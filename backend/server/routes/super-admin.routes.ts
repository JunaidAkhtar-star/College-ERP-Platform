/**
 * @file super-admin.routes.ts
 * @description Routes for SaaS control center operations, including public lead generation
 *              and admin-protected tenant and lead management.
 * @module server/routes
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import type { UploadedFile } from "express-fileupload";
import { authenticate, requireRoles } from "../middlewares";
import { SystemRole } from "../constants/roles";
import { TenantModel, TenantStatus } from "../models/tenant.model";
import { LeadModel, LeadStatus } from "../models/lead.model";
import createError from "http-errors";
import { invalidatePlatformPolicyCache } from "../services/platform-policy.service";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { sendEmail, EmailTemplate } from "../email/email.service";
import { configs } from "../configs";
import { formatIndiaDate } from "../utils/date.util";
import {
  dropTenantDatabase,
  getTenantConnection,
  normalizeTenantId,
  tenantDatabaseName,
} from "../configs/connectionManager";
import {
  ProductModuleModel,
  ProductAddonModel,
  PlatformProductModel,
  PublicSiteConfigModel,
  SubscriptionPlanModel,
} from "../models/platform.model";
import { PlatformBillingRecordModel } from "../models/platform-billing.model";
import {
  approveOfflinePlatformPayment,
  applyCouponToPlatformOrder,
  createPlatformOrder,
  ensurePlatformBillingLineItems,
  generatePlatformBillingPdf,
  rejectOfflinePlatformPayment,
} from "../services/platform-billing.service";
import { PlatformBillingSettingsModel } from "../models/platform-billing-settings.model";
import { PlatformCouponModel } from "../models/platform-coupon.model";
import { platformIntegrationService } from "../services/platform-integration.service";
import { provisionPendingCheckoutForTenant } from "../services/tenant-provisioning.service";
import { type PlatformIntegrationProvider } from "../models/platform-integration.model";
import { auditLogRepository } from "../repositories/audit-log.repository";
import crypto from "crypto";
import { PublicCheckoutModel } from "../models/public-checkout.model";
import { CheckoutAgreementModel } from "../models/checkout-agreement.model";
import {
  checkoutAgreementDocuments,
  generateAgreementPreviewPdfs,
  generateAcceptedAgreementPdfs,
} from "../services/checkout-agreement.service";
import { cryptoUtil } from "../utils/crypto.util";
import { notificationService } from "../services/notification.service";
import { NotificationAudience, NotificationChannel, NotificationType } from "../models";
import { UserModel } from "../models/user.model";
import rateLimit from "express-rate-limit";
import { uploadUtil } from "../utils/upload.util";

const router = Router();
const publicCheckoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: "CHECKOUT_RATE_LIMITED", message: "Too many checkout attempts. Try later." },
  },
});
const publicCheckoutStatusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "CHECKOUT_STATUS_RATE_LIMITED",
      message: "Status refresh is temporarily limited.",
    },
  },
});
const publicCheckoutOtpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "CHECKOUT_OTP_RATE_LIMITED",
      message: "Too many verification-code requests. Try again later.",
    },
  },
});
const requireSuperAdmin = requireRoles([SystemRole.SUPER_ADMIN]);
const platformIntegrationProviders = new Set<PlatformIntegrationProvider>([
  "google_drive",
  "agora",
  "firebase",
  "smtp",
  "cloudinary",
]);

function normalizePlatformCompanyName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/devvelocity/gi, "Devvelocity");
}

function platformIntegrationProvider(value: string): PlatformIntegrationProvider {
  if (!platformIntegrationProviders.has(value as PlatformIntegrationProvider)) {
    throw createError(404, "Platform integration provider not found.");
  }
  return value as PlatformIntegrationProvider;
}

async function validateModuleSlugs(value: unknown): Promise<string[]> {
  if (!Array.isArray(value) || value.length === 0) {
    throw createError(400, "A subscription plan must include at least one product module.");
  }
  const slugs = [...new Set(value.map((item) => String(item).trim().toLowerCase()))];
  const count = await ProductModuleModel.countDocuments({
    slug: { $in: slugs },
    status: "active",
  });
  if (count !== slugs.length) {
    throw createError(400, "One or more plan modules are missing or not active.");
  }
  return slugs;
}

async function allActiveModuleSlugs(): Promise<string[]> {
  const modules = await ProductModuleModel.find({ status: "active" }).select("slug").lean();
  if (modules.length === 0) throw createError(409, "No active product modules are configured.");
  return modules.map((productModule) => productModule.slug);
}

async function measureAllTenantUsage() {
  const [tenants, plans] = await Promise.all([
    TenantModel.find().sort({ createdAt: -1 }).lean().exec(),
    SubscriptionPlanModel.find().select("name slug").lean().exec(),
  ]);
  const planNames = new Map(plans.map((plan) => [String(plan._id), plan.name]));
  return Promise.all(
    tenants.map(async (tenant) => {
      const base = {
        tenantId: String(tenant._id),
        planName: tenant.planId ? planNames.get(String(tenant.planId)) : undefined,
        enabledModuleCount: tenant.enabledModuleSlugs.length,
        measuredAt: new Date(),
      };
      // Registration reserves a database name in the master tenant registry, but
      // the physical tenant database must not be touched until payment/free-tier
      // approval has explicitly moved the tenant into provisioning. Calling
      // getTenantConnection() registers Mongoose models and can auto-create
      // collections, so pending tenants must return before that call.
      if (
        ![
          TenantStatus.PROVISIONING,
          TenantStatus.ACTIVE,
          TenantStatus.SUSPENDED,
          TenantStatus.EXPIRED,
          TenantStatus.PROVISIONING_FAILED,
        ].includes(tenant.status)
      ) {
        return { ...base, students: 0, employees: 0, databaseReachable: false };
      }
      try {
        const connection = getTenantConnection(tenant.tenantId, tenant.databaseName);
        const User = connection.models.User;
        if (!User) throw new Error("Tenant user model is unavailable");
        const [students, employees] = await Promise.all([
          User.countDocuments({ roles: SystemRole.STUDENT, status: "active" }),
          User.countDocuments({
            roles: {
              $elemMatch: {
                $nin: [SystemRole.STUDENT, SystemRole.PARENT, SystemRole.SUPER_ADMIN],
              },
            },
            status: "active",
          }),
        ]);
        return { ...base, students, employees, databaseReachable: true };
      } catch {
        return { ...base, students: 0, employees: 0, databaseReachable: false };
      }
    }),
  );
}

router.get("/public-catalog", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [products, modules, plans, addons, site] = await Promise.all([
      PlatformProductModel.find({ isPublic: true, status: { $ne: "retired" } })
        .sort({ sortOrder: 1, name: 1 })
        .lean()
        .exec(),
      ProductModuleModel.find({ isPublic: true }).sort({ sortOrder: 1, name: 1 }).lean().exec(),
      SubscriptionPlanModel.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean().exec(),
      ProductAddonModel.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean().exec(),
      PublicSiteConfigModel.findOne().lean().exec(),
    ]);
    res.status(200).json({
      success: true,
      data: { products, modules, plans, addons, site },
    });
  } catch (error) {
    next(error);
  }
});

const checkoutTokenHash = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");
const checkoutOtpHash = (otp: string, salt: string) =>
  crypto.scryptSync(otp, salt, 64).toString("hex");
const secureOtpEqual = (actual: string, expected: string) => {
  const actualBuffer = Buffer.from(actual, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return (
    actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  );
};

const publicCheckoutWebsiteUrl = (): string => configs.PLATFORM_WEBSITE_URL.replace(/\/$/, "");

const generateCheckoutAdminPassword = () => `Dvl!${crypto.randomBytes(9).toString("base64url")}9aA`;
const checkoutRequestHash = (requestId: string) =>
  crypto.createHash("sha256").update(requestId).digest("hex");

async function notifyPlatformAdminsOfPublicRegistration(input: {
  institutionName: string;
  tenantId: string;
  adminEmail: string;
  planName: string;
  billingStatus: string;
}) {
  const admins = await UserModel.find({ roles: SystemRole.SUPER_ADMIN, status: "active" })
    .select("_id")
    .lean();
  if (!admins.length) return;
  const title = "New public tenant registration";
  const body = `${input.institutionName} (${input.tenantId}) registered for ${input.planName}. Billing status: ${input.billingStatus.replace("_", " ")}. Administrator: ${input.adminEmail}.`;
  const targetUserIds = admins.map((admin) => String(admin._id));
  await notificationService.create({
    title,
    body,
    type: NotificationType.SYSTEM,
    channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
    audience: NotificationAudience.SPECIFIC_USER,
    targetUserIds,
    // Remains compatible with deployments whose notification sender field is
    // still an ObjectId while targeting every platform administrator.
    createdBy: targetUserIds[0],
    createdByName: "Public checkout",
  });
}

router.post("/public-checkout/register", publicCheckoutLimiter, async (req, res, next) => {
  let createdTenantId: string | undefined;
  try {
    const { tenantId, institutionName, adminEmail, planId, couponCode, addonSlugs, productSlug } =
      req.body;
    const requestId = String(req.body.requestId ?? "").trim();
    if (!tenantId || !institutionName || !adminEmail || !planId)
      throw createError(400, "Institution, administrator and plan details are required.");
    const normalizedInstitutionName = String(institutionName).trim();
    const normalizedEmail = String(adminEmail).toLowerCase().trim();
    const rawTenantId = String(tenantId).trim().toLowerCase();
    if (normalizedInstitutionName.length < 2 || normalizedInstitutionName.length > 150)
      throw createError(422, "Institution name must contain 2–150 characters.");
    if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(rawTenantId))
      throw createError(
        422,
        "Workspace address must contain 3–40 lowercase letters, numbers or hyphens.",
      );
    if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))
      throw createError(400, "A valid administrator email is required.");
    if (requestId && !/^[A-Za-z0-9_-]{20,100}$/.test(requestId))
      throw createError(400, "The registration request ID is invalid.");
    const effectiveRequestId = requestId || crypto.randomUUID();
    const requestHash = checkoutRequestHash(effectiveRequestId);
    const previousCheckout = requestId
      ? await PublicCheckoutModel.findOne({ registrationRequestHash: requestHash })
          .select("+registrationRecoveryCiphertext")
          .lean()
      : null;
    if (previousCheckout) {
      if (
        String(previousCheckout.planId) !== String(planId) ||
        previousCheckout.adminEmail !== normalizedEmail
      )
        throw createError(409, "This registration request was already used with other details.");
      const previousPlan = await SubscriptionPlanModel.findById(previousCheckout.planId).lean();
      if (previousPlan?.planType === "free" && previousCheckout.registrationRecoveryCiphertext) {
        res.status(200).json({
          success: true,
          data: {
            sessionId: String(previousCheckout._id),
            sessionToken: cryptoUtil.decrypt(previousCheckout.registrationRecoveryCiphertext),
            status: "agreement_required",
            adminEmail: previousCheckout.adminEmail,
          },
          message: "Your existing registration was resumed safely.",
        });
        return;
      }
      if (previousCheckout.paymentEmailSentAt) {
        res.status(200).json({
          success: true,
          data: {
            status: "payment_email_sent",
            adminEmail: previousCheckout.adminEmail,
            expiresAt: previousCheckout.expiresAt,
          },
          message: "Registration was already received. The private payment link was sent.",
        });
        return;
      }
      throw createError(409, "This registration is still processing. Please wait and retry.");
    }
    const adminPassword = generateCheckoutAdminPassword();
    const normalizedTenantId = normalizeTenantId(rawTenantId);
    const plan = await SubscriptionPlanModel.findOne({ _id: planId, isActive: true }).lean();
    if (!plan) throw createError(404, "Selected plan is unavailable.");
    if (productSlug && plan.productSlug !== String(productSlug).trim().toLowerCase())
      throw createError(400, "Selected plan does not belong to this product.");
    const cycle = "year";
    const available = plan.availableBillingPeriods?.length
      ? plan.availableBillingPeriods
      : [plan.billingPeriod];
    if (plan.planType === "paid" && !available.includes(cycle))
      throw createError(400, "Selected billing cycle is unavailable for this plan.");
    const databaseName = tenantDatabaseName(normalizedTenantId);
    if (
      await TenantModel.exists({
        $or: [
          { tenantId: normalizedTenantId },
          { databaseName },
          { billingEmail: normalizedEmail },
        ],
      })
    )
      throw createError(409, "This institution, workspace ID or billing email is registered.");

    const isFree = plan.planType === "free";
    const requestedAddonSlugs = isFree
      ? []
      : [
          ...new Set(
            (Array.isArray(addonSlugs) ? addonSlugs : []).map((slug) =>
              String(slug).trim().toLowerCase(),
            ),
          ),
        ].filter(Boolean);
    const expiresAt = new Date(
      Date.now() + (isFree ? Math.max(1, plan.trialDays) : 1) * 24 * 60 * 60 * 1000,
    );
    const tenant = await TenantModel.create({
      tenantId: normalizedTenantId,
      name: normalizedInstitutionName,
      databaseName,
      status: isFree ? TenantStatus.PENDING_APPROVAL : TenantStatus.PENDING_PAYMENT,
      subscriptionExpiresAt: expiresAt,
      planId: plan._id,
      enabledModuleSlugs: plan.moduleSlugs,
      entitlementEnforced: true,
      maxStudents: plan.studentLimit,
      maxEmployees: plan.employeeLimit,
      billingEmail: normalizedEmail,
      billingStatus: isFree ? "pending_approval" : "pending_payment",
      trialEndsAt: isFree ? expiresAt : undefined,
      enabledAddonSlugs: plan.includedAddonSlugs,
    });
    createdTenantId = String(tenant._id);
    const sessionToken = crypto.randomBytes(32).toString("base64url");
    const checkout = await PublicCheckoutModel.create({
      tenantId: tenant._id,
      planId: plan._id,
      sessionTokenHash: checkoutTokenHash(sessionToken),
      registrationRequestHash: requestHash,
      registrationRecoveryCiphertext: cryptoUtil.encrypt(sessionToken),
      adminEmail: normalizedEmail,
      adminPasswordCiphertext: cryptoUtil.encrypt(adminPassword),
      billingPeriod: cycle,
      addonSlugs: requestedAddonSlugs,
      couponCode: couponCode ? String(couponCode).trim().toUpperCase() : undefined,
      status: "pending_payment",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    if (isFree) {
      await PlatformBillingRecordModel.create({
        tenantId: tenant._id,
        checkoutId: checkout._id,
        planId: plan._id,
        addonSlugs: [],
        lineItems: [
          {
            kind: "plan",
            slug: plan.slug,
            description: `${plan.name} registration`,
            billingLabel: "Free tier — payment not required",
            amountInPaise: 0,
          },
        ],
        invoiceNumber: `FREE-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
        amountInPaise: 0,
        subtotalInPaise: 0,
        taxRatePercent: 0,
        taxAmountInPaise: 0,
        listPriceInPaise: 0,
        discountInPaise: 0,
        currency: "INR",
        status: "created",
        paymentMethod: "bank_transfer",
        billingEmail: checkout.adminEmail,
        billingPeriod: cycle,
        purchaseKind: "plan",
        licensedUserCount: Math.max(1, plan.minimumBillableUsers),
      });
      void notifyPlatformAdminsOfPublicRegistration({
        institutionName: tenant.name,
        tenantId: tenant.tenantId,
        adminEmail: checkout.adminEmail,
        planName: plan.name,
        billingStatus: tenant.billingStatus,
      }).catch((error) =>
        console.error("[PublicCheckout] Platform admin notification failed", error),
      );
      res.status(202).json({
        success: true,
        data: {
          sessionId: String(checkout._id),
          sessionToken,
          status: "agreement_required",
          adminEmail: checkout.adminEmail,
        },
      });
      return;
    }
    const order = await createPlatformOrder({
      tenantId: String(tenant._id),
      checkoutId: String(checkout._id),
      planId: String(plan._id),
      addonSlugs: requestedAddonSlugs,
      billingPeriod: cycle,
      couponCode: checkout.couponCode,
    });
    const websiteUrl = publicCheckoutWebsiteUrl();
    const paymentLink = `${websiteUrl}/checkout#sessionId=${encodeURIComponent(String(checkout._id))}&token=${encodeURIComponent(sessionToken)}`;
    const publicSite = await PublicSiteConfigModel.findOne().lean().exec();
    const platformLogoPath = path.resolve(process.cwd(), "public", "devvelocitylogo-email.png");
    const hasEmbeddedPlatformLogo = fs.existsSync(platformLogoPath);
    await sendEmail({
      to: checkout.adminEmail,
      subject: `Complete payment for ${tenant.name} — ${order.invoiceNumber}`,
      template: EmailTemplate.PLATFORM_PAYMENT_REQUEST,
      throwOnFailure: true,
      branding: {
        instituteName: publicSite?.companyName || configs.APP_NAME,
        tagline: publicSite?.headline,
        emailSenderName: publicSite?.companyName || configs.APP_NAME,
        email: publicSite?.supportEmail,
        replyToEmail: publicSite?.supportEmail,
        phone: publicSite?.phone,
        address: publicSite?.address,
        websiteUrl: configs.PLATFORM_WEBSITE_URL,
        websiteUrlShort: configs.PLATFORM_WEBSITE_URL.replace(/^https?:\/\/(www\.)?/, ""),
        logoUrl: hasEmbeddedPlatformLogo
          ? "cid:devvelocity-platform-logo"
          : configs.PLATFORM_LOGO_URL,
      },
      attachments: hasEmbeddedPlatformLogo
        ? [
            {
              filename: "devvelocity-logo.png",
              path: platformLogoPath,
              contentType: "image/png",
              cid: "devvelocity-platform-logo",
            },
          ]
        : undefined,
      context: {
        institutionName: tenant.name,
        planName: plan.name,
        invoiceNumber: order.invoiceNumber,
        amount: `₹${(order.amount / 100).toLocaleString("en-IN")}`,
        paymentLink,
      },
    });
    checkout.paymentEmailSentAt = new Date();
    await checkout.save();
    void notifyPlatformAdminsOfPublicRegistration({
      institutionName: tenant.name,
      tenantId: tenant.tenantId,
      adminEmail: checkout.adminEmail,
      planName: plan.name,
      billingStatus: tenant.billingStatus,
    }).catch((error) =>
      console.error("[PublicCheckout] Platform admin notification failed", error),
    );
    res.status(201).json({
      success: true,
      data: {
        status: "payment_email_sent",
        adminEmail: checkout.adminEmail,
        expiresAt: checkout.expiresAt,
      },
    });
  } catch (error) {
    if (createdTenantId) {
      const claimedCoupons = await PlatformBillingRecordModel.find({
        tenantId: createdTenantId,
        status: { $in: ["created", "rejected"] },
        couponCode: { $exists: true },
      })
        .select("couponCode")
        .lean();
      await Promise.all([
        TenantModel.deleteOne({
          _id: createdTenantId,
          status: { $in: [TenantStatus.PENDING_PAYMENT, TenantStatus.PENDING_APPROVAL] },
        }),
        PublicCheckoutModel.deleteOne({ tenantId: createdTenantId }),
        PlatformBillingRecordModel.deleteMany({
          tenantId: createdTenantId,
          status: "created",
          paymentMethod: "bank_transfer",
        }),
        ...claimedCoupons.map((record) =>
          PlatformCouponModel.updateOne(
            { code: record.couponCode, redemptionCount: { $gt: 0 } },
            { $inc: { redemptionCount: -1 } },
          ),
        ),
      ]);
    }
    next(error);
  }
});

router.post("/public-checkout/free-tier-submit", publicCheckoutLimiter, async (req, res, next) => {
  try {
    const checkout = await PublicCheckoutModel.findOne({
      _id: req.body.sessionId,
      sessionTokenHash: checkoutTokenHash(String(req.body.sessionToken ?? "")),
      status: { $in: ["pending_payment", "awaiting_payment_review"] },
      expiresAt: { $gt: new Date() },
    });
    if (!checkout) throw createError(404, "Checkout session is invalid or expired.");
    const plan = await SubscriptionPlanModel.findById(checkout.planId).lean();
    if (!plan || plan.planType !== "free")
      throw createError(409, "This approval path is only available for free-tier registrations.");
    if (checkout.status === "awaiting_payment_review") {
      const submitted = await PlatformBillingRecordModel.findOne({
        checkoutId: checkout._id,
        amountInPaise: 0,
        status: "submitted",
      }).lean();
      if (!submitted) throw createError(409, "The existing approval request is inconsistent.");
      res.status(200).json({
        success: true,
        data: { status: "awaiting_payment_review", invoiceNumber: submitted.invoiceNumber },
        message: "This approval request was already submitted successfully.",
      });
      return;
    }
    const documents = checkoutAgreementDocuments();
    const acceptedAgreement = await CheckoutAgreementModel.exists({
      checkoutId: checkout._id,
      tenantId: checkout.tenantId,
      acceptedAt: { $exists: true },
      ndaVersion: documents.nda.version,
      ndaHash: documents.nda.hash,
      termsVersion: documents.terms.version,
      termsHash: documents.terms.hash,
      signatoryAuthorityConfirmed: true,
      ndaAccepted: true,
      termsAccepted: true,
    });
    if (!acceptedAgreement)
      throw createError(403, "Verify the NDA and Terms before submitting for approval.");
    const now = new Date();
    const record = await PlatformBillingRecordModel.findOneAndUpdate(
      {
        checkoutId: checkout._id,
        tenantId: checkout.tenantId,
        status: { $in: ["created", "rejected"] },
        amountInPaise: 0,
      },
      { $set: { status: "submitted", submittedAt: now } },
      { returnDocument: "after" },
    );
    if (!record) throw createError(409, "Free-tier approval request is already submitted.");
    checkout.status = "awaiting_payment_review";
    await checkout.save();
    const tenant = await TenantModel.findById(checkout.tenantId).select("name tenantId").lean();
    void notifyPlatformAdminsOfPublicRegistration({
      institutionName: tenant?.name || "Free-tier registration",
      tenantId: tenant?.tenantId || String(checkout.tenantId),
      adminEmail: checkout.adminEmail,
      planName: plan.name,
      billingStatus: "awaiting_admin_approval",
    }).catch((error) =>
      console.error("[PublicCheckout] Free-tier approval notification failed", error),
    );
    res.status(202).json({
      success: true,
      data: { status: "awaiting_payment_review", invoiceNumber: record.invoiceNumber },
      message: "Agreement accepted. The free-tier workspace is awaiting administrator approval.",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/public-checkout/session", publicCheckoutLimiter, async (req, res, next) => {
  try {
    const checkout = await PublicCheckoutModel.findOne({
      _id: req.body.sessionId,
      sessionTokenHash: checkoutTokenHash(String(req.body.sessionToken ?? "")),
      expiresAt: { $gt: new Date() },
    }).lean();
    if (!checkout) throw createError(404, "Payment link is invalid or has expired.");
    const [initialRecord, tenant, billingSettings] = await Promise.all([
      PlatformBillingRecordModel.findOne({
        $or: [
          { checkoutId: checkout._id },
          { tenantId: checkout.tenantId, planId: checkout.planId, purchaseKind: "plan" },
        ],
        paymentMethod: "bank_transfer",
      })
        .sort({ createdAt: -1 })
        .lean(),
      TenantModel.findById(checkout.tenantId).select("name billingEmail").lean(),
      PlatformBillingSettingsModel.findOne({ isEnabled: true }).sort({ updatedAt: -1 }).lean(),
    ]);
    let record = initialRecord;
    if (!tenant) throw createError(404, "Registered institution was not found.");
    if (
      !billingSettings &&
      checkout.status === "pending_payment" &&
      (record?.amountInPaise ?? 0) > 0
    )
      throw createError(503, "Invoice billing is temporarily unavailable.");
    if (!record && checkout.status === "pending_payment") {
      try {
        const recovered = await createPlatformOrder({
          tenantId: String(checkout.tenantId),
          checkoutId: String(checkout._id),
          planId: String(checkout.planId),
          addonSlugs: checkout.addonSlugs,
          billingPeriod: checkout.billingPeriod,
          couponCode: checkout.couponCode,
        });
        record = await PlatformBillingRecordModel.findById(recovered.billingId).lean();
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        record = await PlatformBillingRecordModel.findOne({ checkoutId: checkout._id }).lean();
      }
    }
    if (!record) throw createError(404, "Payment invoice was not found.");
    const lineItems = await ensurePlatformBillingLineItems(String(record._id));
    const agreementDocuments = checkoutAgreementDocuments();
    const agreementAccepted = Boolean(
      await CheckoutAgreementModel.exists({
        checkoutId: checkout._id,
        tenantId: checkout.tenantId,
        acceptedAt: { $exists: true },
        ndaVersion: agreementDocuments.nda.version,
        ndaHash: agreementDocuments.nda.hash,
        termsVersion: agreementDocuments.terms.version,
        termsHash: agreementDocuments.terms.hash,
        signatoryAuthorityConfirmed: true,
        ndaAccepted: true,
        termsAccepted: true,
      }),
    );
    res.json({
      success: true,
      data: {
        sessionId: String(checkout._id),
        status: checkout.status,
        error: checkout.error,
        paymentRequired: record.amountInPaise > 0,
        agreementAccepted,
        adminEmail: checkout.adminEmail,
        order: billingSettings
          ? {
              billingId: record._id,
              amount: record.amountInPaise,
              listPrice: record.listPriceInPaise ?? record.subtotalInPaise ?? record.amountInPaise,
              discount: record.discountInPaise ?? 0,
              annualDiscount: Math.max(
                0,
                (record.discountInPaise ?? 0) - (record.couponDiscountInPaise ?? 0),
              ),
              lineItems,
              couponCode: record.couponCode,
              couponDiscount: record.couponDiscountInPaise ?? 0,
              subtotal: record.subtotalInPaise ?? record.amountInPaise,
              taxRatePercent: record.taxRatePercent ?? 0,
              taxAmount: record.taxAmountInPaise ?? 0,
              currency: record.currency,
              invoiceNumber: record.invoiceNumber,
              tenantName: tenant.name,
              billingEmail: tenant.billingEmail,
              paymentMethod: "bank_transfer",
              bankTransfer: {
                accountHolderName: billingSettings.accountHolderName,
                bankName: billingSettings.bankName,
                accountNumber: billingSettings.accountNumber,
                ifscCode: billingSettings.ifscCode,
                branch: billingSettings.branch,
                upiId: billingSettings.upiId,
                instructions: billingSettings.instructions,
              },
            }
          : undefined,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/public-checkout/apply-coupon", publicCheckoutLimiter, async (req, res, next) => {
  try {
    const checkout = await PublicCheckoutModel.findOne({
      _id: req.body.sessionId,
      sessionTokenHash: checkoutTokenHash(String(req.body.sessionToken ?? "")),
      status: "pending_payment",
      expiresAt: { $gt: new Date() },
    }).lean();
    if (!checkout) throw createError(404, "Payment link is invalid or has expired.");
    const record = await PlatformBillingRecordModel.findOne({
      checkoutId: checkout._id,
      tenantId: checkout.tenantId,
      status: "created",
    }).lean();
    if (!record) throw createError(404, "Reserved payment invoice was not found.");
    const updated = await applyCouponToPlatformOrder({
      recordId: String(record._id),
      tenantId: String(checkout.tenantId),
      couponCode: String(req.body.couponCode ?? ""),
    });
    res.json({
      success: true,
      data: {
        amount: updated.amountInPaise,
        listPrice: updated.listPriceInPaise ?? updated.subtotalInPaise ?? updated.amountInPaise,
        discount: updated.discountInPaise ?? 0,
        annualDiscount: Math.max(
          0,
          (updated.discountInPaise ?? 0) - (updated.couponDiscountInPaise ?? 0),
        ),
        lineItems: updated.lineItems ?? [],
        couponCode: updated.couponCode,
        couponDiscount: updated.couponDiscountInPaise ?? 0,
        subtotal: updated.subtotalInPaise ?? updated.amountInPaise,
        taxRatePercent: updated.taxRatePercent ?? 0,
        taxAmount: updated.taxAmountInPaise ?? 0,
      },
      message: "Coupon applied to the reserved invoice.",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/public-checkout/agreements", publicCheckoutLimiter, async (req, res, next) => {
  try {
    const checkout = await PublicCheckoutModel.findOne({
      _id: req.body.sessionId,
      sessionTokenHash: checkoutTokenHash(String(req.body.sessionToken ?? "")),
      status: "pending_payment",
      expiresAt: { $gt: new Date() },
    }).lean();
    if (!checkout) throw createError(404, "Checkout session is invalid or expired.");
    const documents = checkoutAgreementDocuments();
    const tenant = await TenantModel.findById(checkout.tenantId).select("name").lean();
    const previewDocuments = await generateAgreementPreviewPdfs(tenant?.name || "Your institution");
    const acceptance = await CheckoutAgreementModel.findOne({
      checkoutId: checkout._id,
      ndaVersion: documents.nda.version,
      ndaHash: documents.nda.hash,
      termsVersion: documents.terms.version,
      termsHash: documents.terms.hash,
    })
      .select("acceptedAt acceptanceId otpVerifiedAt email")
      .lean();
    const maskedEmail = checkout.adminEmail.replace(
      /^(.{1,2}).*(@.*)$/,
      (_match, start: string, domain: string) => `${start}••••${domain}`,
    );
    res.json({
      success: true,
      data: {
        documents: previewDocuments,
        accepted: Boolean(acceptance?.acceptedAt),
        acceptanceId: acceptance?.acceptanceId,
        verifiedAt: acceptance?.otpVerifiedAt,
        maskedEmail,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/public-checkout/agreement/send-otp",
  publicCheckoutOtpLimiter,
  async (req, res, next) => {
    try {
      const now = new Date();
      const checkout = await PublicCheckoutModel.findOne({
        _id: req.body.sessionId,
        sessionTokenHash: checkoutTokenHash(String(req.body.sessionToken ?? "")),
        status: "pending_payment",
        expiresAt: { $gt: now },
      }).lean();
      if (!checkout) throw createError(404, "Checkout session is invalid or expired.");
      const signatoryName = String(req.body.signatoryName ?? "").trim();
      const signatoryDesignation = String(req.body.signatoryDesignation ?? "").trim();
      if (signatoryName.length < 2 || signatoryName.length > 120)
        throw createError(400, "Enter the authorized signatory's full name.");
      if (signatoryDesignation.length < 2 || signatoryDesignation.length > 120)
        throw createError(400, "Enter the authorized signatory's designation.");
      if (
        req.body.ndaAccepted !== true ||
        req.body.termsAccepted !== true ||
        req.body.signatoryAuthorityConfirmed !== true
      )
        throw createError(400, "Accept both documents and confirm signatory authority.");
      const documents = checkoutAgreementDocuments();
      const existing = await CheckoutAgreementModel.findOne({
        checkoutId: checkout._id,
        ndaVersion: documents.nda.version,
        termsVersion: documents.terms.version,
      }).lean();
      if (existing?.acceptedAt)
        return res.json({
          success: true,
          data: { accepted: true, acceptanceId: existing.acceptanceId },
          message: "The agreements are already accepted.",
        });
      if (existing?.otpSentAt && now.getTime() - new Date(existing.otpSentAt).getTime() < 60 * 1000)
        throw createError(429, "Wait 60 seconds before requesting another verification code.");

      const otp = String(crypto.randomInt(100_000, 1_000_000));
      const otpSalt = crypto.randomBytes(24).toString("hex");
      const otpHash = checkoutOtpHash(otp, otpSalt);
      const otpExpiresAt = new Date(now.getTime() + 5 * 60 * 1000);
      const tenant = await TenantModel.findById(checkout.tenantId).select("name").lean();
      const agreementLogoPath = path.resolve(process.cwd(), "public", "devvelocitylogo-email.png");
      const hasAgreementLogo = fs.existsSync(agreementLogoPath);
      await sendEmail({
        to: checkout.adminEmail,
        subject: "Verify your Devvelocity agreement acceptance",
        template: EmailTemplate.AGREEMENT_VERIFICATION,
        context: {
          recipientName: signatoryName,
          institutionName: tenant?.name || "your institution",
          otp,
        },
        branding: {
          instituteName: "Devvelocity",
          tagline: "Modern software products and engineering services",
          websiteUrl: configs.PLATFORM_WEBSITE_URL,
          websiteUrlShort: configs.PLATFORM_WEBSITE_URL.replace(/^https?:\/\/(www\.)?/, ""),
          logoUrl: hasAgreementLogo ? "cid:devvelocity-agreement-logo" : configs.PLATFORM_LOGO_URL,
          emailSenderName: "Devvelocity",
        },
        attachments: hasAgreementLogo
          ? [
              {
                filename: "devvelocity-logo.png",
                path: agreementLogoPath,
                contentType: "image/png",
                cid: "devvelocity-agreement-logo",
              },
            ]
          : undefined,
        priority: "high",
        throwOnFailure: true,
      });
      await CheckoutAgreementModel.findOneAndUpdate(
        {
          checkoutId: checkout._id,
          ndaVersion: documents.nda.version,
          termsVersion: documents.terms.version,
          acceptedAt: { $exists: false },
        },
        {
          $set: {
            tenantId: checkout.tenantId,
            email: checkout.adminEmail,
            ndaVersion: documents.nda.version,
            ndaHash: documents.nda.hash,
            ndaTitle: documents.nda.title,
            ndaSections: documents.nda.sections,
            termsVersion: documents.terms.version,
            termsHash: documents.terms.hash,
            termsTitle: documents.terms.title,
            termsSections: documents.terms.sections,
            signatoryName,
            signatoryDesignation,
            signatoryAuthorityConfirmed: true,
            ndaAccepted: true,
            termsAccepted: true,
            otpHash,
            otpSalt,
            otpExpiresAt,
            otpSentAt: now,
            otpAttempts: 0,
            userAgent: String(req.get("user-agent") ?? "").slice(0, 500),
          },
          $unset: {
            otpVerifiedAt: 1,
            acceptanceId: 1,
            ipAddressCiphertext: 1,
          },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
      );
      res.json({
        success: true,
        data: { sent: true, expiresInSeconds: 300 },
        message: "A verification code was sent to the registered billing email.",
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/public-checkout/agreement/verify-otp",
  publicCheckoutLimiter,
  async (req, res, next) => {
    try {
      const now = new Date();
      const checkout = await PublicCheckoutModel.findOne({
        _id: req.body.sessionId,
        sessionTokenHash: checkoutTokenHash(String(req.body.sessionToken ?? "")),
        status: "pending_payment",
        expiresAt: { $gt: now },
      }).lean();
      if (!checkout) throw createError(404, "Checkout session is invalid or expired.");
      const otp = String(req.body.otp ?? "").trim();
      if (!/^\d{6}$/.test(otp)) throw createError(400, "Enter the six-digit verification code.");
      const documents = checkoutAgreementDocuments();
      const acceptance = await CheckoutAgreementModel.findOne({
        checkoutId: checkout._id,
        ndaVersion: documents.nda.version,
        termsVersion: documents.terms.version,
      }).select("+otpHash +otpSalt");
      if (!acceptance?.otpHash || !acceptance.otpSalt || !acceptance.otpExpiresAt)
        throw createError(400, "Request a new verification code.");
      if (acceptance.acceptedAt)
        return res.json({
          success: true,
          data: { accepted: true, acceptanceId: acceptance.acceptanceId },
        });
      if (acceptance.otpAttempts >= 5)
        throw createError(429, "Too many incorrect attempts. Request a new verification code.");
      if (acceptance.otpExpiresAt <= now)
        throw createError(400, "The verification code has expired.");
      const matches = secureOtpEqual(checkoutOtpHash(otp, acceptance.otpSalt), acceptance.otpHash);
      if (!matches) {
        acceptance.otpAttempts += 1;
        await acceptance.save();
        throw createError(400, "The verification code is incorrect.");
      }
      if (
        acceptance.ndaHash !== documents.nda.hash ||
        acceptance.termsHash !== documents.terms.hash ||
        acceptance.ndaVersion !== documents.nda.version ||
        acceptance.termsVersion !== documents.terms.version
      )
        throw createError(409, "The agreement documents changed. Review and accept them again.");
      acceptance.otpVerifiedAt = now;
      acceptance.acceptedAt = now;
      acceptance.acceptanceId = `DVA-${now.getUTCFullYear()}-${crypto.randomUUID().toUpperCase()}`;
      acceptance.ipAddressCiphertext = cryptoUtil.encrypt(
        String(req.ip || req.socket.remoteAddress || "unavailable"),
      );
      acceptance.otpHash = undefined;
      acceptance.otpSalt = undefined;
      acceptance.otpExpiresAt = undefined;
      await acceptance.save();
      const tenant = await TenantModel.findById(checkout.tenantId).select("name").lean();
      const paymentRequired = await PlatformBillingRecordModel.exists({
        checkoutId: checkout._id,
        amountInPaise: { $gt: 0 },
      });
      if (!paymentRequired) {
        const acceptedDocuments = await generateAcceptedAgreementPdfs({
          checkoutId: String(checkout._id),
          tenantName: tenant?.name || "Your institution",
        });
        await sendEmail({
          to: checkout.adminEmail,
          subject: `Devvelocity agreements accepted — ${acceptance.acceptanceId}`,
          template: EmailTemplate.AGREEMENT_ACCEPTED,
          context: {
            recipientName: acceptance.signatoryName,
            institutionName: tenant?.name || "Your institution",
            acceptanceId: acceptance.acceptanceId,
          },
          branding: {
            instituteName: "Devvelocity",
            tagline: "Modern software products and engineering services",
            websiteUrl: configs.PLATFORM_WEBSITE_URL,
            websiteUrlShort: configs.PLATFORM_WEBSITE_URL.replace(/^https?:\/\/(www\.)?/, ""),
            emailSenderName: "Devvelocity",
          },
          attachments: acceptedDocuments,
        });
      }
      res.json({
        success: true,
        data: {
          accepted: true,
          acceptanceId: acceptance.acceptanceId,
          acceptedAt: acceptance.acceptedAt,
        },
        message: "Agreement acceptance verified successfully.",
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post("/public-checkout/payment-proof", publicCheckoutLimiter, async (req, res, next) => {
  try {
    const { sessionId, sessionToken, transferReference, paymentDate, paymentChannel } = req.body;
    const normalizedChannel = String(paymentChannel ?? "").toLowerCase();
    if (!["neft", "rtgs", "imps", "upi"].includes(normalizedChannel))
      throw createError(400, "Select NEFT, RTGS, IMPS or UPI as the payment method.");
    const normalizedReference = String(transferReference ?? "")
      .trim()
      .toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{7,49}$/.test(normalizedReference))
      throw createError(400, "Enter a valid 8–50 character bank transaction reference.");
    const parsedPaymentDate = new Date(String(paymentDate ?? ""));
    const now = new Date();
    if (
      Number.isNaN(parsedPaymentDate.getTime()) ||
      parsedPaymentDate > now ||
      parsedPaymentDate < new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000)
    )
      throw createError(400, "Payment date must be within the last 45 days.");
    const proof = req.files?.proof;
    if (!proof || Array.isArray(proof))
      throw createError(400, "A PDF or image payment proof is required.");
    const checkout = await PublicCheckoutModel.findOne({
      _id: sessionId,
      sessionTokenHash: checkoutTokenHash(String(sessionToken ?? "")),
      status: { $in: ["pending_payment", "awaiting_payment_review"] },
      expiresAt: { $gt: now },
    }).lean();
    if (!checkout)
      throw createError(404, "Checkout session is invalid, expired or already submitted.");
    if (checkout.status === "awaiting_payment_review") {
      const submitted = await PlatformBillingRecordModel.findOne({
        checkoutId: checkout._id,
        paymentMethod: "bank_transfer",
        transferReference: normalizedReference,
        status: "submitted",
      }).lean();
      if (!submitted)
        throw createError(409, "A different payment confirmation is already under review.");
      res.status(200).json({
        success: true,
        data: { status: "awaiting_payment_review", invoiceNumber: submitted.invoiceNumber },
        message: "This payment confirmation was already submitted successfully.",
      });
      return;
    }
    const documents = checkoutAgreementDocuments();
    const acceptedAgreement = await CheckoutAgreementModel.exists({
      checkoutId: checkout._id,
      tenantId: checkout.tenantId,
      acceptedAt: { $exists: true },
      ndaVersion: documents.nda.version,
      ndaHash: documents.nda.hash,
      termsVersion: documents.terms.version,
      termsHash: documents.terms.hash,
      signatoryAuthorityConfirmed: true,
      ndaAccepted: true,
      termsAccepted: true,
    });
    if (!acceptedAgreement)
      throw createError(
        403,
        "Verify the NDA and Terms acceptance before submitting payment details.",
      );
    const record = await PlatformBillingRecordModel.findOne({
      $or: [
        { checkoutId: checkout._id },
        { tenantId: checkout.tenantId, planId: checkout.planId, purchaseKind: "plan" },
      ],
      paymentMethod: "bank_transfer",
      status: { $in: ["created", "rejected"] },
    }).sort({ createdAt: -1 });
    if (!record) throw createError(404, "Invoice billing record was not found.");
    if (
      await PlatformBillingRecordModel.exists({
        transferReference: normalizedReference,
        _id: { $ne: record._id },
      })
    )
      throw createError(409, "This transaction reference has already been submitted.");
    const uploaded = await uploadUtil.uploadDocument(
      proof as UploadedFile,
      "platform/subscription-payment-proofs",
      { publicId: `payment-${record._id}-${Date.now()}` },
    );
    record.transferReference = normalizedReference;
    record.paymentChannel = normalizedChannel as "neft" | "rtgs" | "imps" | "upi";
    record.paymentDate = parsedPaymentDate;
    record.paymentProofUrl = uploaded.url;
    record.paymentProofPublicId = uploaded.publicId;
    record.paymentProofMimeType = proof.mimetype;
    record.submittedAt = now;
    record.status = "submitted";
    record.reviewRemarks = undefined;
    await record.save();
    await PublicCheckoutModel.updateOne(
      { _id: checkout._id, status: "pending_payment" },
      { $set: { status: "awaiting_payment_review" }, $unset: { error: 1 } },
    );
    await TenantModel.updateOne(
      { _id: checkout.tenantId },
      { $set: { status: TenantStatus.PENDING_APPROVAL, billingStatus: "pending_approval" } },
    );
    void notifyPlatformAdminsOfPublicRegistration({
      institutionName: "Subscription payment submitted",
      tenantId: normalizedReference,
      adminEmail: checkout.adminEmail,
      planName: "invoice review",
      billingStatus: "awaiting_payment_review",
    }).catch((error) =>
      console.error("[PublicCheckout] Payment-review notification failed", error),
    );
    res.status(202).json({
      success: true,
      data: { status: "awaiting_payment_review", invoiceNumber: record.invoiceNumber },
      message: "Payment proof submitted securely for administrator verification.",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/public-checkout/status", publicCheckoutStatusLimiter, async (req, res, next) => {
  try {
    const checkout = await PublicCheckoutModel.findOne({
      _id: req.body.sessionId,
      sessionTokenHash: checkoutTokenHash(String(req.body.sessionToken ?? "")),
      expiresAt: { $gt: new Date() },
    })
      .select("status error tenantId")
      .populate("tenantId", "tenantId")
      .lean();
    if (!checkout) throw createError(404, "Checkout session is invalid or expired.");
    const tenant = checkout.tenantId as unknown as { tenantId?: string };
    res.json({
      success: true,
      data: {
        status: checkout.status,
        error: checkout.error,
        loginUrl:
          checkout.status === "ready" && tenant.tenantId
            ? configs.TENANT_APP_URL_TEMPLATE.replace(
                "{tenant}",
                encodeURIComponent(tenant.tenantId),
              )
            : undefined,
      },
    });
  } catch (error) {
    next(error);
  }
});

/** One-request payload for the platform command-centre dashboard. */
router.get("/overview", authenticate, requireSuperAdmin, async (_req, res, next) => {
  try {
    const [tenants, leads, modules, plans, publicProfile, tenantUsage] = await Promise.all([
      TenantModel.find().sort({ createdAt: -1 }).lean().exec(),
      LeadModel.find().sort({ createdAt: -1 }).lean().exec(),
      ProductModuleModel.find().sort({ sortOrder: 1 }).lean().exec(),
      SubscriptionPlanModel.find().sort({ sortOrder: 1 }).lean().exec(),
      PublicSiteConfigModel.findOne().lean().exec(),
      measureAllTenantUsage(),
    ]);
    res.json({
      success: true,
      data: { tenants, leads, modules, plans, publicProfile, tenantUsage, measuredAt: new Date() },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/product-modules", authenticate, requireSuperAdmin, async (_req, res, next) => {
  try {
    res.json({
      success: true,
      data: await ProductModuleModel.find().sort({ sortOrder: 1 }).lean(),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/products", authenticate, requireSuperAdmin, async (_req, res, next) => {
  try {
    res.json({
      success: true,
      data: await PlatformProductModel.find().sort({ sortOrder: 1, name: 1 }).lean(),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/products", authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const { name, slug, eyebrow, description, status, publicPath, icon, isPublic, sortOrder } =
      req.body;
    if (!name || !eyebrow || !description || !/^[a-z0-9-]+$/.test(String(slug ?? "")))
      throw createError(400, "Product name, slug, eyebrow and description are required.");
    const product = await PlatformProductModel.create({
      name,
      slug,
      eyebrow,
      description,
      status: status ?? "planned",
      publicPath,
      icon: icon || "Package",
      isPublic: isPublic ?? true,
      sortOrder,
    });
    res.status(201).json({ success: true, data: product, message: "Product created." });
  } catch (error) {
    next(error);
  }
});

router.patch("/products/:id", authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const allowed = [
      "name",
      "slug",
      "eyebrow",
      "description",
      "status",
      "publicPath",
      "icon",
      "isPublic",
      "sortOrder",
    ];
    const update = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowed.includes(key)),
    );
    const product = await PlatformProductModel.findByIdAndUpdate(req.params.id, update, {
      returnDocument: "after",
      runValidators: true,
    }).lean();
    if (!product) throw createError(404, "Product not found.");
    res.json({ success: true, data: product, message: "Product updated." });
  } catch (error) {
    next(error);
  }
});

router.post("/product-modules", authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const {
      name,
      slug,
      description,
      icon,
      frontendRoute,
      apiRoute,
      apiRoutes,
      frontendRoutes,
      permissionModule,
      features,
      status,
      sortOrder,
      isPublic,
      tier,
    } = req.body;
    if (!name || !slug || !description || !icon || !frontendRoute || !apiRoute)
      throw createError(400, "All module identity and route fields are required.");
    const module = await ProductModuleModel.create({
      name,
      slug,
      description,
      icon,
      frontendRoute,
      apiRoute,
      apiRoutes: Array.isArray(apiRoutes) ? apiRoutes : [],
      frontendRoutes: Array.isArray(frontendRoutes) ? frontendRoutes : [],
      permissionModule: permissionModule || slug.replace(/-/g, "_"),
      features: Array.isArray(features) ? features : [],
      status,
      sortOrder,
      isPublic,
      tier,
    });
    invalidatePlatformPolicyCache();
    res.status(201).json({ success: true, data: module, message: "Product module created." });
  } catch (error) {
    next(error);
  }
});

router.post("/product-modules/import", authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const modules = Array.isArray(req.body.modules) ? req.body.modules : [];
    if (!modules.length || modules.length > 100) {
      throw createError(400, "Provide between 1 and 100 valid product modules.");
    }
    let imported = 0;
    for (const item of modules) {
      const {
        name,
        slug,
        description,
        icon,
        frontendRoute,
        apiRoute,
        apiRoutes,
        frontendRoutes,
        permissionModule,
        features,
        tier,
      } = item;
      if (!name || !/^[a-z0-9-]+$/.test(slug) || !description || !frontendRoute || !apiRoute) {
        throw createError(400, `Invalid product module payload for '${String(slug)}'.`);
      }
      await ProductModuleModel.updateOne(
        { slug },
        {
          $set: {
            name,
            description,
            icon: icon || "Boxes",
            frontendRoute,
            apiRoute,
            apiRoutes: Array.isArray(apiRoutes) ? apiRoutes : [],
            frontendRoutes: Array.isArray(frontendRoutes) ? frontendRoutes : [],
            permissionModule: permissionModule || slug.replace(/-/g, "_"),
            features: Array.isArray(features) ? features : [],
            status: "active",
            isPublic: true,
            tier: tier || "core",
          },
        },
        { upsert: true, runValidators: true },
      );
      imported++;
    }
    invalidatePlatformPolicyCache();
    res.json({ success: true, data: { imported }, message: `${imported} modules imported.` });
  } catch (error) {
    next(error);
  }
});

router.patch("/product-modules/:id", authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const allowed = [
      "name",
      "slug",
      "description",
      "icon",
      "frontendRoute",
      "apiRoute",
      "apiRoutes",
      "frontendRoutes",
      "permissionModule",
      "features",
      "status",
      "sortOrder",
      "meetingLimitBoost",
      "isPublic",
      "tier",
    ];
    const update = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowed.includes(key)),
    );
    const module = await ProductModuleModel.findByIdAndUpdate(req.params.id, update, {
      returnDocument: "after",
      runValidators: true,
    }).lean();
    if (!module) throw createError(404, "Product module not found.");
    invalidatePlatformPolicyCache();
    res.json({ success: true, data: module, message: "Product module updated." });
  } catch (error) {
    next(error);
  }
});

router.delete("/product-modules/:id", authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const module = await ProductModuleModel.findById(req.params.id).lean();
    if (!module) throw createError(404, "Product module not found.");
    const referenced = await SubscriptionPlanModel.exists({ moduleSlugs: module.slug });
    if (referenced) {
      throw createError(
        409,
        "This module is assigned to a subscription plan and cannot be deleted.",
      );
    }
    await ProductModuleModel.findByIdAndUpdate(req.params.id, {
      $set: { status: "maintenance", isPublic: false },
    });
    invalidatePlatformPolicyCache();
    res.json({ success: true, message: "Product module archived." });
  } catch (error) {
    next(error);
  }
});

router.get("/plans", authenticate, requireSuperAdmin, async (_req, res, next) => {
  try {
    res.json({
      success: true,
      data: await SubscriptionPlanModel.find().sort({ sortOrder: 1 }).lean(),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/plans", authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const {
      name,
      slug,
      description,
      priceLabel,
      billingPeriod,
      availableBillingPeriods,
      moduleSlugs,
      highlights,
      studentLimit,
      employeeLimit,
      isPopular,
      isActive,
      sortOrder,
      planType,
      amountInPaise,
      pricingModel,
      dailyRatePaise,
      minimumBillableUsers,
      currency,
      trialDays,
      graceDays,
      includedAddonSlugs,
    } = req.body;
    if (!name || !slug || !description || !priceLabel)
      throw createError(400, "Plan name, slug, description and price are required.");
    const normalizedStudentLimit = Number(studentLimit);
    const normalizedEmployeeLimit = Number(employeeLimit);
    if (!Number.isSafeInteger(normalizedStudentLimit) || normalizedStudentLimit < 10)
      throw createError(400, "Student limit must be an integer of at least 10.");
    if (!Number.isSafeInteger(normalizedEmployeeLimit) || normalizedEmployeeLimit < 1)
      throw createError(400, "Employee limit must be an integer of at least 1.");
    const normalizedSlug = String(slug).trim().toLowerCase();
    const isEnterprise = normalizedSlug === "enterprise";
    const validatedModuleSlugs = isEnterprise
      ? await allActiveModuleSlugs()
      : await validateModuleSlugs(moduleSlugs);
    const normalizedAmountInPaise = Number(amountInPaise ?? 0);
    const normalizedMonthlyAmountInPaise =
      planType === "free" ? 0 : Math.round((normalizedAmountInPaise / 12) * 1.1);
    const plan = await SubscriptionPlanModel.create({
      name,
      slug: normalizedSlug,
      description,
      priceLabel,
      billingPeriod,
      availableBillingPeriods,
      monthlyAmountInPaise: normalizedMonthlyAmountInPaise,
      moduleSlugs: validatedModuleSlugs,
      highlights,
      studentLimit: normalizedStudentLimit,
      employeeLimit: normalizedEmployeeLimit,
      isPopular,
      isActive,
      sortOrder,
      planType,
      amountInPaise: normalizedAmountInPaise,
      pricingModel,
      dailyRatePaise,
      minimumBillableUsers,
      currency,
      trialDays,
      graceDays,
      includedAddonSlugs: isEnterprise ? [] : includedAddonSlugs,
    });
    res.status(201).json({ success: true, data: plan, message: "Subscription plan created." });
  } catch (error) {
    next(error);
  }
});

router.patch("/plans/:id", authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const allowed = [
      "name",
      "slug",
      "description",
      "priceLabel",
      "billingPeriod",
      "availableBillingPeriods",
      "monthlyAmountInPaise",
      "moduleSlugs",
      "highlights",
      "studentLimit",
      "employeeLimit",
      "isPopular",
      "isActive",
      "sortOrder",
      "capacityBoost",
      "meetingLimitBoost",
      "meetingLimitBoost",
      "planType",
      "amountInPaise",
      "pricingModel",
      "dailyRatePaise",
      "minimumBillableUsers",
      "currency",
      "trialDays",
      "graceDays",
      "includedAddonSlugs",
    ];
    const update = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowed.includes(key)),
    );
    if ("studentLimit" in update) {
      const value = Number(update.studentLimit);
      if (!Number.isSafeInteger(value) || value < 10)
        throw createError(400, "Student limit must be an integer of at least 10.");
      update.studentLimit = value;
    }
    if ("employeeLimit" in update) {
      const value = Number(update.employeeLimit);
      if (!Number.isSafeInteger(value) || value < 1)
        throw createError(400, "Employee limit must be an integer of at least 1.");
      update.employeeLimit = value;
    }
    const existingPlan = await SubscriptionPlanModel.findById(req.params.id)
      .select("slug amountInPaise planType")
      .lean();
    if (!existingPlan) throw createError(404, "Subscription plan not found.");
    const resultingSlug = String(update.slug ?? existingPlan.slug)
      .trim()
      .toLowerCase();
    update.slug = resultingSlug;
    const resultingPlanType = String(update.planType ?? existingPlan.planType);
    const resultingAnnualAmount = Number(update.amountInPaise ?? existingPlan.amountInPaise);
    update.monthlyAmountInPaise =
      resultingPlanType === "free" ? 0 : Math.round((resultingAnnualAmount / 12) * 1.1);
    if (resultingSlug === "enterprise") {
      update.moduleSlugs = await allActiveModuleSlugs();
      update.includedAddonSlugs = [];
    } else if ("moduleSlugs" in update) {
      update.moduleSlugs = await validateModuleSlugs(update.moduleSlugs);
    }
    const plan = await SubscriptionPlanModel.findByIdAndUpdate(req.params.id, update, {
      returnDocument: "after",
      runValidators: true,
    }).lean();
    if (!plan) throw createError(404, "Subscription plan not found.");
    res.json({ success: true, data: plan, message: "Subscription plan updated." });
  } catch (error) {
    next(error);
  }
});

router.get("/addons", authenticate, requireSuperAdmin, async (_req, res, next) => {
  try {
    res.json({ success: true, data: await ProductAddonModel.find().sort({ sortOrder: 1 }).lean() });
  } catch (error) {
    next(error);
  }
});

router.post("/addons", authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const allowed = [
      "name",
      "slug",
      "description",
      "moduleSlugs",
      "featureKeys",
      "amountInPaise",
      "currency",
      "billingPeriod",
      "availableBillingPeriods",
      "monthlyAmountInPaise",
      "isActive",
      "sortOrder",
      "capacityBoost",
      "meetingLimitBoost",
    ];
    const payload = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowed.includes(key)),
    );
    const addon = await ProductAddonModel.create(payload);
    res.status(201).json({ success: true, data: addon, message: "Product add-on created." });
  } catch (error) {
    next(error);
  }
});

router.patch("/addons/:id", authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const allowed = [
      "name",
      "slug",
      "description",
      "moduleSlugs",
      "featureKeys",
      "amountInPaise",
      "currency",
      "billingPeriod",
      "availableBillingPeriods",
      "monthlyAmountInPaise",
      "isActive",
      "sortOrder",
    ];
    const update = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowed.includes(key)),
    );
    const addon = await ProductAddonModel.findByIdAndUpdate(req.params.id, update, {
      returnDocument: "after",
      runValidators: true,
    }).lean();
    if (!addon) throw createError(404, "Product add-on not found.");
    res.json({ success: true, data: addon, message: "Product add-on updated." });
  } catch (error) {
    next(error);
  }
});

router.get("/billing/records", authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 20));
    const status = String(req.query.status || "all");
    const paymentMethod = String(req.query.paymentMethod || "all");
    const agreementStatus = String(req.query.agreementStatus || "all");
    const search = String(req.query.q || "")
      .trim()
      .slice(0, 120);
    const filter: Record<string, unknown> = {};
    if (
      ["created", "submitted", "paid", "rejected", "failed", "refunded", "cancelled"].includes(
        status,
      )
    )
      filter["status"] = status;
    if (paymentMethod === "bank_transfer") filter["paymentMethod"] = paymentMethod;

    if (agreementStatus !== "all") {
      const acceptedCheckoutIds = await CheckoutAgreementModel.distinct("checkoutId", {
        acceptedAt: { $exists: true },
        ndaAccepted: true,
        termsAccepted: true,
      });
      filter["checkoutId"] =
        agreementStatus === "accepted"
          ? { $in: acceptedCheckoutIds }
          : { $nin: acceptedCheckoutIds };
    }
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(escaped, "i");
      const tenants = await TenantModel.find({
        $or: [{ name: pattern }, { tenantId: pattern }, { billingEmail: pattern }],
      })
        .select("_id")
        .limit(100)
        .lean();
      filter["$or"] = [
        { tenantId: { $in: tenants.map((tenant) => tenant._id) } },
        { billingEmail: pattern },
        { invoiceNumber: pattern },
        { transferReference: pattern },
      ];
    }

    const [records, total, summaryRows] = await Promise.all([
      PlatformBillingRecordModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("tenantId", "name tenantId billingEmail")
        .populate("planId", "name slug billingPeriod")
        .populate("reviewedBy", "name email")
        .lean(),
      PlatformBillingRecordModel.countDocuments(filter),
      PlatformBillingRecordModel.aggregate<{
        _id: null;
        collectedInPaise: number;
        refundedInPaise: number;
        successful: number;
        failed: number;
      }>([
        {
          $group: {
            _id: null,
            collectedInPaise: {
              $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$amountInPaise", 0] },
            },
            refundedInPaise: { $sum: { $ifNull: ["$refundAmountInPaise", 0] } },
            successful: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
          },
        },
      ]),
    ]);
    const checkoutIds = records
      .map((record) => record.checkoutId)
      .filter((checkoutId): checkoutId is NonNullable<typeof checkoutId> => Boolean(checkoutId));
    const agreements = checkoutIds.length
      ? await CheckoutAgreementModel.find({
          checkoutId: { $in: checkoutIds },
          acceptedAt: { $exists: true },
        })
          .select(
            "checkoutId acceptanceId email signatoryName signatoryDesignation signatoryAuthorityConfirmed ndaAccepted termsAccepted ndaTitle ndaVersion ndaHash termsTitle termsVersion termsHash otpSentAt otpVerifiedAt acceptedAt otpAttempts userAgent",
          )
          .lean()
      : [];
    const agreementsByCheckout = new Map(
      agreements.map((agreement) => [String(agreement.checkoutId), agreement]),
    );
    res.json({
      success: true,
      data: records.map((record) => ({
        ...record,
        agreement: record.checkoutId
          ? agreementsByCheckout.get(String(record.checkoutId))
          : undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
      summary: summaryRows[0] ?? {
        collectedInPaise: 0,
        refundedInPaise: 0,
        successful: 0,
        failed: 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get(
  "/billing/records/:id/invoice",
  authenticate,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const document = await generatePlatformBillingPdf(req.params.id);
      if (req.query.encoding === "base64") {
        res.json({
          success: true,
          data: {
            dataUrl: `data:application/pdf;base64,${document.pdf.toString("base64")}`,
            filename: document.filename,
          },
        });
        return;
      }
      res.setHeader("Content-Type", "application/pdf");
      const disposition = req.query.download === "1" ? "attachment" : "inline";
      res.setHeader("Content-Disposition", `${disposition}; filename="${document.filename}"`);
      res.setHeader("Cache-Control", "private, no-store");
      res.send(document.pdf);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/billing/records/:id/agreements/:kind",
  authenticate,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      if (!["nda", "terms"].includes(req.params.kind))
        throw createError(400, "Agreement type must be NDA or terms.");
      const record = await PlatformBillingRecordModel.findById(req.params.id)
        .populate("tenantId", "name")
        .lean();
      const tenant =
        record?.tenantId && typeof record.tenantId !== "string"
          ? (record.tenantId as unknown as { name?: string })
          : undefined;
      if (!record?.checkoutId || !tenant?.name)
        throw createError(404, "Accepted agreement record was not found.");
      const documents = await generateAcceptedAgreementPdfs({
        checkoutId: String(record.checkoutId),
        tenantName: tenant.name,
      });
      const index = req.params.kind === "nda" ? 0 : 1;
      const document = documents[index];
      if (!document) throw createError(404, "Accepted agreement PDF was not found.");
      res.setHeader("Content-Type", document.contentType);
      const disposition = req.query.download === "1" ? "attachment" : "inline";
      res.setHeader("Content-Disposition", `${disposition}; filename="${document.filename}"`);
      res.setHeader("Cache-Control", "private, no-store");
      res.send(document.content);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/billing/records/:id/agreements/:kind/preview",
  authenticate,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      if (!["nda", "terms"].includes(req.params.kind))
        throw createError(400, "Agreement type must be NDA or terms.");
      const record = await PlatformBillingRecordModel.findById(req.params.id)
        .populate("tenantId", "name")
        .lean();
      const tenant =
        record?.tenantId && typeof record.tenantId !== "string"
          ? (record.tenantId as unknown as { name?: string })
          : undefined;
      if (!record?.checkoutId || !tenant?.name)
        throw createError(404, "Accepted agreement record was not found.");
      const documents = await generateAcceptedAgreementPdfs({
        checkoutId: String(record.checkoutId),
        tenantName: tenant.name,
      });
      const document = documents[req.params.kind === "nda" ? 0 : 1];
      if (!document) throw createError(404, "Accepted agreement PDF was not found.");
      res.json({
        success: true,
        data: {
          filename: document.filename,
          mimeType: document.contentType,
          dataUrl: `data:${document.contentType};base64,${document.content.toString("base64")}`,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get("/billing/settings", authenticate, requireSuperAdmin, async (_req, res, next) => {
  try {
    const settings = await PlatformBillingSettingsModel.findOne().sort({ updatedAt: -1 }).lean();
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

router.get("/billing/coupons", authenticate, requireSuperAdmin, async (_req, res, next) => {
  try {
    const coupons = await PlatformCouponModel.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: coupons });
  } catch (error) {
    next(error);
  }
});

router.post("/billing/coupons", authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const discountType = req.body.discountType === "fixed" ? "fixed" : "percentage";
    const discountValueInput = Number(req.body.discountValue);
    const discountValue =
      discountType === "fixed" ? Math.round(discountValueInput * 100) : discountValueInput;
    if (
      !Number.isFinite(discountValue) ||
      discountValue <= 0 ||
      (discountType === "percentage" && discountValue > 100)
    )
      throw createError(400, "Enter a valid coupon discount.");
    const validFrom = req.body.validFrom ? new Date(req.body.validFrom) : undefined;
    const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : undefined;
    if (
      (validFrom && Number.isNaN(validFrom.getTime())) ||
      (expiresAt && Number.isNaN(expiresAt.getTime())) ||
      (validFrom && expiresAt && expiresAt <= validFrom)
    )
      throw createError(400, "Coupon validity dates are invalid.");
    const maxRedemptions = req.body.maxRedemptions
      ? Math.trunc(Number(req.body.maxRedemptions))
      : undefined;
    if (maxRedemptions !== undefined && maxRedemptions < 1)
      throw createError(400, "Maximum redemptions must be at least 1.");
    const coupon = await PlatformCouponModel.create({
      code: String(req.body.code ?? "")
        .trim()
        .toUpperCase(),
      description: req.body.description,
      discountType,
      discountValue,
      assignedEmail: req.body.assignedEmail || undefined,
      assignedTenantId: req.body.assignedTenantId || undefined,
      validFrom,
      expiresAt,
      maxRedemptions,
      isActive: req.body.isActive !== false,
    });
    res.status(201).json({ success: true, data: coupon, message: "Coupon created." });
  } catch (error) {
    next(error);
  }
});

router.patch("/billing/coupons/:id", authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const coupon = await PlatformCouponModel.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: Boolean(req.body.isActive) } },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!coupon) throw createError(404, "Coupon not found.");
    res.json({ success: true, data: coupon, message: "Coupon status updated." });
  } catch (error) {
    next(error);
  }
});

router.put("/billing/settings", authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const allowed = [
      "accountHolderName",
      "bankName",
      "accountNumber",
      "ifscCode",
      "branch",
      "upiId",
      "instructions",
      "legalName",
      "gstin",
      "state",
      "taxRatePercent",
      "authorizedSignatoryName",
      "isEnabled",
    ];
    const update = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowed.includes(key)),
    );
    const required = ["accountHolderName", "bankName", "accountNumber", "ifscCode"];
    if (required.some((key) => !String(update[key] ?? "").trim()))
      throw createError(400, "Account holder, bank, account number and IFSC are required.");
    const taxRatePercent = Number(update.taxRatePercent ?? 0);
    if (!Number.isFinite(taxRatePercent) || taxRatePercent < 0 || taxRatePercent > 100)
      throw createError(400, "GST rate must be between 0 and 100.");
    if (
      taxRatePercent > 0 &&
      ["legalName", "gstin", "state"].some((key) => !String(update[key] ?? "").trim())
    )
      throw createError(
        400,
        "Registered legal name, GSTIN and state are required when GST is enabled.",
      );
    const settings = await PlatformBillingSettingsModel.findOneAndUpdate(
      {},
      { ...update, updatedBy: req.user?._id },
      { upsert: true, returnDocument: "after", runValidators: true },
    ).lean();
    res.json({
      success: true,
      data: settings,
      message: "Secure invoice billing details updated.",
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/billing/records/:id/approve",
  authenticate,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const reviewerId = String(req.user?._id ?? "");
      if (!reviewerId) throw createError(401, "Authenticated reviewer is required.");
      res.json({
        success: true,
        data: await approveOfflinePlatformPayment({
          recordId: req.params.id,
          reviewedBy: reviewerId,
          remarks: req.body.remarks,
        }),
        message: "Payment approved, subscription activated and invoice queued.",
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/billing/records/:id/reject",
  authenticate,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const reviewerId = String(req.user?._id ?? "");
      if (!reviewerId) throw createError(401, "Authenticated reviewer is required.");
      res.json({
        success: true,
        data: await rejectOfflinePlatformPayment({
          recordId: req.params.id,
          reviewedBy: reviewerId,
          remarks: String(req.body.remarks ?? ""),
        }),
        message: "Payment submission rejected with an audit reason.",
      });
    } catch (error) {
      next(error);
    }
  },
);

router.delete("/plans/:id", authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const plan = await SubscriptionPlanModel.findById(req.params.id).lean();
    if (!plan) throw createError(404, "Subscription plan not found.");
    const assigned = await TenantModel.exists({ planId: plan._id });
    if (assigned) {
      throw createError(409, "This plan is assigned to one or more tenants and cannot be deleted.");
    }
    await SubscriptionPlanModel.findByIdAndUpdate(req.params.id, {
      $set: { isActive: false, isPopular: false },
    });
    res.json({ success: true, message: "Subscription plan archived." });
  } catch (error) {
    next(error);
  }
});

router.get("/public-profile", authenticate, requireSuperAdmin, async (_req, res, next) => {
  try {
    res.json({ success: true, data: await PublicSiteConfigModel.findOne().lean() });
  } catch (error) {
    next(error);
  }
});

router.put("/public-profile", authenticate, requireSuperAdmin, async (req, res, next) => {
  try {
    const {
      companyName,
      headline,
      description,
      supportEmail,
      salesEmail,
      phone,
      address,
      socialLinks,
    } = req.body;
    if (
      !companyName ||
      !headline ||
      !description ||
      !supportEmail ||
      !salesEmail ||
      !phone ||
      !address
    )
      throw createError(400, "All company and contact fields are required.");
    const normalizedCompanyName = normalizePlatformCompanyName(companyName);
    const site = await PublicSiteConfigModel.findOneAndUpdate(
      {},
      {
        companyName: normalizedCompanyName,
        headline,
        description,
        supportEmail,
        salesEmail,
        phone,
        address,
        socialLinks,
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    ).lean();
    res.json({ success: true, data: site, message: "Public website profile updated." });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/super-admin/platform-config
 * Returns sanitized operational configuration without credentials or secret values.
 */
router.get(
  "/platform-config",
  authenticate,
  requireSuperAdmin,
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const integrations = await platformIntegrationService.list();
      const integration = (provider: PlatformIntegrationProvider) =>
        integrations.find((item) => item.provider === provider);
      const smtp = integration("smtp");
      const firebase = integration("firebase");
      const invoiceBilling = await PlatformBillingSettingsModel.exists({ isEnabled: true });
      res.status(200).json({
        success: true,
        data: {
          environment: configs.NODE_ENV,
          masterDatabaseName: configs.MASTER_DB_NAME,
          tenantIsolation: "database_per_tenant",
          emailConfigured: smtp?.status === "healthy",
          redisConfigured: Boolean(configs.REDIS_URL),
          firebaseConfigured: firebase?.status === "healthy",
          invoiceBilling: {
            configured: Boolean(invoiceBilling),
            method: "bank_transfer_with_admin_verification",
          },
          allowedOriginCount: configs.ALLOWED_ORIGINS
            ? configs.ALLOWED_ORIGINS.split(",").filter(Boolean).length
            : 0,
          retentionDays: {
            notifications: configs.NOTIFICATION_RETENTION_DAYS,
            auditLogs: configs.AUDIT_LOG_RETENTION_DAYS,
            softDeletes: configs.SOFT_DELETE_PURGE_DAYS,
            chatMessages: configs.DELETED_CHAT_MESSAGE_RETENTION_DAYS,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/integrations",
  authenticate,
  requireSuperAdmin,
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ success: true, data: await platformIntegrationService.list() });
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  "/integrations/:provider",
  authenticate,
  requireSuperAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const provider = platformIntegrationProvider(req.params.provider);
      const data = await platformIntegrationService.save(provider, {
        enabled: req.body.enabled,
        config: req.body.config,
        secret: req.body.secret,
        updatedBy: req.user?._id ? String(req.user._id) : undefined,
      });
      await auditLogRepository.create({
        user: req.user ?? null,
        action: "PLATFORM_INTEGRATION_UPDATED",
        module: "platform_settings",
        targetId: provider,
        targetModel: "PlatformIntegration",
        description: `${provider} platform integration updated`,
        metadata: { provider, enabled: Boolean(req.body.enabled) },
        req,
      });
      res.json({
        success: true,
        data,
        message: "Platform integration saved securely. Test it before tenant use.",
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/integrations/firebase/client-config",
  authenticate,
  requireSuperAdmin,
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({
        success: true,
        data: await platformIntegrationService.getFirebaseClientConfig(),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/fcm-token",
  authenticate,
  requireSuperAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { UserModel } = await import("../models/user.model");
      const { token, platform, deviceId } = req.body as {
        token?: string;
        platform?: "web" | "ios" | "android";
        deviceId?: string;
      };
      if (!token || !platform || !["web", "ios", "android"].includes(platform)) {
        res
          .status(400)
          .json({ success: false, message: "token and platform (web|ios|android) are required" });
        return;
      }
      const registrationId = deviceId?.trim() || token;
      await UserModel.findByIdAndUpdate(req.user!._id, {
        $pull: { fcmTokens: { deviceId: registrationId } },
      }).exec();
      await UserModel.findByIdAndUpdate(
        req.user!._id,
        {
          $set: {
            [`fcmToken.${platform}`]: token,
            "notificationPreferences.push": true,
            "notificationPreferences.inApp": true,
          },
          $push: {
            fcmTokens: { deviceId: registrationId, platform, token, lastSeenAt: new Date() },
          },
        },
        { returnDocument: "after" },
      ).exec();
      res.json({ success: true, message: "FCM token registered" });
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/fcm-token",
  authenticate,
  requireSuperAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { UserModel } = await import("../models/user.model");
      const { platform, deviceId, token } = req.body as {
        platform?: "web" | "ios" | "android";
        deviceId?: string;
        token?: string;
      };
      if (!platform || !["web", "ios", "android"].includes(platform)) {
        res.status(400).json({ success: false, message: "platform (web|ios|android) is required" });
        return;
      }
      await UserModel.findByIdAndUpdate(req.user!._id, {
        $pull: {
          fcmTokens: deviceId?.trim()
            ? { deviceId: deviceId.trim(), platform }
            : token?.trim()
              ? { token: token.trim(), platform }
              : { platform },
        },
        ...(token?.trim() ? { $unset: { [`fcmToken.${platform}`]: "" } } : {}),
      }).exec();
      res.json({ success: true, message: "FCM token unregistered" });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/integrations/:provider/test",
  authenticate,
  requireSuperAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const provider = platformIntegrationProvider(req.params.provider);
      const data = await platformIntegrationService.test(provider);
      await auditLogRepository.create({
        user: req.user ?? null,
        action: "PLATFORM_INTEGRATION_TESTED",
        module: "platform_settings",
        targetId: provider,
        targetModel: "PlatformIntegration",
        description: `${provider} platform integration readiness verified`,
        metadata: { provider, succeeded: true },
        req,
      });

      let pushDispatched = false;
      const bodyToken = typeof req.body?.fcmToken === "string" ? req.body.fcmToken.trim() : null;
      const userToken = req.user?.fcmToken;
      const targetFcmToken = bodyToken ? { web: bodyToken } : userToken;

      if (provider === "firebase" && targetFcmToken) {
        const { sendFcmToUser } = await import("../utils/fcm.util");
        try {
          const delivery = await sendFcmToUser(targetFcmToken, {
            title: "🚀 Firebase Push Notification Verified",
            body: "Devvelocity Firebase integration is healthy! Real push notifications are functioning on this device.",
            data: { type: "integration_test", timestamp: new Date().toISOString() },
          });
          pushDispatched = delivery.successCount > 0;
        } catch (pushErr) {
          console.warn("[PlatformIntegration] Firebase test push dispatch warning:", pushErr);
        }
      }

      const message =
        provider === "firebase"
          ? pushDispatched
            ? "Firebase connection verified & real test push notification sent to your device!"
            : "Firebase connection verified! (Enable device notification permission in browser settings to receive real push alerts)."
          : "Integration is ready for tenant use.";

      res.json({ success: true, data, message, pushDispatched });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/v1/super-admin/leads
 * Public route to submit a demo request/lead from the Devvelocity landing page.
 */
router.post("/leads", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, phone, collegeName, designation, studentCount } = req.body;

    if (!name || !email || !phone || !collegeName) {
      throw createError(400, "Missing required contact details.");
    }

    const count = Number(studentCount) || 0;

    const lead = await LeadModel.create({
      name,
      email,
      phone,
      collegeName,
      designation: designation || "Other",
      studentCount: count,
      status: LeadStatus.PENDING,
    });

    res.status(201).json({
      success: true,
      data: lead,
      message: "Your demo request has been submitted successfully!",
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/super-admin/leads
 * Protected route for Super Admin to list all demo requests.
 */
router.get(
  "/leads",
  authenticate,
  requireSuperAdmin,
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const leads = await LeadModel.find().sort({ createdAt: -1 }).lean().exec();
      res.status(200).json({
        success: true,
        data: leads,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/v1/super-admin/leads/:id
 * Protected route for Super Admin to update status/notes of a lead.
 */
router.patch(
  "/leads/:id",
  authenticate,
  requireSuperAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;

      const lead = await LeadModel.findByIdAndUpdate(
        id,
        { status, notes },
        { returnDocument: "after", runValidators: true },
      )
        .lean()
        .exec();

      if (!lead) {
        throw createError(404, "Lead record not found.");
      }

      res.status(200).json({
        success: true,
        data: lead,
        message: "Lead status updated successfully.",
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/super-admin/tenants
 * Protected route for Super Admin to list all tenant colleges.
 */
router.get(
  "/tenants",
  authenticate,
  requireSuperAdmin,
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenants = await TenantModel.find().sort({ createdAt: -1 }).lean().exec();
      res.status(200).json({
        success: true,
        data: tenants,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/super-admin/tenant-usage
 * Returns current licensed consumption and database reachability for every tenant.
 */
router.get(
  "/tenant-usage",
  authenticate,
  requireSuperAdmin,
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const usage = await measureAllTenantUsage();
      res.status(200).json({ success: true, data: usage });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/tenants/:id/retry-provisioning",
  authenticate,
  requireSuperAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenant = await TenantModel.findById(req.params.id).lean();
      if (!tenant) throw createError(404, "Tenant not found.");
      const staleProvisioning =
        tenant.status === TenantStatus.PROVISIONING &&
        Date.now() - new Date(tenant.updatedAt).getTime() >= 5 * 60 * 1000;
      if (tenant.status !== TenantStatus.PROVISIONING_FAILED && !staleProvisioning)
        throw createError(
          409,
          "Provisioning can be retried only after failure or after being stuck for five minutes.",
        );
      const [checkout, paidRecord] = await Promise.all([
        PublicCheckoutModel.findOne({
          tenantId: tenant._id,
          status: { $in: ["failed", "provisioning", "payment_verified"] },
        }),
        PlatformBillingRecordModel.exists({ tenantId: tenant._id, status: "paid" }),
      ]);
      if (!checkout || !paidRecord)
        throw createError(409, "Payment or free-tier approval must be completed before retrying.");
      checkout.status = "payment_verified";
      checkout.error = undefined;
      await checkout.save();
      await TenantModel.updateOne(
        { _id: tenant._id },
        { $set: { status: TenantStatus.PROVISIONING } },
      );
      void provisionPendingCheckoutForTenant(String(tenant._id)).catch((error) =>
        console.error("[TenantProvisioning] Retry failed to start", error),
      );
      res.status(202).json({
        success: true,
        message: "Tenant database provisioning retry started.",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * The former direct-provisioning endpoint is intentionally retired. Keeping a
 * terminal response at its old implementation path prevents payment/approval
 * bypasses while allowing older deployed clients to receive an explicit error.
 */
router.post(
  "/tenants/direct-provisioning-disabled",
  (_req: Request, res: Response): void => {
    res.status(410).json({
      success: false,
      error: {
        message:
          "Direct tenant provisioning is disabled. Create a checkout registration and complete payment or free-tier approval.",
      },
    });
  },
  authenticate,
  requireSuperAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        tenantId,
        name,
        subscriptionTerm,
        subscriptionExpiresAt,
        adminEmail,
        planId,
        addonSlugs,
      } = req.body;

      if (!tenantId || !name || !adminEmail || !planId) {
        throw createError(400, "Missing required tenant provisioning parameters.");
      }

      const plan = await SubscriptionPlanModel.findOne({ _id: planId, isActive: true }).lean();
      if (!plan) throw createError(400, "A valid active subscription plan is required.");
      const requestedAddonSlugs = [
        ...new Set(
          (Array.isArray(addonSlugs) ? addonSlugs : []).map((slug) =>
            String(slug).trim().toLowerCase(),
          ),
        ),
      ].filter(Boolean);
      const addons = requestedAddonSlugs.length
        ? await ProductAddonModel.find({
            slug: { $in: requestedAddonSlugs },
            isActive: true,
          }).lean()
        : [];
      if (addons.length !== requestedAddonSlugs.length) {
        throw createError(400, "One or more selected applications are unavailable.");
      }

      let normalizedTenantId: string;
      try {
        normalizedTenantId = normalizeTenantId(String(tenantId));
      } catch (error) {
        throw createError(400, error instanceof Error ? error.message : "Invalid tenant ID.");
      }
      const databaseName = tenantDatabaseName(normalizedTenantId);
      const isTrial = subscriptionTerm === "trial";
      if (subscriptionTerm && !["trial", "1", "2", "5", "10"].includes(subscriptionTerm)) {
        throw createError(400, "Invalid subscription term.");
      }
      const defaultTrialDays = 3;
      const calculatedTrialEnd = new Date(Date.now() + defaultTrialDays * 24 * 60 * 60 * 1000);
      const requestedExpiry = subscriptionExpiresAt ? new Date(subscriptionExpiresAt) : undefined;
      if (
        requestedExpiry &&
        (Number.isNaN(requestedExpiry.getTime()) || requestedExpiry.getTime() <= Date.now())
      ) {
        throw createError(400, "Subscription expiry must be a valid future date.");
      }
      // Trial duration is measured from the provisioning timestamp, not from
      // midnight in a browser-generated date string.
      const expiresAt = isTrial ? calculatedTrialEnd : requestedExpiry || calculatedTrialEnd;
      const trialEndsAt = isTrial ? expiresAt : undefined;
      const existing = await TenantModel.findOne({
        $or: [{ tenantId: normalizedTenantId }, { databaseName }],
      })
        .lean()
        .exec();
      if (existing && existing.status !== TenantStatus.PROVISIONING_FAILED) {
        throw createError(409, `Tenant with ID '${tenantId}' already exists.`);
      }

      const enabledAddonSlugs = [...new Set([...plan.includedAddonSlugs, ...requestedAddonSlugs])];
      const enabledModuleSlugs = [
        ...new Set([...plan.moduleSlugs, ...addons.flatMap((addon) => addon.moduleSlugs)]),
      ];
      const maxStudents =
        plan.studentLimit +
        addons.reduce((total, addon) => total + (addon.capacityBoost?.additionalStudents ?? 0), 0);
      const maxEmployees =
        plan.employeeLimit +
        addons.reduce((total, addon) => total + (addon.capacityBoost?.additionalEmployees ?? 0), 0);
      const adminPassword = generateCheckoutAdminPassword();
      const tenantConfiguration = {
        tenantId: normalizedTenantId,
        name: String(name).trim(),
        databaseName,
        status: TenantStatus.PROVISIONING,
        subscriptionExpiresAt: expiresAt,
        planId: plan._id,
        enabledModuleSlugs,
        entitlementEnforced: true,
        maxStudents,
        maxEmployees,
        billingEmail: String(adminEmail).trim().toLowerCase(),
        billingStatus: isTrial
          ? ("trialing" as const)
          : plan.planType === "free"
            ? ("free" as const)
            : ("active" as const),
        trialEndsAt,
        enabledAddonSlugs,
      };
      const tenant = existing
        ? await TenantModel.findByIdAndUpdate(
            existing._id,
            { $set: tenantConfiguration },
            { returnDocument: "after", runValidators: true },
          )
        : await TenantModel.create(tenantConfiguration);
      if (!tenant) throw createError(500, "Tenant provisioning record could not be prepared.");

      // Asynchronously trigger database seeding for the newly provisioned tenant context
      const compiledRuntime = path.extname(__filename) === ".js";
      const scriptPath = compiledRuntime
        ? path.resolve(__dirname, "../scripts/seed.js")
        : path.resolve(process.cwd(), "server/scripts/seed.ts");
      const executable = compiledRuntime
        ? process.execPath
        : path.resolve(process.cwd(), "node_modules/.bin/ts-node");
      const env = {
        ...process.env,
        MONGODB_URI: configs.MONGODB_URI,
        MONGODB_DB_NAME: databaseName,
        SEED_ADMIN_EMAIL: adminEmail,
        SEED_ADMIN_PASS: adminPassword,
        SEED_REQUIRE_PASSWORD_CHANGE: "true",
        SEED_ADMIN_NAME: `${name} Administrator`,
        SEED_INSTITUTION_NAME: String(name).trim(),
        SEED_CORE_CURRICULA: "true",
        SEED_CLEAN: "true", // Do not seed legacy/demo role accounts
      };

      execFile(executable, [scriptPath], { env, cwd: process.cwd() }, async (error) => {
        if (error) {
          await TenantModel.updateOne(
            { _id: tenant._id },
            { $set: { status: TenantStatus.PROVISIONING_FAILED } },
          ).exec();
          console.error(
            `[SuperAdmin] Dynamic database seeding failed for tenant: ${tenantId}`,
            error,
          );
        } else {
          await TenantModel.updateOne(
            { _id: tenant._id },
            { $set: { status: TenantStatus.ACTIVE } },
          ).exec();
          console.info(
            `[SuperAdmin] Dynamic database seeding completed successfully for tenant: ${tenantId}`,
          );

          // Once seeded successfully, send onboarding welcome email to the tenant's admin
          const loginUrl = configs.TENANT_APP_URL_TEMPLATE.replace(
            "{tenant}",
            encodeURIComponent(normalizedTenantId),
          );
          const publicSite = await PublicSiteConfigModel.findOne().lean().exec();
          const platformLogoPath = path.resolve(
            process.cwd(),
            "public",
            "devvelocitylogo-email.png",
          );
          const hasEmbeddedPlatformLogo = fs.existsSync(platformLogoPath);
          sendEmail({
            to: adminEmail,
            subject: `Your ${name} workspace is ready`,
            template: EmailTemplate.TENANT_WELCOME,
            context: {
              recipientName: `${String(name).trim()} Administrator`,
              organizationName: String(name).trim(),
              tenantId: normalizedTenantId,
              planName: plan.name,
              adminEmail: String(adminEmail).trim().toLowerCase(),
              temporaryPassword: adminPassword,
              subscriptionExpiresAt: formatIndiaDate(expiresAt),
              loginUrl,
              supportEmail: publicSite?.supportEmail,
            },
            branding: {
              instituteName: publicSite?.companyName || "Devvelocity",
              tagline: "Education ERP Platform",
              emailSenderName: publicSite?.companyName || "Devvelocity",
              email: publicSite?.supportEmail,
              replyToEmail: publicSite?.supportEmail,
              phone: publicSite?.phone,
              address: publicSite?.address,
              websiteUrl: configs.PLATFORM_WEBSITE_URL,
              websiteUrlShort: configs.PLATFORM_WEBSITE_URL.replace(/^https?:\/\/(www\.)?/, ""),
              logoUrl: hasEmbeddedPlatformLogo
                ? "cid:devvelocity-platform-logo"
                : configs.PLATFORM_LOGO_URL,
            },
            attachments: hasEmbeddedPlatformLogo
              ? [
                  {
                    filename: "devvelocity-logo.png",
                    path: platformLogoPath,
                    contentType: "image/png",
                    cid: "devvelocity-platform-logo",
                  },
                ]
              : undefined,
            priority: "high",
          }).catch((mailErr) => {
            console.error(
              `[SuperAdmin] Welcome email failed to send to ${adminEmail} for tenant: ${tenantId}`,
              mailErr,
            );
          });
        }
      });

      res.status(201).json({
        success: true,
        data: tenant,
        message: `Tenant '${name}' provisioning started. It will become active after database initialization succeeds.`,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/v1/super-admin/tenants/:id
 * Protected route for Super Admin to suspend/activate or renew a tenant.
 */
router.patch(
  "/tenants/:id",
  authenticate,
  requireSuperAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { status, subscriptionExpiresAt, name, planId } = req.body;

      const updatePayload: Record<string, unknown> = {};
      if (status) {
        const manuallyAssignableStatuses = [TenantStatus.ACTIVE, TenantStatus.SUSPENDED];
        if (!manuallyAssignableStatuses.includes(status as TenantStatus)) {
          throw createError(400, "Status must be either 'active' or 'suspended'.");
        }
        updatePayload.status = status;
      }
      if (name) updatePayload.name = name;
      if (subscriptionExpiresAt) {
        const expiresAt = new Date(subscriptionExpiresAt);
        if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
          throw createError(400, "Subscription expiry must be a valid future date.");
        }
        updatePayload.subscriptionExpiresAt = expiresAt;
      }
      if (planId) {
        const plan = await SubscriptionPlanModel.findOne({ _id: planId, isActive: true }).lean();
        if (!plan) throw createError(400, "A valid active subscription plan is required.");
        updatePayload.planId = plan._id;
        updatePayload.enabledModuleSlugs = plan.moduleSlugs;
        updatePayload.maxStudents = plan.studentLimit;
        updatePayload.maxEmployees = plan.employeeLimit;
        updatePayload.entitlementEnforced = true;
      }

      const tenant = await TenantModel.findByIdAndUpdate(id, updatePayload, {
        returnDocument: "after",
        runValidators: true,
      })
        .lean()
        .exec();

      if (!tenant) {
        throw createError(404, "Tenant record not found.");
      }

      res.status(200).json({
        success: true,
        data: tenant,
        message: "Tenant subscription updated successfully.",
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/v1/super-admin/tenants/:id
 * Permanently removes a suspended tenant, its isolated database and master billing records.
 */
router.delete(
  "/tenants/:id",
  authenticate,
  requireSuperAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenant = await TenantModel.findById(req.params.id).lean().exec();
      if (!tenant) {
        throw createError(404, "Tenant record not found.");
      }
      if (tenant.status !== TenantStatus.SUSPENDED) {
        throw createError(409, "Only a suspended tenant can be permanently removed.");
      }

      await dropTenantDatabase(tenant.tenantId, tenant.databaseName);
      await Promise.all([
        PlatformBillingRecordModel.deleteMany({ tenantId: tenant._id }).exec(),
        TenantModel.deleteOne({ _id: tenant._id, status: TenantStatus.SUSPENDED }).exec(),
      ]);

      res.status(200).json({
        success: true,
        message: `Tenant '${tenant.name}' and its isolated database were permanently removed.`,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;

import { Router } from "express";
import type { UploadedFile } from "express-fileupload";
import createError from "http-errors";
import { SystemRole } from "../constants/roles";
import { authenticate, requireRoles } from "../middlewares/auth.middleware";
import { PlatformBillingRecordModel } from "../models/platform-billing.model";
import { PlatformBillingSettingsModel } from "../models/platform-billing-settings.model";
import { ProductAddonModel, SubscriptionPlanModel } from "../models/platform.model";
import { TenantModel } from "../models/tenant.model";
import { pdfService } from "../pdf/pdf.service";
import { createPlatformOrder } from "../services/platform-billing.service";
import { uploadUtil } from "../utils/upload.util";

const router = Router();

router.use(authenticate, requireRoles([SystemRole.SUPER_ADMIN]));

async function tenantForRequest(tenantId?: string) {
  if (!tenantId) throw createError(400, "Tenant context is required.");
  const tenant = await TenantModel.findOne({ tenantId }).lean();
  if (!tenant) throw createError(404, "Tenant subscription was not found.");
  return tenant;
}

router.get("/", async (req, res, next) => {
  try {
    const tenant = await tenantForRequest(req.tenantId);
    const [plan, records, addons] = await Promise.all([
      tenant.planId ? SubscriptionPlanModel.findById(tenant.planId).lean() : null,
      PlatformBillingRecordModel.find({ tenantId: tenant._id })
        .sort({ createdAt: -1 })
        .limit(250)
        .select("-webhookEventIds")
        .lean(),
      ProductAddonModel.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean(),
    ]);

    const includedModules = new Set(plan?.moduleSlugs ?? []);
    const enabledAddons = new Set(tenant.enabledAddonSlugs ?? []);
    const includedAddons = new Set(plan?.includedAddonSlugs ?? []);
    const pendingAddons = new Set(
      records
        .filter(
          (record) =>
            record.purchaseKind === "addon" && ["created", "submitted"].includes(record.status),
        )
        .flatMap((record) => record.addonSlugs),
    );
    const availableAddons = addons.filter((addon) => {
      const moduleAlreadyIncluded =
        addon.moduleSlugs.length > 0 &&
        addon.featureKeys.some((key) => key.startsWith("module.")) &&
        (plan?.slug === "enterprise" ||
          addon.moduleSlugs.every((moduleSlug) => includedModules.has(moduleSlug)));
      return (
        !enabledAddons.has(addon.slug) &&
        !includedAddons.has(addon.slug) &&
        !pendingAddons.has(addon.slug) &&
        !moduleAlreadyIncluded
      );
    });

    res.setHeader("Cache-Control", "no-store");
    res.json({
      success: true,
      data: {
        subscription: {
          plan,
          status: tenant.billingStatus,
          expiresAt: tenant.subscriptionExpiresAt,
          trialEndsAt: tenant.trialEndsAt,
          graceEndsAt: tenant.graceEndsAt,
          billingEmail: tenant.billingEmail,
          maxStudents: tenant.maxStudents,
          maxEmployees: tenant.maxEmployees,
          enabledAddonSlugs: tenant.enabledAddonSlugs ?? [],
          unlimitedMeetingsUntil: tenant.unlimitedMeetingsUntil,
          unlimitedMeetingsActive: Boolean(
            tenant.unlimitedMeetingsUntil &&
            new Date(tenant.unlimitedMeetingsUntil).getTime() >= Date.now(),
          ),
        },
        enabledAddons: addons.filter((addon) => enabledAddons.has(addon.slug)),
        availableAddons,
        payments: records,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/addons/:slug/order", async (req, res, next) => {
  try {
    const tenant = await tenantForRequest(req.tenantId);
    if (!tenant.planId || !["active", "trialing"].includes(tenant.billingStatus))
      throw createError(409, "An active subscription plan is required before purchasing add-ons.");
    const addon = await ProductAddonModel.findOne({
      slug: String(req.params.slug).trim().toLowerCase(),
      isActive: true,
    }).lean();
    if (!addon) throw createError(404, "Selected add-on is unavailable.");
    const pendingOrder = await PlatformBillingRecordModel.exists({
      tenantId: tenant._id,
      addonSlugs: addon.slug,
      purchaseKind: "addon",
      status: { $in: ["created", "submitted"] },
    });
    if (pendingOrder)
      throw createError(
        409,
        "This add-on already has a pending invoice. Continue it from payment history.",
      );
    const order = await createPlatformOrder({
      tenantId: String(tenant._id),
      planId: String(tenant.planId),
      addonSlugs: [addon.slug],
      addonOnly: true,
      billingPeriod: "year",
    });
    res.status(201).json({
      success: true,
      data: order,
      message: "Add-on invoice created. Transfer the exact amount and submit payment proof.",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/addons/orders/:recordId", async (req, res, next) => {
  try {
    const tenant = await tenantForRequest(req.tenantId);
    const [record, billingSettings] = await Promise.all([
      PlatformBillingRecordModel.findOne({
        _id: req.params.recordId,
        tenantId: tenant._id,
        purchaseKind: "addon",
        status: { $in: ["created", "rejected"] },
      }).lean(),
      PlatformBillingSettingsModel.findOne({ isEnabled: true }).sort({ updatedAt: -1 }).lean(),
    ]);
    if (!record) throw createError(404, "Pending add-on invoice was not found.");
    if (!billingSettings) throw createError(503, "Invoice billing is temporarily unavailable.");
    res.json({
      success: true,
      data: {
        billingId: String(record._id),
        amount: record.amountInPaise,
        invoiceNumber: record.invoiceNumber,
        lineItems: record.lineItems,
        bankTransfer: {
          accountHolderName: billingSettings.accountHolderName,
          bankName: billingSettings.bankName,
          accountNumber: billingSettings.accountNumber,
          ifscCode: billingSettings.ifscCode,
          branch: billingSettings.branch,
          upiId: billingSettings.upiId,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/addons/payment-proof", async (req, res, next) => {
  try {
    const tenant = await tenantForRequest(req.tenantId);
    const reference = String(req.body.transferReference ?? "")
      .trim()
      .toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{7,49}$/.test(reference))
      throw createError(400, "Enter a valid bank transaction reference.");
    const proof = req.files?.proof;
    if (!proof || Array.isArray(proof)) throw createError(400, "Payment proof is required.");
    const paymentDate = new Date(String(req.body.paymentDate ?? ""));
    if (
      Number.isNaN(paymentDate.getTime()) ||
      paymentDate > new Date() ||
      paymentDate < new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
    )
      throw createError(400, "Payment date must be within the last 45 days.");
    const record = await PlatformBillingRecordModel.findOne({
      _id: req.body.billingId,
      tenantId: tenant._id,
      purchaseKind: "addon",
      paymentMethod: "bank_transfer",
      status: { $in: ["created", "rejected"] },
    });
    if (!record) throw createError(404, "Pending add-on invoice was not found.");
    if (
      await PlatformBillingRecordModel.exists({
        transferReference: reference,
        _id: { $ne: record._id },
      })
    )
      throw createError(409, "This transaction reference has already been submitted.");
    const uploaded = await uploadUtil.uploadDocument(
      proof as UploadedFile,
      "platform/subscription-payment-proofs",
      { publicId: `addon-payment-${record._id}-${Date.now()}` },
    );
    record.transferReference = reference;
    record.paymentDate = paymentDate;
    record.paymentProofUrl = uploaded.url;
    record.paymentProofPublicId = uploaded.publicId;
    record.paymentProofMimeType = (proof as UploadedFile).mimetype;
    record.submittedAt = new Date();
    record.status = "submitted";
    await record.save();
    res.status(202).json({
      success: true,
      data: record,
      message:
        "Payment proof submitted. The add-on activates after Devvelocity verifies the transfer.",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/invoices/:recordId", async (req, res, next) => {
  try {
    const tenant = await tenantForRequest(req.tenantId);
    const record = await PlatformBillingRecordModel.findOne({
      _id: req.params.recordId,
      tenantId: tenant._id,
      status: { $in: ["paid", "refunded"] },
    }).lean();
    if (!record) throw createError(404, "Invoice was not found for this institution.");
    const plan = await SubscriptionPlanModel.findById(record.planId).lean();
    if (!plan) throw createError(404, "The billed subscription plan was not found.");

    const refunded = record.status === "refunded";
    const transactionTime =
      (refunded ? record.refundedAt : record.paidAt) ?? record.updatedAt ?? record.createdAt;
    const amountInPaise = refunded
      ? (record.refundAmountInPaise ?? record.amountInPaise)
      : record.amountInPaise;
    const pdf = await pdfService.generatePlatformInvoice({
      documentTitle: refunded ? "Refund credit note" : "Payment invoice",
      invoiceNumber: record.invoiceNumber,
      issuedAt: transactionTime,
      tenantName: tenant.name,
      billingEmail: record.billingEmail,
      planName: plan.name,
      billingLabel:
        record.billingPeriod === "one_time"
          ? "Lifetime access"
          : record.billingPeriod === "month"
            ? "Monthly subscription"
            : "Annual subscription",
      amount: amountInPaise / 100,
      amountLabel: refunded ? "Amount refunded" : "Amount paid",
      paymentId: record.transferReference,
      transactionTime: transactionTime.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      }),
      status: refunded ? "Refunded" : "Paid",
      detail: record.purchaseKind === "addon" ? "Subscription add-on purchase" : undefined,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${refunded ? "credit-note" : "invoice"}-${record.invoiceNumber}.pdf"`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

export default router;

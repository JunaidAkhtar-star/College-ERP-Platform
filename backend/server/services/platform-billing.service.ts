import crypto from "crypto";
import fs from "fs";
import path from "path";
import createError from "http-errors";
import { PlatformBillingRecordModel } from "../models/platform-billing.model";
import { PlatformBillingSettingsModel } from "../models/platform-billing-settings.model";
import { PlatformCouponModel } from "../models/platform-coupon.model";
import { PublicCheckoutModel } from "../models/public-checkout.model";
import {
  ProductAddonModel,
  PublicSiteConfigModel,
  SubscriptionPlanModel,
} from "../models/platform.model";
import { TenantModel, TenantStatus } from "../models/tenant.model";
import { sendEmail, EmailTemplate } from "../email/email.service";
import { pdfService } from "../pdf/pdf.service";
import { configs } from "../configs";
import { logger } from "../utils/logger.util";
import { CheckoutAgreementModel } from "../models/checkout-agreement.model";
import { generateAcceptedAgreementPdfs } from "./checkout-agreement.service";

const formatIndiaDateTime = (value: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(value);

function invoiceNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `DVL-${date}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
}

function addPeriod(from: Date, period: "month" | "year" | "one_time"): Date {
  const result = new Date(from);
  if (period === "month") result.setUTCMonth(result.getUTCMonth() + 1);
  else if (period === "year") result.setUTCFullYear(result.getUTCFullYear() + 1);
  else return new Date("9999-12-31T23:59:59.999Z");
  return result;
}

const monthlyPriceWithPremium = (annualAmountInPaise: number): number =>
  Math.round((annualAmountInPaise / 12) * 1.1);

const billingPeriodLabel = (period: "month" | "year" | "one_time") =>
  period === "one_time" ? "One-time" : period === "month" ? "Monthly" : "Annual";

function platformInvoiceLineItems(
  record: InstanceType<typeof PlatformBillingRecordModel>,
  planName: string,
) {
  if (record.lineItems?.length > 0) {
    return record.lineItems.map((item, index) => ({
      number: index + 1,
      description: item.description,
      billingLabel: item.billingLabel,
      amount: item.amountInPaise / 100,
    }));
  }
  return [
    {
      number: 1,
      description: `${planName} subscription and selected add-ons`,
      billingLabel: billingPeriodLabel(record.billingPeriod),
      amount:
        ((record.subtotalInPaise ?? record.amountInPaise) + (record.couponDiscountInPaise ?? 0)) /
        100,
    },
  ];
}

export async function ensurePlatformBillingLineItems(recordId: string) {
  const record = await PlatformBillingRecordModel.findById(recordId);
  if (!record) throw createError(404, "Billing record not found.");
  if (record.lineItems?.length > 0) return record.lineItems;

  const [plan, addons] = await Promise.all([
    SubscriptionPlanModel.findById(record.planId).lean(),
    ProductAddonModel.find({ slug: { $in: record.addonSlugs }, isActive: true }).lean(),
  ]);
  if (!plan) throw createError(404, "Invoice plan was not found.");

  const included = new Set(plan.includedAddonSlugs);
  const chargeableAddons = addons.filter((addon) => !included.has(addon.slug));
  const addonItems = chargeableAddons.map((addon) => ({
    kind: "addon" as const,
    slug: addon.slug,
    description: addon.name,
    billingLabel: billingPeriodLabel(record.billingPeriod),
    amountInPaise:
      record.billingPeriod === "month" ? addon.monthlyAmountInPaise : addon.amountInPaise,
  }));
  const beforeCoupon =
    (record.subtotalInPaise ?? record.amountInPaise) + (record.couponDiscountInPaise ?? 0);
  const addonTotal = addonItems.reduce((sum, item) => sum + item.amountInPaise, 0);
  const lineItems =
    record.purchaseKind === "addon"
      ? addonItems
      : [
          {
            kind: "plan" as const,
            slug: plan.slug,
            description: `${plan.name} subscription`,
            billingLabel: billingPeriodLabel(record.billingPeriod),
            amountInPaise: Math.max(0, beforeCoupon - addonTotal),
          },
          ...addonItems,
        ];
  if (
    lineItems.length === 0 ||
    lineItems.reduce((sum, item) => sum + item.amountInPaise, 0) !== beforeCoupon
  )
    return record.lineItems;

  record.lineItems = lineItems;
  await record.save();
  return record.lineItems;
}

async function billingContext(recordId: string) {
  const record = await PlatformBillingRecordModel.findById(recordId);
  if (!record) throw createError(404, "Billing record not found.");
  const [tenant, plan] = await Promise.all([
    TenantModel.findById(record.tenantId).lean(),
    SubscriptionPlanModel.findById(record.planId).lean(),
  ]);
  return { record, tenant, plan };
}

async function sendBillingDocument(
  recordId: string,
  kind: "success" | "refund",
  detail?: string,
): Promise<void> {
  const { record, tenant, plan } = await billingContext(recordId);
  const alreadySent = kind === "success" ? record.successEmailSentAt : record.refundEmailSentAt;
  if (alreadySent || !tenant || !plan) return;
  const transactionTime = (kind === "success" ? record.paidAt : record.refundedAt) || new Date();
  const amountInPaise = kind === "success" ? record.amountInPaise : record.refundAmountInPaise || 0;
  const documentTitle = kind === "success" ? "Payment invoice" : "Refund credit note";
  const [billingSettings, publicSite] = await Promise.all([
    PlatformBillingSettingsModel.findOne().sort({ updatedAt: -1 }).lean(),
    PublicSiteConfigModel.findOne().lean(),
  ]);
  const subtotalInPaise =
    kind === "success" ? (record.subtotalInPaise ?? record.amountInPaise) : amountInPaise;
  const listPriceInPaise =
    kind === "success"
      ? (record.listPriceInPaise ??
        (record.billingPeriod === "year"
          ? monthlyPriceWithPremium(plan.amountInPaise) * 12
          : subtotalInPaise))
      : amountInPaise;
  const discountInPaise =
    kind === "success"
      ? (record.discountInPaise ?? Math.max(0, listPriceInPaise - subtotalInPaise))
      : 0;
  const couponDiscountInPaise = kind === "success" ? (record.couponDiscountInPaise ?? 0) : 0;
  const annualDiscountInPaise = Math.max(0, discountInPaise - couponDiscountInPaise);
  const taxAmountInPaise = kind === "success" ? (record.taxAmountInPaise ?? 0) : 0;
  const taxRatePercent = kind === "success" ? (record.taxRatePercent ?? 0) : 0;
  const paymentMethodLabel = `${String(record.paymentChannel || "bank transfer").toUpperCase()} bank transfer`;
  const pdf = await pdfService.generatePlatformInvoice({
    documentTitle,
    invoiceNumber: record.invoiceNumber,
    issuedAt: transactionTime,
    tenantName: tenant.name,
    billingEmail: record.billingEmail,
    sellerLegalName: billingSettings?.legalName || publicSite?.companyName || "Devvelocity",
    sellerGstin: billingSettings?.gstin,
    sellerState: billingSettings?.state,
    authorizedSignatoryName: billingSettings?.authorizedSignatoryName || "Rajesh Kumar Behera",
    planName: plan.name,
    lineItems: platformInvoiceLineItems(record, plan.name),
    billingLabel:
      record.billingPeriod === "one_time"
        ? "Lifetime access"
        : record.billingPeriod === "month"
          ? "Monthly subscription"
          : "Annual subscription",
    subtotal: subtotalInPaise / 100,
    listPrice: listPriceInPaise / 100,
    discount: annualDiscountInPaise / 100,
    hasDiscount: annualDiscountInPaise > 0,
    couponCode: record.couponCode,
    couponDiscount: couponDiscountInPaise / 100,
    hasCouponDiscount: couponDiscountInPaise > 0,
    taxRatePercent,
    taxAmount: taxAmountInPaise / 100,
    amount: amountInPaise / 100,
    amountLabel: kind === "success" ? "Amount paid" : "Amount refunded",
    paymentId: record.transferReference,
    paymentMethodLabel,
    transactionTime: formatIndiaDateTime(transactionTime),
    status: kind === "success" ? "Paid" : "Refunded",
    detail,
  });
  const platformLogoPath = path.resolve(process.cwd(), "public", "devvelocitylogo-email.png");
  const hasEmbeddedPlatformLogo = fs.existsSync(platformLogoPath);
  const agreement =
    kind === "success" && record.checkoutId
      ? await CheckoutAgreementModel.findOne({
          checkoutId: record.checkoutId,
          acceptedAt: { $exists: true },
        })
          .sort({ acceptedAt: -1 })
          .select("acceptanceId")
          .lean()
      : null;
  const agreementAttachments =
    kind === "success" && record.checkoutId && agreement?.acceptanceId
      ? await generateAcceptedAgreementPdfs({
          checkoutId: String(record.checkoutId),
          tenantName: tenant.name,
        })
      : [];
  await sendEmail({
    to: record.billingEmail,
    subject:
      kind === "success" && agreement
        ? `Payment approved and agreements confirmed — ${record.invoiceNumber}`
        : `${documentTitle} — ${record.invoiceNumber}`,
    template: EmailTemplate.PLATFORM_BILLING_DOCUMENT,
    context: {
      title: documentTitle,
      documentType: kind === "success" ? "payment invoice" : "credit note",
      invoiceNumber: record.invoiceNumber,
      paidAmount: `₹${(amountInPaise / 100).toLocaleString("en-IN")}`,
      paymentReference: record.transferReference,
      billingTerm:
        record.billingPeriod === "one_time"
          ? "Lifetime"
          : record.billingPeriod === "month"
            ? "Monthly"
            : "Yearly · 10% annual saving",
      recipientName: `${tenant.name} Administrator`,
      body:
        kind === "success"
          ? `Your Devvelocity payment of ₹${(amountInPaise / 100).toLocaleString("en-IN")} was approved on ${formatIndiaDateTime(transactionTime)} IST. Your ${record.billingPeriod === "one_time" ? "lifetime" : record.billingPeriod === "month" ? "monthly" : "yearly"} access is active.${agreement?.acceptanceId ? ` Agreement acceptance ${agreement.acceptanceId} is confirmed; the accepted NDA and Subscription Terms are attached with your paid invoice.` : ""}`
          : `A refund of ₹${(amountInPaise / 100).toLocaleString("en-IN")} was processed on ${formatIndiaDateTime(transactionTime)} IST. ${detail || ""}`,
    },
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
    attachments: [
      ...(hasEmbeddedPlatformLogo
        ? [
            {
              filename: "devvelocity-logo.png",
              path: platformLogoPath,
              contentType: "image/png",
              cid: "devvelocity-platform-logo",
            },
          ]
        : []),
      {
        filename: `${kind === "success" ? "invoice" : "credit-note"}-${record.invoiceNumber}.pdf`,
        content: pdf,
        contentType: "application/pdf",
      },
      ...agreementAttachments,
    ],
  });
  const sentAtField = kind === "success" ? "successEmailSentAt" : "refundEmailSentAt";
  await PlatformBillingRecordModel.updateOne(
    { _id: record._id, [sentAtField]: { $exists: false } },
    { $set: { [sentAtField]: new Date() } },
  );
}

export async function generatePlatformBillingPdf(recordId: string) {
  const { record, tenant, plan } = await billingContext(recordId);
  if (!tenant || !plan) throw createError(404, "Invoice billing context was not found.");
  if (!["paid", "refunded"].includes(record.status))
    throw createError(409, "The official invoice is available after payment approval.");
  const refunded = record.status === "refunded";
  const transactionTime =
    (refunded ? record.refundedAt : record.paidAt) || record.updatedAt || record.createdAt;
  const amountInPaise = refunded
    ? (record.refundAmountInPaise ?? record.amountInPaise)
    : record.amountInPaise;
  const [billingSettings, publicSite] = await Promise.all([
    PlatformBillingSettingsModel.findOne().sort({ updatedAt: -1 }).lean(),
    PublicSiteConfigModel.findOne().lean(),
  ]);
  const subtotalInPaise = refunded
    ? amountInPaise
    : (record.subtotalInPaise ?? record.amountInPaise);
  const listPriceInPaise = refunded ? amountInPaise : (record.listPriceInPaise ?? subtotalInPaise);
  const couponDiscountInPaise = refunded ? 0 : (record.couponDiscountInPaise ?? 0);
  const totalDiscountInPaise = refunded ? 0 : (record.discountInPaise ?? 0);
  const annualDiscountInPaise = Math.max(0, totalDiscountInPaise - couponDiscountInPaise);
  const pdf = await pdfService.generatePlatformInvoice({
    documentTitle: refunded ? "Refund credit note" : "Payment invoice",
    invoiceNumber: record.invoiceNumber,
    issuedAt: transactionTime,
    tenantName: tenant.name,
    billingEmail: record.billingEmail,
    sellerLegalName: billingSettings?.legalName || publicSite?.companyName || "Devvelocity",
    sellerGstin: billingSettings?.gstin,
    sellerState: billingSettings?.state,
    authorizedSignatoryName: billingSettings?.authorizedSignatoryName || "Rajesh Kumar Behera",
    planName: plan.name,
    lineItems: platformInvoiceLineItems(record, plan.name),
    billingLabel:
      record.billingPeriod === "one_time"
        ? "Lifetime access"
        : record.billingPeriod === "month"
          ? "Monthly subscription"
          : "Annual subscription",
    subtotal: subtotalInPaise / 100,
    listPrice: listPriceInPaise / 100,
    discount: annualDiscountInPaise / 100,
    hasDiscount: annualDiscountInPaise > 0,
    couponCode: record.couponCode,
    couponDiscount: couponDiscountInPaise / 100,
    hasCouponDiscount: couponDiscountInPaise > 0,
    taxRatePercent: refunded ? 0 : (record.taxRatePercent ?? 0),
    taxAmount: refunded ? 0 : (record.taxAmountInPaise ?? 0) / 100,
    amount: amountInPaise / 100,
    amountLabel: refunded ? "Amount refunded" : "Amount paid",
    paymentId: record.transferReference,
    paymentMethodLabel: `${String(record.paymentChannel || "bank transfer").toUpperCase()} bank transfer`,
    transactionTime: formatIndiaDateTime(transactionTime),
    status: refunded ? "Refunded" : "Paid",
    detail: record.purchaseKind === "addon" ? "Subscription add-on purchase" : undefined,
  });
  return {
    pdf,
    filename: `${refunded ? "credit-note" : "invoice"}-${record.invoiceNumber}.pdf`,
  };
}

export async function createPlatformOrder(input: {
  tenantId: string;
  checkoutId?: string;
  planId: string;
  addonSlugs?: string[];
  addonOnly?: boolean;
  licensedUserCount?: number;
  billingPeriod?: "month" | "year" | "one_time";
  couponCode?: string;
}) {
  const [tenant, plan, billingSettings] = await Promise.all([
    TenantModel.findById(input.tenantId).lean(),
    SubscriptionPlanModel.findOne({ _id: input.planId, isActive: true }).lean(),
    PlatformBillingSettingsModel.findOne({ isEnabled: true }).sort({ updatedAt: -1 }).lean(),
  ]);
  if (!tenant) throw createError(404, "Tenant not found.");
  if (!plan || plan.planType !== "paid") throw createError(400, "A paid active plan is required.");
  if (!tenant.billingEmail) throw createError(409, "Tenant billing email is missing.");
  if (!billingSettings)
    throw createError(
      503,
      "Invoice billing is not configured. A platform administrator must add bank details first.",
    );
  const billingPeriod = input.billingPeriod ?? plan.billingPeriod;
  if (!(["month", "year", "one_time"] as const).includes(billingPeriod)) {
    throw createError(400, "Plan billing period is invalid.");
  }
  const availablePeriods = plan.availableBillingPeriods?.length
    ? plan.availableBillingPeriods
    : [plan.billingPeriod];
  if (!availablePeriods.includes(billingPeriod))
    throw createError(400, `The selected plan is not available for ${billingPeriod} billing.`);

  const requestedAddonSlugs = (input.addonSlugs || []).map((slug) => String(slug).toLowerCase());
  const addonSlugs = [...new Set([...plan.includedAddonSlugs, ...requestedAddonSlugs])];
  const addons = addonSlugs.length
    ? await ProductAddonModel.find({ slug: { $in: addonSlugs }, isActive: true }).lean()
    : [];
  if (addons.length !== addonSlugs.length)
    throw createError(400, "One or more add-ons are invalid.");
  const includedModules = new Set(plan.moduleSlugs);
  const redundantModuleAddons = addons.filter(
    (addon) =>
      requestedAddonSlugs.includes(addon.slug) &&
      addon.featureKeys.some((featureKey) => featureKey.startsWith("module.")) &&
      addon.moduleSlugs.length > 0 &&
      (plan.slug === "enterprise" ||
        addon.moduleSlugs.every((moduleSlug) => includedModules.has(moduleSlug))),
  );
  if (redundantModuleAddons.length > 0) {
    throw createError(
      409,
      `${redundantModuleAddons.map((addon) => addon.name).join(", ")} already included in the selected plan.`,
    );
  }
  if (
    addons.some((addon) => {
      const periods = addon.availableBillingPeriods?.length
        ? addon.availableBillingPeriods
        : [addon.billingPeriod];
      return !periods.includes(billingPeriod);
    })
  ) {
    throw createError(400, "Add-on billing periods must match the selected plan.");
  }

  const included = new Set(plan.includedAddonSlugs);
  const chargeableAddons = addons.filter(
    (addon) =>
      requestedAddonSlugs.includes(addon.slug) && !tenant.enabledAddonSlugs.includes(addon.slug),
  );
  const capacitySlugs = ["meeting-capacity-100", "meeting-capacity-500"];
  const capacitySelections = [...tenant.enabledAddonSlugs, ...requestedAddonSlugs].filter((slug) =>
    capacitySlugs.includes(slug),
  );
  if (new Set(capacitySelections).size > 1)
    throw createError(
      409,
      "Choose either the 100-seat or 500-seat meeting capacity add-on; they cannot be stacked.",
    );
  if (input.addonOnly && chargeableAddons.length === 0)
    throw createError(409, "Selected add-on is already enabled or included in the plan.");
  const licensedUserCount = input.addonOnly
    ? tenant.maxStudents
    : Math.trunc(input.licensedUserCount ?? plan.minimumBillableUsers);
  if (
    !input.addonOnly &&
    (!Number.isSafeInteger(licensedUserCount) ||
      !licensedUserCount ||
      licensedUserCount < plan.minimumBillableUsers ||
      licensedUserCount > plan.studentLimit)
  ) {
    throw createError(
      400,
      `Licensed users must be between ${plan.minimumBillableUsers} and ${plan.studentLimit}.`,
    );
  }
  const calculatedMonthlyPlanAmount =
    plan.pricingModel === "per_user_day"
      ? (licensedUserCount ?? plan.minimumBillableUsers) * plan.dailyRatePaise * 30
      : monthlyPriceWithPremium(plan.amountInPaise);
  const monthlyPlanAmount =
    plan.pricingModel === "fixed" && plan.monthlyAmountInPaise > 0
      ? plan.monthlyAmountInPaise
      : calculatedMonthlyPlanAmount;
  const planAmount =
    billingPeriod === "month"
      ? monthlyPlanAmount
      : billingPeriod === "year"
        ? plan.amountInPaise
        : plan.amountInPaise;
  const addonAmount = (addon: (typeof addons)[number]) =>
    billingPeriod === "month" ? addon.monthlyAmountInPaise : addon.amountInPaise;
  const subtotalBeforeCoupon = input.addonOnly
    ? chargeableAddons.reduce((sum, addon) => sum + addonAmount(addon), 0)
    : planAmount +
      addons.reduce((sum, addon) => sum + (included.has(addon.slug) ? 0 : addonAmount(addon)), 0);
  const lineItems = [
    ...(!input.addonOnly
      ? [
          {
            kind: "plan" as const,
            slug: plan.slug,
            description: `${plan.name} subscription`,
            billingLabel: billingPeriodLabel(billingPeriod),
            amountInPaise: planAmount,
          },
        ]
      : []),
    ...chargeableAddons
      .filter((addon) => input.addonOnly || !included.has(addon.slug))
      .map((addon) => ({
        kind: "addon" as const,
        slug: addon.slug,
        description: addon.name,
        billingLabel: billingPeriodLabel(billingPeriod),
        amountInPaise: addonAmount(addon),
      })),
  ];
  if (lineItems.reduce((sum, item) => sum + item.amountInPaise, 0) !== subtotalBeforeCoupon)
    throw createError(500, "Invoice line-item calculation did not match the payable subtotal.");
  const hasRealMonthlyComparison =
    billingPeriod === "year" &&
    !input.addonOnly &&
    availablePeriods.includes("month") &&
    monthlyPlanAmount > 0;
  const listPrice = hasRealMonthlyComparison
    ? monthlyPlanAmount * 12 +
      addons.reduce(
        (sum, addon) =>
          sum +
          (included.has(addon.slug)
            ? 0
            : addon.availableBillingPeriods.includes("month") && addon.monthlyAmountInPaise > 0
              ? addon.monthlyAmountInPaise * 12
              : addonAmount(addon)),
        0,
      )
    : subtotalBeforeCoupon;
  const annualDiscount = Math.max(0, listPrice - subtotalBeforeCoupon);
  let couponCode: string | undefined;
  let couponDiscount = 0;
  let claimedCouponId: string | undefined;
  if (input.couponCode) {
    couponCode = String(input.couponCode).trim().toUpperCase();
    const now = new Date();
    const coupon = await PlatformCouponModel.findOne({
      code: couponCode,
      isActive: true,
      $and: [
        {
          $or: [
            { validFrom: { $exists: false } },
            { validFrom: null },
            { validFrom: { $lte: now } },
          ],
        },
        {
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: now } },
          ],
        },
      ],
    }).lean();
    if (!coupon) throw createError(400, "Coupon code is invalid or expired.");
    if (coupon.assignedEmail && coupon.assignedEmail !== tenant.billingEmail.toLowerCase())
      throw createError(403, "This coupon is assigned to another billing email.");
    if (coupon.assignedTenantId && coupon.assignedTenantId !== tenant.tenantId.toLowerCase())
      throw createError(403, "This coupon is assigned to another institution.");
    if (coupon.maxRedemptions && coupon.redemptionCount >= coupon.maxRedemptions)
      throw createError(409, "This coupon has reached its redemption limit.");
    couponDiscount =
      coupon.discountType === "percentage"
        ? Math.round((subtotalBeforeCoupon * Math.min(coupon.discountValue, 100)) / 100)
        : Math.min(subtotalBeforeCoupon, Math.round(coupon.discountValue));
    claimedCouponId = String(coupon._id);
  }
  const subtotal = Math.max(0, subtotalBeforeCoupon - couponDiscount);
  const discount = annualDiscount + couponDiscount;
  const taxRatePercent = billingSettings.taxRatePercent ?? 18;
  const taxAmount = Math.round((subtotal * taxRatePercent) / 100);
  const amount = subtotal + taxAmount;
  if (!Number.isSafeInteger(amount) || amount < 100)
    throw createError(400, "Payment amount is invalid.");
  const invoice = invoiceNumber();

  if (claimedCouponId) {
    const claimed = await PlatformCouponModel.findOneAndUpdate(
      {
        _id: claimedCouponId,
        isActive: true,
        ...(couponCode ? { code: couponCode } : {}),
        $expr: { $lt: ["$redemptionCount", { $ifNull: ["$maxRedemptions", 2147483647] }] },
      },
      { $inc: { redemptionCount: 1 } },
    );
    if (!claimed) throw createError(409, "This coupon is no longer available.");
  }
  let record;
  try {
    record = await PlatformBillingRecordModel.create({
      tenantId: tenant._id,
      checkoutId: input.checkoutId,
      planId: plan._id,
      addonSlugs: input.addonOnly ? chargeableAddons.map((addon) => addon.slug) : addonSlugs,
      lineItems,
      invoiceNumber: invoice,
      amountInPaise: amount,
      subtotalInPaise: subtotal,
      taxRatePercent,
      taxAmountInPaise: taxAmount,
      listPriceInPaise: listPrice,
      discountInPaise: discount,
      couponCode,
      couponDiscountInPaise: couponDiscount,
      currency: "INR",
      status: "created",
      paymentMethod: "bank_transfer",
      billingEmail: tenant.billingEmail,
      billingPeriod,
      purchaseKind: input.addonOnly ? "addon" : "plan",
      licensedUserCount,
    });
  } catch (error) {
    if (claimedCouponId)
      await PlatformCouponModel.updateOne(
        { _id: claimedCouponId, redemptionCount: { $gt: 0 } },
        { $inc: { redemptionCount: -1 } },
      );
    throw error;
  }
  return {
    billingId: record._id,
    amount,
    listPrice,
    discount,
    annualDiscount,
    lineItems,
    couponCode,
    couponDiscount,
    subtotal,
    taxRatePercent,
    taxAmount,
    currency: "INR",
    invoiceNumber: invoice,
    tenantName: tenant.name,
    billingEmail: tenant.billingEmail,
    paymentMethod: "bank_transfer" as const,
    bankTransfer: {
      accountHolderName: billingSettings.accountHolderName,
      bankName: billingSettings.bankName,
      accountNumber: billingSettings.accountNumber,
      ifscCode: billingSettings.ifscCode,
      branch: billingSettings.branch,
      upiId: billingSettings.upiId,
      instructions: billingSettings.instructions,
    },
  };
}

export async function applyCouponToPlatformOrder(input: {
  recordId: string;
  tenantId: string;
  couponCode: string;
}) {
  const [record, tenant] = await Promise.all([
    PlatformBillingRecordModel.findOne({
      _id: input.recordId,
      tenantId: input.tenantId,
      status: "created",
    }),
    TenantModel.findById(input.tenantId).select("tenantId billingEmail").lean(),
  ]);
  if (!record || !tenant) throw createError(404, "Reserved payment invoice was not found.");
  if (!tenant.billingEmail) throw createError(409, "Tenant billing email is missing.");
  if (record.couponCode) {
    if (record.couponCode === input.couponCode.trim().toUpperCase()) return record;
    throw createError(409, "A coupon is already applied to this reserved invoice.");
  }

  const code = input.couponCode.trim().toUpperCase();
  const now = new Date();
  const coupon = await PlatformCouponModel.findOne({
    code,
    isActive: true,
    $and: [
      {
        $or: [{ validFrom: { $exists: false } }, { validFrom: null }, { validFrom: { $lte: now } }],
      },
      {
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }],
      },
    ],
  }).lean();
  if (!coupon) throw createError(400, "Coupon code is invalid or expired.");
  if (coupon.assignedEmail && coupon.assignedEmail !== tenant.billingEmail.toLowerCase())
    throw createError(403, "This coupon is assigned to another billing email.");
  if (coupon.assignedTenantId && coupon.assignedTenantId !== tenant.tenantId.toLowerCase())
    throw createError(403, "This coupon is assigned to another institution.");

  const originalSubtotal = record.subtotalInPaise ?? record.amountInPaise;
  const couponDiscount =
    coupon.discountType === "percentage"
      ? Math.round((originalSubtotal * Math.min(coupon.discountValue, 100)) / 100)
      : Math.min(originalSubtotal, Math.round(coupon.discountValue));
  const subtotal = originalSubtotal - couponDiscount;
  const taxRatePercent = record.taxRatePercent ?? 0;
  const taxAmount = Math.round((subtotal * taxRatePercent) / 100);
  const amount = subtotal + taxAmount;
  if (amount < 100) throw createError(400, "Coupon would make the payable amount invalid.");

  const claimed = await PlatformCouponModel.findOneAndUpdate(
    {
      _id: coupon._id,
      isActive: true,
      $expr: { $lt: ["$redemptionCount", { $ifNull: ["$maxRedemptions", 2147483647] }] },
    },
    { $inc: { redemptionCount: 1 } },
  );
  if (!claimed) throw createError(409, "This coupon is no longer available.");

  try {
    record.couponCode = code;
    record.couponDiscountInPaise = couponDiscount;
    record.discountInPaise = (record.discountInPaise ?? 0) + couponDiscount;
    record.subtotalInPaise = subtotal;
    record.taxAmountInPaise = taxAmount;
    record.amountInPaise = amount;
    await record.save();
    return record;
  } catch (error) {
    await PlatformCouponModel.updateOne(
      { _id: coupon._id, redemptionCount: { $gt: 0 } },
      { $inc: { redemptionCount: -1 } },
    );
    throw error;
  }
}

async function activatePaidRecord(recordId: string) {
  const record = await PlatformBillingRecordModel.findById(recordId);
  if (!record) throw createError(404, "Billing record not found.");
  if (record.status === "paid") return record;

  const [plan, addons] = await Promise.all([
    SubscriptionPlanModel.findById(record.planId).lean(),
    ProductAddonModel.find({ slug: { $in: record.addonSlugs }, isActive: true }).lean(),
  ]);
  if (!plan) throw createError(409, "Purchased plan no longer exists.");
  const modules = [
    ...new Set([...plan.moduleSlugs, ...addons.flatMap((addon) => addon.moduleSlugs)]),
  ];
  const freeTrialEndsAt = new Date(Date.now() + Math.max(1, plan.trialDays) * 24 * 60 * 60 * 1000);
  const expiresAt =
    plan.planType === "free" ? freeTrialEndsAt : addPeriod(new Date(), record.billingPeriod);

  if (record.purchaseKind === "addon") {
    const tenant = await TenantModel.findById(record.tenantId).lean();
    const enabledAddonSlugs = [
      ...new Set([...(tenant?.enabledAddonSlugs || []), ...record.addonSlugs]),
    ];
    const enabledModuleSlugs = [
      ...new Set([
        ...(tenant?.enabledModuleSlugs || []),
        ...addons.flatMap((addon) => addon.moduleSlugs),
      ]),
    ];
    const additionalStudents = addons.reduce(
      (total, addon) => total + (addon.capacityBoost?.additionalStudents || 0),
      0,
    );
    const additionalEmployees = addons.reduce(
      (total, addon) => total + (addon.capacityBoost?.additionalEmployees || 0),
      0,
    );
    await TenantModel.updateOne(
      { _id: record.tenantId },
      {
        $set: { enabledAddonSlugs, enabledModuleSlugs, billingStatus: "active" },
        ...(additionalStudents || additionalEmployees
          ? {
              $inc: {
                maxStudents: additionalStudents,
                maxEmployees: additionalEmployees,
              },
            }
          : {}),
      },
    );
    record.status = "paid";
    record.paidAt = new Date();
    await record.save();
    void sendBillingDocument(String(record._id), "success").catch((error) =>
      console.error("[PlatformBilling] Add-on success email failed", error),
    );
    return record;
  }

  const tenant = await TenantModel.findById(record.tenantId)
    .select("firstPaidSubscriptionStartedAt unlimitedMeetingsUntil")
    .lean();
  const isFirstPaidSubscription = !tenant?.firstPaidSubscriptionStartedAt;
  // `maxStudents` is the hard enrollment cap. It must reflect the plan's
  // capacity (plan.studentLimit + add-on capacity boosts), NOT the billing
  // `licensedUserCount`. For per_user_day plans, `licensedUserCount` is the
  // minimum number of users the tenant is billed for — it is a billing concept,
  // not an enrollment limit. Writing it into `maxStudents` previously produced
  // `maxStudents: 1` when a tenant subscribed with a single licensed user,
  // which then blocked all new admissions with "Enrollment limit reached".
  const addonStudentBoost = addons.reduce(
    (total, addon) => total + (addon.capacityBoost?.additionalStudents ?? 0),
    0,
  );
  const addonEmployeeBoost = addons.reduce(
    (total, addon) => total + (addon.capacityBoost?.additionalEmployees ?? 0),
    0,
  );
  const planMaxStudents = plan.studentLimit + addonStudentBoost;
  const planMaxEmployees = plan.employeeLimit + addonEmployeeBoost;
  await TenantModel.updateOne(
    { _id: record.tenantId },
    {
      $set: {
        planId: record.planId,
        enabledModuleSlugs: modules,
        enabledAddonSlugs: record.addonSlugs,
        maxStudents: planMaxStudents,
        maxEmployees: planMaxEmployees,
        entitlementEnforced: true,
        billingStatus: plan.planType === "free" ? "trialing" : "active",
        status: TenantStatus.PROVISIONING,
        subscriptionExpiresAt: expiresAt,
        ...(plan.planType === "free" ? { trialEndsAt: freeTrialEndsAt } : {}),
        ...(plan.planType === "paid" && isFirstPaidSubscription
          ? {
              firstPaidSubscriptionStartedAt: new Date(),
              unlimitedMeetingsUntil: expiresAt,
            }
          : {}),
      },
      $unset: plan.planType === "free" ? { graceEndsAt: 1 } : { trialEndsAt: 1, graceEndsAt: 1 },
    },
  );
  record.status = "paid";
  record.paidAt = new Date();
  await record.save();
  void import("./tenant-provisioning.service")
    .then(({ provisionPendingCheckoutForTenant }) =>
      provisionPendingCheckoutForTenant(String(record.tenantId)),
    )
    .catch((error: unknown) =>
      logger.error("[PlatformBilling] Paid tenant provisioning failed", {
        error,
        billingRecordId: String(record._id),
        tenantId: String(record.tenantId),
      }),
    );
  void sendBillingDocument(String(record._id), "success").catch((error) =>
    logger.error("[PlatformBilling] Success email failed", {
      error,
      billingRecordId: String(record._id),
    }),
  );
  return record;
}

export async function approveOfflinePlatformPayment(input: {
  recordId: string;
  reviewedBy: string;
  remarks?: string;
}) {
  const record = await PlatformBillingRecordModel.findOneAndUpdate(
    {
      _id: input.recordId,
      paymentMethod: "bank_transfer",
      status: "submitted",
      reviewedAt: { $exists: false },
    },
    {
      $set: {
        reviewedBy: input.reviewedBy,
        reviewedAt: new Date(),
        reviewRemarks: input.remarks?.trim(),
      },
    },
    { returnDocument: "after" },
  );
  if (!record) {
    const existing = await PlatformBillingRecordModel.findById(input.recordId);
    if (existing?.status === "paid") return existing;
    throw createError(409, "Only an unreviewed bank-transfer payment can be approved.");
  }
  await PublicCheckoutModel.updateOne(
    { tenantId: record.tenantId, status: "awaiting_payment_review" },
    { $set: { status: "payment_verified" }, $unset: { error: 1 } },
  );
  try {
    return await activatePaidRecord(String(record._id));
  } catch (error) {
    await PublicCheckoutModel.updateOne(
      { tenantId: record.tenantId, status: "payment_verified" },
      { $set: { status: "awaiting_payment_review" } },
    );
    throw error;
  }
}

export async function rejectOfflinePlatformPayment(input: {
  recordId: string;
  reviewedBy: string;
  remarks: string;
}) {
  const remarks = input.remarks.trim();
  if (remarks.length < 10) throw createError(400, "A clear rejection reason is required.");
  const record = await PlatformBillingRecordModel.findOneAndUpdate(
    { _id: input.recordId, paymentMethod: "bank_transfer", status: "submitted" },
    {
      $set: {
        status: "rejected",
        reviewedBy: input.reviewedBy,
        reviewedAt: new Date(),
        reviewRemarks: remarks,
      },
    },
    { returnDocument: "after" },
  );
  if (!record) {
    const existing = await PlatformBillingRecordModel.findById(input.recordId);
    if (existing?.status === "rejected") return existing;
    throw createError(409, "Only a submitted bank-transfer payment can be rejected.");
  }
  await PublicCheckoutModel.updateOne(
    { tenantId: record.tenantId },
    { $set: { status: "pending_payment", error: remarks } },
  );
  return record;
}

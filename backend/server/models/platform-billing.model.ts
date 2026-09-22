import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IPlatformBillingLineItem {
  kind: "plan" | "addon";
  slug: string;
  description: string;
  billingLabel: string;
  amountInPaise: number;
}

export interface IPlatformBillingRecord extends Document {
  tenantId: Types.ObjectId;
  checkoutId?: Types.ObjectId;
  planId: Types.ObjectId;
  addonSlugs: string[];
  lineItems: IPlatformBillingLineItem[];
  invoiceNumber: string;
  amountInPaise: number;
  subtotalInPaise?: number;
  taxRatePercent?: number;
  taxAmountInPaise?: number;
  listPriceInPaise?: number;
  discountInPaise?: number;
  couponCode?: string;
  couponDiscountInPaise?: number;
  currency: "INR";
  status: "created" | "submitted" | "paid" | "rejected" | "failed" | "refunded" | "cancelled";
  paymentMethod: "bank_transfer";
  paymentChannel?: "neft" | "rtgs" | "imps" | "upi";
  transferReference?: string;
  paymentProofUrl?: string;
  paymentProofPublicId?: string;
  paymentProofMimeType?: string;
  paymentDate?: Date;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
  reviewRemarks?: string;
  paidAt?: Date;
  failedAt?: Date;
  failureCode?: string;
  failureDescription?: string;
  refundAmountInPaise?: number;
  refundedAt?: Date;
  successEmailSentAt?: Date;
  failureEmailSentAt?: Date;
  refundEmailSentAt?: Date;
  billingEmail: string;
  billingPeriod: "month" | "year" | "one_time";
  purchaseKind: "plan" | "addon";
  licensedUserCount?: number;
  webhookEventIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IPlatformBillingRecord>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    checkoutId: {
      type: Schema.Types.ObjectId,
      ref: "PublicCheckout",
      sparse: true,
      unique: true,
      index: true,
    },
    planId: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan", required: true },
    addonSlugs: [{ type: String, lowercase: true, trim: true }],
    lineItems: {
      type: [
        new Schema<IPlatformBillingLineItem>(
          {
            kind: { type: String, enum: ["plan", "addon"], required: true },
            slug: { type: String, required: true, lowercase: true, trim: true },
            description: { type: String, required: true, trim: true },
            billingLabel: { type: String, required: true, trim: true },
            amountInPaise: { type: Number, required: true, min: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    invoiceNumber: { type: String, required: true, unique: true },
    amountInPaise: { type: Number, required: true, min: 0 },
    subtotalInPaise: { type: Number, min: 0 },
    taxRatePercent: { type: Number, min: 0, max: 100 },
    taxAmountInPaise: { type: Number, min: 0 },
    listPriceInPaise: { type: Number, min: 0 },
    discountInPaise: { type: Number, min: 0 },
    couponCode: { type: String, uppercase: true, trim: true },
    couponDiscountInPaise: { type: Number, min: 0 },
    currency: { type: String, enum: ["INR"], default: "INR" },
    status: {
      type: String,
      enum: ["created", "submitted", "paid", "rejected", "failed", "refunded", "cancelled"],
      default: "created",
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ["bank_transfer"],
      default: "bank_transfer",
      index: true,
    },
    paymentChannel: { type: String, enum: ["neft", "rtgs", "imps", "upi"] },
    transferReference: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
      unique: true,
      maxlength: 50,
    },
    paymentProofUrl: { type: String, trim: true },
    paymentProofPublicId: { type: String, trim: true },
    paymentProofMimeType: { type: String, trim: true },
    paymentDate: Date,
    submittedAt: Date,
    reviewedAt: Date,
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewRemarks: { type: String, trim: true, maxlength: 1000 },
    paidAt: Date,
    failedAt: Date,
    failureCode: { type: String, trim: true },
    failureDescription: { type: String, trim: true, maxlength: 1000 },
    refundAmountInPaise: { type: Number, min: 0 },
    refundedAt: Date,
    successEmailSentAt: Date,
    failureEmailSentAt: Date,
    refundEmailSentAt: Date,
    billingEmail: { type: String, required: true, lowercase: true, trim: true },
    billingPeriod: { type: String, enum: ["month", "year", "one_time"], required: true },
    purchaseKind: { type: String, enum: ["plan", "addon"], default: "plan" },
    licensedUserCount: { type: Number, min: 1 },
    webhookEventIds: [{ type: String }],
  },
  { timestamps: true },
);
schema.index({ tenantId: 1, createdAt: -1 });
export const PlatformBillingRecordModel = mongoose.model<IPlatformBillingRecord>(
  "PlatformBillingRecord",
  schema,
);

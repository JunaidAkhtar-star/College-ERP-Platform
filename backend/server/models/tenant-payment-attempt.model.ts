import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface ITenantPaymentAttempt extends Document {
  _id: Types.ObjectId;
  provider: "razorpay" | "stripe" | "paytm" | "phonepe" | "cashfree";
  feeRecordId: Types.ObjectId;
  requestedBy: Types.ObjectId;
  amount: number;
  currency: string;
  idempotencyKey: string;
  status: "creating" | "pending" | "processing" | "paid" | "failed";
  providerOrderId?: string;
  checkoutUrl?: string;
  checkoutToken?: string;
  providerPaymentId?: string;
  lastError?: string;
  paidAt?: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TenantPaymentAttemptSchema = new Schema<ITenantPaymentAttempt>(
  {
    provider: {
      type: String,
      enum: ["razorpay", "stripe", "paytm", "phonepe", "cashfree"],
      required: true,
    },
    feeRecordId: {
      type: Schema.Types.ObjectId,
      ref: "FeeRecord",
      required: true,
      index: true,
    },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, default: "INR", uppercase: true },
    idempotencyKey: { type: String, required: true },
    status: {
      type: String,
      enum: ["creating", "pending", "processing", "paid", "failed"],
      default: "creating",
      index: true,
    },
    providerOrderId: { type: String, index: true, sparse: true },
    checkoutUrl: String,
    checkoutToken: String,
    providerPaymentId: String,
    lastError: { type: String, maxlength: 500 },
    paidAt: Date,
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

TenantPaymentAttemptSchema.index({ provider: 1, idempotencyKey: 1 }, { unique: true });
TenantPaymentAttemptSchema.index(
  { provider: 1, providerOrderId: 1 },
  { unique: true, sparse: true },
);
TenantPaymentAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export const TenantPaymentAttemptModel = mongoose.model<ITenantPaymentAttempt>(
  "TenantPaymentAttempt",
  TenantPaymentAttemptSchema,
);

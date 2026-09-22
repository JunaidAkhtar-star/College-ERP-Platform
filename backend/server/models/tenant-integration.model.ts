import mongoose, { Schema, type Document, type Types } from "mongoose";

export type TenantIntegrationProvider =
  | "smtp"
  | "firebase"
  | "google_sso"
  | "microsoft_sso"
  | "sms"
  | "razorpay"
  | "stripe"
  | "paytm"
  | "phonepe"
  | "cashfree"
  | "webhooks";
export type TenantIntegrationStatus = "not_configured" | "configured" | "healthy" | "error";

export interface ITenantIntegration extends Document {
  _id: Types.ObjectId;
  provider: TenantIntegrationProvider;
  enabled: boolean;
  config: Record<string, unknown>;
  secretCiphertext?: string;
  status: TenantIntegrationStatus;
  lastTestedAt?: Date;
  lastTestSucceeded?: boolean;
  lastError?: string;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TenantIntegrationSchema = new Schema<ITenantIntegration>(
  {
    provider: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: false },
    config: { type: Schema.Types.Mixed, default: {} },
    secretCiphertext: { type: String, select: false },
    status: {
      type: String,
      enum: ["not_configured", "configured", "healthy", "error"],
      default: "not_configured",
    },
    lastTestedAt: Date,
    lastTestSucceeded: Boolean,
    lastError: { type: String, maxlength: 500 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const TenantIntegrationModel = mongoose.model<ITenantIntegration>(
  "TenantIntegration",
  TenantIntegrationSchema,
);

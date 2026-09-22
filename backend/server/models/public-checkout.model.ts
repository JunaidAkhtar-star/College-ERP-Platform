import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IPublicCheckout extends Document {
  tenantId: Types.ObjectId;
  planId: Types.ObjectId;
  sessionTokenHash: string;
  registrationRequestHash?: string;
  registrationRecoveryCiphertext?: string;
  paymentEmailSentAt?: Date;
  adminEmail: string;
  adminPasswordCiphertext: string;
  billingPeriod: "month" | "year";
  addonSlugs: string[];
  couponCode?: string;
  status:
    | "pending_payment"
    | "awaiting_payment_review"
    | "payment_verified"
    | "provisioning"
    | "ready"
    | "failed";
  error?: string;
  expiresAt: Date;
}

const schema = new Schema<IPublicCheckout>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, unique: true },
    planId: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan", required: true },
    sessionTokenHash: { type: String, required: true, unique: true, select: false },
    registrationRequestHash: { type: String, unique: true, sparse: true, select: false },
    registrationRecoveryCiphertext: { type: String, select: false },
    paymentEmailSentAt: Date,
    adminEmail: { type: String, required: true, lowercase: true, trim: true },
    adminPasswordCiphertext: { type: String, required: true, select: false },
    billingPeriod: { type: String, enum: ["month", "year"], required: true },
    addonSlugs: [{ type: String, lowercase: true, trim: true }],
    couponCode: { type: String, uppercase: true, trim: true },
    status: {
      type: String,
      enum: [
        "pending_payment",
        "awaiting_payment_review",
        "payment_verified",
        "provisioning",
        "ready",
        "failed",
      ],
      required: true,
      index: true,
    },
    error: { type: String, maxlength: 1000 },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true },
);

export const PublicCheckoutModel = mongoose.model<IPublicCheckout>("PublicCheckout", schema);

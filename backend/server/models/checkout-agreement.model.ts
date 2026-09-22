import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface ICheckoutAgreement extends Document {
  checkoutId: Types.ObjectId;
  tenantId: Types.ObjectId;
  email: string;
  ndaVersion: string;
  ndaHash: string;
  ndaTitle: string;
  ndaSections: Array<{ heading: string; body: string }>;
  termsVersion: string;
  termsHash: string;
  termsTitle: string;
  termsSections: Array<{ heading: string; body: string }>;
  signatoryName: string;
  signatoryDesignation: string;
  signatoryAuthorityConfirmed: boolean;
  ndaAccepted: boolean;
  termsAccepted: boolean;
  otpHash?: string;
  otpSalt?: string;
  otpExpiresAt?: Date;
  otpSentAt?: Date;
  otpAttempts: number;
  otpVerifiedAt?: Date;
  acceptedAt?: Date;
  acceptanceId?: string;
  ipAddressCiphertext?: string;
  userAgent?: string;
}

const schema = new Schema<ICheckoutAgreement>(
  {
    checkoutId: {
      type: Schema.Types.ObjectId,
      ref: "PublicCheckout",
      required: true,
      index: true,
    },
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    ndaVersion: { type: String, required: true },
    ndaHash: { type: String, required: true },
    ndaTitle: { type: String, required: true },
    ndaSections: {
      type: [{ heading: { type: String, required: true }, body: { type: String, required: true } }],
      required: true,
    },
    termsVersion: { type: String, required: true },
    termsHash: { type: String, required: true },
    termsTitle: { type: String, required: true },
    termsSections: {
      type: [{ heading: { type: String, required: true }, body: { type: String, required: true } }],
      required: true,
    },
    signatoryName: { type: String, required: true, trim: true, maxlength: 120 },
    signatoryDesignation: { type: String, required: true, trim: true, maxlength: 120 },
    signatoryAuthorityConfirmed: { type: Boolean, required: true },
    ndaAccepted: { type: Boolean, required: true },
    termsAccepted: { type: Boolean, required: true },
    otpHash: { type: String, select: false },
    otpSalt: { type: String, select: false },
    otpExpiresAt: Date,
    otpSentAt: Date,
    otpAttempts: { type: Number, default: 0, min: 0, max: 5 },
    otpVerifiedAt: Date,
    acceptedAt: Date,
    acceptanceId: { type: String, unique: true, sparse: true, index: true },
    ipAddressCiphertext: { type: String, select: false },
    userAgent: { type: String, maxlength: 500 },
  },
  { timestamps: true },
);

schema.index({ checkoutId: 1, ndaVersion: 1, termsVersion: 1 }, { unique: true });

export const CheckoutAgreementModel = mongoose.model<ICheckoutAgreement>(
  "CheckoutAgreement",
  schema,
);

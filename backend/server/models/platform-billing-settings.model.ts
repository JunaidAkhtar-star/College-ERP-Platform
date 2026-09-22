import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IPlatformBillingSettings extends Document {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branch?: string;
  upiId?: string;
  instructions?: string;
  legalName?: string;
  gstin?: string;
  state?: string;
  taxRatePercent: number;
  authorizedSignatoryName?: string;
  isEnabled: boolean;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IPlatformBillingSettings>(
  {
    accountHolderName: { type: String, required: true, trim: true, maxlength: 120 },
    bankName: { type: String, required: true, trim: true, maxlength: 120 },
    accountNumber: { type: String, required: true, trim: true, maxlength: 34 },
    ifscCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: /^[A-Z]{4}0[A-Z0-9]{6}$/,
    },
    branch: { type: String, trim: true, maxlength: 120 },
    upiId: { type: String, trim: true, lowercase: true, maxlength: 120 },
    instructions: { type: String, trim: true, maxlength: 1000 },
    legalName: { type: String, trim: true, maxlength: 160 },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      match: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/,
    },
    state: { type: String, trim: true, maxlength: 100 },
    taxRatePercent: { type: Number, min: 0, max: 100, default: 18 },
    authorizedSignatoryName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "Rajesh Kumar Behera",
    },
    isEnabled: { type: Boolean, default: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const PlatformBillingSettingsModel = mongoose.model<IPlatformBillingSettings>(
  "PlatformBillingSettings",
  schema,
);

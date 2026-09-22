/**
 * Payment Settings Model
 *
 * Super Admin configures the institution's payment details here.
 * Students see these details (QR code, bank account, UPI ID) on their fee
 * portal when making a payment. Only one active record per institution.
 */
import type { Document, Types } from "mongoose";
import mongoose, { Schema } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export interface IBankAccount {
  bankName: string;
  accountHolderName: string;
  accountNumber: string; // stored encrypted
  ifscCode: string;
  branchName?: string;
  accountType: "savings" | "current";
}

export interface IPaymentSettings extends Document {
  _id: Types.ObjectId;
  institutionName: string;
  isActive: boolean;

  // QR Code
  qrCodeUrl?: string; // Cloudinary URL of the QR image
  qrCodePublicId?: string;

  // UPI
  upiId?: string; // e.g. college@sbi
  upiName?: string; // Display name shown with QR

  // Bank Transfer
  bankAccounts: IBankAccount[];

  // Misc
  paymentInstructions?: string; // Rich text / markdown shown to students
  acceptedModes: string[]; // ["upi", "neft", "rtgs", "imps", "cheque", "dd"]

  // Screenshot / proof settings
  requireScreenshot: boolean;
  requireUtrNumber: boolean;
  maxVerificationDays: number; // SLA — accounts team must verify within N days

  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BankAccountSchema = new Schema<IBankAccount>(
  {
    bankName: { type: String, required: true, trim: true },
    accountHolderName: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true }, // encrypted at service layer
    ifscCode: { type: String, required: true, trim: true, uppercase: true },
    branchName: { type: String, trim: true },
    accountType: { type: String, enum: ["savings", "current"], default: "current" },
  },
  { _id: false },
);

const PaymentSettingsSchema = new Schema<IPaymentSettings>(
  {
    institutionName: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    qrCodeUrl: { type: String },
    qrCodePublicId: { type: String },
    upiId: { type: String, trim: true },
    upiName: { type: String, trim: true },
    bankAccounts: { type: [BankAccountSchema], default: [] },
    paymentInstructions: { type: String },
    acceptedModes: {
      type: [String],
      default: ["upi", "neft", "rtgs", "imps"],
    },
    requireScreenshot: { type: Boolean, default: true },
    requireUtrNumber: { type: Boolean, default: true },
    maxVerificationDays: { type: Number, default: 3, min: 1, max: 30 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

PaymentSettingsSchema.plugin(auditPlugin);

export const PaymentSettingsModel = mongoose.model<IPaymentSettings>(
  "PaymentSettings",
  PaymentSettingsSchema,
);

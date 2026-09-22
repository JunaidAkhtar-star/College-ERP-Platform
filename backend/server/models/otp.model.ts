import type { Document, Types } from "mongoose";
import mongoose, { Schema } from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface IOtp extends Document {
  _id: Types.ObjectId;
  /** The user this OTP belongs to (null for pre-registration email flows). */
  userId?: Types.ObjectId;
  email: string;
  otp: string; // Hashed with bcrypt before storage
  purpose: OtpPurpose;
  expiresAt: Date;
  isUsed: boolean;
  attempts: number; // Increment on each wrong attempt; lock after 5
  createdAt: Date;
  updatedAt: Date;
}

export enum OtpPurpose {
  EMAIL_VERIFICATION = "email_verification",
  FORGOT_PASSWORD = "forgot_password",
  MFA_LOGIN = "mfa_login",
  PHONE_VERIFICATION = "phone_verification",
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

const otpSchema = new Schema<IOtp>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    otp: { type: String, required: true, select: false },
    purpose: { type: String, enum: Object.values(OtpPurpose), required: true },
    expiresAt: { type: Date, required: true },
    isUsed: { type: Boolean, default: false },
    attempts: { type: Number, default: 0, max: 5 },
  },
  { timestamps: true },
);

// Auto-delete expired OTP documents (TTL index)
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ email: 1, purpose: 1 });

export const OtpModel = mongoose.model<IOtp>("Otp", otpSchema);

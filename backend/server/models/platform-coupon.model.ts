import mongoose, { Schema, type Document } from "mongoose";

export interface IPlatformCoupon extends Document {
  code: string;
  description?: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  assignedEmail?: string;
  assignedTenantId?: string;
  validFrom?: Date;
  expiresAt?: Date;
  maxRedemptions?: number;
  redemptionCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IPlatformCoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z0-9][A-Z0-9_-]{2,31}$/,
    },
    description: { type: String, trim: true, maxlength: 240 },
    discountType: { type: String, enum: ["percentage", "fixed"], required: true },
    discountValue: { type: Number, required: true, min: 1 },
    assignedEmail: { type: String, lowercase: true, trim: true },
    assignedTenantId: { type: String, lowercase: true, trim: true },
    validFrom: Date,
    expiresAt: Date,
    maxRedemptions: { type: Number, min: 1 },
    redemptionCount: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

schema.index({ isActive: 1, expiresAt: 1 });

export const PlatformCouponModel = mongoose.model<IPlatformCoupon>("PlatformCoupon", schema);

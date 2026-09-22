/**
 * Institution Setting Model
 *
 * Super Admin configures the global institution settings here (e.g. name, tagline, address, contact details).
 * These details are dynamically loaded into email layouts, portals, and reports.
 */
import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IInstitutionSetting extends Document {
  _id: Types.ObjectId;
  name: string;
  shortCode?: string;
  tagline?: string;
  address?: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  logoUrl?: string;
  logoPublicId?: string;
  faviconUrl?: string;
  faviconPublicId?: string;
  invoicePrefix?: string;
  receiptPrefix?: string;
  emailSenderName?: string;
  replyToEmail?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoImageUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  onboardingStatus: "pending" | "completed";
  onboardingStep?: number;
  onboardingCompletedAt?: Date;
  accreditations?: string[];
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const InstitutionSettingSchema = new Schema<IInstitutionSetting>(
  {
    name: { type: String, required: true, trim: true, default: "Institution setup required" },
    shortCode: { type: String, trim: true, uppercase: true, maxlength: 12 },
    tagline: { type: String, trim: true },
    address: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    websiteUrl: { type: String, trim: true },
    logoUrl: { type: String },
    logoPublicId: { type: String },
    accreditations: {
      type: [String],
      default: [],
    },
    faviconUrl: { type: String, trim: true },
    faviconPublicId: { type: String, trim: true },
    invoicePrefix: { type: String, trim: true, uppercase: true, maxlength: 16 },
    receiptPrefix: { type: String, trim: true, uppercase: true, maxlength: 16 },
    emailSenderName: { type: String, trim: true },
    replyToEmail: { type: String, trim: true, lowercase: true },
    seoTitle: { type: String, trim: true, maxlength: 70 },
    seoDescription: { type: String, trim: true, maxlength: 180 },
    seoImageUrl: { type: String, trim: true },
    primaryColor: { type: String, trim: true, match: /^#[0-9A-Fa-f]{6}$/, default: "#0178D7" },
    secondaryColor: { type: String, trim: true, match: /^#[0-9A-Fa-f]{6}$/, default: "#9BB94F" },
    onboardingStatus: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
      index: true,
    },
    onboardingStep: { type: Number, min: 0, max: 5, default: 0 },
    onboardingCompletedAt: { type: Date },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const InstitutionSettingModel = mongoose.model<IInstitutionSetting>(
  "InstitutionSetting",
  InstitutionSettingSchema,
);

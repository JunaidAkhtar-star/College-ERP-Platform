/**
 * @file platform.model.ts
 * @description Global Devvelocity product catalogue, plans and public website configuration.
 * @module server/models
 */

import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IPlatformProduct extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  eyebrow: string;
  description: string;
  status: "available" | "planned" | "retired";
  publicPath?: string;
  icon: string;
  isPublic: boolean;
  sortOrder: number;
}

const PlatformProductSchema = new Schema<IPlatformProduct>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, match: /^[a-z0-9-]+$/ },
    eyebrow: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ["available", "planned", "retired"],
      default: "planned",
      index: true,
    },
    publicPath: { type: String, trim: true },
    icon: { type: String, required: true, trim: true },
    isPublic: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export interface IProductModule extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  icon: string;
  frontendRoute: string;
  apiRoute: string;
  frontendRoutes: string[];
  apiRoutes: string[];
  permissionModule: string;
  features: string[];
  status: "active" | "maintenance" | "planned";
  sortOrder: number;
  isPublic: boolean;
  tier: "core" | "standard" | "premium" | "ultimate";
  productSlug: string;
}

const ProductModuleSchema = new Schema<IProductModule>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, match: /^[a-z0-9-]+$/ },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    icon: { type: String, required: true, trim: true },
    frontendRoute: { type: String, required: true, trim: true },
    apiRoute: { type: String, required: true, trim: true },
    frontendRoutes: [{ type: String, trim: true }],
    apiRoutes: [{ type: String, trim: true }],
    permissionModule: {
      type: String,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9_]+$/,
    },
    features: [{ type: String, trim: true }],
    status: { type: String, enum: ["active", "maintenance", "planned"], default: "active" },
    sortOrder: { type: Number, default: 0 },
    isPublic: { type: Boolean, default: true },
    tier: {
      type: String,
      enum: ["core", "standard", "premium", "ultimate"],
      default: "core",
      index: true,
    },
    productSlug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      default: "college-erp",
      index: true,
    },
  },
  { timestamps: true },
);

export interface ISubscriptionPlan extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  priceLabel: string;
  billingPeriod: "month" | "year" | "one_time";
  availableBillingPeriods: ("month" | "year" | "one_time")[];
  monthlyAmountInPaise: number;
  moduleSlugs: string[];
  highlights: string[];
  studentLimit: number;
  employeeLimit: number;
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
  planType: "free" | "paid";
  amountInPaise: number;
  pricingModel: "per_user_day" | "fixed";
  dailyRatePaise: number;
  minimumBillableUsers: number;
  currency: "INR";
  trialDays: number;
  graceDays: number;
  includedAddonSlugs: string[];
  meetingLimits: {
    maxParticipants: number;
    maxDurationMinutes: number;
    monthlyMinutes: number;
    concurrentMeetings: number;
    recordingEnabled: boolean;
    recordingStorageMb: number;
    retentionDays: number;
  };
  productSlug: string;
}

const SubscriptionPlanSchema = new Schema<ISubscriptionPlan>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, match: /^[a-z0-9-]+$/ },
    description: { type: String, required: true, maxlength: 500 },
    priceLabel: { type: String, required: true, trim: true },
    billingPeriod: { type: String, enum: ["month", "year", "one_time"], default: "year" },
    availableBillingPeriods: {
      type: [{ type: String, enum: ["month", "year", "one_time"] }],
      default: ["month", "year"],
    },
    monthlyAmountInPaise: { type: Number, min: 0, default: 0 },
    moduleSlugs: [{ type: String, trim: true }],
    highlights: [{ type: String, trim: true }],
    studentLimit: { type: Number, min: 10, default: 2000 },
    employeeLimit: { type: Number, min: 1, default: 200 },
    isPopular: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    planType: { type: String, enum: ["free", "paid"], default: "paid" },
    amountInPaise: { type: Number, min: 0, required: true, default: 0 },
    pricingModel: {
      type: String,
      enum: ["per_user_day", "fixed"],
      default: "per_user_day",
    },
    dailyRatePaise: { type: Number, min: 0, default: 0 },
    minimumBillableUsers: { type: Number, min: 1, default: 100 },
    currency: { type: String, enum: ["INR"], default: "INR" },
    trialDays: { type: Number, min: 0, max: 30, default: 3 },
    graceDays: { type: Number, min: 0, max: 30, default: 3 },
    includedAddonSlugs: [{ type: String, trim: true, lowercase: true }],
    meetingLimits: {
      maxParticipants: { type: Number, min: 2, default: 50 },
      maxDurationMinutes: { type: Number, min: 15, default: 120 },
      monthlyMinutes: { type: Number, min: 0, default: 5000 },
      concurrentMeetings: { type: Number, min: 1, default: 5 },
      recordingEnabled: { type: Boolean, default: false },
      recordingStorageMb: { type: Number, min: 0, default: 0 },
      retentionDays: { type: Number, min: 1, default: 30 },
    },
    productSlug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      default: "college-erp",
      index: true,
    },
  },
  { timestamps: true },
);

export interface IProductAddon extends Document {
  name: string;
  slug: string;
  description: string;
  moduleSlugs: string[];
  featureKeys: string[];
  amountInPaise: number;
  currency: "INR";
  billingPeriod: "month" | "year" | "one_time";
  availableBillingPeriods: ("month" | "year" | "one_time")[];
  monthlyAmountInPaise: number;
  isActive: boolean;
  sortOrder: number;
  capacityBoost?: {
    additionalStudents: number;
    additionalEmployees: number;
  };
  meetingLimitBoost?: {
    additionalParticipants: number;
    additionalMonthlyMinutes: number;
    additionalConcurrentMeetings: number;
    additionalRecordingStorageMb: number;
    additionalRetentionDays: number;
    enableRecording: boolean;
  };
  productSlug: string;
}

const ProductAddonSchema = new Schema<IProductAddon>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, match: /^[a-z0-9-]+$/ },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    moduleSlugs: [{ type: String, lowercase: true, trim: true }],
    featureKeys: [{ type: String, lowercase: true, trim: true }],
    amountInPaise: { type: Number, min: 0, required: true },
    currency: { type: String, enum: ["INR"], default: "INR" },
    billingPeriod: { type: String, enum: ["month", "year", "one_time"], default: "year" },
    availableBillingPeriods: {
      type: [{ type: String, enum: ["month", "year", "one_time"] }],
      default: ["month", "year"],
    },
    monthlyAmountInPaise: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    capacityBoost: {
      additionalStudents: { type: Number, min: 0, default: 0 },
      additionalEmployees: { type: Number, min: 0, default: 0 },
    },
    meetingLimitBoost: {
      additionalParticipants: { type: Number, min: 0, default: 0 },
      additionalMonthlyMinutes: { type: Number, min: 0, default: 0 },
      additionalConcurrentMeetings: { type: Number, min: 0, default: 0 },
      additionalRecordingStorageMb: { type: Number, min: 0, default: 0 },
      additionalRetentionDays: { type: Number, min: 0, default: 0 },
      enableRecording: { type: Boolean, default: false },
    },
    productSlug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      default: "college-erp",
      index: true,
    },
  },
  { timestamps: true },
);

export interface IPublicSiteConfig extends Document {
  _id: Types.ObjectId;
  companyName: string;
  headline: string;
  description: string;
  supportEmail: string;
  salesEmail: string;
  phone: string;
  address: string;
  socialLinks: {
    linkedin?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
    x?: string;
  };
}

const PublicSiteConfigSchema = new Schema<IPublicSiteConfig>(
  {
    companyName: { type: String, required: true, trim: true },
    headline: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    supportEmail: { type: String, required: true, lowercase: true, trim: true },
    salesEmail: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    socialLinks: {
      linkedin: String,
      facebook: String,
      instagram: String,
      youtube: String,
      x: String,
    },
  },
  { timestamps: true },
);

export const ProductModuleModel = mongoose.model<IProductModule>(
  "ProductModule",
  ProductModuleSchema,
);
export const PlatformProductModel = mongoose.model<IPlatformProduct>(
  "PlatformProduct",
  PlatformProductSchema,
);
export const SubscriptionPlanModel = mongoose.model<ISubscriptionPlan>(
  "SubscriptionPlan",
  SubscriptionPlanSchema,
);
export const PublicSiteConfigModel = mongoose.model<IPublicSiteConfig>(
  "PublicSiteConfig",
  PublicSiteConfigSchema,
);
export const ProductAddonModel = mongoose.model<IProductAddon>("ProductAddon", ProductAddonSchema);

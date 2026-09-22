/**
 * @file tenant.model.ts
 * @description Mongoose schema and typescript interfaces for college tenants.
 *              Stored globally in the SaaS master database.
 * @module server/models
 */

import { auditPlugin } from "../plugins/audit.plugin";
import mongoose, { Schema, type Document, type Types } from "mongoose";

export enum TenantStatus {
  PENDING_PAYMENT = "pending_payment",
  PENDING_APPROVAL = "pending_approval",
  PROVISIONING = "provisioning",
  ACTIVE = "active",
  SUSPENDED = "suspended",
  EXPIRED = "expired",
  PROVISIONING_FAILED = "provisioning_failed",
}

export interface ITenant extends Document {
  _id: Types.ObjectId;
  tenantId: string; // Subdomain key (e.g. "mit", "stanford")
  name: string; // Official College name
  databaseName: string; // Generated database name on the shared cluster
  status: TenantStatus;
  subscriptionExpiresAt: Date;
  planId?: Types.ObjectId;
  enabledModuleSlugs: string[];
  entitlementEnforced: boolean;
  maxStudents?: number;
  maxEmployees?: number;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  billingStatus:
    | "trialing"
    | "pending_payment"
    | "pending_approval"
    | "active"
    | "past_due"
    | "free"
    | "cancelled";
  trialEndsAt?: Date;
  graceEndsAt?: Date;
  enabledAddonSlugs: string[];
  firstPaidSubscriptionStartedAt?: Date;
  unlimitedMeetingsUntil?: Date;
  billingEmail?: string;
  customDomain?: string;
  customDomainStatus?: "pending" | "verified" | "active" | "failed";
  domainVerificationToken?: string;
  domainVerifiedAt?: Date;
  sslStatus?: "pending" | "active" | "failed";
  trialReminder7SentAt?: Date;
  trialReminder4SentAt?: Date;
  subscriptionReminder7SentAt?: Date;
  subscriptionReminder4SentAt?: Date;
}

const TenantSchema = new Schema<ITenant>(
  {
    tenantId: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    databaseName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      immutable: true,
    },
    status: {
      type: String,
      enum: Object.values(TenantStatus),
      default: TenantStatus.PROVISIONING,
      index: true,
    },
    subscriptionExpiresAt: {
      type: Date,
      required: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      index: true,
    },
    enabledModuleSlugs: {
      type: [{ type: String, lowercase: true, trim: true }],
      default: [],
    },
    // Kept false for pre-subscription legacy tenants; every newly provisioned
    // tenant is created with enforcement enabled.
    entitlementEnforced: {
      type: Boolean,
      default: false,
    },
    maxStudents: {
      type: Number,
      default: 2000,
    },
    maxEmployees: {
      type: Number,
      default: 200,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    billingStatus: {
      type: String,
      enum: [
        "trialing",
        "pending_payment",
        "pending_approval",
        "active",
        "past_due",
        "free",
        "cancelled",
      ],
      default: "trialing",
      index: true,
    },
    trialEndsAt: Date,
    graceEndsAt: Date,
    enabledAddonSlugs: [{ type: String, lowercase: true, trim: true }],
    firstPaidSubscriptionStartedAt: Date,
    unlimitedMeetingsUntil: Date,
    billingEmail: { type: String, lowercase: true, trim: true },
    customDomain: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
    customDomainStatus: {
      type: String,
      enum: ["pending", "verified", "active", "failed"],
    },
    domainVerificationToken: { type: String, select: false },
    domainVerifiedAt: Date,
    sslStatus: { type: String, enum: ["pending", "active", "failed"] },
    trialReminder7SentAt: Date,
    trialReminder4SentAt: Date,
    subscriptionReminder7SentAt: Date,
    subscriptionReminder4SentAt: Date,
  },
  {
    timestamps: true,
  },
);

TenantSchema.plugin(auditPlugin);

export const TenantModel = mongoose.model<ITenant>("Tenant", TenantSchema);

import mongoose, { Schema, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export type TComplianceFramework = string;
export type TComplianceFrequency = "once" | "monthly" | "quarterly" | "half_yearly" | "annual";
export type TComplianceStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "approved"
  | "non_compliant";

export interface IComplianceFramework extends Document {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  shortName: string;
  authority?: string;
  country: string;
  region?: string;
  description?: string;
  version: string;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  institutionTypes: string[];
  terminology: {
    requirement: string;
    submission: string;
    reportingPeriod: string;
  };
  color: string;
  icon: string;
  revisions: {
    version: string;
    name: string;
    authority?: string;
    terminology: Record<string, string>;
    archivedAt: Date;
  }[];
  isSystem: boolean;
  isActive: boolean;
  activatedAt?: Date;
  activatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FrameworkRevisionSchema = new Schema(
  {
    version: { type: String, required: true },
    name: { type: String, required: true },
    authority: { type: String },
    terminology: { type: Schema.Types.Mixed, required: true },
    archivedAt: { type: Date, required: true },
  },
  { _id: false },
);

const ComplianceFrameworkSchema = new Schema<IComplianceFramework>(
  {
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      unique: true,
    },
    name: { type: String, required: true, trim: true },
    shortName: { type: String, required: true, trim: true },
    authority: { type: String, trim: true },
    country: { type: String, required: true, trim: true, default: "India" },
    region: { type: String, trim: true },
    description: { type: String, trim: true },
    version: { type: String, required: true, trim: true, default: "1.0" },
    effectiveFrom: { type: Date },
    effectiveTo: { type: Date },
    institutionTypes: { type: [String], default: [] },
    terminology: {
      requirement: { type: String, default: "Requirement" },
      submission: { type: String, default: "Submission" },
      reportingPeriod: { type: String, default: "Reporting period" },
    },
    color: { type: String, default: "blue", trim: true },
    icon: { type: String, default: "shield-check", trim: true },
    revisions: { type: [FrameworkRevisionSchema], default: [] },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    activatedAt: Date,
    activatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
ComplianceFrameworkSchema.plugin(auditPlugin);

export interface IComplianceRequirement extends Document {
  _id: Types.ObjectId;
  framework: TComplianceFramework;
  code: string;
  title: string;
  description?: string;
  category: string;
  frequency: TComplianceFrequency;
  applicablePrograms: string[];
  departmentIds: Types.ObjectId[];
  ownerIds: Types.ObjectId[];
  reviewerIds: Types.ObjectId[];
  requiredFields: {
    key: string;
    label: string;
    type: "text" | "number" | "date" | "boolean";
    required: boolean;
  }[];
  targetValue?: number;
  unit?: string;
  dueMonth?: number;
  evidenceValidityDays?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RequirementFieldSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: { type: String, enum: ["text", "number", "date", "boolean"], required: true },
    required: { type: Boolean, default: false },
  },
  { _id: false },
);

const ComplianceRequirementSchema = new Schema<IComplianceRequirement>(
  {
    framework: { type: String, required: true, lowercase: true, trim: true, index: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: { type: String, required: true, trim: true, index: true },
    frequency: {
      type: String,
      enum: ["once", "monthly", "quarterly", "half_yearly", "annual"],
      default: "annual",
    },
    applicablePrograms: { type: [String], default: [] },
    departmentIds: [{ type: Schema.Types.ObjectId, ref: "Department" }],
    ownerIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    reviewerIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    requiredFields: { type: [RequirementFieldSchema], default: [] },
    targetValue: { type: Number },
    unit: { type: String, trim: true },
    dueMonth: { type: Number, min: 1, max: 12 },
    evidenceValidityDays: { type: Number, min: 1, max: 3650 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);
ComplianceRequirementSchema.index({ framework: 1, code: 1 }, { unique: true });
ComplianceRequirementSchema.plugin(auditPlugin);

export interface IComplianceSubmission extends Document {
  _id: Types.ObjectId;
  requirementId: Types.ObjectId;
  academicYear: string;
  period?: string;
  departmentId?: Types.ObjectId;
  values: Record<string, string | number | boolean>;
  evidenceFiles: { url: string; name: string }[];
  status: TComplianceStatus;
  remarks?: string;
  evidenceValidUntil?: Date;
  submittedBy?: Types.ObjectId;
  submittedAt?: Date;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ComplianceSubmissionSchema = new Schema<IComplianceSubmission>(
  {
    requirementId: {
      type: Schema.Types.ObjectId,
      ref: "ComplianceRequirement",
      required: true,
      index: true,
    },
    academicYear: { type: String, required: true, trim: true, index: true },
    period: { type: String, trim: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", index: true },
    values: { type: Schema.Types.Mixed, default: {} },
    evidenceFiles: {
      type: [{ url: { type: String, required: true }, name: { type: String, required: true } }],
      default: [],
    },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "submitted", "approved", "non_compliant"],
      default: "in_progress",
      index: true,
    },
    remarks: { type: String, trim: true },
    evidenceValidUntil: { type: Date, index: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
    submittedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
);
ComplianceSubmissionSchema.index(
  { requirementId: 1, academicYear: 1, period: 1, departmentId: 1 },
  { unique: true },
);
ComplianceSubmissionSchema.plugin(auditPlugin);

export interface ITallyConfiguration extends Document {
  _id: Types.ObjectId;
  companyName: string;
  companyGuid?: string;
  financialYear: string;
  exportFormat: "tally_prime_xml";
  ledgerMappings: { accountCode: string; tallyLedgerName: string }[];
  isActive: boolean;
  lastExportedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TallyConfigurationSchema = new Schema<ITallyConfiguration>(
  {
    companyName: { type: String, required: true, trim: true },
    companyGuid: { type: String, trim: true },
    financialYear: { type: String, required: true, trim: true, unique: true },
    exportFormat: { type: String, enum: ["tally_prime_xml"], default: "tally_prime_xml" },
    ledgerMappings: {
      type: [
        {
          accountCode: { type: String, required: true },
          tallyLedgerName: { type: String, required: true },
        },
      ],
      default: [],
    },
    isActive: { type: Boolean, default: true },
    lastExportedAt: { type: Date },
  },
  { timestamps: true },
);
TallyConfigurationSchema.plugin(auditPlugin);

export const ComplianceRequirementModel = mongoose.model<IComplianceRequirement>(
  "ComplianceRequirement",
  ComplianceRequirementSchema,
);
export const ComplianceFrameworkModel = mongoose.model<IComplianceFramework>(
  "ComplianceFramework",
  ComplianceFrameworkSchema,
);
export const ComplianceSubmissionModel = mongoose.model<IComplianceSubmission>(
  "ComplianceSubmission",
  ComplianceSubmissionSchema,
);

export interface IComplianceFinding extends Document {
  findingNumber: string;
  submissionId: Types.ObjectId;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  ownerId: Types.ObjectId;
  dueAt: Date;
  status: "open" | "remediation_in_progress" | "pending_verification" | "closed";
  remediationPlan?: string;
  evidenceFiles: { name: string; url: string }[];
  raisedBy: Types.ObjectId;
  verifiedBy?: Types.ObjectId;
  verifiedAt?: Date;
  closureNote?: string;
}
const ComplianceFindingSchema = new Schema<IComplianceFinding>(
  {
    findingNumber: { type: String, required: true, unique: true },
    submissionId: {
      type: Schema.Types.ObjectId,
      ref: "ComplianceSubmission",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 255 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
      index: true,
    },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    dueAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["open", "remediation_in_progress", "pending_verification", "closed"],
      default: "open",
      index: true,
    },
    remediationPlan: { type: String, trim: true, maxlength: 5000 },
    evidenceFiles: {
      type: [{ name: { type: String, required: true }, url: { type: String, required: true } }],
      default: [],
    },
    raisedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: Date,
    closureNote: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);
ComplianceFindingSchema.index({ status: 1, dueAt: 1, severity: 1 });
ComplianceFindingSchema.plugin(auditPlugin);
export const ComplianceFindingModel = mongoose.model<IComplianceFinding>(
  "ComplianceFinding",
  ComplianceFindingSchema,
);
export const TallyConfigurationModel = mongoose.model<ITallyConfiguration>(
  "TallyConfiguration",
  TallyConfigurationSchema,
);

import mongoose, { Schema, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export type TRegulatoryProvider = "digilocker" | "nad" | "abc" | "aishe" | "nirf";
export type TRegulatoryStatus =
  | "not_started"
  | "documents_pending"
  | "submitted"
  | "approved"
  | "configured"
  | "suspended";

export type TRegulatoryApprovalStatus = "not_requested" | "pending" | "approved" | "rejected";
export type TConnectivityStatus = "not_configured" | "not_tested" | "verified" | "failed";

export interface IRegulatoryEvidence {
  _id?: Types.ObjectId;
  type: string;
  name: string;
  url: string;
  publicId?: string;
  issuedAt?: Date;
  expiresAt?: Date;
  uploadedAt: Date;
  uploadedBy: Types.ObjectId;
}

export interface IRegulatoryCycle {
  _id?: Types.ObjectId;
  name: string;
  reportingYear: string;
  status: "draft" | "in_review" | "submitted" | "acknowledged" | "closed";
  dueDate?: Date;
  submittedAt?: Date;
  acknowledgementReference?: string;
  notes?: string;
}

export interface IRegulatoryIntegration extends Document {
  provider: TRegulatoryProvider;
  status: TRegulatoryStatus;
  institutionCode?: string;
  nodalOfficerName?: string;
  nodalOfficerEmail?: string;
  applicationReference?: string;
  productionEnabled: boolean;
  consentConfirmed: boolean;
  notes?: string;
  checklist: Array<{ key: string; label: string; completed: boolean; completedAt?: Date }>;
  configuredBy?: Types.ObjectId;
  lastReviewedAt?: Date;
  approval: {
    status: TRegulatoryApprovalStatus;
    requestedBy?: Types.ObjectId;
    requestedAt?: Date;
    decidedBy?: Types.ObjectId;
    decidedAt?: Date;
    decisionNote?: string;
  };
  connectivity: {
    status: TConnectivityStatus;
    lastCheckedAt?: Date;
    message?: string;
  };
  evidence: IRegulatoryEvidence[];
  cycles: IRegulatoryCycle[];
  history: Array<{
    action: string;
    fromStatus?: string;
    toStatus?: string;
    reason?: string;
    at: Date;
    by: Types.ObjectId;
  }>;
}

const checklistSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, maxlength: 80 },
    label: { type: String, required: true, trim: true, maxlength: 180 },
    completed: { type: Boolean, default: false },
    completedAt: Date,
  },
  { _id: false },
);

const evidenceSchema = new Schema<IRegulatoryEvidence>(
  {
    type: { type: String, required: true, trim: true, maxlength: 80 },
    name: { type: String, required: true, trim: true, maxlength: 180 },
    url: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true },
    issuedAt: Date,
    expiresAt: Date,
    uploadedAt: { type: Date, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: true },
);

const cycleSchema = new Schema<IRegulatoryCycle>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    reportingYear: { type: String, required: true, trim: true, maxlength: 20 },
    status: {
      type: String,
      enum: ["draft", "in_review", "submitted", "acknowledged", "closed"],
      default: "draft",
    },
    dueDate: Date,
    submittedAt: Date,
    acknowledgementReference: { type: String, trim: true, maxlength: 180 },
    notes: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: true },
);

const historySchema = new Schema(
  {
    action: { type: String, required: true, trim: true },
    fromStatus: String,
    toStatus: String,
    reason: { type: String, trim: true, maxlength: 500 },
    at: { type: Date, required: true },
    by: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: false },
);

const schema = new Schema<IRegulatoryIntegration>(
  {
    provider: {
      type: String,
      enum: ["digilocker", "nad", "abc", "aishe", "nirf"],
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        "not_started",
        "documents_pending",
        "submitted",
        "approved",
        "configured",
        "suspended",
      ],
      default: "not_started",
      index: true,
    },
    institutionCode: { type: String, trim: true, maxlength: 120 },
    nodalOfficerName: { type: String, trim: true, maxlength: 120 },
    nodalOfficerEmail: { type: String, trim: true, lowercase: true, maxlength: 180 },
    applicationReference: { type: String, trim: true, maxlength: 180 },
    productionEnabled: { type: Boolean, default: false },
    consentConfirmed: { type: Boolean, default: false },
    notes: { type: String, trim: true, maxlength: 2000 },
    checklist: { type: [checklistSchema], default: [] },
    configuredBy: { type: Schema.Types.ObjectId, ref: "User" },
    lastReviewedAt: Date,
    approval: {
      status: {
        type: String,
        enum: ["not_requested", "pending", "approved", "rejected"],
        default: "not_requested",
      },
      requestedBy: { type: Schema.Types.ObjectId, ref: "User" },
      requestedAt: Date,
      decidedBy: { type: Schema.Types.ObjectId, ref: "User" },
      decidedAt: Date,
      decisionNote: { type: String, trim: true, maxlength: 500 },
    },
    connectivity: {
      status: {
        type: String,
        enum: ["not_configured", "not_tested", "verified", "failed"],
        default: "not_configured",
      },
      lastCheckedAt: Date,
      message: { type: String, trim: true, maxlength: 500 },
    },
    evidence: { type: [evidenceSchema], default: [] },
    cycles: { type: [cycleSchema], default: [] },
    history: { type: [historySchema], default: [] },
  },
  { timestamps: true },
);

schema.plugin(auditPlugin);

export const RegulatoryIntegrationModel = mongoose.model<IRegulatoryIntegration>(
  "RegulatoryIntegration",
  schema,
);

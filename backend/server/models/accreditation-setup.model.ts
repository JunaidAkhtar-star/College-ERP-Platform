import { createHash } from "node:crypto";
import mongoose, { Schema, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export type TAccreditationTrust =
  | "draft_mapping"
  | "institution_reviewed"
  | "platform_verified"
  | "official_template_mapped"
  | "submitted"
  | "provider_acknowledged";

export interface IAccreditationTrustEvent {
  state: TAccreditationTrust;
  evidenceReference: string;
  evidenceSource: "official_document" | "verified_portal_evidence" | "verified_api";
  note: string;
  changedBy: Types.ObjectId;
  changedAt: Date;
}

export interface IAccreditationFrameworkScope {
  _id?: Types.ObjectId;
  frameworkSlug: string;
  frameworkVersion: string;
  authority: string;
  scopeType: "institution" | "campus" | "programme";
  campusIds: Types.ObjectId[];
  departmentIds: Types.ObjectId[];
  programIds: Types.ObjectId[];
  cycleType: "first" | "subsequent" | "renewal" | "continuous";
  cycleNumber?: number;
  academicYear: string;
  validFrom?: Date;
  validUntil?: Date;
  submissionDueAt?: Date;
  officialSourceUrl?: string;
  officialSourceChecksum?: string;
  trustState: TAccreditationTrust;
  status: "draft" | "pending_approval" | "active" | "rejected" | "retired";
  ownerIds: Types.ObjectId[];
  reviewerIds: Types.ObjectId[];
  requestedBy?: Types.ObjectId;
  requestedAt?: Date;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  decisionNote?: string;
  trustHistory: IAccreditationTrustEvent[];
}

export interface IAccreditationSetup extends Document {
  country: string;
  region?: string;
  institutionType:
    | "university"
    | "deemed_university"
    | "autonomous_college"
    | "affiliated_college"
    | "standalone_institution"
    | "other";
  universityType?: "central" | "state" | "private" | "deemed" | "open" | "not_applicable";
  affiliatingUniversity?: string;
  isAutonomous: boolean;
  programmeDomains: string[];
  setupStatus: "not_started" | "in_progress" | "pending_approval" | "active";
  frameworks: IAccreditationFrameworkScope[];
  createdAt: Date;
  updatedAt: Date;
}

const FrameworkScopeSchema = new Schema<IAccreditationFrameworkScope>(
  {
    frameworkSlug: { type: String, required: true, lowercase: true, trim: true },
    frameworkVersion: { type: String, required: true, trim: true },
    authority: { type: String, required: true, trim: true },
    scopeType: { type: String, enum: ["institution", "campus", "programme"], required: true },
    campusIds: [{ type: Schema.Types.ObjectId, ref: "Campus" }],
    departmentIds: [{ type: Schema.Types.ObjectId, ref: "Department" }],
    programIds: [{ type: Schema.Types.ObjectId, ref: "Curriculum" }],
    cycleType: {
      type: String,
      enum: ["first", "subsequent", "renewal", "continuous"],
      required: true,
    },
    cycleNumber: { type: Number, min: 1, max: 20 },
    academicYear: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    validFrom: Date,
    validUntil: Date,
    submissionDueAt: Date,
    officialSourceUrl: { type: String, trim: true },
    officialSourceChecksum: { type: String, trim: true },
    trustState: {
      type: String,
      enum: [
        "draft_mapping",
        "institution_reviewed",
        "platform_verified",
        "official_template_mapped",
        "submitted",
        "provider_acknowledged",
      ],
      default: "draft_mapping",
    },
    status: {
      type: String,
      enum: ["draft", "pending_approval", "active", "rejected", "retired"],
      default: "draft",
    },
    ownerIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    reviewerIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    requestedBy: { type: Schema.Types.ObjectId, ref: "User" },
    requestedAt: Date,
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
    decisionNote: { type: String, trim: true, maxlength: 2000 },
    trustHistory: {
      type: [
        new Schema(
          {
            state: {
              type: String,
              enum: [
                "draft_mapping",
                "institution_reviewed",
                "platform_verified",
                "official_template_mapped",
                "submitted",
                "provider_acknowledged",
              ],
              required: true,
            },
            evidenceReference: { type: String, required: true, trim: true, maxlength: 500 },
            evidenceSource: {
              type: String,
              enum: ["official_document", "verified_portal_evidence", "verified_api"],
              required: true,
            },
            note: { type: String, required: true, trim: true, maxlength: 2000 },
            changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
            changedAt: { type: Date, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: false },
);

const AccreditationSetupSchema = new Schema<IAccreditationSetup>(
  {
    country: { type: String, required: true, trim: true },
    region: { type: String, trim: true },
    institutionType: {
      type: String,
      enum: [
        "university",
        "deemed_university",
        "autonomous_college",
        "affiliated_college",
        "standalone_institution",
        "other",
      ],
      required: true,
    },
    universityType: {
      type: String,
      enum: ["central", "state", "private", "deemed", "open", "not_applicable"],
    },
    affiliatingUniversity: { type: String, trim: true },
    isAutonomous: { type: Boolean, default: false },
    programmeDomains: { type: [String], default: [] },
    setupStatus: {
      type: String,
      enum: ["not_started", "in_progress", "pending_approval", "active"],
      default: "in_progress",
      index: true,
    },
    frameworks: { type: [FrameworkScopeSchema], default: [] },
  },
  { timestamps: true },
);
AccreditationSetupSchema.plugin(auditPlugin);

export interface IAccreditationSnapshot extends Document {
  snapshotNumber: string;
  frameworkSlug: string;
  frameworkVersion: string;
  academicYear: string;
  scope: Record<string, unknown>;
  payload: Record<string, unknown>;
  payloadHash: string;
  trustState: TAccreditationTrust;
  preparedBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  createdAt: Date;
}

const AccreditationSnapshotSchema = new Schema<IAccreditationSnapshot>(
  {
    snapshotNumber: { type: String, required: true, unique: true },
    frameworkSlug: { type: String, required: true, index: true },
    frameworkVersion: { type: String, required: true },
    academicYear: { type: String, required: true, index: true },
    scope: { type: Schema.Types.Mixed, required: true, immutable: true },
    payload: { type: Schema.Types.Mixed, required: true, immutable: true, select: false },
    payloadHash: { type: String, required: true, immutable: true, unique: true },
    trustState: { type: String, required: true },
    preparedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
AccreditationSnapshotSchema.pre("save", function () {
  const expected = createHash("sha256").update(JSON.stringify(this.payload)).digest("hex");
  if (this.payloadHash !== expected) throw new Error("Accreditation snapshot integrity mismatch");
});
AccreditationSnapshotSchema.pre(
  ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "deleteOne", "deleteMany"],
  function () {
    throw new Error("Accreditation snapshots are immutable");
  },
);

export const AccreditationSetupModel = mongoose.model<IAccreditationSetup>(
  "AccreditationSetup",
  AccreditationSetupSchema,
);
export const AccreditationSnapshotModel = mongoose.model<IAccreditationSnapshot>(
  "AccreditationSnapshot",
  AccreditationSnapshotSchema,
);

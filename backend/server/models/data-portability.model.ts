import mongoose, { Schema, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export interface IDataExportJob extends Document {
  exportNumber: string;
  datasets: string[];
  format: "json" | "ndjson";
  filters: { from?: Date; to?: Date; academicYear?: string };
  counts: Record<string, number>;
  purpose: string;
  legalBasis: "consent" | "contract" | "legal_obligation" | "legitimate_interest";
  redactionProfile: "standard" | "deidentified";
  status:
    | "pending_approval"
    | "generating"
    | "ready"
    | "failed"
    | "rejected"
    | "expired"
    | "cancelled";
  requestedBy: Types.ObjectId;
  requestedByName: string;
  expiresAt: Date;
  downloadedAt?: Date;
  downloadCount: number;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewReason?: string;
  deletionVerifiedAt?: Date;
  deletionVerifiedBy?: Types.ObjectId;
  artifactHash?: string;
  artifactChunkCount?: number;
  artifactGeneratedAt?: Date;
  generationError?: string;
  generationLeaseUntil?: Date;
  generationLeaseToken?: string;
}

const DataExportJobSchema = new Schema<IDataExportJob>(
  {
    exportNumber: { type: String, required: true, unique: true },
    datasets: { type: [String], required: true },
    format: { type: String, enum: ["json", "ndjson"], default: "json" },
    filters: {
      from: Date,
      to: Date,
      academicYear: String,
    },
    counts: { type: Schema.Types.Mixed, default: {} },
    purpose: { type: String, required: true, trim: true, minlength: 10, maxlength: 1000 },
    legalBasis: {
      type: String,
      enum: ["consent", "contract", "legal_obligation", "legitimate_interest"],
      required: true,
    },
    redactionProfile: {
      type: String,
      enum: ["standard", "deidentified"],
      default: "standard",
    },
    status: {
      type: String,
      enum: [
        "pending_approval",
        "generating",
        "ready",
        "failed",
        "rejected",
        "expired",
        "cancelled",
      ],
      default: "pending_approval",
      index: true,
    },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    requestedByName: { type: String, required: true },
    // Indexed below as a TTL index. Declaring `index: true` here as well makes
    // Mongoose register the same key twice and emit a warning at startup.
    expiresAt: { type: Date, required: true },
    downloadedAt: Date,
    downloadCount: { type: Number, default: 0 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    reviewReason: { type: String, trim: true, maxlength: 1000 },
    deletionVerifiedAt: Date,
    deletionVerifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    artifactHash: { type: String, immutable: true },
    artifactChunkCount: { type: Number, min: 0, immutable: true },
    artifactGeneratedAt: Date,
    generationError: { type: String, maxlength: 1000 },
    generationLeaseUntil: Date,
    generationLeaseToken: { type: String, select: false },
  },
  { timestamps: true },
);
DataExportJobSchema.index({ status: 1, expiresAt: 1 });
DataExportJobSchema.plugin(auditPlugin);
export const DataExportJobModel = mongoose.model<IDataExportJob>(
  "DataExportJob",
  DataExportJobSchema,
);

export interface IDataExportArtifactChunk extends Document {
  exportJobId: Types.ObjectId;
  sequence: number;
  dataset: string;
  recordCount: number;
  ciphertext: string;
}
const dataExportArtifactChunkSchema = new Schema<IDataExportArtifactChunk>(
  {
    exportJobId: {
      type: Schema.Types.ObjectId,
      ref: "DataExportJob",
      required: true,
      index: true,
    },
    sequence: { type: Number, required: true, min: 0 },
    dataset: { type: String, required: true },
    recordCount: { type: Number, required: true, min: 0 },
    ciphertext: { type: String, required: true, select: false },
  },
  { timestamps: true },
);
dataExportArtifactChunkSchema.index({ exportJobId: 1, sequence: 1 }, { unique: true });
dataExportArtifactChunkSchema.pre(["updateOne", "updateMany", "findOneAndUpdate"], function () {
  throw new Error("Export artifact chunks are immutable");
});
export const DataExportArtifactChunkModel = mongoose.model<IDataExportArtifactChunk>(
  "DataExportArtifactChunk",
  dataExportArtifactChunkSchema,
);

export interface IDataSubjectRequest extends Document {
  requestNumber: string;
  subjectUserId: Types.ObjectId;
  requestType: "access" | "rectification" | "erasure" | "restriction" | "portability";
  details: string;
  identityVerifiedAt?: Date;
  status: "submitted" | "identity_verified" | "under_review" | "fulfilled" | "rejected";
  dueAt: Date;
  requestedBy: Types.ObjectId;
  assignedTo?: Types.ObjectId;
  resolution?: string;
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
}
const dataSubjectRequestSchema = new Schema<IDataSubjectRequest>(
  {
    requestNumber: { type: String, required: true, unique: true },
    subjectUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    requestType: {
      type: String,
      enum: ["access", "rectification", "erasure", "restriction", "portability"],
      required: true,
    },
    details: { type: String, required: true, trim: true, minlength: 10, maxlength: 5000 },
    identityVerifiedAt: Date,
    status: {
      type: String,
      enum: ["submitted", "identity_verified", "under_review", "fulfilled", "rejected"],
      default: "submitted",
      index: true,
    },
    dueAt: { type: Date, required: true, index: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    resolution: { type: String, trim: true, maxlength: 5000 },
    resolvedAt: Date,
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
dataSubjectRequestSchema.plugin(auditPlugin);
export const DataSubjectRequestModel = mongoose.model<IDataSubjectRequest>(
  "DataSubjectRequest",
  dataSubjectRequestSchema,
);

export interface IDataLegalHold extends Document {
  holdNumber: string;
  name: string;
  reason: string;
  datasets: string[];
  status: "active" | "released";
  effectiveAt: Date;
  releasedAt?: Date;
  createdBy: Types.ObjectId;
  releasedBy?: Types.ObjectId;
  releaseReason?: string;
}
const dataLegalHoldSchema = new Schema<IDataLegalHold>(
  {
    holdNumber: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 255 },
    reason: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    datasets: { type: [String], required: true },
    status: { type: String, enum: ["active", "released"], default: "active", index: true },
    effectiveAt: { type: Date, default: Date.now },
    releasedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    releasedBy: { type: Schema.Types.ObjectId, ref: "User" },
    releaseReason: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);
dataLegalHoldSchema.plugin(auditPlugin);
export const DataLegalHoldModel = mongoose.model<IDataLegalHold>(
  "DataLegalHold",
  dataLegalHoldSchema,
);

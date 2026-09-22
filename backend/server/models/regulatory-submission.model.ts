import { model, Schema, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";
import type { TRegulatoryProvider } from "./regulatory-integration.model";

export type TRegulatorySubmissionStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "exported"
  | "submitted"
  | "partially_accepted"
  | "accepted"
  | "rejected";

export interface IRegulatorySubmissionRow {
  reference: string;
  name: string;
  category: string;
  primaryValue: string;
  secondaryValue: string;
  payload: Record<string, string | number>;
}

export interface IRegulatorySubmission extends Document {
  _id: Types.ObjectId;
  batchNumber: string;
  provider: TRegulatoryProvider;
  academicYear: string;
  status: TRegulatorySubmissionStatus;
  sourceGeneratedAt: Date;
  rows: IRegulatorySubmissionRow[];
  recordCount: number;
  excludedRecords: number;
  exportFields: string[];
  createdBy: Types.ObjectId;
  reviewRequestedBy?: Types.ObjectId;
  reviewRequestedAt?: Date;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  exportedBy?: Types.ObjectId;
  exportedAt?: Date;
  submittedBy?: Types.ObjectId;
  submittedAt?: Date;
  acknowledgementReference?: string;
  acceptedRecords: number;
  rejectedRecords: number;
  reconciliationNote?: string;
  reconciledBy?: Types.ObjectId;
  reconciledAt?: Date;
  history: Array<{
    action: string;
    fromStatus?: string;
    toStatus?: string;
    note?: string;
    at: Date;
    by: Types.ObjectId;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const rowSchema = new Schema<IRegulatorySubmissionRow>(
  {
    reference: { type: String, required: true, trim: true, maxlength: 180 },
    name: { type: String, required: true, trim: true, maxlength: 240 },
    category: { type: String, required: true, trim: true, maxlength: 240 },
    primaryValue: { type: String, required: true, trim: true, maxlength: 500 },
    secondaryValue: { type: String, required: true, trim: true, maxlength: 500 },
    payload: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const historySchema = new Schema(
  {
    action: { type: String, required: true, trim: true },
    fromStatus: String,
    toStatus: String,
    note: { type: String, trim: true, maxlength: 1000 },
    at: { type: Date, required: true, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: false },
);

const schema = new Schema<IRegulatorySubmission>(
  {
    batchNumber: { type: String, required: true, unique: true, trim: true, index: true },
    provider: {
      type: String,
      enum: ["digilocker", "nad", "abc", "aishe", "nirf"],
      required: true,
      index: true,
    },
    academicYear: { type: String, required: true, trim: true, index: true },
    status: {
      type: String,
      enum: [
        "draft",
        "in_review",
        "approved",
        "exported",
        "submitted",
        "partially_accepted",
        "accepted",
        "rejected",
      ],
      default: "draft",
      index: true,
    },
    sourceGeneratedAt: { type: Date, required: true },
    rows: { type: [rowSchema], default: [] },
    recordCount: { type: Number, required: true, min: 1 },
    excludedRecords: { type: Number, default: 0, min: 0 },
    exportFields: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reviewRequestedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewRequestedAt: Date,
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
    exportedBy: { type: Schema.Types.ObjectId, ref: "User" },
    exportedAt: Date,
    submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
    submittedAt: Date,
    acknowledgementReference: { type: String, trim: true, maxlength: 240 },
    acceptedRecords: { type: Number, default: 0, min: 0 },
    rejectedRecords: { type: Number, default: 0, min: 0 },
    reconciliationNote: { type: String, trim: true, maxlength: 1000 },
    reconciledBy: { type: Schema.Types.ObjectId, ref: "User" },
    reconciledAt: Date,
    history: { type: [historySchema], default: [] },
  },
  { timestamps: true },
);

schema.index({ provider: 1, academicYear: 1, createdAt: -1 });
schema.plugin(auditPlugin);

export const RegulatorySubmissionModel = model<IRegulatorySubmission>(
  "RegulatorySubmission",
  schema,
);

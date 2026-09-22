import mongoose, { Schema, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export type TReportDataset =
  | "students"
  | "faculty"
  | "admissions"
  | "fees"
  | "attendance"
  | "examinations";

export type TReportOperator = "eq" | "ne" | "contains" | "gte" | "lte" | "between" | "in";

export interface IReportFilter {
  field: string;
  operator: TReportOperator;
  value: string | number | boolean | string[];
  secondValue?: string | number;
}

export interface IReportDefinition extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  dataset: TReportDataset;
  columns: string[];
  filters: IReportFilter[];
  sort: { field: string; direction: "asc" | "desc" }[];
  visibility: "private" | "roles" | "institution";
  allowedRoles: string[];
  definitionKey: string;
  version: number;
  previousVersionId?: Types.ObjectId;
  definitionHash: string;
  status: "draft" | "pending_approval" | "published" | "retired";
  submittedBy?: Types.ObjectId;
  publishedBy?: Types.ObjectId;
  publishedAt?: Date;
  createdBy: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReportFilterSchema = new Schema<IReportFilter>(
  {
    field: { type: String, required: true },
    operator: {
      type: String,
      enum: ["eq", "ne", "contains", "gte", "lte", "between", "in"],
      required: true,
    },
    value: { type: Schema.Types.Mixed, required: true },
    secondValue: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const ReportDefinitionSchema = new Schema<IReportDefinition>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    dataset: {
      type: String,
      enum: ["students", "faculty", "admissions", "fees", "attendance", "examinations"],
      required: true,
      index: true,
    },
    columns: { type: [String], required: true },
    filters: { type: [ReportFilterSchema], default: [] },
    sort: {
      type: [
        new Schema(
          {
            field: { type: String, required: true },
            direction: { type: String, enum: ["asc", "desc"], default: "asc" },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    visibility: {
      type: String,
      enum: ["private", "roles", "institution"],
      default: "private",
      index: true,
    },
    allowedRoles: { type: [String], default: [] },
    definitionKey: { type: String, required: true, index: true, immutable: true },
    version: { type: Number, required: true, min: 1, immutable: true },
    previousVersionId: { type: Schema.Types.ObjectId, ref: "ReportDefinition", immutable: true },
    definitionHash: { type: String, required: true, immutable: true },
    status: {
      type: String,
      enum: ["draft", "pending_approval", "published", "retired"],
      default: "draft",
      index: true,
    },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
    publishedBy: { type: Schema.Types.ObjectId, ref: "User" },
    publishedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);
ReportDefinitionSchema.index({ createdBy: 1, updatedAt: -1 });
ReportDefinitionSchema.index({ definitionKey: 1, version: 1 }, { unique: true });
ReportDefinitionSchema.plugin(auditPlugin);

export const ReportDefinitionModel = mongoose.model<IReportDefinition>(
  "ReportDefinition",
  ReportDefinitionSchema,
);

export interface IReportSnapshot extends Document {
  snapshotNumber: string;
  reportDefinitionId: Types.ObjectId;
  definitionKey: string;
  definitionVersion: number;
  definitionHash: string;
  asOf: Date;
  generatedBy: Types.ObjectId;
  generatedByRole: string;
  rowCount: number;
  total: number;
  rows: Record<string, unknown>[];
  snapshotHash: string;
  scheduleId?: Types.ObjectId;
  scheduledFor?: Date;
  expiresAt: Date;
}
const reportSnapshotRowSchema = new Schema<Record<string, unknown>>(
  {},
  { _id: false, strict: false },
);
const reportSnapshotSchema = new Schema<IReportSnapshot>(
  {
    snapshotNumber: { type: String, required: true, unique: true },
    reportDefinitionId: { type: Schema.Types.ObjectId, ref: "ReportDefinition", required: true },
    definitionKey: { type: String, required: true, index: true },
    definitionVersion: { type: Number, required: true },
    definitionHash: { type: String, required: true },
    asOf: { type: Date, required: true, index: true },
    generatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    generatedByRole: { type: String, required: true },
    rowCount: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    rows: { type: [reportSnapshotRowSchema], required: true },
    snapshotHash: { type: String, required: true, unique: true, immutable: true },
    scheduleId: { type: Schema.Types.ObjectId, ref: "ReportSchedule", immutable: true },
    scheduledFor: { type: Date, immutable: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
reportSnapshotSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
reportSnapshotSchema.index(
  { scheduleId: 1, scheduledFor: 1 },
  {
    unique: true,
    partialFilterExpression: {
      scheduleId: { $exists: true },
      scheduledFor: { $exists: true },
    },
  },
);
reportSnapshotSchema.pre(
  ["updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany"],
  function () {
    throw new Error("Report snapshots are immutable");
  },
);
export const ReportSnapshotModel = mongoose.model<IReportSnapshot>(
  "ReportSnapshot",
  reportSnapshotSchema,
);

export interface IReportSchedule extends Document {
  reportDefinitionId: Types.ObjectId;
  cronExpression: string;
  timezone: string;
  format: "json" | "csv";
  recipientUserIds: Types.ObjectId[];
  asOfMode: "run_time" | "previous_day" | "previous_month_end";
  status: "active" | "paused";
  lastRunAt?: Date;
  nextRunAt?: Date;
  createdBy: Types.ObjectId;
  createdByRole: string;
  departmentId?: Types.ObjectId;
  lastSnapshotId?: Types.ObjectId;
  lastError?: string;
}
const reportScheduleSchema = new Schema<IReportSchedule>(
  {
    reportDefinitionId: {
      type: Schema.Types.ObjectId,
      ref: "ReportDefinition",
      required: true,
      index: true,
    },
    cronExpression: { type: String, required: true, trim: true },
    timezone: { type: String, required: true, default: "Asia/Kolkata" },
    format: { type: String, enum: ["json", "csv"], default: "csv" },
    recipientUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    asOfMode: {
      type: String,
      enum: ["run_time", "previous_day", "previous_month_end"],
      default: "run_time",
    },
    status: { type: String, enum: ["active", "paused"], default: "active", index: true },
    lastRunAt: Date,
    nextRunAt: { type: Date, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdByRole: { type: String, required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    lastSnapshotId: { type: Schema.Types.ObjectId, ref: "ReportSnapshot" },
    lastError: { type: String, trim: true },
  },
  { timestamps: true },
);
reportScheduleSchema.plugin(auditPlugin);
export const ReportScheduleModel = mongoose.model<IReportSchedule>(
  "ReportSchedule",
  reportScheduleSchema,
);

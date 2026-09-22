import mongoose, { Schema, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export interface ITenantBackupConfig extends Document {
  provider: "google_drive";
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  hourUtc: number;
  dayOfWeek: number;
  dayOfMonth: number;
  retentionCount: number;
  driveFolderId?: string;
  driveAccountEmail?: string;
  encryptedRefreshToken?: string;
  connectedAt?: Date;
  nextRunAt?: Date;
  lastRunAt?: Date;
  lastStatus?: "completed" | "failed";
  lastError?: string;
  updatedBy?: Types.ObjectId;
}

const tenantBackupConfigSchema = new Schema<ITenantBackupConfig>(
  {
    provider: { type: String, enum: ["google_drive"], default: "google_drive", unique: true },
    enabled: { type: Boolean, default: false },
    frequency: { type: String, enum: ["daily", "weekly", "monthly"], default: "weekly" },
    hourUtc: { type: Number, min: 0, max: 23, default: 2 },
    dayOfWeek: { type: Number, min: 0, max: 6, default: 0 },
    dayOfMonth: { type: Number, min: 1, max: 28, default: 1 },
    retentionCount: { type: Number, min: 1, max: 30, default: 7 },
    driveFolderId: { type: String, trim: true, maxlength: 255 },
    driveAccountEmail: { type: String, trim: true, lowercase: true },
    encryptedRefreshToken: { type: String, select: false },
    connectedAt: Date,
    nextRunAt: { type: Date, index: true },
    lastRunAt: Date,
    lastStatus: { type: String, enum: ["completed", "failed"] },
    lastError: { type: String, maxlength: 1000 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
tenantBackupConfigSchema.plugin(auditPlugin);
export const TenantBackupConfigModel = mongoose.model<ITenantBackupConfig>(
  "TenantBackupConfig",
  tenantBackupConfigSchema,
);

export interface ITenantBackupJob extends Document {
  backupNumber: string;
  trigger: "manual" | "scheduled";
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  stage:
    | "queued"
    | "exporting"
    | "encrypting"
    | "verifying"
    | "authorizing"
    | "uploading"
    | "finalizing"
    | "completed"
    | "failed";
  progressMessage: string;
  failureCode?: string;
  driveFileId?: string;
  driveFileName?: string;
  byteSize?: number;
  checksum?: string;
  startedAt?: Date;
  completedAt?: Date;
  retentionDeletedAt?: Date;
  error?: string;
  requestedBy?: Types.ObjectId;
}

const tenantBackupJobSchema = new Schema<ITenantBackupJob>(
  {
    backupNumber: { type: String, required: true, unique: true },
    trigger: { type: String, enum: ["manual", "scheduled"], required: true },
    status: {
      type: String,
      enum: ["queued", "running", "completed", "failed"],
      default: "queued",
      index: true,
    },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    stage: {
      type: String,
      enum: [
        "queued",
        "exporting",
        "encrypting",
        "verifying",
        "authorizing",
        "uploading",
        "finalizing",
        "completed",
        "failed",
      ],
      default: "queued",
    },
    progressMessage: {
      type: String,
      default: "Waiting for the secure backup worker",
      maxlength: 300,
    },
    failureCode: { type: String, maxlength: 80 },
    driveFileId: String,
    driveFileName: String,
    byteSize: { type: Number, min: 0 },
    checksum: String,
    startedAt: Date,
    completedAt: Date,
    retentionDeletedAt: Date,
    error: { type: String, maxlength: 1000 },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
tenantBackupJobSchema.index({ createdAt: -1 });
tenantBackupJobSchema.plugin(auditPlugin);
export const TenantBackupJobModel = mongoose.model<ITenantBackupJob>(
  "TenantBackupJob",
  tenantBackupJobSchema,
);

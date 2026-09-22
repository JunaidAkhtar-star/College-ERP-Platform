import mongoose, { Schema, type Document, type Types } from "mongoose";

export type TImportTarget =
  | "curricula"
  | "departments"
  | "batches"
  | "students"
  | "faculty"
  | "subjects"
  | "fee_opening_balances";
export type TImportStatus =
  | "uploaded"
  | "validated"
  | "validation_failed"
  | "queued"
  | "committing"
  | "completed"
  | "partially_completed"
  | "failed"
  | "cancelled"
  | "rolled_back";

export interface IImportJob extends Document {
  _id: Types.ObjectId;
  target: TImportTarget;
  sourceFileName: string;
  sourceFileSize: number;
  sourceHash: string;
  headers: string[];
  mapping: Record<string, string>;
  options: { skipDuplicates: boolean; updateExisting: boolean };
  status: TImportStatus;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  committedRows: number;
  processedRows: number;
  failedRows: number;
  skippedRows: number;
  updatedRows: number;
  stagedRows: { payload: Record<string, unknown> }[];
  rowErrors: { row: number; field?: string; value?: string; message: string }[];
  createdBy: Types.ObjectId;
  committedBy?: Types.ObjectId;
  committedAt?: Date;
  cancelledAt?: Date;
  committedRecordIds: Types.ObjectId[];
  committedUserIds: Types.ObjectId[];
  rolledBackAt?: Date;
  rolledBackBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ImportJobSchema = new Schema<IImportJob>(
  {
    target: {
      type: String,
      enum: [
        "curricula",
        "departments",
        "batches",
        "students",
        "faculty",
        "subjects",
        "fee_opening_balances",
      ],
      required: true,
      index: true,
    },
    sourceFileName: { type: String, required: true, trim: true },
    sourceFileSize: { type: Number, required: true, min: 1 },
    sourceHash: { type: String, required: true, index: true },
    headers: { type: [String], required: true },
    mapping: { type: Schema.Types.Mixed, default: {} },
    options: {
      skipDuplicates: { type: Boolean, default: true },
      updateExisting: { type: Boolean, default: false },
    },
    status: {
      type: String,
      enum: [
        "uploaded",
        "validated",
        "validation_failed",
        "queued",
        "committing",
        "completed",
        "partially_completed",
        "failed",
        "cancelled",
        "rolled_back",
      ],
      default: "uploaded",
      index: true,
    },
    totalRows: { type: Number, default: 0 },
    validRows: { type: Number, default: 0 },
    invalidRows: { type: Number, default: 0 },
    committedRows: { type: Number, default: 0 },
    processedRows: { type: Number, default: 0, min: 0 },
    failedRows: { type: Number, default: 0 },
    skippedRows: { type: Number, default: 0 },
    updatedRows: { type: Number, default: 0 },
    stagedRows: {
      type: [new Schema({ payload: { type: Schema.Types.Mixed, required: true } }, { _id: false })],
      default: [],
      select: false,
    },
    rowErrors: {
      type: [
        new Schema(
          {
            row: { type: Number, required: true },
            field: { type: String },
            value: { type: String },
            message: { type: String, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    committedBy: { type: Schema.Types.ObjectId, ref: "User" },
    committedAt: { type: Date },
    cancelledAt: { type: Date },
    committedRecordIds: {
      type: [{ type: Schema.Types.ObjectId }],
      default: [],
      select: false,
    },
    committedUserIds: {
      type: [{ type: Schema.Types.ObjectId }],
      default: [],
      select: false,
    },
    rolledBackAt: Date,
    rolledBackBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
ImportJobSchema.index({ createdBy: 1, createdAt: -1 });
ImportJobSchema.index({ sourceHash: 1, target: 1, status: 1 });

export const ImportJobModel = mongoose.model<IImportJob>("ImportJob", ImportJobSchema);

import mongoose, { Schema, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export interface IFeeInstallmentPlan extends Document {
  feeRecordId: Types.ObjectId;
  studentId: Types.ObjectId;
  status: "active" | "completed" | "cancelled";
  installments: Array<{
    sequence: number;
    label: string;
    amount: number;
    dueDate: Date;
    paidAmount: number;
    status: "pending" | "partial" | "paid" | "overdue";
  }>;
  notes?: string;
  createdBy: Types.ObjectId;
}

export interface IFeeAdjustment extends Document {
  feeRecordId: Types.ObjectId;
  studentId: Types.ObjectId;
  kind: "concession" | "waiver" | "late_fee";
  amount: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requestedBy: Types.ObjectId;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewNote?: string;
}

export interface IFeeRefund extends Document {
  feeRecordId: Types.ObjectId;
  studentId: Types.ObjectId;
  transactionId: string;
  amount: number;
  reason: string;
  destination: string;
  status: "requested" | "approved" | "processing" | "paid" | "rejected" | "cancelled";
  reference?: string;
  requestedBy: Types.ObjectId;
  reviewedBy?: Types.ObjectId;
  processedBy?: Types.ObjectId;
  processedAt?: Date;
}

export interface IFeeReconciliation extends Document {
  provider: string;
  statementReference: string;
  transactionReference: string;
  amount: number;
  paidAt: Date;
  feeRecordId?: Types.ObjectId;
  transactionId?: string;
  status: "unmatched" | "matched" | "exception";
  exceptionReason?: string;
  reconciledBy?: Types.ObjectId;
  reconciledAt?: Date;
  importedBy: Types.ObjectId;
}

const FeeInstallmentPlanSchema = new Schema<IFeeInstallmentPlan>(
  {
    feeRecordId: { type: Schema.Types.ObjectId, ref: "FeeRecord", required: true, unique: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["active", "completed", "cancelled"], default: "active" },
    installments: {
      type: [
        new Schema(
          {
            sequence: { type: Number, required: true, min: 1 },
            label: { type: String, required: true, trim: true },
            amount: { type: Number, required: true, min: 0.01 },
            dueDate: { type: Date, required: true },
            paidAmount: { type: Number, default: 0, min: 0 },
            status: {
              type: String,
              enum: ["pending", "partial", "paid", "overdue"],
              default: "pending",
            },
          },
          { _id: false },
        ),
      ],
      validate: [
        (rows: unknown[]) => rows.length > 0 && rows.length <= 24,
        "Use 1-24 installments",
      ],
    },
    notes: { type: String, trim: true, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
FeeInstallmentPlanSchema.plugin(auditPlugin);

const FeeAdjustmentSchema = new Schema<IFeeAdjustment>(
  {
    feeRecordId: { type: Schema.Types.ObjectId, ref: "FeeRecord", required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: ["concession", "waiver", "late_fee"], required: true },
    amount: { type: Number, required: true, min: 0.01 },
    reason: { type: String, required: true, trim: true, minlength: 5, maxlength: 500 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    reviewNote: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);
FeeAdjustmentSchema.plugin(auditPlugin);

const FeeRefundSchema = new Schema<IFeeRefund>(
  {
    feeRecordId: { type: Schema.Types.ObjectId, ref: "FeeRecord", required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    transactionId: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    reason: { type: String, required: true, trim: true, minlength: 5, maxlength: 500 },
    destination: { type: String, required: true, trim: true, maxlength: 200 },
    status: {
      type: String,
      enum: ["requested", "approved", "processing", "paid", "rejected", "cancelled"],
      default: "requested",
      index: true,
    },
    reference: { type: String, trim: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    processedBy: { type: Schema.Types.ObjectId, ref: "User" },
    processedAt: Date,
  },
  { timestamps: true },
);
FeeRefundSchema.index({ feeRecordId: 1, transactionId: 1, status: 1 });
FeeRefundSchema.plugin(auditPlugin);

const FeeReconciliationSchema = new Schema<IFeeReconciliation>(
  {
    provider: { type: String, required: true, trim: true },
    statementReference: { type: String, required: true, trim: true },
    transactionReference: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    paidAt: { type: Date, required: true },
    feeRecordId: { type: Schema.Types.ObjectId, ref: "FeeRecord", index: true },
    transactionId: String,
    status: { type: String, enum: ["unmatched", "matched", "exception"], default: "unmatched" },
    exceptionReason: String,
    reconciledBy: { type: Schema.Types.ObjectId, ref: "User" },
    reconciledAt: Date,
    importedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
FeeReconciliationSchema.index(
  { provider: 1, statementReference: 1, transactionReference: 1 },
  { unique: true },
);
FeeReconciliationSchema.plugin(auditPlugin);

export const FeeInstallmentPlanModel = mongoose.model<IFeeInstallmentPlan>(
  "FeeInstallmentPlan",
  FeeInstallmentPlanSchema,
);
export const FeeAdjustmentModel = mongoose.model<IFeeAdjustment>(
  "FeeAdjustment",
  FeeAdjustmentSchema,
);
export const FeeRefundModel = mongoose.model<IFeeRefund>("FeeRefund", FeeRefundSchema);
export const FeeReconciliationModel = mongoose.model<IFeeReconciliation>(
  "FeeReconciliation",
  FeeReconciliationSchema,
);

import { Schema, model, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export type TFinancialAidType = "grant" | "scholarship" | "loan" | "work_study";
export interface IFinancialAidFund extends Document {
  code: string;
  name: string;
  type: TFinancialAidType;
  source: "government" | "institutional" | "private" | "bank";
  academicYear: string;
  disbursementMode: "fee_credit" | "bank_transfer";
  budgetAmount: number;
  reservedAmount: number;
  disbursedAmount: number;
  maxPerStudent: number;
  isNeedBased: boolean;
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
export interface IFinancialAidPackage extends Document {
  packageNumber: string;
  studentProfileId: Types.ObjectId;
  studentId: Types.ObjectId;
  departmentId: Types.ObjectId;
  academicYear: string;
  costOfAttendance: number;
  studentContribution: number;
  demonstratedNeed: number;
  status:
    | "draft"
    | "offered"
    | "accepted"
    | "declined"
    | "partially_disbursed"
    | "disbursed"
    | "cancelled";
  items: Array<{
    _id: Types.ObjectId;
    fundId: Types.ObjectId;
    fundCode: string;
    fundName: string;
    type: TFinancialAidType;
    disbursementMode: "fee_credit" | "bank_transfer";
    offeredAmount: number;
    acceptedAmount: number;
    disbursedAmount: number;
    status: "offered" | "accepted" | "declined" | "disbursed";
    referenceNo?: string;
    disbursedAt?: Date;
    disbursedBy?: Types.ObjectId;
  }>;
  createdBy: Types.ObjectId;
  offeredBy?: Types.ObjectId;
  offeredAt?: Date;
  acceptedAt?: Date;
  completedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FinancialAidFundSchema = new Schema<IFinancialAidFund>(
  {
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    type: {
      type: String,
      enum: ["grant", "scholarship", "loan", "work_study"],
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ["government", "institutional", "private", "bank"],
      required: true,
    },
    academicYear: { type: String, required: true, trim: true, index: true },
    disbursementMode: { type: String, enum: ["fee_credit", "bank_transfer"], required: true },
    budgetAmount: { type: Number, required: true, min: 1 },
    reservedAmount: { type: Number, default: 0, min: 0 },
    disbursedAmount: { type: Number, default: 0, min: 0 },
    maxPerStudent: { type: Number, required: true, min: 1 },
    isNeedBased: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);
FinancialAidFundSchema.index({ code: 1, academicYear: 1 }, { unique: true });
FinancialAidFundSchema.plugin(auditPlugin);

const PackageItemSchema = new Schema(
  {
    fundId: { type: Schema.Types.ObjectId, ref: "FinancialAidFund", required: true },
    fundCode: { type: String, required: true },
    fundName: { type: String, required: true },
    type: { type: String, enum: ["grant", "scholarship", "loan", "work_study"], required: true },
    disbursementMode: { type: String, enum: ["fee_credit", "bank_transfer"], required: true },
    offeredAmount: { type: Number, required: true, min: 0 },
    acceptedAmount: { type: Number, default: 0, min: 0 },
    disbursedAmount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["offered", "accepted", "declined", "disbursed"],
      default: "offered",
    },
    referenceNo: String,
    disbursedAt: Date,
    disbursedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { _id: true },
);
const FinancialAidPackageSchema = new Schema<IFinancialAidPackage>(
  {
    packageNumber: { type: String, required: true, unique: true, index: true },
    studentProfileId: {
      type: Schema.Types.ObjectId,
      ref: "StudentProfile",
      required: true,
      index: true,
    },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true, index: true },
    academicYear: { type: String, required: true, index: true },
    costOfAttendance: { type: Number, required: true, min: 0 },
    studentContribution: { type: Number, required: true, min: 0 },
    demonstratedNeed: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: [
        "draft",
        "offered",
        "accepted",
        "declined",
        "partially_disbursed",
        "disbursed",
        "cancelled",
      ],
      default: "draft",
      index: true,
    },
    items: {
      type: [PackageItemSchema],
      validate: [(rows: unknown[]) => rows.length > 0 && rows.length <= 20, "Use 1-20 aid items"],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    offeredBy: { type: Schema.Types.ObjectId, ref: "User" },
    offeredAt: Date,
    acceptedAt: Date,
    completedAt: Date,
    notes: { type: String, trim: true, maxlength: 5000 },
  },
  { timestamps: true },
);
FinancialAidPackageSchema.index({ studentProfileId: 1, academicYear: 1 }, { unique: true });
FinancialAidPackageSchema.index({ departmentId: 1, academicYear: 1, status: 1 });
FinancialAidPackageSchema.plugin(auditPlugin);

export const FinancialAidFundModel = model<IFinancialAidFund>(
  "FinancialAidFund",
  FinancialAidFundSchema,
);
export const FinancialAidPackageModel = model<IFinancialAidPackage>(
  "FinancialAidPackage",
  FinancialAidPackageSchema,
);

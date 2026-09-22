import { auditPlugin } from "../plugins/audit.plugin";
import type { Types, Document } from "mongoose";
import { Schema, model } from "mongoose";

export interface IPayrollComponent {
  component: string; // "Basic Pay", "DA", "HRA", "TA"
  type: "earning" | "deduction";
  amount: number;
  isPercentage: boolean;
  percentageBase?: string;
  percentageValue?: number;
}

export interface IPayslip extends Document {
  employeeId: Types.ObjectId;
  employeeName: string;
  designation: string;
  departmentId: Types.ObjectId;
  month: number; // 1-12
  year: number;
  presentDays: number;
  absentDays: number;
  lopDays: number;
  payableDays: number;
  components: IPayrollComponent[];
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  pfAmount: number;
  ptAmount: number;
  tdsAmount: number;
  bankAccount?: string;
  pfAccountNo?: string;
  paymentDate?: Date;
  paymentMode?: "bank_transfer" | "cash" | "cheque";
  isGenerated: boolean;
  isPaid: boolean;
  status: "draft" | "reviewed" | "approved" | "paid";
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  pdfUrl?: string;
  generatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PayrollComponentSchema = new Schema<IPayrollComponent>(
  {
    component: { type: String, required: true },
    type: { type: String, enum: ["earning", "deduction"], required: true },
    amount: { type: Number, required: true, min: 0 },
    isPercentage: { type: Boolean, default: false },
    percentageBase: { type: String },
    percentageValue: { type: Number },
  },
  { _id: false },
);

const PayslipSchema = new Schema<IPayslip>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    employeeName: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    presentDays: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },
    lopDays: { type: Number, default: 0 },
    payableDays: { type: Number, default: 0 },
    components: [PayrollComponentSchema],
    grossPay: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 },
    pfAmount: { type: Number, default: 0 },
    ptAmount: { type: Number, default: 0 },
    tdsAmount: { type: Number, default: 0 },
    bankAccount: { type: String },
    pfAccountNo: { type: String },
    paymentDate: { type: Date },
    paymentMode: { type: String, enum: ["bank_transfer", "cash", "cheque"] },
    isGenerated: { type: Boolean, default: false },
    isPaid: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["draft", "reviewed", "approved", "paid"],
      default: "draft",
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    pdfUrl: { type: String },
    generatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

PayslipSchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });
PayslipSchema.index({ status: 1, year: 1 });
PayslipSchema.index({ month: 1, year: 1 });

// Apply audit plugin (soft delete + createdBy/updatedBy)
PayrollComponentSchema.plugin(auditPlugin);

export const PayslipModel = model<IPayslip>("Payslip", PayslipSchema);

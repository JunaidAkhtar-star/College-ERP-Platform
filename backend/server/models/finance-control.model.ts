import mongoose, { Schema, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export interface IAccountingPeriod extends Document {
  _id: Types.ObjectId;
  financialYear: string;
  period: number;
  startsAt: Date;
  endsAt: Date;
  status: "open" | "soft_closed" | "closed";
  closedBy?: Types.ObjectId;
  closedAt?: Date;
  closeReason?: string;
}

const accountingPeriodSchema = new Schema<IAccountingPeriod>(
  {
    financialYear: { type: String, required: true, trim: true, index: true },
    period: { type: Number, required: true, min: 1, max: 12 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["open", "soft_closed", "closed"],
      default: "open",
      index: true,
    },
    closedBy: { type: Schema.Types.ObjectId, ref: "User" },
    closedAt: Date,
    closeReason: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);
accountingPeriodSchema.index({ financialYear: 1, period: 1 }, { unique: true });
accountingPeriodSchema.index({ startsAt: 1, endsAt: 1 });
accountingPeriodSchema.plugin(auditPlugin);

export interface IFinanceBudget extends Document {
  _id: Types.ObjectId;
  financialYear: string;
  budgetHead: string;
  departmentId?: Types.ObjectId;
  approvedAmount: number;
  encumberedAmount: number;
  consumedAmount: number;
  status: "draft" | "pending_approval" | "approved" | "closed";
  createdBy: Types.ObjectId;
  submittedBy?: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
}

const financeBudgetSchema = new Schema<IFinanceBudget>(
  {
    financialYear: { type: String, required: true, trim: true, index: true },
    budgetHead: { type: String, required: true, trim: true, maxlength: 100 },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    approvedAmount: { type: Number, required: true, min: 0 },
    encumberedAmount: { type: Number, default: 0, min: 0 },
    consumedAmount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["draft", "pending_approval", "approved", "closed"],
      default: "draft",
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
  },
  { timestamps: true },
);
financeBudgetSchema.index({ financialYear: 1, budgetHead: 1, departmentId: 1 }, { unique: true });
financeBudgetSchema.plugin(auditPlugin);

export interface IBankStatementLine extends Document {
  _id: Types.ObjectId;
  bankAccountCode: string;
  statementReference: string;
  transactionDate: Date;
  valueDate: Date;
  amount: number;
  direction: "credit" | "debit";
  description: string;
  status: "unmatched" | "matched" | "exception";
  journalEntryId?: Types.ObjectId;
  importedBy: Types.ObjectId;
  matchedBy?: Types.ObjectId;
  matchedAt?: Date;
  matchNote?: string;
}

export interface IFinanceTaxConfig extends Document {
  _id: Types.ObjectId;
  code: string;
  name: string;
  taxType: "gst" | "tds";
  rate: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  inputAccountCode?: string;
  outputAccountCode: string;
  status: "draft" | "pending_approval" | "approved" | "retired";
  createdBy: Types.ObjectId;
  submittedBy?: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
}

const bankStatementLineSchema = new Schema<IBankStatementLine>(
  {
    bankAccountCode: { type: String, required: true, uppercase: true, trim: true },
    statementReference: { type: String, required: true, trim: true },
    transactionDate: { type: Date, required: true, index: true },
    valueDate: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    direction: { type: String, enum: ["credit", "debit"], required: true },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ["unmatched", "matched", "exception"],
      default: "unmatched",
      index: true,
    },
    journalEntryId: { type: Schema.Types.ObjectId, ref: "JournalEntry" },
    importedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    matchedBy: { type: Schema.Types.ObjectId, ref: "User" },
    matchedAt: Date,
    matchNote: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);
bankStatementLineSchema.index({ bankAccountCode: 1, statementReference: 1 }, { unique: true });
bankStatementLineSchema.plugin(auditPlugin);

const financeTaxConfigSchema = new Schema<IFinanceTaxConfig>(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    taxType: { type: String, enum: ["gst", "tds"], required: true, index: true },
    rate: { type: Number, required: true, min: 0, max: 100 },
    effectiveFrom: { type: Date, required: true, index: true },
    effectiveTo: Date,
    inputAccountCode: { type: String, uppercase: true, trim: true },
    outputAccountCode: { type: String, required: true, uppercase: true, trim: true },
    status: {
      type: String,
      enum: ["draft", "pending_approval", "approved", "retired"],
      default: "draft",
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
  },
  { timestamps: true },
);
financeTaxConfigSchema.index({ code: 1, effectiveFrom: 1 }, { unique: true });
financeTaxConfigSchema.plugin(auditPlugin);

export const AccountingPeriodModel = mongoose.model<IAccountingPeriod>(
  "AccountingPeriod",
  accountingPeriodSchema,
);
export const FinanceBudgetModel = mongoose.model<IFinanceBudget>(
  "FinanceBudget",
  financeBudgetSchema,
);
export const BankStatementLineModel = mongoose.model<IBankStatementLine>(
  "BankStatementLine",
  bankStatementLineSchema,
);
export const FinanceTaxConfigModel = mongoose.model<IFinanceTaxConfig>(
  "FinanceTaxConfig",
  financeTaxConfigSchema,
);

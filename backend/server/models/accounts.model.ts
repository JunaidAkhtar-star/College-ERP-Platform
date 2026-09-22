import { auditPlugin } from "../plugins/audit.plugin";
import type { Types, Document } from "mongoose";
import { Schema, model } from "mongoose";

export interface IAccountsTransaction extends Document {
  transactionType: "income" | "expense";
  category: string; // "Tuition Fee", "Salary", "Infrastructure", ...
  subCategory?: string;
  amount: number;
  paymentMode: "cash" | "bank_transfer" | "cheque" | "upi" | "dd";
  referenceNo?: string;
  description: string;
  departmentId?: Types.ObjectId;
  relatedDocumentId?: Types.ObjectId;
  relatedDocumentType?: string;
  date: Date;
  financialYear: string; // "2025-26"
  budgetHead?: string;
  approvedBy?: Types.ObjectId;
  receiptUrl?: string;
  externalSourceKey?: string;
  reversalOf?: Types.ObjectId;
  reversedAt?: Date;
  reversedBy?: Types.ObjectId;
  reversalReason?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AccountsTransactionSchema = new Schema<IAccountsTransaction>(
  {
    transactionType: { type: String, enum: ["income", "expense"], required: true },
    category: { type: String, required: true, trim: true },
    subCategory: { type: String, trim: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMode: {
      type: String,
      enum: ["cash", "bank_transfer", "cheque", "upi", "dd"],
      required: true,
    },
    referenceNo: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    relatedDocumentId: { type: Schema.Types.ObjectId },
    relatedDocumentType: { type: String },
    date: { type: Date, required: true },
    financialYear: { type: String, required: true, trim: true },
    budgetHead: { type: String, trim: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    receiptUrl: { type: String },
    externalSourceKey: { type: String, unique: true, sparse: true, immutable: true },
    reversalOf: { type: Schema.Types.ObjectId, ref: "AccountsTransaction", immutable: true },
    reversedAt: { type: Date },
    reversedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reversalReason: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

AccountsTransactionSchema.index({ financialYear: 1, transactionType: 1 });
AccountsTransactionSchema.index({ date: -1 });
AccountsTransactionSchema.index({ category: 1, financialYear: 1 });
AccountsTransactionSchema.index({ reversalOf: 1 }, { unique: true, sparse: true });

// Apply audit plugin (soft delete + createdBy/updatedBy)
AccountsTransactionSchema.plugin(auditPlugin);

export const AccountsTransactionModel = model<IAccountsTransaction>(
  "AccountsTransaction",
  AccountsTransactionSchema,
);

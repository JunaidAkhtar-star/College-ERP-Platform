import mongoose, { Schema, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export type TAccountType = "asset" | "liability" | "equity" | "income" | "expense";

export interface IGeneralLedgerAccount extends Document {
  _id: Types.ObjectId;
  code: string;
  name: string;
  type: TAccountType;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GeneralLedgerAccountSchema = new Schema<IGeneralLedgerAccount>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["asset", "liability", "equity", "income", "expense"],
      required: true,
      index: true,
    },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);
GeneralLedgerAccountSchema.plugin(auditPlugin);

export interface IJournalLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description?: string;
  partyId?: Types.ObjectId;
}

export interface IJournalEntry extends Document {
  _id: Types.ObjectId;
  voucherNumber: string;
  date: Date;
  financialYear: string;
  description: string;
  sourceType: string;
  sourceId: Types.ObjectId;
  sourceEvent: string;
  status: "posted" | "reversed";
  lines: IJournalLine[];
  totalDebit: number;
  totalCredit: number;
  postedBy: Types.ObjectId;
  reversedBy?: Types.ObjectId;
  reversedAt?: Date;
  reversalOf?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const JournalLineSchema = new Schema<IJournalLine>(
  {
    accountCode: { type: String, required: true, uppercase: true, trim: true },
    accountName: { type: String, required: true, trim: true },
    debit: { type: Number, required: true, min: 0, default: 0 },
    credit: { type: Number, required: true, min: 0, default: 0 },
    description: { type: String, trim: true },
    partyId: { type: Schema.Types.ObjectId },
  },
  { _id: false },
);

const JournalEntrySchema = new Schema<IJournalEntry>(
  {
    voucherNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    date: { type: Date, required: true, index: true },
    financialYear: { type: String, required: true, trim: true, index: true },
    description: { type: String, required: true, trim: true },
    sourceType: { type: String, required: true, trim: true },
    sourceId: { type: Schema.Types.ObjectId, required: true },
    sourceEvent: { type: String, required: true, trim: true },
    status: { type: String, enum: ["posted", "reversed"], default: "posted", index: true },
    lines: { type: [JournalLineSchema], required: true },
    totalDebit: { type: Number, required: true, min: 0 },
    totalCredit: { type: Number, required: true, min: 0 },
    postedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reversedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reversedAt: { type: Date },
    reversalOf: { type: Schema.Types.ObjectId, ref: "JournalEntry" },
  },
  { timestamps: true },
);

JournalEntrySchema.index({ sourceType: 1, sourceId: 1, sourceEvent: 1 }, { unique: true });
JournalEntrySchema.index({ financialYear: 1, status: 1, date: 1 });
JournalEntrySchema.plugin(auditPlugin);

export const GeneralLedgerAccountModel = mongoose.model<IGeneralLedgerAccount>(
  "GeneralLedgerAccount",
  GeneralLedgerAccountSchema,
);
export const JournalEntryModel = mongoose.model<IJournalEntry>("JournalEntry", JournalEntrySchema);

import { auditPlugin } from "../plugins/audit.plugin";
import type { Types, Document } from "mongoose";
import { Schema, model } from "mongoose";

export interface IBook extends Document {
  isbn: string;
  title: string;
  authors: string[];
  publisher: string;
  publicationYear: number;
  edition?: string;
  category: string;
  subject?: string;
  language: string;
  totalCopies: number;
  availableCopies: number;
  shelfLocation?: string;
  coverImageUrl?: string;
  isDigital: boolean;
  digitalUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBookIssue extends Document {
  bookId: Types.ObjectId;
  memberId: Types.ObjectId; // User (student or faculty)
  memberType: "student" | "faculty";
  issueDate: Date;
  dueDate: Date;
  returnDate?: Date;
  renewalCount: number;
  fineAmount: number;
  finePaid: number;
  finePayments: Array<{
    paymentId: string;
    amount: number;
    paymentMode: "cash" | "bank_transfer" | "upi";
    referenceNo?: string;
    paidAt: Date;
    collectedBy: Types.ObjectId;
  }>;
  status: "issued" | "returned" | "overdue" | "lost";
  issuedBy: Types.ObjectId;
  returnedTo?: Types.ObjectId;
  activeKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BookSchema = new Schema<IBook>(
  {
    isbn: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },
    authors: [{ type: String, trim: true }],
    publisher: { type: String, required: true, trim: true },
    publicationYear: { type: Number, required: true },
    edition: { type: String, trim: true },
    category: { type: String, required: true, trim: true },
    subject: { type: String, trim: true },
    language: { type: String, default: "English" },
    totalCopies: { type: Number, required: true, min: 0 },
    availableCopies: { type: Number, required: true, min: 0 },
    shelfLocation: { type: String, trim: true },
    coverImageUrl: { type: String },
    isDigital: { type: Boolean, default: false },
    digitalUrl: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

BookSchema.index({ title: "text", authors: "text" });

const BookIssueSchema = new Schema<IBookIssue>(
  {
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    memberId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    memberType: { type: String, enum: ["student", "faculty"], required: true },
    issueDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    returnDate: { type: Date },
    renewalCount: { type: Number, default: 0, min: 0 },
    fineAmount: { type: Number, default: 0, min: 0 },
    finePaid: { type: Number, default: 0, min: 0 },
    finePayments: {
      type: [
        new Schema(
          {
            paymentId: { type: String, required: true },
            amount: { type: Number, required: true, min: 0.01 },
            paymentMode: {
              type: String,
              enum: ["cash", "bank_transfer", "upi"],
              required: true,
            },
            referenceNo: { type: String, trim: true },
            paidAt: { type: Date, required: true },
            collectedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    status: { type: String, enum: ["issued", "returned", "overdue", "lost"], default: "issued" },
    issuedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    returnedTo: { type: Schema.Types.ObjectId, ref: "User" },
    activeKey: { type: String, unique: true, sparse: true, select: false },
  },
  { timestamps: true },
);

BookIssueSchema.index({ memberId: 1, status: 1 });
BookIssueSchema.index({ dueDate: 1, status: 1 });
BookIssueSchema.index({ "finePayments.paymentId": 1 }, { unique: true, sparse: true });

// Apply audit plugin (soft delete + createdBy/updatedBy)
BookSchema.plugin(auditPlugin);

export const BookModel = model<IBook>("Book", BookSchema);
export const BookIssueModel = model<IBookIssue>("BookIssue", BookIssueSchema);

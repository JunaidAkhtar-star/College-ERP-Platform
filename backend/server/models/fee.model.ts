import { auditPlugin } from "../plugins/audit.plugin";
import type { Document, Types } from "mongoose";
import mongoose, { Schema } from "mongoose";

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum FeeType {
  TUITION = "Tuition Fee",
  DEVELOPMENT = "Development Fee",
  EXAMINATION = "Examination Fee",
  LIBRARY = "Library Fee",
  LABORATORY = "Laboratory Fee",
  HOSTEL = "Hostel Fee",
  TRANSPORT = "Transport Fee",
  SPORTS = "Sports & Cultural Fee",
  ALUMNI = "Alumni Fee",
  CAUTION_MONEY = "Caution Money (Refundable)",
  REGISTRATION = "Registration Fee",
  LATE_FEE = "Late Fee",
  MISC = "Miscellaneous",
}

export enum FeePaymentMode {
  CASH = "Cash",
  DD = "Demand Draft",
  NEFT = "NEFT",
  RTGS = "RTGS",
  IMPS = "IMPS",
  UPI = "UPI",
  NET_BANKING = "Net Banking",
  CARD = "Card",
  CHEQUE = "Cheque",
  ONLINE_PORTAL = "Online Portal",
}

export enum FeePaymentStatus {
  PENDING = "Pending",
  PARTIAL = "Partial",
  PAID = "Paid",
  OVERDUE = "Overdue",
  WAIVED = "Waived",
  REFUNDED = "Refunded",
}

export enum ScholarshipType {
  MERIT = "Merit Scholarship",
  GOVERNMENT = "Government Scholarship",
  INSTITUTION = "Institution Scholarship",
  SPORTS = "Sports Scholarship",
  DIFFERENTLY_ABLED = "Differently Abled Scholarship",
  SC_ST_ODISHA = "SC/ST Odisha Govt.",
  OBC_SEBC = "OBC/SEBC Scholarship",
  OTHER = "Other",
}

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const FeeItemSchema = new Schema(
  {
    type: { type: String, enum: Object.values(FeeType), required: true },
    description: { type: String },
    amount: { type: Number, required: true, min: 0 },
    concession: { type: Number, default: 0 },
    scholarship: { type: Number, default: 0 },
    netAmount: { type: Number, required: true },
  },
  { _id: false },
);

const PaymentTransactionSchema = new Schema(
  {
    transactionId: { type: String, required: true },
    receiptNumber: { type: String, required: true },
    amountPaid: { type: Number, required: true, min: 0 },
    paymentMode: { type: String, enum: Object.values(FeePaymentMode), required: true },
    paymentDate: { type: Date, required: true },
    bankRef: { type: String },
    chequeNumber: { type: String },
    ddNumber: { type: String },
    upiId: { type: String },
    collectedBy: { type: Schema.Types.ObjectId, ref: "User" },
    collectedByName: { type: String },
    remarks: { type: String },
    receiptUrl: { type: String }, // Cloudinary URL
  },
  { timestamps: true },
);

// ─── Main Schema ──────────────────────────────────────────────────────────────

export interface IFeeRecord extends Document {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  studentProfileId?: Types.ObjectId;
  batchId?: Types.ObjectId;
  sectionId?: Types.ObjectId;
  curriculumId?: Types.ObjectId;
  departmentId?: Types.ObjectId;
  rollNumber: string;
  studentName: string;
  program: string;
  branch: string;
  semester: number;
  academicYear: string; // "2024-25"
  invoiceNumber: string;
  dueDate: Date;
  feeItems: Array<{
    type: string;
    description?: string;
    amount: number;
    concession: number;
    scholarship: number;
    netAmount: number;
  }>;
  grossAmount: number;
  totalConcession: number;
  totalScholarship: number;
  netDue: number;
  totalPaid: number;
  balanceDue: number;
  lateFee: number;
  status: FeePaymentStatus;
  transactions: Array<{
    transactionId: string;
    receiptNumber: string;
    amountPaid: number;
    paymentMode: string;
    paymentDate: Date;
    bankRef?: string;
    chequeNumber?: string;
    ddNumber?: string;
    upiId?: string;
    collectedBy?: Types.ObjectId;
    collectedByName?: string;
    remarks?: string;
    receiptUrl?: string;
  }>;
  scholarships: Array<{
    type: string;
    body: string;
    amount: number;
    reference: string;
  }>;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FeeRecordSchema = new Schema<IFeeRecord>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    studentProfileId: { type: Schema.Types.ObjectId, ref: "StudentProfile" },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch" },
    sectionId: { type: Schema.Types.ObjectId, ref: "Section" },
    curriculumId: { type: Schema.Types.ObjectId, ref: "Curriculum" },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    rollNumber: { type: String, required: true },
    studentName: { type: String, required: true },
    program: { type: String, required: true },
    branch: { type: String, required: true },
    semester: { type: Number, required: true, min: 1, max: 8 },
    academicYear: { type: String, required: true },
    invoiceNumber: { type: String, required: true, unique: true },
    dueDate: { type: Date, required: true },
    feeItems: { type: [FeeItemSchema], required: true },
    grossAmount: { type: Number, required: true, default: 0 },
    totalConcession: { type: Number, default: 0 },
    totalScholarship: { type: Number, default: 0 },
    netDue: { type: Number, required: true, default: 0 },
    totalPaid: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
    lateFee: { type: Number, default: 0 },
    status: {
      type: String,
      enum: Object.values(FeePaymentStatus),
      default: FeePaymentStatus.PENDING,
    },
    transactions: { type: [PaymentTransactionSchema], default: [] },
    scholarships: [
      {
        type: { type: String, enum: Object.values(ScholarshipType) },
        body: String,
        amount: Number,
        reference: String,
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

FeeRecordSchema.index({ studentId: 1, semester: 1, academicYear: 1 });
FeeRecordSchema.index({ rollNumber: 1 });
FeeRecordSchema.index({ status: 1 });
// index on `invoiceNumber` is created by `unique: true` in the field definition above
FeeRecordSchema.index({ dueDate: 1, status: 1 });
FeeRecordSchema.index({ "transactions.transactionId": 1 }, { unique: true, sparse: true });
FeeRecordSchema.index({ "transactions.bankRef": 1 }, { sparse: true });
FeeRecordSchema.index({ "transactions.receiptNumber": 1 }, { unique: true, sparse: true });

// Auto-compute balanceDue before save
FeeRecordSchema.pre("save", async function () {
  this.balanceDue = Math.max(0, this.netDue + this.lateFee - this.totalPaid);
  if (this.balanceDue === 0 && this.totalPaid > 0) this.status = FeePaymentStatus.PAID;
  else if (this.totalPaid > 0 && this.balanceDue > 0) this.status = FeePaymentStatus.PARTIAL;
  else if (new Date() > this.dueDate && this.balanceDue > 0) this.status = FeePaymentStatus.OVERDUE;
});

FeeRecordSchema.plugin(auditPlugin);

export const FeeRecordModel = mongoose.model<IFeeRecord>("FeeRecord", FeeRecordSchema);

// ─── Fee Structure (master template) ─────────────────────────────────────────

export interface IFeeStructure extends Document {
  _id: Types.ObjectId;
  program: string;
  branch: string;
  curriculumId?: Types.ObjectId;
  departmentId?: Types.ObjectId;
  batchId?: Types.ObjectId;
  semester: number;
  academicYear: string;
  admissionType: string;
  category: string; // General / SC / ST / SEBC
  feeItems: Array<{ type: string; description: string; amount: number }>;
  totalAmount: number;
  isActive: boolean;
  approvedBy?: Types.ObjectId;
  approvedDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FeeStructureSchema = new Schema<IFeeStructure>(
  {
    program: { type: String, required: true },
    branch: { type: String, required: true },
    curriculumId: { type: Schema.Types.ObjectId, ref: "Curriculum" },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch" },
    semester: { type: Number, required: true, min: 1, max: 8 },
    academicYear: { type: String, required: true },
    admissionType: { type: String, default: "Regular" },
    category: { type: String, default: "General" },
    feeItems: [{ type: { type: String }, description: String, amount: Number }],
    totalAmount: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedDate: { type: Date },
  },
  { timestamps: true },
);

FeeStructureSchema.index(
  { program: 1, branch: 1, semester: 1, academicYear: 1, category: 1 },
  { unique: true },
);

export const FeeStructureModel = mongoose.model<IFeeStructure>("FeeStructure", FeeStructureSchema);

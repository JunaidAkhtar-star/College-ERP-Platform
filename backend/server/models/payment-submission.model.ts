/**
 * Payment Submission Model
 *
 * When a student wants to pay a fee, they:
 *   1. View payment details (QR / bank / UPI) from PaymentSettings
 *   2. Make the transfer using their bank app / UPI
 *   3. Upload screenshot + UTR/Transaction ID via this submission
 *
 * The Accounts team then:
 *   - Reviews the submission
 *   - Approves (records the payment in FeeRecord + uploads official receipt)
 *   - Or Rejects (with reason)
 *
 * This mirrors a college reimbursement workflow.
 */
import mongoose, { type Document, Schema, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";
import { FeePaymentMode } from "./fee.model";

export enum SubmissionStatus {
  PENDING = "pending", // Submitted, awaiting accounts review
  UNDER_REVIEW = "under_review", // Accounts opened it
  APPROVED = "approved", // Verified & payment recorded
  REJECTED = "rejected", // Invalid proof / wrong amount
  RESUBMIT = "resubmit_required", // Accounts asked student to resubmit
}

export interface IPaymentSubmission extends Document {
  _id: Types.ObjectId;

  // Links
  feeRecordId: Types.ObjectId; // Which FeeRecord this is paying against
  studentId: Types.ObjectId; // Who submitted
  studentName: string;
  rollNumber: string;
  program: string;
  branch: string;
  semester: number;
  academicYear: string;

  // Amount student claims to have paid
  amountSubmitted: number;
  paymentMode: FeePaymentMode;
  paymentDate: Date;

  // Proof
  utrNumber?: string; // UTR / UPI ref / transaction ID from bank
  bankReference?: string; // Bank ref / NEFT ref
  screenshotUrl?: string; // Cloudinary URL of payment screenshot
  screenshotPublicId?: string;

  // Workflow
  status: SubmissionStatus;
  submittedAt: Date;

  // Accounts review
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewRemarks?: string; // Rejection reason or approval note

  // On Approval: Accounts fills these
  officialReceiptUrl?: string; // Official receipt PDF (Cloudinary URL)
  officialReceiptPublicId?: string;
  receiptGenerationStatus?: "pending" | "processing" | "ready" | "failed";
  receiptGenerationError?: string;
  receiptGenerationAttempts: number;
  officialInvoiceNumber?: string; // Invoice number assigned by accounts
  officialReceiptNumber?: string; // External/manual receipt number, if Accounts enters one
  approvalReferenceNo?: string; // Bank/DD/office reference used during approval
  ddNumber?: string;
  chequeNumber?: string;
  feeTransactionId?: string; // The transaction ID added to FeeRecord
  activeKey?: string; // Unique while pending/review; prevents concurrent duplicate submissions

  // Resubmission tracking
  resubmissionCount: number;
  previousSubmissions: Array<{
    screenshotUrl?: string;
    utrNumber?: string;
    rejectedAt: Date;
    rejectionReason: string;
  }>;

  createdAt: Date;
  updatedAt: Date;
}

const PreviousSubmissionSchema = new Schema(
  {
    screenshotUrl: { type: String },
    utrNumber: { type: String },
    rejectedAt: { type: Date, required: true },
    rejectionReason: { type: String, required: true },
  },
  { _id: false },
);

const PaymentSubmissionSchema = new Schema<IPaymentSubmission>(
  {
    feeRecordId: { type: Schema.Types.ObjectId, ref: "FeeRecord", required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    studentName: { type: String, required: true, trim: true },
    rollNumber: { type: String, required: true, trim: true },
    program: { type: String, required: true },
    branch: { type: String, required: true },
    semester: { type: Number, required: true, min: 1, max: 8 },
    academicYear: { type: String, required: true },

    amountSubmitted: { type: Number, required: true, min: 1 },
    paymentMode: { type: String, enum: Object.values(FeePaymentMode), required: true },
    paymentDate: { type: Date, required: true },

    utrNumber: { type: String, trim: true },
    bankReference: { type: String, trim: true },
    screenshotUrl: { type: String },
    screenshotPublicId: { type: String },

    status: {
      type: String,
      enum: Object.values(SubmissionStatus),
      default: SubmissionStatus.PENDING,
      index: true,
    },
    submittedAt: { type: Date, default: Date.now },

    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewRemarks: { type: String },

    officialReceiptUrl: { type: String },
    officialReceiptPublicId: { type: String },
    receiptGenerationStatus: {
      type: String,
      enum: ["pending", "processing", "ready", "failed"],
    },
    receiptGenerationError: { type: String },
    receiptGenerationAttempts: { type: Number, default: 0, min: 0 },
    officialInvoiceNumber: { type: String },
    officialReceiptNumber: { type: String, trim: true },
    approvalReferenceNo: { type: String, trim: true },
    ddNumber: { type: String, trim: true },
    chequeNumber: { type: String, trim: true },
    feeTransactionId: { type: String },
    activeKey: { type: String, unique: true, sparse: true, select: false },

    resubmissionCount: { type: Number, default: 0, min: 0 },
    previousSubmissions: { type: [PreviousSubmissionSchema], default: [] },
  },
  { timestamps: true },
);

// Compound indexes for common queries
PaymentSubmissionSchema.index({ feeRecordId: 1, studentId: 1 });
PaymentSubmissionSchema.index({ status: 1, submittedAt: -1 });
PaymentSubmissionSchema.index({ reviewedBy: 1, status: 1 });
PaymentSubmissionSchema.index({ academicYear: 1, status: 1 });

PaymentSubmissionSchema.plugin(auditPlugin);

export const PaymentSubmissionModel = mongoose.model<IPaymentSubmission>(
  "PaymentSubmission",
  PaymentSubmissionSchema,
);

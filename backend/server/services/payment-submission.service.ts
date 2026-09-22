/**
 * Payment Submission Service
 *
 * Handles the complete manual payment verification workflow:
 *
 *  Student flow:
 *    1. GET  /fee/payment-settings          → see QR / bank details
 *    2. POST /fee/submissions               → submit UTR + screenshot
 *    3. GET  /fee/submissions/:id           → track status
 *    4. PUT  /fee/submissions/:id/resubmit  → resubmit if rejected
 *
 *  Accounts team flow:
 *    1. GET  /accounts/payment-submissions  → list pending submissions
 *    2. PUT  /accounts/payment-submissions/:id/review → mark under_review
 *    3. PUT  /accounts/payment-submissions/:id/approve → approve + record payment + upload receipt
 *    4. PUT  /accounts/payment-submissions/:id/reject  → reject with reason
 */
import createError from "http-errors";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { paymentSubmissionRepository } from "../repositories/payment-submission.repository";
import { feeRepository } from "../repositories/fee.repository";
import { uploadUtil } from "../utils/upload.util";
import { SubmissionStatus } from "../models/payment-submission.model";
import { FeePaymentMode, FeePaymentStatus } from "../models/fee.model";
import { logger } from "../utils/logger.util";
import { paymentSettingsService } from "./payment-settings.service";
import { emailService } from "../email/email.service";
import { pushNotification } from "../socket/socket.gateway";
import { pdfService } from "../pdf/pdf.service";
import type { UploadedFile } from "express-fileupload";
import { generalLedgerService } from "./general-ledger.service";
import { InstitutionSettingModel } from "../models/institution-setting.model";
import { formatIndiaDate } from "../utils/date.util";

const genReceiptNo = async () => {
  const settings = await InstitutionSettingModel.findOne().select("receiptPrefix shortCode").lean();
  const prefix = settings?.receiptPrefix || `${settings?.shortCode || "ERP"}-RCP`;
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${uuidv4().split("-")[0].toUpperCase()}`;
};
const genTransactionId = () => `TXN-${uuidv4().split("-")[0].toUpperCase()}`;

const MODE_ALIASES: Record<string, FeePaymentMode> = {
  cash: FeePaymentMode.CASH,
  dd: FeePaymentMode.DD,
  demanddraft: FeePaymentMode.DD,
  demand_draft: FeePaymentMode.DD,
  neft: FeePaymentMode.NEFT,
  rtgs: FeePaymentMode.RTGS,
  imps: FeePaymentMode.IMPS,
  upi: FeePaymentMode.UPI,
  netbanking: FeePaymentMode.NET_BANKING,
  net_banking: FeePaymentMode.NET_BANKING,
  card: FeePaymentMode.CARD,
  cheque: FeePaymentMode.CHEQUE,
  onlineportal: FeePaymentMode.ONLINE_PORTAL,
  online_portal: FeePaymentMode.ONLINE_PORTAL,
};

function normalizeMode(mode: string) {
  const key = String(mode).toLowerCase().replace(/[\s-]/g, "");
  return MODE_ALIASES[key] ?? Object.values(FeePaymentMode).find((m) => m === mode);
}

export const paymentSubmissionService = {
  // ────────────────────────────────────────────────────────────────────────────
  // STUDENT ACTIONS
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Student submits payment proof.
   * Validates: fee record exists, not already paid, no active pending submission.
   */
  submit: async (
    data: {
      feeRecordId: string;
      studentId: string;
      studentName: string;
      rollNumber: string;
      program: string;
      branch: string;
      semester: number;
      academicYear: string;
      amountSubmitted: number;
      paymentMode: FeePaymentMode;
      paymentDate: string;
      utrNumber?: string;
      bankReference?: string;
    },
    screenshotFile?: UploadedFile,
  ) => {
    // 1. Validate fee record
    const feeRecord = await feeRepository.findRecordById(data.feeRecordId);
    if (!feeRecord) throw createError(404, "Fee record not found");
    if (feeRecord.studentId.toString() !== data.studentId) {
      throw createError(403, "Students can submit payment only for their own invoice");
    }
    if (feeRecord.status === FeePaymentStatus.PAID)
      throw createError(400, "This fee invoice is already fully paid");
    if (feeRecord.balanceDue <= 0) throw createError(400, "No balance due on this invoice");

    const settings = await paymentSettingsService.getActive(false);
    const normalizedMode = normalizeMode(data.paymentMode);
    if (!normalizedMode) throw createError(400, "Unsupported payment mode");
    const acceptedModes = ((settings["acceptedModes"] as string[] | undefined) ?? [])
      .map(normalizeMode)
      .filter(Boolean);
    if (acceptedModes.length > 0 && !acceptedModes.includes(normalizedMode)) {
      throw createError(400, "This payment mode is not currently accepted by Accounts");
    }
    if (settings["requireUtrNumber"] !== false && !data.utrNumber?.trim()) {
      throw createError(400, "UTR / transaction ID is required");
    }
    if (settings["requireScreenshot"] !== false && !screenshotFile) {
      throw createError(400, "Payment screenshot is required");
    }

    // 2. Validate amount
    if (data.amountSubmitted <= 0 || data.amountSubmitted > feeRecord.balanceDue + 0.01) {
      throw createError(
        400,
        `Submitted amount ₹${data.amountSubmitted} exceeds balance due ₹${feeRecord.balanceDue}`,
      );
    }

    // 3. Check for existing active submission
    const existing = await paymentSubmissionRepository.findActivePendingForFeeRecord(
      data.feeRecordId,
    );
    if (existing)
      throw createError(
        409,
        "A payment submission for this invoice is already pending review. Please wait for the Accounts team to process it.",
      );

    // 4. Upload screenshot if provided
    let screenshotUrl: string | undefined;
    let screenshotPublicId: string | undefined;
    if (screenshotFile) {
      const uploaded = await uploadUtil.uploadDocument(screenshotFile, "erp/payment-proofs");
      screenshotUrl = uploaded.url;
      screenshotPublicId = uploaded.publicId;
    }

    // 5. Create submission
    const submission = await paymentSubmissionRepository.create({
      feeRecordId: data.feeRecordId,
      studentId: data.studentId,
      studentName: feeRecord.studentName,
      rollNumber: feeRecord.rollNumber,
      program: feeRecord.program,
      branch: feeRecord.branch,
      semester: feeRecord.semester,
      academicYear: feeRecord.academicYear,
      amountSubmitted: data.amountSubmitted,
      paymentMode: normalizedMode,
      paymentDate: new Date(data.paymentDate),
      utrNumber: data.utrNumber?.trim(),
      bankReference: data.bankReference?.trim(),
      screenshotUrl,
      screenshotPublicId,
      status: SubmissionStatus.PENDING,
      submittedAt: new Date(),
      resubmissionCount: 0,
      activeKey: data.feeRecordId,
    });

    return submission;
  },

  /**
   * Student resubmits after rejection.
   */
  resubmit: async (
    submissionId: string,
    studentId: string,
    data: {
      utrNumber?: string;
      bankReference?: string;
      paymentDate?: string;
      amountSubmitted?: number;
    },
    screenshotFile?: UploadedFile,
  ) => {
    const submission = await paymentSubmissionRepository.findById(submissionId);
    if (!submission) throw createError(404, "Submission not found");
    if (submission.studentId.toString() !== studentId) throw createError(403, "Access denied");
    if (
      submission.status !== SubmissionStatus.REJECTED &&
      submission.status !== SubmissionStatus.RESUBMIT
    )
      throw createError(400, "This submission cannot be resubmitted in its current state");

    const feeRecord = await feeRepository.findRecordById(submission.feeRecordId.toString());
    if (!feeRecord) throw createError(404, "Fee record not found");
    if (feeRecord.studentId.toString() !== studentId) throw createError(403, "Access denied");
    if (feeRecord.status === FeePaymentStatus.PAID) {
      throw createError(400, "This fee invoice is already fully paid");
    }
    const nextAmount = data.amountSubmitted ?? submission.amountSubmitted;
    if (nextAmount <= 0 || nextAmount > feeRecord.balanceDue + 0.01) {
      throw createError(400, `Invalid amount. Balance due is ₹${feeRecord.balanceDue}`);
    }
    const settings = await paymentSettingsService.getActive(false);
    if (
      settings["requireUtrNumber"] !== false &&
      !(data.utrNumber ?? submission.utrNumber)?.trim()
    ) {
      throw createError(400, "UTR / transaction ID is required");
    }
    if (settings["requireScreenshot"] !== false && !screenshotFile && !submission.screenshotUrl) {
      throw createError(400, "Payment screenshot is required");
    }

    // Archive old proof
    const previousEntry = {
      screenshotUrl: submission.screenshotUrl,
      utrNumber: submission.utrNumber,
      rejectedAt: submission.reviewedAt ?? new Date(),
      rejectionReason: submission.reviewRemarks ?? "Rejected",
    };

    let screenshotUrl = submission.screenshotUrl;
    let screenshotPublicId = submission.screenshotPublicId;
    if (screenshotFile) {
      const uploaded = await uploadUtil.uploadDocument(screenshotFile, "erp/payment-proofs");
      screenshotUrl = uploaded.url;
      screenshotPublicId = uploaded.publicId;
    }

    return paymentSubmissionRepository.updateById(submissionId, {
      status: SubmissionStatus.PENDING,
      utrNumber: data.utrNumber ?? submission.utrNumber,
      bankReference: data.bankReference ?? submission.bankReference,
      paymentDate: data.paymentDate ? new Date(data.paymentDate) : submission.paymentDate,
      amountSubmitted: nextAmount,
      screenshotUrl,
      screenshotPublicId,
      reviewedBy: undefined,
      reviewedAt: undefined,
      reviewRemarks: undefined,
      submittedAt: new Date(),
      resubmissionCount: (submission.resubmissionCount ?? 0) + 1,
      activeKey: submission.feeRecordId.toString(),
      $push: { previousSubmissions: previousEntry },
    });
  },

  getByStudent: (studentId: string) => paymentSubmissionRepository.findByStudent(studentId),

  getById: async (id: string, studentId?: string) => {
    const sub = await paymentSubmissionRepository.findById(id);
    if (!sub) throw createError(404, "Submission not found");
    if (studentId && sub.studentId.toString() !== studentId)
      throw createError(403, "Access denied");
    return sub;
  },

  getByFeeRecord: async (feeRecordId: string, studentId?: string) => {
    if (studentId) {
      const feeRecord = await feeRepository.findRecordById(feeRecordId);
      if (!feeRecord) throw createError(404, "Fee record not found");
      if (feeRecord.studentId.toString() !== studentId) throw createError(403, "Access denied");
    }
    return paymentSubmissionRepository.findByFeeRecord(feeRecordId);
  },

  // ────────────────────────────────────────────────────────────────────────────
  // ACCOUNTS TEAM ACTIONS
  // ────────────────────────────────────────────────────────────────────────────

  /** List all submissions with filters (for Accounts portal). */
  list: (filter: Record<string, unknown>, page: number, limit: number) =>
    paymentSubmissionRepository.paginate(filter, page, limit),

  /** Mark a submission as "under review" (Accounts opened it). */
  markUnderReview: async (submissionId: string, reviewedBy: string) => {
    const sub = await paymentSubmissionRepository.findById(submissionId);
    if (!sub) throw createError(404, "Submission not found");
    if (sub.status !== SubmissionStatus.PENDING)
      throw createError(400, "Submission is not in pending state");

    return paymentSubmissionRepository.updateById(submissionId, {
      status: SubmissionStatus.UNDER_REVIEW,
      reviewedBy,
      reviewedAt: new Date(),
    });
  },

  /**
   * Approve a payment submission.
   *
   * Steps:
   *   1. Validate submission & fee record
   *   2. Generate receipt number + transaction ID
   *   3. Add transaction to FeeRecord (atomic with MongoDB session)
   *   4. Upload official receipt PDF to Cloudinary
   *   5. Update submission status to approved
   *   6. Send email + push notification to student
   */
  approve: async (
    submissionId: string,
    reviewedBy: string,
    reviewedByName: string,
    data: {
      officialInvoiceNumber?: string;
      officialReceiptNumber?: string;
      approvalReferenceNo?: string;
      ddNumber?: string;
      chequeNumber?: string;
      remarks?: string;
      studentEmail: string;
      studentName: string;
      fatherName?: string;
    },
    receiptFile?: UploadedFile,
  ) => {
    const sub = await paymentSubmissionRepository.findById(submissionId);
    if (!sub) throw createError(404, "Submission not found");
    if (sub.status !== SubmissionStatus.PENDING && sub.status !== SubmissionStatus.UNDER_REVIEW)
      throw createError(400, "Submission is not awaiting approval");

    const feeRecord = await feeRepository.findRecordById(sub.feeRecordId.toString());
    if (!feeRecord) throw createError(404, "Fee record not found");
    if (feeRecord.status === FeePaymentStatus.PAID)
      throw createError(400, "Fee invoice is already fully paid");

    const receiptNumber = await genReceiptNo();
    const transactionId = genTransactionId();
    const invoiceNumber = data.officialInvoiceNumber ?? feeRecord.invoiceNumber;
    const approvalReferenceNo =
      data.approvalReferenceNo ?? data.ddNumber ?? data.chequeNumber ?? sub.bankReference;
    const approvalRemarks = [
      `Verified by ${reviewedByName}`,
      sub.utrNumber ? `UTR: ${sub.utrNumber}` : undefined,
      data.officialReceiptNumber ? `Official receipt: ${data.officialReceiptNumber}` : undefined,
      data.ddNumber ? `DD: ${data.ddNumber}` : undefined,
      data.chequeNumber ? `Cheque: ${data.chequeNumber}` : undefined,
      data.remarks,
    ]
      .filter(Boolean)
      .join(". ");

    // Use MongoDB session for atomicity (fee record + submission update)
    const session = await mongoose.startSession();
    let updatedSub: Awaited<ReturnType<typeof paymentSubmissionRepository.transitionStatus>> = null;
    try {
      await session.withTransaction(async () => {
        // Add transaction to fee record
        const updatedFeeRecord = await feeRepository.addTransaction(
          sub.feeRecordId.toString(),
          {
            transactionId,
            receiptNumber,
            amountPaid: sub.amountSubmitted,
            paymentMode: sub.paymentMode,
            paymentDate: sub.paymentDate,
            bankRef: approvalReferenceNo,
            ddNumber: data.ddNumber,
            chequeNumber: data.chequeNumber,
            upiId: sub.utrNumber, // UTR doubles as UPI ref
            collectedBy: reviewedBy,
            collectedByName: reviewedByName,
            remarks: approvalRemarks,
          },
          { session, expectedBalanceDue: feeRecord.balanceDue },
        );
        if (!updatedFeeRecord) {
          throw createError(
            409,
            "The fee balance changed or this invoice was already paid. Refresh and review again.",
          );
        }

        await generalLedgerService.postFeeCollection(
          {
            feeRecordId: feeRecord._id,
            transactionId,
            receiptNumber,
            amount: sub.amountSubmitted,
            paymentMode: sub.paymentMode,
            paymentDate: sub.paymentDate,
            financialYear: sub.academicYear,
            studentId: sub.studentId,
            postedBy: reviewedBy,
          },
          session,
        );

        // Update submission
        updatedSub = await paymentSubmissionRepository.transitionStatus(
          submissionId,
          [SubmissionStatus.PENDING, SubmissionStatus.UNDER_REVIEW],
          {
            status: SubmissionStatus.APPROVED,
            reviewedBy,
            reviewedAt: new Date(),
            reviewRemarks: data.remarks,
            receiptGenerationStatus: "pending",
            receiptGenerationError: undefined,
            officialInvoiceNumber: invoiceNumber,
            officialReceiptNumber: data.officialReceiptNumber,
            approvalReferenceNo,
            ddNumber: data.ddNumber,
            chequeNumber: data.chequeNumber,
            feeTransactionId: transactionId,
            activeKey: undefined,
          },
          session,
        );
        if (!updatedSub) {
          throw createError(409, "This payment submission was already finalized by another user.");
        }
      });
    } finally {
      await session.endSession();
    }

    if (!updatedSub) throw createError(500, "Payment approval did not complete");
    const receiptResult = await paymentSubmissionService
      .generateOfficialReceipt(submissionId, reviewedByName, receiptFile)
      .catch(() => ({ submission: updatedSub, status: "pending" as const }));
    updatedSub = receiptResult.submission;

    // Notify student (non-blocking)
    const newBalance = Math.max(0, feeRecord.balanceDue - sub.amountSubmitted);
    emailService
      .sendFeePayment(
        data.studentEmail,
        {
          studentName: data.studentName,
          rollNumber: sub.rollNumber,
          program: sub.program,
          branch: sub.branch,
          semester: sub.semester,
          academicYear: sub.academicYear,
          receiptNumber,
          amount: sub.amountSubmitted.toLocaleString("en-IN"),
          paymentMode: sub.paymentMode,
          transactionId,
          paymentDate: formatIndiaDate(sub.paymentDate),
          pendingAmount: newBalance > 0 ? newBalance.toLocaleString("en-IN") : undefined,
          dueDate: formatIndiaDate(feeRecord.dueDate),
        },
        undefined,
      )
      .catch((error: unknown) => {
        logger.warn("[payment-submission] Receipt upload or email delivery failed", {
          error,
          submissionId: String(sub._id),
          studentId: String(sub.studentId),
          receiptNumber,
        });
        return undefined;
      });

    pushNotification(sub.studentId.toString(), {
      type: "payment",
      title: "Fee Payment Verified ✓",
      body: `Your payment of ₹${sub.amountSubmitted.toLocaleString("en-IN")} has been verified. Receipt: ${receiptNumber}`,
      actionUrl: "/fee",
    });

    return {
      submission: updatedSub,
      receiptNumber,
      transactionId,
      receiptStatus: receiptResult.status,
    };
  },

  generateOfficialReceipt: async (
    submissionId: string,
    collectedByName: string,
    receiptFile?: UploadedFile,
  ) => {
    const sub = await paymentSubmissionRepository.claimReceiptGeneration(submissionId);
    if (!sub) {
      const existing = await paymentSubmissionRepository.findById(submissionId);
      if (!existing) throw createError(404, "Submission not found");
      if (existing.officialReceiptUrl) return { submission: existing, status: "ready" as const };
      if (existing.receiptGenerationStatus === "processing") {
        throw createError(409, "Receipt generation is already in progress");
      }
      throw createError(409, "Only an approved payment can generate a receipt");
    }

    try {
      const feeRecord = await feeRepository.findRecordById(sub.feeRecordId.toString());
      if (!feeRecord) throw new Error("Fee record not found");
      const transaction = feeRecord.transactions.find(
        (item) => item.transactionId === sub.feeTransactionId,
      );
      if (!transaction) throw new Error("Approved fee transaction not found");

      let file = receiptFile;
      if (!file) {
        const pdf = await pdfService.generateFeeReceipt({
          receiptNumber: transaction.receiptNumber,
          studentName: sub.studentName,
          fatherName: "",
          rollNumber: sub.rollNumber,
          program: sub.program,
          branch: sub.branch,
          semester: sub.semester,
          academicYear: sub.academicYear,
          feeItems: feeRecord.feeItems.map((item) => ({
            description: item.type,
            amount: item.netAmount,
          })),
          totalAmount: sub.amountSubmitted,
          paymentMode: sub.paymentMode,
          transactionId: transaction.transactionId,
          paymentDate: formatIndiaDate(sub.paymentDate),
          collectedBy: collectedByName,
        });
        if (!pdf) throw new Error("Receipt PDF generation returned no document");
        file = {
          name: `receipt-${transaction.receiptNumber}.pdf`,
          mimetype: "application/pdf",
          data: pdf,
          size: pdf.length,
          encoding: "7bit",
          tempFilePath: "",
          truncated: false,
          md5: "",
          mv: async () => {},
        } as unknown as UploadedFile;
      }

      const uploaded = await uploadUtil.uploadDocument(file, "erp/official-receipts", {
        publicId: `payment-${submissionId}-receipt`,
      });
      const updated = await paymentSubmissionRepository.updateById(submissionId, {
        officialReceiptUrl: uploaded.url,
        officialReceiptPublicId: uploaded.publicId,
        receiptGenerationStatus: "ready",
        receiptGenerationError: undefined,
      });
      return { submission: updated, status: "ready" as const };
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 500) : "Receipt generation failed";
      const updated = await paymentSubmissionRepository.updateById(submissionId, {
        receiptGenerationStatus: "failed",
        receiptGenerationError: message,
      });
      return { submission: updated, status: "failed" as const };
    }
  },

  /**
   * Reject a payment submission.
   * Student will be asked to resubmit.
   */
  reject: async (
    submissionId: string,
    reviewedBy: string,
    reason: string,
    requireResubmit = true,
  ) => {
    const sub = await paymentSubmissionRepository.findById(submissionId);
    if (!sub) throw createError(404, "Submission not found");
    if (sub.status !== SubmissionStatus.PENDING && sub.status !== SubmissionStatus.UNDER_REVIEW)
      throw createError(400, "Submission cannot be rejected in its current state");

    const newStatus = requireResubmit ? SubmissionStatus.RESUBMIT : SubmissionStatus.REJECTED;
    const updated = await paymentSubmissionRepository.updateById(submissionId, {
      status: newStatus,
      reviewedBy,
      reviewedAt: new Date(),
      reviewRemarks: reason,
      activeKey: undefined,
    });

    // Notify student
    pushNotification(sub.studentId.toString(), {
      type: "payment",
      title: "Payment Verification: Action Required",
      body: requireResubmit
        ? `Your payment proof was not accepted. Reason: ${reason}. Please resubmit.`
        : `Your payment submission was rejected. Reason: ${reason}. Contact Accounts office.`,
      actionUrl: "/fee",
    });

    return updated;
  },

  /** Dashboard counts for Accounts portal. */
  getCounts: () => paymentSubmissionRepository.countByStatus(),
};

import createError from "http-errors";
import { v4 as uuidv4 } from "uuid";
import {
  departmentRepository,
  feeRepository,
  studentProfileRepository,
  studentSectionAllotmentRepository,
} from "../repositories";
import { emailService, EmailTemplate } from "../email/email.service";
import { pdfService } from "../pdf/pdf.service";
import { type FeePaymentMode, FeePaymentStatus } from "../models";
import { redisUtil } from "../utils/redis.util";
import { logger } from "../utils/logger.util";
import { notifyUsers } from "./helpers/notify.helper";
import { NotificationType } from "../models/notification.model";
import { nextSeq } from "../models/counter.model";
import mongoose from "mongoose";
import { generalLedgerService } from "./general-ledger.service";
import { InstitutionSettingModel } from "../models/institution-setting.model";
import { formatIndiaDate } from "../utils/date.util";

const FEE_STRUCT_TTL = 600; // 10 min — fee structures almost never change mid-year

// ─── Invoice number generator ─────────────────────────────────────────────────

const genInvoiceNo = async (academicYear: string) => {
  const seq = await nextSeq(`fee-invoice:${academicYear}`);
  const settings = await InstitutionSettingModel.findOne().select("invoicePrefix shortCode").lean();
  const prefix = settings?.invoicePrefix || `${settings?.shortCode || "ERP"}-INV`;
  return `${prefix}-${academicYear.replace("-", "")}-${String(seq).padStart(5, "0")}`;
};
const genReceiptNo = async (academicYear: string) => {
  const seq = await nextSeq(`fee-receipt:${academicYear}`);
  const settings = await InstitutionSettingModel.findOne().select("receiptPrefix shortCode").lean();
  const prefix = settings?.receiptPrefix || `${settings?.shortCode || "ERP"}-RCP`;
  return `${prefix}-${academicYear.replace("-", "")}-${String(seq).padStart(5, "0")}`;
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const feeService = {
  // ─── Fee Structure ───────────────────────────────────────────────────────

  createStructure: async (data: Record<string, unknown>, createdBy: string) => {
    const existing = await feeRepository.findStructureByAcademicRefs({
      program: data["program"] as string,
      branch: data["branch"] as string,
      curriculumId: data["curriculumId"] as string | undefined,
      departmentId: data["departmentId"] as string | undefined,
      batchId: data["batchId"] as string | undefined,
      semester: Number(data["semester"]),
      academicYear: data["academicYear"] as string,
      category: (data["category"] as string) || "General",
    });
    if (existing) throw createError(409, "Fee structure for this combination already exists");
    const items = data["feeItems"] as Array<{ type: string; description?: string; amount: number }>;
    const totalAmount = items.reduce((sum, i) => sum + (i.amount || 0), 0);
    const result = await feeRepository.createStructure({ ...data, totalAmount, createdBy });
    await redisUtil.delPattern(`fee:struct:*`);
    return result;
  },

  getStructures: (filter: Record<string, unknown>) => {
    const cacheKey = `fee:struct:list:${JSON.stringify(filter)}`;
    return redisUtil.remember(cacheKey, FEE_STRUCT_TTL, () => feeRepository.listStructures(filter));
  },

  getStructure: async (
    program: string,
    branch: string,
    semester: number,
    academicYear: string,
    category?: string,
  ) => {
    const cacheKey = `fee:struct:${program}:${branch}:${semester}:${academicYear}:${category ?? "General"}`;
    return redisUtil.remember(cacheKey, FEE_STRUCT_TTL, async () => {
      const s = await feeRepository.findStructure(
        program,
        branch,
        semester,
        academicYear,
        category,
      );
      if (!s) throw createError(404, "Fee structure not found for this combination");
      return s;
    });
  },

  previewInvoice: async (data: {
    studentId: string;
    program?: string;
    branch?: string;
    semester: number;
    academicYear: string;
    category?: string;
    scholarships?: Array<{ type: string; body?: string; amount: number; reference?: string }>;
  }) => {
    if (data.scholarships?.length)
      throw createError(
        400,
        "Scholarship deductions must come from the governed scholarship workflow",
      );
    const profile = await studentProfileRepository.findByUserId(data.studentId);
    const allotment = await studentSectionAllotmentRepository.findActiveForStudentSemester(
      data.studentId,
      data.academicYear,
      data.semester,
    );
    const departmentId = allotment?.departmentId?.toString() || profile?.department?.toString();
    const department = departmentId ? await departmentRepository.findById(departmentId) : null;
    const program = data.program || profile?.program || "";
    const branch = data.branch || department?.code || "";

    const existingInvoice = await feeRepository.findByStudentSemester(
      data.studentId,
      data.semester,
      data.academicYear,
    );

    const structure = await feeRepository.findStructureByAcademicRefs({
      program,
      branch,
      curriculumId: allotment?.curriculumId?.toString(),
      departmentId: (allotment?.departmentId || profile?.department)?.toString(),
      batchId: allotment?.batchId?.toString(),
      semester: data.semester,
      academicYear: data.academicYear,
      category: data.category || "General",
    });
    if (!structure) {
      throw createError(
        404,
        "No active fee structure matches this student, semester, academic year and category.",
      );
    }

    const scholarshipTotal = (data.scholarships || []).reduce(
      (sum, sc) => sum + Number(sc.amount || 0),
      0,
    );
    const grossAmount = structure.totalAmount;
    const netDue = Math.max(0, grossAmount - scholarshipTotal);

    return {
      studentContext: {
        program,
        branch,
        semester: data.semester,
        academicYear: data.academicYear,
        category: data.category || "General",
        curriculumId: allotment?.curriculumId?.toString(),
        departmentId: (allotment?.departmentId || profile?.department)?.toString(),
        batchId: allotment?.batchId?.toString(),
      },
      structure: {
        _id: structure._id,
        program: structure.program,
        branch: structure.branch,
        semester: structure.semester,
        academicYear: structure.academicYear,
        category: structure.category,
        totalAmount: structure.totalAmount,
        feeItems: structure.feeItems,
      },
      scholarshipTotal,
      grossAmount,
      netDue,
      existingInvoice: existingInvoice
        ? {
            _id: existingInvoice._id,
            invoiceNumber: existingInvoice.invoiceNumber,
            status: existingInvoice.status,
          }
        : null,
    };
  },

  // ─── Generate Invoice (demand letter) ────────────────────────────────────

  generateInvoice: async (data: {
    studentId: string;
    studentProfileId?: string;
    rollNumber?: string;
    studentName?: string;
    fatherName?: string;
    studentEmail?: string;
    program?: string;
    branch?: string;
    semester: number;
    academicYear: string;
    category?: string;
    scholarships?: Array<{ type: string; body: string; amount: number; reference: string }>;
    dueDate: string;
    createdBy: string;
  }) => {
    if (data.scholarships?.length)
      throw createError(
        400,
        "Scholarship deductions must come from the governed scholarship workflow",
      );
    const profile = await studentProfileRepository.findByUserId(data.studentId);
    const allotment = await studentSectionAllotmentRepository.findActiveForStudentSemester(
      data.studentId,
      data.academicYear,
      data.semester,
    );
    const departmentId = allotment?.departmentId?.toString() || profile?.department?.toString();
    const department = departmentId ? await departmentRepository.findById(departmentId) : null;
    const program = data.program || profile?.program || "";
    const branch = data.branch || department?.code || "";
    const rollNumber = data.rollNumber || profile?.rollNumber || "";
    const studentName =
      data.studentName || [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");
    const fatherName = data.fatherName || profile?.parentInfo?.fatherName || "";

    // Check not already invoiced
    const exists = await feeRepository.findByStudentSemester(
      data.studentId,
      data.semester,
      data.academicYear,
    );
    if (exists)
      throw createError(
        409,
        `Fee invoice already generated for Sem ${data.semester} ${data.academicYear}`,
      );

    // Fetch fee structure
    const structure = await feeRepository.findStructureByAcademicRefs({
      program,
      branch,
      curriculumId: allotment?.curriculumId?.toString(),
      departmentId: (allotment?.departmentId || profile?.department)?.toString(),
      batchId: allotment?.batchId?.toString(),
      semester: data.semester,
      academicYear: data.academicYear,
      category: data.category || "General",
    });
    if (!structure)
      throw createError(
        404,
        "Fee structure not configured for this programme. Please contact Accounts.",
      );

    const scholarshipTotal = (data.scholarships || []).reduce((s, sc) => s + sc.amount, 0);
    const grossAmount = structure.totalAmount;
    const netDue = Math.max(0, grossAmount - scholarshipTotal);
    const invoiceNumber = await genInvoiceNo(data.academicYear);

    const feeItems = structure.feeItems.map((fi) => ({
      type: fi.type,
      description: fi.description,
      amount: fi.amount,
      concession: 0,
      scholarship: 0,
      netAmount: fi.amount,
    }));

    const record = await feeRepository.createRecord({
      studentId: data.studentId,
      studentProfileId: data.studentProfileId || profile?._id,
      batchId: allotment?.batchId,
      sectionId: allotment?.sectionId,
      curriculumId: allotment?.curriculumId,
      departmentId: allotment?.departmentId || profile?.department,
      rollNumber,
      studentName,
      program,
      branch,
      semester: data.semester,
      academicYear: data.academicYear,
      invoiceNumber,
      dueDate: new Date(data.dueDate),
      feeItems,
      grossAmount,
      totalConcession: 0,
      totalScholarship: scholarshipTotal,
      netDue,
      totalPaid: 0,
      balanceDue: netDue,
      scholarships: data.scholarships || [],
      status: FeePaymentStatus.PENDING,
      createdBy: data.createdBy,
    });

    // Generate PDF invoice
    const invoicePdf = await pdfService
      .generateFeeInvoice({
        invoiceNumber,
        studentName,
        fatherName,
        rollNumber,
        program,
        branch,
        semester: data.semester,
        academicYear: data.academicYear,
        feeItems: structure.feeItems,
        totalDue: grossAmount,
        dueDate: data.dueDate,
        scholarshipDeduction: scholarshipTotal || undefined,
        balanceDue: netDue,
      })
      .catch((error: unknown) => {
        logger.warn("[fee] Invoice PDF generation failed", {
          error,
          invoiceNumber,
          studentId: String(data.studentId),
        });
        return undefined;
      });

    void notifyUsers([data.studentId], {
      title: `Fee invoice generated — Sem ${data.semester}`,
      body: `Your fee invoice ${invoiceNumber} of ₹${netDue.toLocaleString("en-IN")} is due by ${formatIndiaDate(data.dueDate)}.`,
      type: NotificationType.FEE_REMINDER,
      actionUrl: "/fee",
      withEmail: true,
      emailTemplate: EmailTemplate.GENERAL_NOTIFICATION,
    });

    return { record, invoicePdf };
  },

  // ─── Record Payment ───────────────────────────────────────────────────────

  recordPayment: async (data: {
    feeRecordId: string;
    amountPaid: number;
    paymentMode: FeePaymentMode;
    paymentDate: string;
    bankRef?: string;
    chequeNumber?: string;
    ddNumber?: string;
    upiId?: string;
    collectedBy: string;
    collectedByName: string;
    remarks?: string;
    studentEmail: string;
    studentName: string;
    fatherName: string;
  }) => {
    const record = await feeRepository.findRecordById(data.feeRecordId);
    if (!record) throw createError(404, "Fee record not found");
    if (record.status === FeePaymentStatus.PAID)
      throw createError(400, "This fee invoice is already fully paid");

    if (data.amountPaid <= 0 || data.amountPaid > record.balanceDue) {
      throw createError(400, `Invalid amount. Balance due is ₹ ${record.balanceDue}`);
    }

    const receiptNumber = await genReceiptNo(record.academicYear);
    const transactionId = `TXN-${uuidv4().split("-")[0].toUpperCase()}`;
    const paymentDateObj = new Date(data.paymentDate);

    const transaction = {
      transactionId,
      receiptNumber,
      amountPaid: data.amountPaid,
      paymentMode: data.paymentMode,
      paymentDate: paymentDateObj,
      bankRef: data.bankRef,
      chequeNumber: data.chequeNumber,
      ddNumber: data.ddNumber,
      upiId: data.upiId,
      collectedBy: data.collectedBy,
      collectedByName: data.collectedByName,
      remarks: data.remarks,
    };

    const session = await mongoose.startSession();
    let updated: Awaited<ReturnType<typeof feeRepository.addTransaction>> = null;
    try {
      await session.withTransaction(async () => {
        updated = await feeRepository.addTransaction(data.feeRecordId, transaction, {
          expectedBalanceDue: record.balanceDue,
          session,
        });
        if (!updated) {
          throw createError(
            409,
            "The fee balance changed while this payment was being recorded. Refresh and try again.",
          );
        }
        await generalLedgerService.postFeeCollection(
          {
            feeRecordId: record._id,
            transactionId,
            receiptNumber,
            amount: data.amountPaid,
            paymentMode: data.paymentMode,
            paymentDate: paymentDateObj,
            financialYear: record.academicYear,
            studentId: record.studentId,
            postedBy: data.collectedBy,
          },
          session,
        );
      });
    } finally {
      await session.endSession();
    }
    if (!updated) throw createError(500, "Fee payment transaction did not complete");

    // Generate PDF receipt
    const receiptPdf = await pdfService
      .generateFeeReceipt({
        receiptNumber,
        studentName: data.studentName,
        fatherName: data.fatherName,
        rollNumber: record.rollNumber,
        program: record.program,
        branch: record.branch,
        semester: record.semester,
        academicYear: record.academicYear,
        feeItems: record.feeItems.map((fi) => ({
          description: fi.type + (fi.description ? ` — ${fi.description}` : ""),
          amount: fi.netAmount,
        })),
        totalAmount: data.amountPaid,
        paymentMode: data.paymentMode,
        transactionId,
        paymentDate: formatIndiaDate(paymentDateObj),
        collectedBy: data.collectedByName,
      })
      .catch((error: unknown) => {
        logger.warn("[fee] Receipt PDF generation failed", {
          error,
          invoiceNumber: record.invoiceNumber,
          transactionId,
        });
        return undefined;
      });

    const newBalance = Math.max(0, record.balanceDue - data.amountPaid);

    // Send confirmation email
    void emailService.sendFeePayment(
      data.studentEmail,
      {
        studentName: data.studentName,
        rollNumber: record.rollNumber,
        program: record.program,
        branch: record.branch,
        semester: record.semester,
        academicYear: record.academicYear,
        receiptNumber,
        amount: data.amountPaid.toLocaleString("en-IN"),
        paymentMode: data.paymentMode,
        transactionId,
        paymentDate: formatIndiaDate(paymentDateObj),
        pendingAmount: newBalance > 0 ? newBalance.toLocaleString("en-IN") : undefined,
        dueDate: formatIndiaDate(record.dueDate),
      },
      receiptPdf,
    );

    void notifyUsers([record.studentId as unknown as string], {
      title: "Fee payment received",
      body: `₹${data.amountPaid.toLocaleString("en-IN")} received via ${data.paymentMode}. Receipt: ${receiptNumber}.${newBalance > 0 ? ` Balance due: ₹${newBalance.toLocaleString("en-IN")}.` : " Invoice fully paid."}`,
      type: NotificationType.SUCCESS,
      actionUrl: "/fee",
    });

    return { updated, receiptNumber, transactionId, receiptPdf };
  },

  // ─── Queries ──────────────────────────────────────────────────────────────

  getRecordById: async (id: string) => {
    const rec = await feeRepository.findRecordById(id);
    if (!rec) throw createError(404, "Fee record not found");
    return rec;
  },

  getByStudent: (studentId: string) => feeRepository.findByStudent(studentId),

  listRecords: (filter: Record<string, unknown>, page = 1, limit = 20) =>
    feeRepository.paginate(filter, page, limit),

  getCollectionSummary: (academicYear: string) => feeRepository.getCollectionSummary(academicYear),

  getOverdueFees: () => feeRepository.getOverdueFees(),

  // ─── Bonafide / Certificate generation ───────────────────────────────────

  generateBonafide: async (
    data: {
      studentName: string;
      fatherName: string;
      rollNumber: string;
      program: string;
      branch: string;
      semester: number;
      academicYear: string;
      dateOfAdmission: string;
      purpose: string;
      issuedBy: string;
      designation: string;
      issuedDate: string;
    },
    certSeq: number,
  ) => {
    const certificateNumber = `BON-${new Date().getFullYear()}-${String(certSeq).padStart(4, "0")}`;
    return pdfService.generateBonafide({ ...data, certificateNumber });
  },

  generateTC: async (
    data: {
      studentName: string;
      fatherName: string;
      motherName: string;
      rollNumber: string;
      enrollmentNumber: string;
      program: string;
      branch: string;
      dateOfAdmission: string;
      dateOfLeaving: string;
      semesterCompleted: number;
      cgpa: number;
      conductCharacter: string;
      reasonForLeaving: string;
      issuedBy: string;
      issuedDate: string;
    },
    tcSeq: number,
  ) => {
    const tcNumber = `TC-${new Date().getFullYear()}-${String(tcSeq).padStart(4, "0")}`;
    return pdfService.generateTransferCertificate({ ...data, tcNumber });
  },
};

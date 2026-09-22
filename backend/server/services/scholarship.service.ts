import createError from "http-errors";
import { Types } from "mongoose";
import { scholarshipRepository } from "../repositories";
import { ScholarshipModel, ScholarshipSchemeModel } from "../models/scholarship.model";
import { StudentProfileModel, StudentStatus } from "../models/student-profile.model";
import { FeePaymentStatus, FeeRecordModel, ScholarshipType } from "../models/fee.model";
import { generalLedgerService } from "./general-ledger.service";
import { DocumentModel, DocumentStatus } from "../models/document.model";

type EligibilityInput = {
  currentCgpa?: number;
  familyIncome?: number;
  backlogs: number;
};

type EligibilityRules = {
  minCgpa?: number;
  maxFamilyIncome?: number;
  maxBacklogs: number;
};

export function evaluateScholarshipEligibility(input: EligibilityInput, rules: EligibilityRules) {
  const reasons: string[] = [];
  if (rules.minCgpa !== undefined && (input.currentCgpa ?? -1) < rules.minCgpa)
    reasons.push(`CGPA must be at least ${rules.minCgpa}`);
  if (
    rules.maxFamilyIncome !== undefined &&
    (input.familyIncome === undefined || input.familyIncome > rules.maxFamilyIncome)
  )
    reasons.push(`Verified family income must not exceed ${rules.maxFamilyIncome}`);
  if (input.backlogs > rules.maxBacklogs)
    reasons.push(`Active backlogs must not exceed ${rules.maxBacklogs}`);
  return { eligible: reasons.length === 0, reasons };
}

export function allocateScholarshipFeeCredit(
  invoices: Array<{ id: string; balanceDue: number }>,
  amount: number,
) {
  if (!Number.isFinite(amount) || amount <= 0)
    throw createError(400, "Scholarship credit must be greater than zero");
  const outstanding = invoices.reduce((sum, invoice) => sum + Math.max(0, invoice.balanceDue), 0);
  if (outstanding < amount)
    throw createError(409, "Approved fee credit exceeds the student's outstanding fees");
  let remaining = amount;
  return invoices.flatMap((invoice) => {
    if (!remaining || invoice.balanceDue <= 0) return [];
    const credit = Math.min(remaining, invoice.balanceDue);
    remaining -= credit;
    return [{ id: invoice.id, credit }];
  });
}

function validateSchemeInput(data: Record<string, unknown>) {
  const applicationStart = new Date(String(data.applicationStart ?? ""));
  const applicationEnd = new Date(String(data.applicationEnd ?? ""));
  if (!Number.isFinite(applicationStart.getTime()) || !Number.isFinite(applicationEnd.getTime()))
    throw createError(400, "Valid application dates are required");
  if (applicationEnd < applicationStart)
    throw createError(400, "Application end must follow its start date");
  const budgetAmount = Number(data.budgetAmount);
  const maxAwardAmount = Number(data.maxAwardAmount);
  if (!Number.isFinite(budgetAmount) || budgetAmount <= 0)
    throw createError(400, "Scheme budget must be greater than zero");
  if (!Number.isFinite(maxAwardAmount) || maxAwardAmount <= 0 || maxAwardAmount > budgetAmount)
    throw createError(400, "Maximum award must be within the scheme budget");
  return {
    ...data,
    applicationStart,
    applicationEnd,
    budgetAmount,
    maxAwardAmount,
    reservedAmount: 0,
    disbursedAmount: 0,
    maxBacklogs: Math.max(0, Number(data.maxBacklogs ?? 0)),
    requiredDocumentTypes: Array.isArray(data.requiredDocumentTypes)
      ? [
          ...new Set(
            data.requiredDocumentTypes
              .map(String)
              .map((value) => value.trim())
              .filter(Boolean),
          ),
        ]
      : [],
    isActive: true,
  };
}

export const scholarshipService = {
  getAll: (filter: Record<string, unknown>, page: number, limit: number) =>
    scholarshipRepository.list(filter, page, limit),

  getById: (id: string) => scholarshipRepository.findById(id),

  listSchemes: (filter: Record<string, unknown>) => scholarshipRepository.listSchemes(filter),

  createScheme: (data: Record<string, unknown>, createdBy: string) =>
    scholarshipRepository.createScheme({ ...validateSchemeInput(data), createdBy }),

  apply: async (data: Record<string, unknown>, studentId: string) => {
    const schemeId = String(data.schemeId ?? "");
    if (!Types.ObjectId.isValid(schemeId))
      throw createError(400, "Valid scholarship scheme required");
    const [scheme, profile] = await Promise.all([
      scholarshipRepository.findSchemeById(schemeId),
      StudentProfileModel.findOne({ userId: studentId, status: StudentStatus.ACTIVE }).lean(),
    ]);
    if (!scheme?.isActive) throw createError(404, "Active scholarship scheme not found");
    if (!profile) throw createError(403, "An active student profile is required");
    if (profile.academicYear !== scheme.academicYear)
      throw createError(400, "Scheme is not available for the student's academic year");
    const now = new Date();
    if (now < scheme.applicationStart || now > scheme.applicationEnd)
      throw createError(409, "Scholarship application window is closed");
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > scheme.maxAwardAmount)
      throw createError(400, "Requested amount exceeds the scheme limit");
    const documents = Array.isArray(data.documents)
      ? data.documents.map((document) => document as { docType?: unknown; fileUrl?: unknown })
      : [];
    const normalizedDocuments = documents.map((document) => ({
      docType: String(document.docType ?? "").trim(),
      fileUrl: String(document.fileUrl ?? "").trim(),
      uploadedAt: now,
    }));
    if (
      normalizedDocuments.some(
        (document) => !document.docType || !/^https?:\/\//.test(document.fileUrl),
      )
    )
      throw createError(400, "Every supporting document requires a type and valid URL");
    const suppliedTypes = new Set(normalizedDocuments.map((document) => document.docType));
    const missingDocuments = scheme.requiredDocumentTypes.filter(
      (documentType) => !suppliedTypes.has(documentType),
    );
    if (missingDocuments.length)
      throw createError(400, `Required documents missing: ${missingDocuments.join(", ")}`);
    const ownedDocuments = await DocumentModel.countDocuments({
      owner: studentId,
      ownerModel: "User",
      url: { $in: [...new Set(normalizedDocuments.map((document) => document.fileUrl))] },
      status: { $nin: [DocumentStatus.REJECTED, DocumentStatus.EXPIRED] },
      isExpired: false,
    });
    if (ownedDocuments !== new Set(normalizedDocuments.map((document) => document.fileUrl)).size)
      throw createError(403, "Supporting documents must belong to the applicant");
    return scholarshipRepository.create({
      schemeId: scheme._id,
      scholarshipName: scheme.name,
      scholarshipType: scheme.scholarshipType,
      awardingBody: scheme.awardingBody,
      academicYear: scheme.academicYear,
      benefitMode: scheme.benefitMode,
      appliedDate: now,
      amount,
      documents: normalizedDocuments,
      studentId,
      status: "applied",
      createdBy: studentId,
    });
  },

  review: async (id: string, verifiedBy: string, remarks?: string) => {
    const scholarship = await ScholarshipModel.findById(id).lean();
    if (!scholarship) throw createError(404, "Scholarship not found");
    const [scheme, profile] = await Promise.all([
      ScholarshipSchemeModel.findById(scholarship.schemeId).lean(),
      StudentProfileModel.findOne({ userId: scholarship.studentId }).lean(),
    ]);
    if (!scheme || !profile) throw createError(409, "Scheme or student profile is unavailable");
    const suppliedTypes = new Set(scholarship.documents.map((document) => document.docType));
    const missing = scheme.requiredDocumentTypes.filter((type) => !suppliedTypes.has(type));
    if (missing.length) throw createError(409, `Required documents missing: ${missing.join(", ")}`);
    const verifiedDocuments = await DocumentModel.countDocuments({
      owner: scholarship.studentId,
      url: { $in: scholarship.documents.map((document) => document.fileUrl) },
      status: DocumentStatus.VERIFIED,
      isExpired: false,
    });
    if (
      verifiedDocuments !== new Set(scholarship.documents.map((document) => document.fileUrl)).size
    )
      throw createError(409, "Every supporting document must be independently verified");
    const input = {
      currentCgpa: profile.currentCgpa,
      familyIncome: profile.parentInfo?.annualFamilyIncome,
      backlogs: profile.totalBacklogs,
    };
    const eligibility = evaluateScholarshipEligibility(input, scheme);
    if (!eligibility.eligible) throw createError(409, eligibility.reasons.join("; "));
    const updated = await scholarshipRepository.markReviewed(
      id,
      verifiedBy,
      {
        familyIncome: input.familyIncome,
        cgpa: input.currentCgpa,
        backlogs: input.backlogs,
        evaluatedAt: new Date(),
      },
      remarks,
    );
    if (!updated) throw createError(409, "Application is no longer awaiting review");
    return updated;
  },

  approve: async (id: string, approvedBy: string, amount?: number, remarks?: string) => {
    const scholarship = await ScholarshipModel.findById(id).lean();
    if (!scholarship) throw createError(404, "Scholarship not found");
    if (scholarship.status !== "under_review" || !scholarship.verifiedBy)
      throw createError(409, "Only a verified application can be approved");
    if (String(scholarship.verifiedBy) === approvedBy)
      throw createError(409, "Reviewer and approver must be different users");
    const approvedAmount = amount ?? scholarship.amount;
    if (
      !Number.isFinite(approvedAmount) ||
      approvedAmount <= 0 ||
      approvedAmount > scholarship.amount
    )
      throw createError(400, "Approved amount must be within the requested amount");
    const session = await ScholarshipModel.db.startSession();
    let updated;
    try {
      await session.withTransaction(async () => {
        const scheme = await ScholarshipSchemeModel.findOneAndUpdate(
          {
            _id: scholarship.schemeId,
            isActive: true,
            $expr: { $lte: [{ $add: ["$reservedAmount", approvedAmount] }, "$budgetAmount"] },
          },
          { $inc: { reservedAmount: approvedAmount } },
          { returnDocument: "after", session },
        );
        if (!scheme) throw createError(409, "Insufficient unreserved scholarship budget");
        updated = await ScholarshipModel.findOneAndUpdate(
          { _id: id, status: "under_review", verifiedBy: { $ne: approvedBy } },
          {
            $set: {
              status: "approved",
              approvedAmount,
              approvedBy,
              approvedAt: new Date(),
              remarks,
            },
          },
          { returnDocument: "after", session },
        ).lean();
        if (!updated) throw createError(409, "Application changed while approval was recorded");
      });
    } finally {
      await session.endSession();
    }
    return updated;
  },

  reject: async (id: string, rejectedBy: string, remarks: string) => {
    const reason = String(remarks ?? "").trim();
    if (reason.length < 3 || reason.length > 2000)
      throw createError(400, "A valid rejection reason is required");
    const updated = await scholarshipRepository.reject(id, rejectedBy, reason);
    if (!updated) throw createError(409, "Scholarship is no longer awaiting review");
    return updated;
  },

  disburse: async (id: string, disbursedBy: string, referenceNo: string) => {
    const scholarship = await ScholarshipModel.findById(id).lean();
    if (!scholarship) throw createError(404, "Scholarship not found");
    if (scholarship.status !== "approved" || !scholarship.approvedAmount)
      throw createError(409, "Only an approved scholarship can be disbursed");
    if (String(scholarship.approvedBy) === disbursedBy)
      throw createError(409, "Approver and disbursement officer must be different users");
    const reference = String(referenceNo ?? "").trim();
    if (reference.length < 3 || reference.length > 200)
      throw createError(400, "A valid disbursement reference is required");
    const amount = scholarship.approvedAmount;
    const session = await ScholarshipModel.db.startSession();
    let updated;
    try {
      await session.withTransaction(async () => {
        if (scholarship.benefitMode === "fee_credit") {
          const invoices = await FeeRecordModel.find({
            studentId: scholarship.studentId,
            academicYear: scholarship.academicYear,
            balanceDue: { $gt: 0 },
          })
            .sort({ dueDate: 1 })
            .session(session);
          const allocations = allocateScholarshipFeeCredit(
            invoices.map((invoice) => ({
              id: String(invoice._id),
              balanceDue: invoice.balanceDue,
            })),
            amount,
          );
          for (const allocation of allocations) {
            const invoice = invoices.find((item) => String(item._id) === allocation.id);
            if (!invoice) throw createError(409, "Fee invoice changed during scholarship credit");
            const credit = allocation.credit;
            invoice.totalScholarship += credit;
            invoice.netDue = Math.max(0, invoice.netDue - credit);
            invoice.balanceDue = Math.max(0, invoice.balanceDue - credit);
            invoice.scholarships.push({
              type: ScholarshipType.OTHER,
              body: scholarship.awardingBody,
              amount: credit,
              reference,
            });
            invoice.status =
              invoice.balanceDue === 0
                ? invoice.totalPaid > 0
                  ? FeePaymentStatus.PAID
                  : FeePaymentStatus.WAIVED
                : invoice.totalPaid > 0
                  ? FeePaymentStatus.PARTIAL
                  : new Date() > invoice.dueDate
                    ? FeePaymentStatus.OVERDUE
                    : FeePaymentStatus.PENDING;
            invoice.updatedBy = new Types.ObjectId(disbursedBy);
            await invoice.save({ session });
          }
        } else {
          const paymentDate = new Date();
          const year = paymentDate.getFullYear();
          const startYear = paymentDate.getMonth() >= 3 ? year : year - 1;
          await generalLedgerService.postScholarshipPayment(
            {
              scholarshipId: scholarship._id,
              studentId: scholarship.studentId,
              scholarshipName: scholarship.scholarshipName,
              amount,
              referenceNo: reference,
              paymentDate,
              financialYear: `${startYear}-${String(startYear + 1).slice(-2)}`,
              postedBy: disbursedBy,
            },
            session,
          );
        }
        const scheme = await ScholarshipSchemeModel.findOneAndUpdate(
          { _id: scholarship.schemeId, reservedAmount: { $gte: amount } },
          { $inc: { reservedAmount: -amount, disbursedAmount: amount } },
          { returnDocument: "after", session },
        );
        if (!scheme) throw createError(409, "Reserved scheme budget is inconsistent");
        updated = await ScholarshipModel.findOneAndUpdate(
          { _id: id, status: "approved", approvedBy: { $ne: disbursedBy } },
          {
            $set: {
              status: "disbursed",
              disbursedBy,
              disbursedAmount: amount,
              disbursedDate: new Date(),
              referenceNo: reference,
            },
          },
          { returnDocument: "after", session },
        ).lean();
        if (!updated) throw createError(409, "Scholarship changed during disbursement");
      });
    } finally {
      await session.endSession();
    }
    return updated;
  },

  getSummary: (academicYear: string) => scholarshipRepository.countByStatus(academicYear),
};

import { randomUUID } from "crypto";
import createError from "http-errors";
import { Types } from "mongoose";
import { FeePaymentStatus, FeeRecordModel, ScholarshipType } from "../models/fee.model";
import {
  FinancialAidFundModel,
  FinancialAidPackageModel,
  type TFinancialAidType,
} from "../models/financial-aid.model";
import { ScholarshipModel } from "../models/scholarship.model";
import { StudentProfileModel } from "../models/student-profile.model";
import { generalLedgerService } from "./general-ledger.service";
import { allocateScholarshipFeeCredit } from "./scholarship.service";
import { notifyUsers } from "./helpers/notify.helper";
import { NotificationType } from "../models/notification.model";

interface IPackageInput {
  studentProfileId: string;
  academicYear: string;
  studentContribution: number;
  indirectCost?: number;
  notes?: string;
  items: Array<{ fundId: string; amount: number }>;
}

const safeAmount = (value: unknown, label: string) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0)
    throw createError(400, `${label} must be zero or greater`);
  return Math.round(amount * 100) / 100;
};

export const financialAidService = {
  listFunds: (academicYear?: string) =>
    FinancialAidFundModel.find({ ...(academicYear ? { academicYear } : {}) })
      .sort({ academicYear: -1, code: 1 })
      .lean(),

  createFund: async (actorId: string, input: Record<string, unknown>) => {
    const budgetAmount = safeAmount(input.budgetAmount, "Budget");
    const maxPerStudent = safeAmount(input.maxPerStudent, "Maximum award");
    if (!budgetAmount || !maxPerStudent || maxPerStudent > budgetAmount)
      throw createError(400, "Maximum award must be positive and within the fund budget");
    return FinancialAidFundModel.create({
      code: String(input.code).trim().toUpperCase(),
      name: String(input.name).trim(),
      type: input.type as TFinancialAidType,
      source: input.source as "government" | "institutional" | "private" | "bank",
      academicYear: String(input.academicYear).trim(),
      disbursementMode: input.disbursementMode as "fee_credit" | "bank_transfer",
      budgetAmount,
      maxPerStudent,
      isNeedBased: input.isNeedBased !== false,
      createdBy: actorId,
    });
  },

  calculateNeed: async (
    studentProfileId: string,
    academicYear: string,
    contribution: number,
    indirectCost = 0,
  ) => {
    const profile = await StudentProfileModel.findById(studentProfileId)
      .select("userId department")
      .lean();
    if (!profile) throw createError(404, "Student profile not found");
    const [fees, existingAwards] = await Promise.all([
      FeeRecordModel.find({ studentId: profile.userId, academicYear }).select("grossAmount").lean(),
      ScholarshipModel.find({
        studentId: profile.userId,
        academicYear,
        status: { $in: ["approved", "disbursed"] },
      })
        .select("approvedAmount disbursedAmount")
        .lean(),
    ]);
    const directCost = fees.reduce((sum, fee) => sum + fee.grossAmount, 0);
    const costOfAttendance = directCost + safeAmount(indirectCost, "Indirect cost");
    const studentContribution = safeAmount(contribution, "Student contribution");
    const existingAid = existingAwards.reduce(
      (sum, award) => sum + (award.disbursedAmount ?? award.approvedAmount ?? 0),
      0,
    );
    return {
      profile,
      directCost,
      indirectCost: safeAmount(indirectCost, "Indirect cost"),
      costOfAttendance,
      studentContribution,
      existingAid,
      demonstratedNeed: Math.max(0, costOfAttendance - studentContribution - existingAid),
    };
  },

  createPackage: async (actorId: string, input: IPackageInput) => {
    if (!input.items.length || input.items.length > 20)
      throw createError(400, "Use 1-20 aid items");
    const uniqueIds = new Set(input.items.map((item) => item.fundId));
    if (uniqueIds.size !== input.items.length)
      throw createError(400, "A fund can appear only once in a package");
    const need = await financialAidService.calculateNeed(
      input.studentProfileId,
      input.academicYear,
      input.studentContribution,
      input.indirectCost,
    );
    const funds = await FinancialAidFundModel.find({
      _id: { $in: [...uniqueIds] },
      academicYear: input.academicYear,
      isActive: true,
    }).lean();
    if (funds.length !== uniqueIds.size)
      throw createError(400, "Every package item requires an active fund for this academic year");
    const fundById = new Map(funds.map((fund) => [String(fund._id), fund]));
    const items = input.items.map((item) => {
      const fund = fundById.get(item.fundId)!;
      const amount = safeAmount(item.amount, `${fund.name} amount`);
      if (!amount || amount > fund.maxPerStudent)
        throw createError(400, `${fund.name} exceeds its per-student limit`);
      return {
        fundId: fund._id,
        fundCode: fund.code,
        fundName: fund.name,
        type: fund.type,
        disbursementMode: fund.disbursementMode,
        offeredAmount: amount,
        acceptedAmount: 0,
        disbursedAmount: 0,
        status: "offered" as const,
      };
    });
    const giftAid = items
      .filter((item) => item.type !== "loan")
      .reduce((sum, item) => sum + item.offeredAmount, 0);
    const totalAid = items.reduce((sum, item) => sum + item.offeredAmount, 0);
    if (giftAid > need.demonstratedNeed)
      throw createError(409, "Need-based non-loan aid exceeds demonstrated need");
    if (totalAid + need.existingAid > need.costOfAttendance)
      throw createError(409, "Total aid exceeds cost of attendance");
    return FinancialAidPackageModel.create({
      packageNumber: `AID-${input.academicYear.replace(/\D/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`,
      studentProfileId: input.studentProfileId,
      studentId: need.profile.userId,
      departmentId: need.profile.department,
      academicYear: input.academicYear,
      costOfAttendance: need.costOfAttendance,
      studentContribution: need.studentContribution,
      demonstratedNeed: need.demonstratedNeed,
      items,
      notes: input.notes,
      createdBy: actorId,
    });
  },

  listPackages: async (filter: Record<string, unknown>, page = 1, limit = 30) => {
    const bounded = Math.min(100, Math.max(1, limit));
    const current = Math.max(1, page);
    const [data, total] = await Promise.all([
      FinancialAidPackageModel.find(filter)
        .populate("studentProfileId", "firstName lastName rollNumber program")
        .sort({ createdAt: -1 })
        .skip((current - 1) * bounded)
        .limit(bounded)
        .lean(),
      FinancialAidPackageModel.countDocuments(filter),
    ]);
    return { data, total, page: current, limit: bounded, pages: Math.ceil(total / bounded) };
  },

  packageScope: async (id: string) => {
    const item = await FinancialAidPackageModel.findById(id).lean();
    if (!item) throw createError(404, "Financial aid package not found");
    return item;
  },

  offer: async (id: string, actorId: string) => {
    const item = await FinancialAidPackageModel.findOne({
      _id: id,
      status: "draft",
      createdBy: { $ne: actorId },
    }).lean();
    if (!item) throw createError(409, "A different reviewer must offer a draft package");
    const session = await FinancialAidPackageModel.db.startSession();
    let offered;
    try {
      await session.withTransaction(async () => {
        for (const award of item.items) {
          const fund = await FinancialAidFundModel.findOneAndUpdate(
            {
              _id: award.fundId,
              isActive: true,
              $expr: {
                $lte: [{ $add: ["$reservedAmount", award.offeredAmount] }, "$budgetAmount"],
              },
            },
            { $inc: { reservedAmount: award.offeredAmount } },
            { session, returnDocument: "after" },
          );
          if (!fund) throw createError(409, `Insufficient available budget for ${award.fundName}`);
        }
        offered = await FinancialAidPackageModel.findOneAndUpdate(
          { _id: id, status: "draft" },
          { $set: { status: "offered", offeredBy: actorId, offeredAt: new Date() } },
          { session, returnDocument: "after" },
        ).lean();
        if (!offered) throw createError(409, "Package changed while it was offered");
      });
    } finally {
      await session.endSession();
    }
    if (offered) {
      await notifyUsers([item.studentId], {
        title: "Financial-aid offer available",
        body: `${item.packageNumber} is ready for your review and acceptance.`,
        type: NotificationType.INFO,
        actionUrl: "/financial-aid",
      });
    }
    return offered;
  },

  respond: async (id: string, studentId: string, acceptedFundIds: string[], declineAll = false) => {
    const item = await FinancialAidPackageModel.findOne({ _id: id, studentId, status: "offered" });
    if (!item) throw createError(409, "Only the student can respond to an offered package");
    const accepted = new Set(acceptedFundIds);
    if (!declineAll && !accepted.size)
      throw createError(400, "Accept at least one award or decline the package");
    if (
      [...accepted].some((fundId) => !item.items.some((award) => String(award.fundId) === fundId))
    )
      throw createError(400, "Package response contains an unknown fund");
    const session = await FinancialAidPackageModel.db.startSession();
    try {
      await session.withTransaction(async () => {
        for (const award of item.items) {
          const keep = !declineAll && accepted.has(String(award.fundId));
          award.status = keep ? "accepted" : "declined";
          award.acceptedAmount = keep ? award.offeredAmount : 0;
          if (!keep)
            await FinancialAidFundModel.updateOne(
              { _id: award.fundId, reservedAmount: { $gte: award.offeredAmount } },
              { $inc: { reservedAmount: -award.offeredAmount } },
              { session },
            );
        }
        item.status = declineAll ? "declined" : "accepted";
        item.acceptedAt = new Date();
        await item.save({ session });
      });
    } finally {
      await session.endSession();
    }
    return item.toObject();
  },

  disburseItem: async (packageId: string, itemId: string, actorId: string, referenceNo: string) => {
    const packageRow = await FinancialAidPackageModel.findOne({
      _id: packageId,
      status: { $in: ["accepted", "partially_disbursed"] },
    });
    if (!packageRow) throw createError(409, "Only an accepted package can be disbursed");
    if (String(packageRow.offeredBy) === actorId)
      throw createError(409, "Package reviewer and disbursement officer must be different users");
    const award = packageRow.items.find((row) => String(row._id) === itemId);
    if (!award || award.status !== "accepted" || !award.acceptedAmount)
      throw createError(409, "Only an accepted undisbursed award can be processed");
    if (award.type === "work_study")
      throw createError(
        409,
        "Work-study awards are paid through earned payroll, not aid disbursement",
      );
    const reference = referenceNo.trim();
    if (reference.length < 3 || reference.length > 200)
      throw createError(400, "A valid reconciliation reference is required");
    const session = await FinancialAidPackageModel.db.startSession();
    try {
      await session.withTransaction(async () => {
        if (award.disbursementMode === "fee_credit") {
          const invoices = await FeeRecordModel.find({
            studentId: packageRow.studentId,
            academicYear: packageRow.academicYear,
            balanceDue: { $gt: 0 },
          })
            .sort({ dueDate: 1 })
            .session(session);
          const allocations = allocateScholarshipFeeCredit(
            invoices.map((invoice) => ({
              id: String(invoice._id),
              balanceDue: invoice.balanceDue,
            })),
            award.acceptedAmount,
          );
          for (const allocation of allocations) {
            const invoice = invoices.find((row) => String(row._id) === allocation.id)!;
            invoice.totalScholarship += allocation.credit;
            invoice.netDue = Math.max(0, invoice.netDue - allocation.credit);
            invoice.balanceDue = Math.max(0, invoice.balanceDue - allocation.credit);
            invoice.scholarships.push({
              type: ScholarshipType.OTHER,
              body: award.fundName,
              amount: allocation.credit,
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
            invoice.updatedBy = new Types.ObjectId(actorId);
            await invoice.save({ session });
          }
        } else {
          const paymentDate = new Date();
          const year = paymentDate.getFullYear();
          const startYear = paymentDate.getMonth() >= 3 ? year : year - 1;
          await generalLedgerService.postScholarshipPayment(
            {
              scholarshipId: award._id,
              studentId: packageRow.studentId,
              scholarshipName: award.fundName,
              amount: award.acceptedAmount,
              referenceNo: reference,
              paymentDate,
              financialYear: `${startYear}-${String(startYear + 1).slice(-2)}`,
              postedBy: actorId,
            },
            session,
          );
        }
        const fund = await FinancialAidFundModel.findOneAndUpdate(
          { _id: award.fundId, reservedAmount: { $gte: award.acceptedAmount } },
          {
            $inc: { reservedAmount: -award.acceptedAmount, disbursedAmount: award.acceptedAmount },
          },
          { session, returnDocument: "after" },
        );
        if (!fund) throw createError(409, "Reserved financial-aid budget is inconsistent");
        award.status = "disbursed";
        award.disbursedAmount = award.acceptedAmount;
        award.referenceNo = reference;
        award.disbursedAt = new Date();
        award.disbursedBy = new Types.ObjectId(actorId);
        const pending = packageRow.items.some(
          (row) => row.status === "accepted" && row.type !== "work_study",
        );
        packageRow.status = pending ? "partially_disbursed" : "disbursed";
        if (!pending) packageRow.completedAt = new Date();
        await packageRow.save({ session });
      });
    } finally {
      await session.endSession();
    }
    return packageRow.toObject();
  },
};

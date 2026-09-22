import type { ClientSession } from "mongoose";
import { FeeRecordModel, FeeStructureModel, FeePaymentStatus } from "../models";

export const feeRepository = {
  // ─── Fee Structure ────────────────────────────────────────────────────────

  findStructure: (
    program: string,
    branch: string,
    semester: number,
    academicYear: string,
    category = "General",
  ) =>
    FeeStructureModel.findOne({
      program,
      branch,
      semester,
      academicYear,
      category,
      isActive: true,
    }).lean(),

  findStructureByAcademicRefs: async (params: {
    program?: string;
    branch?: string;
    curriculumId?: string;
    departmentId?: string;
    batchId?: string;
    semester: number;
    academicYear: string;
    category?: string;
  }) => {
    const base = {
      semester: params.semester,
      academicYear: params.academicYear,
      category: params.category || "General",
      isActive: true,
    };
    const candidates = [
      params.batchId &&
        params.curriculumId &&
        params.departmentId && {
          ...base,
          batchId: params.batchId,
          curriculumId: params.curriculumId,
          departmentId: params.departmentId,
        },
      params.curriculumId &&
        params.departmentId && {
          ...base,
          curriculumId: params.curriculumId,
          departmentId: params.departmentId,
          batchId: { $exists: false },
        },
      params.program &&
        params.branch && {
          ...base,
          program: params.program,
          branch: params.branch,
        },
    ].filter(Boolean) as Record<string, unknown>[];

    for (const filter of candidates) {
      const found = await FeeStructureModel.findOne(filter).lean();
      if (found) return found;
    }
    return null;
  },

  listStructures: (filter: Record<string, unknown>) =>
    FeeStructureModel.find({ ...filter, isActive: true })
      .sort({ program: 1, semester: 1 })
      .lean(),

  createStructure: (data: Record<string, unknown>) => FeeStructureModel.create(data),

  updateStructure: (id: string, data: Record<string, unknown>) =>
    FeeStructureModel.findByIdAndUpdate(id, { $set: data }).lean(),

  // ─── Fee Records ──────────────────────────────────────────────────────────

  findRecordById: (id: string) => FeeRecordModel.findById(id).lean(),

  findRecordByInvoice: (invoiceNumber: string) => FeeRecordModel.findOne({ invoiceNumber }).lean(),

  findByStudent: (studentId: string) =>
    FeeRecordModel.find({ studentId }).sort({ createdAt: -1 }).lean(),

  findByStudentSemester: (studentId: string, semester: number, academicYear: string) =>
    FeeRecordModel.findOne({ studentId, semester, academicYear }).lean(),

  paginate: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      FeeRecordModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      FeeRecordModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  createRecord: (data: Record<string, unknown>) => FeeRecordModel.create(data),

  addTransaction: (
    id: string,
    transaction: Record<string, unknown>,
    options: {
      session?: ClientSession;
      expectedBalanceDue?: number;
    } = {},
  ) => {
    const amountPaid = (transaction["amountPaid"] as number) || 0;
    const filter: Record<string, unknown> = {
      _id: id,
      status: { $nin: [FeePaymentStatus.PAID, FeePaymentStatus.REFUNDED] },
      balanceDue: { $gte: amountPaid },
    };
    if (options.expectedBalanceDue !== undefined) {
      filter["balanceDue"] = options.expectedBalanceDue;
    }
    const bankRef = typeof transaction["bankRef"] === "string" ? transaction["bankRef"].trim() : "";
    if (bankRef) filter["transactions.bankRef"] = { $ne: bankRef };

    const nextStatus =
      options.expectedBalanceDue !== undefined && amountPaid >= options.expectedBalanceDue
        ? FeePaymentStatus.PAID
        : FeePaymentStatus.PARTIAL;

    return FeeRecordModel.findOneAndUpdate(
      filter,
      {
        $push: { transactions: transaction },
        $inc: { totalPaid: amountPaid, balanceDue: -amountPaid },
        $set: { status: nextStatus },
      },
      { returnDocument: "after", runValidators: true, session: options.session },
    ).lean();
  },

  updateRecord: (id: string, data: Record<string, unknown>) =>
    FeeRecordModel.findByIdAndUpdate(id, { $set: data }, { runValidators: true }).lean(),

  // ─── Analytics ────────────────────────────────────────────────────────────

  getCollectionSummary: async (academicYear: string) => {
    return FeeRecordModel.aggregate([
      { $match: { academicYear } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalDue: { $sum: "$netDue" },
          totalPaid: { $sum: "$totalPaid" },
          totalBalance: { $sum: "$balanceDue" },
        },
      },
    ]);
  },

  getOverdueFees: (asOf = new Date()) =>
    FeeRecordModel.find({
      dueDate: { $lt: asOf },
      status: { $in: [FeePaymentStatus.PENDING, FeePaymentStatus.PARTIAL] },
    })
      .sort({ dueDate: 1 })
      .lean(),
};

import { PaymentSubmissionModel, SubmissionStatus } from "../models/payment-submission.model";
import type { ClientSession } from "mongoose";

function normalizeUpdate(data: Record<string, unknown>) {
  const operators = Object.fromEntries(Object.entries(data).filter(([key]) => key.startsWith("$")));
  const fields = Object.fromEntries(
    Object.entries(data).filter(([key, value]) => !key.startsWith("$") && value !== undefined),
  );
  const unsetFields = Object.fromEntries(
    Object.entries(data)
      .filter(([key, value]) => !key.startsWith("$") && value === undefined)
      .map(([key]) => [key, 1]),
  );
  return {
    ...operators,
    ...(Object.keys(fields).length ? { $set: fields } : {}),
    ...(Object.keys(unsetFields).length ? { $unset: unsetFields } : {}),
  };
}

export const paymentSubmissionRepository = {
  findById: (id: string) => PaymentSubmissionModel.findById(id).lean(),

  /** All submissions for a student. */
  findByStudent: (studentId: string) =>
    PaymentSubmissionModel.find({ studentId }).sort({ createdAt: -1 }).lean(),

  /** All submissions against a specific fee record. */
  findByFeeRecord: (feeRecordId: string) =>
    PaymentSubmissionModel.find({ feeRecordId }).sort({ createdAt: -1 }).lean(),

  /** Check if an active (pending/under_review) submission already exists for a fee record. */
  findActivePendingForFeeRecord: (feeRecordId: string) =>
    PaymentSubmissionModel.findOne({
      feeRecordId,
      status: { $in: [SubmissionStatus.PENDING, SubmissionStatus.UNDER_REVIEW] },
    }).lean(),

  create: (data: Record<string, unknown>) => PaymentSubmissionModel.create(data),

  updateById: (
    id: string,
    data: Record<string, unknown>,
    options: { session?: ClientSession } = {},
  ) => {
    return PaymentSubmissionModel.findByIdAndUpdate(id, normalizeUpdate(data), {
      returnDocument: "after",
      runValidators: true,
      session: options.session,
    }).lean();
  },

  transitionStatus: (
    id: string,
    from: SubmissionStatus[],
    data: Record<string, unknown>,
    session?: ClientSession,
  ) =>
    PaymentSubmissionModel.findOneAndUpdate(
      { _id: id, status: { $in: from } },
      normalizeUpdate(data),
      { returnDocument: "after", runValidators: true, session },
    ).lean(),

  claimReceiptGeneration: (id: string) =>
    PaymentSubmissionModel.findOneAndUpdate(
      {
        _id: id,
        status: SubmissionStatus.APPROVED,
        receiptGenerationStatus: { $in: ["pending", "failed"] },
      },
      {
        $set: { receiptGenerationStatus: "processing" },
        $unset: { receiptGenerationError: 1 },
        $inc: { receiptGenerationAttempts: 1 },
      },
      { returnDocument: "after" },
    ).lean(),

  /** Paginated list for Accounts team with filters. */
  paginate: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      PaymentSubmissionModel.find(filter)
        .populate("studentId", "name email phone")
        .populate("feeRecordId", "invoiceNumber netDue balanceDue")
        .populate("reviewedBy", "name")
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PaymentSubmissionModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  /** Count by status — for Accounts dashboard card. */
  countByStatus: () =>
    PaymentSubmissionModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
};

import createError from "http-errors";
import mongoose, { Types } from "mongoose";
import {
  FeeAdjustmentModel,
  FeeInstallmentPlanModel,
  FeeReconciliationModel,
  FeeRefundModel,
} from "../models/fee-advanced.model";
import { FeePaymentStatus, FeeRecordModel } from "../models/fee.model";
import { generalLedgerService } from "./general-ledger.service";

const money = (value: number) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function validId(id: string, label: string) {
  if (!Types.ObjectId.isValid(id)) throw createError(400, `Invalid ${label}`);
}

async function feeRecord(id: string) {
  validId(id, "fee record identifier");
  const record = await FeeRecordModel.findById(id).lean();
  if (!record) throw createError(404, "Fee record not found");
  return record;
}

export const feeAdvancedService = {
  async overview(filter: { academicYear?: string; studentId?: string }) {
    const recordFilter: Record<string, unknown> = {};
    if (filter.academicYear) recordFilter["academicYear"] = filter.academicYear;
    if (filter.studentId) recordFilter["studentId"] = filter.studentId;
    const recordIds = await FeeRecordModel.find(recordFilter).distinct("_id");
    const scope = { feeRecordId: { $in: recordIds } };
    const [plans, adjustments, refunds, reconciliation] = await Promise.all([
      FeeInstallmentPlanModel.find(scope).sort({ updatedAt: -1 }).lean(),
      FeeAdjustmentModel.find(scope).sort({ updatedAt: -1 }).lean(),
      FeeRefundModel.find(scope).sort({ updatedAt: -1 }).lean(),
      FeeReconciliationModel.find(
        filter.academicYear
          ? { paidAt: { $gte: new Date(`${filter.academicYear.slice(0, 4)}-04-01`) } }
          : {},
      )
        .sort({ updatedAt: -1 })
        .limit(500)
        .lean(),
    ]);
    return { plans, adjustments, refunds, reconciliation };
  },

  async saveInstallments(
    feeRecordId: string,
    rows: Array<{ label: string; amount: number; dueDate: string }>,
    notes: string | undefined,
    userId: string,
  ) {
    const record = await feeRecord(feeRecordId);
    if (record.status === FeePaymentStatus.PAID || record.status === FeePaymentStatus.REFUNDED)
      throw createError(409, "A completed invoice cannot receive an installment plan");
    if (!rows.length || rows.length > 24) throw createError(400, "Use 1-24 installments");
    const installments = rows.map((row, index) => ({
      sequence: index + 1,
      label: row.label.trim() || `Installment ${index + 1}`,
      amount: money(row.amount),
      dueDate: new Date(row.dueDate),
      paidAmount: 0,
      status: "pending" as const,
    }));
    if (installments.some((row) => row.amount <= 0 || Number.isNaN(row.dueDate.getTime())))
      throw createError(400, "Every installment needs a valid amount and due date");
    const total = money(installments.reduce((sum, row) => sum + row.amount, 0));
    if (total !== money(record.balanceDue))
      throw createError(
        400,
        `Installments must total the current balance of ₹${record.balanceDue}`,
      );
    return FeeInstallmentPlanModel.findOneAndUpdate(
      { feeRecordId: record._id },
      {
        $set: { studentId: record.studentId, installments, notes, status: "active" },
        $setOnInsert: { createdBy: userId },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    ).lean();
  },

  async requestAdjustment(
    feeRecordId: string,
    data: { kind: "concession" | "waiver" | "late_fee"; amount: number; reason: string },
    userId: string,
  ) {
    const record = await feeRecord(feeRecordId);
    const amount = money(data.amount);
    if (amount <= 0) throw createError(400, "Adjustment amount must be positive");
    if (data.kind !== "late_fee" && amount > record.balanceDue)
      throw createError(400, "Adjustment cannot exceed the outstanding balance");
    const pending = await FeeAdjustmentModel.exists({
      feeRecordId: record._id,
      kind: data.kind,
      status: "pending",
    });
    if (pending) throw createError(409, "A pending adjustment of this type already exists");
    return FeeAdjustmentModel.create({
      feeRecordId: record._id,
      studentId: record.studentId,
      kind: data.kind,
      amount,
      reason: data.reason,
      requestedBy: userId,
    });
  },

  async reviewAdjustment(
    id: string,
    decision: "approved" | "rejected",
    note: string | undefined,
    userId: string,
  ) {
    validId(id, "adjustment identifier");
    const session = await mongoose.startSession();
    try {
      let result = null;
      await session.withTransaction(async () => {
        result = await FeeAdjustmentModel.findOneAndUpdate(
          { _id: id, status: "pending" },
          {
            $set: {
              status: decision,
              reviewNote: note,
              reviewedBy: userId,
              reviewedAt: new Date(),
            },
          },
          { returnDocument: "after", session, runValidators: true },
        );
        if (!result) throw createError(409, "Adjustment was already reviewed");
        if (decision === "approved") {
          const adjustment = result as unknown as {
            feeRecordId: Types.ObjectId;
            kind: "concession" | "waiver" | "late_fee";
            amount: number;
          };
          const increment =
            adjustment.kind === "late_fee"
              ? { lateFee: adjustment.amount, balanceDue: adjustment.amount }
              : {
                  totalConcession: adjustment.amount,
                  netDue: -adjustment.amount,
                  balanceDue: -adjustment.amount,
                };
          const updated = await FeeRecordModel.findOneAndUpdate(
            {
              _id: adjustment.feeRecordId,
              ...(adjustment.kind === "late_fee"
                ? {}
                : { balanceDue: { $gte: adjustment.amount } }),
            },
            { $inc: increment, $set: { updatedBy: userId } },
            { returnDocument: "after", session, runValidators: true },
          );
          if (!updated)
            throw createError(409, "Invoice balance changed; review the adjustment again");
          if (updated.balanceDue === 0) {
            updated.status =
              updated.totalPaid > 0 ? FeePaymentStatus.PAID : FeePaymentStatus.WAIVED;
            await updated.save({ session });
          }
        }
      });
      return result;
    } finally {
      await session.endSession();
    }
  },

  async requestRefund(
    feeRecordId: string,
    data: { transactionId: string; amount: number; reason: string; destination: string },
    userId: string,
  ) {
    const record = await feeRecord(feeRecordId);
    const transaction = record.transactions.find((row) => row.transactionId === data.transactionId);
    if (!transaction) throw createError(404, "Payment transaction not found on this invoice");
    const prior = await FeeRefundModel.aggregate<{ total: number }>([
      {
        $match: {
          feeRecordId: record._id,
          transactionId: data.transactionId,
          status: { $in: ["requested", "approved", "processing", "paid"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const amount = money(data.amount);
    if (amount <= 0 || money((prior[0]?.total ?? 0) + amount) > transaction.amountPaid)
      throw createError(400, "Refund exceeds the refundable payment amount");
    return FeeRefundModel.create({
      feeRecordId: record._id,
      studentId: record.studentId,
      transactionId: data.transactionId,
      amount,
      reason: data.reason,
      destination: data.destination,
      requestedBy: userId,
    });
  },

  async reviewRefund(id: string, decision: "approved" | "rejected", userId: string) {
    validId(id, "refund identifier");
    const row = await FeeRefundModel.findOneAndUpdate(
      { _id: id, status: "requested" },
      { $set: { status: decision, reviewedBy: userId } },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!row) throw createError(409, "Refund was already reviewed");
    return row;
  },

  async completeRefund(id: string, reference: string, userId: string) {
    validId(id, "refund identifier");
    if (reference.trim().length < 3) throw createError(400, "Refund reference is required");
    const session = await mongoose.startSession();
    try {
      let refund = null;
      await session.withTransaction(async () => {
        refund = await FeeRefundModel.findOneAndUpdate(
          { _id: id, status: { $in: ["approved", "processing"] } },
          {
            $set: {
              status: "paid",
              reference: reference.trim(),
              processedBy: userId,
              processedAt: new Date(),
            },
          },
          { returnDocument: "after", session },
        );
        if (!refund) throw createError(409, "Refund is not approved or was already completed");
        const row = refund as unknown as {
          feeRecordId: Types.ObjectId;
          amount: number;
          transactionId: string;
        };
        const record = await FeeRecordModel.findOneAndUpdate(
          { _id: row.feeRecordId, totalPaid: { $gte: row.amount } },
          {
            $inc: { totalPaid: -row.amount, balanceDue: row.amount },
            $set: { status: FeePaymentStatus.PARTIAL, updatedBy: userId },
          },
          { returnDocument: "after", session },
        );
        if (!record) throw createError(409, "Invoice payment balance changed");
        await generalLedgerService.postFeeRefund(
          {
            feeRecordId: record._id,
            refundId: (refund as unknown as { _id: Types.ObjectId })._id,
            reference: reference.trim(),
            amount: row.amount,
            financialYear: record.academicYear,
            studentId: record.studentId,
            postedBy: userId,
          },
          session,
        );
      });
      return refund;
    } finally {
      await session.endSession();
    }
  },

  async importReconciliation(
    data: {
      provider: string;
      statementReference: string;
      rows: Array<{ transactionReference: string; amount: number; paidAt: string }>;
    },
    userId: string,
  ) {
    if (!data.rows.length || data.rows.length > 5000) throw createError(400, "Use 1-5000 rows");
    const operations = data.rows.map((row) => ({
      updateOne: {
        filter: {
          provider: data.provider.trim(),
          statementReference: data.statementReference.trim(),
          transactionReference: row.transactionReference.trim(),
        },
        update: {
          $setOnInsert: {
            amount: money(row.amount),
            paidAt: new Date(row.paidAt),
            status: "unmatched" as const,
            importedBy: new Types.ObjectId(userId),
          },
        },
        upsert: true,
      },
    }));
    await FeeReconciliationModel.bulkWrite(operations, { ordered: false });
    const rows = await FeeReconciliationModel.find({
      provider: data.provider.trim(),
      statementReference: data.statementReference.trim(),
    }).lean();
    const references = [...new Set(rows.map((row) => row.transactionReference))];
    const referenceSet = new Set(references);
    const feeRecords = await FeeRecordModel.find({
      $or: [
        { "transactions.transactionId": { $in: references } },
        { "transactions.bankRef": { $in: references } },
        { "transactions.receiptNumber": { $in: references } },
      ],
    })
      .select("transactions")
      .lean();
    const matchesByReference = new Map<
      string,
      { feeRecordId: Types.ObjectId; transactionId?: string; amountPaid: number }
    >();
    for (const record of feeRecords) {
      for (const transaction of record.transactions) {
        for (const reference of [
          transaction.transactionId,
          transaction.bankRef,
          transaction.receiptNumber,
        ]) {
          if (reference && referenceSet.has(reference) && !matchesByReference.has(reference)) {
            matchesByReference.set(reference, {
              feeRecordId: record._id,
              transactionId: transaction.transactionId,
              amountPaid: transaction.amountPaid,
            });
          }
        }
      }
    }
    const reconciliationUpdates = rows.flatMap((row) => {
      const match = matchesByReference.get(row.transactionReference);
      if (!match) return [];
      const amountMatches = money(match.amountPaid) === money(row.amount);
      return [
        {
          updateOne: {
            filter: { _id: row._id },
            update: {
              $set: amountMatches
                ? {
                    feeRecordId: match.feeRecordId,
                    ...(match.transactionId ? { transactionId: match.transactionId } : {}),
                    status: "matched" as const,
                    reconciledBy: new Types.ObjectId(userId),
                    reconciledAt: new Date(),
                  }
                : {
                    status: "exception" as const,
                    exceptionReason: "Reference matched but amount differs",
                  },
            },
          },
        },
      ];
    });
    if (reconciliationUpdates.length > 0)
      await FeeReconciliationModel.bulkWrite(reconciliationUpdates, { ordered: false });
    return FeeReconciliationModel.find({
      provider: data.provider.trim(),
      statementReference: data.statementReference.trim(),
    })
      .sort({ createdAt: 1 })
      .lean();
  },
};

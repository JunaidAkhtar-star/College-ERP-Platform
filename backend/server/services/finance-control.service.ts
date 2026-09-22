import createError from "http-errors";
import { Types } from "mongoose";
import {
  AccountingPeriodModel,
  BankStatementLineModel,
  FinanceBudgetModel,
  FinanceTaxConfigModel,
} from "../models/finance-control.model";
import { JournalEntryModel } from "../models/general-ledger.model";
import { FeeRecordModel } from "../models/fee.model";

const FINANCIAL_YEAR_RE = /^\d{4}-\d{2}$/;

export function periodForDate(date: Date) {
  return date.getMonth() >= 3 ? date.getMonth() - 2 : date.getMonth() + 10;
}

export function availableBudget(input: {
  approvedAmount: number;
  encumberedAmount: number;
  consumedAmount: number;
}) {
  return (
    Math.round(
      (input.approvedAmount - input.encumberedAmount - input.consumedAmount + Number.EPSILON) * 100,
    ) / 100
  );
}

export const financeControlService = {
  listPeriods: (financialYear?: string) =>
    AccountingPeriodModel.find(financialYear ? { financialYear } : {})
      .sort({ financialYear: -1, period: 1 })
      .lean()
      .exec(),

  async createYear(financialYear: string) {
    if (!FINANCIAL_YEAR_RE.test(financialYear))
      throw createError(400, "Financial year must use YYYY-YY format");
    const startYear = Number(financialYear.slice(0, 4));
    const periods = Array.from({ length: 12 }, (_, index) => {
      const startsAt = new Date(startYear, index + 3, 1);
      const endsAt = new Date(startYear, index + 4, 0, 23, 59, 59, 999);
      return {
        financialYear,
        period: index + 1,
        startsAt,
        endsAt,
        status: "open" as const,
      };
    });
    await AccountingPeriodModel.bulkWrite(
      periods.map((period) => ({
        updateOne: {
          filter: { financialYear, period: period.period },
          update: { $setOnInsert: period },
          upsert: true,
        },
      })),
    );
    return this.listPeriods(financialYear);
  },

  async closePeriod(
    id: string,
    status: "soft_closed" | "closed" | "open",
    actorId: string,
    reason: string,
  ) {
    if (reason.trim().length < 10) throw createError(400, "A meaningful close reason is required");
    const period = await AccountingPeriodModel.findById(id);
    if (!period) throw createError(404, "Accounting period not found");
    if (period.status === "closed" && status !== "open")
      throw createError(409, "A closed period cannot be closed again");
    return AccountingPeriodModel.findOneAndUpdate(
      { _id: id, status: period.status },
      {
        $set: {
          status,
          closedBy: status === "open" ? undefined : actorId,
          closedAt: status === "open" ? undefined : new Date(),
          closeReason: reason.trim(),
        },
      },
      { returnDocument: "after" },
    )
      .lean()
      .exec();
  },

  async assertPostingAllowed(date: Date, financialYear: string) {
    const period = await AccountingPeriodModel.findOne({
      financialYear,
      period: periodForDate(date),
    })
      .select("status")
      .lean();
    if (period && period.status !== "open") {
      throw createError(409, `Accounting period is ${period.status}; posting is locked`);
    }
  },

  listBudgets: (financialYear?: string) =>
    FinanceBudgetModel.find(financialYear ? { financialYear } : {})
      .populate("departmentId", "name code")
      .sort({ budgetHead: 1 })
      .lean()
      .exec(),

  createBudget: (input: Record<string, unknown>, actorId: string) =>
    FinanceBudgetModel.create({ ...input, createdBy: actorId, status: "draft" }),

  async submitBudget(id: string, actorId: string) {
    const row = await FinanceBudgetModel.findOneAndUpdate(
      { _id: id, status: "draft" },
      { $set: { status: "pending_approval", submittedBy: actorId } },
      { returnDocument: "after" },
    ).lean();
    if (!row) throw createError(409, "Only a draft budget can be submitted");
    return row;
  },

  async approveBudget(id: string, actorId: string) {
    const budget = await FinanceBudgetModel.findOne({ _id: id, status: "pending_approval" }).lean();
    if (!budget) throw createError(409, "Only a submitted budget can be approved");
    if (String(budget.submittedBy) === actorId)
      throw createError(409, "Budget submitter cannot approve the same budget");
    return FinanceBudgetModel.findOneAndUpdate(
      { _id: id, status: "pending_approval" },
      { $set: { status: "approved", approvedBy: actorId, approvedAt: new Date() } },
      { returnDocument: "after" },
    ).lean();
  },

  async reserveBudget(id: string, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0)
      throw createError(400, "Reserve amount is invalid");
    const row = await FinanceBudgetModel.findOneAndUpdate(
      {
        _id: id,
        status: "approved",
        $expr: {
          $lte: [{ $add: ["$encumberedAmount", "$consumedAmount", amount] }, "$approvedAmount"],
        },
      },
      { $inc: { encumberedAmount: amount } },
      { returnDocument: "after" },
    ).lean();
    if (!row) throw createError(409, "Approved budget has insufficient available balance");
    return row;
  },

  listBankLines: (status?: "unmatched" | "matched" | "exception") =>
    BankStatementLineModel.find(status ? { status } : {})
      .populate("journalEntryId", "voucherNumber date totalDebit totalCredit")
      .sort({ transactionDate: -1 })
      .limit(1000)
      .lean(),

  async importBankLines(lines: Array<Record<string, unknown>>, actorId: string) {
    if (!Array.isArray(lines) || lines.length < 1 || lines.length > 5000)
      throw createError(400, "Import must contain between 1 and 5,000 statement lines");
    const operations = lines.map((line) => ({
      updateOne: {
        filter: {
          bankAccountCode: String(line.bankAccountCode).toUpperCase(),
          statementReference: String(line.statementReference),
        },
        update: {
          $setOnInsert: {
            ...line,
            bankAccountCode: String(line.bankAccountCode).toUpperCase(),
            importedBy: new Types.ObjectId(actorId),
            status: "unmatched" as const,
          },
        },
        upsert: true,
      },
    }));
    const result = await BankStatementLineModel.bulkWrite(operations, { ordered: false });
    return { imported: result.upsertedCount, duplicates: lines.length - result.upsertedCount };
  },

  async matchBankLine(id: string, journalEntryId: string, actorId: string, note?: string) {
    const [line, journal] = await Promise.all([
      BankStatementLineModel.findOne({ _id: id, status: "unmatched" }).lean(),
      JournalEntryModel.findOne({ _id: journalEntryId, status: "posted" }).lean(),
    ]);
    if (!line || !journal) throw createError(404, "Unmatched statement line or journal not found");
    const bankLine = journal.lines.find((entry) => entry.accountCode === line.bankAccountCode);
    const journalAmount = line.direction === "credit" ? bankLine?.debit : bankLine?.credit;
    if (journalAmount !== line.amount)
      throw createError(409, "Bank statement amount and journal bank line do not reconcile");
    const dayDifference =
      Math.abs(line.transactionDate.getTime() - journal.date.getTime()) / 86_400_000;
    if (dayDifference > 7)
      throw createError(409, "Bank and journal dates exceed the seven-day matching window");
    return BankStatementLineModel.findOneAndUpdate(
      { _id: id, status: "unmatched" },
      {
        $set: {
          status: "matched",
          journalEntryId,
          matchedBy: actorId,
          matchedAt: new Date(),
          matchNote: note?.trim(),
        },
      },
      { returnDocument: "after" },
    ).lean();
  },

  async receivableAging(asOf = new Date()) {
    const rows = await FeeRecordModel.aggregate<{
      _id: string;
      amount: number;
      invoices: number;
    }>([
      { $match: { balanceDue: { $gt: 0 } } },
      {
        $project: {
          balanceDue: 1,
          daysPastDue: {
            $max: [0, { $dateDiff: { startDate: "$dueDate", endDate: asOf, unit: "day" } }],
          },
        },
      },
      {
        $project: {
          balanceDue: 1,
          bucket: {
            $switch: {
              branches: [
                { case: { $eq: ["$daysPastDue", 0] }, then: "current" },
                { case: { $lte: ["$daysPastDue", 30] }, then: "1-30" },
                { case: { $lte: ["$daysPastDue", 60] }, then: "31-60" },
                { case: { $lte: ["$daysPastDue", 90] }, then: "61-90" },
              ],
              default: "90+",
            },
          },
        },
      },
      { $group: { _id: "$bucket", amount: { $sum: "$balanceDue" }, invoices: { $sum: 1 } } },
    ]);
    const order = ["current", "1-30", "31-60", "61-90", "90+"];
    const values = new Map(rows.map((row) => [row._id, row]));
    return order.map((bucket) => ({
      bucket,
      amount: values.get(bucket)?.amount ?? 0,
      invoices: values.get(bucket)?.invoices ?? 0,
    }));
  },

  listTaxConfigs: () =>
    FinanceTaxConfigModel.find().sort({ taxType: 1, code: 1, effectiveFrom: -1 }).lean(),

  async createTaxConfig(input: Record<string, unknown>, actorId: string) {
    const effectiveFrom = new Date(String(input.effectiveFrom));
    const effectiveTo = input.effectiveTo ? new Date(String(input.effectiveTo)) : undefined;
    if (!Number.isFinite(effectiveFrom.getTime()) || (effectiveTo && effectiveTo <= effectiveFrom))
      throw createError(400, "Tax configuration effective dates are invalid");
    return FinanceTaxConfigModel.create({
      ...input,
      effectiveFrom,
      effectiveTo,
      createdBy: actorId,
      status: "draft",
    });
  },

  async submitTaxConfig(id: string, actorId: string) {
    const row = await FinanceTaxConfigModel.findOneAndUpdate(
      { _id: id, status: "draft" },
      { $set: { status: "pending_approval", submittedBy: actorId } },
      { returnDocument: "after" },
    ).lean();
    if (!row) throw createError(409, "Only a draft tax configuration can be submitted");
    return row;
  },

  async approveTaxConfig(id: string, actorId: string) {
    const row = await FinanceTaxConfigModel.findOne({
      _id: id,
      status: "pending_approval",
    }).lean();
    if (!row) throw createError(409, "Only a submitted tax configuration can be approved");
    if (String(row.submittedBy) === actorId)
      throw createError(409, "Tax configuration submitter cannot approve the same version");
    const overlap = await FinanceTaxConfigModel.exists({
      _id: { $ne: row._id },
      code: row.code,
      status: "approved",
      effectiveFrom: { $lte: row.effectiveTo ?? new Date("9999-12-31") },
      $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: { $gte: row.effectiveFrom } }],
    });
    if (overlap) throw createError(409, "Approved tax configuration dates overlap");
    return FinanceTaxConfigModel.findOneAndUpdate(
      { _id: id, status: "pending_approval" },
      { $set: { status: "approved", approvedBy: actorId, approvedAt: new Date() } },
      { returnDocument: "after" },
    ).lean();
  },
};

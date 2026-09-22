import { accountsRepository } from "../repositories";
import createError from "http-errors";
import mongoose, { Types } from "mongoose";
import { AccountsTransactionModel } from "../models/accounts.model";
import { generalLedgerService } from "./general-ledger.service";

const FINANCIAL_YEAR_RE = /^\d{4}-\d{2}$/;

export function financialYearForDate(date: Date): string {
  const year = date.getFullYear();
  const start = date.getMonth() >= 3 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

function accountCode(prefix: string, category: string): string {
  const slug = category
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${prefix}-${slug || "OTHER"}`.slice(0, 40);
}

export function manualJournalLines(input: {
  transactionType: "income" | "expense";
  category: string;
  amount: number;
  paymentMode: string;
}) {
  const settlement =
    input.paymentMode === "cash"
      ? { accountCode: "1000-CASH", accountName: "Cash on Hand" }
      : { accountCode: "1010-BANK", accountName: "Bank Account" };
  const amount = Math.round((Number(input.amount) + Number.EPSILON) * 100) / 100;
  if (input.transactionType === "income") {
    return [
      { ...settlement, accountType: "asset" as const, debit: amount },
      {
        accountCode: accountCode("49", input.category),
        accountName: input.category,
        accountType: "income" as const,
        credit: amount,
      },
    ];
  }
  return [
    {
      accountCode: accountCode("59", input.category),
      accountName: input.category,
      accountType: "expense" as const,
      debit: amount,
    },
    { ...settlement, accountType: "asset" as const, credit: amount },
  ];
}

async function assertManuallyEditable(id: string) {
  const transaction = await accountsRepository.findById(id);
  if (!transaction) throw createError(404, "Accounts transaction not found");
  if (transaction.externalSourceKey || transaction.relatedDocumentType) {
    throw createError(
      409,
      "System-posted transactions are immutable. Use a controlled reversal instead.",
    );
  }
  return transaction;
}

export const accountsService = {
  getAll: (filter: Record<string, unknown>, page: number, limit: number) =>
    accountsRepository.list(filter, page, limit),

  getById: (id: string) => accountsRepository.findById(id),

  createTransaction: async (data: Record<string, unknown>) => {
    const date = new Date(String(data.date));
    const amount = Number(data.amount);
    if (!Number.isFinite(date.getTime()))
      throw createError(400, "Valid transaction date is required");
    if (!Number.isFinite(amount) || amount <= 0)
      throw createError(400, "Amount must be greater than zero");
    if (!FINANCIAL_YEAR_RE.test(String(data.financialYear))) {
      throw createError(400, "Financial year must use YYYY-YY format");
    }
    if (financialYearForDate(date) !== data.financialYear) {
      throw createError(400, "Transaction date does not belong to the selected financial year");
    }

    const session = await mongoose.startSession();
    let result: unknown;
    try {
      await session.withTransaction(async () => {
        const id = new Types.ObjectId();
        const [transaction] = await AccountsTransactionModel.create(
          [{ ...data, _id: id, amount, date, externalSourceKey: `manual:${id.toString()}` }],
          { session },
        );
        await generalLedgerService.postJournal(
          {
            date,
            financialYear: String(data.financialYear),
            description: String(data.description),
            sourceType: "AccountsTransaction",
            sourceId: id,
            sourceEvent: "manual:post",
            postedBy: String(data.createdBy),
            lines: manualJournalLines({
              transactionType: data.transactionType as "income" | "expense",
              category: String(data.category),
              amount,
              paymentMode: String(data.paymentMode),
            }),
          },
          session,
        );
        result = transaction;
      });
      return result;
    } finally {
      await session.endSession();
    }
  },

  update: async (id: string, data: Record<string, unknown>) => {
    await assertManuallyEditable(id);
    const immutableFields = new Set([
      "createdBy",
      "approvedBy",
      "externalSourceKey",
      "relatedDocumentId",
      "relatedDocumentType",
    ]);
    const update = Object.fromEntries(
      Object.entries(data).filter(([key]) => !immutableFields.has(key)),
    );
    return accountsRepository.updateById(id, update);
  },

  delete: async (id: string) => {
    await assertManuallyEditable(id);
    return accountsRepository.deleteById(id);
  },

  reverse: async (id: string, reversedBy: string, reason: string) => {
    const session = await mongoose.startSession();
    let result: unknown;
    try {
      await session.withTransaction(async () => {
        const original = await AccountsTransactionModel.findOne({
          _id: id,
          externalSourceKey: { $regex: /^manual:/ },
          reversedAt: { $exists: false },
          reversalOf: { $exists: false },
        }).session(session);
        if (!original)
          throw createError(404, "Posted manual transaction not found or already reversed");
        await generalLedgerService.reverseJournal(
          "AccountsTransaction",
          original._id,
          reversedBy,
          reason,
          session,
        );
        const reversalId = new Types.ObjectId();
        const [reversal] = await AccountsTransactionModel.create(
          [
            {
              _id: reversalId,
              transactionType: original.transactionType === "income" ? "expense" : "income",
              category: original.category,
              subCategory: "Controlled reversal",
              amount: original.amount,
              paymentMode: original.paymentMode,
              referenceNo: original.referenceNo,
              description: `Reversal: ${original.description}`,
              departmentId: original.departmentId,
              relatedDocumentId: original._id,
              relatedDocumentType: "AccountsTransactionReversal",
              date: original.date,
              financialYear: original.financialYear,
              budgetHead: original.budgetHead,
              approvedBy: new Types.ObjectId(reversedBy),
              createdBy: new Types.ObjectId(reversedBy),
              externalSourceKey: `manual-reversal:${original._id.toString()}`,
              reversalOf: original._id,
              reversalReason: reason,
            },
          ],
          { session },
        );
        const updated = await AccountsTransactionModel.updateOne(
          { _id: original._id, reversedAt: { $exists: false } },
          { $set: { reversedAt: new Date(), reversedBy, reversalReason: reason } },
          { session },
        );
        if (updated.modifiedCount !== 1)
          throw createError(409, "Transaction was concurrently reversed");
        result = reversal;
      });
      return result;
    } finally {
      await session.endSession();
    }
  },

  getSummaryByCategory: (financialYear: string) =>
    accountsRepository.getSummaryByCategory(financialYear),

  getMonthlyFlow: (financialYear: string) => accountsRepository.getMonthlyFlow(financialYear),

  getBalance: (financialYear: string) => accountsRepository.getBalance(financialYear),
};

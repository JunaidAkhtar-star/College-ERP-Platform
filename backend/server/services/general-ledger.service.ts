import createError from "http-errors";
import { Types, type ClientSession } from "mongoose";
import {
  GeneralLedgerAccountModel,
  JournalEntryModel,
  type IJournalLine,
  type TAccountType,
} from "../models/general-ledger.model";
import { nextSeq } from "../models/counter.model";
import { AccountsTransactionModel } from "../models/accounts.model";
import { financeControlService } from "./finance-control.service";

interface IPostJournalInput {
  date: Date;
  financialYear: string;
  description: string;
  sourceType: string;
  sourceId: string | Types.ObjectId;
  sourceEvent: string;
  postedBy: string | Types.ObjectId;
  lines: Array<{
    accountCode: string;
    accountName: string;
    accountType: TAccountType;
    debit?: number;
    credit?: number;
    description?: string;
    partyId?: string | Types.ObjectId;
  }>;
}

function money(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export const generalLedgerService = {
  async postJournal(input: IPostJournalInput, session?: ClientSession) {
    if (!input.lines || input.lines.length < 2) {
      throw createError(400, "A journal entry requires at least two lines");
    }

    const lines: IJournalLine[] = input.lines.map((line) => {
      const debit = money(line.debit ?? 0);
      const credit = money(line.credit ?? 0);
      if (debit < 0 || credit < 0 || (debit === 0) === (credit === 0)) {
        throw createError(400, "Each journal line must contain one positive debit or credit");
      }
      return {
        accountCode: line.accountCode.toUpperCase(),
        accountName: line.accountName,
        debit,
        credit,
        description: line.description,
        partyId: line.partyId ? new Types.ObjectId(line.partyId) : undefined,
      };
    });

    const totalDebit = money(lines.reduce((sum, line) => sum + line.debit, 0));
    const totalCredit = money(lines.reduce((sum, line) => sum + line.credit, 0));
    if (totalDebit <= 0 || totalDebit !== totalCredit) {
      throw createError(400, "Journal entry debits and credits must balance");
    }
    await financeControlService.assertPostingAllowed(input.date, input.financialYear);

    await Promise.all(
      input.lines.map((line) =>
        GeneralLedgerAccountModel.updateOne(
          { code: line.accountCode.toUpperCase() },
          {
            $setOnInsert: {
              code: line.accountCode.toUpperCase(),
              name: line.accountName,
              type: line.accountType,
              isSystem: true,
              isActive: true,
            },
          },
          { upsert: true, session },
        ),
      ),
    );

    const sequence = await nextSeq(`journal:${input.financialYear}`);
    const voucherNumber = `JV-${input.financialYear.replace(/[^0-9]/g, "")}-${String(sequence).padStart(7, "0")}`;
    const [entry] = await JournalEntryModel.create(
      [
        {
          ...input,
          sourceId: new Types.ObjectId(input.sourceId),
          postedBy: new Types.ObjectId(input.postedBy),
          voucherNumber,
          status: "posted",
          lines,
          totalDebit,
          totalCredit,
        },
      ],
      { session },
    );
    return entry;
  },

  async reverseJournal(
    sourceType: string,
    sourceId: string | Types.ObjectId,
    reversedBy: string | Types.ObjectId,
    reason: string,
    session?: ClientSession,
  ) {
    const original = await JournalEntryModel.findOne({
      sourceType,
      sourceId: new Types.ObjectId(sourceId),
      status: "posted",
    }).session(session ?? null);
    if (!original) throw createError(404, "Posted journal entry not found or already reversed");
    const accountTypes = new Map(
      (
        await GeneralLedgerAccountModel.find({
          code: { $in: original.lines.map((line) => line.accountCode) },
        })
          .select("code type")
          .session(session ?? null)
          .lean()
      ).map((account) => [account.code, account.type]),
    );

    const reversal = await this.postJournal(
      {
        date: original.date,
        financialYear: original.financialYear,
        description: `Reversal of ${original.voucherNumber}: ${reason}`,
        sourceType: `${sourceType}Reversal`,
        sourceId,
        sourceEvent: `reverse:${original._id.toString()}`,
        postedBy: reversedBy,
        lines: original.lines.map((line) => ({
          accountCode: line.accountCode,
          accountName: line.accountName,
          accountType: accountTypes.get(line.accountCode) ?? "asset",
          debit: line.credit || undefined,
          credit: line.debit || undefined,
          description: reason,
          partyId: line.partyId,
        })),
      },
      session,
    );
    const updated = await JournalEntryModel.updateOne(
      { _id: original._id, status: "posted" },
      { $set: { status: "reversed", reversedBy, reversedAt: new Date() } },
      { session },
    );
    if (updated.modifiedCount !== 1) throw createError(409, "Journal was concurrently reversed");
    await JournalEntryModel.updateOne(
      { _id: reversal._id },
      { $set: { reversalOf: original._id } },
      { session },
    );
    return reversal;
  },

  postFeeCollection(
    input: {
      feeRecordId: string | Types.ObjectId;
      transactionId: string;
      receiptNumber: string;
      amount: number;
      paymentMode: string;
      paymentDate: Date;
      financialYear: string;
      studentId: string | Types.ObjectId;
      postedBy: string | Types.ObjectId;
    },
    session?: ClientSession,
  ) {
    const mode = input.paymentMode.toLowerCase();
    const isCash = mode === "cash";
    const legacyPaymentMode = mode.includes("upi")
      ? "upi"
      : mode.includes("cheque")
        ? "cheque"
        : mode.includes("draft") || mode === "dd"
          ? "dd"
          : isCash
            ? "cash"
            : "bank_transfer";
    return Promise.all([
      this.postJournal(
        {
          date: input.paymentDate,
          financialYear: input.financialYear,
          description: `Fee collection receipt ${input.receiptNumber}`,
          sourceType: "FeeRecord",
          sourceId: input.feeRecordId,
          sourceEvent: input.transactionId,
          postedBy: input.postedBy,
          lines: [
            {
              accountCode: isCash ? "1000-CASH" : "1010-BANK",
              accountName: isCash ? "Cash on Hand" : "Bank Account",
              accountType: "asset",
              debit: input.amount,
              partyId: input.studentId,
            },
            {
              accountCode: "4000-FEE-INCOME",
              accountName: "Academic Fee Income",
              accountType: "income",
              credit: input.amount,
              partyId: input.studentId,
            },
          ],
        },
        session,
      ),
      AccountsTransactionModel.create(
        [
          {
            transactionType: "income",
            category: "Academic Fee",
            subCategory: "Student Fee Collection",
            amount: money(input.amount),
            paymentMode: legacyPaymentMode,
            referenceNo: input.receiptNumber,
            description: `Fee collection receipt ${input.receiptNumber}`,
            relatedDocumentId: new Types.ObjectId(input.feeRecordId),
            relatedDocumentType: "FeeRecord",
            date: input.paymentDate,
            financialYear: input.financialYear,
            approvedBy: new Types.ObjectId(input.postedBy),
            createdBy: new Types.ObjectId(input.postedBy),
            externalSourceKey: `fee:${input.transactionId}`,
          },
        ],
        { session },
      ),
    ]);
  },

  postFeeRefund(
    input: {
      feeRecordId: string | Types.ObjectId;
      refundId: string | Types.ObjectId;
      reference: string;
      amount: number;
      financialYear: string;
      studentId: string | Types.ObjectId;
      postedBy: string | Types.ObjectId;
    },
    session?: ClientSession,
  ) {
    return Promise.all([
      this.postJournal(
        {
          date: new Date(),
          financialYear: input.financialYear,
          description: `Student fee refund ${input.reference}`,
          sourceType: "FeeRefund",
          sourceId: input.refundId,
          sourceEvent: `refund:${input.refundId.toString()}`,
          postedBy: input.postedBy,
          lines: [
            {
              accountCode: "4000-FEE-INCOME",
              accountName: "Academic Fee Income",
              accountType: "income",
              debit: input.amount,
              partyId: input.studentId,
            },
            {
              accountCode: "1010-BANK",
              accountName: "Bank Account",
              accountType: "asset",
              credit: input.amount,
              partyId: input.studentId,
            },
          ],
        },
        session,
      ),
      AccountsTransactionModel.create(
        [
          {
            transactionType: "expense",
            category: "Student Fee Refund",
            amount: money(input.amount),
            paymentMode: "bank_transfer",
            referenceNo: input.reference,
            description: `Student fee refund ${input.reference}`,
            relatedDocumentId: new Types.ObjectId(input.feeRecordId),
            relatedDocumentType: "FeeRecord",
            date: new Date(),
            financialYear: input.financialYear,
            approvedBy: new Types.ObjectId(input.postedBy),
            createdBy: new Types.ObjectId(input.postedBy),
            externalSourceKey: `fee-refund:${input.refundId.toString()}`,
          },
        ],
        { session },
      ),
    ]);
  },

  postPayrollPayment(
    input: {
      payslipId: string | Types.ObjectId;
      employeeId: string | Types.ObjectId;
      employeeName: string;
      netPay: number;
      paymentMode: string;
      paymentDate: Date;
      financialYear: string;
      postedBy: string | Types.ObjectId;
    },
    session?: ClientSession,
  ) {
    const isCash = input.paymentMode.toLowerCase() === "cash";
    return Promise.all([
      this.postJournal(
        {
          date: input.paymentDate,
          financialYear: input.financialYear,
          description: `Salary payment to ${input.employeeName}`,
          sourceType: "Payslip",
          sourceId: input.payslipId,
          sourceEvent: `pay:${input.payslipId.toString()}`,
          postedBy: input.postedBy,
          lines: [
            {
              accountCode: "5000-SALARY-EXPENSE",
              accountName: "Salary Expense",
              accountType: "expense",
              debit: input.netPay,
              partyId: input.employeeId,
            },
            {
              accountCode: isCash ? "1000-CASH" : "1010-BANK",
              accountName: isCash ? "Cash on Hand" : "Bank Account",
              accountType: "asset",
              credit: input.netPay,
              partyId: input.employeeId,
            },
          ],
        },
        session,
      ),
      AccountsTransactionModel.create(
        [
          {
            transactionType: "expense",
            category: "Salary",
            subCategory: "Employee Payroll",
            amount: money(input.netPay),
            paymentMode: isCash ? "cash" : "bank_transfer",
            referenceNo: `PAY-${input.payslipId.toString()}`,
            description: `Salary payment to ${input.employeeName}`,
            relatedDocumentId: new Types.ObjectId(input.payslipId),
            relatedDocumentType: "Payslip",
            date: input.paymentDate,
            financialYear: input.financialYear,
            approvedBy: new Types.ObjectId(input.postedBy),
            createdBy: new Types.ObjectId(input.postedBy),
            externalSourceKey: `payroll:${input.payslipId.toString()}`,
          },
        ],
        { session },
      ),
    ]);
  },

  postScholarshipPayment(
    input: {
      scholarshipId: string | Types.ObjectId;
      studentId: string | Types.ObjectId;
      scholarshipName: string;
      amount: number;
      referenceNo: string;
      paymentDate: Date;
      financialYear: string;
      postedBy: string | Types.ObjectId;
    },
    session?: ClientSession,
  ) {
    return Promise.all([
      this.postJournal(
        {
          date: input.paymentDate,
          financialYear: input.financialYear,
          description: `Scholarship payment: ${input.scholarshipName}`,
          sourceType: "Scholarship",
          sourceId: input.scholarshipId,
          sourceEvent: `disburse:${input.referenceNo}`,
          postedBy: input.postedBy,
          lines: [
            {
              accountCode: "5100-SCHOLARSHIP-EXPENSE",
              accountName: "Scholarship and Student Aid Expense",
              accountType: "expense",
              debit: input.amount,
              partyId: input.studentId,
            },
            {
              accountCode: "1010-BANK",
              accountName: "Bank Account",
              accountType: "asset",
              credit: input.amount,
              partyId: input.studentId,
            },
          ],
        },
        session,
      ),
      AccountsTransactionModel.create(
        [
          {
            transactionType: "expense",
            category: "Scholarship",
            subCategory: input.scholarshipName,
            amount: money(input.amount),
            paymentMode: "bank_transfer",
            referenceNo: input.referenceNo,
            description: `Scholarship payment: ${input.scholarshipName}`,
            relatedDocumentId: new Types.ObjectId(input.scholarshipId),
            relatedDocumentType: "Scholarship",
            date: input.paymentDate,
            financialYear: input.financialYear,
            approvedBy: new Types.ObjectId(input.postedBy),
            createdBy: new Types.ObjectId(input.postedBy),
            externalSourceKey: `scholarship:${input.scholarshipId.toString()}`,
          },
        ],
        { session },
      ),
    ]);
  },

  postLibraryFineCollection(
    input: {
      issueId: string | Types.ObjectId;
      memberId: string | Types.ObjectId;
      paymentId: string;
      amount: number;
      paymentMode: "cash" | "bank_transfer" | "upi";
      paymentDate: Date;
      financialYear: string;
      postedBy: string | Types.ObjectId;
      referenceNo?: string;
    },
    session?: ClientSession,
  ) {
    const isCash = input.paymentMode === "cash";
    return Promise.all([
      this.postJournal(
        {
          date: input.paymentDate,
          financialYear: input.financialYear,
          description: `Library overdue fine ${input.paymentId}`,
          sourceType: "BookIssue",
          sourceId: input.issueId,
          sourceEvent: input.paymentId,
          postedBy: input.postedBy,
          lines: [
            {
              accountCode: isCash ? "1000-CASH" : "1010-BANK",
              accountName: isCash ? "Cash on Hand" : "Bank Account",
              accountType: "asset",
              debit: input.amount,
              partyId: input.memberId,
            },
            {
              accountCode: "4020-LIBRARY-FINE",
              accountName: "Library Fine Income",
              accountType: "income",
              credit: input.amount,
              partyId: input.memberId,
            },
          ],
        },
        session,
      ),
      AccountsTransactionModel.create(
        [
          {
            transactionType: "income",
            category: "Other Income",
            subCategory: "Library Fine",
            amount: money(input.amount),
            paymentMode: input.paymentMode,
            referenceNo: input.referenceNo ?? input.paymentId,
            description: `Library overdue fine ${input.paymentId}`,
            relatedDocumentId: new Types.ObjectId(input.issueId),
            relatedDocumentType: "BookIssue",
            date: input.paymentDate,
            financialYear: input.financialYear,
            approvedBy: new Types.ObjectId(input.postedBy),
            createdBy: new Types.ObjectId(input.postedBy),
            externalSourceKey: `library-fine:${input.paymentId}`,
          },
        ],
        { session },
      ),
    ]);
  },

  postHostelFeeCollection(
    input: {
      hostelFeeId: string | Types.ObjectId;
      studentId: string | Types.ObjectId;
      paymentId: string;
      receiptNo: string;
      amount: number;
      paymentMode: string;
      paymentDate: Date;
      financialYear: string;
      postedBy: string | Types.ObjectId;
    },
    session?: ClientSession,
  ) {
    const mode = input.paymentMode.toLowerCase();
    const isCash = mode === "cash";
    const legacyMode =
      mode === "upi"
        ? "upi"
        : mode === "dd"
          ? "dd"
          : mode === "cheque"
            ? "cheque"
            : isCash
              ? "cash"
              : "bank_transfer";
    return Promise.all([
      this.postJournal(
        {
          date: input.paymentDate,
          financialYear: input.financialYear,
          description: `Hostel fee receipt ${input.receiptNo}`,
          sourceType: "HostelFee",
          sourceId: input.hostelFeeId,
          sourceEvent: input.paymentId,
          postedBy: input.postedBy,
          lines: [
            {
              accountCode: isCash ? "1000-CASH" : "1010-BANK",
              accountName: isCash ? "Cash on Hand" : "Bank Account",
              accountType: "asset",
              debit: input.amount,
              partyId: input.studentId,
            },
            {
              accountCode: "4010-HOSTEL-INCOME",
              accountName: "Hostel and Mess Fee Income",
              accountType: "income",
              credit: input.amount,
              partyId: input.studentId,
            },
          ],
        },
        session,
      ),
      AccountsTransactionModel.create(
        [
          {
            transactionType: "income",
            category: "Hostel Fee",
            subCategory: "Hostel and Mess Collection",
            amount: money(input.amount),
            paymentMode: legacyMode,
            referenceNo: input.receiptNo,
            description: `Hostel fee receipt ${input.receiptNo}`,
            relatedDocumentId: new Types.ObjectId(input.hostelFeeId),
            relatedDocumentType: "HostelFee",
            date: input.paymentDate,
            financialYear: input.financialYear,
            approvedBy: new Types.ObjectId(input.postedBy),
            createdBy: new Types.ObjectId(input.postedBy),
            externalSourceKey: `hostel-fee:${input.paymentId}`,
          },
        ],
        { session },
      ),
    ]);
  },

  postTransportFeeCollection(
    input: {
      transportFeeId: string | Types.ObjectId;
      studentId: string | Types.ObjectId;
      paymentId: string;
      receiptNo: string;
      amount: number;
      paymentMode: string;
      paymentDate: Date;
      financialYear: string;
      postedBy: string | Types.ObjectId;
    },
    session?: ClientSession,
  ) {
    const mode = input.paymentMode.toLowerCase();
    const isCash = mode === "cash";
    const legacyMode =
      mode === "upi"
        ? "upi"
        : mode === "dd"
          ? "dd"
          : mode === "cheque"
            ? "cheque"
            : isCash
              ? "cash"
              : "bank_transfer";
    return Promise.all([
      this.postJournal(
        {
          date: input.paymentDate,
          financialYear: input.financialYear,
          description: `Transport fee receipt ${input.receiptNo}`,
          sourceType: "TransportFee",
          sourceId: input.transportFeeId,
          sourceEvent: input.paymentId,
          postedBy: input.postedBy,
          lines: [
            {
              accountCode: isCash ? "1000-CASH" : "1010-BANK",
              accountName: isCash ? "Cash on Hand" : "Bank Account",
              accountType: "asset",
              debit: input.amount,
              partyId: input.studentId,
            },
            {
              accountCode: "4030-TRANSPORT-INCOME",
              accountName: "Transport Fee Income",
              accountType: "income",
              credit: input.amount,
              partyId: input.studentId,
            },
          ],
        },
        session,
      ),
      AccountsTransactionModel.create(
        [
          {
            transactionType: "income",
            category: "Transport Fee",
            subCategory: "Student Transport Collection",
            amount: money(input.amount),
            paymentMode: legacyMode,
            referenceNo: input.receiptNo,
            description: `Transport fee receipt ${input.receiptNo}`,
            relatedDocumentId: new Types.ObjectId(input.transportFeeId),
            relatedDocumentType: "TransportFee",
            date: input.paymentDate,
            financialYear: input.financialYear,
            approvedBy: new Types.ObjectId(input.postedBy),
            createdBy: new Types.ObjectId(input.postedBy),
            externalSourceKey: `transport-fee:${input.paymentId}`,
          },
        ],
        { session },
      ),
    ]);
  },

  listJournals(filter: Record<string, unknown>, page = 1, limit = 20) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);
    return Promise.all([
      JournalEntryModel.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean(),
      JournalEntryModel.countDocuments(filter),
    ]).then(([data, total]) => ({
      data,
      total,
      page: safePage,
      limit: safeLimit,
      pages: Math.ceil(total / safeLimit),
    }));
  },

  async trialBalance(financialYear: string) {
    const rows = await JournalEntryModel.aggregate([
      { $match: { financialYear, status: { $in: ["posted", "reversed"] } } },
      { $unwind: "$lines" },
      {
        $group: {
          _id: { code: "$lines.accountCode", name: "$lines.accountName" },
          debit: { $sum: "$lines.debit" },
          credit: { $sum: "$lines.credit" },
        },
      },
      { $sort: { "_id.code": 1 } },
    ]);
    const totalDebit = money(rows.reduce((sum, row) => sum + row.debit, 0));
    const totalCredit = money(rows.reduce((sum, row) => sum + row.credit, 0));
    return { rows, totalDebit, totalCredit, balanced: totalDebit === totalCredit };
  },
};

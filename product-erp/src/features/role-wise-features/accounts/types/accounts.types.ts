/**
 * @file accounts.types.ts
 * @description TypeScript interfaces for the Accounts / Finance module.
 *              Field names match the backend AccountsTransaction Mongoose schema exactly.
 * @module features/role-wise-features/accounts/types
 */

// ── Enums (match backend enum strings exactly) ────────────────────────────────
export type TTransactionType = 'income' | 'expense';
export type TPaymentMode = 'cash' | 'bank_transfer' | 'cheque' | 'upi' | 'dd';

// ── Populated department reference ───────────────────────────────────────────
export interface IDeptRef {
  _id: string;
  name: string;
  code: string;
}

// ── Core transaction document ────────────────────────────────────────────────
export interface IAccountTransaction {
  _id: string;
  transactionType: TTransactionType;
  category: string;
  subCategory?: string;
  amount: number;
  paymentMode: TPaymentMode;
  referenceNo?: string;
  description: string;
  departmentId?: IDeptRef | string;
  relatedDocumentId?: string;
  relatedDocumentType?: string;
  date: string; // ISO string from backend
  financialYear: string; // e.g. "2025-26"
  budgetHead?: string;
  approvedBy?: string;
  receiptUrl?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown; // required for CustomTable generic constraint
}

export interface IAccountingPeriod {
  _id: string;
  financialYear: string;
  period: number;
  startsAt: string;
  endsAt: string;
  status: 'open' | 'soft_closed' | 'closed';
  closeReason?: string;
  [key: string]: unknown;
}

export interface IFinanceBudget {
  _id: string;
  financialYear: string;
  budgetHead: string;
  departmentId?: IDeptRef;
  approvedAmount: number;
  encumberedAmount: number;
  consumedAmount: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'closed';
  [key: string]: unknown;
}

export interface IBankStatementLine {
  _id: string;
  bankAccountCode: string;
  statementReference: string;
  transactionDate: string;
  amount: number;
  direction: 'credit' | 'debit';
  description: string;
  status: 'unmatched' | 'matched' | 'exception';
  journalEntryId?: { _id: string; voucherNumber: string };
  [key: string]: unknown;
}

export interface IJournalEntry {
  _id: string;
  voucherNumber: string;
  date: string;
  description: string;
  sourceType: string;
  status: 'posted' | 'reversed';
  totalDebit: number;
  [key: string]: unknown;
}

// ── POST / PUT body ───────────────────────────────────────────────────────────
export interface ICreateTransactionDto {
  transactionType: TTransactionType;
  category: string;
  subCategory?: string;
  amount: number | string;
  paymentMode: TPaymentMode;
  referenceNo?: string;
  description: string;
  departmentId?: string;
  date: string;
  financialYear: string;
  budgetHead?: string;
}

// ── GET /accounts response ────────────────────────────────────────────────────
export interface IAccountListResponse {
  success: boolean;
  data: IAccountTransaction[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ── GET /accounts/balance response ───────────────────────────────────────────
export interface IBalanceResponse {
  success: boolean;
  data: {
    income: number;
    expense: number;
    balance: number;
  };
}

// ── GET /accounts/summary response ───────────────────────────────────────────
export interface ISummaryItem {
  _id: { type: TTransactionType; category: string };
  total: number;
  count: number;
}

// ── GET /accounts/monthly-flow response ──────────────────────────────────────
export interface IMonthlyFlowItem {
  _id: { type: TTransactionType; month: number; year: number };
  total: number;
}

// ── GET /accounts/:id response ────────────────────────────────────────────────
export interface IAccountDetailResponse {
  success: boolean;
  data: IAccountTransaction;
}

// ── Payment Submissions (student fee proof verification queue) ───────────────
export type TSubmissionStatus =
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'resubmit_required';

export interface IPaymentSubmission {
  _id: string;
  feeRecordId: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  program: string;
  branch: string;
  semester: number;
  academicYear: string;
  amountSubmitted: number;
  paymentMode: TPaymentMode;
  paymentDate: string;
  utrNumber?: string;
  bankReference?: string;
  screenshotUrl?: string;
  status: TSubmissionStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewRemarks?: string;
  officialReceiptUrl?: string;
  officialInvoiceNumber?: string;
  officialReceiptNumber?: string;
  approvalReferenceNo?: string;
  ddNumber?: string;
  chequeNumber?: string;
  resubmissionCount: number;
  [key: string]: unknown;
}

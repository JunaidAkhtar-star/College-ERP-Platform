/**
 * @file Fee.types.ts
 * @description TypeScript interfaces for the Fee Management module.
 * @module features/role-wise-features/fee/types
 */

export type TFeePaymentStatus = 'Pending' | 'Partial' | 'Paid' | 'Overdue' | 'Waived' | 'Refunded';
export type TFeePaymentMode =
  | 'Cash'
  | 'Demand Draft'
  | 'DD'
  | 'NEFT'
  | 'RTGS'
  | 'IMPS'
  | 'UPI'
  | 'Net Banking'
  | 'Card'
  | 'Cheque'
  | 'Online Portal';

export interface IFeeTransaction {
  transactionId?: string;
  receiptNumber?: string;
  amountPaid: number;
  paymentMode: TFeePaymentMode;
  paymentDate: string;
  bankRef?: string;
  remarks?: string;
}

export interface IFeeRecord {
  [key: string]: unknown;
  _id: string;
  studentId: string;
  rollNumber: string;
  studentName: string;
  program: string;
  branch: string;
  semester: number;
  academicYear: string;
  invoiceNumber: string;
  dueDate: string;
  grossAmount: number;
  totalConcession: number;
  totalScholarship: number;
  netDue: number;
  totalPaid: number;
  balanceDue: number;
  lateFee: number;
  status: TFeePaymentStatus;
  transactions: IFeeTransaction[];
  createdAt: string;
}

export interface IFeeStructure {
  [key: string]: unknown;
  _id: string;
  program: string;
  branch: string;
  curriculumId?: string;
  departmentId?: string;
  batchId?: string;
  semester: number;
  academicYear: string;
  admissionType: string;
  category: string;
  feeItems: { type: string; description?: string; amount: number }[];
  createdAt: string;
}

export interface IRecordPaymentDto {
  amount: number;
  paymentMode: TFeePaymentMode | '';
  bankRef: string;
  remarks: string;
}

export interface IPaymentInput {
  amount: number;
  paymentMode: string;
  bankRef: string;
  remarks: string;
}

export interface IFeeStructureFeeItem {
  type: string;
  description?: string;
  amount: number;
}

export interface IFeeStructureFormDto {
  curriculumId: string;
  departmentId: string;
  batchId: string;
  program: string;
  branch: string;
  semester: number;
  academicYear: string;
  category: string;
  feeItems: IFeeStructureFeeItem[];
}

export interface IScholarshipInput {
  type: string;
  body?: string;
  amount: number;
  reference?: string;
}

export interface IGenerateInvoiceDto {
  studentId: string;
  studentProfileId?: string;
  rollNumber: string;
  studentName: string;
  fatherName?: string;
  studentEmail?: string;
  program: string;
  branch: string;
  semester: number;
  academicYear: string;
  category: string;
  dueDate: string;
  scholarships: IScholarshipInput[];
}

export interface IFeeCollectionSummaryBucket {
  _id: TFeePaymentStatus;
  count: number;
  totalDue: number;
  totalPaid: number;
  totalBalance: number;
}

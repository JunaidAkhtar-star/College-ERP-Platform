export type TPaymentMode = 'bank_transfer' | 'cash' | 'cheque';

export interface IPayslip {
  [key: string]: unknown;
  _id: string;
  employeeId: string;
  employeeName: string;
  designation: string;
  departmentId: string;
  month: number;
  year: number;
  presentDays: number;
  absentDays: number;
  lopDays: number;
  payableDays: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  pfAmount: number;
  ptAmount: number;
  tdsAmount: number;
  bankAccount?: string;
  pfAccountNo?: string;
  paymentDate?: string;
  paymentMode?: TPaymentMode;
  isGenerated: boolean;
  isPaid: boolean;
  status: 'draft' | 'reviewed' | 'approved' | 'paid';
  pdfUrl?: string;
  generatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface IGeneratePayrollDto {
  month: number;
  year: number;
  employeeIds?: string[];
}

export interface IMarkPaidDto {
  paymentMode: TPaymentMode;
  paymentDate: string;
}

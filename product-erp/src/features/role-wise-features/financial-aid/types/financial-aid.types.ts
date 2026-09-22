export type TFinancialAidType = 'grant' | 'scholarship' | 'loan' | 'work_study';
export interface IFinancialAidFund {
  _id: string;
  code: string;
  name: string;
  type: TFinancialAidType;
  source: string;
  academicYear: string;
  disbursementMode: 'fee_credit' | 'bank_transfer';
  budgetAmount: number;
  reservedAmount: number;
  disbursedAmount: number;
  maxPerStudent: number;
  isNeedBased: boolean;
}
export interface IFinancialAidItem {
  _id: string;
  fundId: string;
  fundCode: string;
  fundName: string;
  type: TFinancialAidType;
  disbursementMode: 'fee_credit' | 'bank_transfer';
  offeredAmount: number;
  acceptedAmount: number;
  disbursedAmount: number;
  status: 'offered' | 'accepted' | 'declined' | 'disbursed';
  referenceNo?: string;
}
export interface IFinancialAidPackage extends Record<string, unknown> {
  _id: string;
  packageNumber: string;
  studentProfileId:
    | string
    | { _id: string; firstName: string; lastName?: string; rollNumber: string; program: string };
  academicYear: string;
  costOfAttendance: number;
  studentContribution: number;
  demonstratedNeed: number;
  status:
    | 'draft'
    | 'offered'
    | 'accepted'
    | 'declined'
    | 'partially_disbursed'
    | 'disbursed'
    | 'cancelled';
  items: IFinancialAidItem[];
  offeredAt?: string;
  acceptedAt?: string;
}
export interface IFinancialAidList {
  data: IFinancialAidPackage[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

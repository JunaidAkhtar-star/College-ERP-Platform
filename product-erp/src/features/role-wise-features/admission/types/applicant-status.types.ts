/**
 * @file applicant-status.types.ts
 * @description Types for the applicant-facing status view (admission portal).
 * @module features/role-wise-features/admission/types
 */

export type TApplicantStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'enrolled'
  | 'withdrawn'
  // Deprecated values retained so legacy records still render correctly:
  | 'document_verification'
  | 'merit_list'
  | 'counseling_scheduled'
  | 'seat_allocated'
  | 'pending_approval'
  | 'fee_pending';

export interface IApplicantApprovalStep {
  role: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedAt?: string;
  remarks?: string;
}

export interface IApplicantDocFile {
  url: string;
  name?: string;
}

export interface IApplicantDocChecklistItem {
  docType: string;
  status?: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string;
  uploadedFileUrl?: string;
  files?: IApplicantDocFile[];
}

export interface IApplicantPaymentDetails {
  amountInNumber?: number;
  transactionId?: string;
  paidAt?: string;
  screenshotUrl?: string;
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  verificationRemarks?: string;
}

export interface IApplicantApplication {
  _id: string;
  applicationNumber: string;
  status: string;
  candidateName: string;
  submittedAt?: string;
  meritRank?: number;
  counselingSchedule?: { date?: string; venue?: string; time?: string };
  allocatedSeat?: { program?: string; department?: string };
  approvals?: IApplicantApprovalStep[];
  rejectionReason?: string;
  documentChecklist?: IApplicantDocChecklistItem[];
  paymentDetails?: IApplicantPaymentDetails;
  onboardStatus?: 'pending' | 'hosteller' | 'day_scholar';
  transportOption?: 'bus' | 'own';
}

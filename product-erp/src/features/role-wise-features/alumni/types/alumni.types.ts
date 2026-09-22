export interface IHigherStudies {
  institution: string;
  program: string;
  year: number;
}

export interface IAlumni extends Record<string, unknown> {
  _id: string;
  userId?: string;
  fullName: string;
  email: string;
  phone?: string;
  program: string;
  branch: string;
  passoutYear: number;
  rollNumber?: string;
  registrationNo?: string;
  currentEmployer?: string;
  currentDesignation?: string;
  currentLocation?: string;
  linkedinUrl?: string;
  higherStudies?: IHigherStudies;
  isPlaced: boolean;
  package?: number;
  skills: string[];
  isVerified: boolean;
  verificationSource?: 'academic_completion' | 'legacy_review';
  careerOutcomeVerified: boolean;
  profileImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IGraduationCandidate extends Record<string, unknown> {
  studentProfileId: string;
  studentId: string;
  fullName: string;
  rollNumber: string;
  program: string;
  batch: string;
  currentSemester: number;
  eligible: boolean;
  blockers: string[];
}

export type TDonationStatus = 'pending' | 'confirmed' | 'failed';
export type TDonationPaymentMethod = 'online' | 'cheque' | 'dd' | 'cash';

export interface IDonation extends Record<string, unknown> {
  _id: string;
  alumniId: string | { _id: string; fullName?: string; email?: string };
  amount: number;
  currency: 'INR';
  purpose: string;
  paymentMethod: TDonationPaymentMethod;
  transactionId?: string;
  status: TDonationStatus;
  donatedAt: string;
  receiptNumber?: string;
  accountingVerified: boolean;
  failureReason?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IDonationStat {
  _id: string;
  total: number;
  count: number;
}

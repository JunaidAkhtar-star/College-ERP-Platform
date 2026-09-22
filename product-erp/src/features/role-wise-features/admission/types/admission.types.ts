export type TApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'enrolled'
  | 'withdrawn'
  // Deprecated values retained so older records continue to render correctly:
  | 'document_verification'
  | 'merit_list'
  | 'counseling_scheduled'
  | 'seat_allocated'
  | 'pending_approval'
  | 'fee_pending';

export type TAcademicProgram = string;

export type TAdmissionType = 'regular' | 'lateral_entry';
export type TAdmissionCategory = 'sc' | 'st' | 'obc' | 'sebc' | 'general' | 'ph';
export type TEntranceExam = 'OJEE' | 'JEE_MAIN' | 'CAT' | 'MAT' | 'ATMA' | 'OTHER';

export interface IAddress {
  line1: string;
  line2?: string;
  city: string;
  district?: string;
  state: string;
  pincode: string;
  country: string;
}

export interface IEntranceExamDetail {
  exam: TEntranceExam;
  otherName?: string;
  applicationNo?: string;
  rank?: number;
  percentile?: number;
  score?: number;
  year: number;
}

export interface IAcademicRecord {
  level: '10th' | '12th_or_diploma' | 'degree';
  boardOrUniversity: string;
  instituteName: string;
  yearOfPassing: number;
  percentageOfMarks: number;
}

export interface IParentInfo {
  fatherName: string;
  fatherOccupation?: string;
  fatherPhone?: string;
  motherName: string;
  motherOccupation?: string;
  motherPhone?: string;
  guardianName?: string;
  annualIncome?: number;
}

export interface IDocumentChecklistItem {
  docType:
    | 'hsc_10th_certificate'
    | 'plus_two_marksheet'
    | 'plus_two_certificate'
    | 'plus_three_marksheet'
    | 'plus_three_certificate'
    | 'school_leaving_certificate'
    | 'aadhaar_card'
    | 'caste_certificate'
    | 'residence_certificate'
    | 'income_certificate'
    | 'anti_ragging_student'
    | 'anti_ragging_guardian'
    | 'passport_photo'
    | 'apaar_id'
    | string;
  originalSubmitted: boolean;
  photocopySubmitted: boolean;
  status?: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  remarks?: string;
  uploadedFileUrl?: string;
  files?: Array<{
    url: string;
    publicId?: string;
    name?: string;
    mimeType?: string;
    size?: number;
    uploadedAt?: string;
  }>;
}

export interface IPaymentDetails {
  amountInNumber?: number;
  amountInWords?: string;
  receiptNo?: string;
  receiptDate?: string;
  paymentMode?: 'cash' | 'upi' | 'net_banking' | 'card';
  collectedBy?: string;
  transactionId?: string;
  paidAt?: string;
  screenshotUrl?: string;
  screenshotPublicId?: string;
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  verificationRemarks?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface IApprovalStep {
  role: string;
  approvedBy?: string;
  approvedByName?: string;
  status: 'pending' | 'approved' | 'rejected';
  remarks?: string;
  actionedAt?: string;
}

export interface IAdmissionApplication {
  [key: string]: unknown;
  _id: string;
  applicationNumber: string;
  academicYear: string;
  session?: string;
  admissionType: TAdmissionType;
  programPreferences: TAcademicProgram[];
  allocatedProgram?: TAcademicProgram;

  // Personal
  candidateName: string;
  fatherName: string;
  motherName: string;
  dateOfBirth: string;
  gender: 'male' | 'female';
  nationality: string;
  religion?: string;
  category: TAdmissionCategory;
  aadhaarNumber?: string;
  bloodGroup?: string;

  // Contact
  email: string;
  phone: string;
  whatsappPhone?: string;
  parentPhone?: string;
  guardianPhone?: string;

  permanentAddress: IAddress;
  presentAddress: IAddress;

  academicRecords: IAcademicRecord[];
  entranceExam?: IEntranceExamDetail;

  parentInfo?: IParentInfo;
  documentChecklist?: IDocumentChecklistItem[];
  paymentDetails?: IPaymentDetails;
  approvalChain?: IApprovalStep[];

  status: TApplicationStatus;
  meritRank?: number;
  submittedAt?: string;
  enrolledAt?: string;
  registrationNumber?: string;
  // counselingDate is not in the DB model — backend sets status only

  onboardStatus?: 'pending' | 'hosteller' | 'day_scholar';
  transportOption?: 'bus' | 'own';

  createdAt: string;
  updatedAt: string;
}

export interface IAdmissionResponse {
  applications: IAdmissionApplication[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IAdmissionFilters {
  status?: TApplicationStatus;
  academicYear?: string;
  program?: TAcademicProgram;
  category?: TAdmissionCategory;
  search?: string;
}

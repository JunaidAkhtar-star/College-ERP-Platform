export type TStudentStatus =
  | 'active'
  | 'detained'
  | 'dropped'
  | 'passed_out'
  | 'transferred'
  | 'lateral_promoted'
  | 'rusticated';

export interface IStudentAddress {
  line1: string;
  line2?: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  country: string;
}

export interface IParentInfo {
  fatherName: string;
  fatherOccupation?: string;
  fatherPhone: string;
  fatherEmail?: string;
  motherName: string;
  motherOccupation?: string;
  motherPhone?: string;
  motherEmail?: string;
  guardianName?: string;
  guardianPhone?: string;
  annualFamilyIncome?: number;
}

export interface ISemesterResult {
  semesterNo: number;
  academicYear: string;
  sgpa?: number;
  cgpa?: number;
  totalCredits?: number;
  creditsEarned?: number;
  backlogs: number;
  result: 'pass' | 'fail' | 'withheld' | 'absent';
  marksheetUrl?: string;
}

export interface IAcademicRecord {
  level: '10th' | '12th_or_diploma' | 'graduation' | 'post_graduation';
  examName: string;
  boardOrUniversity: string;
  instituteName: string;
  passingYear: number;
  percentage: number;
  verified: boolean;
}

export interface IDocumentChecklistItem {
  docType: string;
  originalSubmitted?: boolean;
  photocopySubmitted?: boolean;
  status?: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string;
  uploadedFileUrl?: string;
  uploadedFilePublicId?: string;
  files?: Array<{
    url: string;
    publicId?: string;
    name?: string;
    mimeType?: string;
    size?: number;
    uploadedAt?: string;
  }>;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface IStudentProfile {
  _id: string;
  rollNumber: string;
  registrationNumber?: string;
  enrollmentNumber?: string;
  aadhaarNumber?: string;
  abcId?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  bloodGroup?: string;
  nationality?: string;
  religion?: string;
  caste?: string;
  motherTongue?: string;
  maritalStatus?: 'single' | 'married';
  isPhysicallyChallenged?: boolean;
  pcDisabilityType?: string;
  pcPercentage?: number;
  passportNumber?: string;
  category: string;
  program: string;
  admissionType: string;
  batch: string;
  academicYear: string;
  currentSemester: number;
  currentYear: number;
  section?: string;
  status: TStudentStatus;
  personalEmail?: string;
  collegeEmail: string;
  phone: string;
  whatsappPhone?: string;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactPhone?: string;
  permanentAddress: IStudentAddress;
  currentAddress?: IStudentAddress;
  parentInfo: IParentInfo;
  semesterResults: ISemesterResult[];
  academicRecords: IAcademicRecord[];
  documents?: IDocumentChecklistItem[];
  currentCgpa?: number;
  totalBacklogs: number;
  passportPhotoUrl?: string;
  isPlacementEligible?: boolean;
  placedCompany?: string;
  placementPackage?: number;
  achievements?: string[];
  remarks?: string;
  department?: { _id: string; name: string } | string;
  userId?: string;
  admissionDate?: string;
  entranceExam?: string;
  entranceRank?: number;
  entranceScore?: number;
  /** Populated linked admission application — includes uploaded documents. */
  admissionApplicationId?:
    | string
    | {
        _id: string;
        applicationNumber?: string;
        passportPhotoUrl?: string;
        documentChecklist?: IDocumentChecklistItem[];
      };
  createdAt?: string;
  [key: string]: unknown;
}

export interface IStudentStats {
  total: number;
  active: number;
  detained: number;
  passedOut: number;
  byProgram?: Record<string, number>;
  bySemester?: Record<string, number>;
}

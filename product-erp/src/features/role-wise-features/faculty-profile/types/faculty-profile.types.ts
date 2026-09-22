export type TFacultyStatus =
  | 'active'
  | 'on_leave'
  | 'suspended'
  | 'resigned'
  | 'retired'
  | 'terminated';
export type TEmploymentType = 'permanent' | 'contractual' | 'visiting' | 'adhoc' | 'guest_faculty';

export interface IFacultyAddress {
  line1: string;
  line2?: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  country: string;
}

export interface IQualificationDetail {
  degree: string;
  specialization: string;
  instituteName: string;
  university: string;
  passingYear: number;
  percentage?: number;
  verified: boolean;
}

export interface IExperienceRecord {
  organizationName: string;
  designation: string;
  experienceType: 'teaching' | 'industry' | 'research';
  fromDate: string;
  toDate?: string;
  isCurrent: boolean;
}

export interface IResearchPublication {
  title: string;
  type: 'journal' | 'conference' | 'book' | 'book_chapter' | 'patent';
  publishedIn: string;
  year: number;
  doi?: string;
  impactFactor?: number;
  indexed?: string;
}

export interface ITrainingRecord {
  programName: string;
  organizingBody: string;
  type: 'fdp' | 'workshop' | 'seminar' | 'conference' | 'certification' | 'other';
  fromDate: string;
  toDate: string;
  durationDays?: number;
  certificateUrl?: string;
}

export interface IAppraisalRecord {
  academicYear: string;
  apiScore?: number;
  finalScore?: number;
  grade?: string;
  remarks?: string;
}

export interface IFacultyProfile {
  [key: string]: unknown;
  _id: string;
  employeeId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  bloodGroup?: string;
  category: string;
  nationality?: string;
  caste?: string;
  isPhysicallyChallenged?: boolean;
  spouseOccupation?: string;
  numberOfChildren?: number;
  motherTongue?: string;
  passportExpiryDate?: string;
  designation: string;
  employmentType: TEmploymentType;
  status: TFacultyStatus;
  department?: { _id: string; name: string; code?: string } | string;
  joiningDate: string;
  confirmationDate?: string;
  probationEndDate?: string;
  contractEndDate?: string;
  retirementDate?: string;
  collegeEmail: string;
  personalEmail?: string;
  phone: string;
  alternatePhone?: string;
  qualifications: IQualificationDetail[];
  experience: IExperienceRecord[];
  experienceRecords?: IExperienceRecord[];
  publications: IResearchPublication[];
  trainings: ITrainingRecord[];
  trainingRecords?: ITrainingRecord[];
  appraisals: IAppraisalRecord[];
  highestQualification?: string;
  specialization?: string;
  permanentAddress?: IFacultyAddress;
  currentAddress?: IFacultyAddress;
  whatsappPhone?: string;
  religion?: string;
  maritalStatus?: string;
  spouseName?: string;
  passportNumber?: string;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactPhone?: string;
  passportPhotoUrl?: string;
  totalTeachingExperience?: number;
  totalIndustryExperience?: number;
  totalResearchExperience?: number;
  totalTeachingExperienceYears?: number;
  totalIndustryExperienceYears?: number;
  guidingPhDStudents?: number;
  guidingPGStudents?: number;
  patentsGranted?: number;
  patentsFiled?: number;
  projectsGuided?: number;
  consultancyProjects?: number;
  currentApiScore?: number;
  totalFdpDays?: number;
  additionalResponsibilities?: string[];
  committeeMemberships?: string[];
  isMentor?: boolean;
  aadhaarNumber?: string;
  panNumber?: string;
  pfAccountNo?: string;
  biometricId?: string;
  remarks?: string;
  userId?: string;
  createdAt?: string;
}

export interface IFacultyStats {
  total: number;
  active: number;
  byDesignation?: Record<string, number>;
  byDepartment?: Record<string, number>;
  byEmploymentType?: Record<string, number>;
}

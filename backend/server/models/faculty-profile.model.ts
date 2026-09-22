import { auditPlugin } from "../plugins/audit.plugin";
import mongoose, { Schema, type Document, type Types } from "mongoose";
import { AdmissionCategory } from "./admission-application.model";

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

export enum EmploymentType {
  PERMANENT = "permanent",
  CONTRACTUAL = "contractual",
  VISITING = "visiting",
  ADHOC = "adhoc",
  GUEST_FACULTY = "guest_faculty",
}

export enum FacultyStatus {
  ACTIVE = "active",
  ON_LEAVE = "on_leave",
  SUSPENDED = "suspended",
  RESIGNED = "resigned",
  RETIRED = "retired",
  TERMINATED = "terminated",
}

export enum Designation {
  PROFESSOR = "professor",
  ASSOCIATE_PROFESSOR = "associate_professor",
  ASSISTANT_PROFESSOR = "assistant_professor",
  LECTURER = "lecturer",
  JUNIOR_LECTURER = "junior_lecturer",
  LAB_INSTRUCTOR = "lab_instructor",
  DEMONSTRATOR = "demonstrator",
  // Administrative
  PRINCIPAL = "principal",
  VICE_PRINCIPAL = "vice_principal",
  HOD = "head_of_department",
  DEAN = "dean",
  REGISTRAR = "registrar",
  // Non-teaching
  ADMIN_OFFICER = "admin_officer",
  ACCOUNTANT = "accountant",
  LIBRARIAN = "librarian",
  PROGRAMMER = "programmer",
  SYSTEM_ANALYST = "system_analyst",
  OFFICE_STAFF = "office_staff",
  LAB_TECHNICIAN = "lab_technician",
  PEON = "peon",
}

export enum Qualification {
  PHD = "phd",
  ME_MTECH = "me_mtech",
  BE_BTECH = "be_btech",
  MBA = "mba",
  MCA = "mca",
  MSC = "msc",
  BSC = "bsc",
  MA = "ma",
  BA = "ba",
  DIPLOMA = "diploma",
  OTHER = "other",
}

export enum PayBand {
  PAY_BAND_1 = "5200-20200",
  PAY_BAND_2 = "9300-34800",
  PAY_BAND_3 = "15600-39100",
  PAY_BAND_4 = "37400-67000",
  PAY_BAND_5 = "67000-79000",
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-interfaces
// ─────────────────────────────────────────────────────────────────────────────

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
  degree: Qualification;
  specialization: string;
  instituteName: string;
  university: string;
  passingYear: number;
  percentage?: number;
  cgpa?: number;
  certificateNo?: string;
  verified: boolean;
  documentUrl?: string;
}

export interface IExperienceRecord {
  organizationName: string;
  designation: string;
  department?: string;
  experienceType: "teaching" | "industry" | "research";
  fromDate: Date;
  toDate?: Date;
  isCurrent: boolean;
  experienceLetterUrl?: string;
  remarks?: string;
}

export interface IResearchPublication {
  title: string;
  type: "journal" | "conference" | "book" | "book_chapter" | "patent";
  publishedIn: string; // Journal/conference name
  year: number;
  issn?: string;
  isbn?: string;
  doi?: string;
  impactFactor?: number;
  indexed?: "scopus" | "sci" | "esci" | "ugc_care" | "other";
  coAuthors?: string[];
  url?: string;
}

export interface ISubjectAssignment {
  academicYear: string;
  semester: number;
  subjectCode: string;
  subjectName: string;
  department: Types.ObjectId;
  program: string;
  year: number;
  section?: string;
  lectureHoursPerWeek?: number;
  labHoursPerWeek?: number;
  isLabIncharge?: boolean;
  isCoordinator?: boolean;
}

export interface IFacultyLeaveBalance {
  academicYear: string;
  casualLeave: { total: number; used: number; balance: number };
  earnedLeave: { total: number; used: number; balance: number };
  medicalLeave: { total: number; used: number; balance: number };
  maternityLeave?: { total: number; used: number; balance: number };
  specialLeave: { total: number; used: number; balance: number };
}

export interface ISalaryDetail {
  payBand?: PayBand;
  gradePayOrLevel?: string; // Pay matrix level (7th CPC)
  basicPay: number;
  grossSalary?: number;
  netSalary?: number;
  pfAccountNo?: string;
  panNumber?: string; // Encrypted in prod
  bankAccountNo?: string; // Encrypted in prod
  bankName?: string;
  bankBranch?: string;
  ifscCode?: string;
  salaryMode?: "bank_transfer" | "cash" | "cheque";
  incomeTaxCategory?: string;
}

export interface IAppraisalRecord {
  academicYear: string;
  apiScore?: number; // Academic Performance Indicator (NAAC)
  selfAppraisalScore?: number;
  hodScore?: number;
  principalScore?: number;
  finalScore?: number;
  grade?: "outstanding" | "very_good" | "good" | "satisfactory" | "unsatisfactory";
  remarks?: string;
}

export interface ITrainingRecord {
  programName: string;
  organizingBody: string;
  type: "fdp" | "workshop" | "seminar" | "conference" | "certification" | "other";
  fromDate: Date;
  toDate: Date;
  durationDays?: number;
  certificateUrl?: string;
  fundingSource?: "college" | "self" | "sponsored" | "government";
}

export interface IFacultyDocument {
  docType: string;
  uploadedFileUrl?: string;
  uploadedFilePublicId?: string;
  uploadedAt?: Date;
  verified: boolean;
  verifiedBy?: Types.ObjectId;
  remarks?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main interface
// ─────────────────────────────────────────────────────────────────────────────

export interface IFacultyProfile extends Document {
  _id: Types.ObjectId;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;

  // ── Link ──────────────────────────────────────────────────────────────────
  userId: Types.ObjectId; // → User (auth account)

  // ── Identity numbers ──────────────────────────────────────────────────────
  employeeId: string; // Tenant-configured/system-generated employee identifier
  aadhaarNumber?: string;
  panNumber?: string; // Stored encrypted
  pfAccountNo?: string;
  biometricId?: string; // For attendance machine

  // ── Personal ──────────────────────────────────────────────────────────────
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: Date;
  gender: "male" | "female" | "other";
  bloodGroup?: string;
  nationality: string;
  religion?: string;
  caste?: string;
  category: AdmissionCategory;
  isPhysicallyChallenged: boolean;
  maritalStatus?: "single" | "married" | "divorced" | "widowed";
  spouseName?: string;
  spouseOccupation?: string;
  numberOfChildren?: number;
  motherTongue?: string;
  passportNumber?: string;
  passportExpiryDate?: Date;

  // ── Contact ───────────────────────────────────────────────────────────────
  personalEmail?: string;
  collegeEmail: string; // Official college email
  phone: string;
  alternatePhone?: string;
  whatsappPhone?: string;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactPhone?: string;

  // ── Address ───────────────────────────────────────────────────────────────
  permanentAddress: IFacultyAddress;
  currentAddress?: IFacultyAddress;

  // ── Employment ────────────────────────────────────────────────────────────
  /** "new" = first-time joining, "existing" = lateral / already serving when onboarded. */
  joiningType?: "new" | "existing";
  employmentType: EmploymentType;
  designation: Designation;
  department: Types.ObjectId; // → Department
  joiningDate: Date;
  confirmationDate?: Date;
  probationEndDate?: Date;
  contractEndDate?: Date; // For contractual/visiting
  retirementDate?: Date;
  status: FacultyStatus;
  reportingTo?: Types.ObjectId; // → User (HOD or Principal)

  // ── Qualifications ────────────────────────────────────────────────────────
  highestQualification: Qualification;
  specialization: string; // Primary specialization
  qualifications: IQualificationDetail[];

  // ── Experience ────────────────────────────────────────────────────────────
  experienceRecords: IExperienceRecord[];
  totalTeachingExperience?: number; // In years (auto-calculated)
  totalIndustryExperience?: number;
  totalResearchExperience?: number;

  // ── Subject assignments ───────────────────────────────────────────────────
  subjectAssignments: ISubjectAssignment[];

  // ── Research & Publications ───────────────────────────────────────────────
  publications: IResearchPublication[];
  guidingPhDStudents?: number;
  guidingPGStudents?: number;
  patentsGranted?: number;
  patentsFiled?: number;
  projectsGuided?: number;
  consultancyProjects?: number;

  // ── Salary ────────────────────────────────────────────────────────────────
  salaryDetails?: ISalaryDetail;
  currentGrossSalary?: number;

  // ── Leave balance ─────────────────────────────────────────────────────────
  leaveBalance?: IFacultyLeaveBalance;

  // ── Appraisal ─────────────────────────────────────────────────────────────
  appraisals: IAppraisalRecord[];
  currentApiScore?: number; // For NAAC self-study report

  // ── Training & Development ────────────────────────────────────────────────
  trainingRecords: ITrainingRecord[];
  totalFdpDays?: number; // Faculty Development Programs

  // ── Responsibilities ──────────────────────────────────────────────────────
  additionalResponsibilities?: string[]; // "IQAC coordinator", "NBA coordinator" etc.
  committeeMemberships?: string[];
  isMentor: boolean;
  mentorForStudents?: Types.ObjectId[]; // → StudentProfile

  // ── Documents ─────────────────────────────────────────────────────────────
  documents: IFacultyDocument[];

  // ── Photos ────────────────────────────────────────────────────────────────
  passportPhotoUrl?: string;
  passportPhotoPublicId?: string;
  signatureUrl?: string;

  // ── Remarks ───────────────────────────────────────────────────────────────
  remarks?: string;

  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const addressSchema = new Schema<IFacultyAddress>(
  {
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    country: { type: String, required: true, default: "India", trim: true },
  },
  { _id: false },
);

const qualificationSchema = new Schema<IQualificationDetail>(
  {
    degree: { type: String, enum: Object.values(Qualification), required: true },
    specialization: { type: String, required: true, trim: true },
    instituteName: { type: String, required: true, trim: true },
    university: { type: String, required: true, trim: true },
    passingYear: { type: Number, required: true },
    percentage: { type: Number, min: 0, max: 100 },
    cgpa: { type: Number, min: 0, max: 10 },
    certificateNo: { type: String, trim: true },
    verified: { type: Boolean, default: false },
    documentUrl: { type: String },
  },
  { _id: false },
);

const experienceSchema = new Schema<IExperienceRecord>(
  {
    organizationName: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true },
    department: { type: String, trim: true },
    experienceType: { type: String, enum: ["teaching", "industry", "research"], required: true },
    fromDate: { type: Date, required: true },
    toDate: { type: Date },
    isCurrent: { type: Boolean, default: false },
    experienceLetterUrl: { type: String },
    remarks: { type: String, trim: true },
  },
  { _id: false },
);

const publicationSchema = new Schema<IResearchPublication>(
  {
    title: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["journal", "conference", "book", "book_chapter", "patent"],
      required: true,
    },
    publishedIn: { type: String, required: true, trim: true },
    year: { type: Number, required: true },
    issn: { type: String, trim: true },
    isbn: { type: String, trim: true },
    doi: { type: String, trim: true },
    impactFactor: { type: Number, min: 0 },
    indexed: { type: String, enum: ["scopus", "sci", "esci", "ugc_care", "other"] },
    coAuthors: { type: [String], default: [] },
    url: { type: String },
  },
  { _id: false },
);

const subjectAssignmentSchema = new Schema<ISubjectAssignment>(
  {
    academicYear: { type: String, required: true },
    semester: { type: Number, required: true, min: 1 },
    subjectCode: { type: String, required: true, trim: true },
    subjectName: { type: String, required: true, trim: true },
    department: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    program: { type: String, required: true, trim: true },
    year: { type: Number, required: true, min: 1 },
    section: { type: String, trim: true },
    lectureHoursPerWeek: { type: Number, min: 0 },
    labHoursPerWeek: { type: Number, min: 0 },
    isLabIncharge: { type: Boolean, default: false },
    isCoordinator: { type: Boolean, default: false },
  },
  { _id: false },
);

const leaveBalanceSchema = new Schema<IFacultyLeaveBalance>(
  {
    academicYear: { type: String, required: true },
    casualLeave: { total: { type: Number }, used: { type: Number }, balance: { type: Number } },
    earnedLeave: { total: { type: Number }, used: { type: Number }, balance: { type: Number } },
    medicalLeave: { total: { type: Number }, used: { type: Number }, balance: { type: Number } },
    maternityLeave: { total: { type: Number }, used: { type: Number }, balance: { type: Number } },
    specialLeave: { total: { type: Number }, used: { type: Number }, balance: { type: Number } },
  },
  { _id: false },
);

const salarySchema = new Schema<ISalaryDetail>(
  {
    payBand: { type: String, enum: Object.values(PayBand) },
    gradePayOrLevel: { type: String, trim: true },
    basicPay: { type: Number, required: true, min: 0 },
    grossSalary: { type: Number, min: 0 },
    netSalary: { type: Number, min: 0 },
    pfAccountNo: { type: String, trim: true, select: false },
    panNumber: { type: String, trim: true, select: false },
    bankAccountNo: { type: String, trim: true, select: false },
    bankName: { type: String, trim: true },
    bankBranch: { type: String, trim: true },
    ifscCode: { type: String, trim: true },
    salaryMode: { type: String, enum: ["bank_transfer", "cash", "cheque"] },
    incomeTaxCategory: { type: String, trim: true },
  },
  { _id: false },
);

const appraisalSchema = new Schema<IAppraisalRecord>(
  {
    academicYear: { type: String, required: true },
    apiScore: { type: Number, min: 0 },
    selfAppraisalScore: { type: Number, min: 0 },
    hodScore: { type: Number, min: 0 },
    principalScore: { type: Number, min: 0 },
    finalScore: { type: Number, min: 0 },
    grade: {
      type: String,
      enum: ["outstanding", "very_good", "good", "satisfactory", "unsatisfactory"],
    },
    remarks: { type: String, trim: true },
  },
  { _id: false },
);

const trainingSchema = new Schema<ITrainingRecord>(
  {
    programName: { type: String, required: true, trim: true },
    organizingBody: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["fdp", "workshop", "seminar", "conference", "certification", "other"],
      required: true,
    },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    durationDays: { type: Number, min: 1 },
    certificateUrl: { type: String },
    fundingSource: { type: String, enum: ["college", "self", "sponsored", "government"] },
  },
  { _id: false },
);

const facultyDocumentSchema = new Schema<IFacultyDocument>(
  {
    docType: { type: String, required: true, trim: true },
    uploadedFileUrl: { type: String },
    uploadedFilePublicId: { type: String },
    uploadedAt: { type: Date },
    verified: { type: Boolean, default: false },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    remarks: { type: String, trim: true },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// Main schema
// ─────────────────────────────────────────────────────────────────────────────

const facultyProfileSchema = new Schema<IFacultyProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },

    employeeId: { type: String, required: true, unique: true, trim: true, index: true },
    aadhaarNumber: { type: String, trim: true },
    panNumber: { type: String, trim: true, select: false },
    pfAccountNo: { type: String, trim: true },
    biometricId: { type: String, trim: true },

    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true },
    lastName: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: ["male", "female", "other"], required: true },
    bloodGroup: { type: String, enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
    nationality: { type: String, required: true, default: "Indian", trim: true },
    religion: { type: String, trim: true },
    caste: { type: String, trim: true },
    category: { type: String, enum: Object.values(AdmissionCategory), required: true },
    isPhysicallyChallenged: { type: Boolean, default: false },
    maritalStatus: { type: String, enum: ["single", "married", "divorced", "widowed"] },
    spouseName: { type: String, trim: true },
    spouseOccupation: { type: String, trim: true },
    numberOfChildren: { type: Number, min: 0 },
    motherTongue: { type: String, trim: true },
    passportNumber: { type: String, trim: true },
    passportExpiryDate: { type: Date },

    personalEmail: { type: String, trim: true, lowercase: true },
    collegeEmail: { type: String, required: true, unique: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    alternatePhone: { type: String, trim: true },
    whatsappPhone: { type: String, trim: true },
    emergencyContactName: { type: String, trim: true },
    emergencyContactRelationship: { type: String, trim: true },
    emergencyContactPhone: { type: String, trim: true },

    permanentAddress: { type: addressSchema, required: true },
    currentAddress: { type: addressSchema },

    employmentType: { type: String, enum: Object.values(EmploymentType), required: true },
    joiningType: { type: String, enum: ["new", "existing"], default: "new" },
    designation: { type: String, enum: Object.values(Designation), required: true },
    department: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    joiningDate: { type: Date, required: true },
    confirmationDate: { type: Date },
    probationEndDate: { type: Date },
    contractEndDate: { type: Date },
    retirementDate: { type: Date },
    status: {
      type: String,
      enum: Object.values(FacultyStatus),
      default: FacultyStatus.ACTIVE,
      index: true,
    },
    reportingTo: { type: Schema.Types.ObjectId, ref: "User" },

    highestQualification: { type: String, enum: Object.values(Qualification), required: true },
    specialization: { type: String, required: true, trim: true },
    qualifications: { type: [qualificationSchema], default: [] },

    experienceRecords: { type: [experienceSchema], default: [] },
    totalTeachingExperience: { type: Number, default: 0, min: 0 },
    totalIndustryExperience: { type: Number, default: 0, min: 0 },
    totalResearchExperience: { type: Number, default: 0, min: 0 },

    subjectAssignments: { type: [subjectAssignmentSchema], default: [] },

    publications: { type: [publicationSchema], default: [] },
    guidingPhDStudents: { type: Number, default: 0, min: 0 },
    guidingPGStudents: { type: Number, default: 0, min: 0 },
    patentsGranted: { type: Number, default: 0, min: 0 },
    patentsFiled: { type: Number, default: 0, min: 0 },
    projectsGuided: { type: Number, default: 0, min: 0 },
    consultancyProjects: { type: Number, default: 0, min: 0 },

    salaryDetails: { type: salarySchema },
    currentGrossSalary: { type: Number, min: 0 },

    leaveBalance: { type: leaveBalanceSchema },

    appraisals: { type: [appraisalSchema], default: [] },
    currentApiScore: { type: Number, default: 0, min: 0 },

    trainingRecords: { type: [trainingSchema], default: [] },
    totalFdpDays: { type: Number, default: 0, min: 0 },

    additionalResponsibilities: { type: [String], default: [] },
    committeeMemberships: { type: [String], default: [] },
    isMentor: { type: Boolean, default: false },
    mentorForStudents: { type: [Schema.Types.ObjectId], ref: "StudentProfile", default: [] },

    documents: { type: [facultyDocumentSchema], default: [] },

    passportPhotoUrl: { type: String },
    passportPhotoPublicId: { type: String },
    signatureUrl: { type: String },

    remarks: { type: String, trim: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_d, ret: Record<string, unknown>) => {
        delete ret["__v"];
        delete ret["salaryDetails"]; // Never expose salary in list responses
      },
    },
  },
);

// Virtual: full name
facultyProfileSchema.virtual("fullName").get(function () {
  return [this.firstName, this.middleName, this.lastName].filter(Boolean).join(" ");
});

// Virtual: total experience in years
facultyProfileSchema.virtual("totalExperience").get(function () {
  return (this.totalTeachingExperience ?? 0) + (this.totalIndustryExperience ?? 0);
});

facultyProfileSchema.index({ department: 1, status: 1 });
facultyProfileSchema.index({ designation: 1 });
facultyProfileSchema.index({ employmentType: 1, status: 1 });

facultyProfileSchema.plugin(auditPlugin);
facultyProfileSchema.path("createdBy").required(true);

export const FacultyProfileModel = mongoose.model<IFacultyProfile>(
  "FacultyProfile",
  facultyProfileSchema,
);

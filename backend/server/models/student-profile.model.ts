import { auditPlugin } from "../plugins/audit.plugin";
import mongoose, { Schema, type Document, type Types } from "mongoose";
import { AdmissionCategory, AdmissionType } from "./admission-application.model";

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

export enum StudentStatus {
  ACTIVE = "active",
  DETAINED = "detained", // Not allowed to appear in exams
  DROPPED = "dropped", // Dropped out
  PASSED_OUT = "passed_out", // Completed degree
  TRANSFERRED = "transferred", // Transferred to another institution
  LATERAL_PROMOTED = "lateral_promoted",
  RUSTICATED = "rusticated", // Disciplinary expulsion
}

export enum HostelType {
  BOYS_HOSTEL = "boys_hostel",
  GIRLS_HOSTEL = "girls_hostel",
  DAY_SCHOLAR = "day_scholar",
}

export enum TransportMode {
  COLLEGE_BUS = "college_bus",
  OWN = "own",
  WALK = "walk",
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface IStudentAddress {
  line1: string;
  line2?: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  country: string;
}

export interface IStudentParentInfo {
  fatherName: string;
  fatherOccupation?: string;
  fatherQualification?: string;
  fatherPhone: string;
  fatherEmail?: string;
  fatherAadhaar?: string;
  motherName: string;
  motherOccupation?: string;
  motherQualification?: string;
  motherPhone?: string;
  motherEmail?: string;
  guardianName?: string;
  guardianRelationship?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  annualFamilyIncome?: number; // In INR, for scholarship/fee waiver
}

export interface IStudentAcademicRecord {
  level: "10th" | "12th_or_diploma" | "graduation" | "post_graduation";
  examName: string; // e.g., "CBSE", "BSEB", "CHSE Odisha"
  boardOrUniversity: string;
  instituteName: string;
  passingYear: number;
  percentage: number;
  cgpa?: number;
  rollNumber?: string;
  certificateNo?: string;
  verified: boolean;
  verifiedBy?: Types.ObjectId;
}

export interface IStudentSemesterResultRecord {
  semesterNo: number; // 1-8 for B.Tech, 1-4 for MCA/MBA
  academicYear: string; // "2026-27"
  sgpa?: number;
  cgpa?: number;
  totalCredits?: number;
  creditsEarned?: number;
  backlogs: number;
  result: "pass" | "fail" | "withheld" | "absent";
  marksheetUrl?: string;
}

export interface IScholarshipRecord {
  scholarshipName: string;
  awardingBody: string;
  academicYear: string;
  amount: number;
  disbursedDate?: Date;
  status: "applied" | "approved" | "disbursed" | "rejected";
  referenceNo?: string;
}

export interface IStudentFeeRecord {
  academicYear: string;
  semester?: number;
  feeType: string; // "tuition", "hostel", "transport", "exam"
  amount: number;
  amountPaid: number;
  balance: number;
  dueDate?: Date;
  paidDate?: Date;
  receiptNo?: string;
  paymentMode?: "cash" | "upi" | "net_banking" | "card" | "dd";
}

export interface IHostelDetails {
  hostelType: HostelType;
  hostelName?: string;
  blockName?: string;
  roomNumber?: string;
  bedNumber?: string;
  allotmentDate?: Date;
  vacatingDate?: Date;
  wardenName?: string;
}

export interface ITransportDetails {
  mode: TransportMode;
  routeNo?: string;
  busStopName?: string;
  pickupPoint?: string;
  monthlyFee?: number;
}

export interface IStudentDocument {
  docType: string;
  originalSubmitted: boolean;
  photocopySubmitted: boolean;
  verifiedBy?: Types.ObjectId;
  verifiedAt?: Date;
  uploadedFileUrl?: string;
  uploadedFilePublicId?: string;
  remarks?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main interface
// ─────────────────────────────────────────────────────────────────────────────

export interface IStudentProfile extends Document {
  _id: Types.ObjectId;

  // ── Links ─────────────────────────────────────────────────────────────────
  userId: Types.ObjectId; // → User (auth account)
  admissionApplicationId?: Types.ObjectId; // → AdmissionApplication

  // ── Identity numbers ──────────────────────────────────────────────────────
  rollNumber: string; // e.g., "26RE001" — ERP / class roll
  /**
   * University registration number (e.g. BPUT). Added by AO/AOO AFTER the
   * affiliating university issues the registration. Not set at admission.
   */
  registrationNumber?: string;
  enrollmentNumber?: string; // College enrollment no
  aadhaarNumber?: string;
  abcId?: string; // Academic Bank of Credits ID (NEP 2020)

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
  pcDisabilityType?: string;
  pcPercentage?: number;
  motherTongue?: string;
  maritalStatus?: "single" | "married";
  passportNumber?: string;

  // ── Contact ───────────────────────────────────────────────────────────────
  personalEmail?: string; // Personal email
  collegeEmail: string; // College-issued email (auto-generated)
  phone: string;
  whatsappPhone?: string;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactPhone?: string;

  // ── Address ───────────────────────────────────────────────────────────────
  permanentAddress: IStudentAddress;
  currentAddress?: IStudentAddress; // If different from permanent (hostel etc.)

  // ── Academic program ──────────────────────────────────────────────────────
  program: string;
  admissionType: AdmissionType;
  admissionCategory: AdmissionCategory;
  batch: string; // Admission year, e.g., "2026"
  academicYear: string; // Current year, e.g., "2026-27"
  currentSemester: number;
  currentYear: number; // 1 / 2 / 3 / 4
  section?: string; // "A", "B", "C"
  department?: Types.ObjectId; // → Department
  mentor?: Types.ObjectId; // → User (faculty mentor)
  classTeacher?: Types.ObjectId;
  admissionDate: Date;
  status: StudentStatus;

  // ── Entrance exam ─────────────────────────────────────────────────────────
  entranceExam?: string; // OJEE/JEE MAIN etc.
  entranceRank?: number;
  entranceScore?: number;

  // ── Academic records (previous education) ─────────────────────────────────
  academicRecords: IStudentAcademicRecord[];

  // ── Semester results ──────────────────────────────────────────────────────
  semesterResults: IStudentSemesterResultRecord[];
  currentCgpa?: number;
  totalBacklogs: number;
  activeLateralEntryBenefits?: boolean;

  // ── Parent / Guardian ─────────────────────────────────────────────────────
  parentInfo: IStudentParentInfo;

  // ── Hostel ────────────────────────────────────────────────────────────────
  hostelDetails?: IHostelDetails;

  // ── Transport ─────────────────────────────────────────────────────────────
  transportDetails?: ITransportDetails;

  // ── Fees ──────────────────────────────────────────────────────────────────
  feeRecords: IStudentFeeRecord[];
  totalFeeDue: number;
  totalFeePaid: number;

  // ── Scholarships ──────────────────────────────────────────────────────────
  scholarships: IScholarshipRecord[];

  // ── Documents ─────────────────────────────────────────────────────────────
  documents: IStudentDocument[];

  // ── Co-curricular ─────────────────────────────────────────────────────────
  achievements?: string[]; // Awards, competitions, etc.
  extracurricular?: string[];
  sportsCategory?: string; // "college_level", "state_level", "national_level"

  // ── Library ───────────────────────────────────────────────────────────────
  libraryCardNo?: string;
  libraryCardIssueDate?: Date;

  // ── Placement ─────────────────────────────────────────────────────────────
  isPlacementEligible?: boolean;
  placedCompany?: string;
  placementPackage?: number; // Annual CTC in LPA
  placementDate?: Date;

  // ── Passport photo ────────────────────────────────────────────────────────
  passportPhotoUrl?: string;
  passportPhotoPublicId?: string;
  signatureUrl?: string;

  // ── Gap year ──────────────────────────────────────────────────────────────
  hasGapYear: boolean;
  gapYearReason?: string;

  // ── Remarks ───────────────────────────────────────────────────────────────
  remarks?: string;
  isLocalStudent: boolean; // From same district/state

  createdAt: Date;
  updatedAt: Date;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const addressSchema = new Schema<IStudentAddress>(
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

const parentInfoSchema = new Schema<IStudentParentInfo>(
  {
    fatherName: { type: String, required: true, trim: true },
    fatherOccupation: { type: String, trim: true },
    fatherQualification: { type: String, trim: true },
    fatherPhone: { type: String, required: true, trim: true },
    fatherEmail: { type: String, trim: true, lowercase: true },
    fatherAadhaar: { type: String, trim: true },
    motherName: { type: String, required: true, trim: true },
    motherOccupation: { type: String, trim: true },
    motherQualification: { type: String, trim: true },
    motherPhone: { type: String, trim: true },
    motherEmail: { type: String, trim: true, lowercase: true },
    guardianName: { type: String, trim: true },
    guardianRelationship: { type: String, trim: true },
    guardianPhone: { type: String, trim: true },
    guardianEmail: { type: String, trim: true, lowercase: true },
    annualFamilyIncome: { type: Number, min: 0 },
  },
  { _id: false },
);

const academicRecordSchema = new Schema<IStudentAcademicRecord>(
  {
    level: {
      type: String,
      enum: ["10th", "12th_or_diploma", "graduation", "post_graduation"],
      required: true,
    },
    examName: { type: String, required: true, trim: true },
    boardOrUniversity: { type: String, required: true, trim: true },
    instituteName: { type: String, required: true, trim: true },
    passingYear: { type: Number, required: true },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    cgpa: { type: Number, min: 0, max: 10 },
    rollNumber: { type: String, trim: true },
    certificateNo: { type: String, trim: true },
    verified: { type: Boolean, default: false },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false },
);

const semesterResultSchema = new Schema<IStudentSemesterResultRecord>(
  {
    semesterNo: { type: Number, required: true, min: 1 },
    academicYear: { type: String, required: true },
    sgpa: { type: Number, min: 0, max: 10 },
    cgpa: { type: Number, min: 0, max: 10 },
    totalCredits: { type: Number, min: 0 },
    creditsEarned: { type: Number, min: 0 },
    backlogs: { type: Number, default: 0, min: 0 },
    result: { type: String, enum: ["pass", "fail", "withheld", "absent"], required: true },
    marksheetUrl: { type: String },
  },
  { _id: false },
);

const scholarshipSchema = new Schema<IScholarshipRecord>(
  {
    scholarshipName: { type: String, required: true, trim: true },
    awardingBody: { type: String, required: true, trim: true },
    academicYear: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    disbursedDate: { type: Date },
    status: {
      type: String,
      enum: ["applied", "approved", "disbursed", "rejected"],
      default: "applied",
    },
    referenceNo: { type: String, trim: true },
  },
  { _id: false },
);

const feeRecordSchema = new Schema<IStudentFeeRecord>(
  {
    academicYear: { type: String, required: true },
    semester: { type: Number },
    feeType: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0 },
    dueDate: { type: Date },
    paidDate: { type: Date },
    receiptNo: { type: String, trim: true },
    paymentMode: { type: String, enum: ["cash", "upi", "net_banking", "card", "dd"] },
  },
  { _id: false },
);

const hostelSchema = new Schema<IHostelDetails>(
  {
    hostelType: { type: String, enum: Object.values(HostelType), required: true },
    hostelName: { type: String, trim: true },
    blockName: { type: String, trim: true },
    roomNumber: { type: String, trim: true },
    bedNumber: { type: String, trim: true },
    allotmentDate: { type: Date },
    vacatingDate: { type: Date },
    wardenName: { type: String, trim: true },
  },
  { _id: false },
);

const transportSchema = new Schema<ITransportDetails>(
  {
    mode: { type: String, enum: Object.values(TransportMode), required: true },
    routeNo: { type: String, trim: true },
    busStopName: { type: String, trim: true },
    pickupPoint: { type: String, trim: true },
    monthlyFee: { type: Number, min: 0 },
  },
  { _id: false },
);

const documentSchema = new Schema<IStudentDocument>(
  {
    docType: { type: String, required: true, trim: true },
    originalSubmitted: { type: Boolean, default: false },
    photocopySubmitted: { type: Boolean, default: false },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },
    uploadedFileUrl: { type: String },
    uploadedFilePublicId: { type: String },
    remarks: { type: String, trim: true },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// Main schema
// ─────────────────────────────────────────────────────────────────────────────

const studentProfileSchema = new Schema<IStudentProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    admissionApplicationId: { type: Schema.Types.ObjectId, ref: "AdmissionApplication" },

    rollNumber: { type: String, required: true, unique: true, trim: true },
    registrationNumber: { type: String, unique: true, sparse: true, trim: true, index: true },
    enrollmentNumber: { type: String, trim: true, sparse: true },
    aadhaarNumber: { type: String, trim: true },
    abcId: { type: String, trim: true },

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
    pcDisabilityType: { type: String, trim: true },
    pcPercentage: { type: Number, min: 0, max: 100 },
    motherTongue: { type: String, trim: true },
    maritalStatus: { type: String, enum: ["single", "married"] },
    passportNumber: { type: String, trim: true },

    personalEmail: { type: String, trim: true, lowercase: true },
    collegeEmail: { type: String, required: true, unique: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    whatsappPhone: { type: String, trim: true },
    emergencyContactName: { type: String, trim: true },
    emergencyContactRelationship: { type: String, trim: true },
    emergencyContactPhone: { type: String, trim: true },

    permanentAddress: { type: addressSchema, required: true },
    currentAddress: { type: addressSchema },

    program: { type: String, trim: true, required: true },
    admissionType: { type: String, enum: Object.values(AdmissionType), required: true },
    admissionCategory: { type: String, enum: Object.values(AdmissionCategory), required: true },
    batch: { type: String, required: true },
    academicYear: { type: String, required: true },
    currentSemester: { type: Number, required: true, min: 1, default: 1 },
    currentYear: { type: Number, required: true, min: 1, max: 4, default: 1 },
    section: { type: String, trim: true },
    department: { type: Schema.Types.ObjectId, ref: "Department" },
    mentor: { type: Schema.Types.ObjectId, ref: "User" },
    classTeacher: { type: Schema.Types.ObjectId, ref: "User" },
    admissionDate: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(StudentStatus),
      default: StudentStatus.ACTIVE,
      index: true,
    },

    entranceExam: { type: String, trim: true },
    entranceRank: { type: Number, min: 1 },
    entranceScore: { type: Number, min: 0 },

    academicRecords: { type: [academicRecordSchema], default: [] },
    semesterResults: { type: [semesterResultSchema], default: [] },
    currentCgpa: { type: Number, min: 0, max: 10, default: 0 },
    totalBacklogs: { type: Number, default: 0, min: 0 },
    activeLateralEntryBenefits: { type: Boolean, default: false },

    parentInfo: { type: parentInfoSchema, required: true },

    hostelDetails: { type: hostelSchema },
    transportDetails: { type: transportSchema },

    feeRecords: { type: [feeRecordSchema], default: [] },
    totalFeeDue: { type: Number, default: 0, min: 0 },
    totalFeePaid: { type: Number, default: 0, min: 0 },

    scholarships: { type: [scholarshipSchema], default: [] },

    documents: { type: [documentSchema], default: [] },

    achievements: { type: [String], default: [] },
    extracurricular: { type: [String], default: [] },
    sportsCategory: { type: String, enum: ["college_level", "state_level", "national_level"] },

    libraryCardNo: { type: String, trim: true },
    libraryCardIssueDate: { type: Date },

    isPlacementEligible: { type: Boolean, default: false },
    placedCompany: { type: String, trim: true },
    placementPackage: { type: Number, min: 0 },
    placementDate: { type: Date },

    passportPhotoUrl: { type: String },
    passportPhotoPublicId: { type: String },
    signatureUrl: { type: String },

    hasGapYear: { type: Boolean, default: false },
    gapYearReason: { type: String, trim: true },

    isLocalStudent: { type: Boolean, default: false },
    remarks: { type: String, trim: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_d, ret: Record<string, unknown>) => {
        delete ret["__v"];
      },
    },
  },
);

// Virtual: full name
studentProfileSchema.virtual("fullName").get(function () {
  return [this.firstName, this.middleName, this.lastName].filter(Boolean).join(" ");
});

// Virtual: fee balance
studentProfileSchema.virtual("feeBalance").get(function () {
  return this.totalFeeDue - this.totalFeePaid;
});

studentProfileSchema.index({ program: 1, batch: 1, status: 1 });
studentProfileSchema.index({ department: 1, currentYear: 1, section: 1 });
studentProfileSchema.index({ mentor: 1 });

studentProfileSchema.plugin(auditPlugin);
studentProfileSchema.path("createdBy").required(true);

export const StudentProfileModel = mongoose.model<IStudentProfile>(
  "StudentProfile",
  studentProfileSchema,
);

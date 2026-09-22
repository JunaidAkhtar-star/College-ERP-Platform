import { auditPlugin } from "../plugins/audit.plugin";
import mongoose, { Schema, type Document, type Types } from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
// Enums — aligned with RITE physical admission form
// ─────────────────────────────────────────────────────────────────────────────

export enum ApplicationStatus {
  DRAFT = "draft",
  SUBMITTED = "submitted",
  UNDER_REVIEW = "under_review",
  APPROVED = "approved",
  REJECTED = "rejected",
  ENROLLED = "enrolled",
  WITHDRAWN = "withdrawn",
  // ── Deprecated values retained for back-compat with existing data ──────────
  /** @deprecated use UNDER_REVIEW */
  DOCUMENT_VERIFICATION = "document_verification",
  /** @deprecated merit-list flow removed */
  MERIT_LIST = "merit_list",
  /** @deprecated counseling-scheduling flow removed */
  COUNSELING_SCHEDULED = "counseling_scheduled",
  /** @deprecated seat-allocation flow removed */
  SEAT_ALLOCATED = "seat_allocated",
  /** @deprecated approval-chain flow removed */
  PENDING_APPROVAL = "pending_approval",
  /** @deprecated fee is tracked separately; status stays APPROVED until enrollment */
  FEE_PENDING = "fee_pending",
}

export enum AdmissionType {
  REGULAR = "regular",
  LATERAL_ENTRY = "lateral_entry",
}

/** SC / ST / OBC / SEBC / GEN — as printed on the RITE form */
export enum AdmissionCategory {
  SC = "sc",
  ST = "st",
  OBC = "obc",
  SEBC = "sebc",
  GEN = "general",
  PH = "ph",
}

/** Entrance exams listed on the RITE admission form */
export enum EntranceExam {
  OJEE = "OJEE",
  JEE_MAIN = "JEE_MAIN",
  CAT = "CAT",
  MAT = "MAT",
  ATMA = "ATMA",
  OTHER = "OTHER",
}

export enum PaymentMode {
  CASH = "cash",
  UPI = "upi",
  NET_BANKING = "net_banking",
  CARD = "card",
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-interfaces
// ─────────────────────────────────────────────────────────────────────────────

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
  exam: EntranceExam;
  otherName?: string;
  applicationNo?: string;
  rank?: number;
  percentile?: number;
  score?: number;
  year: number;
}

/** One row of the "Academic Records" table on the RITE form */
export interface IAcademicRecord {
  level: "10th" | "12th_or_diploma" | "degree";
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
  guardianPhone?: string;
  guardianRelationship?: string;
  annualIncome?: number;
}

/** A single uploaded file inside a checklist item — supports multi-file per docType */
export interface IUploadedFile {
  url: string;
  publicId: string;
  name?: string;
  mimeType?: string;
  size?: number;
  uploadedAt?: Date;
}

/** Mirrors the "DOCUMENT DEPOSITED" table — Original + Photocopy checkboxes */
export interface IDocumentChecklistItem {
  docType:
    | "hsc_10th_marksheet"
    | "hsc_10th_certificate"
    | "plus_two_marksheet"
    | "plus_two_certificate"
    | "plus_three_marksheet"
    | "plus_three_certificate"
    | "school_leaving_certificate"
    | "aadhaar_card"
    | "caste_certificate"
    | "residence_certificate"
    | "income_certificate"
    | "anti_ragging_student"
    | "anti_ragging_guardian"
    | "passport_photo"
    | "apaar_id"
    | "payment_proof"
    | "entrance_exam_result";
  originalSubmitted: boolean;
  photocopySubmitted: boolean;
  /** True once a doc has been rejected at least once — used to show "Reverify" after re-upload. */
  previouslyRejected?: boolean;
  /** Per-document review state. 'pending' until reviewer reviews. */
  status?: "pending" | "verified" | "rejected";
  /** Reason shown to the applicant when status === 'rejected'. */
  rejectionReason?: string;
  verifiedBy?: Types.ObjectId;
  verifiedAt?: Date;
  remarks?: string;
  /** All uploaded files for this docType. */
  files: IUploadedFile[];
  /** Legacy single-file fields — first file in `files`, kept for back-compat reads. */
  uploadedFileUrl?: string;
  uploadedFilePublicId?: string;
}

export interface IPaymentDetails {
  amountInNumber?: number;
  amountInWords?: string;
  receiptNo?: string;
  receiptDate?: Date;
  paymentMode?: PaymentMode;
  collectedBy?: Types.ObjectId;
  collectedAt?: Date;
  /** Self-reported by applicant during admission — verified by Accounts later. */
  transactionId?: string;
  paidAt?: Date;
  screenshotUrl?: string;
  screenshotPublicId?: string;
  verificationStatus?: "pending" | "verified" | "rejected";
  verificationRemarks?: string;
  verifiedBy?: Types.ObjectId;
  verifiedAt?: Date;
}

export interface IApprovalStep {
  role: string;
  approvedBy?: Types.ObjectId;
  approvedByName?: string;
  status: "pending" | "approved" | "rejected";
  remarks?: string;
  actionedAt?: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main document interface
// ─────────────────────────────────────────────────────────────────────────────

export interface IAdmissionApplication extends Document {
  _id: Types.ObjectId;

  applicationNumber: string;
  academicYear: string;
  session: string;

  // Personal
  candidateName: string;
  fatherName: string;
  motherName: string;
  guardianName?: string;
  dateOfBirth: Date;
  gender: "male" | "female";
  category: AdmissionCategory;
  religion?: string;
  nationality: string;
  aadhaarNumber?: string;
  bloodGroup?: string;

  // Contact
  email: string;
  phone: string;
  whatsappPhone?: string;
  parentPhone?: string;
  guardianPhone?: string;

  // Address
  presentAddress: IAddress;
  permanentAddress: IAddress;

  // Entrance exam
  entranceExam: IEntranceExamDetail;
  lastCollegeAttended?: string;

  // Program choice
  admissionType: AdmissionType;
  programPreferences: string[];
  preferredDepartmentId?: Types.ObjectId | null;
  allocatedProgram?: string;

  // Academic records
  academicRecords: IAcademicRecord[];

  // Parent/Guardian info
  parentInfo: IParentInfo;

  // Document checklist
  documentChecklist: IDocumentChecklistItem[];

  // Passport photo
  passportPhotoUrl?: string;
  passportPhotoPublicId?: string;

  // Payment
  paymentDetails?: IPaymentDetails;

  // Counseling schedule (set when status -> counseling_scheduled)
  counselingSchedule?: {
    date?: Date;
    venue?: string;
    slot?: string;
    scheduledBy?: Types.ObjectId;
    scheduledAt?: Date;
  };

  // Workflow
  status: ApplicationStatus;
  meritScore?: number;
  meritRank?: number;
  approvalChain: IApprovalStep[];
  rejectionReason?: string;
  remarks?: string;

  // Declaration
  declarationAccepted: boolean;
  declarationAcceptedAt?: Date;

  // Post-enrollment
  registrationNumber?: string;
  enrolledUserId?: Types.ObjectId;
  enrolledAt?: Date;
  onboardStatus?: "pending" | "hosteller" | "day_scholar";
  transportOption?: "bus" | "own";

  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const addressSchema = new Schema<IAddress>(
  {
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    district: { type: String, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true, default: "India" },
  },
  { _id: false },
);

const entranceExamSchema = new Schema<IEntranceExamDetail>(
  {
    exam: { type: String, enum: Object.values(EntranceExam), required: true },
    otherName: { type: String, trim: true },
    applicationNo: { type: String, trim: true },
    rank: { type: Number, min: 1 },
    percentile: { type: Number, min: 0, max: 100 },
    score: { type: Number, min: 0 },
    year: { type: Number, required: true },
  },
  { _id: false },
);

const academicRecordSchema = new Schema<IAcademicRecord>(
  {
    level: { type: String, enum: ["10th", "12th_or_diploma", "degree"], required: true },
    boardOrUniversity: { type: String, required: true, trim: true },
    instituteName: { type: String, required: true, trim: true },
    yearOfPassing: { type: Number, required: true },
    percentageOfMarks: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false },
);

const parentInfoSchema = new Schema<IParentInfo>(
  {
    fatherName: { type: String, required: true, trim: true },
    fatherOccupation: { type: String, trim: true },
    fatherPhone: { type: String, trim: true },
    motherName: { type: String, required: true, trim: true },
    motherOccupation: { type: String, trim: true },
    motherPhone: { type: String, trim: true },
    guardianName: { type: String, trim: true },
    guardianPhone: { type: String, trim: true },
    guardianRelationship: { type: String, trim: true },
    annualIncome: { type: Number, min: 0 },
  },
  { _id: false },
);

const VALID_DOC_TYPES = [
  "hsc_10th_marksheet",
  "hsc_10th_certificate",
  "plus_two_marksheet",
  "plus_two_certificate",
  "plus_three_marksheet",
  "plus_three_certificate",
  "school_leaving_certificate",
  "aadhaar_card",
  "caste_certificate",
  "residence_certificate",
  "income_certificate",
  "anti_ragging_student",
  "anti_ragging_guardian",
  "passport_photo",
  "apaar_id",
  "payment_proof",
  "entrance_exam_result",
] as const;

/**
 * Document requirements. `mandatory` means upload is required to submit.
 * `pgOnly` means only required when the applicant has a post-graduation program
 * (MBA / MCA). UI uses this to render the conditional graduation block.
 */
export const DOCUMENT_REQUIREMENTS: ReadonlyArray<{
  docType: (typeof VALID_DOC_TYPES)[number];
  label: string;
  mandatory: boolean;
  pgOnly?: boolean;
  casteOnly?: boolean;
}> = [
  { docType: "hsc_10th_marksheet", label: "HSC (10th) Marksheet", mandatory: true },
  { docType: "hsc_10th_certificate", label: "HSC (10th) Pass Certificate", mandatory: true },
  { docType: "plus_two_marksheet", label: "+2 / Diploma Marksheet", mandatory: true },
  { docType: "plus_two_certificate", label: "+2 / Diploma Certificate", mandatory: true },
  {
    docType: "plus_three_marksheet",
    label: "+3 / B.Tech Marksheet",
    mandatory: true,
    pgOnly: true,
  },
  {
    docType: "plus_three_certificate",
    label: "+3 / B.Tech / Degree Certificate",
    mandatory: true,
    pgOnly: true,
  },
  {
    docType: "school_leaving_certificate",
    label: "School / College Leaving Certificate (Original)",
    mandatory: true,
  },
  { docType: "aadhaar_card", label: "Aadhaar Card (Photocopy)", mandatory: true },
  {
    docType: "caste_certificate",
    label: "Caste Certificate (SC/ST/OBC/SEBC/PH)",
    mandatory: true,
    casteOnly: true,
  },
  {
    docType: "residence_certificate",
    label: "Residence Certificate (SC/ST/OBC/SEBC/PH)",
    mandatory: true,
    casteOnly: true,
  },
  {
    docType: "income_certificate",
    label: "Income Certificate (SC/ST/OBC/SEBC/PH)",
    mandatory: true,
    casteOnly: true,
  },
  { docType: "anti_ragging_student", label: "Anti-Ragging Affidavit (Student)", mandatory: false },
  {
    docType: "anti_ragging_guardian",
    label: "Anti-Ragging Affidavit (Guardian)",
    mandatory: false,
  },
  { docType: "passport_photo", label: "Passport Size Photo", mandatory: true },
  { docType: "apaar_id", label: "APAAR ID", mandatory: false },
  { docType: "entrance_exam_result", label: "Entrance Exam Rank / Score Card", mandatory: true },
];

const uploadedFileSchema = new Schema<IUploadedFile>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    name: { type: String, trim: true },
    mimeType: { type: String, trim: true },
    size: { type: Number, min: 0 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const documentChecklistItemSchema = new Schema<IDocumentChecklistItem>(
  {
    docType: { type: String, required: true, enum: VALID_DOC_TYPES },
    originalSubmitted: { type: Boolean, default: false },
    photocopySubmitted: { type: Boolean, default: false },
    previouslyRejected: { type: Boolean, default: false },
    status: { type: String, enum: ["pending", "verified", "rejected"], default: "pending" },
    rejectionReason: { type: String, trim: true },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },
    remarks: { type: String, trim: true },
    files: { type: [uploadedFileSchema], default: [] },
    uploadedFileUrl: { type: String },
    uploadedFilePublicId: { type: String },
  },
  { _id: false },
);

const paymentDetailsSchema = new Schema<IPaymentDetails>(
  {
    amountInNumber: { type: Number, min: 0 },
    amountInWords: { type: String, trim: true },
    receiptNo: { type: String, trim: true },
    receiptDate: { type: Date },
    paymentMode: { type: String, enum: Object.values(PaymentMode) },
    collectedBy: { type: Schema.Types.ObjectId, ref: "User" },
    collectedAt: { type: Date },
    transactionId: { type: String, trim: true },
    paidAt: { type: Date },
    screenshotUrl: { type: String },
    screenshotPublicId: { type: String },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    verificationRemarks: { type: String, trim: true },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },
  },
  { _id: false },
);

const approvalStepSchema = new Schema<IApprovalStep>(
  {
    role: { type: String, required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedByName: { type: String },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    remarks: { type: String },
    actionedAt: { type: Date },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// Main schema
// ─────────────────────────────────────────────────────────────────────────────

const admissionApplicationSchema = new Schema<IAdmissionApplication>(
  {
    applicationNumber: { type: String, required: true, unique: true, index: true },
    academicYear: { type: String, required: true, index: true },
    /** Session defaults to the academic year when not explicitly provided. */
    session: {
      type: String,
      default(this: { academicYear?: string }) {
        return this.academicYear ?? "";
      },
    },

    candidateName: { type: String, required: true, trim: true },
    fatherName: { type: String, required: true, trim: true },
    motherName: { type: String, required: true, trim: true },
    guardianName: { type: String, trim: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: ["male", "female"], required: true },
    category: { type: String, enum: Object.values(AdmissionCategory), required: true },
    religion: { type: String, trim: true },
    nationality: { type: String, required: true, default: "Indian", trim: true },
    aadhaarNumber: { type: String, trim: true },
    bloodGroup: { type: String, enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },

    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    phone: { type: String, required: true, trim: true },
    whatsappPhone: { type: String, trim: true },
    parentPhone: { type: String, trim: true },
    guardianPhone: { type: String, trim: true },

    presentAddress: { type: addressSchema, required: true },
    permanentAddress: { type: addressSchema, required: true },

    entranceExam: { type: entranceExamSchema, required: true },
    lastCollegeAttended: { type: String, trim: true },

    admissionType: {
      type: String,
      enum: Object.values(AdmissionType),
      required: true,
      default: AdmissionType.REGULAR,
    },
    programPreferences: {
      type: [String],
      required: true,
      validate: {
        validator: (v: string[]) => v.length > 0,
        message: "At least one program preference is required",
      },
    },
    preferredDepartmentId: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    allocatedProgram: { type: String, trim: true },

    academicRecords: {
      type: [academicRecordSchema],
      validate: {
        validator: (v: IAcademicRecord[]) => v.length >= 1,
        message: "At least 10th academic record is required",
      },
    },

    parentInfo: { type: parentInfoSchema, required: true },

    documentChecklist: { type: [documentChecklistItemSchema], default: [] },

    passportPhotoUrl: { type: String },
    passportPhotoPublicId: { type: String },

    paymentDetails: { type: paymentDetailsSchema },

    counselingSchedule: {
      date: { type: Date },
      venue: { type: String, trim: true },
      slot: { type: String, trim: true },
      scheduledBy: { type: Schema.Types.ObjectId, ref: "User" },
      scheduledAt: { type: Date },
    },

    status: {
      type: String,
      enum: Object.values(ApplicationStatus),
      default: ApplicationStatus.DRAFT,
      index: true,
    },
    meritScore: { type: Number },
    meritRank: { type: Number },
    approvalChain: { type: [approvalStepSchema], default: [] },
    rejectionReason: { type: String },
    remarks: { type: String },

    declarationAccepted: { type: Boolean, default: false },
    declarationAcceptedAt: { type: Date },

    registrationNumber: { type: String, unique: true, sparse: true },
    enrolledUserId: { type: Schema.Types.ObjectId, ref: "User" },
    enrolledAt: { type: Date },
    onboardStatus: {
      type: String,
      enum: ["pending", "hosteller", "day_scholar"],
      default: "pending",
    },
    transportOption: { type: String, enum: ["bus", "own"] },

    submittedAt: { type: Date },
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

admissionApplicationSchema.index({ status: 1, academicYear: 1 });
admissionApplicationSchema.index({ email: 1, academicYear: 1 });
admissionApplicationSchema.index({ allocatedProgram: 1, academicYear: 1 });
admissionApplicationSchema.index({ meritRank: 1, allocatedProgram: 1 });
admissionApplicationSchema.index({ enrolledUserId: 1 }, { unique: true, sparse: true });
admissionApplicationSchema.index({ createdAt: -1 });
admissionApplicationSchema.index({ phone: 1 });

admissionApplicationSchema.plugin(auditPlugin);

export const AdmissionApplicationModel = mongoose.model<IAdmissionApplication>(
  "AdmissionApplication",
  admissionApplicationSchema,
);

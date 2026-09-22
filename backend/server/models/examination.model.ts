import { auditPlugin } from "../plugins/audit.plugin";
import mongoose, { type Document, Schema, type Types } from "mongoose";

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum ExamType {
  MID_SEM_1 = "Mid Semester 1",
  MID_SEM_2 = "Mid Semester 2",
  END_SEM = "End Semester",
  PRACTICAL = "Practical",
  VIVA = "Viva",
  ASSIGNMENT = "Assignment",
  QUIZ = "Quiz",
  SUPPLEMENTARY = "Supplementary",
  BACK = "Back Paper",
}

export enum ExamStatus {
  SCHEDULED = "Scheduled",
  ONGOING = "Ongoing",
  COMPLETED = "Completed",
  POSTPONED = "Postponed",
  CANCELLED = "Cancelled",
}

export enum GradePoint {
  O = 10, // Outstanding 90-100
  A_PLUS = 9, // Excellent 80-89
  A = 8, // Very Good 70-79
  B_PLUS = 7, // Good 60-69
  B = 6, // Above Average 50-59
  C = 5, // Average 45-49
  F = 0, // Fail <45
}

// ─── Examination Schedule ─────────────────────────────────────────────────────

export interface IExamSchedule extends Document {
  _id: Types.ObjectId;
  curriculumId?: Types.ObjectId;
  departmentId?: Types.ObjectId;
  batchId?: Types.ObjectId;
  sectionId?: Types.ObjectId;
  title: string;
  examType: ExamType;
  program: string;
  branch: string;
  semester: number;
  section: string;
  academicYear: string;
  status: ExamStatus;
  subjects: Array<{
    subjectId: Types.ObjectId;
    subjectCode: string;
    subjectName: string;
    examDate: Date;
    startTime: string;
    endTime: string;
    duration: number; // minutes
    venueId?: Types.ObjectId;
    venue: string;
    invigilators: Types.ObjectId[];
    maxMarks: number;
    passMarks: number;
  }>;
  createdBy: Types.ObjectId;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ExamScheduleSchema = new Schema<IExamSchedule>(
  {
    curriculumId: { type: Schema.Types.ObjectId, ref: "Curriculum" },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch" },
    sectionId: { type: Schema.Types.ObjectId, ref: "Section" },
    title: { type: String, required: true },
    examType: { type: String, enum: Object.values(ExamType), required: true },
    program: { type: String, required: true },
    branch: { type: String, required: true },
    semester: { type: Number, required: true, min: 1, max: 8 },
    section: { type: String, default: "A" },
    academicYear: { type: String, required: true },
    status: { type: String, enum: Object.values(ExamStatus), default: ExamStatus.SCHEDULED },
    subjects: [
      {
        subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
        subjectCode: { type: String, required: true, trim: true },
        subjectName: { type: String, required: true, trim: true },
        examDate: { type: Date, required: true },
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },
        duration: { type: Number, default: 180 },
        venueId: { type: Schema.Types.ObjectId, ref: "FacilitySpace" },
        venue: { type: String, required: true, trim: true },
        invigilators: [{ type: Schema.Types.ObjectId, ref: "User" }],
        maxMarks: { type: Number, required: true, min: 1 },
        passMarks: { type: Number, required: true, min: 0 },
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    publishedAt: { type: Date },
  },
  { timestamps: true },
);

ExamScheduleSchema.plugin(auditPlugin);
ExamScheduleSchema.index(
  { sectionId: 1, examType: 1, academicYear: 1 },
  { unique: true, partialFilterExpression: { sectionId: { $exists: true } } },
);

export const ExamScheduleModel = mongoose.model<IExamSchedule>("ExamSchedule", ExamScheduleSchema);

// ─── Student Marks (one record per student per exam per subject) ──────────────

export interface IStudentMarks extends Document {
  _id: Types.ObjectId;
  scheduleId: Types.ObjectId;
  studentId: Types.ObjectId;
  curriculumId?: Types.ObjectId;
  departmentId?: Types.ObjectId;
  batchId?: Types.ObjectId;
  sectionId?: Types.ObjectId;
  rollNumber: string;
  enrollmentNumber: string;
  subjectId: Types.ObjectId;
  subjectCode: string;
  examType: ExamType;
  semester: number;
  academicYear: string;
  assessmentPolicyId?: Types.ObjectId;
  assessmentPolicyCode?: string;
  assessmentPolicyVersion?: number;
  assessmentPolicySnapshot?: Record<string, unknown>;
  assessmentLedgerId?: Types.ObjectId;
  // Internal components
  internalComponents: Array<{ name: string; maxMarks: number; marksObtained: number }>;
  internalTotal: number;
  internalMax: number;
  // External
  externalMarks: number;
  externalMax: number;
  // Aggregates
  totalMarks: number;
  totalMax: number;
  percentage: number;
  gradePoint: number;
  gradeLetter: string;
  isPassed: boolean;
  isAbsent: boolean;
  isWithheld: boolean;
  // Results freeze
  isPublished: boolean;
  publishedAt?: Date;
  enteredBy: Types.ObjectId;
  verifiedBy?: Types.ObjectId;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StudentMarksSchema = new Schema<IStudentMarks>(
  {
    scheduleId: { type: Schema.Types.ObjectId, ref: "ExamSchedule" },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    curriculumId: { type: Schema.Types.ObjectId, ref: "Curriculum" },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch" },
    sectionId: { type: Schema.Types.ObjectId, ref: "Section" },
    rollNumber: { type: String, required: true },
    enrollmentNumber: { type: String },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    subjectCode: { type: String, required: true },
    examType: { type: String, enum: Object.values(ExamType), required: true },
    semester: { type: Number, required: true },
    academicYear: { type: String, required: true },
    assessmentPolicyId: { type: Schema.Types.ObjectId, ref: "AssessmentPolicy" },
    assessmentPolicyCode: { type: String },
    assessmentPolicyVersion: { type: Number },
    assessmentPolicySnapshot: { type: Schema.Types.Mixed },
    assessmentLedgerId: { type: Schema.Types.ObjectId, ref: "AssessmentScoreLedger" },
    internalComponents: [
      {
        name: String,
        maxMarks: Number,
        marksObtained: { type: Number, default: 0 },
      },
    ],
    internalTotal: { type: Number, default: 0 },
    internalMax: { type: Number, default: 30 },
    externalMarks: { type: Number, default: 0 },
    externalMax: { type: Number, default: 70 },
    totalMarks: { type: Number, default: 0 },
    totalMax: { type: Number, default: 100 },
    percentage: { type: Number, default: 0 },
    gradePoint: { type: Number, default: 0 },
    gradeLetter: { type: String, default: "F" },
    isPassed: { type: Boolean, default: false },
    isAbsent: { type: Boolean, default: false },
    isWithheld: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date },
    enteredBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },
  },
  { timestamps: true },
);

// Auto-compute grade before save
StudentMarksSchema.pre("save", async function () {
  if (!this.isAbsent && !this.isWithheld) {
    this.totalMarks = this.internalTotal + this.externalMarks;
    this.percentage = this.totalMax > 0 ? (this.totalMarks / this.totalMax) * 100 : 0;
    const snapshot = this.assessmentPolicySnapshot as
      | {
          resultTarget?: string;
          minimumTotalMarks?: number;
          gradeScale?: Array<{ letter: string; minimumPercentage: number; point: number }>;
        }
      | undefined;
    const policyGrade = snapshot?.gradeScale
      ?.filter(
        (band) =>
          band.letter && Number.isFinite(band.minimumPercentage) && Number.isFinite(band.point),
      )
      .sort((a, b) => b.minimumPercentage - a.minimumPercentage)
      .find((band) => this.percentage >= band.minimumPercentage);
    const p = this.percentage;
    if (policyGrade) {
      this.gradeLetter = policyGrade.letter;
      this.gradePoint = policyGrade.point;
    } else if (p >= 90) {
      this.gradeLetter = "O";
      this.gradePoint = 10;
    } else if (p >= 80) {
      this.gradeLetter = "A+";
      this.gradePoint = 9;
    } else if (p >= 70) {
      this.gradeLetter = "A";
      this.gradePoint = 8;
    } else if (p >= 60) {
      this.gradeLetter = "B+";
      this.gradePoint = 7;
    } else if (p >= 50) {
      this.gradeLetter = "B";
      this.gradePoint = 6;
    } else if (p >= 45) {
      this.gradeLetter = "C";
      this.gradePoint = 5;
    } else {
      this.gradeLetter = "F";
      this.gradePoint = 0;
    }
    this.isPassed = snapshot
      ? this.totalMarks >= Number(snapshot.minimumTotalMarks || 0) && this.gradePoint > 0
      : this.gradePoint > 0 &&
        this.internalTotal >= this.internalMax * 0.4 &&
        this.externalMarks >= this.externalMax * 0.4;
  }
});
StudentMarksSchema.index({ isPublished: 1, verifiedBy: 1, updatedAt: 1 });

StudentMarksSchema.index(
  { studentId: 1, subjectId: 1, examType: 1, academicYear: 1 },
  { unique: true },
);
StudentMarksSchema.index({ rollNumber: 1, semester: 1 });

export const StudentMarksModel = mongoose.model<IStudentMarks>("StudentMarks", StudentMarksSchema);

// ─── Exam Attempt Ledger (regular/backlog attempt history) ───────────────────

export interface IExamAttempt extends Document {
  _id: Types.ObjectId;
  scheduleId?: Types.ObjectId;
  studentId: Types.ObjectId;
  curriculumId?: Types.ObjectId;
  departmentId?: Types.ObjectId;
  batchId?: Types.ObjectId;
  sectionId?: Types.ObjectId;
  rollNumber: string;
  enrollmentNumber?: string;
  subjectId: Types.ObjectId;
  subjectCode: string;
  subjectName?: string;
  examType: ExamType;
  semester: number;
  academicYear: string;
  attemptType: "regular" | "backlog";
  attemptNo: number;
  internalTotal: number;
  internalMax: number;
  externalMarks: number;
  externalMax: number;
  totalMarks: number;
  totalMax: number;
  percentage: number;
  gradePoint: number;
  gradeLetter: string;
  isPassed: boolean;
  isAbsent: boolean;
  enteredBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ExamAttemptSchema = new Schema<IExamAttempt>(
  {
    scheduleId: { type: Schema.Types.ObjectId, ref: "ExamSchedule" },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    curriculumId: { type: Schema.Types.ObjectId, ref: "Curriculum" },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch" },
    sectionId: { type: Schema.Types.ObjectId, ref: "Section" },
    rollNumber: { type: String, required: true },
    enrollmentNumber: { type: String },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    subjectCode: { type: String, required: true },
    subjectName: { type: String },
    examType: { type: String, enum: Object.values(ExamType), required: true },
    semester: { type: Number, required: true },
    academicYear: { type: String, required: true },
    attemptType: { type: String, enum: ["regular", "backlog"], required: true },
    attemptNo: { type: Number, required: true, min: 1 },
    internalTotal: { type: Number, default: 0 },
    internalMax: { type: Number, default: 30 },
    externalMarks: { type: Number, default: 0 },
    externalMax: { type: Number, default: 70 },
    totalMarks: { type: Number, default: 0 },
    totalMax: { type: Number, default: 100 },
    percentage: { type: Number, default: 0 },
    gradePoint: { type: Number, default: 0 },
    gradeLetter: { type: String, default: "F" },
    isPassed: { type: Boolean, default: false },
    isAbsent: { type: Boolean, default: false },
    enteredBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

ExamAttemptSchema.index({
  studentId: 1,
  subjectId: 1,
  examType: 1,
  academicYear: 1,
  attemptType: 1,
  attemptNo: 1,
});
ExamAttemptSchema.index(
  { scheduleId: 1, studentId: 1, subjectId: 1, examType: 1 },
  { unique: true, partialFilterExpression: { scheduleId: { $exists: true } } },
);
ExamAttemptSchema.index({ departmentId: 1, academicYear: 1, semester: 1 });

export const ExamAttemptModel = mongoose.model<IExamAttempt>("ExamAttempt", ExamAttemptSchema);

// ─── Semester Result (consolidated) ──────────────────────────────────────────

export interface ISemesterResult extends Document {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  curriculumId?: Types.ObjectId;
  departmentId?: Types.ObjectId;
  batchId?: Types.ObjectId;
  sectionId?: Types.ObjectId;
  rollNumber: string;
  enrollmentNumber: string;
  bputExamRoll: string;
  program: string;
  branch: string;
  semester: number;
  academicYear: string;
  subjectResults: Array<{
    subjectCode: string;
    subjectName: string;
    credits: number;
    internalMarks: number;
    externalMarks: number;
    totalMarks: number;
    gradePoint: number;
    gradeLetter: string;
    creditPoints: number;
    isPassed: boolean;
    isBack: boolean;
  }>;
  totalCreditsRegistered: number;
  totalCreditsEarned: number;
  totalCreditPoints: number;
  sgpa: number;
  cgpa: number;
  backlogs: number;
  backSubjects: string[];
  result: "PASS" | "FAIL" | "WITHHELD";
  rank?: number;
  isPublished: boolean;
  publishedAt?: Date;
  marksheetUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SemesterResultSchema = new Schema<ISemesterResult>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    curriculumId: { type: Schema.Types.ObjectId, ref: "Curriculum" },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch" },
    sectionId: { type: Schema.Types.ObjectId, ref: "Section" },
    rollNumber: { type: String, required: true },
    enrollmentNumber: { type: String },
    bputExamRoll: { type: String },
    program: { type: String, required: true },
    branch: { type: String, required: true },
    semester: { type: Number, required: true, min: 1, max: 8 },
    academicYear: { type: String, required: true },
    subjectResults: [
      {
        subjectCode: String,
        subjectName: String,
        credits: Number,
        internalMarks: Number,
        externalMarks: Number,
        totalMarks: Number,
        gradePoint: Number,
        gradeLetter: String,
        creditPoints: Number,
        isPassed: Boolean,
        isBack: Boolean,
      },
    ],
    totalCreditsRegistered: { type: Number, default: 0 },
    totalCreditsEarned: { type: Number, default: 0 },
    totalCreditPoints: { type: Number, default: 0 },
    sgpa: { type: Number, default: 0 },
    cgpa: { type: Number, default: 0 },
    backlogs: { type: Number, default: 0 },
    backSubjects: { type: [String], default: [] },
    result: { type: String, enum: ["PASS", "FAIL", "WITHHELD"], default: "FAIL" },
    rank: { type: Number },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date },
    marksheetUrl: { type: String },
  },
  { timestamps: true },
);

SemesterResultSchema.index({ studentId: 1, semester: 1, academicYear: 1 }, { unique: true });
SemesterResultSchema.index({ rollNumber: 1 });
SemesterResultSchema.index({ departmentId: 1, semester: 1, academicYear: 1 });

export const SemesterResultModel = mongoose.model<ISemesterResult>(
  "SemesterResult",
  SemesterResultSchema,
);

// ─── Result Recheck / Revaluation Request (M20) ──────────────────────────────

export interface IRecheckRequest extends Document {
  studentId: mongoose.Types.ObjectId;
  rollNumber: string;
  semester: number;
  academicYear: string;
  subjectCode: string;
  subjectName: string;
  requestType: "recheck" | "revaluation";
  reason?: string;
  currentMarks: number;
  revisedMarks?: number;
  status: "pending" | "under_review" | "marks_updated" | "no_change" | "rejected";
  reviewedBy?: mongoose.Types.ObjectId;
  reviewNotes?: string;
  reviewedAt?: Date;
  fee: number;
  feePaid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RecheckRequestSchema = new Schema<IRecheckRequest>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rollNumber: { type: String, required: true, trim: true },
    semester: { type: Number, required: true, min: 1 },
    academicYear: { type: String, required: true, trim: true },
    subjectCode: { type: String, required: true, trim: true },
    subjectName: { type: String, required: true, trim: true },
    requestType: { type: String, enum: ["recheck", "revaluation"], required: true },
    reason: { type: String, trim: true },
    currentMarks: { type: Number, required: true, min: 0 },
    revisedMarks: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ["pending", "under_review", "marks_updated", "no_change", "rejected"],
      default: "pending",
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewNotes: { type: String },
    reviewedAt: { type: Date },
    fee: { type: Number, default: 500 },
    feePaid: { type: Boolean, default: false },
  },
  { timestamps: true },
);

RecheckRequestSchema.index({ studentId: 1, semester: 1, academicYear: 1 });
RecheckRequestSchema.index({ status: 1 });

export const RecheckRequestModel = mongoose.model<IRecheckRequest>(
  "RecheckRequest",
  RecheckRequestSchema,
);

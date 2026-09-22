import { Schema, model, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";
import type { IAssessmentComponent } from "./assessment-policy.model";

export enum GradebookStatus {
  DRAFT = "draft",
  RETURNED = "returned",
  SUBMITTED = "submitted",
  VERIFIED = "verified",
  FROZEN = "frozen",
}
export enum ActivityStatus {
  PLANNED = "planned",
  OPEN = "open",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}
export interface IAssessmentActivity extends Document {
  _id: Types.ObjectId;
  policyId: Types.ObjectId;
  componentKey: string;
  subjectId: Types.ObjectId;
  sectionId?: Types.ObjectId;
  semester: number;
  academicYear: string;
  sequence: number;
  title: string;
  scheduledAt: Date;
  maximumMarks: number;
  attendanceRecordId?: Types.ObjectId;
  status: ActivityStatus;
  createdBy: Types.ObjectId;
}
export interface IScoreAttempt {
  componentKey: string;
  activityId?: Types.ObjectId;
  sourceRecordId?: Types.ObjectId;
  rawMarks: number;
  maximumMarks: number;
  attendanceRecordId?: Types.ObjectId;
  attended?: boolean;
  isMakeup: boolean;
  recordedBy: Types.ObjectId;
  recordedAt: Date;
}
export interface IAssessmentScoreLedger extends Document {
  policyId: Types.ObjectId;
  policyCode: string;
  policyVersion: number;
  policySnapshot: {
    maximumMarks: number;
    resultTarget: string;
    minimumTotalMarks: number;
    gradeScale: Array<{ letter: string; minimumPercentage: number; point: number }>;
    components: IAssessmentComponent[];
  };
  studentId: Types.ObjectId;
  subjectId: Types.ObjectId;
  sectionId?: Types.ObjectId;
  semester: number;
  academicYear: string;
  attempts: IScoreAttempt[];
  componentResults: Array<{ key: string; marks: number; maximumMarks: number; passed: boolean }>;
  totalMarks: number;
  maximumMarks: number;
  percentage: number;
  gradeLetter: string;
  gradePoint: number;
  passed: boolean;
  status: GradebookStatus;
  enteredBy: Types.ObjectId;
  submittedAt?: Date;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewNote?: string;
  verifiedBy?: Types.ObjectId;
  verifiedAt?: Date;
  frozenBy?: Types.ObjectId;
  frozenAt?: Date;
}
const ActivitySchema = new Schema<IAssessmentActivity>(
  {
    policyId: { type: Schema.Types.ObjectId, ref: "AssessmentPolicy", required: true },
    componentKey: { type: String, required: true, lowercase: true, trim: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    sectionId: { type: Schema.Types.ObjectId, ref: "Section" },
    semester: { type: Number, required: true, min: 1 },
    academicYear: { type: String, required: true },
    sequence: { type: Number, required: true, min: 1 },
    title: { type: String, required: true, trim: true },
    scheduledAt: { type: Date, required: true },
    maximumMarks: { type: Number, required: true, min: 0.01 },
    attendanceRecordId: { type: Schema.Types.ObjectId, ref: "AttendanceRecord" },
    status: { type: String, enum: Object.values(ActivityStatus), default: ActivityStatus.PLANNED },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
ActivitySchema.plugin(auditPlugin);
ActivitySchema.index(
  { policyId: 1, componentKey: 1, subjectId: 1, sectionId: 1, academicYear: 1, sequence: 1 },
  { unique: true },
);
const AttemptSchema = new Schema<IScoreAttempt>(
  {
    componentKey: { type: String, required: true, lowercase: true },
    activityId: { type: Schema.Types.ObjectId, ref: "AssessmentActivity" },
    sourceRecordId: { type: Schema.Types.ObjectId },
    rawMarks: { type: Number, required: true, min: 0 },
    maximumMarks: { type: Number, required: true, min: 0.01 },
    attendanceRecordId: { type: Schema.Types.ObjectId, ref: "AttendanceRecord" },
    attended: { type: Boolean },
    isMakeup: { type: Boolean, default: false },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recordedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);
const ResultSchema = new Schema(
  { key: String, marks: Number, maximumMarks: Number, passed: Boolean },
  { _id: false },
);
const LedgerSchema = new Schema<IAssessmentScoreLedger>(
  {
    policyId: { type: Schema.Types.ObjectId, ref: "AssessmentPolicy", required: true },
    policyCode: { type: String, required: true },
    policyVersion: { type: Number, required: true },
    policySnapshot: {
      maximumMarks: { type: Number, required: true },
      resultTarget: { type: String, required: true },
      minimumTotalMarks: { type: Number, default: 0 },
      gradeScale: { type: [Schema.Types.Mixed], default: [] },
      components: { type: [Schema.Types.Mixed], required: true },
    },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    sectionId: { type: Schema.Types.ObjectId, ref: "Section" },
    semester: { type: Number, required: true, min: 1 },
    academicYear: { type: String, required: true },
    attempts: { type: [AttemptSchema], default: [] },
    componentResults: { type: [ResultSchema], default: [] },
    totalMarks: { type: Number, default: 0 },
    maximumMarks: { type: Number, required: true },
    percentage: { type: Number, default: 0 },
    gradeLetter: { type: String, default: "" },
    gradePoint: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    status: { type: String, enum: Object.values(GradebookStatus), default: GradebookStatus.DRAFT },
    enteredBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    submittedAt: Date,
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    reviewNote: { type: String, trim: true, maxlength: 1000 },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: Date,
    frozenBy: { type: Schema.Types.ObjectId, ref: "User" },
    frozenAt: Date,
  },
  { timestamps: true },
);
LedgerSchema.plugin(auditPlugin);
LedgerSchema.index(
  { policyId: 1, studentId: 1, subjectId: 1, semester: 1, academicYear: 1 },
  { unique: true },
);
LedgerSchema.index({ subjectId: 1, sectionId: 1, academicYear: 1, status: 1 });
export const AssessmentActivityModel = model<IAssessmentActivity>(
  "AssessmentActivity",
  ActivitySchema,
);
export const AssessmentScoreLedgerModel = model<IAssessmentScoreLedger>(
  "AssessmentScoreLedger",
  LedgerSchema,
);

import { Schema, model, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export enum TransferCreditStatus {
  DRAFT = "draft",
  SUBMITTED = "submitted",
  APPROVED = "approved",
  PARTIALLY_APPROVED = "partially_approved",
  REJECTED = "rejected",
}

export interface ITransferCreditCourse {
  _id?: Types.ObjectId;
  externalCourseCode: string;
  externalCourseName: string;
  externalCredits: number;
  grade?: string;
  targetSubjectId?: Types.ObjectId;
  targetSubjectCode?: string;
  targetSubjectName?: string;
  approvedCredits: number;
  decision: "pending" | "approved" | "rejected";
  remarks?: string;
}

export interface ITransferCreditEvaluation extends Document {
  studentProfileId: Types.ObjectId;
  studentId: Types.ObjectId;
  externalInstitution: string;
  externalProgramme: string;
  transcriptDocumentId?: Types.ObjectId;
  referenceNumber: string;
  courses: ITransferCreditCourse[];
  status: TransferCreditStatus;
  submittedAt?: Date;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewRemarks?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAcademicPlanItem {
  subjectId: Types.ObjectId;
  subjectCode: string;
  subjectName: string;
  credits: number;
  plannedSemester: number;
  status: "planned" | "registered" | "completed" | "waived";
}

export interface IAcademicPlan extends Document {
  studentProfileId: Types.ObjectId;
  studentId: Types.ObjectId;
  curriculumId: Types.ObjectId;
  items: IAcademicPlanItem[];
  goalGraduationTerm?: string;
  notes?: string;
  status: "draft" | "submitted" | "approved" | "returned";
  submittedAt?: Date;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewRemarks?: string;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TransferCreditCourseSchema = new Schema<ITransferCreditCourse>(
  {
    externalCourseCode: { type: String, required: true, trim: true, maxlength: 40 },
    externalCourseName: { type: String, required: true, trim: true, maxlength: 180 },
    externalCredits: { type: Number, required: true, min: 0, max: 30 },
    grade: { type: String, trim: true, maxlength: 20 },
    targetSubjectId: { type: Schema.Types.ObjectId, ref: "Subject" },
    targetSubjectCode: { type: String, trim: true, maxlength: 40 },
    targetSubjectName: { type: String, trim: true, maxlength: 180 },
    approvedCredits: { type: Number, default: 0, min: 0, max: 30 },
    decision: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    remarks: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: true },
);

const TransferCreditEvaluationSchema = new Schema<ITransferCreditEvaluation>(
  {
    studentProfileId: {
      type: Schema.Types.ObjectId,
      ref: "StudentProfile",
      required: true,
      index: true,
    },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    externalInstitution: { type: String, required: true, trim: true, maxlength: 240 },
    externalProgramme: { type: String, required: true, trim: true, maxlength: 180 },
    transcriptDocumentId: { type: Schema.Types.ObjectId, ref: "Document" },
    referenceNumber: { type: String, required: true, trim: true, maxlength: 80 },
    courses: {
      type: [TransferCreditCourseSchema],
      validate: [(value: unknown[]) => value.length > 0],
    },
    status: {
      type: String,
      enum: Object.values(TransferCreditStatus),
      default: TransferCreditStatus.DRAFT,
      index: true,
    },
    submittedAt: Date,
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    reviewRemarks: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

TransferCreditEvaluationSchema.plugin(auditPlugin);
TransferCreditEvaluationSchema.index({ studentProfileId: 1, referenceNumber: 1 }, { unique: true });

const AcademicPlanItemSchema = new Schema<IAcademicPlanItem>(
  {
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    subjectCode: { type: String, required: true, trim: true },
    subjectName: { type: String, required: true, trim: true },
    credits: { type: Number, required: true, min: 0, max: 30 },
    plannedSemester: { type: Number, required: true, min: 1, max: 20 },
    status: {
      type: String,
      enum: ["planned", "registered", "completed", "waived"],
      default: "planned",
    },
  },
  { _id: false },
);

const AcademicPlanSchema = new Schema<IAcademicPlan>(
  {
    studentProfileId: {
      type: Schema.Types.ObjectId,
      ref: "StudentProfile",
      required: true,
      unique: true,
    },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    curriculumId: { type: Schema.Types.ObjectId, ref: "Curriculum", required: true },
    items: { type: [AcademicPlanItemSchema], default: [] },
    goalGraduationTerm: { type: String, trim: true, maxlength: 80 },
    notes: { type: String, trim: true, maxlength: 3000 },
    status: {
      type: String,
      enum: ["draft", "submitted", "approved", "returned"],
      default: "draft",
    },
    submittedAt: Date,
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    reviewRemarks: { type: String, trim: true, maxlength: 2000 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

AcademicPlanSchema.plugin(auditPlugin);

export const TransferCreditEvaluationModel = model<ITransferCreditEvaluation>(
  "TransferCreditEvaluation",
  TransferCreditEvaluationSchema,
);
export const AcademicPlanModel = model<IAcademicPlan>("AcademicPlan", AcademicPlanSchema);

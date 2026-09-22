import { auditPlugin } from "../plugins/audit.plugin";
import type { Types, Document } from "mongoose";
import { Schema, model } from "mongoose";

export interface ISubmission {
  studentId: Types.ObjectId;
  submittedAt: Date;
  fileUrl?: string;
  textContent?: string;
  marks?: number;
  rawMarks?: number;
  penaltyApplied?: number;
  grade?: string;
  feedback?: string;
  evaluatedBy?: Types.ObjectId;
  evaluatedAt?: Date;
  isLate: boolean;
  gradingHistory: Array<{
    rawMarks: number;
    marks: number;
    grade: string;
    feedback?: string;
    evaluatedBy: Types.ObjectId;
    evaluatedAt: Date;
  }>;
}

export enum AssignmentStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  CLOSED = "closed",
  EVALUATED = "evaluated",
}

export interface IAssignment extends Document {
  sectionId: Types.ObjectId;
  title: string;
  description: string;
  subjectId: Types.ObjectId;
  subjectCode: string;
  facultyId: Types.ObjectId;
  departmentId: Types.ObjectId;
  program: string;
  semester: number;
  section: string;
  academicYear: string;
  maxMarks: number;
  dueDate: Date;
  allowLateSubmission: boolean;
  latePenaltyPercent: number;
  attachmentUrl?: string;
  submissions: ISubmission[];
  totalSubmissions: number;
  status: AssignmentStatus;
  publishedAt?: Date;
  closedAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubmissionSchema = new Schema<ISubmission>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    submittedAt: { type: Date, required: true },
    fileUrl: { type: String, trim: true, maxlength: 2000 },
    textContent: { type: String, trim: true, maxlength: 20000 },
    marks: { type: Number, min: 0 },
    rawMarks: { type: Number, min: 0 },
    penaltyApplied: { type: Number, min: 0, max: 100 },
    grade: { type: String },
    feedback: { type: String, trim: true, maxlength: 5000 },
    evaluatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    evaluatedAt: { type: Date },
    isLate: { type: Boolean, default: false },
    gradingHistory: {
      type: [
        new Schema(
          {
            rawMarks: { type: Number, required: true, min: 0 },
            marks: { type: Number, required: true, min: 0 },
            grade: { type: String, required: true },
            feedback: { type: String, trim: true },
            evaluatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
            evaluatedAt: { type: Date, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { _id: true },
);

const AssignmentSchema = new Schema<IAssignment>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    sectionId: { type: Schema.Types.ObjectId, ref: "Section", required: true, index: true },
    description: { type: String, required: true, trim: true, maxlength: 20000 },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    subjectCode: { type: String, required: true, trim: true },
    facultyId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    program: { type: String, required: true },
    semester: { type: Number, required: true, min: 1 },
    section: { type: String, required: true, trim: true },
    academicYear: { type: String, required: true },
    maxMarks: { type: Number, required: true, min: 1, max: 1000 },
    dueDate: { type: Date, required: true },
    allowLateSubmission: { type: Boolean, default: false },
    latePenaltyPercent: { type: Number, default: 0, min: 0, max: 100 },
    attachmentUrl: { type: String },
    submissions: [SubmissionSchema],
    totalSubmissions: { type: Number, default: 0 },
    status: {
      type: String,
      enum: Object.values(AssignmentStatus),
      default: AssignmentStatus.DRAFT,
      index: true,
    },
    publishedAt: { type: Date },
    closedAt: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

AssignmentSchema.index({ subjectId: 1, academicYear: 1, section: 1 });
AssignmentSchema.index({ sectionId: 1, status: 1, dueDate: 1 });

// Apply audit plugin (soft delete + createdBy/updatedBy)
SubmissionSchema.plugin(auditPlugin);

export const AssignmentModel = model<IAssignment>("Assignment", AssignmentSchema);

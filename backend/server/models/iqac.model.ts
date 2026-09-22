import { auditPlugin } from "../plugins/audit.plugin";
import type { Types, Document } from "mongoose";
import { Schema, model } from "mongoose";

// IQAC - Internal Quality Assurance Cell
export interface IIQACFeedback extends Document {
  academicYear: string;
  semesterType: "odd" | "even";
  feedbackType:
    | "student_on_faculty"
    | "student_course_exit"
    | "faculty_on_curriculum"
    | "alumni"
    | "employer"
    | "parent";
  targetId?: Types.ObjectId; // FacultyId or SubjectId depending on type
  respondentId: Types.ObjectId;
  ratings: { criterion: string; score: number }[];
  averageScore: number;
  textFeedback?: string;
  isAnonymous: boolean;
  createdAt: Date;
}

export interface IIQACAudit extends Document {
  academicYear: string;
  auditType: "academic" | "administrative" | "infrastructure" | "documentation";
  departmentId?: Types.ObjectId;
  auditDate: Date;
  auditedBy: Types.ObjectId[];
  findings: {
    criterion: string;
    observation: string;
    status: "compliant" | "partial" | "non_compliant";
    remark?: string;
  }[];
  overallCompliance: number; // Percentage
  actionPlan?: string;
  closureDate?: Date;
  status: "scheduled" | "ongoing" | "completed" | "closed";
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// CO-PO Attainment (NBA)
export interface ICOPOAttainment extends Document {
  departmentId: Types.ObjectId;
  academicYear: string;
  subjectId: Types.ObjectId;
  subjectCode: string;
  program: string;
  semester: number;
  section: string;
  coAttainments: {
    coCode: string;
    targetLevel: number;
    targetPercentage?: number;
    directAttainment: number;
    indirectAttainment: number;
    finalAttainment: number;
    attainmentLevel?: number;
    attainedStudents?: number;
    assessedStudents?: number;
    indirectResponseCount?: number;
  }[];
  poAttainments: { poCode: string; attainmentLevel: number; attainmentPercentage?: number }[];
  directWeight?: number;
  indirectWeight?: number;
  evidence?: {
    quizCount: number;
    attemptCount: number;
    mappedQuestionCount: number;
    feedbackResponseCount: number;
  };
  gaps?: Array<{ coCode: string; gap: number; message: string; actionPlan?: string }>;
  calculationVersion?: number;
  status?: "draft" | "submitted" | "approved";
  submittedBy?: Types.ObjectId;
  submittedAt?: Date;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  calculatedBy: Types.ObjectId;
  calculatedAt: Date;
}

const IQACFeedbackSchema = new Schema<IIQACFeedback>(
  {
    academicYear: { type: String, required: true },
    semesterType: { type: String, enum: ["odd", "even"], required: true },
    feedbackType: {
      type: String,
      enum: [
        "student_on_faculty",
        "student_course_exit",
        "faculty_on_curriculum",
        "alumni",
        "employer",
        "parent",
      ],
      required: true,
    },
    targetId: { type: Schema.Types.ObjectId },
    respondentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ratings: [{ criterion: String, score: Number }],
    averageScore: { type: Number, default: 0 },
    textFeedback: { type: String },
    isAnonymous: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const IQACAuditSchema = new Schema<IIQACAudit>(
  {
    academicYear: { type: String, required: true },
    auditType: {
      type: String,
      enum: ["academic", "administrative", "infrastructure", "documentation"],
      required: true,
    },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    auditDate: { type: Date, required: true },
    auditedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    findings: [
      {
        criterion: { type: String },
        observation: { type: String },
        status: { type: String, enum: ["compliant", "partial", "non_compliant"] },
        remark: { type: String },
      },
    ],
    overallCompliance: { type: Number, default: 0 },
    actionPlan: { type: String },
    closureDate: { type: Date },
    status: {
      type: String,
      enum: ["scheduled", "ongoing", "completed", "closed"],
      default: "scheduled",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

const COPOAttainmentSchema = new Schema<ICOPOAttainment>(
  {
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true, index: true },
    academicYear: { type: String, required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    subjectCode: { type: String, required: true },
    program: { type: String, required: true },
    semester: { type: Number, required: true },
    section: { type: String, required: true },
    coAttainments: [
      {
        coCode: { type: String },
        targetLevel: { type: Number },
        targetPercentage: { type: Number, min: 0, max: 100 },
        directAttainment: { type: Number },
        indirectAttainment: { type: Number },
        finalAttainment: { type: Number },
        attainmentLevel: { type: Number, min: 0, max: 3 },
        attainedStudents: { type: Number, min: 0 },
        assessedStudents: { type: Number, min: 0 },
        indirectResponseCount: { type: Number, min: 0 },
      },
    ],
    poAttainments: [{ poCode: String, attainmentLevel: Number, attainmentPercentage: Number }],
    directWeight: { type: Number, min: 0, max: 100, default: 80 },
    indirectWeight: { type: Number, min: 0, max: 100, default: 20 },
    evidence: {
      quizCount: { type: Number, default: 0 },
      attemptCount: { type: Number, default: 0 },
      mappedQuestionCount: { type: Number, default: 0 },
      feedbackResponseCount: { type: Number, default: 0 },
    },
    gaps: [
      {
        coCode: String,
        gap: Number,
        message: String,
        actionPlan: String,
      },
    ],
    calculationVersion: { type: Number, default: 2, min: 1 },
    status: {
      type: String,
      enum: ["draft", "submitted", "approved"],
      default: "draft",
      index: true,
    },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
    submittedAt: Date,
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
    calculatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    calculatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

COPOAttainmentSchema.index(
  { departmentId: 1, academicYear: 1, subjectId: 1, section: 1 },
  { unique: true },
);

// Apply audit plugin (soft delete + createdBy/updatedBy)
IQACFeedbackSchema.plugin(auditPlugin);
IQACFeedbackSchema.index(
  { academicYear: 1, semesterType: 1, feedbackType: 1, targetId: 1, respondentId: 1 },
  { unique: true },
);

export const IQACFeedbackModel = model<IIQACFeedback>("IQACFeedback", IQACFeedbackSchema);
export const IQACAuditModel = model<IIQACAudit>("IQACAudit", IQACAuditSchema);
export const COPOAttainmentModel = model<ICOPOAttainment>("COPOAttainment", COPOAttainmentSchema);

import { auditPlugin } from "../plugins/audit.plugin";
import type { Document, Types } from "mongoose";
import mongoose, { Schema } from "mongoose";

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum SubjectType {
  THEORY = "Theory",
  PRACTICAL = "Practical",
  PROJECT = "Project",
  SEMINAR = "Seminar",
  ELECTIVE = "Elective",
  OPEN_ELECTIVE = "Open Elective",
}

export enum SubjectCategory {
  CORE = "Core",
  PROFESSIONAL = "Professional Elective",
  OPEN = "Open Elective",
  MANDATORY = "Mandatory",
  AUDIT = "Audit",
  EXTRA_CURRICULAR = "Extra-Curricular",
}

export enum GradeSystem {
  BPUT_10_POINT = "BPUT_10",
  PERCENTAGE = "PERCENTAGE",
}

export interface ISubject extends Document {
  _id: Types.ObjectId;
  code: string; // BPUT subject code
  name: string;
  shortName: string;
  departmentId: Types.ObjectId;
  departmentCode: string;
  type: SubjectType;
  category: SubjectCategory;
  credits: number;
  lectureHours: number; // L
  tutorialHours: number; // T
  practicalHours: number; // P
  totalHours: number; // total contact hours per week
  semester?: number;
  program?: string; // Legacy/derived field; curriculum semester plans are source of truth.
  // Marks distribution
  internalMarks: number; // Max internal / sessional
  externalMarks: number; // Max external / ESE
  totalMarks: number;
  passMarksInternal: number;
  passMarksExternal: number;
  // BPUT info
  bputPaperCode?: string;
  syllabusPdfUrl?: string;
  // Flags
  hasLabComponent: boolean;
  isElective: boolean;
  isActive: boolean;
  // Audit
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const SubjectSchema = new Schema<ISubject>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    shortName: { type: String, required: true, trim: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    departmentCode: { type: String, required: true, uppercase: true },
    type: { type: String, enum: Object.values(SubjectType), required: true },
    category: { type: String, enum: Object.values(SubjectCategory), default: SubjectCategory.CORE },
    credits: { type: Number, required: true, min: 0, max: 10 },
    lectureHours: { type: Number, default: 0 },
    tutorialHours: { type: Number, default: 0 },
    practicalHours: { type: Number, default: 0 },
    totalHours: { type: Number, default: 0 },
    semester: { type: Number, min: 1 },
    program: { type: String },
    internalMarks: { type: Number, default: 30 },
    externalMarks: { type: Number, default: 70 },
    totalMarks: { type: Number, default: 100 },
    passMarksInternal: { type: Number, default: 12 },
    passMarksExternal: { type: Number, default: 28 },
    bputPaperCode: { type: String },
    syllabusPdfUrl: { type: String },
    hasLabComponent: { type: Boolean, default: false },
    isElective: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// index on `code` is created by `unique: true` in the field definition above
SubjectSchema.index({ departmentId: 1 });

SubjectSchema.plugin(auditPlugin);
SubjectSchema.path("createdBy").required(true);

export const SubjectModel = mongoose.model<ISubject>("Subject", SubjectSchema);

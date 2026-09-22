import { auditPlugin } from "../plugins/audit.plugin";
import type { Document, Types } from "mongoose";
import mongoose, { Schema } from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

export enum RegistrationStatus {
  DRAFT = "draft", // Student is still building subject list
  SUBMITTED = "submitted", // Submitted for HOD approval
  APPROVED = "approved", // Approved; student may attend classes
  FROZEN = "frozen", // Frozen after add/drop period ends
  REJECTED = "rejected", // Rejected; student must resubmit
  WITHDRAWN = "withdrawn", // Withdrawn by the student before the add/drop deadline
}

export enum RegistrationSubjectType {
  THEORY = "theory",
  LAB = "lab",
  ELECTIVE = "elective",
  OPEN_ELEC = "open_elective",
  PROJECT = "project",
  SEMINAR = "seminar",
  AUDIT = "audit", // Non-graded audit course
}

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface ISubjectRegistrationItem {
  subjectId: Types.ObjectId;
  subjectCode: string;
  subjectName: string;
  credits: number;
  type: RegistrationSubjectType;
  isBacklog: boolean; // Re-registering a failed subject
}

export interface ISemesterRegistration extends Document {
  _id: Types.ObjectId;

  // Student identity
  studentId: Types.ObjectId;
  rollNumber: string;
  studentName: string;
  program: string;
  branch: string;
  batchId?: Types.ObjectId;
  sectionId?: Types.ObjectId;
  curriculumId?: Types.ObjectId;
  departmentId: Types.ObjectId;

  // Semester context
  targetSemester: number; // Semester student is registering FOR
  academicYear: string; // E.g. "2024-25"

  // Subjects
  registeredSubjects: ISubjectRegistrationItem[];
  totalCredits: number; // Computed from registeredSubjects

  // Approval workflow
  status: RegistrationStatus;
  submittedAt?: Date;
  reviewedBy?: Types.ObjectId;
  reviewedByName?: string;
  reviewedAt?: Date;
  frozenAt?: Date;
  remarks?: string; // HOD rejection reason or notes

  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schema
// ─────────────────────────────────────────────────────────────────────────────

const SubjectItemSchema = new Schema<ISubjectRegistrationItem>(
  {
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    subjectCode: { type: String, required: true, trim: true },
    subjectName: { type: String, required: true, trim: true },
    credits: { type: Number, required: true, min: 0, max: 6 },
    type: { type: String, enum: Object.values(RegistrationSubjectType), required: true },
    isBacklog: { type: Boolean, default: false },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// Main schema
// ─────────────────────────────────────────────────────────────────────────────

const SemesterRegistrationSchema = new Schema<ISemesterRegistration>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    rollNumber: { type: String, required: true, trim: true },
    studentName: { type: String, required: true, trim: true },
    program: { type: String, required: true },
    branch: { type: String, required: true },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch" },
    sectionId: { type: Schema.Types.ObjectId, ref: "Section" },
    curriculumId: { type: Schema.Types.ObjectId, ref: "Curriculum" },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true, index: true },

    targetSemester: { type: Number, required: true, min: 1, max: 10 },
    academicYear: { type: String, required: true, trim: true },

    registeredSubjects: { type: [SubjectItemSchema], default: [] },
    totalCredits: { type: Number, default: 0, min: 0 },

    status: {
      type: String,
      enum: Object.values(RegistrationStatus),
      default: RegistrationStatus.DRAFT,
    },
    submittedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedByName: { type: String },
    reviewedAt: { type: Date },
    frozenAt: { type: Date },
    remarks: { type: String, trim: true },
  },
  { timestamps: true },
);

// ─────────────────────────────────────────────────────────────────────────────
// Compound unique index — one registration per student per semester per year
// ─────────────────────────────────────────────────────────────────────────────

SemesterRegistrationSchema.index(
  { studentId: 1, targetSemester: 1, academicYear: 1 },
  { unique: true },
);
SemesterRegistrationSchema.index({ departmentId: 1, status: 1 });
SemesterRegistrationSchema.index({ academicYear: 1, targetSemester: 1 });

SemesterRegistrationSchema.plugin(auditPlugin);

export const SemesterRegistrationModel = mongoose.model<ISemesterRegistration>(
  "SemesterRegistration",
  SemesterRegistrationSchema,
);

export interface ISemesterRegistrationWindow extends Document {
  departmentId: Types.ObjectId;
  targetSemester: number;
  academicYear: string;
  opensAt: Date;
  closesAt: Date;
  addDropEndsAt: Date;
  minCredits: number;
  maxCredits: number;
  requireFeeClearance: boolean;
  allowBacklogs: boolean;
  maxBacklogSubjects: number;
  isActive: boolean;
  configuredBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SemesterRegistrationWindowSchema = new Schema<ISemesterRegistrationWindow>(
  {
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    targetSemester: { type: Number, required: true, min: 1, max: 10 },
    academicYear: { type: String, required: true, trim: true },
    opensAt: { type: Date, required: true },
    closesAt: { type: Date, required: true },
    addDropEndsAt: { type: Date, required: true },
    minCredits: { type: Number, required: true, min: 0, max: 60, default: 12 },
    maxCredits: { type: Number, required: true, min: 1, max: 60, default: 30 },
    requireFeeClearance: { type: Boolean, default: true },
    allowBacklogs: { type: Boolean, default: true },
    maxBacklogSubjects: { type: Number, default: 6, min: 0, max: 20 },
    isActive: { type: Boolean, default: true },
    configuredBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
SemesterRegistrationWindowSchema.index(
  { departmentId: 1, targetSemester: 1, academicYear: 1 },
  { unique: true },
);
SemesterRegistrationWindowSchema.index({ isActive: 1, opensAt: 1, closesAt: 1 });

export const SemesterRegistrationWindowModel = mongoose.model<ISemesterRegistrationWindow>(
  "SemesterRegistrationWindow",
  SemesterRegistrationWindowSchema,
);

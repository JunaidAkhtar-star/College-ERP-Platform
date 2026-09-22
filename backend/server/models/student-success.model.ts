import { Schema, model, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export interface IStudentRiskSignal {
  key: "attendance" | "backlogs" | "cgpa" | "fee_balance" | "advisor_followup";
  label: string;
  value: number;
  threshold: number;
  score: number;
  severity: "low" | "medium" | "high";
  explanation: string;
}

export interface IStudentRiskSnapshot extends Document {
  studentProfileId: Types.ObjectId;
  studentId: Types.ObjectId;
  departmentId: Types.ObjectId;
  mentorId?: Types.ObjectId;
  academicYear: string;
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  signals: IStudentRiskSignal[];
  calculatedAt: Date;
  sourceUpdatedAt: Date;
}

export interface IStudentSuccessCase extends Document {
  studentProfileId: Types.ObjectId;
  studentId: Types.ObjectId;
  departmentId: Types.ObjectId;
  riskSnapshotId?: Types.ObjectId;
  title: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "contacted" | "in_progress" | "monitoring" | "resolved" | "closed";
  assignedAdvisorId: Types.ObjectId;
  openedBy: Types.ObjectId;
  openedAt: Date;
  dueAt?: Date;
  summary: string;
  interventions: Array<{
    type: "academic" | "attendance" | "financial" | "wellbeing" | "career" | "parent_outreach";
    action: string;
    outcome?: string;
    nextFollowUpAt?: Date;
    recordedBy: Types.ObjectId;
    recordedAt: Date;
  }>;
  resolution?: string;
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  escalatedAt?: Date;
  escalationCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const StudentRiskSignalSchema = new Schema<IStudentRiskSignal>(
  {
    key: {
      type: String,
      enum: ["attendance", "backlogs", "cgpa", "fee_balance", "advisor_followup"],
      required: true,
    },
    label: { type: String, required: true, trim: true },
    value: { type: Number, required: true },
    threshold: { type: Number, required: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    severity: { type: String, enum: ["low", "medium", "high"], required: true },
    explanation: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const StudentRiskSnapshotSchema = new Schema<IStudentRiskSnapshot>(
  {
    studentProfileId: {
      type: Schema.Types.ObjectId,
      ref: "StudentProfile",
      required: true,
      unique: true,
    },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true, index: true },
    mentorId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    academicYear: { type: String, required: true, trim: true },
    riskScore: { type: Number, required: true, min: 0, max: 100, index: true },
    riskLevel: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
      index: true,
    },
    signals: { type: [StudentRiskSignalSchema], default: [] },
    calculatedAt: { type: Date, required: true, default: Date.now },
    sourceUpdatedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

StudentRiskSnapshotSchema.plugin(auditPlugin);
StudentRiskSnapshotSchema.index({ departmentId: 1, riskLevel: 1, riskScore: -1 });
StudentRiskSnapshotSchema.index({ mentorId: 1, riskLevel: 1, riskScore: -1 });

const InterventionSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["academic", "attendance", "financial", "wellbeing", "career", "parent_outreach"],
      required: true,
    },
    action: { type: String, required: true, trim: true, maxlength: 3000 },
    outcome: { type: String, trim: true, maxlength: 3000 },
    nextFollowUpAt: Date,
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recordedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const StudentSuccessCaseSchema = new Schema<IStudentSuccessCase>(
  {
    studentProfileId: {
      type: Schema.Types.ObjectId,
      ref: "StudentProfile",
      required: true,
      index: true,
    },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true, index: true },
    riskSnapshotId: { type: Schema.Types.ObjectId, ref: "StudentRiskSnapshot" },
    title: { type: String, required: true, trim: true, maxlength: 240 },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "contacted", "in_progress", "monitoring", "resolved", "closed"],
      default: "open",
      index: true,
    },
    assignedAdvisorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    openedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    openedAt: { type: Date, default: Date.now },
    dueAt: Date,
    summary: { type: String, required: true, trim: true, maxlength: 5000 },
    interventions: { type: [InterventionSchema], default: [] },
    resolution: { type: String, trim: true, maxlength: 5000 },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: Date,
    escalatedAt: Date,
    escalationCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

StudentSuccessCaseSchema.plugin(auditPlugin);
StudentSuccessCaseSchema.index({ assignedAdvisorId: 1, status: 1, dueAt: 1 });
StudentSuccessCaseSchema.index({ status: 1, dueAt: 1, escalatedAt: 1 });
StudentSuccessCaseSchema.index(
  { studentProfileId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["open", "contacted", "in_progress", "monitoring"] },
    },
  },
);

export const StudentRiskSnapshotModel = model<IStudentRiskSnapshot>(
  "StudentRiskSnapshot",
  StudentRiskSnapshotSchema,
);
export const StudentSuccessCaseModel = model<IStudentSuccessCase>(
  "StudentSuccessCase",
  StudentSuccessCaseSchema,
);

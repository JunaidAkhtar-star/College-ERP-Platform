import { auditPlugin } from "../plugins/audit.plugin";
import type { Types, Document } from "mongoose";
import { Schema, model } from "mongoose";

export type QuestionType = "mcq" | "short_answer" | "long_answer" | "coding" | "true_false";
export type DifficultyLevel = "easy" | "medium" | "hard";
export enum QuestionStatus {
  DRAFT = "draft",
  APPROVED = "approved",
  RETIRED = "retired",
}

export interface IQuestionOption {
  optionText: string;
  isCorrect: boolean;
}

export interface IQuestion extends Document {
  subjectId: Types.ObjectId;
  subjectCode: string;
  departmentId: Types.ObjectId;
  unitNo: number;
  coCode?: string; // CO mapping
  questionText: string;
  fingerprint: string;
  questionType: QuestionType;
  difficultyLevel: DifficultyLevel;
  marks: number;
  options?: IQuestionOption[];
  correctAnswer?: string; // For short/coding answers
  explanation?: string;
  tags: string[];
  isActive: boolean;
  status: QuestionStatus;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  retiredBy?: Types.ObjectId;
  retiredAt?: Date;
  retirementReason?: string;
  revision: number;
  usageCount: number; // How many times used in exams/quizzes
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionOptionSchema = new Schema<IQuestionOption>(
  {
    optionText: { type: String, required: true, trim: true, maxlength: 2000 },
    isCorrect: { type: Boolean, required: true, default: false },
  },
  { _id: false },
);

const QuestionSchema = new Schema<IQuestion>(
  {
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    subjectCode: { type: String, required: true, trim: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    unitNo: { type: Number, required: true, min: 1, max: 20 },
    coCode: { type: String, trim: true, uppercase: true, maxlength: 20 },
    questionText: { type: String, required: true, trim: true, maxlength: 10000 },
    fingerprint: { type: String, required: true, maxlength: 64 },
    questionType: {
      type: String,
      enum: ["mcq", "short_answer", "long_answer", "coding", "true_false"],
      required: true,
    },
    difficultyLevel: { type: String, enum: ["easy", "medium", "hard"], required: true },
    marks: { type: Number, required: true, min: 0.01, max: 1000 },
    options: [QuestionOptionSchema],
    correctAnswer: { type: String, trim: true, maxlength: 10000 },
    explanation: { type: String, trim: true, maxlength: 20000 },
    tags: [{ type: String, lowercase: true, trim: true }],
    isActive: { type: Boolean, default: true },
    status: {
      type: String,
      enum: Object.values(QuestionStatus),
      default: QuestionStatus.DRAFT,
      required: true,
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    retiredBy: { type: Schema.Types.ObjectId, ref: "User" },
    retiredAt: { type: Date },
    retirementReason: { type: String, trim: true, maxlength: 1000 },
    revision: { type: Number, default: 1, min: 1 },
    usageCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

QuestionSchema.index({ subjectId: 1, unitNo: 1, difficultyLevel: 1 });
QuestionSchema.index({ departmentId: 1, status: 1, createdBy: 1 });
QuestionSchema.index({ subjectId: 1, fingerprint: 1 });
QuestionSchema.index({ tags: 1 });

// Apply audit plugin (soft delete + createdBy/updatedBy)
QuestionOptionSchema.plugin(auditPlugin);

export const QuestionModel = model<IQuestion>("Question", QuestionSchema);

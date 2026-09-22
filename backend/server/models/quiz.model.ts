import { auditPlugin } from "../plugins/audit.plugin";
import type { Types, Document } from "mongoose";
import { Schema, model } from "mongoose";

export interface IQuizQuestion {
  _id?: Types.ObjectId;
  questionId?: Types.ObjectId;
  questionText: string;
  questionType: "mcq" | "true_false" | "short_answer";
  options?: { optionText: string; isCorrect: boolean }[];
  correctAnswer?: string;
  marks: number;
}

export enum QuizStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  CLOSED = "closed",
}

export type ProctoringEventType =
  | "tab_switch"
  | "fullscreen_exit"
  | "copy_paste"
  | "suspicious_activity"
  | "auto_submitted"
  | "screenshot";

export interface IProctoringConfig {
  fullscreenRequired: boolean;
  copyPasteDisabled: boolean;
  tabSwitchLimit: number; // 0 = unlimited; n = auto-submit after n violations
  screenshotIntervalSec: number; // 0 = disabled
  webcamRequired: boolean;
}

export interface IQuiz extends Document {
  title: string;
  description?: string;
  subjectId: Types.ObjectId;
  sectionId: Types.ObjectId;
  subjectCode: string;
  facultyId: Types.ObjectId;
  departmentId: Types.ObjectId;
  program: string;
  semester: number;
  section: string;
  academicYear: string;
  quizType: "scheduled" | "surprise";
  questions: IQuizQuestion[];
  totalMarks: number;
  durationMinutes: number;
  startDateTime?: Date;
  endDateTime?: Date;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResultImmediately: boolean;
  status: QuizStatus;
  publishedAt?: Date;
  closedAt?: Date;
  totalAttempts: number;
  isActive: boolean;

  // Proctoring
  proctoringEnabled: boolean;
  proctoringConfig: IProctoringConfig;

  createdAt: Date;
  updatedAt: Date;
}

const QuizQuestionSchema = new Schema<IQuizQuestion>(
  {
    questionId: { type: Schema.Types.ObjectId, ref: "Question" },
    questionText: { type: String, required: true, trim: true, maxlength: 10000 },
    questionType: { type: String, enum: ["mcq", "true_false", "short_answer"], required: true },
    options: [{ optionText: String, isCorrect: Boolean }],
    correctAnswer: { type: String, trim: true, maxlength: 5000 },
    marks: { type: Number, required: true, min: 0.01, max: 1000 },
  },
  { _id: true },
);

const QuizSchema = new Schema<IQuiz>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 20000 },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    sectionId: { type: Schema.Types.ObjectId, ref: "Section", required: true },
    subjectCode: { type: String, required: true },
    facultyId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    program: { type: String, required: true },
    semester: { type: Number, required: true, min: 1 },
    section: { type: String, required: true },
    academicYear: { type: String, required: true },
    quizType: { type: String, enum: ["scheduled", "surprise"], default: "scheduled" },
    questions: [QuizQuestionSchema],
    totalMarks: { type: Number, default: 0 },
    durationMinutes: { type: Number, required: true, min: 1, max: 480 },
    startDateTime: { type: Date },
    endDateTime: { type: Date },
    shuffleQuestions: { type: Boolean, default: false },
    shuffleOptions: { type: Boolean, default: false },
    showResultImmediately: { type: Boolean, default: true },
    status: {
      type: String,
      enum: Object.values(QuizStatus),
      default: QuizStatus.DRAFT,
      required: true,
    },
    publishedAt: { type: Date },
    closedAt: { type: Date },
    totalAttempts: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: false },

    // Proctoring
    proctoringEnabled: { type: Boolean, default: false },
    proctoringConfig: {
      fullscreenRequired: { type: Boolean, default: false },
      copyPasteDisabled: { type: Boolean, default: false },
      tabSwitchLimit: { type: Number, default: 3, min: 0 },
      screenshotIntervalSec: { type: Number, default: 0, min: 0 },
      webcamRequired: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

QuizSchema.index({ subjectId: 1, academicYear: 1 });
QuizSchema.index({ sectionId: 1, status: 1, startDateTime: 1, endDateTime: 1 });

// Apply audit plugin (soft delete + createdBy/updatedBy)
QuizQuestionSchema.plugin(auditPlugin);

export const QuizModel = model<IQuiz>("Quiz", QuizSchema);

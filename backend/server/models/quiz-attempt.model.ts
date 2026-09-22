import { Schema, model, type Document, type Types } from "mongoose";

export interface IQuizAttempt extends Document {
  quizId: Types.ObjectId;
  studentId: Types.ObjectId;
  startedAt: Date;
  expiresAt: Date;
  presentation: {
    questionId: Types.ObjectId;
    optionOrder: number[];
  }[];
  draftAnswers: {
    questionId: Types.ObjectId;
    selectedOption?: number;
    textAnswer?: string;
  }[];
  answerRevision: number;
  lastSavedAt?: Date;
  submittedAt?: Date;
  answers: {
    questionId: Types.ObjectId;
    selectedOption?: number;
    textAnswer?: string;
    isCorrect: boolean;
    marksAwarded: number;
  }[];
  score: number;
  maxScore: number;
  percentage: number;
  timeTakenSeconds?: number;
  isSubmitted: boolean;
  autoSubmitted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const QuizAttemptSchema = new Schema<IQuizAttempt>(
  {
    quizId: { type: Schema.Types.ObjectId, ref: "Quiz", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    startedAt: { type: Date, default: () => new Date(), required: true },
    expiresAt: { type: Date, required: true },
    presentation: [
      {
        questionId: { type: Schema.Types.ObjectId, required: true },
        optionOrder: [{ type: Number, min: 0 }],
      },
    ],
    draftAnswers: [
      {
        questionId: { type: Schema.Types.ObjectId, required: true },
        selectedOption: { type: Number, min: 0, max: 9 },
        textAnswer: { type: String, trim: true, maxlength: 5000 },
      },
    ],
    answerRevision: { type: Number, default: 0, min: 0 },
    lastSavedAt: { type: Date },
    submittedAt: { type: Date },
    answers: [
      {
        questionId: { type: Schema.Types.ObjectId, required: true },
        selectedOption: { type: Number },
        textAnswer: { type: String, trim: true, maxlength: 5000 },
        isCorrect: { type: Boolean, default: false },
        marksAwarded: { type: Number, default: 0 },
      },
    ],
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    timeTakenSeconds: { type: Number, default: 0 },
    isSubmitted: { type: Boolean, default: false },
    autoSubmitted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

QuizAttemptSchema.index({ quizId: 1, studentId: 1 }, { unique: true });

export const QuizAttemptModel = model<IQuizAttempt>("QuizAttempt", QuizAttemptSchema);

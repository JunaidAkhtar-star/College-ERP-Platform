import { Schema, model } from "mongoose";

interface IExamScheduleMutationLock {
  key: string;
  revision: number;
}

const ExamScheduleMutationLockSchema = new Schema<IExamScheduleMutationLock>(
  {
    key: { type: String, required: true, unique: true },
    revision: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export const ExamScheduleMutationLockModel = model<IExamScheduleMutationLock>(
  "ExamScheduleMutationLock",
  ExamScheduleMutationLockSchema,
);

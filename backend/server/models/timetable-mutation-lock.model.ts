import { Schema, model } from "mongoose";

interface ITimetableMutationLock {
  key: string;
  revision: number;
}

const TimetableMutationLockSchema = new Schema<ITimetableMutationLock>(
  {
    key: { type: String, required: true, unique: true },
    revision: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export const TimetableMutationLockModel = model<ITimetableMutationLock>(
  "TimetableMutationLock",
  TimetableMutationLockSchema,
);

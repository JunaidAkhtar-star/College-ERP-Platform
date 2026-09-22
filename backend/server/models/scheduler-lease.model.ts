import mongoose, { Schema } from "mongoose";

export interface ISchedulerLease {
  key: string;
  owner: string;
  lockedUntil: Date;
  acquiredAt: Date;
  updatedAt: Date;
}

const schedulerLeaseSchema = new Schema<ISchedulerLease>(
  {
    key: { type: String, required: true, unique: true, index: true },
    owner: { type: String, required: true, index: true },
    lockedUntil: { type: Date, required: true, index: true },
    acquiredAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const SchedulerLeaseModel = mongoose.model<ISchedulerLease>(
  "SchedulerLease",
  schedulerLeaseSchema,
);

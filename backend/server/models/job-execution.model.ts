import mongoose, { Schema } from "mongoose";

export interface IJobExecution {
  topic: string;
  idempotencyKey: string;
  messageId: string;
  claimToken: string;
  status: "processing" | "completed" | "failed";
  lockedAt: Date;
  completedAt?: Date;
  lastError?: string;
}

const jobExecutionSchema = new Schema<IJobExecution>(
  {
    topic: { type: String, required: true },
    idempotencyKey: { type: String, required: true },
    messageId: { type: String, required: true },
    claimToken: { type: String, required: true },
    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      required: true,
      index: true,
    },
    lockedAt: { type: Date, required: true },
    completedAt: { type: Date },
    lastError: { type: String },
  },
  { timestamps: true },
);

jobExecutionSchema.index({ topic: 1, idempotencyKey: 1 }, { unique: true });
jobExecutionSchema.index(
  { completedAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60, partialFilterExpression: { status: "completed" } },
);

export const JobExecutionModel = mongoose.model<IJobExecution>("JobExecution", jobExecutionSchema);

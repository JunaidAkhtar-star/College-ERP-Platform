import mongoose, { Schema } from "mongoose";

export interface IJobDeadLetter {
  messageId: string;
  topic: string;
  idempotencyKey: string;
  payloadCiphertext: string;
  tenantId: string;
  databaseName: string;
  attempts: number;
  maxAttempts: number;
  lastError: string;
  originalCreatedAt: Date;
  replayedAt?: Date;
  replayingAt?: Date;
  replayedBy?: mongoose.Types.ObjectId;
  replayReason?: string;
  replayMessageId?: string;
}

const jobDeadLetterSchema = new Schema<IJobDeadLetter>(
  {
    messageId: { type: String, required: true, unique: true },
    topic: { type: String, required: true, index: true },
    idempotencyKey: { type: String, required: true, index: true },
    payloadCiphertext: { type: String, required: true, select: false },
    tenantId: { type: String, required: true },
    databaseName: { type: String, required: true },
    attempts: { type: Number, required: true },
    maxAttempts: { type: Number, required: true },
    lastError: { type: String, required: true },
    originalCreatedAt: { type: Date, required: true },
    replayedAt: Date,
    replayingAt: Date,
    replayedBy: { type: Schema.Types.ObjectId, ref: "User" },
    replayReason: { type: String, trim: true, maxlength: 1000 },
    replayMessageId: String,
  },
  { timestamps: true },
);

jobDeadLetterSchema.index({ replayedAt: 1, createdAt: -1 });

export const JobDeadLetterModel = mongoose.model<IJobDeadLetter>(
  "JobDeadLetter",
  jobDeadLetterSchema,
);

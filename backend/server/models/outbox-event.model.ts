import mongoose, { Schema } from "mongoose";

export interface IOutboxEvent {
  topic: string;
  idempotencyKey: string;
  payloadCiphertext: string;
  tenantId: string;
  databaseName: string;
  status: "pending" | "publishing" | "published";
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  lockedAt?: Date;
  lockedBy?: string;
  publishedAt?: Date;
  lastError?: string;
}

const outboxEventSchema = new Schema<IOutboxEvent>(
  {
    topic: { type: String, required: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true },
    payloadCiphertext: { type: String, required: true, select: false },
    tenantId: { type: String, required: true },
    databaseName: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "publishing", "published"],
      default: "pending",
      index: true,
    },
    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, required: true, min: 1, max: 20 },
    availableAt: { type: Date, required: true, index: true },
    lockedAt: { type: Date },
    lockedBy: { type: String },
    publishedAt: { type: Date },
    lastError: { type: String },
  },
  { timestamps: true },
);

outboxEventSchema.index({ status: 1, availableAt: 1 });
outboxEventSchema.index(
  { publishedAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60, partialFilterExpression: { status: "published" } },
);

export const OutboxEventModel = mongoose.model<IOutboxEvent>("OutboxEvent", outboxEventSchema);

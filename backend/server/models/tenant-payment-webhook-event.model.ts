import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface ITenantPaymentWebhookEvent extends Document {
  _id: Types.ObjectId;
  provider: string;
  eventId: string;
  payloadHash: string;
  status: "processing" | "processed" | "failed";
  feeRecordId?: string;
  transactionId?: string;
  lastError?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TenantPaymentWebhookEventSchema = new Schema<ITenantPaymentWebhookEvent>(
  {
    provider: { type: String, required: true },
    eventId: { type: String, required: true },
    payloadHash: { type: String, required: true },
    status: {
      type: String,
      enum: ["processing", "processed", "failed"],
      default: "processing",
      index: true,
    },
    feeRecordId: String,
    transactionId: String,
    lastError: { type: String, maxlength: 500 },
    processedAt: Date,
  },
  { timestamps: true },
);

TenantPaymentWebhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
TenantPaymentWebhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

export const TenantPaymentWebhookEventModel = mongoose.model<ITenantPaymentWebhookEvent>(
  "TenantPaymentWebhookEvent",
  TenantPaymentWebhookEventSchema,
);

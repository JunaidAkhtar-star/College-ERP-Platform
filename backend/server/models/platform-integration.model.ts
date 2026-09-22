import mongoose, { Schema, type Document, type Types } from "mongoose";

export type PlatformIntegrationProvider =
  | "google_drive"
  | "agora"
  | "firebase"
  | "smtp"
  | "cloudinary";

export interface IPlatformIntegration extends Document {
  provider: PlatformIntegrationProvider;
  enabled: boolean;
  status: "not_configured" | "configured" | "healthy" | "error" | "disabled";
  config: Record<string, unknown>;
  secretCiphertext?: string;
  lastTestedAt?: Date;
  lastSucceededAt?: Date;
  lastError?: string;
  updatedBy?: Types.ObjectId;
}

const platformIntegrationSchema = new Schema<IPlatformIntegration>(
  {
    provider: {
      type: String,
      enum: ["google_drive", "agora", "firebase", "smtp", "cloudinary"],
      required: true,
      unique: true,
    },
    enabled: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["not_configured", "configured", "healthy", "error", "disabled"],
      default: "not_configured",
      index: true,
    },
    config: { type: Schema.Types.Mixed, default: {} },
    secretCiphertext: { type: String, select: false },
    lastTestedAt: Date,
    lastSucceededAt: Date,
    lastError: { type: String, maxlength: 1000 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const PlatformIntegrationModel = mongoose.model<IPlatformIntegration>(
  "PlatformIntegration",
  platformIntegrationSchema,
);

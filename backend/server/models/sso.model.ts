import mongoose, { Schema, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export type TSsoProvider = "google" | "microsoft";

export interface ISsoConfiguration extends Document {
  provider: TSsoProvider;
  enabled: boolean;
  clientId: string;
  clientSecretCiphertext: string;
  microsoftTenantId?: string;
  allowedDomains: string[];
  autoProvision: boolean;
  defaultRole?: string;
  status: "configured" | "healthy" | "error" | "disabled";
  lastTestedAt?: Date;
  lastSucceededAt?: Date;
  lastError?: string;
  updatedBy?: Types.ObjectId;
}

export interface ISsoState extends Document {
  stateHash: string;
  provider: TSsoProvider;
  codeVerifierCiphertext: string;
  returnUrl: string;
  expiresAt: Date;
}

const SsoConfigurationSchema = new Schema<ISsoConfiguration>(
  {
    provider: { type: String, enum: ["google", "microsoft"], required: true, unique: true },
    enabled: { type: Boolean, default: false, index: true },
    clientId: { type: String, required: true, trim: true },
    clientSecretCiphertext: { type: String, required: true, select: false },
    microsoftTenantId: { type: String, trim: true },
    allowedDomains: { type: [String], default: [] },
    autoProvision: { type: Boolean, default: false },
    defaultRole: String,
    status: {
      type: String,
      enum: ["configured", "healthy", "error", "disabled"],
      default: "configured",
      index: true,
    },
    lastTestedAt: Date,
    lastSucceededAt: Date,
    lastError: { type: String, maxlength: 500 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
SsoConfigurationSchema.plugin(auditPlugin);

const SsoStateSchema = new Schema<ISsoState>(
  {
    stateHash: { type: String, required: true, unique: true },
    provider: { type: String, enum: ["google", "microsoft"], required: true },
    codeVerifierCiphertext: { type: String, required: true, select: false },
    returnUrl: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
SsoStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SsoConfigurationModel = mongoose.model<ISsoConfiguration>(
  "SsoConfiguration",
  SsoConfigurationSchema,
);
export const SsoStateModel = mongoose.model<ISsoState>("SsoState", SsoStateSchema);

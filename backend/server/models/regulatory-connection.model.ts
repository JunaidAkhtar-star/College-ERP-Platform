import { model, Schema, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";
import type { TRegulatoryProvider } from "./regulatory-integration.model";

export interface IRegulatoryConnection extends Document {
  provider: TRegulatoryProvider;
  mode: "portal_export" | "api";
  enabled: boolean;
  apiBaseUrl?: string;
  clientId?: string;
  secretCiphertext?: string;
  status: "not_configured" | "credential_required" | "configured" | "verified" | "failed";
  adapterAvailable: boolean;
  lastTestedAt?: Date;
  lastTestSucceeded?: boolean;
  message?: string;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IRegulatoryConnection>(
  {
    provider: {
      type: String,
      enum: ["digilocker", "nad", "abc", "aishe", "nirf"],
      required: true,
      unique: true,
      index: true,
    },
    mode: { type: String, enum: ["portal_export", "api"], default: "portal_export" },
    enabled: { type: Boolean, default: false },
    apiBaseUrl: { type: String, trim: true, maxlength: 500 },
    clientId: { type: String, trim: true, maxlength: 240 },
    secretCiphertext: { type: String, select: false },
    status: {
      type: String,
      enum: ["not_configured", "credential_required", "configured", "verified", "failed"],
      default: "not_configured",
      index: true,
    },
    adapterAvailable: { type: Boolean, default: false },
    lastTestedAt: Date,
    lastTestSucceeded: Boolean,
    message: { type: String, trim: true, maxlength: 1000 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

schema.plugin(auditPlugin);

export const RegulatoryConnectionModel = model<IRegulatoryConnection>(
  "RegulatoryConnection",
  schema,
);

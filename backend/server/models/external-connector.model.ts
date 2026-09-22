import mongoose, { Schema, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export type TConnectorProvider =
  | "twilio_sms"
  | "tally_bridge"
  | "quickbooks"
  | "google_workspace"
  | "microsoft_graph"
  | "google_meet"
  | "bigbluebutton"
  | "canvas_lms"
  | "moodle_lms"
  | "oneroster_1_2"
  | "coursera"
  | "custom_webhook";
export interface IExternalConnector extends Document {
  name: string;
  provider: TConnectorProvider;
  enabled: boolean;
  config: Record<string, unknown>;
  secretCiphertext: string;
  capabilities: string[];
  status: "configured" | "healthy" | "degraded" | "disabled" | "error";
  failureCount: number;
  circuitOpenUntil?: Date;
  lastTestedAt?: Date;
  lastSucceededAt?: Date;
  lastError?: string;
  createdBy: Types.ObjectId;
  secretVersion: number;
}
export interface IConnectorExecution extends Document {
  connectorId: Types.ObjectId;
  provider: TConnectorProvider;
  operation: string;
  idempotencyKey: string;
  payloadHash: string;
  status:
    | "queued"
    | "running"
    | "accepted"
    | "delivered"
    | "succeeded"
    | "partially_succeeded"
    | "failed";
  attempts: number;
  requestedBy?: Types.ObjectId;
  startedAt?: Date;
  completedAt?: Date;
  resultSummary?: Record<string, unknown>;
  error?: string;
  providerReference?: string;
}

const ExternalConnectorSchema = new Schema<IExternalConnector>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    provider: {
      type: String,
      enum: [
        "twilio_sms",
        "tally_bridge",
        "quickbooks",
        "google_workspace",
        "microsoft_graph",
        "google_meet",
        "bigbluebutton",
        "canvas_lms",
        "moodle_lms",
        "oneroster_1_2",
        "coursera",
        "custom_webhook",
      ],
      required: true,
      index: true,
    },
    enabled: { type: Boolean, default: false, index: true },
    config: { type: Schema.Types.Mixed, default: {} },
    secretCiphertext: { type: String, required: true, select: false },
    capabilities: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["configured", "healthy", "degraded", "disabled", "error"],
      default: "configured",
      index: true,
    },
    failureCount: { type: Number, default: 0 },
    circuitOpenUntil: Date,
    lastTestedAt: Date,
    lastSucceededAt: Date,
    lastError: { type: String, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    secretVersion: { type: Number, min: 1, default: 1 },
  },
  { timestamps: true },
);
ExternalConnectorSchema.index({ name: 1 }, { unique: true });
ExternalConnectorSchema.plugin(auditPlugin);
const ConnectorExecutionSchema = new Schema<IConnectorExecution>(
  {
    connectorId: {
      type: Schema.Types.ObjectId,
      ref: "ExternalConnector",
      required: true,
      index: true,
    },
    provider: { type: String, required: true, index: true },
    operation: { type: String, required: true, maxlength: 100 },
    idempotencyKey: { type: String, required: true, unique: true },
    payloadHash: { type: String, required: true },
    status: {
      type: String,
      enum: [
        "queued",
        "running",
        "accepted",
        "delivered",
        "succeeded",
        "partially_succeeded",
        "failed",
      ],
      default: "queued",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User" },
    startedAt: Date,
    completedAt: Date,
    resultSummary: Schema.Types.Mixed,
    error: { type: String, maxlength: 2000 },
    providerReference: { type: String, index: true },
  },
  { timestamps: true },
);
ConnectorExecutionSchema.index({ connectorId: 1, createdAt: -1 });
ConnectorExecutionSchema.index(
  { connectorId: 1, providerReference: 1 },
  { unique: true, sparse: true },
);
ConnectorExecutionSchema.plugin(auditPlugin);
export const ExternalConnectorModel = mongoose.model<IExternalConnector>(
  "ExternalConnector",
  ExternalConnectorSchema,
);
export const ConnectorExecutionModel = mongoose.model<IConnectorExecution>(
  "ConnectorExecution",
  ConnectorExecutionSchema,
);

export interface IConnectorSecretVersion extends Document {
  connectorId: Types.ObjectId;
  version: number;
  secretCiphertext: string;
  rotatedAt: Date;
  rotatedBy: Types.ObjectId;
  reason: string;
}
const ConnectorSecretVersionSchema = new Schema<IConnectorSecretVersion>(
  {
    connectorId: {
      type: Schema.Types.ObjectId,
      ref: "ExternalConnector",
      required: true,
      index: true,
    },
    version: { type: Number, required: true, min: 1 },
    secretCiphertext: { type: String, required: true, select: false, immutable: true },
    rotatedAt: { type: Date, required: true },
    rotatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);
ConnectorSecretVersionSchema.index({ connectorId: 1, version: 1 }, { unique: true });
ConnectorSecretVersionSchema.pre(
  ["updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany"],
  function () {
    throw new Error("Connector secret history is immutable");
  },
);
export const ConnectorSecretVersionModel = mongoose.model<IConnectorSecretVersion>(
  "ConnectorSecretVersion",
  ConnectorSecretVersionSchema,
);

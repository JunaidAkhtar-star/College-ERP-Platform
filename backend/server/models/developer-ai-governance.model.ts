import { Schema, model, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";
export interface IAiUseCase extends Document {
  createdAt: Date;
  updatedAt: Date;
  name: string;
  purpose: string;
  ownerId: Types.ObjectId;
  provider: string;
  modelName: string;
  dataCategories: string[];
  decisionImpact: "assistive" | "recommendation" | "high_impact";
  riskLevel: "low" | "medium" | "high";
  humanReviewRequired: boolean;
  status: "draft" | "under_review" | "approved" | "suspended" | "retired";
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  reviewDueAt?: Date;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}
const UseCaseSchema = new Schema<IAiUseCase>(
  {
    name: { type: String, required: true, trim: true },
    purpose: { type: String, required: true, trim: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: String, required: true, trim: true },
    modelName: { type: String, required: true, trim: true },
    dataCategories: [{ type: String, required: true }],
    decisionImpact: {
      type: String,
      enum: ["assistive", "recommendation", "high_impact"],
      required: true,
    },
    riskLevel: { type: String, enum: ["low", "medium", "high"], required: true, index: true },
    humanReviewRequired: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["draft", "under_review", "approved", "suspended", "retired"],
      default: "draft",
      index: true,
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
    reviewDueAt: { type: Date, index: true },
  },
  { timestamps: true },
);
UseCaseSchema.plugin(auditPlugin);
UseCaseSchema.path("createdBy").required(true);
export const AiUseCaseModel = model<IAiUseCase>("AiUseCase", UseCaseSchema);
export interface IAiRiskAssessment extends Document {
  createdAt: Date;
  updatedAt: Date;
  useCaseId: Types.ObjectId;
  version: number;
  privacyRisk: number;
  biasRisk: number;
  securityRisk: number;
  explainabilityRisk: number;
  impactRisk: number;
  mitigations: string[];
  residualRisk: "low" | "medium" | "high";
  assessedBy: Types.ObjectId;
  assessedAt: Date;
  createdBy: Types.ObjectId;
}
const AssessmentSchema = new Schema<IAiRiskAssessment>(
  {
    useCaseId: { type: Schema.Types.ObjectId, ref: "AiUseCase", required: true, index: true },
    version: { type: Number, required: true, min: 1 },
    privacyRisk: { type: Number, min: 1, max: 5, required: true },
    biasRisk: { type: Number, min: 1, max: 5, required: true },
    securityRisk: { type: Number, min: 1, max: 5, required: true },
    explainabilityRisk: { type: Number, min: 1, max: 5, required: true },
    impactRisk: { type: Number, min: 1, max: 5, required: true },
    mitigations: [{ type: String, required: true }],
    residualRisk: { type: String, enum: ["low", "medium", "high"], required: true },
    assessedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assessedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
AssessmentSchema.index({ useCaseId: 1, version: 1 }, { unique: true });
AssessmentSchema.plugin(auditPlugin);
AssessmentSchema.path("createdBy").required(true);
export const AiRiskAssessmentModel = model<IAiRiskAssessment>("AiRiskAssessment", AssessmentSchema);
export interface IAiIncident extends Document {
  createdAt: Date;
  updatedAt: Date;
  useCaseId: Types.ObjectId;
  number: string;
  severity: "low" | "medium" | "high" | "critical";
  summary: string;
  description: string;
  status: "open" | "investigating" | "contained" | "resolved";
  reportedBy: Types.ObjectId;
  ownerId: Types.ObjectId;
  containedAt?: Date;
  resolvedAt?: Date;
  resolution?: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}
const IncidentSchema = new Schema<IAiIncident>(
  {
    useCaseId: { type: Schema.Types.ObjectId, ref: "AiUseCase", required: true, index: true },
    number: { type: String, required: true, unique: true },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
      index: true,
    },
    summary: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["open", "investigating", "contained", "resolved"],
      default: "open",
      index: true,
    },
    reportedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    containedAt: Date,
    resolvedAt: Date,
    resolution: { type: String, trim: true },
  },
  { timestamps: true },
);
IncidentSchema.plugin(auditPlugin);
IncidentSchema.path("createdBy").required(true);
export const AiIncidentModel = model<IAiIncident>("AiIncident", IncidentSchema);

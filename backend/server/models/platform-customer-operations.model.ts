import mongoose, { Schema, type Document, type Types } from "mongoose";
export interface IImplementationProject extends Document {
  tenantId: Types.ObjectId;
  ownerId: Types.ObjectId;
  stage:
    | "discovery"
    | "configuration"
    | "migration"
    | "training"
    | "go_live"
    | "stabilization"
    | "completed"
    | "on_hold";
  health: "on_track" | "at_risk" | "blocked";
  targetGoLiveAt: Date;
  actualGoLiveAt?: Date;
  milestones: Array<{
    _id: Types.ObjectId;
    name: string;
    category: string;
    dueAt: Date;
    status: "pending" | "in_progress" | "completed" | "blocked";
    completedAt?: Date;
    note?: string;
  }>;
  risks: Array<{
    _id: Types.ObjectId;
    summary: string;
    severity: "low" | "medium" | "high";
    mitigation: string;
    ownerId: Types.ObjectId;
    status: "open" | "mitigated";
  }>;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}
const ImplementationSchema = new Schema<IImplementationProject>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      unique: true,
      index: true,
    },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    stage: {
      type: String,
      enum: [
        "discovery",
        "configuration",
        "migration",
        "training",
        "go_live",
        "stabilization",
        "completed",
        "on_hold",
      ],
      default: "discovery",
      index: true,
    },
    health: {
      type: String,
      enum: ["on_track", "at_risk", "blocked"],
      default: "on_track",
      index: true,
    },
    targetGoLiveAt: { type: Date, required: true, index: true },
    actualGoLiveAt: Date,
    milestones: [
      {
        name: { type: String, required: true, trim: true },
        category: { type: String, required: true, trim: true },
        dueAt: { type: Date, required: true },
        status: {
          type: String,
          enum: ["pending", "in_progress", "completed", "blocked"],
          default: "pending",
        },
        completedAt: Date,
        note: { type: String, trim: true },
      },
    ],
    risks: [
      {
        summary: { type: String, required: true, trim: true },
        severity: { type: String, enum: ["low", "medium", "high"], required: true },
        mitigation: { type: String, required: true, trim: true },
        ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        status: { type: String, enum: ["open", "mitigated"], default: "open" },
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
export const ImplementationProjectModel = mongoose.model<IImplementationProject>(
  "ImplementationProject",
  ImplementationSchema,
);
export interface ISupportTicket extends Document {
  number: string;
  tenantId: Types.ObjectId;
  category:
    | "incident"
    | "question"
    | "configuration"
    | "data"
    | "billing"
    | "security"
    | "feature_request";
  priority: "low" | "medium" | "high" | "critical";
  subject: string;
  description: string;
  status: "open" | "triaged" | "in_progress" | "waiting_customer" | "resolved" | "closed";
  requesterName: string;
  requesterEmail: string;
  ownerId?: Types.ObjectId;
  firstResponseDueAt: Date;
  resolutionDueAt: Date;
  firstRespondedAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  resolution?: string;
  comments: Array<{
    _id: Types.ObjectId;
    authorId: Types.ObjectId;
    body: string;
    visibility: "internal" | "customer";
    createdAt: Date;
  }>;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}
const TicketSchema = new Schema<ISupportTicket>(
  {
    number: { type: String, required: true, unique: true },
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    category: {
      type: String,
      enum: [
        "incident",
        "question",
        "configuration",
        "data",
        "billing",
        "security",
        "feature_request",
      ],
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
      index: true,
    },
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["open", "triaged", "in_progress", "waiting_customer", "resolved", "closed"],
      default: "open",
      index: true,
    },
    requesterName: { type: String, required: true, trim: true },
    requesterEmail: { type: String, required: true, lowercase: true, trim: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    firstResponseDueAt: { type: Date, required: true, index: true },
    resolutionDueAt: { type: Date, required: true, index: true },
    firstRespondedAt: Date,
    resolvedAt: Date,
    closedAt: Date,
    resolution: { type: String, trim: true },
    comments: [
      {
        authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        body: { type: String, required: true, trim: true },
        visibility: { type: String, enum: ["internal", "customer"], required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
TicketSchema.index({ tenantId: 1, status: 1, priority: 1 });
export const SupportTicketModel = mongoose.model<ISupportTicket>("SupportTicket", TicketSchema);

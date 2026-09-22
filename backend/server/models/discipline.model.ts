import mongoose, { Schema, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export interface IDisciplineCategory extends Document {
  name: string;
  code: string;
  description?: string;
  defaultSeverity: "minor" | "moderate" | "major" | "critical";
  isActive: boolean;
  createdBy: Types.ObjectId;
}
export interface IDisciplineIncident extends Document {
  incidentNumber: string;
  title: string;
  description: string;
  categoryId: Types.ObjectId;
  severity: "minor" | "moderate" | "major" | "critical";
  occurredAt: Date;
  location?: string;
  accusedUserIds: Types.ObjectId[];
  witnessUserIds: Types.ObjectId[];
  evidence: Array<{ name: string; url: string; publicId?: string }>;
  confidential: boolean;
  status:
    | "reported"
    | "triage"
    | "investigation"
    | "hearing"
    | "decided"
    | "appealed"
    | "closed"
    | "dismissed";
  reportedBy: Types.ObjectId;
  assignedTo?: Types.ObjectId;
  finding?: string;
  decision?: string;
  decidedBy?: Types.ObjectId;
  decidedAt?: Date;
  closedAt?: Date;
}
export interface IDisciplineEvent extends Document {
  incidentId: Types.ObjectId;
  type: "note" | "status_change" | "hearing" | "decision" | "appeal" | "sanction";
  content: string;
  fromStatus?: string;
  toStatus?: string;
  eventAt: Date;
  private: boolean;
  createdBy: Types.ObjectId;
  createdByName: string;
}
export interface IDisciplineSanction extends Document {
  incidentId: Types.ObjectId;
  userId: Types.ObjectId;
  type:
    | "warning"
    | "community_service"
    | "fine"
    | "suspension"
    | "restriction"
    | "rustication"
    | "other";
  description: string;
  startsAt: Date;
  endsAt?: Date;
  amount?: number;
  status: "active" | "completed" | "revoked";
  imposedBy: Types.ObjectId;
}

const DisciplineCategorySchema = new Schema<IDisciplineCategory>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 30 },
    description: { type: String, maxlength: 1000 },
    defaultSeverity: {
      type: String,
      enum: ["minor", "moderate", "major", "critical"],
      required: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
DisciplineCategorySchema.index({ code: 1 }, { unique: true });
DisciplineCategorySchema.plugin(auditPlugin);

const EvidenceSchema = new Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    publicId: String,
  },
  { _id: false },
);
const DisciplineIncidentSchema = new Schema<IDisciplineIncident>(
  {
    incidentNumber: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 10000 },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "DisciplineCategory",
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ["minor", "moderate", "major", "critical"],
      required: true,
      index: true,
    },
    occurredAt: { type: Date, required: true },
    location: { type: String, trim: true, maxlength: 300 },
    accusedUserIds: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    witnessUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    evidence: { type: [EvidenceSchema], default: [] },
    confidential: { type: Boolean, default: true },
    status: {
      type: String,
      enum: [
        "reported",
        "triage",
        "investigation",
        "hearing",
        "decided",
        "appealed",
        "closed",
        "dismissed",
      ],
      default: "reported",
      index: true,
    },
    reportedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", index: true },
    finding: { type: String, maxlength: 10000 },
    decision: { type: String, maxlength: 10000 },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User" },
    decidedAt: Date,
    closedAt: Date,
  },
  { timestamps: true },
);
DisciplineIncidentSchema.index({ createdAt: -1 });
DisciplineIncidentSchema.plugin(auditPlugin);

const DisciplineEventSchema = new Schema<IDisciplineEvent>(
  {
    incidentId: {
      type: Schema.Types.ObjectId,
      ref: "DisciplineIncident",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["note", "status_change", "hearing", "decision", "appeal", "sanction"],
      required: true,
    },
    content: { type: String, required: true, trim: true, maxlength: 10000 },
    fromStatus: String,
    toStatus: String,
    eventAt: { type: Date, default: Date.now },
    private: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true },
);
DisciplineEventSchema.index({ incidentId: 1, eventAt: 1 });
DisciplineEventSchema.plugin(auditPlugin);

const DisciplineSanctionSchema = new Schema<IDisciplineSanction>(
  {
    incidentId: {
      type: Schema.Types.ObjectId,
      ref: "DisciplineIncident",
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: [
        "warning",
        "community_service",
        "fine",
        "suspension",
        "restriction",
        "rustication",
        "other",
      ],
      required: true,
    },
    description: { type: String, required: true, trim: true, maxlength: 3000 },
    startsAt: { type: Date, required: true },
    endsAt: Date,
    amount: { type: Number, min: 0 },
    status: { type: String, enum: ["active", "completed", "revoked"], default: "active" },
    imposedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
DisciplineSanctionSchema.plugin(auditPlugin);

export const DisciplineCategoryModel = mongoose.model<IDisciplineCategory>(
  "DisciplineCategory",
  DisciplineCategorySchema,
);
export const DisciplineIncidentModel = mongoose.model<IDisciplineIncident>(
  "DisciplineIncident",
  DisciplineIncidentSchema,
);
export const DisciplineEventModel = mongoose.model<IDisciplineEvent>(
  "DisciplineEvent",
  DisciplineEventSchema,
);
export const DisciplineSanctionModel = mongoose.model<IDisciplineSanction>(
  "DisciplineSanction",
  DisciplineSanctionSchema,
);

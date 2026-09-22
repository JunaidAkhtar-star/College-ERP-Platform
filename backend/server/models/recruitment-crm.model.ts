import { Schema, model, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export type RecruitmentStage =
  | "new"
  | "contacted"
  | "qualified"
  | "application_started"
  | "applied"
  | "enrolled"
  | "lost";

export interface IRecruitmentLead extends Document {
  firstName: string;
  lastName?: string;
  email?: string;
  phone: string;
  source: "website" | "walk_in" | "referral" | "campaign" | "school_visit" | "other";
  sourceDetail?: string;
  programInterest?: Types.ObjectId;
  stage: RecruitmentStage;
  score: number;
  ownerId?: Types.ObjectId;
  nextFollowUpAt?: Date;
  lastContactedAt?: Date;
  consentToContact: boolean;
  tags: string[];
  notes?: string;
  lostReason?: string;
  admissionApplicationId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRecruitmentActivity extends Document {
  leadId: Types.ObjectId;
  type: "call" | "email" | "message" | "meeting" | "note" | "task";
  subject: string;
  details?: string;
  status: "planned" | "completed" | "cancelled";
  dueAt?: Date;
  completedAt?: Date;
  ownerId: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<IRecruitmentLead>(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 120 },
    lastName: { type: String, trim: true, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, required: true, trim: true, maxlength: 24 },
    source: {
      type: String,
      enum: ["website", "walk_in", "referral", "campaign", "school_visit", "other"],
      required: true,
      index: true,
    },
    sourceDetail: { type: String, trim: true, maxlength: 240 },
    programInterest: { type: Schema.Types.ObjectId, ref: "Department", index: true },
    stage: {
      type: String,
      enum: ["new", "contacted", "qualified", "application_started", "applied", "enrolled", "lost"],
      default: "new",
      index: true,
    },
    score: { type: Number, default: 0, min: 0, max: 100, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    nextFollowUpAt: { type: Date, index: true },
    lastContactedAt: Date,
    consentToContact: { type: Boolean, required: true, default: false },
    tags: { type: [String], default: [] },
    notes: { type: String, trim: true, maxlength: 5000 },
    lostReason: { type: String, trim: true, maxlength: 1000 },
    admissionApplicationId: {
      type: Schema.Types.ObjectId,
      ref: "AdmissionApplication",
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
LeadSchema.plugin(auditPlugin);
LeadSchema.index({ phone: 1 }, { unique: true });
LeadSchema.index({ email: 1 }, { unique: true, sparse: true });
LeadSchema.index({ ownerId: 1, stage: 1, nextFollowUpAt: 1 });
LeadSchema.index({ firstName: "text", lastName: "text", phone: "text", email: "text" });

const ActivitySchema = new Schema<IRecruitmentActivity>(
  {
    leadId: { type: Schema.Types.ObjectId, ref: "RecruitmentLead", required: true, index: true },
    type: {
      type: String,
      enum: ["call", "email", "message", "meeting", "note", "task"],
      required: true,
    },
    subject: { type: String, required: true, trim: true, maxlength: 240 },
    details: { type: String, trim: true, maxlength: 5000 },
    status: {
      type: String,
      enum: ["planned", "completed", "cancelled"],
      default: "planned",
      index: true,
    },
    dueAt: { type: Date, index: true },
    completedAt: Date,
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
ActivitySchema.plugin(auditPlugin);
ActivitySchema.index({ ownerId: 1, status: 1, dueAt: 1 });
ActivitySchema.index({ leadId: 1, createdAt: -1 });

export const RecruitmentLeadModel = model<IRecruitmentLead>("RecruitmentLead", LeadSchema);
export const RecruitmentActivityModel = model<IRecruitmentActivity>(
  "RecruitmentActivity",
  ActivitySchema,
);

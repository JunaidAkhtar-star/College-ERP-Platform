import { Schema, model, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export interface IAdvancementFund extends Document {
  code: string;
  name: string;
  purpose: string;
  restriction: "unrestricted" | "temporarily_restricted" | "permanently_restricted";
  goalAmount?: number;
  startsAt?: Date;
  endsAt?: Date;
  status: "draft" | "active" | "closed";
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}
const FundSchema = new Schema<IAdvancementFund>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    purpose: { type: String, required: true, trim: true },
    restriction: {
      type: String,
      enum: ["unrestricted", "temporarily_restricted", "permanently_restricted"],
      required: true,
    },
    goalAmount: { type: Number, min: 0 },
    startsAt: Date,
    endsAt: Date,
    status: { type: String, enum: ["draft", "active", "closed"], default: "draft", index: true },
  },
  { timestamps: true },
);
FundSchema.plugin(auditPlugin);
FundSchema.path("createdBy").required(true);
export const AdvancementFundModel = model<IAdvancementFund>("AdvancementFund", FundSchema);

export interface IAdvancementCampaign extends Document {
  code: string;
  name: string;
  description: string;
  fundId: Types.ObjectId;
  goalAmount: number;
  startsAt: Date;
  endsAt: Date;
  audience: string[];
  status: "draft" | "active" | "paused" | "completed" | "cancelled";
  ownerId: Types.ObjectId;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}
const CampaignSchema = new Schema<IAdvancementCampaign>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    fundId: { type: Schema.Types.ObjectId, ref: "AdvancementFund", required: true, index: true },
    goalAmount: { type: Number, required: true, min: 1 },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    audience: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: ["draft", "active", "paused", "completed", "cancelled"],
      default: "draft",
      index: true,
    },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
CampaignSchema.plugin(auditPlugin);
CampaignSchema.path("createdBy").required(true);
export const AdvancementCampaignModel = model<IAdvancementCampaign>(
  "AdvancementCampaign",
  CampaignSchema,
);

export interface IAdvancementPledge extends Document {
  pledgeNumber: string;
  alumniId: Types.ObjectId;
  campaignId: Types.ObjectId;
  fundId: Types.ObjectId;
  amount: number;
  currency: string;
  pledgedAt: Date;
  dueAt: Date;
  status: "active" | "partially_fulfilled" | "fulfilled" | "cancelled";
  fulfilledAmount: number;
  notes?: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}
const PledgeSchema = new Schema<IAdvancementPledge>(
  {
    pledgeNumber: { type: String, required: true, unique: true },
    alumniId: { type: Schema.Types.ObjectId, ref: "Alumni", required: true, index: true },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: "AdvancementCampaign",
      required: true,
      index: true,
    },
    fundId: { type: Schema.Types.ObjectId, ref: "AdvancementFund", required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: "INR" },
    pledgedAt: { type: Date, default: Date.now },
    dueAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["active", "partially_fulfilled", "fulfilled", "cancelled"],
      default: "active",
      index: true,
    },
    fulfilledAmount: { type: Number, default: 0, min: 0 },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);
PledgeSchema.plugin(auditPlugin);
PledgeSchema.path("createdBy").required(true);
export const AdvancementPledgeModel = model<IAdvancementPledge>("AdvancementPledge", PledgeSchema);

export interface IAdvancementGiftDesignation extends Document {
  donationId: Types.ObjectId;
  fundId: Types.ObjectId;
  campaignId?: Types.ObjectId;
  pledgeId?: Types.ObjectId;
  amount: number;
  acknowledgedAt?: Date;
  acknowledgedBy?: Types.ObjectId;
  createdBy: Types.ObjectId;
}
const DesignationSchema = new Schema<IAdvancementGiftDesignation>(
  {
    donationId: { type: Schema.Types.ObjectId, ref: "Donation", required: true, index: true },
    fundId: { type: Schema.Types.ObjectId, ref: "AdvancementFund", required: true, index: true },
    campaignId: { type: Schema.Types.ObjectId, ref: "AdvancementCampaign", index: true },
    pledgeId: { type: Schema.Types.ObjectId, ref: "AdvancementPledge", index: true },
    amount: { type: Number, required: true, min: 1 },
    acknowledgedAt: Date,
    acknowledgedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
DesignationSchema.index({ donationId: 1, fundId: 1 }, { unique: true });
DesignationSchema.plugin(auditPlugin);
DesignationSchema.path("createdBy").required(true);
export const AdvancementGiftDesignationModel = model<IAdvancementGiftDesignation>(
  "AdvancementGiftDesignation",
  DesignationSchema,
);

export interface IStewardshipTask extends Document {
  alumniId: Types.ObjectId;
  campaignId?: Types.ObjectId;
  type: "call" | "meeting" | "proposal" | "thank_you" | "impact_report" | "other";
  subject: string;
  dueAt: Date;
  assignedTo: Types.ObjectId;
  status: "open" | "completed" | "cancelled";
  outcome?: string;
  completedAt?: Date;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}
const StewardshipSchema = new Schema<IStewardshipTask>(
  {
    alumniId: { type: Schema.Types.ObjectId, ref: "Alumni", required: true, index: true },
    campaignId: { type: Schema.Types.ObjectId, ref: "AdvancementCampaign", index: true },
    type: {
      type: String,
      enum: ["call", "meeting", "proposal", "thank_you", "impact_report", "other"],
      required: true,
    },
    subject: { type: String, required: true, trim: true },
    dueAt: { type: Date, required: true, index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: {
      type: String,
      enum: ["open", "completed", "cancelled"],
      default: "open",
      index: true,
    },
    outcome: { type: String, trim: true },
    completedAt: Date,
  },
  { timestamps: true },
);
StewardshipSchema.plugin(auditPlugin);
StewardshipSchema.path("createdBy").required(true);
export const StewardshipTaskModel = model<IStewardshipTask>("StewardshipTask", StewardshipSchema);

export interface IContinuingEducationOffering extends Document {
  code: string;
  title: string;
  description: string;
  deliveryMode: "in_person" | "online" | "hybrid";
  durationHours: number;
  fee: number;
  currency: string;
  credentialType: "certificate" | "badge" | "microcredential" | "non_credit";
  learningOutcomes: string[];
  prerequisites: string[];
  status: "draft" | "published" | "retired";
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}
const OfferingSchema = new Schema<IContinuingEducationOffering>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    deliveryMode: { type: String, enum: ["in_person", "online", "hybrid"], required: true },
    durationHours: { type: Number, required: true, min: 1 },
    fee: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    credentialType: {
      type: String,
      enum: ["certificate", "badge", "microcredential", "non_credit"],
      required: true,
    },
    learningOutcomes: [{ type: String, trim: true }],
    prerequisites: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: ["draft", "published", "retired"],
      default: "draft",
      index: true,
    },
  },
  { timestamps: true },
);
OfferingSchema.plugin(auditPlugin);
OfferingSchema.path("createdBy").required(true);
export const ContinuingEducationOfferingModel = model<IContinuingEducationOffering>(
  "ContinuingEducationOffering",
  OfferingSchema,
);

export interface IContinuingEducationCohort extends Document {
  offeringId: Types.ObjectId;
  code: string;
  startsAt: Date;
  endsAt: Date;
  enrollmentOpensAt: Date;
  enrollmentClosesAt: Date;
  capacity: number;
  enrolledCount: number;
  instructorId: Types.ObjectId;
  campusId?: Types.ObjectId;
  venue?: string;
  meetingUrl?: string;
  status: "planned" | "open" | "in_progress" | "completed" | "cancelled";
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}
const CohortSchema = new Schema<IContinuingEducationCohort>(
  {
    offeringId: {
      type: Schema.Types.ObjectId,
      ref: "ContinuingEducationOffering",
      required: true,
      index: true,
    },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    enrollmentOpensAt: { type: Date, required: true },
    enrollmentClosesAt: { type: Date, required: true },
    capacity: { type: Number, required: true, min: 1 },
    enrolledCount: { type: Number, default: 0, min: 0 },
    instructorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    campusId: { type: Schema.Types.ObjectId, ref: "Campus", index: true },
    venue: { type: String, trim: true },
    meetingUrl: { type: String, trim: true },
    status: {
      type: String,
      enum: ["planned", "open", "in_progress", "completed", "cancelled"],
      default: "planned",
      index: true,
    },
  },
  { timestamps: true },
);
CohortSchema.plugin(auditPlugin);
CohortSchema.path("createdBy").required(true);
export const ContinuingEducationCohortModel = model<IContinuingEducationCohort>(
  "ContinuingEducationCohort",
  CohortSchema,
);

export interface IContinuingEducationEnrollment extends Document {
  enrollmentNumber: string;
  cohortId: Types.ObjectId;
  learnerId?: Types.ObjectId;
  learnerName: string;
  learnerEmail: string;
  status: "pending" | "enrolled" | "withdrawn" | "completed" | "failed";
  paymentStatus: "not_required" | "pending" | "paid" | "refunded";
  attendancePercent: number;
  assessmentScore?: number;
  completedAt?: Date;
  credentialCode?: string;
  credentialIssuedAt?: Date;
  credentialRevokedAt?: Date;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}
const EnrollmentSchema = new Schema<IContinuingEducationEnrollment>(
  {
    enrollmentNumber: { type: String, required: true, unique: true },
    cohortId: {
      type: Schema.Types.ObjectId,
      ref: "ContinuingEducationCohort",
      required: true,
      index: true,
    },
    learnerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    learnerName: { type: String, required: true, trim: true },
    learnerEmail: { type: String, required: true, lowercase: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "enrolled", "withdrawn", "completed", "failed"],
      default: "pending",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["not_required", "pending", "paid", "refunded"],
      required: true,
      index: true,
    },
    attendancePercent: { type: Number, default: 0, min: 0, max: 100 },
    assessmentScore: { type: Number, min: 0, max: 100 },
    completedAt: Date,
    credentialCode: { type: String, unique: true, sparse: true },
    credentialIssuedAt: Date,
    credentialRevokedAt: Date,
  },
  { timestamps: true },
);
EnrollmentSchema.index({ cohortId: 1, learnerEmail: 1 }, { unique: true });
EnrollmentSchema.plugin(auditPlugin);
EnrollmentSchema.path("createdBy").required(true);
export const ContinuingEducationEnrollmentModel = model<IContinuingEducationEnrollment>(
  "ContinuingEducationEnrollment",
  EnrollmentSchema,
);

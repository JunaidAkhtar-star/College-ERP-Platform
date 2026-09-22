/**
 * @file iic.model.ts
 * @description Institution Innovation Council records — activities tracked
 * for MIC (Ministry of Education) quarterly reports.
 */
import type { Types, Document } from "mongoose";
import { Schema, model } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export type TIicActivityKind =
  | "workshop"
  | "hackathon"
  | "ideation"
  | "expert_lecture"
  | "industry_visit"
  | "celebration"
  | "other";

export type TIicQuarter = "Q1" | "Q2" | "Q3" | "Q4";

export interface IIicActivity extends Document {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  kind: TIicActivityKind;
  quarter: TIicQuarter;
  academicYear: string; // "2026-27"
  startDate: Date;
  endDate?: Date;
  venue?: string;
  participantCount?: number;
  facultyCoordinator?: Types.ObjectId;
  studentCoordinator?: Types.ObjectId;
  outcome?: string;
  proofUrl?: string; // photo / report PDF
  reportedToMic: boolean; // marked once included in an MIC quarterly upload
  createdAt: Date;
  updatedAt: Date;
}

const IicActivitySchema = new Schema<IIicActivity>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    kind: {
      type: String,
      enum: [
        "workshop",
        "hackathon",
        "ideation",
        "expert_lecture",
        "industry_visit",
        "celebration",
        "other",
      ],
      required: true,
      index: true,
    },
    quarter: { type: String, enum: ["Q1", "Q2", "Q3", "Q4"], required: true, index: true },
    academicYear: { type: String, required: true, trim: true, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    venue: { type: String, trim: true },
    participantCount: { type: Number, min: 0 },
    facultyCoordinator: { type: Schema.Types.ObjectId, ref: "User" },
    studentCoordinator: { type: Schema.Types.ObjectId, ref: "User" },
    outcome: { type: String, trim: true },
    proofUrl: { type: String, trim: true },
    reportedToMic: { type: Boolean, default: false },
  },
  { timestamps: true },
);

IicActivitySchema.plugin(auditPlugin);

export const IicActivityModel = model<IIicActivity>("IicActivity", IicActivitySchema);

export type TInnovationStatus =
  | "submitted"
  | "screening"
  | "evaluation"
  | "approved"
  | "incubating"
  | "completed"
  | "rejected";

export interface IInnovationProject extends Document {
  title: string;
  problemStatement: string;
  proposedSolution: string;
  category: string;
  submitterId: Types.ObjectId;
  teamMemberIds: Types.ObjectId[];
  mentorId?: Types.ObjectId;
  status: TInnovationStatus;
  evaluationScore?: number;
  evaluationNote?: string;
  fundingAllocated: number;
  fundingSpent: number;
  milestones: {
    title: string;
    dueDate: Date;
    status: "planned" | "completed";
    completedAt?: Date;
    evidenceUrl?: string;
  }[];
  ipRecords: {
    type: "patent" | "copyright" | "trademark" | "design";
    applicationNumber: string;
    status: "draft" | "filed" | "published" | "granted" | "rejected";
  }[];
  prototypeUrl?: string;
  startupName?: string;
  incorporationNumber?: string;
  outcome?: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}

const InnovationProjectSchema = new Schema<IInnovationProject>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    problemStatement: { type: String, required: true, trim: true, maxlength: 5000 },
    proposedSolution: { type: String, required: true, trim: true, maxlength: 5000 },
    category: { type: String, required: true, trim: true, maxlength: 120 },
    submitterId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    teamMemberIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    mentorId: { type: Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: [
        "submitted",
        "screening",
        "evaluation",
        "approved",
        "incubating",
        "completed",
        "rejected",
      ],
      default: "submitted",
      index: true,
    },
    evaluationScore: { type: Number, min: 0, max: 100 },
    evaluationNote: { type: String, trim: true, maxlength: 3000 },
    fundingAllocated: { type: Number, min: 0, default: 0 },
    fundingSpent: { type: Number, min: 0, default: 0 },
    milestones: [
      {
        title: { type: String, required: true, trim: true },
        dueDate: { type: Date, required: true },
        status: { type: String, enum: ["planned", "completed"], default: "planned" },
        completedAt: Date,
        evidenceUrl: { type: String, trim: true },
      },
    ],
    ipRecords: [
      {
        type: {
          type: String,
          enum: ["patent", "copyright", "trademark", "design"],
          required: true,
        },
        applicationNumber: { type: String, required: true, trim: true },
        status: {
          type: String,
          enum: ["draft", "filed", "published", "granted", "rejected"],
          required: true,
        },
      },
    ],
    prototypeUrl: { type: String, trim: true },
    startupName: { type: String, trim: true },
    incorporationNumber: { type: String, trim: true },
    outcome: { type: String, trim: true, maxlength: 5000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
InnovationProjectSchema.plugin(auditPlugin);
InnovationProjectSchema.path("createdBy").required(true);
export const InnovationProjectModel = model<IInnovationProject>(
  "InnovationProject",
  InnovationProjectSchema,
);

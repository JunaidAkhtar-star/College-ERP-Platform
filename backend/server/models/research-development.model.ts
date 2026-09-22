/**
 * @file research-development.model.ts
 * @description Research & Development office records — projects, grants and
 * publications by faculty / students.
 */
import type { Types, Document } from "mongoose";
import { Schema, model } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export type TResearchProjectStatus =
  | "proposed"
  | "ethics_review"
  | "approved"
  | "ongoing"
  | "completed"
  | "on_hold"
  | "rejected"
  | "closed";

export interface IResearchProject extends Document {
  _id: Types.ObjectId;
  title: string;
  projectCode: string;
  abstractText?: string;
  principalInvestigator: Types.ObjectId;
  coInvestigators: Types.ObjectId[];
  department?: Types.ObjectId;
  fundingAgency?: string;
  grantAmount?: number;
  sanctionedAmount?: number;
  expenditureAmount: number;
  ethicsRequired: boolean;
  ethicsStatus: "not_required" | "pending" | "approved" | "rejected";
  ethicsReference?: string;
  ethicsReviewedBy?: Types.ObjectId;
  ethicsReviewedAt?: Date;
  milestones: {
    title: string;
    dueAt: Date;
    status: "pending" | "completed" | "overdue";
    completedAt?: Date;
    evidenceUrl?: string;
  }[];
  utilizationCertificates: {
    period: string;
    amount: number;
    certificateUrl: string;
    submittedAt: Date;
  }[];
  intellectualProperty: {
    title: string;
    type: "patent" | "copyright" | "trademark" | "design";
    applicationNumber?: string;
    status: "draft" | "filed" | "published" | "granted" | "abandoned";
    filedAt?: Date;
    grantedAt?: Date;
  }[];
  startDate?: Date;
  endDate?: Date;
  status: TResearchProjectStatus;
  outcomes?: string;
  documents: { name: string; url: string }[];
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ResearchProjectSchema = new Schema<IResearchProject>(
  {
    title: { type: String, required: true, trim: true },
    projectCode: { type: String, required: true, trim: true, uppercase: true, unique: true },
    abstractText: { type: String, trim: true },
    principalInvestigator: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    coInvestigators: [{ type: Schema.Types.ObjectId, ref: "User" }],
    department: { type: Schema.Types.ObjectId, ref: "Department", index: true },
    fundingAgency: { type: String, trim: true },
    grantAmount: { type: Number, min: 0 },
    sanctionedAmount: { type: Number, min: 0 },
    expenditureAmount: { type: Number, min: 0, default: 0 },
    ethicsRequired: { type: Boolean, default: false },
    ethicsStatus: {
      type: String,
      enum: ["not_required", "pending", "approved", "rejected"],
      default: "not_required",
      index: true,
    },
    ethicsReference: { type: String, trim: true },
    ethicsReviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    ethicsReviewedAt: Date,
    milestones: [
      new Schema(
        {
          title: { type: String, required: true, trim: true },
          dueAt: { type: Date, required: true },
          status: {
            type: String,
            enum: ["pending", "completed", "overdue"],
            default: "pending",
          },
          completedAt: Date,
          evidenceUrl: { type: String, trim: true },
        },
        { _id: true },
      ),
    ],
    utilizationCertificates: [
      new Schema(
        {
          period: { type: String, required: true, trim: true },
          amount: { type: Number, required: true, min: 0 },
          certificateUrl: { type: String, required: true, trim: true },
          submittedAt: { type: Date, default: Date.now },
        },
        { _id: true },
      ),
    ],
    intellectualProperty: [
      new Schema(
        {
          title: { type: String, required: true, trim: true },
          type: {
            type: String,
            enum: ["patent", "copyright", "trademark", "design"],
            required: true,
          },
          applicationNumber: { type: String, trim: true },
          status: {
            type: String,
            enum: ["draft", "filed", "published", "granted", "abandoned"],
            default: "draft",
          },
          filedAt: Date,
          grantedAt: Date,
        },
        { _id: true },
      ),
    ],
    startDate: { type: Date },
    endDate: { type: Date },
    status: {
      type: String,
      enum: [
        "proposed",
        "ethics_review",
        "approved",
        "ongoing",
        "completed",
        "on_hold",
        "rejected",
        "closed",
      ],
      default: "proposed",
      index: true,
    },
    outcomes: { type: String, trim: true },
    documents: [
      {
        name: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: Date,
  },
  { timestamps: true },
);

ResearchProjectSchema.plugin(auditPlugin);

export const ResearchProjectModel = model<IResearchProject>(
  "ResearchProject",
  ResearchProjectSchema,
);

// ─────────────────────────────────────────────────────────────────────────────
// Publications (papers / conferences / patents)
// ─────────────────────────────────────────────────────────────────────────────

export type TPublicationKind = "journal" | "conference" | "patent" | "book" | "chapter";

export interface IRndPublication extends Document {
  _id: Types.ObjectId;
  title: string;
  kind: TPublicationKind;
  authors: Types.ObjectId[];
  authorsText?: string; // free-form fallback when authors aren't system users
  venue?: string; // journal / conference / publisher name
  year: number;
  doi?: string;
  url?: string;
  abstractText?: string;
  department?: Types.ObjectId;
  verificationStatus: "draft" | "submitted" | "verified" | "rejected";
  evidenceUrl?: string;
  verifiedBy?: Types.ObjectId;
  verifiedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RndPublicationSchema = new Schema<IRndPublication>(
  {
    title: { type: String, required: true, trim: true },
    kind: {
      type: String,
      enum: ["journal", "conference", "patent", "book", "chapter"],
      required: true,
      index: true,
    },
    authors: [{ type: Schema.Types.ObjectId, ref: "User" }],
    authorsText: { type: String, trim: true },
    venue: { type: String, trim: true },
    year: { type: Number, required: true, min: 1900, index: true },
    doi: { type: String, trim: true },
    url: { type: String, trim: true },
    abstractText: { type: String, trim: true },
    department: { type: Schema.Types.ObjectId, ref: "Department" },
    verificationStatus: {
      type: String,
      enum: ["draft", "submitted", "verified", "rejected"],
      default: "draft",
      index: true,
    },
    evidenceUrl: { type: String, trim: true },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: Date,
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: Date,
  },
  { timestamps: true },
);

RndPublicationSchema.plugin(auditPlugin);
RndPublicationSchema.index({ doi: 1 }, { unique: true, sparse: true });

export const RndPublicationModel = model<IRndPublication>(
  "ResearchPublication",
  RndPublicationSchema,
);

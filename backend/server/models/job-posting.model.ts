/**
 * Job Posting Model
 *
 * Off-campus and lateral job opportunities shared by T&P cell.
 * Students can view and apply (tracked separately in PlacementApplication
 * or via an external link).
 */
import mongoose, { Schema, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export enum JobType {
  FULL_TIME = "Full Time",
  INTERNSHIP = "Internship",
  PART_TIME = "Part Time",
  CONTRACT = "Contract",
  APPRENTICESHIP = "Apprenticeship",
}

export enum JobPostingStatus {
  ACTIVE = "active",
  CLOSED = "closed",
  DRAFT = "draft",
  EXPIRED = "expired",
}

export interface IJobPosting extends Document {
  _id: Types.ObjectId;
  companyName: string;
  companyLogo?: string; // Cloudinary URL
  companyWebsite?: string;
  companyDescription?: string;

  jobTitle: string;
  jobType: JobType;
  location: string;
  isRemote: boolean;
  description: string;
  responsibilities?: string;
  requirements?: string;

  // Package
  salaryMin?: number; // LPA
  salaryMax?: number;
  isSalaryDisclosed: boolean;
  stipend?: number; // For internships (monthly)

  // Eligibility
  eligiblePrograms: string[];
  eligibleBranches: string[];
  eligibleBatches: string[];
  minCgpa?: number;
  maxBacklogs?: number;
  graduationYear?: number;

  // Application
  applyMode: "internal" | "external"; // Internal = via ERP, External = link
  applicationDeadline: Date;
  externalApplyLink?: string; // For external mode
  applyEmail?: string;
  jobDescriptionFileUrl?: string; // JD PDF

  // Interest tracking (internal mode)
  interestedStudents: Types.ObjectId[];
  appliedStudents: Types.ObjectId[];

  status: JobPostingStatus;
  postedBy: Types.ObjectId;
  postedAt: Date;
  publishedAt?: Date;
  closedAt?: Date;

  // Views
  viewCount: number;

  createdAt: Date;
  updatedAt: Date;
}

const JobPostingSchema = new Schema<IJobPosting>(
  {
    companyName: { type: String, required: true, trim: true },
    companyLogo: { type: String },
    companyWebsite: { type: String, trim: true },
    companyDescription: { type: String },

    jobTitle: { type: String, required: true, trim: true },
    jobType: { type: String, enum: Object.values(JobType), required: true },
    location: { type: String, required: true, trim: true },
    isRemote: { type: Boolean, default: false },
    description: { type: String, required: true },
    responsibilities: { type: String },
    requirements: { type: String },

    salaryMin: { type: Number, min: 0 },
    salaryMax: { type: Number, min: 0 },
    isSalaryDisclosed: { type: Boolean, default: true },
    stipend: { type: Number, min: 0 },

    eligiblePrograms: [{ type: String }],
    eligibleBranches: [{ type: String }],
    eligibleBatches: [{ type: String }],
    minCgpa: { type: Number, min: 0, max: 10 },
    maxBacklogs: { type: Number, min: 0 },
    graduationYear: { type: Number },

    applyMode: { type: String, enum: ["internal", "external"], default: "external" },
    applicationDeadline: { type: Date, required: true },
    externalApplyLink: { type: String },
    applyEmail: { type: String, trim: true, lowercase: true },
    jobDescriptionFileUrl: { type: String },

    interestedStudents: [{ type: Schema.Types.ObjectId, ref: "User" }],
    appliedStudents: [{ type: Schema.Types.ObjectId, ref: "User" }],

    status: {
      type: String,
      enum: Object.values(JobPostingStatus),
      default: JobPostingStatus.ACTIVE,
      index: true,
    },
    postedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    postedAt: { type: Date, default: Date.now },
    publishedAt: { type: Date },
    closedAt: { type: Date },
    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

JobPostingSchema.index({ status: 1, applicationDeadline: -1 });
JobPostingSchema.index({ jobType: 1, status: 1 });
JobPostingSchema.index({ eligibleBatches: 1, status: 1 });

JobPostingSchema.plugin(auditPlugin);

export const JobPostingModel = mongoose.model<IJobPosting>("JobPosting", JobPostingSchema);

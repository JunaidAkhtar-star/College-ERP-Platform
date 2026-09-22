/**
 * Student Placement Profile
 *
 * A student's placement-specific profile:
 * resume, skills, certifications, eligibility, offer history.
 * Separate from the main StudentProfile to keep placement data isolated.
 */
import type { Document, Types } from "mongoose";
import mongoose, { Schema } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export enum PlacementEligibilityStatus {
  ELIGIBLE = "eligible",
  NOT_ELIGIBLE = "not_eligible",
  OPTED_OUT = "opted_out", // Student doesn't want campus placement
  PLACED = "placed", // Already placed in a drive
  HIGHER_STUDIES = "higher_studies",
}

export interface ISkill {
  name: string;
  proficiency: "beginner" | "intermediate" | "advanced" | "expert";
}

export interface ICertification {
  name: string;
  issuingOrg: string;
  issueDate?: Date;
  expiryDate?: Date;
  credentialId?: string;
  certificateUrl?: string;
}

export interface IProject {
  title: string;
  description: string;
  techStack: string[];
  projectUrl?: string;
  githubUrl?: string;
  duration?: string;
}

export interface IStudentPlacementProfile extends Document {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  studentProfileId?: Types.ObjectId;
  rollNumber: string;
  name: string;
  program: string;
  branch: string;
  batch: string;
  currentSemester: number;
  cgpa: number;
  activeBacklogs: number;
  totalBacklogs: number;

  // Eligibility
  eligibilityStatus: PlacementEligibilityStatus;
  isEligibleForPlacement: boolean; // Computed by system based on CGPA + backlog criteria
  placementCoordinatorNote?: string;

  // Contact & Social
  personalEmail?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;

  // Resume
  resumeUrl?: string;
  resumePublicId?: string;
  resumeUpdatedAt?: Date;

  // Profile completeness
  skills: ISkill[];
  certifications: ICertification[];
  projects: IProject[];
  internships: Array<{
    company: string;
    role: string;
    duration: string;
    description?: string;
    stipend?: number;
    offerLetterUrl?: string;
  }>;

  // Placement history
  registeredDrives: Types.ObjectId[]; // PlacementDrive IDs
  placedInDrive?: Types.ObjectId;
  placedCompany?: string;
  placedRole?: string;
  placedPackage?: number; // LPA
  placedPackageFixed?: number; // Fixed salary per annum
  offerLetterUrl?: string;
  joiningDate?: Date;
  isHigherPackageSeeking: boolean; // Can register for more drives even after placement
  academicSyncedAt: Date;
  placementOutcomeVerified: boolean;

  // Training participation
  trainingSessionsAttended: number;
  mockInterviewsGiven: number;
  lastMockScore?: number;

  createdAt: Date;
  updatedAt: Date;
}

const SkillSchema = new Schema<ISkill>(
  {
    name: { type: String, required: true, trim: true },
    proficiency: {
      type: String,
      enum: ["beginner", "intermediate", "advanced", "expert"],
      default: "beginner",
    },
  },
  { _id: false },
);

const CertificationSchema = new Schema<ICertification>(
  {
    name: { type: String, required: true, trim: true },
    issuingOrg: { type: String, required: true, trim: true },
    issueDate: { type: Date },
    expiryDate: { type: Date },
    credentialId: { type: String, trim: true },
    certificateUrl: { type: String },
  },
  { _id: true },
);

const ProjectSchema = new Schema<IProject>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    techStack: [{ type: String }],
    projectUrl: { type: String },
    githubUrl: { type: String },
    duration: { type: String },
  },
  { _id: true },
);

const InternshipSchema = new Schema(
  {
    company: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    duration: { type: String, required: true },
    description: { type: String },
    stipend: { type: Number, min: 0 },
    offerLetterUrl: { type: String },
  },
  { _id: true },
);

const StudentPlacementProfileSchema = new Schema<IStudentPlacementProfile>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    studentProfileId: { type: Schema.Types.ObjectId, ref: "StudentProfile" },
    rollNumber: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    program: { type: String, required: true },
    branch: { type: String, required: true },
    batch: { type: String, required: true },
    currentSemester: { type: Number, required: true },
    cgpa: { type: Number, min: 0, max: 10, default: 0 },
    activeBacklogs: { type: Number, default: 0, min: 0 },
    totalBacklogs: { type: Number, default: 0, min: 0 },

    eligibilityStatus: {
      type: String,
      enum: Object.values(PlacementEligibilityStatus),
      default: PlacementEligibilityStatus.NOT_ELIGIBLE,
      index: true,
    },
    isEligibleForPlacement: { type: Boolean, default: false, index: true },
    placementCoordinatorNote: { type: String },

    personalEmail: { type: String, trim: true, lowercase: true },
    linkedinUrl: { type: String, trim: true },
    githubUrl: { type: String, trim: true },
    portfolioUrl: { type: String, trim: true },

    resumeUrl: { type: String },
    resumePublicId: { type: String },
    resumeUpdatedAt: { type: Date },

    skills: { type: [SkillSchema], default: [] },
    certifications: { type: [CertificationSchema], default: [] },
    projects: { type: [ProjectSchema], default: [] },
    internships: { type: [InternshipSchema], default: [] },

    registeredDrives: [{ type: Schema.Types.ObjectId, ref: "PlacementDrive" }],
    placedInDrive: { type: Schema.Types.ObjectId, ref: "PlacementDrive" },
    placedCompany: { type: String, trim: true },
    placedRole: { type: String, trim: true },
    placedPackage: { type: Number, min: 0 },
    placedPackageFixed: { type: Number, min: 0 },
    offerLetterUrl: { type: String },
    joiningDate: { type: Date },
    isHigherPackageSeeking: { type: Boolean, default: false },
    academicSyncedAt: { type: Date, required: true, default: Date.now },
    placementOutcomeVerified: { type: Boolean, default: false, index: true },

    trainingSessionsAttended: { type: Number, default: 0 },
    mockInterviewsGiven: { type: Number, default: 0 },
    lastMockScore: { type: Number, min: 0, max: 100 },
  },
  { timestamps: true },
);

StudentPlacementProfileSchema.index({ program: 1, branch: 1, batch: 1, isEligibleForPlacement: 1 });
StudentPlacementProfileSchema.index({ cgpa: -1, activeBacklogs: 1 });
StudentPlacementProfileSchema.index({ eligibilityStatus: 1, batch: 1 });

StudentPlacementProfileSchema.plugin(auditPlugin);

export const StudentPlacementProfileModel = mongoose.model<IStudentPlacementProfile>(
  "StudentPlacementProfile",
  StudentPlacementProfileSchema,
);

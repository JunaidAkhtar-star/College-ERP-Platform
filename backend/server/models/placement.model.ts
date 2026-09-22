import { auditPlugin } from "../plugins/audit.plugin";
import type { Types, Document } from "mongoose";
import { Schema, model } from "mongoose";

export interface IPlacementDriveRound {
  roundNo: number;
  roundName: string; // "Aptitude", "Technical", "HR"
  scheduledDate?: Date;
  resultDate?: Date;
  description?: string;
}

export interface IPlacementDrive extends Document {
  academicYear: string;
  companyName: string;
  companyProfile?: string;
  hrContact?: string;
  hrEmail?: string;
  driveDate: Date;
  registrationStart: Date;
  registrationEnd: Date;
  venue: string;
  jobRole: string;
  jobDescription?: string;
  package: number; // LPA
  packageMax?: number;
  bond?: string;
  eligibilityCgpa?: number;
  eligibilityBacklogs?: number;
  eligiblePrograms: string[];
  eligibleBranches: string[];
  eligibleBatches: string[];
  rounds: IPlacementDriveRound[];
  // NOTE: registeredStudents, shortlistedStudents, selectedStudents, offeredStudents
  // arrays removed — derive these by querying PlacementApplication:
  //   PlacementApplication.find({ driveId, status: 'registered' })
  //   PlacementApplication.find({ driveId, status: 'shortlisted' })
  // This avoids unbounded array growth and dual-write consistency bugs.
  status: "upcoming" | "ongoing" | "completed" | "cancelled";
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DriveRoundSchema = new Schema<IPlacementDriveRound>(
  {
    roundNo: { type: Number, required: true },
    roundName: { type: String, required: true, trim: true },
    scheduledDate: { type: Date },
    resultDate: { type: Date },
    description: { type: String },
  },
  { _id: false },
);

const PlacementDriveSchema = new Schema<IPlacementDrive>(
  {
    academicYear: { type: String, required: true, trim: true, index: true },
    companyName: { type: String, required: true, trim: true },
    companyProfile: { type: String },
    hrContact: { type: String, trim: true },
    hrEmail: { type: String, lowercase: true, trim: true },
    driveDate: { type: Date, required: true },
    registrationStart: { type: Date, required: true },
    registrationEnd: { type: Date, required: true },
    venue: { type: String, required: true, trim: true },
    jobRole: { type: String, required: true, trim: true },
    jobDescription: { type: String },
    package: { type: Number, required: true, min: 0 },
    packageMax: { type: Number, min: 0 },
    bond: { type: String },
    eligibilityCgpa: { type: Number, min: 0, max: 10 },
    eligibilityBacklogs: { type: Number, default: 0, min: 0 },
    eligiblePrograms: [{ type: String }],
    eligibleBranches: [{ type: String }],
    eligibleBatches: [{ type: String }],
    rounds: [DriveRoundSchema],
    status: {
      type: String,
      enum: ["upcoming", "ongoing", "completed", "cancelled"],
      default: "upcoming",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

PlacementDriveSchema.index({ driveDate: -1 });
PlacementDriveSchema.index({ status: 1 });
PlacementDriveSchema.index(
  { academicYear: 1, companyName: 1, jobRole: 1, driveDate: 1 },
  { unique: true },
);

// Apply audit plugin (soft delete + createdBy/updatedBy)
PlacementDriveSchema.plugin(auditPlugin);

export const PlacementDriveModel = model<IPlacementDrive>("PlacementDrive", PlacementDriveSchema);

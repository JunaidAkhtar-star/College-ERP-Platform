/**
 * Placement Application Model
 *
 * Tracks each student's application to a specific placement drive.
 * Replaces the embedded arrays (registeredStudents, shortlistedStudents, etc.)
 * in PlacementDrive for proper per-student round-wise tracking.
 *
 * One document per (student × drive) pair.
 */
import type { Document, Types } from "mongoose";
import mongoose, { Schema } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export enum PlacementApplicationStatus {
  REGISTERED = "registered", // Applied / registered
  SHORTLISTED = "shortlisted", // Shortlisted for first round
  ROUND_ONGOING = "round_ongoing", // In process — rounds running
  SELECTED = "selected", // Selected by company
  OFFERED = "offered", // Offer letter issued
  ACCEPTED = "accepted", // Student accepted offer
  DECLINED = "declined", // Student declined offer
  REJECTED = "rejected", // Not selected after rounds
  WITHDRAWN = "withdrawn", // Student withdrew
  ABSENT = "absent", // Did not attend
  SUPERSEDED = "superseded", // Earlier accepted offer replaced by a governed higher offer
}

export interface IRoundResult {
  roundNo: number;
  roundName: string;
  status: "pass" | "fail" | "absent" | "pending";
  score?: number;
  maxScore?: number;
  remarks?: string;
  conductedAt?: Date;
  resultDeclaredAt?: Date;
}

export interface IPlacementApplication extends Document {
  _id: Types.ObjectId;
  driveId: Types.ObjectId;
  studentId: Types.ObjectId;
  studentPlacementProfileId?: Types.ObjectId;
  rollNumber: string;
  studentName: string;
  program: string;
  branch: string;
  batch: string;
  cgpaAtTimeOfApplication: number;
  backlogsAtTimeOfApplication: number;

  status: PlacementApplicationStatus;
  registeredAt: Date;

  // Round tracking
  roundResults: IRoundResult[];
  currentRound: number;

  // Final outcome
  offerLetterUrl?: string;
  offeredPackage?: number; // LPA
  offeredRole?: string;
  offerIssuedAt?: Date;
  joiningDate?: Date;
  offerExpiresAt?: Date;
  offerRespondedAt?: Date;
  declineReason?: string;
  outcomeVerified: boolean;
  statusHistory: Array<{
    from?: PlacementApplicationStatus;
    to: PlacementApplicationStatus;
    changedBy: Types.ObjectId;
    changedAt: Date;
    reason?: string;
  }>;

  // Admin notes
  coordinatorRemarks?: string;

  createdAt: Date;
  updatedAt: Date;
}

const RoundResultSchema = new Schema<IRoundResult>(
  {
    roundNo: { type: Number, required: true },
    roundName: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["pass", "fail", "absent", "pending"],
      default: "pending",
    },
    score: { type: Number, min: 0 },
    maxScore: { type: Number, min: 0 },
    remarks: { type: String },
    conductedAt: { type: Date },
    resultDeclaredAt: { type: Date },
  },
  { _id: false },
);

const PlacementApplicationSchema = new Schema<IPlacementApplication>(
  {
    driveId: { type: Schema.Types.ObjectId, ref: "PlacementDrive", required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    studentPlacementProfileId: { type: Schema.Types.ObjectId, ref: "StudentPlacementProfile" },
    rollNumber: { type: String, required: true },
    studentName: { type: String, required: true, trim: true },
    program: { type: String, required: true },
    branch: { type: String, required: true },
    batch: { type: String, required: true },
    cgpaAtTimeOfApplication: { type: Number, required: true, min: 0, max: 10 },
    backlogsAtTimeOfApplication: { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: Object.values(PlacementApplicationStatus),
      default: PlacementApplicationStatus.REGISTERED,
      index: true,
    },
    registeredAt: { type: Date, default: Date.now },

    roundResults: { type: [RoundResultSchema], default: [] },
    currentRound: { type: Number, default: 0 },

    offerLetterUrl: { type: String },
    offeredPackage: { type: Number, min: 0 },
    offeredRole: { type: String, trim: true },
    offerIssuedAt: { type: Date },
    joiningDate: { type: Date },
    offerExpiresAt: { type: Date },
    offerRespondedAt: { type: Date },
    declineReason: { type: String, trim: true, maxlength: 1000 },
    outcomeVerified: { type: Boolean, default: false, index: true },
    statusHistory: {
      type: [
        {
          from: { type: String, enum: Object.values(PlacementApplicationStatus) },
          to: { type: String, enum: Object.values(PlacementApplicationStatus), required: true },
          changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
          changedAt: { type: Date, default: Date.now },
          reason: { type: String, trim: true },
        },
      ],
      default: [],
    },
    coordinatorRemarks: { type: String },
  },
  { timestamps: true },
);

// One application per student per drive
PlacementApplicationSchema.index({ driveId: 1, studentId: 1 }, { unique: true });
PlacementApplicationSchema.index({ studentId: 1, status: 1 });
PlacementApplicationSchema.index({ driveId: 1, status: 1 });
PlacementApplicationSchema.index({ batch: 1, status: 1 });
PlacementApplicationSchema.index({ status: 1, offerExpiresAt: 1 });

PlacementApplicationSchema.path("roundResults").validate(function (results: IRoundResult[]) {
  return new Set(results.map((result) => result.roundNo)).size === results.length;
}, "A round result can be declared only once per application");

PlacementApplicationSchema.plugin(auditPlugin);

export const PlacementApplicationModel = mongoose.model<IPlacementApplication>(
  "PlacementApplication",
  PlacementApplicationSchema,
);

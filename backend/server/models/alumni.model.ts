import { auditPlugin } from "../plugins/audit.plugin";
import { Schema, model, type Types, type Document } from "mongoose";

export interface IAlumni extends Document {
  userId?: Types.ObjectId;
  fullName: string;
  email: string;
  phone?: string;
  program: string;
  branch: string;
  passoutYear: number;
  rollNumber?: string;
  registrationNo?: string;
  currentEmployer?: string;
  currentDesignation?: string;
  currentLocation?: string;
  linkedinUrl?: string;
  higherStudies?: { institution: string; program: string; year: number };
  isPlaced: boolean;
  package?: number;
  skills: string[];
  isVerified: boolean;
  verifiedBy?: Types.ObjectId;
  verifiedAt?: Date;
  verificationSource?: "academic_completion" | "legacy_review";
  careerOutcomeVerified: boolean;
  careerOutcomeVerifiedBy?: Types.ObjectId;
  careerOutcomeVerifiedAt?: Date;
  profileImageUrl?: string;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AlumniSchema = new Schema<IAlumni>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    program: { type: String, required: true, trim: true },
    branch: { type: String, required: true, trim: true },
    passoutYear: { type: Number, required: true },
    rollNumber: { type: String, trim: true },
    registrationNo: { type: String, trim: true },
    currentEmployer: { type: String, trim: true },
    currentDesignation: { type: String, trim: true },
    currentLocation: { type: String, trim: true },
    linkedinUrl: { type: String, trim: true },
    higherStudies: {
      institution: { type: String },
      program: { type: String },
      year: { type: Number },
    },
    isPlaced: { type: Boolean, default: false },
    package: { type: Number },
    skills: [{ type: String, lowercase: true, trim: true }],
    isVerified: { type: Boolean, default: false },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },
    verificationSource: { type: String, enum: ["academic_completion", "legacy_review"] },
    careerOutcomeVerified: { type: Boolean, default: false, index: true },
    careerOutcomeVerifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    careerOutcomeVerifiedAt: { type: Date },
    profileImageUrl: { type: String },
  },
  { timestamps: true },
);

AlumniSchema.index({ email: 1 }, { unique: true });
AlumniSchema.index({ userId: 1 }, { unique: true, sparse: true });
AlumniSchema.index({ rollNumber: 1 }, { unique: true, sparse: true });
AlumniSchema.index({ program: 1, branch: 1, passoutYear: -1 });

// Apply audit plugin (soft delete + createdBy/updatedBy)
AlumniSchema.plugin(auditPlugin);

export const AlumniModel = model<IAlumni>("Alumni", AlumniSchema);

export interface IAlumniEngagement extends Document {
  type: "reunion" | "mentorship" | "guest_talk" | "referral" | "networking" | "other";
  title: string;
  description: string;
  scheduledAt: Date;
  venue?: string;
  alumniIds: Types.ObjectId[];
  capacity?: number;
  status: "planned" | "completed" | "cancelled";
  outcome?: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AlumniEngagementSchema = new Schema<IAlumniEngagement>(
  {
    type: {
      type: String,
      enum: ["reunion", "mentorship", "guest_talk", "referral", "networking", "other"],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    scheduledAt: { type: Date, required: true, index: true },
    venue: { type: String, trim: true, maxlength: 300 },
    alumniIds: [{ type: Schema.Types.ObjectId, ref: "Alumni", required: true }],
    capacity: { type: Number, min: 1 },
    status: {
      type: String,
      enum: ["planned", "completed", "cancelled"],
      default: "planned",
      index: true,
    },
    outcome: { type: String, trim: true, maxlength: 5000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
AlumniEngagementSchema.plugin(auditPlugin);
AlumniEngagementSchema.path("createdBy").required(true);
export const AlumniEngagementModel = model<IAlumniEngagement>(
  "AlumniEngagement",
  AlumniEngagementSchema,
);

// ─── Alumni Donation (M43) ────────────────────────────────────────────────────

export interface IDonation extends Document {
  alumniId: Types.ObjectId;
  amount: number;
  currency: string;
  purpose: string;
  paymentMethod: "online" | "cheque" | "dd" | "cash";
  transactionId?: string;
  status: "pending" | "confirmed" | "failed";
  donatedAt: Date;
  confirmedBy?: Types.ObjectId;
  confirmedAt?: Date;
  failedBy?: Types.ObjectId;
  failedAt?: Date;
  failureReason?: string;
  receiptNumber?: string;
  journalEntryId?: Types.ObjectId;
  accountingVerified: boolean;
  createdBy: Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  updatedBy?: Types.ObjectId;
}

const DonationSchema = new Schema<IDonation>(
  {
    alumniId: { type: Schema.Types.ObjectId, ref: "Alumni", required: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: "INR", trim: true },
    purpose: { type: String, required: true, trim: true },
    paymentMethod: { type: String, enum: ["online", "cheque", "dd", "cash"], required: true },
    transactionId: { type: String, trim: true },
    status: { type: String, enum: ["pending", "confirmed", "failed"], default: "pending" },
    donatedAt: { type: Date, default: Date.now },
    confirmedBy: { type: Schema.Types.ObjectId, ref: "User" },
    confirmedAt: { type: Date },
    failedBy: { type: Schema.Types.ObjectId, ref: "User" },
    failedAt: { type: Date },
    failureReason: { type: String, trim: true, maxlength: 1000 },
    receiptNumber: { type: String, trim: true },
    journalEntryId: { type: Schema.Types.ObjectId, ref: "JournalEntry" },
    accountingVerified: { type: Boolean, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    notes: { type: String },
  },
  { timestamps: true },
);
DonationSchema.index({ alumniId: 1, donatedAt: -1 });
DonationSchema.index({ status: 1 });
DonationSchema.index({ transactionId: 1 }, { unique: true, sparse: true });
DonationSchema.index({ receiptNumber: 1 }, { unique: true, sparse: true });
DonationSchema.plugin(auditPlugin);
DonationSchema.path("createdBy").required(true);
export const DonationModel = model<IDonation>("Donation", DonationSchema);

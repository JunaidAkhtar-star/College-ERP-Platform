/**
 * HR (Human Resources) Model — SRS §4.8, Modules 36–39
 * Manages employee records: personal info, employment details, contracts, documents.
 */
import { auditPlugin } from "../plugins/audit.plugin";
import mongoose, { Schema, type Document, type Types } from "mongoose";
import { EmploymentType } from "./faculty-profile.model";

// Re-export for convenience
export { EmploymentType } from "./faculty-profile.model";

export enum EmploymentStatus {
  ACTIVE = "active",
  RESIGNED = "resigned",
  TERMINATED = "terminated",
  RETIRED = "retired",
  ON_LEAVE = "on_leave",
}

export enum Gender {
  MALE = "male",
  FEMALE = "female",
  OTHER = "other",
}

export interface IHrEmployee extends Document {
  _id: Types.ObjectId;

  // ── Identity ──────────────────────────────────────────────────────────────
  userId: Types.ObjectId; // linked User account
  employeeId: string; // system-generated (EMP-0001)
  name: string;
  email: string;
  phone: string;
  gender: Gender;
  dateOfBirth: Date;
  bloodGroup?: string;
  aadhaarNumber?: string; // stored encrypted via cryptoUtil
  panNumber?: string;

  // ── Address ───────────────────────────────────────────────────────────────
  permanentAddress?: string;
  currentAddress?: string;

  // ── Employment ────────────────────────────────────────────────────────────
  department: Types.ObjectId;
  designation: string;
  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;
  dateOfJoining: Date;
  dateOfLeaving?: Date;
  reportingTo?: Types.ObjectId; // manager's userId

  // ── Salary ────────────────────────────────────────────────────────────────
  basicSalary: number;
  grade?: string;

  // ── Bank Details ──────────────────────────────────────────────────────────
  bankName?: string;
  bankAccountNumber?: string; // should be encrypted in prod
  ifscCode?: string;

  // ── Documents ─────────────────────────────────────────────────────────────
  documents?: Array<{
    type: string;
    url: string;
    uploadedAt: Date;
  }>;

  // ── Emergency Contact ─────────────────────────────────────────────────────
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };

  // ── Timestamps ────────────────────────────────────────────────────────────
  createdAt: Date;
  updatedAt: Date;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}

const HrEmployeeSchema = new Schema<IHrEmployee>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    employeeId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    gender: { type: String, enum: Object.values(Gender), required: true },
    dateOfBirth: { type: Date, required: true },
    bloodGroup: { type: String },
    aadhaarNumber: { type: String, select: false }, // encrypted, never returned by default
    panNumber: { type: String },

    permanentAddress: { type: String },
    currentAddress: { type: String },

    department: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    designation: { type: String, required: true },
    employmentType: {
      type: String,
      enum: Object.values(EmploymentType),
      required: true,
      default: EmploymentType.PERMANENT,
    },
    employmentStatus: {
      type: String,
      enum: Object.values(EmploymentStatus),
      default: EmploymentStatus.ACTIVE,
    },
    dateOfJoining: { type: Date, required: true },
    dateOfLeaving: { type: Date },
    reportingTo: { type: Schema.Types.ObjectId, ref: "User" },

    basicSalary: { type: Number, required: true, min: 0 },
    grade: { type: String },

    bankName: { type: String },
    bankAccountNumber: { type: String, select: false },
    ifscCode: { type: String },

    documents: [
      {
        type: { type: String, required: true },
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    emergencyContact: {
      name: { type: String },
      relationship: { type: String },
      phone: { type: String },
    },
  },
  { timestamps: true },
);

HrEmployeeSchema.index({ department: 1, employmentStatus: 1 });
HrEmployeeSchema.index({ employmentStatus: 1 });

HrEmployeeSchema.plugin(auditPlugin);
HrEmployeeSchema.path("createdBy").required(true);

export const HrEmployeeModel = mongoose.model<IHrEmployee>("HrEmployee", HrEmployeeSchema);

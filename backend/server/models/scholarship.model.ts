import { auditPlugin } from "../plugins/audit.plugin";
import type { Types, Document } from "mongoose";
import { Schema, model } from "mongoose";

export interface IScholarship extends Document {
  schemeId: Types.ObjectId;
  studentId: Types.ObjectId;
  scholarshipName: string;
  scholarshipType: "government" | "institutional" | "private" | "merit" | "need_based";
  awardingBody: string;
  academicYear: string;
  appliedDate: Date;
  amount: number;
  approvedAmount?: number;
  disbursedAmount?: number;
  status: "applied" | "document_pending" | "under_review" | "approved" | "rejected" | "disbursed";
  documents: { docType: string; fileUrl: string; uploadedAt: Date }[];
  eligibilityCriteria?: string;
  verifiedBy?: Types.ObjectId;
  verifiedAt?: Date;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  disbursedDate?: Date;
  disbursedBy?: Types.ObjectId;
  remarks?: string;
  referenceNo?: string;
  benefitMode: "fee_credit" | "bank_transfer";
  eligibilitySnapshot?: {
    familyIncome?: number;
    cgpa?: number;
    backlogs: number;
    evaluatedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IScholarshipScheme extends Document {
  name: string;
  scholarshipType: IScholarship["scholarshipType"];
  awardingBody: string;
  academicYear: string;
  benefitMode: IScholarship["benefitMode"];
  applicationStart: Date;
  applicationEnd: Date;
  budgetAmount: number;
  reservedAmount: number;
  disbursedAmount: number;
  maxAwardAmount: number;
  minCgpa?: number;
  maxFamilyIncome?: number;
  maxBacklogs: number;
  requiredDocumentTypes: string[];
  isActive: boolean;
}

const SCHOLARSHIP_TYPES = ["government", "institutional", "private", "merit", "need_based"];

const ScholarshipSchema = new Schema<IScholarship>(
  {
    schemeId: { type: Schema.Types.ObjectId, ref: "ScholarshipScheme", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    scholarshipName: { type: String, required: true, trim: true },
    scholarshipType: {
      type: String,
      enum: SCHOLARSHIP_TYPES,
      required: true,
    },
    awardingBody: { type: String, required: true, trim: true },
    academicYear: { type: String, required: true },
    appliedDate: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    approvedAmount: { type: Number, min: 0 },
    disbursedAmount: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ["applied", "document_pending", "under_review", "approved", "rejected", "disbursed"],
      default: "applied",
    },
    documents: [
      {
        docType: { type: String, required: true },
        fileUrl: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    eligibilityCriteria: { type: String },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    rejectionReason: { type: String },
    disbursedDate: { type: Date },
    disbursedBy: { type: Schema.Types.ObjectId, ref: "User" },
    remarks: { type: String },
    referenceNo: { type: String, trim: true },
    benefitMode: { type: String, enum: ["fee_credit", "bank_transfer"], required: true },
    eligibilitySnapshot: {
      familyIncome: Number,
      cgpa: Number,
      backlogs: { type: Number, min: 0 },
      evaluatedAt: Date,
    },
  },
  { timestamps: true },
);

ScholarshipSchema.index({ studentId: 1, schemeId: 1 }, { unique: true });
ScholarshipSchema.index({ status: 1 });
ScholarshipSchema.index({ schemeId: 1, status: 1 });

// Apply audit plugin (soft delete + createdBy/updatedBy)
ScholarshipSchema.plugin(auditPlugin);

export const ScholarshipModel = model<IScholarship>("Scholarship", ScholarshipSchema);

const ScholarshipSchemeSchema = new Schema<IScholarshipScheme>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    scholarshipType: { type: String, enum: SCHOLARSHIP_TYPES, required: true },
    awardingBody: { type: String, required: true, trim: true, maxlength: 200 },
    academicYear: { type: String, required: true, trim: true },
    benefitMode: { type: String, enum: ["fee_credit", "bank_transfer"], required: true },
    applicationStart: { type: Date, required: true },
    applicationEnd: { type: Date, required: true },
    budgetAmount: { type: Number, required: true, min: 1 },
    reservedAmount: { type: Number, default: 0, min: 0 },
    disbursedAmount: { type: Number, default: 0, min: 0 },
    maxAwardAmount: { type: Number, required: true, min: 1 },
    minCgpa: { type: Number, min: 0, max: 10 },
    maxFamilyIncome: { type: Number, min: 0 },
    maxBacklogs: { type: Number, default: 0, min: 0 },
    requiredDocumentTypes: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

ScholarshipSchemeSchema.index({ name: 1, academicYear: 1 }, { unique: true });
ScholarshipSchemeSchema.index({ academicYear: 1, isActive: 1, applicationEnd: 1 });
ScholarshipSchemeSchema.plugin(auditPlugin);

export const ScholarshipSchemeModel = model<IScholarshipScheme>(
  "ScholarshipScheme",
  ScholarshipSchemeSchema,
);

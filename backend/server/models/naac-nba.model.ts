import { auditPlugin } from "../plugins/audit.plugin";
/**
 * NAAC & NBA Model (M34 + M35)
 * NAAC  — criteria-based evidence/documentation for accreditation
 * NBA   — CO/PO attainment reports and OBE compliance tracking
 */
import type { Types, Document } from "mongoose";
import { Schema, model } from "mongoose";

// ─── NAAC ─────────────────────────────────────────────────────────────────────

export type NaacCriterion = "1" | "2" | "3" | "4" | "5" | "6" | "7";

export interface INaacEvidence extends Document {
  criterion: NaacCriterion;
  metricNo: string; // e.g. "3.2.1"
  title: string;
  description?: string;
  evidenceFiles: { url: string; name: string; uploadedAt: Date }[];
  academicYear: string;
  submittedBy: Types.ObjectId;
  reviewedBy?: Types.ObjectId;
  status: "draft" | "submitted" | "approved" | "revision_requested";
  reviewNotes?: string;
  score?: number; // IQAC-assigned score (0–4)
  createdAt: Date;
  updatedAt: Date;
}

const NaacEvidenceSchema = new Schema<INaacEvidence>(
  {
    criterion: { type: String, enum: ["1", "2", "3", "4", "5", "6", "7"], required: true },
    metricNo: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    evidenceFiles: [
      {
        url: { type: String, required: true },
        name: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    academicYear: { type: String, required: true, trim: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["draft", "submitted", "approved", "revision_requested"],
      default: "draft",
    },
    reviewNotes: { type: String },
    score: { type: Number, min: 0, max: 4 },
  },
  { timestamps: true },
);

NaacEvidenceSchema.index({ criterion: 1, academicYear: 1 });
NaacEvidenceSchema.index({ criterion: 1, metricNo: 1, academicYear: 1 }, { unique: true });
NaacEvidenceSchema.index({ status: 1 });

// Apply audit plugin (soft delete + createdBy/updatedBy)
NaacEvidenceSchema.plugin(auditPlugin);

export const NaacEvidenceModel = model<INaacEvidence>("NaacEvidence", NaacEvidenceSchema);

// ─── NBA ──────────────────────────────────────────────────────────────────────

export interface INbaReport extends Document {
  programId: Types.ObjectId;
  program: string;
  departmentId: Types.ObjectId;
  academicYear: string;
  semester: number;
  coAttainments: {
    courseCode: string;
    courseName: string;
    coCode: string;
    coStatement: string;
    directAttainment: number; // %
    indirectAttainment: number; // %
    finalAttainment: number; // weighted avg
    attainmentLevel: 1 | 2 | 3; // NBA level
  }[];
  poAttainments: {
    poCode: string;
    poStatement: string;
    attainmentLevel: number; // avg across mapped COs
  }[];
  psoAttainments?: {
    psoCode: string;
    psoStatement: string;
    attainmentLevel: number;
  }[];
  thresholdMet: boolean; // all POs ≥ threshold (typically 60%)
  generatedBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvalComments?: string;
  approvedAt?: Date;
  status: "draft" | "approved";
  reportUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NbaReportSchema = new Schema<INbaReport>(
  {
    programId: { type: Schema.Types.ObjectId, ref: "Curriculum", required: true },
    program: { type: String, required: true, trim: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    academicYear: { type: String, required: true, trim: true },
    semester: { type: Number, required: true, min: 1 },
    coAttainments: [
      {
        courseCode: { type: String, required: true },
        courseName: { type: String, required: true },
        coCode: { type: String, required: true },
        coStatement: { type: String, required: true },
        directAttainment: { type: Number, default: 0 },
        indirectAttainment: { type: Number, default: 0 },
        finalAttainment: { type: Number, default: 0 },
        attainmentLevel: { type: Number, enum: [1, 2, 3], default: 1 },
      },
    ],
    poAttainments: [
      {
        poCode: { type: String, required: true },
        poStatement: { type: String, required: true },
        attainmentLevel: { type: Number, default: 0 },
      },
    ],
    psoAttainments: [
      {
        psoCode: { type: String },
        psoStatement: { type: String },
        attainmentLevel: { type: Number, default: 0 },
      },
    ],
    thresholdMet: { type: Boolean, default: false },
    generatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvalComments: { type: String, trim: true, maxlength: 2000 },
    approvedAt: Date,
    status: { type: String, enum: ["draft", "approved"], default: "draft" },
    reportUrl: { type: String },
  },
  { timestamps: true },
);

NbaReportSchema.index({ programId: 1, academicYear: 1, semester: 1 }, { unique: true });
NbaReportSchema.plugin(auditPlugin);

export const NbaReportModel = model<INbaReport>("NbaReport", NbaReportSchema);

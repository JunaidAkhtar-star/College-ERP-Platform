import { auditPlugin } from "../plugins/audit.plugin";
import mongoose, { Schema, type Document, type Types } from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

export enum DocumentType {
  AADHAAR = "aadhaar",
  TENTH_MARKSHEET = "tenth_marksheet",
  TWELFTH_MARKSHEET = "twelfth_marksheet",
  DIPLOMA_MARKSHEET = "diploma_marksheet",
  TRANSFER_CERTIFICATE = "transfer_certificate",
  MIGRATION_CERTIFICATE = "migration_certificate",
  INCOME_CERTIFICATE = "income_certificate",
  CASTE_CERTIFICATE = "caste_certificate",
  SCHOLARSHIP_DOC = "scholarship_doc",
  PASSPORT_PHOTO = "passport_photo",
  BIRTH_CERTIFICATE = "birth_certificate",
  CHARACTER_CERTIFICATE = "character_certificate",
  QUALIFYING_EXAM_SCORECARD = "qualifying_exam_scorecard",
  EMPLOYEE_EXPERIENCE = "employee_experience",
  EMPLOYEE_QUALIFICATION = "employee_qualification",
  OTHER = "other",
}

export enum DocumentStatus {
  PENDING = "pending",
  UNDER_REVIEW = "under_review",
  VERIFIED = "verified",
  REJECTED = "rejected",
  EXPIRED = "expired",
}

// ─────────────────────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface IDocumentVersion {
  version: number;
  url: string;
  publicId: string;
  uploadedAt: Date;
  fileSize: number;
  format: string;
}

export interface IDocument extends Document {
  _id: Types.ObjectId;
  owner: Types.ObjectId; // User who owns this document
  ownerModel: "User" | "AdmissionApplication";

  type: DocumentType;
  name: string; // Display name, e.g., "10th Marksheet 2022"

  // ── Current version ───────────────────────────────────────────────────────
  url: string;
  publicId: string;
  fileSize: number;
  format: string;

  // ── Version history ───────────────────────────────────────────────────────
  versions: IDocumentVersion[];

  // ── Verification workflow ─────────────────────────────────────────────────
  status: DocumentStatus;
  verifiedBy?: Types.ObjectId;
  verifiedAt?: Date;
  rejectionReason?: string;

  // ── Expiry ────────────────────────────────────────────────────────────────
  expiresAt?: Date;
  isExpired: boolean;

  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const documentVersionSchema = new Schema<IDocumentVersion>(
  {
    version: { type: Number, required: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    uploadedAt: { type: Date, required: true, default: Date.now },
    fileSize: { type: Number, required: true },
    format: { type: String, required: true },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// Main schema
// ─────────────────────────────────────────────────────────────────────────────

const documentSchema = new Schema<IDocument>(
  {
    owner: { type: Schema.Types.ObjectId, required: true, refPath: "ownerModel", index: true },
    ownerModel: { type: String, enum: ["User", "AdmissionApplication"], required: true },

    type: { type: String, enum: Object.values(DocumentType), required: true },
    name: { type: String, required: true, trim: true },

    url: { type: String, required: true },
    publicId: { type: String, required: true },
    fileSize: { type: Number, required: true },
    format: { type: String, required: true },

    versions: { type: [documentVersionSchema], default: [] },

    status: {
      type: String,
      enum: Object.values(DocumentStatus),
      default: DocumentStatus.PENDING,
      index: true,
    },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },
    rejectionReason: { type: String },

    expiresAt: { type: Date },
    isExpired: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_d, ret: Record<string, unknown>) => {
        delete ret["__v"];
      },
    },
  },
);

documentSchema.index({ owner: 1, type: 1 });
// index on `status` is created by `index: true` in the field definition above
documentSchema.index({ expiresAt: 1 });

documentSchema.plugin(auditPlugin);
documentSchema.path("createdBy").required(true);

export const DocumentModel = mongoose.model<IDocument>("Document", documentSchema);

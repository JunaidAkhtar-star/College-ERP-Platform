import mongoose, { Schema, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export type TDocumentAudience = "student" | "faculty" | "visitor";
export type TDocumentKind = "certificate" | "id_card" | "letter" | "report" | "poster";
export type TDocumentTemplateStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "published"
  | "retired";
export interface ITemplateElement {
  id: string;
  type: "text" | "image" | "line" | "qr";
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  source?: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  align?: "left" | "center" | "right";
  color?: string;
  backgroundColor?: string;
  borderRadius?: number;
  rotation?: number;
  opacity?: number;
}
export interface IDocumentTemplate extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  category: string;
  tags: string[];
  kind: TDocumentKind;
  audience: TDocumentAudience;
  page: { widthMm: number; heightMm: number; orientation: "portrait" | "landscape" };
  backgroundUrl?: string;
  elements: ITemplateElement[];
  version: number;
  status: TDocumentTemplateStatus;
  submittedBy?: Types.ObjectId;
  submittedAt?: Date;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  publishedBy?: Types.ObjectId;
  publishedAt?: Date;
  retiredBy?: Types.ObjectId;
  retiredAt?: Date;
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
export interface IIssuedDocument extends Document {
  _id: Types.ObjectId;
  templateId: Types.ObjectId;
  templateVersion: number;
  subjectType: TDocumentAudience;
  subjectId: Types.ObjectId;
  documentNumber: string;
  verificationCode: string;
  snapshot: Record<string, unknown>;
  templateSnapshot: Record<string, unknown>;
  templateHash: string;
  pdfHash: string;
  issuedBy: Types.ObjectId;
  issuedAt: Date;
  revokedAt?: Date;
  revocationReason?: string;
}

const ElementSchema = new Schema<ITemplateElement>(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ["text", "image", "line", "qr"], required: true },
    x: { type: Number, required: true, min: 0 },
    y: { type: Number, required: true, min: 0 },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    content: String,
    source: String,
    fontSize: { type: Number, min: 6, max: 96 },
    fontWeight: { type: String, enum: ["normal", "bold"] },
    align: { type: String, enum: ["left", "center", "right"] },
    color: String,
    backgroundColor: String,
    borderRadius: { type: Number, min: 0, max: 100 },
    rotation: { type: Number, min: -360, max: 360, default: 0 },
    opacity: { type: Number, min: 0.1, max: 1, default: 1 },
  },
  { _id: false },
);
const DocumentTemplateSchema = new Schema<IDocumentTemplate>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, maxlength: 1000 },
    category: { type: String, trim: true, default: "General", maxlength: 80, index: true },
    tags: { type: [String], default: [] },
    kind: {
      type: String,
      enum: ["certificate", "id_card", "letter", "report", "poster"],
      required: true,
      index: true,
    },
    audience: {
      type: String,
      enum: ["student", "faculty", "visitor"],
      required: true,
      index: true,
    },
    page: {
      widthMm: { type: Number, required: true, min: 40, max: 500 },
      heightMm: { type: Number, required: true, min: 40, max: 500 },
      orientation: { type: String, enum: ["portrait", "landscape"], default: "portrait" },
    },
    backgroundUrl: String,
    elements: { type: [ElementSchema], default: [] },
    version: { type: Number, default: 1, min: 1 },
    status: {
      type: String,
      enum: ["draft", "pending_approval", "approved", "published", "retired"],
      default: "draft",
      index: true,
    },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
    submittedAt: Date,
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
    publishedBy: { type: Schema.Types.ObjectId, ref: "User" },
    publishedAt: Date,
    retiredBy: { type: Schema.Types.ObjectId, ref: "User" },
    retiredAt: Date,
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
DocumentTemplateSchema.plugin(auditPlugin);

export interface IDocumentTemplateVersion extends Document {
  templateId: Types.ObjectId;
  version: number;
  snapshot: Record<string, unknown>;
  snapshotHash: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
}
const DocumentTemplateVersionSchema = new Schema<IDocumentTemplateVersion>(
  {
    templateId: {
      type: Schema.Types.ObjectId,
      ref: "DocumentTemplate",
      required: true,
      index: true,
    },
    version: { type: Number, required: true, min: 1 },
    snapshot: { type: Schema.Types.Mixed, required: true, immutable: true },
    snapshotHash: { type: String, required: true, immutable: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
DocumentTemplateVersionSchema.index({ templateId: 1, version: 1 }, { unique: true });
DocumentTemplateVersionSchema.pre(
  ["updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany"],
  function () {
    throw new Error("Published document template versions are immutable");
  },
);
const IssuedDocumentSchema = new Schema<IIssuedDocument>(
  {
    templateId: {
      type: Schema.Types.ObjectId,
      ref: "DocumentTemplate",
      required: true,
      index: true,
    },
    templateVersion: { type: Number, required: true },
    subjectType: { type: String, enum: ["student", "faculty", "visitor"], required: true },
    subjectId: { type: Schema.Types.ObjectId, required: true, index: true },
    documentNumber: { type: String, required: true, unique: true },
    verificationCode: { type: String, required: true, unique: true, index: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
    templateSnapshot: { type: Schema.Types.Mixed, required: true, immutable: true },
    templateHash: { type: String, required: true, immutable: true },
    pdfHash: { type: String, required: true, immutable: true },
    issuedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    issuedAt: { type: Date, default: Date.now },
    revokedAt: Date,
    revocationReason: String,
  },
  { timestamps: true },
);
export const DocumentTemplateModel = mongoose.model<IDocumentTemplate>(
  "DocumentTemplate",
  DocumentTemplateSchema,
);
export const DocumentTemplateVersionModel = mongoose.model<IDocumentTemplateVersion>(
  "DocumentTemplateVersion",
  DocumentTemplateVersionSchema,
);
export const IssuedDocumentModel = mongoose.model<IIssuedDocument>(
  "IssuedDocument",
  IssuedDocumentSchema,
);

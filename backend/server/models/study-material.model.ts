import { auditPlugin } from "../plugins/audit.plugin";
import type { Types, Document } from "mongoose";
import { Schema, model } from "mongoose";

export type MaterialType = "pdf" | "ppt" | "video" | "notes" | "link" | "other";
export enum StudyMaterialStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  ARCHIVED = "archived",
}

export interface IStudyMaterial extends Document {
  title: string;
  description?: string;
  subjectId: Types.ObjectId;
  sectionIds: Types.ObjectId[];
  subjectCode: string;
  departmentId: Types.ObjectId;
  program: string;
  semester: number;
  academicYear: string;
  unitNo?: number;
  materialType: MaterialType;
  fileUrl?: string;
  fileSize?: number;
  externalLink?: string;
  uploadedBy: Types.ObjectId;
  isActive: boolean;
  status: StudyMaterialStatus;
  version: number;
  replacesMaterialId?: Types.ObjectId;
  replacedByMaterialId?: Types.ObjectId;
  publishedAt?: Date;
  archivedAt?: Date;
  archivedBy?: Types.ObjectId;
  viewCount: number;
  downloadCount: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const StudyMaterialSchema = new Schema<IStudyMaterial>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 20000 },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    sectionIds: [{ type: Schema.Types.ObjectId, ref: "Section", required: true }],
    subjectCode: { type: String, required: true, trim: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    program: { type: String, required: true, trim: true },
    semester: { type: Number, required: true, min: 1 },
    academicYear: { type: String, required: true, trim: true },
    unitNo: { type: Number, min: 1, max: 20 },
    materialType: {
      type: String,
      enum: ["pdf", "ppt", "video", "notes", "link", "other"],
      required: true,
    },
    fileUrl: { type: String, trim: true, maxlength: 2000 },
    fileSize: { type: Number, min: 0, max: 5 * 1024 * 1024 * 1024 },
    externalLink: { type: String, trim: true, maxlength: 2000 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isActive: { type: Boolean, default: false },
    status: {
      type: String,
      enum: Object.values(StudyMaterialStatus),
      default: StudyMaterialStatus.DRAFT,
      required: true,
    },
    version: { type: Number, default: 1, min: 1 },
    replacesMaterialId: { type: Schema.Types.ObjectId, ref: "StudyMaterial" },
    replacedByMaterialId: { type: Schema.Types.ObjectId, ref: "StudyMaterial" },
    publishedAt: { type: Date },
    archivedAt: { type: Date },
    archivedBy: { type: Schema.Types.ObjectId, ref: "User" },
    viewCount: { type: Number, default: 0 },
    downloadCount: { type: Number, default: 0 },
    tags: [{ type: String, lowercase: true, trim: true }],
  },
  { timestamps: true },
);

StudyMaterialSchema.index({ subjectId: 1, semester: 1 });
StudyMaterialSchema.index({ departmentId: 1, program: 1 });
StudyMaterialSchema.index({ sectionIds: 1, status: 1, subjectId: 1 });

// Apply audit plugin (soft delete + createdBy/updatedBy)
StudyMaterialSchema.plugin(auditPlugin);

export const StudyMaterialModel = model<IStudyMaterial>("StudyMaterial", StudyMaterialSchema);

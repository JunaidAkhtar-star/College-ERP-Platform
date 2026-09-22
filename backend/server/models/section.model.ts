import { auditPlugin } from "../plugins/audit.plugin";
import type { Document, Types } from "mongoose";
import mongoose, { Schema } from "mongoose";

export enum SectionStatus {
  PLANNED = "Planned",
  ACTIVE = "Active",
  LOCKED = "Locked",
  ARCHIVED = "Archived",
}

export interface ISection extends Document {
  _id: Types.ObjectId;
  academicYear: string;
  batchId: Types.ObjectId;
  curriculumId: Types.ObjectId;
  departmentId: Types.ObjectId;
  program: string;
  departmentCode: string;
  semesterNo: number;
  sectionName: string;
  capacity: number;
  allottedCount: number;
  classTeacherId?: Types.ObjectId;
  classTeacherName?: string;
  status: SectionStatus;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SectionSchema = new Schema<ISection>(
  {
    academicYear: { type: String, required: true, trim: true },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
    curriculumId: { type: Schema.Types.ObjectId, ref: "Curriculum", required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    program: { type: String, required: true, trim: true },
    departmentCode: { type: String, required: true, uppercase: true, trim: true },
    semesterNo: { type: Number, required: true, min: 1, max: 12 },
    sectionName: { type: String, required: true, uppercase: true, trim: true },
    capacity: { type: Number, required: true, min: 1 },
    allottedCount: { type: Number, default: 0, min: 0 },
    classTeacherId: { type: Schema.Types.ObjectId, ref: "User" },
    classTeacherName: { type: String, trim: true },
    status: { type: String, enum: Object.values(SectionStatus), default: SectionStatus.ACTIVE },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

SectionSchema.index(
  { academicYear: 1, batchId: 1, semesterNo: 1, sectionName: 1 },
  { unique: true },
);
SectionSchema.index({ departmentId: 1, academicYear: 1, semesterNo: 1 });
SectionSchema.index({ classTeacherId: 1, academicYear: 1 });

SectionSchema.plugin(auditPlugin);
SectionSchema.path("createdBy").required(true);

export const SectionModel = mongoose.model<ISection>("Section", SectionSchema);

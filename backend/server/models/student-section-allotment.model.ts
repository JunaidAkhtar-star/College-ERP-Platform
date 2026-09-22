import { auditPlugin } from "../plugins/audit.plugin";
import type { Document, Types } from "mongoose";
import mongoose, { Schema } from "mongoose";

export enum StudentSectionAllotmentStatus {
  ACTIVE = "Active",
  TRANSFERRED = "Transferred",
  CANCELLED = "Cancelled",
  COMPLETED = "Completed",
}

export interface ISectionTransferHistory {
  fromSectionId?: Types.ObjectId;
  toSectionId: Types.ObjectId;
  changedAt: Date;
  changedBy: Types.ObjectId;
  reason: string;
}

export interface IStudentSectionAllotment extends Document {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  studentProfileId?: Types.ObjectId;
  sectionId: Types.ObjectId;
  batchId: Types.ObjectId;
  curriculumId: Types.ObjectId;
  departmentId: Types.ObjectId;
  academicYear: string;
  semesterNo: number;
  rollNo: string;
  status: StudentSectionAllotmentStatus;
  validFrom: Date;
  validTo?: Date;
  transferHistory: ISectionTransferHistory[];
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SectionTransferHistorySchema = new Schema<ISectionTransferHistory>(
  {
    fromSectionId: { type: Schema.Types.ObjectId, ref: "Section" },
    toSectionId: { type: Schema.Types.ObjectId, ref: "Section", required: true },
    changedAt: { type: Date, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const StudentSectionAllotmentSchema = new Schema<IStudentSectionAllotment>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    studentProfileId: { type: Schema.Types.ObjectId, ref: "StudentProfile" },
    sectionId: { type: Schema.Types.ObjectId, ref: "Section", required: true },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
    curriculumId: { type: Schema.Types.ObjectId, ref: "Curriculum", required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    academicYear: { type: String, required: true, trim: true },
    semesterNo: { type: Number, required: true, min: 1, max: 12 },
    rollNo: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(StudentSectionAllotmentStatus),
      default: StudentSectionAllotmentStatus.ACTIVE,
    },
    validFrom: { type: Date, required: true, default: Date.now },
    validTo: { type: Date },
    transferHistory: { type: [SectionTransferHistorySchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

StudentSectionAllotmentSchema.index(
  { studentId: 1, academicYear: 1, semesterNo: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: StudentSectionAllotmentStatus.ACTIVE },
  },
);
StudentSectionAllotmentSchema.index(
  { sectionId: 1, rollNo: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: StudentSectionAllotmentStatus.ACTIVE },
  },
);
StudentSectionAllotmentSchema.index({ sectionId: 1, status: 1 });
StudentSectionAllotmentSchema.index({ batchId: 1, semesterNo: 1, academicYear: 1 });

StudentSectionAllotmentSchema.plugin(auditPlugin);
StudentSectionAllotmentSchema.path("createdBy").required(true);

export const StudentSectionAllotmentModel = mongoose.model<IStudentSectionAllotment>(
  "StudentSectionAllotment",
  StudentSectionAllotmentSchema,
);

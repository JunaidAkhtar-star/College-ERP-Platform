import { auditPlugin } from "../plugins/audit.plugin";
import mongoose, { Schema, type Document, type Types } from "mongoose";

export enum BatchStatus {
  PLANNED = "Planned",
  ACTIVE = "Active",
  PASSED_OUT = "Passed Out",
  ARCHIVED = "Archived",
}

export interface IBatch extends Document {
  _id: Types.ObjectId;
  name: string;
  curriculumId: Types.ObjectId;
  departmentId: Types.ObjectId;
  program: string;
  departmentCode: string;
  admissionYear: number;
  regulationYear: string;
  expectedGraduationYear: number;
  lateralEntryAllowed: boolean;
  intake: number;
  status: BatchStatus;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BatchSchema = new Schema<IBatch>(
  {
    name: { type: String, required: true, trim: true },
    curriculumId: { type: Schema.Types.ObjectId, ref: "Curriculum", required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    program: { type: String, required: true, trim: true },
    departmentCode: { type: String, required: true, uppercase: true, trim: true },
    admissionYear: { type: Number, required: true, min: 2000, max: 2100 },
    regulationYear: { type: String, required: true, trim: true },
    expectedGraduationYear: { type: Number, required: true, min: 2000, max: 2105 },
    lateralEntryAllowed: { type: Boolean, default: false },
    intake: { type: Number, required: true, min: 1 },
    status: { type: String, enum: Object.values(BatchStatus), default: BatchStatus.ACTIVE },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

BatchSchema.index({ curriculumId: 1, departmentId: 1, admissionYear: 1 }, { unique: true });
BatchSchema.index({ departmentId: 1, status: 1 });
BatchSchema.index({ admissionYear: 1, status: 1 });

BatchSchema.plugin(auditPlugin);
BatchSchema.path("createdBy").required(true);

export const BatchModel = mongoose.model<IBatch>("Batch", BatchSchema);

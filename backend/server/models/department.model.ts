import { auditPlugin } from "../plugins/audit.plugin";
import type { Document, Types } from "mongoose";
import mongoose, { Schema } from "mongoose";

// ─── Types ────────────────────────────────────────────────────────────────────

export enum DepartmentStatus {
  ACTIVE = "Active",
  INACTIVE = "Inactive",
}

export interface IDepartment extends Document {
  _id: Types.ObjectId;
  campusId?: Types.ObjectId;
  code: string; // e.g. "CSE", "ECE"
  name: string; // e.g. "Computer Science & Engineering"
  shortName: string; // e.g. "Dept. of CSE"
  hodId?: Types.ObjectId;
  hodName?: string;
  curriculumIds: Types.ObjectId[];
  programs: string[]; // ["B.Tech", "M.Tech", "MBA"]
  vision?: string;
  mission?: string;
  email?: string;
  phone?: string;
  location?: string; // Block/Room
  naacCode?: string;
  aicteCode?: string;
  intake: number; // Approved intake per year
  status: DepartmentStatus;
  establishedYear?: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const DepartmentSchema = new Schema<IDepartment>(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    campusId: { type: Schema.Types.ObjectId, ref: "Campus", index: true },
    name: { type: String, required: true, trim: true },
    shortName: { type: String, required: true, trim: true },
    hodId: { type: Schema.Types.ObjectId, ref: "User" },
    hodName: { type: String },
    curriculumIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Curriculum" }],
      validate: {
        validator: (value: Types.ObjectId[]) => Array.isArray(value) && value.length > 0,
        message: "At least one curriculum is required",
      },
    },
    programs: { type: [String], default: [] },
    vision: { type: String },
    mission: { type: String },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String },
    location: { type: String },
    naacCode: { type: String },
    aicteCode: { type: String },
    intake: { type: Number, default: 60 },
    status: {
      type: String,
      enum: Object.values(DepartmentStatus),
      default: DepartmentStatus.ACTIVE,
    },
    establishedYear: { type: Number },
  },
  { timestamps: true },
);

DepartmentSchema.index({ campusId: 1, code: 1 }, { unique: true });
DepartmentSchema.index({ status: 1 });

DepartmentSchema.plugin(auditPlugin);

export const DepartmentModel = mongoose.model<IDepartment>("Department", DepartmentSchema);

import { auditPlugin } from "../plugins/audit.plugin";
import { Schema, model, type Types, type Document } from "mongoose";

export interface IFacultyWorkloadAssignment {
  subjectId: Types.ObjectId;
  subjectCode: string;
  subjectName: string;
  program: string;
  semester: number;
  section: string;
  classType: "theory" | "lab" | "tutorial";
  weeklyHours: number;
  totalHours: number;
  batch?: string;
}

export interface IExtraDuty {
  type: "iqac" | "exam_duty" | "mentor" | "committee" | "placement" | "other";
  description: string;
  weeklyHours: number;
}

export interface IFacultyWorkload extends Document {
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  facultyId: Types.ObjectId;
  departmentId: Types.ObjectId;
  academicYear: string;
  semesterType: "odd" | "even";
  teachingAssignments: IFacultyWorkloadAssignment[];
  extraDuties: IExtraDuty[];
  totalWeeklyTeachingHours: number;
  totalWeeklyHours: number;
  isApproved: boolean;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WorkloadAssignmentSchema = new Schema<IFacultyWorkloadAssignment>(
  {
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    subjectCode: { type: String, required: true },
    subjectName: { type: String, required: true },
    program: { type: String, required: true },
    semester: { type: Number, required: true },
    section: { type: String, required: true },
    classType: { type: String, enum: ["theory", "lab", "tutorial"], required: true },
    weeklyHours: { type: Number, required: true, min: 0 },
    totalHours: { type: Number, required: true, min: 0 },
    batch: { type: String },
  },
  { _id: false },
);

const ExtraDutySchema = new Schema<IExtraDuty>(
  {
    type: {
      type: String,
      enum: ["iqac", "exam_duty", "mentor", "committee", "placement", "other"],
      required: true,
    },
    description: { type: String, required: true, trim: true },
    weeklyHours: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const FacultyWorkloadSchema = new Schema<IFacultyWorkload>(
  {
    facultyId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    academicYear: { type: String, required: true, trim: true },
    semesterType: { type: String, enum: ["odd", "even"], required: true },
    teachingAssignments: [WorkloadAssignmentSchema],
    extraDuties: [ExtraDutySchema],
    totalWeeklyTeachingHours: { type: Number, default: 0 },
    totalWeeklyHours: { type: Number, default: 0 },
    isApproved: { type: Boolean, default: false },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
  },
  { timestamps: true },
);

FacultyWorkloadSchema.index({ facultyId: 1, academicYear: 1, semesterType: 1 }, { unique: true });

FacultyWorkloadSchema.plugin(auditPlugin);
FacultyWorkloadSchema.path("createdBy").required(true);

export const FacultyWorkloadModel = model<IFacultyWorkload>(
  "FacultyWorkload",
  FacultyWorkloadSchema,
);

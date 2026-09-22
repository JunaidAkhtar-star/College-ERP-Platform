import { auditPlugin } from "../plugins/audit.plugin";
import type { Types, Document } from "mongoose";
import { Schema, model } from "mongoose";

export interface IUnitPlan {
  unitNo: number;
  unitTitle: string;
  plannedTopics: string[];
  plannedClasses: number;
  plannedStartDate: Date;
  plannedEndDate: Date;
  coMappings: string[]; // CO codes mapped to this unit
  actualClasses?: number;
  isComplete?: boolean;
}

export interface ILessonPlan extends Document {
  academicYear: string;
  semesterType: "odd" | "even";
  subjectId: Types.ObjectId;
  sectionId: Types.ObjectId;
  curriculumId: Types.ObjectId;
  subjectCode: string;
  subjectName: string;
  facultyId: Types.ObjectId;
  departmentId: Types.ObjectId;
  program: string;
  semester: number;
  section: string;
  totalUnits: number;
  totalPlannedClasses: number;
  unitPlans: IUnitPlan[];
  status: "draft" | "submitted" | "approved" | "rejected";
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  reviewHistory: Array<{
    action: "submitted" | "approved" | "rejected";
    actorId: Types.ObjectId;
    at: Date;
    remark?: string;
  }>;
  submittedAt?: Date;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UnitPlanSchema = new Schema<IUnitPlan>(
  {
    unitNo: { type: Number, required: true, min: 1, max: 20 },
    unitTitle: { type: String, required: true, trim: true, maxlength: 500 },
    plannedTopics: [{ type: String, trim: true, maxlength: 1000 }],
    plannedClasses: { type: Number, required: true, min: 1, max: 500 },
    plannedStartDate: { type: Date, required: true },
    plannedEndDate: { type: Date, required: true },
    coMappings: [{ type: String, uppercase: true, trim: true }],
    actualClasses: { type: Number, default: 0 },
    isComplete: { type: Boolean, default: false },
  },
  { _id: false },
);

const LessonPlanSchema = new Schema<ILessonPlan>(
  {
    academicYear: { type: String, required: true, trim: true },
    semesterType: { type: String, enum: ["odd", "even"], required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    sectionId: { type: Schema.Types.ObjectId, ref: "Section", required: true },
    curriculumId: { type: Schema.Types.ObjectId, ref: "Curriculum", required: true },
    subjectCode: { type: String, required: true, trim: true },
    subjectName: { type: String, required: true, trim: true },
    facultyId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    program: { type: String, required: true, trim: true },
    semester: { type: Number, required: true, min: 1 },
    section: { type: String, required: true, trim: true, uppercase: true },
    totalUnits: { type: Number, required: true, min: 1 },
    totalPlannedClasses: { type: Number, default: 0 },
    unitPlans: [UnitPlanSchema],
    status: {
      type: String,
      enum: ["draft", "submitted", "approved", "rejected"],
      default: "draft",
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    rejectionReason: { type: String, trim: true, maxlength: 2000 },
    reviewHistory: [
      {
        action: { type: String, enum: ["submitted", "approved", "rejected"], required: true },
        actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        at: { type: Date, required: true },
        remark: { type: String, trim: true, maxlength: 2000 },
      },
    ],
    submittedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

LessonPlanSchema.index(
  { academicYear: 1, subjectId: 1, facultyId: 1, sectionId: 1 },
  { unique: true },
);
LessonPlanSchema.index({ departmentId: 1, status: 1, sectionId: 1 });

// Apply audit plugin (soft delete + createdBy/updatedBy)
UnitPlanSchema.plugin(auditPlugin);

export const LessonPlanModel = model<ILessonPlan>("LessonPlan", LessonPlanSchema);

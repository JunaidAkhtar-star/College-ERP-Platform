import { auditPlugin } from "../plugins/audit.plugin";
import type { Types, Document } from "mongoose";
import { Schema, model } from "mongoose";

export interface ICourseOutcome {
  coCode: string; // "CO1", "CO2" ...
  description: string;
  bloomsLevel: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
}

export interface ISubjectEntry {
  subjectId: Types.ObjectId;
  subjectCode: string;
  subjectName: string;
  credits: number;
  theoryHours: number;
  labHours: number;
  tutorialHours: number;
  isElective: boolean;
  electiveGroup?: string;
  courseOutcomes: ICourseOutcome[];
}

export interface ISemesterPlan {
  semesterNo: number;
  subjects: ISubjectEntry[];
  totalCredits: number;
  totalTheoryHours: number;
  totalLabHours: number;
}

export interface ICurriculum extends Document {
  program: string; // "B.Tech", "MCA", "MBA"
  academicLevel: "certificate" | "diploma" | "undergraduate" | "postgraduate" | "doctoral";
  openForAdmissions: boolean;
  regulationYear: string; // "2021", "2022" — BPUT regulation
  totalSemesters: number;
  totalCreditsRequired: number;
  semesterPlans: ISemesterPlan[];
  programOutcomes: { poCode: string; description: string }[];
  isActive: boolean;
  version: number;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CourseOutcomeSchema = new Schema<ICourseOutcome>(
  {
    coCode: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    bloomsLevel: {
      type: String,
      enum: ["remember", "understand", "apply", "analyze", "evaluate", "create"],
      required: true,
    },
  },
  { _id: false },
);

const SubjectEntrySchema = new Schema<ISubjectEntry>(
  {
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    subjectCode: { type: String, required: true, trim: true },
    subjectName: { type: String, required: true, trim: true },
    credits: { type: Number, required: true, min: 0 },
    theoryHours: { type: Number, default: 0, min: 0 },
    labHours: { type: Number, default: 0, min: 0 },
    tutorialHours: { type: Number, default: 0, min: 0 },
    isElective: { type: Boolean, default: false },
    electiveGroup: { type: String },
    courseOutcomes: [CourseOutcomeSchema],
  },
  { _id: false },
);

const SemesterPlanSchema = new Schema<ISemesterPlan>(
  {
    semesterNo: { type: Number, required: true, min: 1 },
    subjects: [SubjectEntrySchema],
    totalCredits: { type: Number, default: 0 },
    totalTheoryHours: { type: Number, default: 0 },
    totalLabHours: { type: Number, default: 0 },
  },
  { _id: false },
);

const CurriculumSchema = new Schema<ICurriculum>(
  {
    program: { type: String, required: true, trim: true },
    academicLevel: {
      type: String,
      enum: ["certificate", "diploma", "undergraduate", "postgraduate", "doctoral"],
      required: true,
    },
    openForAdmissions: { type: Boolean, default: true, index: true },
    regulationYear: { type: String, required: true, trim: true },
    totalSemesters: { type: Number, required: true, min: 1 },
    totalCreditsRequired: { type: Number, required: true, min: 0 },
    semesterPlans: [SemesterPlanSchema],
    programOutcomes: [{ poCode: String, description: String }],
    isActive: { type: Boolean, default: true },
    version: { type: Number, default: 1 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

CurriculumSchema.plugin(auditPlugin);
CurriculumSchema.path("createdBy").required(true);
CurriculumSchema.index({ program: 1, regulationYear: 1 }, { unique: true });

export const CurriculumModel = model<ICurriculum>("Curriculum", CurriculumSchema);

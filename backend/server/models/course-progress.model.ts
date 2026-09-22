import { auditPlugin } from "../plugins/audit.plugin";
import type { Types, Document } from "mongoose";
import { Schema, model } from "mongoose";

export interface ITopicEntry {
  date: Date;
  unitNo: number;
  plannedTopic: string;
  topicCovered: string;
  noOfClasses: number;
  attendanceRecordIds: Types.ObjectId[];
  coMappings: string[];
  evidenceVerified: boolean;
  teachingMethod?: string;
  remarks?: string;
}

export interface ICourseProgress extends Document {
  academicYear: string;
  lessonPlanId: Types.ObjectId;
  sectionId: Types.ObjectId;
  curriculumId: Types.ObjectId;
  semesterType: "odd" | "even";
  subjectId: Types.ObjectId;
  subjectCode: string;
  subjectName: string;
  facultyId: Types.ObjectId;
  departmentId: Types.ObjectId;
  program: string;
  semester: number;
  section: string;
  totalPlanedClasses: number;
  totalConductedClasses: number;
  completionPercentage: number;
  topicEntries: ITopicEntry[];
  isComplete: boolean;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TopicEntrySchema = new Schema<ITopicEntry>(
  {
    date: { type: Date, required: true },
    unitNo: { type: Number, required: true, min: 1 },
    plannedTopic: { type: String, required: true, trim: true, maxlength: 1000 },
    topicCovered: { type: String, required: true, trim: true, maxlength: 2000 },
    noOfClasses: { type: Number, required: true, min: 1, default: 1 },
    attendanceRecordIds: [{ type: Schema.Types.ObjectId, ref: "AttendanceRecord", required: true }],
    coMappings: [{ type: String, trim: true, uppercase: true }],
    evidenceVerified: { type: Boolean, default: true, required: true },
    teachingMethod: { type: String, trim: true, maxlength: 500 },
    remarks: { type: String, trim: true, maxlength: 2000 },
  },
  { _id: true },
);

const CourseProgressSchema = new Schema<ICourseProgress>(
  {
    academicYear: { type: String, required: true, trim: true },
    lessonPlanId: { type: Schema.Types.ObjectId, ref: "LessonPlan", required: true, unique: true },
    sectionId: { type: Schema.Types.ObjectId, ref: "Section", required: true },
    curriculumId: { type: Schema.Types.ObjectId, ref: "Curriculum", required: true },
    semesterType: { type: String, enum: ["odd", "even"], required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    subjectCode: { type: String, required: true, trim: true },
    subjectName: { type: String, required: true, trim: true },
    facultyId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    program: { type: String, required: true, trim: true },
    semester: { type: Number, required: true, min: 1 },
    section: { type: String, required: true, trim: true, uppercase: true },
    totalPlanedClasses: { type: Number, default: 0, min: 0 },
    totalConductedClasses: { type: Number, default: 0, min: 0 },
    completionPercentage: { type: Number, default: 0, min: 0, max: 100 },
    topicEntries: [TopicEntrySchema],
    isComplete: { type: Boolean, default: false },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

CourseProgressSchema.index(
  { academicYear: 1, subjectId: 1, facultyId: 1, sectionId: 1 },
  { unique: true },
);
CourseProgressSchema.index({ departmentId: 1, isComplete: 1, sectionId: 1 });

// Apply audit plugin (soft delete + createdBy/updatedBy)
TopicEntrySchema.plugin(auditPlugin);

export const CourseProgressModel = model<ICourseProgress>("CourseProgress", CourseProgressSchema);

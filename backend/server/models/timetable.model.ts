import { auditPlugin } from "../plugins/audit.plugin";
import type { Types, Document } from "mongoose";
import { Schema, model } from "mongoose";

export type SlotDay = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday";

export interface ITimetableSlot {
  _id?: Types.ObjectId;
  day: SlotDay;
  periodNo: number; // 1-8
  startTime: string; // "09:00"
  endTime: string; // "09:50"
  slotKind?: "teaching" | "break" | "activity";
  title?: string;
  subjectId?: Types.ObjectId;
  subjectCode: string;
  subjectShortName?: string;
  subjectName: string;
  facultyId?: Types.ObjectId;
  facultyName: string;
  facultyCode?: string;
  facultyDepartmentId?: Types.ObjectId;
  roomId?: Types.ObjectId;
  roomNo: string;
  classType: "theory" | "lab" | "tutorial";
  labBatch?: string; // "A1", "B2" for split lab batches
  branches?: string[]; // Branch codes for multi-branch grids (e.g., ["CE", "CSE", "EE", "ME"])
  isCombined?: boolean; // True if shared across all branches
  branch?: string; // Branch lane for master/institution timetable views
  branchDepartmentId?: Types.ObjectId; // Authoritative branch for subject/faculty validation
  branchDepartmentIds?: Types.ObjectId[]; // Participating branches for a combined/common class
}

export interface ITimetable extends Document {
  sectionId?: Types.ObjectId;
  batchId?: Types.ObjectId;
  curriculumId?: Types.ObjectId;
  academicYear: string;
  scheduleStartTime?: string;
  scheduleEndTime?: string;
  title?: string;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  documentNo?: string;
  semesterType: "odd" | "even";
  departmentId: Types.ObjectId;
  program: string;
  branches?: string[]; // List of degree branches in multi-branch master grid
  branchDepartmentIds?: Types.ObjectId[];
  semester: number;
  section?: string;
  slots: ITimetableSlot[];
  isActive: boolean;
  isApproved: boolean;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  substituteLog: Array<{
    _id?: Types.ObjectId;
    slotIndex: number;
    substituteFacultyId: Types.ObjectId;
    date: Date;
    reason: string;
    assignedBy: Types.ObjectId;
    assignedAt: Date;
    status?: "active" | "cancelled";
    cancelledBy?: Types.ObjectId;
    cancelledAt?: Date;
    cancellationReason?: string;
  }>;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TimetableSlotSchema = new Schema<ITimetableSlot>(
  {
    day: {
      type: String,
      enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      required: true,
    },
    periodNo: { type: Number, required: true, min: 1, max: 10 },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    slotKind: {
      type: String,
      enum: ["teaching", "break", "activity"],
      default: "teaching",
    },
    title: { type: String, trim: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject" },
    subjectCode: { type: String, default: "" },
    subjectShortName: { type: String, trim: true },
    subjectName: { type: String, default: "" },
    facultyId: { type: Schema.Types.ObjectId, ref: "User" },
    facultyName: { type: String, default: "" },
    facultyCode: { type: String, trim: true, uppercase: true },
    facultyDepartmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    roomId: { type: Schema.Types.ObjectId, ref: "FacilitySpace" },
    roomNo: { type: String, default: "", trim: true },
    classType: { type: String, enum: ["theory", "lab", "tutorial"], required: true },
    labBatch: { type: String },
    branches: { type: [String], default: [] },
    isCombined: { type: Boolean, default: false },
    branch: { type: String, trim: true, uppercase: true },
    branchDepartmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    branchDepartmentIds: [{ type: Schema.Types.ObjectId, ref: "Department" }],
  },
  { _id: true },
);

const TimetableSchema = new Schema<ITimetable>(
  {
    sectionId: { type: Schema.Types.ObjectId, ref: "Section" },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch" },
    curriculumId: { type: Schema.Types.ObjectId, ref: "Curriculum" },
    academicYear: { type: String, required: true, trim: true },
    scheduleStartTime: { type: String, match: /^(?:[01]\d|2[0-3]):[0-5]\d$/ },
    scheduleEndTime: { type: String, match: /^(?:[01]\d|2[0-3]):[0-5]\d$/ },
    title: { type: String, trim: true },
    effectiveFrom: { type: Date },
    effectiveTo: { type: Date },
    documentNo: { type: String, trim: true },
    semesterType: { type: String, enum: ["odd", "even"], required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    program: { type: String, required: true, trim: true },
    branches: { type: [String], default: [] },
    branchDepartmentIds: [{ type: Schema.Types.ObjectId, ref: "Department" }],
    semester: { type: Number, required: true, min: 1 },
    section: { type: String, trim: true, uppercase: true },
    slots: [TimetableSlotSchema],
    isActive: { type: Boolean, default: true },
    isApproved: { type: Boolean, default: false },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    substituteLog: {
      type: [
        new Schema(
          {
            slotIndex: { type: Number, required: true, min: 0 },
            substituteFacultyId: {
              type: Schema.Types.ObjectId,
              ref: "User",
              required: true,
            },
            date: { type: Date, required: true },
            reason: { type: String, required: true, trim: true },
            assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
            assignedAt: { type: Date, required: true, default: Date.now },
            status: { type: String, enum: ["active", "cancelled"], default: "active" },
            cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
            cancelledAt: { type: Date },
            cancellationReason: { type: String, trim: true },
          },
          { _id: true },
        ),
      ],
      default: [],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

TimetableSchema.index(
  { academicYear: 1, semesterType: 1, departmentId: 1, semester: 1, section: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
    name: "uniq_active_class_timetable",
  },
);
TimetableSchema.index(
  { sectionId: 1, semesterType: 1 },
  {
    unique: true,
    partialFilterExpression: { sectionId: { $exists: true }, isActive: true },
    name: "uniq_active_section_timetable",
  },
);

// Apply audit plugin (soft delete + createdBy/updatedBy)
TimetableSlotSchema.plugin(auditPlugin);

export const TimetableModel = model<ITimetable>("Timetable", TimetableSchema);

import { auditPlugin } from "../plugins/audit.plugin";
import mongoose, { type Document, Schema, type Types } from "mongoose";

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum AttendanceStatus {
  PRESENT = "P",
  ABSENT = "A",
  LATE = "L", // Late arrival
  MEDICAL = "M", // Medical leave
  OD = "OD", // On Duty
  HOLIDAY = "H",
}

export enum ClassType {
  LECTURE = "Lecture",
  TUTORIAL = "Tutorial",
  PRACTICAL = "Practical",
  EXTRA = "Extra Class",
}

// ─── Daily Attendance (one record per class session) ─────────────────────────

export interface IAttendanceRecord extends Document {
  _id: Types.ObjectId;
  sectionId?: Types.ObjectId;
  timetableId?: Types.ObjectId;
  timetableSlotId?: Types.ObjectId;
  subjectId: Types.ObjectId;
  subjectCode: string;
  subjectName: string;
  facultyId: Types.ObjectId;
  departmentId: Types.ObjectId;
  classType: ClassType;
  program: string;
  branch: string;
  semester: number;
  section: string;
  academicYear: string;
  date: Date;
  startTime: string;
  endTime: string;
  periodNumber: number;
  entries: Array<{
    studentId: Types.ObjectId;
    rollNumber: string;
    status: AttendanceStatus;
    remarks?: string;
  }>;
  totalPresent: number;
  totalAbsent: number;
  totalStrength: number;
  isLocked: boolean; // Locked after 24h
  lockedAt?: Date;
  correctionRequests?: Array<{
    studentId: Types.ObjectId;
    requestedStatus: AttendanceStatus;
    reason: string;
    requestedBy: Types.ObjectId;
    status: "pending" | "approved" | "rejected";
    createdAt: Date;
    approvedBy?: Types.ObjectId;
    approvedAt?: Date;
    reviewRemarks?: string;
  }>;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceEntrySchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rollNumber: { type: String, required: true },
    status: { type: String, enum: Object.values(AttendanceStatus), required: true },
    remarks: { type: String },
  },
  { _id: false },
);

const CorrectionRequestSchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    requestedStatus: { type: String, enum: Object.values(AttendanceStatus), required: true },
    reason: { type: String, required: true, trim: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    createdAt: { type: Date, default: Date.now },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    reviewRemarks: { type: String, trim: true },
  },
  { _id: false },
);

const AttendanceRecordSchema = new Schema<IAttendanceRecord>(
  {
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    sectionId: { type: Schema.Types.ObjectId, ref: "Section" },
    timetableId: { type: Schema.Types.ObjectId, ref: "Timetable" },
    timetableSlotId: { type: Schema.Types.ObjectId },
    subjectCode: { type: String, required: true },
    subjectName: { type: String, required: true },
    facultyId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    classType: { type: String, enum: Object.values(ClassType), default: ClassType.LECTURE },
    program: { type: String, required: true },
    branch: { type: String, required: true },
    semester: { type: Number, required: true, min: 1, max: 8 },
    section: { type: String, default: "" },
    academicYear: { type: String, required: true },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    periodNumber: { type: Number, min: 1, max: 8 },
    entries: { type: [AttendanceEntrySchema], default: [] },
    totalPresent: { type: Number, default: 0 },
    totalAbsent: { type: Number, default: 0 },
    totalStrength: { type: Number, default: 0 },
    isLocked: { type: Boolean, default: false },
    lockedAt: { type: Date },
    correctionRequests: { type: [CorrectionRequestSchema], default: [] },
  },
  { timestamps: true },
);

AttendanceRecordSchema.index({ subjectId: 1, date: 1 });
AttendanceRecordSchema.index({ sectionId: 1, date: 1 });
AttendanceRecordSchema.index({ facultyId: 1, date: 1 });
AttendanceRecordSchema.index({ branch: 1, semester: 1, academicYear: 1 });
// Prevent duplicate attendance for same subject+date+period
AttendanceRecordSchema.index(
  { timetableSlotId: 1, date: 1 },
  { unique: true, partialFilterExpression: { timetableSlotId: { $exists: true } } },
);
AttendanceRecordSchema.index(
  { subjectId: 1, date: 1, periodNumber: 1, section: 1 },
  { unique: true, partialFilterExpression: { timetableSlotId: { $exists: false } } },
);
AttendanceRecordSchema.index(
  { sectionId: 1, subjectId: 1, date: 1, periodNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sectionId: { $exists: true },
      timetableSlotId: { $exists: false },
    },
  },
);
// FIX: Index on embedded studentId so "find all records where student X was
// present/absent" doesn't require a full collection scan.
AttendanceRecordSchema.index({ "entries.studentId": 1, date: 1 });
AttendanceRecordSchema.index({ "entries.studentId": 1, subjectId: 1, academicYear: 1 });
AttendanceRecordSchema.index({ "correctionRequests.status": 1, date: -1 });

AttendanceRecordSchema.pre("save", async function () {
  const present = this.entries.filter(
    (e) =>
      e.status === AttendanceStatus.PRESENT ||
      e.status === AttendanceStatus.LATE ||
      e.status === AttendanceStatus.OD,
  ).length;
  this.totalPresent = present;
  this.totalAbsent = this.entries.length - present;
  this.totalStrength = this.entries.length;
});

AttendanceRecordSchema.plugin(auditPlugin);

export const AttendanceRecordModel = mongoose.model<IAttendanceRecord>(
  "AttendanceRecord",
  AttendanceRecordSchema,
);

// ─── Student Attendance Summary (denormalised — updated per session) ──────────

export interface IStudentAttendanceSummary extends Document {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  rollNumber: string;
  subjectId: Types.ObjectId;
  subjectCode: string;
  semester: number;
  academicYear: string;
  totalClasses: number;
  attended: number;
  absent: number;
  late: number;
  onDuty: number;
  medicalLeave: number;
  percentage: number;
  isShortage: boolean;
  lastUpdated: Date;
  lastShortageAlertAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StudentAttendanceSummarySchema = new Schema<IStudentAttendanceSummary>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rollNumber: { type: String, required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    subjectCode: { type: String, required: true },
    semester: { type: Number, required: true },
    academicYear: { type: String, required: true },
    totalClasses: { type: Number, default: 0 },
    attended: { type: Number, default: 0 },
    absent: { type: Number, default: 0 },
    late: { type: Number, default: 0 },
    onDuty: { type: Number, default: 0 },
    medicalLeave: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    isShortage: { type: Boolean, default: false },
    lastUpdated: { type: Date, default: Date.now },
    lastShortageAlertAt: { type: Date },
  },
  { timestamps: true },
);

StudentAttendanceSummarySchema.index(
  { studentId: 1, subjectId: 1, academicYear: 1 },
  { unique: true },
);
StudentAttendanceSummarySchema.index({ rollNumber: 1, semester: 1, academicYear: 1 });
StudentAttendanceSummarySchema.index({ isShortage: 1 });

export const StudentAttendanceSummaryModel = mongoose.model<IStudentAttendanceSummary>(
  "StudentAttendanceSummary",
  StudentAttendanceSummarySchema,
);

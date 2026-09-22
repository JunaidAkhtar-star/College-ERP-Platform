/**
 * Training Session Model
 *
 * Manages all T&P training activities:
 *   - Aptitude & Reasoning sessions
 *   - Technical skill workshops
 *   - Soft skills & communication
 *   - Mock interviews (individual or group)
 *   - Resume building workshops
 *   - Group discussions
 *   - Industry expert sessions / webinars
 */
import mongoose, { Schema, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export enum TrainingType {
  APTITUDE = "Aptitude & Reasoning",
  TECHNICAL = "Technical Skills",
  SOFT_SKILLS = "Soft Skills",
  MOCK_INTERVIEW = "Mock Interview",
  GROUP_DISCUSSION = "Group Discussion",
  RESUME_WORKSHOP = "Resume Building Workshop",
  INDUSTRY_TALK = "Industry Expert Talk",
  WEBINAR = "Webinar",
  CODING_CONTEST = "Coding Contest",
  WORKSHOP = "Workshop",
  ORIENTATION = "Placement Orientation",
}

export enum TrainingMode {
  OFFLINE = "Offline",
  ONLINE = "Online",
  HYBRID = "Hybrid",
}

export enum TrainingSessionStatus {
  DRAFT = "draft",
  SCHEDULED = "scheduled",
  ONGOING = "ongoing",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  POSTPONED = "postponed",
}

export interface IAttendanceEntry {
  studentId: Types.ObjectId;
  rollNumber: string;
  status: "present" | "absent" | "late";
  score?: number; // For mock interviews / tests
  feedback?: string; // Trainer feedback on the student
}

export interface ITrainingSession extends Document {
  _id: Types.ObjectId;
  title: string;
  type: TrainingType;
  mode: TrainingMode;
  description?: string;
  facilitator: string; // Trainer / speaker name
  facilitatorOrg?: string; // Company / institution
  facilitatorEmail?: string;

  targetPrograms: string[];
  targetBranches: string[];
  targetBatches: string[];
  targetSemesters?: number[];

  scheduledDate: Date;
  registrationStart: Date;
  registrationEnd: Date;
  startTime: string; // "10:00"
  endTime: string; // "12:00"
  duration: number; // Minutes
  venue: string;
  meetingLink?: string; // For online sessions

  maxParticipants?: number;
  registeredStudents: Types.ObjectId[];

  // Attendance (filled after session)
  attendanceMarked: boolean;
  attendance: IAttendanceEntry[];
  totalPresent: number;
  totalAbsent: number;

  // Resources
  materialUrl?: string; // Slides / notes
  recordingUrl?: string; // Session recording
  assignmentGiven?: string; // Post-session task

  status: TrainingSessionStatus;
  cancellationReason?: string;
  postponedTo?: Date;

  // Feedback
  averageRating?: number; // Student ratings (0–5)
  feedbackCount: number;
  attendanceVerified: boolean;
  attendanceMarkedBy?: Types.ObjectId;
  attendanceMarkedAt?: Date;

  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceEntrySchema = new Schema<IAttendanceEntry>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rollNumber: { type: String, required: true },
    status: { type: String, enum: ["present", "absent", "late"], default: "absent" },
    score: { type: Number, min: 0, max: 100 },
    feedback: { type: String },
  },
  { _id: false },
);

const TrainingSessionSchema = new Schema<ITrainingSession>(
  {
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: Object.values(TrainingType), required: true },
    mode: { type: String, enum: Object.values(TrainingMode), default: TrainingMode.OFFLINE },
    description: { type: String },
    facilitator: { type: String, required: true, trim: true },
    facilitatorOrg: { type: String, trim: true },
    facilitatorEmail: { type: String, trim: true, lowercase: true },

    targetPrograms: [{ type: String }],
    targetBranches: [{ type: String }],
    targetBatches: [{ type: String }],
    targetSemesters: [{ type: Number }],

    scheduledDate: { type: Date, required: true },
    registrationStart: { type: Date, required: true },
    registrationEnd: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    duration: { type: Number, required: true, min: 15 },
    venue: { type: String, required: true, trim: true },
    meetingLink: { type: String },

    maxParticipants: { type: Number, min: 1 },
    registeredStudents: [{ type: Schema.Types.ObjectId, ref: "User" }],

    attendanceMarked: { type: Boolean, default: false },
    attendance: { type: [AttendanceEntrySchema], default: [] },
    totalPresent: { type: Number, default: 0 },
    totalAbsent: { type: Number, default: 0 },

    materialUrl: { type: String },
    recordingUrl: { type: String },
    assignmentGiven: { type: String },

    status: {
      type: String,
      enum: Object.values(TrainingSessionStatus),
      default: TrainingSessionStatus.DRAFT,
      index: true,
    },
    cancellationReason: { type: String },
    postponedTo: { type: Date },

    averageRating: { type: Number, min: 0, max: 5 },
    feedbackCount: { type: Number, default: 0 },
    attendanceVerified: { type: Boolean, default: false, index: true },
    attendanceMarkedBy: { type: Schema.Types.ObjectId, ref: "User" },
    attendanceMarkedAt: { type: Date },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

TrainingSessionSchema.index({ scheduledDate: -1 });
TrainingSessionSchema.index({ type: 1, status: 1 });
TrainingSessionSchema.index({ targetBatches: 1, status: 1 });

TrainingSessionSchema.plugin(auditPlugin);

export const TrainingSessionModel = mongoose.model<ITrainingSession>(
  "TrainingSession",
  TrainingSessionSchema,
);

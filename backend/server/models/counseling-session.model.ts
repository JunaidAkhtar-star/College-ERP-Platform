import { auditPlugin } from "../plugins/audit.plugin";
import type { Document, Types } from "mongoose";
import mongoose, { Schema } from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

export enum CounselingType {
  ACADEMIC = "academic", // Academic performance / backlog counseling
  PERSONAL = "personal", // Personal issues
  CAREER = "career", // Career guidance
  DISCIPLINARY = "disciplinary",
  MEDICAL = "medical",
  FINANCIAL = "financial",
}

export enum CounselingStatus {
  SCHEDULED = "scheduled",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  FOLLOW_UP_REQUIRED = "follow_up_required",
  PARENT_MEETING_REQUIRED = "parent_meeting_required",
}

// ─────────────────────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface IFollowUpAction {
  action: string;
  dueDate?: Date;
  completedAt?: Date;
  isCompleted: boolean;
}

export interface ICounselingSession extends Document {
  _id: Types.ObjectId;
  sessionNumber: string; // System-generated, e.g., "COUN-2026-00045"

  // ── Participants ──────────────────────────────────────────────────────────
  student: Types.ObjectId;
  counselor: Types.ObjectId; // Faculty/Mentor who conducted the session

  // ── Session details ───────────────────────────────────────────────────────
  type: CounselingType;
  scheduledAt: Date;
  conductedAt?: Date;
  durationMinutes?: number;
  mode: "in_person" | "online" | "phone";
  venue?: string;

  // ── Content ───────────────────────────────────────────────────────────────
  /** Problem statement / issue raised — visible to counselor and HOD. */
  issueDescription: string;
  /**
   * Counselor notes — restricted visibility.
   * Only the counselor, HOD, and Principal can view these.
   */
  counselorNotes?: string;
  /** Action items agreed during the session. */
  followUpActions: IFollowUpAction[];

  // ── Parent involvement ────────────────────────────────────────────────────
  parentMeetingRequired: boolean;
  parentMeetingDate?: Date;
  parentMeetingNotes?: string;
  parentNotified: boolean;
  parentNotifiedAt?: Date;

  // ── Outcome ───────────────────────────────────────────────────────────────
  status: CounselingStatus;
  outcome?: string;
  nextSessionDate?: Date;

  // ── Meta ──────────────────────────────────────────────────────────────────
  academicYear: string;
  semester?: number;
  attachments?: Types.ObjectId[]; // Document model references

  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const followUpActionSchema = new Schema<IFollowUpAction>(
  {
    action: { type: String, required: true },
    dueDate: { type: Date },
    completedAt: { type: Date },
    isCompleted: { type: Boolean, default: false },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// Main schema
// ─────────────────────────────────────────────────────────────────────────────

const counselingSessionSchema = new Schema<ICounselingSession>(
  {
    sessionNumber: { type: String, required: true, unique: true, index: true },

    student: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    counselor: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    type: { type: String, enum: Object.values(CounselingType), required: true },
    scheduledAt: { type: Date, required: true },
    conductedAt: { type: Date },
    durationMinutes: { type: Number, min: 0 },
    mode: { type: String, enum: ["in_person", "online", "phone"], default: "in_person" },
    venue: { type: String, trim: true },

    issueDescription: { type: String, required: true },
    counselorNotes: { type: String, select: false },
    followUpActions: { type: [followUpActionSchema], default: [] },

    parentMeetingRequired: { type: Boolean, default: false },
    parentMeetingDate: { type: Date },
    parentMeetingNotes: { type: String },
    parentNotified: { type: Boolean, default: false },
    parentNotifiedAt: { type: Date },

    status: {
      type: String,
      enum: Object.values(CounselingStatus),
      default: CounselingStatus.SCHEDULED,
      index: true,
    },
    outcome: { type: String },
    nextSessionDate: { type: Date },

    academicYear: { type: String, required: true, index: true },
    semester: { type: Number, min: 1, max: 8 },
    attachments: [{ type: Schema.Types.ObjectId, ref: "Document" }],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_d, ret: Record<string, unknown>) => {
        delete ret["__v"];
      },
    },
  },
);

counselingSessionSchema.index({ student: 1, academicYear: 1 });
counselingSessionSchema.index({ counselor: 1, scheduledAt: -1 });
counselingSessionSchema.index({ status: 1, academicYear: 1 });

counselingSessionSchema.plugin(auditPlugin);

export const CounselingSessionModel = mongoose.model<ICounselingSession>(
  "CounselingSession",
  counselingSessionSchema,
);

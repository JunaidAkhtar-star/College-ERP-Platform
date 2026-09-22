import { Schema, model, type Types, type Document } from "mongoose";
import { randomBytes } from "node:crypto";
import { auditPlugin } from "../plugins/audit.plugin";

const createMeetingCode = () => {
  const alphabet = "abcdefghjkmnpqrstuvwxyz";
  const bytes = randomBytes(10);
  const value = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`;
};

export type MeetingType = "faculty" | "student";
export type MeetingMode = "physical" | "online" | "hybrid";
export type MeetingStatus = "scheduled" | "ongoing" | "completed" | "cancelled";
export type MeetingRecurrence = "none" | "daily" | "weekly" | "monthly";

export interface IMeetingAttendee {
  userId: Types.ObjectId;
  attended: boolean;
  joinedAt?: Date;
  leftAt?: Date;
  durationSeconds?: number;
  attendancePercentage?: number;
}

export interface IMeeting extends Document {
  title: string;
  meetingCode?: string;
  meetingType: MeetingType;
  agenda: string;
  scheduledAt: Date;
  durationMinutes?: number;
  durationSpecified?: boolean;
  mode: MeetingMode;
  venue?: string;
  meetingLink?: string;
  conductedBy: Types.ObjectId;
  department?: Types.ObjectId; // HoD's dept, or principal's optional filter
  // Faculty-meeting specific
  invitees: Types.ObjectId[]; // selected faculty members
  // Student-meeting specific
  targetDepartments: Types.ObjectId[];
  targetYears: number[]; // e.g. [1, 2, 3]
  // Post-meeting
  status: MeetingStatus;
  startedAt?: Date;
  endedAt?: Date;
  concludingRemarks?: string;
  concludingRemarksSubmittedAt?: Date;
  minutesStatus: "not_submitted" | "pending_approval" | "approved" | "rejected";
  minutesSubmittedBy?: Types.ObjectId;
  minutesReviewedBy?: Types.ObjectId;
  minutesReviewedAt?: Date;
  minutesReviewNote?: string;
  recordingConsentRequired: boolean;
  recordingConsentUserIds: Types.ObjectId[];
  attendees: IMeetingAttendee[];
  coHostIds: Types.ObjectId[];
  blockedUserIds: Types.ObjectId[];
  isLocked: boolean;
  allowParticipantScreenShare: boolean;
  recurrence: MeetingRecurrence;
  recurrenceGroupId?: Types.ObjectId;
  occurrenceNumber: number;
  notifiedAt?: Date;
  reminderSent10m?: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MeetingAttendeeSchema = new Schema<IMeetingAttendee>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    attended: { type: Boolean, default: false },
    joinedAt: { type: Date },
    leftAt: { type: Date },
    durationSeconds: { type: Number, min: 0, default: 0 },
    attendancePercentage: { type: Number, min: 0, max: 100, default: 0 },
  },
  { _id: false },
);

const MeetingSchema = new Schema<IMeeting>(
  {
    title: { type: String, required: true, trim: true },
    meetingCode: {
      type: String,
      default: createMeetingCode,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/,
      index: true,
    },
    meetingType: {
      type: String,
      enum: ["faculty", "student"] satisfies MeetingType[],
      required: true,
      index: true,
    },
    agenda: { type: String, required: true },
    scheduledAt: { type: Date, required: true, index: true },
    durationMinutes: { type: Number, min: 1 },
    durationSpecified: { type: Boolean, default: false },
    mode: {
      type: String,
      enum: ["physical", "online", "hybrid"] satisfies MeetingMode[],
      required: true,
    },
    venue: { type: String, trim: true },
    meetingLink: { type: String, trim: true },
    conductedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    department: { type: Schema.Types.ObjectId, ref: "Department", index: true },
    // Faculty-meeting
    invitees: [{ type: Schema.Types.ObjectId, ref: "User" }],
    // Student-meeting
    targetDepartments: [{ type: Schema.Types.ObjectId, ref: "Department" }],
    targetYears: [{ type: Number, min: 1, max: 6 }],
    // Post-meeting
    status: {
      type: String,
      enum: ["scheduled", "ongoing", "completed", "cancelled"] satisfies MeetingStatus[],
      default: "scheduled",
      index: true,
    },
    startedAt: { type: Date },
    endedAt: { type: Date },
    concludingRemarks: { type: String },
    concludingRemarksSubmittedAt: { type: Date },
    minutesStatus: {
      type: String,
      enum: ["not_submitted", "pending_approval", "approved", "rejected"],
      default: "not_submitted",
      index: true,
    },
    minutesSubmittedBy: { type: Schema.Types.ObjectId, ref: "User" },
    minutesReviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    minutesReviewedAt: Date,
    minutesReviewNote: { type: String, trim: true, maxlength: 2000 },
    recordingConsentRequired: { type: Boolean, default: true },
    recordingConsentUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    attendees: [MeetingAttendeeSchema],
    coHostIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    blockedUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    isLocked: { type: Boolean, default: false },
    allowParticipantScreenShare: { type: Boolean, default: true },
    recurrence: { type: String, enum: ["none", "daily", "weekly", "monthly"], default: "none" },
    recurrenceGroupId: { type: Schema.Types.ObjectId, index: true },
    occurrenceNumber: { type: Number, min: 1, default: 1 },
    notifiedAt: { type: Date },
    reminderSent10m: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

MeetingSchema.index({ scheduledAt: -1, status: 1 });
MeetingSchema.index({ status: 1, isDeleted: 1, endedAt: 1, scheduledAt: 1 });
MeetingSchema.index({ meetingType: 1, targetDepartments: 1, targetYears: 1, scheduledAt: 1 });
MeetingSchema.index({ invitees: 1, status: 1, scheduledAt: 1 });
MeetingSchema.index({ conductedBy: 1, status: 1, scheduledAt: 1 });
MeetingSchema.index({ createdBy: 1, status: 1, scheduledAt: 1 });

MeetingSchema.plugin(auditPlugin);

export const MeetingModel = model<IMeeting>("Meeting", MeetingSchema);

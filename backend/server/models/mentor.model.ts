import { auditPlugin } from "../plugins/audit.plugin";
import type { Types, Document } from "mongoose";
import { Schema, model } from "mongoose";

export interface IMentorMeeting {
  studentId: Types.ObjectId;
  date: Date;
  type: "academic" | "personal" | "parent" | "career" | "disciplinary";
  agenda: string;
  notes: string;
  nextActionDate?: Date;
  nextAction?: string;
  parentPresent: boolean;
  conductedBy: Types.ObjectId;
}

export interface IMentor extends Document {
  facultyId: Types.ObjectId;
  departmentId: Types.ObjectId;
  academicYear: string;
  menteeIds: Types.ObjectId[]; // Student IDs
  maxMentees: number;
  meetings: IMentorMeeting[];
  totalMeetings: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MeetingSchema = new Schema<IMentorMeeting>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },
    type: {
      type: String,
      enum: ["academic", "personal", "parent", "career", "disciplinary"],
      required: true,
    },
    agenda: { type: String, required: true, trim: true },
    notes: { type: String, required: true, trim: true },
    nextActionDate: { type: Date },
    nextAction: { type: String, trim: true },
    parentPresent: { type: Boolean, default: false },
    conductedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: true },
);

const MentorSchema = new Schema<IMentor>(
  {
    facultyId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    academicYear: { type: String, required: true, trim: true },
    menteeIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    maxMentees: { type: Number, default: 20, min: 1 },
    meetings: [MeetingSchema],
    totalMeetings: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

MentorSchema.index({ facultyId: 1, academicYear: 1 }, { unique: true });

// Apply audit plugin (soft delete + createdBy/updatedBy)
MeetingSchema.plugin(auditPlugin);

export const MentorModel = model<IMentor>("Mentor", MentorSchema);

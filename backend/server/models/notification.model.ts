import { auditPlugin } from "../plugins/audit.plugin";
import type { Document } from "mongoose";
import mongoose, { Schema, Types } from "mongoose";

export enum NotificationType {
  INFO = "Info",
  SUCCESS = "Success",
  WARNING = "Warning",
  ALERT = "Alert",
  FEE_REMINDER = "Fee Reminder",
  ATTENDANCE = "Attendance",
  RESULT = "Result",
  EXAM = "Exam",
  ADMISSION = "Admission",
  PLACEMENT = "Placement",
  GENERAL = "General",
  HOLIDAY = "Holiday",
  SYSTEM = "System",
  LEAVE = "Leave",
  ASSIGNMENT = "Assignment",
  LESSON_PLAN = "Lesson Plan",
  SEMESTER_REGISTRATION = "Semester Registration",
  LIBRARY = "Library",
  HOSTEL = "Hostel",
  GRIEVANCE = "Grievance",
  COUNSELING = "Counseling",
  NOTICE = "Notice",
  WORKLOAD = "Workload",
}

export enum NotificationChannel {
  IN_APP = "In-App",
  EMAIL = "Email",
  PUSH = "Push",
}

export enum NotificationAudience {
  ALL = "All",
  STUDENTS = "Students",
  FACULTY = "Faculty",
  PARENTS = "Parents",
  SPECIFIC_DEPT = "Specific Department",
  SPECIFIC_BATCH = "Specific Batch",
  SPECIFIC_USER = "Specific User",
  ADMIN = "Admin",
}

export interface INotification extends Document {
  _id: Types.ObjectId;
  title: string;
  body: string;
  type: NotificationType;
  channels: NotificationChannel[];
  audience: NotificationAudience;
  // Scope filters
  targetDepartments?: string[];
  targetPrograms?: string[];
  targetSemesters?: number[];
  targetBatches?: string[];
  targetUserIds?: Types.ObjectId[];
  // Delivery
  isScheduled: boolean;
  scheduledAt?: Date;
  sentAt?: Date;
  isSent: boolean;
  // Attachment
  attachmentUrl?: string;
  actionUrl?: string;
  // Sender — ObjectId for real users, or the sentinel string "system" for
  // notifications produced by cron jobs, schedulers, and other unattended flows.
  createdBy: Types.ObjectId | "system";
  createdByName: string;
  // Per-user read receipts (only for in-app)
  readBy: Array<{ userId: Types.ObjectId; readAt: Date }>;
  totalRead: number;
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 5000 },
    type: { type: String, enum: Object.values(NotificationType), required: true },
    channels: {
      type: [String],
      enum: Object.values(NotificationChannel),
      default: [NotificationChannel.IN_APP],
    },
    audience: { type: String, enum: Object.values(NotificationAudience), required: true },
    targetDepartments: [String],
    targetPrograms: [String],
    targetSemesters: [Number],
    targetBatches: [String],
    targetUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    isScheduled: { type: Boolean, default: false },
    scheduledAt: { type: Date },
    sentAt: { type: Date },
    isSent: { type: Boolean, default: false },
    attachmentUrl: { type: String },
    actionUrl: { type: String },
    createdBy: {
      type: Schema.Types.Mixed,
      required: true,
      validate: {
        validator: (v: unknown) =>
          v === "system" ||
          (typeof v === "string" && /^[a-f0-9]{24}$/i.test(v)) ||
          v instanceof Types.ObjectId,
        message: 'createdBy must be a User ObjectId or the literal "system"',
      },
    },
    createdByName: { type: String, required: true },
    readBy: [{ userId: { type: Schema.Types.ObjectId, ref: "User" }, readAt: Date }],
    totalRead: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date },
  },
  { timestamps: true },
);

NotificationSchema.index({ audience: 1, isSent: 1 });
NotificationSchema.index({ targetUserIds: 1 });
NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ isActive: 1, expiresAt: 1 });
// Hot path: "unread notifications for this user, newest first" — used by the
// offline-flush on socket connect and the bell-dropdown SWR.
NotificationSchema.index({ targetUserIds: 1, isActive: 1, createdAt: -1 });

NotificationSchema.plugin(auditPlugin);

export const NotificationModel = mongoose.model<INotification>("Notification", NotificationSchema);

import { auditPlugin } from "../plugins/audit.plugin";
import mongoose, { Schema, type Document, type Types } from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

export enum GrievanceType {
  ACADEMIC = "academic", // Marks, results, attendance discrepancy
  EXAMINATION = "examination", // Hall ticket, seating, paper issues
  FACULTY = "faculty", // Complaint against faculty behaviour
  FACILITY = "facility", // Classroom, lab, infrastructure
  HOSTEL = "hostel", // Hostel-related grievance
  TRANSPORT = "transport", // Bus/route issues
  FEE = "fee", // Fee discrepancy or overcharge
  SCHOLARSHIP = "scholarship", // Scholarship disbursement issues
  LIBRARY = "library",
  RAGGING = "ragging", // Anti-ragging — routed directly to Principal
  HARASSMENT = "harassment",
  OTHER = "other",
}

export enum GrievancePriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent", // Ragging / harassment always URGENT
}

export enum GrievanceStatus {
  SUBMITTED = "submitted",
  ACKNOWLEDGED = "acknowledged",
  UNDER_REVIEW = "under_review",
  REFERRED = "referred", // Referred to another department / authority
  RESOLVED = "resolved",
  CLOSED = "closed",
  REJECTED = "rejected",
  REOPENED = "reopened",
}

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface IGrievanceTimelineEntry {
  status: GrievanceStatus;
  note: string;
  updatedBy?: Types.ObjectId;
  updatedByName?: string;
  updatedAt: Date;
}

export interface IGrievance extends Document {
  _id: Types.ObjectId;

  // Who filed it
  studentId: Types.ObjectId; // User._id of the student
  studentName: string;
  rollNumber: string;
  program: string;
  branch: string;
  semester: number;
  departmentId?: Types.ObjectId;

  // Grievance content
  type: GrievanceType;
  priority: GrievancePriority;
  title: string;
  description: string;
  attachments?: string[]; // Cloudinary URLs

  // Target (optional — faculty / subject / etc.)
  targetUserId?: Types.ObjectId;
  targetName?: string;

  // Status tracking
  status: GrievanceStatus;
  timeline: IGrievanceTimelineEntry[];

  // Response from authority
  response?: string;
  respondedBy?: Types.ObjectId;
  respondedAt?: Date;

  // Escalation
  isEscalated: boolean;
  escalatedTo?: Types.ObjectId;
  escalatedAt?: Date;
  responseDueAt: Date;
  resolutionDueAt: Date;
  confidentiality: "standard" | "restricted";
  appealCount: number;
  lastAppealedAt?: Date;
  appealReason?: string;

  // Resolution
  resolvedAt?: Date;
  satisfactionRating?: number; // 1–5 from student after resolution
  satisfactionFeedback?: string;

  // Reference number shown to student
  referenceNumber: string;

  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const TimelineEntrySchema = new Schema<IGrievanceTimelineEntry>(
  {
    status: { type: String, enum: Object.values(GrievanceStatus), required: true },
    note: { type: String, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedByName: { type: String },
    updatedAt: { type: Date, required: true },
  },
  { _id: true },
);

// ─────────────────────────────────────────────────────────────────────────────
// Main schema
// ─────────────────────────────────────────────────────────────────────────────

const GrievanceSchema = new Schema<IGrievance>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    studentName: { type: String, required: true, trim: true },
    rollNumber: { type: String, required: true, trim: true },
    program: { type: String, required: true },
    branch: { type: String, required: true },
    semester: { type: Number, required: true, min: 1, max: 10 },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },

    type: { type: String, enum: Object.values(GrievanceType), required: true },
    priority: {
      type: String,
      enum: Object.values(GrievancePriority),
      default: GrievancePriority.MEDIUM,
    },
    title: { type: String, required: true, trim: true, maxlength: 255 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    attachments: [{ type: String }],

    targetUserId: { type: Schema.Types.ObjectId, ref: "User" },
    targetName: { type: String, trim: true },

    status: {
      type: String,
      enum: Object.values(GrievanceStatus),
      default: GrievanceStatus.SUBMITTED,
    },
    timeline: { type: [TimelineEntrySchema], default: [] },

    response: { type: String, trim: true },
    respondedBy: { type: Schema.Types.ObjectId, ref: "User" },
    respondedAt: { type: Date },

    isEscalated: { type: Boolean, default: false },
    escalatedTo: { type: Schema.Types.ObjectId, ref: "User" },
    escalatedAt: { type: Date },
    responseDueAt: { type: Date, required: true, index: true },
    resolutionDueAt: { type: Date, required: true, index: true },
    confidentiality: {
      type: String,
      enum: ["standard", "restricted"],
      default: "standard",
      index: true,
    },
    appealCount: { type: Number, default: 0, min: 0, max: 3 },
    lastAppealedAt: Date,
    appealReason: { type: String, trim: true, maxlength: 2000 },

    resolvedAt: { type: Date },
    satisfactionRating: { type: Number, min: 1, max: 5 },
    satisfactionFeedback: { type: String, trim: true },

    referenceNumber: { type: String, required: true, unique: true, trim: true },
  },
  { timestamps: true },
);

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

GrievanceSchema.index({ status: 1, type: 1 });
GrievanceSchema.index({ departmentId: 1, status: 1 });
GrievanceSchema.index({ priority: 1, status: 1 });
GrievanceSchema.index({ createdAt: -1 });

// Soft delete + createdBy/updatedBy
GrievanceSchema.plugin(auditPlugin);
GrievanceSchema.path("createdBy").required(true);

export const GrievanceModel = mongoose.model<IGrievance>("Grievance", GrievanceSchema);

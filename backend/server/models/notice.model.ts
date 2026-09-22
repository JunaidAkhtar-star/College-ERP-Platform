import { auditPlugin } from "../plugins/audit.plugin";
import { Schema, model, type Types, type Document } from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
// FIX: readBy[] removed from Notice document.
// A separate NoticeRead collection tracks who read what, avoiding unbounded
// array growth (e.g. 2000 students reading a global notice = 2000 ObjectIds
// embedded in one document → document bloat + write conflicts).
// ─────────────────────────────────────────────────────────────────────────────

// ── NoticeRead (one doc per user-notice read event) ─────────────────────────
export interface INoticeRead extends Document {
  noticeId: Types.ObjectId;
  userId: Types.ObjectId;
  readAt: Date;
}

const NoticeReadSchema = new Schema<INoticeRead>(
  {
    noticeId: { type: Schema.Types.ObjectId, ref: "Notice", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    readAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

NoticeReadSchema.index({ noticeId: 1, userId: 1 }, { unique: true }); // one read per user per notice
NoticeReadSchema.index({ userId: 1, noticeId: 1 }); // "get all notices I read"

export const NoticeReadModel = model<INoticeRead>("NoticeRead", NoticeReadSchema);

// ── Notice ───────────────────────────────────────────────────────────────────
export interface INotice extends Document {
  title: string;
  content: string;
  noticeType: "global" | "department" | "role_based" | "program";
  targetDepartments?: Types.ObjectId[];
  targetRoles?: string[];
  targetPrograms?: string[];
  attachments?: { fileName: string; fileUrl: string; fileSize: number }[];
  priority: "low" | "normal" | "high" | "urgent";
  expiryDate?: Date;
  isPublished: boolean;
  publishedAt?: Date;
  publishedBy?: Types.ObjectId;
  // readBy[] removed — query NoticeRead.countDocuments({ noticeId }) for count
  // and NoticeRead.findOne({ noticeId, userId }) to check if a user read it
  readCount: number; // denormalised counter (increment on NoticeRead insert)
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const NoticeSchema = new Schema<INotice>(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    noticeType: {
      type: String,
      enum: ["global", "department", "role_based", "program"],
      required: true,
    },
    targetDepartments: [{ type: Schema.Types.ObjectId, ref: "Department" }],
    targetRoles: [{ type: String }],
    targetPrograms: [{ type: String }],
    attachments: [
      {
        fileName: { type: String },
        fileUrl: { type: String },
        fileSize: { type: Number },
      },
    ],
    priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal" },
    expiryDate: { type: Date },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date },
    publishedBy: { type: Schema.Types.ObjectId, ref: "User" },
    readCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

NoticeSchema.index({ isPublished: 1, expiryDate: 1 });
NoticeSchema.index({ noticeType: 1 });

// Apply audit plugin (soft delete + createdBy/updatedBy)
NoticeSchema.plugin(auditPlugin);

export const NoticeModel = model<INotice>("Notice", NoticeSchema);

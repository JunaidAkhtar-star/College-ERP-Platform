import { auditPlugin } from "../plugins/audit.plugin";
import type { Types, Document } from "mongoose";
import { Schema, model } from "mongoose";

export interface ITaskAttachment {
  url: string;
  publicId: string;
  name: string;
}

export interface ITaskComment {
  author: Types.ObjectId;
  authorName: string;
  message: string;
  createdAt: Date;
}

export interface ITask extends Document {
  title: string;
  description: string;
  assigner: Types.ObjectId; // User who created the task (Principal / HOD)
  assignees: Types.ObjectId[]; // Faculties / HODs assigned to the task
  status: "todo" | "in_progress" | "completed" | "approved";
  priority: "low" | "medium" | "high" | "critical";
  dueDate: Date;
  dependencyIds: Types.ObjectId[];
  sourceModule?: string;
  sourceRecordId?: string;
  recurrence?: {
    frequency: "daily" | "weekly" | "monthly";
    interval: number;
    endsAt?: Date;
  };
  escalatedAt?: Date;
  completionNote?: string;
  completionEvidence: ITaskAttachment[];
  completedAt?: Date;
  comments: ITaskComment[];
  notes?: string;
  feedback?: string;
  attachments?: ITaskAttachment[];
  createdAt: Date;
  updatedAt: Date;
}

const TaskAttachmentSchema = new Schema<ITaskAttachment>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    name: { type: String, required: true },
  },
  { _id: false },
);

const TaskCommentSchema = new Schema<ITaskComment>(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const TaskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 5000 },
    assigner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignees: [{ type: Schema.Types.ObjectId, ref: "User", required: true, index: true }],
    status: {
      type: String,
      enum: ["todo", "in_progress", "completed", "approved"],
      default: "todo",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
      index: true,
    },
    dueDate: { type: Date, required: true, index: true },
    dependencyIds: [{ type: Schema.Types.ObjectId, ref: "Task" }],
    sourceModule: { type: String, trim: true, maxlength: 100 },
    sourceRecordId: { type: String, trim: true, maxlength: 100 },
    recurrence: {
      frequency: { type: String, enum: ["daily", "weekly", "monthly"] },
      interval: { type: Number, min: 1, max: 365 },
      endsAt: Date,
    },
    escalatedAt: Date,
    completionNote: { type: String, trim: true, maxlength: 5000 },
    completionEvidence: { type: [TaskAttachmentSchema], default: [] },
    completedAt: Date,
    comments: { type: [TaskCommentSchema], default: [] },
    notes: { type: String, trim: true },
    feedback: { type: String, trim: true },
    attachments: [TaskAttachmentSchema],
  },
  { timestamps: true },
);

// Plugin for standard audit fields
TaskSchema.plugin(auditPlugin);
TaskSchema.index({ assignees: 1, status: 1, dueDate: 1 });
TaskSchema.index({ sourceModule: 1, sourceRecordId: 1 });

export const TaskModel = model<ITask>("Task", TaskSchema);

import mongoose, { Schema, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export interface ICommunicationTemplate extends Document {
  name: string;
  category: string;
  subject: string;
  body: string;
  channels: Array<"in_app" | "email" | "push" | "sms">;
  variables: string[];
  isActive: boolean;
  createdBy: Types.ObjectId;
}

export interface ICommunicationCampaign extends Document {
  title: string;
  body: string;
  channels: Array<"in_app" | "email" | "push" | "sms">;
  audience: "all" | "students" | "faculty" | "parents" | "admin" | "specific_users";
  targetDepartments: string[];
  targetPrograms: string[];
  targetSemesters: number[];
  targetUserIds: Types.ObjectId[];
  scheduledAt?: Date;
  status: "draft" | "scheduled" | "dispatching" | "sent" | "cancelled" | "failed";
  notificationId?: Types.ObjectId;
  recipientCount: number;
  priority: "normal" | "important" | "emergency";
  requireAcknowledgement: boolean;
  channelStats: Array<{
    channel: "in_app" | "email" | "push" | "sms";
    queued: number;
    accepted: number;
    delivered: number;
    failed: number;
    status: "pending" | "sent" | "unavailable" | "failed";
    message?: string;
  }>;
  createdBy: Types.ObjectId;
  sentAt?: Date;
  cancelledAt?: Date;
}

export interface ICommunicationSuppression extends Document {
  channel: "email" | "sms";
  destinationHash: string;
  reason: string;
  active: boolean;
  createdBy: Types.ObjectId;
  releasedBy?: Types.ObjectId;
  releasedAt?: Date;
}

const channelEnum = ["in_app", "email", "push", "sms"];
const CommunicationTemplateSchema = new Schema<ICommunicationTemplate>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, required: true, trim: true, maxlength: 80, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    channels: { type: [String], enum: channelEnum, required: true },
    variables: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
CommunicationTemplateSchema.index({ name: 1 }, { unique: true });
CommunicationTemplateSchema.plugin(auditPlugin);

const CommunicationCampaignSchema = new Schema<ICommunicationCampaign>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    channels: { type: [String], enum: channelEnum, required: true },
    audience: {
      type: String,
      enum: ["all", "students", "faculty", "parents", "admin", "specific_users"],
      required: true,
    },
    targetDepartments: { type: [String], default: [] },
    targetPrograms: { type: [String], default: [] },
    targetSemesters: { type: [Number], default: [] },
    targetUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    scheduledAt: Date,
    status: {
      type: String,
      enum: ["draft", "scheduled", "dispatching", "sent", "cancelled", "failed"],
      default: "draft",
      index: true,
    },
    notificationId: { type: Schema.Types.ObjectId, ref: "Notification", index: true },
    recipientCount: { type: Number, default: 0 },
    priority: {
      type: String,
      enum: ["normal", "important", "emergency"],
      default: "normal",
      index: true,
    },
    requireAcknowledgement: { type: Boolean, default: false },
    channelStats: {
      type: [
        new Schema(
          {
            channel: { type: String, enum: channelEnum, required: true },
            queued: { type: Number, default: 0 },
            accepted: { type: Number, default: 0 },
            delivered: { type: Number, default: 0 },
            failed: { type: Number, default: 0 },
            status: {
              type: String,
              enum: ["pending", "sent", "unavailable", "failed"],
              default: "pending",
            },
            message: String,
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sentAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true },
);
CommunicationCampaignSchema.index({ createdAt: -1 });
CommunicationCampaignSchema.plugin(auditPlugin);

const CommunicationSuppressionSchema = new Schema<ICommunicationSuppression>(
  {
    channel: { type: String, enum: ["email", "sms"], required: true },
    destinationHash: { type: String, required: true, minlength: 64, maxlength: 64 },
    reason: { type: String, required: true, trim: true, minlength: 10, maxlength: 1000 },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    releasedBy: { type: Schema.Types.ObjectId, ref: "User" },
    releasedAt: Date,
  },
  { timestamps: true },
);
CommunicationSuppressionSchema.index({ channel: 1, destinationHash: 1 }, { unique: true });
CommunicationSuppressionSchema.plugin(auditPlugin);

export const CommunicationTemplateModel = mongoose.model<ICommunicationTemplate>(
  "CommunicationTemplate",
  CommunicationTemplateSchema,
);
export const CommunicationCampaignModel = mongoose.model<ICommunicationCampaign>(
  "CommunicationCampaign",
  CommunicationCampaignSchema,
);
export const CommunicationSuppressionModel = mongoose.model<ICommunicationSuppression>(
  "CommunicationSuppression",
  CommunicationSuppressionSchema,
);

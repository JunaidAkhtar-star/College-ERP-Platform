import { auditPlugin } from "../plugins/audit.plugin";
import { Schema, model, type Types, type Document } from "mongoose";

export interface IEvent extends Document {
  title: string;
  description: string;
  eventType: "workshop" | "seminar" | "cultural" | "sports" | "technical" | "placement" | "other";
  startDate: Date;
  endDate: Date;
  venue: string;
  organizingDepartment?: Types.ObjectId;
  coordinators: Types.ObjectId[];
  targetAudience: string[]; // ["student", "faculty", "all"]
  maxRegistrations?: number;
  registrations: { userId: Types.ObjectId; registeredAt: Date; attended: boolean }[];
  registrationCount: number;
  attachments?: string[];
  isPublished: boolean;
  isCancelled: boolean;
  cancellationReason?: string;
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<IEvent>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    eventType: {
      type: String,
      enum: ["workshop", "seminar", "cultural", "sports", "technical", "placement", "other"],
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    venue: { type: String, required: true, trim: true },
    organizingDepartment: { type: Schema.Types.ObjectId, ref: "Department" },
    coordinators: [{ type: Schema.Types.ObjectId, ref: "User" }],
    targetAudience: [{ type: String }],
    maxRegistrations: { type: Number },
    registrations: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        registeredAt: { type: Date, default: Date.now },
        attended: { type: Boolean, default: false },
      },
    ],
    registrationCount: { type: Number, default: 0 },
    attachments: [{ type: String }],
    isPublished: { type: Boolean, default: false },
    isCancelled: { type: Boolean, default: false },
    cancellationReason: { type: String, trim: true, maxlength: 1000 },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

EventSchema.index({ startDate: -1 });
EventSchema.index({ eventType: 1, isPublished: 1 });

// Apply audit plugin (soft delete + createdBy/updatedBy)
EventSchema.plugin(auditPlugin);
EventSchema.path("createdBy").required(true);

export const EventModel = model<IEvent>("Event", EventSchema);

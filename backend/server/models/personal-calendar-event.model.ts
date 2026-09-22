import { Schema, model, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export interface IPersonalCalendarEvent extends Document {
  ownerId: Types.ObjectId;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  location?: string;
  color: "blue" | "green" | "amber" | "rose" | "violet";
  recurrence: "none" | "daily" | "weekly" | "monthly";
  recurrenceUntil?: Date;
  reminderMinutes: number[];
  reminderNotificationIds: Types.ObjectId[];
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}

const PersonalCalendarEventSchema = new Schema<IPersonalCalendarEvent>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 5000 },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true },
    allDay: { type: Boolean, default: false },
    location: { type: String, trim: true, maxlength: 500 },
    color: { type: String, enum: ["blue", "green", "amber", "rose", "violet"], default: "blue" },
    recurrence: { type: String, enum: ["none", "daily", "weekly", "monthly"], default: "none" },
    recurrenceUntil: { type: Date },
    reminderMinutes: [{ type: Number, min: 0, max: 10080 }],
    reminderNotificationIds: [{ type: Schema.Types.ObjectId, ref: "Notification" }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

PersonalCalendarEventSchema.index({ ownerId: 1, startDate: 1, endDate: 1 });
PersonalCalendarEventSchema.plugin(auditPlugin);

export const PersonalCalendarEventModel = model<IPersonalCalendarEvent>(
  "PersonalCalendarEvent",
  PersonalCalendarEventSchema,
);

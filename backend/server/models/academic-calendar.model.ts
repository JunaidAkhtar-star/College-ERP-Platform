import { auditPlugin } from "../plugins/audit.plugin";
import { Schema, model, type Types, type Document } from "mongoose";

export type EventCategory =
  | "holiday"
  | "internal_exam"
  | "university_exam"
  | "cultural"
  | "sports"
  | "technical"
  | "other";

export interface ICalendarEvent {
  _id?: Types.ObjectId;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  category: EventCategory;
  affectedRoles?: string[];
  departmentId?: Types.ObjectId;
  isRecurring?: boolean;
}

export interface IAcademicCalendar extends Document {
  academicYear: string; // "2025-26"
  semesterType: "odd" | "even";
  semesterStartDate: Date;
  semesterEndDate: Date;
  internalExamStartDate?: Date;
  internalExamEndDate?: Date;
  universityExamStartDate?: Date;
  universityExamEndDate?: Date;
  vacationStartDate?: Date;
  vacationEndDate?: Date;
  totalWorkingDays: number;
  events: ICalendarEvent[];
  isPublished: boolean;
  publishedAt?: Date;
  publishedBy?: Types.ObjectId;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CalendarEventSchema = new Schema<ICalendarEvent>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    category: {
      type: String,
      enum: [
        "holiday",
        "internal_exam",
        "university_exam",
        "cultural",
        "sports",
        "technical",
        "other",
      ],
      required: true,
    },
    affectedRoles: [{ type: String }],
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    isRecurring: { type: Boolean, default: false },
  },
  { _id: true },
);

const AcademicCalendarSchema = new Schema<IAcademicCalendar>(
  {
    academicYear: { type: String, required: true, trim: true },
    semesterType: { type: String, enum: ["odd", "even"], required: true },
    semesterStartDate: { type: Date, required: true },
    semesterEndDate: { type: Date, required: true },
    internalExamStartDate: { type: Date },
    internalExamEndDate: { type: Date },
    universityExamStartDate: { type: Date },
    universityExamEndDate: { type: Date },
    vacationStartDate: { type: Date },
    vacationEndDate: { type: Date },
    totalWorkingDays: { type: Number, default: 0, min: 0 },
    events: [CalendarEventSchema],
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date },
    publishedBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

AcademicCalendarSchema.index({ academicYear: 1, semesterType: 1 }, { unique: true });

AcademicCalendarSchema.plugin(auditPlugin);
AcademicCalendarSchema.path("createdBy").required(true);

export const AcademicCalendarModel = model<IAcademicCalendar>(
  "AcademicCalendar",
  AcademicCalendarSchema,
);

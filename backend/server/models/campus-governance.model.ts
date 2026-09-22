import { Schema, model, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export interface ICampus extends Document {
  code: string;
  name: string;
  type: "campus" | "school" | "learning_center";
  parentCampusId?: Types.ObjectId;
  timezone: string;
  address: { line1: string; city: string; state: string; postalCode: string; country: string };
  contactEmail?: string;
  contactPhone?: string;
  status: "planned" | "active" | "inactive" | "closed";
  openedAt?: Date;
  closedAt?: Date;
  createdBy: Types.ObjectId;
}
export interface ICampusUserAssignment extends Document {
  campusId: Types.ObjectId;
  userId: Types.ObjectId;
  scopeRole: "leader" | "academic" | "finance" | "operations" | "viewer";
  isPrimary: boolean;
  startsAt: Date;
  endsAt?: Date;
  status: "active" | "revoked" | "expired";
  assignedBy: Types.ObjectId;
  revokedAt?: Date;
  revokedBy?: Types.ObjectId;
  createdBy: Types.ObjectId;
}
export interface ICampusCalendar extends Document {
  campusId: Types.ObjectId;
  academicYear: string;
  name: string;
  status: "draft" | "published" | "archived";
  events: Array<{
    title: string;
    category: "holiday" | "academic" | "exam" | "operations" | "community";
    startAt: Date;
    endAt: Date;
    description?: string;
    inheritedFromParent: boolean;
  }>;
  publishedAt?: Date;
  publishedBy?: Types.ObjectId;
  createdBy: Types.ObjectId;
}
export interface ICampusSharedService extends Document {
  code: string;
  name: string;
  serviceType:
    | "library"
    | "transport"
    | "procurement"
    | "finance"
    | "hr"
    | "it"
    | "admissions"
    | "other";
  providerCampusId: Types.ObjectId;
  consumerCampusIds: Types.ObjectId[];
  allocationMethod: "equal" | "headcount" | "usage" | "fixed";
  annualBudget?: number;
  startsAt: Date;
  endsAt?: Date;
  status: "draft" | "active" | "suspended" | "ended";
  ownerId: Types.ObjectId;
  createdBy: Types.ObjectId;
}

const CampusSchema = new Schema<ICampus>(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      maxlength: 24,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    type: { type: String, enum: ["campus", "school", "learning_center"], required: true },
    parentCampusId: { type: Schema.Types.ObjectId, ref: "Campus", index: true },
    timezone: { type: String, required: true, trim: true, default: "Asia/Kolkata" },
    address: {
      line1: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      postalCode: { type: String, required: true, trim: true },
      country: { type: String, required: true, trim: true, default: "India" },
    },
    contactEmail: { type: String, trim: true, lowercase: true },
    contactPhone: { type: String, trim: true },
    status: {
      type: String,
      enum: ["planned", "active", "inactive", "closed"],
      default: "planned",
      index: true,
    },
    openedAt: Date,
    closedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
CampusSchema.index({ parentCampusId: 1, status: 1, name: 1 });
CampusSchema.plugin(auditPlugin);

const AssignmentSchema = new Schema<ICampusUserAssignment>(
  {
    campusId: { type: Schema.Types.ObjectId, ref: "Campus", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    scopeRole: {
      type: String,
      enum: ["leader", "academic", "finance", "operations", "viewer"],
      required: true,
    },
    isPrimary: { type: Boolean, default: false },
    startsAt: { type: Date, required: true, default: Date.now },
    endsAt: Date,
    status: {
      type: String,
      enum: ["active", "revoked", "expired"],
      default: "active",
      index: true,
    },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    revokedAt: Date,
    revokedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
AssignmentSchema.index(
  { campusId: 1, userId: 1, scopeRole: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "active" } },
);
AssignmentSchema.plugin(auditPlugin);

const CalendarSchema = new Schema<ICampusCalendar>(
  {
    campusId: { type: Schema.Types.ObjectId, ref: "Campus", required: true, index: true },
    academicYear: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    events: [
      {
        title: { type: String, required: true, trim: true },
        category: {
          type: String,
          enum: ["holiday", "academic", "exam", "operations", "community"],
          required: true,
        },
        startAt: { type: Date, required: true },
        endAt: { type: Date, required: true },
        description: { type: String, trim: true, maxlength: 2000 },
        inheritedFromParent: { type: Boolean, default: false },
      },
    ],
    publishedAt: Date,
    publishedBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
CalendarSchema.index({ campusId: 1, academicYear: 1 }, { unique: true });
CalendarSchema.plugin(auditPlugin);

const SharedServiceSchema = new Schema<ICampusSharedService>(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      maxlength: 40,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    serviceType: {
      type: String,
      enum: ["library", "transport", "procurement", "finance", "hr", "it", "admissions", "other"],
      required: true,
    },
    providerCampusId: { type: Schema.Types.ObjectId, ref: "Campus", required: true, index: true },
    consumerCampusIds: { type: [Schema.Types.ObjectId], ref: "Campus", required: true },
    allocationMethod: {
      type: String,
      enum: ["equal", "headcount", "usage", "fixed"],
      required: true,
    },
    annualBudget: { type: Number, min: 0 },
    startsAt: { type: Date, required: true },
    endsAt: Date,
    status: {
      type: String,
      enum: ["draft", "active", "suspended", "ended"],
      default: "draft",
      index: true,
    },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
SharedServiceSchema.index({ providerCampusId: 1, status: 1 });
SharedServiceSchema.plugin(auditPlugin);

export const CampusModel = model<ICampus>("Campus", CampusSchema);
export const CampusUserAssignmentModel = model<ICampusUserAssignment>(
  "CampusUserAssignment",
  AssignmentSchema,
);
export const CampusCalendarModel = model<ICampusCalendar>("CampusCalendar", CalendarSchema);
export const CampusSharedServiceModel = model<ICampusSharedService>(
  "CampusSharedService",
  SharedServiceSchema,
);

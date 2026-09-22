/**
 * @file club.model.ts
 * @description Student clubs & activities. Each club has a faculty advisor,
 * a student head, a roster of members, and a stream of activities.
 */
import { Schema, model, type Types, type Document } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export type TClubCategory =
  | "technical"
  | "cultural"
  | "sports"
  | "literary"
  | "entrepreneurship"
  | "social"
  | "other";

export interface IClubMember {
  userId: Types.ObjectId;
  joinedAt: Date;
  role?: string; // "Member", "Secretary", "Treasurer", etc.
}

export interface IClubActivity {
  title: string;
  description?: string;
  date: Date;
  participantCount?: number;
  proofUrl?: string;
  venue?: string;
  outcome?: string;
  budget?: number;
}

export interface IClub extends Document {
  _id: Types.ObjectId;
  name: string;
  category: TClubCategory;
  description?: string;
  facultyAdvisor?: Types.ObjectId;
  studentHead?: Types.ObjectId;
  establishedYear?: number;
  members: IClubMember[];
  activities: IClubActivity[];
  isActive: boolean;
  logoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}

const ClubMemberSchema = new Schema<IClubMember>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    joinedAt: { type: Date, default: Date.now },
    role: { type: String, default: "Member", trim: true },
  },
  { _id: false },
);

const ClubActivitySchema = new Schema<IClubActivity>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    date: { type: Date, required: true },
    participantCount: { type: Number, min: 0 },
    proofUrl: { type: String, trim: true },
    venue: { type: String, trim: true },
    outcome: { type: String, trim: true, maxlength: 2000 },
    budget: { type: Number, min: 0 },
  },
  { _id: false },
);

const ClubSchema = new Schema<IClub>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    category: {
      type: String,
      enum: ["technical", "cultural", "sports", "literary", "entrepreneurship", "social", "other"],
      default: "other",
      index: true,
    },
    description: { type: String, trim: true },
    facultyAdvisor: { type: Schema.Types.ObjectId, ref: "User", index: true },
    studentHead: { type: Schema.Types.ObjectId, ref: "User" },
    establishedYear: { type: Number },
    members: { type: [ClubMemberSchema], default: [] },
    activities: { type: [ClubActivitySchema], default: [] },
    isActive: { type: Boolean, default: true },
    logoUrl: { type: String, trim: true },
  },
  { timestamps: true },
);

ClubSchema.plugin(auditPlugin);
ClubSchema.path("createdBy").required(true);

export const ClubModel = model<IClub>("Club", ClubSchema);

export interface IClubMembershipRequest extends Document {
  clubId: Types.ObjectId;
  userId: Types.ObjectId;
  message?: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  requestedAt: Date;
  decidedAt?: Date;
  decidedBy?: Types.ObjectId;
  decisionNote?: string;
}

const ClubMembershipRequestSchema = new Schema<IClubMembershipRequest>(
  {
    clubId: { type: Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    message: { type: String, trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "withdrawn"],
      default: "pending",
      index: true,
    },
    requestedAt: { type: Date, default: Date.now },
    decidedAt: Date,
    decidedBy: { type: Schema.Types.ObjectId, ref: "User" },
    decisionNote: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);
ClubMembershipRequestSchema.index(
  { clubId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);
export const ClubMembershipRequestModel = model<IClubMembershipRequest>(
  "ClubMembershipRequest",
  ClubMembershipRequestSchema,
);

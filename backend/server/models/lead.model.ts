/**
 * @file lead.model.ts
 * @description Mongoose schema and typescript interfaces for public demo requests (leads).
 *              Stored globally in the SaaS master database.
 * @module server/models
 */

import { auditPlugin } from "../plugins/audit.plugin";
import type { Document, Types } from "mongoose";
import mongoose, { Schema } from "mongoose";

export enum LeadStatus {
  PENDING = "pending",
  CONTACTED = "contacted",
  CONVERTED = "converted",
  REJECTED = "rejected",
}

export interface ILead extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  collegeName: string;
  designation: string;
  studentCount: number;
  status: LeadStatus;
  notes?: string;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    collegeName: {
      type: String,
      required: true,
      trim: true,
    },
    designation: {
      type: String,
      required: true,
      trim: true,
    },
    studentCount: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: Object.values(LeadStatus),
      default: LeadStatus.PENDING,
      index: true,
    },
    notes: {
      type: String,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

LeadSchema.plugin(auditPlugin);

export const LeadModel = mongoose.model<ILead>("Lead", LeadSchema);

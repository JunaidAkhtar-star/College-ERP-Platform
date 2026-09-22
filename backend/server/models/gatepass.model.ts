import type { Document, Types } from "mongoose";
import mongoose, { Schema } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export interface IGatePass extends Document {
  _id: Types.ObjectId;
  passNumber: string; // e.g. GP-2026-0001
  visitorName: string;
  visitorPhone: string;
  purpose: string;
  hostId: Types.ObjectId; // User being visited (Faculty / Student / Admin)
  checkInTime: Date;
  checkOutTime?: Date;
  status: "checked_in" | "checked_out";
  vehicleNumber?: string;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GatePassSchema = new Schema<IGatePass>(
  {
    passNumber: { type: String, required: true, unique: true, index: true },
    visitorName: { type: String, required: true, trim: true },
    visitorPhone: { type: String, required: true, trim: true },
    purpose: { type: String, required: true, trim: true },
    hostId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    checkInTime: { type: Date, required: true, default: Date.now },
    checkOutTime: { type: Date },
    status: {
      type: String,
      enum: ["checked_in", "checked_out"],
      default: "checked_in",
      index: true,
    },
    vehicleNumber: { type: String, trim: true },
    remarks: { type: String, trim: true },
  },
  { timestamps: true },
);

GatePassSchema.plugin(auditPlugin);

export const GatePassModel = mongoose.model<IGatePass>("GatePass", GatePassSchema);

export type StudentOutingStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "outside"
  | "returned";

export interface IStudentOutingPass extends Document {
  _id: Types.ObjectId;
  outingNumber: string;
  studentId: Types.ObjectId;
  reason: string;
  destination: string;
  departureAt: Date;
  expectedReturnAt: Date;
  emergencyContact: string;
  status: StudentOutingStatus;
  reviewNotes?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  exitedAt?: Date;
  returnedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StudentOutingPassSchema = new Schema<IStudentOutingPass>(
  {
    outingNumber: { type: String, required: true, unique: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    destination: { type: String, required: true, trim: true, maxlength: 200 },
    departureAt: { type: Date, required: true },
    expectedReturnAt: { type: Date, required: true },
    emergencyContact: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled", "outside", "returned"],
      default: "pending",
      index: true,
    },
    reviewNotes: { type: String, trim: true, maxlength: 500 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    exitedAt: { type: Date },
    returnedAt: { type: Date },
  },
  { timestamps: true },
);

StudentOutingPassSchema.index({ studentId: 1, createdAt: -1 });
StudentOutingPassSchema.plugin(auditPlugin);

export const StudentOutingPassModel = mongoose.model<IStudentOutingPass>(
  "StudentOutingPass",
  StudentOutingPassSchema,
);

import { auditPlugin } from "../plugins/audit.plugin";
import type { Types, Document } from "mongoose";
import { Schema, model } from "mongoose";

export interface ILeaveRequest extends Document {
  employeeId: Types.ObjectId;
  departmentId: Types.ObjectId;
  leaveType:
    | "casual"
    | "sick"
    | "earned"
    | "on_duty"
    | "maternity"
    | "paternity"
    | "special"
    | "loss_of_pay";
  fromDate: Date;
  toDate: Date;
  totalDays: number;
  reason: string;
  attachmentUrl?: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  hodApproval?: "pending" | "approved" | "rejected";
  hodApprovedBy?: Types.ObjectId;
  hodApprovedAt?: Date;
  adminApproval?: "pending" | "approved" | "rejected";
  adminApprovedBy?: Types.ObjectId;
  adminApprovedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILeaveBalance {
  employeeId: Types.ObjectId;
  academicYear: string;
  casual: number;
  sick: number;
  earned: number;
  onDuty: number;
  casualUsed: number;
  sickUsed: number;
  earnedUsed: number;
  onDutyUsed: number;
  updatedAt: Date;
}

const LeaveRequestSchema = new Schema<ILeaveRequest>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    leaveType: {
      type: String,
      enum: [
        "casual",
        "sick",
        "earned",
        "on_duty",
        "maternity",
        "paternity",
        "special",
        "loss_of_pay",
      ],
      required: true,
    },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    totalDays: { type: Number, required: true, min: 0.5 },
    reason: { type: String, required: true, trim: true },
    attachmentUrl: { type: String },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
    },
    hodApproval: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    hodApprovedBy: { type: Schema.Types.ObjectId, ref: "User" },
    hodApprovedAt: { type: Date },
    adminApproval: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    adminApprovedBy: { type: Schema.Types.ObjectId, ref: "User" },
    adminApprovedAt: { type: Date },
    rejectionReason: { type: String },
  },
  { timestamps: true },
);

const LeaveBalanceSchema = new Schema<ILeaveBalance>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    academicYear: { type: String, required: true },
    casual: { type: Number, default: 12 },
    sick: { type: Number, default: 12 },
    earned: { type: Number, default: 15 },
    onDuty: { type: Number, default: 10 },
    casualUsed: { type: Number, default: 0 },
    sickUsed: { type: Number, default: 0 },
    earnedUsed: { type: Number, default: 0 },
    onDutyUsed: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

LeaveBalanceSchema.index({ employeeId: 1, academicYear: 1 }, { unique: true });

// Indexes for leave request queries (employeeId+status is the most common filter)
LeaveRequestSchema.index({ employeeId: 1, status: 1 });
LeaveRequestSchema.index({ status: 1, hodApproval: 1 });
LeaveRequestSchema.index({ fromDate: 1, toDate: 1 });

// Apply audit plugin (soft delete + createdBy/updatedBy)
LeaveRequestSchema.plugin(auditPlugin);

export const LeaveRequestModel = model<ILeaveRequest>("LeaveRequest", LeaveRequestSchema);
export const LeaveBalanceModel = model<ILeaveBalance>("LeaveBalance", LeaveBalanceSchema);

import type { Document, Types } from "mongoose";
import mongoose, { Schema } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export interface IRequisition extends Document {
  _id: Types.ObjectId;
  requisitionNumber: string; // e.g. REQ-2026-0001
  itemName: string;
  quantity: number;
  estimatedCost: number;
  purpose: string;
  departmentId: Types.ObjectId;
  status: "pending" | "hod_approved" | "approved" | "partially_received" | "received" | "rejected";
  raisedBy: Types.ObjectId; // User (Faculty / Staff)
  approvedBy?: Types.ObjectId; // HOD / Dean / Admin
  hodApprovedBy?: Types.ObjectId;
  poNumber?: string; // Purchase Order reference if approved
  receivedQuantity: number;
  receivedBy?: Types.ObjectId;
  receivedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RequisitionSchema = new Schema<IRequisition>(
  {
    requisitionNumber: { type: String, required: true, unique: true, index: true },
    itemName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    estimatedCost: { type: Number, required: true, min: 0 },
    purpose: { type: String, required: true, trim: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "hod_approved", "approved", "partially_received", "received", "rejected"],
      default: "pending",
      index: true,
    },
    raisedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    hodApprovedBy: { type: Schema.Types.ObjectId, ref: "User" },
    poNumber: { type: String, trim: true },
    receivedQuantity: { type: Number, default: 0, min: 0 },
    receivedBy: { type: Schema.Types.ObjectId, ref: "User" },
    receivedAt: { type: Date },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

RequisitionSchema.plugin(auditPlugin);

export const RequisitionModel = mongoose.model<IRequisition>("Requisition", RequisitionSchema);

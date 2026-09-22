import { auditPlugin } from "../plugins/audit.plugin";
import type { Types, Document } from "mongoose";
import { Schema, model } from "mongoose";

export interface IHostelRoom extends Document {
  hostelName: string;
  roomNumber: string;
  blockName: string;
  hostelType: "boys" | "girls" | "mixed";
  roomType: "single" | "double" | "triple" | "dormitory";
  floor: number;
  capacity: number;
  occupancy: number;
  facilities: string[];
  monthlyFee: number;
  isActive: boolean;
  createdAt: Date;
}

export interface IHostelAllocation extends Document {
  studentId: Types.ObjectId;
  roomId: Types.ObjectId;
  academicYear: string;
  allocationDate: Date;
  vacatingDate?: Date;
  status: "active" | "vacated" | "transferred";
  monthlyFee: number;
  depositPaid: number;
  messFee?: number;
  remarks?: string;
  allocatedBy: Types.ObjectId;
  activeKey?: string;
  roomTransfers: Array<{
    fromRoomId: Types.ObjectId;
    toRoomId: Types.ObjectId;
    transferredAt: Date;
    transferredBy: Types.ObjectId;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const HostelRoomSchema = new Schema<IHostelRoom>(
  {
    hostelName: { type: String, required: true, trim: true },
    roomNumber: { type: String, required: true, trim: true },
    blockName: { type: String, required: true, trim: true },
    hostelType: { type: String, enum: ["boys", "girls", "mixed"], required: true },
    roomType: { type: String, enum: ["single", "double", "triple", "dormitory"], required: true },
    floor: { type: Number, required: true },
    capacity: { type: Number, required: true, min: 1 },
    occupancy: { type: Number, default: 0, min: 0 },
    facilities: [{ type: String }],
    monthlyFee: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

HostelRoomSchema.index({ hostelName: 1, roomNumber: 1 }, { unique: true });

const HostelAllocationSchema = new Schema<IHostelAllocation>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    roomId: { type: Schema.Types.ObjectId, ref: "HostelRoom", required: true },
    academicYear: { type: String, required: true },
    allocationDate: { type: Date, required: true },
    vacatingDate: { type: Date },
    status: { type: String, enum: ["active", "vacated", "transferred"], default: "active" },
    monthlyFee: { type: Number, required: true, min: 0 },
    depositPaid: { type: Number, default: 0, min: 0 },
    messFee: { type: Number, default: 0 },
    remarks: { type: String },
    allocatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    activeKey: { type: String, unique: true, sparse: true, select: false },
    roomTransfers: {
      type: [
        new Schema(
          {
            fromRoomId: { type: Schema.Types.ObjectId, ref: "HostelRoom", required: true },
            toRoomId: { type: Schema.Types.ObjectId, ref: "HostelRoom", required: true },
            transferredAt: { type: Date, required: true },
            transferredBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true },
);

HostelAllocationSchema.index({ studentId: 1, academicYear: 1 });

// Apply audit plugin (soft delete + createdBy/updatedBy)
HostelRoomSchema.plugin(auditPlugin);

export const HostelRoomModel = model<IHostelRoom>("HostelRoom", HostelRoomSchema);
export const HostelAllocationModel = model<IHostelAllocation>(
  "HostelAllocation",
  HostelAllocationSchema,
);

// ─── Hostel Visitor Log (M40) ─────────────────────────────────────────────────

export interface IHostelVisitor extends Document {
  hostelName: string;
  studentId: Types.ObjectId;
  studentName: string;
  roomNo: string;
  visitorName: string;
  visitorPhone: string;
  relation: string;
  purpose?: string;
  checkIn: Date;
  checkOut?: Date;
  approvedBy?: Types.ObjectId;
  idProofType?: string;
  idProofNo?: string;
  createdAt: Date;
  updatedAt: Date;
}

const HostelVisitorSchema = new Schema<IHostelVisitor>(
  {
    hostelName: { type: String, required: true, trim: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    studentName: { type: String, required: true, trim: true },
    roomNo: { type: String, required: true, trim: true },
    visitorName: { type: String, required: true, trim: true },
    visitorPhone: { type: String, required: true, trim: true },
    relation: { type: String, required: true, trim: true },
    purpose: { type: String },
    checkIn: { type: Date, required: true, default: Date.now },
    checkOut: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    idProofType: {
      type: String,
      enum: ["aadhaar", "passport", "driving_license", "voter_id", "other"],
    },
    idProofNo: { type: String, trim: true },
  },
  { timestamps: true },
);
HostelVisitorSchema.index({ studentId: 1, checkIn: -1 });
export const HostelVisitorModel = model<IHostelVisitor>("HostelVisitor", HostelVisitorSchema);

// ─── Hostel Complaint (M40) ───────────────────────────────────────────────────

export interface IHostelComplaint extends Document {
  studentId: Types.ObjectId;
  roomNo: string;
  hostelName: string;
  category: "maintenance" | "cleanliness" | "mess" | "security" | "other";
  description: string;
  attachmentUrl?: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  assignedTo?: Types.ObjectId;
  resolution?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const HostelComplaintSchema = new Schema<IHostelComplaint>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    roomNo: { type: String, required: true, trim: true },
    hostelName: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["maintenance", "cleanliness", "mess", "security", "other"],
      required: true,
    },
    description: { type: String, required: true },
    attachmentUrl: { type: String },
    status: { type: String, enum: ["open", "in_progress", "resolved", "closed"], default: "open" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    resolution: { type: String },
    resolvedAt: { type: Date },
  },
  { timestamps: true },
);
HostelComplaintSchema.index({ studentId: 1, status: 1 });
export const HostelComplaintModel = model<IHostelComplaint>(
  "HostelComplaint",
  HostelComplaintSchema,
);

// ─── Hostel Fee Record (M40) ──────────────────────────────────────────────────

export interface IHostelFee extends Document {
  allocationId: Types.ObjectId;
  studentId: Types.ObjectId;
  academicYear: string;
  month: string; // "2025-06"
  monthlyFee: number;
  messFee: number;
  otherCharges: number;
  totalDue: number;
  paidAmount: number;
  dueDate: Date;
  paidDate?: Date;
  paymentMode?: "cash" | "online" | "dd" | "cheque";
  receiptNo?: string;
  status: "unpaid" | "partial" | "paid" | "overdue";
  collectedBy?: Types.ObjectId;
  payments: Array<{
    paymentId: string;
    amount: number;
    paymentMode: "cash" | "online" | "bank_transfer" | "upi" | "dd" | "cheque";
    receiptNo: string;
    paidDate: Date;
    collectedBy: Types.ObjectId;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const HostelFeeSchema = new Schema<IHostelFee>(
  {
    allocationId: { type: Schema.Types.ObjectId, ref: "HostelAllocation", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    academicYear: { type: String, required: true },
    month: { type: String, required: true, trim: true },
    monthlyFee: { type: Number, required: true, min: 0 },
    messFee: { type: Number, default: 0, min: 0 },
    otherCharges: { type: Number, default: 0, min: 0 },
    totalDue: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    dueDate: { type: Date, required: true },
    paidDate: { type: Date },
    paymentMode: {
      type: String,
      enum: ["cash", "online", "bank_transfer", "upi", "dd", "cheque"],
    },
    receiptNo: { type: String, trim: true },
    status: { type: String, enum: ["unpaid", "partial", "paid", "overdue"], default: "unpaid" },
    collectedBy: { type: Schema.Types.ObjectId, ref: "User" },
    payments: {
      type: [
        new Schema(
          {
            paymentId: { type: String, required: true },
            amount: { type: Number, required: true, min: 0.01 },
            paymentMode: {
              type: String,
              enum: ["cash", "online", "bank_transfer", "upi", "dd", "cheque"],
              required: true,
            },
            receiptNo: { type: String, required: true, trim: true },
            paidDate: { type: Date, required: true },
            collectedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true },
);
HostelFeeSchema.index({ studentId: 1, month: 1 }, { unique: true });
HostelFeeSchema.index({ status: 1, dueDate: 1 });
HostelFeeSchema.index({ "payments.paymentId": 1 }, { unique: true, sparse: true });
export const HostelFeeModel = model<IHostelFee>("HostelFee", HostelFeeSchema);

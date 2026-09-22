import { auditPlugin } from "../plugins/audit.plugin";
import type { Types, Document } from "mongoose";
import { Schema, model } from "mongoose";

export interface IBusRoute extends Document {
  routeNo: string;
  routeName: string;
  stops: { stopName: string; stopTime: string; fareFromOrigin: number }[];
  driverName: string;
  driverPhone: string;
  vehicleNo: string;
  vehicleType: string;
  capacity: number;
  occupiedCount: number;
  isActive: boolean;
  gps?: {
    lat: number;
    lng: number;
    speed?: number;
    heading?: number;
    accuracy?: number;
    recordedAt?: Date;
    lastSeen: Date;
  };
  createdAt: Date;
}

export interface ITransportAllocation extends Document {
  studentId: Types.ObjectId;
  routeId: Types.ObjectId;
  stopName: string;
  academicYear: string;
  monthlyFee: number;
  status: "active" | "cancelled";
  allocatedBy: Types.ObjectId;
  activeKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BusRouteSchema = new Schema<IBusRoute>(
  {
    routeNo: { type: String, required: true, unique: true, trim: true },
    routeName: { type: String, required: true, trim: true },
    stops: [
      {
        stopName: { type: String, required: true, trim: true },
        stopTime: { type: String, required: true },
        fareFromOrigin: { type: Number, required: true, min: 0 },
      },
    ],
    driverName: { type: String, required: true, trim: true },
    driverPhone: { type: String, required: true, trim: true },
    vehicleNo: { type: String, required: true, trim: true },
    vehicleType: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1 },
    occupiedCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    gps: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
      speed: { type: Number, min: 0 },
      heading: { type: Number, min: 0, max: 360 },
      accuracy: { type: Number, min: 0, max: 5000 },
      recordedAt: { type: Date },
      lastSeen: { type: Date },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const TransportAllocationSchema = new Schema<ITransportAllocation>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    routeId: { type: Schema.Types.ObjectId, ref: "BusRoute", required: true },
    stopName: { type: String, required: true },
    academicYear: { type: String, required: true },
    monthlyFee: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["active", "cancelled"], default: "active" },
    allocatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    activeKey: { type: String, unique: true, sparse: true, select: false },
  },
  { timestamps: true },
);

TransportAllocationSchema.index({ studentId: 1, academicYear: 1 });
TransportAllocationSchema.index({ routeId: 1, academicYear: 1 });
TransportAllocationSchema.index({ status: 1, academicYear: 1 });

// Apply audit plugin (soft delete + createdBy/updatedBy)
BusRouteSchema.plugin(auditPlugin);

export const BusRouteModel = model<IBusRoute>("BusRoute", BusRouteSchema);
export const TransportAllocationModel = model<ITransportAllocation>(
  "TransportAllocation",
  TransportAllocationSchema,
);

// ─── Driver (M41) ─────────────────────────────────────────────────────────────

export interface IDriver extends Document {
  name: string;
  phone: string;
  licenseNo: string;
  licenseExpiry: Date;
  address?: string;
  experience: number; // years
  photoUrl?: string;
  assignedRoute?: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DriverSchema = new Schema<IDriver>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    licenseNo: { type: String, required: true, unique: true, trim: true },
    licenseExpiry: { type: Date, required: true },
    address: { type: String },
    experience: { type: Number, default: 0, min: 0 },
    photoUrl: { type: String },
    assignedRoute: { type: Schema.Types.ObjectId, ref: "BusRoute" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
// index on `licenseNo` is created by `unique: true` in the field definition above
DriverSchema.index(
  { assignedRoute: 1 },
  {
    unique: true,
    partialFilterExpression: { assignedRoute: { $type: "objectId" }, isActive: true },
  },
);
export const DriverModel = model<IDriver>("Driver", DriverSchema);

export interface ITransportTrackingSession extends Document {
  routeId: Types.ObjectId;
  startedBy: Types.ObjectId;
  status: "active" | "stopped" | "expired";
  activeRouteKey?: string;
  startedAt: Date;
  lastSeenAt?: Date;
  lastRecordedAt?: Date;
  expiresAt: Date;
  stoppedAt?: Date;
}

const TransportTrackingSessionSchema = new Schema<ITransportTrackingSession>(
  {
    routeId: { type: Schema.Types.ObjectId, ref: "BusRoute", required: true, index: true },
    startedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: {
      type: String,
      enum: ["active", "stopped", "expired"],
      default: "active",
      index: true,
    },
    activeRouteKey: { type: String, unique: true, sparse: true, select: false },
    startedAt: { type: Date, required: true },
    lastSeenAt: { type: Date },
    lastRecordedAt: { type: Date },
    expiresAt: { type: Date, required: true, index: true },
    stoppedAt: { type: Date },
  },
  { timestamps: true },
);
TransportTrackingSessionSchema.index({ startedBy: 1, status: 1 });

export interface ITransportPosition extends Document {
  routeId: Types.ObjectId;
  sessionId: Types.ObjectId;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  recordedAt: Date;
  receivedAt: Date;
}

const TransportPositionSchema = new Schema<ITransportPosition>(
  {
    routeId: { type: Schema.Types.ObjectId, ref: "BusRoute", required: true, index: true },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "TransportTrackingSession",
      required: true,
      index: true,
    },
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    speed: { type: Number, min: 0, max: 200 },
    heading: { type: Number, min: 0, max: 360 },
    accuracy: { type: Number, min: 0, max: 5000 },
    recordedAt: { type: Date, required: true },
    receivedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false },
);
TransportPositionSchema.index({ routeId: 1, recordedAt: -1 });
TransportPositionSchema.index({ receivedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const TransportTrackingSessionModel = model<ITransportTrackingSession>(
  "TransportTrackingSession",
  TransportTrackingSessionSchema,
);
export const TransportPositionModel = model<ITransportPosition>(
  "TransportPosition",
  TransportPositionSchema,
);

export interface ITransportFee extends Document {
  allocationId: Types.ObjectId;
  studentId: Types.ObjectId;
  academicYear: string;
  month: string;
  totalDue: number;
  paidAmount: number;
  dueDate: Date;
  status: "unpaid" | "partial" | "paid" | "overdue";
  payments: Array<{
    paymentId: string;
    receiptNo: string;
    amount: number;
    paymentMode: "cash" | "bank_transfer" | "upi" | "dd" | "cheque";
    paidDate: Date;
    collectedBy: Types.ObjectId;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const TransportFeeSchema = new Schema<ITransportFee>(
  {
    allocationId: { type: Schema.Types.ObjectId, ref: "TransportAllocation", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    academicYear: { type: String, required: true, trim: true },
    month: { type: String, required: true, trim: true },
    totalDue: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    dueDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["unpaid", "partial", "paid", "overdue"],
      default: "unpaid",
      index: true,
    },
    payments: {
      type: [
        new Schema(
          {
            paymentId: { type: String, required: true },
            receiptNo: { type: String, required: true, trim: true },
            amount: { type: Number, required: true, min: 0.01 },
            paymentMode: {
              type: String,
              enum: ["cash", "bank_transfer", "upi", "dd", "cheque"],
              required: true,
            },
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
TransportFeeSchema.index({ studentId: 1, month: 1 }, { unique: true });
TransportFeeSchema.index({ dueDate: 1, status: 1 });
TransportFeeSchema.index({ "payments.paymentId": 1 }, { unique: true, sparse: true });

export const TransportFeeModel = model<ITransportFee>("TransportFee", TransportFeeSchema);

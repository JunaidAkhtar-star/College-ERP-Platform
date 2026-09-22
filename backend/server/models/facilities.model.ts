import { Schema, model, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export interface IFacilitySpace extends Document {
  campusId: Types.ObjectId;
  code: string;
  name: string;
  building: string;
  floor?: string;
  type:
    | "classroom"
    | "laboratory"
    | "office"
    | "auditorium"
    | "library"
    | "sports"
    | "hostel"
    | "utility"
    | "other";
  capacity: number;
  amenities: string[];
  accessibility: string[];
  status: "active" | "maintenance" | "inactive";
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}
const FacilitySpaceSchema = new Schema<IFacilitySpace>(
  {
    campusId: { type: Schema.Types.ObjectId, ref: "Campus", required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    building: { type: String, required: true, trim: true, index: true },
    floor: { type: String, trim: true },
    type: {
      type: String,
      enum: [
        "classroom",
        "laboratory",
        "office",
        "auditorium",
        "library",
        "sports",
        "hostel",
        "utility",
        "other",
      ],
      required: true,
      index: true,
    },
    capacity: { type: Number, required: true, min: 0 },
    amenities: [{ type: String, trim: true }],
    accessibility: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: ["active", "maintenance", "inactive"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true },
);
FacilitySpaceSchema.index({ campusId: 1, code: 1 }, { unique: true });
FacilitySpaceSchema.plugin(auditPlugin);
FacilitySpaceSchema.path("createdBy").required(true);
export const FacilitySpaceModel = model<IFacilitySpace>("FacilitySpace", FacilitySpaceSchema);

export interface IAsset extends Document {
  campusId: Types.ObjectId;
  spaceId?: Types.ObjectId;
  storeItemId?: Types.ObjectId;
  assetTag: string;
  name: string;
  category: string;
  serialNumber?: string;
  manufacturer?: string;
  modelName?: string;
  acquiredAt?: Date;
  acquisitionCost?: number;
  warrantyEndsAt?: Date;
  usefulLifeMonths?: number;
  condition: "excellent" | "good" | "fair" | "poor" | "unserviceable";
  status: "in_service" | "in_repair" | "reserved" | "retired" | "disposed";
  custodianId?: Types.ObjectId;
  maintenanceIntervalDays?: number;
  lastMaintainedAt?: Date;
  nextMaintenanceAt?: Date;
  retiredAt?: Date;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}
const AssetSchema = new Schema<IAsset>(
  {
    campusId: { type: Schema.Types.ObjectId, ref: "Campus", required: true, index: true },
    spaceId: { type: Schema.Types.ObjectId, ref: "FacilitySpace", index: true },
    storeItemId: { type: Schema.Types.ObjectId, ref: "StoreItem" },
    assetTag: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, index: true },
    serialNumber: { type: String, trim: true, sparse: true },
    manufacturer: { type: String, trim: true },
    modelName: { type: String, trim: true },
    acquiredAt: Date,
    acquisitionCost: { type: Number, min: 0 },
    warrantyEndsAt: Date,
    usefulLifeMonths: { type: Number, min: 1, max: 1200 },
    condition: {
      type: String,
      enum: ["excellent", "good", "fair", "poor", "unserviceable"],
      default: "good",
      index: true,
    },
    status: {
      type: String,
      enum: ["in_service", "in_repair", "reserved", "retired", "disposed"],
      default: "in_service",
      index: true,
    },
    custodianId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    maintenanceIntervalDays: { type: Number, min: 1, max: 3650 },
    lastMaintainedAt: Date,
    nextMaintenanceAt: { type: Date, index: true },
    retiredAt: Date,
  },
  { timestamps: true },
);
AssetSchema.index({ campusId: 1, assetTag: 1 }, { unique: true });
AssetSchema.index({ campusId: 1, serialNumber: 1 }, { unique: true, sparse: true });
AssetSchema.plugin(auditPlugin);
AssetSchema.path("createdBy").required(true);
export const AssetModel = model<IAsset>("Asset", AssetSchema);

export interface IFacilityWorkOrder extends Document {
  campusId: Types.ObjectId;
  number: string;
  spaceId?: Types.ObjectId;
  assetId?: Types.ObjectId;
  title: string;
  description: string;
  category: "corrective" | "preventive" | "inspection" | "safety" | "cleaning";
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "assigned" | "in_progress" | "on_hold" | "completed" | "cancelled";
  requestedBy: Types.ObjectId;
  assignedTo?: Types.ObjectId;
  dueAt: Date;
  completedAt?: Date;
  resolution?: string;
  laborCost?: number;
  materialCost?: number;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}
const FacilityWorkOrderSchema = new Schema<IFacilityWorkOrder>(
  {
    campusId: { type: Schema.Types.ObjectId, ref: "Campus", required: true, index: true },
    number: { type: String, required: true, unique: true },
    spaceId: { type: Schema.Types.ObjectId, ref: "FacilitySpace", index: true },
    assetId: { type: Schema.Types.ObjectId, ref: "Asset", index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["corrective", "preventive", "inspection", "safety", "cleaning"],
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "assigned", "in_progress", "on_hold", "completed", "cancelled"],
      default: "open",
      index: true,
    },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", index: true },
    dueAt: { type: Date, required: true, index: true },
    completedAt: Date,
    resolution: { type: String, trim: true },
    laborCost: { type: Number, min: 0 },
    materialCost: { type: Number, min: 0 },
  },
  { timestamps: true },
);
FacilityWorkOrderSchema.index({ campusId: 1, status: 1, dueAt: 1 });
FacilityWorkOrderSchema.plugin(auditPlugin);
FacilityWorkOrderSchema.path("createdBy").required(true);
export const FacilityWorkOrderModel = model<IFacilityWorkOrder>(
  "FacilityWorkOrder",
  FacilityWorkOrderSchema,
);

export interface IFacilityBooking extends Document {
  campusId: Types.ObjectId;
  spaceId: Types.ObjectId;
  title: string;
  purpose: string;
  startsAt: Date;
  endsAt: Date;
  attendees: number;
  status: "confirmed" | "cancelled";
  bookedBy: Types.ObjectId;
  cancelledAt?: Date;
  createdBy: Types.ObjectId;
}
const FacilityBookingSchema = new Schema<IFacilityBooking>(
  {
    campusId: { type: Schema.Types.ObjectId, ref: "Campus", required: true, index: true },
    spaceId: { type: Schema.Types.ObjectId, ref: "FacilitySpace", required: true, index: true },
    title: { type: String, required: true, trim: true },
    purpose: { type: String, required: true, trim: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true, index: true },
    attendees: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ["confirmed", "cancelled"], default: "confirmed", index: true },
    bookedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    cancelledAt: Date,
  },
  { timestamps: true },
);
FacilityBookingSchema.index({ spaceId: 1, startsAt: 1, endsAt: 1, status: 1 });
FacilityBookingSchema.plugin(auditPlugin);
FacilityBookingSchema.path("createdBy").required(true);
export const FacilityBookingModel = model<IFacilityBooking>(
  "FacilityBooking",
  FacilityBookingSchema,
);

export interface IFacilityInspection extends Document {
  campusId: Types.ObjectId;
  spaceId: Types.ObjectId;
  checklist: Array<{ item: string; passed: boolean; note?: string }>;
  score: number;
  outcome: "pass" | "conditional" | "fail";
  inspectedBy: Types.ObjectId;
  inspectedAt: Date;
  followUpDueAt?: Date;
  createdBy: Types.ObjectId;
}
const FacilityInspectionSchema = new Schema<IFacilityInspection>(
  {
    campusId: { type: Schema.Types.ObjectId, ref: "Campus", required: true, index: true },
    spaceId: { type: Schema.Types.ObjectId, ref: "FacilitySpace", required: true, index: true },
    checklist: [
      {
        _id: false,
        item: { type: String, required: true, trim: true },
        passed: { type: Boolean, required: true },
        note: { type: String, trim: true },
      },
    ],
    score: { type: Number, required: true, min: 0, max: 100 },
    outcome: { type: String, enum: ["pass", "conditional", "fail"], required: true, index: true },
    inspectedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    inspectedAt: { type: Date, required: true, default: Date.now },
    followUpDueAt: Date,
  },
  { timestamps: true },
);
FacilityInspectionSchema.plugin(auditPlugin);
FacilityInspectionSchema.path("createdBy").required(true);
export const FacilityInspectionModel = model<IFacilityInspection>(
  "FacilityInspection",
  FacilityInspectionSchema,
);

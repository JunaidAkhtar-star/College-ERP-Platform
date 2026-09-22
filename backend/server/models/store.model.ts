/**
 * @file store.model.ts
 * @description Inventory / store management. Tracks consumable items and
 * non-consumable assets held by the Store/Maintenance staff.
 *
 * Two collections:
 *   - StoreItem    : the catalogue (name, sku, category, unit, stock balance)
 *   - StoreRequest : a department/staff requisition against the catalogue
 */
import { Schema, model, type Types, type Document } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export type TStoreCategory =
  | "stationery"
  | "electronics"
  | "lab_equipment"
  | "furniture"
  | "maintenance"
  | "cleaning"
  | "other";

export interface IStoreItem extends Document {
  _id: Types.ObjectId;
  sku: string;
  name: string;
  category: TStoreCategory;
  unit: string; // pieces, boxes, litres, etc.
  currentStock: number;
  minStock: number;
  unitCost?: number;
  vendor?: string;
  location?: string; // shelf / room
  valuationMethod: "fifo" | "weighted_average";
  reorderQuantity: number;
  leadTimeDays: number;
  batchTracking: boolean;
  serialTracking: boolean;
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}

const StoreItemSchema = new Schema<IStoreItem>(
  {
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: [
        "stationery",
        "electronics",
        "lab_equipment",
        "furniture",
        "maintenance",
        "cleaning",
        "other",
      ],
      default: "other",
      index: true,
    },
    unit: { type: String, required: true, default: "pcs" },
    currentStock: { type: Number, required: true, default: 0, min: 0 },
    minStock: { type: Number, default: 0, min: 0 },
    unitCost: { type: Number, min: 0 },
    vendor: { type: String, trim: true },
    location: { type: String, trim: true },
    valuationMethod: {
      type: String,
      enum: ["fifo", "weighted_average"],
      default: "weighted_average",
    },
    reorderQuantity: { type: Number, default: 0, min: 0 },
    leadTimeDays: { type: Number, default: 0, min: 0, max: 365 },
    batchTracking: { type: Boolean, default: false },
    serialTracking: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

StoreItemSchema.plugin(auditPlugin);
StoreItemSchema.path("createdBy").required(true);

export const StoreItemModel = model<IStoreItem>("StoreItem", StoreItemSchema);

// ─────────────────────────────────────────────────────────────────────────────
// Requisition (request) sub-model
// ─────────────────────────────────────────────────────────────────────────────

export type TStoreRequestStatus = "pending" | "approved" | "issued" | "rejected";

export interface IStoreRequest extends Document {
  _id: Types.ObjectId;
  requestNumber: string;
  itemId: Types.ObjectId;
  itemName: string; // denormalised for display when item is later renamed
  quantity: number;
  requestedBy: Types.ObjectId;
  requestedByName: string;
  department?: Types.ObjectId;
  purpose?: string;
  status: TStoreRequestStatus;
  decidedBy?: Types.ObjectId;
  decidedAt?: Date;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  issuedBy?: Types.ObjectId;
  issuedAt?: Date;
  createdBy: Types.ObjectId;
}

const StoreRequestSchema = new Schema<IStoreRequest>(
  {
    requestNumber: { type: String, required: true, unique: true, trim: true },
    itemId: { type: Schema.Types.ObjectId, ref: "StoreItem", required: true, index: true },
    itemName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    requestedByName: { type: String, required: true },
    department: { type: Schema.Types.ObjectId, ref: "Department" },
    purpose: { type: String, trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "issued", "rejected"],
      default: "pending",
      index: true,
    },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User" },
    decidedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    issuedBy: { type: Schema.Types.ObjectId, ref: "User" },
    issuedAt: { type: Date },
    remarks: { type: String, trim: true },
  },
  { timestamps: true },
);

StoreRequestSchema.plugin(auditPlugin);
StoreRequestSchema.path("createdBy").required(true);

export const StoreRequestModel = model<IStoreRequest>("StoreRequest", StoreRequestSchema);

export interface IStoreStockMovement extends Document {
  itemId: Types.ObjectId;
  requestId?: Types.ObjectId;
  delta: number;
  balanceAfter: number;
  reason: string;
  sourceType?: string;
  sourceId?: Types.ObjectId;
  unitCost?: number;
  movementValue?: number;
  performedBy: Types.ObjectId;
  createdAt: Date;
}

const StoreStockMovementSchema = new Schema<IStoreStockMovement>(
  {
    itemId: { type: Schema.Types.ObjectId, ref: "StoreItem", required: true, index: true },
    requestId: { type: Schema.Types.ObjectId, ref: "StoreRequest" },
    delta: { type: Number, required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, trim: true },
    sourceType: { type: String, trim: true, index: true },
    sourceId: { type: Schema.Types.ObjectId },
    unitCost: { type: Number, min: 0 },
    movementValue: { type: Number, min: 0 },
    performedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

const immutableMovement = function () {
  throw new Error("Stock movements are append-only and cannot be changed or deleted");
};
StoreStockMovementSchema.pre("updateOne", immutableMovement);
StoreStockMovementSchema.pre("updateMany", immutableMovement);
StoreStockMovementSchema.pre("findOneAndUpdate", immutableMovement);
StoreStockMovementSchema.pre("deleteOne", immutableMovement);
StoreStockMovementSchema.pre("deleteMany", immutableMovement);
StoreStockMovementSchema.pre("findOneAndDelete", immutableMovement);

export const StoreStockMovementModel = model<IStoreStockMovement>(
  "StoreStockMovement",
  StoreStockMovementSchema,
);

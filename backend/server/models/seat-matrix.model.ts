/**
 * Seat Matrix Model
 *
 * Per-program, per-academic-year seat capacity buckets used by the admission
 * cell to plan and monitor allocations. The number of seats actually filled
 * (`allocatedSeats` / `availableSeats`) is NOT stored here — it is computed at
 * read time from `AdmissionApplicationModel`.
 */
import type { Document, Types } from "mongoose";
import mongoose, { Schema } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export interface ISeatMatrix extends Document {
  _id: Types.ObjectId;
  program: string;
  academicYear: string;
  totalSeats: number;
  /** Atomically reserved when an application is approved. */
  allocatedSeats: number;
  generalSeats: number;
  scSeats: number;
  stSeats: number;
  obcSeats: number;
  ewsSeats: number;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SeatMatrixSchema = new Schema<ISeatMatrix>(
  {
    program: {
      type: String,
      required: true,
      index: true,
    },
    academicYear: { type: String, required: true, trim: true, index: true },
    totalSeats: { type: Number, required: true, min: 0, default: 0 },
    allocatedSeats: { type: Number, required: true, min: 0, default: 0 },
    generalSeats: { type: Number, required: true, min: 0, default: 0 },
    scSeats: { type: Number, required: true, min: 0, default: 0 },
    stSeats: { type: Number, required: true, min: 0, default: 0 },
    obcSeats: { type: Number, required: true, min: 0, default: 0 },
    ewsSeats: { type: Number, required: true, min: 0, default: 0 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

SeatMatrixSchema.index({ program: 1, academicYear: 1 }, { unique: true });

SeatMatrixSchema.plugin(auditPlugin);

export const SeatMatrixModel = mongoose.model<ISeatMatrix>("SeatMatrix", SeatMatrixSchema);

import { Schema, model, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export interface IClassOperation extends Document {
  timetableId: Types.ObjectId;
  operationType: "extra_class";
  date: Date;
  startTime: string;
  endTime: string;
  subjectId: Types.ObjectId;
  subjectCode: string;
  subjectName: string;
  facultyId: Types.ObjectId;
  facultyName: string;
  roomId?: Types.ObjectId;
  roomNo: string;
  branchDepartmentIds: Types.ObjectId[];
  reason: string;
  status: "scheduled" | "cancelled" | "completed";
  createdBy: Types.ObjectId;
  cancelledBy?: Types.ObjectId;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClassOperationSchema = new Schema<IClassOperation>(
  {
    timetableId: { type: Schema.Types.ObjectId, ref: "Timetable", required: true, index: true },
    operationType: { type: String, enum: ["extra_class"], default: "extra_class" },
    date: { type: Date, required: true, index: true },
    startTime: { type: String, required: true, match: /^(?:[01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, required: true, match: /^(?:[01]\d|2[0-3]):[0-5]\d$/ },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    subjectCode: { type: String, required: true, trim: true },
    subjectName: { type: String, required: true, trim: true },
    facultyId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    facultyName: { type: String, required: true, trim: true },
    roomId: { type: Schema.Types.ObjectId, ref: "FacilitySpace" },
    roomNo: { type: String, required: true, trim: true, uppercase: true },
    branchDepartmentIds: [{ type: Schema.Types.ObjectId, ref: "Department", required: true }],
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["scheduled", "cancelled", "completed"],
      default: "scheduled",
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, trim: true },
  },
  { timestamps: true },
);

ClassOperationSchema.index({ facultyId: 1, date: 1, status: 1 });
ClassOperationSchema.index({ roomNo: 1, date: 1, status: 1 });
ClassOperationSchema.index({ timetableId: 1, date: 1, status: 1 });
ClassOperationSchema.plugin(auditPlugin);

export const ClassOperationModel = model<IClassOperation>("ClassOperation", ClassOperationSchema);

import { auditPlugin } from "../plugins/audit.plugin";
import type { Types, Document } from "mongoose";
import { Schema, model } from "mongoose";

export interface IFacultyAttendance extends Document {
  facultyId: Types.ObjectId;
  departmentId: Types.ObjectId;
  date: Date;
  checkInTime?: string; // "09:05"
  checkOutTime?: string; // "17:30"
  status: "present" | "absent" | "on_leave" | "half_day" | "late";
  leaveType?:
    | "casual"
    | "sick"
    | "earned"
    | "on_duty"
    | "maternity"
    | "paternity"
    | "special"
    | "loss_of_pay";
  leaveRequestId?: Types.ObjectId;
  remarks?: string;
  markedBy?: Types.ObjectId; // If admin/HR marked it
  isLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FacultyAttendanceSchema = new Schema<IFacultyAttendance>(
  {
    facultyId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    date: { type: Date, required: true },
    checkInTime: { type: String },
    checkOutTime: { type: String },
    status: {
      type: String,
      enum: ["present", "absent", "on_leave", "half_day", "late"],
      required: true,
    },
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
    },
    leaveRequestId: { type: Schema.Types.ObjectId, ref: "LeaveRequest" },
    remarks: { type: String, trim: true },
    markedBy: { type: Schema.Types.ObjectId, ref: "User" },
    isLocked: { type: Boolean, default: false },
  },
  { timestamps: true },
);

FacultyAttendanceSchema.index({ facultyId: 1, date: 1 }, { unique: true });
FacultyAttendanceSchema.index({ departmentId: 1, date: 1 });

// Apply audit plugin (soft delete + createdBy/updatedBy)
FacultyAttendanceSchema.plugin(auditPlugin);

export const FacultyAttendanceModel = model<IFacultyAttendance>(
  "FacultyAttendance",
  FacultyAttendanceSchema,
);

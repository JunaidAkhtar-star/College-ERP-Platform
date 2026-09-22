import createError from "http-errors";
import { facultyAttendanceRepository, facultyProfileRepository } from "../repositories";
import { LeaveRequestModel } from "../models/leave.model";

export const FACULTY_ATTENDANCE_STATUSES = [
  "present",
  "absent",
  "on_leave",
  "half_day",
  "late",
] as const;
type FacultyAttendanceStatus = (typeof FACULTY_ATTENDANCE_STATUSES)[number];

export function normalizeAttendanceDate(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function attendanceEquivalent(status: FacultyAttendanceStatus): number {
  if (status === "present" || status === "late") return 1;
  if (status === "half_day") return 0.5;
  return 0;
}

function assertTime(value: unknown, field: string) {
  if (value !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value))) {
    throw createError(400, `${field} must use HH:mm format`);
  }
}

export async function getFacultyAttendanceContext(facultyId: string) {
  const profile = await facultyProfileRepository.findByUserId(facultyId);
  if (!profile) throw createError(404, "Active faculty profile not found");
  if (profile.status !== "active" && profile.status !== "on_leave") {
    throw createError(409, "Attendance cannot be marked for an inactive faculty member");
  }
  const department = profile.department as unknown as {
    _id?: { toString(): string };
    toString(): string;
  };
  return { profile, departmentId: (department._id ?? department).toString() };
}

export const facultyAttendanceService = {
  getAll: (filter: Record<string, unknown>, page: number, limit: number) =>
    facultyAttendanceRepository.list(filter, page, limit),

  getFacultyContext: getFacultyAttendanceContext,

  markAttendance: async (facultyId: string, dateInput: Date, data: Record<string, unknown>) => {
    if (!FACULTY_ATTENDANCE_STATUSES.includes(data.status as FacultyAttendanceStatus)) {
      throw createError(400, "Invalid faculty attendance status");
    }
    if (!Number.isFinite(dateInput.getTime()))
      throw createError(400, "Valid attendance date required");
    const date = normalizeAttendanceDate(dateInput);
    const today = normalizeAttendanceDate(new Date());
    if (date > today) throw createError(400, "Faculty attendance cannot be marked in the future");
    if (date.getTime() < today.getTime() - 7 * 86400000) {
      throw createError(403, "Faculty attendance older than seven days is locked");
    }

    const { departmentId } = await getFacultyAttendanceContext(facultyId);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    const approvedLeave = await LeaveRequestModel.findOne({
      employeeId: facultyId,
      status: "approved",
      fromDate: { $lte: dayEnd },
      toDate: { $gte: date },
    })
      .select("_id leaveType")
      .lean();

    let status = data.status as FacultyAttendanceStatus;
    if (approvedLeave) status = "on_leave";
    if (status === "on_leave" && !approvedLeave) {
      throw createError(
        409,
        "On-leave attendance requires an approved leave request for this date",
      );
    }
    assertTime(data.checkInTime, "checkInTime");
    assertTime(data.checkOutTime, "checkOutTime");
    if (["present", "late", "half_day"].includes(status) && !data.checkInTime) {
      throw createError(400, "Check-in time is required for attended days");
    }
    if (
      data.checkInTime &&
      data.checkOutTime &&
      String(data.checkOutTime) <= String(data.checkInTime)
    ) {
      throw createError(400, "Check-out time must be after check-in time");
    }

    const patch = {
      status,
      departmentId,
      checkInTime: status === "on_leave" ? undefined : data.checkInTime,
      checkOutTime: status === "on_leave" ? undefined : data.checkOutTime,
      leaveType: approvedLeave?.leaveType,
      leaveRequestId: approvedLeave?._id,
      remarks: data.remarks,
      markedBy: data.markedBy,
    };
    const existing = await facultyAttendanceRepository.findByFacultyDate(facultyId, date);
    if (existing?.isLocked) throw createError(409, "Faculty attendance record is locked");
    if (existing) {
      const updated = await facultyAttendanceRepository.updateUnlockedById(
        existing._id.toString(),
        patch,
      );
      if (!updated) throw createError(409, "Faculty attendance was concurrently locked");
      return updated;
    }
    try {
      return await facultyAttendanceRepository.create({ facultyId, date, ...patch });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw createError(409, "Faculty attendance was already marked for this date");
      }
      throw error;
    }
  },

  getMonthlySummary: (facultyId: string, month: number, year: number) =>
    facultyAttendanceRepository.getMonthlySummary(facultyId, month, year),

  getDepartmentSummary: (
    departmentId: string,
    month: number,
    year: number,
    startDate?: Date,
    endDate?: Date,
  ) =>
    facultyAttendanceRepository.getDepartmentSummary(departmentId, month, year, startDate, endDate),
};

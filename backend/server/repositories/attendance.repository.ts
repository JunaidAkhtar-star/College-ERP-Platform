import { Types } from "mongoose";
import type { MongoFilter } from "../types/mongoose.types";
import {
  AttendanceRecordModel,
  StudentAttendanceSummaryModel,
  AttendanceStatus,
  type IAttendanceRecord,
  type IStudentAttendanceSummary,
} from "../models";

function toId(val?: unknown): Types.ObjectId | unknown {
  if (val && typeof val === "string" && Types.ObjectId.isValid(val)) {
    return new Types.ObjectId(val);
  }
  return val;
}

function withAttendanceTotals(data: Record<string, unknown>) {
  const entries = data["entries"];
  if (!Array.isArray(entries)) return data;

  const totalPresent = entries.filter((entry) =>
    [AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.OD].includes(
      (entry as { status: AttendanceStatus }).status,
    ),
  ).length;

  return {
    ...data,
    totalPresent,
    totalAbsent: entries.length - totalPresent,
    totalStrength: entries.length,
  };
}

export const attendanceRepository = {
  // ─── Records ──────────────────────────────────────────────────────────────

  findRecord: (
    subjectId: string,
    date: Date,
    section: string,
    periodNumber: number,
    sectionId?: string,
    timetableSlotId?: string,
    timetableId?: string,
  ) => {
    const sId = toId(subjectId);
    const secId = toId(sectionId);
    const slotId = toId(timetableSlotId);
    const ttId = toId(timetableId);

    const query = {
      date,
      $or: [
        ...(slotId ? [{ timetableSlotId: slotId }] : []),
        ...(ttId ? [{ timetableId: ttId, subjectId: sId, periodNumber }] : []),
        secId
          ? { subjectId: sId, sectionId: secId, periodNumber }
          : { subjectId: sId, section, periodNumber },
      ],
    } as MongoFilter<IAttendanceRecord>;

    return AttendanceRecordModel.findOne(query).lean();
  },

  findRecordById: (id: string) => AttendanceRecordModel.findById(id).lean(),

  createRecord: (data: Record<string, unknown>) => AttendanceRecordModel.create(data),

  updateRecord: (id: string, data: Record<string, unknown>) => {
    const hasOperator = Object.keys(data).some((key) => key.startsWith("$"));
    const update = hasOperator ? data : { $set: withAttendanceTotals(data) };
    return AttendanceRecordModel.findByIdAndUpdate(id, update, {
      runValidators: true,
      returnDocument: "after",
    }).lean();
  },

  updatePendingCorrection: (id: string, correctionIdx: number, data: Record<string, unknown>) =>
    AttendanceRecordModel.findOneAndUpdate(
      { _id: id, [`correctionRequests.${correctionIdx}.status`]: "pending" },
      { $set: withAttendanceTotals(data) },
      { runValidators: true, returnDocument: "after" },
    ).lean(),

  listByFacultyDate: (facultyId: string, date: Date) => {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    const fId = toId(facultyId);
    const query = {
      $or: [{ facultyId: fId }, { createdBy: fId }],
      date: { $gte: date, $lt: nextDate },
    } as MongoFilter<IAttendanceRecord>;
    return AttendanceRecordModel.find(query).sort({ periodNumber: 1 }).lean();
  },

  listRecords: (filter: {
    facultyId?: string;
    departmentId?: string;
    createdBy?: string;
    startDate?: Date;
    endDate?: Date;
    subjectId?: string;
    sectionId?: string;
  }) => {
    const query: Record<string, unknown> = {};
    const fId = toId(filter.facultyId);
    const dId = toId(filter.departmentId);
    const cId = toId(filter.createdBy);
    const sId = toId(filter.subjectId);
    const secId = toId(filter.sectionId);

    if (filter.facultyId && filter.departmentId) {
      query.$or = [{ facultyId: fId }, { createdBy: fId }, { departmentId: dId }];
    } else if (filter.departmentId && filter.createdBy) {
      query.$or = [{ departmentId: dId }, { createdBy: cId }, { facultyId: cId }];
    } else if (filter.facultyId) {
      query.$or = [{ facultyId: fId }, { createdBy: fId }];
    } else if (filter.departmentId) {
      query.departmentId = dId;
    }

    if (filter.subjectId) {
      query.subjectId = sId;
    }
    if (filter.sectionId) {
      query.sectionId = secId;
    }
    if (filter.startDate && filter.endDate) {
      query.date = { $gte: filter.startDate, $lte: filter.endDate };
    } else if (filter.startDate) {
      const nextDate = new Date(filter.startDate);
      nextDate.setDate(nextDate.getDate() + 1);
      query.date = { $gte: filter.startDate, $lt: nextDate };
    }
    return AttendanceRecordModel.find(query as MongoFilter<IAttendanceRecord>)
      .populate("facultyId", "name email")
      .populate("departmentId", "name code")
      .sort({ date: -1, periodNumber: 1 })
      .lean();
  },

  listByStudentDateRange: (studentId: string, from: Date, to: Date) =>
    AttendanceRecordModel.find({
      "entries.studentId": studentId,
      date: { $gte: from, $lte: to },
    })
      .select(
        "subjectCode subjectName date periodNumber startTime endTime entries correctionRequests isLocked",
      )
      .sort({ date: -1, periodNumber: -1 })
      .limit(100)
      .lean(),

  listBySubject: (subjectId: string, from: Date, to: Date, scope: Record<string, unknown> = {}) => {
    const sId = toId(subjectId);
    const q: Record<string, unknown> = { subjectId: sId, date: { $gte: from, $lte: to } };
    if (scope["facultyId"]) q["facultyId"] = toId(scope["facultyId"]);
    if (scope["departmentId"]) q["departmentId"] = toId(scope["departmentId"]);
    return AttendanceRecordModel.find(q as MongoFilter<IAttendanceRecord>)
      .populate("facultyId", "name email")
      .populate("departmentId", "name code")
      .sort({ date: 1 })
      .lean();
  },

  listPendingCorrections: (filter: Record<string, unknown> = {}) =>
    AttendanceRecordModel.find({ ...filter, "correctionRequests.status": "pending" })
      .populate("correctionRequests.studentId", "name email")
      .sort({ date: -1, periodNumber: 1 })
      .lean(),

  lockOldRecords: async () => {
    const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return AttendanceRecordModel.updateMany(
      { isLocked: false, date: { $lt: threshold } },
      { $set: { isLocked: true, lockedAt: new Date() } },
    );
  },

  /** Lock all attendance records for a given academic year (semester-end lock — SRS §8.2) */
  lockSemesterAttendance: async (academicYear: string) => {
    return AttendanceRecordModel.updateMany(
      { isLocked: false, academicYear },
      { $set: { isLocked: true, lockedAt: new Date(), lockedReason: "semester_end" } },
    );
  },

  getSummary: (studentId: string, subjectId: string, academicYear: string) => {
    const stId = toId(studentId);
    const sId = toId(subjectId);
    const query = {
      studentId: stId,
      subjectId: sId,
      academicYear,
    } as MongoFilter<IStudentAttendanceSummary>;
    return StudentAttendanceSummaryModel.findOne(query).lean();
  },

  getStudentAllSummaries: (studentId: string, semester: number, academicYear: string) => {
    const stId = toId(studentId);
    const query = {
      studentId: stId,
      semester,
      academicYear,
    } as MongoFilter<IStudentAttendanceSummary>;
    return StudentAttendanceSummaryModel.find(query).populate("subjectId", "name code").lean();
  },

  upsertSummary: (
    studentId: string,
    subjectId: string,
    academicYear: string,
    data: Record<string, unknown>,
  ) => {
    const stId = toId(studentId);
    const sId = toId(subjectId);
    const query = {
      studentId: stId,
      subjectId: sId,
      academicYear,
    } as MongoFilter<IStudentAttendanceSummary>;
    return StudentAttendanceSummaryModel.findOneAndUpdate(
      query,
      { $set: { ...data, lastUpdated: new Date() } },
      { upsert: true, runValidators: true },
    ).lean();
  },

  getShortageStudents: (semester: number, academicYear: string) =>
    StudentAttendanceSummaryModel.find({ semester, academicYear, isShortage: true })
      .populate("studentId", "name email avatar")
      .populate("subjectId", "name code")
      .lean(),

  // Recompute summary from raw records
  recomputeSummary: async (
    studentId: string,
    subjectId: string,
    academicYear: string,
    semester: number,
  ) => {
    const records = await AttendanceRecordModel.find({
      subjectId,
      academicYear,
      "entries.studentId": studentId,
    }).lean();

    let total = 0,
      attended = 0,
      absent = 0,
      late = 0,
      od = 0,
      medical = 0;
    let rollNumber = "";
    let subjectCode = "";
    for (const rec of records) {
      const entry = rec.entries.find((e) => e.studentId.toString() === studentId);
      if (!entry) continue;
      rollNumber ||= entry.rollNumber;
      subjectCode ||= rec.subjectCode;
      if (entry.status === AttendanceStatus.HOLIDAY) continue;
      total++;
      if (entry.status === AttendanceStatus.PRESENT) attended++;
      else if (entry.status === AttendanceStatus.ABSENT) absent++;
      else if (entry.status === AttendanceStatus.LATE) {
        attended++;
        late++;
      } else if (entry.status === AttendanceStatus.OD) {
        attended++;
        od++;
      } else if (entry.status === AttendanceStatus.MEDICAL) medical++;
    }

    const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;

    return StudentAttendanceSummaryModel.findOneAndUpdate(
      { studentId, subjectId, academicYear },
      {
        $set: {
          rollNumber,
          subjectCode,
          semester,
          totalClasses: total,
          attended,
          absent,
          late,
          onDuty: od,
          medicalLeave: medical,
          percentage,
          isShortage: total > 0 && percentage < 75,
          lastUpdated: new Date(),
        },
      },
      { upsert: true },
    ).lean();
  },

  /**
   * Batch recompute summaries for all students of a subject in one aggregation pass.
   * Replaces the N+1 per-student recomputeSummary calls — O(1) DB round-trips.
   */
  batchRecomputeSummaries: async (
    subjectId: string,
    academicYear: string,
    semester: number,
    studentIds: string[],
  ) => {
    const { Types } = await import("mongoose");
    const studentObjIds = studentIds.map((id) => new Types.ObjectId(id));

    // One aggregation to compute counts per student
    const stats: Array<{
      _id: string;
      rollNumber: string;
      subjectCode: string;
      total: number;
      attended: number;
      absent: number;
      late: number;
      od: number;
      medical: number;
    }> = await AttendanceRecordModel.aggregate([
      {
        $match: {
          subjectId: new Types.ObjectId(subjectId),
          academicYear,
          "entries.studentId": { $in: studentObjIds },
        },
      },
      { $unwind: "$entries" },
      { $match: { "entries.studentId": { $in: studentObjIds } } },
      {
        $group: {
          _id: "$entries.studentId",
          rollNumber: { $first: "$entries.rollNumber" },
          subjectCode: { $first: "$subjectCode" },
          total: {
            $sum: {
              $cond: [{ $ne: ["$entries.status", AttendanceStatus.HOLIDAY] }, 1, 0],
            },
          },
          attended: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$entries.status",
                    [AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.OD],
                  ],
                },
                1,
                0,
              ],
            },
          },
          absent: {
            $sum: { $cond: [{ $eq: ["$entries.status", AttendanceStatus.ABSENT] }, 1, 0] },
          },
          late: {
            $sum: { $cond: [{ $eq: ["$entries.status", AttendanceStatus.LATE] }, 1, 0] },
          },
          od: { $sum: { $cond: [{ $eq: ["$entries.status", AttendanceStatus.OD] }, 1, 0] } },
          medical: {
            $sum: { $cond: [{ $eq: ["$entries.status", AttendanceStatus.MEDICAL] }, 1, 0] },
          },
        },
      },
    ]);

    // Bulk-write summaries
    const sId = toId(subjectId);
    const ops = stats.map((s) => {
      const percentage = s.total > 0 ? Math.round((s.attended / s.total) * 100) : 0;
      return {
        updateOne: {
          filter: { studentId: s._id, subjectId: sId, academicYear },
          update: {
            $set: {
              semester,
              rollNumber: s.rollNumber,
              subjectCode: s.subjectCode,
              totalClasses: s.total,
              attended: s.attended,
              absent: s.absent,
              late: s.late,
              onDuty: s.od,
              medicalLeave: s.medical,
              percentage,
              isShortage: s.total > 0 && percentage < 75,
              lastUpdated: new Date(),
            },
          },
          upsert: true,
        },
      };
    });

    if (ops.length > 0) {
      await StudentAttendanceSummaryModel.bulkWrite(
        ops as Parameters<typeof StudentAttendanceSummaryModel.bulkWrite>[0],
      );
    }

    return stats;
  },
};

import createError from "http-errors";
import { Types } from "mongoose";
import {
  attendanceRepository,
  sectionRepository,
  studentSectionAllotmentRepository,
  subjectRepository,
  timetableRepository,
} from "../repositories";
import {
  AttendanceRecordModel,
  AttendanceStatus,
  ClassType,
  type IAttendanceRecord,
} from "../models";
import { StudentProfileModel, StudentStatus } from "../models/student-profile.model";
import { logger } from "../utils/logger.util";
import { tenantLocalStorage } from "../configs/connectionManager";
import { formatIndiaDate } from "../utils/date.util";

export const attendanceService = {
  // Mark attendance for a class session
  markAttendance: async (data: {
    sectionId?: string;
    timetableId?: string;
    timetableSlotId?: string;
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    facultyId: string;
    departmentId: string;
    classType?: ClassType;
    program: string;
    branch: string;
    semester: number;
    section: string;
    academicYear: string;
    date: string;
    startTime: string;
    endTime: string;
    periodNumber: number;
    entries?: Array<{
      studentId: string;
      rollNumber: string;
      status: AttendanceStatus;
      remarks?: string;
    }>;
    requireAssignedSlot?: boolean;
    allowedDepartmentId?: string;
    allowLateOverride?: boolean;
  }) => {
    const submittedDate = parseAttendanceDate(data.date);
    if (!submittedDate) {
      throw createError(400, "Valid attendance date required");
    }
    if (data.requireAssignedSlot) {
      if (!data.timetableId || !data.timetableSlotId) {
        throw createError(403, "Faculty attendance must be marked from an assigned timetable slot");
      }
      const timetable = await timetableRepository.findById(data.timetableId);
      if (!timetable) throw createError(404, "Timetable not found");
      if (!timetable.isActive || !timetable.isApproved) {
        throw createError(403, "Attendance can be marked only from an active approved timetable");
      }
      const slotIndex = (timetable.slots ?? []).findIndex(
        (s) => s._id?.toString() === data.timetableSlotId,
      );
      const slot = slotIndex >= 0 ? timetable.slots[slotIndex] : undefined;
      if (!slot) throw createError(404, "Timetable slot not found");
      if (
        !slot.facultyId ||
        !slot.subjectId ||
        slot.slotKind === "break" ||
        slot.slotKind === "activity"
      ) {
        throw createError(400, "Attendance is available only for teaching timetable slots");
      }
      const attendanceDate = attendanceDateKey(submittedDate);
      const isActiveSubstitute = (timetable.substituteLog ?? []).some(
        (entry) =>
          entry.status !== "cancelled" &&
          entry.slotIndex === slotIndex &&
          entry.substituteFacultyId.toString() === data.facultyId &&
          attendanceDateKey(new Date(entry.date)) === attendanceDate,
      );
      if (slot.facultyId.toString() !== data.facultyId && !isActiveSubstitute) {
        throw createError(403, "Faculty can mark attendance only for assigned slots");
      }
      if (slot.subjectId.toString() !== data.subjectId) {
        throw createError(400, "Selected subject does not match the assigned timetable slot");
      }
      const weekdays = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      if (slot.day !== weekdays[submittedDate.getDay()]) {
        throw createError(400, "Selected timetable slot does not occur on the attendance date");
      }
      data.sectionId = data.sectionId || timetable.sectionId?.toString();
      const slotDepartmentIds = slot.branchDepartmentIds?.length
        ? slot.branchDepartmentIds.map(String)
        : [String(slot.branchDepartmentId ?? timetable.departmentId)];
      if (data.allowedDepartmentId && !slotDepartmentIds.includes(data.allowedDepartmentId)) {
        throw createError(403, "This class is outside your department");
      }
      data.departmentId = data.allowedDepartmentId ?? slotDepartmentIds[0]!;
      data.subjectCode = slot.subjectCode;
      data.subjectName = slot.subjectName;
      data.startTime = slot.startTime;
      data.endTime = slot.endTime;
      data.periodNumber = slot.periodNo;
    }

    if (data.sectionId) {
      if (!Types.ObjectId.isValid(data.sectionId)) throw createError(400, "Valid section required");
      const section = await sectionRepository.findRawById(data.sectionId);
      if (!section) throw createError(404, "Section not found");
      const roster = await studentSectionAllotmentRepository.findActiveBySection(data.sectionId);
      if (!roster.length) throw createError(400, "No active students allotted to this section");
      const rosterStudentIds = new Set(roster.map((a) => a.studentId.toString()));

      data.departmentId = section.departmentId.toString();
      data.program = section.program;
      data.branch = section.departmentCode;
      data.semester = section.semesterNo;
      data.section = section.sectionName;
      data.academicYear = section.academicYear;
      if (data.allowedDepartmentId && data.departmentId !== data.allowedDepartmentId) {
        throw createError(403, "You can mark attendance only for your department");
      }
      const subject = await subjectRepository.findById(data.subjectId);
      if (!subject || !subject.isActive) throw createError(404, "Active subject not found");
      if (subject.departmentId.toString() !== data.departmentId) {
        throw createError(400, "Subject does not belong to the selected section department");
      }
      if (subject.semester && subject.semester !== data.semester) {
        throw createError(400, "Subject does not belong to the selected section semester");
      }
      data.subjectCode = subject.code;
      data.subjectName = subject.name;

      if (!data.entries?.length) {
        data.entries = roster.map((a) => ({
          studentId: a.studentId.toString(),
          rollNumber: a.rollNo,
          status: AttendanceStatus.ABSENT,
        }));
      } else {
        const entryStudentIds = data.entries.map((e) => e.studentId);
        const duplicate = entryStudentIds.find(
          (id, index) => entryStudentIds.indexOf(id) !== index,
        );
        if (duplicate) throw createError(400, "Duplicate student entry in attendance roster");
        const outsideSection = entryStudentIds.find((id) => !rosterStudentIds.has(id));
        if (outsideSection) {
          throw createError(400, "Attendance contains a student outside the selected section");
        }
        const missingStudent = roster.find(
          (allotment) => !entryStudentIds.includes(allotment.studentId.toString()),
        );
        if (missingStudent) {
          throw createError(400, "Attendance must include every active student in the section");
        }
        const submittedByStudent = new Map(data.entries.map((entry) => [entry.studentId, entry]));
        data.entries = roster.map((allotment) => {
          const submitted = submittedByStudent.get(allotment.studentId.toString())!;
          return {
            studentId: allotment.studentId.toString(),
            rollNumber: allotment.rollNo,
            status: submitted.status,
            remarks: submitted.remarks,
          };
        });
      }
    }

    if (!data.sectionId && data.entries?.length) {
      const entryStudentIds = data.entries.map((entry) => entry.studentId);
      const duplicate = entryStudentIds.find(
        (studentId, index) => entryStudentIds.indexOf(studentId) !== index,
      );
      if (duplicate) throw createError(400, "Duplicate student entry in attendance roster");
      // Validate that all roster students are active institutional profiles (supports combined/multi-dept cohorts)
      const roster = await StudentProfileModel.find({
        $or: [{ userId: { $in: entryStudentIds } }, { _id: { $in: entryStudentIds } }],
        status: StudentStatus.ACTIVE,
      })
        .select("_id userId")
        .lean();
      const allowedStudentIds = new Set(
        roster.flatMap((profile) => [String(profile._id), String(profile.userId)]),
      );
      const outsideCohort = entryStudentIds.find((studentId) => !allowedStudentIds.has(studentId));
      if (outsideCohort) {
        throw createError(400, "Attendance contains an invalid or inactive student record");
      }
    }

    if (!data.entries?.length) throw createError(400, "Attendance roster is empty");
    const entries = data.entries;

    const dateObj = submittedDate;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dateObj > today) throw createError(400, "Attendance cannot be marked for a future date");
    if (!data.allowLateOverride && !canModifyAttendanceAt(dateObj, data.endTime, data.startTime)) {
      throw createError(403, "Attendance can be marked or changed only within 24 hours of class");
    }

    const existing = await attendanceRepository.findRecord(
      data.subjectId,
      dateObj,
      data.section,
      data.periodNumber,
      data.sectionId,
      data.timetableSlotId,
      data.timetableId,
    );
    if (existing) {
      if (existing.isLocked)
        throw createError(
          403,
          "Attendance record is locked after 24 hours. Contact admin to edit.",
        );
      // Update
      const updated = await attendanceRepository.updateRecord(existing._id.toString(), {
        entries,
        classType: data.classType || ClassType.LECTURE,
        facultyId: data.facultyId,
        timetableId: data.timetableId,
        timetableSlotId: data.timetableSlotId,
        startTime: data.startTime,
        endTime: data.endTime,
      });
      const currentStore = tenantLocalStorage.getStore();
      setImmediate(() => {
        if (currentStore && updated) {
          void tenantLocalStorage.run(currentStore, async () => {
            try {
              await attendanceService._recomputeSummaries(
                data.subjectId,
                entries.map((e) => e.studentId),
                data.semester,
                data.academicYear,
              );
              await attendanceService._sendAbsenceAlerts(
                updated as IAttendanceRecord,
                existing.entries.map((entry) => ({
                  studentId: entry.studentId,
                  status: entry.status,
                })),
              );
            } catch (err) {
              logger.error("[markAttendance] background update tasks failed", err);
            }
          });
        }
      });
      return updated;
    }

    const record = await attendanceRepository.createRecord({
      ...data,
      entries,
      date: dateObj,
      classType: data.classType || ClassType.LECTURE,
    });

    const currentStore = tenantLocalStorage.getStore();
    setImmediate(() => {
      if (currentStore && record) {
        void tenantLocalStorage.run(currentStore, async () => {
          try {
            await attendanceService._recomputeSummaries(
              data.subjectId,
              entries.map((e) => e.studentId),
              data.semester,
              data.academicYear,
            );
            await attendanceService._sendAbsenceAlerts(record as IAttendanceRecord);
          } catch (err) {
            logger.error("[markAttendance] background create tasks failed", err);
          }
        });
      }
    });

    return record;
  },

  // Internal: recompute and check shortage
  /**
   * Batch recompute all student summaries for a subject after marking attendance.
   * Uses one aggregation + bulkWrite instead of N individual DB calls (was N+1).
   */
  _recomputeSummaries: async (
    subjectId: string,
    studentIds: string[],
    semester: number,
    academicYear: string,
  ) => {
    try {
      const stats = await attendanceRepository.batchRecomputeSummaries(
        subjectId,
        academicYear,
        semester,
        studentIds,
      );
      // Log shortages (cron job handles actual notifications)
      for (const s of stats) {
        const pct = s.total > 0 ? Math.round((s.attended / s.total) * 100) : 0;
        if (s.total > 0 && pct < 75) {
          logger.warn(`[Attendance] Shortage: studentId=${s._id}, subject=${subjectId}, ${pct}%`);
        }
      }
    } catch (e) {
      logger.error("[Attendance] Batch summary recompute error", e);
      throw e;
    }
  },

  getRecord: async (id: string) => {
    const rec = await attendanceRepository.findRecordById(id);
    if (!rec) throw createError(404, "Attendance record not found");
    return rec;
  },

  getAttendanceRecords: async (filter: {
    departmentId?: string;
    facultyId?: string;
    createdBy?: string;
    date?: string;
    from?: string;
    to?: string;
    subjectId?: string;
    sectionId?: string;
  }) => {
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (filter.from && filter.to) {
      const parsedStart = parseAttendanceDate(filter.from);
      const parsedEnd = parseAttendanceDate(filter.to);
      if (!parsedStart || !parsedEnd) throw createError(400, "Valid attendance range required");
      if (parsedStart > parsedEnd) throw createError(400, "Range start must be before range end");
      startDate = parsedStart;
      const endOfToDay = new Date(parsedEnd);
      endOfToDay.setDate(endOfToDay.getDate() + 1);
      endOfToDay.setMilliseconds(-1);
      endDate = endOfToDay;
    } else if (filter.date) {
      const parsed = parseAttendanceDate(filter.date);
      if (!parsed) throw createError(400, "Valid attendance date required");
      startDate = parsed;
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startDate = today;
    }

    const records = await attendanceRepository.listRecords({
      departmentId: filter.departmentId,
      facultyId: filter.facultyId,
      createdBy: filter.createdBy,
      startDate,
      endDate,
      subjectId: filter.subjectId,
      sectionId: filter.sectionId,
    });

    const studentIds = [
      ...new Set(
        records.flatMap((record) => record.entries.map((entry) => entry.studentId.toString())),
      ),
    ];
    const profiles = studentIds.length
      ? await StudentProfileModel.find({
          $or: [{ userId: { $in: studentIds } }, { _id: { $in: studentIds } }],
        })
          .select(
            "userId firstName middleName lastName rollNumber department program currentSemester",
          )
          .populate("userId", "name")
          .populate("department", "name code")
          .lean()
      : [];

    const profileByStudentId = new Map<string, (typeof profiles)[number]>();
    for (const profile of profiles) {
      const linkedUser = profile.userId as unknown as { _id?: Types.ObjectId; name?: string };
      profileByStudentId.set(String(profile._id), profile);
      if (linkedUser?._id) profileByStudentId.set(String(linkedUser._id), profile);
    }

    return records.map((record) => {
      const faculty = record.facultyId as unknown as
        | { _id?: Types.ObjectId; name?: string; email?: string }
        | undefined;
      const dept = record.departmentId as unknown as
        | { _id?: Types.ObjectId; name?: string; code?: string }
        | undefined;
      return {
        ...record,
        facultyId: faculty?._id ? String(faculty._id) : String(record.facultyId || ""),
        facultyName: faculty?.name || "Faculty",
        facultyEmail: faculty?.email,
        departmentName: dept?.name,
        departmentCode: dept?.code,
        entries: record.entries.map((entry) => {
          const profile = profileByStudentId.get(entry.studentId.toString());
          const linkedUser = profile?.userId as unknown as
            | { _id?: Types.ObjectId; name?: string }
            | undefined;
          const department = profile?.department as unknown as
            | { name?: string; code?: string }
            | undefined;
          return {
            ...entry,
            studentId: entry.studentId.toString(),
            studentName:
              [profile?.firstName, profile?.middleName, profile?.lastName]
                .filter(Boolean)
                .join(" ") ||
              linkedUser?.name ||
              "Student",
            rollNumber: entry.rollNumber || profile?.rollNumber || "—",
            departmentCode: department?.code ?? department?.name ?? record.branch,
            program: profile?.program ?? record.program,
            semester: profile?.currentSemester ?? record.semester,
          };
        }),
      };
    });
  },

  getByFacultyDate: (facultyId: string, date: string) =>
    attendanceService.getAttendanceRecords({ facultyId, date }),

  getByFacultyDateRange: async (facultyId: string, from: string, to: string) =>
    attendanceService.getAttendanceRecords({ facultyId, from, to }),

  getStudentRecords: async (studentId: string, from: string, to: string) => {
    const fromDate = parseAttendanceDate(from);
    const toDate = parseAttendanceDate(to);
    if (!fromDate || !toDate) throw createError(400, "Valid attendance date range required");
    const throughDate = new Date(toDate);
    throughDate.setDate(throughDate.getDate() + 1);
    throughDate.setMilliseconds(-1);
    const records = await attendanceRepository.listByStudentDateRange(
      studentId,
      fromDate,
      throughDate,
    );
    return records.map((record) => ({
      ...record,
      entries: record.entries.filter((entry) => entry.studentId.toString() === studentId),
      correctionRequests: record.correctionRequests?.filter(
        (request) => request.studentId.toString() === studentId,
      ),
    }));
  },

  getBySubject: async (
    subjectId: string,
    from: string,
    to: string,
    scope: Record<string, unknown> = {},
  ) => {
    const fromDate = parseAttendanceDate(from);
    const toDate = parseAttendanceDate(to);
    if (!fromDate || !toDate) throw createError(400, "Valid attendance date range required");
    const throughDate = new Date(toDate);
    throughDate.setDate(throughDate.getDate() + 1);
    throughDate.setMilliseconds(-1);
    return attendanceRepository.listBySubject(subjectId, fromDate, throughDate, scope);
  },

  getStudentSummary: async (studentId: string, semester: number, academicYear: string) => {
    const summaries = await attendanceRepository.getStudentAllSummaries(
      studentId,
      semester,
      academicYear,
    );

    if (!summaries || summaries.length === 0) {
      const studentObjId = Types.ObjectId.isValid(studentId)
        ? new Types.ObjectId(studentId)
        : studentId;
      const records = await AttendanceRecordModel.find({
        "entries.studentId": studentObjId,
        semester,
        academicYear,
      })
        .populate("subjectId", "name code")
        .lean();

      if (records.length > 0) {
        const subjectMap = new Map<
          string,
          {
            subjectId: string;
            subjectCode: string;
            subjectName: string;
            rollNumber: string;
            totalClasses: number;
            attended: number;
            absent: number;
            late: number;
            onDuty: number;
            medicalLeave: number;
          }
        >();

        for (const rec of records) {
          const entry = rec.entries.find(
            (e: { studentId: unknown; status?: AttendanceStatus; rollNumber?: string }) =>
              String(e.studentId) === String(studentId),
          );
          if (!entry || entry.status === AttendanceStatus.HOLIDAY) continue;

          const sObj = rec.subjectId as unknown as
            | { _id?: { toString(): string }; name?: string; code?: string }
            | undefined;
          const sId = String(sObj?._id ?? rec.subjectId);
          const sCode = rec.subjectCode || sObj?.code || "";
          const sName = rec.subjectName || sObj?.name || "";

          if (!subjectMap.has(sId)) {
            subjectMap.set(sId, {
              subjectId: sId,
              subjectCode: sCode,
              subjectName: sName,
              rollNumber: entry.rollNumber || "",
              totalClasses: 0,
              attended: 0,
              absent: 0,
              late: 0,
              onDuty: 0,
              medicalLeave: 0,
            });
          }

          const stats = subjectMap.get(sId)!;
          stats.totalClasses++;
          if (entry.status === AttendanceStatus.PRESENT) stats.attended++;
          else if (entry.status === AttendanceStatus.ABSENT) stats.absent++;
          else if (entry.status === AttendanceStatus.LATE) {
            stats.attended++;
            stats.late++;
          } else if (entry.status === AttendanceStatus.OD) {
            stats.attended++;
            stats.onDuty++;
          } else if (entry.status === AttendanceStatus.MEDICAL) {
            stats.medicalLeave++;
          }
        }

        return Array.from(subjectMap.values()).map((s) => {
          const percentage =
            s.totalClasses > 0 ? Math.round((s.attended / s.totalClasses) * 100) : 0;
          return {
            ...s,
            semester,
            academicYear,
            percentage,
            isShortage: percentage < 75,
          };
        });
      }
    }

    return summaries.map((summary) => {
      const subject = summary.subjectId as unknown as {
        _id?: { toString(): string };
        name?: string;
        code?: string;
      };
      return {
        ...summary,
        subjectId: subject?._id?.toString() ?? String(summary.subjectId),
        subjectCode: summary.subjectCode || subject?.code || "",
        subjectName: subject?.name ?? null,
      };
    });
  },

  getSubjectSummary: (studentId: string, subjectId: string, academicYear: string) =>
    attendanceRepository.getSummary(studentId, subjectId, academicYear),

  getShortageList: async (semester: number, academicYear: string, departmentId?: string) => {
    const summaries = await attendanceRepository.getShortageStudents(semester, academicYear);
    const studentIds = summaries.map((summary) => {
      const student = summary.studentId as unknown as { _id?: { toString(): string } };
      return student?._id?.toString() ?? String(summary.studentId);
    });
    const studentObjIds = studentIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    const deptObjId =
      departmentId && Types.ObjectId.isValid(departmentId)
        ? new Types.ObjectId(departmentId)
        : undefined;
    const profiles = await StudentProfileModel.find({
      $or: [{ userId: { $in: studentObjIds } }, { _id: { $in: studentObjIds } }],
      ...(deptObjId ? { department: deptObjId } : {}),
    })
      .select("userId program department")
      .populate("department", "name code")
      .lean();
    const profileByUser = new Map<string, (typeof profiles)[number]>();
    for (const profile of profiles) {
      profileByUser.set(String(profile.userId), profile);
      profileByUser.set(String(profile._id), profile);
    }

    return summaries.flatMap((summary) => {
      const student = summary.studentId as unknown as {
        _id?: { toString(): string };
        name?: string;
      };
      const studentId = student?._id?.toString() ?? String(summary.studentId);
      const profile = profileByUser.get(studentId);
      if (!profile) return [];
      const subject = summary.subjectId as unknown as {
        _id?: { toString(): string };
        name?: string;
        code?: string;
      };
      const department = profile.department as unknown as { name?: string; code?: string };
      return [
        {
          ...summary,
          studentId,
          studentName: student?.name ?? "Student",
          rollNo: summary.rollNumber,
          program: profile.program,
          branch: department?.code ?? department?.name ?? null,
          subjectId: subject?._id?.toString() ?? String(summary.subjectId),
          subjectCode: summary.subjectCode || subject?.code || "",
          subjectName: subject?.name ?? null,
        },
      ];
    });
  },

  getPendingCorrections: (filter: Record<string, unknown> = {}) =>
    attendanceRepository.listPendingCorrections(filter),

  lockOldRecords: () => attendanceRepository.lockOldRecords(),

  /** Semester-end lock: permanently lock all records for the given academic year (SRS §8.2) */
  lockSemesterAttendance: (academicYear: string) =>
    attendanceRepository.lockSemesterAttendance(academicYear),

  // Edit attendance (admin only, for corrections)
  editAttendance: async (
    recordId: string,
    entries: Array<{
      studentId: string;
      rollNumber: string;
      status: AttendanceStatus;
      remarks?: string;
    }>,
    _requestedBy: string,
  ) => {
    const record = await attendanceRepository.findRecordById(recordId);
    if (!record) throw createError(404, "Attendance record not found");
    if (record.isLocked) {
      throw createError(403, "Locked attendance cannot be edited");
    }
    const updated = await attendanceRepository.updateRecord(recordId, { entries });
    if (updated) {
      await attendanceService._recomputeSummaries(
        record.subjectId.toString(),
        entries.map((e) => e.studentId),
        record.semester,
        record.academicYear,
      );
      setImmediate(() => {
        void attendanceService._sendAbsenceAlerts(
          updated as IAttendanceRecord,
          record.entries.map((entry) => ({
            studentId: entry.studentId,
            status: entry.status,
          })),
        );
      });
    }
    return updated;
  },

  // Correction request workflow: faculty raises request, HOD/Admin approves
  requestCorrection: async (data: {
    recordId: string;
    studentId: string;
    requestedStatus: AttendanceStatus;
    reason: string;
    requestedBy: string;
  }) => {
    const record = await attendanceRepository.findRecordById(data.recordId);
    if (!record) throw createError(404, "Attendance record not found");
    if (record.isLocked) {
      throw createError(403, "Locked attendance cannot accept correction requests");
    }
    const entry = record.entries.find((e) => e.studentId.toString() === data.studentId);
    if (!entry) {
      throw createError(403, "Correction can be requested only for your own attendance entry");
    }
    if (
      record.correctionRequests?.some(
        (request) =>
          request.studentId.toString() === data.studentId && request.status === "pending",
      )
    ) {
      throw createError(409, "A correction request is already pending for this attendance record");
    }
    if (entry.status === data.requestedStatus) {
      throw createError(400, "Requested status is already recorded");
    }
    const correction = {
      studentId: data.studentId,
      requestedStatus: data.requestedStatus,
      reason: data.reason,
      requestedBy: data.requestedBy,
      status: "pending",
      createdAt: new Date(),
    };
    const updated = await attendanceRepository.updateRecord(data.recordId, {
      $push: { correctionRequests: correction },
    });
    return updated;
  },

  approveCorrection: async (recordId: string, correctionIdx: number, approvedBy: string) => {
    const record = (await attendanceRepository.findRecordById(
      recordId,
    )) as unknown as IAttendanceRecord & {
      correctionRequests?: Array<{
        studentId: { toString(): string };
        requestedStatus: AttendanceStatus;
        status?: string;
      }>;
    };
    if (!record) throw createError(404, "Attendance record not found");
    if (record.isLocked) {
      throw createError(403, "Locked attendance corrections cannot be approved");
    }
    const req = record.correctionRequests?.[correctionIdx];
    if (!req) throw createError(404, "Correction request not found");
    if (req.status && req.status !== "pending") {
      throw createError(400, "Correction request is already processed");
    }
    // Apply the correction to the entries array
    const entries = record.entries.map((e) =>
      e.studentId.toString() === req.studentId.toString()
        ? { ...e, status: req.requestedStatus, remarks: `Corrected by ${approvedBy}` }
        : e,
    );
    const updated = await attendanceRepository.updatePendingCorrection(recordId, correctionIdx, {
      entries,
      [`correctionRequests.${correctionIdx}.status`]: "approved",
      [`correctionRequests.${correctionIdx}.approvedBy`]: approvedBy,
      [`correctionRequests.${correctionIdx}.approvedAt`]: new Date(),
    });
    if (!updated) throw createError(409, "Correction request was concurrently processed");
    if (updated) {
      await attendanceService._recomputeSummaries(
        record.subjectId.toString(),
        [req.studentId.toString()],
        record.semester,
        record.academicYear,
      );
      setImmediate(() => {
        void attendanceService._sendAbsenceAlerts(
          updated as IAttendanceRecord,
          record.entries.map((entry) => ({
            studentId: entry.studentId,
            status: entry.status,
          })),
        );
      });
    }
    return updated;
  },

  rejectCorrection: async (
    recordId: string,
    correctionIdx: number,
    reviewedBy: string,
    reason: string,
  ) => {
    const updated = await attendanceRepository.updatePendingCorrection(recordId, correctionIdx, {
      [`correctionRequests.${correctionIdx}.status`]: "rejected",
      [`correctionRequests.${correctionIdx}.approvedBy`]: reviewedBy,
      [`correctionRequests.${correctionIdx}.approvedAt`]: new Date(),
      [`correctionRequests.${correctionIdx}.reviewRemarks`]: reason,
    });
    if (!updated) throw createError(409, "Correction request was not found or already processed");
    return updated;
  },

  _sendAbsenceAlerts: async (
    record: IAttendanceRecord,
    previousEntries: Array<{ studentId: unknown; status: AttendanceStatus }> = [],
  ) => {
    try {
      const previousStatus = new Map(
        previousEntries.map((entry) => [String(entry.studentId), entry.status]),
      );
      const alertStatuses = new Set([AttendanceStatus.ABSENT, AttendanceStatus.LATE]);
      const changedEntries = record.entries.filter((entry) => {
        const before = previousStatus.get(String(entry.studentId));
        return (
          before !== entry.status && (alertStatuses.has(entry.status) || alertStatuses.has(before!))
        );
      });
      if (changedEntries.length === 0) return;

      const { StudentProfileModel } =
        require("../models/student-profile.model") as typeof import("../models/student-profile.model");
      const { sendEmail, EmailTemplate } =
        require("../email/email.service") as typeof import("../email/email.service");
      const { UserModel } =
        require("../models/user.model") as typeof import("../models/user.model");
      const { notifyUsers } =
        require("./helpers/notify.helper") as typeof import("./helpers/notify.helper");
      const { NotificationType } =
        require("../models/notification.model") as typeof import("../models/notification.model");

      const changedStudentIds = changedEntries.map((entry) => String(entry.studentId));
      const profiles = await StudentProfileModel.find({
        $or: [{ userId: { $in: changedStudentIds } }, { _id: { $in: changedStudentIds } }],
      })
        .select("userId firstName middleName lastName rollNumber parentInfo mentor")
        .lean();

      const allParentEmails = Array.from(
        new Set(
          profiles.flatMap((profile) =>
            [
              profile.parentInfo?.fatherEmail,
              profile.parentInfo?.motherEmail,
              profile.parentInfo?.guardianEmail,
            ].filter((email): email is string => Boolean(email)),
          ),
        ),
      );

      const { SystemRole } = require("../constants/roles") as typeof import("../constants/roles");
      const parentUsers = allParentEmails.length
        ? await UserModel.find({
            roles: { $in: [SystemRole.PARENT] },
            email: { $in: allParentEmails },
            status: "active",
          } as unknown as Parameters<typeof UserModel.find>[0])
            .select("_id email")
            .lean()
        : [];

      const parentUserIds = parentUsers.map((p) => String(p._id));
      const submitterId = String(record.createdBy ?? "");
      const classFacultyId = String(record.facultyId ?? "");
      const mentorIds = Array.from(
        new Set(
          profiles
            .map((p) => String(p.mentor ?? ""))
            .filter((m) => Boolean(m) && m !== submitterId && m !== classFacultyId),
        ),
      );

      const dateStr = formatIndiaDate(record.date);
      const subjectInfo = `${record.subjectName} (${record.subjectCode})`;
      const timeInfo = `Period ${record.periodNumber} (${record.startTime} - ${record.endTime})`;

      // 1. Group student IDs by status for bulk notification
      const absentStudentIds = changedEntries
        .filter((e) => e.status === AttendanceStatus.ABSENT)
        .map((e) => e.studentId);
      const lateStudentIds = changedEntries
        .filter((e) => e.status === AttendanceStatus.LATE)
        .map((e) => e.studentId);
      const otherStudentIds = changedEntries
        .filter((e) => e.status !== AttendanceStatus.ABSENT && e.status !== AttendanceStatus.LATE)
        .map((e) => e.studentId);

      const batchTasks: Array<Promise<unknown>> = [];

      if (absentStudentIds.length > 0) {
        batchTasks.push(
          notifyUsers(absentStudentIds, {
            title: "Attendance Absent",
            body: `You were marked absent for ${subjectInfo} on ${dateStr}, ${timeInfo}. Contact your faculty or mentor if this needs correction.`,
            type: NotificationType.ATTENDANCE,
            actionUrl: "/attendance",
            withEmail: true,
          }),
        );
      }

      if (lateStudentIds.length > 0) {
        batchTasks.push(
          notifyUsers(lateStudentIds, {
            title: "Attendance Late",
            body: `You were marked late for ${subjectInfo} on ${dateStr}, ${timeInfo}.`,
            type: NotificationType.ATTENDANCE,
            actionUrl: "/attendance",
            withEmail: true,
          }),
        );
      }

      if (otherStudentIds.length > 0) {
        batchTasks.push(
          notifyUsers(otherStudentIds, {
            title: "Attendance status corrected",
            body: `Your attendance status for ${subjectInfo} on ${dateStr}, ${timeInfo} has been updated.`,
            type: NotificationType.SUCCESS,
            actionUrl: "/attendance",
            withEmail: true,
          }),
        );
      }

      // 2. Bulk notify mentors
      if (mentorIds.length > 0) {
        batchTasks.push(
          notifyUsers(mentorIds, {
            title: "Mentee attendance update",
            body: `Attendance records were updated for ${subjectInfo} on ${dateStr}, ${timeInfo}.`,
            type: NotificationType.ATTENDANCE,
            actionUrl: "/attendance",
          }),
        );
      }

      // 3. Bulk notify parent accounts
      if (parentUserIds.length > 0) {
        batchTasks.push(
          notifyUsers(parentUserIds, {
            title: "Ward attendance update",
            body: `Attendance was recorded for ${subjectInfo} on ${dateStr}, ${timeInfo}.`,
            type: NotificationType.ATTENDANCE,
            actionUrl: "/parent/attendance",
          }),
        );
      }

      // 4. Bulk email to parent email addresses
      if (allParentEmails.length > 0) {
        batchTasks.push(
          sendEmail({
            to: allParentEmails,
            subject: `Attendance Alert: ${subjectInfo} on ${dateStr}`,
            template: EmailTemplate.GENERAL_NOTIFICATION,
            context: {
              title: "Attendance Notification",
              recipientName: "Parent / Guardian",
              body: `Attendance has been marked for ${subjectInfo} on ${dateStr}, ${timeInfo}. Please check the parent portal for detailed status.`,
              actionUrl: "/parent/attendance",
            },
          }).catch((err) => {
            logger.error("[markAttendance] failed to send parent email batch", err);
          }),
        );
      }

      await Promise.all(batchTasks);
    } catch (err) {
      logger.error("[_sendAbsenceAlerts] failed", err);
    }
  },
};

export function canModifyAttendanceAt(
  classDate: Date,
  endTime: string,
  startTime?: string | Date,
  now = new Date(),
): boolean {
  if (startTime instanceof Date) {
    now = startTime;
  }
  const classEnd = new Date(classDate);
  const matchEnd = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(endTime);
  if (!matchEnd) return false;
  classEnd.setHours(Number(matchEnd[1]), Number(matchEnd[2]), 0, 0);

  // Attendance opens when the class completes and closes exactly 24 hours later.
  const earliest = classEnd.getTime();
  const deadline = classEnd.getTime() + 24 * 60 * 60 * 1000;
  return now.getTime() >= earliest && now.getTime() <= deadline;
}

export function parseAttendanceDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function attendanceDateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

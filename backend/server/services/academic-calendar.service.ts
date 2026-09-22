import createError from "http-errors";
import { Types } from "mongoose";
import type { ICalendarEvent } from "../models/academic-calendar.model";
import { academicCalendarRepository } from "../repositories";
import { ALL_ROLES } from "../constants/roles";
import { notificationService } from "./notification.service";
import {
  NotificationAudience,
  NotificationChannel,
  NotificationType,
} from "../models/notification.model";
import {
  AttendanceRecordModel,
  ClassOperationModel,
  DepartmentModel,
  EventModel,
  FacultyProfileModel,
  MeetingModel,
  MentorModel,
  NotificationModel,
  PersonalCalendarEventModel,
  StudentProfileModel,
  TimetableModel,
} from "../models";

interface IFacultyUserPopulated {
  _id?: Types.ObjectId;
  name?: string;
  email?: string;
}

interface IDepartmentPopulated {
  _id?: Types.ObjectId;
  name?: string;
  code?: string;
}

interface IFacultyProfileDoc {
  userId?: IFacultyUserPopulated;
  department?: IDepartmentPopulated;
  designation?: string;
  employeeId?: string;
}

interface IMenteeStudentDoc {
  _id?: Types.ObjectId;
  name?: string;
  email?: string;
  rollNumber?: string;
  program?: string;
  branch?: string;
  currentSemester?: number;
  section?: string;
}

const ACADEMIC_YEAR_RE = /^\d{4}-\d{2}$/;
const DATE_FIELDS = [
  ["internalExamStartDate", "internalExamEndDate"],
  ["universityExamStartDate", "universityExamEndDate"],
  ["vacationStartDate", "vacationEndDate"],
] as const;

function dateValue(value: unknown, label: string) {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) throw createError(400, `${label} is invalid`);
  return date;
}

function calendarDays(start: Date, end: Date) {
  const days: Date[] = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (current <= last) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function atTime(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const value = new Date(date);
  value.setHours(hours || 0, minutes || 0, 0, 0);
  return value;
}

export function normalizeAcademicCalendar(input: Record<string, unknown>) {
  const academicYear = String(input.academicYear ?? "").trim();
  if (!ACADEMIC_YEAR_RE.test(academicYear))
    throw createError(400, "Academic year must use YYYY-YY format");
  const semesterType = input.semesterType;
  if (!["odd", "even"].includes(String(semesterType)))
    throw createError(400, "Semester type must be odd or even");
  const semesterStartDate = dateValue(input.semesterStartDate, "Semester start date");
  const semesterEndDate = dateValue(input.semesterEndDate, "Semester end date");
  if (semesterEndDate <= semesterStartDate)
    throw createError(400, "Semester end date must be after its start date");
  const normalized: Record<string, unknown> = {
    academicYear,
    semesterType,
    semesterStartDate,
    semesterEndDate,
  };
  for (const [startField, endField] of DATE_FIELDS) {
    const hasStart = Boolean(input[startField]);
    const hasEnd = Boolean(input[endField]);
    if (hasStart !== hasEnd)
      throw createError(400, `${startField} and ${endField} are both required`);
    if (!hasStart) continue;
    const start = dateValue(input[startField], startField);
    const end = dateValue(input[endField], endField);
    if (end < start || start < semesterStartDate || end > semesterEndDate)
      throw createError(400, `${startField} range must be ordered within the semester`);
    normalized[startField] = start;
    normalized[endField] = end;
  }
  const events = Array.isArray(input.events)
    ? input.events.map((value) =>
        normalizeCalendarEvent(
          value as Record<string, unknown>,
          semesterStartDate,
          semesterEndDate,
        ),
      )
    : [];
  const holidayDates = new Set<string>();
  for (const event of events.filter((item) => item.category === "holiday"))
    for (const day of calendarDays(event.startDate, event.endDate))
      holidayDates.add(day.toISOString().slice(0, 10));
  normalized.events = events;
  normalized.totalWorkingDays = calendarDays(semesterStartDate, semesterEndDate).filter(
    (day) =>
      day.getDay() !== 0 && day.getDay() !== 6 && !holidayDates.has(day.toISOString().slice(0, 10)),
  ).length;
  return normalized;
}

export function normalizeCalendarEvent(
  input: Record<string, unknown>,
  semesterStart: Date,
  semesterEnd: Date,
) {
  const title = String(input.title ?? "").trim();
  if (!title) throw createError(400, "Event title is required");
  const startDate = dateValue(input.startDate, "Event start date");
  const endDate = dateValue(input.endDate, "Event end date");
  if (endDate < startDate || startDate < semesterStart || endDate > semesterEnd)
    throw createError(400, "Event dates must be ordered within the semester");
  const categories = [
    "holiday",
    "internal_exam",
    "university_exam",
    "cultural",
    "sports",
    "technical",
    "other",
  ];
  if (!categories.includes(String(input.category)))
    throw createError(400, "Event category is invalid");
  const affectedRoles = Array.isArray(input.affectedRoles)
    ? [...new Set(input.affectedRoles.map(String))]
    : [];
  if (affectedRoles.some((role) => !ALL_ROLES.includes(role as (typeof ALL_ROLES)[number])))
    throw createError(400, "Event contains an invalid affected role");
  if (input.departmentId && !Types.ObjectId.isValid(String(input.departmentId)))
    throw createError(400, "Event department is invalid");
  return {
    ...(input._id && Types.ObjectId.isValid(String(input._id))
      ? { _id: new Types.ObjectId(String(input._id)) }
      : {}),
    title,
    description: String(input.description ?? "").trim() || undefined,
    startDate,
    endDate,
    category: input.category as ICalendarEvent["category"],
    affectedRoles,
    departmentId:
      input.departmentId && Types.ObjectId.isValid(String(input.departmentId))
        ? new Types.ObjectId(String(input.departmentId))
        : undefined,
    isRecurring: Boolean(input.isRecurring),
  };
}

export const academicCalendarService = {
  getAll: (filter: Record<string, unknown>, page: number, limit: number) =>
    academicCalendarRepository.list(filter, page, Math.min(limit, 100)),
  getByYearSemester: (academicYear: string, semesterType: "odd" | "even") =>
    academicCalendarRepository.findByYear(academicYear, semesterType),

  getHierarchyContext: async (
    activeRole?: string,
    departmentId?: string,
    currentUserId?: string,
  ) => {
    const isDeanOrAdmin = [
      "super_admin",
      "admin",
      "principal",
      "dean_academic",
      "administration_office",
    ].includes(String(activeRole));
    const isHOD = activeRole === "hod";

    const departmentFilter: Record<string, unknown> = { isDeleted: false };
    if (isHOD && departmentId && Types.ObjectId.isValid(departmentId)) {
      departmentFilter._id = new Types.ObjectId(departmentId);
    }

    const [departments, facultyProfiles, mentorDoc] = await Promise.all([
      isDeanOrAdmin || isHOD
        ? DepartmentModel.find(departmentFilter).select("name code").sort({ name: 1 }).lean()
        : [],
      isDeanOrAdmin || isHOD
        ? FacultyProfileModel.find(
            isHOD && departmentId && Types.ObjectId.isValid(departmentId)
              ? { department: new Types.ObjectId(departmentId) }
              : {},
          )
            .populate("userId", "name email")
            .populate("department", "name code")
            .select("userId department designation employeeId")
            .lean()
        : [],
      currentUserId && Types.ObjectId.isValid(currentUserId)
        ? MentorModel.findOne({ facultyId: new Types.ObjectId(currentUserId), isActive: true })
            .populate({
              path: "menteeIds",
              select: "name email rollNumber program branch currentSemester section",
            })
            .lean()
        : null,
    ]);

    const facultyList = ((facultyProfiles as unknown as IFacultyProfileDoc[]) || [])
      .map((fp) => {
        const user = fp.userId;
        const dept = fp.department;
        if (!user?._id) return null;
        return {
          _id: String(user._id),
          name: user.name || "Faculty",
          email: user.email || "",
          designation: fp.designation || "Faculty",
          employeeId: fp.employeeId || "",
          departmentId: dept?._id ? String(dept._id) : undefined,
          departmentName: dept?.name || "",
          departmentCode: dept?.code || "",
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.name.localeCompare(b.name));

    const menteeList = ((mentorDoc?.menteeIds as unknown as IMenteeStudentDoc[]) || []).map(
      (m) => ({
        _id: String(m._id),
        name: m.name || "Student",
        email: m.email || "",
        rollNumber: m.rollNumber || "",
        program: m.program || "",
        branch: m.branch || "",
        semester: m.currentSemester || 1,
        section: m.section || "A",
      }),
    );

    return {
      canInspectAnyFaculty: isDeanOrAdmin,
      canInspectDeptFaculty: isHOD,
      canInspectMentees: menteeList.length > 0,
      departments: (
        (departments as Array<{ _id: Types.ObjectId; name: string; code?: string }>) || []
      ).map((d) => ({
        _id: String(d._id),
        name: d.name,
        code: d.code,
      })),
      faculty: facultyList,
      mentees: menteeList,
    };
  },

  getVisible: async (
    activeRole?: string,
    departmentId?: string,
    userId?: string,
    options?: {
      targetUserId?: string;
      targetDepartmentId?: string;
      scope?: "self" | "department" | "faculty" | "mentee";
    },
  ) => {
    const result = await academicCalendarRepository.list({ isPublished: true }, 1, 20);
    const institutionWideRoles = new Set([
      "super_admin",
      "admin",
      "principal",
      "dean_academic",
      "administration_office",
    ]);

    const effectiveDepartmentId = options?.targetDepartmentId || departmentId;
    const academicCalendars = result.data.map((calendar) => ({
      ...calendar,
      events: calendar.events.filter((event) => {
        const roleVisible =
          !event.affectedRoles?.length || (activeRole && event.affectedRoles.includes(activeRole));
        const eventDepartment = event.departmentId?.toString();
        const departmentVisible =
          !eventDepartment ||
          institutionWideRoles.has(String(activeRole)) ||
          (effectiveDepartmentId && eventDepartment === effectiveDepartmentId);
        return Boolean(roleVisible && departmentVisible);
      }),
    }));
    if (!userId || !Types.ObjectId.isValid(userId)) return academicCalendars;

    const currentUserId = new Types.ObjectId(userId);
    const isDeanOrAdmin = institutionWideRoles.has(String(activeRole));
    const isHOD = activeRole === "hod";

    const isDepartmentMode =
      options?.scope === "department" ||
      (Boolean(options?.targetDepartmentId) && !options?.targetUserId);

    // Determine target user to inspect
    let inspectedUserObjectId = currentUserId;
    if (options?.targetUserId && Types.ObjectId.isValid(options.targetUserId)) {
      const candidateId = new Types.ObjectId(options.targetUserId);
      if (isDeanOrAdmin) {
        inspectedUserObjectId = candidateId;
      } else if (isHOD) {
        const targetFaculty = await FacultyProfileModel.findOne({
          userId: candidateId,
          department:
            departmentId && Types.ObjectId.isValid(departmentId)
              ? new Types.ObjectId(departmentId)
              : undefined,
        }).lean();
        if (targetFaculty) inspectedUserObjectId = candidateId;
      } else {
        const isMentee = await MentorModel.findOne({
          facultyId: currentUserId,
          menteeIds: candidateId,
          isActive: true,
        }).lean();
        if (isMentee) inspectedUserObjectId = candidateId;
      }
    }

    const departmentObjectId =
      effectiveDepartmentId && Types.ObjectId.isValid(effectiveDepartmentId)
        ? new Types.ObjectId(effectiveDepartmentId)
        : undefined;

    const now = new Date();
    const rangeStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const rangeEnd = new Date(now.getFullYear() + 1, now.getMonth() + 1, 0, 23, 59, 59, 999);

    // If department scope, fetch department faculty IDs
    const deptFacultyProfiles =
      isDepartmentMode && departmentObjectId
        ? await FacultyProfileModel.find({ department: departmentObjectId }).select("userId").lean()
        : [];
    const deptFacultyUserIds = deptFacultyProfiles
      .map((p) => p.userId)
      .filter((id): id is Types.ObjectId => Boolean(id));

    // Check if target is a student or faculty (when not in department mode)
    const studentProfile = !isDepartmentMode
      ? await StudentProfileModel.findOne({
          userId: inspectedUserObjectId,
        }).lean()
      : null;
    const isStudentTarget = Boolean(studentProfile);

    let timetableQuery: Record<string, unknown>;
    if (isDepartmentMode) {
      timetableQuery = {
        isActive: true,
        isApproved: true,
        ...(departmentObjectId
          ? {
              $and: [
                {
                  $or: [
                    { departmentId: departmentObjectId },
                    { branchDepartmentIds: departmentObjectId },
                    { "slots.facultyDepartmentId": departmentObjectId },
                    { "slots.branchDepartmentId": departmentObjectId },
                    ...(deptFacultyUserIds.length
                      ? [{ "slots.facultyId": { $in: deptFacultyUserIds } }]
                      : []),
                  ],
                },
                {
                  $or: [
                    { effectiveFrom: { $exists: false } },
                    { effectiveFrom: null },
                    { effectiveFrom: { $lte: rangeEnd } },
                  ],
                },
              ],
            }
          : {
              $or: [
                { effectiveFrom: { $exists: false } },
                { effectiveFrom: null },
                { effectiveFrom: { $lte: rangeEnd } },
              ],
            }),
      };
    } else if (isStudentTarget) {
      timetableQuery = {
        isActive: true,
        isApproved: true,
        program: studentProfile!.program,
        semester: studentProfile!.currentSemester,
        section: studentProfile!.section,
        $or: [
          { effectiveFrom: { $exists: false } },
          { effectiveFrom: null },
          { effectiveFrom: { $lte: rangeEnd } },
        ],
      };
    } else {
      timetableQuery = {
        isActive: true,
        isApproved: true,
        "slots.facultyId": inspectedUserObjectId,
        $or: [
          { effectiveFrom: { $exists: false } },
          { effectiveFrom: null },
          { effectiveFrom: { $lte: rangeEnd } },
        ],
      };
    }

    const extraClassQuery = isDepartmentMode
      ? {
          status: { $ne: "cancelled" as const },
          date: { $gte: rangeStart, $lte: rangeEnd },
          ...(departmentObjectId
            ? {
                $or: [
                  { departmentId: departmentObjectId },
                  { department: departmentObjectId },
                  ...(deptFacultyUserIds.length
                    ? [{ facultyId: { $in: deptFacultyUserIds } }]
                    : []),
                ],
              }
            : {}),
        }
      : isStudentTarget
        ? null
        : {
            facultyId: inspectedUserObjectId,
            status: { $ne: "cancelled" as const },
            date: { $gte: rangeStart, $lte: rangeEnd },
          };

    const meetingQuery = isDepartmentMode
      ? {
          status: { $ne: "cancelled" as const },
          $and: [
            {
              $or: [
                { scheduledAt: { $gte: rangeStart, $lte: rangeEnd } },
                { startedAt: { $gte: rangeStart, $lte: rangeEnd } },
              ],
            },
          ],
          ...(departmentObjectId
            ? {
                $or: [
                  { departmentId: departmentObjectId },
                  { organizingDepartment: departmentObjectId },
                  ...(deptFacultyUserIds.length
                    ? [
                        { conductedBy: { $in: deptFacultyUserIds } },
                        { invitees: { $in: deptFacultyUserIds } },
                        { coHostIds: { $in: deptFacultyUserIds } },
                      ]
                    : []),
                ],
              }
            : {}),
        }
      : {
          status: { $ne: "cancelled" as const },
          blockedUserIds: { $ne: inspectedUserObjectId },
          $and: [
            {
              $or: [
                { scheduledAt: { $gte: rangeStart, $lte: rangeEnd } },
                { startedAt: { $gte: rangeStart, $lte: rangeEnd } },
              ],
            },
          ],
          $or: [
            { conductedBy: inspectedUserObjectId },
            { invitees: inspectedUserObjectId },
            { coHostIds: inspectedUserObjectId },
          ],
        };

    const [timetables, extraClasses, meetings, institutionEvents, attendanceRecords, personalRows] =
      await Promise.all([
        TimetableModel.find(timetableQuery)
          .select("title program semester section effectiveFrom effectiveTo slots substituteLog")
          .lean(),
        extraClassQuery ? ClassOperationModel.find(extraClassQuery).lean() : [],
        MeetingModel.find(meetingQuery).lean(),
        EventModel.find({
          isPublished: true,
          startDate: { $lte: rangeEnd },
          endDate: { $gte: rangeStart },
          targetAudience: { $in: ["all", String(activeRole)] },
          ...(departmentObjectId
            ? {
                $or: [{ organizingDepartment: null }, { organizingDepartment: departmentObjectId }],
              }
            : {}),
        }).lean(),
        !isDepartmentMode && !isStudentTarget
          ? AttendanceRecordModel.find({
              facultyId: inspectedUserObjectId,
              date: { $gte: rangeStart, $lte: rangeEnd },
            })
              .select(
                "timetableId timetableSlotId subjectId date periodNumber totalPresent totalAbsent totalStrength isLocked",
              )
              .lean()
          : [],
        // Privacy rule: Only return personal private events if viewing own calendar
        !isDepartmentMode && inspectedUserObjectId.equals(currentUserId)
          ? PersonalCalendarEventModel.find({
              ownerId: currentUserId,
              startDate: { $lte: rangeEnd },
              $or: [{ recurrenceUntil: { $gte: rangeStart } }, { endDate: { $gte: rangeStart } }],
            }).lean()
          : [],
      ]);

    const attendanceBySession = new Map(
      attendanceRecords.map((record) => [
        [
          record.timetableId ? String(record.timetableId) : "",
          record.timetableSlotId ? String(record.timetableSlotId) : "",
          new Date(record.date).toISOString().slice(0, 10),
          record.periodNumber,
        ].join(":"),
        record,
      ]),
    );

    const personalEvents: Array<Record<string, unknown>> = [];
    for (const timetable of timetables) {
      const effectiveStart = timetable.effectiveFrom
        ? new Date(Math.max(rangeStart.getTime(), new Date(timetable.effectiveFrom).getTime()))
        : rangeStart;
      const effectiveEnd = timetable.effectiveTo
        ? new Date(Math.min(rangeEnd.getTime(), new Date(timetable.effectiveTo).getTime()))
        : rangeEnd;
      for (const day of calendarDays(effectiveStart, effectiveEnd)) {
        const dayName = WEEKDAY_NAMES[day.getDay()];
        timetable.slots.forEach((slot, slotIndex) => {
          if (slot.day !== dayName) return;
          if (
            !isDepartmentMode &&
            !isStudentTarget &&
            String(slot.facultyId ?? "") !== String(inspectedUserObjectId)
          )
            return;
          const replacement = timetable.substituteLog?.find(
            (entry) =>
              entry.status !== "cancelled" &&
              entry.slotIndex === slotIndex &&
              new Date(entry.date).toDateString() === day.toDateString(),
          );
          if (
            !isDepartmentMode &&
            !isStudentTarget &&
            replacement &&
            String(replacement.substituteFacultyId) !== String(inspectedUserObjectId)
          )
            return;
          const startDate = atTime(day, slot.startTime);
          const endDate = atTime(day, slot.endTime);
          const attendance = attendanceBySession.get(
            [
              String(timetable._id),
              slot._id ? String(slot._id) : "",
              day.toISOString().slice(0, 10),
              slot.periodNo,
            ].join(":"),
          );
          const attendanceState = attendance
            ? "recorded"
            : startDate <= now && endDate >= now
              ? "in_progress"
              : endDate < now
                ? "missing"
                : "upcoming";
          personalEvents.push({
            _id: `${String(timetable._id)}-${slotIndex}-${day.toISOString().slice(0, 10)}`,
            title: slot.subjectName || slot.title || "Scheduled class",
            description: [
              slot.subjectCode,
              slot.facultyName ? `Faculty: ${slot.facultyName}` : "",
              timetable.program,
              `Semester ${timetable.semester}`,
              timetable.section ? `Section ${timetable.section}` : "",
              slot.roomNo,
            ]
              .filter(Boolean)
              .join(" · "),
            startDate,
            endDate,
            category: "class",
            source: "timetable",
            location: slot.roomNo,
            allDay: false,
            attendanceState,
            attendanceSummary: attendance
              ? {
                  present: attendance.totalPresent,
                  absent: attendance.totalAbsent,
                  strength: attendance.totalStrength,
                  locked: attendance.isLocked,
                }
              : undefined,
          });
        });
      }
    }
    for (const item of extraClasses)
      personalEvents.push({
        _id: String(item._id),
        title: item.subjectName,
        description: `Extra class · ${item.reason}`,
        startDate: atTime(item.date, item.startTime),
        endDate: atTime(item.date, item.endTime),
        category: "class",
        source: "extra_class",
        location: item.roomNo,
        allDay: false,
      });
    for (const item of meetings) {
      const actualStart =
        item.status !== "scheduled" && item.startedAt ? item.startedAt : item.scheduledAt;
      const actualEnd =
        item.status === "completed" && item.endedAt
          ? item.endedAt
          : new Date(new Date(actualStart).getTime() + (item.durationMinutes || 60) * 60000);
      personalEvents.push({
        _id: String(item._id),
        title: item.title,
        description: item.agenda,
        startDate: actualStart,
        endDate: actualEnd,
        category: "meeting",
        source: "meeting",
        lifecycleStatus: item.status,
        location: item.venue,
        allDay: false,
      });
    }
    for (const item of institutionEvents) {
      const text = `${item.title || ""} ${item.description || ""}`.toLowerCase();
      const typeStr = String(item.eventType || "").toLowerCase();
      let eventCategory = "other";

      if (typeStr === "sports" || typeStr === "cultural" || typeStr === "technical") {
        eventCategory = typeStr;
      } else if (
        text.includes("exam") ||
        text.includes("examination") ||
        text.includes("evaluation") ||
        text.includes("assessment")
      ) {
        eventCategory =
          text.includes("university") || text.includes("end sem")
            ? "university_exam"
            : "internal_exam";
      } else if (
        text.includes("meeting") ||
        text.includes("council") ||
        text.includes("colloquium") ||
        text.includes("committee")
      ) {
        eventCategory = "meeting";
      } else if (
        typeStr === "workshop" ||
        typeStr === "seminar" ||
        typeStr === "placement" ||
        text.includes("workshop") ||
        text.includes("seminar") ||
        text.includes("lecture") ||
        text.includes("fdp") ||
        text.includes("training")
      ) {
        eventCategory = "technical";
      } else if (text.includes("holiday") || text.includes("vacation")) {
        eventCategory = "holiday";
      }

      personalEvents.push({
        _id: String(item._id),
        title: item.title,
        description: item.description,
        startDate: item.startDate,
        endDate: item.endDate,
        category: eventCategory,
        source: "event",
        location: item.venue,
        allDay: false,
      });
    }
    for (const item of personalRows) {
      const occurrence = new Date(item.startDate);
      const duration = new Date(item.endDate).getTime() - occurrence.getTime();
      const last = item.recurrenceUntil ? new Date(item.recurrenceUntil) : occurrence;
      while (occurrence <= last && occurrence <= rangeEnd) {
        if (occurrence >= rangeStart)
          personalEvents.push({
            _id: `${String(item._id)}-${occurrence.toISOString()}`,
            sourceId: String(item._id),
            title: item.title,
            description: item.description,
            startDate: new Date(occurrence),
            endDate: new Date(occurrence.getTime() + duration),
            category: "personal",
            source: "personal",
            location: item.location,
            allDay: item.allDay,
            color: item.color,
            recurrence: item.recurrence,
            reminderMinutes: item.reminderMinutes,
          });
        if (item.recurrence === "daily") occurrence.setDate(occurrence.getDate() + 1);
        else if (item.recurrence === "weekly") occurrence.setDate(occurrence.getDate() + 7);
        else if (item.recurrence === "monthly") occurrence.setMonth(occurrence.getMonth() + 1);
        else break;
      }
    }

    return [
      ...academicCalendars,
      {
        _id: "personal-schedule",
        academicYear: "personal",
        semesterType: "odd" as const,
        events: personalEvents,
      },
    ];
  },
  savePersonalEvent: async (userId: string, input: Record<string, unknown>, id?: string) => {
    if (!Types.ObjectId.isValid(userId)) throw createError(400, "Invalid user identity");
    const startDate = dateValue(input.startDate, "Start date");
    const endDate = dateValue(input.endDate, "End date");
    if (endDate <= startDate) throw createError(400, "End must be after start");
    const title = String(input.title ?? "").trim();
    if (!title) throw createError(400, "Event title is required");
    const ownerId = new Types.ObjectId(userId);
    const existing = id ? await PersonalCalendarEventModel.findOne({ _id: id, ownerId }) : null;
    if (id && !existing) throw createError(404, "Personal event not found");
    const isUnchangedHistoricalStart =
      existing && new Date(existing.startDate).getTime() === startDate.getTime();
    if (startDate.getTime() < Date.now() - 60_000 && !isUnchangedHistoricalStart)
      throw createError(400, "Event start time cannot be in the past");
    const legacyReminderId = (existing as unknown as { reminderNotificationId?: Types.ObjectId })
      ?.reminderNotificationId;
    const oldReminderIds = [legacyReminderId, ...(existing?.reminderNotificationIds ?? [])].filter(
      (value): value is Types.ObjectId => Boolean(value),
    );
    if (oldReminderIds.length)
      await NotificationModel.updateMany({ _id: { $in: oldReminderIds } }, { isActive: false });
    const payload = {
      ownerId,
      title,
      description: String(input.description ?? "").trim() || undefined,
      startDate,
      endDate,
      allDay: Boolean(input.allDay),
      location: String(input.location ?? "").trim() || undefined,
      color: String(input.color ?? "blue") as "blue" | "green" | "amber" | "rose" | "violet",
      recurrence: String(input.recurrence ?? "none") as "none" | "daily" | "weekly" | "monthly",
      recurrenceUntil: input.recurrenceUntil
        ? dateValue(input.recurrenceUntil, "Recurrence end")
        : undefined,
      reminderMinutes: Array.isArray(input.reminderMinutes)
        ? [...new Set(input.reminderMinutes.map(Number))].sort((a, b) => b - a)
        : [],
      reminderNotificationIds: [],
      ...(existing ? { updatedBy: ownerId } : { createdBy: ownerId }),
    };
    if (payload.recurrence !== "none" && !payload.recurrenceUntil)
      throw createError(400, "Repeat until is required for a repeating event");
    if (payload.recurrenceUntil && payload.recurrenceUntil < startDate)
      throw createError(400, "Repeat until cannot be before the event starts");
    const row = existing
      ? await PersonalCalendarEventModel.findByIdAndUpdate(existing._id, payload, {
          new: true,
          runValidators: true,
        })
      : await PersonalCalendarEventModel.create(payload);
    if (!row) throw createError(409, "Personal event could not be saved");
    const notificationIds: Types.ObjectId[] = [];
    const occurrence = new Date(row.startDate);
    const recurrenceEnd = row.recurrenceUntil ? new Date(row.recurrenceUntil) : occurrence;
    let occurrenceCount = 0;
    while (occurrence <= recurrenceEnd && occurrenceCount < 366) {
      for (const minutes of row.reminderMinutes ?? []) {
        const scheduledAt = new Date(occurrence.getTime() - minutes * 60000);
        if (scheduledAt <= new Date()) continue;
        const notification = await notificationService.create({
          title: `Reminder: ${row.title}`,
          body: `${row.title} starts at ${occurrence.toLocaleString("en-IN")}${row.location ? ` · ${row.location}` : ""}.`,
          type: NotificationType.INFO,
          channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
          audience: NotificationAudience.SPECIFIC_USER,
          targetUserIds: [userId],
          isScheduled: true,
          scheduledAt: scheduledAt.toISOString(),
          actionUrl: "/dashboard",
          createdBy: userId,
          createdByName: "Personal calendar",
        });
        notificationIds.push(notification._id);
      }
      occurrenceCount += 1;
      if (row.recurrence === "daily") occurrence.setDate(occurrence.getDate() + 1);
      else if (row.recurrence === "weekly") occurrence.setDate(occurrence.getDate() + 7);
      else if (row.recurrence === "monthly") occurrence.setMonth(occurrence.getMonth() + 1);
      else break;
    }
    if (notificationIds.length) {
      row.reminderNotificationIds = notificationIds;
      await row.save();
    }
    return row.toObject();
  },
  deletePersonalEvent: async (userId: string, id: string) => {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(id))
      throw createError(400, "Invalid identifier");
    const row = await PersonalCalendarEventModel.findOneAndDelete({ _id: id, ownerId: userId });
    if (!row) throw createError(404, "Personal event not found");
    const legacyId = (row as unknown as { reminderNotificationId?: Types.ObjectId })
      .reminderNotificationId;
    const reminderIds = [legacyId, ...(row.reminderNotificationIds ?? [])].filter(
      (value): value is Types.ObjectId => Boolean(value),
    );
    if (reminderIds.length)
      await NotificationModel.updateMany({ _id: { $in: reminderIds } }, { isActive: false });
  },
  getById: async (id: string) => {
    const calendar = await academicCalendarRepository.findById(id);
    if (!calendar) throw createError(404, "Academic calendar not found");
    return calendar;
  },
  create: async (input: Record<string, unknown>, createdBy: string) => {
    const normalized = normalizeAcademicCalendar(input);
    if (
      await academicCalendarRepository.findByYear(
        normalized.academicYear as string,
        normalized.semesterType as "odd" | "even",
      )
    )
      throw createError(409, "Academic calendar already exists for this semester");
    return academicCalendarRepository.create({ ...normalized, isPublished: false, createdBy });
  },
  update: async (id: string, input: Record<string, unknown>, updatedBy: string) => {
    const current = await academicCalendarRepository.findById(id);
    if (!current) throw createError(404, "Academic calendar not found");
    if (current.isPublished) throw createError(409, "Published academic calendars are immutable");
    return academicCalendarRepository.updateById(id, {
      ...normalizeAcademicCalendar({ ...current, ...input }),
      updatedBy,
    });
  },
  publish: async (id: string, publishedBy: string) => {
    const current = await academicCalendarRepository.findById(id);
    if (!current) throw createError(404, "Academic calendar not found");
    normalizeAcademicCalendar({ ...current });
    const published = await academicCalendarRepository.publish(id, publishedBy);
    if (!published)
      throw createError(
        409,
        "Publication requires an unpublished calendar and a different approver",
      );
    return published;
  },
  addEvent: async (id: string, input: Record<string, unknown>, updatedBy: string) => {
    const calendar = await academicCalendarRepository.findById(id);
    if (!calendar) throw createError(404, "Academic calendar not found");
    if (calendar.isPublished) throw createError(409, "Published academic calendars are immutable");
    const event = normalizeCalendarEvent(
      input,
      calendar.semesterStartDate,
      calendar.semesterEndDate,
    );
    const normalized = normalizeAcademicCalendar({
      ...calendar,
      events: [...calendar.events, event],
    });
    const updated = await academicCalendarRepository.updateById(id, { ...normalized, updatedBy });
    if (!updated) throw createError(409, "Only draft calendars can be changed");
    return updated;
  },
  removeEvent: async (id: string, eventId: string, updatedBy: string) => {
    if (!Types.ObjectId.isValid(eventId)) throw createError(400, "Event ID is invalid");
    const calendar = await academicCalendarRepository.findById(id);
    if (!calendar) throw createError(404, "Academic calendar not found");
    if (calendar.isPublished) throw createError(409, "Published academic calendars are immutable");
    const events = calendar.events.filter((event) => event._id?.toString() !== eventId);
    if (events.length === calendar.events.length)
      throw createError(404, "Calendar event not found");
    const normalized = normalizeAcademicCalendar({ ...calendar, events });
    const updated = await academicCalendarRepository.updateById(id, { ...normalized, updatedBy });
    if (!updated) throw createError(409, "Only draft calendars can be changed");
    return updated;
  },
};

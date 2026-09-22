import createError from "http-errors";
import mongoose, { Types, type ClientSession } from "mongoose";
import type { MongoFilter } from "../types/mongoose.types";
import {
  attendanceRepository,
  auditLogRepository,
  curriculumRepository,
  examinationRepository,
  feeRepository,
  semesterRegistrationRepository,
  sectionRepository,
  studentProfileRepository,
  studentSectionAllotmentRepository,
  subjectRepository,
} from "../repositories";
import { pdfService } from "../pdf/pdf.service";
import { configs } from "../configs";
import { ExamType, ExamScheduleModel, ExamStatus, FeePaymentStatus } from "../models";
import { RegistrationStatus } from "../models/semester-registration.model";
import type { IStudentProfile } from "../models/student-profile.model";
import {
  SemesterResultModel,
  StudentMarksModel,
  type IExamSchedule,
} from "../models/examination.model";
import { redisUtil } from "../utils/redis.util";
import { notifyUsers, notifyStudentsByClass } from "./helpers/notify.helper";
import { NotificationType } from "../models/notification.model";
import { logger } from "../utils/logger.util";
import { formatIndiaDate } from "../utils/date.util";
import { UserModel } from "../models/user.model";
import { SystemRole } from "../constants/roles";
import { ExamScheduleMutationLockModel } from "../models/exam-schedule-mutation-lock.model";
import { FacilitySpaceModel } from "../models/facilities.model";

const RESULT_TTL = 600; // 10 minutes — results don't change after publish

export function examDurationMinutes(startTime: string, endTime: string): number {
  const pattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const start = pattern.exec(startTime);
  const end = pattern.exec(endTime);
  if (!start || !end) throw createError(400, "Exam times must use HH:mm format");
  const minutes = Number(end[1]) * 60 + Number(end[2]) - (Number(start[1]) * 60 + Number(start[2]));
  if (minutes <= 0 || minutes > 8 * 60)
    throw createError(400, "Exam end time must follow start time");
  return minutes;
}

type NormalizedExamSubject = {
  subjectId: Types.ObjectId;
  subjectCode: string;
  subjectName: string;
  examDate: Date;
  startTime: string;
  endTime: string;
  duration: number;
  venueId?: Types.ObjectId;
  venue: string;
  invigilators: string[];
  maxMarks: number;
  passMarks: number;
};

export function examSlotsOverlap(
  first: Pick<NormalizedExamSubject, "startTime" | "endTime">,
  second: Pick<NormalizedExamSubject, "startTime" | "endTime">,
) {
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  return (
    minutes(first.startTime) < minutes(second.endTime) &&
    minutes(second.startTime) < minutes(first.endTime)
  );
}

async function assertNoExamResourceConflicts(
  subjects: NormalizedExamSubject[],
  excludeScheduleId?: string,
  session?: ClientSession,
) {
  const dates = [
    ...new Map(
      subjects.map((subject) => [subject.examDate.toISOString(), subject.examDate]),
    ).values(),
  ];
  const candidates = await examinationRepository.findScheduleResourceCandidates(
    dates,
    excludeScheduleId,
    session,
  );
  for (const subject of subjects) {
    for (const schedule of candidates) {
      for (const existing of schedule.subjects ?? []) {
        if (
          new Date(existing.examDate).toISOString() !== subject.examDate.toISOString() ||
          !examSlotsOverlap(subject, existing)
        )
          continue;
        const venueConflict =
          existing.venue.trim().toUpperCase() === subject.venue.trim().toUpperCase();
        const existingInvigilators = new Set(existing.invigilators.map(String));
        const invigilatorConflict = subject.invigilators.find((id) => existingInvigilators.has(id));
        if (venueConflict) {
          throw createError(
            409,
            `Venue ${subject.venue} is already booked for ${schedule.title} during this time`,
          );
        }
        if (invigilatorConflict) {
          throw createError(
            409,
            `An assigned invigilator is already scheduled for ${schedule.title} during this time`,
          );
        }
      }
    }
  }
}

function examScheduleLockKeys(subjects: NormalizedExamSubject[]) {
  const keys = new Set<string>();
  for (const subject of subjects) {
    const date = subject.examDate.toISOString().slice(0, 10);
    keys.add(`exam:${date}:venue:${subject.venue.trim().toUpperCase()}`);
    for (const invigilatorId of subject.invigilators) {
      keys.add(`exam:${date}:invigilator:${invigilatorId}`);
    }
  }
  return [...keys].sort();
}

async function withExamScheduleLocks<T>(
  keys: string[],
  work: (session: ClientSession) => Promise<T>,
) {
  const uniqueKeys = [...new Set(keys)].sort();
  try {
    await ExamScheduleMutationLockModel.bulkWrite(
      uniqueKeys.map((key) => ({
        updateOne: {
          filter: { key },
          update: { $setOnInsert: { key, revision: 0 } },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  const session = await mongoose.startSession();
  let result: T | undefined;
  try {
    await session.withTransaction(async () => {
      await ExamScheduleMutationLockModel.updateMany(
        { key: { $in: uniqueKeys } },
        { $inc: { revision: 1 } },
        { session },
      );
      result = await work(session);
    });
  } finally {
    await session.endSession();
  }
  if (result === undefined)
    throw createError(409, "Exam schedule operation could not be committed");
  return result;
}

async function normalizeSchedule(data: Record<string, unknown>) {
  const subjects = data.subjects as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(subjects) || subjects.length === 0) {
    throw createError(400, "At least one exam subject is required");
  }
  if (subjects.length > 50) throw createError(400, "Exam schedule has too many subjects");
  let requiredVenueCapacity: number | undefined;
  if (data.sectionId) {
    const section = await sectionRepository.findRawById(String(data.sectionId));
    if (!section) throw createError(404, "Section not found");
    data.departmentId = section.departmentId;
    data.program = section.program;
    data.branch = section.departmentCode;
    data.semester = section.semesterNo;
    data.section = section.sectionName;
    data.academicYear = section.academicYear;
    requiredVenueCapacity = Math.max(section.allottedCount || 0, section.capacity || 0);
  }
  const departmentId = String(data.departmentId || "");
  if (!departmentId) throw createError(400, "Department is required");
  const requestedInvigilatorIds = [
    ...new Set(
      subjects.flatMap((item) =>
        Array.isArray(item.invigilators) ? item.invigilators.map(String) : [],
      ),
    ),
  ];
  if (
    !requestedInvigilatorIds.length ||
    requestedInvigilatorIds.some((id) => !Types.ObjectId.isValid(id))
  ) {
    throw createError(400, "Every exam subject requires valid invigilators");
  }
  const eligibleInvigilators = await UserModel.find({
    _id: { $in: requestedInvigilatorIds },
    status: "active",
    roles: {
      $in: [SystemRole.FACULTY, SystemRole.HOD, SystemRole.EXAMINATION_CELL, SystemRole.PRINCIPAL],
    },
  })
    .select("_id")
    .lean();
  if (eligibleInvigilators.length !== requestedInvigilatorIds.length) {
    throw createError(400, "One or more invigilators are inactive or not eligible for exam duty");
  }
  const requestedVenueIds = [
    ...new Set(subjects.map((item) => String(item.venueId || "")).filter(Boolean)),
  ];
  if (requestedVenueIds.some((id) => !Types.ObjectId.isValid(id))) {
    throw createError(400, "One or more exam venues are invalid");
  }
  const facilities = requestedVenueIds.length
    ? await FacilitySpaceModel.find({ _id: { $in: requestedVenueIds } }).lean()
    : [];
  const facilityById = new Map(facilities.map((facility) => [facility._id.toString(), facility]));
  const seenSubjects = new Set<string>();
  const occupied: Array<{ date: string; start: number; end: number }> = [];
  data.subjects = await Promise.all(
    subjects.map(async (item) => {
      const subjectId = String(item.subjectId || "");
      if (!subjectId || seenSubjects.has(subjectId)) {
        throw createError(400, "Exam subjects must be unique and valid");
      }
      seenSubjects.add(subjectId);
      const subject = await subjectRepository.findById(subjectId);
      if (!subject || !subject.isActive) throw createError(404, "Active exam subject not found");
      if (subject.departmentId.toString() !== departmentId) {
        throw createError(400, `${subject.code} does not belong to the schedule department`);
      }
      if (subject.semester && subject.semester !== Number(data.semester)) {
        throw createError(400, `${subject.code} does not belong to the schedule semester`);
      }
      const examDate = new Date(String(item.examDate));
      if (!Number.isFinite(examDate.getTime())) throw createError(400, "Valid exam date required");
      examDate.setHours(0, 0, 0, 0);
      const startTime = String(item.startTime || "");
      const endTime = String(item.endTime || "");
      const duration = examDurationMinutes(startTime, endTime);
      const startMinute = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3));
      const endMinute = startMinute + duration;
      const dateKey = examDate.toISOString();
      if (
        occupied.some(
          (slot) => slot.date === dateKey && startMinute < slot.end && endMinute > slot.start,
        )
      ) {
        throw createError(409, "A section cannot have overlapping exams in the same slot");
      }
      occupied.push({ date: dateKey, start: startMinute, end: endMinute });
      const invigilators = Array.isArray(item.invigilators)
        ? [...new Set(item.invigilators.map(String))]
        : [];
      if (!invigilators.length) throw createError(400, `Assign an evaluator for ${subject.code}`);
      const requestedVenueId = String(item.venueId || "");
      const facility = requestedVenueId ? facilityById.get(requestedVenueId) : undefined;
      if (requestedVenueId && !facility) throw createError(404, "Exam venue was not found");
      if (facility && facility.status !== "active") {
        throw createError(409, `${facility.code} is not available for examinations`);
      }
      if (facility && !["classroom", "laboratory", "auditorium"].includes(facility.type)) {
        throw createError(409, `${facility.code} is not configured as an examination space`);
      }
      if (facility && requiredVenueCapacity && facility.capacity < requiredVenueCapacity) {
        throw createError(
          409,
          `${facility.code} capacity (${facility.capacity}) is below section capacity (${requiredVenueCapacity})`,
        );
      }
      const venue = String(facility?.code || item.venue || "")
        .trim()
        .toUpperCase();
      if (!venue || venue.length > 100)
        throw createError(400, `Assign a valid venue for ${subject.code}`);
      return {
        ...item,
        subjectId: subject._id,
        subjectCode: subject.code,
        subjectName: subject.name,
        examDate,
        startTime,
        endTime,
        duration,
        venueId: facility?._id,
        venue,
        invigilators,
        maxMarks: subject.externalMarks,
        passMarks: subject.passMarksExternal,
      };
    }),
  );
  return data as Record<string, unknown> & { subjects: NormalizedExamSubject[] };
}

export function calculateGrade(input: {
  internalTotal?: number;
  internalMax?: number;
  externalMarks?: number;
  externalMax?: number;
  isAbsent?: boolean;
}) {
  const internalTotal = Number(input.internalTotal || 0);
  const internalMax = Number(input.internalMax || 30);
  const externalMarks = Number(input.externalMarks || 0);
  const externalMax = Number(input.externalMax || 70);
  if (
    ![internalTotal, internalMax, externalMarks, externalMax].every(Number.isFinite) ||
    internalMax <= 0 ||
    externalMax <= 0 ||
    internalTotal < 0 ||
    externalMarks < 0 ||
    internalTotal > internalMax ||
    externalMarks > externalMax
  ) {
    throw createError(400, "Marks must be within the configured internal and external maximums");
  }
  const totalMarks = input.isAbsent ? 0 : internalTotal + externalMarks;
  const totalMax = internalMax + externalMax;
  const percentage = totalMax > 0 ? (totalMarks / totalMax) * 100 : 0;
  let gradeLetter = "F";
  let gradePoint = 0;
  if (!input.isAbsent) {
    if (percentage >= 90) {
      gradeLetter = "O";
      gradePoint = 10;
    } else if (percentage >= 80) {
      gradeLetter = "A+";
      gradePoint = 9;
    } else if (percentage >= 70) {
      gradeLetter = "A";
      gradePoint = 8;
    } else if (percentage >= 60) {
      gradeLetter = "B+";
      gradePoint = 7;
    } else if (percentage >= 50) {
      gradeLetter = "B";
      gradePoint = 6;
    } else if (percentage >= 45) {
      gradeLetter = "C";
      gradePoint = 5;
    }
  }
  const isPassed =
    gradePoint > 0 && internalTotal >= internalMax * 0.4 && externalMarks >= externalMax * 0.4;
  return {
    internalTotal,
    internalMax,
    externalMarks,
    externalMax,
    totalMarks,
    totalMax,
    percentage,
    gradeLetter,
    gradePoint,
    isPassed,
  };
}

export const examinationService = {
  // ─── Schedule ─────────────────────────────────────────────────────────────

  createSchedule: async (data: Record<string, unknown>, createdBy: string) => {
    const normalized = await normalizeSchedule({
      ...data,
      status: ExamStatus.SCHEDULED,
      publishedAt: new Date(),
    });
    const schedule = await withExamScheduleLocks(
      examScheduleLockKeys(normalized.subjects),
      async (session) => {
        await assertNoExamResourceConflicts(normalized.subjects, undefined, session);
        return examinationRepository.createSchedule({ ...normalized, createdBy }, session);
      },
    );
    void notifyStudentsByClass(
      { semester: data.semester as number, academicYear: data.academicYear as string },
      {
        title: `Exam scheduled: ${(data as { examType?: string }).examType ?? "Exam"}`,
        body: `${(data as { examType?: string }).examType ?? "An exam"} for Sem ${data.semester ?? "?"} (${data.academicYear ?? ""}) has been scheduled. Check your exam timetable for details.`,
        type: NotificationType.EXAM,
        actionUrl: "/student/examination",
      },
    );
    return schedule;
  },

  getSchedule: async (id: string) => {
    const s = await examinationRepository.findScheduleById(id);
    if (!s) throw createError(404, "Exam schedule not found");
    return s;
  },

  listSchedules: (filter: Record<string, unknown>) => examinationRepository.listSchedules(filter),

  updateSchedule: async (id: string, data: Record<string, unknown>) => {
    const existing = await examinationRepository.findScheduleById(id);
    if (!existing) throw createError(404, "Exam schedule not found");
    if ([ExamStatus.COMPLETED, ExamStatus.CANCELLED].includes(existing.status)) {
      throw createError(409, "Completed or cancelled exam schedules are immutable");
    }
    const requestedStatus = (data.status as ExamStatus | undefined) ?? existing.status;
    const allowedTransitions: Record<ExamStatus, ExamStatus[]> = {
      [ExamStatus.SCHEDULED]: [
        ExamStatus.SCHEDULED,
        ExamStatus.ONGOING,
        ExamStatus.POSTPONED,
        ExamStatus.CANCELLED,
      ],
      [ExamStatus.ONGOING]: [ExamStatus.ONGOING, ExamStatus.COMPLETED, ExamStatus.POSTPONED],
      [ExamStatus.POSTPONED]: [ExamStatus.POSTPONED, ExamStatus.SCHEDULED, ExamStatus.CANCELLED],
      [ExamStatus.COMPLETED]: [ExamStatus.COMPLETED],
      [ExamStatus.CANCELLED]: [ExamStatus.CANCELLED],
    };
    if (!allowedTransitions[existing.status].includes(requestedStatus)) {
      throw createError(
        409,
        `Invalid exam transition from ${existing.status} to ${requestedStatus}`,
      );
    }
    const normalized = await normalizeSchedule({
      ...existing,
      ...data,
      createdBy: existing.createdBy,
      status: requestedStatus,
    });
    delete normalized._id;
    delete normalized.createdAt;
    delete normalized.updatedAt;
    const keys = [
      ...examScheduleLockKeys(existing.subjects as unknown as NormalizedExamSubject[]),
      ...examScheduleLockKeys(normalized.subjects),
    ];
    const updated = await withExamScheduleLocks(keys, async (session) => {
      const current = await examinationRepository.findScheduleById(id, session);
      if (!current || current.status !== existing.status) {
        throw createError(409, "Exam schedule changed while it was being updated");
      }
      await assertNoExamResourceConflicts(normalized.subjects, id, session);
      return examinationRepository.updateSchedule(id, normalized, session);
    });
    if (!updated) throw createError(404, "Exam schedule not found");
    return updated;
  },

  // ─── Enter Marks ──────────────────────────────────────────────────────────

  enterMarks: async (
    marks: Array<{
      scheduleId?: string;
      studentId: string;
      rollNumber: string;
      enrollmentNumber?: string;
      subjectId: string;
      subjectCode: string;
      examType: ExamType;
      semester: number;
      academicYear: string;
      internalComponents?: Array<{ name: string; maxMarks: number; marksObtained: number }>;
      internalTotal?: number;
      internalMax?: number;
      externalMarks?: number;
      externalMax?: number;
      isAbsent?: boolean;
      enteredBy: string;
      requireAssignedSchedule?: boolean;
    }>,
  ) => {
    const registrationCache = new Map<
      string,
      Awaited<ReturnType<typeof semesterRegistrationRepository.findByStudentSemester>>
    >();
    const scheduleCache = new Map<
      string,
      Awaited<ReturnType<typeof examinationRepository.findScheduleById>>
    >();
    const registrationByMark = new Map<
      string,
      NonNullable<Awaited<ReturnType<typeof semesterRegistrationRepository.findByStudentSemester>>>
    >();
    const subjectAttemptType = new Map<string, "regular" | "backlog">();
    const subjectCache = new Map<string, Awaited<ReturnType<typeof subjectRepository.findById>>>();
    const inputKeys = new Set<string>();

    for (const mark of marks) {
      const inputKey = `${mark.studentId}:${mark.subjectId}:${mark.examType}:${mark.academicYear}`;
      if (inputKeys.has(inputKey)) throw createError(400, "Duplicate marks record in request");
      inputKeys.add(inputKey);
      if (mark.requireAssignedSchedule) {
        if (!mark.scheduleId) {
          throw createError(403, "Faculty marks entry requires an assigned exam schedule");
        }
        let schedule = scheduleCache.get(mark.scheduleId);
        if (!scheduleCache.has(mark.scheduleId)) {
          schedule = await examinationRepository.findScheduleById(mark.scheduleId);
          scheduleCache.set(mark.scheduleId, schedule);
        }
        if (!schedule) throw createError(404, "Exam schedule not found");
        if (schedule.status !== ExamStatus.COMPLETED) {
          throw createError(409, "Marks can be entered only after the exam schedule is completed");
        }
        if (
          schedule.examType !== mark.examType ||
          schedule.semester !== mark.semester ||
          schedule.academicYear !== mark.academicYear
        ) {
          throw createError(400, "Marks context does not match the selected exam schedule");
        }
        const scheduledSubject = (schedule.subjects ?? []).find(
          (s) =>
            s.subjectId?.toString() === mark.subjectId ||
            s.subjectCode?.toUpperCase() === mark.subjectCode.toUpperCase(),
        );
        if (!scheduledSubject) {
          throw createError(400, `${mark.subjectCode} is not part of the selected exam schedule`);
        }
        const invigilators = scheduledSubject.invigilators ?? [];
        if (!invigilators.some((id) => id.toString() === mark.enteredBy)) {
          throw createError(403, "Faculty can enter marks only for assigned exam subjects");
        }
      }

      const cacheKey = `${mark.studentId}:${mark.semester}:${mark.academicYear}`;
      let registration = registrationCache.get(cacheKey);
      if (!registrationCache.has(cacheKey)) {
        registration = await semesterRegistrationRepository.findByStudentSemester(
          mark.studentId,
          mark.semester,
          mark.academicYear,
        );
        registrationCache.set(cacheKey, registration);
      }
      if (
        !registration ||
        ![RegistrationStatus.APPROVED, RegistrationStatus.FROZEN].includes(
          registration.status as RegistrationStatus,
        )
      ) {
        throw createError(403, "Marks can be entered only after semester registration approval");
      }
      const registered = registration.registeredSubjects ?? [];
      const isRegistered = registered.some(
        (s) =>
          s.subjectId.toString() === mark.subjectId ||
          s.subjectCode.toUpperCase() === mark.subjectCode.toUpperCase(),
      );
      if (!isRegistered) {
        throw createError(
          400,
          `${mark.subjectCode} is not registered for ${mark.rollNumber || mark.studentId}`,
        );
      }
      registrationByMark.set(cacheKey, registration);
      const registeredSubject = registered.find(
        (s) =>
          s.subjectId.toString() === mark.subjectId ||
          s.subjectCode.toUpperCase() === mark.subjectCode.toUpperCase(),
      );
      if (!registeredSubject) throw createError(400, "Registered subject not found");
      let subject = subjectCache.get(registeredSubject.subjectId.toString());
      if (!subjectCache.has(registeredSubject.subjectId.toString())) {
        subject = await subjectRepository.findById(registeredSubject.subjectId.toString());
        subjectCache.set(registeredSubject.subjectId.toString(), subject);
      }
      if (!subject || !subject.isActive) throw createError(404, "Active subject not found");
      const components = mark.internalComponents ?? [];
      const componentNames = components.map((component) => component.name.trim().toLowerCase());
      if (new Set(componentNames).size !== componentNames.length) {
        throw createError(400, `Duplicate internal component for ${subject.code}`);
      }
      for (const component of components) {
        if (
          !component.name.trim() ||
          !Number.isFinite(component.maxMarks) ||
          !Number.isFinite(component.marksObtained) ||
          component.maxMarks <= 0 ||
          component.marksObtained < 0 ||
          component.marksObtained > component.maxMarks
        ) {
          throw createError(400, `Invalid internal component marks for ${subject.code}`);
        }
      }
      if (
        components.length &&
        components.reduce((sum, component) => sum + component.maxMarks, 0) !== subject.internalMarks
      ) {
        throw createError(
          400,
          `Internal component maximums must total ${subject.internalMarks} for ${subject.code}`,
        );
      }
      if (
        mark.isAbsent &&
        (Number(mark.internalTotal || 0) > 0 || Number(mark.externalMarks || 0) > 0)
      ) {
        throw createError(400, "Absent students cannot have marks");
      }
      const published = await examinationRepository.findPublishedMarks(
        mark.studentId,
        registeredSubject.subjectId.toString(),
        mark.examType,
        mark.academicYear,
      );
      if (published)
        throw createError(409, "Published marks are immutable; use revaluation workflow");
      mark.subjectId = registeredSubject.subjectId.toString();
      mark.subjectCode = subject.code;
      mark.rollNumber = registration.rollNumber;
      mark.internalMax = subject.internalMarks;
      mark.externalMax = subject.externalMarks;
      subjectAttemptType.set(
        `${cacheKey}:${mark.subjectId}:${mark.subjectCode.toUpperCase()}`,
        registeredSubject?.isBacklog ? "backlog" : "regular",
      );
    }

    const records = marks.map((m) => {
      const cacheKey = `${m.studentId}:${m.semester}:${m.academicYear}`;
      const registration = registrationByMark.get(cacheKey);
      const totals = calculateGrade({
        ...m,
        internalTotal: m.internalComponents?.length
          ? m.internalComponents.reduce((s, c) => s + c.marksObtained, 0)
          : (m.internalTotal ?? 0),
      });
      return {
        ...m,
        curriculumId: registration?.curriculumId,
        departmentId: registration?.departmentId,
        batchId: registration?.batchId,
        sectionId: registration?.sectionId,
        ...totals,
      };
    });
    const result = await examinationRepository.bulkUpsertMarks(
      records as Parameters<typeof examinationRepository.bulkUpsertMarks>[0],
    );

    for (const record of records) {
      const key = `${record.studentId}:${record.semester}:${record.academicYear}:${record.subjectId}:${record.subjectCode.toUpperCase()}`;
      const attemptType = subjectAttemptType.get(key) ?? "regular";
      const attemptFilter = record.scheduleId
        ? {
            scheduleId: record.scheduleId,
            studentId: record.studentId,
            subjectId: record.subjectId,
            examType: record.examType,
          }
        : {
            studentId: record.studentId,
            subjectId: record.subjectId,
            examType: record.examType,
            academicYear: record.academicYear,
            attemptType,
          };
      const existingCount = await examinationRepository.countAttempts({
        studentId: record.studentId,
        subjectId: record.subjectId,
        examType: record.examType,
        attemptType,
      });
      await examinationRepository.upsertAttempt(attemptFilter, {
        ...record,
        attemptType,
        attemptNo: record.scheduleId ? Math.max(existingCount, 1) : existingCount + 1,
      });
      await redisUtil.delPattern(
        `exam:marks:*:${record.studentId}:${record.semester}:${record.academicYear}`,
      );
    }

    return result;
  },

  getStudentMarks: (
    studentId: string,
    semester: number,
    academicYear: string,
    publishedOnly = false,
  ) => {
    const cacheKey = `exam:marks:${publishedOnly ? "published" : "all"}:${studentId}:${semester}:${academicYear}`;
    return redisUtil.remember(cacheKey, RESULT_TTL, () =>
      examinationRepository.findMarksByStudent(studentId, semester, academicYear, publishedOnly),
    );
  },

  listPendingMarkVerification: (filter: Record<string, unknown> = {}) =>
    examinationRepository.listPendingVerification(filter),

  verifyMarks: async (markIds: string[], verifierId: string) => {
    const uniqueIds = [...new Set(markIds)];
    if (
      !uniqueIds.length ||
      uniqueIds.length > 300 ||
      uniqueIds.some((id) => !Types.ObjectId.isValid(id))
    ) {
      throw createError(400, "Select between 1 and 300 valid marks records");
    }
    const records = await examinationRepository.findMarksForVerification(uniqueIds);
    if (records.length !== uniqueIds.length)
      throw createError(404, "One or more marks records were not found");
    if (records.some((record) => record.isPublished)) {
      throw createError(409, "Published marks cannot be verified again");
    }
    if (records.some((record) => record.verifiedBy)) {
      throw createError(409, "One or more marks records are already verified");
    }
    if (records.some((record) => record.enteredBy.toString() === verifierId)) {
      throw createError(
        409,
        "Marks must be verified by someone other than the person who entered them",
      );
    }
    const result = await examinationRepository.verifyMarks(uniqueIds, verifierId);
    if (result.modifiedCount !== uniqueIds.length) {
      throw createError(409, "Marks changed while verification was in progress; reload and retry");
    }
    return { verifiedCount: result.modifiedCount };
  },

  listAttempts: (filter: Record<string, unknown>) => examinationRepository.listAttempts(filter),

  // ─── Semester Result compilation ──────────────────────────────────────────

  compileSemesterResult: async (
    studentId: string,
    rollNumber: string,
    enrollmentNumber: string,
    semester: number,
    academicYear: string,
    _program: string,
    _branch: string,
    _enteredBy: string,
  ) => {
    const registration = await semesterRegistrationRepository.findByStudentSemester(
      studentId,
      semester,
      academicYear,
    );
    if (!registration || registration.status !== RegistrationStatus.FROZEN) {
      throw createError(409, "Semester registration must be frozen before result compilation");
    }
    const studentProfile = await studentProfileRepository.findByUserId(studentId);
    if (!studentProfile) throw createError(404, "Student profile not found");
    const existingResult = await examinationRepository.findResult(
      studentId,
      semester,
      academicYear,
    );
    if (existingResult?.isPublished) {
      throw createError(409, "Published semester results are immutable");
    }
    const marksList = await examinationRepository.findMarksByStudent(
      studentId,
      semester,
      academicYear,
    );
    const unverifiedFinalMarks = marksList.filter(
      (marks) =>
        [ExamType.END_SEM, ExamType.SUPPLEMENTARY, ExamType.BACK].includes(
          marks.examType as ExamType,
        ) && !marks.verifiedBy,
    );
    if (unverifiedFinalMarks.length) {
      throw createError(
        409,
        `Final marks require independent verification: ${[
          ...new Set(unverifiedFinalMarks.map((marks) => marks.subjectCode)),
        ].join(", ")}`,
      );
    }

    const allotment = await studentSectionAllotmentRepository.findActiveForStudentSemester(
      studentId,
      academicYear,
      semester,
    );
    const curriculum = allotment?.curriculumId
      ? await curriculumRepository.findById(allotment.curriculumId.toString())
      : null;
    const plan = curriculum?.semesterPlans?.find((p) => p.semesterNo === semester);
    const subjectMap = new Map(
      (plan?.subjects ?? []).map((s) => [
        s.subjectId.toString(),
        {
          subjectCode: s.subjectCode,
          subjectName: s.subjectName,
          credits: s.credits,
        },
      ]),
    );

    const finalExamPriority = new Map<ExamType, number>([
      [ExamType.BACK, 3],
      [ExamType.SUPPLEMENTARY, 2],
      [ExamType.END_SEM, 1],
    ]);
    const finalMarksBySubject = new Map<string, (typeof marksList)[number]>();
    for (const marks of marksList) {
      const priority = finalExamPriority.get(marks.examType as ExamType);
      if (!priority) continue;
      const key = marks.subjectId.toString();
      const current = finalMarksBySubject.get(key);
      if (!current || priority > (finalExamPriority.get(current.examType as ExamType) ?? 0)) {
        finalMarksBySubject.set(key, marks);
      }
    }
    const gradedRegistrations = (registration.registeredSubjects ?? []).filter(
      (subject) => subject.credits > 0,
    );
    const missing = gradedRegistrations.filter(
      (subject) => !finalMarksBySubject.has(subject.subjectId.toString()),
    );
    if (missing.length) {
      throw createError(
        409,
        `Final marks are missing for: ${missing.map((subject) => subject.subjectCode).join(", ")}`,
      );
    }

    const subjectResults = gradedRegistrations.map((registeredSubject) => {
      const m = finalMarksBySubject.get(registeredSubject.subjectId.toString())!;
      const planned = subjectMap.get(registeredSubject.subjectId.toString());
      const credits = registeredSubject.credits ?? planned?.credits ?? 0;
      return {
        subjectCode: registeredSubject.subjectCode || planned?.subjectCode || m.subjectCode,
        subjectName: registeredSubject.subjectName || planned?.subjectName || m.subjectCode,
        credits,
        internalMarks: m.internalTotal,
        externalMarks: m.externalMarks,
        totalMarks: m.totalMarks,
        gradePoint: m.gradePoint,
        gradeLetter: m.gradeLetter,
        creditPoints: credits * m.gradePoint,
        isPassed: m.isPassed,
        isBack: !m.isPassed,
      };
    });

    const totalCreditPoints = subjectResults.reduce((s, r) => s + r.creditPoints, 0);
    const totalCreditsEarned = subjectResults
      .filter((r) => r.isPassed)
      .reduce((s, r) => s + r.credits, 0);
    const totalCreditsReg = subjectResults.reduce((s, r) => s + r.credits, 0);
    const sgpa =
      totalCreditsReg > 0 ? parseFloat((totalCreditPoints / totalCreditsReg).toFixed(2)) : 0;
    const backSubjects = subjectResults.filter((r) => r.isBack).map((r) => r.subjectCode);

    const previousResults = await examinationRepository.findResultsByStudent(studentId);
    const previousPublished = previousResults.filter(
      (r) => r.isPublished && !(r.semester === semester && r.academicYear === academicYear),
    );
    const cumulativeCredits =
      previousPublished.reduce((sum, r) => sum + (r.totalCreditsRegistered ?? 0), 0) +
      totalCreditsReg;
    const cumulativePoints =
      previousPublished.reduce((sum, r) => sum + (r.totalCreditPoints ?? 0), 0) + totalCreditPoints;
    const cgpa =
      cumulativeCredits > 0 ? parseFloat((cumulativePoints / cumulativeCredits).toFixed(2)) : sgpa;

    const hasWithheld = Array.from(finalMarksBySubject.values()).some((marks) => marks.isWithheld);
    const compiled = await examinationRepository.upsertResult(studentId, semester, academicYear, {
      curriculumId: registration.curriculumId ?? allotment?.curriculumId,
      departmentId: registration.departmentId,
      batchId: registration.batchId ?? allotment?.batchId,
      sectionId: registration.sectionId ?? allotment?.sectionId,
      rollNumber: registration.rollNumber,
      enrollmentNumber: studentProfile.registrationNumber || enrollmentNumber || "",
      program: registration.program,
      branch: registration.branch,
      semester,
      academicYear,
      subjectResults,
      totalCreditsRegistered: totalCreditsReg,
      totalCreditsEarned,
      totalCreditPoints,
      sgpa,
      cgpa,
      backlogs: backSubjects.length,
      backSubjects,
      result: hasWithheld ? "WITHHELD" : backSubjects.length === 0 ? "PASS" : "FAIL",
    });
    await redisUtil.delPattern(`exam:result:*:${studentId}:${semester}:${academicYear}`);
    await redisUtil.delPattern(`exam:results:*:${studentId}`);
    return compiled;
  },

  publishResults: async (
    semester: number,
    academicYear: string,
    scope: Record<string, unknown> = {},
  ) => {
    const unverifiedMarksCount = await StudentMarksModel.countDocuments({
      semester,
      academicYear,
      isPublished: false,
      verifiedBy: { $exists: false },
      ...scope,
    });
    if (unverifiedMarksCount) {
      throw createError(
        409,
        `${unverifiedMarksCount} marks record(s) require independent verification before publishing`,
      );
    }
    const unpublishedCount = await SemesterResultModel.countDocuments({
      semester,
      academicYear,
      isPublished: false,
      ...scope,
    });
    if (!unpublishedCount) throw createError(409, "No compiled unpublished results found");
    const incompleteCount = await SemesterResultModel.countDocuments({
      semester,
      academicYear,
      isPublished: false,
      "subjectResults.0": { $exists: false },
      ...scope,
    });
    if (incompleteCount)
      throw createError(409, "All compiled results must contain subject results");
    const publishable = await SemesterResultModel.find({
      semester,
      academicYear,
      isPublished: false,
      "subjectResults.0": { $exists: true },
      ...scope,
    })
      .select("studentId")
      .lean();
    const studentIds = publishable.map((row) => row.studentId);
    const session = await mongoose.startSession();
    let result: Awaited<ReturnType<typeof examinationRepository.publishResults>> | undefined;
    try {
      await session.withTransaction(async () => {
        result = await examinationRepository.publishResults(semester, academicYear, scope, session);
        await examinationRepository.publishMarks(
          semester,
          academicYear,
          { studentId: { $in: studentIds } },
          session,
        );
      });
    } finally {
      await session.endSession();
    }
    await redisUtil.delPattern("exam:marks:*");
    await redisUtil.delPattern("exam:result:*");
    await redisUtil.delPattern("exam:results:*");
    try {
      const published = await SemesterResultModel.find({
        semester,
        academicYear,
        isPublished: true,
      })
        .select("studentId sgpa result")
        .lean();
      for (const row of published) {
        void notifyUsers([row.studentId], {
          title: `Sem ${semester} results published`,
          body: `Your Sem ${semester} (${academicYear}) result is now available. SGPA: ${row.sgpa ?? "-"} (${row.result ?? "-"}).`,
          type: NotificationType.RESULT,
          actionUrl: "/student/examination",
          withEmail: true,
        });
      }
    } catch (err) {
      logger.error("[publishResults notify] failed", { err });
    }
    return result!;
  },

  getResult: async (
    studentId: string,
    semester: number,
    academicYear: string,
    publishedOnly = false,
  ) => {
    const cacheKey = `exam:result:${publishedOnly ? "published" : "all"}:${studentId}:${semester}:${academicYear}`;
    return redisUtil.remember(cacheKey, RESULT_TTL, async () => {
      const result = await examinationRepository.findResult(
        studentId,
        semester,
        academicYear,
        publishedOnly,
      );
      if (!result) throw createError(404, "Result not found");
      return result;
    });
  },

  getStudentResults: (studentId: string, publishedOnly = false) => {
    const cacheKey = `exam:results:${publishedOnly ? "published" : "all"}:${studentId}`;
    return redisUtil.remember(cacheKey, RESULT_TTL, () =>
      examinationRepository.findResultsByStudent(studentId, publishedOnly),
    );
  },

  listResults: (filter: Record<string, unknown>, page = 1, limit = 20) =>
    examinationRepository.paginate(filter, page, limit),

  getRanklist: (filter: Record<string, unknown>) => examinationRepository.getRanklist(filter),

  // ─── Hall Ticket generation ───────────────────────────────────────────────

  generateSeatingPlan: async (scheduleId: string, createdBy: string, asPdf = false) => {
    const schedule = (await ExamScheduleModel.findById(scheduleId)
      .lean()
      .exec()) as IExamSchedule | null;
    if (!schedule) throw createError(404, "Exam schedule not found");
    // Build seating: fetch students for this schedule's semester/branch, shuffle & assign
    const { StudentProfileModel } = await import("../models/student-profile.model");
    const students = (await StudentProfileModel.find({
      semester: schedule.semester,
      program: schedule.program,
      isActive: true,
    } as unknown as MongoFilter<IStudentProfile>)
      .select("_id rollNumber name")
      .lean()
      .exec()) as unknown as Array<{ _id: unknown; rollNumber: string; name: string }>;
    // Shuffle (Fisher-Yates) to prevent malpractice
    for (let i = students.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [students[i], students[j]] = [students[j], students[i]];
    }
    const configuredHalls =
      (schedule as IExamSchedule & { halls?: Array<{ hallName?: string; capacity?: number }> })
        .halls ?? [];
    const venueHalls = Array.from(
      new Set(schedule.subjects.map((subject) => subject.venue).filter(Boolean)),
    ).map((hallName) => ({ hallName, capacity: 30 }));
    const halls = configuredHalls.length ? configuredHalls : venueHalls;
    if (!halls.length) {
      throw createError(409, "Add an exam venue before generating the seating plan");
    }
    const totalCapacity = halls.reduce((total, hall) => total + (hall.capacity ?? 30), 0);
    if (totalCapacity < students.length) {
      throw createError(
        409,
        `Seating capacity is ${totalCapacity}, but ${students.length} students are eligible`,
      );
    }
    const seatingMap: Array<{
      hall: string;
      seatNumber: number;
      student: unknown;
      rollNumber: string;
      studentName: string;
    }> = [];
    let seatIdx = 0;
    for (const hall of halls) {
      for (let seat = 1; seat <= (hall.capacity ?? 30); seat++) {
        if (seatIdx >= students.length) break;
        const s = students[seatIdx]!;
        seatingMap.push({
          hall: hall.hallName ?? String(hall),
          seatNumber: seat,
          student: s._id,
          rollNumber: s.rollNumber,
          studentName: s.name,
        });
        seatIdx++;
      }
    }
    const result = {
      scheduleId,
      totalStudents: students.length,
      seatingMap,
      generatedBy: createdBy,
    };

    if (asPdf) {
      const pdfBuffer = await pdfService.generateSeatingPlan({
        collegeName: configs.COLLEGE_NAME,
        examTitle: schedule.title,
        examType: schedule.examType,
        program: schedule.program,
        branch: schedule.branch,
        semester: schedule.semester,
        academicYear: schedule.academicYear,
        totalStudents: students.length,
        generatedBy: createdBy,
        generatedOn: formatIndiaDate(new Date()),
        seatingMap,
      });
      return pdfBuffer;
    }
    return result;
  },

  generateHallTicket: async (
    data: {
      scheduleId?: string;
      studentName: string;
      fatherName: string;
      rollNumber: string;
      enrollmentNumber: string;
      bputExamRoll: string;
      program: string;
      branch: string;
      semester: number;
      academicYear: string;
      examType: string;
      examCentre: string;
      subjects: Array<{ code: string; name: string; date: string; time: string; duration: string }>;
      allowFeePartialWaiver?: boolean;
      overrideEligibility?: boolean;
      overrideReason?: string;
      generatedBy?: string;
    },
    seq: number,
  ) => {
    const schedule = data.scheduleId
      ? await examinationRepository.findScheduleById(data.scheduleId)
      : null;
    if (data.scheduleId && !schedule) throw createError(404, "Examination schedule not found");
    if (schedule) {
      data.semester = schedule.semester;
      data.academicYear = schedule.academicYear;
      data.examType = schedule.examType;
      data.examCentre = schedule.subjects[0]?.venue || data.examCentre || "";
      data.subjects = schedule.subjects.map((subject) => ({
        code: subject.subjectCode,
        name: subject.subjectName,
        date: formatIndiaDate(subject.examDate),
        time: subject.startTime,
        duration: `${subject.duration} minutes`,
      }));
    }
    const profile = await studentProfileRepository.findByRollNumber(data.rollNumber);
    if (!profile) throw createError(404, "Student profile not found for this roll number");

    const studentId = profile.userId?.toString();
    if (!studentId) throw createError(400, "Student user is not linked to this profile");

    const registration = await semesterRegistrationRepository.findByStudentSemester(
      studentId,
      data.semester,
      data.academicYear,
    );
    if (
      !registration ||
      ![RegistrationStatus.APPROVED, RegistrationStatus.FROZEN].includes(
        registration.status as RegistrationStatus,
      )
    ) {
      throw createError(403, "Semester registration must be approved before hall ticket");
    }

    const feeRecord = await feeRepository.findByStudentSemester(
      studentId,
      data.semester,
      data.academicYear,
    );
    const feeCleared =
      feeRecord?.status === FeePaymentStatus.PAID || Number(feeRecord?.balanceDue || 0) <= 0;
    const feeWaived =
      data.allowFeePartialWaiver && feeRecord && Number(feeRecord.totalPaid || 0) > 0;
    if (!feeCleared && !feeWaived && !data.overrideEligibility) {
      throw createError(403, "Fee must be cleared before hall ticket generation");
    }

    const minAttendance = Number(process.env["EXAM_MIN_ATTENDANCE_PERCENT"] || 75);
    const summaries = await attendanceRepository.getStudentAllSummaries(
      studentId,
      data.semester,
      data.academicYear,
    );
    const shortage = summaries.find((s) => s.percentage < minAttendance);
    if (shortage && !data.overrideEligibility) {
      throw createError(
        403,
        `Attendance eligibility is below the required ${minAttendance}% threshold`,
      );
    }

    if (data.overrideEligibility) {
      if (!data.overrideReason?.trim()) {
        throw createError(400, "Eligibility override reason is required");
      }
      await auditLogRepository.create({
        action: "hall_ticket_eligibility_override",
        module: "examination",
        targetId: studentId,
        targetModel: "User",
        description: `Hall ticket eligibility overridden for ${data.rollNumber}`,
        metadata: {
          semester: data.semester,
          academicYear: data.academicYear,
          reason: data.overrideReason,
          minAttendance,
          feeStatus: feeRecord?.status,
          feeBalance: feeRecord?.balanceDue,
          shortageSubjectId: shortage?.subjectId?.toString(),
          generatedBy: data.generatedBy,
        },
      });
    }

    const registeredSubjects = registration.registeredSubjects ?? [];
    const eligibleSubjects = registeredSubjects.length
      ? registeredSubjects.map((s) => ({
          code: s.subjectCode,
          name: s.subjectName,
          date: data.subjects.find((sub) => sub.code === s.subjectCode)?.date ?? "",
          time: data.subjects.find((sub) => sub.code === s.subjectCode)?.time ?? "",
          duration: data.subjects.find((sub) => sub.code === s.subjectCode)?.duration ?? "",
        }))
      : data.subjects;
    const hallTicketNumber = `HT-${data.academicYear.replace("-", "")}-${String(seq).padStart(5, "0")}`;
    return pdfService.generateHallTicket({
      ...data,
      studentName:
        data.studentName || [profile.firstName, profile.lastName].filter(Boolean).join(" "),
      fatherName: data.fatherName || profile.parentInfo?.fatherName || "",
      enrollmentNumber: data.enrollmentNumber || profile.registrationNumber || "",
      program: data.program || profile.program || "",
      subjects: eligibleSubjects,
      hallTicketNumber,
    });
  },

  // ─── Recheck / Revaluation (M20) ─────────────────────────────────────────

  submitRecheckRequest: async (
    studentId: string,
    rollNumber: string,
    semester: number,
    academicYear: string,
    subjectCode: string,
    subjectName: string,
    requestType: "recheck" | "revaluation",
    currentMarks: number,
    reason?: string,
  ) => {
    const publishedResult = await SemesterResultModel.findOne({
      studentId,
      semester,
      academicYear,
      isPublished: true,
    }).lean();
    if (!publishedResult) throw createError(404, "Published semester result not found");
    const subjectResult = publishedResult.subjectResults.find(
      (subject) => subject.subjectCode.toUpperCase() === subjectCode.toUpperCase(),
    );
    if (!subjectResult) throw createError(404, "Subject is not part of the published result");
    const profile = await studentProfileRepository.findByUserId(studentId);
    if (!profile) throw createError(404, "Student profile not found");

    // Prevent duplicate active request
    const { RecheckRequestModel } = await import("../models/examination.model");
    const existing = await RecheckRequestModel.findOne({
      studentId,
      semester,
      academicYear,
      subjectCode,
      status: { $in: ["pending", "under_review"] },
    }).lean();
    if (existing)
      throw createError(409, "A pending recheck request already exists for this subject");

    return examinationRepository.createRecheckRequest({
      studentId,
      rollNumber: profile.rollNumber,
      semester,
      academicYear,
      subjectCode,
      subjectName: subjectResult.subjectName,
      requestType,
      currentMarks: subjectResult.externalMarks,
      reason,
      fee: requestType === "revaluation" ? 1000 : 500,
    });
  },

  listRecheckRequests: (filter: Record<string, unknown>, page = 1, limit = 20) =>
    examinationRepository.listRecheckRequests(filter, page, limit),

  getRecheckRequest: async (id: string) => {
    const req = await examinationRepository.findRecheckById(id);
    if (!req) throw createError(404, "Recheck request not found");
    return req;
  },

  reviewRecheckRequest: async (
    id: string,
    reviewedBy: string,
    status: string,
    revisedMarks?: number,
    reviewNotes?: string,
  ) => {
    const recheckReq = await examinationRepository.findRecheckById(id);
    if (!recheckReq) throw createError(404, "Recheck request not found");
    if (recheckReq.status !== "under_review" || !recheckReq.feePaid) {
      throw createError(409, "Only a fee-paid request under review can be finalized");
    }
    if (!(["marks_updated", "no_change", "rejected"] as string[]).includes(status)) {
      throw createError(400, "Invalid recheck review outcome");
    }
    if (!reviewNotes?.trim()) throw createError(400, "Review notes are required");

    const update: Record<string, unknown> = {
      status,
      reviewedBy,
      reviewNotes,
      reviewedAt: new Date(),
    };
    let finalized: unknown;
    if (status === "marks_updated") {
      if (revisedMarks === undefined || !Number.isFinite(Number(revisedMarks))) {
        throw createError(400, "Revised marks are required when marks are updated");
      }
      update.revisedMarks = Number(revisedMarks);
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const candidates = await StudentMarksModel.find({
            studentId: recheckReq.studentId,
            semester: recheckReq.semester,
            academicYear: recheckReq.academicYear,
            subjectCode: recheckReq.subjectCode,
            examType: { $in: [ExamType.BACK, ExamType.SUPPLEMENTARY, ExamType.END_SEM] },
            isPublished: true,
          }).session(session);
          const priority = [ExamType.BACK, ExamType.SUPPLEMENTARY, ExamType.END_SEM];
          const marks = priority
            .map((examType) => candidates.find((candidate) => candidate.examType === examType))
            .find(Boolean);
          if (!marks) throw createError(404, "Published source marks record not found");
          const grade = calculateGrade({
            internalTotal: marks.internalTotal,
            internalMax: marks.internalMax,
            externalMarks: Number(revisedMarks),
            externalMax: marks.externalMax,
            isAbsent: false,
          });
          const result = await SemesterResultModel.findOne({
            studentId: recheckReq.studentId,
            semester: recheckReq.semester,
            academicYear: recheckReq.academicYear,
            isPublished: true,
          }).session(session);
          if (!result) throw createError(404, "Published semester result not found");
          const subject = result.subjectResults.find(
            (item) => item.subjectCode.toUpperCase() === recheckReq.subjectCode.toUpperCase(),
          );
          if (!subject) throw createError(404, "Subject result not found");

          Object.assign(subject, {
            externalMarks: grade.externalMarks,
            totalMarks: grade.totalMarks,
            gradePoint: grade.gradePoint,
            gradeLetter: grade.gradeLetter,
            creditPoints: subject.credits * grade.gradePoint,
            isPassed: grade.isPassed,
            isBack: !grade.isPassed,
          });
          result.totalCreditsEarned = result.subjectResults
            .filter((item) => item.isPassed)
            .reduce((sum, item) => sum + item.credits, 0);
          result.totalCreditPoints = result.subjectResults.reduce(
            (sum, item) => sum + item.creditPoints,
            0,
          );
          result.sgpa = result.totalCreditsRegistered
            ? Number((result.totalCreditPoints / result.totalCreditsRegistered).toFixed(2))
            : 0;
          result.backSubjects = result.subjectResults
            .filter((item) => item.isBack)
            .map((item) => item.subjectCode);
          result.backlogs = result.backSubjects.length;
          result.result = result.backlogs ? "FAIL" : "PASS";

          marks.set({ ...grade, isAbsent: false, verifiedBy: reviewedBy });
          await marks.save({ session });
          await result.save({ session });

          const semesterResults = await SemesterResultModel.find({
            studentId: recheckReq.studentId,
            isPublished: true,
          })
            .sort({ semester: 1, academicYear: 1 })
            .session(session);
          let cumulativeCredits = 0;
          let cumulativePoints = 0;
          for (const semesterResult of semesterResults) {
            cumulativeCredits += semesterResult.totalCreditsRegistered;
            cumulativePoints += semesterResult.totalCreditPoints;
            semesterResult.cgpa = cumulativeCredits
              ? Number((cumulativePoints / cumulativeCredits).toFixed(2))
              : 0;
            await semesterResult.save({ session });
          }

          finalized = await examinationRepository.transitionRecheckRequest(
            id,
            { status: "under_review", feePaid: true },
            update,
            session,
          );
          if (!finalized) throw createError(409, "Recheck request was concurrently finalized");
        });
      } finally {
        await session.endSession();
      }
    } else {
      finalized = await examinationRepository.transitionRecheckRequest(
        id,
        { status: "under_review", feePaid: true },
        update,
      );
      if (!finalized) throw createError(409, "Recheck request was concurrently finalized");
    }
    await redisUtil.delPattern(`exam:marks:*:${recheckReq.studentId}:*`);
    await redisUtil.delPattern(
      `exam:result:*:${recheckReq.studentId}:${recheckReq.semester}:${recheckReq.academicYear}`,
    );
    await redisUtil.delPattern(`exam:results:*:${recheckReq.studentId}`);
    return finalized;
  },

  markRecheckFeePaid: async (id: string) => {
    const recheckReq = await examinationRepository.findRecheckById(id);
    if (!recheckReq) throw createError(404, "Recheck request not found");
    const updated = await examinationRepository.transitionRecheckRequest(
      id,
      { status: "pending", feePaid: false },
      { feePaid: true, status: "under_review" },
    );
    if (!updated) throw createError(409, "Recheck request is not awaiting fee verification");
    return updated;
  },

  // ─── Marksheet / Transcript PDF ──────────────────────────────────────────

  /**
   * Generate a semester marksheet PDF for a student.
   * Fetches the compiled SemesterResult and the student's profile, then
   * renders the marksheet template and optionally caches the Cloudinary URL.
   */
  generateMarksheetPdf: async (
    studentId: string,
    semester: number,
    academicYear: string,
  ): Promise<Buffer> => {
    const semResult = await SemesterResultModel.findOne({
      studentId,
      semester,
      academicYear,
    }).lean();
    if (!semResult) throw createError(404, "Result not found or not yet published");
    if (!(semResult as unknown as { isPublished: boolean }).isPublished)
      throw createError(403, "Results have not been published yet");

    const { StudentProfileModel } = await import("../models/student-profile.model");
    const profile = (await StudentProfileModel.findOne({ userId: studentId })
      .select("name fatherName motherName rollNumber photoUrl")
      .lean()) as {
      name: string;
      fatherName: string;
      motherName?: string;
      rollNumber: string;
      photoUrl?: string;
    } | null;

    if (!profile) throw createError(404, "Student profile not found");

    const r = semResult as unknown as Record<string, unknown>;
    return pdfService.generateMarksheet({
      studentName: profile.name,
      fatherName: profile.fatherName,
      motherName: profile.motherName,
      rollNumber: r.rollNumber as string,
      enrollmentNumber: r.enrollmentNumber as string,
      bputExamRoll: r.bputExamRoll as string,
      program: r.program as string,
      branch: r.branch as string,
      semester: r.semester as number,
      academicYear: r.academicYear as string,
      examType: "Regular",
      subjectResults: r.subjectResults as Array<{
        subjectCode: string;
        subjectName: string;
        credits: number;
        internalMarks: number;
        externalMarks: number;
        totalMarks: number;
        totalMax: number;
        gradePoint: number;
        gradeLetter: string;
        creditPoints: number;
        isPassed: boolean;
      }>,
      totalCreditsRegistered: r.totalCreditsRegistered as number,
      totalCreditsEarned: r.totalCreditsEarned as number,
      totalCreditPoints: r.totalCreditPoints as number,
      sgpa: r.sgpa as number,
      cgpa: r.cgpa as number,
      backlogs: r.backlogs as number,
      backSubjects: r.backSubjects as string[],
      result: r.result as string,
      rank: r.rank as number | undefined,
      photoUrl: profile.photoUrl,
    });
  },

  /**
   * Generate a consolidated transcript PDF for a student (all semesters).
   */
  generateTranscriptPdf: async (studentId: string): Promise<Buffer> => {
    const { SemesterResultModel } = await import("../models/examination.model");
    const allResults = (await SemesterResultModel.find({ studentId, isPublished: true })
      .sort({ semester: 1 })
      .lean()) as unknown as Array<Record<string, unknown>>;

    if (!allResults.length) throw createError(404, "No published results found for this student");

    const { StudentProfileModel } = await import("../models/student-profile.model");
    const profile = (await StudentProfileModel.findOne({ userId: studentId })
      .select(
        "name fatherName motherName rollNumber enrollmentNumber program branch dateOfAdmission photoUrl",
      )
      .lean()) as unknown as Record<string, unknown> | null;

    if (!profile) throw createError(404, "Student profile not found");

    const finalCgpa = (allResults[allResults.length - 1]?.cgpa as number) ?? 0;
    const totalCreditsEarned = allResults.reduce(
      (sum, r) => sum + ((r.totalCreditsEarned as number) ?? 0),
      0,
    );

    return pdfService.generateTranscript({
      studentName: profile.name as string,
      fatherName: profile.fatherName as string,
      motherName: profile.motherName as string | undefined,
      rollNumber: profile.rollNumber as string,
      enrollmentNumber: profile.enrollmentNumber as string,
      bputExamRoll: (profile.bputExamRoll as string) ?? "",
      program: profile.program as string,
      branch: profile.branch as string,
      dateOfAdmission: profile.dateOfAdmission
        ? formatIndiaDate(profile.dateOfAdmission as Date)
        : "",
      semesterResults: allResults.map((r) => ({
        semester: r.semester as number,
        academicYear: r.academicYear as string,
        totalCreditsRegistered: r.totalCreditsRegistered as number,
        totalCreditsEarned: r.totalCreditsEarned as number,
        sgpa: r.sgpa as number,
        result: r.result as string,
      })),
      finalCgpa,
      totalCreditsEarned,
      photoUrl: profile.photoUrl as string | undefined,
    });
  },
};

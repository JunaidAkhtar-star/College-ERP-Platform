import createError from "http-errors";
import type { UploadedFile } from "express-fileupload";
import { NotificationType } from "../models/notification.model";
import {
  TrainingMode,
  TrainingSessionModel,
  TrainingSessionStatus,
  TrainingType,
  type ITrainingSession,
} from "../models/training-session.model";
import { StudentPlacementProfileModel } from "../models/student-placement-profile.model";
import { studentPlacementProfileRepository } from "../repositories/student-placement-profile.repository";
import { trainingSessionRepository } from "../repositories/training-session.repository";
import { redisUtil } from "../utils/redis.util";
import { uploadUtil } from "../utils/upload.util";
import { notifyStudentsByClass, notifyUsers } from "./helpers/notify.helper";

const CACHE_PREFIX = "tp:training:";
const CACHE_TTL = 300;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MUTABLE_FIELDS = [
  "title",
  "type",
  "mode",
  "description",
  "facilitator",
  "facilitatorOrg",
  "facilitatorEmail",
  "targetPrograms",
  "targetBranches",
  "targetBatches",
  "targetSemesters",
  "scheduledDate",
  "registrationStart",
  "registrationEnd",
  "startTime",
  "endTime",
  "venue",
  "meetingLink",
  "maxParticipants",
  "assignmentGiven",
] as const;

function uniqueStrings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

function minutes(value: string) {
  const match = TIME_PATTERN.exec(value);
  if (!match) throw createError(400, "Times must use 24-hour HH:mm format");
  return Number(match[1]) * 60 + Number(match[2]);
}

function sessionDateTime(date: Date, time: string) {
  const result = new Date(date);
  const [hour, minute] = time.split(":").map(Number);
  result.setHours(hour, minute, 0, 0);
  return result;
}

export function normalizeTrainingSession(input: Record<string, unknown>, publish = false) {
  const data: Record<string, unknown> = {};
  for (const field of MUTABLE_FIELDS) if (field in input) data[field] = input[field];
  for (const field of ["title", "facilitator", "venue"] as const) {
    const value = String(data[field] ?? "").trim();
    if (!value) throw createError(400, `${field} is required`);
    data[field] = value;
  }
  if (!Object.values(TrainingType).includes(data.type as TrainingType))
    throw createError(400, "A valid training type is required");
  if (!Object.values(TrainingMode).includes(data.mode as TrainingMode))
    throw createError(400, "A valid training mode is required");
  const startTime = String(data.startTime ?? "");
  const endTime = String(data.endTime ?? "");
  const startMinutes = minutes(startTime);
  const endMinutes = minutes(endTime);
  if (endMinutes <= startMinutes) throw createError(400, "End time must be after start time");
  data.duration = endMinutes - startMinutes;
  const scheduledDate = new Date(String(data.scheduledDate ?? ""));
  const registrationStart = new Date(String(data.registrationStart ?? ""));
  const registrationEnd = new Date(String(data.registrationEnd ?? ""));
  if (
    [scheduledDate, registrationStart, registrationEnd].some((date) => Number.isNaN(date.getTime()))
  )
    throw createError(400, "Schedule and registration dates are required");
  const startsAt = sessionDateTime(scheduledDate, startTime);
  if (registrationStart >= registrationEnd || registrationEnd > startsAt)
    throw createError(400, "Registration window must close before the session starts");
  if (publish && (startsAt <= new Date() || registrationEnd <= new Date()))
    throw createError(
      400,
      "Published sessions require a future registration window and start time",
    );
  data.scheduledDate = scheduledDate;
  data.registrationStart = registrationStart;
  data.registrationEnd = registrationEnd;
  const maxParticipants = Number(data.maxParticipants);
  if (
    data.maxParticipants !== undefined &&
    (!Number.isInteger(maxParticipants) || maxParticipants < 1)
  )
    throw createError(400, "Maximum participants must be a positive integer");
  if (data.maxParticipants !== undefined) data.maxParticipants = maxParticipants;
  data.targetPrograms = uniqueStrings(data.targetPrograms);
  data.targetBranches = uniqueStrings(data.targetBranches);
  data.targetBatches = uniqueStrings(data.targetBatches);
  const semesters = Array.isArray(data.targetSemesters)
    ? [...new Set(data.targetSemesters.map(Number))]
    : [];
  if (semesters.some((semester) => !Number.isInteger(semester) || semester < 1 || semester > 12))
    throw createError(400, "Target semesters must be valid semester numbers");
  data.targetSemesters = semesters;
  if (data.mode !== TrainingMode.OFFLINE) {
    const link = String(data.meetingLink ?? "").trim();
    try {
      const url = new URL(link);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      throw createError(400, "Online and hybrid sessions require a valid meeting link");
    }
  }
  return data;
}

export function evaluateTrainingEligibility(
  session: Pick<
    ITrainingSession,
    "targetPrograms" | "targetBranches" | "targetBatches" | "targetSemesters"
  >,
  profile: { program: string; branch: string; batch: string; currentSemester: number },
) {
  const reasons: string[] = [];
  if (session.targetPrograms.length && !session.targetPrograms.includes(profile.program))
    reasons.push("Program is not targeted");
  if (session.targetBranches.length && !session.targetBranches.includes(profile.branch))
    reasons.push("Branch is not targeted");
  if (session.targetBatches.length && !session.targetBatches.includes(profile.batch))
    reasons.push("Batch is not targeted");
  if (session.targetSemesters?.length && !session.targetSemesters.includes(profile.currentSemester))
    reasons.push("Semester is not targeted");
  return { eligible: reasons.length === 0, reasons };
}

async function notifyTargetStudents(session: ITrainingSession) {
  const programs = session.targetPrograms.length ? session.targetPrograms : [undefined];
  const branches = session.targetBranches.length ? session.targetBranches : [undefined];
  const semesters = session.targetSemesters?.length ? session.targetSemesters : [undefined];
  for (const program of programs) {
    for (const branch of branches) {
      for (const semester of semesters) {
        await notifyStudentsByClass(
          { program, branch, semester },
          {
            title: `Training session: ${session.title}`,
            body: `Registration is open until ${session.registrationEnd.toLocaleString("en-IN")}.`,
            type: NotificationType.PLACEMENT,
            actionUrl: "/student/training-session",
          },
        );
      }
    }
  }
}

export const trainingSessionService = {
  stats: () => trainingSessionRepository.getStats(),
  list: async (query: Record<string, unknown>, page = 1, limit = 20, studentId?: string) => {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    if (query.batch) filter.targetBatches = query.batch;
    if (query.from || query.to) {
      filter.scheduledDate = {
        ...(query.from ? { $gte: new Date(String(query.from)) } : {}),
        ...(query.to ? { $lte: new Date(String(query.to)) } : {}),
      };
    }
    if (studentId) {
      filter.status = TrainingSessionStatus.SCHEDULED;
      filter.scheduledDate = { $gte: new Date() };
    }
    const result = await trainingSessionRepository.paginate(filter, page, Math.min(limit, 100));
    if (!studentId) return result;
    const profile = await studentPlacementProfileRepository.findByStudentId(studentId);
    return {
      ...result,
      data: result.data.map((session) => {
        const { registeredStudents, attendance, meetingLink, materialUrl, ...safeSession } =
          session;
        const isRegistered = registeredStudents.some((id) => String(id) === studentId);
        const eligibility = profile
          ? evaluateTrainingEligibility(session, profile)
          : { eligible: false, reasons: ["Placement profile is missing"] };
        return {
          ...safeSession,
          ...eligibility,
          registeredCount: registeredStudents.length,
          isRegistered,
          attendanceMarked: Boolean(attendance.length),
          meetingLink: isRegistered ? meetingLink : undefined,
          materialUrl: isRegistered ? materialUrl : undefined,
        };
      }),
    };
  },

  getById: async (id: string, studentId?: string) => {
    const cached = studentId ? undefined : await redisUtil.get<ITrainingSession>(CACHE_PREFIX + id);
    if (cached) return cached;
    const session = await trainingSessionRepository.findById(id);
    if (!session) throw createError(404, "Training session not found");
    if (studentId) {
      if (session.status !== TrainingSessionStatus.SCHEDULED)
        throw createError(404, "Training session not found");
      const profile = await studentPlacementProfileRepository.findByStudentId(studentId);
      const eligibility = profile
        ? evaluateTrainingEligibility(session, profile)
        : { eligible: false, reasons: ["Placement profile is missing"] };
      const { registeredStudents, attendance, meetingLink, materialUrl, ...safeSession } = session;
      const isRegistered = registeredStudents.some((value) => String(value) === studentId);
      return {
        ...safeSession,
        ...eligibility,
        registeredCount: registeredStudents.length,
        isRegistered,
        attendanceMarked: Boolean(attendance.length),
        meetingLink: isRegistered ? meetingLink : undefined,
        materialUrl: isRegistered ? materialUrl : undefined,
      };
    }
    const registeredStudentDetails = session.registeredStudents.length
      ? await StudentPlacementProfileModel.find({
          studentId: { $in: session.registeredStudents },
        })
          .select("studentId rollNumber name")
          .lean()
      : [];
    const detailedSession = { ...session, registeredStudentDetails };
    await redisUtil.set(CACHE_PREFIX + id, detailedSession, CACHE_TTL);
    return detailedSession;
  },

  create: (input: Record<string, unknown>, createdBy: string) =>
    trainingSessionRepository.create({
      ...normalizeTrainingSession(input),
      status: TrainingSessionStatus.DRAFT,
      createdBy,
    }),

  update: async (id: string, input: Record<string, unknown>) => {
    const current = await trainingSessionRepository.findById(id);
    if (!current) throw createError(404, "Training session not found");
    if (current.status !== TrainingSessionStatus.DRAFT)
      throw createError(409, "Only draft training sessions can be edited");
    const session = await trainingSessionRepository.updateById(
      id,
      normalizeTrainingSession({ ...current, ...input }),
    );
    await redisUtil.del(`${CACHE_PREFIX}${id}`);
    return session;
  },

  publish: async (id: string) => {
    const current = await trainingSessionRepository.findById(id);
    if (!current) throw createError(404, "Training session not found");
    normalizeTrainingSession({ ...current }, true);
    const session = await trainingSessionRepository.transition(id, TrainingSessionStatus.DRAFT, {
      status: TrainingSessionStatus.SCHEDULED,
    });
    if (!session) throw createError(409, "Session is no longer a draft");
    await redisUtil.del(`${CACHE_PREFIX}${id}`);
    void notifyTargetStudents(session as ITrainingSession);
    return session;
  },

  start: async (id: string) => {
    const current = await trainingSessionRepository.findById(id);
    if (!current) throw createError(404, "Training session not found");
    const startsAt = sessionDateTime(current.scheduledDate, current.startTime);
    const endsAt = sessionDateTime(current.scheduledDate, current.endTime);
    const now = new Date();
    const reconciliationDeadline = new Date(endsAt.getTime() + 7 * 86_400_000);
    if (now < startsAt || now > reconciliationDeadline)
      throw createError(
        409,
        "Session attendance can only be opened from its start time through the 7-day reconciliation window",
      );
    const session = await trainingSessionRepository.transition(
      id,
      TrainingSessionStatus.SCHEDULED,
      { status: TrainingSessionStatus.ONGOING },
    );
    if (!session) throw createError(409, "Only a scheduled session can be started");
    await redisUtil.del(`${CACHE_PREFIX}${id}`);
    return session;
  },

  cancel: async (id: string, reason: string) => {
    const cancellationReason = String(reason ?? "").trim();
    if (cancellationReason.length < 5)
      throw createError(400, "A meaningful cancellation reason is required");
    const session = await trainingSessionRepository.transition(
      id,
      TrainingSessionStatus.SCHEDULED,
      { status: TrainingSessionStatus.CANCELLED, cancellationReason },
    );
    if (!session) throw createError(409, "Only a scheduled session can be cancelled");
    await redisUtil.del(`${CACHE_PREFIX}${id}`);
    void notifyUsers(session.registeredStudents, {
      title: `Training cancelled: ${session.title}`,
      body: cancellationReason,
      type: NotificationType.PLACEMENT,
      actionUrl: "/student/training-session",
    });
    return session;
  },

  delete: async (id: string) => {
    const removed = await trainingSessionRepository.deleteDraft(id);
    if (!removed) throw createError(409, "Only an empty draft session can be deleted");
    await redisUtil.del(`${CACHE_PREFIX}${id}`);
    return { id };
  },

  register: async (sessionId: string, studentId: string) => {
    const session = await trainingSessionRepository.findById(sessionId);
    if (!session) throw createError(404, "Training session not found");
    const profile = await studentPlacementProfileRepository.findByStudentId(studentId);
    if (!profile) throw createError(409, "Complete your placement profile before registering");
    const eligibility = evaluateTrainingEligibility(session, profile);
    if (!eligibility.eligible) throw createError(403, eligibility.reasons.join(". "));
    const updated = await trainingSessionRepository.registerStudent(
      sessionId,
      studentId,
      new Date(),
    );
    if (!updated) throw createError(409, "Registration is closed, full, or already completed");
    await redisUtil.del(`${CACHE_PREFIX}${sessionId}`);
    return { message: "Registered successfully" };
  },

  unregister: async (sessionId: string, studentId: string) => {
    const updated = await trainingSessionRepository.unregisterStudent(sessionId, studentId);
    if (!updated) throw createError(409, "Unregistration is closed");
    await redisUtil.del(`${CACHE_PREFIX}${sessionId}`);
    return { message: "Unregistered successfully" };
  },

  markAttendance: async (
    sessionId: string,
    attendance: Array<{
      studentId: string;
      status: "present" | "absent" | "late";
      score?: number;
      feedback?: string;
    }>,
    markedBy: string,
  ) => {
    const session = await TrainingSessionModel.findById(sessionId).lean();
    if (!session) throw createError(404, "Training session not found");
    if (session.status !== TrainingSessionStatus.ONGOING || session.attendanceMarked)
      throw createError(409, "Attendance can only be marked once for an ongoing session");
    const inputIds = attendance.map((entry) => entry.studentId);
    const registeredIds = session.registeredStudents.map(String);
    if (
      new Set(inputIds).size !== inputIds.length ||
      inputIds.length !== registeredIds.length ||
      inputIds.some((id) => !registeredIds.includes(id))
    )
      throw createError(400, "Attendance must contain every registered student exactly once");
    if (
      attendance.some(
        (entry) =>
          !["present", "absent", "late"].includes(entry.status) ||
          (entry.score !== undefined && (entry.score < 0 || entry.score > 100)),
      )
    )
      throw createError(400, "Attendance status or score is invalid");
    const profiles = await StudentPlacementProfileModel.find({ studentId: { $in: inputIds } })
      .select("studentId rollNumber")
      .lean();
    if (profiles.length !== inputIds.length)
      throw createError(409, "Every attendee must have an authoritative placement profile");
    const rollNumbers = new Map(
      profiles.map((profile) => [String(profile.studentId), profile.rollNumber]),
    );
    const normalized = attendance.map((entry) => ({
      ...entry,
      rollNumber: rollNumbers.get(entry.studentId) ?? "",
      feedback: String(entry.feedback ?? "").trim() || undefined,
    }));
    const presentIds = normalized
      .filter((entry) => entry.status !== "absent")
      .map((entry) => entry.studentId);
    const databaseSession = await TrainingSessionModel.db.startSession();
    let updated;
    try {
      await databaseSession.withTransaction(async () => {
        updated = await TrainingSessionModel.findOneAndUpdate(
          { _id: sessionId, status: TrainingSessionStatus.ONGOING, attendanceMarked: false },
          {
            $set: {
              attendance: normalized,
              attendanceMarked: true,
              attendanceVerified: true,
              attendanceMarkedBy: markedBy,
              attendanceMarkedAt: new Date(),
              totalPresent: presentIds.length,
              totalAbsent: normalized.length - presentIds.length,
              status: TrainingSessionStatus.COMPLETED,
            },
          },
          { returnDocument: "after", runValidators: true, session: databaseSession },
        ).lean();
        if (!updated) throw createError(409, "Attendance was already recorded");
        if (presentIds.length)
          await StudentPlacementProfileModel.updateMany(
            { studentId: { $in: presentIds } },
            { $inc: { trainingSessionsAttended: 1 } },
            { session: databaseSession },
          );
      });
    } finally {
      await databaseSession.endSession();
    }
    await redisUtil.del(`${CACHE_PREFIX}${sessionId}`);
    return updated;
  },

  getUpcoming: async (days = 7, studentId?: string) => {
    const sessions = await trainingSessionRepository.findUpcoming(Math.min(Math.max(days, 1), 90));
    if (!studentId) return sessions;
    return sessions.map((session) => {
      const { registeredStudents, attendance, meetingLink, materialUrl, ...safeSession } = session;
      const isRegistered = registeredStudents.some((value) => String(value) === studentId);
      return {
        ...safeSession,
        registeredCount: registeredStudents.length,
        isRegistered,
        attendanceMarked: Boolean(attendance.length),
        meetingLink: isRegistered ? meetingLink : undefined,
        materialUrl: isRegistered ? materialUrl : undefined,
      };
    });
  },
  getMySchedule: async (studentId: string) => {
    const sessions = await trainingSessionRepository.findByStudent(studentId);
    return sessions.map((session) => {
      const { registeredStudents, attendance, ...safeSession } = session;
      return {
        ...safeSession,
        registeredCount: registeredStudents.length,
        isRegistered: true,
        myAttendance: attendance.find((entry) => String(entry.studentId) === studentId),
      };
    });
  },

  uploadMaterial: async (sessionId: string, file: UploadedFile) => {
    const current = await trainingSessionRepository.findById(sessionId);
    if (!current) throw createError(404, "Training session not found");
    if (![TrainingSessionStatus.DRAFT, TrainingSessionStatus.COMPLETED].includes(current.status))
      throw createError(409, "Materials can be changed only for draft or completed sessions");
    const result = await uploadUtil.uploadDocument(file, "erp/training-materials");
    const updated = await trainingSessionRepository.updateById(sessionId, {
      materialUrl: result.url,
    });
    await redisUtil.del(`${CACHE_PREFIX}${sessionId}`);
    return updated;
  },
};

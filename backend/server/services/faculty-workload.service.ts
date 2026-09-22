import { facultyWorkloadRepository } from "../repositories";
import createError from "http-errors";
import { Types } from "mongoose";
import { UserModel } from "../models/user.model";
import { SubjectModel } from "../models/subject.model";
import { SystemRole } from "../constants/roles";
import { TimetableModel } from "../models/timetable.model";
import { ClassOperationModel } from "../models/class-operation.model";
import { notificationService } from "./notification.service";
import {
  NotificationAudience,
  NotificationChannel,
  NotificationType,
  type IFacultyWorkload,
} from "../models";
import { logger } from "../utils/logger.util";

type WorkloadNotificationEvent = "assigned" | "updated" | "approved";

async function notifyFacultyOfWorkload(
  workload: Pick<
    IFacultyWorkload,
    "facultyId" | "academicYear" | "semesterType" | "totalWeeklyHours"
  >,
  event: WorkloadNotificationEvent,
  actorId: string,
) {
  const facultyId = String(workload.facultyId ?? "");
  if (!facultyId) return;

  const actor = Types.ObjectId.isValid(actorId)
    ? await UserModel.findById(actorId).select("name").lean()
    : null;
  const actorName = actor?.name?.trim() || "Academic Office";
  const copy: Record<WorkloadNotificationEvent, { title: string; body: string }> = {
    assigned: {
      title: "New Academic Workload Assigned",
      body: `A ${workload.totalWeeklyHours} hrs/week workload for ${workload.academicYear} (${workload.semesterType} semester) has been assigned to you and is pending approval.`,
    },
    updated: {
      title: "Academic Workload Updated",
      body: `Your pending workload for ${workload.academicYear} (${workload.semesterType} semester) has been updated to ${workload.totalWeeklyHours} hrs/week.`,
    },
    approved: {
      title: "Academic Workload Approved",
      body: `Your official academic workload (${workload.totalWeeklyHours} hrs/week) for ${workload.academicYear} (${workload.semesterType} semester) has been approved.`,
    },
  };

  await notificationService.create({
    ...copy[event],
    type: NotificationType.WORKLOAD,
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.PUSH],
    audience: NotificationAudience.SPECIFIC_USER,
    targetUserIds: [facultyId],
    actionUrl: "/faculty-workload",
    createdBy: actorId,
    createdByName: actorName,
  });
}

async function notifyFacultySafely(
  workload: Pick<
    IFacultyWorkload,
    "facultyId" | "academicYear" | "semesterType" | "totalWeeklyHours"
  >,
  event: WorkloadNotificationEvent,
  actorId: string,
) {
  try {
    await notifyFacultyOfWorkload(workload, event, actorId);
  } catch (err) {
    logger.warn(`Failed to dispatch workload ${event} notification`, { err });
  }
}

export function normalizeFacultyWorkload(data: Record<string, unknown>) {
  const academicYear = String(data.academicYear ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(academicYear)) throw createError(400, "Academic year must use YYYY-YY");
  if (!["odd", "even"].includes(String(data.semesterType)))
    throw createError(400, "Semester type is invalid");
  const teachingAssignments = Array.isArray(data.teachingAssignments)
    ? (data.teachingAssignments as Array<Record<string, unknown>>)
    : [];
  for (const item of teachingAssignments) {
    item.program = String(item.program ?? "").trim();
    if (!item.program) throw createError(400, "Assignment programme is required");
    item.section = String(item.section ?? "").trim();
    if (!item.section) throw createError(400, "Assignment section is required");
    const semester = Number(item.semester);
    const weeklyHours = Number(item.weeklyHours) || 0;
    const totalHours = Number(item.totalHours) || weeklyHours * 15;
    item.totalHours = totalHours;
    if (!Number.isInteger(semester) || semester < 1 || semester > 10)
      throw createError(400, "Assignment semester is invalid; expected an integer from 1 to 10");
    if (!["theory", "lab", "tutorial"].includes(String(item.classType)))
      throw createError(400, "Assignment class type must be theory, lab, or tutorial");
    if (!Number.isFinite(totalHours) || totalHours <= 0)
      throw createError(400, "Assignment total hours are invalid; expected a positive value");
  }
  const keys = teachingAssignments.map((item) =>
    [item.subjectId, item.program, item.semester, item.section, item.classType].join(":"),
  );
  if (new Set(keys).size !== keys.length) {
    throw createError(
      400,
      "Workload contains duplicate assignments for the same subject and section",
    );
  }
  const extraDuties = Array.isArray(data.extraDuties)
    ? (data.extraDuties as Array<Record<string, unknown>>)
    : [];
  const totalWeeklyTeachingHours = teachingAssignments.reduce((sum, item) => {
    const hours = Number(item.weeklyHours);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 30)
      throw createError(400, "Assignment weekly hours are invalid");
    return sum + hours;
  }, 0);
  const extraHours = extraDuties.reduce((sum, item) => {
    const hours = Number(item.weeklyHours);
    if (!Number.isFinite(hours) || hours < 0 || hours > 30)
      throw createError(400, "Extra-duty weekly hours are invalid");
    return sum + hours;
  }, 0);
  const totalWeeklyHours = totalWeeklyTeachingHours + extraHours;
  if (totalWeeklyHours > 60) throw createError(400, "Total weekly workload cannot exceed 60 hours");
  return {
    academicYear,
    semesterType: data.semesterType,
    teachingAssignments,
    extraDuties,
    totalWeeklyTeachingHours,
    totalWeeklyHours,
  };
}

export const facultyWorkloadService = {
  getAll: (filter: Record<string, unknown>, page: number, limit: number) =>
    facultyWorkloadRepository.list(filter, page, limit),

  getById: (id: string) => facultyWorkloadRepository.findById(id),

  getForFaculty: (facultyId: string, academicYear: string, semesterType: string) =>
    facultyWorkloadRepository.findOne(facultyId, academicYear, semesterType),

  create: async (data: Record<string, unknown>, createdBy: string, scopedDepartmentId?: string) => {
    const facultyId = String(data.facultyId ?? "");
    const departmentId = String(data.departmentId ?? "");
    if (!Types.ObjectId.isValid(facultyId) || !Types.ObjectId.isValid(departmentId))
      throw createError(400, "Faculty and department are required");
    if (scopedDepartmentId && departmentId !== scopedDepartmentId)
      throw createError(403, "You can manage only your department workload");
    const faculty = await UserModel.findOne({
      _id: facultyId,
      department: departmentId,
      roles: SystemRole.FACULTY,
      status: "active",
    }).lean();
    if (!faculty) throw createError(400, "Active faculty does not belong to this department");
    const normalized = normalizeFacultyWorkload(data);
    const subjectIds = normalized.teachingAssignments.map((item) => String(item.subjectId));
    if (subjectIds.some((id) => !Types.ObjectId.isValid(id)))
      throw createError(400, "Invalid subject assignment");
    const subjectCount = await SubjectModel.countDocuments({
      _id: { $in: subjectIds },
      isActive: true,
    });
    if (subjectCount !== new Set(subjectIds).size)
      throw createError(400, "All assigned subjects must exist and be active");
    const created = await facultyWorkloadRepository.create({
      ...normalized,
      facultyId,
      departmentId,
      isApproved: false,
      createdBy,
    });
    await notifyFacultySafely(created, "assigned", createdBy);
    return created;
  },

  update: async (id: string, data: Record<string, unknown>, updatedBy: string) => {
    const current = await facultyWorkloadRepository.findById(id);
    if (!current) throw createError(404, "Faculty workload not found");
    const updated = await facultyWorkloadRepository.updateById(id, {
      ...normalizeFacultyWorkload({ ...current, ...data }),
      updatedBy,
    });
    if (!updated) throw createError(409, "Approved workload is immutable");
    await notifyFacultySafely(updated, "updated", updatedBy);
    return updated;
  },

  approve: async (id: string, approverId: string) => {
    const approved = await facultyWorkloadRepository.approve(id, approverId);
    if (!approved) throw createError(409, "Workload is already approved or not found");

    await notifyFacultySafely(approved, "approved", approverId);

    return approved;
  },

  getDepartmentSummary: (departmentId: string, academicYear: string, semesterType: string) =>
    facultyWorkloadRepository.getDepartmentWorkloadSummary(
      departmentId,
      academicYear,
      semesterType,
    ),

  getOperationalSummary: async (id: string) => {
    const workload = await facultyWorkloadRepository.findById(id);
    if (!workload) throw createError(404, "Faculty workload not found");
    const facultyId = workload.facultyId.toString();
    const timetables = await TimetableModel.find({
      academicYear: workload.academicYear,
      semesterType: workload.semesterType,
      isApproved: true,
    })
      .select("slots substituteLog")
      .lean();
    let substituteTakenMinutes = 0;
    let substituteReleasedMinutes = 0;
    for (const timetable of timetables) {
      for (const entry of timetable.substituteLog ?? []) {
        if (entry.status === "cancelled") continue;
        const slot = timetable.slots?.[entry.slotIndex];
        if (!slot) continue;
        const duration = Math.max(
          0,
          toWorkloadMinutes(slot.endTime) - toWorkloadMinutes(slot.startTime),
        );
        if (entry.substituteFacultyId.toString() === facultyId) substituteTakenMinutes += duration;
        if (slot.facultyId?.toString() === facultyId) substituteReleasedMinutes += duration;
      }
    }
    const timetableIds = timetables.map((timetable) => timetable._id);
    const extraClasses = timetableIds.length
      ? await ClassOperationModel.find({
          timetableId: { $in: timetableIds },
          facultyId,
          status: { $in: ["scheduled", "completed"] },
        })
          .select("startTime endTime status")
          .lean()
      : [];
    const extraClassMinutes = extraClasses.reduce(
      (total, operation) =>
        total +
        Math.max(0, toWorkloadMinutes(operation.endTime) - toWorkloadMinutes(operation.startTime)),
      0,
    );
    return {
      plannedWeeklyTeachingHours: workload.totalWeeklyTeachingHours,
      plannedWeeklyTotalHours: workload.totalWeeklyHours,
      substituteTakenMinutes,
      substituteReleasedMinutes,
      extraClassMinutes,
      netOperationalMinutes: substituteTakenMinutes + extraClassMinutes - substituteReleasedMinutes,
    };
  },
};

function toWorkloadMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

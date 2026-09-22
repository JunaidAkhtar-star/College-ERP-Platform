import createError from "http-errors";
import mongoose, { Types, type ClientSession } from "mongoose";
import {
  curriculumRepository,
  sectionRepository,
  subjectRepository,
  timetableRepository,
} from "../repositories";
import type { ITimetable } from "../models/timetable.model";
import { redisUtil } from "../utils/redis.util";
import { notifyStudentsByClass, notifyUsers } from "./helpers/notify.helper";
import { NotificationType } from "../models/notification.model";
import { UserModel } from "../models/user.model";
import { SystemRole } from "../constants/roles";
import { TimetableMutationLockModel } from "../models/timetable-mutation-lock.model";
import { FacilitySpaceModel } from "../models/facilities.model";
import { FacultyWorkloadModel } from "../models/faculty-workload.model";
import { DepartmentModel, DepartmentStatus } from "../models/department.model";
import { FacultyProfileModel } from "../models/faculty-profile.model";
import { FacultyAttendanceModel } from "../models/faculty-attendance.model";
import { LeaveRequestModel } from "../models/leave.model";
import { ClassOperationModel } from "../models/class-operation.model";
import { SubjectModel, type ISubject } from "../models/subject.model";
import type { IUser } from "../models/user.model";
import type { IFacultyProfile } from "../models/faculty-profile.model";

const TT_TTL = 300; // 5 minutes — timetables rarely change

const invalidateTimetableCache = async (
  _academicYear?: string,
  _semesterType?: string,
  _departmentId?: string,
) => {
  await redisUtil.delPattern("tt:*");
};

// ── helpers ──────────────────────────────────────────────────────────────────

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function timesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return toMinutes(startA) < toMinutes(endB) && toMinutes(startB) < toMinutes(endA);
}

export function buildBalancedTimetableCandidates<T extends { periodNo: number }>(
  days: string[],
  periodTimings: T[],
  subjectIndex: number,
): Array<{ day: string; timing: T }> {
  if (!days.length) return [];
  const offset = ((subjectIndex % days.length) + days.length) % days.length;
  const rotatedDays = days.map((_, index) => days[(index + offset) % days.length]);
  return periodTimings.flatMap((timing) => rotatedDays.map((day) => ({ day, timing })));
}

interface SlotInput {
  day: string;
  periodNo: number;
  startTime: string;
  endTime: string;
  slotKind?: "teaching" | "break" | "activity";
  facultyId?: string;
  roomId?: string;
  roomNo: string;
  classType?: "theory" | "lab" | "tutorial";
  labBatch?: string;
  branch?: string;
  branchDepartmentId?: string;
  branchDepartmentIds?: string[];
  isCombined?: boolean;
}

function timetableLockKeys(
  slots: SlotInput[],
  academicYear: string,
  semesterType: string,
  sectionId: string,
) {
  const prefix = `${academicYear}:${semesterType}`;
  const keys = new Set<string>();
  for (const slot of slots) {
    keys.add(`${prefix}:section:${sectionId}:${slot.day}`);
    keys.add(`${prefix}:faculty:${slot.facultyId}:${slot.day}`);
    keys.add(`${prefix}:room:${slot.roomNo.trim().toUpperCase()}:${slot.day}`);
  }
  return [...keys].sort();
}

async function withTimetableLocks<T>(keys: string[], work: (session: ClientSession) => Promise<T>) {
  const uniqueKeys = [...new Set(keys)].sort();
  if (uniqueKeys.length) {
    try {
      await TimetableMutationLockModel.bulkWrite(
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
  }
  const session = await mongoose.startSession();
  let result: T | undefined;
  try {
    await session.withTransaction(async () => {
      if (uniqueKeys.length) {
        await TimetableMutationLockModel.updateMany(
          { key: { $in: uniqueKeys } },
          { $inc: { revision: 1 } },
          { session },
        );
      }
      result = await work(session);
    });
  } finally {
    await session.endSession();
  }
  if (result === undefined) throw createError(409, "Timetable operation could not be committed");
  return result;
}

export function assertTimetableSlotLayout(slots: SlotInput[]) {
  const targetBranches = (slot: SlotInput) => {
    const ids = (slot.branchDepartmentIds ?? []).map(String).filter(Boolean);
    if (ids.length) return ids;
    if (slot.branchDepartmentId) return [String(slot.branchDepartmentId)];
    if (slot.branch) return [`code:${slot.branch.trim().toUpperCase()}`];
    return ["*"];
  };
  for (let index = 0; index < slots.length; index++) {
    const slot = slots[index];
    if (
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(slot.startTime) ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(slot.endTime) ||
      toMinutes(slot.endTime) <= toMinutes(slot.startTime)
    ) {
      throw createError(400, `Invalid time range for timetable slot ${index + 1}`);
    }
    for (let otherIndex = index + 1; otherIndex < slots.length; otherIndex++) {
      const other = slots[otherIndex];
      if (
        slot.day !== other.day ||
        !timesOverlap(slot.startTime, slot.endTime, other.startTime, other.endTime)
      )
        continue;
      if (slot.facultyId && other.facultyId && String(slot.facultyId) === String(other.facultyId)) {
        throw createError(409, `Faculty is assigned twice within the timetable on ${slot.day}`);
      }
      if (
        slot.roomNo &&
        other.roomNo &&
        slot.roomNo.trim().toUpperCase() === other.roomNo.trim().toUpperCase()
      ) {
        throw createError(
          409,
          `Room ${slot.roomNo} is assigned twice within the timetable on ${slot.day}`,
        );
      }
      const splitLab =
        slot.classType === "lab" &&
        other.classType === "lab" &&
        Boolean(slot.labBatch) &&
        Boolean(other.labBatch) &&
        slot.labBatch !== other.labBatch;
      const slotBranches = targetBranches(slot);
      const otherBranches = targetBranches(other);
      const branchesOverlap =
        slotBranches.includes("*") ||
        otherBranches.includes("*") ||
        slotBranches.some((branch) => otherBranches.includes(branch));
      if (!splitLab && branchesOverlap) {
        throw createError(
          409,
          `Section has overlapping classes within the timetable on ${slot.day}`,
        );
      }
    }
  }
}

async function normalizeTimetablePayload(data: Record<string, unknown>, existing?: ITimetable) {
  const next = { ...data };
  const scheduleStartTime = String(
    next["scheduleStartTime"] ?? existing?.scheduleStartTime ?? "",
  ).trim();
  const scheduleEndTime = String(next["scheduleEndTime"] ?? existing?.scheduleEndTime ?? "").trim();
  if (scheduleStartTime || scheduleEndTime) {
    if (
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(scheduleStartTime) ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(scheduleEndTime) ||
      toMinutes(scheduleEndTime) <= toMinutes(scheduleStartTime)
    ) {
      throw createError(400, "Timetable end time must be after its start time");
    }
    next["scheduleStartTime"] = scheduleStartTime;
    next["scheduleEndTime"] = scheduleEndTime;
  }
  const referenceId = (value: unknown): string => {
    if (value && typeof value === "object" && "_id" in value) {
      return String((value as { _id: unknown })._id ?? "");
    }
    return String(value ?? "");
  };
  let rawSectionId: unknown = next["sectionId"] ?? existing?.sectionId;
  if (rawSectionId && typeof rawSectionId === "object") {
    const rawObj = rawSectionId as Record<string, unknown>;
    if ("_id" in rawObj) {
      rawSectionId = rawObj._id;
    }
  }
  const sectionId = (rawSectionId as { toString?: () => string })?.toString?.();

  if (sectionId && !Types.ObjectId.isValid(sectionId)) {
    throw createError(400, "Valid section is required");
  }
  const section = sectionId ? await sectionRepository.findRawById(sectionId) : null;
  if (sectionId && !section) throw createError(404, "Section not found");

  if (section) {
    next["sectionId"] = section._id;
    next["batchId"] = section.batchId;
    next["curriculumId"] = section.curriculumId;
    next["academicYear"] = section.academicYear;
    next["departmentId"] = section.departmentId;
    next["program"] = section.program;
    next["semester"] = section.semesterNo;
    next["section"] = section.sectionName;
  } else {
    const academicYear = String(next["academicYear"] ?? existing?.academicYear ?? "").trim();
    const curriculumId = referenceId(next["curriculumId"] ?? existing?.curriculumId);
    const departmentId = referenceId(next["departmentId"] ?? existing?.departmentId);
    const program = String(next["program"] ?? existing?.program ?? "").trim();
    const semester = Number(next["semester"] ?? existing?.semester);
    if (!/^\d{4}-(?:\d{2}|\d{4})$/.test(academicYear)) {
      throw createError(400, "Valid academic year is required");
    }
    if (!Types.ObjectId.isValid(curriculumId))
      throw createError(400, "Valid curriculum is required");
    if (!Types.ObjectId.isValid(departmentId))
      throw createError(400, "Valid department is required");
    if (!program) throw createError(400, "Programme is required");
    if (!Number.isInteger(semester) || semester < 1 || semester > 12) {
      throw createError(400, "Valid semester is required");
    }
    next["sectionId"] = undefined;
    next["batchId"] = undefined;
    next["academicYear"] = academicYear;
    next["curriculumId"] = curriculumId;
    next["departmentId"] = departmentId;
    next["program"] = program;
    next["semester"] = semester;
    next["section"] = undefined;
  }
  const scopeDepartmentId = String(next["departmentId"]);
  const scopeSemester = Number(next["semester"]);
  const scopeAcademicYear = String(next["academicYear"]);
  const scopeProgram = String(next["program"]);
  const scopeSection = String(next["section"] ?? "");
  const requestedBranchDepartmentIds =
    (next["branchDepartmentIds"] as Array<string | Types.ObjectId> | undefined) ?? [];
  const branchDepartmentIds = (
    requestedBranchDepartmentIds.length ? requestedBranchDepartmentIds : [scopeDepartmentId]
  ).map(String);
  const branchCodeByDepartmentId = new Map<string, string>();
  if (branchDepartmentIds.some((departmentId) => !Types.ObjectId.isValid(departmentId))) {
    throw createError(400, "One or more selected timetable branches are invalid");
  }
  if (branchDepartmentIds.length) {
    const branchDepartments = await DepartmentModel.find({
      _id: { $in: branchDepartmentIds },
      status: DepartmentStatus.ACTIVE,
    })
      .select("_id code")
      .lean();
    if (branchDepartments.length !== new Set(branchDepartmentIds).size) {
      throw createError(400, "One or more selected timetable branches are unavailable");
    }
    const codeById = new Map(
      branchDepartments.map((department) => [department._id.toString(), department.code]),
    );
    for (const [departmentId, code] of codeById) {
      branchCodeByDepartmentId.set(departmentId, code);
    }
    next["branchDepartmentIds"] = branchDepartmentIds;
    next["branches"] = branchDepartmentIds.map((departmentId) => codeById.get(departmentId));
  } else {
    next["branchDepartmentIds"] = [];
    next["branches"] = [];
  }
  const expectedSemesterType = scopeSemester % 2 === 0 ? "even" : "odd";
  if (!next["semesterType"]) {
    next["semesterType"] = expectedSemesterType;
  } else if (next["semesterType"] !== expectedSemesterType) {
    throw createError(
      400,
      `Semester ${scopeSemester} requires ${expectedSemesterType} semester type`,
    );
  }

  const curriculum = await curriculumRepository.findById(String(next["curriculumId"]));
  if (!curriculum || !curriculum.isActive) throw createError(409, "Active curriculum not found");
  if (curriculum.program !== scopeProgram) {
    throw createError(400, "Curriculum does not belong to the selected programme");
  }
  if (!section) {
    const uniqueBranchDepartmentIds = [...new Set(branchDepartmentIds)];
    const linkedDepartmentCount = await DepartmentModel.countDocuments({
      _id: { $in: uniqueBranchDepartmentIds },
      status: DepartmentStatus.ACTIVE,
      curriculumIds: curriculum._id,
    });
    if (linkedDepartmentCount !== uniqueBranchDepartmentIds.length) {
      throw createError(400, "One or more branches are not linked to the selected curriculum");
    }
  }
  const plan = curriculum.semesterPlans?.find((item) => item.semesterNo === scopeSemester);
  if (!plan) throw createError(409, "Curriculum semester plan not found");
  const allowed = new Map(plan.subjects.map((item) => [item.subjectId.toString(), item]));
  const slots = (next["slots"] as Array<Record<string, unknown>> | undefined) ?? [];
  if (slots.length > 100) throw createError(400, "Timetable cannot exceed 100 weekly slots");
  const requestedRoomIds = [
    ...new Set(slots.map((slot) => String(slot.roomId || "")).filter(Boolean)),
  ];
  if (requestedRoomIds.some((roomId) => !Types.ObjectId.isValid(roomId))) {
    throw createError(400, "One or more timetable facility spaces are invalid");
  }
  const facilities = requestedRoomIds.length
    ? await FacilitySpaceModel.find({ _id: { $in: requestedRoomIds } }).lean()
    : [];
  const facilityById = new Map(facilities.map((facility) => [facility._id.toString(), facility]));
  const requestedFacultyIds = [
    ...new Set(slots.map((slot) => String(slot.facultyId || "")).filter(Types.ObjectId.isValid)),
  ];
  const approvedWorkloads = requestedFacultyIds.length
    ? await FacultyWorkloadModel.find({
        facultyId: { $in: requestedFacultyIds },
        academicYear: scopeAcademicYear,
        semesterType: next["semesterType"] as "odd" | "even",
        isApproved: true,
      })
        .select("facultyId teachingAssignments")
        .lean()
    : [];
  const workloadByFaculty = new Map(
    approvedWorkloads.map((workload) => [workload.facultyId.toString(), workload]),
  );
  const requestedSubjectIds = [
    ...new Set(slots.map((slot) => String(slot.subjectId || "")).filter(Types.ObjectId.isValid)),
  ];
  const [subjectsList, facultyUsersList, facultyProfilesList] = await Promise.all([
    requestedSubjectIds.length
      ? SubjectModel.find({ _id: { $in: requestedSubjectIds } }).lean()
      : [],
    requestedFacultyIds.length
      ? UserModel.find({
          _id: { $in: requestedFacultyIds },
          roles: { $in: [SystemRole.FACULTY, SystemRole.HOD] },
          status: "active",
        })
          .select("_id name department")
          .lean()
      : [],
    requestedFacultyIds.length
      ? FacultyProfileModel.find({ userId: { $in: requestedFacultyIds } })
          .select("userId employeeId")
          .lean()
      : [],
  ]);

  const subjectMap = new Map<string, ISubject>(
    subjectsList.map((s) => [s._id.toString(), s as unknown as ISubject]),
  );
  const facultyUserMap = new Map<string, IUser>(
    facultyUsersList.map((u) => [u._id.toString(), u as unknown as IUser]),
  );
  const facultyProfileMap = new Map<string, IFacultyProfile>(
    facultyProfilesList.map((p) => [p.userId.toString(), p as unknown as IFacultyProfile]),
  );

  const normalizedSlots = slots.map((slot, index) => {
    if (
      scheduleStartTime &&
      scheduleEndTime &&
      (toMinutes(String(slot.startTime || "")) < toMinutes(scheduleStartTime) ||
        toMinutes(String(slot.endTime || "")) > toMinutes(scheduleEndTime))
    ) {
      throw createError(
        400,
        `Slot ${index + 1} must be inside ${scheduleStartTime}–${scheduleEndTime}`,
      );
    }
    const slotKind = String(slot.slotKind || "teaching") as "teaching" | "break" | "activity";
    if (slotKind !== "teaching") {
      const title = String(slot.title || slot.subjectName || "").trim();
      if (!title) throw createError(400, `Slot ${index + 1} requires a title`);
      return {
        ...slot,
        slotKind,
        title,
        subjectId: undefined,
        subjectCode: "",
        subjectName: title,
        facultyId: undefined,
        facultyName: "",
        facultyCode: undefined,
        roomId: undefined,
        roomNo: "",
        labBatch: undefined,
      };
    }
    const subjectId = String(slot.subjectId || "");
    const facultyId = String(slot.facultyId || "");
    const legacyBranchCode = String(slot.branch || "")
      .trim()
      .toUpperCase();
    const legacyBranchDepartmentId = [...branchCodeByDepartmentId.entries()].find(
      ([, code]) => code.trim().toUpperCase() === legacyBranchCode,
    )?.[0];
    const branchDepartmentId = String(
      slot.branchDepartmentId ||
        legacyBranchDepartmentId ||
        (branchDepartmentIds.length === 1 ? branchDepartmentIds[0] : ""),
    );
    const requestedSlotBranchIds = Array.isArray(slot.branchDepartmentIds)
      ? slot.branchDepartmentIds.map(String)
      : [];
    const slotBranchDepartmentIds = [
      ...new Set(requestedSlotBranchIds.length ? requestedSlotBranchIds : [branchDepartmentId]),
    ];
    if (
      slotBranchDepartmentIds.some(
        (departmentId) =>
          !Types.ObjectId.isValid(departmentId) || !branchDepartmentIds.includes(departmentId),
      )
    ) {
      throw createError(400, `Slot ${index + 1} requires a branch from this timetable`);
    }
    if (!Types.ObjectId.isValid(subjectId) || !allowed.has(subjectId)) {
      throw createError(400, `Slot ${index + 1} subject is not assigned in the curriculum`);
    }
    if (!Types.ObjectId.isValid(facultyId)) {
      throw createError(400, `Slot ${index + 1} requires a valid faculty`);
    }
    const subject = subjectMap.get(subjectId);
    const faculty = facultyUserMap.get(facultyId);
    const facultyProfile = facultyProfileMap.get(facultyId);
    if (!subject || !subject.isActive) throw createError(404, "Active timetable subject not found");
    const isCombined = Boolean(slot.isCombined || slotBranchDepartmentIds.length > 1);
    if (!faculty) throw createError(404, "Active teaching faculty not found");
    const classType = String(slot.classType || "");
    const approvedWorkload = workloadByFaculty.get(facultyId);
    if (
      approvedWorkload &&
      !approvedWorkload.teachingAssignments.some(
        (assignment) =>
          assignment.subjectId.toString() === subjectId &&
          assignment.classType === classType &&
          assignment.program === scopeProgram &&
          Number(assignment.semester) === Number(scopeSemester) &&
          (!scopeSection ||
            !assignment.section ||
            ["ALL", "COMBINED", "NA"].includes(assignment.section.trim().toUpperCase()) ||
            assignment.section.trim().toUpperCase() === scopeSection.trim().toUpperCase()),
      )
    ) {
      throw createError(
        409,
        `${faculty.name} has no approved workload assignment for this subject and class`,
      );
    }
    const curriculumSubject = allowed.get(subjectId)!;
    if (
      (classType === "theory" && curriculumSubject.theoryHours <= 0) ||
      (classType === "tutorial" && curriculumSubject.tutorialHours <= 0) ||
      (classType === "lab" && curriculumSubject.labHours <= 0)
    ) {
      throw createError(400, `${subject.code} has no configured ${classType} hours`);
    }
    const requestedRoomId = String(slot.roomId || "");
    const facility = requestedRoomId ? facilityById.get(requestedRoomId) : null;
    if (requestedRoomId && !facility) {
      throw createError(404, `Slot ${index + 1} facility space was not found`);
    }
    if (facility?.status !== undefined && facility.status !== "active") {
      throw createError(409, `${facility.code} is not available for scheduling`);
    }
    if (facility && classType === "lab" && facility.type !== "laboratory") {
      throw createError(409, `${facility.code} is not configured as a laboratory`);
    }
    if (facility && section && facility.capacity < section.capacity) {
      throw createError(
        409,
        `${facility.code} capacity (${facility.capacity}) is below section capacity (${section.capacity})`,
      );
    }
    const roomNo = String(facility?.code || slot.roomNo || "")
      .trim()
      .toUpperCase();
    if (!roomNo) throw createError(400, `Slot ${index + 1} room is required`);
    return {
      ...slot,
      slotKind,
      classType: classType as "theory" | "lab" | "tutorial",
      startTime: String(slot.startTime || ""),
      endTime: String(slot.endTime || ""),
      subjectId: subject._id,
      subjectCode: subject.code,
      subjectShortName: subject.shortName,
      subjectName: subject.name,
      facultyId: faculty._id,
      facultyName: faculty.name,
      facultyCode: facultyProfile?.employeeId || undefined,
      facultyDepartmentId: faculty.department,
      roomId: facility?._id,
      roomNo,
      branchDepartmentId,
      branchDepartmentIds: slotBranchDepartmentIds,
      branches: slotBranchDepartmentIds
        .map((departmentId) => branchCodeByDepartmentId.get(departmentId))
        .filter(Boolean),
      isCombined,
      branch: isCombined ? undefined : branchCodeByDepartmentId.get(branchDepartmentId),
      labBatch: classType === "lab" ? String(slot.labBatch || "").trim() || undefined : undefined,
    };
  });
  const scheduledHours = new Map<string, number>();
  for (const slot of normalizedSlots) {
    if (slot.slotKind !== "teaching" || !slot.subjectId) continue;
    const batchKey = slot.classType === "lab" ? String(slot.labBatch || "all") : "all";
    const key = `${String(slot.subjectId)}:${String(slot.classType)}:${batchKey}`;
    const durationMinutes = toMinutes(String(slot.endTime)) - toMinutes(String(slot.startTime));
    scheduledHours.set(key, (scheduledHours.get(key) ?? 0) + durationMinutes);
    const subjectPlan = allowed.get(String(slot.subjectId))!;
    const maximum =
      slot.classType === "theory"
        ? subjectPlan.theoryHours
        : slot.classType === "tutorial"
          ? subjectPlan.tutorialHours
          : subjectPlan.labHours;
    if ((scheduledHours.get(key) ?? 0) > maximum * 60) {
      throw createError(
        400,
        `${slot.subjectCode} exceeds configured weekly ${slot.classType} hours`,
      );
    }
  }
  next["slots"] = normalizedSlots;

  return next;
}

async function assertRequiredSubjectsScheduled(timetable: ITimetable) {
  if (!timetable.curriculumId) throw createError(409, "Timetable has no curriculum reference");
  const curriculum = await curriculumRepository.findById(timetable.curriculumId.toString());
  const plan = curriculum?.semesterPlans?.find((item) => item.semesterNo === timetable.semester);
  if (!curriculum?.isActive || !plan) throw createError(409, "Active curriculum plan not found");

  // A curriculum can contain the semester plans for several program branches. A timetable,
  // however, may intentionally target only one branch or a selected subset of branches. Only
  // subjects owned by those target departments are required for this publication.
  const targetDepartmentIds = new Set(
    (timetable.branchDepartmentIds?.length
      ? timetable.branchDepartmentIds
      : [timetable.departmentId]
    ).map(String),
  );
  const plannedSubjects = await subjectRepository.findByIds(
    plan.subjects.map((subject) => subject.subjectId.toString()),
  );
  const subjectDepartmentById = new Map(
    plannedSubjects.map((subject) => [subject._id.toString(), subject.departmentId.toString()]),
  );
  const scheduled = new Set(
    (timetable.slots ?? [])
      .filter((slot) => slot.slotKind !== "break" && slot.slotKind !== "activity" && slot.subjectId)
      .map((slot) => slot.subjectId!.toString()),
  );
  const missing = plan.subjects.filter(
    (subject) =>
      targetDepartmentIds.has(subjectDepartmentById.get(subject.subjectId.toString()) ?? "") &&
      !subject.isElective &&
      subject.theoryHours + subject.labHours + subject.tutorialHours > 0 &&
      !scheduled.has(subject.subjectId.toString()),
  );
  if (missing.length) {
    throw createError(
      400,
      `Required curriculum subjects are unscheduled: ${missing.map((item) => item.subjectCode).join(", ")}`,
    );
  }
}

function assertTimetableDepartment(
  timetable: Record<string, unknown>,
  allowedDepartmentId?: string,
) {
  if (!allowedDepartmentId) return;
  const departmentId = timetable["departmentId"]?.toString();
  const branchDepartmentIds = (
    (timetable["branchDepartmentIds"] as Array<string | Types.ObjectId> | undefined) ?? []
  ).map(String);
  if (
    departmentId !== allowedDepartmentId ||
    branchDepartmentIds.some((branchDepartmentId) => branchDepartmentId !== allowedDepartmentId)
  ) {
    throw createError(403, "You can manage only your department timetable");
  }
}

async function enrichFacultyDepartments<T extends object>(timetables: T[]) {
  const facultyIds = [
    ...new Set(
      timetables.flatMap((timetable) =>
        (
          ((timetable as unknown as Record<string, unknown>)["slots"] as
            | Array<{
                facultyId?: unknown;
              }>
            | undefined) ?? []
        )
          .map((slot) => String(slot.facultyId ?? ""))
          .filter((facultyId) => Types.ObjectId.isValid(facultyId)),
      ),
    ),
  ];
  if (!facultyIds.length) return timetables;
  const faculty = await UserModel.find({ _id: { $in: facultyIds } })
    .select("_id department")
    .lean();
  const departmentByFaculty = new Map(
    faculty.map((item) => [String(item._id), String(item.department ?? "")]),
  );
  return timetables.map((timetable) => ({
    ...timetable,
    slots: (
      ((timetable as unknown as Record<string, unknown>)["slots"] as
        | Array<Record<string, unknown>>
        | undefined) ?? []
    ).map((slot) => ({
      ...slot,
      facultyDepartmentId:
        String(slot["facultyDepartmentId"] ?? "") ||
        departmentByFaculty.get(String(slot["facultyId"] ?? "")) ||
        undefined,
    })),
  })) as Array<T & { slots: Array<Record<string, unknown>> }>;
}

async function enrichFacilityDetails<T extends object>(timetables: T[]) {
  const roomIds = [
    ...new Set(
      timetables.flatMap((timetable) =>
        (
          ((timetable as unknown as Record<string, unknown>)["slots"] as
            | Array<{
                roomId?: unknown;
              }>
            | undefined) ?? []
        )
          .map((slot) => String(slot.roomId ?? ""))
          .filter((roomId) => Types.ObjectId.isValid(roomId)),
      ),
    ),
  ];
  if (!roomIds.length) return timetables;
  const rooms = await FacilitySpaceModel.find({ _id: { $in: roomIds } })
    .select("_id code name building floor")
    .lean();
  const roomById = new Map(rooms.map((room) => [String(room._id), room]));
  return timetables.map((timetable) => ({
    ...timetable,
    slots: (
      ((timetable as unknown as Record<string, unknown>)["slots"] as
        | Array<Record<string, unknown>>
        | undefined) ?? []
    ).map((slot) => {
      const room = roomById.get(String(slot["roomId"] ?? ""));
      return {
        ...slot,
        roomName: room?.name,
        roomBuilding: room?.building,
        roomFloor: room?.floor,
      };
    }),
  })) as Array<T & { slots: Array<Record<string, unknown>> }>;
}

async function enrichTimetableReferences<T extends object>(timetables: T[]) {
  return enrichFacilityDetails(await enrichFacultyDepartments(timetables));
}

async function checkClashes(
  slots: SlotInput[],
  academicYear: string,
  semesterType: string,
  excludeId?: string,
  session?: ClientSession,
) {
  if (!slots?.length) return;

  assertTimetableSlotLayout(slots);

  // Build lookup arrays for DB query (period-level)
  const facultyKeys = slots
    .filter((slot) => slot.facultyId)
    .map((s) => ({ facultyId: s.facultyId!, day: s.day }));
  const roomKeys = slots
    .filter((slot) => slot.roomNo)
    .map((s) => ({ roomNo: s.roomNo, day: s.day }));

  const [facultyConflicts, roomConflicts] = await Promise.all([
    timetableRepository.findFacultyConflicts(
      facultyKeys,
      academicYear,
      semesterType,
      excludeId,
      session,
    ),
    timetableRepository.findRoomConflicts(roomKeys, academicYear, semesterType, excludeId, session),
  ]);

  // Faculty time-overlap check
  for (const conflict of facultyConflicts as unknown as ITimetable[]) {
    const existingSlots = conflict.slots as unknown as SlotInput[];
    for (const newSlot of slots) {
      for (const ex of existingSlots) {
        if (
          ex.facultyId &&
          newSlot.facultyId &&
          String(ex.facultyId) === String(newSlot.facultyId) &&
          ex.day === newSlot.day &&
          timesOverlap(newSlot.startTime, newSlot.endTime, ex.startTime, ex.endTime)
        ) {
          throw createError(
            409,
            `Faculty clash: faculty ${newSlot.facultyId} is already assigned on ${newSlot.day} ` +
              `${newSlot.startTime}–${newSlot.endTime} in ${conflict.program} Sem ${conflict.semester} ${conflict.section}`,
          );
        }
      }
    }
  }

  // Room double-booking check
  for (const conflict of roomConflicts as unknown as ITimetable[]) {
    const existingSlots = conflict.slots as unknown as SlotInput[];
    for (const newSlot of slots) {
      for (const ex of existingSlots) {
        // Allow lab batches sharing a room intentionally? No — rooms are exclusive
        if (
          ex.roomNo &&
          newSlot.roomNo &&
          ex.roomNo === newSlot.roomNo &&
          ex.day === newSlot.day &&
          timesOverlap(newSlot.startTime, newSlot.endTime, ex.startTime, ex.endTime)
        ) {
          throw createError(
            409,
            `Room clash: room ${newSlot.roomNo} is already occupied on ${newSlot.day} ` +
              `${newSlot.startTime}–${newSlot.endTime} by ${conflict.program} Sem ${conflict.semester} ${conflict.section}`,
          );
        }
      }
    }
  }
}

// ── service ───────────────────────────────────────────────────────────────────

export const timetableService = {
  getAll: async (filter: Record<string, unknown>, page: number, limit: number) => {
    const result = await timetableRepository.list(filter, page, limit);
    return { ...result, data: await enrichTimetableReferences(result.data) };
  },

  getById: async (id: string) => {
    const timetable = await redisUtil.remember(`tt:id:${id}`, TT_TTL, () =>
      timetableRepository.findById(id),
    );
    if (!timetable) return timetable;
    return (await enrichTimetableReferences([timetable]))[0];
  },

  getForClass: (
    academicYear: string,
    semesterType: string,
    departmentId: string,
    semester: number,
    section: string,
    sectionId?: string,
    approvedOnly = false,
  ) => {
    const cacheKey = sectionId
      ? `tt:section:${approvedOnly ? "approved" : "all"}:${sectionId}:${semesterType}`
      : `tt:${approvedOnly ? "approved" : "all"}:${academicYear}:${semesterType}:${departmentId}:${semester}:${section}`;
    return redisUtil.remember(cacheKey, TT_TTL, () =>
      timetableRepository.findOne(
        sectionId
          ? {
              sectionId,
              semesterType,
              ...(approvedOnly ? { isApproved: true, isActive: true } : {}),
            }
          : {
              academicYear,
              semesterType,
              departmentId,
              semester,
              section,
              ...(approvedOnly ? { isApproved: true, isActive: true } : {}),
            },
      ),
    );
  },

  getFacultyTimetable: (
    facultyId: string,
    academicYear: string,
    semesterType: string,
    departmentId?: string,
  ) => {
    const cacheKey = `tt:faculty:${facultyId}:${academicYear}:${semesterType}:${departmentId ?? "all"}`;
    return redisUtil.remember(cacheKey, TT_TTL, async () =>
      enrichTimetableReferences(
        await timetableRepository.getFacultyTimetable(
          facultyId,
          academicYear,
          semesterType,
          departmentId,
        ),
      ),
    );
  },

  create: async (data: Record<string, unknown>, allowedDepartmentId?: string) => {
    const normalized = await normalizeTimetablePayload({
      ...data,
      isApproved: false,
      approvedBy: undefined,
      approvedAt: undefined,
      isActive: true,
    });
    assertTimetableDepartment(normalized, allowedDepartmentId);
    const slots = (normalized.slots as SlotInput[]) || [];
    const keys = timetableLockKeys(
      slots,
      normalized.academicYear as string,
      normalized.semesterType as string,
      String(normalized.sectionId),
    );
    const result = await withTimetableLocks(keys, async (session) => {
      await checkClashes(
        slots,
        normalized.academicYear as string,
        normalized.semesterType as string,
        undefined,
        session,
      );
      return timetableRepository.create(normalized, session);
    });
    await invalidateTimetableCache(
      normalized.academicYear as string,
      normalized.semesterType as string,
      normalized.departmentId as string,
    );
    return result;
  },

  createBatch: async (
    data: Record<string, unknown> & {
      sectionIds?: string[];
      directScopes?: Array<Record<string, unknown>>;
    },
    allowedDepartmentId?: string,
  ) => {
    const sectionIds = [...new Set(data.sectionIds ?? [])];
    const directScopes = data.directScopes ?? [];
    if (!sectionIds.length && !directScopes.length) {
      throw createError(400, "Select sections or add at least one direct academic scope");
    }
    if (sectionIds.length + directScopes.length > 50)
      throw createError(400, "A timetable plan cannot exceed 50 academic groups");
    const normalizedRows: Record<string, unknown>[] = [];
    for (const sectionId of sectionIds) {
      const normalized = await normalizeTimetablePayload({
        ...data,
        sectionIds: undefined,
        directScopes: undefined,
        sectionId,
        slots: [],
        isApproved: false,
        approvedBy: undefined,
        approvedAt: undefined,
        isActive: true,
      });
      assertTimetableDepartment(normalized, allowedDepartmentId);
      normalizedRows.push(normalized);
    }
    for (const scope of directScopes) {
      const normalized = await normalizeTimetablePayload({
        ...data,
        ...scope,
        sectionIds: undefined,
        directScopes: undefined,
        sectionId: undefined,
        section: undefined,
        slots: [],
        isApproved: false,
        approvedBy: undefined,
        approvedAt: undefined,
        isActive: true,
      });
      assertTimetableDepartment(normalized, allowedDepartmentId);
      normalizedRows.push(normalized);
    }
    const keys = normalizedRows.flatMap((row) =>
      timetableLockKeys(
        (row.slots as SlotInput[]) ?? [],
        String(row.academicYear),
        String(row.semesterType),
        String(row.sectionId),
      ),
    );
    const created = await withTimetableLocks(keys, async (session) => {
      const rows = [];
      for (const normalized of normalizedRows) {
        await checkClashes(
          (normalized.slots as SlotInput[]) ?? [],
          String(normalized.academicYear),
          String(normalized.semesterType),
          undefined,
          session,
        );
        rows.push(await timetableRepository.create(normalized, session));
      }
      return rows;
    });
    await invalidateTimetableCache();
    return created;
  },

  update: async (id: string, data: Record<string, unknown>, allowedDepartmentId?: string) => {
    const existing = (await timetableRepository.findById(id)) as unknown as ITimetable | null;
    if (!existing) throw createError(404, "Timetable not found");
    if (existing.isApproved) throw createError(409, "Approved timetables are immutable");
    assertTimetableDepartment(existing as unknown as Record<string, unknown>, allowedDepartmentId);
    const normalized = await normalizeTimetablePayload(data, existing);
    for (const field of [
      "_id",
      "createdBy",
      "createdAt",
      "updatedAt",
      "isApproved",
      "approvedBy",
      "approvedAt",
      "substituteLog",
    ]) {
      delete normalized[field];
    }
    assertTimetableDepartment(normalized, allowedDepartmentId);
    const nextSlots =
      (normalized.slots as SlotInput[]) ?? (existing.slots as unknown as SlotInput[]);
    const academicYear = (normalized.academicYear as string) || existing.academicYear;
    const semesterType = (normalized.semesterType as string) || existing.semesterType;
    const keys = [
      ...timetableLockKeys(
        existing.slots as unknown as SlotInput[],
        existing.academicYear,
        existing.semesterType,
        String(existing.sectionId),
      ),
      ...timetableLockKeys(
        nextSlots,
        academicYear,
        semesterType,
        String(normalized.sectionId ?? existing.sectionId),
      ),
    ];
    const result = await withTimetableLocks(keys, async (session) => {
      const current = await timetableRepository.findById(id, session);
      if (!current || current.isApproved)
        throw createError(409, "Timetable was concurrently changed");
      await checkClashes(nextSlots, academicYear, semesterType, id, session);
      const saved = await timetableRepository.updateById(id, normalized, session);
      if (!saved) throw createError(409, "Timetable was concurrently approved");
      return saved;
    });
    await invalidateTimetableCache();
    return result;
  },

  updatePublicationDetails: async (
    id: string,
    data: Record<string, unknown>,
    updatedBy: string,
    allowedDepartmentId?: string,
  ) => {
    const existing = await timetableRepository.findById(id);
    if (!existing) throw createError(404, "Timetable not found");
    assertTimetableDepartment(existing as unknown as Record<string, unknown>, allowedDepartmentId);
    const effectiveFrom = data.effectiveFrom ? new Date(String(data.effectiveFrom)) : undefined;
    const effectiveTo = data.effectiveTo ? new Date(String(data.effectiveTo)) : undefined;
    if (effectiveFrom && !Number.isFinite(effectiveFrom.getTime())) {
      throw createError(400, "Valid effective-from date is required");
    }
    if (effectiveTo && !Number.isFinite(effectiveTo.getTime())) {
      throw createError(400, "Valid effective-to date is required");
    }
    if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) {
      throw createError(400, "Effective-to date cannot be before effective-from date");
    }
    const updated = await timetableRepository.updatePublicationDetails(id, {
      title: String(data.title ?? "").trim() || undefined,
      effectiveFrom,
      effectiveTo,
      documentNo: String(data.documentNo ?? "").trim() || undefined,
      updatedBy,
    });
    await invalidateTimetableCache();
    return updated;
  },

  approve: async (id: string, approvedBy: string, allowedDepartmentId?: string) => {
    const existing = await timetableRepository.findById(id);
    if (!existing) throw createError(404, "Timetable not found");
    assertTimetableDepartment(existing as unknown as Record<string, unknown>, allowedDepartmentId);
    if (existing.isApproved) throw createError(409, "Timetable is already approved");
    if (!existing.isActive || !existing.slots?.length) {
      throw createError(400, "Only an active timetable with at least one slot can be approved");
    }
    await assertRequiredSubjectsScheduled(existing as unknown as ITimetable);
    const slots = existing.slots as unknown as SlotInput[];
    const keys = timetableLockKeys(
      slots,
      existing.academicYear,
      existing.semesterType,
      String(existing.sectionId),
    );
    const approved = await withTimetableLocks(keys, async (session) => {
      await checkClashes(slots, existing.academicYear, existing.semesterType, id, session);
      const result = await timetableRepository.approve(id, approvedBy, session);
      if (!result) throw createError(409, "Timetable was concurrently changed or approved");
      return result;
    });
    await invalidateTimetableCache();
    void notifyStudentsByClass(
      {
        departmentId: existing.departmentId.toString(),
        semester: existing.semester,
        section: existing.section,
        academicYear: existing.academicYear,
      },
      {
        title: "New timetable published",
        body: `Your Sem ${existing.semester} ${existing.section} timetable for ${existing.academicYear} (${existing.semesterType}) is now available.`,
        type: NotificationType.GENERAL,
        actionUrl: "/timetable",
      },
    );
    return approved;
  },

  validateForPublish: async (id: string, allowedDepartmentId?: string) => {
    const existing = await timetableRepository.findById(id);
    if (!existing) throw createError(404, "Timetable not found");
    assertTimetableDepartment(existing as unknown as Record<string, unknown>, allowedDepartmentId);
    if (existing.isApproved) throw createError(409, "Timetable is already published");
    if (!existing.isActive || !existing.slots?.length) {
      throw createError(400, "An active timetable with at least one slot is required");
    }
    await assertRequiredSubjectsScheduled(existing as unknown as ITimetable);
    await checkClashes(
      existing.slots as unknown as SlotInput[],
      existing.academicYear,
      existing.semesterType,
      id,
    );
    return {
      ready: true,
      slotCount: existing.slots.length,
      subjectCount: new Set(
        existing.slots.filter((slot) => slot.subjectId).map((slot) => slot.subjectId!.toString()),
      ).size,
      facultyCount: new Set(
        existing.slots.filter((slot) => slot.facultyId).map((slot) => slot.facultyId!.toString()),
      ).size,
      checkedAt: new Date().toISOString(),
    };
  },

  delete: async (id: string, allowedDepartmentId?: string) => {
    const existing = await timetableRepository.findById(id);
    if (!existing) throw createError(404, "Timetable not found");
    if (existing.isApproved) throw createError(409, "Approved timetables cannot be deleted");
    assertTimetableDepartment(existing as unknown as Record<string, unknown>, allowedDepartmentId);
    await timetableRepository.deleteById(id);
    await invalidateTimetableCache();
    return { _id: id };
  },

  archive: async (id: string, updatedBy: string, allowedDepartmentId?: string) => {
    const existing = await timetableRepository.findById(id);
    if (!existing) throw createError(404, "Timetable not found");
    assertTimetableDepartment(existing as unknown as Record<string, unknown>, allowedDepartmentId);
    if (!existing.isApproved || !existing.isActive) {
      throw createError(409, "Only an approved active timetable can be archived");
    }
    const archived = await timetableRepository.archive(id, updatedBy);
    if (!archived) throw createError(409, "Timetable was concurrently archived");
    await invalidateTimetableCache();
    return archived;
  },

  assignSubstitute: async (
    timetableId: string,
    slotIndex: number,
    substituteFacultyId: string,
    date: string,
    reason: string,
    assignedBy: string,
    allowedDepartmentId?: string,
  ) => {
    const tt = await timetableRepository.findById(timetableId);
    if (!tt) throw (await import("http-errors")).default(404, "Timetable not found");
    assertTimetableDepartment(tt as unknown as Record<string, unknown>, allowedDepartmentId);
    if (!tt.isApproved || !tt.isActive) {
      throw createError(409, "Substitutes can be assigned only to an approved active timetable");
    }
    const slot = tt.slots?.[slotIndex];
    if (!slot) throw createError(400, "Valid timetable slot index is required");
    if (!reason.trim()) throw createError(400, "Substitute assignment reason is required");
    if (!Types.ObjectId.isValid(substituteFacultyId)) {
      throw createError(400, "Valid substitute faculty is required");
    }
    if (String(slot.facultyId) === substituteFacultyId) {
      throw createError(400, "Substitute faculty must differ from the assigned faculty");
    }
    const substitute = await UserModel.findOne({
      _id: substituteFacultyId,
      roles: { $in: [SystemRole.FACULTY, SystemRole.HOD] },
      status: "active",
    })
      .select("_id name")
      .lean();
    if (!substitute) throw createError(404, "Active substitute faculty not found");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw createError(400, "Valid substitute date required");
    const substituteDate = new Date(`${date}T00:00:00.000Z`);
    if (!Number.isFinite(substituteDate.getTime()))
      throw createError(400, "Valid substitute date required");
    const indiaDateParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      indiaDateParts.find((item) => item.type === type)?.value ?? "";
    const todayInIndia = `${part("year")}-${part("month")}-${part("day")}`;
    if (date < todayInIndia) throw createError(400, "Past substitute assignments are not allowed");
    if (tt.effectiveFrom && substituteDate < new Date(tt.effectiveFrom)) {
      throw createError(400, "Substitute date is before the timetable effective date");
    }
    if (tt.effectiveTo && substituteDate > new Date(tt.effectiveTo)) {
      throw createError(400, "Substitute date is after the timetable effective period");
    }
    const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
      substituteDate.getUTCDay()
    ];
    if (day !== slot.day) throw createError(400, `Selected date must be a ${slot.day}`);
    const duplicate = (tt.substituteLog ?? []).some(
      (entry) =>
        entry.status !== "cancelled" &&
        entry.slotIndex === slotIndex &&
        new Date(entry.date).toISOString().slice(0, 10) === date,
    );
    if (duplicate)
      throw createError(409, "A substitute is already assigned for this slot and date");

    const dayEnd = new Date(substituteDate);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    const [substituteAttendance, substituteLeave] = await Promise.all([
      FacultyAttendanceModel.findOne({
        facultyId: substituteFacultyId,
        date: { $gte: substituteDate, $lt: dayEnd },
        status: { $in: ["absent", "on_leave"] },
      })
        .select("status")
        .lean(),
      LeaveRequestModel.findOne({
        employeeId: substituteFacultyId,
        status: "approved",
        fromDate: { $lt: dayEnd },
        toDate: { $gte: substituteDate },
      })
        .select("_id")
        .lean(),
    ]);
    if (substituteAttendance || substituteLeave) {
      throw createError(409, `${substitute.name} is absent or on approved leave for this date`);
    }
    const regularConflict = tt.slots.some(
      (otherSlot, otherIndex) =>
        otherIndex !== slotIndex &&
        otherSlot.day === slot.day &&
        String(otherSlot.facultyId ?? "") === substituteFacultyId &&
        timesOverlap(slot.startTime, slot.endTime, otherSlot.startTime, otherSlot.endTime),
    );
    if (regularConflict) {
      throw createError(409, `${substitute.name} already has another class at this time`);
    }
    const substituteSlot = { ...slot, facultyId: substituteFacultyId } as unknown as SlotInput;
    const keys = timetableLockKeys(
      [substituteSlot],
      tt.academicYear,
      tt.semesterType,
      String(tt.sectionId),
    );
    const updated = await withTimetableLocks(keys, async (session) => {
      const current = await timetableRepository.findById(timetableId, session);
      if (!current || !current.isApproved || !current.isActive) {
        throw createError(409, "Timetable changed while assigning substitute");
      }
      if (
        (current.substituteLog ?? []).some(
          (entry) =>
            entry.status !== "cancelled" &&
            entry.slotIndex === slotIndex &&
            new Date(entry.date).toISOString().slice(0, 10) === date,
        )
      ) {
        throw createError(409, "A substitute is already assigned for this slot and date");
      }
      await checkClashes([substituteSlot], tt.academicYear, tt.semesterType, timetableId, session);
      const nextDay = new Date(substituteDate);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const assignments = await timetableRepository.findSubstituteAssignments(
        substituteFacultyId,
        substituteDate,
        nextDay,
        session,
      );
      for (const assignment of assignments) {
        for (const entry of assignment.substituteLog ?? []) {
          if (
            entry.status === "cancelled" ||
            String(entry.substituteFacultyId) !== substituteFacultyId ||
            new Date(entry.date).toISOString().slice(0, 10) !== date
          )
            continue;
          const assignedSlot = assignment.slots?.[entry.slotIndex];
          if (
            assignedSlot &&
            assignedSlot.day === slot.day &&
            timesOverlap(slot.startTime, slot.endTime, assignedSlot.startTime, assignedSlot.endTime)
          ) {
            throw createError(409, "Substitute faculty already has an overlapping assignment");
          }
        }
      }
      const result = await timetableRepository.pushSubstitute(
        timetableId,
        {
          slotIndex,
          substituteFacultyId,
          date: substituteDate,
          reason: reason.trim(),
          assignedBy,
          assignedAt: new Date(),
          status: "active",
        },
        session,
      );
      if (!result) throw createError(409, "Timetable changed while assigning substitute");
      return result;
    });
    await invalidateTimetableCache();
    const originalFaculty = slot.facultyId
      ? await UserModel.findById(slot.facultyId).select("_id name").lean()
      : null;
    const classLabel = `${slot.subjectName} on ${date}, ${slot.startTime}–${slot.endTime}${slot.roomNo ? ` in ${slot.roomNo}` : ""}`;
    void notifyUsers([substituteFacultyId], {
      title: "Substitute class assigned",
      body: `You have been assigned ${classLabel}.`,
      type: NotificationType.INFO,
      actionUrl: "/timetable",
      createdBy: assignedBy,
    });
    if (originalFaculty?._id) {
      void notifyUsers([originalFaculty._id], {
        title: "Substitute arranged for your class",
        body: `${substitute.name} will conduct ${classLabel}.`,
        type: NotificationType.INFO,
        actionUrl: "/timetable",
        createdBy: assignedBy,
      });
    }
    const targetDepartmentIds = slot.isCombined
      ? slot.branchDepartmentIds?.length
        ? slot.branchDepartmentIds
        : tt.branchDepartmentIds
      : [slot.branchDepartmentId ?? tt.departmentId];
    for (const departmentId of targetDepartmentIds ?? []) {
      void notifyStudentsByClass(
        {
          departmentId,
          program: tt.program,
          semester: tt.semester,
          section: tt.section || undefined,
          academicYear: tt.academicYear,
        },
        {
          title: "Faculty changed for an upcoming class",
          body: `${slot.subjectName} on ${date}, ${slot.startTime}–${slot.endTime} will be conducted by ${substitute.name}${slot.roomNo ? ` in ${slot.roomNo}` : ""}.`,
          type: NotificationType.INFO,
          actionUrl: "/timetable",
          createdBy: assignedBy,
        },
      );
    }
    return updated;
  },

  cancelSubstitute: async (
    timetableId: string,
    substituteEntryId: string,
    reason: string,
    cancelledBy: string,
    allowedDepartmentId?: string,
  ) => {
    if (!Types.ObjectId.isValid(substituteEntryId)) {
      throw createError(400, "Valid substitute assignment is required");
    }
    if (reason.trim().length < 3) throw createError(400, "Cancellation reason is required");
    const timetable = await timetableRepository.findById(timetableId);
    if (!timetable) throw createError(404, "Timetable not found");
    assertTimetableDepartment(timetable as unknown as Record<string, unknown>, allowedDepartmentId);
    const entry = (timetable.substituteLog ?? []).find(
      (item) => item._id?.toString() === substituteEntryId && item.status !== "cancelled",
    );
    if (!entry) throw createError(404, "Active substitute assignment not found");
    const slot = timetable.slots?.[entry.slotIndex];
    if (!slot) throw createError(409, "The original timetable slot no longer exists");
    const updated = await timetableRepository.cancelSubstitute(
      timetableId,
      substituteEntryId,
      cancelledBy,
      reason.trim(),
    );
    if (!updated) throw createError(409, "Substitute assignment was concurrently changed");
    await invalidateTimetableCache();
    const date = new Date(entry.date).toISOString().slice(0, 10);
    void notifyUsers([entry.substituteFacultyId], {
      title: "Substitute class assignment cancelled",
      body: `${slot.subjectName} on ${date}, ${slot.startTime}–${slot.endTime} has been cancelled. Reason: ${reason.trim()}`,
      type: NotificationType.WARNING,
      actionUrl: "/timetable",
      createdBy: cancelledBy,
    });
    if (slot.facultyId) {
      void notifyUsers([slot.facultyId], {
        title: "Substitute arrangement cancelled",
        body: `${slot.subjectName} on ${date}, ${slot.startTime}–${slot.endTime} no longer has a replacement assigned.`,
        type: NotificationType.WARNING,
        actionUrl: "/timetable",
        createdBy: cancelledBy,
      });
    }
    const targetDepartmentIds = slot.isCombined
      ? slot.branchDepartmentIds?.length
        ? slot.branchDepartmentIds
        : timetable.branchDepartmentIds
      : [slot.branchDepartmentId ?? timetable.departmentId];
    for (const departmentId of targetDepartmentIds ?? []) {
      void notifyStudentsByClass(
        {
          departmentId,
          program: timetable.program,
          semester: timetable.semester,
          section: timetable.section || undefined,
          academicYear: timetable.academicYear,
        },
        {
          title: "Faculty replacement updated",
          body: `The replacement for ${slot.subjectName} on ${date}, ${slot.startTime}–${slot.endTime} was cancelled. Check the timetable for further updates.`,
          type: NotificationType.WARNING,
          actionUrl: "/timetable",
          createdBy: cancelledBy,
        },
      );
    }
    return updated;
  },

  listClassOperations: async (timetableId: string, allowedDepartmentId?: string) => {
    const timetable = await timetableRepository.findById(timetableId);
    if (!timetable) throw createError(404, "Timetable not found");
    assertTimetableDepartment(timetable as unknown as Record<string, unknown>, allowedDepartmentId);
    return ClassOperationModel.find({ timetableId })
      .populate("facultyId", "name")
      .populate("subjectId", "code name shortName")
      .sort({ date: 1, startTime: 1 })
      .lean();
  },

  createExtraClass: async (
    timetableId: string,
    data: Record<string, unknown>,
    createdBy: string,
    allowedDepartmentId?: string,
  ) => {
    const timetable = await timetableRepository.findById(timetableId);
    if (!timetable) throw createError(404, "Timetable not found");
    assertTimetableDepartment(timetable as unknown as Record<string, unknown>, allowedDepartmentId);
    if (!timetable.isApproved || !timetable.isActive) {
      throw createError(409, "Extra classes require an active published timetable");
    }
    const subjectId = String(data.subjectId ?? "");
    const facultyId = String(data.facultyId ?? "");
    const roomId = String(data.roomId ?? "");
    const dateText = String(data.date ?? "");
    const startTime = String(data.startTime ?? "");
    const endTime = String(data.endTime ?? "");
    const reason = String(data.reason ?? "").trim();
    if (
      !Types.ObjectId.isValid(subjectId) ||
      !Types.ObjectId.isValid(facultyId) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(dateText) ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(endTime) ||
      toMinutes(endTime) <= toMinutes(startTime) ||
      reason.length < 3
    ) {
      throw createError(400, "Valid subject, faculty, date, time range, and reason are required");
    }
    const date = new Date(`${dateText}T00:00:00.000Z`);
    const nextDate = new Date(date);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    if (dateText < today) throw createError(400, "Past extra classes are not allowed");
    if (timetable.effectiveFrom && date < new Date(timetable.effectiveFrom)) {
      throw createError(400, "Extra-class date is before the timetable effective date");
    }
    if (timetable.effectiveTo && date > new Date(timetable.effectiveTo)) {
      throw createError(400, "Extra-class date is after the timetable effective period");
    }
    const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
      date.getUTCDay()
    ];
    const curriculum = timetable.curriculumId
      ? await curriculumRepository.findById(timetable.curriculumId.toString())
      : null;
    const plan = curriculum?.semesterPlans?.find((item) => item.semesterNo === timetable.semester);
    if (!plan?.subjects.some((item) => item.subjectId.toString() === subjectId)) {
      throw createError(400, "Subject is not assigned to this curriculum semester");
    }
    const [subject, faculty, facultyAttendance, facultyLeave] = await Promise.all([
      subjectRepository.findById(subjectId),
      UserModel.findOne({
        _id: facultyId,
        roles: { $in: [SystemRole.FACULTY, SystemRole.HOD] },
        status: "active",
      })
        .select("_id name")
        .lean(),
      FacultyAttendanceModel.findOne({
        facultyId,
        date: { $gte: date, $lt: nextDate },
        status: { $in: ["absent", "on_leave"] },
      }).lean(),
      LeaveRequestModel.findOne({
        employeeId: facultyId,
        status: "approved",
        fromDate: { $lt: nextDate },
        toDate: { $gte: date },
      }).lean(),
    ]);
    if (!subject?.isActive) throw createError(404, "Active subject not found");
    if (!faculty) throw createError(404, "Active teaching faculty not found");
    if (facultyAttendance || facultyLeave) {
      throw createError(409, `${faculty.name} is absent or on approved leave for this date`);
    }
    const targetDepartmentIds = [
      ...new Set(
        (
          (data.branchDepartmentIds as unknown[] | undefined) ??
          timetable.branchDepartmentIds ?? [timetable.departmentId]
        ).map(String),
      ),
    ];
    const timetableDepartmentIds = new Set(
      (timetable.branchDepartmentIds?.length
        ? timetable.branchDepartmentIds
        : [timetable.departmentId]
      ).map(String),
    );
    if (
      !targetDepartmentIds.length ||
      targetDepartmentIds.some(
        (departmentId) =>
          !Types.ObjectId.isValid(departmentId) || !timetableDepartmentIds.has(departmentId),
      )
    ) {
      throw createError(400, "Extra class requires valid timetable branches");
    }
    let roomNo = String(data.roomNo ?? "")
      .trim()
      .toUpperCase();
    if (roomId) {
      if (!Types.ObjectId.isValid(roomId)) throw createError(400, "Valid room is required");
      const room = await FacilitySpaceModel.findById(roomId).lean();
      if (!room) throw createError(404, "Room not found");
      roomNo = room.code;
    }
    if (!roomNo) throw createError(400, "Room is required");
    const targetSet = new Set(targetDepartmentIds);
    const studentConflict = timetable.slots.some((slot) => {
      if (slot.day !== weekday || !timesOverlap(startTime, endTime, slot.startTime, slot.endTime)) {
        return false;
      }
      const slotDepartments = slot.branchDepartmentIds?.length
        ? slot.branchDepartmentIds.map(String)
        : [String(slot.branchDepartmentId ?? timetable.departmentId)];
      return slotDepartments.some((departmentId) => targetSet.has(departmentId));
    });
    if (studentConflict)
      throw createError(409, "Selected class group already has a class at this time");
    await checkClashes(
      [
        {
          day: weekday,
          periodNo: 1,
          startTime,
          endTime,
          facultyId,
          roomId: roomId || undefined,
          roomNo,
          classType: "theory",
          branchDepartmentIds: targetDepartmentIds,
        },
      ],
      timetable.academicYear,
      timetable.semesterType,
    );
    const operationalConflict = await ClassOperationModel.findOne({
      date: { $gte: date, $lt: nextDate },
      status: "scheduled",
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
      $or: [
        { facultyId },
        { roomNo },
        { timetableId, branchDepartmentIds: { $in: targetDepartmentIds } },
      ],
    }).lean();
    if (operationalConflict) {
      throw createError(
        409,
        "Faculty, room, or class group already has an extra class at this time",
      );
    }
    const operation = await ClassOperationModel.create({
      timetableId,
      operationType: "extra_class",
      date,
      startTime,
      endTime,
      subjectId,
      subjectCode: subject.code,
      subjectName: subject.name,
      facultyId,
      facultyName: faculty.name,
      roomId: roomId || undefined,
      roomNo,
      branchDepartmentIds: targetDepartmentIds,
      reason,
      status: "scheduled",
      createdBy,
    });
    void notifyUsers([facultyId], {
      title: "Extra class assigned",
      body: `You have been assigned ${subject.name} on ${dateText}, ${startTime}–${endTime} in ${roomNo}.`,
      type: NotificationType.INFO,
      actionUrl: "/timetable",
      createdBy,
    });
    for (const departmentId of targetDepartmentIds) {
      void notifyStudentsByClass(
        {
          departmentId,
          program: timetable.program,
          semester: timetable.semester,
          section: timetable.section || undefined,
          academicYear: timetable.academicYear,
        },
        {
          title: "Extra class scheduled",
          body: `${subject.name} is scheduled on ${dateText}, ${startTime}–${endTime} with ${faculty.name} in ${roomNo}.`,
          type: NotificationType.INFO,
          actionUrl: "/timetable",
          createdBy,
        },
      );
    }
    return operation;
  },

  cancelExtraClass: async (
    timetableId: string,
    operationId: string,
    reason: string,
    cancelledBy: string,
    allowedDepartmentId?: string,
  ) => {
    const timetable = await timetableRepository.findById(timetableId);
    if (!timetable) throw createError(404, "Timetable not found");
    assertTimetableDepartment(timetable as unknown as Record<string, unknown>, allowedDepartmentId);
    const operation = await ClassOperationModel.findOneAndUpdate(
      { _id: operationId, timetableId, status: "scheduled" },
      {
        $set: {
          status: "cancelled",
          cancelledBy,
          cancelledAt: new Date(),
          cancellationReason: reason.trim(),
        },
      },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!operation) throw createError(404, "Scheduled extra class not found");
    void notifyUsers([operation.facultyId], {
      title: "Extra class cancelled",
      body: `${operation.subjectName} on ${operation.date.toISOString().slice(0, 10)}, ${operation.startTime}–${operation.endTime} was cancelled.`,
      type: NotificationType.WARNING,
      actionUrl: "/timetable",
      createdBy: cancelledBy,
    });
    for (const departmentId of operation.branchDepartmentIds) {
      void notifyStudentsByClass(
        {
          departmentId,
          program: timetable.program,
          semester: timetable.semester,
          section: timetable.section || undefined,
          academicYear: timetable.academicYear,
        },
        {
          title: "Extra class cancelled",
          body: `${operation.subjectName} on ${operation.date.toISOString().slice(0, 10)}, ${operation.startTime}–${operation.endTime} has been cancelled.`,
          type: NotificationType.WARNING,
          actionUrl: "/timetable",
          createdBy: cancelledBy,
        },
      );
    }
    return operation;
  },

  // ─── Auto-generate timetable (M12) ─────────────────────────────────────────
  /**
   * Greedy scheduler: assigns subjects to day/period slots avoiding faculty and
   * room conflicts with already-existing timetables in the DB.
   *
   * Input subjects array shape:
   *   { subjectId, subjectCode, subjectName, facultyId, facultyName, roomNo,
   *     classType, periodsPerWeek, labBatch? }
   */
  async autoGenerate(
    params: {
      sectionId: string;
      academicYear: string;
      semesterType?: "odd" | "even";
      departmentId: string;
      program: string;
      semester: number;
      section: string;
      subjects: Array<{
        subjectId: string;
        subjectCode: string;
        subjectName: string;
        facultyId: string;
        facultyName: string;
        roomNo: string;
        roomId?: string;
        classType: "theory" | "lab" | "tutorial";
        periodsPerWeek: number;
        labBatch?: string;
      }>;
      periodTimings: Array<{ periodNo: number; startTime: string; endTime: string }>;
      workingDays?: string[];
      generationRules?: {
        maxFacultyPeriodsPerDay?: number;
        maxSubjectPeriodsPerDay?: number;
      };
      createdBy: string;
    },
    allowedDepartmentId?: string,
  ) {
    const { subjects, periodTimings, createdBy } = params;
    const authoritativeHeader = await normalizeTimetablePayload({
      sectionId: params.sectionId,
      slots: [],
    });
    assertTimetableDepartment(authoritativeHeader, allowedDepartmentId);
    const academicYear = String(authoritativeHeader.academicYear);
    const semesterType = authoritativeHeader.semesterType as "odd" | "even";
    const departmentId = String(authoritativeHeader.departmentId);
    const program = String(authoritativeHeader.program);
    const semester = Number(authoritativeHeader.semester);
    const section = String(authoritativeHeader.section);

    const DAYS: string[] = params.workingDays ?? [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    if (new Set(DAYS).size !== DAYS.length) throw createError(400, "Working days must be unique");
    const periodNumbers = new Set<number>();
    for (const timing of periodTimings) {
      if (
        periodNumbers.has(timing.periodNo) ||
        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(timing.startTime) ||
        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(timing.endTime) ||
        toMinutes(timing.endTime) <= toMinutes(timing.startTime)
      ) {
        throw createError(400, "Period timings must be unique and valid");
      }
      periodNumbers.add(timing.periodNo);
    }
    for (let index = 0; index < periodTimings.length; index++) {
      for (let otherIndex = index + 1; otherIndex < periodTimings.length; otherIndex++) {
        if (
          timesOverlap(
            periodTimings[index].startTime,
            periodTimings[index].endTime,
            periodTimings[otherIndex].startTime,
            periodTimings[otherIndex].endTime,
          )
        ) {
          throw createError(400, "Period timings cannot overlap");
        }
      }
    }
    // Build a set of occupied (facultyId|day|periodNo) and (roomNo|day|periodNo)
    // from existing active timetables for this academic period
    const existing = await timetableRepository.findAll({
      academicYear,
      semesterType,
      isActive: true,
    });
    const facultyBusy = new Set<string>();
    const roomBusy = new Set<string>();
    const existingSlots: SlotInput[] = [];
    for (const tt of existing as unknown as ITimetable[]) {
      for (const s of tt.slots ?? []) {
        existingSlots.push(s as unknown as SlotInput);
        facultyBusy.add(`${s.facultyId}|${s.day}|${s.periodNo}`);
        roomBusy.add(`${s.roomNo}|${s.day}|${s.periodNo}`);
      }
    }

    const slots: Record<string, unknown>[] = [];

    // Track slots used in this new timetable as well
    const localFaculty = new Set<string>();
    const localRoom = new Set<string>();
    const localSection = new Set<string>();
    const facultyDailyLoad = new Map<string, number>();
    const subjectDailyLoad = new Map<string, number>();
    const maxFacultyPeriodsPerDay = params.generationRules?.maxFacultyPeriodsPerDay ?? 4;
    const maxSubjectPeriodsPerDay = params.generationRules?.maxSubjectPeriodsPerDay ?? 1;

    for (const existingSlot of existingSlots) {
      const key = `${String(existingSlot.facultyId)}|${existingSlot.day}`;
      facultyDailyLoad.set(key, (facultyDailyLoad.get(key) ?? 0) + 1);
    }

    for (const subj of subjects) {
      let assigned = 0;

      // Walk the week period-first so repeated lectures are spread across days
      // instead of filling every period on Monday before moving to Tuesday.
      // Rotating the starting day per subject also avoids creating the same
      // early-week bias for every course in the generated timetable.
      const subjectIndex = subjects.indexOf(subj);
      const candidates = buildBalancedTimetableCandidates(DAYS, periodTimings, subjectIndex);

      for (const { day, timing: pt } of candidates) {
        if (assigned >= subj.periodsPerWeek) break;

        const fKey = `${subj.facultyId}|${day}|${pt.periodNo}`;
        const rKey = `${subj.roomNo}|${day}|${pt.periodNo}`;
        const sectionKey = `${day}|${pt.periodNo}`;
        const facultyDayKey = `${subj.facultyId}|${day}`;
        const subjectDayKey = `${subj.subjectId}|${subj.classType}|${day}`;

        if (facultyBusy.has(fKey) || localFaculty.has(fKey)) continue;
        if (roomBusy.has(rKey) || localRoom.has(rKey)) continue;
        if (localSection.has(sectionKey)) continue;
        if ((facultyDailyLoad.get(facultyDayKey) ?? 0) >= maxFacultyPeriodsPerDay) continue;
        if ((subjectDailyLoad.get(subjectDayKey) ?? 0) >= maxSubjectPeriodsPerDay) continue;
        if (
          slots.some(
            (localSlot) =>
              localSlot.day === day &&
              timesOverlap(
                pt.startTime,
                pt.endTime,
                String(localSlot.startTime),
                String(localSlot.endTime),
              ),
          )
        )
          continue;
        if (
          existingSlots.some(
            (existingSlot) =>
              existingSlot.day === day &&
              timesOverlap(
                pt.startTime,
                pt.endTime,
                existingSlot.startTime,
                existingSlot.endTime,
              ) &&
              (String(existingSlot.facultyId) === String(subj.facultyId) ||
                existingSlot.roomNo.trim().toUpperCase() === subj.roomNo.trim().toUpperCase()),
          )
        )
          continue;

        slots.push({
          day,
          periodNo: pt.periodNo,
          startTime: pt.startTime,
          endTime: pt.endTime,
          subjectId: subj.subjectId,
          subjectCode: subj.subjectCode,
          subjectName: subj.subjectName,
          facultyId: subj.facultyId,
          facultyName: subj.facultyName,
          roomNo: subj.roomNo,
          roomId: subj.roomId,
          classType: subj.classType,
          labBatch: subj.labBatch,
        });

        localFaculty.add(fKey);
        localRoom.add(rKey);
        localSection.add(sectionKey);
        facultyDailyLoad.set(facultyDayKey, (facultyDailyLoad.get(facultyDayKey) ?? 0) + 1);
        subjectDailyLoad.set(subjectDayKey, (subjectDailyLoad.get(subjectDayKey) ?? 0) + 1);
        assigned++;
      }

      if (assigned < subj.periodsPerWeek) {
        const createError = (await import("http-errors")).default;
        throw createError(
          409,
          `Could not schedule all ${subj.periodsPerWeek} periods for the selected subject — insufficient free slots`,
        );
      }
    }

    const normalized = await normalizeTimetablePayload({
      sectionId: params.sectionId,
      academicYear,
      semesterType,
      departmentId,
      program,
      semester,
      section,
      slots,
      isActive: true,
      isApproved: false,
      createdBy,
    });
    assertTimetableDepartment(normalized, allowedDepartmentId);
    const normalizedSlots = normalized.slots as SlotInput[];
    const keys = timetableLockKeys(
      normalizedSlots,
      normalized.academicYear as string,
      normalized.semesterType as string,
      String(normalized.sectionId),
    );
    const result = await withTimetableLocks(keys, async (session) => {
      await checkClashes(
        normalizedSlots,
        normalized.academicYear as string,
        normalized.semesterType as string,
        undefined,
        session,
      );
      return timetableRepository.create(normalized, session);
    });
    await invalidateTimetableCache();
    return result;
  },
};

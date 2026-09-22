/**
 * Global search route — full-text regex search across multiple entities.
 *
 * GET /search?q=:query&index=:index&limit=:limit
 *   - index: students | faculty | users | departments | subjects | notices | events | all  (default: all)
 *   - limit: max per group when index=all (default 5), max page size otherwise (default 15)
 *
 * Each result item is shaped as:
 *   { _id, type, label, sub?, badge?, url }
 * so the frontend can render select-style options that navigate on click.
 */
import type { Request, Response, NextFunction } from "express";
import { Router } from "express";
import { query } from "express-validator";
import { isValidObjectId } from "mongoose";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import { UserModel } from "../models/user.model";
import { StudentProfileModel } from "../models/student-profile.model";
import { FacultyProfileModel } from "../models/faculty-profile.model";
import { DepartmentModel, DepartmentStatus } from "../models/department.model";
import { SubjectModel } from "../models/subject.model";
import { CurriculumModel } from "../models/curriculum.model";
import { BatchModel } from "../models/batch.model";
import { SectionModel } from "../models/section.model";
import { formatIndiaDate } from "../utils/date.util";
import { TimetableModel } from "../models/timetable.model";
import { NoticeModel } from "../models/notice.model";
import { EventModel } from "../models/event.model";
import { AdmissionApplicationModel } from "../models/admission-application.model";
import { BookModel } from "../models/library.model";
import { AlumniModel } from "../models/alumni.model";
import { GatePassModel } from "../models/gatepass.model";
import { FacilitySpaceModel } from "../models/facilities.model";
import { RoleModel } from "../models/role.model";
import { deriveStudentAdmissionCode } from "../utils/id.util";
import { FeeRecordModel } from "../models/fee.model";
import { FacultyWorkloadModel } from "../models/faculty-workload.model";
import {
  StudentSectionAllotmentModel,
  StudentSectionAllotmentStatus,
} from "../models/student-section-allotment.model";
import { SystemRole } from "../constants/roles";
import { getDepartmentScope } from "../utils/ownership.util";
import { MentorModel } from "../models/mentor.model";
import { CampusModel } from "../models/campus-governance.model";

const router = Router();

type TIndex = "students" | "faculty" | "users" | "departments" | "subjects" | "notices" | "events";

const ALL_INDEXES: TIndex[] = [
  "students",
  "faculty",
  "users",
  "departments",
  "subjects",
  "notices",
  "events",
];

interface ISearchHit {
  _id: string;
  type: TIndex;
  label: string;
  sub?: string;
  badge?: string;
  url: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function searchStudents(regex: RegExp, limit: number): Promise<ISearchHit[]> {
  const rows = await StudentProfileModel.find({
    $or: [
      { firstName: regex },
      { lastName: regex },
      { rollNumber: regex },
      { registrationNumber: regex },
      { collegeEmail: regex },
      { personalEmail: regex },
      { phone: regex },
    ],
  })
    .select(
      "firstName middleName lastName rollNumber registrationNumber collegeEmail program currentSemester",
    )
    .limit(limit)
    .lean();
  return rows.map((r) => ({
    _id: String(r._id),
    type: "students",
    label: [r.firstName, r.middleName, r.lastName].filter(Boolean).join(" ").trim(),
    sub: [r.program, r.currentSemester ? `Sem ${r.currentSemester}` : null, r.collegeEmail]
      .filter(Boolean)
      .join(" · "),
    badge: r.rollNumber || r.registrationNumber,
    url: `/student-profile?focus=${r._id}`,
  }));
}

async function searchFaculty(regex: RegExp, limit: number): Promise<ISearchHit[]> {
  const rows = await FacultyProfileModel.find({
    $or: [
      { firstName: regex },
      { lastName: regex },
      { employeeId: regex },
      { collegeEmail: regex },
      { personalEmail: regex },
      { phone: regex },
    ],
  })
    .select("firstName lastName employeeId collegeEmail designation")
    .limit(limit)
    .lean();
  return rows.map((r) => ({
    _id: String(r._id),
    type: "faculty",
    label: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim(),
    sub: [r.designation, r.collegeEmail].filter(Boolean).join(" · "),
    badge: r.employeeId,
    url: `/faculty-profile?focus=${r._id}`,
  }));
}

async function searchUsers(regex: RegExp, limit: number): Promise<ISearchHit[]> {
  const rows = await UserModel.find({
    $or: [{ name: regex }, { email: regex }, { phone: regex }, { studentId: regex }],
  })
    .select("name email phone studentId role roles")
    .limit(limit)
    .lean();
  return rows.map((r) => ({
    _id: String(r._id),
    type: "users",
    label: r.name || r.email || String(r._id),
    sub: [r.email, r.phone].filter(Boolean).join(" · "),
    badge:
      (r as { studentId?: string }).studentId || (Array.isArray(r.roles) ? r.roles[0] : undefined),
    url: `/users?focus=${r._id}`,
  }));
}

async function searchDepartments(regex: RegExp, limit: number): Promise<ISearchHit[]> {
  const rows = await DepartmentModel.find({
    $or: [{ name: regex }, { code: regex }, { shortName: regex }],
  })
    .select("name code shortName hodName")
    .limit(limit)
    .lean();
  return rows.map((r) => ({
    _id: String(r._id),
    type: "departments",
    label: r.name,
    sub: r.hodName ? `HOD: ${r.hodName}` : r.shortName,
    badge: r.code,
    url: `/department?focus=${r._id}`,
  }));
}

async function searchSubjects(regex: RegExp, limit: number): Promise<ISearchHit[]> {
  const rows = await SubjectModel.find({
    $or: [{ name: regex }, { code: regex }, { shortName: regex }],
  })
    .select("name code shortName departmentCode")
    .limit(limit)
    .lean();
  return rows.map((r) => ({
    _id: String(r._id),
    type: "subjects",
    label: r.name,
    sub: r.departmentCode,
    badge: r.code,
    url: `/subject?focus=${r._id}`,
  }));
}

async function searchNotices(regex: RegExp, limit: number): Promise<ISearchHit[]> {
  const rows = await NoticeModel.find({ title: regex })
    .select("title createdAt")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return rows.map((r) => ({
    _id: String(r._id),
    type: "notices",
    label: r.title,
    sub: r.createdAt ? formatIndiaDate(r.createdAt) : undefined,
    url: `/notice?focus=${r._id}`,
  }));
}

async function searchEvents(regex: RegExp, limit: number): Promise<ISearchHit[]> {
  const rows = await EventModel.find({ title: regex })
    .select("title startDate")
    .sort({ startDate: -1 })
    .limit(limit)
    .lean();
  return rows.map((r) => ({
    _id: String(r._id),
    type: "events",
    label: r.title,
    sub: (r as { startDate?: Date }).startDate
      ? formatIndiaDate((r as { startDate: Date }).startDate)
      : undefined,
    url: `/event?focus=${r._id}`,
  }));
}

const SEARCHERS: Record<TIndex, (regex: RegExp, limit: number) => Promise<ISearchHit[]>> = {
  students: searchStudents,
  faculty: searchFaculty,
  users: searchUsers,
  departments: searchDepartments,
  subjects: searchSubjects,
  notices: searchNotices,
  events: searchEvents,
};

router.get(
  "/",
  authenticate,
  [
    query("q").isString().trim().isLength({ min: 1 }).withMessage("Search query (q) is required"),
    query("index")
      .optional()
      .isIn(["all", ...ALL_INDEXES])
      .withMessage("Invalid index"),
    query("limit").optional().isInt({ min: 1, max: 50 }),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = (req.query.q as string).trim();
      const indexKey = (req.query.index as TIndex | "all" | undefined) ?? "all";
      const regex = new RegExp(escapeRegex(q), "i");

      if (indexKey === "all") {
        const limit = parseInt(req.query.limit as string) || 5;
        const entries = await Promise.all(
          ALL_INDEXES.map(async (idx) => [idx, await SEARCHERS[idx](regex, limit)] as const),
        );
        const grouped = Object.fromEntries(entries) as Record<TIndex, ISearchHit[]>;
        const total = Object.values(grouped).reduce((s, arr) => s + arr.length, 0);
        return res.json({ success: true, data: { grouped, total, query: q } });
      }

      const limit = parseInt(req.query.limit as string) || 15;
      const results = await SEARCHERS[indexKey](regex, limit);
      return res.json({ success: true, data: results });
    } catch (err) {
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /search/options?type=:type&q=:query&limit=:limit
//
// Returns a flat list of select-field options shaped as { value, label, sub? }
// for use in async dropdowns inside forms across the app.
//
// Supported types:
//   students, faculty, users, departments, subjects, curricula, programs,
//   sections, batches, academicYears, semesters
// ─────────────────────────────────────────────────────────────────────────────

type TOptionType =
  | "students"
  | "studentProfiles"
  | "faculty"
  | "users"
  | "departments"
  | "subjects"
  | "curricula"
  | "programs"
  | "sections"
  | "batches"
  | "academicYears"
  | "semesters"
  | "books"
  | "alumni"
  | "visitors"
  | "facilitySpaces"
  | "campuses"
  | "roles"
  | "feeRecords";

interface IOption {
  value: string;
  label: string;
  sub?: string;
  meta?: Record<string, string | number | boolean | null>;
}

async function optionsCampuses(regex: RegExp | null, limit: number): Promise<IOption[]> {
  const rows = await CampusModel.find({
    status: { $in: ["active", "planned"] },
    ...(regex ? { $or: [{ name: regex }, { code: regex }] } : {}),
  })
    .select("name code type status")
    .sort({ name: 1 })
    .limit(limit)
    .lean();
  return rows.map((campus) => ({
    value: String(campus._id),
    label: `${campus.code} · ${campus.name}`,
    sub: `${campus.type.replace(/_/g, " ")} · ${campus.status}`,
  }));
}

function exactOptionId(params?: Record<string, unknown>): string | null {
  const value = String(params?.["q"] ?? "");
  return isValidObjectId(value) ? value : null;
}

async function optionsStudents(
  regex: RegExp | null,
  limit: number,
  params?: Record<string, unknown>,
): Promise<IOption[]> {
  const exactId = exactOptionId(params);
  const filter: Record<string, unknown> = exactId
    ? { userId: exactId }
    : regex
      ? {
          $or: [
            { firstName: regex },
            { lastName: regex },
            { rollNumber: regex },
            { registrationNumber: regex },
          ],
        }
      : {};
  if (params?.["departmentId"]) filter["department"] = params["departmentId"];
  if (params?.["academicYear"]) filter["academicYear"] = params["academicYear"];
  if (params?.["_departmentScope"]) filter["department"] = params["_departmentScope"];
  if (params?.["assignedOnly"] && params?.["_facultyId"]) {
    const facultyId = String(params["_facultyId"]);
    const timetables = await TimetableModel.find({
      isApproved: true,
      isActive: true,
      "slots.facultyId": facultyId,
    })
      .select("sectionId academicYear program semester departmentId branchDepartmentIds slots")
      .lean();
    const directSectionIds = timetables
      .map((timetable) => timetable.sectionId)
      .filter((sectionId): sectionId is NonNullable<typeof sectionId> => Boolean(sectionId));
    const legacySectionFilters = timetables
      .filter((timetable) => !timetable.sectionId)
      .map((timetable) => {
        const facultySlots = timetable.slots.filter((slot) => String(slot.facultyId) === facultyId);
        const facultyDepartmentIds = [
          ...new Set(
            facultySlots
              .flatMap((slot) => [slot.branchDepartmentId, ...(slot.branchDepartmentIds ?? [])])
              .filter(Boolean)
              .map(String),
          ),
        ];
        const fallbackDepartmentIds = (
          timetable.branchDepartmentIds?.length
            ? timetable.branchDepartmentIds
            : [timetable.departmentId]
        ).map(String);
        return {
          academicYear: timetable.academicYear,
          program: timetable.program,
          semesterNo: timetable.semester,
          departmentId: {
            $in: facultyDepartmentIds.length ? facultyDepartmentIds : fallbackDepartmentIds,
          },
        };
      });
    const legacySectionIds = legacySectionFilters.length
      ? await SectionModel.find({ $or: legacySectionFilters }).distinct("_id")
      : [];
    const sectionIds = [
      ...new Set([...directSectionIds, ...legacySectionIds].map((sectionId) => String(sectionId))),
    ];
    const assignedStudentIds = sectionIds.length
      ? await StudentSectionAllotmentModel.find({
          sectionId: { $in: sectionIds },
          status: StudentSectionAllotmentStatus.ACTIVE,
        }).distinct("studentId")
      : [];
    const allowedUserIds = assignedStudentIds.map(String);
    if (exactId) {
      filter["userId"] = allowedUserIds.includes(exactId) ? exactId : { $in: [] };
    } else {
      filter["userId"] = { $in: allowedUserIds };
    }
  }
  const rows = await StudentProfileModel.find(filter)
    .select("userId firstName middleName lastName rollNumber program currentSemester")
    .limit(limit)
    .lean();
  return rows.map((r) => ({
    value: String(r.userId),
    label:
      [r.firstName, r.middleName, r.lastName].filter(Boolean).join(" ").trim() ||
      (r.rollNumber ?? String(r._id)),
    sub: [r.rollNumber, r.program, r.currentSemester ? `Sem ${r.currentSemester}` : null]
      .filter(Boolean)
      .join(" · "),
  }));
}

async function optionsStudentProfiles(
  regex: RegExp | null,
  limit: number,
  params?: Record<string, unknown>,
): Promise<IOption[]> {
  const exactId = exactOptionId(params);
  const filter: Record<string, unknown> = exactId
    ? { _id: exactId }
    : {
        ...(regex
          ? {
              $or: [
                { firstName: regex },
                { lastName: regex },
                { rollNumber: regex },
                { registrationNumber: regex },
              ],
            }
          : {}),
        ...(params?.departmentId ? { department: params.departmentId } : {}),
        ...(params?.academicYear ? { academicYear: params.academicYear } : {}),
        ...(params?.program ? { program: params.program } : {}),
      };
  if (params?.["_departmentScope"]) filter["department"] = params["_departmentScope"];
  if (params?.["assignedOnly"] && params?.["_facultyId"]) {
    const facultyId = String(params["_facultyId"]);
    const mentorAssignments = await MentorModel.find({ facultyId, isActive: true })
      .select("menteeIds")
      .lean();
    const assignedUserIds = [
      ...new Set(mentorAssignments.flatMap((assignment) => assignment.menteeIds.map(String))),
    ];
    const assignmentScope = {
      $or: [
        { mentor: facultyId },
        ...(assignedUserIds.length ? [{ userId: { $in: assignedUserIds } }] : []),
      ],
    };
    const searchScope = filter["$or"];
    if (searchScope) {
      delete filter["$or"];
      filter["$and"] = [{ $or: searchScope }, assignmentScope];
    } else {
      Object.assign(filter, assignmentScope);
    }
  }
  const rows = await StudentProfileModel.find(filter)
    .select("firstName middleName lastName rollNumber program currentSemester")
    .limit(limit)
    .lean();
  return rows.map((row) => ({
    value: String(row._id),
    label:
      [row.firstName, row.middleName, row.lastName].filter(Boolean).join(" ").trim() ||
      (row.rollNumber ?? String(row._id)),
    sub: [row.rollNumber, row.program, row.currentSemester ? `Sem ${row.currentSemester}` : null]
      .filter(Boolean)
      .join(" · "),
  }));
}

async function optionsFaculty(
  regex: RegExp | null,
  limit: number,
  params?: Record<string, unknown>,
): Promise<IOption[]> {
  const exactId = exactOptionId(params);
  const subjectId = String(params?.["subjectId"] ?? "");
  const academicYear = String(params?.["academicYear"] ?? "");
  const semesterType = String(params?.["semesterType"] ?? "");
  const semester = Number(params?.["semester"]);
  const program = String(params?.["program"] ?? "");
  const section = String(params?.["section"] ?? "")
    .trim()
    .toUpperCase();
  const canViewInstitutionFaculty =
    Boolean(params?.["includeAllTeachingFaculty"]) &&
    ["super_admin", "admin", "principal", "dean_academic"].includes(
      String(params?.["_activeRole"] ?? ""),
    );
  let eligibleFacultyIds: string[] | undefined;
  if (
    !canViewInstitutionFaculty &&
    isValidObjectId(subjectId) &&
    academicYear &&
    ["odd", "even"].includes(semesterType)
  ) {
    const workloadFilter: Record<string, unknown> = {
      academicYear,
      semesterType,
      isApproved: true,
      "teachingAssignments.subjectId": subjectId,
    };
    if (params?.["departmentId"]) workloadFilter["departmentId"] = params["departmentId"];
    const workloads = await FacultyWorkloadModel.find(workloadFilter)
      .select("facultyId teachingAssignments")
      .lean();
    eligibleFacultyIds = workloads
      .filter((workload) =>
        workload.teachingAssignments.some(
          (assignment) =>
            assignment.subjectId.toString() === subjectId &&
            (!program || assignment.program === program) &&
            (!semester || assignment.semester === semester) &&
            (!section || assignment.section.trim().toUpperCase() === section),
        ),
      )
      .map((workload) => workload.facultyId.toString());
  }
  const filter: Record<string, unknown> = exactId
    ? { userId: exactId, status: "active" }
    : regex
      ? {
          status: "active",
          $or: [{ firstName: regex }, { lastName: regex }, { employeeId: regex }],
        }
      : { status: "active" };
  if (eligibleFacultyIds) {
    if (exactId && !eligibleFacultyIds.includes(exactId)) return [];
    if (!exactId) filter["userId"] = { $in: eligibleFacultyIds };
  }
  if (!canViewInstitutionFaculty && params?.["departmentId"])
    filter["department"] = params["departmentId"];
  if (!canViewInstitutionFaculty && params?.["program"]) filter["program"] = params["program"];
  const rows = await FacultyProfileModel.find(filter)
    .select("userId firstName lastName employeeId designation department")
    .populate("department", "name code")
    .limit(limit)
    .lean();
  const day = String(params?.["day"] ?? "");
  const startTime = String(params?.["startTime"] ?? "");
  const endTime = String(params?.["endTime"] ?? "");
  const candidateFacultyIds = rows.map((row) => String(row.userId));
  const busyByFaculty = new Map<string, string>();
  if (
    candidateFacultyIds.length &&
    day &&
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime) &&
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(endTime)
  ) {
    const timetableFilter: Record<string, unknown> = {
      isActive: true,
      ...(academicYear ? { academicYear } : {}),
      ...(semesterType ? { semesterType } : {}),
      "slots.facultyId": { $in: candidateFacultyIds },
      "slots.day": day,
    };
    if (isValidObjectId(String(params?.["excludeTimetableId"] ?? ""))) {
      timetableFilter["_id"] = { $ne: params?.["excludeTimetableId"] };
    }
    const timetables = await TimetableModel.find(timetableFilter)
      .select("program semester section slots")
      .lean();
    const minutes = (value: string) => {
      const [hour, minute] = value.split(":").map(Number);
      return hour * 60 + minute;
    };
    for (const timetable of timetables) {
      for (const slot of timetable.slots) {
        const facultyId = String(slot.facultyId ?? "");
        if (
          candidateFacultyIds.includes(facultyId) &&
          slot.day === day &&
          minutes(startTime) < minutes(slot.endTime) &&
          minutes(slot.startTime) < minutes(endTime)
        ) {
          busyByFaculty.set(
            facultyId,
            `Busy ${slot.startTime}–${slot.endTime} · ${timetable.program} Sem ${timetable.semester}${timetable.section ? ` ${timetable.section}` : ""}`,
          );
        }
      }
    }
  }
  return rows.map((r) => {
    const department = r.department as unknown as { name?: string; code?: string } | null;
    const designationLabel = String(r.designation ?? "")
      .split("_")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
    return {
      value: String(r.userId),
      label: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || (r.employeeId ?? String(r._id)),
      sub: [r.employeeId, busyByFaculty.get(String(r.userId))].filter(Boolean).join(" · "),
      meta: {
        busy: busyByFaculty.has(String(r.userId)),
        busyReason: busyByFaculty.get(String(r.userId)) ?? "",
        branchCode: department?.code ?? "",
        branchName: department?.name ?? "",
        designationLabel,
      },
    };
  });
}

async function optionsVisitors(regex: RegExp | null, limit: number): Promise<IOption[]> {
  const filter = regex
    ? {
        $or: [
          { visitorName: regex },
          { visitorPhone: regex },
          { passNumber: regex },
          { purpose: regex },
        ],
      }
    : {};
  const rows = await GatePassModel.find(filter)
    .select("visitorName visitorPhone passNumber purpose checkInTime")
    .sort({ checkInTime: -1 })
    .limit(limit)
    .lean();
  return rows.map((row) => ({
    value: String(row._id),
    label: row.visitorName,
    sub: [row.passNumber, row.visitorPhone, row.purpose].filter(Boolean).join(" · "),
  }));
}

async function optionsFacilitySpaces(
  regex: RegExp | null,
  limit: number,
  params?: Record<string, unknown>,
): Promise<IOption[]> {
  const exactId = exactOptionId(params);
  const filter: Record<string, unknown> = exactId
    ? { _id: exactId }
    : {
        status: "active",
        ...(params?.["campusId"] ? { campusId: params["campusId"] } : {}),
        ...(params?.["spaceType"] ? { type: params["spaceType"] } : {}),
        ...(regex ? { $or: [{ code: regex }, { name: regex }, { building: regex }] } : {}),
      };
  const rows = await FacilitySpaceModel.find(filter)
    .select("code name building floor type capacity")
    .sort({ building: 1, code: 1 })
    .limit(limit)
    .lean();
  return rows.map((space) => ({
    value: String(space._id),
    label: `${space.code} — ${space.name}`,
    sub: [space.building, space.floor, space.type, `${space.capacity} seats`]
      .filter(Boolean)
      .join(" · "),
  }));
}

async function optionsUsers(
  regex: RegExp | null,
  limit: number,
  params?: Record<string, unknown>,
): Promise<IOption[]> {
  const exactId = exactOptionId(params);
  const filter: Record<string, unknown> = exactId
    ? { _id: exactId }
    : regex
      ? { $or: [{ name: regex }, { email: regex }] }
      : {};
  if (params?.["_departmentScope"]) filter["department"] = params["_departmentScope"];
  const excludedRoles = params?.["excludeRoles"]
    ? String(params["excludeRoles"])
        .split(",")
        .map((role) => role.trim())
        .filter(Boolean)
    : [];
  if (params?.["_activeRole"] !== SystemRole.SUPER_ADMIN) {
    excludedRoles.push(SystemRole.SUPER_ADMIN);
  }
  if (excludedRoles.length) filter["roles"] = { $nin: [...new Set(excludedRoles)] };
  const rows = await UserModel.find(filter).select("name email roles").limit(limit).lean();
  return rows.map((r) => ({
    value: String(r._id),
    label: r.name || r.email || String(r._id),
    sub: [r.email, r.roles?.[0]].filter(Boolean).join(" · "),
  }));
}

async function optionsDepartments(
  regex: RegExp | null,
  limit: number,
  params?: Record<string, unknown>,
): Promise<IOption[]> {
  const exactId = exactOptionId(params);
  const departmentScope = String(params?.["_departmentScope"] ?? "");
  if (exactId && departmentScope && exactId !== departmentScope) return [];
  const filter: Record<string, unknown> = exactId
    ? { _id: exactId }
    : regex
      ? { $or: [{ name: regex }, { code: regex }] }
      : {};
  if (departmentScope) filter["_id"] = departmentScope;
  if (params?.["curriculumId"]) filter["curriculumIds"] = params["curriculumId"];
  if (params?.["departmentIds"]) {
    const departmentIds = String(params["departmentIds"])
      .split(",")
      .map((value) => value.trim())
      .filter(isValidObjectId);
    if (departmentIds.length) filter["_id"] = { $in: departmentIds };
  }
  if (params?.["program"]) {
    const program = String(params["program"]).trim();
    const curriculumFilter: Record<string, unknown> = {
      program,
      isActive: true,
      ...(params["admissionOnly"] ? { openForAdmissions: true } : {}),
    };
    if (params["academicYear"]) {
      const startYear = parseInt(String(params["academicYear"]).split("-")[0], 10);
      if (!isNaN(startYear)) {
        curriculumFilter["regulationYear"] = startYear;
      }
    }
    const curriculumIds = await CurriculumModel.find(curriculumFilter).distinct("_id");
    filter["status"] = DepartmentStatus.ACTIVE;
    filter["$and"] = [
      {
        $or: [{ programs: program }, { curriculumIds: { $in: curriculumIds } }],
      },
    ];
  }
  const rows = await DepartmentModel.find(filter).select("name code").limit(limit).lean();
  return rows.map((r) => ({
    value: String(r._id),
    label: r.name,
    sub: r.code,
    meta: { code: r.code },
  }));
}

async function optionsSubjects(
  regex: RegExp | null,
  limit: number,
  params?: Record<string, unknown>,
): Promise<IOption[]> {
  const exactId = exactOptionId(params);
  const filter: Record<string, unknown> = exactId
    ? { _id: exactId }
    : regex
      ? { $or: [{ name: regex }, { code: regex }] }
      : {};
  if (!exactId) filter["isActive"] = true;
  if (params?.["departmentId"]) filter["departmentId"] = params["departmentId"];
  if (params?.["departmentIds"]) {
    const departmentIds = String(params["departmentIds"])
      .split(",")
      .map((value) => value.trim())
      .filter(isValidObjectId);
    if (departmentIds.length) filter["departmentId"] = { $in: departmentIds };
  }
  let curriculumId = params?.["curriculumId"];
  let semesterNo = params?.["semesterNo"];
  const program = params?.["program"] ? String(params["program"]).trim() : "";

  if (program) {
    // If a specific program is selected (e.g., MBA, MCA, B.Tech), find active curricula for that program
    const curriculumFilter: Record<string, unknown> = { program, isActive: true };
    const currs = await CurriculumModel.find(curriculumFilter)
      .select("semesterPlans departmentId")
      .lean();
    const currIds = currs.map((c) => String(c._id));
    const deptIdsForProgram = await DepartmentModel.find({
      $or: [{ programs: program }, { curriculumIds: { $in: currIds } }],
    }).distinct("_id");

    if (currs.length > 0) {
      const allSubjectIds = currs.flatMap((c) =>
        (c.semesterPlans ?? [])
          .filter((p) => !semesterNo || p.semesterNo === Number(semesterNo))
          .flatMap((p) => (p.subjects ?? []).map((s) => s.subjectId)),
      );
      if (allSubjectIds.length > 0) {
        filter["$or"] = [
          { _id: { $in: allSubjectIds } },
          { departmentId: { $in: deptIdsForProgram } },
        ];
      } else if (deptIdsForProgram.length > 0) {
        filter["departmentId"] = { $in: deptIdsForProgram };
      }
    } else if (deptIdsForProgram.length > 0) {
      filter["departmentId"] = { $in: deptIdsForProgram };
    }
  }

  if (params?.["sectionId"]) {
    const section = await SectionModel.findById(String(params["sectionId"]))
      .select("curriculumId semesterNo departmentId")
      .lean();
    curriculumId = section?.curriculumId;
    semesterNo = section?.semesterNo;
  }
  if (curriculumId && semesterNo) {
    const curriculum = await CurriculumModel.findById(String(curriculumId))
      .select("semesterPlans")
      .lean();
    const plan = curriculum?.semesterPlans?.find((item) => item.semesterNo === Number(semesterNo));
    filter["_id"] = { $in: (plan?.subjects ?? []).map((item) => item.subjectId) };
    if (params?.["_facultyId"] && params?.["sectionId"]) {
      const section = await SectionModel.findById(String(params["sectionId"]))
        .select("academicYear program semesterNo departmentId")
        .lean();
      const timetables = await TimetableModel.find({
        isApproved: true,
        isActive: true,
        "slots.facultyId": String(params["_facultyId"]),
        $or: [
          { sectionId: String(params["sectionId"]) },
          ...(section
            ? [
                {
                  sectionId: { $exists: false },
                  academicYear: section.academicYear,
                  program: section.program,
                  semester: section.semesterNo,
                  $or: [
                    { departmentId: section.departmentId },
                    { branchDepartmentIds: section.departmentId },
                    { "slots.branchDepartmentId": section.departmentId },
                    { "slots.branchDepartmentIds": section.departmentId },
                  ],
                },
              ]
            : []),
        ],
      })
        .select("slots")
        .lean();
      const assignedIds = new Set(
        timetables.flatMap((timetable) =>
          timetable.slots
            .filter((slot) => String(slot.facultyId) === String(params["_facultyId"]))
            .map((slot) => String(slot.subjectId)),
        ),
      );
      const plannedIds = (plan?.subjects ?? []).map((item) => String(item.subjectId));
      filter["_id"] = { $in: plannedIds.filter((id) => assignedIds.has(id)) };
    }
  } else if (curriculumId) {
    const departmentIds = await DepartmentModel.find({
      curriculumIds: String(curriculumId),
    }).distinct("_id");
    filter["departmentId"] = { $in: departmentIds };
  }
  if (params?.["assignedOnly"] && params?.["_facultyId"] && !params?.["sectionId"]) {
    const facultyId = String(params["_facultyId"]);
    const timetables = await TimetableModel.find({
      isApproved: true,
      isActive: true,
      "slots.facultyId": facultyId,
    })
      .select("slots")
      .lean();
    const assignedSubjectIds = [
      ...new Set(
        timetables.flatMap((timetable) =>
          timetable.slots
            .filter((slot) => String(slot.facultyId) === facultyId)
            .map((slot) => String(slot.subjectId)),
        ),
      ),
    ];
    const existingIdFilter = filter["_id"];
    if (typeof existingIdFilter === "string") {
      filter["_id"] = assignedSubjectIds.includes(existingIdFilter)
        ? existingIdFilter
        : { $in: [] };
    } else if (
      existingIdFilter &&
      typeof existingIdFilter === "object" &&
      "$in" in existingIdFilter
    ) {
      const plannedIds = (existingIdFilter as { $in: unknown[] }).$in.map(String);
      filter["_id"] = {
        $in: assignedSubjectIds.filter((subjectId) => plannedIds.includes(subjectId)),
      };
    } else {
      filter["_id"] = { $in: assignedSubjectIds };
    }
  }
  const rows = await SubjectModel.find(filter)
    .select("name shortName code departmentCode")
    .limit(limit)
    .lean();
  return rows.map((r) => ({
    value: String(r._id),
    label: r.name,
    sub: [r.code, r.departmentCode].filter(Boolean).join(" · "),
    meta: { shortName: r.shortName },
  }));
}

async function optionsCurricula(
  regex: RegExp | null,
  limit: number,
  params?: Record<string, unknown>,
): Promise<IOption[]> {
  const exactId = exactOptionId(params);
  const filter: Record<string, unknown> = exactId
    ? { _id: exactId }
    : regex
      ? { program: regex }
      : {};
  const departmentScope = String(params?.["_departmentScope"] ?? "");
  if (departmentScope) {
    const department = await DepartmentModel.findById(departmentScope)
      .select("curriculumIds")
      .lean();
    const curriculumIds = (department?.curriculumIds ?? []).map(String);
    if (exactId && !curriculumIds.includes(exactId)) return [];
    filter["_id"] = exactId || { $in: curriculumIds };
  }
  const rows = await CurriculumModel.find({ ...filter, isActive: true })
    .select("program regulationYear totalSemesters")
    .sort({ program: 1, regulationYear: -1 })
    .limit(limit)
    .lean();
  return rows.map((r) => ({
    value: String(r._id),
    label: r.program,
    sub: [`Reg ${r.regulationYear}`, `${r.totalSemesters} sem`].filter(Boolean).join(" · "),
  }));
}

async function optionsSections(
  regex: RegExp | null,
  limit: number,
  params?: Record<string, unknown>,
): Promise<IOption[]> {
  const exactId = exactOptionId(params);
  const filter: Record<string, unknown> = exactId ? { _id: exactId } : {};
  if (regex && !exactId) {
    filter["$or"] = [
      { sectionName: regex },
      { program: regex },
      { departmentCode: regex },
      { academicYear: regex },
    ];
  }
  if (params?.["academicYear"]) filter["academicYear"] = params["academicYear"];
  if (params?.["batchId"]) filter["batchId"] = params["batchId"];
  if (params?.["departmentId"]) filter["departmentId"] = params["departmentId"];
  if (params?.["departmentIds"]) {
    const departmentIds = String(params["departmentIds"])
      .split(",")
      .map((value) => value.trim())
      .filter(isValidObjectId);
    if (departmentIds.length) filter["departmentId"] = { $in: departmentIds };
  }
  if (params?.["program"]) filter["program"] = params["program"];
  if (params?.["semesterNo"] || params?.["semester"]) {
    filter["semesterNo"] = Number(params["semesterNo"] || params["semester"]);
  }
  if (params?.["_facultyId"] && !exactId) {
    const facultyTimetables = await TimetableModel.find({
      isApproved: true,
      isActive: true,
      "slots.facultyId": String(params["_facultyId"]),
    })
      .select(
        "sectionId academicYear program semester departmentId branchDepartmentIds slots.facultyId slots.branchDepartmentId slots.branchDepartmentIds",
      )
      .lean();
    const assignedSectionIds = facultyTimetables
      .map((timetable) => timetable.sectionId)
      .filter(Boolean);
    const cohortScopes = facultyTimetables.flatMap((timetable) => {
      if (timetable.sectionId) return [];
      const facultySlots = timetable.slots.filter(
        (slot) => String(slot.facultyId ?? "") === String(params["_facultyId"]),
      );
      const departmentIds = [
        timetable.departmentId,
        ...(timetable.branchDepartmentIds ?? []),
        ...facultySlots.flatMap((slot) => [
          slot.branchDepartmentId,
          ...(slot.branchDepartmentIds ?? []),
        ]),
      ]
        .filter(Boolean)
        .map(String);
      return [...new Set(departmentIds)].map((departmentId) => ({
        academicYear: timetable.academicYear,
        program: timetable.program,
        semesterNo: timetable.semester,
        departmentId,
        status: "Active",
      }));
    });
    filter["$and"] = [
      ...(Array.isArray(filter["$and"]) ? (filter["$and"] as Record<string, unknown>[]) : []),
      {
        $or: [
          ...(assignedSectionIds.length ? [{ _id: { $in: assignedSectionIds } }] : []),
          ...cohortScopes,
        ],
      },
    ];
  }

  const rows = await SectionModel.find(filter)
    .select(
      "sectionName academicYear semesterNo program departmentCode departmentId batchId curriculumId status",
    )
    .sort({ academicYear: -1, departmentCode: 1, semesterNo: 1, sectionName: 1 })
    .limit(limit)
    .lean();

  return rows.map((r) => ({
    value: params?.["valueMode"] === "name" ? r.sectionName : String(r._id),
    label: `${r.departmentCode} · Semester ${r.semesterNo} · Section ${r.sectionName}`,
    sub: `${r.program} · ${r.academicYear}`,
    meta: {
      academicYear: r.academicYear,
      semesterNo: r.semesterNo,
      semesterType: r.semesterNo % 2 === 0 ? "even" : "odd",
      program: r.program,
      departmentCode: r.departmentCode,
      departmentId: String(r.departmentId),
      batchId: String(r.batchId),
      curriculumId: String(r.curriculumId),
      sectionName: r.sectionName,
      shortLabel: `${r.departmentCode} · Sem ${r.semesterNo} · ${r.sectionName}`,
      status: r.status,
    },
  }));
}

async function optionsBatches(
  regex: RegExp | null,
  limit: number,
  params?: Record<string, unknown>,
): Promise<IOption[]> {
  const exactId = exactOptionId(params);
  const wantsMaster =
    exactId ||
    params?.["master"] ||
    params?.["curriculumId"] ||
    params?.["departmentId"] ||
    params?.["admissionYear"];
  if (!wantsMaster) {
    const values = (await StudentProfileModel.distinct(
      "batch",
      params?.["_departmentScope"] ? { department: params["_departmentScope"] } : {},
    )) as (string | null)[];
    return values
      .filter((v): v is string => !!v && (!regex || regex.test(v)))
      .sort()
      .reverse()
      .slice(0, limit)
      .map((v) => {
        const year = Number(v);
        const label = /^\d{4}$/.test(v)
          ? `${year}-${String(year + 1).slice(-2)} Batch`
          : `${v} Batch`;
        return { value: v, label };
      });
  }

  const filter: Record<string, unknown> = exactId ? { _id: exactId } : regex ? { name: regex } : {};
  if (params?.["curriculumId"]) filter["curriculumId"] = params["curriculumId"];
  if (params?.["departmentId"]) filter["departmentId"] = params["departmentId"];
  if (params?.["admissionYear"]) filter["admissionYear"] = Number(params["admissionYear"]);
  if (params?.["program"]) filter["program"] = params["program"];

  const rows = await BatchModel.find(filter)
    .select("name program departmentCode admissionYear regulationYear status curriculumId")
    .populate("curriculumId", "totalSemesters")
    .sort({ admissionYear: -1, departmentCode: 1 })
    .limit(limit)
    .lean();
  return rows.map((r) => {
    const year = Number(r.admissionYear);
    const academicYear = `${year}-${String(year + 1).slice(-2)}`;
    const baseName = String(r.name || `${r.program} ${r.departmentCode}`).replace(
      /\s\d{4}(?:-\d{2})?$/,
      "",
    );
    const curriculumObj = r.curriculumId as unknown as { totalSemesters?: number } | null;
    return {
      value: params?.["valueMode"] === "year" ? String(r.admissionYear) : String(r._id),
      label: `${baseName} ${academicYear}`,
      sub: [`Reg ${r.regulationYear}`, r.status].filter(Boolean).join(" · "),
      meta: {
        totalSemesters: curriculumObj?.totalSemesters ?? 8,
        admissionYear: r.admissionYear,
      },
    };
  });
}

async function optionsAcademicYears(
  regex: RegExp | null,
  limit: number,
  params?: Record<string, unknown>,
): Promise<IOption[]> {
  const departmentScope = params?.["_departmentScope"];
  const studentFilter = departmentScope ? { department: departmentScope } : {};
  const structureFilter = departmentScope ? { departmentId: departmentScope } : {};
  const [studentYears, sectionYears, admissionYears, batchYears] = await Promise.all([
    StudentProfileModel.distinct("academicYear", studentFilter),
    SectionModel.distinct("academicYear", structureFilter),
    AdmissionApplicationModel.distinct("academicYear"),
    BatchModel.distinct("admissionYear", structureFilter),
  ]);
  const values = new Set<string>();
  for (const value of [...studentYears, ...sectionYears, ...admissionYears]) {
    if (value) values.add(String(value));
  }
  for (const value of batchYears) {
    const year = Number(value);
    if (year) values.add(`${year}-${String(year + 1).slice(-2)}`);
  }
  const now = new Date();
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  values.add(`${start}-${String(start + 1).slice(-2)}`);
  values.add(`${start + 1}-${String(start + 2).slice(-2)}`);
  const currentAcademicYear = `${start}-${String(start + 1).slice(-2)}`;
  return [...values]
    .filter((v): v is string => !!v && (!regex || regex.test(v)))
    .sort((left, right) => {
      if (left === currentAcademicYear) return -1;
      if (right === currentAcademicYear) return 1;
      return right.localeCompare(left);
    })
    .slice(0, limit)
    .map((v) => ({ value: v, label: v }));
}

async function optionsPrograms(
  regex: RegExp | null,
  limit: number,
  params?: Record<string, unknown>,
): Promise<IOption[]> {
  const filter: Record<string, unknown> = {
    isActive: true,
    ...(params?.["admissionOnly"]
      ? {
          openForAdmissions: true,
          academicLevel: {
            $in: ["certificate", "diploma", "undergraduate", "postgraduate", "doctoral"],
          },
        }
      : {}),
    ...(regex ? { program: regex } : {}),
  };
  const departmentScope = String(params?.["_departmentScope"] ?? "");
  if (departmentScope) {
    const department = await DepartmentModel.findById(departmentScope)
      .select("curriculumIds")
      .lean();
    filter["_id"] = { $in: department?.curriculumIds ?? [] };
  }
  if (params?.["academicYear"]) {
    const startYear = parseInt(String(params["academicYear"]).split("-")[0], 10);
    if (!isNaN(startYear)) {
      filter["regulationYear"] = startYear;
    }
  }
  const rows = await CurriculumModel.find(filter)
    .select("program academicLevel regulationYear")
    .sort({ program: 1, regulationYear: -1 })
    .lean();
  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latest.has(row.program)) latest.set(row.program, row);
  }
  return [...latest.values()].slice(0, limit).map((row) => ({
    value: row.program,
    label: row.program,
    sub: row.academicLevel.replace("_", " "),
    meta: {
      regularAdmissionCode: deriveStudentAdmissionCode(row.program, "regular"),
      lateralAdmissionCode: deriveStudentAdmissionCode(row.program, "lateral_entry"),
    },
  }));
}

async function optionsSemesters(
  regex: RegExp | null,
  limit: number,
  params?: Record<string, unknown>,
): Promise<IOption[]> {
  if (params?.["configured"]) {
    const sectionFilter: Record<string, unknown> = {};
    if (params["curriculumId"]) sectionFilter["curriculumId"] = params["curriculumId"];
    if (params["departmentId"]) sectionFilter["departmentId"] = params["departmentId"];
    if (params["departmentIds"]) {
      const departmentIds = String(params["departmentIds"])
        .split(",")
        .map((value) => value.trim())
        .filter(isValidObjectId);
      if (departmentIds.length) sectionFilter["departmentId"] = { $in: departmentIds };
    }
    if (params["academicYear"]) sectionFilter["academicYear"] = params["academicYear"];
    if (params["program"]) sectionFilter["program"] = params["program"];

    const semesterNumbers = (await SectionModel.distinct("semesterNo", sectionFilter))
      .map(Number)
      .filter((semester) => Number.isInteger(semester) && semester >= 1 && semester <= 12)
      .sort((left, right) => left - right);

    return semesterNumbers
      .map((semester) => ({
        value: String(semester),
        label: `Semester ${semester}`,
        sub: semester % 2 === 0 ? "Even semester" : "Odd semester",
      }))
      .filter((option) => !regex || regex.test(option.label) || regex.test(option.value))
      .slice(0, limit);
  }

  if (params?.["curriculumId"]) {
    const curriculum = await CurriculumModel.findById(String(params["curriculumId"]))
      .select("totalSemesters")
      .lean();
    if (curriculum?.totalSemesters) {
      return Array.from({ length: curriculum.totalSemesters }, (_, i) => i + 1)
        .map((n) => ({
          value: String(n),
          label: `Semester ${n}`,
          sub: n % 2 === 0 ? "Even semester" : "Odd semester",
        }))
        .filter((o) => !regex || regex.test(o.label) || regex.test(o.value))
        .slice(0, limit);
    }
  }

  // Default 8 standard semesters with Odd/Even sub-labels
  return Array.from({ length: 8 }, (_, i) => i + 1)
    .map((n) => ({
      value: String(n),
      label: `Semester ${n}`,
      sub: n % 2 === 0 ? "Even semester" : "Odd semester",
    }))
    .filter((o) => !regex || regex.test(o.label) || regex.test(o.value))
    .slice(0, limit);
}

async function optionsBooks(
  regex: RegExp | null,
  limit: number,
  params?: Record<string, unknown>,
): Promise<IOption[]> {
  const exactId = exactOptionId(params);
  const filter: Record<string, unknown> = exactId
    ? { _id: exactId }
    : {
        isActive: true,
        isDigital: false,
        availableCopies: { $gt: 0 },
        ...(regex ? { $or: [{ title: regex }, { isbn: regex }, { authors: regex }] } : {}),
      };
  const rows = await BookModel.find(filter)
    .select("title isbn authors availableCopies shelfLocation")
    .sort({ title: 1 })
    .limit(limit)
    .lean();
  return rows.map((book) => ({
    value: String(book._id),
    label: book.title,
    sub: [book.isbn, book.authors.join(", "), `${book.availableCopies} available`]
      .filter(Boolean)
      .join(" · "),
  }));
}

async function optionsAlumni(
  regex: RegExp | null,
  limit: number,
  params?: Record<string, unknown>,
): Promise<IOption[]> {
  const exactId = exactOptionId(params);
  const filter: Record<string, unknown> = exactId
    ? { _id: exactId }
    : {
        isVerified: true,
        ...(regex ? { $or: [{ fullName: regex }, { email: regex }, { rollNumber: regex }] } : {}),
      };
  const rows = await AlumniModel.find(filter)
    .select("fullName email rollNumber program passoutYear")
    .sort({ fullName: 1 })
    .limit(limit)
    .lean();
  return rows.map((alumni) => ({
    value: String(alumni._id),
    label: alumni.fullName,
    sub: [alumni.rollNumber, alumni.program, alumni.passoutYear].filter(Boolean).join(" · "),
  }));
}

async function optionsRoles(
  regex: RegExp | null,
  limit: number,
  params?: Record<string, unknown>,
): Promise<IOption[]> {
  const filter: Record<string, unknown> = {
    isActive: true,
    ...(regex ? { $or: [{ name: regex }, { displayName: regex }] } : {}),
  };
  if (params?.["standaloneOnly"]) {
    // Student, Parent, Faculty and HOD identities require domain-aware
    // onboarding. Administrative and non-teaching accounts are created here,
    // then may be linked to an HR employment record without duplicating users.
    filter["name"] = {
      $nin: [SystemRole.STUDENT, SystemRole.PARENT, SystemRole.FACULTY, SystemRole.HOD],
    };
  }
  if (params?.["category"] === "teaching") {
    filter["name"] = { $in: ["faculty", "hod", "principal", "dean_academic"] };
  } else if (params?.["category"] === "non_teaching") {
    filter["name"] = {
      $in: [
        "hostel_warden",
        "accounts_department",
        "hr_department",
        "library_staff",
        "transportation",
        "placement_cell",
        "examination_cell",
        "scholarship_cell",
        "administration_office",
        "store",
        "security",
        "lab_assistant",
      ],
    };
  }
  const rows = await RoleModel.find(filter)
    .select("name displayName description")
    .sort({ displayName: 1 })
    .limit(limit)
    .lean();
  return rows.map((role) => {
    const rawName = role.name || "";
    const prettyName = rawName
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    return {
      value: role.name,
      label: role.displayName || prettyName,
      sub: role.description || `System role: ${prettyName}`,
    };
  });
}

async function optionsFeeRecords(
  regex: RegExp | null,
  limit: number,
  params?: Record<string, unknown>,
): Promise<IOption[]> {
  const exactId = exactOptionId(params);
  const filter: Record<string, unknown> = exactId
    ? { _id: exactId }
    : regex
      ? {
          $or: [{ invoiceNumber: regex }, { studentName: regex }, { rollNumber: regex }],
        }
      : {};
  if (params?.["outstandingOnly"] === "true") {
    filter["balanceDue"] = { $gt: 0 };
  }
  const rows = await FeeRecordModel.find(filter)
    .select("invoiceNumber studentName rollNumber balanceDue transactions")
    .limit(limit)
    .lean();
  return rows.map((r) => ({
    value: String(r._id),
    label: `${r.invoiceNumber} · ${r.studentName} · ₹${r.balanceDue} due`,
    sub: r.rollNumber,
    meta: {
      balanceDue: r.balanceDue,
      transactions: JSON.stringify(r.transactions ?? []),
    },
  }));
}

const OPTION_LOADERS: Record<
  TOptionType,
  (
    regex: RegExp | null,
    limit: number,
    params?: Record<string, unknown>,
  ) => Promise<IOption[]> | IOption[]
> = {
  students: optionsStudents,
  studentProfiles: optionsStudentProfiles,
  faculty: optionsFaculty,
  users: optionsUsers,
  departments: optionsDepartments,
  subjects: optionsSubjects,
  curricula: optionsCurricula,
  sections: optionsSections,
  batches: optionsBatches,
  academicYears: optionsAcademicYears,
  programs: optionsPrograms,
  semesters: optionsSemesters,
  books: optionsBooks,
  alumni: optionsAlumni,
  visitors: optionsVisitors,
  facilitySpaces: optionsFacilitySpaces,
  campuses: optionsCampuses,
  roles: optionsRoles,
  feeRecords: optionsFeeRecords,
};

router.get(
  "/options",
  authenticate,
  [
    query("type")
      .isIn(Object.keys(OPTION_LOADERS))
      .withMessage(`type must be one of: ${Object.keys(OPTION_LOADERS).join(", ")}`),
    query("q").optional().isString().trim(),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const type = req.query.type as TOptionType;
      const q = ((req.query.q as string) || "").trim();
      const limit = parseInt(req.query.limit as string) || 20;
      const regex = q ? new RegExp(escapeRegex(q), "i") : null;

      const optionParams: Record<string, unknown> = { ...req.query };
      optionParams["_activeRole"] = req.activeRole;
      const requestsAssignmentScope = String(req.query["assignedOnly"] ?? "") === "true";
      const authenticatedAsTeachingStaff =
        [SystemRole.HOD, SystemRole.FACULTY].includes(req.activeRole as SystemRole) ||
        req.user?.roles.some((role) =>
          [SystemRole.HOD, SystemRole.FACULTY].includes(role as SystemRole),
        );
      if (
        req.user &&
        (req.activeRole === SystemRole.FACULTY ||
          (requestsAssignmentScope && authenticatedAsTeachingStaff))
      ) {
        optionParams["_facultyId"] = req.user._id.toString();
      }
      if (req.activeRole === SystemRole.HOD) {
        const departmentScope = await getDepartmentScope(req);
        optionParams["_departmentScope"] = departmentScope;
        optionParams["departmentId"] = departmentScope;
        delete optionParams["departmentIds"];
      }
      const data = await OPTION_LOADERS[type](regex, limit, optionParams);
      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
);

export default router;

import createError from "http-errors";
import { Types } from "mongoose";
import {
  curriculumRepository,
  departmentRepository,
  studentProfileRepository,
  studentSectionAllotmentRepository,
} from "../repositories";
import { semesterRegistrationRepository } from "../repositories/semester-registration.repository";
import type { ISubjectRegistrationItem } from "../models/semester-registration.model";
import { RegistrationStatus, RegistrationSubjectType } from "../models/semester-registration.model";
import { notifyUsers, notifyByPermission } from "./helpers/notify.helper";
import { NotificationType } from "../models/notification.model";
import { EmailTemplate } from "../email/email.service";
import { Module, PermissionAction } from "../constants/permissions";
import { FeeRecordModel, SemesterResultModel, StudentStatus } from "../models";

// ─── Credit limit constants ───────────────────────────────────────────────────
const MIN_CREDITS = 12; // Absolute minimum (backlog-heavy scenario)
const MAX_CREDITS = 30; // BPUT / UGC standard maximum

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function calcCredits(subjects: ISubjectRegistrationItem[]): number {
  return subjects.reduce((sum, s) => sum + s.credits, 0);
}

export function canEditRegistrationAt(
  now: Date,
  window: { opensAt: Date; closesAt: Date; addDropEndsAt: Date },
  existingStatus?: RegistrationStatus,
) {
  if (now < new Date(window.opensAt)) return false;
  const deadline =
    existingStatus === RegistrationStatus.APPROVED ||
    existingStatus === RegistrationStatus.REJECTED ||
    existingStatus === RegistrationStatus.WITHDRAWN
      ? new Date(window.addDropEndsAt)
      : new Date(window.closesAt);
  return now <= deadline;
}

async function buildRegistrationContext(
  studentId: string,
  payload: {
    rollNumber?: string;
    studentName?: string;
    program?: string;
    branch?: string;
    departmentId?: string;
    targetSemester: number;
    academicYear: string;
    registeredSubjects?: ISubjectRegistrationItem[];
  },
) {
  const profile = await studentProfileRepository.findByUserId(studentId);
  if (!profile || profile.status !== StudentStatus.ACTIVE) {
    throw createError(403, "An active student profile is required for semester registration");
  }
  if (profile.currentSemester !== payload.targetSemester) {
    throw createError(
      400,
      `Registration is allowed only for the student's current semester (${profile.currentSemester})`,
    );
  }
  const allotment = await studentSectionAllotmentRepository.findActiveForStudentSemester(
    studentId,
    payload.academicYear,
    payload.targetSemester,
  );
  if (!allotment) {
    throw createError(400, "Student must be allotted to a section for this semester/year first");
  }

  const curriculum = allotment.curriculumId
    ? await curriculumRepository.findById(allotment.curriculumId.toString())
    : null;
  if (!curriculum) throw createError(404, "Curriculum not found for active allotment");
  const plan = curriculum.semesterPlans?.find((p) => p.semesterNo === payload.targetSemester);
  if (!plan) {
    throw createError(400, "Curriculum semester plan is not configured for this semester");
  }

  let registeredSubjects = payload.registeredSubjects ?? [];
  if (!registeredSubjects.length) {
    if ((plan.subjects ?? []).some((subject) => subject.isElective)) {
      throw createError(400, "Elective selections are required for this semester");
    }
    registeredSubjects = (plan.subjects ?? []).map((s) => ({
      subjectId: new Types.ObjectId(s.subjectId.toString()),
      subjectCode: s.subjectCode,
      subjectName: s.subjectName,
      credits: s.credits,
      type: s.isElective
        ? RegistrationSubjectType.ELECTIVE
        : s.labHours > 0 && s.theoryHours === 0
          ? RegistrationSubjectType.LAB
          : RegistrationSubjectType.THEORY,
      isBacklog: false,
    }));
  } else {
    const planSubjects = new Map((plan.subjects ?? []).map((s) => [s.subjectId.toString(), s]));
    const priorSubjects = new Map(
      (curriculum.semesterPlans ?? [])
        .filter((p) => p.semesterNo < payload.targetSemester)
        .flatMap((p) => p.subjects ?? [])
        .map((s) => [s.subjectId.toString(), s]),
    );
    const electiveGroups = new Map<string, number>();
    const seenSubjectIds = new Set<string>();

    registeredSubjects = registeredSubjects.map((subject) => {
      const subjectId = subject.subjectId.toString();
      if (seenSubjectIds.has(subjectId)) {
        throw createError(400, "The same subject cannot be registered more than once");
      }
      seenSubjectIds.add(subjectId);
      const planned = planSubjects.get(subjectId);
      const prior = priorSubjects.get(subjectId);

      if (subject.isBacklog) {
        if (!prior) {
          throw createError(
            400,
            `${subject.subjectCode} is not eligible as backlog for this semester`,
          );
        }
        return {
          ...subject,
          subjectCode: prior.subjectCode,
          subjectName: prior.subjectName,
          credits: prior.credits,
          isBacklog: true,
        };
      }

      if (!planned) {
        throw createError(400, `${subject.subjectCode} is not in the semester curriculum plan`);
      }
      if (planned.isElective) {
        const group = planned.electiveGroup || planned.subjectCode;
        const count = (electiveGroups.get(group) ?? 0) + 1;
        electiveGroups.set(group, count);
        if (count > 1) {
          throw createError(400, `Only one elective can be selected from ${group}`);
        }
      }
      return {
        ...subject,
        subjectCode: planned.subjectCode,
        subjectName: planned.subjectName,
        credits: planned.credits,
        type: planned.isElective
          ? RegistrationSubjectType.ELECTIVE
          : planned.labHours > 0 && planned.theoryHours === 0
            ? RegistrationSubjectType.LAB
            : RegistrationSubjectType.THEORY,
        isBacklog: false,
      };
    });

    const selectedCurrentIds = new Set(
      registeredSubjects
        .filter((subject) => !subject.isBacklog)
        .map((subject) => subject.subjectId.toString()),
    );
    const missingMandatory = (plan.subjects ?? []).filter(
      (subject) => !subject.isElective && !selectedCurrentIds.has(subject.subjectId.toString()),
    );
    if (missingMandatory.length) {
      throw createError(
        400,
        `Mandatory subjects cannot be omitted: ${missingMandatory.map((subject) => subject.subjectCode).join(", ")}`,
      );
    }
    const requiredElectiveGroups = new Set(
      (plan.subjects ?? [])
        .filter((subject) => subject.isElective)
        .map((subject) => subject.electiveGroup || subject.subjectCode),
    );
    for (const group of requiredElectiveGroups) {
      if ((electiveGroups.get(group) ?? 0) !== 1) {
        throw createError(400, `Exactly one elective must be selected from ${group}`);
      }
    }
  }

  const studentName = [profile.firstName, profile.middleName, profile.lastName]
    .filter(Boolean)
    .join(" ");
  const departmentId = allotment?.departmentId?.toString() || profile.department?.toString() || "";
  const department = departmentId ? await departmentRepository.findById(departmentId) : null;

  return {
    rollNumber: profile.rollNumber,
    studentName,
    program: profile.program,
    branch: department?.code || "",
    departmentId,
    batchId: allotment?.batchId,
    sectionId: allotment?.sectionId,
    curriculumId: allotment?.curriculumId,
    registeredSubjects,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export const semesterRegistrationService = {
  async getStudentContext(studentId: string, academicYear: string, requestedSemester?: number) {
    const profile = await studentProfileRepository.findByUserId(studentId);
    if (!profile || profile.status !== StudentStatus.ACTIVE) {
      throw createError(403, "An active student profile is required for semester registration");
    }
    const targetSemester = requestedSemester || profile.currentSemester;
    if (profile.currentSemester !== targetSemester) {
      throw createError(
        400,
        `Registration is allowed only for the student's current semester (${profile.currentSemester})`,
      );
    }
    const allotment = await studentSectionAllotmentRepository.findActiveForStudentSemester(
      studentId,
      academicYear,
      targetSemester,
    );
    if (!allotment) {
      throw createError(400, "Student must be allotted to a section for this semester/year first");
    }
    const curriculum = allotment.curriculumId
      ? await curriculumRepository.findById(allotment.curriculumId.toString())
      : null;
    const plan = curriculum?.semesterPlans?.find((row) => row.semesterNo === targetSemester);
    if (!curriculum || !plan) {
      throw createError(400, "Curriculum semester plan is not configured for this semester");
    }
    const departmentId = allotment.departmentId?.toString() || profile.department?.toString() || "";
    const department = departmentId ? await departmentRepository.findById(departmentId) : null;
    const publishedResults = await SemesterResultModel.find({ studentId, isPublished: true })
      .select("subjectResults")
      .lean();
    const passedCodes = new Set(
      publishedResults.flatMap((result) =>
        result.subjectResults
          .filter((subject) => subject.isPassed)
          .map((subject) => subject.subjectCode.toUpperCase()),
      ),
    );
    const failedCodes = new Set(
      publishedResults.flatMap((result) =>
        result.subjectResults
          .filter((subject) => !subject.isPassed)
          .map((subject) => subject.subjectCode.toUpperCase()),
      ),
    );
    const outstandingBacklogs = (curriculum.semesterPlans ?? [])
      .filter((semesterPlan) => semesterPlan.semesterNo < targetSemester)
      .flatMap((semesterPlan) => semesterPlan.subjects ?? [])
      .filter((subject) => {
        const code = subject.subjectCode.toUpperCase();
        return failedCodes.has(code) && !passedCodes.has(code);
      });
    return {
      rollNumber: profile.rollNumber,
      studentName: [profile.firstName, profile.middleName, profile.lastName]
        .filter(Boolean)
        .join(" "),
      program: profile.program,
      branch: department?.code || "",
      departmentId,
      batchId: allotment.batchId,
      sectionId: allotment.sectionId,
      curriculumId: allotment.curriculumId,
      targetSemester,
      subjects: plan.subjects
        .map((subject) => ({
          _id: subject.subjectId,
          code: subject.subjectCode,
          name: subject.subjectName,
          credits: subject.credits,
          type: subject.isElective
            ? RegistrationSubjectType.ELECTIVE
            : subject.labHours > 0 && subject.theoryHours === 0
              ? RegistrationSubjectType.LAB
              : RegistrationSubjectType.THEORY,
          isElective: subject.isElective,
          electiveGroup: subject.electiveGroup,
          isBacklogEligible: false,
        }))
        .concat(
          outstandingBacklogs.map((subject) => ({
            _id: subject.subjectId,
            code: subject.subjectCode,
            name: subject.subjectName,
            credits: subject.credits,
            type:
              subject.labHours > 0 && subject.theoryHours === 0
                ? RegistrationSubjectType.LAB
                : RegistrationSubjectType.THEORY,
            isElective: false,
            electiveGroup: undefined,
            isBacklogEligible: true,
          })),
        ),
    };
  },

  /**
   * Student saves or updates their draft / submits their registration.
   * `submit: true` moves status from DRAFT → SUBMITTED.
   */
  async register(
    studentId: string,
    payload: {
      rollNumber: string;
      studentName: string;
      program: string;
      branch: string;
      departmentId: string;
      targetSemester: number;
      academicYear: string;
      registeredSubjects?: ISubjectRegistrationItem[];
      submit?: boolean;
    },
  ) {
    const { submit } = payload;
    const context = await buildRegistrationContext(studentId, payload);
    const registeredSubjects = context.registeredSubjects;
    if (!registeredSubjects.length) {
      throw createError(
        400,
        "No subjects found. Configure the curriculum semester plan before registration.",
      );
    }
    const existing = await semesterRegistrationRepository.findByStudentSemester(
      studentId,
      payload.targetSemester,
      payload.academicYear,
    );
    if (existing?.status === RegistrationStatus.FROZEN) {
      throw createError(409, "Registration for this semester is frozen and cannot be modified");
    }
    if (existing?.status === RegistrationStatus.SUBMITTED) {
      throw createError(409, "Submitted registration is awaiting review and cannot be modified");
    }
    const window = await semesterRegistrationRepository.findWindow(
      context.departmentId,
      payload.targetSemester,
      payload.academicYear,
    );
    if (!window) throw createError(409, "Semester registration window is not configured");
    if (
      !canEditRegistrationAt(new Date(), window, existing?.status as RegistrationStatus | undefined)
    ) {
      throw createError(409, "Semester registration window is closed");
    }

    const backlogSubjects = registeredSubjects.filter((subject) => subject.isBacklog);
    if (backlogSubjects.length && !window.allowBacklogs) {
      throw createError(400, "Backlog registration is disabled for this window");
    }
    if (backlogSubjects.length > window.maxBacklogSubjects) {
      throw createError(
        400,
        `A maximum of ${window.maxBacklogSubjects} backlog subjects is allowed`,
      );
    }
    if (backlogSubjects.length) {
      const results = await SemesterResultModel.find({ studentId, isPublished: true })
        .select("subjectResults")
        .lean();
      const passedCodes = new Set(
        results.flatMap((result) =>
          result.subjectResults
            .filter((subject) => subject.isPassed)
            .map((subject) => subject.subjectCode),
        ),
      );
      const failedCodes = new Set(
        results.flatMap((result) =>
          result.subjectResults
            .filter((subject) => !subject.isPassed)
            .map((subject) => subject.subjectCode),
        ),
      );
      for (const subject of backlogSubjects) {
        if (!failedCodes.has(subject.subjectCode) || passedCodes.has(subject.subjectCode)) {
          throw createError(400, `${subject.subjectCode} is not an outstanding published backlog`);
        }
      }
    }

    if (submit && window.requireFeeClearance) {
      const outstandingFee = await FeeRecordModel.exists({ studentId, balanceDue: { $gt: 0 } });
      if (outstandingFee) {
        throw createError(409, "Outstanding institutional fees must be cleared before submission");
      }
    }

    const totalCredits = calcCredits(registeredSubjects);
    const minCredits = window.minCredits ?? MIN_CREDITS;
    const maxCredits = window.maxCredits ?? MAX_CREDITS;
    if (submit) {
      if (totalCredits < minCredits)
        throw createError(400, `Minimum ${minCredits} credits required to submit registration`);
      if (totalCredits > maxCredits)
        throw createError(400, `Credit limit is ${maxCredits} per semester`);
    }

    const status = submit ? RegistrationStatus.SUBMITTED : RegistrationStatus.DRAFT;
    const extra = submit ? { submittedAt: new Date() } : {};

    let registration;
    try {
      registration = await semesterRegistrationRepository.upsert(
        studentId,
        payload.targetSemester,
        payload.academicYear,
        {
          targetSemester: payload.targetSemester,
          academicYear: payload.academicYear,
          ...context,
          studentId,
          registeredSubjects,
          totalCredits,
          status,
          remarks: undefined,
          reviewedBy: undefined,
          reviewedAt: undefined,
          ...extra,
        },
      );
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw createError(409, "Registration changed concurrently or is no longer editable");
      }
      throw error;
    }

    if (submit) {
      void notifyByPermission(Module.SEMESTER_REGISTRATION, PermissionAction.APPROVE, {
        departmentId: context.departmentId,
        title: "Semester registration awaiting approval",
        body: `${context.studentName} (${context.rollNumber}) submitted Sem ${payload.targetSemester} registration with ${totalCredits} credits.`,
        type: NotificationType.INFO,
        actionUrl: "/hod/semester-registration",
      });
    }

    return registration;
  },

  /**
   * Get all registrations for a student.
   */
  getForStudent: (studentId: string) => semesterRegistrationRepository.findByStudent(studentId),

  /**
   * Get the registration for a specific student/semester/year.
   */
  getForStudentSemester: (studentId: string, semester: number, academicYear: string) =>
    semesterRegistrationRepository.findByStudentSemester(studentId, semester, academicYear),

  getById: (id: string) => semesterRegistrationRepository.findById(id),

  withdraw: async (id: string, studentId: string) => {
    const registration = await semesterRegistrationRepository.findById(id);
    if (!registration) throw createError(404, "Registration not found");
    if (registration.studentId.toString() !== studentId) {
      throw createError(403, "You can withdraw only your own registration");
    }
    const window = await semesterRegistrationRepository.findWindow(
      registration.departmentId.toString(),
      registration.targetSemester,
      registration.academicYear,
    );
    if (!window || new Date() > new Date(window.addDropEndsAt)) {
      throw createError(409, "Registration withdrawal deadline has passed");
    }
    const withdrawn = await semesterRegistrationRepository.withdraw(id, studentId);
    if (!withdrawn) throw createError(409, "Registration can no longer be withdrawn");
    return withdrawn;
  },

  /**
   * HOD / Admin: paginated list with optional filters.
   */
  list(filter: Record<string, unknown>, page: number, limit: number) {
    return semesterRegistrationRepository.paginate(filter, page, limit);
  },

  /**
   * HOD approves a single registration.
   */
  async approve(id: string, reviewedById: string, reviewedByName: string) {
    const reg = await semesterRegistrationRepository.findById(id);
    if (!reg) throw createError(404, "Registration not found");
    if (reg.status !== RegistrationStatus.SUBMITTED)
      throw createError(400, `Cannot approve a registration with status '${reg.status}'`);

    const updated = await semesterRegistrationRepository.updateStatus(
      id,
      [RegistrationStatus.SUBMITTED],
      RegistrationStatus.APPROVED,
      {
        reviewedBy: reviewedById,
        reviewedByName,
        reviewedAt: new Date(),
      },
    );
    if (!updated) throw createError(409, "Registration was already reviewed");
    void notifyUsers([reg.studentId], {
      title: "Semester registration approved",
      body: `Your Sem ${reg.targetSemester} registration (${reg.academicYear}) has been approved.`,
      type: NotificationType.SUCCESS,
      actionUrl: "/student/semester-registration",
      withEmail: true,
      emailTemplate: EmailTemplate.SEMESTER_REGISTRATION_UPDATE,
    });
    return updated;
  },

  /**
   * HOD rejects a registration and optionally provides remarks.
   */
  async reject(id: string, reviewedById: string, reviewedByName: string, remarks?: string) {
    const reg = await semesterRegistrationRepository.findById(id);
    if (!reg) throw createError(404, "Registration not found");
    if (reg.status !== RegistrationStatus.SUBMITTED)
      throw createError(400, `Cannot reject a registration with status '${reg.status}'`);

    const updated = await semesterRegistrationRepository.updateStatus(
      id,
      [RegistrationStatus.SUBMITTED],
      RegistrationStatus.REJECTED,
      {
        reviewedBy: reviewedById,
        reviewedByName,
        reviewedAt: new Date(),
        remarks: remarks ?? "Registration rejected by HOD",
      },
    );
    if (!updated) throw createError(409, "Registration was already reviewed");
    void notifyUsers([reg.studentId], {
      title: "Semester registration rejected",
      body: `Your Sem ${reg.targetSemester} registration was rejected. Remark: ${remarks ?? "Not provided"}.`,
      type: NotificationType.WARNING,
      actionUrl: "/student/semester-registration",
      withEmail: true,
      emailTemplate: EmailTemplate.SEMESTER_REGISTRATION_UPDATE,
    });
    return updated;
  },

  /**
   * Bulk approve all submitted registrations for a department + semester.
   */
  bulkApprove: (
    departmentId: string,
    targetSemester: number,
    academicYear: string,
    reviewedById: string,
    reviewedByName: string,
  ) =>
    semesterRegistrationRepository.bulkApprove(
      departmentId,
      targetSemester,
      academicYear,
      reviewedById,
      reviewedByName,
    ),

  /**
   * Freeze all approved registrations — called at end of add/drop period.
   * After freezing, students cannot modify or delete their registration.
   */
  async freezeSemester(departmentId: string, targetSemester: number, academicYear: string) {
    const window = await semesterRegistrationRepository.findWindow(
      departmentId,
      targetSemester,
      academicYear,
    );
    if (!window) throw createError(409, "Semester registration window is not configured");
    if (new Date() < new Date(window.addDropEndsAt)) {
      throw createError(409, "Registration cannot be frozen before the add/drop deadline");
    }
    const result = await semesterRegistrationRepository.freezeApproved(
      departmentId,
      targetSemester,
      academicYear,
    );
    return {
      frozen: (result as { modifiedCount: number }).modifiedCount,
      message: `Registration frozen for Semester ${targetSemester} (${academicYear})`,
    };
  },

  /**
   * Stats for HOD dashboard.
   */
  getStats: (filter: Record<string, unknown>) =>
    semesterRegistrationRepository.countByStatus(filter),

  configureWindow: async (
    data: {
      departmentId: string;
      targetSemester: number;
      academicYear: string;
      opensAt: string;
      closesAt: string;
      addDropEndsAt: string;
      minCredits: number;
      maxCredits: number;
      requireFeeClearance?: boolean;
      allowBacklogs?: boolean;
      maxBacklogSubjects?: number;
      isActive?: boolean;
    },
    configuredBy: string,
  ) => {
    const opensAt = new Date(data.opensAt);
    const closesAt = new Date(data.closesAt);
    const addDropEndsAt = new Date(data.addDropEndsAt);
    if (
      [opensAt, closesAt, addDropEndsAt].some((date) => Number.isNaN(date.getTime())) ||
      closesAt <= opensAt ||
      addDropEndsAt < closesAt
    ) {
      throw createError(400, "Window dates must satisfy opensAt < closesAt <= addDropEndsAt");
    }
    if (data.minCredits < 0 || data.maxCredits < data.minCredits || data.maxCredits > 60) {
      throw createError(400, "Registration credit limits are invalid");
    }
    return semesterRegistrationRepository.upsertWindow(
      data.departmentId,
      data.targetSemester,
      data.academicYear,
      { ...data, opensAt, closesAt, addDropEndsAt, configuredBy },
    );
  },

  listWindows: (filter: Record<string, unknown>) =>
    semesterRegistrationRepository.listWindows(filter),
};

import { NotFound, BadRequest, Forbidden } from "http-errors";
import { counselingRepository } from "../repositories/counseling.repository";
import { auditLogRepository } from "../repositories/audit-log.repository";
import { userRepository } from "../repositories/user.repository";
import {
  type CounselingType,
  type ICounselingSession,
  CounselingStatus,
} from "../models/counseling-session.model";
import type { IUser } from "../models/user.model";
import { SystemRole, ADMIN_ROLES } from "../constants/roles";
import { Module } from "../constants/permissions";
import type { PaginationQuery } from "../types";
import type { Request } from "express";
import { notifyUsers } from "./helpers/notify.helper";
import { NotificationType } from "../models/notification.model";
import { EmailTemplate } from "../email/email.service";
import { nextSeq } from "../models/counter.model";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function generateSessionNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const sequence = await nextSeq(`counseling:${year}`);
  return `COUN-${year}-${String(sequence).padStart(6, "0")}`;
}

function idOf(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return (
    (value as { _id?: { toString(): string }; toString?: () => string })._id?.toString() ||
    (value as { toString?: () => string }).toString?.() ||
    ""
  );
}

function hasRole(user: IUser, role: SystemRole): boolean {
  return user.roles.includes(role);
}

function isInstitutionRole(user: IUser): boolean {
  const institutionCounselingRoles = [
    ...ADMIN_ROLES,
    SystemRole.ADMINISTRATION_OFFICE,
    SystemRole.ASSISTANT_ADMINISTRATION_OFFICER,
    SystemRole.ADMISSION_INCHARGE,
    SystemRole.ADMISSION_COUNSELOR,
  ];
  return user.roles.some((role) => institutionCounselingRoles.includes(role as SystemRole));
}

function getStudentDepartment(sessionOrStudent: unknown): string {
  const student = (sessionOrStudent as { student?: unknown }).student ?? sessionOrStudent;
  return idOf((student as { department?: unknown })?.department);
}

async function assertCanAccessStudent(studentId: string, actorUser: IUser): Promise<void> {
  if (isInstitutionRole(actorUser)) return;

  if (hasRole(actorUser, SystemRole.STUDENT)) {
    if (actorUser._id.toString() !== studentId) throw new Forbidden("Access denied");
    return;
  }

  if (hasRole(actorUser, SystemRole.HOD) || hasRole(actorUser, SystemRole.FACULTY)) {
    const student = await userRepository.findById(studentId);
    if (!student) throw new NotFound("Student not found");
    if (idOf(student.department) !== idOf(actorUser.department)) {
      throw new Forbidden("You can access only your department students");
    }
    return;
  }

  throw new Forbidden("Access denied");
}

async function buildCounselingScope(
  actorUser: IUser,
  baseFilter: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (isInstitutionRole(actorUser)) return baseFilter;

  if (hasRole(actorUser, SystemRole.STUDENT)) {
    return { ...baseFilter, student: actorUser._id };
  }

  if (hasRole(actorUser, SystemRole.FACULTY)) {
    return { ...baseFilter, counselor: actorUser._id };
  }

  if (hasRole(actorUser, SystemRole.HOD)) {
    const departmentId = idOf(actorUser.department);
    if (!departmentId) throw new Forbidden("Department ownership is required for this role");
    const studentIds = await userRepository.findStudentIdsByDepartment(departmentId);
    return { ...baseFilter, student: { $in: studentIds } };
  }

  throw new Forbidden("Access denied");
}

async function assertCanAccessSession(
  sessionId: string,
  actorUser: IUser,
  allowWrite = false,
  includeSensitiveNotes = false,
) {
  const session = await counselingRepository.findById(sessionId, includeSensitiveNotes);
  if (!session) throw new NotFound("Counseling session not found");

  const studentId = idOf((session.student as { _id?: unknown })?._id ?? session.student);
  const counselorId = idOf((session.counselor as { _id?: unknown })?._id ?? session.counselor);

  if (isInstitutionRole(actorUser)) return session;

  if (hasRole(actorUser, SystemRole.STUDENT)) {
    if (studentId !== actorUser._id.toString() || allowWrite) throw new Forbidden("Access denied");
    return session;
  }

  if (hasRole(actorUser, SystemRole.FACULTY)) {
    if (counselorId !== actorUser._id.toString()) {
      throw new Forbidden("Only the assigned counselor can access this session");
    }
    return session;
  }

  if (hasRole(actorUser, SystemRole.HOD)) {
    const departmentId = idOf(actorUser.department);
    if (!departmentId || getStudentDepartment(session) !== departmentId) {
      throw new Forbidden("You can access only your department counseling records");
    }
    return session;
  }

  throw new Forbidden("Access denied");
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export const counselingService = {
  /**
   * Schedule a new counseling session.
   */
  async scheduleSession(
    data: {
      studentId: string;
      type: CounselingType;
      scheduledAt: Date;
      mode: ICounselingSession["mode"];
      issueDescription: string;
      venue?: string;
      academicYear: string;
      semester?: number;
    },
    actorUser: IUser,
    req: Request,
  ) {
    const scheduledAt = new Date(data.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
      throw new BadRequest("Counseling sessions must be scheduled for a future date and time");
    }
    if (!/^\d{4}-\d{2}$/.test(data.academicYear)) {
      throw new BadRequest("Choose a valid academic year");
    }
    if (data.mode === "in_person" && !data.venue?.trim()) {
      throw new BadRequest("Venue is required for an in-person session");
    }
    const student = await userRepository.findById(data.studentId);
    if (!student) throw new NotFound("Student not found");
    if (!student.roles.includes(SystemRole.STUDENT)) {
      throw new BadRequest("The specified user is not a student");
    }
    if (actorUser.roles.includes(SystemRole.STUDENT)) {
      throw new Forbidden("Students cannot schedule counseling sessions");
    }
    await assertCanAccessStudent(data.studentId, actorUser);

    const session = await counselingRepository.create({
      sessionNumber: await generateSessionNumber(),
      student: student._id,
      counselor: actorUser._id,
      type: data.type,
      scheduledAt,
      mode: data.mode,
      issueDescription: data.issueDescription,
      venue: data.venue,
      academicYear: data.academicYear,
      semester: data.semester,
      status: CounselingStatus.SCHEDULED,
      followUpActions: [],
      parentMeetingRequired: false,
      parentNotified: false,
    });

    await auditLogRepository.create({
      user: actorUser,
      action: "COUNSELING_SCHEDULED",
      module: Module.COUNSELING_NOTES,
      targetId: session._id.toString(),
      targetModel: "CounselingSession",
      description: `Counseling session scheduled for student ${student.name} — Type: ${data.type}`,
      req,
    });

    void notifyUsers([data.studentId], {
      title: "Counseling session scheduled",
      body: `A ${data.type} counseling session has been scheduled for you on ${new Date(data.scheduledAt).toLocaleString()}${data.venue ? ` at ${data.venue}` : ""}.`,
      type: NotificationType.INFO,
      actionUrl: "/student/counseling",
      withEmail: true,
      emailTemplate: EmailTemplate.COUNSELING_SCHEDULED,
    });

    return session;
  },

  /**
   * Get a session by ID.
   * Sensitive notes are included only when the active role has counseling-notes view access.
   */
  async getSession(sessionId: string, requester: IUser, includeSensitiveNotes = false) {
    return assertCanAccessSession(sessionId, requester, false, includeSensitiveNotes);
  },

  /**
   * Get all sessions for a student.
   */
  async getStudentSessions(studentId: string, requester: IUser, academicYear?: string) {
    await assertCanAccessStudent(studentId, requester);
    return counselingRepository.findByStudent(studentId, academicYear);
  },

  /**
   * List all sessions (paginated) — for HOD / admin view.
   */
  async listSessions(
    query: PaginationQuery,
    actorUser: IUser,
    filter: Record<string, unknown> = {},
  ) {
    const scopedFilter = await buildCounselingScope(actorUser, filter);
    return counselingRepository.paginate(scopedFilter, query);
  },

  /**
   * Update session after it has been conducted.
   */
  async conductSession(
    sessionId: string,
    data: {
      counselorNotes?: string;
      followUpActions?: ICounselingSession["followUpActions"];
      outcome?: string;
      durationMinutes?: number;
      nextSessionDate?: Date;
      parentMeetingRequired?: boolean;
    },
    actorUser: IUser,
    req: Request,
  ) {
    const session = await assertCanAccessSession(sessionId, actorUser, true);

    const updated = await counselingRepository.updateById(sessionId, {
      ...data,
      conductedAt: new Date(),
      status: data.followUpActions?.length
        ? CounselingStatus.FOLLOW_UP_REQUIRED
        : CounselingStatus.COMPLETED,
    });

    await auditLogRepository.create({
      user: actorUser,
      action: "COUNSELING_CONDUCTED",
      module: Module.COUNSELING_NOTES,
      targetId: sessionId,
      targetModel: "CounselingSession",
      description: `Counseling session ${(session as unknown as ICounselingSession).sessionNumber} conducted`,
      req,
    });

    return updated;
  },

  /**
   * Cancel a session.
   */
  async cancelSession(sessionId: string, actorUser: IUser, req: Request) {
    const session = await assertCanAccessSession(sessionId, actorUser, true);

    if ((session as unknown as ICounselingSession).status === CounselingStatus.COMPLETED) {
      throw new BadRequest("Cannot cancel a completed session");
    }

    const updated = await counselingRepository.updateStatus(sessionId, CounselingStatus.CANCELLED);

    await auditLogRepository.create({
      user: actorUser,
      action: "COUNSELING_CANCELLED",
      module: Module.COUNSELING_NOTES,
      targetId: sessionId,
      targetModel: "CounselingSession",
      description: `Session ${(session as unknown as ICounselingSession).sessionNumber} cancelled by ${actorUser.name}`,
      req,
    });

    return updated;
  },

  /**
   * Mark a follow-up action as completed.
   */
  async completeFollowUpAction(
    sessionId: string,
    actionIndex: number,
    actorUser: IUser,
    _req: Request,
  ) {
    const session = await assertCanAccessSession(sessionId, actorUser, true);

    const actions = [...((session as unknown as ICounselingSession).followUpActions ?? [])];
    if (!actions[actionIndex]) throw new BadRequest("Invalid action index");

    actions[actionIndex] = {
      ...actions[actionIndex],
      isCompleted: true,
      completedAt: new Date(),
    };

    const allDone = actions.every((a: { isCompleted?: boolean }) => a.isCompleted);

    const updated = await counselingRepository.updateById(sessionId, {
      followUpActions: actions,
      ...(allDone ? { status: CounselingStatus.COMPLETED } : {}),
    });

    return updated;
  },

  /**
   * Summary stats for HOD / mentor dashboard.
   */
  async getStats(actorUser: IUser, academicYear: string) {
    const scope = await buildCounselingScope(actorUser, { academicYear });
    const [totalSessions, pendingSessions, completedSessions, followUpRequired] = await Promise.all(
      [
        counselingRepository.countByFilter(scope),
        counselingRepository.countByFilter({ ...scope, status: CounselingStatus.SCHEDULED }),
        counselingRepository.countByFilter({ ...scope, status: CounselingStatus.COMPLETED }),
        counselingRepository.countByFilter({
          ...scope,
          status: {
            $in: [CounselingStatus.FOLLOW_UP_REQUIRED, CounselingStatus.PARENT_MEETING_REQUIRED],
          },
        }),
      ],
    );
    return {
      totalSessions,
      completedSessions,
      pendingSessions,
      followUpRequired,
    };
  },
};

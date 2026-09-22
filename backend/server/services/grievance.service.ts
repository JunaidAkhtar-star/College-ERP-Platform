import createError from "http-errors";
import { grievanceRepository } from "../repositories/grievance.repository";
import { auditLogRepository } from "../repositories/audit-log.repository";
import { GrievanceStatus, GrievancePriority, GrievanceType } from "../models/grievance.model";
import { Module, PermissionAction } from "../constants/permissions";
import { notifyUsers, notifyByPermission } from "./helpers/notify.helper";
import { NotificationType } from "../models/notification.model";
import { EmailTemplate } from "../email/email.service";
import { UserModel, type IUser } from "../models/user.model";
import type { Request } from "express";
import { nextSeq } from "../models/counter.model";
import { SystemRole } from "../constants/roles";

// ─── Reference number generator ──────────────────────────────────────────────

async function genRef() {
  const year = new Date().getFullYear();
  const sequence = await nextSeq(`grievance:${year}`);
  return `GRV-${year}-${String(sequence).padStart(7, "0")}`;
}

// ─── Role → HOD / Principal routing ──────────────────────────────────────────
// Ragging and harassment always escalate directly to Principal.
// Other types go to department HOD first.
function autoEscalateTypes(): GrievanceType[] {
  return [GrievanceType.RAGGING, GrievanceType.HARASSMENT];
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export const grievanceService = {
  /**
   * Student submits a new grievance.
   */
  async submit(
    data: {
      studentId: string;
      studentName: string;
      rollNumber: string;
      program: string;
      branch: string;
      semester: number;
      departmentId?: string;
      type: GrievanceType;
      title: string;
      description: string;
      attachments?: string[];
      targetUserId?: string;
      targetName?: string;
    },
    req: Request,
  ) {
    const referenceNumber = await genRef();

    // Auto-elevate priority for sensitive types
    const priority = autoEscalateTypes().includes(data.type)
      ? GrievancePriority.URGENT
      : GrievancePriority.MEDIUM;
    const sensitive = autoEscalateTypes().includes(data.type);
    const responseHours = sensitive ? 4 : 48;
    const resolutionDays = sensitive ? 2 : 14;

    const initialTimeline = [
      {
        status: GrievanceStatus.SUBMITTED,
        note: "Grievance submitted by student.",
        updatedAt: new Date(),
      },
    ];

    const grievance = await grievanceRepository.create({
      ...data,
      priority,
      status: GrievanceStatus.SUBMITTED,
      referenceNumber,
      timeline: initialTimeline,
      isEscalated: false,
      confidentiality: sensitive ? "restricted" : "standard",
      responseDueAt: new Date(Date.now() + responseHours * 60 * 60 * 1000),
      resolutionDueAt: new Date(Date.now() + resolutionDays * 24 * 60 * 60 * 1000),
      createdBy: data.studentId,
    });

    await auditLogRepository.create({
      user: { _id: data.studentId, name: data.studentName } as unknown as IUser,
      action: "GRIEVANCE_SUBMITTED",
      module: Module.GRIEVANCE,
      description: `Grievance submitted: ${referenceNumber} — ${data.type}`,
      req,
    });

    void notifyByPermission(Module.GRIEVANCE, PermissionAction.APPROVE, {
      departmentId: data.departmentId,
      title: `New ${priority} grievance: ${data.type}`,
      body: `${data.studentName} (${data.rollNumber}) — ${data.title}. Ref: ${referenceNumber}.`,
      type: priority === GrievancePriority.URGENT ? NotificationType.ALERT : NotificationType.INFO,
      actionUrl: "/hod/grievance",
      withEmail: priority === GrievancePriority.URGENT,
    });
    void notifyUsers([data.studentId], {
      title: "Grievance submitted",
      body: `Your grievance has been recorded with reference ${referenceNumber}.`,
      type: NotificationType.SUCCESS,
      actionUrl: "/student/grievance",
    });

    return { grievance, referenceNumber };
  },

  /**
   * Get all grievances (admin / HOD view) — paginated, filterable.
   */
  list(filter: Record<string, unknown>, page: number, limit: number) {
    return grievanceRepository.paginate(filter, page, limit);
  },

  /**
   * Get all grievances for a single student.
   */
  listForStudent(studentId: string, filter: Record<string, unknown>, page: number, limit: number) {
    return grievanceRepository.findByStudent(studentId, filter, page, limit);
  },

  /**
   * Get a single grievance by ID.
   */
  async getById(id: string) {
    const g = await grievanceRepository.findById(id);
    if (!g) throw createError(404, "Grievance not found");
    return g;
  },

  /**
   * Get by reference number (student-friendly lookup).
   */
  async getByRef(ref: string) {
    const g = await grievanceRepository.findByRef(ref);
    if (!g) throw createError(404, `Grievance not found for reference: ${ref}`);
    return g;
  },

  /**
   * Authority acknowledges receipt and begins review.
   */
  async acknowledge(id: string, staffId: string, staffName: string, note?: string) {
    const existing = await grievanceRepository.findById(id);
    if (!existing) throw createError(404, "Grievance not found");
    if (existing.targetUserId?.toString() === staffId)
      throw createError(409, "A person named in a grievance cannot handle the case");
    const g = await grievanceRepository.updateStatus(
      id,
      [GrievanceStatus.SUBMITTED, GrievanceStatus.REOPENED, GrievanceStatus.REFERRED],
      GrievanceStatus.ACKNOWLEDGED,
      note ?? "Grievance received and acknowledged. Under review.",
      staffId,
      staffName,
    );
    if (!g) throw createError(409, "Grievance is not awaiting acknowledgement");
    void notifyUsers([g.studentId], {
      title: "Your grievance is being reviewed",
      body: `${staffName} has acknowledged your grievance (${g.referenceNumber}).`,
      type: NotificationType.INFO,
      actionUrl: "/student/grievance",
    });
    return g;
  },

  /**
   * Provide a formal response / resolution.
   */
  async respond(
    id: string,
    response: string,
    respondedById: string,
    respondedByName: string,
    resolve: boolean,
    req: Request,
  ) {
    const existing = await grievanceRepository.findById(id);
    if (!existing) throw createError(404, "Grievance not found");
    if (existing.targetUserId?.toString() === respondedById)
      throw createError(409, "A person named in a grievance cannot decide the case");
    const newStatus = resolve ? GrievanceStatus.RESOLVED : GrievanceStatus.UNDER_REVIEW;
    const g = await grievanceRepository.respond(
      id,
      [GrievanceStatus.ACKNOWLEDGED, GrievanceStatus.UNDER_REVIEW, GrievanceStatus.REFERRED],
      response,
      respondedById,
      respondedByName,
      newStatus,
    );
    if (!g) throw createError(409, "A response cannot be added in the current grievance state");

    await auditLogRepository.create({
      user: { _id: respondedById } as unknown as IUser,
      action: resolve ? "GRIEVANCE_RESOLVED" : "GRIEVANCE_RESPONDED",
      module: Module.GRIEVANCE,
      description: `Grievance ${id} ${resolve ? "resolved" : "responded to"} by ${respondedByName}`,
      req,
    });

    void notifyUsers([g.studentId], {
      title: resolve ? "Grievance resolved" : "New response on your grievance",
      body: resolve
        ? `Your grievance (${g.referenceNumber}) has been marked as resolved. Please rate your satisfaction.`
        : `${respondedByName} has responded to your grievance (${g.referenceNumber}).`,
      type: resolve ? NotificationType.SUCCESS : NotificationType.INFO,
      actionUrl: "/student/grievance",
      withEmail: resolve,
    });

    return g;
  },

  /**
   * Escalate to a higher authority (e.g., HOD → Principal).
   */
  async escalate(
    id: string,
    escalatedToId: string,
    escalatedToName: string,
    staffId: string,
    staffName: string,
    note: string,
  ) {
    const target = await UserModel.findOne({
      _id: escalatedToId,
      status: "active",
      roles: { $in: [SystemRole.PRINCIPAL, SystemRole.DEAN_ACADEMIC, SystemRole.SUPER_ADMIN] },
    })
      .select("name")
      .lean();
    if (!target) throw createError(400, "Escalation target must be an active higher authority");
    escalatedToName = target.name;
    const g = await grievanceRepository.updateStatus(
      id,
      [
        GrievanceStatus.SUBMITTED,
        GrievanceStatus.ACKNOWLEDGED,
        GrievanceStatus.UNDER_REVIEW,
        GrievanceStatus.REFERRED,
      ],
      GrievanceStatus.REFERRED,
      note,
      staffId,
      staffName,
      { isEscalated: true, escalatedTo: escalatedToId, escalatedAt: new Date() },
    );
    if (!g) throw createError(409, "Grievance cannot be escalated in its current state");

    void notifyUsers([escalatedToId], {
      title: "Grievance escalated to you",
      body: `${staffName} has escalated grievance ${g.referenceNumber} (${g.type}) to you. Note: ${note}.`,
      type: NotificationType.ALERT,
      actionUrl: "/principal/grievance",
      withEmail: true,
      emailTemplate: EmailTemplate.GRIEVANCE_UPDATE,
    });
    void notifyUsers([g.studentId], {
      title: "Your grievance has been escalated",
      body: `Your grievance (${g.referenceNumber}) has been forwarded to ${escalatedToName} for further action.`,
      type: NotificationType.INFO,
      actionUrl: "/student/grievance",
    });

    return g;
  },

  /**
   * Student closes or reopens their own grievance.
   */
  async close(id: string, studentId: string) {
    const g = await grievanceRepository.findById(id);
    if (!g) throw createError(404, "Grievance not found");
    if (g.studentId.toString() !== studentId)
      throw createError(403, "You can only close your own grievances");
    const closed = await grievanceRepository.updateStatus(
      id,
      [
        GrievanceStatus.SUBMITTED,
        GrievanceStatus.ACKNOWLEDGED,
        GrievanceStatus.UNDER_REVIEW,
        GrievanceStatus.REFERRED,
        GrievanceStatus.RESOLVED,
      ],
      GrievanceStatus.CLOSED,
      "Closed by student.",
      studentId,
      "Student",
    );
    if (!closed) throw createError(409, "Grievance cannot be closed in its current state");
    return closed;
  },

  async appeal(id: string, studentId: string, reason: string) {
    if (reason.trim().length < 20) throw createError(400, "A meaningful appeal reason is required");
    const grievance = await grievanceRepository.findById(id);
    if (!grievance) throw createError(404, "Grievance not found");
    if (grievance.studentId.toString() !== studentId)
      throw createError(403, "You can appeal only your own grievance");
    if (
      ![GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED, GrievanceStatus.REJECTED].includes(
        grievance.status,
      )
    )
      throw createError(409, "Only a resolved, closed, or rejected grievance can be appealed");
    if ((grievance.appealCount ?? 0) >= 3) throw createError(409, "Maximum appeal limit reached");
    const terminalAt = grievance.resolvedAt ?? grievance.updatedAt;
    if (Date.now() - new Date(terminalAt).getTime() > 30 * 24 * 60 * 60 * 1000)
      throw createError(409, "The 30-day appeal window has expired");
    const updated = await grievanceRepository.updateStatus(
      id,
      [grievance.status],
      GrievanceStatus.REOPENED,
      `Appeal: ${reason.trim()}`,
      studentId,
      "Student",
      {
        appealCount: (grievance.appealCount ?? 0) + 1,
        lastAppealedAt: new Date(),
        appealReason: reason.trim(),
        isEscalated: true,
      },
    );
    if (!updated) throw createError(409, "Grievance appeal was concurrently processed");
    return updated;
  },

  /**
   * Student rates satisfaction after resolution.
   */
  async rateSatisfaction(id: string, studentId: string, rating: number, feedback?: string) {
    const g = await grievanceRepository.findById(id);
    if (!g) throw createError(404, "Grievance not found");
    if (g.studentId.toString() !== studentId)
      throw createError(403, "Only the grievance owner can rate satisfaction");
    if (g.status !== GrievanceStatus.RESOLVED)
      throw createError(400, "Satisfaction rating can only be given after resolution");
    if (rating < 1 || rating > 5) throw createError(400, "Rating must be between 1 and 5");
    const rated = await grievanceRepository.rateSatisfaction(id, studentId, rating, feedback);
    if (!rated) throw createError(409, "This resolved grievance has already been rated");
    return rated;
  },

  /**
   * Dashboard stats for admin / IQAC.
   */
  async getStats(filter: Record<string, unknown> = {}) {
    const [raw] = await grievanceRepository.getStats(filter);
    const byStatus = Object.fromEntries(
      (raw?.byStatus ?? []).map((entry: { _id: string; count: number }) => [
        entry._id,
        entry.count,
      ]),
    );
    const byType = Object.fromEntries(
      (raw?.byType ?? []).map((entry: { _id: string; count: number }) => [entry._id, entry.count]),
    );
    const byPriority = Object.fromEntries(
      (raw?.byPriority ?? []).map((entry: { _id: string; count: number }) => [
        entry._id,
        entry.count,
      ]),
    );
    return {
      total: Object.values(byStatus).reduce((sum, count) => sum + Number(count), 0),
      ...byStatus,
      byType,
      byPriority,
      avgResolutionDays: raw?.avgResolutionDays?.[0]?.avg ?? 0,
    };
  },

  listAuthorities: () =>
    UserModel.find({
      status: "active",
      roles: { $in: [SystemRole.PRINCIPAL, SystemRole.DEAN_ACADEMIC, SystemRole.SUPER_ADMIN] },
    })
      .select("name email roles")
      .sort({ name: 1 })
      .lean(),
};

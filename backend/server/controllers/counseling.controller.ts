import type { RequestHandler } from "express";
import { counselingService } from "../services/counseling.service";
import { responseUtil } from "../utils/response.util";
import { parsePagination } from "../utils/pagination.util";
import type { Request } from "express";
import type { IUser } from "../models/user.model";
import { SystemRole } from "../constants/roles";
import { Module, PermissionAction } from "../constants/permissions";

/** Builds the active-role actor from the lean user object attached by authentication. */
const activeRoleUser = (req: Request): IUser =>
  ({
    ...(req.user as unknown as Record<string, unknown>),
    roles: req.role?.baseRole
      ? [req.role.baseRole]
      : req.activeRole
        ? [req.activeRole as SystemRole]
        : [],
  }) as IUser;

const hasAction = (req: Request, module: Module, action: PermissionAction): boolean =>
  (req.permissions ?? []).some(
    (permission) => permission.module === module && permission.actions.includes(action),
  );

export const counselingController: Record<string, RequestHandler> = {
  /** POST /counseling/sessions */
  async scheduleSession(req, res, next) {
    try {
      const session = await counselingService.scheduleSession(
        { ...req.body, scheduledAt: new Date(req.body.scheduledAt) },
        activeRoleUser(req),
        req,
      );
      responseUtil.created(res, session, "Counseling session scheduled");
    } catch (err) {
      next(err);
    }
  },

  /** GET /counseling/sessions */
  async listSessions(req, res, next) {
    try {
      const query = parsePagination(req.query as Record<string, unknown>);
      const filter: Record<string, unknown> = {};
      if (req.query.status) filter.status = req.query.status;
      if (req.query.type) filter.type = req.query.type;
      if (req.query.academicYear) filter.academicYear = req.query.academicYear;
      if (req.query.counselor) filter.counselor = req.query.counselor;
      const result = await counselingService.listSessions(query, activeRoleUser(req), filter);
      responseUtil.success(res, result);
    } catch (err) {
      next(err);
    }
  },

  /** GET /counseling/sessions/:id */
  async getSession(req, res, next) {
    try {
      const session = await counselingService.getSession(
        req.params.id,
        activeRoleUser(req),
        hasAction(req, Module.COUNSELING_NOTES, PermissionAction.VIEW),
      );
      responseUtil.success(res, session);
    } catch (err) {
      next(err);
    }
  },

  /** GET /counseling/students/:studentId/sessions */
  async getStudentSessions(req, res, next) {
    try {
      const sessions = await counselingService.getStudentSessions(
        req.params.studentId,
        activeRoleUser(req),
        req.query.academicYear as string | undefined,
      );
      responseUtil.success(res, sessions);
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /counseling/sessions/:id/conduct */
  async conductSession(req, res, next) {
    try {
      const body = { ...req.body };
      if (!hasAction(req, Module.COUNSELING_NOTES, PermissionAction.EDIT)) {
        delete body.counselorNotes;
      }
      const session = await counselingService.conductSession(
        req.params.id,
        body,
        activeRoleUser(req),
        req,
      );
      responseUtil.success(res, session, "Session updated");
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /counseling/sessions/:id/cancel */
  async cancelSession(req, res, next) {
    try {
      const session = await counselingService.cancelSession(
        req.params.id,
        activeRoleUser(req),
        req,
      );
      responseUtil.success(res, session, "Session cancelled");
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /counseling/sessions/:id/follow-up/:index/complete */
  async completeFollowUp(req, res, next) {
    try {
      const session = await counselingService.completeFollowUpAction(
        req.params.id,
        parseInt(req.params.index, 10),
        activeRoleUser(req),
        req,
      );
      responseUtil.success(res, session, "Follow-up action marked complete");
    } catch (err) {
      next(err);
    }
  },

  /** GET /counseling/stats */
  async getStats(req, res, next) {
    try {
      const academicYear =
        (req.query.academicYear as string) ||
        `${new Date().getFullYear()}-${(new Date().getFullYear() + 1).toString().slice(-2)}`;
      const stats = await counselingService.getStats(activeRoleUser(req), academicYear);
      responseUtil.success(res, stats);
    } catch (err) {
      next(err);
    }
  },
};

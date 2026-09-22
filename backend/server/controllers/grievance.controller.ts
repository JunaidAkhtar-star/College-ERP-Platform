import type { RequestHandler } from "express";
import createError from "http-errors";
import { grievanceService } from "../services/grievance.service";
import { responseUtil } from "../utils/response.util";
import { SystemRole } from "../constants/roles";
import { applyDepartmentScope, assertDepartmentAccess } from "../utils/ownership.util";
import { StudentProfileModel } from "../models/student-profile.model";
import { Module, PermissionAction } from "../constants/permissions";

const activeBaseRole = (req: Parameters<RequestHandler>[0]): string =>
  req.role?.baseRole ?? req.activeRole ?? "";

const canManageRestricted = (req: Parameters<RequestHandler>[0]): boolean =>
  (req.permissions ?? []).some(
    (permission) =>
      permission.module === Module.GRIEVANCE &&
      permission.actions.includes(PermissionAction.APPROVE),
  );

async function assertGrievanceAccess(
  req: Parameters<RequestHandler>[0],
  grievance: {
    studentId?: { toString(): string } | string;
    departmentId?: unknown;
    confidentiality?: string;
  },
) {
  if (activeBaseRole(req) === SystemRole.STUDENT) {
    if (grievance.studentId?.toString() !== req.user?._id.toString()) {
      throw createError(403, "You can access only your own grievances");
    }
    return;
  }
  if (grievance.confidentiality === "restricted" && !canManageRestricted(req)) {
    throw createError(403, "Restricted grievances require approval authority");
  }
  await assertDepartmentAccess(req, grievance.departmentId);
}

export const grievanceController: Record<string, RequestHandler> = {
  /** POST /grievance — student submits */
  async submit(req, res, next) {
    try {
      const userId = req.user!._id.toString();
      const profile = await StudentProfileModel.findOne({ userId: req.user!._id })
        .select("firstName middleName lastName rollNumber program currentSemester department")
        .populate("department", "name code")
        .lean();
      if (!profile) throw createError(403, "An active student profile is required");
      const department = profile.department as unknown as {
        _id: { toString(): string };
        name?: string;
        code?: string;
      };
      const result = await grievanceService.submit(
        {
          ...req.body,
          studentId: userId,
          studentName: [profile.firstName, profile.middleName, profile.lastName]
            .filter(Boolean)
            .join(" "),
          rollNumber: profile.rollNumber,
          program: String(profile.program),
          branch: department.code ?? department.name ?? "",
          semester: profile.currentSemester,
          departmentId: department._id.toString(),
        },
        req,
      );
      responseUtil.created(res, result, "Grievance submitted successfully");
    } catch (err) {
      next(err);
    }
  },

  /** GET /grievance — admin / HOD list (paginated, filterable) */
  async list(req, res, next) {
    try {
      const { type, status, priority, departmentId, page, limit } = req.query;
      const filter: Record<string, unknown> = {};
      if (type) filter.type = type;
      if (status) filter.status = status;
      if (priority) filter.priority = priority;
      if (departmentId) filter.departmentId = departmentId;
      if (!canManageRestricted(req)) filter.confidentiality = "standard";

      const scopedFilter = await applyDepartmentScope(req, filter);
      const result = await grievanceService.list(
        scopedFilter,
        Number(page) || 1,
        Number(limit) || 20,
      );
      responseUtil.success(res, result);
    } catch (err) {
      next(err);
    }
  },

  /** GET /grievance/mine — student's own grievances */
  async listMine(req, res, next) {
    try {
      const filter: Record<string, unknown> = {};
      if (req.query.type) filter.type = req.query.type;
      if (req.query.status) filter.status = req.query.status;
      if (req.query.priority) filter.priority = req.query.priority;
      const data = await grievanceService.listForStudent(
        req.user!._id.toString(),
        filter,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      responseUtil.success(res, data);
    } catch (err) {
      next(err);
    }
  },

  /** GET /grievance/ref/:ref — by reference number */
  async getByRef(req, res, next) {
    try {
      const data = await grievanceService.getByRef(req.params["ref"]!);
      await assertGrievanceAccess(req, data);
      responseUtil.success(res, data);
    } catch (err) {
      next(err);
    }
  },

  /** GET /grievance/:id */
  async getById(req, res, next) {
    try {
      const data = await grievanceService.getById(req.params["id"]!);
      await assertGrievanceAccess(req, data);
      responseUtil.success(res, data);
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /grievance/:id/acknowledge */
  async acknowledge(req, res, next) {
    try {
      const staff = req.user!;
      const existing = await grievanceService.getById(req.params["id"]!);
      await assertGrievanceAccess(req, existing);
      const data = await grievanceService.acknowledge(
        req.params["id"]!,
        staff._id.toString(),
        staff.name,
        req.body.note,
      );
      responseUtil.success(res, data, "Grievance acknowledged");
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /grievance/:id/respond */
  async respond(req, res, next) {
    try {
      const { response, resolve } = req.body;
      const staff = req.user!;
      const existing = await grievanceService.getById(req.params["id"]!);
      await assertGrievanceAccess(req, existing);
      const data = await grievanceService.respond(
        req.params["id"]!,
        response,
        staff._id.toString(),
        staff.name,
        Boolean(resolve),
        req,
      );
      responseUtil.success(res, data, resolve ? "Grievance resolved" : "Response recorded");
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /grievance/:id/escalate */
  async escalate(req, res, next) {
    try {
      const { escalatedToId, escalatedToName, note } = req.body;
      const staff = req.user!;
      const existing = await grievanceService.getById(req.params["id"]!);
      await assertGrievanceAccess(req, existing);
      const data = await grievanceService.escalate(
        req.params["id"]!,
        escalatedToId,
        escalatedToName,
        staff._id.toString(),
        staff.name,
        note,
      );
      responseUtil.success(res, data, "Grievance escalated");
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /grievance/:id/close — student closes own */
  async close(req, res, next) {
    try {
      const data = await grievanceService.close(req.params["id"]!, req.user!._id.toString());
      responseUtil.success(res, data, "Grievance closed");
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /grievance/:id/rate — student rates satisfaction */
  async rate(req, res, next) {
    try {
      const { rating, feedback } = req.body;
      const data = await grievanceService.rateSatisfaction(
        req.params["id"]!,
        req.user!._id.toString(),
        Number(rating),
        feedback,
      );
      responseUtil.success(res, data, "Thank you for your feedback");
    } catch (err) {
      next(err);
    }
  },

  async appeal(req, res, next) {
    try {
      const data = await grievanceService.appeal(
        req.params["id"]!,
        req.user!._id.toString(),
        req.body.reason,
      );
      responseUtil.success(res, data, "Appeal submitted");
    } catch (err) {
      next(err);
    }
  },

  /** GET /grievance/stats — admin / IQAC */
  async stats(req, res, next) {
    try {
      if (activeBaseRole(req) === SystemRole.STUDENT) {
        const data = await grievanceService.getStats({ studentId: req.user!._id });
        responseUtil.success(res, data);
        return;
      }
      const baseFilter = canManageRestricted(req) ? {} : { confidentiality: "standard" };
      const filter = await applyDepartmentScope(req, baseFilter);
      const data = await grievanceService.getStats(filter);
      responseUtil.success(res, data);
    } catch (err) {
      next(err);
    }
  },

  async authorities(_req, res, next) {
    try {
      responseUtil.success(res, await grievanceService.listAuthorities());
    } catch (err) {
      next(err);
    }
  },
};

import type { RequestHandler } from "express";
import { semesterRegistrationService } from "../services/semester-registration.service";
import { responseUtil } from "../utils/response.util";
import { applyDepartmentScope, assertDepartmentAccess } from "../utils/ownership.util";
import createError from "http-errors";

export const semesterRegistrationController: Record<string, RequestHandler> = {
  async getContext(req, res, next) {
    try {
      const data = await semesterRegistrationService.getStudentContext(
        req.user!._id.toString(),
        String(req.query.academicYear),
        Number(req.query.targetSemester),
      );
      responseUtil.success(res, data);
    } catch (err) {
      next(err);
    }
  },

  /** POST /semester-registration — student saves/submits */
  async register(req, res, next) {
    try {
      const data = await semesterRegistrationService.register(req.user!._id.toString(), req.body);
      responseUtil.created(res, data, "Registration saved");
    } catch (err) {
      next(err);
    }
  },

  /** GET /semester-registration/mine — student's own registrations */
  async getMine(req, res, next) {
    try {
      const data = await semesterRegistrationService.getForStudent(req.user!._id.toString());
      responseUtil.success(res, data);
    } catch (err) {
      next(err);
    }
  },

  /** GET /semester-registration/mine/:semester — specific semester */
  async getMySemester(req, res, next) {
    try {
      const { semester } = req.params;
      const { academicYear } = req.query as Record<string, string>;
      const data = await semesterRegistrationService.getForStudentSemester(
        req.user!._id.toString(),
        Number(semester),
        academicYear,
      );
      responseUtil.success(res, data);
    } catch (err) {
      next(err);
    }
  },

  async withdraw(req, res, next) {
    try {
      const data = await semesterRegistrationService.withdraw(
        req.params["id"]!,
        req.user!._id.toString(),
      );
      responseUtil.success(res, data, "Registration withdrawn");
    } catch (err) {
      next(err);
    }
  },

  /** GET /semester-registration — HOD / admin list */
  async list(req, res, next) {
    try {
      const { departmentId, targetSemester, academicYear, status, page, limit } = req.query;
      const filter: Record<string, unknown> = {};
      if (departmentId) filter.departmentId = departmentId;
      if (targetSemester) filter.targetSemester = Number(targetSemester);
      if (academicYear) filter.academicYear = academicYear;
      if (status) filter.status = status;
      const scopedFilter = await applyDepartmentScope(req, filter);

      const data = await semesterRegistrationService.list(
        scopedFilter,
        Number(page) || 1,
        Number(limit) || 30,
      );
      responseUtil.success(res, data);
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /semester-registration/:id/approve */
  async approve(req, res, next) {
    try {
      const reviewer = req.user!;
      const existing = await semesterRegistrationService.getById(req.params["id"]!);
      if (!existing) throw createError(404, "Registration not found");
      await assertDepartmentAccess(req, existing.departmentId);
      const data = await semesterRegistrationService.approve(
        req.params["id"]!,
        reviewer._id.toString(),
        reviewer.name,
      );
      responseUtil.success(res, data, "Registration approved");
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /semester-registration/:id/reject */
  async reject(req, res, next) {
    try {
      const reviewer = req.user!;
      const existing = await semesterRegistrationService.getById(req.params["id"]!);
      if (!existing) throw createError(404, "Registration not found");
      await assertDepartmentAccess(req, existing.departmentId);
      const data = await semesterRegistrationService.reject(
        req.params["id"]!,
        reviewer._id.toString(),
        reviewer.name,
        req.body.remarks,
      );
      responseUtil.success(res, data, "Registration rejected");
    } catch (err) {
      next(err);
    }
  },

  /** POST /semester-registration/bulk-approve */
  async bulkApprove(req, res, next) {
    try {
      const { departmentId, targetSemester, academicYear } = req.body;
      await assertDepartmentAccess(req, departmentId);
      const reviewer = req.user!;
      const result = await semesterRegistrationService.bulkApprove(
        departmentId,
        Number(targetSemester),
        academicYear,
        reviewer._id.toString(),
        reviewer.name,
      );
      responseUtil.success(res, result, "Bulk approval completed");
    } catch (err) {
      next(err);
    }
  },

  /** POST /semester-registration/freeze */
  async freeze(req, res, next) {
    try {
      const { departmentId, targetSemester, academicYear } = req.body;
      await assertDepartmentAccess(req, departmentId);
      const result = await semesterRegistrationService.freezeSemester(
        departmentId,
        Number(targetSemester),
        academicYear,
      );
      responseUtil.success(res, result);
    } catch (err) {
      next(err);
    }
  },

  /** GET /semester-registration/stats */
  async stats(req, res, next) {
    try {
      const { departmentId, targetSemester, academicYear } = req.query;
      const filter: Record<string, unknown> = {};
      if (departmentId) filter.departmentId = departmentId;
      if (targetSemester) filter.targetSemester = Number(targetSemester);
      if (academicYear) filter.academicYear = academicYear;
      const scopedFilter = await applyDepartmentScope(req, filter);
      const data = await semesterRegistrationService.getStats(scopedFilter);
      responseUtil.success(res, data);
    } catch (err) {
      next(err);
    }
  },

  async configureWindow(req, res, next) {
    try {
      await assertDepartmentAccess(req, req.body.departmentId);
      const data = await semesterRegistrationService.configureWindow(
        req.body,
        req.user!._id.toString(),
      );
      responseUtil.success(res, data, "Registration window configured");
    } catch (err) {
      next(err);
    }
  },

  async listWindows(req, res, next) {
    try {
      const filter: Record<string, unknown> = {};
      if (req.query.departmentId) filter.departmentId = req.query.departmentId;
      if (req.query.targetSemester) filter.targetSemester = Number(req.query.targetSemester);
      if (req.query.academicYear) filter.academicYear = req.query.academicYear;
      const scoped = await applyDepartmentScope(req, filter);
      const data = await semesterRegistrationService.listWindows(scoped);
      responseUtil.success(res, data);
    } catch (err) {
      next(err);
    }
  },
};

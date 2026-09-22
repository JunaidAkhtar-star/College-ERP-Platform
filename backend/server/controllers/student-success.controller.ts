import type { RequestHandler } from "express";
import { SystemRole } from "../constants/roles";
import { studentSuccessService } from "../services/student-success.service";
import { applyDepartmentScope, assertDepartmentAccess } from "../utils/ownership.util";
import { responseUtil } from "../utils/response.util";
import createError from "http-errors";

function assertAssignedAdvisor(req: Parameters<RequestHandler>[0], assignedAdvisorId: unknown) {
  if (
    req.activeRole === SystemRole.FACULTY &&
    String(assignedAdvisorId) !== req.user!._id.toString()
  )
    throw createError(403, "Only the assigned advisor can update this student-success case");
}

export const studentSuccessController: Record<string, RequestHandler> = {
  async mine(req, res, next) {
    try {
      responseUtil.success(res, await studentSuccessService.mine(req.user!._id.toString()));
    } catch (error) {
      next(error);
    }
  },

  async caseload(req, res, next) {
    try {
      const filter: Record<string, unknown> = {};
      if (req.query.riskLevel) filter.riskLevel = req.query.riskLevel;
      if (req.query.departmentId) filter.departmentId = req.query.departmentId;
      if (req.activeRole === SystemRole.FACULTY) filter.mentorId = req.user!._id;
      const scoped = await applyDepartmentScope(req, filter);
      responseUtil.success(
        res,
        await studentSuccessService.caseload(
          scoped,
          Number(req.query.page) || 1,
          Number(req.query.limit) || 30,
        ),
      );
    } catch (error) {
      next(error);
    }
  },

  async refreshStudent(req, res, next) {
    try {
      const student = await studentSuccessService.studentScope(req.params.studentProfileId!);
      await assertDepartmentAccess(req, student.department);
      const snapshot = await studentSuccessService.calculateStudentRisk(
        req.params.studentProfileId!,
      );
      responseUtil.success(res, snapshot, "Student risk indicators refreshed");
    } catch (error) {
      next(error);
    }
  },

  async refreshDepartment(req, res, next) {
    try {
      if (req.body.departmentId) await assertDepartmentAccess(req, req.body.departmentId);
      responseUtil.success(
        res,
        await studentSuccessService.refreshDepartment(req.body.departmentId),
        "Student success indicators refreshed",
      );
    } catch (error) {
      next(error);
    }
  },

  async openCase(req, res, next) {
    try {
      const student = await studentSuccessService.studentScope(req.body.studentProfileId);
      await assertDepartmentAccess(req, student.department);
      if (
        req.activeRole === SystemRole.FACULTY &&
        String(req.body.assignedAdvisorId) !== req.user!._id.toString()
      )
        throw createError(403, "Faculty can only open cases assigned to themselves");
      await studentSuccessService.calculateStudentRisk(req.body.studentProfileId);
      responseUtil.created(
        res,
        await studentSuccessService.openCase(req.user!._id.toString(), req.body),
        "Student success case opened",
      );
    } catch (error) {
      next(error);
    }
  },

  async addIntervention(req, res, next) {
    try {
      const item = await studentSuccessService.caseById(req.params.id!);
      await assertDepartmentAccess(req, item.departmentId);
      assertAssignedAdvisor(req, item.assignedAdvisorId);
      responseUtil.success(
        res,
        await studentSuccessService.addIntervention(
          req.params.id!,
          req.user!._id.toString(),
          req.body,
        ),
        "Intervention recorded",
      );
    } catch (error) {
      next(error);
    }
  },

  async resolveCase(req, res, next) {
    try {
      const item = await studentSuccessService.caseById(req.params.id!);
      await assertDepartmentAccess(req, item.departmentId);
      assertAssignedAdvisor(req, item.assignedAdvisorId);
      responseUtil.success(
        res,
        await studentSuccessService.resolveCase(
          req.params.id!,
          req.user!._id.toString(),
          req.body.resolution,
        ),
        "Student success case resolved",
      );
    } catch (error) {
      next(error);
    }
  },
};

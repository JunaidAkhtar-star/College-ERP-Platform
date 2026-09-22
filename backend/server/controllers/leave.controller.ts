import type { Request, Response, NextFunction } from "express";
import { leaveService } from "../services";
import createError from "http-errors";
import { SystemRole } from "../constants/roles";
import {
  applyDepartmentScope,
  assertDepartmentAccess,
  getDepartmentScope,
} from "../utils/ownership.util";

const GLOBAL_LEAVE_ROLES = new Set<SystemRole>([SystemRole.SUPER_ADMIN, SystemRole.PRINCIPAL]);

async function assertLeaveAccess(
  req: Request,
  leave: { employeeId: unknown; departmentId: unknown },
) {
  if (GLOBAL_LEAVE_ROLES.has(req.activeRole as SystemRole)) return;
  if (req.activeRole === SystemRole.HOD) {
    await assertDepartmentAccess(req, leave.departmentId);
    return;
  }
  if (String(leave.employeeId) !== req.user!._id.toString()) {
    throw createError(403, "You can access only your own leave requests");
  }
}

export const leaveController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId, departmentId, status, leaveType } = req.query;
      const filter: Record<string, unknown> = {};
      if (employeeId) filter.employeeId = employeeId;
      if (departmentId) filter.departmentId = departmentId;
      if (status) filter.status = status;
      if (leaveType) filter.leaveType = leaveType;
      const scopedFilter = await applyDepartmentScope(req, filter);
      const result = await leaveService.getRequests(
        scopedFilter,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  listMine: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter: Record<string, unknown> = { employeeId: req.user!._id };
      if (req.query.status) filter.status = req.query.status;
      if (req.query.leaveType) filter.leaveType = req.query.leaveType;
      const result = await leaveService.getRequests(
        filter,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await leaveService.getRequestById(req.params.id);
      if (!data) {
        res.status(404).json({ success: false, message: "Not found" });
        return;
      }
      await assertLeaveAccess(req, data);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  myBalance: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { academicYear } = req.query;
      const data = await leaveService.getBalance(
        req.user!._id as unknown as string,
        academicYear as string,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  apply: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawDepartment = req.user?.department;
      const departmentId =
        (typeof rawDepartment === "object" && rawDepartment
          ? String((rawDepartment as { _id?: unknown })._id || "")
          : String(rawDepartment || "")) || (await getDepartmentScope(req));
      if (!departmentId) throw createError(403, "A department assignment is required for leave");
      const data = await leaveService.apply({
        ...req.body,
        employeeId: req.user!._id,
        departmentId,
      });
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  hodApprove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await leaveService.getRequestById(req.params.id);
      if (!existing) throw createError(404, "Leave request not found");
      await assertDepartmentAccess(req, existing.departmentId);
      const data = await leaveService.hodApprove(req.params.id, req.user!._id as unknown as string);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  hodReject: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await leaveService.getRequestById(req.params.id);
      if (!existing) throw createError(404, "Leave request not found");
      await assertDepartmentAccess(req, existing.departmentId);
      const data = await leaveService.hodReject(
        req.params.id,
        req.user!._id as unknown as string,
        req.body.reason,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  adminApprove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await leaveService.adminApprove(
        req.params.id,
        req.user!._id as unknown as string,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  adminReject: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await leaveService.adminReject(
        req.params.id,
        req.user!._id as unknown as string,
        req.body.reason,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  cancel: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await leaveService.cancel(req.params.id, req.user!._id.toString());
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};

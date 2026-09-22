import type { Request, Response, NextFunction } from "express";
import { facultyAttendanceService } from "../services";
import {
  applyDepartmentScope,
  assertDepartmentAccess,
  getDepartmentScope,
} from "../utils/ownership.util";
import { SystemRole } from "../constants/roles";

export const facultyAttendanceController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { facultyId, departmentId, month, year, status, startDate, endDate } = req.query;
      const filter: Record<string, unknown> = {};
      if (facultyId) filter.facultyId = facultyId;
      if (departmentId) filter.departmentId = departmentId;
      if (status) filter.status = status;
      if (startDate && endDate) {
        const start = new Date(`${String(startDate)}T00:00:00`);
        const end = new Date(`${String(endDate)}T23:59:59.999`);
        filter.date = { $gte: start, $lte: end };
      } else if (month && year) {
        const m = Number(month),
          y = Number(year);
        filter.date = { $gte: new Date(y, m - 1, 1), $lte: new Date(y, m, 0) };
      }
      const scopedFilter = await applyDepartmentScope(req, filter);
      const result = await facultyAttendanceService.getAll(
        scopedFilter,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 31,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  mark: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { facultyId, date, ...rest } = req.body;
      const context = await facultyAttendanceService.getFacultyContext(facultyId);
      await assertDepartmentAccess(req, context.departmentId);
      const data = await facultyAttendanceService.markAttendance(facultyId, new Date(date), {
        ...rest,
        markedBy: req.user!._id,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  getMonthlySummary: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const now = new Date();
      const month = Number(req.query.month) || now.getMonth() + 1;
      const year = Number(req.query.year) || now.getFullYear();
      let facultyId = (req.query.facultyId as string) || String(req.user!._id);
      if (req.activeRole === SystemRole.FACULTY) facultyId = String(req.user!._id);
      if (facultyId !== String(req.user!._id)) {
        const context = await facultyAttendanceService.getFacultyContext(facultyId);
        await assertDepartmentAccess(req, context.departmentId);
      }
      const data = await facultyAttendanceService.getMonthlySummary(facultyId, month, year);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  /** GET /faculty-attendance/department-summary?departmentId=&month=&year= */
  getDepartmentSummary: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const now = new Date();
      const month = Number(req.query["month"]) || now.getMonth() + 1;
      const year = Number(req.query["year"]) || now.getFullYear();
      const startDate = req.query["startDate"]
        ? new Date(`${String(req.query["startDate"])}T00:00:00`)
        : undefined;
      const endDate = req.query["endDate"]
        ? new Date(`${String(req.query["endDate"])}T23:59:59.999`)
        : undefined;
      const requestedDepartmentId = req.query["departmentId"] as string | undefined;
      const departmentId = requestedDepartmentId || (await getDepartmentScope(req));
      if (!departmentId) {
        res.status(400).json({ success: false, message: "departmentId is required" });
        return;
      }
      await assertDepartmentAccess(req, departmentId);
      const data = await facultyAttendanceService.getDepartmentSummary(
        departmentId,
        month,
        year,
        startDate,
        endDate,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};

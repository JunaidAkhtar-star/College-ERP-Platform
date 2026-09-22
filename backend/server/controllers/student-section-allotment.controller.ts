import type { Request, Response, NextFunction } from "express";
import { studentSectionAllotmentService } from "../services";
import {
  applyDepartmentScope,
  assertDepartmentAccess,
  getDepartmentScope,
} from "../utils/ownership.util";

export const studentSectionAllotmentController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sectionId, batchId, studentId, academicYear, semesterNo, status } = req.query;
      const filter: Record<string, unknown> = {};
      if (sectionId) filter.sectionId = sectionId;
      if (batchId) filter.batchId = batchId;
      if (studentId) filter.studentId = studentId;
      if (academicYear) filter.academicYear = academicYear;
      if (semesterNo) filter.semesterNo = Number(semesterNo);
      if (status) filter.status = status;
      const scopedFilter = sectionId ? filter : await applyDepartmentScope(req, filter);
      const data = await studentSectionAllotmentService.list(
        scopedFilter,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      res.json({ success: true, ...data });
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await studentSectionAllotmentService.getById(req.params.id);
      await assertDepartmentAccess(req, String(data.departmentId));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  allot: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await studentSectionAllotmentService.allot(
        req.body,
        req.user?._id.toString() || "",
        await getDepartmentScope(req),
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  previewBulk: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await studentSectionAllotmentService.previewBulk(
        req.body,
        await getDepartmentScope(req),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  executeBulk: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await studentSectionAllotmentService.executeBulk(
        req.body,
        req.user?._id.toString() || "",
        await getDepartmentScope(req),
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  transfer: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await studentSectionAllotmentService.transfer(
        req.params.id,
        req.body.toSectionId,
        req.body.reason,
        req.user?._id.toString() || "",
        await getDepartmentScope(req),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  cancel: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await studentSectionAllotmentService.cancel(
        req.params.id,
        req.body.reason,
        req.user?._id.toString() || "",
        await getDepartmentScope(req),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};

import type { Request, Response, NextFunction } from "express";
import createError from "http-errors";
import { courseProgressService } from "../services";
import { SystemRole } from "../constants/roles";
import { applyDepartmentScope, assertDepartmentAccess } from "../utils/ownership.util";

export const courseProgressController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { academicYear, subjectId, facultyId, section, departmentId, isComplete } = req.query;
      const filter: Record<string, unknown> = {};
      if (academicYear) filter.academicYear = academicYear;
      if (subjectId) filter.subjectId = subjectId;
      if (facultyId) filter.facultyId = facultyId;
      if (section) filter.section = section;
      if (departmentId) filter.departmentId = departmentId;
      if (isComplete !== undefined) filter.isComplete = isComplete === "true";
      if (req.activeRole === SystemRole.FACULTY) filter.facultyId = req.user!._id;
      const scopedFilter = await applyDepartmentScope(req, filter);
      const result = await courseProgressService.getAll(
        scopedFilter,
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
      const data = await courseProgressService.getById(req.params.id);
      if (!data) throw createError(404, "Course progress not found");
      await assertDepartmentAccess(req, data.departmentId);
      if (
        req.activeRole === SystemRole.FACULTY &&
        String(data.facultyId) !== req.user!._id.toString()
      )
        throw createError(403, "Faculty can access only their course progress");
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  addTopic: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await courseProgressService.addTopic(
        req.params.id,
        req.user!._id.toString(),
        req.body,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};

import type { Request, Response, NextFunction } from "express";
import createError from "http-errors";
import { lessonPlanService } from "../services";
import { SystemRole } from "../constants/roles";
import { sectionRepository } from "../repositories";
import { applyDepartmentScope, assertDepartmentAccess } from "../utils/ownership.util";

async function assertPlanAccess(req: Request, plan: Record<string, unknown>) {
  await assertDepartmentAccess(req, plan.departmentId);
  if (req.activeRole === SystemRole.FACULTY && String(plan.facultyId) !== req.user!._id.toString())
    throw createError(403, "Faculty can access only their own lesson plans");
}

export const lessonPlanController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { academicYear, subjectId, facultyId, section, status } = req.query;
      const filter: Record<string, unknown> = {};
      if (academicYear) filter.academicYear = academicYear;
      if (subjectId) filter.subjectId = subjectId;
      if (facultyId) filter.facultyId = facultyId;
      if (section) filter.section = section;
      if (status) filter.status = status;
      const scopedFilter = await applyDepartmentScope(req, filter);
      if (req.activeRole === SystemRole.FACULTY) scopedFilter.facultyId = req.user!._id;
      const result = await lessonPlanService.getAll(
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
      const data = await lessonPlanService.getById(req.params.id);
      if (!data) throw createError(404, "Lesson plan not found");
      await assertPlanAccess(req, data as unknown as Record<string, unknown>);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const section = await sectionRepository.findRawById(String(req.body.sectionId ?? ""));
      if (!section) throw createError(404, "Section not found");
      await assertDepartmentAccess(req, section.departmentId);
      const data = await lessonPlanService.create(req.body, req.user!._id.toString());
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await lessonPlanService.getById(req.params.id);
      if (!existing) throw createError(404, "Lesson plan not found");
      await assertPlanAccess(req, existing as unknown as Record<string, unknown>);
      if (req.body.sectionId) {
        const section = await sectionRepository.findRawById(String(req.body.sectionId));
        if (!section) throw createError(404, "Section not found");
        await assertDepartmentAccess(req, section.departmentId);
      }
      const data = await lessonPlanService.update(
        req.params.id,
        req.body,
        req.user!._id.toString(),
        req.activeRole === SystemRole.FACULTY,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  submit: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await lessonPlanService.submit(req.params.id, req.user!._id.toString());
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  approve: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await lessonPlanService.getById(req.params.id);
      if (!existing) throw createError(404, "Lesson plan not found");
      await assertDepartmentAccess(req, existing.departmentId);
      const data = await lessonPlanService.approve(req.params.id, req.user!._id.toString());
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  reject: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await lessonPlanService.getById(req.params.id);
      if (!existing) throw createError(404, "Lesson plan not found");
      await assertDepartmentAccess(req, existing.departmentId);
      const data = await lessonPlanService.reject(
        req.params.id,
        req.user!._id.toString(),
        req.body.remark,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};

import type { Request, Response, NextFunction } from "express";
import { subjectService } from "../services";
import { applyDepartmentScope, assertDepartmentAccess } from "../utils/ownership.util";

export const subjectController = {
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.body.departmentId) await assertDepartmentAccess(req, req.body.departmentId);
      const subject = await subjectService.create(req.body, req.user?._id.toString() || "");
      res.status(201).json({ success: true, data: subject });
    } catch (e) {
      next(e);
    }
  },

  getAll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { program, semester, page, limit } = req.query as Record<string, string>;
      let data;
      if (program && semester) {
        data = await subjectService.getByProgramSemester(program, Number(semester));
        const scope = await applyDepartmentScope(req, {});
        if (scope.departmentId)
          data = data.filter(
            (subject) => String(subject.departmentId) === String(scope.departmentId),
          );
      } else {
        data = await subjectService.getAll(
          await applyDepartmentScope(req, req.query),
          Number(page || 1),
          Number(limit || 20),
        );
      }
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const subject = await subjectService.getById(req.params["id"]!);
      await assertDepartmentAccess(req, String(subject.departmentId));
      res.json({ success: true, data: subject });
    } catch (e) {
      next(e);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await subjectService.getById(req.params["id"]!);
      await assertDepartmentAccess(req, String(existing.departmentId));
      if (req.body.departmentId) await assertDepartmentAccess(req, req.body.departmentId);
      const subject = await subjectService.update(
        req.params["id"]!,
        req.body,
        req.user?._id.toString() || "",
      );
      res.json({ success: true, data: subject });
    } catch (e) {
      next(e);
    }
  },

  setStatus: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await subjectService.getById(req.params["id"]!);
      await assertDepartmentAccess(req, String(existing.departmentId));
      const subject = req.body.isActive
        ? await subjectService.activate(req.params["id"]!, req.user?._id.toString() || "")
        : await subjectService.deactivate(req.params["id"]!, req.user?._id.toString() || "");
      res.json({
        success: true,
        data: subject,
        message: req.body.isActive ? "Subject activated" : "Subject deactivated",
      });
    } catch (e) {
      next(e);
    }
  },

  deactivate: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await subjectService.getById(req.params["id"]!);
      await assertDepartmentAccess(req, String(existing.departmentId));
      const subject = await subjectService.deactivate(
        req.params["id"]!,
        req.user?._id.toString() || "",
      );
      res.json({ success: true, data: subject, message: "Subject deactivated" });
    } catch (e) {
      next(e);
    }
  },
};

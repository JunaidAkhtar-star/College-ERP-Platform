import type { Request, Response, NextFunction } from "express";
import { curriculumService } from "../services";

export const curriculumController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { program, regulationYear } = req.query;
      const filter: Record<string, unknown> = {};
      if (program) filter.program = program;
      if (regulationYear) filter.regulationYear = String(regulationYear);
      const result = await curriculumService.getAll(
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
      const data = await curriculumService.getById(req.params.id);
      if (!data) {
        res.status(404).json({ success: false, message: "Not found" });
        return;
      }
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await curriculumService.create(req.body, String(req.user?._id));
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await curriculumService.update(req.params.id, req.body, String(req.user?._id));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  addSubjectToSemester: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await curriculumService.addSubjectToSemester(
        req.params.id,
        Number(req.body.semesterNo),
        String(req.body.subjectId),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  removeSubjectFromSemester: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await curriculumService.removeSubjectFromSemester(
        req.params.id,
        Number(req.params.semesterNo),
        req.params.subjectId,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};

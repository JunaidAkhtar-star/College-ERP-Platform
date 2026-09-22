import type { Request, Response, NextFunction } from "express";
import { sectionService } from "../services";
import {
  applyDepartmentScope,
  assertDepartmentAccess,
  getDepartmentScope,
} from "../utils/ownership.util";

export const sectionController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        academicYear,
        batchId,
        curriculumId,
        departmentId,
        departmentIds,
        semesterNo,
        status,
      } = req.query;
      const filter: Record<string, unknown> = {};
      if (academicYear) filter.academicYear = academicYear;
      if (batchId) filter.batchId = batchId;
      if (curriculumId) filter.curriculumId = curriculumId;
      if (departmentIds) {
        filter.departmentId = {
          $in: String(departmentIds)
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        };
      } else if (departmentId) filter.departmentId = departmentId;
      if (semesterNo) filter.semesterNo = Number(semesterNo);
      if (status) filter.status = status;
      const scopedFilter = await applyDepartmentScope(req, filter);
      const data = await sectionService.list(
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
      const data = await sectionService.getById(req.params.id);
      const departmentId =
        typeof data.departmentId === "object" && data.departmentId && "_id" in data.departmentId
          ? String((data.departmentId as { _id: unknown })._id)
          : String(data.departmentId);
      await assertDepartmentAccess(req, departmentId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.body.departmentId) await assertDepartmentAccess(req, req.body.departmentId);
      const data = await sectionService.create(
        req.body,
        req.user?._id.toString() || "",
        await getDepartmentScope(req),
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.body.departmentId) await assertDepartmentAccess(req, req.body.departmentId);
      const data = await sectionService.update(
        req.params.id,
        req.body,
        req.user?._id.toString() || "",
        await getDepartmentScope(req),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  approve: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await sectionService.approve(
        req.params.id,
        req.user?._id.toString() || "",
        await getDepartmentScope(req),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};

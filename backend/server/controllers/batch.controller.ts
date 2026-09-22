import type { Request, Response, NextFunction } from "express";
import { batchService } from "../services";
import {
  applyDepartmentScope,
  assertDepartmentAccess,
  getDepartmentScope,
} from "../utils/ownership.util";

export const batchController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { curriculumId, departmentId, admissionYear, status, q } = req.query;
      const filter: Record<string, unknown> = {};
      if (curriculumId) filter.curriculumId = curriculumId;
      if (departmentId) filter.departmentId = departmentId;
      if (admissionYear) filter.admissionYear = Number(admissionYear);
      if (status) filter.status = status;
      if (q) {
        const regex = new RegExp(String(q).replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "i");
        filter.$or = [{ name: regex }, { program: regex }, { departmentCode: regex }];
      }
      const scopedFilter = await applyDepartmentScope(req, filter);
      const data = await batchService.list(
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
      const data = await batchService.getById(req.params.id);
      const department = data.departmentId as unknown as { _id?: { toString(): string } };
      await assertDepartmentAccess(
        req,
        department?._id?.toString() ?? data.departmentId.toString(),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await assertDepartmentAccess(req, req.body.departmentId);
      const data = await batchService.create(
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
      const data = await batchService.update(
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
};

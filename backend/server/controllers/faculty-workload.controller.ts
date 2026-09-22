import type { Request, Response, NextFunction } from "express";
import { facultyWorkloadService } from "../services";
import {
  applyDepartmentScope,
  assertDepartmentAccess,
  getDepartmentScope,
} from "../utils/ownership.util";
import { FacultyProfileModel } from "../models/faculty-profile.model";
import { SystemRole } from "../constants/roles";
import createError from "http-errors";

export const facultyWorkloadController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { departmentId, academicYear, semesterType, facultyId } = req.query;
      const filter: Record<string, unknown> = {};
      if (departmentId) filter.departmentId = departmentId;
      if (academicYear) filter.academicYear = academicYear;
      if (semesterType) filter.semesterType = semesterType;
      if (facultyId) filter.facultyId = facultyId;

      const isLeadership = [
        SystemRole.SUPER_ADMIN,
        SystemRole.ADMIN,
        SystemRole.HOD,
        SystemRole.DEAN_ACADEMIC,
        SystemRole.PRINCIPAL,
      ].includes(req.activeRole as SystemRole);

      if (!isLeadership && req.activeRole === SystemRole.FACULTY && req.user?._id) {
        const profile = await FacultyProfileModel.findOne({ userId: req.user._id })
          .select("_id")
          .lean();
        filter.$or = [
          { facultyId: req.user._id },
          ...(profile ? [{ facultyId: profile._id }] : []),
        ];
      }

      const scopedFilter = await applyDepartmentScope(req, filter, "departmentId");
      if (req.user && req.activeRole === SystemRole.HOD) {
        const profile = await FacultyProfileModel.findOne({ userId: req.user._id })
          .select("_id")
          .lean();
        const selfIds = [req.user._id, ...(profile ? [profile._id] : [])];
        if (req.query.scope === "own") {
          scopedFilter.facultyId = { $in: selfIds };
        } else {
          scopedFilter.facultyId = { $nin: selfIds };
        }
      }

      const result = await facultyWorkloadService.getAll(
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
      const data = await facultyWorkloadService.getById(req.params.id);
      if (!data) {
        res.status(404).json({ success: false, message: "Not found" });
        return;
      }
      await assertDepartmentAccess(req, data.departmentId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  getOperationalSummary: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const current = await facultyWorkloadService.getById(req.params.id);
      if (!current) throw createError(404, "Faculty workload not found");
      await assertDepartmentAccess(req, current.departmentId);
      const data = await facultyWorkloadService.getOperationalSummary(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await facultyWorkloadService.create(
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
      const current = await facultyWorkloadService.getById(req.params.id);
      if (!current) throw createError(404, "Faculty workload not found");
      await assertDepartmentAccess(req, current.departmentId);
      const data = await facultyWorkloadService.update(
        req.params.id,
        req.body,
        req.user?._id.toString() || "",
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  approve: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await facultyWorkloadService.approve(
        req.params.id,
        req.user?._id.toString() || "",
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  getDepartmentSummary: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { departmentId, academicYear, semesterType } = req.query;
      const scopedDepartmentId = await getDepartmentScope(req);
      const data = await facultyWorkloadService.getDepartmentSummary(
        scopedDepartmentId ?? (departmentId as string),
        academicYear as string,
        semesterType as string,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};

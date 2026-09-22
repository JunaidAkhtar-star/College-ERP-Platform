import type { Request, Response, NextFunction } from "express";
import { facultyProfileService } from "../services";
import { SystemRole } from "../constants/roles";
import { Types } from "mongoose";
import {
  applyDepartmentScope,
  assertDepartmentAccess,
  getDepartmentScope,
} from "../utils/ownership.util";

const MANAGER_ROLES = new Set<SystemRole>([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
  SystemRole.HOD,
  SystemRole.HR_DEPARTMENT,
]);

export const facultyProfileController = {
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await facultyProfileService.create(req.body, req.user?._id.toString() || "");
      res.status(201).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, ...query } = req.query as Record<string, string>;
      const scopedQuery = await applyDepartmentScope(req, query, "departmentId");
      const data = await facultyProfileService.list(
        scopedQuery,
        Number(page || 1),
        Number(limit || 20),
      );
      res.json({ success: true, ...data });
    } catch (e) {
      next(e);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await facultyProfileService.getById(req.params["id"]!);
      await assertDepartmentAccess(req, data.department);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  getMyProfile: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await facultyProfileService.getByUserId(req.user?._id.toString() || "");
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await facultyProfileService.update(
        req.params.id,
        req.body,
        req.user?._id.toString() || "",
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  updateMyProfile: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await facultyProfileService.updateMyProfile(
        req.user?._id.toString() || "",
        req.body,
      );
      res.json({ success: true, data, message: "Profile updated" });
    } catch (e) {
      next(e);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await facultyProfileService.delete(req.params["id"]!);
      res.json({ success: true, message: "Faculty profile deleted" });
    } catch (e) {
      next(e);
    }
  },

  addPublication: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await facultyProfileService.getById(req.params.id);
      await assertDepartmentAccess(req, profile.department);
      const data = await facultyProfileService.addPublication(
        req.params.id,
        req.body,
        req.user?._id.toString() || "",
        MANAGER_ROLES.has(req.activeRole as SystemRole),
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  addTraining: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await facultyProfileService.getById(req.params.id);
      await assertDepartmentAccess(req, profile.department);
      const data = await facultyProfileService.addTraining(
        req.params.id,
        req.body,
        req.user?._id.toString() || "",
        MANAGER_ROLES.has(req.activeRole as SystemRole),
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  getStats: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const departmentId = await getDepartmentScope(req);
      const data = await facultyProfileService.getStats(
        departmentId ? { department: new Types.ObjectId(departmentId) } : {},
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  generateSalarySlip: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { month, year, lopDays } = req.body;
      const pdf = await facultyProfileService.generateSalarySlip(
        req.params["id"]!,
        month,
        Number(year),
        Number(lopDays || 0),
      );
      res.set("Content-Type", "application/pdf");
      res.set("Content-Disposition", `inline; filename=salary-slip-${month}-${year}.pdf`);
      res.send(pdf);
    } catch (e) {
      next(e);
    }
  },

  generateExperienceLetter: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { dateOfRelieving, principalName } = req.body;
      const pdf = await facultyProfileService.generateExperienceLetter(
        req.params["id"]!,
        dateOfRelieving,
        req.user?.name ?? "Authorized Officer",
        principalName || req.user?.name || "Principal",
      );
      res.set("Content-Type", "application/pdf");
      res.set("Content-Disposition", "inline; filename=experience-letter.pdf");
      res.send(pdf);
    } catch (e) {
      next(e);
    }
  },
};

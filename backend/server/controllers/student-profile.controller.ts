import type { Request, Response, NextFunction } from "express";
import { studentProfileService } from "../services";
import { applyDepartmentScope, assertDepartmentAccess } from "../utils/ownership.util";
import { SystemRole } from "../constants/roles";
import { studentAbcService } from "../services/student-abc.service";

const SENSITIVE_ROLES = new Set<SystemRole>([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.DEAN_ACADEMIC,
  SystemRole.ADMINISTRATION_OFFICE,
  SystemRole.ASSISTANT_ADMINISTRATION_OFFICER,
  SystemRole.ADMISSION_INCHARGE,
  SystemRole.SCHOLARSHIP_CELL,
]);

const canViewSensitive = (req: Request) => SENSITIVE_ROLES.has(req.activeRole as SystemRole);

export const studentProfileController = {
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await studentProfileService.create(req.body, req.user?._id.toString() || "");
      res.status(201).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, ...query } = req.query as Record<string, string>;
      let scopedQuery: Record<string, unknown> = query;
      // Apply department scope if no specific academic program or department is explicitly requested
      if (!query["department"] && !query["program"]) {
        scopedQuery = await applyDepartmentScope(req, query, "department");
      }
      const data = await studentProfileService.list(
        scopedQuery,
        Number(page || 1),
        Number(limit || 20),
        canViewSensitive(req),
      );
      res.json({ success: true, ...data });
    } catch (e) {
      next(e);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await studentProfileService.getById(req.params["id"]!, canViewSensitive(req));
      await assertDepartmentAccess(req, data?.department);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  getMyProfile: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await studentProfileService.getByUserId(req.user?._id.toString() || "");
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  getMyAbcLedger: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await studentAbcService.myLedger(String(req.user?._id ?? ""));
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.body.department) await assertDepartmentAccess(req, req.body.department);
      const current = await studentProfileService.getById(req.params["id"]!, false);
      await assertDepartmentAccess(req, current?.department);
      const data = await studentProfileService.update(
        req.params["id"]!,
        req.body,
        req.user?._id.toString() || "",
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  setRegistrationNumber: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { registrationNumber } = req.body as { registrationNumber: string };
      const current = await studentProfileService.getById(req.params["id"]!, false);
      await assertDepartmentAccess(req, current?.department);
      const data = await studentProfileService.setRegistrationNumber(
        req.params["id"]!,
        registrationNumber,
        req.user?._id.toString() || "",
      );
      res.json({ success: true, data, message: "University registration number updated" });
    } catch (e) {
      next(e);
    }
  },

  exportCsv: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { csv, count } = await studentProfileService.exportCsv(
        (await applyDepartmentScope(
          req,
          req.query as Record<string, string>,
          "department",
        )) as Record<string, string>,
      );
      const stamp = new Date().toISOString().slice(0, 10);
      res.set("Content-Type", "text/csv; charset=utf-8");
      res.set("Content-Disposition", `attachment; filename=students-${stamp}.csv`);
      res.set("X-Total-Rows", String(count));
      res.send(csv);
    } catch (e) {
      next(e);
    }
  },

  updateMyProfile: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await studentProfileService.updateMyProfile(
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
      const current = await studentProfileService.getById(req.params["id"]!, false);
      await assertDepartmentAccess(req, current?.department);
      await studentProfileService.delete(req.params["id"]!);
      res.json({ success: true, message: "Student profile deleted" });
    } catch (e) {
      next(e);
    }
  },

  promoteSemester: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const current = await studentProfileService.getById(req.params["id"]!, false);
      await assertDepartmentAccess(req, current?.department);
      const data = await studentProfileService.promoteSemester(
        req.params["id"]!,
        req.user?._id.toString() || "",
      );
      res.json({ success: true, data, message: "Student promoted to next semester" });
    } catch (e) {
      next(e);
    }
  },

  getStats: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter = await applyDepartmentScope(req, {}, "department");
      const data = await studentProfileService.getStats(filter);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  generateBonafide: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const current = await studentProfileService.getById(req.params["id"]!, false);
      await assertDepartmentAccess(req, current?.department);
      const { purpose } = req.body;
      const pdf = await studentProfileService.generateBonafide(
        req.params["id"]!,
        purpose,
        req.user?.name ?? "Authorized Officer",
        String(req.activeRole ?? "Authorized Officer"),
      );
      res.set("Content-Type", "application/pdf");
      res.set("Content-Disposition", "inline; filename=bonafide.pdf");
      res.send(pdf);
    } catch (e) {
      next(e);
    }
  },
};

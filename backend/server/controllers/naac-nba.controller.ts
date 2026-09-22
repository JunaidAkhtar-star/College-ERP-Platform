import type { Request, Response, NextFunction } from "express";
import { naacNbaService } from "../services/naac-nba.service";
import { SystemRole } from "../constants/roles";
import {
  applyDepartmentScope,
  assertDepartmentAccess,
  getDepartmentScope,
} from "../utils/ownership.util";

export const naacNbaController = {
  // ─── NAAC ─────────────────────────────────────────────────────────────────

  listEvidence: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { criterion, academicYear, status, page, limit } = req.query;
      const filter: Record<string, unknown> = {};
      if (criterion) filter.criterion = criterion;
      if (academicYear) filter.academicYear = academicYear;
      if (status) filter.status = status;
      if (req.activeRole === SystemRole.FACULTY) filter.submittedBy = req.user!._id;
      const result = await naacNbaService.listEvidence(
        filter,
        Number(page) || 1,
        Number(limit) || 20,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  getEvidence: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ev = await naacNbaService.getEvidence(req.params.id);
      if (
        req.activeRole === SystemRole.FACULTY &&
        String(ev.submittedBy?._id ?? ev.submittedBy) !== String(req.user!._id)
      ) {
        res
          .status(403)
          .json({ success: false, error: { message: "You can access only your own evidence" } });
        return;
      }
      res.json({ success: true, data: ev });
    } catch (err) {
      next(err);
    }
  },

  createEvidence: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const submittedBy = (req.user!._id as unknown as string).toString();
      const ev = await naacNbaService.createEvidence({ ...req.body, submittedBy });
      res.status(201).json({ success: true, data: ev });
    } catch (err) {
      next(err);
    }
  },

  updateEvidence: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.user!._id as unknown as string).toString();
      const ev = await naacNbaService.updateEvidence(req.params.id, req.body, userId);
      res.json({ success: true, data: ev });
    } catch (err) {
      next(err);
    }
  },

  submitEvidence: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ev = await naacNbaService.submitEvidence(req.params.id, String(req.user!._id));
      res.json({ success: true, data: ev });
    } catch (err) {
      next(err);
    }
  },

  reviewEvidence: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reviewedBy = (req.user!._id as unknown as string).toString();
      const { status, reviewNotes, score } = req.body;
      const ev = await naacNbaService.reviewEvidence(
        req.params.id,
        status,
        reviewedBy,
        reviewNotes,
        score,
      );
      res.json({ success: true, data: ev });
    } catch (err) {
      next(err);
    }
  },

  criterionSummary: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const academicYear = String(req.query.academicYear);
      const data = await naacNbaService.criterionSummary(academicYear);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  // ─── NBA ──────────────────────────────────────────────────────────────────

  listReports: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { departmentId, academicYear, program, status, page, limit } = req.query;
      const filter: Record<string, unknown> = {};
      if (departmentId) filter.departmentId = departmentId;
      if (academicYear) filter.academicYear = academicYear;
      if (program) filter.program = program;
      if (status) filter.status = status;
      const scopedFilter = await applyDepartmentScope(req, filter);
      const result = await naacNbaService.listReports(
        scopedFilter,
        Number(page) || 1,
        Number(limit) || 20,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  getReport: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await naacNbaService.getReport(req.params.id);
      await assertDepartmentAccess(req, report.departmentId);
      res.json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  },

  createReport: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const generatedBy = (req.user!._id as unknown as string).toString();
      const departmentId = await getDepartmentScope(req);
      const report = await naacNbaService.createReport({
        ...req.body,
        ...(departmentId ? { departmentId } : {}),
        generatedBy,
      });
      res.status(201).json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  },

  updateReport: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const current = await naacNbaService.getReport(req.params.id);
      await assertDepartmentAccess(req, current.departmentId);
      const report = await naacNbaService.updateReport(req.params.id, req.body);
      res.json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  },

  approveReport: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const approvedBy = (req.user!._id as unknown as string).toString();
      const report = await naacNbaService.approveReport(
        req.params.id,
        approvedBy,
        String(req.body.comments ?? "").trim(),
      );
      res.json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  },

  poDepartmentSummary: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { departmentId, academicYear } = req.query;
      await assertDepartmentAccess(req, departmentId);
      const data = await naacNbaService.poDepartmentSummary(
        departmentId as string,
        academicYear as string,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};

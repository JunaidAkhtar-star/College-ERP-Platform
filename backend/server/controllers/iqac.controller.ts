import type { Request, Response, NextFunction } from "express";
import { iqacService } from "../services";
import {
  applyDepartmentScope,
  assertDepartmentAccess,
  getDepartmentScope,
} from "../utils/ownership.util";

export const iqacController = {
  // Feedback
  submitFeedback: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await iqacService.submitFeedback({ ...req.body, respondentId: req.user!._id }, [
        String(req.activeRole),
      ]);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  getFeedback: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { feedbackType, academicYear, semesterType } = req.query;
      const filter: Record<string, unknown> = {};
      if (feedbackType) filter.feedbackType = feedbackType;
      if (academicYear) filter.academicYear = academicYear;
      if (semesterType) filter.semesterType = semesterType;
      const result = await iqacService.getFeedback(
        filter,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  getFeedbackAnalysis: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { feedbackType, academicYear, targetId } = req.query;
      const data = await iqacService.getFeedbackAnalysis(
        feedbackType as string,
        academicYear as string,
        targetId as string,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  // Audits
  listAudits: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { academicYear, auditType, departmentId, status } = req.query;
      const filter: Record<string, unknown> = {};
      if (academicYear) filter.academicYear = academicYear;
      if (auditType) filter.auditType = auditType;
      if (departmentId) filter.departmentId = departmentId;
      if (status) filter.status = status;
      const result = await iqacService.getAudits(
        await applyDepartmentScope(req, filter),
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  getAuditById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await iqacService.getAuditById(req.params.id);
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

  createAudit: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await iqacService.createAudit({ ...req.body, createdBy: req.user!._id });
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  updateAudit: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await iqacService.updateAudit(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  // CO-PO Attainment
  getAttainment: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { academicYear, subjectId, section } = req.query;
      const data = await iqacService.getAttainment(
        academicYear as string,
        subjectId as string,
        section as string,
        await getDepartmentScope(req),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  saveAttainment: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const current = await iqacService.getAttainmentById(req.params["id"]);
      await assertDepartmentAccess(req, current.departmentId);
      const data = await iqacService.updateAttainmentActionPlans(
        req.params["id"],
        req.body.actions,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  submitAttainment: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const current = await iqacService.getAttainmentById(req.params["id"]);
      await assertDepartmentAccess(req, current.departmentId);
      const data = await iqacService.submitAttainment(req.params["id"], req.user!._id.toString());
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  approveAttainment: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await iqacService.approveAttainment(req.params["id"], req.user!._id.toString());
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  getPOSummary: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { academicYear, program } = req.query;
      const data = await iqacService.getPOAttainmentSummary(
        academicYear as string,
        program as string,
        await getDepartmentScope(req),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  getCourseOutcomes: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await iqacService.getCourseOutcomes(String(req.query["subjectId"] || ""));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  /** POST /iqac/co-po/auto-calculate — OBE auto-calculation (SRS §4.8 / NBA) */
  autoCalculateCOPO: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const calculatedBy = (req.user!._id as unknown as string).toString();
      const departmentScope = await getDepartmentScope(req);
      const data = await iqacService.autoCalculateCOPOAttainment({
        ...req.body,
        calculatedBy,
        departmentScope,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};

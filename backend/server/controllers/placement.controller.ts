import type { Request, Response, NextFunction } from "express";
import type { UploadedFile } from "express-fileupload";
import { placementService } from "../services";
import { SystemRole } from "../constants/roles";
import { PlacementApplicationStatus } from "../models/placement-application.model";

export const placementController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, academicYear } = req.query;
      const filter: Record<string, unknown> = {};
      if (status) filter.status = status;
      if (academicYear) filter.academicYear = academicYear;
      const result = await placementService.getAll(
        filter,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
        req.activeRole === SystemRole.STUDENT ? (req.user!._id as unknown as string) : undefined,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await placementService.getById(req.params.id);
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
      const data = await placementService.create({ ...req.body, createdBy: req.user!._id });
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await placementService.update(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  transition: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await placementService.transitionDrive(
        req.params.id,
        req.body.action,
        req.user!._id as unknown as string,
        req.body.reason,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  register: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await placementService.register(
        req.params.id,
        (req.user!._id as unknown as string).toString(),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  shortlist: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentIds } = req.body;
      const data = await placementService.shortlistStudents(
        req.params.id,
        studentIds,
        req.user!._id as unknown as string,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  select: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { applicationIds } = req.body;
      const data = await placementService.selectStudents(
        req.params.id,
        applicationIds,
        req.user!._id as unknown as string,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  stats: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await placementService.getStats();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  // ── Round Management ───────────────────────────────────────────────────────

  declareRoundResults: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { roundNo, roundName, results } = req.body;
      const data = await placementService.declareRoundResults(
        req.params.id,
        roundNo,
        roundName,
        results,
        req.user!._id as unknown as string,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  // ── Offers ────────────────────────────────────────────────────────────────

  issueOffer: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.files?.offerLetter as UploadedFile | undefined;
      const data = await placementService.issueOffer(
        req.params.applicationId,
        req.body,
        file,
        req.user!._id as unknown as string,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  respondToOffer: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await placementService.respondToOffer(
        req.params.applicationId,
        req.user!._id as unknown as string,
        req.body.response,
        req.body.reason,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  // ── Applications ──────────────────────────────────────────────────────────

  getDriveApplications: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawStatus = typeof req.query.status === "string" ? req.query.status : undefined;
      const status = Object.values(PlacementApplicationStatus).includes(
        rawStatus as PlacementApplicationStatus,
      )
        ? (rawStatus as PlacementApplicationStatus)
        : undefined;
      const data = await placementService.getDriveApplications(req.params.id, status);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  getDriveApplicationCounts: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await placementService.getDriveApplicationCounts(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  getApplication: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await placementService.getApplication(
        req.params.applicationId,
        req.activeRole === SystemRole.STUDENT ? (req.user!._id as unknown as string) : undefined,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  myApplications: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await placementService.getStudentApplications(
        (req.user!._id as unknown as string).toString(),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};

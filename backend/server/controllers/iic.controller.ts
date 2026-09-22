/**
 * @file iic.controller.ts
 */
import type { Request, Response, NextFunction } from "express";
import { iicService } from "../services/iic.service";
import { SystemRole } from "../constants/roles";

const actor = (req: Request) => ({
  _id: req.user!._id,
  roles: req.activeRole ? [req.activeRole as SystemRole] : [],
});

export const iicController = {
  listProjects: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await iicService.listProjects(
        req.query.status as
          | "submitted"
          | "screening"
          | "evaluation"
          | "approved"
          | "incubating"
          | "completed"
          | "rejected"
          | undefined,
        actor(req),
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  getProject: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await iicService.getProject(req.params.id, actor(req));
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  createProject: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await iicService.createProject(req.body, String(req.user?._id));
      res.status(201).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  transitionProject: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await iicService.transitionProject(
        req.params.id,
        req.body.status,
        req.body.note,
        req.body.score,
        String(req.user?._id),
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  assignMentor: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await iicService.assignMentor(
        req.params.id,
        req.body.mentorId,
        String(req.user?._id),
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  addMilestone: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await iicService.addMilestone(req.params.id, req.body, String(req.user?._id));
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  completeMilestone: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await iicService.completeMilestone(
        req.params.id,
        Number(req.params.index),
        req.body.evidenceUrl,
        String(req.user?._id),
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  updateFunding: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await iicService.updateFunding(
        req.params.id,
        Number(req.body.allocated),
        Number(req.body.spent),
        String(req.user?._id),
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  addIpRecord: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await iicService.addIpRecord(req.params.id, req.body, String(req.user?._id));
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  recordOutcome: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await iicService.recordOutcome(req.params.id, req.body, String(req.user?._id));
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, ...filter } = req.query as Record<string, string>;
      const data = await iicService.list(filter, Number(page || 1), Number(limit || 50));
      res.json({ success: true, ...data });
    } catch (e) {
      next(e);
    }
  },
  get: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await iicService.get(req.params["id"]!);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await iicService.create(req.body);
      res.status(201).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await iicService.update(req.params["id"]!, req.body);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  delete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await iicService.delete(req.params["id"]!);
      res.json({ success: true, message: "Activity deleted" });
    } catch (e) {
      next(e);
    }
  },
  markReported: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await iicService.markReported(req.params["id"]!);
      res.json({ success: true, data, message: "Marked as reported to MIC" });
    } catch (e) {
      next(e);
    }
  },
  stats: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await iicService.stats(req.query["academicYear"] as string | undefined);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
};

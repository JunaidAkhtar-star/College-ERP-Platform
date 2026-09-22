/**
 * @file research-development.controller.ts
 */
import type { Request, Response, NextFunction } from "express";
import { researchDevelopmentService } from "../services/research-development.service";

export const researchDevelopmentController = {
  listProjects: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, ...filter } = req.query as Record<string, string>;
      const data = await researchDevelopmentService.listProjects(
        filter,
        Number(page || 1),
        Number(limit || 50),
      );
      res.json({ success: true, ...data });
    } catch (e) {
      next(e);
    }
  },
  getProject: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await researchDevelopmentService.getProject(req.params["id"]!);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  createProject: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await researchDevelopmentService.createProject(req.body);
      res.status(201).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  updateProject: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const update = { ...req.body };
      if (update.ethicsStatus && update.ethicsStatus !== "pending") {
        update.ethicsReviewedBy = req.user!._id;
        update.ethicsReviewedAt = new Date();
      }
      const data = await researchDevelopmentService.updateProject(req.params["id"]!, update);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  deleteProject: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await researchDevelopmentService.deleteProject(req.params["id"]!);
      res.json({ success: true, message: "Project deleted" });
    } catch (e) {
      next(e);
    }
  },

  listPublications: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, ...filter } = req.query as Record<string, string>;
      const data = await researchDevelopmentService.listPublications(
        filter,
        Number(page || 1),
        Number(limit || 50),
      );
      res.json({ success: true, ...data });
    } catch (e) {
      next(e);
    }
  },
  createPublication: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await researchDevelopmentService.createPublication(req.body);
      res.status(201).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  updatePublication: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const update = { ...req.body };
      if (update.verificationStatus === "verified") {
        update.verifiedBy = req.user!._id;
        update.verifiedAt = new Date();
      }
      const data = await researchDevelopmentService.updatePublication(req.params["id"]!, update);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  deletePublication: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await researchDevelopmentService.deletePublication(req.params["id"]!);
      res.json({ success: true, message: "Publication deleted" });
    } catch (e) {
      next(e);
    }
  },
  stats: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await researchDevelopmentService.stats();
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
};

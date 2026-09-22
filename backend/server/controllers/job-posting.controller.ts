import type { Request, Response, NextFunction } from "express";
import type { UploadedFile } from "express-fileupload";
import { jobPostingService } from "../services/job-posting.service";

export const jobPostingController = {
  stats: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await jobPostingService.stats() });
    } catch (error) {
      next(error);
    }
  },
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = "1", limit = "20", ...query } = req.query as Record<string, string>;
      const result = await jobPostingService.list(query, +page, +limit);
      res.json({ success: true, ...result });
    } catch (e) {
      next(e);
    }
  },

  studentList: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = "1", limit = "20", ...query } = req.query as Record<string, string>;
      const result = await jobPostingService.list(
        query,
        +page,
        +limit,
        (req.user!._id as unknown as string).toString(),
      );
      res.json({ success: true, ...result });
    } catch (e) {
      next(e);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await jobPostingService.getById(
        req.params.id,
        req.activeRole === "student" ? (req.user!._id as unknown as string).toString() : undefined,
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await jobPostingService.create(
        req.body,
        (req.user!._id as unknown as string).toString(),
      );
      res.status(201).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await jobPostingService.update(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  close: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await jobPostingService.close(req.params.id);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  publish: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await jobPostingService.publish(req.params.id);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  markInterest: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await jobPostingService.markInterest(
        req.params.id,
        (req.user!._id as unknown as string).toString(),
      );
      res.json({ success: true, ...result });
    } catch (e) {
      next(e);
    }
  },

  removeInterest: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await jobPostingService.removeInterest(
        req.params.id,
        (req.user!._id as unknown as string).toString(),
      );
      res.json({ success: true, ...result });
    } catch (e) {
      next(e);
    }
  },

  markApplied: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await jobPostingService.markApplied(
        req.params.id,
        (req.user!._id as unknown as string).toString(),
      );
      res.json({ success: true, ...result });
    } catch (e) {
      next(e);
    }
  },

  uploadJD: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.files?.jd as UploadedFile | undefined;
      if (!file)
        return res
          .status(400)
          .json({ success: false, error: { message: "JD file required (field: jd)" } });
      const data = await jobPostingService.uploadJD(req.params.id, file);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
};

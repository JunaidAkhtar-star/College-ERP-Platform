import type { Request, Response, NextFunction } from "express";
import type { UploadedFile } from "express-fileupload";
import { trainingSessionService } from "../services/training-session.service";

export const trainingSessionController = {
  stats: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await trainingSessionService.stats() });
    } catch (error) {
      next(error);
    }
  },
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = "1", limit = "20", ...query } = req.query as Record<string, string>;
      const result = await trainingSessionService.list(
        query,
        +page,
        +limit,
        req.activeRole === "student" ? (req.user!._id as unknown as string).toString() : undefined,
      );
      res.json({ success: true, ...result });
    } catch (e) {
      next(e);
    }
  },

  upcoming: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const days = +(req.query.days as string) || 7;
      const data = await trainingSessionService.getUpcoming(
        days,
        req.activeRole === "student" ? (req.user!._id as unknown as string).toString() : undefined,
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await trainingSessionService.getById(
        req.params.id,
        req.activeRole === "student" ? (req.user!._id as unknown as string).toString() : undefined,
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  mySchedule: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await trainingSessionService.getMySchedule(
        (req.user!._id as unknown as string).toString(),
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await trainingSessionService.create(
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
      const data = await trainingSessionService.update(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await trainingSessionService.delete(req.params.id);
      res.json({ success: true, message: "Training session deleted" });
    } catch (e) {
      next(e);
    }
  },

  publish: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await trainingSessionService.publish(req.params.id);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  start: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await trainingSessionService.start(req.params.id);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  cancel: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await trainingSessionService.cancel(req.params.id, req.body.reason);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  register: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await trainingSessionService.register(
        req.params.id,
        (req.user!._id as unknown as string).toString(),
      );
      res.json({ success: true, ...result });
    } catch (e) {
      next(e);
    }
  },

  unregister: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await trainingSessionService.unregister(
        req.params.id,
        (req.user!._id as unknown as string).toString(),
      );
      res.json({ success: true, ...result });
    } catch (e) {
      next(e);
    }
  },

  markAttendance: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { attendance } = req.body;
      const data = await trainingSessionService.markAttendance(
        req.params.id,
        attendance,
        (req.user!._id as unknown as string).toString(),
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  uploadMaterial: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.files?.material as UploadedFile | undefined;
      if (!file)
        return res
          .status(400)
          .json({ success: false, error: { message: "Material file required (field: material)" } });
      const data = await trainingSessionService.uploadMaterial(req.params.id, file);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
};

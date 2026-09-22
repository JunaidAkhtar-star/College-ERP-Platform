import type { NextFunction, Request, Response } from "express";
import { jobQueueService } from "../services/job-queue.service";

export const operationsController = {
  outboxSummary: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await jobQueueService.summary() });
    } catch (error) {
      next(error);
    }
  },
  deadLetters: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await jobQueueService.listDead() });
    } catch (error) {
      next(error);
    }
  },
  replayDeadLetter: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(202).json({
        success: true,
        data: await jobQueueService.replay(req.params.id, String(req.user?._id), req.body.reason),
        message: "Dead-letter replay queued",
      });
    } catch (error) {
      next(error);
    }
  },
};

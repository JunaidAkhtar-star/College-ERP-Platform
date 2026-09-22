import type { Request, Response, NextFunction } from "express";
import { taskService } from "../services/task.service";

export const taskController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await taskService.getTasks(req.user!._id as unknown as string, [
        String(req.activeRole),
      ]);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await taskService.getTaskById(req.params.id, req.user!._id.toString(), [
        String(req.activeRole),
      ]);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const assignerId = req.user!._id as unknown as string;
      const assignerName = req.user!.name;
      const task = await taskService.createTask(
        req.body,
        assignerId,
        assignerName,
        [String(req.activeRole)],
        req.user!.department?.toString(),
      );
      res.status(201).json({ success: true, data: task });
    } catch (err) {
      next(err);
    }
  },

  updateStatus: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!._id as unknown as string;
      const { status, completionNote, completionEvidence } = req.body;
      if (!["todo", "in_progress", "completed"].includes(status)) {
        res.status(400).json({ success: false, message: "Invalid status" });
        return;
      }
      const data = await taskService.updateTaskStatus(req.params.id, userId, status, {
        note: completionNote,
        evidence: completionEvidence,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  decide: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!._id as unknown as string;
      const userName = req.user!.name;
      const { action, feedback } = req.body;
      if (!["approve", "reject"].includes(action)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid action. Use 'approve' or 'reject'" });
        return;
      }
      const data = await taskService.approveOrRejectTask(
        req.params.id,
        userId,
        userName,
        action,
        feedback,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  comment: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await taskService.addComment(
        req.params.id,
        req.user!._id.toString(),
        req.user!.name,
        req.body.message,
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};

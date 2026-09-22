import type { NextFunction, Request, Response } from "express";
import { disciplineService } from "../services/discipline.service";

const identity = (req: Request) => ({
  id: String(req.user?._id),
  name: req.user?.name || "User",
  roles: req.activeRole ? [String(req.activeRole)] : [],
});
export const disciplineController = {
  metadata: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await disciplineService.metadata() });
    } catch (error) {
      next(error);
    }
  },
  createCategory: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({
        success: true,
        data: await disciplineService.createCategory(req.body, String(req.user?._id)),
      });
    } catch (error) {
      next(error);
    }
  },
  people: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await disciplineService.people(String(req.query["q"] ?? "")),
      });
    } catch (error) {
      next(error);
    }
  },
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await disciplineService.list(identity(req), {
          status: typeof req.query["status"] === "string" ? req.query["status"] : undefined,
          severity: typeof req.query["severity"] === "string" ? req.query["severity"] : undefined,
        }),
      });
    } catch (error) {
      next(error);
    }
  },
  get: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await disciplineService.get(String(req.params["id"]), identity(req)),
      });
    } catch (error) {
      next(error);
    }
  },
  report: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res
        .status(201)
        .json({ success: true, data: await disciplineService.report(req.body, identity(req)) });
    } catch (error) {
      next(error);
    }
  },
  assign: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await disciplineService.assign(
          String(req.params["id"]),
          req.body.assigneeId,
          identity(req),
        ),
      });
    } catch (error) {
      next(error);
    }
  },
  transition: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await disciplineService.transition(String(req.params["id"]), req.body, identity(req)),
      });
    } catch (error) {
      next(error);
    }
  },
  addEvent: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({
        success: true,
        data: await disciplineService.addEvent(String(req.params["id"]), req.body, identity(req)),
      });
    } catch (error) {
      next(error);
    }
  },
  sanction: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({
        success: true,
        data: await disciplineService.sanction(String(req.params["id"]), req.body, identity(req)),
      });
    } catch (error) {
      next(error);
    }
  },
  appeal: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await disciplineService.appeal(
          String(req.params["id"]),
          req.body.reason,
          identity(req),
        ),
      });
    } catch (error) {
      next(error);
    }
  },
};

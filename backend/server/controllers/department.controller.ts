import type { Request, Response, NextFunction } from "express";
import { departmentService } from "../services";

export const departmentController = {
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dept = await departmentService.create(req.body, req.user?._id.toString() || "");
      res.status(201).json({ success: true, data: dept });
    } catch (e) {
      next(e);
    }
  },

  getAll: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const depts = await departmentService.getAll();
      res.json({ success: true, data: depts });
    } catch (e) {
      next(e);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dept = await departmentService.getById(req.params["id"]!);
      res.json({ success: true, data: dept });
    } catch (e) {
      next(e);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dept = await departmentService.update(
        req.params["id"]!,
        req.body,
        String(req.user?._id),
      );
      res.json({ success: true, data: dept });
    } catch (e) {
      next(e);
    }
  },

  deactivate: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dept = await departmentService.deactivate(req.params["id"]!, String(req.user?._id));
      res.json({ success: true, data: dept, message: "Department deactivated" });
    } catch (e) {
      next(e);
    }
  },
};

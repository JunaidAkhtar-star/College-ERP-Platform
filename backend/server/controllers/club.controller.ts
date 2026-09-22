/**
 * @file club.controller.ts
 */
import type { Request, Response, NextFunction } from "express";
import { clubService } from "../services/club.service";
import { Module, PermissionAction } from "../constants/permissions";

const canApprove = (req: Request) =>
  Boolean(
    req.permissions?.some(
      (permission) =>
        permission.module === Module.CLUBS && permission.actions.includes(PermissionAction.APPROVE),
    ),
  );

export const clubController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, ...filter } = req.query as Record<string, string>;
      const data = await clubService.list(filter, Number(page || 1), Number(limit || 50));
      res.json({ success: true, ...data });
    } catch (e) {
      next(e);
    }
  },
  get: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await clubService.get(req.params["id"]!);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await clubService.create(req.body, req.user?._id.toString() || "");
      res.status(201).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await clubService.update(
        req.params.id,
        req.body,
        req.user?._id.toString() || "",
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  delete: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await clubService.delete(req.params.id, req.user?._id.toString() || "");
      res.json({ success: true, message: "Club deleted" });
    } catch (e) {
      next(e);
    }
  },
  addMember: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await clubService.addMember(req.params["id"]!, req.body);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  removeMember: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await clubService.removeMember(req.params["id"]!, req.params["userId"]!);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  addActivity: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await clubService.addActivity(req.params["id"]!, req.body);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  requestMembership: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await clubService.requestMembership(
        req.params.id,
        String(req.user?._id),
        req.body.message,
      );
      res.status(201).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  membershipRequests: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await clubService.membershipRequests(String(req.user?._id), canApprove(req));
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  decideMembership: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await clubService.decideMembership(
        req.params.requestId,
        req.body.decision,
        req.body.note,
        String(req.user?._id),
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  stats: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await clubService.stats();
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
};

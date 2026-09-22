/**
 * @file nav.controller.ts
 * @description Endpoints for the sidebar nav system.
 *   - GET    /nav/me      — role-filtered tree for the current user
 *   - GET    /nav         — full list (admin)
 *   - POST   /nav         — create item (admin)
 *   - PUT    /nav/:id     — update item (admin)
 *   - DELETE /nav/:id     — delete item (admin); cascades child links
 *   - POST   /nav/reorder — bulk reorder (admin)
 */

import type { Request, Response, NextFunction } from "express";
import { navService } from "../services/nav.service";

export const navController = {
  me: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id.toString() ?? "";
      const data = await navService.getForUser(
        userId,
        req.activeRole,
        req.allowedNavItems,
        req.permissions,
        req.enabledModuleSlugs,
        req.entitlementEnforced,
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  list: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await navService.list();
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await navService.create(req.body);
      res.status(201).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await navService.update(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await navService.remove(req.params.id);
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  },

  reorder: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await navService.reorder(req.body.items ?? []);
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  },
};

/**
 * @file store.controller.ts
 */
import type { Request, Response, NextFunction } from "express";
import { storeService } from "../services/store.service";
import type { TStoreRequestStatus } from "../models/store.model";
import { SystemRole } from "../constants/roles";

const STORE_MANAGERS = new Set<SystemRole>([
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.PRINCIPAL,
  SystemRole.STORE,
  SystemRole.ADMINISTRATION_OFFICE,
]);

export const storeController = {
  // ── Items ────────────────────────────────────────────────────────────────
  listItems: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, ...filter } = req.query as Record<string, string>;
      const data = await storeService.listItems(filter, Number(page || 1), Number(limit || 50));
      res.json({ success: true, ...data });
    } catch (e) {
      next(e);
    }
  },
  getItem: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await storeService.getItem(req.params["id"]!);
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  createItem: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await storeService.createItem(req.body, req.user?._id.toString() || "");
      res.status(201).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  updateItem: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await storeService.updateItem(
        req.params.id,
        req.body,
        req.user?._id.toString() || "",
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  adjustStock: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { delta, note } = req.body as { delta: number; note?: string };
      const data = await storeService.adjustStock(
        req.params.id,
        Number(delta),
        note ?? "",
        req.user?._id.toString() || "",
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  deleteItem: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await storeService.deleteItem(req.params.id, req.user?._id.toString() || "");
      res.json({ success: true, message: "Item deleted" });
    } catch (e) {
      next(e);
    }
  },
  stats: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await storeService.stats();
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  listMovements: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await storeService.listMovements(
        req.query.itemId as string | undefined,
        Number(req.query.page || 1),
        Number(req.query.limit || 100),
      );
      res.json({ success: true, ...data });
    } catch (e) {
      next(e);
    }
  },
  reorderPlan: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await storeService.reorderPlan() });
    } catch (e) {
      next(e);
    }
  },
  reconciliation: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await storeService.reconcileInventory() });
    } catch (e) {
      next(e);
    }
  },

  // ── Requests ─────────────────────────────────────────────────────────────
  listRequests: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, ...filter } = req.query as Record<string, string>;
      if (!STORE_MANAGERS.has(req.activeRole as SystemRole))
        filter.requestedBy = req.user?._id.toString() || "";
      const data = await storeService.listRequests(filter, Number(page || 1), Number(limit || 50));
      res.json({ success: true, ...data });
    } catch (e) {
      next(e);
    }
  },
  createRequest: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const department = req.user?.department;
      const departmentId =
        typeof department === "object" && department && "_id" in department
          ? String(department._id)
          : department
            ? String(department)
            : undefined;
      const data = await storeService.createRequest(req.user!, {
        ...req.body,
        department: departmentId,
      });
      res.status(201).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
  decideRequest: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { decision, remarks } = req.body as {
        decision: TStoreRequestStatus;
        remarks?: string;
      };
      const data = await storeService.decideRequest(
        req.params["id"]!,
        req.user!,
        decision as Exclude<TStoreRequestStatus, "pending">,
        remarks,
      );
      res.json({ success: true, data });
    } catch (e) {
      next(e);
    }
  },
};

import type { Request, Response, NextFunction } from "express";
import createError from "http-errors";
import { transportService } from "../services";
import { SystemRole } from "../constants/roles";

export const transportController = {
  listRoutes: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { isActive } = req.query;
      const filter: Record<string, unknown> = {};
      if (isActive !== undefined) filter.isActive = isActive === "true";
      const result = await transportService.getRoutes(
        filter,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 50,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  addRoute: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await transportService.addRoute(req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  updateRoute: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await transportService.updateRoute(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  listAllocations: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId, academicYear, status, routeId } = req.query;
      const filter: Record<string, unknown> = {};
      if (studentId) filter.studentId = studentId;
      if (academicYear) filter.academicYear = academicYear;
      if (status) filter.status = status;
      if (routeId) filter.routeId = routeId;
      const result = await transportService.getAllocations(
        filter,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  myAllocation: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await transportService.getMyAllocation(req.user!._id.toString());
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  allocate: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId, routeId, academicYear, stopName, monthlyFee } = req.body;
      const data = await transportService.allocate(
        studentId,
        routeId,
        academicYear,
        stopName,
        monthlyFee,
        req.user!._id as unknown as string,
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  cancel: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await transportService.cancel(req.params.id);
      res.json({ success: true, message: "Allocation cancelled" });
    } catch (err) {
      next(err);
    }
  },

  generateFee: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await transportService.generateFee(
        req.body.allocationId,
        req.body.month,
        req.body.dueDate,
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  listFees: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter: Record<string, unknown> = {};
      if (req.activeRole === SystemRole.STUDENT) filter.studentId = req.user!._id;
      else if (req.query.studentId) filter.studentId = req.query.studentId;
      if (req.query.status) filter.status = req.query.status;
      if (req.query.month) filter.month = req.query.month;
      const result = await transportService.listFees(
        filter,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  collectFee: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await transportService.collectFee(
        req.params.id,
        Number(req.body.amount),
        req.body.paymentMode,
        req.user!._id.toString(),
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  // ── GPS ────────────────────────────────────────────────────────────────────
  startTrackingSession: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await transportService.startTrackingSession(
        req.body.routeId,
        req.user!._id.toString(),
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  recordTrackingPosition: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await transportService.recordTrackingPosition(
        req.params.id,
        req.user!._id.toString(),
        req.body,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  stopTrackingSession: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await transportService.stopTrackingSession(req.params.id, req.user!._id.toString());
      res.json({ success: true, message: "Live tracking stopped" });
    } catch (err) {
      next(err);
    }
  },

  listLiveGps: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await transportService.listLiveGps(req.user!._id.toString(), req.activeRole);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  // ── Drivers (M41) ──────────────────────────────────────────────────────────────
  createDriver: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const driver = await transportService.createDriver(req.body);
      res.status(201).json({ success: true, data: driver });
    } catch (err) {
      next(err);
    }
  },
  listDrivers: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { isActive, page, limit } = req.query;
      const filter: Record<string, unknown> = {};
      if (isActive !== undefined) filter.isActive = isActive === "true";
      const result = await transportService.listDrivers(
        filter,
        Number(page) || 1,
        Number(limit) || 20,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },
  getDriver: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const driver = await transportService.getDriver(req.params.id);
      if (!driver) throw createError(404, "Driver not found");
      res.json({ success: true, data: driver });
    } catch (err) {
      next(err);
    }
  },
  updateDriver: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const driver = await transportService.updateDriver(req.params.id, req.body);
      res.json({ success: true, data: driver });
    } catch (err) {
      next(err);
    }
  },
  deleteDriver: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await transportService.deleteDriver(req.params.id);
      res.json({ success: true, message: "Driver removed" });
    } catch (err) {
      next(err);
    }
  },
};

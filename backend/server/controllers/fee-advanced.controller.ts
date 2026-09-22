import type { NextFunction, Request, Response } from "express";
import { feeAdvancedService } from "../services/fee-advanced.service";

const userId = (req: Request) => req.user?._id.toString() || "system";

export const feeAdvancedController = {
  overview: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await feeAdvancedService.overview({
        academicYear:
          typeof req.query["academicYear"] === "string" ? req.query["academicYear"] : undefined,
        studentId: typeof req.query["studentId"] === "string" ? req.query["studentId"] : undefined,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  saveInstallments: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await feeAdvancedService.saveInstallments(
        req.params["recordId"]!,
        req.body.installments,
        req.body.notes,
        userId(req),
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  requestAdjustment: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await feeAdvancedService.requestAdjustment(
        req.params["recordId"]!,
        req.body,
        userId(req),
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  reviewAdjustment: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await feeAdvancedService.reviewAdjustment(
        req.params["id"]!,
        req.body.decision,
        req.body.note,
        userId(req),
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  requestRefund: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await feeAdvancedService.requestRefund(
        req.params["recordId"]!,
        req.body,
        userId(req),
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  reviewRefund: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await feeAdvancedService.reviewRefund(
        req.params["id"]!,
        req.body.decision,
        userId(req),
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  completeRefund: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await feeAdvancedService.completeRefund(
        req.params["id"]!,
        req.body.reference,
        userId(req),
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  importReconciliation: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await feeAdvancedService.importReconciliation(req.body, userId(req));
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
};

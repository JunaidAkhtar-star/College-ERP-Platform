import type { Request, Response, NextFunction } from "express";
import { paymentSettingsService } from "../services/payment-settings.service";
import type { UploadedFile } from "express-fileupload";

export const paymentSettingsController = {
  /** GET /payment-settings — active settings (students see redacted bank numbers) */
  getActive: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = ["super_admin", "accounts_department", "principal"].includes(
        req.activeRole ?? "",
      );
      const data = await paymentSettingsService.getActive(isAdmin);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  /** GET /payment-settings/all — all records (Super Admin only) */
  getAll: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await paymentSettingsService.getAll();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  /** POST /payment-settings — create / update settings */
  upsert: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await paymentSettingsService.upsert(req.body, req.user!._id.toString());
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  /** POST /payment-settings/:id/qr — upload QR code image */
  uploadQr: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.files?.qrCode as UploadedFile | undefined;
      if (!file) {
        res.status(400).json({ success: false, error: { message: "qrCode file is required" } });
        return;
      }
      const data = await paymentSettingsService.uploadQrCode(
        file,
        req.params["id"]!,
        req.user!._id.toString(),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  /** PUT /payment-settings/:id/activate */
  activate: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await paymentSettingsService.activate(
        req.params["id"]!,
        req.user!._id.toString(),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};

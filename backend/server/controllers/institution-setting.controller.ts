/**
 * Institution Setting Controller
 *
 * Exposes endpoints for managing global institution settings.
 */
import type { Request, Response, NextFunction } from "express";
import { institutionSettingService } from "../services/institution-setting.service";
import { responseUtil } from "../utils/response.util";
import type { UploadedFile } from "express-fileupload";

export const institutionSettingController = {
  getSettings: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await institutionSettingService.getSettings(req.tenantId);
      responseUtil.success(res, data);
    } catch (err) {
      next(err);
    }
  },

  updateSettings: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const logo = req.files?.logo as UploadedFile | undefined;
      const favicon = req.files?.favicon as UploadedFile | undefined;

      let accreditations: string[] | undefined;
      if (req.body.accreditations) {
        if (typeof req.body.accreditations === "string") {
          try {
            accreditations = JSON.parse(req.body.accreditations);
          } catch {
            accreditations = req.body.accreditations
              .split(",")
              .map((s: string) => s.trim())
              .filter(Boolean);
          }
        } else if (Array.isArray(req.body.accreditations)) {
          accreditations = req.body.accreditations;
        }
      }

      const data = await institutionSettingService.updateSettings(
        {
          ...req.body,
          accreditations,
        },
        logo,
        favicon,
        req.user?._id as unknown as string,
        req.tenantId,
      );
      responseUtil.success(res, data, "Institution settings updated successfully");
    } catch (err) {
      next(err);
    }
  },

  completeOnboarding: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await institutionSettingService.completeOnboarding(
        req.user?._id as unknown as string,
        req.tenantId,
      );
      responseUtil.success(res, data, "Institution onboarding completed successfully");
    } catch (err) {
      next(err);
    }
  },
};

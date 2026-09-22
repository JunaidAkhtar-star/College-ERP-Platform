import type { NextFunction, Request, Response } from "express";
import { communicationHubService } from "../services/communication-hub.service";
import { getDepartmentScope } from "../utils/ownership.util";
import { SystemRole } from "../constants/roles";
import createError from "http-errors";

const globalManager = (req: Request) =>
  [
    SystemRole.SUPER_ADMIN,
    SystemRole.ADMIN,
    SystemRole.PRINCIPAL,
    SystemRole.DEAN_ACADEMIC,
    SystemRole.ADMINISTRATION_OFFICE,
  ].includes(req.activeRole as SystemRole);

async function campaignScope(req: Request) {
  const departmentId = await getDepartmentScope(req);
  return departmentId
    ? { $or: [{ createdBy: req.user!._id }, { targetDepartments: departmentId }] }
    : {};
}

async function scopedAudience(req: Request) {
  const departmentId = await getDepartmentScope(req);
  if (!departmentId) return req.body;
  const requested = (req.body.targetDepartments as string[] | undefined) ?? [];
  if (requested.some((id) => String(id) !== departmentId)) {
    throw createError(403, "HOD communication is limited to the active department");
  }
  return { ...req.body, targetDepartments: [departmentId] };
}

export const communicationHubController = {
  metadata: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await communicationHubService.metadata(await getDepartmentScope(req)),
      });
    } catch (error) {
      next(error);
    }
  },
  campaigns: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await communicationHubService.listCampaigns(await campaignScope(req)),
      });
    } catch (error) {
      next(error);
    }
  },
  campaign: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await communicationHubService.campaignDetail(
          String(req.params.id),
          await campaignScope(req),
        ),
      });
    } catch (error) {
      next(error);
    }
  },
  audiencePreview: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await communicationHubService.audiencePreview(await scopedAudience(req)),
      });
    } catch (error) {
      next(error);
    }
  },
  templates: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await communicationHubService.listTemplates() });
    } catch (error) {
      next(error);
    }
  },
  suppressions: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await communicationHubService.listSuppressions() });
    } catch (error) {
      next(error);
    }
  },
  suppress: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({
        success: true,
        data: await communicationHubService.suppress(
          req.body.channel,
          req.body.destination,
          req.body.reason,
          String(req.user?._id),
        ),
      });
    } catch (error) {
      next(error);
    }
  },
  releaseSuppression: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await communicationHubService.releaseSuppression(
          String(req.params.id),
          String(req.user?._id),
        ),
      });
    } catch (error) {
      next(error);
    }
  },
  saveTemplate: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await communicationHubService.saveTemplate(
        await scopedAudience(req),
        String(req.user?._id),
        req.params["id"],
      );
      res.status(req.params["id"] ? 200 : 201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  createCampaign: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await communicationHubService.createCampaign(
        req.body,
        String(req.user?._id),
        req.user?.name || "Institution",
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  cancelCampaign: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await communicationHubService.cancelCampaign(
        String(req.params["id"]),
        String(req.user?._id),
        globalManager(req),
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  retryCampaign: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await communicationHubService.retryCampaign(
        String(req.params.id),
        String(req.user?._id),
        req.body.reason,
        globalManager(req),
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
};

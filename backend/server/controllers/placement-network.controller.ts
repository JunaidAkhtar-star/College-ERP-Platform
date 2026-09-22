import type { NextFunction, Request, Response } from "express";
import { placementNetworkService } from "../services/placement-network.service";

function context(req: Request) {
  if (!req.tenantId || !req.user?._id) throw new Error("Tenant authentication is required");
  return { tenantId: req.tenantId, userId: String(req.user._id) };
}

export const placementNetworkController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = context(req);
      res.json({ success: true, data: await placementNetworkService.list(tenantId) });
    } catch (error) {
      next(error);
    }
  },
  publish: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, userId } = context(req);
      const data = await placementNetworkService.publish(tenantId, req.params.id, userId, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  withdraw: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = context(req);
      res.json({
        success: true,
        data: await placementNetworkService.withdrawListing(tenantId, req.params.listingId),
      });
    } catch (error) {
      next(error);
    }
  },
  request: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, userId } = context(req);
      const data = await placementNetworkService.requestParticipation(
        tenantId,
        req.params.listingId,
        userId,
        req.body,
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  requests: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = context(req);
      res.json({ success: true, data: await placementNetworkService.requests(tenantId) });
    } catch (error) {
      next(error);
    }
  },
  decide: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, userId } = context(req);
      const data = await placementNetworkService.decideRequest(
        tenantId,
        req.params.requestId,
        req.body.decision,
        userId,
        req.body.decisionNote,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
};

import type { RequestHandler } from "express";
import { advancementService } from "../services/advancement.service";
import { responseUtil } from "../utils/response.util";
export const advancementController: Record<string, RequestHandler> = {
  async dashboard(_q, r, n) {
    try {
      responseUtil.success(r, await advancementService.dashboard());
    } catch (e) {
      n(e);
    }
  },
  async funds(_q, r, n) {
    try {
      responseUtil.success(r, await advancementService.funds());
    } catch (e) {
      n(e);
    }
  },
  async createFund(q, r, n) {
    try {
      responseUtil.created(
        r,
        await advancementService.createFund(q.user!._id.toString(), q.body),
        "Advancement fund created",
      );
    } catch (e) {
      n(e);
    }
  },
  async campaigns(_q, r, n) {
    try {
      responseUtil.success(r, await advancementService.campaigns());
    } catch (e) {
      n(e);
    }
  },
  async createCampaign(q, r, n) {
    try {
      responseUtil.created(
        r,
        await advancementService.createCampaign(q.user!._id.toString(), q.body),
        "Campaign created",
      );
    } catch (e) {
      n(e);
    }
  },
  async pledges(_q, r, n) {
    try {
      responseUtil.success(r, await advancementService.pledges());
    } catch (e) {
      n(e);
    }
  },
  async createPledge(q, r, n) {
    try {
      responseUtil.created(
        r,
        await advancementService.createPledge(q.user!._id.toString(), q.body),
        "Pledge recorded",
      );
    } catch (e) {
      n(e);
    }
  },
  async designations(_q, r, n) {
    try {
      responseUtil.success(r, await advancementService.designations());
    } catch (e) {
      n(e);
    }
  },
  async designate(q, r, n) {
    try {
      responseUtil.created(
        r,
        await advancementService.designateGift(q.user!._id.toString(), q.body),
        "Gift designated",
      );
    } catch (e) {
      n(e);
    }
  },
  async tasks(_q, r, n) {
    try {
      responseUtil.success(r, await advancementService.tasks());
    } catch (e) {
      n(e);
    }
  },
  async createTask(q, r, n) {
    try {
      responseUtil.created(
        r,
        await advancementService.createTask(q.user!._id.toString(), q.body),
        "Stewardship task created",
      );
    } catch (e) {
      n(e);
    }
  },
  async closeTask(q, r, n) {
    try {
      responseUtil.success(
        r,
        await advancementService.closeTask(q.params.id!, q.user!._id.toString(), q.body.outcome),
        "Stewardship task completed",
      );
    } catch (e) {
      n(e);
    }
  },
};

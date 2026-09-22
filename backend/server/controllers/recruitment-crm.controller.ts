import type { RequestHandler } from "express";
import { SystemRole } from "../constants/roles";
import { recruitmentCrmService } from "../services/recruitment-crm.service";
import { responseUtil } from "../utils/response.util";

const isCounselor = (role?: string) => role === SystemRole.ADMISSION_COUNSELOR;

export const recruitmentCrmController: Record<string, RequestHandler> = {
  async list(req, res, next) {
    try {
      const filter: Record<string, unknown> = {};
      if (req.query.stage) filter.stage = req.query.stage;
      if (req.query.source) filter.source = req.query.source;
      if (req.query.ownerId) filter.ownerId = req.query.ownerId;
      if (req.query.search) filter.$text = { $search: String(req.query.search) };
      if (req.query.overdue === "true") filter.nextFollowUpAt = { $lt: new Date() };
      if (isCounselor(req.activeRole)) filter.ownerId = req.user!._id;
      responseUtil.success(
        res,
        await recruitmentCrmService.list(
          filter,
          Number(req.query.page) || 1,
          Number(req.query.limit) || 30,
        ),
      );
    } catch (error) {
      next(error);
    }
  },
  async dashboard(req, res, next) {
    try {
      responseUtil.success(
        res,
        await recruitmentCrmService.dashboard(
          isCounselor(req.activeRole) ? req.user!._id.toString() : undefined,
        ),
      );
    } catch (error) {
      next(error);
    }
  },
  async create(req, res, next) {
    try {
      const input = isCounselor(req.activeRole)
        ? { ...req.body, ownerId: req.user!._id.toString() }
        : req.body;
      responseUtil.created(
        res,
        await recruitmentCrmService.create(req.user!._id.toString(), input),
        "Prospect created",
      );
    } catch (error) {
      next(error);
    }
  },
  async update(req, res, next) {
    try {
      responseUtil.success(
        res,
        await recruitmentCrmService.update(
          req.params.id!,
          req.body,
          isCounselor(req.activeRole) ? req.user!._id.toString() : undefined,
        ),
        "Prospect updated",
      );
    } catch (error) {
      next(error);
    }
  },
  async activities(req, res, next) {
    try {
      responseUtil.success(
        res,
        await recruitmentCrmService.activities(
          req.params.id!,
          isCounselor(req.activeRole) ? req.user!._id.toString() : undefined,
        ),
      );
    } catch (error) {
      next(error);
    }
  },
  async addActivity(req, res, next) {
    try {
      responseUtil.created(
        res,
        await recruitmentCrmService.addActivity(
          req.params.id!,
          req.user!._id.toString(),
          req.body,
          isCounselor(req.activeRole) ? req.user!._id.toString() : undefined,
        ),
        "Follow-up recorded",
      );
    } catch (error) {
      next(error);
    }
  },
  async completeActivity(req, res, next) {
    try {
      responseUtil.success(
        res,
        await recruitmentCrmService.completeActivity(req.params.id!, req.user!._id.toString()),
        "Follow-up completed",
      );
    } catch (error) {
      next(error);
    }
  },
};

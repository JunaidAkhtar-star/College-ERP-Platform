import type { RequestHandler } from "express";
import { gatepassService } from "../services/gatepass.service";
import { responseUtil } from "../utils/response.util";
import { Module, PermissionAction } from "../constants/permissions";

export const gatepassController: Record<string, RequestHandler> = {
  /** POST /gate-pass */
  async checkIn(req, res, next) {
    try {
      const pass = await gatepassService.checkIn(req.body);
      responseUtil.created(res, pass, "Visitor checked in successfully");
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /gate-pass/:id/checkout */
  async checkOut(req, res, next) {
    try {
      const pass = await gatepassService.checkOut(req.params.id);
      responseUtil.success(res, pass, "Visitor checked out successfully");
    } catch (err) {
      next(err);
    }
  },

  /** GET /gate-pass */
  async getAll(req, res, next) {
    try {
      const filter: { status?: "checked_in" | "checked_out"; hostId?: string } = {};
      if (req.query.status === "checked_in" || req.query.status === "checked_out") {
        filter.status = req.query.status;
      }

      // Approval authority grants operational register visibility; otherwise a
      // user only sees visitors for whom they are the recorded host.
      const canManageGate = req.permissions?.some(
        (permission) =>
          permission.module === Module.GATE_PASS &&
          permission.actions.includes(PermissionAction.APPROVE),
      );
      if (!canManageGate) {
        filter.hostId = req.user?._id.toString();
      }

      const passes = await gatepassService.getAll(filter);
      responseUtil.success(res, passes);
    } catch (err) {
      next(err);
    }
  },

  async applyForOuting(req, res, next) {
    try {
      const outing = await gatepassService.applyForOuting(req.user!._id.toString(), req.body);
      responseUtil.created(res, outing, "Student outing request submitted");
    } catch (err) {
      next(err);
    }
  },

  async getOutings(req, res, next) {
    try {
      const canReview = req.permissions?.some(
        (permission) =>
          permission.module === Module.GATE_PASS &&
          permission.actions.includes(PermissionAction.APPROVE),
      );
      const outings = await gatepassService.listOutings(
        canReview ? undefined : req.user!._id.toString(),
      );
      responseUtil.success(res, outings);
    } catch (err) {
      next(err);
    }
  },

  async decideOuting(req, res, next) {
    try {
      const outing = await gatepassService.decideOuting(
        req.params.id,
        req.user!._id.toString(),
        req.body.decision,
        req.body.reviewNotes,
      );
      responseUtil.success(res, outing, "Outing decision recorded");
    } catch (err) {
      next(err);
    }
  },

  async recordOutingMovement(req, res, next) {
    try {
      const outing = await gatepassService.recordOutingMovement(req.params.id, req.body.movement);
      responseUtil.success(res, outing, "Student movement recorded");
    } catch (err) {
      next(err);
    }
  },

  async cancelOuting(req, res, next) {
    try {
      const outing = await gatepassService.cancelOuting(req.params.id, req.user!._id.toString());
      responseUtil.success(res, outing, "Outing request cancelled");
    } catch (err) {
      next(err);
    }
  },
};
export default gatepassController;

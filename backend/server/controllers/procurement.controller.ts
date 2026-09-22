import type { RequestHandler } from "express";
import { procurementService } from "../services/procurement.service";
import { responseUtil } from "../utils/response.util";
import createError from "http-errors";
import { SystemRole } from "../constants/roles";
import { getDepartmentScope } from "../utils/ownership.util";

export const procurementController: Record<string, RequestHandler> = {
  /** POST /procurement/requisitions */
  async createRequisition(req, res, next) {
    try {
      const departmentId = await getDepartmentScope(req);
      const payload = {
        ...req.body,
        ...(departmentId ? { departmentId } : {}),
        raisedBy: req.user!._id.toString(),
      };
      const requisition = await procurementService.createRequisition(payload);
      responseUtil.created(res, requisition, "Requisition raised successfully");
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /procurement/requisitions/:id/decide */
  async decideRequisition(req, res, next) {
    try {
      const { action, notes } = req.body;
      if (req.activeRole === SystemRole.HOD && action !== "hod_approve" && action !== "reject") {
        throw createError(
          403,
          "HODs can recommend or reject requisitions, not issue final approval",
        );
      }
      if (req.activeRole !== SystemRole.HOD && action === "hod_approve") {
        throw createError(403, "Only the active HOD role can recommend a requisition");
      }
      const current = await procurementService.getById(req.params.id);
      const departmentId = await getDepartmentScope(req);
      if (
        departmentId &&
        String(current.departmentId?._id ?? current.departmentId) !== departmentId
      ) {
        throw createError(403, "You can decide requisitions only for your department");
      }
      const dec = await procurementService.decideRequisition(
        req.params.id,
        action,
        req.user!._id.toString(),
        notes,
      );
      responseUtil.success(res, dec, "Requisition status updated");
    } catch (err) {
      next(err);
    }
  },

  async receiveGoods(req, res, next) {
    try {
      const result = await procurementService.receiveGoods(
        req.params.id,
        Number(req.body.quantity),
        req.user!._id.toString(),
      );
      responseUtil.success(res, result, "Goods received and stock updated");
    } catch (err) {
      next(err);
    }
  },

  /** GET /procurement/requisitions */
  async getAll(req, res, next) {
    try {
      const filter: Record<string, unknown> = {};
      if (req.query.status) filter.status = req.query.status as string;
      if (req.query.departmentId) filter.departmentId = req.query.departmentId as string;

      const activeRole = req.activeRole as SystemRole;
      if (activeRole === SystemRole.HOD) filter.departmentId = await getDepartmentScope(req);
      if (activeRole === SystemRole.FACULTY) filter.raisedBy = req.user!._id;
      if (
        [SystemRole.STORE, SystemRole.ACCOUNTS_DEPARTMENT].includes(activeRole) &&
        !filter.status
      ) {
        filter.status = { $in: ["hod_approved", "approved", "partially_received", "received"] };
      }

      const requisitions = await procurementService.getAll(filter);
      responseUtil.success(res, requisitions);
    } catch (err) {
      next(err);
    }
  },
};
export default procurementController;

import type { RequestHandler } from "express";
import { facilitiesService } from "../services/facilities.service";
import { assertCampusAccess, getCampusScope } from "../utils/campus-scope.util";
import { responseUtil } from "../utils/response.util";
import { Module, PermissionAction } from "../constants/permissions";
import createError from "http-errors";

const canManageFacilities = (req: Parameters<RequestHandler>[0]) =>
  req.permissions?.some(
    (permission) =>
      permission.module === Module.STORE && permission.actions.includes(PermissionAction.EDIT),
  ) ?? false;

export const facilitiesController: Record<string, RequestHandler> = {
  async dashboard(req, res, next) {
    try {
      const scope = await getCampusScope(req);
      responseUtil.success(res, await facilitiesService.dashboard(scope ?? undefined));
    } catch (error) {
      next(error);
    }
  },
  async spaces(req, res, next) {
    try {
      const scope = await getCampusScope(req);
      responseUtil.success(res, await facilitiesService.spaces(scope ?? undefined));
    } catch (error) {
      next(error);
    }
  },
  async createSpace(req, res, next) {
    try {
      await assertCampusAccess(req, req.body.campusId);
      responseUtil.created(
        res,
        await facilitiesService.createSpace(req.user!._id.toString(), req.body),
        "Facility space created",
      );
    } catch (error) {
      next(error);
    }
  },
  async assets(req, res, next) {
    try {
      const scope = await getCampusScope(req);
      responseUtil.success(res, await facilitiesService.assets(scope ?? undefined));
    } catch (error) {
      next(error);
    }
  },
  async createAsset(req, res, next) {
    try {
      await assertCampusAccess(req, req.body.campusId);
      responseUtil.created(
        res,
        await facilitiesService.createAsset(req.user!._id.toString(), req.body),
        "Asset registered",
      );
    } catch (error) {
      next(error);
    }
  },
  async workOrders(req, res, next) {
    try {
      const scope = await getCampusScope(req);
      responseUtil.success(res, await facilitiesService.workOrders(scope ?? undefined));
    } catch (error) {
      next(error);
    }
  },
  async createWorkOrder(req, res, next) {
    try {
      await assertCampusAccess(req, req.body.campusId);
      responseUtil.created(
        res,
        await facilitiesService.createWorkOrder(req.user!._id.toString(), req.body),
        "Work order created",
      );
    } catch (error) {
      next(error);
    }
  },
  async transitionWorkOrder(req, res, next) {
    try {
      const item = await facilitiesService.workOrderById(req.params.id!);
      await assertCampusAccess(req, item.campusId);
      const assigneeId = String(item.assignedTo?._id ?? item.assignedTo ?? "");
      const isManager = canManageFacilities(req);
      if (!isManager && assigneeId !== req.user!._id.toString()) {
        throw createError(
          403,
          "Only facility managers or the assigned worker can update this order",
        );
      }
      if (!isManager && ["assigned", "cancelled"].includes(req.body.status)) {
        throw createError(403, "Assigned workers can record progress or completion only");
      }
      responseUtil.success(
        res,
        await facilitiesService.transitionWorkOrder(
          req.params.id!,
          req.user!._id.toString(),
          req.body,
        ),
        "Work order updated",
      );
    } catch (error) {
      next(error);
    }
  },
  async generatePreventive(req, res, next) {
    try {
      const scope = await getCampusScope(req);
      responseUtil.success(
        res,
        await facilitiesService.generatePreventiveWorkOrders(
          req.user!._id.toString(),
          scope ?? undefined,
        ),
        "Preventive work orders generated",
      );
    } catch (error) {
      next(error);
    }
  },
  async bookings(req, res, next) {
    try {
      const scope = await getCampusScope(req);
      responseUtil.success(res, await facilitiesService.bookings(scope ?? undefined));
    } catch (error) {
      next(error);
    }
  },
  async createBooking(req, res, next) {
    try {
      await assertCampusAccess(req, req.body.campusId);
      responseUtil.created(
        res,
        await facilitiesService.createBooking(req.user!._id.toString(), req.body),
        "Facility reserved",
      );
    } catch (error) {
      next(error);
    }
  },
  async inspections(req, res, next) {
    try {
      const scope = await getCampusScope(req);
      responseUtil.success(res, await facilitiesService.inspections(scope ?? undefined));
    } catch (error) {
      next(error);
    }
  },
  async createInspection(req, res, next) {
    try {
      await assertCampusAccess(req, req.body.campusId);
      responseUtil.created(
        res,
        await facilitiesService.createInspection(req.user!._id.toString(), req.body),
        "Inspection recorded",
      );
    } catch (error) {
      next(error);
    }
  },
};

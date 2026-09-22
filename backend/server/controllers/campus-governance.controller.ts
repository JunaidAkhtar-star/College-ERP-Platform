import type { RequestHandler } from "express";
import { campusGovernanceService } from "../services/campus-governance.service";
import { assertCampusAccess, getCampusScope } from "../utils/campus-scope.util";
import { responseUtil } from "../utils/response.util";

export const campusGovernanceController: Record<string, RequestHandler> = {
  async campuses(req, res, next) {
    try {
      const scope = await getCampusScope(req);
      responseUtil.success(
        res,
        await campusGovernanceService.listCampuses(scope ? { _id: { $in: scope } } : {}),
      );
    } catch (error) {
      next(error);
    }
  },
  async saveCampus(req, res, next) {
    try {
      if (req.params.id) await assertCampusAccess(req, req.params.id);
      if (req.body.parentCampusId) await assertCampusAccess(req, req.body.parentCampusId);
      const data = await campusGovernanceService.saveCampus(
        req.user!._id.toString(),
        req.body,
        req.params.id,
      );
      req.params.id
        ? responseUtil.success(res, data, "Campus updated")
        : responseUtil.created(res, data, "Campus created");
    } catch (error) {
      next(error);
    }
  },
  async bindDepartment(req, res, next) {
    try {
      await assertCampusAccess(req, req.body.campusId);
      responseUtil.success(
        res,
        await campusGovernanceService.bindDepartment(
          req.params.departmentId!,
          req.body.campusId,
          req.user!._id.toString(),
        ),
        "Department assigned to campus",
      );
    } catch (error) {
      next(error);
    }
  },
  async assignments(req, res, next) {
    try {
      const scope = await getCampusScope(req);
      responseUtil.success(res, await campusGovernanceService.assignments(scope ?? undefined));
    } catch (error) {
      next(error);
    }
  },
  async assign(req, res, next) {
    try {
      await assertCampusAccess(req, req.body.campusId);
      responseUtil.created(
        res,
        await campusGovernanceService.assignUser(req.user!._id.toString(), req.body),
        "Campus access assigned",
      );
    } catch (error) {
      next(error);
    }
  },
  async revoke(req, res, next) {
    try {
      const item = await campusGovernanceService.assignmentById(req.params.id!);
      await assertCampusAccess(req, item.campusId);
      responseUtil.success(
        res,
        await campusGovernanceService.revokeAssignment(req.params.id!, req.user!._id.toString()),
        "Campus access revoked",
      );
    } catch (error) {
      next(error);
    }
  },
  async calendars(req, res, next) {
    try {
      const scope = await getCampusScope(req);
      responseUtil.success(res, await campusGovernanceService.calendars(scope ?? undefined));
    } catch (error) {
      next(error);
    }
  },
  async createCalendar(req, res, next) {
    try {
      await assertCampusAccess(req, req.body.campusId);
      responseUtil.created(
        res,
        await campusGovernanceService.saveCalendar(req.user!._id.toString(), req.body),
        "Campus calendar created",
      );
    } catch (error) {
      next(error);
    }
  },
  async publishCalendar(req, res, next) {
    try {
      const item = await campusGovernanceService.calendarById(req.params.id!);
      await assertCampusAccess(req, item.campusId);
      responseUtil.success(
        res,
        await campusGovernanceService.publishCalendar(req.params.id!, req.user!._id.toString()),
        "Campus calendar published",
      );
    } catch (error) {
      next(error);
    }
  },
  async effectiveCalendar(req, res, next) {
    try {
      await assertCampusAccess(req, req.params.campusId);
      responseUtil.success(
        res,
        await campusGovernanceService.effectiveCalendar(
          req.params.campusId!,
          String(req.query.academicYear),
        ),
      );
    } catch (error) {
      next(error);
    }
  },
  async sharedServices(req, res, next) {
    try {
      const scope = await getCampusScope(req);
      responseUtil.success(res, await campusGovernanceService.sharedServices(scope ?? undefined));
    } catch (error) {
      next(error);
    }
  },
  async createSharedService(req, res, next) {
    try {
      await assertCampusAccess(req, req.body.providerCampusId);
      for (const id of req.body.consumerCampusIds) await assertCampusAccess(req, id);
      responseUtil.created(
        res,
        await campusGovernanceService.createSharedService(req.user!._id.toString(), req.body),
        "Shared service created",
      );
    } catch (error) {
      next(error);
    }
  },
  async metrics(req, res, next) {
    try {
      const scope = await getCampusScope(req);
      responseUtil.success(res, await campusGovernanceService.metrics(scope ?? undefined));
    } catch (error) {
      next(error);
    }
  },
};

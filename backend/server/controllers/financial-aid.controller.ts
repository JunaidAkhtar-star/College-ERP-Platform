import type { RequestHandler } from "express";
import { financialAidService } from "../services/financial-aid.service";
import { applyDepartmentScope, assertDepartmentAccess } from "../utils/ownership.util";
import { responseUtil } from "../utils/response.util";

export const financialAidController: Record<string, RequestHandler> = {
  async funds(req, res, next) {
    try {
      responseUtil.success(
        res,
        await financialAidService.listFunds(
          req.query.academicYear ? String(req.query.academicYear) : undefined,
        ),
      );
    } catch (error) {
      next(error);
    }
  },
  async createFund(req, res, next) {
    try {
      responseUtil.created(
        res,
        await financialAidService.createFund(req.user!._id.toString(), req.body),
        "Financial-aid fund created",
      );
    } catch (error) {
      next(error);
    }
  },
  async calculate(req, res, next) {
    try {
      const result = await financialAidService.calculateNeed(
        req.body.studentProfileId,
        req.body.academicYear,
        Number(req.body.studentContribution),
        Number(req.body.indirectCost ?? 0),
      );
      await assertDepartmentAccess(req, result.profile.department);
      responseUtil.success(res, result);
    } catch (error) {
      next(error);
    }
  },
  async createPackage(req, res, next) {
    try {
      const need = await financialAidService.calculateNeed(
        req.body.studentProfileId,
        req.body.academicYear,
        Number(req.body.studentContribution),
        Number(req.body.indirectCost ?? 0),
      );
      await assertDepartmentAccess(req, need.profile.department);
      responseUtil.created(
        res,
        await financialAidService.createPackage(req.user!._id.toString(), req.body),
        "Financial-aid package drafted",
      );
    } catch (error) {
      next(error);
    }
  },
  async packages(req, res, next) {
    try {
      const filter: Record<string, unknown> = {};
      if (req.query.academicYear) filter.academicYear = req.query.academicYear;
      if (req.query.status) filter.status = req.query.status;
      const scoped = await applyDepartmentScope(req, filter);
      responseUtil.success(
        res,
        await financialAidService.listPackages(
          scoped,
          Number(req.query.page) || 1,
          Number(req.query.limit) || 30,
        ),
      );
    } catch (error) {
      next(error);
    }
  },
  async mine(req, res, next) {
    try {
      responseUtil.success(
        res,
        await financialAidService.listPackages(
          { studentId: req.user!._id },
          Number(req.query.page) || 1,
          Number(req.query.limit) || 30,
        ),
      );
    } catch (error) {
      next(error);
    }
  },
  async offer(req, res, next) {
    try {
      const item = await financialAidService.packageScope(req.params.id!);
      await assertDepartmentAccess(req, item.departmentId);
      responseUtil.success(
        res,
        await financialAidService.offer(req.params.id!, req.user!._id.toString()),
        "Financial-aid offer released",
      );
    } catch (error) {
      next(error);
    }
  },
  async respond(req, res, next) {
    try {
      responseUtil.success(
        res,
        await financialAidService.respond(
          req.params.id!,
          req.user!._id.toString(),
          req.body.acceptedFundIds ?? [],
          Boolean(req.body.declineAll),
        ),
        "Financial-aid response recorded",
      );
    } catch (error) {
      next(error);
    }
  },
  async disburse(req, res, next) {
    try {
      const item = await financialAidService.packageScope(req.params.id!);
      await assertDepartmentAccess(req, item.departmentId);
      responseUtil.success(
        res,
        await financialAidService.disburseItem(
          req.params.id!,
          req.params.itemId!,
          req.user!._id.toString(),
          req.body.referenceNo,
        ),
        "Aid disbursement reconciled",
      );
    } catch (error) {
      next(error);
    }
  },
};

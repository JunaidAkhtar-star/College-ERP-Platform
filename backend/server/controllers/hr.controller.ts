import type { RequestHandler } from "express";
import { hrService } from "../services/hr.service";
import { responseUtil } from "../utils/response.util";
import type { EmploymentStatus } from "../models/hr.model";

export const hrController: Record<string, RequestHandler> = {
  /** POST /hr/employees */
  async create(req, res, next) {
    try {
      const createdBy = req.user?._id.toString() || "";
      const employee = await hrService.create(req.body, createdBy);
      responseUtil.success(res, employee, "Employee created", 201);
    } catch (err) {
      next(err);
    }
  },

  /** GET /hr/employees */
  async list(req, res, next) {
    try {
      const { department, status, type, search, page, limit } = req.query;
      const result = await hrService.list(
        {
          department: department as string | undefined,
          employmentStatus: status as EmploymentStatus | undefined,
          employmentType: type as string | undefined,
          search: search as string | undefined,
        },
        Number(page) || 1,
        Number(limit) || 20,
      );
      responseUtil.success(res, result);
    } catch (err) {
      next(err);
    }
  },

  /** GET /hr/employees/:id */
  async getById(req, res, next) {
    try {
      const employee = await hrService.getById(req.params.id);
      responseUtil.success(res, employee);
    } catch (err) {
      next(err);
    }
  },

  /** GET /hr/me — current user's HR record */
  async getMyRecord(req, res, next) {
    try {
      const employee = await hrService.getByUserId(req.user!._id.toString());
      responseUtil.success(res, employee);
    } catch (err) {
      next(err);
    }
  },

  /** PUT /hr/employees/:id */
  async update(req, res, next) {
    try {
      const updatedBy = req.user!._id.toString();
      const employee = await hrService.update(req.params.id, req.body, updatedBy);
      responseUtil.success(res, employee, "Employee updated");
    } catch (err) {
      next(err);
    }
  },

  /** DELETE /hr/employees/:id — soft delete (terminate) */
  async terminate(req, res, next) {
    try {
      const deletedBy = req.user!._id.toString();
      await hrService.terminate(req.params.id, deletedBy);
      responseUtil.success(res, undefined, "Employee terminated");
    } catch (err) {
      next(err);
    }
  },
};

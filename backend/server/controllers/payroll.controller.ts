import type { Request, Response, NextFunction } from "express";
import { payrollService } from "../services";
import createError from "http-errors";
import { SystemRole } from "../constants/roles";

const PAYROLL_ADMIN_ROLES = new Set<SystemRole>([
  SystemRole.SUPER_ADMIN,
  SystemRole.HR_DEPARTMENT,
  SystemRole.ACCOUNTS_DEPARTMENT,
]);

function assertOwnPayroll(req: Request, employeeId: unknown) {
  if (PAYROLL_ADMIN_ROLES.has(req.activeRole as SystemRole)) return;
  if (String(employeeId) !== req.user!._id.toString()) {
    throw createError(403, "You can access only your own payroll records");
  }
}

export const payrollController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId, departmentId, month, year, isPaid } = req.query;
      const filter: Record<string, unknown> = {};
      if (employeeId) filter.employeeId = employeeId;
      if (departmentId) filter.departmentId = departmentId;
      if (month) filter.month = Number(month);
      if (year) filter.year = Number(year);
      if (isPaid !== undefined) filter.isPaid = isPaid === "true";
      const result = await payrollService.getPayslips(
        filter,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await payrollService.getPayslipById(req.params.id);
      if (!data) {
        res.status(404).json({ success: false, message: "Not found" });
        return;
      }
      assertOwnPayroll(req, data.employeeId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  generate: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        employeeId,
        employeeName,
        designation,
        departmentId,
        month,
        year,
        basicPay,
        presentDays,
        absentDays,
        lopDays,
        payableDays,
      } = req.body;
      const data = await payrollService.generatePayslip(
        employeeId,
        employeeName,
        designation,
        departmentId,
        month,
        year,
        basicPay,
        presentDays,
        absentDays,
        lopDays,
        payableDays,
        req.user!._id as unknown as string,
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  generateMonthly: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await payrollService.generateMonthlyPayroll(
        Number(req.body.month),
        Number(req.body.year),
        req.user!._id.toString(),
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  markPaid: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { paymentDate, paymentMode } = req.body;
      const data = await payrollService.markPaid(
        req.params.id,
        new Date(paymentDate),
        paymentMode,
        req.user!._id.toString(),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
  review: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await payrollService.reviewPayslip(req.params.id, req.user!._id.toString());
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
  approve: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await payrollService.approvePayslip(req.params.id, req.user!._id.toString());
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  summary: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { month, year } = req.query;
      const data = await payrollService.getMonthlySummary(Number(month), Number(year));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  sendEmail: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await payrollService.sendPayslipEmail(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  form16: async (req: Request, res: Response, next: NextFunction) => {
    try {
      assertOwnPayroll(req, req.params.employeeId);
      const { financialYear } = req.query;
      if (!financialYear)
        return res
          .status(400)
          .json({ success: false, error: { message: "financialYear required (e.g. 2024-25)" } });
      const data = await payrollService.generateForm16(
        req.params.employeeId,
        financialYear as string,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  policy: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await payrollService.getPolicy() });
    } catch (err) {
      next(err);
    }
  },

  createPolicy: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await payrollService.createPolicy(req.body, req.user!._id.toString());
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};

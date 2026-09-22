import type { Request, Response, NextFunction } from "express";
import { accountsService } from "../services";
import { generalLedgerService } from "../services/general-ledger.service";

export const accountsController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { transactionType, category, financialYear, departmentId } = req.query;
      const filter: Record<string, unknown> = {};
      if (transactionType) filter.transactionType = transactionType;
      if (category) filter.category = category;
      if (financialYear) filter.financialYear = financialYear;
      if (departmentId) filter.departmentId = departmentId;
      const result = await accountsService.getAll(
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
      const data = await accountsService.getById(req.params.id);
      if (!data) {
        res.status(404).json({ success: false, message: "Not found" });
        return;
      }
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        transactionType,
        category,
        subCategory,
        amount,
        paymentMode,
        referenceNo,
        description,
        departmentId,
        date,
        financialYear,
        budgetHead,
        receiptUrl,
      } = req.body;
      const data = await accountsService.createTransaction({
        transactionType,
        category,
        subCategory,
        amount,
        paymentMode,
        referenceNo,
        description,
        departmentId: departmentId || undefined,
        date,
        financialYear,
        budgetHead,
        receiptUrl,
        createdBy: req.user!._id,
        approvedBy: req.user!._id,
      });
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await accountsService.update(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await accountsService.delete(req.params.id);
      res.json({ success: true, message: "Transaction deleted" });
    } catch (err) {
      next(err);
    }
  },

  reverse: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await accountsService.reverse(
        req.params.id,
        req.user!._id.toString(),
        req.body.reason,
      );
      res.json({ success: true, data, message: "Transaction reversed" });
    } catch (err) {
      next(err);
    }
  },

  summary: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { financialYear } = req.query;
      const data = await accountsService.getSummaryByCategory(financialYear as string);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  monthlyFlow: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { financialYear } = req.query;
      const data = await accountsService.getMonthlyFlow(financialYear as string);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  balance: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { financialYear } = req.query;
      const data = await accountsService.getBalance(financialYear as string);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  journals: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter: Record<string, unknown> = {};
      if (req.query.financialYear) filter.financialYear = req.query.financialYear;
      if (req.query.status) filter.status = req.query.status;
      if (req.query.sourceType) filter.sourceType = req.query.sourceType;
      const result = await generalLedgerService.listJournals(
        filter,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  trialBalance: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const financialYear = String(req.query.financialYear || "");
      if (!financialYear) {
        res.status(400).json({ success: false, error: { message: "financialYear is required" } });
        return;
      }
      const data = await generalLedgerService.trialBalance(financialYear);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};

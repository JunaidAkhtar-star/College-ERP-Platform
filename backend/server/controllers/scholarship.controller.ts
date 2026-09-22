import type { Request, Response, NextFunction } from "express";
import { scholarshipService } from "../services";
import createError from "http-errors";
import { SystemRole } from "../constants/roles";

export const scholarshipController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId, academicYear, status, scholarshipType } = req.query;
      const filter: Record<string, unknown> = {};
      if (studentId) filter.studentId = studentId;
      if (academicYear) filter.academicYear = academicYear;
      if (status) filter.status = status;
      if (scholarshipType) filter.scholarshipType = scholarshipType;
      const result = await scholarshipService.getAll(
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
      const data = await scholarshipService.getById(req.params.id);
      if (!data) {
        res.status(404).json({ success: false, message: "Not found" });
        return;
      }
      if (
        req.activeRole === SystemRole.STUDENT &&
        data.studentId.toString() !== req.user!._id.toString()
      ) {
        throw createError(403, "You can access only your own scholarship applications");
      }
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  listMine: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter: Record<string, unknown> = { studentId: req.user!._id };
      if (req.query.academicYear) filter.academicYear = req.query.academicYear;
      if (req.query.status) filter.status = req.query.status;
      const result = await scholarshipService.getAll(
        filter,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  listSchemes: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter: Record<string, unknown> = {};
      if (req.query.academicYear) filter.academicYear = req.query.academicYear;
      if (req.activeRole === SystemRole.STUDENT) {
        filter.isActive = true;
        filter.applicationStart = { $lte: new Date() };
        filter.applicationEnd = { $gte: new Date() };
      }
      const data = await scholarshipService.listSchemes(filter);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  createScheme: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await scholarshipService.createScheme(
        req.body,
        req.user!._id as unknown as string,
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  apply: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const documents = Array.isArray(req.body.documents)
        ? req.body.documents.map((document: unknown, index: number) =>
            typeof document === "string"
              ? { docType: `supporting_document_${index + 1}`, fileUrl: document }
              : document,
          )
        : [];
      const data = await scholarshipService.apply(
        { schemeId: req.body.schemeId, amount: req.body.amount, documents },
        req.user!._id as unknown as string,
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  review: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await scholarshipService.review(
        req.params.id,
        req.user!._id as unknown as string,
        req.body.remarks,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  approve: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await scholarshipService.approve(
        req.params.id,
        req.user!._id as unknown as string,
        req.body.amount !== undefined ? Number(req.body.amount) : undefined,
        req.body.remarks,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  reject: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await scholarshipService.reject(
        req.params.id,
        req.user!._id as unknown as string,
        req.body.remarks,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  disburse: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await scholarshipService.disburse(
        req.params.id,
        req.user!._id as unknown as string,
        req.body.referenceNo,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  getSummary: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { academicYear } = req.query;
      const data = await scholarshipService.getSummary(academicYear as string);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};

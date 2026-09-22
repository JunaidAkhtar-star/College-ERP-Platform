import type { Request, Response, NextFunction } from "express";
import { libraryService } from "../services";
import { Module, PermissionAction } from "../constants/permissions";

export const libraryController = {
  searchBooks: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { q, category, isDigital } = req.query;
      const filter: Record<string, unknown> = { isActive: true };
      if (category) filter.category = category;
      if (isDigital !== undefined) filter.isDigital = isDigital === "true";
      const result = await libraryService.searchBooks(
        (q as string) || "",
        filter,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  getBook: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await libraryService.getBookById(req.params.id);
      if (!data) {
        res.status(404).json({ success: false, message: "Not found" });
        return;
      }
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  addBook: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await libraryService.addBook(req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  updateBook: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await libraryService.updateBook(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  issueBook: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { bookId, memberId, memberType } = req.body;
      const data = await libraryService.issueBook(
        bookId,
        memberId,
        memberType,
        req.user!._id as unknown as string,
      );
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  returnBook: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await libraryService.returnBook(
        req.params.id,
        req.user!._id as unknown as string,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  renewBook: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const canManageAll = Boolean(
        req.permissions?.some(
          (permission) =>
            permission.module === Module.LIBRARY &&
            (permission.actions.includes(PermissionAction.EDIT) ||
              permission.actions.includes(PermissionAction.CREATE)),
        ),
      );
      const data = await libraryService.renewBook(
        req.params.id,
        req.user!._id.toString(),
        canManageAll,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  collectFine: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await libraryService.collectFine(
        req.params.id,
        Number(req.body.amount),
        req.body.paymentMode,
        req.user!._id.toString(),
        req.body.referenceNo,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  myIssues: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await libraryService.getMemberActiveIssues(req.user!._id as unknown as string);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  listIssues: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { memberId, status, bookId } = req.query;
      const filter: Record<string, unknown> = {};
      if (memberId) filter.memberId = memberId;
      if (status) filter.status = status;
      if (bookId) filter.bookId = bookId;
      const result = await libraryService.listIssues(
        filter,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 20,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  overdueIssues: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await libraryService.getOverdueIssues();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  listDigital: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { q = "", category = "", page, limit } = req.query as Record<string, string>;
      const result = await libraryService.listDigitalResources(
        q,
        category,
        Number(page) || 1,
        Number(limit) || 20,
      );
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  addDigital: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const book = await libraryService.addDigitalResource(req.body);
      res.status(201).json({ success: true, data: book });
    } catch (err) {
      next(err);
    }
  },
};

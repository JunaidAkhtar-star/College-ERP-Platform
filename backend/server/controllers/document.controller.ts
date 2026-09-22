import type { Request, Response, NextFunction } from "express";
import { documentService } from "../services/document.service";
import type { UploadedFile } from "express-fileupload";
import createError from "http-errors";
import { Module, PermissionAction } from "../constants/permissions";

function canManageDocuments(req: Request): boolean {
  return Boolean(
    req.permissions?.some(
      (permission) =>
        permission.module === Module.DOCUMENT_MANAGEMENT &&
        permission.actions.includes(PermissionAction.APPROVE),
    ),
  );
}

function assertDocumentOwner(req: Request, owner: unknown): void {
  if (canManageDocuments(req)) return;
  if (String(owner) !== req.user?._id.toString()) {
    throw createError(403, "You can access only your own documents");
  }
}

export const documentController = {
  upload: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, name, ownerModel, expiresAt } = req.body;
      const requestedOwnerId = req.body.ownerId as string | undefined;
      if (!canManageDocuments(req) && (requestedOwnerId || ownerModel === "AdmissionApplication")) {
        throw createError(403, "Only authorized staff can upload documents for another record");
      }
      const ownerId = requestedOwnerId || req.user?._id.toString() || "";
      const file = req.files?.document as UploadedFile;
      if (!file)
        return res
          .status(400)
          .json({ success: false, error: { message: "No file uploaded (field: document)" } });
      const doc = await documentService.upload(
        ownerId,
        ownerModel ?? "User",
        type,
        name,
        file,
        expiresAt,
        req,
        req.user,
      );
      res.status(201).json({ success: true, data: doc });
    } catch (err) {
      next(err);
    }
  },

  reUpload: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await documentService.getById(req.params.id);
      assertDocumentOwner(req, existing.owner);
      const file = req.files?.document as UploadedFile;
      if (!file)
        return res
          .status(400)
          .json({ success: false, error: { message: "No file uploaded (field: document)" } });
      const doc = await documentService.reUpload(req.params.id, file, req.user, req);
      res.json({ success: true, data: doc });
    } catch (err) {
      next(err);
    }
  },

  myDocuments: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id.toString() || "";
      const docs = await documentService.getByOwner(userId, req.query.type as string | undefined);
      res.json({ success: true, data: docs });
    } catch (err) {
      next(err);
    }
  },

  getByOwner: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const docs = await documentService.getByOwner(
        req.params.ownerId,
        req.query.type as string | undefined,
      );
      res.json({ success: true, data: docs });
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await documentService.getById(req.params.id);
      assertDocumentOwner(req, doc.owner);
      res.json({ success: true, data: doc });
    } catch (err) {
      next(err);
    }
  },

  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, status, page, limit } = req.query;
      const filter: Record<string, unknown> = {};
      if (type) filter.type = type;
      if (status) filter.status = status;
      const result = await documentService.list(filter, Number(page) || 1, Number(limit) || 20);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  verify: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const verifierId = req.user?._id.toString() || "";
      const doc = await documentService.verify(req.params.id, verifierId, req.user, req);
      res.json({ success: true, data: doc });
    } catch (err) {
      next(err);
    }
  },

  reject: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reason } = req.body;
      const doc = await documentService.reject(req.params.id, reason, req.user, req);
      res.json({ success: true, data: doc });
    } catch (err) {
      next(err);
    }
  },

  expiringSoon: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const days = Number(req.query.days) || 30;
      const docs = await documentService.getExpiringSoon(days);
      res.json({ success: true, data: docs });
    } catch (err) {
      next(err);
    }
  },
};

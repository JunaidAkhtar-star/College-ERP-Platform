import createError from "http-errors";
import { documentRepository } from "../repositories/document.repository";
import { DocumentStatus, DocumentType, type IDocument } from "../models/document.model";
import { uploadUtil } from "../utils/upload.util";
import type { UploadedFile } from "express-fileupload";
import { auditLogRepository } from "../repositories/audit-log.repository";
import { UserModel, type IUser } from "../models/user.model";
import type { Request } from "express";
import { Types } from "mongoose";
import { AdmissionApplicationModel } from "../models/admission-application.model";

export const documentService = {
  upload: async (
    ownerId: string,
    ownerModel: "User" | "AdmissionApplication",
    type: string,
    name: string,
    file: UploadedFile,
    expiresAt?: string,
    req?: Request,
    user?: IUser,
  ) => {
    if (!Types.ObjectId.isValid(ownerId)) throw createError(400, "Document owner is invalid");
    if (!["User", "AdmissionApplication"].includes(ownerModel))
      throw createError(400, "Document owner type is invalid");
    if (!Object.values(DocumentType).includes(type as DocumentType))
      throw createError(400, "Document type is invalid");
    const cleanName = name?.trim();
    if (!cleanName || cleanName.length > 160) throw createError(400, "Document name is invalid");
    if (expiresAt) {
      const expiry = new Date(expiresAt);
      if (Number.isNaN(expiry.getTime()) || expiry <= new Date())
        throw createError(400, "Document expiry date must be in the future");
    }
    const ownerExists =
      ownerModel === "User"
        ? await UserModel.exists({ _id: ownerId })
        : await AdmissionApplicationModel.exists({ _id: ownerId });
    if (!ownerExists) throw createError(404, "Document owner not found");
    if (type !== DocumentType.OTHER) {
      const existing = await documentRepository.findByOwner(ownerId, type, 1);
      if (existing.length)
        throw createError(409, "This document type already exists; use the re-upload workflow");
    }
    const result = await uploadUtil.uploadDocument(file, "erp/documents");
    const versionEntry = {
      version: 1,
      url: result.url,
      publicId: result.publicId,
      uploadedAt: new Date(),
      fileSize: file.size,
      format: result.format,
    };

    const doc = await documentRepository.create({
      owner: ownerId,
      ownerModel,
      type,
      name: cleanName,
      url: result.url,
      publicId: result.publicId,
      fileSize: file.size,
      format: result.format,
      versions: [versionEntry],
      status: DocumentStatus.PENDING,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      createdBy: user?._id,
    });

    if (user && req) {
      await auditLogRepository.create({
        user,
        action: "upload",
        module: "document_management",
        targetId: (doc as unknown as IDocument)._id.toString(),
        description: `Uploaded document: ${name}`,
        req,
      });
    }

    return doc;
  },

  reUpload: async (docId: string, file: UploadedFile, user?: IUser, req?: Request) => {
    const doc = await documentRepository.findById(docId);
    if (!doc) throw createError(404, "Document not found");
    if (![DocumentStatus.REJECTED, DocumentStatus.EXPIRED].includes(doc.status))
      throw createError(409, "Only rejected or expired documents can be re-uploaded");

    const result = await uploadUtil.uploadDocument(file, "erp/documents");
    const newVersion = {
      version: ((doc as unknown as IDocument).versions?.length ?? 0) + 1,
      url: result.url,
      publicId: result.publicId,
      uploadedAt: new Date(),
      fileSize: file.size,
      format: result.format,
    };

    const updated = await documentRepository.addVersion(
      docId,
      newVersion as unknown as Record<string, unknown>,
    );
    if (!updated) throw createError(409, "Only rejected or expired documents can be re-uploaded");
    if (user && req) {
      await auditLogRepository.create({
        user,
        action: "reupload",
        module: "document_management",
        targetId: docId,
        description: `Re-uploaded document: ${(doc as unknown as IDocument).name}`,
        req,
      });
    }
    return updated;
  },

  getByOwner: (ownerId: string, type?: string) => documentRepository.findByOwner(ownerId, type),

  getById: async (id: string) => {
    const doc = await documentRepository.findById(id);
    if (!doc) throw createError(404, "Document not found");
    return doc;
  },

  list: (filter: Record<string, unknown>, page = 1, limit = 20) =>
    documentRepository.paginate(filter, page, limit),

  verify: async (id: string, verifierId: string, user?: IUser, req?: Request) => {
    const existing = await documentRepository.findById(id);
    if (!existing) throw createError(404, "Document not found");
    if (existing.createdBy?.toString() === verifierId)
      throw createError(409, "A document must be verified by a different user");
    const doc = await documentRepository.updateStatus(
      id,
      [DocumentStatus.PENDING, DocumentStatus.UNDER_REVIEW],
      DocumentStatus.VERIFIED,
      verifierId,
    );
    if (!doc) throw createError(409, "Only pending documents can be verified");
    if (user && req) {
      await auditLogRepository.create({
        user,
        action: "verify",
        module: "document_management",
        targetId: id,
        description: `Verified document: ${(doc as unknown as IDocument).name}`,
        req,
      });
    }
    return doc;
  },

  reject: async (id: string, reason: string, user?: IUser, req?: Request) => {
    const cleanReason = reason?.trim();
    if (!cleanReason || cleanReason.length < 5)
      throw createError(400, "A meaningful rejection reason is required");
    const doc = await documentRepository.updateStatus(
      id,
      [DocumentStatus.PENDING, DocumentStatus.UNDER_REVIEW],
      DocumentStatus.REJECTED,
      undefined,
      cleanReason,
    );
    if (!doc) throw createError(404, "Document not found");
    if (user && req) {
      await auditLogRepository.create({
        user,
        action: "reject",
        module: "document_management",
        targetId: id,
        description: `Rejected document: reason=${cleanReason}`,
        req,
      });
    }
    return doc;
  },

  getExpiringSoon: (days = 30) => documentRepository.findExpiring(days),

  processExpired: () => documentRepository.markExpired(),
};

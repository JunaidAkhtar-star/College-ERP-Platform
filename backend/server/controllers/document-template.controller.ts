import type { NextFunction, Request, Response } from "express";
import { auditLogRepository } from "../repositories/audit-log.repository";
import { documentTemplateService } from "../services/document-template.service";

export const documentTemplateController = {
  metadata: (_req: Request, res: Response) =>
    res.json({ success: true, data: documentTemplateService.metadata() }),
  list: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await documentTemplateService.list() });
    } catch (error) {
      next(error);
    }
  },
  versions: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await documentTemplateService.versions(String(req.params["id"])),
      });
    } catch (error) {
      next(error);
    }
  },
  issued: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await documentTemplateService.issued() });
    } catch (error) {
      next(error);
    }
  },
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await documentTemplateService.save(req.body, String(req.user?._id));
      res.status(201).json({ success: true, data, message: "Template created" });
    } catch (error) {
      next(error);
    }
  },
  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await documentTemplateService.save(
        req.body,
        String(req.user?._id),
        String(req.params["id"]),
      );
      res.json({ success: true, data, message: "Template updated" });
    } catch (error) {
      next(error);
    }
  },
  transition: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const action = String(req.params["action"]);
      const userId = String(req.user?._id);
      const handlers = {
        submit: () => documentTemplateService.submit(String(req.params["id"]), userId),
        approve: () => documentTemplateService.approve(String(req.params["id"]), userId),
        publish: () => documentTemplateService.publish(String(req.params["id"]), userId),
        revise: () => documentTemplateService.revise(String(req.params["id"])),
        retire: () => documentTemplateService.retire(String(req.params["id"]), userId),
      };
      const handler = handlers[action as keyof typeof handlers];
      if (!handler) throw new Error("Unsupported template lifecycle action");
      const data = await handler();
      await auditLogRepository.create({
        user: req.user,
        action: `DOCUMENT_TEMPLATE_${action.toUpperCase()}`,
        module: "document_template",
        targetId: String(req.params["id"]),
        targetModel: "DocumentTemplate",
        description: `${action} document template ${data?.name ?? req.params["id"]}`,
        req,
      });
      res.json({ success: true, data, message: `Template ${action} completed` });
    } catch (error) {
      next(error);
    }
  },
  issue: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const output = await documentTemplateService.issue(
        String(req.params["id"]),
        String(req.body.subjectId),
        String(req.user?._id),
      );
      await auditLogRepository.create({
        user: req.user,
        action: "DOCUMENT_ISSUED",
        module: "document_template",
        targetId: String(output.issued._id),
        targetModel: "IssuedDocument",
        description: `Issued ${output.issued.documentNumber}`,
        req,
      });
      res.json({
        success: true,
        data: { issued: output.issued, pdfBase64: output.pdf.toString("base64") },
        message: "Document issued",
      });
    } catch (error) {
      next(error);
    }
  },
  verify: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await documentTemplateService.verify(String(req.params["code"]));
      res.json({ success: true, data, valid: Boolean(data && !data.revokedAt) });
    } catch (error) {
      next(error);
    }
  },
  revoke: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await documentTemplateService.revoke(
        String(req.params["id"]),
        String(req.body.reason ?? ""),
      );
      await auditLogRepository.create({
        user: req.user,
        action: "DOCUMENT_REVOKED",
        module: "document_template",
        targetId: String(data._id),
        targetModel: "IssuedDocument",
        description: `Revoked ${data.documentNumber}`,
        metadata: { reason: data.revocationReason },
        req,
      });
      res.json({ success: true, data, message: "Document revoked" });
    } catch (error) {
      next(error);
    }
  },
};

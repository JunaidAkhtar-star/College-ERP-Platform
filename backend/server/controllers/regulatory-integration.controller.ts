import type { NextFunction, Request, Response } from "express";
import { auditLogRepository } from "../repositories/audit-log.repository";
import { regulatoryIntegrationService } from "../services/regulatory-integration.service";
import type { TRegulatoryProvider } from "../models/regulatory-integration.model";
import type { UploadedFile } from "express-fileupload";
import { uploadUtil } from "../utils/upload.util";
import { BadRequest } from "http-errors";
import { regulatoryDataService } from "../services/regulatory-data.service";
import { regulatorySubmissionService } from "../services/regulatory-submission.service";
import { regulatoryConnectionService } from "../services/regulatory-connection.service";

export const regulatoryIntegrationController = {
  overview: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await regulatoryIntegrationService.overview() });
    } catch (error) {
      next(error);
    }
  },
  operational: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const provider = String(req.params["provider"]) as TRegulatoryProvider;
      const academicYear = String(req.query["academicYear"] ?? "").trim() || undefined;
      res.json({
        success: true,
        data: await regulatoryDataService.operational(provider, academicYear),
      });
    } catch (error) {
      next(error);
    }
  },
  listSubmissions: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await regulatorySubmissionService.list(
          req.query["provider"]
            ? (String(req.query["provider"]) as TRegulatoryProvider)
            : undefined,
          req.query["academicYear"] ? String(req.query["academicYear"]) : undefined,
        ),
      });
    } catch (error) {
      next(error);
    }
  },
  listConnections: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await regulatoryConnectionService.list() });
    } catch (error) {
      next(error);
    }
  },
  saveConnection: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const provider = String(req.params["provider"]) as TRegulatoryProvider;
      const data = await regulatoryConnectionService.save(
        provider,
        req.body,
        String(req.user?._id),
      );
      await auditLogRepository.create({
        user: req.user,
        action: "REGULATORY_CONNECTION_PROFILE_UPDATED",
        module: "regulatory_integration",
        targetId: provider,
        targetModel: "RegulatoryConnection",
        description: `Updated ${provider} connection profile`,
        metadata: { provider, mode: data.mode, status: data.status },
        req,
      });
      res.json({ success: true, data, message: "Connection profile saved" });
    } catch (error) {
      next(error);
    }
  },
  testConnection: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await regulatoryConnectionService.test(
        String(req.params["provider"]) as TRegulatoryProvider,
        String(req.user?._id),
      );
      res.json({ success: true, data, message: data.message });
    } catch (error) {
      next(error);
    }
  },
  createSubmission: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const provider = String(req.params["provider"]) as TRegulatoryProvider;
      const data = await regulatorySubmissionService.create(
        provider,
        String(req.body.academicYear),
        String(req.user?._id),
      );
      await auditLogRepository.create({
        user: req.user,
        action: "REGULATORY_SUBMISSION_BATCH_CREATED",
        module: "regulatory_integration",
        targetId: String(data._id),
        targetModel: "RegulatorySubmission",
        description: `Created ${provider} submission batch ${data.batchNumber}`,
        metadata: { provider, academicYear: data.academicYear, records: data.rows.length },
        req,
      });
      res.status(201).json({ success: true, data, message: "Submission batch created" });
    } catch (error) {
      next(error);
    }
  },
  requestSubmissionReview: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await regulatorySubmissionService.requestReview(
        String(req.params["batchId"]),
        String(req.user?._id),
        String(req.body.note),
      );
      res.json({ success: true, data, message: "Batch sent for independent review" });
    } catch (error) {
      next(error);
    }
  },
  decideSubmission: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await regulatorySubmissionService.decide(
        String(req.params["batchId"]),
        String(req.user?._id),
        req.body.decision,
        String(req.body.note),
      );
      res.json({ success: true, data, message: `Batch ${req.body.decision}` });
    } catch (error) {
      next(error);
    }
  },
  markSubmissionExported: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await regulatorySubmissionService.markExported(
        String(req.params["batchId"]),
        String(req.user?._id),
      );
      res.json({ success: true, data, message: "Governed batch export generated" });
    } catch (error) {
      next(error);
    }
  },
  markSubmissionSubmitted: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await regulatorySubmissionService.markSubmitted(
        String(req.params["batchId"]),
        String(req.user?._id),
        String(req.body.acknowledgementReference),
      );
      res.json({ success: true, data, message: "Portal submission recorded" });
    } catch (error) {
      next(error);
    }
  },
  reconcileSubmission: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await regulatorySubmissionService.reconcile(
        String(req.params["batchId"]),
        String(req.user?._id),
        Number(req.body.acceptedRecords),
        Number(req.body.rejectedRecords),
        String(req.body.note),
      );
      res.json({ success: true, data, message: "Submission response reconciled" });
    } catch (error) {
      next(error);
    }
  },
  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const provider = String(req.params["provider"]) as TRegulatoryProvider;
      const data = await regulatoryIntegrationService.update(
        provider,
        req.body,
        String(req.user?._id),
      );
      await auditLogRepository.create({
        user: req.user,
        action: "REGULATORY_INTEGRATION_UPDATED",
        module: "regulatory_integration",
        targetId: String(data._id),
        targetModel: "RegulatoryIntegration",
        description: `Updated ${provider} regulatory onboarding`,
        metadata: { provider, status: data.status, productionEnabled: data.productionEnabled },
        req,
      });
      res.json({ success: true, data, message: "Integration onboarding updated" });
    } catch (error) {
      next(error);
    }
  },
  requestApproval: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const provider = String(req.params["provider"]) as TRegulatoryProvider;
      const data = await regulatoryIntegrationService.requestApproval(
        provider,
        String(req.user?._id),
        String(req.body.reason),
      );
      await auditLogRepository.create({
        user: req.user,
        action: "REGULATORY_PRODUCTION_APPROVAL_REQUESTED",
        module: "regulatory_integration",
        targetId: String(data._id),
        targetModel: "RegulatoryIntegration",
        description: `Requested ${provider} production authorization`,
        metadata: { provider, reason: req.body.reason },
        req,
      });
      res.json({ success: true, data, message: "Production authorization requested" });
    } catch (error) {
      next(error);
    }
  },
  decideApproval: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const provider = String(req.params["provider"]) as TRegulatoryProvider;
      const data = await regulatoryIntegrationService.decideApproval(
        provider,
        String(req.user?._id),
        req.body.decision,
        String(req.body.note),
      );
      await auditLogRepository.create({
        user: req.user,
        action: `REGULATORY_PRODUCTION_${String(req.body.decision).toUpperCase()}`,
        module: "regulatory_integration",
        targetId: String(data._id),
        targetModel: "RegulatoryIntegration",
        description: `${req.body.decision} ${provider} production authorization`,
        metadata: { provider, decision: req.body.decision, note: req.body.note },
        req,
      });
      res.json({ success: true, data, message: "Approval decision recorded" });
    } catch (error) {
      next(error);
    }
  },
  uploadEvidence: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = (req.files?.file ?? req.files?.document) as UploadedFile | undefined;
      if (!file) throw new BadRequest('Multipart field "file" is required.');
      const provider = String(req.params["provider"]) as TRegulatoryProvider;
      const uploaded = await uploadUtil.uploadDocument(file, "erp/regulatory-evidence");
      const data = await regulatoryIntegrationService.addEvidence(provider, String(req.user?._id), {
        type: String(req.body.type),
        name: String(req.body.name || file.name),
        url: uploaded.url,
        publicId: uploaded.publicId,
        issuedAt: req.body.issuedAt,
        expiresAt: req.body.expiresAt,
      });
      res.json({ success: true, data, message: "Evidence uploaded" });
    } catch (error) {
      next(error);
    }
  },
  removeEvidence: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const provider = String(req.params["provider"]) as TRegulatoryProvider;
      const removed = await regulatoryIntegrationService.removeEvidence(
        provider,
        String(req.params["evidenceId"]),
        String(req.user?._id),
      );
      if (removed.publicId) await uploadUtil.deleteFile(removed.publicId);
      res.json({ success: true, message: "Evidence removed" });
    } catch (error) {
      next(error);
    }
  },
  addCycle: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const provider = String(req.params["provider"]) as TRegulatoryProvider;
      const data = await regulatoryIntegrationService.addCycle(
        provider,
        req.body,
        String(req.user?._id),
      );
      res.status(201).json({ success: true, data, message: "Reporting cycle created" });
    } catch (error) {
      next(error);
    }
  },
  updateCycle: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await regulatoryIntegrationService.updateCycle(
        String(req.params["provider"]) as TRegulatoryProvider,
        String(req.params["cycleId"]),
        req.body,
        String(req.user?._id),
      );
      res.json({ success: true, data, message: "Reporting cycle updated" });
    } catch (error) {
      next(error);
    }
  },
  deleteCycle: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await regulatoryIntegrationService.deleteCycle(
        String(req.params["provider"]) as TRegulatoryProvider,
        String(req.params["cycleId"]),
        String(req.user?._id),
      );
      res.json({ success: true, message: "Draft reporting cycle deleted" });
    } catch (error) {
      next(error);
    }
  },
};

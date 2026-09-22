import type { NextFunction, Request, Response } from "express";
import { complianceWorkspaceService } from "../services/compliance-workspace.service";
import { auditLogRepository } from "../repositories/audit-log.repository";
import { applyDepartmentScope, getDepartmentScope } from "../utils/ownership.util";
import { accreditationSetupService } from "../services/accreditation-setup.service";

const audit = (
  req: Request,
  action: string,
  description: string,
  targetId?: string,
  metadata?: Record<string, unknown>,
) =>
  auditLogRepository.create({
    user: req.user,
    action,
    module: "compliance",
    targetId,
    targetModel: "ComplianceWorkspace",
    description,
    metadata,
    req,
  });

export const complianceWorkspaceController = {
  accreditationSetup: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await accreditationSetupService.get() });
    } catch (error) {
      next(error);
    }
  },
  saveAccreditationProfile: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await accreditationSetupService.saveProfile(req.body);
      await audit(
        req,
        "ACCREDITATION_PROFILE_UPDATED",
        "Updated accreditation classification",
        String(data?._id),
      );
      res.json({ success: true, data, message: "Institution classification saved" });
    } catch (error) {
      next(error);
    }
  },
  accreditationRecommendations: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await accreditationSetupService.recommendations() });
    } catch (error) {
      next(error);
    }
  },
  addAccreditationScope: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await accreditationSetupService.addScope(req.body);
      await audit(
        req,
        "ACCREDITATION_SCOPE_CREATED",
        `Added ${req.body.frameworkSlug} scope`,
        String(data?._id),
      );
      res.status(201).json({ success: true, data, message: "Framework scope added as draft" });
    } catch (error) {
      next(error);
    }
  },
  requestAccreditationActivation: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await accreditationSetupService.requestActivation(
        String(req.params["scopeId"]),
        String(req.user?._id),
      );
      await audit(
        req,
        "ACCREDITATION_ACTIVATION_REQUESTED",
        "Requested independent framework activation",
        String(req.params["scopeId"]),
      );
      res.json({ success: true, data, message: "Framework sent for independent approval" });
    } catch (error) {
      next(error);
    }
  },
  decideAccreditationActivation: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await accreditationSetupService.decideActivation(
        String(req.params["scopeId"]),
        String(req.user?._id),
        req.body.approved,
        req.body.note,
      );
      await audit(
        req,
        "ACCREDITATION_ACTIVATION_DECIDED",
        req.body.approved ? "Approved framework activation" : "Rejected framework activation",
        String(req.params["scopeId"]),
      );
      res.json({
        success: true,
        data,
        message: req.body.approved ? "Framework activated" : "Framework returned for revision",
      });
    } catch (error) {
      next(error);
    }
  },
  advanceAccreditationTrust: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await accreditationSetupService.advanceTrust(
        String(req.params["scopeId"]),
        String(req.user?._id),
        req.body,
      );
      await audit(
        req,
        "ACCREDITATION_TRUST_ADVANCED",
        `Recorded evidence-backed trust state ${req.body.state}`,
        String(req.params["scopeId"]),
        { evidenceSource: req.body.evidenceSource },
      );
      res.json({
        success: true,
        data,
        message: "Verification evidence recorded; no provider request was sent",
      });
    } catch (error) {
      next(error);
    }
  },
  accreditationReadiness: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: await accreditationSetupService.readiness(String(req.query["academicYear"])),
      });
    } catch (error) {
      next(error);
    }
  },
  createAccreditationSnapshot: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await accreditationSetupService.createSnapshot(
        String(req.params["scopeId"]),
        String(req.user?._id),
      );
      await audit(
        req,
        "ACCREDITATION_SNAPSHOT_CREATED",
        `Created immutable snapshot ${data.snapshotNumber}`,
        String(data._id),
        { payloadHash: data.payloadHash },
      );
      res
        .status(201)
        .json({ success: true, data, message: "Immutable preparation snapshot created" });
    } catch (error) {
      next(error);
    }
  },
  accreditationSnapshots: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await accreditationSetupService.snapshots() });
    } catch (error) {
      next(error);
    }
  },
  catalog: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: await complianceWorkspaceService.catalog() });
    } catch (error) {
      next(error);
    }
  },
  activateCatalogFramework: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await complianceWorkspaceService.activateCatalogFramework(
        String(req.params["key"]),
        String(req.user?._id),
      );
      await audit(
        req,
        "COMPLIANCE_FRAMEWORK_ACTIVATED",
        `Activated framework ${data?.shortName}`,
        String(data?._id),
      );
      res.status(201).json({ success: true, data, message: "Compliance framework activated" });
    } catch (error) {
      next(error);
    }
  },
  frameworks: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await complianceWorkspaceService.frameworks(
        req.query["includeInactive"] === "true",
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  createFramework: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await complianceWorkspaceService.saveFramework(req.body);
      if (!data) throw new Error("Framework creation failed");
      await audit(
        req,
        "COMPLIANCE_FRAMEWORK_CREATED",
        `Created framework ${data.shortName}`,
        String(data._id),
      );
      res.status(201).json({ success: true, data, message: "Compliance framework created" });
    } catch (error) {
      next(error);
    }
  },
  updateFramework: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await complianceWorkspaceService.saveFramework(
        req.body,
        String(req.params["id"]),
      );
      await audit(
        req,
        "COMPLIANCE_FRAMEWORK_UPDATED",
        `Updated framework ${data?.shortName}`,
        String(data?._id),
      );
      res.json({ success: true, data, message: "Compliance framework updated" });
    } catch (error) {
      next(error);
    }
  },
  requirements: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await complianceWorkspaceService.requirements(
        req.query as Record<string, string>,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  createRequirement: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await complianceWorkspaceService.saveRequirement(req.body);
      await audit(
        req,
        "COMPLIANCE_REQUIREMENT_CREATED",
        `Created ${req.body.framework} requirement`,
        String(data._id),
      );
      res.status(201).json({ success: true, data, message: "Requirement created" });
    } catch (error) {
      next(error);
    }
  },
  updateRequirement: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await complianceWorkspaceService.saveRequirement(
        req.body,
        String(req.params["id"]),
      );
      await audit(
        req,
        "COMPLIANCE_REQUIREMENT_UPDATED",
        "Updated compliance requirement",
        String(data._id),
      );
      res.json({ success: true, data, message: "Requirement updated" });
    } catch (error) {
      next(error);
    }
  },
  submissions: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter = await applyDepartmentScope(
        req,
        req.query as Record<string, string>,
        "departmentId",
      );
      const data = await complianceWorkspaceService.submissions(filter as Record<string, string>);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  createSubmission: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const departmentId = await getDepartmentScope(req);
      const data = await complianceWorkspaceService.saveSubmission(
        req.body,
        String(req.user?._id),
        undefined,
        departmentId,
      );
      await audit(
        req,
        "COMPLIANCE_RECORD_CREATED",
        "Created compliance submission",
        String(data._id),
        { status: data.status },
      );
      res.status(201).json({ success: true, data, message: "Compliance record saved" });
    } catch (error) {
      next(error);
    }
  },
  updateSubmission: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const departmentId = await getDepartmentScope(req);
      const data = await complianceWorkspaceService.saveSubmission(
        req.body,
        String(req.user?._id),
        String(req.params["id"]),
        departmentId,
      );
      await audit(
        req,
        "COMPLIANCE_RECORD_UPDATED",
        "Updated compliance submission",
        String(data._id),
        { status: data.status },
      );
      res.json({ success: true, data, message: "Compliance record updated" });
    } catch (error) {
      next(error);
    }
  },
  reviewSubmission: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await complianceWorkspaceService.reviewSubmission(
        String(req.params["id"]),
        req.body.status,
        req.body.remarks ?? "",
        String(req.user?._id),
      );
      await audit(
        req,
        "COMPLIANCE_RECORD_REVIEWED",
        "Reviewed compliance submission",
        String(data._id),
        { status: data.status },
      );
      res.json({ success: true, data, message: "Compliance review recorded" });
    } catch (error) {
      next(error);
    }
  },
  findings: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const departmentId = await getDepartmentScope(req);
      res.json({
        success: true,
        data: await complianceWorkspaceService.findings(
          departmentId,
          req.query["academicYear"] as string | undefined,
        ),
      });
    } catch (error) {
      next(error);
    }
  },
  createFinding: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(201).json({
        success: true,
        data: await complianceWorkspaceService.createFinding(req.body, String(req.user?._id)),
      });
    } catch (error) {
      next(error);
    }
  },
  submitFindingRemediation: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await complianceWorkspaceService.submitFindingRemediation(
        String(req.params["id"]),
        String(req.user?._id),
        req.body,
      );
      await audit(
        req,
        "COMPLIANCE_REMEDIATION_SUBMITTED",
        "Submitted finding remediation",
        String(data?._id),
      );
      res.json({ success: true, data, message: "Remediation submitted for verification" });
    } catch (error) {
      next(error);
    }
  },
  verifyFinding: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await complianceWorkspaceService.verifyFinding(
        String(req.params["id"]),
        String(req.user?._id),
        req.body.closureNote,
        req.body.accepted,
      );
      await audit(
        req,
        "COMPLIANCE_REMEDIATION_VERIFIED",
        "Verified finding remediation",
        String(data?._id),
        { accepted: req.body.accepted },
      );
      res.json({
        success: true,
        data,
        message: req.body.accepted ? "Finding closed" : "Remediation returned",
      });
    } catch (error) {
      next(error);
    }
  },
  dashboard: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const departmentId = await getDepartmentScope(req);
      const data = await complianceWorkspaceService.dashboard(
        req.query["academicYear"] as string,
        departmentId,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  auditManifest: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const departmentId = await getDepartmentScope(req);
      const data = await complianceWorkspaceService.auditManifest(
        String(req.query["academicYear"]),
        req.query["framework"] as string | undefined,
        departmentId,
      );
      await audit(
        req,
        "COMPLIANCE_AUDIT_MANIFEST_EXPORTED",
        "Exported compliance audit manifest",
        undefined,
        { academicYear: req.query["academicYear"], framework: req.query["framework"] },
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=compliance-audit-${req.query["academicYear"]}.json`,
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  tallyConfig: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await complianceWorkspaceService.tallyConfig();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
  saveTallyConfig: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await complianceWorkspaceService.saveTallyConfig(req.body);
      await audit(
        req,
        "TALLY_CONFIGURATION_UPDATED",
        "Updated Tally integration configuration",
        String(data?._id),
      );
      res.json({ success: true, data, message: "Tally configuration saved" });
    } catch (error) {
      next(error);
    }
  },
  tallyExport: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const output = await complianceWorkspaceService.tallyExport(
        String(req.query["financialYear"] ?? ""),
        req.query["from"] as string,
        req.query["to"] as string,
      );
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=tally-vouchers.xml");
      res.send(output.xml);
    } catch (error) {
      next(error);
    }
  },
  tallyExportJson: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await complianceWorkspaceService.tallyExport(
        req.body.financialYear,
        req.body.from,
        req.body.to,
      );
      await audit(
        req,
        "TALLY_VOUCHERS_EXPORTED",
        `Exported ${data.count} journals to Tally`,
        undefined,
        { financialYear: req.body.financialYear, count: data.count },
      );
      res.json({ success: true, data, message: `${data.count} vouchers prepared for Tally` });
    } catch (error) {
      next(error);
    }
  },
};

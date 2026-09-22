import createError from "http-errors";
import { formatIndiaDate } from "../utils/date.util";
import { Types } from "mongoose";
import {
  ComplianceFrameworkModel,
  ComplianceFindingModel,
  ComplianceRequirementModel,
  ComplianceSubmissionModel,
  TallyConfigurationModel,
  type IComplianceFramework,
  type IComplianceRequirement,
  type IComplianceSubmission,
  type ITallyConfiguration,
} from "../models/compliance-workspace.model";
import { JournalEntryModel } from "../models/general-ledger.model";
import { nextSeq } from "../models/counter.model";
import {
  NotificationAudience,
  NotificationChannel,
  NotificationType,
} from "../models/notification.model";
import { notificationService } from "./notification.service";
import { COMPLIANCE_CATALOG } from "../constants/compliance-catalog";

const notifyUsers = async (input: {
  userIds: string[];
  title: string;
  body: string;
  actorId: string;
}) => {
  if (!input.userIds.length) return;
  await notificationService.create({
    title: input.title,
    body: input.body,
    type: NotificationType.INFO,
    channels: [NotificationChannel.IN_APP],
    audience: NotificationAudience.SPECIFIC_USER,
    targetUserIds: input.userIds,
    actionUrl: "/compliance",
    createdBy: input.actorId,
    createdByName: "Compliance workflow",
  });
};

const xml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export const complianceWorkspaceService = {
  catalog: async () => {
    const activeSlugs = new Set(
      await ComplianceFrameworkModel.find({ isActive: true }).distinct("slug"),
    );
    return COMPLIANCE_CATALOG.map((item) => ({
      ...item,
      isActivated: activeSlugs.has(item.slug),
    }));
  },

  activateCatalogFramework: async (key: string, actorId: string) => {
    const template = COMPLIANCE_CATALOG.find((item) => item.key === key);
    if (!template) throw createError(404, "Compliance framework template not found");
    const existing = await ComplianceFrameworkModel.findOne({ slug: template.slug }).lean();
    if (existing) {
      if (existing.isActive) throw createError(409, "Compliance framework is already active");
      return ComplianceFrameworkModel.findByIdAndUpdate(
        existing._id,
        { isActive: true, activatedAt: new Date(), activatedBy: actorId },
        { returnDocument: "after", runValidators: true },
      ).lean();
    }
    return ComplianceFrameworkModel.create({
      ...template,
      version: "1.0",
      institutionTypes: [],
      terminology: {
        requirement: "Requirement",
        submission: "Evidence submission",
        reportingPeriod: "Reporting period",
      },
      color: "blue",
      icon: "shield-check",
      isSystem: true,
      isActive: true,
      activatedAt: new Date(),
      activatedBy: actorId,
    });
  },
  frameworks: async (includeInactive = false) => {
    return ComplianceFrameworkModel.find(includeInactive ? {} : { isActive: true })
      .sort({ isSystem: -1, shortName: 1 })
      .lean();
  },

  saveFramework: async (data: Partial<IComplianceFramework>, id?: string) => {
    const slug = String(data.slug ?? "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (!slug || !data.name || !data.shortName || !data.country)
      throw createError(400, "slug, name, shortName and country are required");
    if (
      data.effectiveFrom &&
      data.effectiveTo &&
      new Date(data.effectiveTo) < new Date(data.effectiveFrom)
    )
      throw createError(400, "Effective end date must be after the start date");
    const update = { ...data, slug };
    if (id) {
      const current = await ComplianceFrameworkModel.findById(id).lean();
      if (!current) throw createError(404, "Compliance framework not found");
      if (current.isSystem && current.slug !== slug)
        throw createError(409, "A system framework slug cannot be changed");
      const versionChanged = Boolean(data.version && data.version !== current.version);
      const operation: Record<string, unknown> = { $set: update };
      if (versionChanged) {
        operation["$push"] = {
          revisions: {
            version: current.version,
            name: current.name,
            authority: current.authority,
            terminology: current.terminology,
            archivedAt: new Date(),
          },
        };
      }
      const row = await ComplianceFrameworkModel.findByIdAndUpdate(id, operation, {
        returnDocument: "after",
        runValidators: true,
      }).lean();
      return row;
    }
    return ComplianceFrameworkModel.create(update);
  },

  requirements: async (filter: Record<string, string>) => {
    const q: Record<string, unknown> = {};
    if (filter["framework"]) q["framework"] = filter["framework"];
    if (filter["category"]) q["category"] = filter["category"];
    if (filter["active"] !== undefined) q["isActive"] = filter["active"] === "true";
    if (filter["search"]) {
      const re = new RegExp(filter["search"], "i");
      q["$or"] = [{ code: re }, { title: re }, { description: re }];
    }
    return ComplianceRequirementModel.find(q)
      .populate("departmentIds", "name code")
      .populate("ownerIds reviewerIds", "name email")
      .sort({ framework: 1, category: 1, code: 1 })
      .lean();
  },

  saveRequirement: async (data: Partial<IComplianceRequirement>, id?: string) => {
    if (!data.framework || !data.code || !data.title || !data.category)
      throw createError(400, "framework, code, title and category are required");
    const framework = await ComplianceFrameworkModel.findOne({
      slug: data.framework,
      isActive: true,
    }).lean();
    if (!framework) throw createError(400, "Active compliance framework not found");
    if (id) {
      const row = await ComplianceRequirementModel.findByIdAndUpdate(id, data, {
        returnDocument: "after",
        runValidators: true,
      }).lean();
      if (!row) throw createError(404, "Compliance requirement not found");
      return row;
    }
    return ComplianceRequirementModel.create(data);
  },

  submissions: async (filter: Record<string, string>) => {
    if (!filter["academicYear"]) throw createError(400, "Academic year is required");
    const q: Record<string, unknown> = {};
    if (filter["academicYear"]) q["academicYear"] = filter["academicYear"];
    if (filter["status"]) q["status"] = filter["status"];
    if (filter["requirementId"]) q["requirementId"] = filter["requirementId"];
    const data = await ComplianceSubmissionModel.find(q)
      .populate(
        "requirementId",
        "framework code title category frequency targetValue unit requiredFields",
      )
      .populate("departmentId", "name code")
      .populate("submittedBy reviewedBy", "name email")
      .sort({ updatedAt: -1 })
      .lean();
    if (!filter["framework"]) return data;
    return data.filter((row) => {
      const requirement = row.requirementId as unknown as { framework?: string };
      return requirement?.framework === filter["framework"];
    });
  },

  saveSubmission: async (
    data: Partial<IComplianceSubmission>,
    userId: string,
    id?: string,
    scopedDepartmentId?: string,
  ) => {
    if (!data.requirementId || !data.academicYear)
      throw createError(400, "requirementId and academicYear are required");
    const requirement = await ComplianceRequirementModel.findById(data.requirementId).lean();
    if (!requirement || !requirement.isActive)
      throw createError(400, "Active requirement not found");
    if (
      requirement.ownerIds?.length &&
      !requirement.ownerIds.some((ownerId) => String(ownerId) === userId)
    )
      throw createError(403, "This compliance requirement is assigned to another owner");
    for (const field of requirement.requiredFields.filter((item) => item.required)) {
      const value = data.values?.[field.key];
      if (value === undefined || value === "") throw createError(400, `${field.label} is required`);
    }
    const update: Partial<IComplianceSubmission> = {
      requirementId: data.requirementId,
      academicYear: data.academicYear,
      period: data.period,
      values: data.values,
      evidenceFiles: data.evidenceFiles,
      status: data.status,
      remarks: data.remarks,
      evidenceValidUntil:
        data.evidenceValidUntil ??
        (data.status === "submitted" && requirement.evidenceValidityDays
          ? new Date(Date.now() + requirement.evidenceValidityDays * 24 * 60 * 60 * 1000)
          : undefined),
      ...(data.departmentId ? { departmentId: data.departmentId } : {}),
      ...(scopedDepartmentId ? { departmentId: new Types.ObjectId(scopedDepartmentId) } : {}),
    };
    if (data.status === "submitted") {
      update.submittedBy = new Types.ObjectId(userId);
      update.submittedAt = new Date();
    }
    if (id) {
      const current = await ComplianceSubmissionModel.findById(id).lean();
      if (!current) throw createError(404, "Compliance submission not found");
      if (["submitted", "approved"].includes(current.status))
        throw createError(409, "Submitted or approved compliance records are immutable");
      if (String(current.requirementId) !== String(data.requirementId))
        throw createError(409, "Compliance requirement is immutable");
      if (current.academicYear !== data.academicYear)
        throw createError(409, "Compliance academic year is immutable");
      if (scopedDepartmentId && String(current.departmentId ?? "") !== scopedDepartmentId)
        throw createError(403, "You can update only your department compliance records");
      const row = await ComplianceSubmissionModel.findOneAndUpdate(
        { _id: id, status: { $nin: ["submitted", "approved"] } },
        update,
        {
          returnDocument: "after",
          runValidators: true,
        },
      ).lean();
      if (!row) throw createError(409, "Compliance record changed while it was being updated");
      if (data.status === "submitted") {
        await notifyUsers({
          userIds: requirement.reviewerIds.map(String).filter((id) => id !== userId),
          title: "Compliance evidence awaiting review",
          body: `${requirement.code}: ${requirement.title} was submitted for independent review.`,
          actorId: userId,
        });
      }
      return row;
    }
    const row = await ComplianceSubmissionModel.create(update);
    if (data.status === "submitted") {
      await notifyUsers({
        userIds: requirement.reviewerIds.map(String).filter((id) => id !== userId),
        title: "Compliance evidence awaiting review",
        body: `${requirement.code}: ${requirement.title} was submitted for independent review.`,
        actorId: userId,
      });
    }
    return row;
  },

  reviewSubmission: async (id: string, status: string, remarks: string, userId: string) => {
    if (!["approved", "non_compliant"].includes(status))
      throw createError(400, "Invalid review status");
    const current = await ComplianceSubmissionModel.findById(id).lean();
    if (!current) throw createError(404, "Compliance submission not found");
    if (current.status !== "submitted")
      throw createError(409, "Only submitted compliance records can be reviewed");
    if (!current.submittedBy)
      throw createError(409, "Submitted compliance record has no submitter");
    if (String(current.submittedBy) === userId)
      throw createError(409, "Compliance review requires an independent reviewer");
    const requirement = await ComplianceRequirementModel.findById(current.requirementId)
      .select("reviewerIds")
      .lean();
    if (
      requirement?.reviewerIds?.length &&
      !requirement.reviewerIds.some((reviewerId) => String(reviewerId) === userId)
    )
      throw createError(403, "This compliance requirement is assigned to another reviewer");
    const row = await ComplianceSubmissionModel.findOneAndUpdate(
      { _id: id, status: "submitted", submittedBy: { $ne: userId } },
      { status, remarks, reviewedBy: userId, reviewedAt: new Date() },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!row) throw createError(409, "Compliance record changed while it was being reviewed");
    await notifyUsers({
      userIds: [String(current.submittedBy)],
      title: status === "approved" ? "Compliance evidence approved" : "Compliance action required",
      body:
        status === "approved"
          ? "Your submitted compliance evidence was approved."
          : `Your compliance evidence requires corrective action. ${remarks}`,
      actorId: userId,
    });
    return row;
  },

  findings: async (departmentId?: string, academicYear?: string) => {
    const query: Record<string, unknown> = {};
    if (departmentId || academicYear) {
      const submissionIds = await ComplianceSubmissionModel.find({
        ...(departmentId ? { departmentId } : {}),
        ...(academicYear ? { academicYear } : {}),
      }).distinct("_id");
      query["submissionId"] = { $in: submissionIds };
    }
    return ComplianceFindingModel.find(query)
      .populate({
        path: "submissionId",
        select: "academicYear status requirementId departmentId",
        populate: { path: "requirementId", select: "framework code title category" },
      })
      .populate("ownerId raisedBy verifiedBy", "name email")
      .sort({ dueAt: 1 })
      .limit(500)
      .lean();
  },
  async createFinding(
    input: {
      submissionId: string;
      title: string;
      description: string;
      severity: "low" | "medium" | "high" | "critical";
      ownerId: string;
      dueAt: Date;
    },
    actorId: string,
  ) {
    const submission = await ComplianceSubmissionModel.findById(input.submissionId).lean();
    if (!submission) throw createError(404, "Compliance submission not found");
    if (new Date(input.dueAt) <= new Date())
      throw createError(400, "Finding due date must be future");
    const year = new Date().getFullYear();
    const sequence = await nextSeq(`compliance-finding-${year}`);
    const finding = await ComplianceFindingModel.create({
      ...input,
      findingNumber: `FND-${year}-${String(sequence).padStart(6, "0")}`,
      raisedBy: actorId,
    });
    await notifyUsers({
      userIds: [input.ownerId],
      title: `Compliance finding assigned: ${finding.findingNumber}`,
      body: `${input.title} is due ${formatIndiaDate(input.dueAt)}.`,
      actorId,
    });
    return finding;
  },
  async submitFindingRemediation(
    id: string,
    actorId: string,
    input: { remediationPlan: string; evidenceFiles: { name: string; url: string }[] },
  ) {
    const finding = await ComplianceFindingModel.findById(id).lean();
    if (!finding) throw createError(404, "Compliance finding not found");
    if (String(finding.ownerId) !== actorId)
      throw createError(403, "Only the assigned finding owner can submit remediation");
    if (!input.remediationPlan?.trim() || !input.evidenceFiles?.length)
      throw createError(400, "Remediation plan and evidence are required");
    if (!["open", "remediation_in_progress"].includes(finding.status))
      throw createError(409, "Finding is not accepting remediation");
    const updated = await ComplianceFindingModel.findOneAndUpdate(
      { _id: id, status: finding.status, ownerId: actorId },
      {
        status: "pending_verification",
        remediationPlan: input.remediationPlan,
        evidenceFiles: input.evidenceFiles,
      },
      { returnDocument: "after", runValidators: true },
    ).lean();
    const submission = await ComplianceSubmissionModel.findById(finding.submissionId)
      .select("requirementId")
      .lean();
    const requirement = submission
      ? await ComplianceRequirementModel.findById(submission.requirementId)
          .select("reviewerIds code")
          .lean()
      : null;
    await notifyUsers({
      userIds: (requirement?.reviewerIds ?? []).map(String).filter((userId) => userId !== actorId),
      title: "Compliance remediation awaiting verification",
      body: `${finding.findingNumber}${requirement?.code ? ` · ${requirement.code}` : ""} is ready for independent verification.`,
      actorId,
    });
    return updated;
  },

  async verifyFinding(id: string, actorId: string, closureNote: string, accepted: boolean) {
    const finding = await ComplianceFindingModel.findById(id).lean();
    if (!finding) throw createError(404, "Compliance finding not found");
    if (finding.status !== "pending_verification")
      throw createError(409, "Only pending remediation can be verified");
    if (String(finding.ownerId) === actorId)
      throw createError(409, "Finding owner cannot verify their own remediation");
    if (closureNote.trim().length < 10)
      throw createError(400, "A closure verification note is required (at least 10 characters)");
    const updated = await ComplianceFindingModel.findOneAndUpdate(
      { _id: id, status: "pending_verification", ownerId: { $ne: actorId } },
      {
        status: accepted ? "closed" : "remediation_in_progress",
        closureNote,
        ...(accepted ? { verifiedBy: actorId, verifiedAt: new Date() } : {}),
      },
      { returnDocument: "after", runValidators: true },
    ).lean();
    await notifyUsers({
      userIds: [String(finding.ownerId)],
      title: accepted ? "Compliance finding closed" : "Compliance remediation returned",
      body: `${finding.findingNumber}: ${closureNote}`,
      actorId,
    });
    return updated;
  },

  dashboard: async (academicYear: string, departmentId?: string) => {
    if (!academicYear) throw createError(400, "Academic year is required");
    const requirementQuery = { isActive: true };
    const submissionQuery: Record<string, unknown> = {
      academicYear,
      ...(departmentId ? { departmentId } : {}),
    };
    const [requirements, submissions] = await Promise.all([
      ComplianceRequirementModel.find(requirementQuery).lean(),
      ComplianceSubmissionModel.find(submissionQuery).populate("requirementId", "framework").lean(),
    ]);
    const frameworkDefinitions = await ComplianceFrameworkModel.find({ isActive: true }).lean();
    const frameworks = frameworkDefinitions.map((definition) => {
      const framework = definition.slug;
      const requirementIds = new Set(
        requirements.filter((r) => r.framework === framework).map((r) => String(r._id)),
      );
      const rows = submissions.filter((s) =>
        requirementIds.has(String(s.requirementId._id ?? s.requirementId)),
      );
      const approved = rows.filter((s) => s.status === "approved").length;
      const total = requirementIds.size;
      return {
        framework,
        name: definition.name,
        shortName: definition.shortName,
        color: definition.color,
        total,
        completed: approved,
        pending: Math.max(total - approved, 0),
        score: total ? Math.round((approved / total) * 100) : 0,
      };
    });
    return {
      frameworks,
      totalRequirements: requirements.length,
      totalSubmissions: submissions.length,
      inProgress: submissions.filter((s) => s.status === "in_progress").length,
      approved: submissions.filter((s) => s.status === "approved").length,
      submitted: submissions.filter((s) => s.status === "submitted").length,
      nonCompliant: submissions.filter((s) => s.status === "non_compliant").length,
    };
  },

  auditManifest: async (academicYear: string, framework?: string, departmentId?: string) => {
    const requirementQuery: Record<string, unknown> = {
      isActive: true,
      ...(framework ? { framework } : {}),
    };
    const requirements = await ComplianceRequirementModel.find(requirementQuery)
      .select("framework code title category frequency ownerIds reviewerIds")
      .lean();
    const requirementIds = requirements.map((item) => item._id);
    const submissions = await ComplianceSubmissionModel.find({
      academicYear,
      requirementId: { $in: requirementIds },
      ...(departmentId ? { departmentId } : {}),
    })
      .populate("submittedBy reviewedBy", "name email")
      .lean();
    const submissionIds = submissions.map((item) => item._id);
    const findings = await ComplianceFindingModel.find({ submissionId: { $in: submissionIds } })
      .select("findingNumber submissionId title severity dueAt status closureNote")
      .lean();
    const submissionMap = new Map(submissions.map((item) => [String(item.requirementId), item]));
    const findingsBySubmission = new Map<string, typeof findings>();
    for (const finding of findings) {
      const key = String(finding.submissionId);
      findingsBySubmission.set(key, [...(findingsBySubmission.get(key) ?? []), finding]);
    }
    const records = requirements.map((requirement) => {
      const submission = submissionMap.get(String(requirement._id));
      return {
        framework: requirement.framework,
        requirementCode: requirement.code,
        requirementTitle: requirement.title,
        category: requirement.category,
        frequency: requirement.frequency,
        status: submission?.status ?? "not_started",
        period: submission?.period,
        submittedAt: submission?.submittedAt,
        reviewedAt: submission?.reviewedAt,
        evidenceValidUntil: submission?.evidenceValidUntil,
        evidence: submission?.evidenceFiles ?? [],
        values: submission?.values ?? {},
        findings: submission ? (findingsBySubmission.get(String(submission._id)) ?? []) : [],
      };
    });
    return {
      generatedAt: new Date().toISOString(),
      academicYear,
      framework: framework ?? "all",
      summary: {
        requirements: requirements.length,
        submissions: submissions.length,
        approved: submissions.filter((item) => item.status === "approved").length,
        openFindings: findings.filter((item) => item.status !== "closed").length,
      },
      records,
    };
  },

  tallyConfig: () =>
    TallyConfigurationModel.findOne({ isActive: true }).sort({ updatedAt: -1 }).lean(),
  saveTallyConfig: async (data: Partial<ITallyConfiguration>) => {
    if (!data.companyName || !data.financialYear)
      throw createError(400, "Company name and financial year are required");
    return TallyConfigurationModel.findOneAndUpdate({ financialYear: data.financialYear }, data, {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
    }).lean();
  },
  tallyExport: async (financialYear: string, from?: string, to?: string) => {
    const config = await TallyConfigurationModel.findOne({ financialYear, isActive: true }).lean();
    if (!config) throw createError(400, "Configure Tally for this financial year first");
    const q: Record<string, unknown> = { financialYear, status: "posted" };
    if (from && to && new Date(from) > new Date(to))
      throw createError(400, "Export start date must not be after the end date");
    if (from || to) {
      const range: Record<string, Date> = {};
      if (from) range["$gte"] = new Date(from);
      if (to) range["$lte"] = new Date(to);
      q["date"] = range;
    }
    const journals = await JournalEntryModel.find(q).sort({ date: 1 }).lean();
    const mappings = new Map(config.ledgerMappings.map((m) => [m.accountCode, m.tallyLedgerName]));
    const vouchers = journals
      .map(
        (journal) =>
          `<TALLYMESSAGE><VOUCHER VCHTYPE="Journal" ACTION="Create"><DATE>${journal.date
            .toISOString()
            .slice(0, 10)
            .replace(
              /-/g,
              "",
            )}</DATE><VOUCHERNUMBER>${xml(journal.voucherNumber)}</VOUCHERNUMBER><NARRATION>${xml(journal.description)}</NARRATION>${journal.lines
            .map(
              (line) =>
                `<ALLLEDGERENTRIES.LIST><LEDGERNAME>${xml(mappings.get(line.accountCode) ?? line.accountName)}</LEDGERNAME><ISDEEMEDPOSITIVE>${line.debit > 0 ? "Yes" : "No"}</ISDEEMEDPOSITIVE><AMOUNT>${line.debit > 0 ? -line.debit : line.credit}</AMOUNT></ALLLEDGERENTRIES.LIST>`,
            )
            .join("")}</VOUCHER></TALLYMESSAGE>`,
      )
      .join("");
    await TallyConfigurationModel.findByIdAndUpdate(config._id, { lastExportedAt: new Date() });
    return {
      xml: `<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${xml(config.companyName)}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC><REQUESTDATA>${vouchers}</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`,
      count: journals.length,
    };
  },
};

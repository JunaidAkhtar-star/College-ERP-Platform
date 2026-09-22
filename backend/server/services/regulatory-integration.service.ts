import createError from "http-errors";
import { Types } from "mongoose";
import {
  RegulatoryIntegrationModel,
  type TRegulatoryProvider,
  type TRegulatoryStatus,
} from "../models/regulatory-integration.model";

export const REGULATORY_CATALOG: Array<{
  provider: TRegulatoryProvider;
  name: string;
  shortName: string;
  description: string;
  officialUrl: string;
  capabilities: string[];
  checklist: Array<{ key: string; label: string }>;
  cycleBased: boolean;
  requiredEvidence: Array<{ type: string; label: string }>;
}> = [
  {
    provider: "digilocker",
    name: "DigiLocker",
    shortName: "DigiLocker",
    description:
      "Issue and request verified institutional documents after official partner approval.",
    officialUrl: "https://www.digilocker.gov.in/web/partners/issuers",
    capabilities: ["Document issuance", "Consent-based document retrieval", "Verification"],
    cycleBased: false,
    requiredEvidence: [
      { type: "partner_approval", label: "Partner approval" },
      { type: "production_approval", label: "Production-access approval" },
    ],
    checklist: [
      { key: "institution_verified", label: "Institution identity verified" },
      { key: "partner_application", label: "API Setu partner application submitted" },
      { key: "agreement", label: "Required agreement or MoU completed" },
      { key: "production_approval", label: "Production access approved" },
    ],
  },
  {
    provider: "nad",
    name: "National Academic Depository",
    shortName: "NAD",
    description:
      "Prepare and track verified academic award publication and verification readiness.",
    officialUrl: "https://nad.digilocker.gov.in/",
    capabilities: ["Academic awards", "Award verification", "Publication readiness"],
    cycleBased: false,
    requiredEvidence: [{ type: "production_approval", label: "Production-access approval" }],
    checklist: [
      { key: "institution_registered", label: "Academic institution registered" },
      { key: "nodal_officer", label: "Nodal officer authorized" },
      { key: "award_schema", label: "Award data schema validated" },
      { key: "production_approval", label: "Production access approved" },
    ],
  },
  {
    provider: "abc",
    name: "Academic Bank of Credits",
    shortName: "ABC",
    description: "Manage institutional readiness for approved academic-credit exchange workflows.",
    officialUrl: "https://www.abc.gov.in/",
    capabilities: ["Credit readiness", "Student identity mapping", "Submission tracking"],
    cycleBased: false,
    requiredEvidence: [{ type: "production_approval", label: "Production-access approval" }],
    checklist: [
      { key: "institution_registered", label: "Institution registered" },
      { key: "officer_authorized", label: "Authorized officer nominated" },
      { key: "student_mapping", label: "Student identity mapping reviewed" },
      { key: "production_approval", label: "Production access approved" },
    ],
  },
  {
    provider: "aishe",
    name: "All India Survey on Higher Education",
    shortName: "AISHE",
    description:
      "Prepare governed institutional datasets for the applicable AISHE reporting cycle.",
    officialUrl: "https://aishe.gov.in/",
    capabilities: ["Survey readiness", "Data validation", "Submission evidence"],
    cycleBased: true,
    requiredEvidence: [{ type: "registration", label: "Current-cycle registration evidence" }],
    checklist: [
      { key: "aishe_code", label: "AISHE institution code confirmed" },
      { key: "officer_authorized", label: "Nodal officer authorized" },
      { key: "dataset_reviewed", label: "Institutional dataset reviewed" },
      { key: "submission_recorded", label: "Submission acknowledgement recorded" },
    ],
  },
  {
    provider: "nirf",
    name: "National Institutional Ranking Framework",
    shortName: "NIRF",
    description: "Coordinate approved ranking data preparation, review and submission evidence.",
    officialUrl: "https://www.nirfindia.org/",
    capabilities: ["Ranking dataset", "Approval workflow", "Submission evidence"],
    cycleBased: true,
    requiredEvidence: [{ type: "registration", label: "Current-cycle registration evidence" }],
    checklist: [
      { key: "registration", label: "Current-cycle registration confirmed" },
      { key: "data_owner", label: "Institutional data owner nominated" },
      { key: "dataset_reviewed", label: "Ranking dataset reviewed" },
      { key: "submission_recorded", label: "Submission acknowledgement recorded" },
    ],
  },
];

const ALLOWED_TRANSITIONS: Record<TRegulatoryStatus, TRegulatoryStatus[]> = {
  not_started: ["documents_pending"],
  documents_pending: ["not_started", "submitted"],
  submitted: ["documents_pending", "approved"],
  approved: ["documents_pending", "configured"],
  configured: ["suspended"],
  suspended: ["configured"],
};

async function ensureRecords() {
  await Promise.all(
    REGULATORY_CATALOG.map((item) =>
      RegulatoryIntegrationModel.updateOne(
        { provider: item.provider },
        {
          $setOnInsert: {
            provider: item.provider,
            status: "not_started",
            checklist: item.checklist.map((entry) => ({ ...entry, completed: false })),
          },
        },
        { upsert: true },
      ),
    ),
  );
}

export const regulatoryIntegrationService = {
  async overview() {
    await ensureRecords();
    const records = await RegulatoryIntegrationModel.find().lean();
    const byProvider = new Map(records.map((record) => [record.provider, record]));
    const integrations = REGULATORY_CATALOG.map((item) => ({
      ...item,
      record: byProvider.get(item.provider),
    }));
    return {
      integrations,
      summary: {
        total: integrations.length,
        configured: records.filter((item) => item.status === "configured").length,
        inProgress: records.filter((item) =>
          ["documents_pending", "submitted", "approved"].includes(item.status),
        ).length,
        productionEnabled: records.filter((item) => item.productionEnabled).length,
        pendingApproval: records.filter((item) => item.approval?.status === "pending").length,
        expiringEvidence: records.reduce(
          (count, item) =>
            count +
            (item.evidence ?? []).filter((entry) => {
              if (!entry.expiresAt) return false;
              const remaining = new Date(entry.expiresAt).getTime() - Date.now();
              return remaining >= 0 && remaining <= 60 * 24 * 60 * 60 * 1000;
            }).length,
          0,
        ),
      },
    };
  },

  async update(provider: TRegulatoryProvider, input: Record<string, unknown>, userId: string) {
    const catalog = REGULATORY_CATALOG.find((item) => item.provider === provider);
    if (!catalog) throw createError(404, "Regulatory integration is not supported.");
    await ensureRecords();
    const current = await RegulatoryIntegrationModel.findOne({ provider });
    if (!current) throw createError(404, "Regulatory integration was not found.");

    const nextStatus = input.status as TRegulatoryStatus | undefined;
    const consentConfirmed = Boolean(input.consentConfirmed);
    if (nextStatus && nextStatus !== current.status) {
      if (!ALLOWED_TRANSITIONS[current.status].includes(nextStatus)) {
        throw createError(409, `Status cannot move from ${current.status} to ${nextStatus}.`);
      }
      const reason = String(input.reason ?? "").trim();
      if (reason.length < 3) throw createError(400, "A reason is required for status changes.");
      current.history.push({
        action: "STATUS_CHANGED",
        fromStatus: current.status,
        toStatus: nextStatus,
        reason,
        at: new Date(),
        by: new Types.ObjectId(userId),
      });
    }

    current.status = nextStatus ?? current.status;
    current.institutionCode = String(input.institutionCode ?? "").trim() || undefined;
    current.nodalOfficerName = String(input.nodalOfficerName ?? "").trim() || undefined;
    current.nodalOfficerEmail = String(input.nodalOfficerEmail ?? "").trim() || undefined;
    current.applicationReference = String(input.applicationReference ?? "").trim() || undefined;
    current.notes = String(input.notes ?? "").trim() || undefined;
    current.consentConfirmed = consentConfirmed;
    current.configuredBy = userId as never;
    current.lastReviewedAt = new Date();
    if (Array.isArray(input.checklist)) {
      const completed = new Set(input.checklist.map(String));
      const previous = new Map(current.checklist.map((item) => [item.key, item]));
      current.checklist = catalog.checklist.map((item) => ({
        ...item,
        completed: completed.has(item.key),
        ...(completed.has(item.key)
          ? { completedAt: previous.get(item.key)?.completedAt ?? new Date() }
          : {}),
      }));
    }
    if (
      current.productionEnabled &&
      (current.status !== "configured" ||
        !current.consentConfirmed ||
        current.checklist.some((entry) => !entry.completed))
    ) {
      current.productionEnabled = false;
      current.approval.status = "not_requested";
      current.history.push({
        action: "PRODUCTION_AUTHORIZATION_REVOKED",
        reason: "Readiness or authorization controls changed",
        at: new Date(),
        by: new Types.ObjectId(userId),
      });
    }
    await current.save();
    return current;
  },

  async requestApproval(provider: TRegulatoryProvider, userId: string, reason: string) {
    const current = await RegulatoryIntegrationModel.findOne({ provider });
    if (!current) throw createError(404, "Regulatory integration was not found.");
    const catalog = REGULATORY_CATALOG.find((item) => item.provider === provider);
    if (!catalog) throw createError(404, "Regulatory integration is not supported.");
    if (current.status !== "configured")
      throw createError(409, "Complete the governed configuration lifecycle first.");
    if (!current.consentConfirmed)
      throw createError(409, "Institutional authorization must be confirmed first.");
    if (current.checklist.some((entry) => !entry.completed))
      throw createError(409, "Complete every mandatory readiness item first.");
    const evidenceTypes = new Set(current.evidence.map((entry) => entry.type));
    const missing = catalog.requiredEvidence.find((entry) => !evidenceTypes.has(entry.type));
    if (missing) throw createError(409, `Upload ${missing.label} before requesting approval.`);
    current.approval = {
      status: "pending",
      requestedBy: new Types.ObjectId(userId),
      requestedAt: new Date(),
      decisionNote: reason,
    };
    current.productionEnabled = false;
    current.history.push({
      action: "PRODUCTION_APPROVAL_REQUESTED",
      reason,
      at: new Date(),
      by: new Types.ObjectId(userId),
    });
    await current.save();
    return current;
  },

  async decideApproval(
    provider: TRegulatoryProvider,
    userId: string,
    decision: "approved" | "rejected",
    note: string,
  ) {
    const current = await RegulatoryIntegrationModel.findOne({ provider });
    if (!current) throw createError(404, "Regulatory integration was not found.");
    if (current.approval?.status !== "pending")
      throw createError(409, "There is no pending production-authorization request.");
    if (String(current.approval.requestedBy) === userId)
      throw createError(403, "The requester cannot approve their own production authorization.");
    current.approval.status = decision;
    current.approval.decidedBy = new Types.ObjectId(userId);
    current.approval.decidedAt = new Date();
    current.approval.decisionNote = note;
    current.productionEnabled = decision === "approved";
    current.history.push({
      action: decision === "approved" ? "PRODUCTION_AUTHORIZED" : "PRODUCTION_REJECTED",
      reason: note,
      at: new Date(),
      by: new Types.ObjectId(userId),
    });
    await current.save();
    return current;
  },

  async addEvidence(
    provider: TRegulatoryProvider,
    userId: string,
    evidence: {
      type: string;
      name: string;
      url: string;
      publicId?: string;
      issuedAt?: string;
      expiresAt?: string;
    },
  ) {
    const current = await RegulatoryIntegrationModel.findOne({ provider });
    if (!current) throw createError(404, "Regulatory integration was not found.");
    const allowedTypes = new Set([
      ...(REGULATORY_CATALOG.find((item) => item.provider === provider)?.requiredEvidence.map(
        (item) => item.type,
      ) ?? []),
      "application_acknowledgement",
      "agreement",
      "supporting_evidence",
    ]);
    if (!allowedTypes.has(evidence.type)) throw createError(400, "Invalid evidence category.");
    const issuedAt = evidence.issuedAt ? new Date(evidence.issuedAt) : undefined;
    const expiresAt = evidence.expiresAt ? new Date(evidence.expiresAt) : undefined;
    if (issuedAt && Number.isNaN(issuedAt.getTime())) throw createError(400, "Invalid issue date.");
    if (expiresAt && Number.isNaN(expiresAt.getTime()))
      throw createError(400, "Invalid expiry date.");
    if (issuedAt && expiresAt && expiresAt < issuedAt)
      throw createError(400, "Expiry date cannot be before the issue date.");
    current.evidence.push({
      ...evidence,
      issuedAt,
      expiresAt,
      uploadedAt: new Date(),
      uploadedBy: new Types.ObjectId(userId),
    });
    current.history.push({
      action: "EVIDENCE_ADDED",
      reason: evidence.name,
      at: new Date(),
      by: new Types.ObjectId(userId),
    });
    await current.save();
    return current;
  },

  async removeEvidence(provider: TRegulatoryProvider, evidenceId: string, userId: string) {
    const current = await RegulatoryIntegrationModel.findOne({ provider });
    if (!current) throw createError(404, "Regulatory integration was not found.");
    const evidenceIndex = current.evidence.findIndex((item) => String(item._id) === evidenceId);
    if (evidenceIndex < 0) throw createError(404, "Evidence was not found.");
    const [removed] = current.evidence.splice(evidenceIndex, 1);
    const catalog = REGULATORY_CATALOG.find((item) => item.provider === provider);
    const remainingTypes = new Set(current.evidence.map((item) => item.type));
    if (
      current.productionEnabled &&
      catalog?.requiredEvidence.some((item) => !remainingTypes.has(item.type))
    ) {
      current.productionEnabled = false;
      current.approval.status = "not_requested";
      current.history.push({
        action: "PRODUCTION_AUTHORIZATION_REVOKED",
        reason: "Mandatory approval evidence was removed",
        at: new Date(),
        by: new Types.ObjectId(userId),
      });
    }
    current.history.push({
      action: "EVIDENCE_REMOVED",
      reason: removed.name,
      at: new Date(),
      by: new Types.ObjectId(userId),
    });
    await current.save();
    return removed;
  },

  async addCycle(provider: TRegulatoryProvider, input: Record<string, unknown>, userId: string) {
    const catalog = REGULATORY_CATALOG.find((item) => item.provider === provider);
    if (!catalog?.cycleBased)
      throw createError(409, "This provider does not use reporting cycles.");
    const current = await RegulatoryIntegrationModel.findOne({ provider });
    if (!current) throw createError(404, "Regulatory integration was not found.");
    const reportingYear = String(input.reportingYear ?? "").trim();
    if (current.cycles.some((cycle) => cycle.reportingYear === reportingYear))
      throw createError(409, "A cycle already exists for this reporting year.");
    current.cycles.push({
      name: String(input.name ?? "").trim(),
      reportingYear,
      status: "draft",
      dueDate: input.dueDate ? new Date(String(input.dueDate)) : undefined,
      notes: String(input.notes ?? "").trim() || undefined,
    });
    current.history.push({
      action: "REPORTING_CYCLE_CREATED",
      reason: reportingYear,
      at: new Date(),
      by: new Types.ObjectId(userId),
    });
    await current.save();
    return current;
  },

  async updateCycle(
    provider: TRegulatoryProvider,
    cycleId: string,
    input: Record<string, unknown>,
    userId: string,
  ) {
    const current = await RegulatoryIntegrationModel.findOne({ provider });
    if (!current) throw createError(404, "Regulatory integration was not found.");
    const cycle = current.cycles.find((item) => String(item._id) === cycleId);
    if (!cycle) throw createError(404, "Reporting cycle was not found.");
    const nextStatus = String(input.status ?? cycle.status) as typeof cycle.status;
    const transitions: Record<typeof cycle.status, Array<typeof cycle.status>> = {
      draft: ["in_review"],
      in_review: ["draft", "submitted"],
      submitted: ["acknowledged"],
      acknowledged: ["closed"],
      closed: [],
    };
    if (nextStatus !== cycle.status && !transitions[cycle.status].includes(nextStatus))
      throw createError(409, `Cycle cannot move from ${cycle.status} to ${nextStatus}.`);
    if (nextStatus === "acknowledged" && !String(input.acknowledgementReference ?? "").trim())
      throw createError(400, "Acknowledgement reference is required.");
    cycle.status = nextStatus;
    cycle.acknowledgementReference =
      String(input.acknowledgementReference ?? cycle.acknowledgementReference ?? "").trim() ||
      undefined;
    cycle.notes = String(input.notes ?? cycle.notes ?? "").trim() || undefined;
    if (nextStatus === "submitted" && !cycle.submittedAt) cycle.submittedAt = new Date();
    current.history.push({
      action: "REPORTING_CYCLE_UPDATED",
      reason: `${cycle.reportingYear}: ${nextStatus}`,
      at: new Date(),
      by: new Types.ObjectId(userId),
    });
    await current.save();
    return current;
  },

  async deleteCycle(provider: TRegulatoryProvider, cycleId: string, userId: string) {
    const current = await RegulatoryIntegrationModel.findOne({ provider });
    if (!current) throw createError(404, "Regulatory integration was not found.");
    const index = current.cycles.findIndex((item) => String(item._id) === cycleId);
    if (index < 0) throw createError(404, "Reporting cycle was not found.");
    if (current.cycles[index].status !== "draft")
      throw createError(409, "Only draft reporting cycles can be deleted.");
    const [removed] = current.cycles.splice(index, 1);
    current.history.push({
      action: "REPORTING_CYCLE_DELETED",
      reason: removed.reportingYear,
      at: new Date(),
      by: new Types.ObjectId(userId),
    });
    await current.save();
  },
};

import createError from "http-errors";
import {
  AiIncidentModel,
  AiRiskAssessmentModel,
  AiUseCaseModel,
} from "../models/developer-ai-governance.model";
import { nextSeq } from "../models/counter.model";
import { UserModel } from "../models/user.model";
const date = (value: unknown, label: string) => {
  const result = new Date(String(value));
  if (!Number.isFinite(result.getTime())) throw createError(400, `${label} is invalid`);
  return result;
};
export const aiGovernanceService = {
  useCases: () =>
    AiUseCaseModel.find()
      .populate("ownerId approvedBy", "name email")
      .sort({ createdAt: -1 })
      .lean(),
  async useCaseDetail(id: string) {
    const useCase = await AiUseCaseModel.findById(id)
      .populate("ownerId approvedBy createdBy updatedBy", "name email")
      .lean();
    if (!useCase) throw createError(404, "AI use case not found");
    const [assessments, incidents] = await Promise.all([
      AiRiskAssessmentModel.find({ useCaseId: id })
        .populate("assessedBy", "name email")
        .sort({ version: -1 })
        .lean(),
      AiIncidentModel.find({ useCaseId: id })
        .populate("ownerId reportedBy", "name email")
        .sort({ createdAt: -1 })
        .lean(),
    ]);
    const timeline = [
      { type: "registered", at: useCase.createdAt, actor: useCase.createdBy },
      ...assessments.map((item) => ({
        type: "assessment",
        at: item.assessedAt,
        actor: item.assessedBy,
        summary: `Risk assessment v${item.version}: ${item.residualRisk}`,
      })),
      ...(useCase.approvedAt
        ? [
            {
              type: "decision",
              at: useCase.approvedAt,
              actor: useCase.approvedBy,
              summary: useCase.status,
            },
          ]
        : []),
      ...incidents.map((item) => ({
        type: "incident",
        at: item.createdAt,
        actor: item.reportedBy,
        summary: `${item.number}: ${item.summary}`,
      })),
    ].sort(
      (left, right) => new Date(String(right.at)).getTime() - new Date(String(left.at)).getTime(),
    );
    return { useCase, assessments, incidents, timeline };
  },
  async createUseCase(actorId: string, input: Record<string, unknown>) {
    const ownerId = String(input.ownerId),
      owner = await UserModel.exists({ _id: ownerId, status: "active" });
    if (!owner) throw createError(404, "Active AI use-case owner not found");
    if (input.decisionImpact === "high_impact" && input.humanReviewRequired !== true)
      throw createError(400, "High-impact AI use cases require human review");
    const categories = Array.isArray(input.dataCategories)
        ? input.dataCategories.map((item) => String(item))
        : [],
      highRiskData = categories.some((item) => ["health", "biometric"].includes(item)),
      mediumRiskData = categories.some((item) =>
        ["student_records", "financial", "behavioral"].includes(item),
      ),
      riskLevel =
        input.decisionImpact === "high_impact" || highRiskData
          ? "high"
          : input.decisionImpact === "recommendation" || mediumRiskData
            ? "medium"
            : "low";
    return AiUseCaseModel.create({ ...input, ownerId, riskLevel, createdBy: actorId });
  },
  assessments: () =>
    AiRiskAssessmentModel.find()
      .populate("useCaseId", "name riskLevel status")
      .populate("assessedBy", "name")
      .sort({ assessedAt: -1 })
      .lean(),
  async assess(actorId: string, input: Record<string, unknown>) {
    const useCaseId = String(input.useCaseId),
      useCase = await AiUseCaseModel.findById(useCaseId).lean();
    if (!useCase || ["retired", "suspended"].includes(useCase.status))
      throw createError(409, "AI use case is unavailable for assessment");
    const risks = [
        "privacyRisk",
        "biasRisk",
        "securityRisk",
        "explainabilityRisk",
        "impactRisk",
      ].map((k) => Number(input[k])),
      average = risks.reduce((a, b) => a + b, 0) / risks.length,
      residualRisk = average >= 4 ? "high" : average >= 2.5 ? "medium" : "low",
      latest = await AiRiskAssessmentModel.findOne({ useCaseId })
        .sort({ version: -1 })
        .select("version")
        .lean(),
      version = (latest?.version ?? 0) + 1;
    const item = await AiRiskAssessmentModel.create({
      ...input,
      useCaseId,
      version,
      residualRisk,
      assessedBy: actorId,
      assessedAt: new Date(),
      createdBy: actorId,
    });
    await AiUseCaseModel.updateOne(
      { _id: useCaseId },
      { $set: { status: "under_review", riskLevel: residualRisk, updatedBy: actorId } },
    );
    return item;
  },
  async approve(
    id: string,
    actorId: string,
    input: { decision: "approve" | "suspend"; reviewDueAt?: string },
  ) {
    const useCase = await AiUseCaseModel.findById(id);
    if (!useCase) throw createError(404, "AI use case not found");
    if (useCase.status !== "under_review")
      throw createError(409, `AI use case cannot be decided while ${useCase.status}`);
    const assessment = await AiRiskAssessmentModel.findOne({ useCaseId: id })
      .sort({ version: -1 })
      .lean();
    if (!assessment) throw createError(409, "A risk assessment is required before approval");
    if (String(useCase.createdBy) === actorId || String(assessment.assessedBy) === actorId)
      throw createError(409, "Independent approval is required from a different governance user");
    if (input.decision === "approve" && assessment.residualRisk === "high")
      throw createError(409, "High residual risk must be mitigated before approval");
    if (input.decision === "approve" && !input.reviewDueAt)
      throw createError(400, "Approved AI use cases require a review date");
    if (
      input.decision === "approve" &&
      input.reviewDueAt &&
      date(input.reviewDueAt, "Review due date").getTime() <= Date.now()
    )
      throw createError(400, "Review due date must be in the future");
    const openCriticalIncident = await AiIncidentModel.exists({
      useCaseId: id,
      severity: "critical",
      status: { $ne: "resolved" },
    });
    if (input.decision === "approve" && openCriticalIncident)
      throw createError(409, "Open critical incidents must be resolved before approval");
    useCase.status = input.decision === "approve" ? "approved" : "suspended";
    useCase.approvedBy = actorId as never;
    useCase.approvedAt = new Date();
    useCase.reviewDueAt = input.reviewDueAt
      ? date(input.reviewDueAt, "Review due date")
      : undefined;
    useCase.updatedBy = actorId as never;
    await useCase.save();
    return useCase.toObject();
  },
  incidents: () =>
    AiIncidentModel.find()
      .populate("useCaseId", "name provider modelName")
      .populate("ownerId reportedBy", "name email")
      .sort({ createdAt: -1 })
      .lean(),
  async reportIncident(actorId: string, input: Record<string, unknown>) {
    const useCaseId = String(input.useCaseId),
      ownerId = String(input.ownerId),
      [useCase, owner] = await Promise.all([
        AiUseCaseModel.exists({ _id: useCaseId, status: { $ne: "retired" } }),
        UserModel.exists({ _id: ownerId, status: "active" }),
      ]);
    if (!useCase || !owner) throw createError(404, "AI use case or incident owner not found");
    const number = `AI-${new Date().getFullYear()}-${String(await nextSeq(`ai-incident:${new Date().getFullYear()}`)).padStart(6, "0")}`;
    if (input.severity === "critical")
      await AiUseCaseModel.updateOne(
        { _id: useCaseId },
        { $set: { status: "suspended", updatedBy: actorId } },
      );
    return AiIncidentModel.create({
      ...input,
      useCaseId,
      ownerId,
      number,
      reportedBy: actorId,
      createdBy: actorId,
    });
  },
  async transitionIncident(
    id: string,
    actorId: string,
    input: { status: "investigating" | "contained" | "resolved"; resolution?: string },
  ) {
    const item = await AiIncidentModel.findById(id);
    if (!item) throw createError(404, "AI incident not found");
    const allowed: Record<string, string[]> = {
      open: ["investigating", "contained"],
      investigating: ["contained"],
      contained: ["resolved"],
    };
    if (!allowed[item.status]?.includes(input.status))
      throw createError(409, `AI incident cannot move from ${item.status} to ${input.status}`);
    if (input.status === "resolved" && (!input.resolution || input.resolution.trim().length < 10))
      throw createError(400, "Resolution evidence is required");
    item.status = input.status;
    item.resolution = input.resolution;
    if (input.status === "contained") item.containedAt = new Date();
    if (input.status === "resolved") item.resolvedAt = new Date();
    item.updatedBy = actorId as never;
    await item.save();
    return item.toObject();
  },
  async dashboard() {
    const [
      registered,
      approved,
      highRisk,
      openIncidents,
      overdueReviews,
      statusDistribution,
      riskDistribution,
      incidentSeverity,
    ] = await Promise.all([
      AiUseCaseModel.countDocuments(),
      AiUseCaseModel.countDocuments({ status: "approved" }),
      AiUseCaseModel.countDocuments({ riskLevel: "high", status: { $ne: "retired" } }),
      AiIncidentModel.countDocuments({ status: { $ne: "resolved" } }),
      AiUseCaseModel.countDocuments({ status: "approved", reviewDueAt: { $lt: new Date() } }),
      AiUseCaseModel.aggregate<{ _id: string; count: number }>([
        { $match: { isDeleted: false } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      AiUseCaseModel.aggregate<{ _id: string; count: number }>([
        { $match: { isDeleted: false, status: { $ne: "retired" } } },
        { $group: { _id: "$riskLevel", count: { $sum: 1 } } },
      ]),
      AiIncidentModel.aggregate<{ _id: string; count: number }>([
        { $match: { isDeleted: false, status: { $ne: "resolved" } } },
        { $group: { _id: "$severity", count: { $sum: 1 } } },
      ]),
    ]);
    return {
      registered,
      approved,
      highRisk,
      openIncidents,
      overdueReviews,
      statusDistribution: Object.fromEntries(
        statusDistribution.map((item) => [item._id, item.count]),
      ),
      riskDistribution: Object.fromEntries(riskDistribution.map((item) => [item._id, item.count])),
      incidentSeverity: Object.fromEntries(incidentSeverity.map((item) => [item._id, item.count])),
    };
  },
};

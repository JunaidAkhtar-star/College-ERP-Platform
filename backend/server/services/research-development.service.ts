/**
 * @file research-development.service.ts
 * @description R&D office CRUD — projects and publications.
 */
import createError from "http-errors";
import type { IResearchProject, IRndPublication } from "../models/research-development.model";
import { ResearchProjectModel, RndPublicationModel } from "../models/research-development.model";
import { nextSeq } from "../models/counter.model";

const projectTransitions: Record<string, string[]> = {
  proposed: ["ethics_review", "approved", "rejected"],
  ethics_review: ["approved", "rejected"],
  approved: ["ongoing", "rejected"],
  ongoing: ["on_hold", "completed"],
  on_hold: ["ongoing", "rejected"],
  completed: ["closed"],
};

export function validateResearchProject(data: Partial<IResearchProject>) {
  if (data.startDate && data.endDate && new Date(data.endDate) <= new Date(data.startDate))
    throw createError(400, "Project end date must be after its start date");
  if (
    data.sanctionedAmount !== undefined &&
    data.grantAmount !== undefined &&
    data.sanctionedAmount > data.grantAmount
  )
    throw createError(400, "Sanctioned amount cannot exceed the proposed grant");
  if (
    data.expenditureAmount !== undefined &&
    data.sanctionedAmount !== undefined &&
    data.expenditureAmount > data.sanctionedAmount
  )
    throw createError(400, "Expenditure cannot exceed the sanctioned amount");
  if (data.ethicsRequired && data.status === "approved" && data.ethicsStatus !== "approved")
    throw createError(409, "Ethics approval is required before project approval");
  return data;
}

export const researchDevelopmentService = {
  // ── Projects ─────────────────────────────────────────────────────────────
  listProjects: async (filter: Record<string, unknown> = {}, page = 1, limit = 50) => {
    const q: Record<string, unknown> = { isDeleted: { $ne: true } };
    if (filter["status"]) q["status"] = filter["status"];
    if (filter["department"]) q["department"] = filter["department"];
    if (filter["search"]) {
      const re = new RegExp(String(filter["search"]), "i");
      q["$or"] = [{ title: re }, { fundingAgency: re }];
    }
    const [data, total] = await Promise.all([
      ResearchProjectModel.find(q)
        .populate("principalInvestigator", "name email")
        .populate("department", "name code")
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ResearchProjectModel.countDocuments(q),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  getProject: async (id: string) => {
    const doc = await ResearchProjectModel.findById(id)
      .populate("principalInvestigator", "name email")
      .populate("coInvestigators", "name email")
      .populate("department", "name code")
      .lean();
    if (!doc) throw createError(404, "Project not found");
    return doc;
  },

  createProject: async (data: Partial<IResearchProject>) => {
    if (!data.title || !data.principalInvestigator)
      throw createError(400, "title and principalInvestigator are required");
    validateResearchProject(data);
    const year = new Date().getFullYear();
    const sequence = await nextSeq(`research-project-${year}`);
    return ResearchProjectModel.create({
      ...data,
      projectCode: `RND-${year}-${String(sequence).padStart(5, "0")}`,
      ethicsStatus: data.ethicsRequired ? "pending" : "not_required",
      status: data.ethicsRequired ? "ethics_review" : "proposed",
    });
  },

  updateProject: async (id: string, data: Partial<IResearchProject>) => {
    const current = await ResearchProjectModel.findById(id).lean();
    if (!current) throw createError(404, "Project not found");
    validateResearchProject({
      ...current,
      ...data,
      milestones: data.milestones ?? current.milestones,
      utilizationCertificates: data.utilizationCertificates ?? current.utilizationCertificates,
      intellectualProperty: data.intellectualProperty ?? current.intellectualProperty,
    });
    if (
      data.status &&
      data.status !== current.status &&
      !projectTransitions[current.status]?.includes(data.status)
    )
      throw createError(409, `Project cannot move from ${current.status} to ${data.status}`);
    if (data.status === "completed") {
      if ((current.milestones ?? []).some((milestone) => milestone.status !== "completed"))
        throw createError(409, "Every project milestone must be completed first");
      if (current.sanctionedAmount && !(current.utilizationCertificates ?? []).length)
        throw createError(409, "A utilization certificate is required before completion");
    }
    const doc = await ResearchProjectModel.findOneAndUpdate(
      { _id: id, status: current.status },
      { $set: data },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!doc) throw createError(404, "Project not found");
    return doc;
  },

  deleteProject: async (id: string) => {
    const doc = await ResearchProjectModel.findOneAndUpdate(
      { _id: id, status: { $in: ["proposed", "rejected"] } },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { returnDocument: "after" },
    ).lean();
    if (!doc) throw createError(404, "Project not found");
    return { success: true, retainedForAudit: true };
  },

  // ── Publications ─────────────────────────────────────────────────────────
  listPublications: async (filter: Record<string, unknown> = {}, page = 1, limit = 50) => {
    const q: Record<string, unknown> = { isDeleted: { $ne: true } };
    if (filter["kind"]) q["kind"] = filter["kind"];
    if (filter["year"]) q["year"] = Number(filter["year"]);
    if (filter["department"]) q["department"] = filter["department"];
    if (filter["search"]) {
      const re = new RegExp(String(filter["search"]), "i");
      q["$or"] = [{ title: re }, { venue: re }, { authorsText: re }];
    }
    const [data, total] = await Promise.all([
      RndPublicationModel.find(q)
        .populate("authors", "name email")
        .populate("department", "name code")
        .sort({ year: -1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      RndPublicationModel.countDocuments(q),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  createPublication: async (data: Partial<IRndPublication>) => {
    if (!data.title || !data.kind || !data.year)
      throw createError(400, "title, kind and year are required");
    return RndPublicationModel.create(data);
  },

  updatePublication: async (id: string, data: Partial<IRndPublication>) => {
    const current = await RndPublicationModel.findById(id).lean();
    if (!current) throw createError(404, "Publication not found");
    const allowed: Record<string, string[]> = {
      draft: ["submitted"],
      submitted: ["verified", "rejected"],
      rejected: ["draft"],
    };
    if (
      data.verificationStatus &&
      data.verificationStatus !== current.verificationStatus &&
      !allowed[current.verificationStatus]?.includes(data.verificationStatus)
    )
      throw createError(409, "Invalid publication verification transition");
    if (
      ["submitted", "verified"].includes(data.verificationStatus ?? current.verificationStatus) &&
      !(data.evidenceUrl ?? current.evidenceUrl)
    )
      throw createError(400, "Publication evidence is required");
    const doc = await RndPublicationModel.findOneAndUpdate(
      { _id: id, verificationStatus: current.verificationStatus },
      { $set: data },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!doc) throw createError(404, "Publication not found");
    return doc;
  },

  deletePublication: async (id: string) => {
    const doc = await RndPublicationModel.findOneAndUpdate(
      { _id: id, verificationStatus: { $in: ["draft", "rejected"] } },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { returnDocument: "after" },
    ).lean();
    if (!doc) throw createError(404, "Publication not found");
    return { success: true, retainedForAudit: true };
  },

  stats: async () => {
    const [projectsTotal, ongoing, completed, publicationsTotal] = await Promise.all([
      ResearchProjectModel.countDocuments({ isDeleted: { $ne: true } }),
      ResearchProjectModel.countDocuments({ status: "ongoing" }),
      ResearchProjectModel.countDocuments({ status: "completed" }),
      RndPublicationModel.countDocuments({ isDeleted: { $ne: true } }),
    ]);
    return { projectsTotal, ongoing, completed, publicationsTotal };
  },
};

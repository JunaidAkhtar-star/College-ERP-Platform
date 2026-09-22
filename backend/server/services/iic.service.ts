/**
 * @file iic.service.ts
 * @description Institution Innovation Council activity CRUD + MIC reporting.
 */
import createError from "http-errors";
import { Types } from "mongoose";
import type { IIicActivity, TInnovationStatus } from "../models/iic.model";
import { IicActivityModel, InnovationProjectModel } from "../models/iic.model";
import { UserModel } from "../models/user.model";
import type { IUser } from "../models/user.model";
import { SystemRole } from "../constants/roles";

const NEXT_STATUS: Record<TInnovationStatus, TInnovationStatus[]> = {
  submitted: ["screening", "rejected"],
  screening: ["evaluation", "rejected"],
  evaluation: ["approved", "rejected"],
  approved: ["incubating"],
  incubating: ["completed"],
  completed: [],
  rejected: [],
};
type IicActor = Pick<IUser, "_id" | "roles">;

function canManageIic(actor: IicActor) {
  return actor.roles.some((role) =>
    [
      SystemRole.SUPER_ADMIN,
      SystemRole.ADMIN,
      SystemRole.PRINCIPAL,
      SystemRole.IIC,
      SystemRole.RESEARCH_DEVELOPMENT,
    ].includes(role as SystemRole),
  );
}

export const iicService = {
  listProjects: async (status: TInnovationStatus | undefined, actor: IicActor) => {
    const canViewAll = canManageIic(actor);
    const ownership: Record<string, unknown> = canViewAll
      ? {}
      : {
          $or: [{ submitterId: actor._id }, { teamMemberIds: actor._id }, { mentorId: actor._id }],
        };
    return InnovationProjectModel.find({ ...ownership, ...(status ? { status } : {}) })
      .populate("submitterId", "name email")
      .populate("teamMemberIds", "name email")
      .populate("mentorId", "name email")
      .sort({ createdAt: -1 })
      .lean();
  },

  getProject: async (id: string, actor: IicActor) => {
    const project = await InnovationProjectModel.findById(id)
      .populate("submitterId", "name email")
      .populate("teamMemberIds", "name email")
      .populate("mentorId", "name email")
      .lean();
    if (!project) throw createError(404, "Innovation project not found");
    const actorId = String(actor._id);
    const ownsProject =
      String(project.submitterId?._id ?? project.submitterId) === actorId ||
      project.teamMemberIds.some((member) => String(member?._id ?? member) === actorId) ||
      String(project.mentorId?._id ?? project.mentorId) === actorId;
    if (!canManageIic(actor) && !ownsProject) throw createError(403, "Project access denied");
    return project;
  },

  createProject: async (input: Record<string, unknown>, actorId: string) => {
    const teamMemberIds = [
      ...new Set((Array.isArray(input.teamMemberIds) ? input.teamMemberIds : []).map(String)),
    ].filter((id) => id !== actorId);
    if (teamMemberIds.some((id) => !Types.ObjectId.isValid(id)))
      throw createError(400, "Project team contains an invalid user");
    const activeTeam = await UserModel.countDocuments({
      _id: { $in: teamMemberIds },
      status: "active",
    });
    if (activeTeam !== teamMemberIds.length)
      throw createError(409, "Every project team member must be an active user");
    return InnovationProjectModel.create({
      title: String(input.title ?? "").trim(),
      problemStatement: String(input.problemStatement ?? "").trim(),
      proposedSolution: String(input.proposedSolution ?? "").trim(),
      category: String(input.category ?? "").trim(),
      submitterId: actorId,
      teamMemberIds,
      status: "submitted",
      fundingAllocated: 0,
      fundingSpent: 0,
      milestones: [],
      ipRecords: [],
      createdBy: actorId,
    });
  },

  transitionProject: async (
    id: string,
    status: TInnovationStatus,
    note: string,
    score: number | undefined,
    actorId: string,
  ) => {
    const current = await InnovationProjectModel.findById(id).lean();
    if (!current) throw createError(404, "Innovation project not found");
    if (!NEXT_STATUS[current.status].includes(status))
      throw createError(409, `Project cannot move from ${current.status} to ${status}`);
    if (current.status === "evaluation" && status === "approved") {
      if (!Number.isFinite(score) || Number(score) < 0 || Number(score) > 100)
        throw createError(400, "Approval requires an evaluation score from 0 to 100");
    }
    if (status === "completed") {
      if (
        !current.milestones.length ||
        current.milestones.some((item) => item.status !== "completed")
      )
        throw createError(409, "Complete every planned milestone before project closure");
      if (!current.outcome || current.outcome.trim().length < 10)
        throw createError(409, "Record a measurable project outcome before closure");
    }
    if (note.trim().length < 5) throw createError(400, "Add a meaningful evaluation note");
    return InnovationProjectModel.findByIdAndUpdate(
      id,
      {
        $set: {
          status,
          evaluationNote: note.trim(),
          ...(score !== undefined ? { evaluationScore: Number(score) } : {}),
          updatedBy: actorId,
        },
      },
      { returnDocument: "after", runValidators: true },
    ).lean();
  },

  assignMentor: async (id: string, mentorId: string, actorId: string) => {
    const mentor = await UserModel.exists({ _id: mentorId, status: "active" });
    if (!mentor) throw createError(400, "Choose an active mentor");
    const project = await InnovationProjectModel.findOneAndUpdate(
      { _id: id, status: { $in: ["approved", "incubating"] } },
      { $set: { mentorId, updatedBy: actorId } },
      { returnDocument: "after" },
    ).lean();
    if (!project) throw createError(409, "Mentors can be assigned only after approval");
    return project;
  },

  addMilestone: async (id: string, input: { title: string; dueDate: string }, actorId: string) => {
    const project = await InnovationProjectModel.findOneAndUpdate(
      { _id: id, status: "incubating" },
      {
        $push: { milestones: { title: input.title.trim(), dueDate: new Date(input.dueDate) } },
        $set: { updatedBy: actorId },
      },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!project) throw createError(409, "Milestones require an incubating project");
    return project;
  },

  completeMilestone: async (id: string, index: number, evidenceUrl: string, actorId: string) => {
    if (!/^https:\/\//i.test(evidenceUrl))
      throw createError(400, "Milestone completion requires secure evidence");
    const project = await InnovationProjectModel.findOneAndUpdate(
      { _id: id, status: "incubating", [`milestones.${index}.status`]: "planned" },
      {
        $set: {
          [`milestones.${index}.status`]: "completed",
          [`milestones.${index}.completedAt`]: new Date(),
          [`milestones.${index}.evidenceUrl`]: evidenceUrl,
          updatedBy: actorId,
        },
      },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!project) throw createError(409, "Milestone is missing or already completed");
    return project;
  },

  updateFunding: async (id: string, allocated: number, spent: number, actorId: string) => {
    if (allocated < 0 || spent < 0 || spent > allocated)
      throw createError(400, "Funding spent cannot exceed the approved allocation");
    const project = await InnovationProjectModel.findOneAndUpdate(
      { _id: id, status: { $in: ["approved", "incubating"] } },
      { $set: { fundingAllocated: allocated, fundingSpent: spent, updatedBy: actorId } },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!project) throw createError(409, "Funding requires an approved project");
    return project;
  },

  addIpRecord: async (
    id: string,
    input: {
      type: "patent" | "copyright" | "trademark" | "design";
      applicationNumber: string;
      status: "draft" | "filed" | "published" | "granted" | "rejected";
    },
    actorId: string,
  ) => {
    const project = await InnovationProjectModel.findOneAndUpdate(
      { _id: id, status: { $in: ["approved", "incubating", "completed"] } },
      {
        $push: { ipRecords: input },
        $set: { updatedBy: actorId },
      },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!project) throw createError(409, "IP records require an approved project");
    return project;
  },

  recordOutcome: async (
    id: string,
    input: {
      outcome: string;
      prototypeUrl?: string;
      startupName?: string;
      incorporationNumber?: string;
    },
    actorId: string,
  ) => {
    if (input.prototypeUrl && !/^https:\/\//i.test(input.prototypeUrl))
      throw createError(400, "Prototype evidence URL must use HTTPS");
    const project = await InnovationProjectModel.findOneAndUpdate(
      { _id: id, status: { $in: ["incubating", "completed"] } },
      { $set: { ...input, updatedBy: actorId } },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!project) throw createError(409, "Outcomes require an incubating project");
    return project;
  },

  list: async (filter: Record<string, unknown> = {}, page = 1, limit = 50) => {
    const q: Record<string, unknown> = {};
    if (filter["kind"]) q["kind"] = filter["kind"];
    if (filter["quarter"]) q["quarter"] = filter["quarter"];
    if (filter["academicYear"]) q["academicYear"] = filter["academicYear"];
    if (filter["reportedToMic"] !== undefined && filter["reportedToMic"] !== "")
      q["reportedToMic"] = filter["reportedToMic"] === "true";
    if (filter["search"]) {
      const re = new RegExp(String(filter["search"]), "i");
      q["$or"] = [{ title: re }, { description: re }, { venue: re }];
    }
    const [data, total] = await Promise.all([
      IicActivityModel.find(q)
        .populate("facultyCoordinator", "name email")
        .populate("studentCoordinator", "name email")
        .sort({ startDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      IicActivityModel.countDocuments(q),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  get: async (id: string) => {
    const doc = await IicActivityModel.findById(id)
      .populate("facultyCoordinator", "name email")
      .populate("studentCoordinator", "name email")
      .lean();
    if (!doc) throw createError(404, "Activity not found");
    return doc;
  },

  create: async (data: Partial<IIicActivity>) => {
    if (!data.title || !data.kind || !data.quarter || !data.academicYear || !data.startDate)
      throw createError(400, "title, kind, quarter, academicYear, startDate are required");
    const startDate = new Date(data.startDate);
    const endDate = data.endDate ? new Date(data.endDate) : undefined;
    if (Number.isNaN(startDate.getTime()) || (endDate && endDate < startDate))
      throw createError(400, "Activity dates are invalid");
    if (data.proofUrl && !/^https:\/\//i.test(data.proofUrl))
      throw createError(400, "Activity evidence must use a secure URL");
    return IicActivityModel.create({ ...data, startDate, endDate, reportedToMic: false });
  },

  update: async (id: string, data: Partial<IIicActivity>) => {
    const doc = await IicActivityModel.findOneAndUpdate({ _id: id, reportedToMic: false }, data, {
      returnDocument: "after",
      runValidators: true,
    }).lean();
    if (!doc) throw createError(409, "Reported activities are immutable");
    return doc;
  },

  delete: async (id: string) => {
    const doc = await IicActivityModel.findOneAndDelete({ _id: id, reportedToMic: false }).lean();
    if (!doc) throw createError(409, "Reported activities cannot be deleted");
    return { success: true };
  },

  markReported: async (id: string) => {
    const doc = await IicActivityModel.findOneAndUpdate(
      {
        _id: id,
        reportedToMic: false,
        participantCount: { $gte: 1 },
        outcome: { $type: "string", $ne: "" },
        proofUrl: { $regex: /^https:\/\//i },
      },
      { reportedToMic: true },
      { returnDocument: "after" },
    ).lean();
    if (!doc)
      throw createError(
        409,
        "MIC reporting requires participants, a measured outcome and secure evidence",
      );
    return doc;
  },

  stats: async (academicYear?: string) => {
    const q: Record<string, unknown> = {};
    if (academicYear) q["academicYear"] = academicYear;
    const [total, reported, projectSummary, projectStages, categories, activityKinds] =
      await Promise.all([
        IicActivityModel.countDocuments(q),
        IicActivityModel.countDocuments({ ...q, reportedToMic: true }),
        InnovationProjectModel.aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              active: {
                $sum: {
                  $cond: [
                    { $in: ["$status", ["screening", "evaluation", "approved", "incubating"]] },
                    1,
                    0,
                  ],
                },
              },
              incubating: { $sum: { $cond: [{ $eq: ["$status", "incubating"] }, 1, 0] } },
              completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
              ipRecords: { $sum: { $size: { $ifNull: ["$ipRecords", []] } } },
              allocated: { $sum: "$fundingAllocated" },
              spent: { $sum: "$fundingSpent" },
            },
          },
          { $project: { _id: 0 } },
        ]),
        InnovationProjectModel.aggregate([
          { $group: { _id: "$status", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        InnovationProjectModel.aggregate([
          { $group: { _id: "$category", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 6 },
        ]),
        IicActivityModel.aggregate([
          { $match: q },
          {
            $group: {
              _id: "$kind",
              count: { $sum: 1 },
              participants: { $sum: "$participantCount" },
            },
          },
          { $sort: { count: -1 } },
        ]),
      ]);
    const byQuarter = await IicActivityModel.aggregate<{ _id: string; count: number }>([
      { $match: q },
      { $group: { _id: "$quarter", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    return {
      activities: { total, reported, pending: total - reported },
      projects: projectSummary[0] ?? {
        total: 0,
        active: 0,
        incubating: 0,
        completed: 0,
        ipRecords: 0,
        allocated: 0,
        spent: 0,
      },
      projectStages,
      categories,
      byQuarter,
      activityKinds,
    };
  },
};

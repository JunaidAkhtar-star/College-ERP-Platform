import createError from "http-errors";
import { RecruitmentActivityModel, RecruitmentLeadModel } from "../models/recruitment-crm.model";

const normalizePhone = (value: string) => value.replace(/[^\d+]/g, "");
const leadScore = (input: {
  email?: string;
  programInterest?: string;
  consentToContact?: boolean;
  nextFollowUpAt?: string;
}) =>
  Math.min(
    100,
    (input.email ? 20 : 0) +
      (input.programInterest ? 30 : 0) +
      (input.consentToContact ? 25 : 0) +
      (input.nextFollowUpAt ? 25 : 0),
  );

export const recruitmentCrmService = {
  list: async (filter: Record<string, unknown>, page = 1, limit = 30) => {
    const bounded = Math.min(100, Math.max(1, limit));
    const current = Math.max(1, page);
    const [data, total] = await Promise.all([
      RecruitmentLeadModel.find(filter)
        .populate("programInterest", "name code")
        .populate("ownerId", "name email")
        .sort({ nextFollowUpAt: 1, createdAt: -1 })
        .skip((current - 1) * bounded)
        .limit(bounded)
        .lean(),
      RecruitmentLeadModel.countDocuments(filter),
    ]);
    return { data, total, page: current, limit: bounded, pages: Math.ceil(total / bounded) };
  },

  dashboard: async (ownerId?: string) => {
    const base = ownerId ? { ownerId } : {};
    const now = new Date();
    const [stages, overdue, dueToday, unassigned] = await Promise.all([
      RecruitmentLeadModel.aggregate([
        { $match: base },
        { $group: { _id: "$stage", count: { $sum: 1 } } },
      ]),
      RecruitmentActivityModel.countDocuments({ ...base, status: "planned", dueAt: { $lt: now } }),
      RecruitmentActivityModel.countDocuments({
        ...base,
        status: "planned",
        dueAt: {
          $gte: new Date(now.toDateString()),
          $lt: new Date(new Date(now.toDateString()).getTime() + 86_400_000),
        },
      }),
      RecruitmentLeadModel.countDocuments({
        ownerId: { $exists: false },
        stage: { $nin: ["enrolled", "lost"] },
      }),
    ]);
    return {
      stages: Object.fromEntries(stages.map((row) => [row._id, row.count])),
      overdue,
      dueToday,
      unassigned,
    };
  },

  create: async (actorId: string, input: Record<string, unknown>) => {
    const phone = normalizePhone(String(input.phone));
    const duplicate = await RecruitmentLeadModel.findOne({
      $or: [{ phone }, ...(input.email ? [{ email: String(input.email).toLowerCase() }] : [])],
    }).lean();
    if (duplicate) throw createError(409, "A prospect with this phone or email already exists");
    return RecruitmentLeadModel.create({
      ...input,
      phone,
      score: leadScore(input as never),
      createdBy: actorId,
    });
  },

  update: async (id: string, input: Record<string, unknown>, scopedOwnerId?: string) => {
    const selector = { _id: id, ...(scopedOwnerId ? { ownerId: scopedOwnerId } : {}) };
    const current = await RecruitmentLeadModel.findOne(selector).lean();
    if (!current) throw createError(404, "Recruitment prospect not found");
    if (input.stage === "lost" && !String(input.lostReason ?? "").trim())
      throw createError(400, "A lost reason is required");
    const score = leadScore({
      email: String(input.email ?? current.email ?? "") || undefined,
      programInterest: String(input.programInterest ?? current.programInterest ?? "") || undefined,
      consentToContact: Boolean(input.consentToContact ?? current.consentToContact),
      nextFollowUpAt: String(input.nextFollowUpAt ?? current.nextFollowUpAt ?? "") || undefined,
    });
    const safeInput = scopedOwnerId ? { ...input, ownerId: scopedOwnerId } : input;
    return RecruitmentLeadModel.findOneAndUpdate(
      selector,
      { $set: { ...safeInput, score } },
      { returnDocument: "after", runValidators: true },
    ).lean();
  },

  activities: async (leadId: string, scopedOwnerId?: string) => {
    if (scopedOwnerId) {
      const accessible = await RecruitmentLeadModel.exists({ _id: leadId, ownerId: scopedOwnerId });
      if (!accessible) throw createError(404, "Recruitment prospect not found");
    }
    return RecruitmentActivityModel.find({ leadId })
      .populate("ownerId", "name email")
      .sort({ createdAt: -1 })
      .lean();
  },

  addActivity: async (
    leadId: string,
    actorId: string,
    input: Record<string, unknown>,
    scopedOwnerId?: string,
  ) => {
    const lead = await RecruitmentLeadModel.exists({
      _id: leadId,
      ...(scopedOwnerId ? { ownerId: scopedOwnerId } : {}),
    });
    if (!lead) throw createError(404, "Recruitment prospect not found");
    const type = input.type as "call" | "email" | "message" | "meeting" | "note" | "task";
    const status = (input.status ?? "planned") as "planned" | "completed" | "cancelled";
    const activity = await RecruitmentActivityModel.create({
      type,
      subject: String(input.subject),
      details: input.details ? String(input.details) : undefined,
      status,
      dueAt: input.dueAt ? new Date(String(input.dueAt)) : undefined,
      leadId,
      createdBy: actorId,
      ownerId: scopedOwnerId ?? String(input.ownerId ?? actorId),
    });
    const contactTypes = ["call", "email", "message", "meeting"];
    const update: Record<string, unknown> = {};
    if (input.status === "completed" && contactTypes.includes(String(input.type)))
      update.lastContactedAt = new Date();
    if (input.dueAt && input.status !== "completed") update.nextFollowUpAt = input.dueAt;
    if (Object.keys(update).length)
      await RecruitmentLeadModel.updateOne({ _id: leadId }, { $set: update });
    return activity;
  },

  completeActivity: async (id: string, actorId: string) => {
    const item = await RecruitmentActivityModel.findOneAndUpdate(
      { _id: id, $or: [{ ownerId: actorId }, { createdBy: actorId }], status: "planned" },
      { $set: { status: "completed", completedAt: new Date() } },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!item) throw createError(409, "Only the activity owner can complete a planned activity");
    return item;
  },
};

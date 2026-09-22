import createError from "http-errors";
import mongoose from "mongoose";
import { DonationModel } from "../models/alumni.model";
import { AlumniModel } from "../models/alumni.model";
import {
  AdvancementCampaignModel,
  AdvancementFundModel,
  AdvancementGiftDesignationModel,
  AdvancementPledgeModel,
  StewardshipTaskModel,
} from "../models/advancement-continuing-education.model";
import { nextSeq } from "../models/counter.model";
import { UserModel } from "../models/user.model";

const date = (value: unknown, label: string) => {
  const result = new Date(String(value));
  if (!Number.isFinite(result.getTime())) throw createError(400, `${label} is invalid`);
  return result;
};
export const advancementService = {
  funds: () => AdvancementFundModel.find().sort({ code: 1 }).lean(),
  async createFund(actorId: string, input: Record<string, unknown>) {
    const startsAt = input.startsAt ? date(input.startsAt, "Fund start") : undefined,
      endsAt = input.endsAt ? date(input.endsAt, "Fund end") : undefined;
    if (startsAt && endsAt && endsAt <= startsAt)
      throw createError(400, "Fund end must follow its start");
    return AdvancementFundModel.create({
      ...input,
      code: String(input.code).trim().toUpperCase(),
      startsAt,
      endsAt,
      createdBy: actorId,
    });
  },
  campaigns: () =>
    AdvancementCampaignModel.find()
      .populate("fundId", "code name restriction")
      .populate("ownerId", "name email")
      .sort({ startsAt: -1 })
      .lean(),
  async createCampaign(actorId: string, input: Record<string, unknown>) {
    const fundId = String(input.fundId),
      ownerId = String(input.ownerId),
      startsAt = date(input.startsAt, "Campaign start"),
      endsAt = date(input.endsAt, "Campaign end");
    if (endsAt <= startsAt) throw createError(400, "Campaign end must follow its start");
    const [fund, owner] = await Promise.all([
      AdvancementFundModel.exists({ _id: fundId, status: { $ne: "closed" } }),
      UserModel.exists({ _id: ownerId, status: "active" }),
    ]);
    if (!fund || !owner) throw createError(404, "Active fund or campaign owner not found");
    return AdvancementCampaignModel.create({
      ...input,
      code: String(input.code).trim().toUpperCase(),
      fundId,
      ownerId,
      startsAt,
      endsAt,
      createdBy: actorId,
    });
  },
  pledges: () =>
    AdvancementPledgeModel.find()
      .populate("alumniId", "fullName email passoutYear")
      .populate("campaignId", "code name")
      .populate("fundId", "code name")
      .sort({ pledgedAt: -1 })
      .lean(),
  async createPledge(actorId: string, input: Record<string, unknown>) {
    const campaignId = String(input.campaignId),
      fundId = String(input.fundId),
      alumniId = String(input.alumniId);
    const [campaign, alumni] = await Promise.all([
      AdvancementCampaignModel.findOne({
        _id: campaignId,
        status: { $in: ["active", "draft"] },
      }).lean(),
      AlumniModel.exists({ _id: alumniId, isVerified: true }),
    ]);
    if (!campaign || !alumni)
      throw createError(404, "Open campaign or verified alumni donor not found");
    if (String(campaign.fundId) !== fundId)
      throw createError(409, "Pledge fund must match the campaign fund");
    const dueAt = date(input.dueAt, "Pledge due date");
    if (dueAt < new Date()) throw createError(400, "Pledge due date cannot be in the past");
    const pledgeNumber = `PLG-${new Date().getFullYear()}-${String(await nextSeq(`advancement-pledge:${new Date().getFullYear()}`)).padStart(6, "0")}`;
    return AdvancementPledgeModel.create({
      ...input,
      alumniId,
      campaignId,
      fundId,
      pledgeNumber,
      dueAt,
      createdBy: actorId,
    });
  },
  designations: () =>
    AdvancementGiftDesignationModel.find()
      .populate("donationId")
      .populate("fundId", "code name restriction")
      .populate("campaignId", "code name")
      .populate("pledgeId", "pledgeNumber amount fulfilledAmount")
      .sort({ createdAt: -1 })
      .lean(),
  async designateGift(
    actorId: string,
    input: {
      donationId: string;
      fundId: string;
      campaignId?: string;
      pledgeId?: string;
      amount: number;
    },
  ) {
    return mongoose.connection.transaction(async (session) => {
      const donation = await DonationModel.findOne({
        _id: input.donationId,
        status: "confirmed",
      }).session(session);
      if (!donation) throw createError(404, "Confirmed alumni donation not found");
      const [fund, campaign] = await Promise.all([
        AdvancementFundModel.findOne({ _id: input.fundId, status: { $ne: "closed" } }).session(
          session,
        ),
        input.campaignId
          ? AdvancementCampaignModel.findOne({
              _id: input.campaignId,
              fundId: input.fundId,
              status: { $nin: ["cancelled"] },
            }).session(session)
          : true,
      ]);
      if (!fund || !campaign) throw createError(404, "Open fund or matching campaign not found");
      const designated = await AdvancementGiftDesignationModel.aggregate(
        [
          { $match: { donationId: donation._id } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ],
        { session },
      );
      if ((designated[0]?.total ?? 0) + input.amount > donation.amount)
        throw createError(409, "Gift designations cannot exceed the confirmed donation amount");
      let pledge;
      if (input.pledgeId) {
        pledge = await AdvancementPledgeModel.findOne({
          _id: input.pledgeId,
          alumniId: donation.alumniId,
          fundId: input.fundId,
          ...(input.campaignId ? { campaignId: input.campaignId } : {}),
          status: { $in: ["active", "partially_fulfilled"] },
        }).session(session);
        if (!pledge) throw createError(409, "Active matching pledge not found");
        if (pledge.fulfilledAmount + input.amount > pledge.amount)
          throw createError(409, "Gift amount exceeds the remaining pledge balance");
        pledge.fulfilledAmount += input.amount;
        pledge.status =
          pledge.fulfilledAmount === pledge.amount ? "fulfilled" : "partially_fulfilled";
        pledge.updatedBy = actorId as never;
        await pledge.save({ session });
      }
      const [created] = await AdvancementGiftDesignationModel.create(
        [{ ...input, createdBy: actorId }],
        { session },
      );
      return created.toObject();
    });
  },
  tasks: () =>
    StewardshipTaskModel.find()
      .populate("alumniId", "fullName email")
      .populate("campaignId", "code name")
      .populate("assignedTo", "name email")
      .sort({ dueAt: 1 })
      .lean(),
  async createTask(actorId: string, input: Record<string, unknown>) {
    const assignedTo = String(input.assignedTo),
      owner = await UserModel.exists({ _id: assignedTo, status: "active" });
    if (!owner) throw createError(404, "Active stewardship owner not found");
    return StewardshipTaskModel.create({
      ...input,
      assignedTo,
      dueAt: date(input.dueAt, "Task due date"),
      createdBy: actorId,
    });
  },
  async closeTask(id: string, actorId: string, outcome: string) {
    const item = await StewardshipTaskModel.findOneAndUpdate(
      { _id: id, status: "open" },
      { $set: { status: "completed", outcome, completedAt: new Date(), updatedBy: actorId } },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!item) throw createError(409, "Only an open stewardship task can be completed");
    return item;
  },
  async dashboard() {
    const [
      funds,
      campaigns,
      pledged,
      confirmed,
      openTasks,
      overdueTasks,
      campaignRows,
      campaignPledges,
      campaignGifts,
      pledgePipeline,
      giftTrend,
      taskPipeline,
    ] = await Promise.all([
      AdvancementFundModel.countDocuments({ status: "active" }),
      AdvancementCampaignModel.countDocuments({ status: "active" }),
      AdvancementPledgeModel.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        { $group: { _id: null, value: { $sum: "$amount" } } },
      ]),
      AdvancementGiftDesignationModel.aggregate([
        { $group: { _id: null, value: { $sum: "$amount" } } },
      ]),
      StewardshipTaskModel.countDocuments({ status: "open" }),
      StewardshipTaskModel.countDocuments({ status: "open", dueAt: { $lt: new Date() } }),
      AdvancementCampaignModel.find({ status: { $nin: ["cancelled"] } })
        .select("name code goalAmount status startsAt endsAt")
        .sort({ startsAt: -1 })
        .limit(8)
        .lean(),
      AdvancementPledgeModel.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        { $group: { _id: "$campaignId", amount: { $sum: "$amount" } } },
      ]),
      AdvancementGiftDesignationModel.aggregate([
        { $match: { campaignId: { $exists: true } } },
        { $group: { _id: "$campaignId", amount: { $sum: "$amount" } } },
      ]),
      AdvancementPledgeModel.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" } } },
        { $sort: { count: -1 } },
      ]),
      AdvancementGiftDesignationModel.aggregate([
        {
          $group: {
            _id: { $dateToString: { date: "$createdAt", format: "%Y-%m" } },
            amount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: 12 },
        { $sort: { _id: 1 } },
      ]),
      StewardshipTaskModel.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);
    const pledgeByCampaign = new Map(campaignPledges.map((row) => [String(row._id), row.amount]));
    const giftByCampaign = new Map(campaignGifts.map((row) => [String(row._id), row.amount]));
    return {
      activeFunds: funds,
      activeCampaigns: campaigns,
      pledged: pledged[0]?.value ?? 0,
      designated: confirmed[0]?.value ?? 0,
      openTasks,
      overdueTasks,
      campaignPerformance: campaignRows.map((campaign) => ({
        id: String(campaign._id),
        name: campaign.name,
        code: campaign.code,
        goal: campaign.goalAmount,
        pledged: pledgeByCampaign.get(String(campaign._id)) ?? 0,
        designated: giftByCampaign.get(String(campaign._id)) ?? 0,
        status: campaign.status,
      })),
      pledgePipeline,
      giftTrend,
      taskPipeline,
    };
  },
};

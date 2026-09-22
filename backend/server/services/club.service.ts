/**
 * @file club.service.ts
 * @description Student club CRUD + member roster + activity log.
 */
import createError from "http-errors";
import { Types } from "mongoose";
import {
  ClubMembershipRequestModel,
  ClubModel,
  type IClub,
  type IClubActivity,
  type IClubMember,
} from "../models/club.model";
import { UserModel } from "../models/user.model";
import { SystemRole } from "../constants/roles";

export const clubService = {
  list: async (filter: Record<string, unknown> = {}, page = 1, limit = 50) => {
    const q: Record<string, unknown> = {};
    if (filter["category"]) q["category"] = filter["category"];
    if (filter["isActive"] !== undefined && filter["isActive"] !== "")
      q["isActive"] = filter["isActive"] === "true";
    if (filter["search"]) {
      const re = new RegExp(String(filter["search"]), "i");
      q["$or"] = [{ name: re }, { description: re }];
    }
    const [data, total] = await Promise.all([
      ClubModel.find(q)
        .populate("facultyAdvisor", "name email")
        .populate("studentHead", "name email")
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ClubModel.countDocuments(q),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  get: async (id: string) => {
    const doc = await ClubModel.findById(id)
      .populate("facultyAdvisor", "name email")
      .populate("studentHead", "name email")
      .populate("members.userId", "name email")
      .lean();
    if (!doc) throw createError(404, "Club not found");
    return doc;
  },

  create: async (data: Partial<IClub>, actorId: string) => {
    if (!data.name) throw createError(400, "Club name is required");
    const exists = await ClubModel.findOne({ name: data.name });
    if (exists) throw createError(409, "Club with this name already exists");
    if (data.facultyAdvisor) {
      const advisor = await UserModel.exists({
        _id: data.facultyAdvisor,
        roles: SystemRole.FACULTY,
        status: "active",
      });
      if (!advisor) throw createError(400, "Faculty advisor must be an active faculty user");
    }
    if (data.studentHead) {
      const studentHead = await UserModel.exists({
        _id: data.studentHead,
        roles: SystemRole.STUDENT,
        status: "active",
      });
      if (!studentHead) throw createError(400, "Student head must be an active student user");
    }
    return ClubModel.create({
      name: data.name.trim(),
      category: data.category,
      description: data.description,
      facultyAdvisor: data.facultyAdvisor,
      studentHead: data.studentHead,
      establishedYear: data.establishedYear,
      logoUrl: data.logoUrl,
      isActive: true,
      members: [],
      activities: [],
      createdBy: new Types.ObjectId(actorId),
    });
  },

  update: async (id: string, data: Partial<IClub>, actorId: string) => {
    if (data.facultyAdvisor) {
      const advisor = await UserModel.exists({
        _id: data.facultyAdvisor,
        roles: SystemRole.FACULTY,
        status: "active",
      });
      if (!advisor) throw createError(400, "Faculty advisor must be an active faculty user");
    }
    if (data.studentHead) {
      const studentHead = await UserModel.exists({
        _id: data.studentHead,
        roles: SystemRole.STUDENT,
        status: "active",
      });
      if (!studentHead) throw createError(400, "Student head must be an active student user");
    }
    const allowed = {
      name: data.name,
      category: data.category,
      description: data.description,
      facultyAdvisor: data.facultyAdvisor,
      studentHead: data.studentHead,
      establishedYear: data.establishedYear,
      logoUrl: data.logoUrl,
      isActive: data.isActive,
      updatedBy: actorId,
    };
    const doc = await ClubModel.findByIdAndUpdate(
      id,
      {
        $set: Object.fromEntries(
          Object.entries(allowed).filter(([, value]) => value !== undefined),
        ),
      },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!doc) throw createError(404, "Club not found");
    return doc;
  },

  delete: async (id: string, actorId: string) => {
    const doc = await ClubModel.findByIdAndUpdate(
      id,
      { $set: { isActive: false, updatedBy: actorId } },
      { returnDocument: "after" },
    ).lean();
    if (!doc) throw createError(404, "Club not found");
    return { success: true };
  },

  // ── Members ──────────────────────────────────────────────────────────────
  addMember: async (clubId: string, member: Partial<IClubMember>) => {
    if (!member.userId) throw createError(400, "userId is required");
    const userObjId = new Types.ObjectId(String(member.userId));
    const user = await UserModel.exists({ _id: userObjId, status: "active" });
    if (!user) throw createError(400, "Only an active user can join a club");
    const role = String(member.role ?? "Member").trim();
    if (!role || role.length > 80) throw createError(400, "Club member role is invalid");
    const club = await ClubModel.findOneAndUpdate(
      { _id: clubId, isActive: true, "members.userId": { $ne: userObjId } },
      { $push: { members: { userId: userObjId, role, joinedAt: new Date() } } },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!club) throw createError(409, "Club is inactive or user is already a member");
    return club;
  },

  removeMember: async (clubId: string, userId: string) => {
    const club = await ClubModel.findOneAndUpdate(
      { _id: clubId, "members.userId": userId },
      { $pull: { members: { userId } } },
      { returnDocument: "after" },
    ).lean();
    if (!club) throw createError(404, "Club membership not found");
    return club;
  },

  // ── Activities ───────────────────────────────────────────────────────────
  addActivity: async (clubId: string, activity: Partial<IClubActivity>) => {
    if (!activity.title || !activity.date) throw createError(400, "title and date are required");
    const date = new Date(activity.date);
    if (Number.isNaN(date.getTime())) throw createError(400, "Activity date is invalid");
    if (activity.proofUrl && !/^https:\/\//i.test(activity.proofUrl))
      throw createError(400, "Activity proof URL must use HTTPS");
    const club = await ClubModel.findOne({ _id: clubId, isActive: true });
    if (!club) throw createError(409, "Activities require an active club");
    club.activities.push({
      title: activity.title,
      description: activity.description,
      date,
      participantCount: activity.participantCount,
      proofUrl: activity.proofUrl,
      venue: activity.venue,
      outcome: activity.outcome,
      budget: activity.budget,
    });
    await club.save();
    return club.toObject();
  },

  requestMembership: async (clubId: string, userId: string, message?: string) => {
    const [club, user] = await Promise.all([
      ClubModel.findOne({ _id: clubId, isActive: true }).lean(),
      UserModel.exists({ _id: userId, status: "active" }),
    ]);
    if (!club || !user) throw createError(404, "Active club or user not found");
    if (club.members.some((member) => String(member.userId) === userId))
      throw createError(409, "You are already a member of this club");
    try {
      return await ClubMembershipRequestModel.create({
        clubId,
        userId,
        message: String(message ?? "").trim() || undefined,
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw createError(409, "A membership request is already pending");
      throw error;
    }
  },

  membershipRequests: async (userId: string, canApprove: boolean) =>
    ClubMembershipRequestModel.find(canApprove ? {} : { userId })
      .populate("clubId", "name category isActive")
      .populate("userId", "name email")
      .populate("decidedBy", "name email")
      .sort({ requestedAt: -1 })
      .lean(),

  decideMembership: async (
    requestId: string,
    decision: "approved" | "rejected",
    note: string,
    actorId: string,
  ) => {
    const request = await ClubMembershipRequestModel.findOne({
      _id: requestId,
      status: "pending",
    });
    if (!request) throw createError(409, "Only a pending membership request can be decided");
    if (decision === "approved") {
      const club = await ClubModel.findOneAndUpdate(
        { _id: request.clubId, isActive: true, "members.userId": { $ne: request.userId } },
        { $push: { members: { userId: request.userId, role: "Member", joinedAt: new Date() } } },
        { returnDocument: "after", runValidators: true },
      );
      if (!club) throw createError(409, "Club is inactive or the applicant is already a member");
    }
    request.status = decision;
    request.decisionNote = note.trim();
    request.decidedAt = new Date();
    request.decidedBy = new Types.ObjectId(actorId);
    await request.save();
    return request.toObject();
  },

  stats: async () => {
    const [total, active, pendingRequests, totals, activityTrend] = await Promise.all([
      ClubModel.countDocuments(),
      ClubModel.countDocuments({ isActive: true }),
      ClubMembershipRequestModel.countDocuments({ status: "pending" }),
      ClubModel.aggregate([
        {
          $group: {
            _id: null,
            members: { $sum: { $size: "$members" } },
            activities: { $sum: { $size: "$activities" } },
            participants: {
              $sum: {
                $sum: {
                  $map: {
                    input: "$activities",
                    as: "activity",
                    in: { $ifNull: ["$$activity.participantCount", 0] },
                  },
                },
              },
            },
            budget: {
              $sum: {
                $sum: {
                  $map: {
                    input: "$activities",
                    as: "activity",
                    in: { $ifNull: ["$$activity.budget", 0] },
                  },
                },
              },
            },
          },
        },
      ]),
      ClubModel.aggregate([
        { $unwind: "$activities" },
        {
          $group: {
            _id: { $dateToString: { date: "$activities.date", format: "%Y-%m" } },
            count: { $sum: 1 },
            participants: { $sum: { $ifNull: ["$activities.participantCount", 0] } },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: 12 },
        { $sort: { _id: 1 } },
      ]),
    ]);
    const byCategory = await ClubModel.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);
    return {
      total,
      active,
      pendingRequests,
      members: totals[0]?.members ?? 0,
      activities: totals[0]?.activities ?? 0,
      participants: totals[0]?.participants ?? 0,
      activityBudget: totals[0]?.budget ?? 0,
      byCategory,
      activityTrend,
    };
  },
};

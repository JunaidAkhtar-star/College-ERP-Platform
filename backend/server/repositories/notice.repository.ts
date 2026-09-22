import type { MongoFilter } from "../types/mongoose.types";
import { NoticeModel, NoticeReadModel, type INotice } from "../models/notice.model";
import { Types } from "mongoose";

export const noticeRepository = {
  findById: (id: string) => NoticeModel.findById(id).lean(),

  create: (data: Record<string, unknown>) => NoticeModel.create(data),

  updateById: (id: string, data: Record<string, unknown>) =>
    NoticeModel.findByIdAndUpdate(id, { $set: data }).lean(),

  deleteById: (id: string, deletedBy: string) =>
    NoticeModel.findOneAndUpdate(
      { _id: id, isPublished: false },
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy } },
      { returnDocument: "after" },
    ).lean(),

  list: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      NoticeModel.find(filter)
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      NoticeModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  // FIX: markRead now creates a NoticeRead doc instead of pushing to readBy[]
  markRead: async (noticeId: string, userId: string) => {
    // Upsert — safe to call multiple times (unique index prevents duplicates)
    await NoticeReadModel.updateOne(
      { noticeId: new Types.ObjectId(noticeId), userId: new Types.ObjectId(userId) },
      {
        $setOnInsert: {
          noticeId: new Types.ObjectId(noticeId),
          userId: new Types.ObjectId(userId),
          readAt: new Date(),
        },
      },
      { upsert: true },
    );
    // Keep readCount accurate (only increment on first read)
    // Using $inc on the first upsert would double-count; use countDocuments instead.
    const count = await NoticeReadModel.countDocuments({ noticeId: new Types.ObjectId(noticeId) });
    return NoticeModel.findByIdAndUpdate(
      noticeId,
      { $set: { readCount: count } },
      { returnDocument: "after" },
    ).lean();
  },

  publish: (id: string, publishedBy: string) =>
    NoticeModel.findOneAndUpdate(
      { _id: id, isPublished: false, createdBy: { $ne: publishedBy } },
      { $set: { isPublished: true, publishedAt: new Date(), publishedBy } },
      { returnDocument: "after" },
    ).lean(),

  getActiveForUser: async (
    roles: string[],
    departmentIds: string[],
    programs: string[],
    page = 1,
    limit = 20,
    userId?: string,
  ) => {
    const skip = (page - 1) * limit;
    const now = new Date();
    const filter = {
      isPublished: true,
      $and: [
        { $or: [{ expiryDate: null }, { expiryDate: { $gt: now } }] },
        {
          $or: [
            { noticeType: "global" },
            { noticeType: "role_based", targetRoles: { $in: roles } },
            { noticeType: "department", targetDepartments: { $in: departmentIds } },
            { noticeType: "program", targetPrograms: { $in: programs } },
          ],
        },
      ],
    };
    const [data, total] = await Promise.all([
      NoticeModel.find(filter as MongoFilter<INotice>)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      NoticeModel.countDocuments(filter as MongoFilter<INotice>),
    ]);

    // Inject isRead per notice for this user (one batch query)
    if (userId && data.length > 0) {
      const noticeIds = data.map((n) => n._id);
      const readSet = await NoticeReadModel.distinct("noticeId", {
        noticeId: { $in: noticeIds },
        userId: new Types.ObjectId(userId),
      });
      const readIds = new Set(readSet.map(String));
      const dataWithRead = data.map((n) => ({ ...n, isRead: readIds.has(String(n._id)) }));
      return { data: dataWithRead, total, page, limit, pages: Math.ceil(total / limit) };
    }

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  stats: async () => {
    const now = new Date();
    const [summary, byPriority, byType, publishingTrend] = await Promise.all([
      NoticeModel.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            published: { $sum: { $cond: ["$isPublished", 1, 0] } },
            drafts: { $sum: { $cond: ["$isPublished", 0, 1] } },
            urgent: { $sum: { $cond: [{ $eq: ["$priority", "urgent"] }, 1, 0] } },
            reads: { $sum: "$readCount" },
            active: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      "$isPublished",
                      { $or: [{ $eq: ["$expiryDate", null] }, { $gt: ["$expiryDate", now] }] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $project: { _id: 0 } },
      ]),
      NoticeModel.aggregate([
        { $group: { _id: "$priority", count: { $sum: 1 }, reads: { $sum: "$readCount" } } },
        { $sort: { count: -1 } },
      ]),
      NoticeModel.aggregate([
        { $group: { _id: "$noticeType", count: { $sum: 1 }, reads: { $sum: "$readCount" } } },
        { $sort: { count: -1 } },
      ]),
      NoticeModel.aggregate([
        { $match: { isPublished: true, publishedAt: { $type: "date" } } },
        {
          $group: {
            _id: { $dateToString: { date: "$publishedAt", format: "%Y-%m" } },
            published: { $sum: 1 },
            reads: { $sum: "$readCount" },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: 12 },
        { $sort: { _id: 1 } },
      ]),
    ]);
    return {
      summary: summary[0] ?? {
        total: 0,
        published: 0,
        drafts: 0,
        urgent: 0,
        reads: 0,
        active: 0,
      },
      byPriority,
      byType,
      publishingTrend,
    };
  },
};

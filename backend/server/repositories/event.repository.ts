import { EventModel } from "../models";

export const eventRepository = {
  findById: (id: string) =>
    EventModel.findById(id)
      .populate("createdBy", "name email")
      .populate("organizingDepartment", "name code")
      .populate("coordinators", "name email")
      .populate("registrations.userId", "name email")
      .lean(),

  create: (data: Record<string, unknown>) => EventModel.create(data),

  updateById: (id: string, data: Record<string, unknown>) =>
    EventModel.findOneAndUpdate(
      { _id: id, isPublished: false },
      { $set: data },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  list: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      EventModel.find(filter)
        .select("-registrations")
        .populate("createdBy", "name email")
        .populate("organizingDepartment", "name code")
        .populate("coordinators", "name email")
        .sort({ startDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EventModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  register: (eventId: string, userId: string) =>
    EventModel.findOneAndUpdate(
      {
        _id: eventId,
        isPublished: true,
        isCancelled: { $ne: true },
        startDate: { $gt: new Date() },
        "registrations.userId": { $ne: userId },
        $expr: {
          $or: [
            { $eq: [{ $ifNull: ["$maxRegistrations", 0] }, 0] },
            { $lt: [{ $ifNull: ["$registrationCount", 0] }, "$maxRegistrations"] },
          ],
        },
      },
      {
        $push: { registrations: { userId, registeredAt: new Date(), attended: false } },
        $inc: { registrationCount: 1 },
      },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  markAttendance: (eventId: string, userId: string) =>
    EventModel.updateOne(
      { _id: eventId, "registrations.userId": userId },
      { $set: { "registrations.$.attended": true } },
    ),

  cancel: (id: string, reason: string, cancelledBy: string) =>
    EventModel.findOneAndUpdate(
      { _id: id, isCancelled: { $ne: true }, endDate: { $gt: new Date() } },
      {
        $set: {
          isCancelled: true,
          cancellationReason: reason,
          cancelledAt: new Date(),
          cancelledBy,
        },
      },
      { returnDocument: "after", runValidators: true },
    ).lean(),

  stats: async (filter: Record<string, unknown>) => {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const [summary, byType, trend] = await Promise.all([
      EventModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            drafts: { $sum: { $cond: [{ $eq: ["$isPublished", false] }, 1, 0] } },
            upcoming: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$isPublished", true] },
                      { $ne: ["$isCancelled", true] },
                      { $gt: ["$startDate", now] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            ongoing: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$isPublished", true] },
                      { $ne: ["$isCancelled", true] },
                      { $lte: ["$startDate", now] },
                      { $gte: ["$endDate", now] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            completed: {
              $sum: {
                $cond: [
                  { $and: [{ $ne: ["$isCancelled", true] }, { $lt: ["$endDate", now] }] },
                  1,
                  0,
                ],
              },
            },
            cancelled: { $sum: { $cond: [{ $eq: ["$isCancelled", true] }, 1, 0] } },
            registrations: { $sum: { $ifNull: ["$registrationCount", 0] } },
            attended: {
              $sum: {
                $size: {
                  $filter: {
                    input: { $ifNull: ["$registrations", []] },
                    as: "registration",
                    cond: "$$registration.attended",
                  },
                },
              },
            },
            capacity: { $sum: { $ifNull: ["$maxRegistrations", 0] } },
          },
        },
      ]),
      EventModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$eventType",
            events: { $sum: 1 },
            registrations: { $sum: { $ifNull: ["$registrationCount", 0] } },
          },
        },
        { $sort: { events: -1 } },
      ]),
      EventModel.aggregate([
        { $match: { ...filter, startDate: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$startDate" } },
            events: { $sum: 1 },
            registrations: { $sum: { $ifNull: ["$registrationCount", 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);
    return {
      summary: summary[0] ?? {
        total: 0,
        drafts: 0,
        upcoming: 0,
        ongoing: 0,
        completed: 0,
        cancelled: 0,
        registrations: 0,
        attended: 0,
        capacity: 0,
      },
      byType,
      trend,
    };
  },

  publish: (id: string, publishedBy: string) =>
    EventModel.findOneAndUpdate(
      {
        _id: id,
        isPublished: false,
        isCancelled: { $ne: true },
        createdBy: { $ne: publishedBy },
        startDate: { $gt: new Date() },
      },
      { $set: { isPublished: true, updatedBy: publishedBy } },
      { returnDocument: "after" },
    ).lean(),
};

import { NotificationModel, NotificationAudience, NotificationType } from "../models";

export const notificationRepository = {
  findById: (id: string) => NotificationModel.findById(id).lean(),

  create: (data: Record<string, unknown>) => NotificationModel.create(data),

  updateById: (id: string, data: Record<string, unknown>) =>
    NotificationModel.findByIdAndUpdate(id, { $set: data }, { returnDocument: "after" }).lean(),

  markRead: (id: string, userId: string) =>
    NotificationModel.findOneAndUpdate(
      { _id: id, "readBy.userId": { $ne: userId } },
      { $addToSet: { readBy: { userId, readAt: new Date() } }, $inc: { totalRead: 1 } },
      { returnDocument: "after" },
    ).lean(),

  /** Mark all chat-related notifications as read for a given user. */
  markAllChatRead: (userId: string) =>
    NotificationModel.updateMany(
      {
        isActive: true,
        targetUserIds: userId,
        actionUrl: { $regex: "/chat", $options: "i" },
        "readBy.userId": { $ne: userId },
      },
      { $addToSet: { readBy: { userId, readAt: new Date() } } },
    ),

  /** Fetch unread notifications for a user (used on socket connect to flush
   *  the offline "queue" — messages and pushes that piled up while away). */
  getUnreadForUser: (userId: string, limit = 20) =>
    NotificationModel.find({
      isActive: true,
      targetUserIds: userId,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      "readBy.userId": { $ne: userId },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),

  deactivateAdmissionPipelineForUser: (userId: string) =>
    NotificationModel.updateMany(
      {
        isActive: true,
        type: NotificationType.ADMISSION,
        targetUserIds: userId,
        actionUrl: {
          $in: ["/admission-portal", "/student/admission-portal", "/dashboard"],
        },
      },
      { $set: { isActive: false } },
    ),

  getForUser: async (
    userId: string,
    roles: string[],
    departmentCode?: string,
    page = 1,
    limit = 20,
  ) => {
    const skip = (page - 1) * limit;
    const now = new Date();
    const audienceFilter = [
      { audience: NotificationAudience.ALL },
      { targetUserIds: userId },
      ...(roles.includes("student") ? [{ audience: NotificationAudience.STUDENTS }] : []),
      ...(roles.includes("faculty") ? [{ audience: NotificationAudience.FACULTY }] : []),
      ...(roles.includes("parent") ? [{ audience: NotificationAudience.PARENTS }] : []),
      ...(roles.some((role) => ["super_admin", "principal", "hod"].includes(role))
        ? [{ audience: NotificationAudience.ADMIN }]
        : []),
      ...(departmentCode ? [{ targetDepartments: departmentCode }] : []),
    ];
    const filter = {
      isActive: true,
      $and: [{ $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }, { $or: audienceFilter }],
    };
    const [data, total] = await Promise.all([
      NotificationModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      NotificationModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  listAll: async (filter: Record<string, unknown>, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      NotificationModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      NotificationModel.countDocuments(filter),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  },

  getPendingScheduled: () =>
    NotificationModel.find({
      isScheduled: true,
      isSent: false,
      scheduledAt: { $lte: new Date() },
    }).lean(),

  deactivateExpired: () =>
    NotificationModel.updateMany(
      { expiresAt: { $lt: new Date() }, isActive: true },
      { $set: { isActive: false } },
    ),
};

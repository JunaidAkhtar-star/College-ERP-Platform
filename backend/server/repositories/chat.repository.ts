import { ConversationModel, ChatMessageModel } from "../models";
import { Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";

// ─────────────────────────────────────────────────────────────────────────────
// Chat Repository — updated to use separate ChatMessage collection.
// Messages are NO LONGER embedded in Conversation documents.
// ─────────────────────────────────────────────────────────────────────────────

export const chatRepository = {
  findById: (id: string) => ConversationModel.findById(id).lean(),

  findByIdPopulated: (id: string) =>
    ConversationModel.findById(id)
      .populate("participants", "name email avatar roles lastSeenAt")
      .lean(),

  create: (data: Record<string, unknown>) => ConversationModel.create(data),

  findDirectConversation: (userId1: string, userId2: string) =>
    ConversationModel.findOne({
      type: "direct",
      participants: { $all: [userId1, userId2], $size: 2 },
    }).lean(),

  getUserConversations: async (userId: string, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const conversations = await ConversationModel.find({
      participants: userId,
      isActive: true,
    })
      .populate("participants", "name email avatar roles lastSeenAt")
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    if (conversations.length === 0) return [];

    const conversationIds = conversations.map((conversation) => conversation._id);
    const unreadRows = await ChatMessageModel.aggregate<{
      _id: Types.ObjectId;
      unreadCount: number;
    }>([
      {
        $match: {
          conversationId: { $in: conversationIds },
          senderId: { $ne: new Types.ObjectId(userId) },
          readBy: { $ne: new Types.ObjectId(userId) },
          deletedFor: { $ne: new Types.ObjectId(userId) },
          isDeleted: false,
        },
      },
      { $group: { _id: "$conversationId", unreadCount: { $sum: 1 } } },
    ]);
    const unreadByConversation = new Map(
      unreadRows.map((row) => [String(row._id), row.unreadCount]),
    );

    return conversations.map((conversation) => ({
      ...conversation,
      unreadCount: unreadByConversation.get(String(conversation._id)) ?? 0,
    }));
  },

  // ── Messages (own collection) ──────────────────────────────────────────────

  addMessage: async (
    conversationId: string,
    message: {
      senderId: string;
      content: string;
      messageType?: string;
      fileUrl?: string;
      fileName?: string;
      replyTo?: string;
    },
  ) => {
    // 1. Insert message into chatmessages collection
    const created = await ChatMessageModel.create({
      conversationId: new Types.ObjectId(conversationId),
      senderId: new Types.ObjectId(message.senderId),
      content: message.content,
      messageType: (message.messageType ?? "text") as
        | "text"
        | "file"
        | "image"
        | "audio"
        | "video"
        | "call_log",
      fileUrl: message.fileUrl,
      fileName: message.fileName,
      replyTo: message.replyTo ? new Types.ObjectId(message.replyTo) : undefined,
      isDeleted: false,
      deletedFor: [],
      reactions: [],
      readBy: [new Types.ObjectId(message.senderId)],
    });

    // 2. Update conversation's last-message snapshot (cheap metadata)
    await ConversationModel.findByIdAndUpdate(conversationId, {
      $set: {
        lastMessage: message.content,
        lastMessageAt: created.createdAt,
        lastMessageBy: new Types.ObjectId(message.senderId),
      },
      $inc: { totalMessages: 1 },
    });

    const populated = await ChatMessageModel.findById(created._id)
      .populate("senderId", "name email avatar roles")
      .lean();
    return populated;
  },

  getMessages: async (conversationId: string, userId: string, page = 1, limit = 50) => {
    const skip = (page - 1) * limit;
    const [messages, total] = await Promise.all([
      ChatMessageModel.find({
        conversationId: new Types.ObjectId(conversationId),
        deletedFor: { $ne: new Types.ObjectId(userId) },
      })
        .populate("senderId", "name email avatar roles")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ChatMessageModel.countDocuments({
        conversationId: new Types.ObjectId(conversationId),
        deletedFor: { $ne: new Types.ObjectId(userId) },
      }),
    ]);
    return {
      messages: messages.reverse(),
      isReversed: true,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  // Soft-delete for everyone
  deleteMessageForEveryone: (conversationId: string, messageId: string, requesterId: string) =>
    ChatMessageModel.findOneAndUpdate(
      {
        _id: messageId,
        conversationId: new Types.ObjectId(conversationId),
        senderId: new Types.ObjectId(requesterId),
      },
      { $set: { isDeleted: true, content: "This message was deleted" } },
      { returnDocument: "after" },
    ).lean(),

  // Delete only for requesting user
  deleteMessageForMe: (conversationId: string, messageId: string, userId: string) =>
    ChatMessageModel.findOneAndUpdate(
      { _id: messageId, conversationId: new Types.ObjectId(conversationId) },
      { $addToSet: { deletedFor: new Types.ObjectId(userId) } },
      { returnDocument: "after" },
    ).lean(),

  // Emoji reaction
  addReaction: async (conversationId: string, messageId: string, userId: string, emoji: string) => {
    await ChatMessageModel.updateOne(
      { _id: messageId, conversationId: new Types.ObjectId(conversationId) },
      { $pull: { reactions: { userId: new Types.ObjectId(userId) } } },
    );
    return ChatMessageModel.findOneAndUpdate(
      { _id: messageId, conversationId: new Types.ObjectId(conversationId) },
      { $push: { reactions: { userId: new Types.ObjectId(userId), emoji } } },
      { returnDocument: "after" },
    ).lean();
  },

  // Mark all messages in conversation as read by userId
  markMessagesRead: (conversationId: string, userId: string) =>
    ChatMessageModel.updateMany(
      {
        conversationId: new Types.ObjectId(conversationId),
        readBy: { $ne: new Types.ObjectId(userId) },
      },
      { $addToSet: { readBy: new Types.ObjectId(userId) } },
    ),

  // Full-text search across messages the user can access
  searchMessages: async (userId: string, q: string, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    // Get conversation IDs the user is a participant of
    const convIds = await ConversationModel.distinct("_id", {
      participants: new Types.ObjectId(userId),
      isActive: true,
    });
    return ChatMessageModel.find({
      conversationId: { $in: convIds },
      $text: { $search: q },
      isDeleted: false,
    })
      .sort({ score: { $meta: "textScore" } as never, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  },

  // ── Conversation management ────────────────────────────────────────────────

  addParticipants: (conversationId: string, userIds: string[]) =>
    ConversationModel.findByIdAndUpdate(
      conversationId,
      { $addToSet: { participants: { $each: userIds } } },
      { returnDocument: "after" },
    ).lean(),

  removeParticipant: (conversationId: string, userId: string) =>
    ConversationModel.findByIdAndUpdate(
      conversationId,
      {
        $pull: {
          participants: new Types.ObjectId(userId),
          groupAdmins: new Types.ObjectId(userId),
        },
      },
      { returnDocument: "after" },
    ).lean(),

  makeAdmin: (conversationId: string, userId: string) =>
    ConversationModel.findByIdAndUpdate(
      conversationId,
      { $addToSet: { groupAdmins: new Types.ObjectId(userId) } },
      { returnDocument: "after" },
    ).lean(),

  removeAdmin: (conversationId: string, userId: string) =>
    ConversationModel.findByIdAndUpdate(
      conversationId,
      { $pull: { groupAdmins: new Types.ObjectId(userId) } },
      { returnDocument: "after" },
    ).lean(),

  updateGroupInfo: (
    conversationId: string,
    data: { groupName?: string; groupAvatar?: string; groupDescription?: string },
  ) => ConversationModel.findByIdAndUpdate(conversationId, { $set: data }).lean(),

  generateInviteLink: (conversationId: string) => {
    const token = uuidv4();
    return ConversationModel.findByIdAndUpdate(
      conversationId,
      { $set: { inviteLink: token, inviteLinkExpiresAt: new Date(Date.now() + 7 * 86400000) } },
      { returnDocument: "after" },
    ).lean();
  },

  findByInviteLink: (token: string) =>
    ConversationModel.findOne({
      inviteLink: token,
      inviteLinkExpiresAt: { $gt: new Date() },
      type: "group",
      isActive: true,
    }).lean(),

  clearChatHistory: (conversationId: string, userId: string) =>
    ChatMessageModel.updateMany(
      { conversationId: new Types.ObjectId(conversationId) },
      { $addToSet: { deletedFor: new Types.ObjectId(userId) } },
    ),

  deleteConversation: (conversationId: string, userId: string) =>
    ConversationModel.findOneAndUpdate(
      { _id: conversationId, participants: userId },
      {
        $pull: {
          participants: new Types.ObjectId(userId),
          groupAdmins: new Types.ObjectId(userId),
        },
      },
      { returnDocument: "after" },
    ).lean(),
};

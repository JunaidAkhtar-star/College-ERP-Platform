import createError from "http-errors";
import mongoose, { Types } from "mongoose";
import {
  CollaborationPostModel,
  CollaborationReplyModel,
  GalleryAlbumModel,
  GalleryMediaModel,
  PollVoteModel,
} from "../models/collaboration.model";
import { DepartmentModel } from "../models/department.model";
import { RoleModel } from "../models/role.model";

interface IIdentity {
  id: string;
  name: string;
  roles: string[];
  departmentId?: string;
}
const MODERATOR_ROLES = new Set([
  "super_admin",
  "admin",
  "principal",
  "dean_academic",
  "administration_office",
]);
function visibility(user: IIdentity): Record<string, unknown> {
  return {
    $or: [
      { scope: "institution" },
      { scope: "roles", targetRoles: { $in: user.roles } },
      ...(user.departmentId
        ? [{ scope: "departments", targetDepartments: new Types.ObjectId(user.departmentId) }]
        : []),
      { createdBy: new Types.ObjectId(user.id) },
    ],
  };
}
function validateScope(data: {
  scope: "institution" | "roles" | "departments";
  targetRoles?: string[];
  targetDepartments?: string[];
}) {
  if (data.scope === "roles" && !data.targetRoles?.length)
    throw createError(400, "Role-scoped content requires target roles");
  if (data.scope === "departments" && !data.targetDepartments?.length)
    throw createError(400, "Department-scoped content requires target departments");
}

export const collaborationService = {
  metadata: async () => {
    const [roles, departments] = await Promise.all([
      RoleModel.find({ isActive: true }).select("name displayName").sort({ displayName: 1 }).lean(),
      DepartmentModel.find({ isActive: true }).select("name code").sort({ name: 1 }).lean(),
    ]);
    return { roles, departments, postTypes: ["discussion", "announcement", "poll"] };
  },
  listPosts: async (user: IIdentity, type?: "discussion" | "announcement" | "poll") => {
    const posts = await CollaborationPostModel.find({
      ...visibility(user),
      ...(type ? { type } : {}),
    })
      .sort({ isPinned: -1, createdAt: -1 })
      .limit(500)
      .lean();
    const votes = await PollVoteModel.find({
      userId: user.id,
      postId: { $in: posts.filter((post) => post.type === "poll").map((post) => post._id) },
    }).lean();
    const voteMap = new Map(votes.map((vote) => [vote.postId.toString(), vote.optionIds]));
    return posts.map((post) => ({
      ...post,
      myVoteOptionIds: voteMap.get(post._id.toString()) ?? [],
    }));
  },
  getPost: async (id: string, user: IIdentity) => {
    const post = await CollaborationPostModel.findOne({ _id: id, ...visibility(user) }).lean();
    if (!post) throw createError(404, "Collaboration post not found");
    const replies = await CollaborationReplyModel.find({ postId: id })
      .sort({ createdAt: 1 })
      .lean();
    return { post, replies };
  },
  managePost: async (
    id: string,
    data: { isPinned?: boolean; isLocked?: boolean },
    user: IIdentity,
  ) => {
    if (data.isPinned === undefined && data.isLocked === undefined)
      throw createError(400, "Choose whether to pin or close the discussion");
    const post = await CollaborationPostModel.findOne({ _id: id, ...visibility(user) });
    if (!post) throw createError(404, "Collaboration post not found");
    const isModerator = user.roles.some((role) => MODERATOR_ROLES.has(role));
    const isOwner = post.createdBy.toString() === user.id;
    if (!isModerator && !isOwner)
      throw createError(403, "Only the author or an institution moderator can manage this post");
    if (data.isPinned !== undefined && !isModerator)
      throw createError(403, "Only an institution moderator can pin announcements");
    if (data.isPinned !== undefined) post.isPinned = data.isPinned;
    if (data.isLocked !== undefined) post.isLocked = data.isLocked;
    await post.save();
    return post.toObject();
  },
  createPost: async (
    data: {
      type: "discussion" | "announcement" | "poll";
      title: string;
      content: string;
      scope: "institution" | "roles" | "departments";
      targetRoles?: string[];
      targetDepartments?: string[];
      attachments?: Array<{ name: string; url: string; publicId?: string }>;
      pollOptions?: string[];
      pollEndsAt?: string;
      allowMultipleVotes?: boolean;
    },
    user: IIdentity,
  ) => {
    validateScope(data);
    const options = (data.pollOptions ?? []).map((label, index) => ({
      id: `option_${index + 1}`,
      label: label.trim(),
      voteCount: 0,
    }));
    if (data.type === "poll" && (options.length < 2 || options.length > 20))
      throw createError(400, "A poll requires 2-20 options");
    if (options.some((option) => !option.label))
      throw createError(400, "Poll options cannot be empty");
    const endsAt = data.pollEndsAt ? new Date(data.pollEndsAt) : undefined;
    if (endsAt && endsAt <= new Date())
      throw createError(400, "Poll end time must be in the future");
    return CollaborationPostModel.create({
      ...data,
      pollOptions: data.type === "poll" ? options : [],
      pollEndsAt: endsAt,
      createdBy: user.id,
      createdByName: user.name,
    });
  },
  reply: async (
    postId: string,
    data: {
      content: string;
      attachments?: Array<{ name: string; url: string; publicId?: string }>;
    },
    user: IIdentity,
  ) => {
    const post = await CollaborationPostModel.findOne({
      _id: postId,
      ...visibility(user),
      isLocked: false,
      type: { $ne: "poll" },
    }).lean();
    if (!post) throw createError(409, "Post is unavailable, locked or does not accept replies");
    const session = await mongoose.startSession();
    try {
      let reply = null;
      await session.withTransaction(async () => {
        [reply] = await CollaborationReplyModel.create(
          [{ ...data, postId, createdBy: user.id, createdByName: user.name }],
          { session },
        );
        const updated = await CollaborationPostModel.updateOne(
          { _id: postId, isLocked: false },
          { $inc: { replyCount: 1 } },
          { session },
        );
        if (updated.modifiedCount !== 1) throw createError(409, "Post was locked concurrently");
      });
      return reply;
    } finally {
      await session.endSession();
    }
  },
  vote: async (postId: string, optionIds: string[], user: IIdentity) => {
    const post = await CollaborationPostModel.findOne({
      _id: postId,
      type: "poll",
      isLocked: false,
      $and: [
        visibility(user),
        { $or: [{ pollEndsAt: { $exists: false } }, { pollEndsAt: { $gt: new Date() } }] },
      ],
    }).lean();
    if (!post) throw createError(409, "Poll is unavailable or closed");
    const unique = Array.from(new Set(optionIds));
    if (!unique.length || (!post.allowMultipleVotes && unique.length !== 1))
      throw createError(400, "Select a valid number of poll options");
    const validOptions = new Set(post.pollOptions.map((option) => option.id));
    if (unique.some((id) => !validOptions.has(id))) throw createError(400, "Invalid poll option");
    const session = await mongoose.startSession();
    try {
      let vote = null;
      await session.withTransaction(async () => {
        [vote] = await PollVoteModel.create([{ postId, userId: user.id, optionIds: unique }], {
          session,
        });
        for (const optionId of unique) {
          const updated = await CollaborationPostModel.updateOne(
            { _id: postId, "pollOptions.id": optionId },
            { $inc: { "pollOptions.$.voteCount": 1 } },
            { session },
          );
          if (updated.modifiedCount !== 1) throw createError(409, "Poll changed while voting");
        }
      });
      return vote;
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw createError(409, "You have already voted in this poll");
      throw error;
    } finally {
      await session.endSession();
    }
  },
  listAlbums: (user: IIdentity) =>
    GalleryAlbumModel.find(visibility(user)).sort({ createdAt: -1 }).lean(),
  createAlbum: async (
    data: {
      name: string;
      description?: string;
      scope: "institution" | "roles" | "departments";
      targetRoles?: string[];
      targetDepartments?: string[];
    },
    user: IIdentity,
  ) => {
    validateScope(data);
    return GalleryAlbumModel.create({ ...data, createdBy: user.id });
  },
  getAlbum: async (id: string, user: IIdentity) => {
    const album = await GalleryAlbumModel.findOne({ _id: id, ...visibility(user) }).lean();
    if (!album) throw createError(404, "Gallery album not found");
    const media = await GalleryMediaModel.find({ albumId: id }).sort({ createdAt: -1 }).lean();
    return { album, media };
  },
  addMedia: async (
    albumId: string,
    data: { title: string; description?: string; url: string; publicId?: string; mimeType: string },
    user: IIdentity,
  ) => {
    const album = await GalleryAlbumModel.findOne({ _id: albumId, ...visibility(user) }).lean();
    if (!album) throw createError(404, "Gallery album not found");
    const isModerator = user.roles.some((role) => MODERATOR_ROLES.has(role));
    if (!isModerator && album.createdBy.toString() !== user.id) {
      throw createError(403, "Only the album owner or an institution moderator can add media");
    }
    if (!/^https:\/\//i.test(data.url))
      throw createError(400, "Gallery media requires an HTTPS URL");
    const session = await mongoose.startSession();
    try {
      let media = null;
      await session.withTransaction(async () => {
        [media] = await GalleryMediaModel.create([{ ...data, albumId, uploadedBy: user.id }], {
          session,
        });
        await GalleryAlbumModel.updateOne(
          { _id: albumId },
          { $inc: { mediaCount: 1 }, $set: { coverUrl: album.coverUrl ?? data.url } },
          { session },
        );
      });
      return media;
    } finally {
      await session.endSession();
    }
  },
};

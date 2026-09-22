import mongoose, { Schema, type Document, type Types } from "mongoose";
import { auditPlugin } from "../plugins/audit.plugin";

export interface ICollaborationPost extends Document {
  type: "discussion" | "announcement" | "poll";
  title: string;
  content: string;
  scope: "institution" | "roles" | "departments";
  targetRoles: string[];
  targetDepartments: Types.ObjectId[];
  attachments: Array<{ name: string; url: string; publicId?: string }>;
  pollOptions: Array<{ id: string; label: string; voteCount: number }>;
  pollEndsAt?: Date;
  allowMultipleVotes: boolean;
  isPinned: boolean;
  isLocked: boolean;
  replyCount: number;
  createdBy: Types.ObjectId;
  createdByName: string;
}
export interface ICollaborationReply extends Document {
  postId: Types.ObjectId;
  content: string;
  attachments: Array<{ name: string; url: string; publicId?: string }>;
  createdBy: Types.ObjectId;
  createdByName: string;
}
export interface IPollVote extends Document {
  postId: Types.ObjectId;
  userId: Types.ObjectId;
  optionIds: string[];
}
export interface IGalleryAlbum extends Document {
  name: string;
  description?: string;
  scope: "institution" | "roles" | "departments";
  targetRoles: string[];
  targetDepartments: Types.ObjectId[];
  coverUrl?: string;
  mediaCount: number;
  createdBy: Types.ObjectId;
}
export interface IGalleryMedia extends Document {
  albumId: Types.ObjectId;
  title: string;
  description?: string;
  url: string;
  publicId?: string;
  mimeType: string;
  uploadedBy: Types.ObjectId;
}

const AttachmentSchema = new Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    publicId: String,
  },
  { _id: false },
);
const ScopeFields = {
  scope: {
    type: String,
    enum: ["institution", "roles", "departments"],
    default: "institution" as const,
  },
  targetRoles: { type: [String], default: [] },
  targetDepartments: [{ type: Schema.Types.ObjectId, ref: "Department" }],
};
const CollaborationPostSchema = new Schema<ICollaborationPost>(
  {
    type: {
      type: String,
      enum: ["discussion", "announcement", "poll"],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, trim: true, maxlength: 10000 },
    ...ScopeFields,
    attachments: { type: [AttachmentSchema], default: [] },
    pollOptions: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            label: { type: String, required: true, maxlength: 200 },
            voteCount: { type: Number, default: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    pollEndsAt: Date,
    allowMultipleVotes: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false, index: true },
    isLocked: { type: Boolean, default: false },
    replyCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true },
);
CollaborationPostSchema.index({ isPinned: -1, createdAt: -1 });
CollaborationPostSchema.plugin(auditPlugin);
const CollaborationReplySchema = new Schema<ICollaborationReply>(
  {
    postId: { type: Schema.Types.ObjectId, ref: "CollaborationPost", required: true, index: true },
    content: { type: String, required: true, trim: true, maxlength: 5000 },
    attachments: { type: [AttachmentSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true },
);
CollaborationReplySchema.index({ postId: 1, createdAt: 1 });
CollaborationReplySchema.plugin(auditPlugin);
const PollVoteSchema = new Schema<IPollVote>(
  {
    postId: { type: Schema.Types.ObjectId, ref: "CollaborationPost", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    optionIds: { type: [String], required: true },
  },
  { timestamps: true },
);
PollVoteSchema.index({ postId: 1, userId: 1 }, { unique: true });
const GalleryAlbumSchema = new Schema<IGalleryAlbum>(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, maxlength: 1000 },
    ...ScopeFields,
    coverUrl: String,
    mediaCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
GalleryAlbumSchema.plugin(auditPlugin);
const GalleryMediaSchema = new Schema<IGalleryMedia>(
  {
    albumId: { type: Schema.Types.ObjectId, ref: "GalleryAlbum", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 1000 },
    url: { type: String, required: true },
    publicId: String,
    mimeType: { type: String, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
GalleryMediaSchema.index({ albumId: 1, createdAt: -1 });
GalleryMediaSchema.plugin(auditPlugin);

export const CollaborationPostModel = mongoose.model<ICollaborationPost>(
  "CollaborationPost",
  CollaborationPostSchema,
);
export const CollaborationReplyModel = mongoose.model<ICollaborationReply>(
  "CollaborationReply",
  CollaborationReplySchema,
);
export const PollVoteModel = mongoose.model<IPollVote>("PollVote", PollVoteSchema);
export const GalleryAlbumModel = mongoose.model<IGalleryAlbum>("GalleryAlbum", GalleryAlbumSchema);
export const GalleryMediaModel = mongoose.model<IGalleryMedia>("GalleryMedia", GalleryMediaSchema);

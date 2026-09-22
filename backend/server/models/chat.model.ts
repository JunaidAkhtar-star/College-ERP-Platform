import type { Types, Document } from "mongoose";
import { Schema, model } from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
// FIX: Messages are stored in a SEPARATE collection (not embedded in
// Conversation) to prevent the 16MB MongoDB document size limit from being
// hit in active group chats.
// ─────────────────────────────────────────────────────────────────────────────

// ── Reaction sub-document ────────────────────────────────────────────────────
export interface IChatReaction {
  userId: Types.ObjectId;
  emoji: string;
}

const ChatReactionSchema = new Schema<IChatReaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    emoji: { type: String, required: true, trim: true },
  },
  { _id: false },
);

// ── Message document (own collection: "chatmessages") ───────────────────────
export interface IChatMessage extends Document {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId; // FK → Conversation
  senderId: Types.ObjectId; // FK → User
  content: string;
  messageType: "text" | "file" | "image" | "audio" | "video" | "call_log";
  fileUrl?: string;
  fileName?: string;
  replyTo?: Types.ObjectId; // FK → ChatMessage (self-ref)
  reactions: IChatReaction[];
  isDeleted: boolean; // deleted for everyone
  deletedFor: Types.ObjectId[]; // deleted only for these users (delete for me)
  readBy: Types.ObjectId[]; // FK[] → User
  createdAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true },
    messageType: {
      type: String,
      enum: ["text", "file", "image", "audio", "video", "call_log"],
      default: "text",
    },
    fileUrl: { type: String },
    fileName: { type: String },
    replyTo: { type: Schema.Types.ObjectId, ref: "ChatMessage" },
    reactions: { type: [ChatReactionSchema], default: [] },
    isDeleted: { type: Boolean, default: false },
    deletedFor: [{ type: Schema.Types.ObjectId, ref: "User" }],
    readBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Index for paginated message fetch (most common query)
ChatMessageSchema.index({ conversationId: 1, createdAt: -1 });
// Full-text search on message content
ChatMessageSchema.index({ content: "text" });

export const ChatMessageModel = model<IChatMessage>("ChatMessage", ChatMessageSchema);

// ── Conversation document (own collection: "conversations") ─────────────────
// Stores ONLY metadata. Messages live in ChatMessage collection.
export interface IConversation extends Document {
  participants: Types.ObjectId[];
  type: "direct" | "group";
  groupName?: string;
  groupAvatar?: string;
  groupDescription?: string;
  groupAdmins?: Types.ObjectId[];
  inviteLink?: string;
  inviteLinkExpiresAt?: Date;
  // Denormalised last-message snapshot for inbox list (avoids extra query)
  lastMessage?: string;
  lastMessageAt?: Date;
  lastMessageBy?: Types.ObjectId;
  totalMessages: number;
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    type: { type: String, enum: ["direct", "group"], required: true },
    groupName: { type: String, trim: true },
    groupAvatar: { type: String },
    groupDescription: { type: String, trim: true },
    groupAdmins: [{ type: Schema.Types.ObjectId, ref: "User" }],
    inviteLink: { type: String },
    inviteLinkExpiresAt: { type: Date },
    lastMessage: { type: String },
    lastMessageAt: { type: Date },
    lastMessageBy: { type: Schema.Types.ObjectId, ref: "User" },
    totalMessages: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ lastMessageAt: -1 });
ConversationSchema.index({ inviteLink: 1 }, { sparse: true });

export const ConversationModel = model<IConversation>("Conversation", ConversationSchema);

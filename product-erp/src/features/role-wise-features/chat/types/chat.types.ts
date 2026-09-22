/**
 * @file chat.types.ts
 * @description TypeScript interfaces for the Chat module.
 *  Mirrors backend Conversation + Message models with frontend-specific additions.
 * @module features/role-wise-features/chat/types
 */

import { TSystemRole } from '@/shared/types';

// ── User reference in chat context ───────────────────────────────────────────

export interface IChatUser {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: TSystemRole;
  /** Short context label rendered next to the name (e.g. "CSE • Y3-A", "HOD - CSE", "Faculty"). */
  tag?: string;
  isOnline?: boolean;
}

// ── Reaction on a message ────────────────────────────────────────────────────

export interface IChatReaction {
  userId: string;
  emoji: string;
}

// ── Individual message ────────────────────────────────────────────────────────

export type TMessageType = 'text' | 'file' | 'image' | 'audio' | 'video' | 'call_log';

export interface IChatMessage {
  _id: string;
  senderId: IChatUser | string;
  content: string;
  messageType: TMessageType;
  fileUrl?: string;
  fileName?: string;
  replyTo?: string; // _id of the message being replied to
  reactions: IChatReaction[];
  isDeleted: boolean;
  deletedFor: string[];
  readBy: string[];
  createdAt: string;
}

// ── Conversation (direct or group) ───────────────────────────────────────────

export type TConversationType = 'direct' | 'group';

export interface IConversation {
  _id: string;
  participants: IChatUser[];
  type: TConversationType;
  groupName?: string;
  groupAvatar?: string;
  groupDescription?: string;
  groupAdmins?: string[];
  inviteLink?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  lastMessageBy?: string;
  messages?: IChatMessage[];
  totalMessages: number;
  unreadCount?: number; // frontend-only — calculated from readBy
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ── API response shapes ──────────────────────────────────────────────────────

export interface IConversationsResponse {
  conversations: IConversation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IMessagesResponse {
  messages: IChatMessage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IOnlineUsersResponse {
  onlineUserIds: string[];
}

export interface ISearchResult {
  conversationId: string;
  message: IChatMessage;
  conversationName: string;
  conversationType: TConversationType;
}

export interface IMessageSearchResponse {
  results: ISearchResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ── Form DTOs for mutations ──────────────────────────────────────────────────

export interface IStartDirectChatDto {
  userId: string;
}

export interface ICreateGroupDto {
  name: string;
  participantIds: string[];
  description?: string;
}

export interface ISendMessageDto {
  content: string;
  messageType?: TMessageType;
  fileUrl?: string;
  fileName?: string;
  replyTo?: string;
}

export interface IUpdateGroupDto {
  groupName?: string;
  groupAvatar?: string;
  groupDescription?: string;
}

export interface IAddMembersDto {
  userIds: string[];
}

export interface IReactToMessageDto {
  emoji: string;
}

// ── Contacts directory ───────────────────────────────────────────────────────

export interface IContactSection {
  label: string;
  users: IChatUser[];
}

export interface IContactsResponse {
  sections: IContactSection[];
}

export interface IUserSearchResponse {
  users: IChatUser[];
}

// ── Call States ──────────────────────────────────────────────────────────────

export type TCallType = 'audio' | 'video';

export interface IWaitingCall {
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  type: TCallType;
  conversationId: string;
  /** Optional legacy peer signal; Agora channel calls do not require it. */
  signalData?: unknown;
}

export interface ICallState {
  isActive: boolean;
  isIncoming: boolean;
  callerId?: string;
  callerName?: string;
  callerAvatar?: string;
  targetUserId?: string;
  type?: TCallType;
  conversationId?: string;
  /** Optional legacy peer signal; Agora channel calls do not require it. */
  signalData?: unknown;
  waitingCall?: IWaitingCall | null;
  isCallWaiting?: boolean; // True if the current user is waiting for someone else busy
}

/**
 * @file ChatHeader.tsx
 * @description Chat window top bar — name, online status, typing, group info panel.
 * @module features/role-wise-features/chat/components
 */
'use client';

import AsyncSelect from '@/shared/core/AsyncSelect';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useAuthStore } from '@/shared/store/authStore';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import {
  Bell,
  BellOff,
  Briefcase,
  ChevronRight,
  Link,
  LogOut,
  Mail,
  MoreVertical,
  Phone,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { IChatUser, IConversation } from '../types/chat.types';

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-green-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-red-500',
  'bg-indigo-500',
];
function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length] ?? 'bg-slate-400';
}
function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

interface Props {
  conversation: IConversation;
  typingUsers: string[];
  isOnline: boolean;
  onClose: () => void;
  onMutate: () => void;
  /** Current chat wallpaper URL (empty string = default pattern). */
  wallpaper?: string;
  onChangeWallpaper?: (url: string) => void;
  onStartCall?: (type: 'audio' | 'video') => void;
  searchTerm?: string;
  onSearchChange?: (val: string) => void;
}

/** Preset chat wallpapers expressed as Tailwind class strings — these are
 *  applied to both the picker swatch and the MessagePanel container, so the
 *  same class string can round-trip through localStorage. Keeping classes here
 *  (not arbitrary gradient strings) lets Tailwind statically compile them. */
const WALLPAPER_PRESETS: Array<{ label: string; className: string }> = [
  { label: 'Default', className: '' },
  { label: 'Sky', className: 'bg-gradient-to-br from-sky-100 to-blue-100' },
  { label: 'Mint', className: 'bg-gradient-to-br from-emerald-50 to-emerald-100' },
  { label: 'Sand', className: 'bg-gradient-to-br from-amber-100 to-amber-200' },
  { label: 'Rose', className: 'bg-gradient-to-br from-rose-100 to-pink-100' },
  { label: 'Lavender', className: 'bg-gradient-to-br from-violet-100 to-violet-200' },
  { label: 'Slate', className: 'bg-gradient-to-br from-slate-200 to-slate-300' },
];

export default function ChatHeader({
  conversation,
  typingUsers,
  isOnline,
  onClose,
  onMutate,
  wallpaper,
  onChangeWallpaper,
  onStartCall,
  searchTerm = '',
  onSearchChange,
}: Props) {
  const { user } = useAuthStore();
  const { mutation, isLoading } = useMutation();
  const [showInfo, setShowInfo] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [addMemberInput, setAddMemberInput] = useState('');

  const isDirect = conversation.type === 'direct';
  const other = isDirect ? conversation.participants.find((p) => p._id !== user?._id) : null;
  const displayName = isDirect ? (other?.name ?? 'Unknown') : (conversation.groupName ?? 'Group');
  const isAdmin = !isDirect && (conversation.groupAdmins ?? []).includes(user?._id ?? '');

  // ── Mute state ─────────────────────────────────────────────────────────────
  const { data: mutedRaw, mutate: mutateMuted } = useSwr<{ data?: string[] }>('chat/muted');
  const { data: callReadiness } = useSwr<{
    data?: { ready: boolean; reason?: string };
  }>('chat/call/readiness');
  const mutedIds = mutedRaw?.data ?? [];
  const isMuted = mutedIds.includes(conversation._id);

  const handleToggleMute = async () => {
    const res = await mutation(`chat/${conversation._id}/mute`, {
      method: 'POST',
      isAlert: false,
    });
    const data = (res as { results?: { data?: { muted?: boolean } } })?.results?.data;
    if (data && typeof data.muted === 'boolean') {
      toast.success(data.muted ? 'Conversation muted' : 'Conversation unmuted');
      mutateMuted();
    } else {
      toast.error('Failed to update mute');
    }
  };

  const handleAddMember = async () => {
    if (!addMemberInput.trim()) return;
    const res = await mutation(`chat/${conversation._id}/members`, {
      method: 'POST',
      body: { userIds: [addMemberInput.trim()] },
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Member added');
      setAddMemberInput('');
      onMutate();
    } else toast.error('Failed');
  };

  const handleRemoveMember = async (uid: string) => {
    const r = await Swal.fire({
      title: 'Remove member?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#0178D7',
      confirmButtonText: 'Remove',
    });
    if (!r.isConfirmed) return;
    const res = await mutation(`chat/${conversation._id}/members/${uid}`, {
      method: 'DELETE',
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Removed');
      onMutate();
    } else toast.error('Failed');
  };

  const handleLeave = async () => {
    const r = await Swal.fire({
      title: 'Leave group?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Leave',
    });
    if (!r.isConfirmed) return;
    const res = await mutation(`chat/${conversation._id}/leave`, { method: 'POST', isAlert: true });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Left group');
      onClose();
      onMutate();
    } else toast.error('Failed');
  };

  const handleGenerateLink = async () => {
    const res = await mutation(`chat/${conversation._id}/invite-link`, {
      method: 'POST',
      isAlert: true,
    });
    const link = (res as { results?: { data?: { inviteLink?: string } } })?.results?.data
      ?.inviteLink;
    if (link) {
      await navigator.clipboard
        .writeText(`${window.location.origin}/chat/join/${link}`)
        .catch(() => undefined);
      toast.success('Invite link copied!');
      onMutate();
    } else toast.error('Failed');
  };

  const handleMakeAdmin = async (uid: string) => {
    const res = await mutation(`chat/${conversation._id}/admins/${uid}`, {
      method: 'POST',
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Promoted to admin');
      onMutate();
    } else toast.error('Failed');
  };

  const handleClearHistory = async () => {
    const r = await Swal.fire({
      title: 'Clear Chat History?',
      text: 'All messages in this conversation will be permanently deleted. This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Clear All',
    });
    if (!r.isConfirmed) return;
    const res = await mutation(`chat/${conversation._id}/clear`, {
      method: 'DELETE',
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Chat history cleared');
      setShowInfo(false);
      onMutate();
    } else toast.error('Failed to clear history');
  };

  const handleDeleteConversation = async () => {
    const r = await Swal.fire({
      title: isDirect ? 'Delete Conversation?' : 'Delete Group Chat?',
      text: 'The entire conversation and all messages will be permanently deleted.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Delete',
    });
    if (!r.isConfirmed) return;
    const res = await mutation(`chat/${conversation._id}`, { method: 'DELETE', isAlert: true });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Conversation deleted');
      setShowInfo(false);
      onClose();
      onMutate();
    } else toast.error('Failed to delete conversation');
  };

  return (
    <>
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
        {showSearch ? (
          <div className="flex flex-1 items-center gap-2 pr-4">
            <Search className="h-4 w-4 text-slate-600 shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search in this conversation..."
              className="w-full bg-slate-100/80 border border-slate-200/60 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-primary focus:bg-white transition-all"
              autoFocus
            />
            <button
              type="button"
              onClick={() => {
                setShowSearch(false);
                onSearchChange?.('');
              }}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {/* Back btn on mobile */}
            <button
              type="button"
              onClick={onClose}
              className="mr-1 rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <ChevronRight className="h-4.5 w-4.5 rotate-180" />
            </button>
            {/* Avatar */}
            <button
              type="button"
              onClick={() => setShowInfo((v) => !v)}
              className="relative shrink-0"
            >
              {!isDirect && conversation.groupAvatar ? (
                <Image
                  src={conversation.groupAvatar}
                  alt={displayName}
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : other?.avatar ? (
                <Image
                  src={other.avatar}
                  alt={displayName}
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(other?._id ?? conversation._id)}`}
                >
                  {isDirect ? initials(displayName) : <Users className="h-4 w-4" />}
                </div>
              )}
              {isDirect && isOnline && (
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-400" />
              )}
            </button>
            {/* Name + status */}
            <div onClick={() => setShowInfo((v) => !v)} className="cursor-pointer">
              <p className="text-sm font-semibold text-slate-800">{displayName}</p>
              {typingUsers.length > 0 ? (
                <p className="text-xs text-primary animate-pulse">
                  {isDirect
                    ? 'typing…'
                    : `${typingUsers.join(', ')} ${typingUsers.length > 1 ? 'are' : 'is'} typing…`}
                </p>
              ) : isDirect ? (
                <p className={`text-xs ${isOnline ? 'text-green-500' : 'text-slate-600'}`}>
                  {isOnline ? 'Online' : 'Offline'}
                </p>
              ) : (
                <p className="text-xs text-slate-600">{conversation.participants.length} members</p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1">
          {onStartCall && callReadiness?.data?.ready && (
            <>
              <button
                type="button"
                onClick={() => onStartCall('video')}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-primary"
                title={isDirect ? 'Video Call' : 'Group Video Call'}
              >
                <Video className="h-4.5 w-4.5" />
              </button>
              <button
                type="button"
                onClick={() => onStartCall('audio')}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-primary"
                title={isDirect ? 'Voice Call' : 'Group Voice Call'}
              >
                <Phone className="h-4.5 w-4.5" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setShowSearch((v) => !v)}
            className={`rounded-lg p-2 ${showSearch ? 'text-primary bg-primary/10' : 'text-slate-600'} hover:bg-slate-100`}
            title="Search"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            title={isDirect ? 'Profile' : 'Group info'}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Group info side panel */}
      <AnimatePresence>
        {showInfo && !isDirect && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute inset-y-0 right-0 z-30 flex w-72 flex-col bg-white  border-l border-slate-100"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="font-semibold text-slate-800">Group Info</h3>
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Group name / description */}
              <div className="flex flex-col items-center text-center">
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white ${avatarColor(conversation._id)}`}
                >
                  <Users className="h-7 w-7" />
                </div>
                <p className="mt-2 font-bold text-slate-800">{conversation.groupName}</p>
                {conversation.groupDescription && (
                  <p className="mt-1 text-xs text-slate-600">{conversation.groupDescription}</p>
                )}
              </div>

              {/* Invite link */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleGenerateLink}
                  className="flex w-full items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100"
                >
                  <Link className="h-4 w-4 text-primary" />
                  <span>Generate invite link</span>
                </button>
              )}

              {/* Members */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-slate-600">
                  Members ({conversation.participants.length})
                </p>
                <div className="space-y-1">
                  {conversation.participants.map((p: IChatUser) => {
                    const memberIsAdmin = (conversation.groupAdmins ?? []).includes(p._id);
                    return (
                      <div
                        key={p._id}
                        className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(p._id)}`}
                          >
                            {initials(p.name)}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-700">
                              {p.name}{' '}
                              {p._id === user?._id && <span className="text-slate-600">(you)</span>}
                            </p>
                            {memberIsAdmin && (
                              <p className="text-[10px] text-primary font-medium">Admin</p>
                            )}
                          </div>
                        </div>
                        {isAdmin && p._id !== user?._id && (
                          <div className="flex items-center gap-1">
                            {!memberIsAdmin && (
                              <button
                                type="button"
                                onClick={() => handleMakeAdmin(p._id)}
                                title="Make admin"
                                className="rounded p-1 text-slate-600 hover:text-primary"
                              >
                                <Shield className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(p._id)}
                              title="Remove"
                              className="rounded p-1 text-slate-600 hover:text-red-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add member */}
              {isAdmin && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-slate-600">Add Member</p>
                  <div className="flex items-end gap-2">
                    <AsyncSelect
                      type="users"
                      value={addMemberInput || null}
                      onChange={(value) => setAddMemberInput(value ?? '')}
                      placeholder="Search people…"
                      className="min-w-0 flex-1"
                    />
                    <button
                      type="button"
                      onClick={handleAddMember}
                      className="rounded-lg bg-primary px-2.5 py-1.5 text-white hover:bg-primary/90"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Mute toggle (group) */}
              <button
                type="button"
                onClick={handleToggleMute}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors ${isMuted
                    ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
              >
                <span className="flex items-center gap-2">
                  {isMuted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                  {isMuted ? 'Notifications muted' : 'Mute notifications'}
                </span>
                <span
                  className={`relative h-5 w-9 rounded-full transition-colors ${isMuted ? 'bg-amber-400' : 'bg-slate-300'}`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white  transition-transform ${isMuted ? 'translate-x-4' : 'translate-x-0.5'}`}
                  />
                </span>
              </button>

              {/* Wallpaper picker (group) */}
              {onChangeWallpaper && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-slate-600">
                    Chat Wallpaper
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {WALLPAPER_PRESETS.map((p) => {
                      const isActive = (wallpaper ?? '') === p.className;
                      return (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => onChangeWallpaper(p.className)}
                          title={p.label}
                          className={`h-12 rounded-lg ring-2 transition-all ${isActive ? 'ring-primary' : 'ring-transparent hover:ring-slate-200'} ${p.className || 'bg-slate-50'}`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Group Actions */}
            <div className="border-t border-slate-100 p-4 space-y-2.5 bg-slate-50/50">
              <button
                type="button"
                onClick={handleClearHistory}
                className="group flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-xs transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.99]"
              >
                <Trash2 className="h-4 w-4 text-slate-400 transition-colors group-hover:text-amber-600" />
                <span>Clear Chat History</span>
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleDeleteConversation}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl border border-red-200/80 bg-red-50/80 px-4 py-2.5 text-xs font-semibold text-red-600 shadow-xs transition-all duration-200 hover:border-red-300 hover:bg-red-500 hover:text-white active:scale-[0.99]"
                >
                  <Trash2 className="h-4 w-4 text-red-500 transition-colors group-hover:text-white" />
                  <span>Delete Group Chat</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleLeave}
                disabled={isLoading}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-red-500 to-rose-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm shadow-red-500/20 transition-all duration-200 hover:from-red-600 hover:to-rose-700 hover:shadow-md hover:shadow-red-500/30 active:scale-[0.99] disabled:opacity-50"
              >
                <LogOut className="h-4 w-4 text-red-100 transition-transform group-hover:-translate-x-0.5" />
                <span>{isLoading ? 'Leaving…' : 'Leave Group'}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Direct user profile side panel */}
      <AnimatePresence>
        {showInfo && isDirect && other && (
          <motion.div
            initial={{ x: '100%', opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="absolute inset-y-0 right-0 z-30 flex w-80 flex-col bg-white border-l border-slate-200/80 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <h3 className="font-semibold text-slate-800 text-sm tracking-tight">Contact Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Profile Card with Gradient Accent */}
              <div className="relative flex flex-col items-center text-center rounded-2xl bg-linear-to-b from-slate-50 to-white p-5 border border-slate-100 shadow-xs">
                <div className="relative">
                  {other.avatar ? (
                    <Image
                      src={other.avatar}
                      alt={other.name}
                      width={80}
                      height={80}
                      className="h-20 w-20 rounded-full object-cover ring-4 ring-white shadow-md"
                    />
                  ) : (
                    <div
                      className={`flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white ring-4 ring-white shadow-md ${avatarColor(other._id)}`}
                    >
                      {initials(other.name)}
                    </div>
                  )}
                  <span
                    className={`absolute bottom-0 right-0 h-4.5 w-4.5 rounded-full border-2 border-white shadow-xs ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                  />
                </div>

                <p className="mt-3.5 text-base font-bold text-slate-900 tracking-tight">{other.name}</p>

                <div className="mt-1 flex items-center gap-1.5">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  <p className={`text-xs font-medium ${isOnline ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {isOnline ? 'Available now' : 'Currently offline'}
                  </p>
                </div>

                {other.tag && (
                  <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                    <Sparkles className="h-3 w-3" />
                    {other.tag}
                  </span>
                )}
              </div>

              {/* Information Section */}
              <div className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                  User Information
                </p>

                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-slate-50/60 p-1">
                  {other.email && (
                    <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white transition-colors">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase text-slate-400">Email Address</p>
                        <p className="truncate text-xs font-medium text-slate-700 select-all">{other.email}</p>
                      </div>
                    </div>
                  )}

                  {other.role && (
                    <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white transition-colors">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                        <Briefcase className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase text-slate-400">Campus Role</p>
                        <p className="truncate text-xs font-medium text-slate-700">
                          {String(other.role)
                            .split('_')
                            .map((w) => w[0]?.toUpperCase() + w.slice(1))
                            .join(' ')}
                        </p>
                      </div>
                    </div>
                  )}

                  {(other as { phone?: string }).phone && (
                    <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white transition-colors">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        <Phone className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase text-slate-400">Phone</p>
                        <p className="truncate text-xs font-medium text-slate-700">
                          {(other as { phone?: string }).phone}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white transition-colors">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase text-slate-400">Chat Privacy</p>
                      <p className="truncate text-xs font-medium text-slate-700">Role-verified direct channel</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Preferences: Mute Notifications */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                  Chat Preferences
                </p>
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className={`flex w-full items-center justify-between rounded-xl border p-3 text-sm transition-all duration-200 ${isMuted
                      ? 'border-amber-200 bg-amber-50/70 text-amber-900 shadow-xs'
                      : 'border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                >
                  <span className="flex items-center gap-2.5 text-xs font-medium">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-lg ${isMuted ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                        }`}
                    >
                      {isMuted ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                    </div>
                    {isMuted ? 'Notifications muted' : 'Mute notifications'}
                  </span>
                  <span
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out ${isMuted ? 'bg-amber-500' : 'bg-slate-300'
                      }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${isMuted ? 'translate-x-4.5 mt-0.5' : 'translate-x-0.5 mt-0.5'
                        }`}
                    />
                  </span>
                </button>
              </div>

              {/* Wallpaper picker */}
              {onChangeWallpaper && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                    Chat Wallpaper
                  </p>
                  <div className="grid grid-cols-4 gap-2 rounded-2xl border border-slate-100 bg-slate-50/60 p-2.5">
                    {WALLPAPER_PRESETS.map((p) => {
                      const isActive = (wallpaper ?? '') === p.className;
                      return (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => onChangeWallpaper(p.className)}
                          title={p.label}
                          className={`relative h-11 rounded-lg ring-2 transition-all ${isActive
                              ? 'ring-primary ring-offset-1 shadow-xs scale-102'
                              : 'ring-transparent hover:ring-slate-300 hover:scale-98'
                            } ${p.className || 'bg-white border border-slate-200'}`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Custom Styled Action Buttons */}
            <div className="border-t border-slate-100 p-4 space-y-2.5 bg-slate-50/50">
              <button
                type="button"
                onClick={handleClearHistory}
                className="group flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-xs transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.99]"
              >
                <Trash2 className="h-4 w-4 text-slate-400 transition-colors group-hover:text-amber-600" />
                <span>Clear Chat History</span>
              </button>

              <button
                type="button"
                onClick={handleDeleteConversation}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-red-500 to-rose-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm shadow-red-500/20 transition-all duration-200 hover:from-red-600 hover:to-rose-700 hover:shadow-md hover:shadow-red-500/30 active:scale-[0.99]"
              >
                <Trash2 className="h-4 w-4 text-red-100 transition-transform group-hover:scale-110" />
                <span>Delete Conversation</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

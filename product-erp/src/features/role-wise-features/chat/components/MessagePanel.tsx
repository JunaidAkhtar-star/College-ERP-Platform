/**
 * @file MessagePanel.tsx
 * @description Chat message area — messages list, reactions, reply, delete, read receipts,
 * infinite scroll (load older), file/image/audio/video rendering.
 * @module features/role-wise-features/chat/components
 */
'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import Image from 'next/image';
import {
  Check,
  CheckCheck,
  Reply,
  Trash2,
  Smile,
  FileText,
  Download,
  ChevronDown,
  Phone,
  Video,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import useMutation from '@/shared/hooks/useMutation';
import { useAuthStore } from '@/shared/store/authStore';
import { IChatMessage, IConversation } from '../types/chat.types';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface Props {
  conversation: IConversation;
  messages: IChatMessage[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onReply: (msg: IChatMessage) => void;
  onMutate: () => void;
  /** Optional chat background image URL (WhatsApp-style wallpaper). */
  background?: string | null;
  /** Set of currently online user IDs. */
  onlineIds?: Set<string>;
  searchTerm?: string;
}

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-green-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-teal-500',
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
function getSenderId(msg: IChatMessage): string {
  return typeof msg.senderId === 'object' ? (msg.senderId as { _id: string })._id : msg.senderId;
}
function getSenderName(msg: IChatMessage): string {
  return typeof msg.senderId === 'object'
    ? ((msg.senderId as { name?: string }).name ?? 'User')
    : 'User';
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function MessagePanel({
  conversation,
  messages,
  isLoading,
  hasMore,
  onLoadMore,
  onReply,
  onMutate,
  background,
  onlineIds,
  searchTerm = '',
}: Props) {
  const { user } = useAuthStore();
  const { mutation } = useMutation();
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [showReactionFor, setShowReactionFor] = useState<string | null>(null);
  const prevScrollHeight = useRef(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unseenCount, setUnseenCount] = useState(0);

  // Click outside to close reaction picker
  useEffect(() => {
    if (showReactionFor === null) return;
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.reaction-picker-container') && !target.closest('.react-btn-trigger')) {
        setShowReactionFor(null);
        setHovered(null);
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [showReactionFor]);

  // Filter messages by search term and call_log/content validation
  const visibleMessages = React.useMemo(() => {
    let list = messages.filter(
      (m) => m.messageType === 'call_log' || (m.content ?? '').trim().length > 0 || m.fileUrl,
    );
    if (searchTerm.trim()) {
      list = list.filter((m) => m.content?.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return list;
  }, [messages, searchTerm]);

  // ── Scroll to bottom on new message (only if user is already near the bottom)
  //   If the user scrolled up to read history, do NOT yank them to the bottom —
  //   instead bump the "new messages" counter shown on the floating chevron.
  useEffect(() => {
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnseenCount(0); // eslint-disable-line react-hooks/set-state-in-effect
    } else {
      setUnseenCount((c) => c + 1);
    }
  }, [visibleMessages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset unseen counter when conversation changes ────────────────────────
  useEffect(() => {
    setUnseenCount(0); // eslint-disable-line react-hooks/set-state-in-effect
    setIsAtBottom(true);
  }, [conversation._id]);

  // ── Restore scroll position when loading more ──────────────────────────────
  useEffect(() => {
    if (!isLoading && containerRef.current) {
      const diff = containerRef.current.scrollHeight - prevScrollHeight.current;
      containerRef.current.scrollTop = diff;
    }
  }, [isLoading]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    // Track whether user is near the bottom (within 80 px).
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < 80;
    setIsAtBottom(atBottom);
    if (atBottom) setUnseenCount(0);
    // Older-message infinite scroll
    if (!isLoading && hasMore && el.scrollTop < 80) {
      prevScrollHeight.current = el.scrollHeight;
      onLoadMore();
    }
  }, [isLoading, hasMore, onLoadMore]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUnseenCount(0);
    setIsAtBottom(true);
  }, []);

  const handleDelete = async (msg: IChatMessage) => {
    const { value: deleteFor } = await Swal.fire({
      title: 'Delete message?',
      input: 'radio',
      inputOptions: { everyone: 'Delete for everyone', me: 'Delete for me' },
      inputValue: 'everyone',
      showCancelButton: true,
      confirmButtonColor: '#0178D7',
    });
    if (!deleteFor) return;
    const res = await mutation(
      `chat/${conversation._id}/messages/${msg._id}?deleteFor=${deleteFor}`,
      { method: 'DELETE', isAlert: true },
    );
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Deleted');
      onMutate();
    } else toast.error('Failed');
  };

  const handleReact = async (msg: IChatMessage, emoji: string) => {
    setShowReactionFor(null);
    setHovered(null);
    const res = await mutation(`chat/${conversation._id}/messages/${msg._id}/react`, {
      method: 'POST',
      body: { emoji },
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) onMutate();
    else toast.error('Failed');
  };

  // Find reply-to message
  const findReplyMsg = (replyId?: string): IChatMessage | undefined => {
    if (!replyId) return undefined;
    return messages.find((m) => m._id === replyId);
  };

  const renderMedia = (msg: IChatMessage) => {
    if (msg.isDeleted) {
      return <p className="text-xs italic text-slate-600">🚫 This message was deleted</p>;
    }
    switch (msg.messageType) {
      case 'call_log': {
        const isVideo = msg.content?.includes('Video');
        return (
          <div className="flex items-center gap-1.5">
            {isVideo ? <Video className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
            <span className="text-xs font-medium">{msg.content}</span>
          </div>
        );
      }
      case 'image':
        return (
          <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={msg.fileUrl!}
              alt={msg.fileName ?? 'Image'}
              loading="lazy"
              className="max-h-72 max-w-xs rounded-lg object-cover"
            />
          </a>
        );
      case 'video':
        return (
          <video controls className="max-w-48 rounded-lg">
            <source src={msg.fileUrl} />
            Your browser does not support video.
          </video>
        );
      case 'audio':
        return <audio controls src={msg.fileUrl} className="max-w-48" />;
      case 'file':
        return (
          <div className="flex items-center gap-3 rounded-xl bg-slate-50/90 border border-slate-200/50 p-3 min-w-55 max-w-xs ">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-semibold text-slate-800">
                {msg.fileName ?? 'document.pdf'}
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500">
                <span>Unknown Size</span>
                <span className="text-slate-300">•</span>
                <a
                  href={msg.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={msg.fileName}
                  className="font-bold text-primary hover:underline flex items-center gap-0.5"
                >
                  Download <Download className="h-2.5 w-2.5" />
                </a>
              </div>
            </div>
          </div>
        );
      default:
        return <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>;
    }
  };

  if (isLoading && visibleMessages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center space-y-3 p-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`flex w-full items-end gap-2 ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}
          >
            <div className="h-7 w-7 rounded-full bg-slate-200 animate-pulse shrink-0" />
            <div
              className={`rounded-2xl bg-slate-200 animate-pulse ${i % 2 === 0 ? 'h-10 w-40' : 'h-14 w-56'}`}
            />
          </div>
        ))}
      </div>
    );
  }

  // Wallpaper handling: presets are Tailwind class strings (e.g.
  // "bg-gradient-to-br from-sky-100 to-blue-100"). When `background` is falsy
  // we render the default dotted pattern via a small inline backgroundImage —
  // there's no Tailwind utility for radial-gradient dot grids.
  const isWallpaperClass = !!background && !background.startsWith('http');
  const isWallpaperUrl = !!background && background.startsWith('http');
  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`relative flex flex-1 flex-col overflow-y-auto px-4 py-4 space-y-0.5 ${isWallpaperClass ? background : ''}`}
      style={
        isWallpaperUrl
          ? {
            backgroundImage: `url(${background})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'local',
          }
          : !background
            ? {
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(1,120,215,0.03) 1px, transparent 0)',
              backgroundSize: '32px 32px',
            }
            : undefined
      }
    >
      {/* Load more indicator */}
      {hasMore && (
        <div className="flex justify-center py-2">
          {isLoading ? (
            <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          ) : (
            <button
              type="button"
              onClick={onLoadMore}
              className="rounded-full bg-white px-3 py-1 text-xs text-primary  "
            >
              Load older messages
            </button>
          )}
        </div>
      )}

      {visibleMessages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center my-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="flex max-w-sm flex-col items-center justify-center text-center"
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              className="relative mb-3 flex items-center justify-center bg-transparent"
            >
              <Image
                src="/images/chat/sidebar-empty-chat.png"
                alt="No messages yet illustration"
                width={180}
                height={180}
                priority
                className="h-36 w-36 object-contain bg-transparent"
              />
            </motion.div>
            <h3 className="text-base font-semibold text-slate-800">No messages yet</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-xs leading-relaxed">
              Send a message or share a document to start your conversation.
            </p>
          </motion.div>
        </div>
      ) : (
        visibleMessages.map((msg, idx) => {
          const isOwn = getSenderId(msg) === user?._id;
          const showDay =
            idx === 0 || !isSameDay(visibleMessages[idx - 1]!.createdAt, msg.createdAt);
          const showAvatar =
            !isOwn && (idx === 0 || getSenderId(visibleMessages[idx - 1]!) !== getSenderId(msg));
          // ── WhatsApp-style receipts ───────────────────────────────────────
          // - sent: only sender in readBy (gray single tick)
          // - delivered: another participant is online (server reached them)
          //   but they haven't opened the chat yet (gray double tick)
          // - read: every OTHER participant has read it (blue double tick)
          const readByIds = (msg.readBy ?? []).map(String);
          const otherParticipantIds = conversation.participants
            .map((p) => String(p._id))
            .filter((id) => id !== String(user?._id));
          const readByOthers = otherParticipantIds.filter((id) => readByIds.includes(id));
          const isRead =
            otherParticipantIds.length > 0 && readByOthers.length >= otherParticipantIds.length;
          // "Delivered" means either they read it, or they are online right now
          const isDelivered =
            isRead ||
            (otherParticipantIds.length > 0 &&
              otherParticipantIds.some((id) => onlineIds?.has(id) || readByIds.includes(id)));
          const replyMsg = findReplyMsg(msg.replyTo);

          return (
            <React.Fragment key={msg._id}>
              {/* Day separator */}
              {showDay && (
                <div className="my-3 flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="rounded-full bg-slate-100 px-3 py-0.5 text-[10px] font-medium text-slate-600">
                    {dayLabel(msg.createdAt)}
                  </span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
              )}

              {/* ── Call log — WhatsApp-style centered system card ────────── */}
              {msg.messageType === 'call_log' ? (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className="my-2 flex justify-center"
                >
                  {(() => {
                    const isMissedOrRejected =
                      msg.content?.toLowerCase().includes('missed') ||
                      msg.content?.toLowerCase().includes('declined') ||
                      msg.content?.toLowerCase().includes('rejected') ||
                      msg.content?.toLowerCase().includes('no answer');
                    const isVideo = msg.content?.includes('Video');

                    return (
                      <div
                        className={`flex items-center gap-2 rounded-full px-4 py-1.5  border ${isMissedOrRejected
                            ? 'border-red-200/60 bg-red-50/70 text-red-500'
                            : 'border-slate-200 bg-white/80 backdrop-blur-xs text-slate-500'
                          }`}
                      >
                        {isVideo ? (
                          <Video
                            className={`h-3.5 w-3.5 ${isMissedOrRejected ? 'text-red-500' : 'text-blue-500'}`}
                          />
                        ) : (
                          <Phone
                            className={`h-3.5 w-3.5 ${isMissedOrRejected ? 'text-red-500' : 'text-emerald-500'}`}
                          />
                        )}
                        <span className="text-[11px] font-semibold">{msg.content}</span>
                        <span
                          className={`text-[10px] ${isMissedOrRejected ? 'text-red-400' : 'text-slate-600'}`}
                        >
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                    );
                  })()}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className={`group relative flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''} mt-1`}
                  onMouseEnter={() => setHovered(msg._id)}
                  onMouseLeave={() => {
                    if (showReactionFor !== msg._id) {
                      setHovered(null);
                    }
                  }}
                >
                  {/* Avatar (others only) */}
                  {!isOwn && (
                    <div
                      className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${avatarColor(getSenderId(msg))} ${!showAvatar ? 'invisible' : ''}`}
                    >
                      {initials(getSenderName(msg))}
                    </div>
                  )}

                  {/* Bubble */}
                  <div
                    className={`relative max-w-xs md:max-w-sm lg:max-w-md ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}
                  >
                    {/* Sender name in group */}
                    {!isOwn && conversation.type === 'group' && showAvatar && (
                      <p className="mb-0.5 ml-1 text-[10px] font-semibold text-primary">
                        {getSenderName(msg)}
                      </p>
                    )}

                    {/* Reply quote */}
                    {replyMsg && (
                      <div
                        className={`mb-1 rounded-lg border-l-2 border-primary/50 bg-slate-100/80 px-2 py-1 text-xs text-slate-500 ${isOwn ? 'self-end' : 'self-start'}`}
                      >
                        <p className="font-semibold text-primary/70">{getSenderName(replyMsg)}</p>
                        <p className="truncate max-w-48">
                          {replyMsg.isDeleted ? '🚫 Deleted' : replyMsg.content.slice(0, 50)}
                        </p>
                      </div>
                    )}

                    <div
                      className={`relative rounded-2xl px-3 py-2 ${isOwn
                          ? 'rounded-br-sm bg-primary text-white'
                          : 'rounded-bl-sm bg-white text-slate-800 '
                        }`}
                    >
                      {renderMedia(msg)}

                      {/* Time + read receipt */}
                      <div
                        className={`mt-0.5 flex items-center gap-1 ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <span
                          className={`text-[10px] ${isOwn ? 'text-white/60' : 'text-slate-600'}`}
                        >
                          {formatTime(msg.createdAt)}
                        </span>
                        {isOwn &&
                          (isRead ? (
                            <CheckCheck className="h-3.5 w-3.5 text-sky-300" />
                          ) : isDelivered ? (
                            <CheckCheck className="h-3.5 w-3.5 text-white/70" />
                          ) : (
                            <Check className="h-3.5 w-3.5 text-white/70" />
                          ))}
                      </div>

                      {/* Reactions chip — WhatsApp-style: floats outside the
                        bubble at the bottom edge, anchored to the side facing
                        the conversation (right for own, left for others). */}
                      {msg.reactions.length > 0 && (
                        <div
                          className={`absolute -bottom-2.5 ${isOwn ? 'right-2' : 'left-2'} flex items-center gap-0.5 rounded-full border border-slate-100 bg-white px-1.5 py-0.5 `}
                        >
                          {Object.entries(
                            msg.reactions.reduce<Record<string, number>>((acc, r) => {
                              acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
                              return acc;
                            }, {}),
                          ).map(([emoji, count]) => (
                            <span key={emoji} className="text-[11px] leading-none text-slate-700">
                              {emoji}
                              {count > 1 ? (
                                <span className="ml-0.5 text-[10px] text-slate-500">{count}</span>
                              ) : null}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action toolbar (on hover) */}
                  <AnimatePresence>
                    {hovered === msg._id && !msg.isDeleted && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.1 }}
                        className={`flex items-center gap-0.5 rounded-xl bg-white px-1.5 py-1  ${isOwn ? 'mr-1' : 'ml-1'}`}
                      >
                        <button
                          type="button"
                          onClick={() => setShowReactionFor(msg._id)}
                          className="react-btn-trigger rounded p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-600"
                          title="React"
                        >
                          <Smile className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onReply(msg)}
                          className="rounded p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-600"
                          title="Reply"
                        >
                          <Reply className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(msg)}
                          className="rounded p-1 text-slate-600 hover:bg-red-50 hover:text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Quick reaction picker */}
                  <AnimatePresence>
                    {showReactionFor === msg._id && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className={`reaction-picker-container absolute bottom-10 ${isOwn ? 'right-0' : 'left-0'} z-20 flex items-center gap-1 rounded-2xl bg-white px-2 py-1.5 `}
                      >
                        {QUICK_REACTIONS.map((e) => (
                          <button
                            key={e}
                            type="button"
                            onClick={() => handleReact(msg, e)}
                            className="rounded-xl p-1 text-lg transition-transform hover:scale-125"
                          >
                            {e}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </React.Fragment>
          );
        })
      )}

      <div ref={bottomRef} />

      {/* Floating scroll-to-bottom (WhatsApp-style chevron with unread badge) */}
      <AnimatePresence>
        {!isAtBottom && (
          <motion.button
            type="button"
            onClick={scrollToBottom}
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 8 }}
            transition={{ duration: 0.15 }}
            className="sticky bottom-4 ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600  hover:text-primary"
            aria-label="Scroll to latest"
          >
            <ChevronDown className="h-5 w-5" />
            {unseenCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">
                {unseenCount > 99 ? '99+' : unseenCount}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

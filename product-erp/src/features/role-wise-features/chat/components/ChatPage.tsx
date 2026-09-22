/**
 * @file ChatPage.tsx
 * @description Main chat page — orchestrates socket connections, conversations, messages,
 * online users, typing indicators, unread counts, notifications.
 * @module features/role-wise-features/chat/components
 */
'use client';

import useMutation from '@/shared/hooks/useMutation';
import { useSocket } from '@/shared/hooks/useSocket';
import useSwr from '@/shared/hooks/useSwr';
import { useAuthStore } from '@/shared/store/authStore';
import { useCallStore } from '@/shared/store/callStore';
import { getFromLocalStorage, saveToLocalStorage } from '@/shared/utils';
import { ShieldCheck, Video } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { motion } from '@/shared/utils/motion';
import {
  IChatMessage,
  IConversation,
  ICreateGroupDto,
  IMessagesResponse,
  IStartDirectChatDto,
  TCallType,
} from '../types/chat.types';

function SidebarSkeleton() {
  return (
    <div className="h-full bg-white p-4">
      <div className="mb-5 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded-full bg-slate-200" />
          <div className="h-2.5 w-16 animate-pulse rounded-full bg-slate-100" />
        </div>
        <div className="h-8 w-8 animate-pulse rounded-lg bg-primary-50" />
      </div>
      <div className="mb-5 h-10 animate-pulse rounded-xl bg-slate-100" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div key={item} className="flex items-center gap-3 py-1">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-primary-50" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/5 animate-pulse rounded-full bg-slate-200" />
              <div className="h-2.5 w-3/5 animate-pulse rounded-full bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConversationSkeleton() {
  return (
    <div className="flex flex-1 flex-col justify-end gap-4 bg-white p-5">
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className={`h-12 animate-pulse rounded-2xl bg-slate-100 ${item % 2 === 0 ? 'ml-auto w-2/5 bg-primary-50' : 'w-1/2'}`}
        />
      ))}
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-100 bg-white px-4">
      <div className="h-10 w-10 animate-pulse rounded-full bg-primary-50" />
      <div className="space-y-2">
        <div className="h-3 w-32 animate-pulse rounded-full bg-slate-200" />
        <div className="h-2.5 w-20 animate-pulse rounded-full bg-slate-100" />
      </div>
      <div className="ml-auto flex gap-2">
        <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-100" />
      </div>
    </div>
  );
}

function InputSkeleton() {
  return (
    <div className="flex shrink-0 items-center gap-3 border-t border-slate-100 bg-white p-3">
      <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-100" />
      <div className="h-11 flex-1 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-10 w-10 animate-pulse rounded-xl bg-primary-50" />
    </div>
  );
}

function ModalSkeleton() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100/70 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
        <div className="h-5 w-40 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-6 space-y-4">
          <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-40 animate-pulse rounded-xl bg-primary-50" />
        </div>
      </div>
    </div>
  );
}

// Heavy components — dynamic imports with stable loading surfaces.
const ConversationList = dynamic(() => import('./ConversationList'), {
  ssr: false,
  loading: () => <SidebarSkeleton />,
});
const ChatHeader = dynamic(() => import('./ChatHeader'), {
  ssr: false,
  loading: () => <HeaderSkeleton />,
});
const MessagePanel = dynamic(() => import('./MessagePanel'), {
  ssr: false,
  loading: () => <ConversationSkeleton />,
});
const MessageInput = dynamic(() => import('./MessageInput'), {
  ssr: false,
  loading: () => <InputSkeleton />,
});
const CreateGroupModal = dynamic(() => import('./CreateGroupModal'), {
  ssr: false,
  loading: () => <ModalSkeleton />,
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { user, role, hasPermission } = useAuthStore();
  const { socket, isConnected } = useSocket();
  const { mutation } = useMutation();

  // ── Server data ────────────────────────────────────────────────────────────
  const { data: convRaw, mutate: mutateConvs, isLoading: convsLoading } = useSwr('chat');
  const { data: upcomingMeetingRaw, mutate: mutateUpcomingMeeting } = useSwr<{
    data?: { _id: string; title: string; scheduledAt: string; meetingLink?: string };
  }>('meeting/upcoming', {
    refreshInterval: 15000,
  });
  const upcomingMeeting = upcomingMeetingRaw?.data;
  const canUseChat = hasPermission('chat', 'view');
  const { data: onlineRaw } = useSwr('chat/online/users');
  const { data: pinnedRaw, mutate: mutatePinned } = useSwr('chat/pinned');
  const { data: mutedRaw, mutate: mutateMuted } = useSwr<{ data?: string[] }>('chat/muted');

  // Backend shapes:
  //   GET /chat              -> { success, data: IConversation[] }
  //   GET /chat/online/users -> { success, onlineUserIds: string[] }
  const conversations: IConversation[] = useMemo(
    () => (convRaw as { data?: IConversation[] } | null)?.data ?? [],
    [convRaw],
  );
  const initialOnline: string[] = useMemo(
    () => (onlineRaw as { onlineUserIds?: string[] } | null)?.onlineUserIds ?? [],
    [onlineRaw],
  );
  const pinnedIds: string[] = useMemo(
    () => (pinnedRaw as { data?: string[] } | null)?.data ?? [],
    [pinnedRaw],
  );
  const mutedIds: string[] = useMemo(
    () => mutedRaw?.data ?? [],
    [mutedRaw],
  );

  // ── Local state ────────────────────────────────────────────────────────────
  const [activeConv, setActiveConv] = useState<IConversation | null>(null);
  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [typingMap, setTypingMap] = useState<Record<string, string[]>>({}); // convId → userNames
  const [replyTo, setReplyTo] = useState<IChatMessage | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showList, setShowList] = useState(true); // for mobile toggle
  const { setCallState } = useCallStore();
  const [searchTerm, setSearchTerm] = useState('');

  // Per-user chat wallpaper, persisted via the shared localStorage helpers.
  // Empty string means "default pattern" (handled in MessagePanel).
  const [wallpaper, setWallpaper] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return getFromLocalStorage('chat:wallpaper') ?? '';
  });
  const handleChangeWallpaper = useCallback((url: string) => {
    setWallpaper(url);
    saveToLocalStorage('chat:wallpaper', url);
  }, []);

  const activeConvRef = useRef<IConversation | null>(null);

  const persistedUnreadMap = useMemo(
    () =>
      Object.fromEntries(
        conversations.map((conversation) => [conversation._id, conversation.unreadCount ?? 0]),
      ),
    [conversations],
  );
  const displayUnreadMap = useMemo(
    () => ({ ...persistedUnreadMap, ...unreadMap }),
    [persistedUnreadMap, unreadMap],
  );

  useEffect(() => {
    activeConvRef.current = activeConv;
  }, [activeConv]);

  // ── Auto-open conversation from `?conv=<id>` (deep link / notification) ────
  const searchParams = useSearchParams();
  const convQueryRef = useRef<string | null>(null);

  const [onlineDeltas, setOnlineDeltas] = useState<Record<string, boolean>>({});
  const onlineIds = useMemo(() => {
    const set = new Set(initialOnline);
    Object.entries(onlineDeltas).forEach(([userId, isOnline]) => {
      if (isOnline) set.add(userId);
      else set.delete(userId);
    });
    return set;
  }, [initialOnline, onlineDeltas]);

  useEffect(() => {
    if (!socket) return;
    const refreshUpcomingMeeting = () => mutateUpcomingMeeting();
    socket.on('meeting_status_changed', refreshUpcomingMeeting);
    return () => {
      socket.off('meeting_status_changed', refreshUpcomingMeeting);
    };
  }, [socket, mutateUpcomingMeeting]);

  // ── Fetch messages ─────────────────────────────────────────────────────────
  // Backend returns the conversation document with a `$slice`d `messages`
  // array already in chronological order (oldest → newest). We append to
  // `messages` directly — DO NOT reverse — so newest stays at the bottom
  // (WhatsApp-style).
  const fetchMessages = useCallback(
    async (convId: string, pg = 1, prepend = false) => {
      setMessagesLoading(true);
      try {
        const response = await mutation(`chat/${convId}/messages?page=${pg}&limit=50`, {
          method: 'GET',
          silentError: true,
        });
        const json = response?.results as
          | {
            success?: boolean;
            data?: IMessagesResponse & { totalMessages?: number };
          }
          | undefined;
        const msgs: IChatMessage[] = json?.data?.messages ?? [];
        const total: number =
          json?.data?.pagination?.total ?? json?.data?.totalMessages ?? msgs.length;
        if (prepend) {
          // Loading older page → prepend older messages above current view.
          setMessages((prev) => [...msgs, ...prev]);
        } else {
          // First load → newest 50, oldest at index 0, newest at the end.
          setMessages(msgs);
        }
        setHasMore(pg * 50 < total);
      } catch {
        toast.error('Failed to load messages');
      } finally {
        setMessagesLoading(false);
      }
    },
    [mutation],
  );

  // ── Select conversation ────────────────────────────────────────────────────
  const selectConversation = useCallback(
    async (conv: IConversation) => {
      const prev = activeConvRef.current;
      if (prev?._id === conv._id) return;

      // Leave previous room
      if (prev && socket) {
        socket.emit('leave_conversation', { conversationId: prev._id });
      }

      setActiveConv(conv);
      setMessages([]);
      setPage(1);
      setHasMore(false);
      setReplyTo(null);
      setShowList(false); // mobile: hide list
      setSearchTerm('');

      // Join new room
      if (socket) {
        socket.emit('join_conversation', { conversationId: conv._id });
      }

      // Mark read
      setUnreadMap((prev) => ({ ...prev, [conv._id]: 0 }));
      await mutation(`chat/${conv._id}/read`, { method: 'POST', isAlert: false }).catch(
        () => undefined,
      );

      // Fetch messages
      await fetchMessages(conv._id, 1, false);
    },
    [socket, mutation, fetchMessages],
  );

  useEffect(() => {
    const target = searchParams.get('conv');
    if (!target || conversations.length === 0) return;
    if (convQueryRef.current === target) return;
    const match = conversations.find((c) => c._id === target);
    if (!match) return;
    convQueryRef.current = target;
    selectConversation(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, conversations]);

  // ── Load more (older) messages ─────────────────────────────────────────────
  const handleLoadMore = useCallback(async () => {
    if (!activeConv || !hasMore || messagesLoading) return;
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchMessages(activeConv._id, nextPage, true);
  }, [activeConv, hasMore, messagesLoading, page, fetchMessages]);

  // ── Socket listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onNewMessage = (payload: { conversationId: string; message: IChatMessage }) => {
      const { conversationId, message } = payload;
      if (activeConvRef.current?._id === conversationId) {
        setMessages((prev) => [...prev, message]);
        // Mark read automatically since window is open
        mutation(`chat/${conversationId}/read`, { method: 'POST', isAlert: false }).catch(
          () => undefined,
        );
      } else {
        setUnreadMap((prev) => ({
          ...prev,
          [conversationId]: (prev[conversationId] ?? persistedUnreadMap[conversationId] ?? 0) + 1,
        }));
      }
      // Update lastMessage on conversations list
      mutateConvs();
    };

    const onTyping = (payload: {
      conversationId: string;
      userId: string;
      userName: string;
      isTyping: boolean;
    }) => {
      setTypingMap((prev) => {
        const current = prev[payload.conversationId] ?? [];
        if (payload.isTyping) {
          return {
            ...prev,
            [payload.conversationId]: [...new Set([...current, payload.userName])],
          };
        } else {
          return {
            ...prev,
            [payload.conversationId]: current.filter((n) => n !== payload.userName),
          };
        }
      });
    };

    const onUserOnline = (payload: { userId: string }) => {
      setOnlineDeltas((prev) => ({ ...prev, [payload.userId]: true }));
    };

    const onUserOffline = (payload: { userId: string }) => {
      setOnlineDeltas((prev) => ({ ...prev, [payload.userId]: false }));
    };

    const onNotificationPush = () => {
      // Chat-related notifications are handled inline (active conv updates,
      // unread badges, conversation list refresh). Do NOT show a toast while
      // the user is on the chat page — Header suppresses them too.
    };

    const onMessageReaction = () => {
      // Refresh messages to show updated reactions
      if (activeConvRef.current) fetchMessages(activeConvRef.current._id, 1, false);
    };

    const onCallEndedMessageRefresh = () => {
      if (activeConvRef.current) {
        setTimeout(() => fetchMessages(activeConvRef.current!._id, 1, false), 800);
      }
    };

    const onCallRejectedMessageRefresh = () => {
      if (activeConvRef.current) {
        setTimeout(() => fetchMessages(activeConvRef.current!._id, 1, false), 800);
      }
    };

    socket.on('new_message', onNewMessage);
    socket.on('typing', onTyping);
    socket.on('user_online', onUserOnline);
    socket.on('user_offline', onUserOffline);
    socket.on('notification_push', onNotificationPush);
    socket.on('message_reaction', onMessageReaction);
    socket.on('call_rejected', onCallRejectedMessageRefresh);
    socket.on('call_ended', onCallEndedMessageRefresh);

    return () => {
      socket.off('new_message', onNewMessage);
      socket.off('typing', onTyping);
      socket.off('user_online', onUserOnline);
      socket.off('user_offline', onUserOffline);
      socket.off('notification_push', onNotificationPush);
      socket.off('message_reaction', onMessageReaction);
      socket.off('call_rejected', onCallRejectedMessageRefresh);
      socket.off('call_ended', onCallEndedMessageRefresh);
    };
  }, [socket, mutateConvs, fetchMessages, mutation, persistedUnreadMap]);

  // ── Join active conversation on socket reconnect ───────────────────────────
  const activeConvId = activeConv?._id;
  useEffect(() => {
    if (isConnected && activeConvId && socket) {
      socket.emit('join_conversation', { conversationId: activeConvId });
    }
  }, [isConnected, activeConvId, socket]);

  // ── Start direct chat ──────────────────────────────────────────────────────
  const handleStartDirect = useCallback(
    async (userId: string) => {
      const payload: IStartDirectChatDto = { userId };
      const res = await mutation('chat/direct', { method: 'POST', body: payload, isAlert: true });
      const conv = (res as { results?: { data?: IConversation } } | undefined)?.results?.data;
      if (conv?._id) {
        await mutateConvs();
        selectConversation(conv);
      } else toast.error('Failed to start chat');
    },
    [mutation, mutateConvs, selectConversation],
  );

  // ── Create group ───────────────────────────────────────────────────────────
  const handleCreateGroup = useCallback(
    async (data: ICreateGroupDto) => {
      const res = await mutation('chat/group', { method: 'POST', body: data, isAlert: true });
      const conv = (res as { results?: { data?: IConversation } } | undefined)?.results?.data;
      if (conv?._id) {
        toast.success('Group created!');
        setShowCreateGroup(false);
        await mutateConvs();
        selectConversation(conv);
      } else toast.error('Failed to create group');
    },
    [mutation, mutateConvs, selectConversation],
  );

  // ── Call Actions ───────────────────────────────────────────────────────────
  const handleStartCall = useCallback(
    (type: TCallType) => {
      if (!activeConvRef.current || !socket) return;
      const conv = activeConvRef.current;
      const isGroup = conv.type === 'group';

      if (isGroup) {
        setCallState({
          isActive: true,
          isIncoming: false,
          targetUserId: conv._id,
          callerName: conv.groupName ?? 'Group Call',
          callerAvatar: conv.groupAvatar,
          type,
          conversationId: conv._id,
        });
        socket.emit('call_user', {
          targetUserId: conv._id,
          type,
          conversationId: conv._id,
          isGroup: true,
        });
        return;
      }

      const otherUser = conv.participants.find((p) => p._id !== user?._id);
      if (!otherUser) return;
      if (!onlineIds.has(otherUser._id)) {
        Swal.fire({
          title: 'User Offline',
          text: `${otherUser.name} is currently offline. You can only call online users.`,
          icon: 'warning',
          confirmButtonColor: '#0178D7',
          confirmButtonText: 'OK',
        });
        return;
      }

      setCallState({
        isActive: false,
        isIncoming: false,
        targetUserId: otherUser._id,
        callerName: otherUser.name,
        callerAvatar: otherUser.avatar,
        type,
        conversationId: conv._id,
      });
      socket.emit('call_user', {
        targetUserId: otherUser._id,
        type,
        conversationId: conv._id,
      });
    },
    [socket, user, onlineIds, setCallState],
  );

  const handleTogglePin = useCallback(
    async (convId: string) => {
      await mutation(`chat/${convId}/pin`, { method: 'POST', isAlert: true });
      mutatePinned();
    },
    [mutation, mutatePinned],
  );

  // ── Send message via API (fallback / file upload) ──────────────────────────
  const handleSendViaApi = useCallback(
    async (
      content: string,
      messageType = 'text',
      fileUrl?: string,
      fileName?: string,
      replyToId?: string,
    ) => {
      if (!activeConv) return;
      const res = await mutation(`chat/${activeConv._id}/messages`, {
        method: 'POST',
        body: { content, messageType, fileUrl, fileName, replyTo: replyToId },
        isAlert: true,
      });
      const msg = (res as { results?: { data?: { message?: IChatMessage } } })?.results?.data
        ?.message;
      if (msg) setMessages((prev) => [...prev, msg]);
      else toast.error('Failed to send message');
    },
    [activeConv, mutation],
  );

  // ── Other user online? ─────────────────────────────────────────────────────
  const isOtherOnline = useCallback((): boolean => {
    if (!activeConv || activeConv.type !== 'direct') return false;
    const other = activeConv.participants.find((p) => p._id !== user?._id);
    return other ? onlineIds.has(other._id) : false;
  }, [activeConv, user, onlineIds]);

  return (
    <div className="flex h-[calc(100dvh-135px)] overflow-hidden bg-slate-50">
      {/* ── Left sidebar ──────────────────────────────────────────────────── */}
      <div
        className={`${showList ? 'flex' : 'hidden lg:flex'} w-full shrink-0 flex-col bg-white lg:w-80 xl:w-96`}
      >
        <ConversationList
          conversations={conversations}
          activeId={activeConv?._id ?? null}
          onlineIds={onlineIds}
          isLoading={convsLoading}
          onSelect={selectConversation}
          onStartDirect={canUseChat ? handleStartDirect : undefined}
          onCreateGroup={canUseChat ? () => setShowCreateGroup(true) : undefined}
          unreadMap={displayUnreadMap}
          typingMap={typingMap}
          pinnedIds={pinnedIds}
          mutedIds={mutedIds}
          onTogglePin={handleTogglePin}
        />
      </div>

      {/* ── Right panel ───────────────────────────────────────────────────── */}
      <div
        className={`${!showList ? 'flex' : 'hidden lg:flex'} relative flex-1 flex-col overflow-hidden`}
      >
        {upcomingMeeting && (
          <div className="flex items-center justify-between bg-primary-50 border-b border-primary-100/60 px-4 py-2.5 text-primary shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Video className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-xs font-semibold truncate">
                Upcoming Meeting: {upcomingMeeting.title}
              </span>
            </div>
            <Link
              href={
                upcomingMeeting.meetingLink?.startsWith('/meeting/room/')
                  ? `/${role}${upcomingMeeting.meetingLink}`
                  : upcomingMeeting.meetingLink || `/${role}/meeting/room/${upcomingMeeting._id}`
              }
              className="cursor-pointer bg-primary text-white text-[11px] font-semibold px-3 py-1 rounded-lg hover:bg-primary-600 transition-colors shrink-0"
            >
              Join
            </Link>
          </div>
        )}
        {activeConv ? (
          <>
            <ChatHeader
              conversation={activeConv}
              typingUsers={typingMap[activeConv._id] ?? []}
              isOnline={isOtherOnline()}
              onClose={() => {
                setActiveConv(null);
                setShowList(true);
                setSearchTerm('');
              }}
              onMutate={() => {
                mutateConvs();
                mutateMuted();
              }}
              wallpaper={wallpaper}
              onChangeWallpaper={handleChangeWallpaper}
              onStartCall={handleStartCall}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
            />
            <MessagePanel
              conversation={activeConv}
              messages={messages}
              isLoading={messagesLoading}
              hasMore={hasMore}
              onLoadMore={handleLoadMore}
              onReply={setReplyTo}
              onMutate={() => fetchMessages(activeConv._id, 1, false)}
              background={wallpaper || null}
              searchTerm={searchTerm}
            />
            <MessageInput
              conversationId={activeConv._id}
              socket={socket}
              replyTo={replyTo}
              onClearReply={() => setReplyTo(null)}
              onSendViaApi={handleSendViaApi}
              disabled={!canUseChat}
            />
          </>
        ) : (
          <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-white p-6 md:p-10">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="flex w-full max-w-lg flex-col items-center justify-center text-center my-auto"
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                className="relative mb-5 flex w-full max-w-105 items-center justify-center"
              >
                <Image
                  src="/images/chat/campus-chat-workspace.png"
                  alt="Students and staff collaborating through secure campus chat"
                  width={640}
                  height={480}
                  priority
                  className="h-auto max-h-85 w-auto object-contain"
                />
              </motion.div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                Institution-only conversations
              </div>
              <h2 className="text-xl font-semibold text-slate-900">Your collaboration workspace</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                Select a conversation to message colleagues and students, share documents, or begin
                a secure voice or video call.
              </p>
            </motion.div>
          </div>
        )}
      </div>

      {/* ── Create group modal ─────────────────────────────────────────────── */}
      {showCreateGroup && (
        <CreateGroupModal onClose={() => setShowCreateGroup(false)} onCreate={handleCreateGroup} />
      )}
    </div>
  );
}

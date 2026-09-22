/**
 * @file ConversationList.tsx
 * @description Left panel — conversations + role-aware contacts directory.
 *   Search filters local conversations AND queries the user directory remotely.
 * @module features/role-wise-features/chat/components
 */
'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Search, Users, MessageCircle, X, Pin, GraduationCap, Filter, BellOff } from 'lucide-react';
import { useAuthStore } from '@/shared/store/authStore';
import useSwr from '@/shared/hooks/useSwr';
import AsyncSelect from '@/shared/core/AsyncSelect';
import { motion } from '@/shared/utils/motion';
import {
  IConversation,
  IChatUser,
  IContactsResponse,
  IUserSearchResponse,
} from '../types/chat.types';

interface Props {
  conversations: IConversation[];
  activeId: string | null;
  onlineIds: Set<string>;
  isLoading: boolean;
  onSelect: (conv: IConversation) => void;
  onStartDirect?: (userId: string) => void;
  onCreateGroup?: () => void;
  unreadMap: Record<string, number>;
  /** convId → list of user-names currently typing (excluding me). */
  typingMap?: Record<string, string[]>;
  pinnedIds?: string[];
  mutedIds?: string[];
  onTogglePin?: (id: string) => void;
}

type TDirectoryView = 'chats' | 'faculty' | 'students';

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

function formatRole(role?: string) {
  if (!role) return '';
  return role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 604_800_000) return d.toLocaleDateString('en-IN', { weekday: 'short' });
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function UserRow({
  user,
  isOnline,
  onClick,
}: {
  user: IChatUser;
  isOnline: boolean;
  onClick: () => void;
}) {
  const tag = user.tag || formatRole(user.role);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
    >
      <div className="relative shrink-0">
        {user.avatar ? (
          <Image
            src={user.avatar}
            alt={user.name}
            width={38}
            height={38}
            className="h-9.5 w-9.5 rounded-full object-cover"
          />
        ) : (
          <div
            className={`flex h-9.5 w-9.5 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(user._id)}`}
          >
            {initials(user.name)}
          </div>
        )}
        {isOnline && (
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-400" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <span className="truncate text-sm font-semibold text-slate-800">{user.name}</span>
        {tag && (
          <span className="mt-0.5 inline-flex max-w-full items-center self-start rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            <span className="truncate">{tag}</span>
          </span>
        )}
      </div>
    </button>
  );
}

export default function ConversationList({
  conversations,
  activeId,
  onlineIds,
  isLoading,
  onSelect,
  onStartDirect,
  onCreateGroup,
  unreadMap,
  typingMap,
  pinnedIds = [],
  mutedIds = [],
  onTogglePin,
}: Props) {
  const { user, role } = useAuthStore();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [directoryView, setDirectoryView] = useState<TDirectoryView>('chats');
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [program, setProgram] = useState<string | null>(null);
  const [academicYear, setAcademicYear] = useState<string | null>(null);
  const [showStudentFilters, setShowStudentFilters] = useState(false);
  const canBrowseStudents = [
    'super_admin',
    'admin',
    'principal',
    'dean_academic',
    'administration_office',
    'assistant_administration_officer',
    'hod',
    'faculty',
  ].includes(role ?? '');
  const canFilterAcrossDepartments = [
    'super_admin',
    'admin',
    'principal',
    'dean_academic',
    'administration_office',
    'assistant_administration_officer',
  ].includes(role ?? '');
  const requiresStudentFilter =
    directoryView === 'students' &&
    canFilterAcrossDepartments &&
    !departmentId &&
    !program &&
    !academicYear;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const contactsPath = useMemo(() => {
    if (!onStartDirect) return null;
    if (directoryView === 'chats') return null;
    if (requiresStudentFilter) return null;
    const params = new URLSearchParams({ contactType: directoryView });
    if (departmentId) params.set('departmentId', departmentId);
    if (program) params.set('program', program);
    if (academicYear) params.set('academicYear', academicYear);
    return `chat/contacts?${params.toString()}`;
  }, [onStartDirect, directoryView, departmentId, program, academicYear, requiresStudentFilter]);

  const { data: contactsRaw, isLoading: contactsLoading } = useSwr<{
    data?: IContactsResponse;
  }>(contactsPath);
  const contactSections = useMemo(() => contactsRaw?.data?.sections ?? [], [contactsRaw]);

  // Flat, deduped list of every contact (no group headers — chips show context).
  const flatContacts = useMemo(() => {
    const out: IChatUser[] = [];
    const seen = new Set<string>();
    contactSections.forEach((s) =>
      s.users.forEach((u) => {
        if (!seen.has(u._id)) {
          seen.add(u._id);
          out.push(u);
        }
      }),
    );
    return out;
  }, [contactSections]);

  // Lookup userId → tag, so conversation rows can also show the contact chip.
  const tagByUserId = useMemo(() => {
    const map: Record<string, string> = {};
    flatContacts.forEach((u) => {
      if (u.tag) map[u._id] = u.tag;
    });
    return map;
  }, [flatContacts]);

  const shouldSearchRemote =
    Boolean(onStartDirect) && directoryView === 'chats' && debouncedSearch.length >= 2;
  const { data: searchRaw, isValidating: searchLoading } = useSwr<{
    data?: IUserSearchResponse;
  }>(
    shouldSearchRemote
      ? `chat/users/search?q=${encodeURIComponent(debouncedSearch)}&limit=20`
      : null,
  );
  const searchedUsers = useMemo(() => searchRaw?.data?.users ?? [], [searchRaw]);

  const filteredConversations = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const name =
        c.type === 'group'
          ? (c.groupName ?? '').toLowerCase()
          : (c.participants.find((p) => p._id !== user?._id)?.name?.toLowerCase() ?? '');
      return name.includes(q) || (c.lastMessage ?? '').toLowerCase().includes(q);
    });
  }, [conversations, debouncedSearch, user]);

  const filteredDirectoryContacts = useMemo(() => {
    const query = debouncedSearch.toLowerCase();
    if (!query) return flatContacts;
    return flatContacts.filter((contact) =>
      [contact.name, contact.email, contact.tag]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [flatContacts, debouncedSearch]);

  const conversationParticipantIds = useMemo(() => {
    const ids = new Set<string>();
    conversations.forEach((c) => {
      if (c.type === 'direct') {
        c.participants.forEach((p) => {
          if (p._id !== user?._id) ids.add(p._id);
        });
      }
    });
    return ids;
  }, [conversations, user]);

  const newPeople = useMemo(
    () => searchedUsers.filter((u) => !conversationParticipantIds.has(u._id)),
    [searchedUsers, conversationParticipantIds],
  );

  const getDisplayName = useCallback(
    (c: IConversation) => {
      if (c.type === 'group') return c.groupName ?? 'Group';
      const other = c.participants.find((p) => p._id !== user?._id);
      return other?.name ?? 'Unknown';
    },
    [user],
  );

  const getOtherUser = useCallback(
    (c: IConversation): IChatUser | null => {
      if (c.type === 'group') return null;
      return c.participants.find((p) => p._id !== user?._id) ?? null;
    },
    [user],
  );

  const isConvOnline = useCallback(
    (c: IConversation): boolean => {
      if (c.type === 'group') return false;
      const other = getOtherUser(c);
      return other ? onlineIds.has(other._id) : false;
    },
    [getOtherUser, onlineIds],
  );

  const isSearching = debouncedSearch.length > 0;
  const showEmpty =
    !isLoading &&
    !contactsLoading &&
    (directoryView === 'chats'
      ? filteredConversations.length === 0 &&
      (!isSearching || (newPeople.length === 0 && !searchLoading))
      : filteredDirectoryContacts.length === 0);

  // Contacts that aren't already in an existing direct conversation.
  const availableContacts = useMemo(
    () => flatContacts.filter((u) => !conversationParticipantIds.has(u._id)),
    [flatContacts, conversationParticipantIds],
  );

  const renderConvRow = (conv: IConversation, isPinned: boolean) => {
    const name = getDisplayName(conv);
    const other = getOtherUser(conv);
    const online = isConvOnline(conv);
    const unread = unreadMap[conv._id] ?? 0;
    const isActive = activeId === conv._id;
    const avatarId = other?._id ?? conv._id;

    return (
      <div
        key={conv._id}
        className={`group flex w-full items-center justify-between transition-colors hover:bg-slate-50 ${isActive ? 'bg-primary-50' : ''}`}
      >
        <button
          type="button"
          onClick={() => onSelect(conv)}
          className="flex-1 flex items-center gap-3 px-4 py-3 text-left min-w-0"
        >
          <div className="relative shrink-0">
            {other?.avatar ? (
              <Image
                src={other.avatar}
                alt={name}
                width={40}
                height={40}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(avatarId)}`}
              >
                {conv.type === 'group' ? <Users className="h-4 w-4" /> : initials(name)}
              </div>
            )}
            {online && (
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-400" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`truncate text-sm ${unread > 0 ? 'font-bold text-slate-900' : 'font-semibold'} ${isActive ? 'text-primary' : unread > 0 ? 'text-slate-900' : 'text-slate-800'}`}
                >
                  {name}
                </span>
                {conv.type === 'direct' && other && tagByUserId[other._id] && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    {tagByUserId[other._id]}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {mutedIds.includes(conv._id) && (
                  <BellOff className="h-3 w-3 text-slate-400" />
                )}
                <span
                  className={`text-[10px] ${unread > 0 ? 'font-semibold text-emerald-500' : 'text-slate-600'}`}
                >
                  {conv.lastMessageAt ? relativeTime(conv.lastMessageAt) : ''}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              {(() => {
                const typers = typingMap?.[conv._id] ?? [];
                if (typers.length > 0) {
                  const label =
                    conv.type === 'group'
                      ? `${typers[0]}${typers.length > 1 ? ` +${typers.length - 1}` : ''} typing…`
                      : 'typing…';
                  return (
                    <p className="truncate text-xs font-medium italic text-emerald-500">{label}</p>
                  );
                }
                return (
                  <p
                    className={`truncate text-xs ${unread > 0 ? 'font-semibold text-slate-700' : 'text-slate-600'}`}
                  >
                    {conv.lastMessage ?? 'No messages yet'}
                  </p>
                );
              })()}
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <span className="ml-2 shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </div>
            </div>
          </div>
        </button>

        {onTogglePin && (
          <button
            type="button"
            onClick={() => onTogglePin(conv._id)}
            className={`mr-4 p-1.5 rounded-lg transition-colors hover:bg-slate-200/50 ${isPinned ? 'text-primary' : 'text-slate-300 opacity-0 group-hover:opacity-100'
              }`}
            title={isPinned ? 'Unpin Chat' : 'Pin Chat'}
          >
            <Pin className={`h-3.5 w-3.5 ${isPinned ? 'fill-primary' : ''}`} />
          </button>
        )}
      </div>
    );
  };

  const onlineContacts = flatContacts.filter((c) => onlineIds.has(c._id));
  const pinnedConvs = filteredConversations.filter((c) => pinnedIds.includes(c._id));
  const recentConvs = filteredConversations.filter((c) => !pinnedIds.includes(c._id));

  return (
    <div className="flex h-full flex-col">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">All Chats</h2>
          <p className="text-[10px] text-slate-600">{conversations.length} conversations</p>
        </div>
        {onCreateGroup && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCreateGroup}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-primary"
              title="New group"
            >
              <Users className="h-4.5 w-4.5" />
            </button>
          </div>
        )}
      </div>

      {onStartDirect && (
        <div className="border-b border-slate-100 px-3 py-2">
          <div
            className={`grid gap-1 rounded-xl bg-slate-100 p-1 ${canBrowseStudents ? 'grid-cols-3' : 'grid-cols-2'}`}
          >
            {[
              { value: 'chats', label: 'Chats', icon: MessageCircle },
              { value: 'faculty', label: 'Faculty', icon: Users },
              ...(canBrowseStudents
                ? ([{ value: 'students', label: 'Students', icon: GraduationCap }] as const)
                : []),
            ].map((item) => {
              const Icon = item.icon;
              const active = directoryView === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setDirectoryView(item.value as TDirectoryView);
                    setSearch('');
                  }}
                  className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${active ? 'bg-white text-primary' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="border-b border-slate-100 px-4 py-2">
        <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-slate-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              directoryView === 'chats'
                ? 'Search conversations…'
                : directoryView === 'faculty'
                  ? 'Search faculty…'
                  : 'Search students…'
            }
            className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')}>
              <X className="h-3.5 w-3.5 text-slate-600" />
            </button>
          )}
          {directoryView === 'students' && (
            <button
              type="button"
              onClick={() => setShowStudentFilters((prev) => !prev)}
              className={`relative ml-0.5 rounded-md p-1 transition-colors ${
                showStudentFilters || academicYear || program || departmentId
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-slate-500 hover:bg-slate-200/70 hover:text-slate-800'
              }`}
              title={showStudentFilters ? 'Hide filters' : 'Show hierarchical filters'}
            >
              <Filter className="h-3.5 w-3.5" />
              {(academicYear || program || departmentId) && !showStudentFilters && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
              )}
            </button>
          )}
        </div>
      </div>

      {directoryView === 'students' && showStudentFilters && (
        <div className="space-y-2 border-b border-slate-100 bg-slate-50 px-3 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700">Hierarchy Filters</span>
            {(academicYear || program || departmentId) && (
              <button
                type="button"
                onClick={() => {
                  setAcademicYear(null);
                  setProgram(null);
                  setDepartmentId(null);
                }}
                className="text-[10px] font-semibold text-primary hover:underline"
              >
                Reset
              </button>
            )}
          </div>

          <div>
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              1. Session / Academic Year
            </span>
            <AsyncSelect
              type="academicYears"
              value={academicYear}
              onChange={(val) => {
                setAcademicYear(val);
                setProgram(null);
                setDepartmentId(null);
              }}
              placeholder="Select session…"
              limit={50}
            />
          </div>

          <div>
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              2. Program
            </span>
            <AsyncSelect
              type="programs"
              value={program}
              onChange={(val) => {
                setProgram(val);
                setDepartmentId(null);
              }}
              params={academicYear ? { academicYear } : undefined}
              placeholder={academicYear ? 'Select program…' : 'Select session first'}
              disabled={!academicYear}
              limit={100}
            />
          </div>

          {canFilterAcrossDepartments && (
            <div>
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                3. Department
              </span>
              <AsyncSelect
                type="departments"
                value={departmentId}
                onChange={setDepartmentId}
                params={
                  program || academicYear
                    ? {
                        ...(program ? { program } : {}),
                        ...(academicYear ? { academicYear } : {}),
                      }
                    : undefined
                }
                placeholder={program ? 'Select department…' : 'Select program first'}
                disabled={!program}
                limit={100}
              />
            </div>
          )}
        </div>
      )}

      {/* Scrollable list content */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Horizontal Online List */}
        {directoryView === 'chats' &&
          onStartDirect &&
          !isSearching &&
          onlineContacts.length > 0 && (
            <div className="px-4 py-3 border-b border-slate-100 shrink-0">
              <div className="mb-2 flex items-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
                  Online Now
                </p>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
                {onlineContacts.slice(0, 15).map((c) => (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => onStartDirect?.(c._id)}
                    disabled={!onStartDirect}
                    className="flex flex-col items-center gap-1.5 min-w-14 text-center shrink-0"
                  >
                    <div className="relative">
                      {c.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.avatar}
                          alt={c.name}
                          className="h-10 w-10 rounded-full object-cover border border-slate-100"
                        />
                      ) : (
                        <div
                          className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold text-white ${avatarColor(c._id)}`}
                        >
                          {initials(c.name)}
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-400" />
                    </div>
                    <span className="text-[10px] font-medium text-slate-600 truncate w-14">
                      {c.name.split(' ')[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

        {directoryView === 'chats' &&
          (isLoading ? (
            <div className="space-y-1 p-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl p-3">
                  <div className="h-10 w-10 rounded-full bg-slate-200 animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 rounded bg-slate-200 animate-pulse" />
                    <div className="h-2.5 w-48 rounded bg-slate-100 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Pinned Chats */}
              {pinnedConvs.length > 0 && (
                <div className="py-2 border-b border-slate-100">
                  <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                    Pinned Chat
                  </p>
                  {pinnedConvs.map((c) => renderConvRow(c, true))}
                </div>
              )}

              {/* Recent Chats */}
              {recentConvs.length > 0 && (
                <div className="py-2">
                  {!isSearching && pinnedConvs.length > 0 && (
                    <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                      Recent Chat
                    </p>
                  )}
                  {recentConvs.map((c) => renderConvRow(c, false))}
                </div>
              )}
            </>
          ))}

        {onStartDirect && contactsLoading && !isLoading && (
          <div className="border-t border-slate-100 px-4 py-3">
            <div className="mb-3 h-2.5 w-32 animate-pulse rounded-full bg-slate-200" />
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-primary-50" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/5 animate-pulse rounded-full bg-slate-200" />
                    <div className="h-2.5 w-1/3 animate-pulse rounded-full bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {directoryView === 'chats' && onStartDirect && isSearching && (
          <div className="py-1">
            <p className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wide text-slate-600">
              People
            </p>
            {searchLoading && newPeople.length === 0 ? (
              <div className="space-y-1 px-4 py-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5">
                    <div className="h-9 w-9 animate-pulse rounded-full bg-slate-200" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
                      <div className="h-2.5 w-20 animate-pulse rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : newPeople.length > 0 ? (
              newPeople.map((u) => (
                <UserRow
                  key={u._id}
                  user={u}
                  isOnline={onlineIds.has(u._id)}
                  onClick={() => onStartDirect?.(u._id)}
                />
              ))
            ) : (
              <p className="px-4 py-3 text-xs text-slate-600">No matching people found.</p>
            )}
          </div>
        )}

        {directoryView !== 'chats' && !contactsLoading && filteredDirectoryContacts.length > 0 && (
          <div className="border-t border-slate-100 py-1">
            <div className="px-4 pb-1 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
                {directoryView === 'faculty' ? 'Faculty directory' : 'Student directory'}
                <span className="ml-1 normal-case tracking-normal text-slate-300">
                  ({filteredDirectoryContacts.length})
                </span>
              </p>
            </div>
            <div>
              {filteredDirectoryContacts.map((u) => (
                <UserRow
                  key={u._id}
                  user={u}
                  isOnline={onlineIds.has(u._id)}
                  onClick={() => onStartDirect?.(u._id)}
                />
              ))}
            </div>
          </div>
        )}

        {showEmpty && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-1 flex-col items-center justify-center px-5 py-8 text-center"
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="relative mb-3 flex items-center justify-center"
            >
              <div className="relative w-36 h-36 flex items-center justify-center">
                <Image
                  src="/images/chat/sidebar-empty-chat.png"
                  alt="No chats or messages found"
                  width={144}
                  height={144}
                  className="h-full w-full object-contain"
                />
              </div>
            </motion.div>
            <p className="text-sm font-semibold text-slate-700">
              {requiresStudentFilter
                ? 'Select Session and Program to load students'
                : isSearching
                  ? 'No matches found'
                  : directoryView === 'chats'
                    ? 'No conversations yet'
                    : `No ${directoryView} found`}
            </p>
            {directoryView === 'students' && requiresStudentFilter && (
              <div className="mt-2 flex flex-col items-center gap-1.5">
                <p className="text-xs leading-5 text-slate-400">
                  Click the filter icon or button below to choose session and program.
                </p>
                <button
                  type="button"
                  onClick={() => setShowStudentFilters(true)}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                >
                  <Filter className="h-3.5 w-3.5" />
                  Open Filters
                </button>
              </div>
            )}
            {directoryView === 'chats' && !isSearching && availableContacts.length === 0 && (
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Start with Faculty or Students to find an authorized contact.
              </p>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

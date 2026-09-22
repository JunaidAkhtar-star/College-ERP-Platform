/**
 * @file CreateGroupModal.tsx
 * @description Modal for creating a new group chat — multi-select user picker
 *   sourced from /chat/contacts (suggested) and /chat/users/search (free text).
 * @module features/role-wise-features/chat/components
 */
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Check, Search, Users, X } from 'lucide-react';
import CustomButton from '@/shared/core/CustomButton';
import useSwr from '@/shared/hooks/useSwr';
import {
  IChatUser,
  IContactsResponse,
  ICreateGroupDto,
  IUserSearchResponse,
} from '../types/chat.types';

interface Props {
  onClose: () => void;
  onCreate: (data: ICreateGroupDto) => Promise<void>;
}

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

const schema = Yup.object({
  name: Yup.string().trim().required('Group name is required').min(2, 'Min 2 characters'),
  description: Yup.string().trim(),
});

export default function CreateGroupModal({ onClose, onCreate }: Props) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, IChatUser>>({});

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const { data: contactsRaw } = useSwr<{ data?: IContactsResponse }>('chat/contacts');
  const contactSections = useMemo(() => contactsRaw?.data?.sections ?? [], [contactsRaw]);

  const shouldSearchRemote = debouncedSearch.length >= 2;
  const { data: searchRaw, isValidating: searchLoading } = useSwr<{
    data?: IUserSearchResponse;
  }>(
    shouldSearchRemote
      ? `chat/users/search?q=${encodeURIComponent(debouncedSearch)}&limit=30`
      : null,
  );
  const searchedUsers = useMemo(() => searchRaw?.data?.users ?? [], [searchRaw]);

  const visibleSections = useMemo(() => {
    if (shouldSearchRemote) {
      return [{ label: 'Search Results', users: searchedUsers }];
    }
    return contactSections;
  }, [shouldSearchRemote, searchedUsers, contactSections]);

  const formik = useFormik({
    initialValues: { name: '', description: '' },
    validationSchema: schema,
    onSubmit: async (values) => {
      const ids = Object.keys(selected);
      if (!ids.length) {
        formik.setFieldError('name', 'Pick at least one participant');
        return;
      }
      await onCreate({
        name: values.name,
        description: values.description,
        participantIds: ids,
      });
    },
  });

  const toggleUser = (u: IChatUser) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (next[u._id]) delete next[u._id];
      else next[u._id] = u;
      return next;
    });

  const selectedList = Object.values(selected);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-50">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <h2 className="font-bold text-slate-800">Create Group</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <form onSubmit={formik.handleSubmit} className="flex min-h-0 flex-1 flex-col">
          {/* Group details */}
          <div className="shrink-0 space-y-3 border-b border-slate-100 px-5 py-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Group Name *</label>
              <input
                {...formik.getFieldProps('name')}
                placeholder="e.g. CS4A Students"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
              {formik.touched.name && formik.errors.name && (
                <p className="mt-1 text-xs text-red-500">{formik.errors.name}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
              <input
                {...formik.getFieldProps('description')}
                placeholder="Optional"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Selected chips */}
          {selectedList.length > 0 && (
            <div className="shrink-0 border-b border-slate-100 px-5 py-2">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                Selected ({selectedList.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedList.map((u) => (
                  <span
                    key={u._id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 py-1 pl-2 pr-1 text-xs text-primary"
                  >
                    {u.name}
                    <button
                      type="button"
                      onClick={() => toggleUser(u)}
                      className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-primary/15"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="shrink-0 border-b border-slate-100 px-5 py-2">
            <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-slate-600" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search people…"
                className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')}>
                  <X className="h-3.5 w-3.5 text-slate-600" />
                </button>
              )}
            </div>
          </div>

          {/* User list */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {searchLoading && shouldSearchRemote && searchedUsers.length === 0 ? (
              <div className="space-y-1 px-4 py-3">
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
            ) : visibleSections.length === 0 || visibleSections.every((s) => !s.users.length) ? (
              <p className="px-5 py-6 text-center text-xs text-slate-600">
                {shouldSearchRemote ? 'No matching people found.' : 'No suggested contacts.'}
              </p>
            ) : (
              visibleSections.map((section) => (
                <div key={section.label} className="py-1">
                  <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    {section.label}
                  </p>
                  {section.users.map((u) => {
                    const isSelected = !!selected[u._id];
                    return (
                      <button
                        type="button"
                        key={u._id}
                        onClick={() => toggleUser(u)}
                        className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-slate-50 ${isSelected ? 'bg-primary-50/60' : ''}`}
                      >
                        <div className="relative shrink-0">
                          {u.avatar ? (
                            <Image
                              src={u.avatar}
                              alt={u.name}
                              width={36}
                              height={36}
                              className="h-9 w-9 rounded-full object-cover"
                            />
                          ) : (
                            <div
                              className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(u._id)}`}
                            >
                              {initials(u.name)}
                            </div>
                          )}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium text-slate-800">
                            {u.name}
                          </span>
                          <span className="truncate text-[11px] text-slate-600">
                            {formatRole(u.role) || u.email}
                          </span>
                        </div>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${isSelected ? 'border-primary bg-primary text-white' : 'border-slate-300'}`}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 gap-2 border-t border-slate-100 px-5 py-3">
            <CustomButton type="button" variant="cancel" onClick={onClose} className="flex-1">
              Cancel
            </CustomButton>
            <CustomButton
              type="submit"
              loading={formik.isSubmitting}
              disabled={selectedList.length === 0}
              className="flex-1"
            >
              Create Group
            </CustomButton>
          </div>
        </form>
      </div>
    </div>
  );
}

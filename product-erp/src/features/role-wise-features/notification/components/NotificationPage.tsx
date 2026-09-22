/**
 * @file NotificationPage.tsx
 * @description Notification management — role-aware:
 *   Admin/Faculty/HOD: Create (POST notification), list all (GET notification), edit (PUT notification/:id), deactivate (DELETE notification/:id)
 *   All users: My notifications (GET notification/my), mark read (POST notification/:id/read), preferences (GET/PUT notification/preferences)
 * @module features/role-wise-features/notification
 */
'use client';

import React, { useEffect, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import {
  Bell,
  BellRing,
  CheckCheck,
  CheckCircle,
  ChevronRight,
  Edit2,
  Inbox,
  Plus,
  Search,
  Send,
  Settings,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useSocket } from '@/shared/hooks/useSocket';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { usePushReadiness } from '@/shared/hooks/usePushReadiness';
import Empty from '@/shared/core/Empty';
import AsyncSelect from '@/shared/core/AsyncSelect';
import { useRouter } from 'nextjs-toploader/app';
import { useAuthStore } from '@/shared/store/authStore';
import { getPushDeviceId, PUSH_MANUAL_OPTOUT_KEY } from '@/shared/hooks/useFcm';
import { removeFromLocalStorage, saveToLocalStorage } from '@/shared/utils';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface INotification {
  _id: string;
  title: string;
  message: string;
  type?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  body?: string;
  actionUrl?: string;
  attachmentUrl?: string;
  audience?: string;
  channels?: string[];
  isScheduled?: boolean;
  scheduledAt?: string;
  isSent?: boolean;
  totalRead?: number;
  targetAudience?: string[];
  targetRoles?: string[];
  isActive?: boolean;
  isRead?: boolean;
  createdByName?: string;
  createdAt?: string;
  expiresAt?: string;
  [key: string]: unknown;
}

interface IPreferences {
  email?: boolean;
  sms?: boolean;
  push?: boolean;
  inApp?: boolean;
  [key: string]: unknown;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-500',
  medium: 'bg-blue-50 text-blue-600',
  high: 'bg-amber-50 text-amber-600',
  urgent: 'bg-red-50 text-red-500',
};

const TYPE_OPTIONS = [
  'Info',
  'Success',
  'Warning',
  'Alert',
  'Fee Reminder',
  'Attendance',
  'Result',
  'Exam',
  'Admission',
  'Placement',
  'General',
  'Holiday',
  'System',
  'Leave',
  'Assignment',
  'Library',
  'Hostel',
  'Grievance',
  'Counseling',
  'Notice',
];
const AUDIENCE_OPTIONS = ['All', 'Students', 'Faculty', 'Parents', 'Admin', 'Specific User'];
const CHANNEL_OPTIONS = ['In-App', 'Email', 'Push'];
const ACTION_OPTIONS = [
  { label: 'No action needed', value: '' },
  { label: 'Open dashboard', value: '/dashboard' },
  { label: 'Open admissions', value: '/admission' },
  { label: 'Open attendance', value: '/attendance' },
  { label: 'Open examinations', value: '/examination' },
  { label: 'Open fees', value: '/fee' },
  { label: 'Open library', value: '/library' },
  { label: 'Open meetings', value: '/meeting' },
  { label: 'Open notices', value: '/notice' },
  { label: 'Open tasks', value: '/task-management' },
];

function priorityOf(notification: INotification): 'routine' | 'important' | 'urgent' {
  if (notification.type === 'Alert') return 'urgent';
  if (['Warning', 'Fee Reminder', 'Exam', 'Attendance'].includes(notification.type ?? ''))
    return 'important';
  return 'routine';
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Create / Edit Modal ───────────────────────────────────────────────────────

interface NotifModalProps {
  editing?: INotification | null;
  onClose: () => void;
  onSaved: () => void;
}

function NotifModal({ editing, onClose, onSaved }: NotifModalProps) {
  const { mutation, isLoading } = useMutation();
  const isEdit = !!editing;

  const formik = useFormik({
    initialValues: {
      title: editing?.title ?? '',
      message: editing?.message ?? editing?.body ?? '',
      type: editing?.type ?? 'General',
      audience: editing?.audience ?? 'All',
      channels: editing?.channels ?? ['In-App'],
      targetUserIds: [] as string[],
      actionUrl: editing?.actionUrl ?? '',
      isScheduled: editing?.isScheduled ?? false,
      scheduledAt: editing?.scheduledAt ? String(editing.scheduledAt).slice(0, 16) : '',
      expiresAt: editing?.expiresAt ? String(editing.expiresAt).slice(0, 16) : '',
    },
    validationSchema: Yup.object({
      title: Yup.string().trim().required('Title required'),
      message: Yup.string().trim().required('Message required'),
      type: Yup.string().required(),
    }),
    onSubmit: async (values) => {
      const body = {
        title: values.title,
        body: values.message,
        type: values.type,
        audience: values.audience,
        channels: values.channels,
        targetUserIds: values.audience === 'Specific User' ? values.targetUserIds : [],
        actionUrl: values.actionUrl || undefined,
        isScheduled: values.isScheduled,
        scheduledAt: values.isScheduled ? values.scheduledAt : undefined,
        expiresAt: values.expiresAt || undefined,
      };
      const url = isEdit ? `notification/${editing!._id}` : 'notification';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await mutation(url, { method, body });
      if (res?.results?.success) {
        toast.success(isEdit ? 'Notification updated' : 'Notification created');
        onSaved();
        onClose();
      }
    },
  });

  const toggleChannel = (channel: string) => {
    const current = formik.values.channels;
    formik.setFieldValue(
      'channels',
      current.includes(channel)
        ? current.filter((value) => value !== channel)
        : [...current, channel],
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {isEdit ? 'Edit Notification' : 'New Notification'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-600 hover:text-slate-600 text-xl"
          >
            ✕
          </button>
        </div>

        <form onSubmit={formik.handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Title *</label>
            <input
              name="title"
              value={formik.values.title}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              placeholder="Notification title"
              className={inputCls}
            />
            {formik.touched.title && formik.errors.title && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.title}</p>
            )}
          </div>

          <div>
            <label className={labelCls}>Message *</label>
            <textarea
              name="message"
              rows={4}
              value={formik.values.message}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              placeholder="Notification content…"
              className={inputCls + ' resize-none'}
            />
            {formik.touched.message && formik.errors.message && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Type</label>
              <select
                name="type"
                value={formik.values.type}
                onChange={formik.handleChange}
                className={inputCls}
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t} className="capitalize">
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Audience</label>
              <select
                name="audience"
                value={formik.values.audience}
                onChange={formik.handleChange}
                className={inputCls}
              >
                {AUDIENCE_OPTIONS.map((audience) => (
                  <option key={audience} value={audience}>
                    {audience}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Delivery channels</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {CHANNEL_OPTIONS.map((channel) => (
                <button
                  key={channel}
                  type="button"
                  onClick={() => toggleChannel(channel)}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                    formik.values.channels.includes(channel)
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {channel}
                </button>
              ))}
            </div>
            {!formik.values.channels.length && (
              <p className="mt-1 text-xs text-red-500">Select at least one delivery channel.</p>
            )}
          </div>

          {formik.values.audience === 'Specific User' && (
            <AsyncSelect
              type="users"
              multiple
              required
              label="Recipients"
              value={formik.values.targetUserIds}
              onChange={(values) => formik.setFieldValue('targetUserIds', values)}
              placeholder="Search people by name or email"
            />
          )}

          <div>
            <label className={labelCls}>When opened, take the user to</label>
            <select
              name="actionUrl"
              value={formik.values.actionUrl}
              onChange={formik.handleChange}
              className={inputCls}
            >
              {ACTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {!isEdit && (
            <div className="rounded-xl bg-slate-50 p-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  name="isScheduled"
                  checked={formik.values.isScheduled}
                  onChange={formik.handleChange}
                />
                Schedule for later
              </label>
              {formik.values.isScheduled && (
                <input
                  type="datetime-local"
                  name="scheduledAt"
                  value={formik.values.scheduledAt}
                  onChange={formik.handleChange}
                  className={`${inputCls} mt-3 bg-white`}
                />
              )}
            </div>
          )}

          <div>
            <label className={labelCls}>Expires At (optional)</label>
            <input
              type="datetime-local"
              name="expiresAt"
              value={formik.values.expiresAt}
              onChange={formik.handleChange}
              className={inputCls}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton
              variant="primary"
              type="submit"
              loading={isLoading}
              disabled={
                !formik.values.channels.length ||
                (formik.values.audience === 'Specific User' &&
                  !formik.values.targetUserIds.length) ||
                (formik.values.isScheduled && !formik.values.scheduledAt)
              }
              startIcon={<Send className="h-4 w-4" />}
            >
              {isEdit
                ? 'Update notification'
                : formik.values.isScheduled
                  ? 'Schedule notification'
                  : 'Send notification'}
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Admin: All Notifications Panel ───────────────────────────────────────────

function AllNotificationsPanel() {
  const { data: raw, isLoading, error, mutate } = useSwr('notification');
  const list: INotification[] =
    (raw as { notifications?: INotification[] })?.notifications ??
    (raw as { data?: INotification[] })?.data ??
    [];
  const { mutation } = useMutation();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<INotification | null>(null);

  const handleDelete = async (row: INotification) => {
    const r = await Swal.fire({
      title: 'Deactivate notification?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Deactivate',
      confirmButtonColor: '#0178D7',
    });
    if (!r.isConfirmed) return;
    const res = await mutation(`notification/${row._id}`, { method: 'DELETE' });
    if (res?.results?.success) {
      toast.success('Deactivated');
      mutate();
    }
  };

  const cols: Column<INotification>[] = [
    {
      field: 'title',
      title: 'Title',
      render: (r) => (
        <div>
          <p className="text-sm font-semibold">{String(r.title)}</p>
          <p className="text-xs text-slate-600 truncate max-w-48">{String(r.message ?? '')}</p>
        </div>
      ),
    },
    {
      field: 'type',
      title: 'Type',
      render: (r) => (
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs capitalize">
          {String(r.type ?? '—')}
        </span>
      ),
    },
    {
      field: 'priority',
      title: 'Priority',
      render: (r) => (
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${PRIORITY_COLORS[String(r.priority ?? 'low')] ?? ''}`}
        >
          {String(r.priority ?? '—')}
        </span>
      ),
    },
    {
      field: 'targetAudience',
      title: 'Audience',
      render: (r) => (
        <span className="text-xs text-slate-500">
          {(r.targetAudience as string[] | undefined)?.join(', ') ?? 'all'}
        </span>
      ),
    },
    {
      field: 'createdByName',
      title: 'By',
      render: (r) => (
        <span className="text-xs text-slate-600">{String(r.createdByName ?? '—')}</span>
      ),
    },
    {
      field: 'isActive',
      title: 'Status',
      render: (r) => (
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-medium ${r.isActive !== false ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-600'}`}
        >
          {r.isActive !== false ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      field: 'createdAt',
      title: 'Created',
      render: (r) => <span className="text-xs text-slate-600">{fmtDate(r.createdAt)}</span>,
    },
  ];

  const actions: Action<INotification>[] = [
    {
      tooltip: 'Edit',
      icon: <Edit2 className="h-4 w-4" />,
      onClick: (r: INotification) => {
        setEditing(r);
        setShowModal(true);
      },
    },
    {
      tooltip: 'Deactivate',
      icon: <Trash2 className="h-4 w-4" />,
      onClick: handleDelete,
      className: 'text-red-500',
    },
  ];

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          Notifications could not be loaded. Management actions are unavailable until the request
          succeeds.
        </div>
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">All Notifications</h2>
        {!error && (
          <CustomButton
            variant="primary"
            onClick={() => {
              setEditing(null);
              setShowModal(true);
            }}
            startIcon={<Plus className="h-4 w-4" />}
            className="w-fit!"
          >
            New Notification
          </CustomButton>
        )}
      </div>
      <DataViewSwitcher<INotification>
        data={error ? [] : list}
        isLoading={isLoading}
        storageKey="notification.view"
        searchPlaceholder="Search notifications…"
        searchFields={['title', 'message', 'type', 'priority']}
        renderCard={(n) => {
          const priorityStyle =
            n.priority === 'urgent' || n.priority === 'high'
              ? 'bg-red-50 text-red-500'
              : n.priority === 'medium'
                ? 'bg-amber-50 text-amber-600'
                : 'bg-slate-100 text-slate-500';
          return (
            <motion.div
              whileHover={{ y: -2 }}
              className="flex flex-col gap-3 rounded-2xl bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
                  <Bell className="h-5 w-5" />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${n.isActive ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {n.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {n.priority && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${priorityStyle}`}
                    >
                      {n.priority}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 line-clamp-2">{n.title}</p>
                <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{n.message}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-600">{n.type}</p>
              </div>
              <div className="space-y-1 text-xs text-slate-500">
                {n.targetAudience && (
                  <p>
                    Audience: <span className="capitalize">{n.targetAudience}</span>
                  </p>
                )}
                {n.createdByName && <p>By: {n.createdByName}</p>}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(n);
                    setShowModal(true);
                  }}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  <Edit2 className="h-3 w-3" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(n)}
                  className="inline-flex items-center gap-1 font-medium text-red-500 hover:underline"
                >
                  <Trash2 className="h-3 w-3" /> Deactivate
                </button>
              </div>
            </motion.div>
          );
        }}
        table={
          <div className="overflow-hidden rounded-2xl bg-white">
            <CustomTable<INotification>
              data={list}
              columns={cols}
              actions={actions}
              isLoading={isLoading}
              options={{ search: false, pagination: true, pageSize: 15 }}
              localization={{ toolbar: { searchPlaceholder: 'Search notifications…' } }}
            />
          </div>
        }
      />
      <AnimatePresence>
        {showModal && (
          <NotifModal editing={editing} onClose={() => setShowModal(false)} onSaved={mutate} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── My Notifications Panel (all users) ───────────────────────────────────────

function MyNotificationsPanel() {
  const { data: raw, isLoading, error, mutate } = useSwr('notification/my?limit=100');
  const { socket } = useSocket();
  const router = useRouter();
  const activeRole = useAuthStore((state) => state.activeRole);
  const list: INotification[] =
    (raw as { notifications?: INotification[] })?.notifications ??
    (raw as { data?: INotification[] })?.data ??
    [];
  const { mutation } = useMutation();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'important'>('all');

  useEffect(() => {
    if (!socket) return;
    const onPush = () => mutate();
    socket.on('notification_push', onPush);
    return () => {
      socket.off('notification_push', onPush);
    };
  }, [socket, mutate]);

  const handleRead = async (id: string) => {
    await mutation(`notification/${id}/read`, { method: 'POST', body: {} });
    mutate();
  };
  const handleMarkAll = async () => {
    const response = await mutation('notification/read-all', { method: 'POST', body: {} });
    if (!response?.results?.success) return;
    toast.success('Inbox cleared');
    mutate();
  };
  const openNotification = async (notification: INotification) => {
    if (!notification.isRead) await handleRead(notification._id);
    if (!notification.actionUrl) return;
    if (/^https?:\/\//i.test(notification.actionUrl)) {
      window.open(notification.actionUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    const role = activeRole?.name;
    const destination = role
      ? `/${role}${notification.actionUrl.startsWith('/') ? notification.actionUrl : `/${notification.actionUrl}`}`
      : notification.actionUrl;
    router.push(destination);
  };

  const unread = list.filter((n) => !n.isRead).length;
  const important = list.filter((notification) => priorityOf(notification) !== 'routine').length;
  const visible = list.filter((notification) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      [notification.title, notification.message, notification.body, notification.type].some(
        (value) =>
          String(value ?? '')
            .toLowerCase()
            .includes(query),
      );
    const matchesFilter =
      filter === 'all' ||
      (filter === 'unread' && !notification.isRead) ||
      (filter === 'important' && priorityOf(notification) !== 'routine');
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          Your notifications could not be loaded. Counts and inbox content are unavailable.
        </div>
      )}
      {!error && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                label: 'All updates',
                value: list.length,
                icon: Inbox,
                tone: 'bg-blue-50 text-blue-700',
              },
              {
                label: 'Unread',
                value: unread,
                icon: BellRing,
                tone: 'bg-violet-50 text-violet-700',
              },
              {
                label: 'Important',
                value: important,
                icon: Bell,
                tone: 'bg-amber-50 text-amber-700',
              },
            ].map((item) => (
              <article
                key={item.label}
                className="flex items-center justify-between rounded-2xl bg-white p-4"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-500">{item.label}</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{item.value}</p>
                </div>
                <span className={`rounded-xl p-2.5 ${item.tone}`}>
                  <item.icon className="h-4 w-4" />
                </span>
              </article>
            ))}
          </div>
          <div className="flex flex-col gap-3 rounded-2xl bg-white p-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-600" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search notifications"
                aria-label="Search notifications"
                className={`${inputCls} pl-9`}
              />
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {[
                ['all', `All (${list.length})`],
                ['unread', `Unread (${unread})`],
                ['important', `Important (${important})`],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value as typeof filter)}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold ${filter === value ? 'bg-primary text-white' : 'bg-slate-50 text-slate-600'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold text-primary"
              >
                <CheckCheck className="h-4 w-4" /> Mark all read
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-white" />
              ))}
            </div>
          ) : visible.length ? (
            <div className="space-y-2">
              {visible.map((n, i) => {
                const priority = priorityOf(n);
                return (
                  <motion.div
                    key={n._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`flex items-start gap-3 rounded-2xl border p-4 transition-colors ${n.isRead ? 'border-transparent bg-white' : 'border-primary/10 bg-primary-50/40'}`}
                  >
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${PRIORITY_COLORS[String(n.priority ?? 'low')] ?? 'bg-slate-100'}`}
                    >
                      <Bell className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm ${n.isRead ? 'text-slate-700' : 'font-semibold text-slate-900'}`}
                        >
                          {n.title}
                        </p>
                        {!n.isRead && (
                          <span
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                            aria-label="Unread"
                          />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{n.message}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-500">
                          {n.type ?? 'general'}
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${
                            priority === 'urgent'
                              ? 'bg-red-50 text-red-700'
                              : priority === 'important'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-50 text-slate-500'
                          }`}
                        >
                          {priority}
                        </span>
                        <span className="text-xs text-slate-600">{fmtDate(n.createdAt)}</span>
                        {!n.isRead && (
                          <button
                            type="button"
                            onClick={() => handleRead(n._id)}
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <CheckCircle className="h-3 w-3" /> Mark read
                          </button>
                        )}
                        {n.actionUrl && (
                          <button
                            type="button"
                            onClick={() => openNotification(n)}
                            className="ml-auto flex items-center gap-1 text-xs font-bold text-primary"
                          >
                            Open related work <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl bg-white">
              <Empty
                title={
                  search || filter !== 'all' ? 'No matching notifications' : 'You are all caught up'
                }
                subTitle={
                  search || filter !== 'all'
                    ? 'Try another keyword or choose a different inbox filter.'
                    : 'New institutional updates and actions will appear here.'
                }
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Preferences Panel ─────────────────────────────────────────────────────────

function PreferencesPanel() {
  const { data: raw, isLoading, error, mutate } = useSwr('notification/preferences');
  const prefs: IPreferences = (raw as { data?: IPreferences })?.data ?? {};
  const { mutation, isLoading: saving } = useMutation();
  const [local, setLocal] = useState<IPreferences | null>(null);
  const { readiness: pushReadiness, ready: pushReady } = usePushReadiness();
  const [browserPermission, setBrowserPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  useEffect(() => {
    const syncPermission = () => {
      if ('Notification' in window) setBrowserPermission(Notification.permission);
    };
    window.addEventListener('focus', syncPermission);
    return () => window.removeEventListener('focus', syncPermission);
  }, []);

  const current = local ?? prefs;

  const toggle = (key: keyof IPreferences) =>
    setLocal((p) => ({ ...(p ?? prefs), [key]: !(p ?? prefs)[key] }));

  const changePush = async () => {
    const enabling = !(current.push && browserPermission === 'granted');
    if (enabling) {
      if (!pushReady) {
        toast.info(pushReadiness?.reason || 'Push delivery is not ready for this institution.');
        return;
      }
      if (browserPermission === 'unsupported') {
        toast.info('This browser does not support web push notifications.');
        return;
      }
      let permission = Notification.permission;
      if (permission === 'default') permission = await Notification.requestPermission();
      setBrowserPermission(permission);
      if (permission !== 'granted') {
        toast.info(
          permission === 'denied'
            ? 'Notifications are blocked in this browser. Allow them in site settings, then try again.'
            : 'Push was not enabled because notification access was not granted.',
        );
        return;
      }
    }

    const next = { ...current, push: enabling };
    const response = await mutation('notification/preferences', {
      method: 'PUT',
      body: next,
    });
    if (!response?.results?.success) return;
    if (!enabling) {
      saveToLocalStorage(PUSH_MANUAL_OPTOUT_KEY, 'true');
      await mutation('notification/fcm-token', {
        method: 'DELETE',
        body: { platform: 'web', deviceId: getPushDeviceId() },
        isAlert: false,
      });
    } else {
      removeFromLocalStorage(PUSH_MANUAL_OPTOUT_KEY);
    }
    setLocal(next);
    await mutate();
    setLocal(null);
    toast.success(enabling ? 'Push notifications enabled on this device' : 'Push access removed');
  };

  const handleSave = async () => {
    const res = await mutation('notification/preferences', {
      method: 'PUT',
      body: current,
    });
    if (res?.results?.success) {
      toast.success('Preferences saved');
      mutate();
      setLocal(null);
    }
  };

  const CHANNELS: { key: keyof IPreferences; label: string; desc: string }[] = [
    { key: 'inApp', label: 'In-App', desc: 'Notifications inside the portal' },
    { key: 'email', label: 'Email', desc: 'Receive notifications via email' },
    { key: 'push', label: 'Push', desc: 'Browser/mobile push notifications' },
    { key: 'sms', label: 'SMS', desc: 'Time-sensitive text message notifications' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Notification Preferences</h2>
      {error ? (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          Notification preferences could not be loaded. No settings can be changed safely.
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-white divide-y divide-slate-50">
          {CHANNELS.map((ch) => {
            const unavailable =
              ch.key === 'push' && (!pushReady || browserPermission === 'unsupported');
            const checked =
              unavailable || (ch.key === 'push' && browserPermission !== 'granted')
                ? false
                : !!current[ch.key];
            const pushBlocked = ch.key === 'push' && browserPermission === 'denied';
            return (
              <div key={ch.key} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-semibold">{ch.label}</p>
                  <p className={`text-xs ${unavailable ? 'text-amber-600' : 'text-slate-600'}`}>
                    {unavailable
                      ? pushReadiness?.reason ||
                        'Push delivery is unavailable for this institution or browser.'
                      : pushBlocked
                        ? 'Blocked by this browser. Open site settings, allow Notifications, then turn Push on again.'
                        : ch.desc}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  disabled={unavailable}
                  onClick={() => (ch.key === 'push' ? changePush() : toggle(ch.key))}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${unavailable ? 'cursor-not-allowed bg-slate-200 opacity-70' : checked ? 'cursor-pointer bg-primary' : 'cursor-pointer bg-slate-300'}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white  transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`}
                  />
                </button>
              </div>
            );
          })}
          <div className="flex justify-end p-4">
            <CustomButton
              variant="primary"
              onClick={handleSave}
              loading={saving}
              className="w-fit!"
            >
              Save Preferences
            </CustomButton>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'mine' | 'all' | 'preferences';

export default function NotificationPage() {
  const isAdmin = useHasPermission('notification', 'create');
  const [active, setActive] = useState<Tab>('mine');

  const tabs: { id: Tab; label: string; icon: React.ElementType; show: boolean }[] = [
    { id: 'mine', label: 'My Notifications', icon: Bell, show: true },
    { id: 'all', label: 'Manage', icon: Send, show: isAdmin },
    { id: 'preferences', label: 'Preferences', icon: Settings, show: true },
  ];

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {isAdmin
            ? 'Manage and send notifications across the institution'
            : 'Stay updated with the latest announcements'}
        </p>
      </motion.div>

      <div className="flex flex-wrap gap-1 rounded-xl bg-white p-1.5">
        {tabs
          .filter((t) => t.show)
          .map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActive(tab.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                  active === tab.id ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          {active === 'mine' && <MyNotificationsPanel />}
          {active === 'all' && <AllNotificationsPanel />}
          {active === 'preferences' && <PreferencesPanel />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

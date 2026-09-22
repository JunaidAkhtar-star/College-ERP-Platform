/**
 * @file NoticePage.tsx
 * @description Notice Board — role-aware:
 *   - Admin roles (super_admin, principal, dean_academic, hod): full CRUD management,
 *     publish/unpublish, calendar view, draft filter, stats.
 *   - All other roles (faculty, student, parent, etc.): read-only bulletin board,
 *     mark-as-read, search, filter by type & priority.
 * @module features/role-wise-features/notice
 */
'use client';

import React, { useState, useMemo } from 'react';
import EngagementWorkflowBar from '@/shared/components/EngagementWorkflowBar';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import {
  Bell,
  BellOff,
  Eye,
  Send,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Filter,
  Search,
  X,
  FileText,
  Clock,
  Users,
  Globe,
  BarChart3,
  Radio,
  TrendingUp,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import CalendarView, { CalendarEvent } from '@/shared/core/CalendarView';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useHasPermission } from '@/shared/hooks/useHasPermission';

import NoticeModal from './NoticeModal';

type NoticeType = 'global' | 'department' | 'role_based' | 'program';
type NoticePriority = 'low' | 'normal' | 'high' | 'urgent';

interface INotice {
  _id: string;
  title: string;
  content: string;
  noticeType: NoticeType;
  targetDepartments?: string[];
  targetRoles?: string[];
  targetPrograms?: string[];
  attachments?: { fileName: string; fileUrl: string; fileSize: number }[];
  priority: NoticePriority;
  expiryDate?: string;
  isPublished: boolean;
  publishedAt?: string;
  // readBy[] removed from backend — use isRead field returned by API instead
  isRead?: boolean;
  readCount: number;
  createdAt: string;
  [key: string]: unknown;
}
interface INoticeStats {
  summary: {
    total: number;
    published: number;
    drafts: number;
    urgent: number;
    reads: number;
    active: number;
  };
  byPriority: Array<{ _id: NoticePriority; count: number; reads: number }>;
  byType: Array<{ _id: NoticeType; count: number; reads: number }>;
  publishingTrend: Array<{ _id: string; published: number; reads: number }>;
}

const PRIORITY_CFG: Record<
  NoticePriority,
  { label: string; bg: string; text: string; color: string; dot: string }
> = {
  urgent: {
    label: 'Urgent',
    bg: 'bg-red-50',
    text: 'text-red-500',
    color: 'bg-red-500',
    dot: 'bg-red-500',
  },
  high: {
    label: 'High',
    bg: 'bg-orange-50',
    text: 'text-orange-600',
    color: 'bg-orange-400',
    dot: 'bg-orange-400',
  },
  normal: {
    label: 'Normal',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    color: 'bg-blue-400',
    dot: 'bg-blue-400',
  },
  low: {
    label: 'Low',
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    color: 'bg-slate-300',
    dot: 'bg-slate-300',
  },
};

const TYPE_CFG: Record<NoticeType, { label: string; icon: React.ElementType }> = {
  global: { label: 'Global', icon: Globe },
  department: { label: 'Department', icon: Users },
  role_based: { label: 'Role Based', icon: BookOpen },
  program: { label: 'Program', icon: FileText },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
function isExpired(iso?: string) {
  return iso ? new Date(iso) < new Date() : false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Detail Drawer
// ─────────────────────────────────────────────────────────────────────────────
function NoticeDetailDrawer({
  notice,
  isAdmin,
  onClose,
  onEdit,
  onDelete,
  onPublish,
  onMarkRead,
  processing,
  canEdit = false,
  canPublish = false,
  canDelete = false,
}: {
  notice: INotice;
  isAdmin: boolean;
  onClose: () => void;
  onEdit: (n: INotice) => void;
  onDelete: (n: INotice) => void;
  onPublish: (n: INotice) => void;
  onMarkRead: (n: INotice) => void;
  processing: boolean;
  canEdit?: boolean;
  canPublish?: boolean;
  canDelete?: boolean;
}) {
  const alreadyRead = notice.isRead ?? false;
  const pc = PRIORITY_CFG[notice.priority] ?? PRIORITY_CFG.normal;
  const TypeIcon = TYPE_CFG[notice.noticeType]?.icon ?? Globe;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden bg-white "
      >
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Notice</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Title + badges */}
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-bold text-slate-900 leading-snug">{notice.title}</h3>
              {canPublish && !notice.isPublished && (
                <span className="shrink-0 rounded-full px-2 py-0.5 text-xs bg-slate-100 text-slate-600">
                  Draft
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${pc.bg} ${pc.text}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${pc.dot}`} />
                {pc.label}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs bg-slate-100 text-slate-600">
                <TypeIcon className="h-3 w-3" />
                {TYPE_CFG[notice.noticeType]?.label}
              </span>
              {alreadyRead && (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs bg-green-50 text-green-600">
                  <CheckCircle2 className="h-3 w-3" /> Read
                </span>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {notice.content}
            </p>
          </div>

          {/* Meta */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>
                Published: {notice.publishedAt ? formatDate(notice.publishedAt) : 'Not yet'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>Created: {formatDate(notice.createdAt)}</span>
            </div>
            {notice.expiryDate && (
              <div
                className={`flex items-center gap-2 text-xs ${isExpired(notice.expiryDate) ? 'text-red-500 font-medium' : 'text-orange-500'}`}
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {isExpired(notice.expiryDate) ? 'Expired' : 'Expires'}:{' '}
                  {formatDate(notice.expiryDate)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Eye className="h-3.5 w-3.5 shrink-0" />
              <span>{notice.readCount} people read this</span>
            </div>
          </div>

          {/* Target roles */}
          {notice.targetRoles && notice.targetRoles.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Target Roles
              </p>
              <div className="flex flex-wrap gap-1.5">
                {notice.targetRoles.map((r) => (
                  <span
                    key={r}
                    className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 capitalize"
                  >
                    {r.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          {notice.attachments && notice.attachments.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Attachments
              </p>
              <div className="space-y-2">
                {notice.attachments.map((att, i) => (
                  <a
                    key={i}
                    href={att.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={att.fileName}
                    className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-primary hover:bg-slate-100"
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 truncate">{att.fileName}</span>
                    <span className="ml-auto shrink-0 text-xs text-slate-600">
                      {att.fileSize ? `${(att.fileSize / 1024).toFixed(0)} KB` : ''}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-slate-100 px-5 py-4 flex flex-wrap gap-2">
          {isAdmin ? (
            <>
              {!notice.isPublished && (
                <CustomButton
                  variant="primary"
                  startIcon={<Send className="h-4 w-4" />}
                  onClick={() => onPublish(notice)}
                  loading={processing}
                  className="flex-1"
                >
                  Publish
                </CustomButton>
              )}
              {canEdit && !notice.isPublished && (
                <CustomButton
                  variant="secondary"
                  startIcon={<Edit2 className="h-4 w-4" />}
                  onClick={() => onEdit(notice)}
                  className="flex-1"
                >
                  Edit
                </CustomButton>
              )}
              {canDelete && !notice.isPublished && (
                <CustomButton
                  variant="cancel"
                  startIcon={<Trash2 className="h-4 w-4" />}
                  onClick={() => onDelete(notice)}
                  loading={processing}
                >
                  <Trash2 className="h-4 w-4" />
                </CustomButton>
              )}
            </>
          ) : (
            !alreadyRead && (
              <CustomButton
                variant="primary"
                startIcon={<CheckCircle2 className="h-4 w-4" />}
                onClick={() => onMarkRead(notice)}
                loading={processing}
                className="w-full"
              >
                Mark as Read
              </CustomButton>
            )
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Read-only bulletin board (non-admin roles)
// ─────────────────────────────────────────────────────────────────────────────
function NoticeBulletinBoard() {
  const { mutation: markMutation, isLoading: markLoading } = useMutation();
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterType, setFilterType] = useState('');
  const [detailNotice, setDetailNotice] = useState<INotice | null>(null);

  const qp = new URLSearchParams();
  if (filterPriority) qp.set('priority', filterPriority);
  if (filterType) qp.set('noticeType', filterType);
  const {
    data: raw,
    isLoading,
    mutate,
  } = useSwr(`notice/active${qp.toString() ? '?' + qp.toString() : ''}`);
  const notices = useMemo(() => (raw as { data?: INotice[] })?.data ?? [], [raw]);

  const filtered = useMemo(() => {
    if (!search.trim()) return notices;
    const q = search.toLowerCase();
    return notices.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q),
    );
  }, [notices, search]);

  const handleMarkRead = async (n: INotice) => {
    const res = await markMutation(`notice/${n._id}/read`, { method: 'POST', isAlert: false });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Marked as read');
      mutate();
      setDetailNotice(null);
    } else toast.error('Failed');
  };

  const unreadCount = notices.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-5">
      <EngagementWorkflowBar />
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notice Board</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Stay updated with institutional announcements
          </p>
        </div>
        {unreadCount > 0 && (
          <span className="flex w-fit items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-sm font-semibold text-primary">
            <Bell className="h-4 w-4" />
            {unreadCount} unread notice{unreadCount > 1 ? 's' : ''}
          </span>
        )}
      </motion.div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4">
        <div className="flex flex-1 min-w-48 items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-slate-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notices…"
            className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')}>
              <X className="h-3.5 w-3.5 text-slate-600" />
            </button>
          )}
        </div>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">All Types</option>
          <option value="global">Global</option>
          <option value="department">Department</option>
          <option value="role_based">Role Based</option>
          <option value="program">Program</option>
        </select>
        {(filterPriority || filterType) && (
          <button
            type="button"
            onClick={() => {
              setFilterPriority('');
              setFilterType('');
            }}
            className="text-xs text-slate-600 underline hover:text-slate-600"
          >
            Clear
          </button>
        )}
      </div>

      {/* Notice cards */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-2xl bg-white p-5 animate-pulse">
              <div className="mb-3 h-4 w-20 rounded bg-slate-200" />
              <div className="mb-2 h-5 w-full rounded bg-slate-200" />
              <div className="h-3 w-3/4 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-16 text-slate-300">
          <BellOff className="mb-3 h-10 w-10" />
          <p className="text-sm font-medium text-slate-600">No notices found</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((n, i) => {
            const pc = PRIORITY_CFG[n.priority] ?? PRIORITY_CFG.normal;
            const alreadyRead = n.isRead ?? false;
            const expired = isExpired(n.expiryDate);
            const TypeIcon = TYPE_CFG[n.noticeType]?.icon ?? Globe;
            return (
              <motion.div
                key={n._id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setDetailNotice(n)}
                className={`group cursor-pointer rounded-2xl bg-white p-5 transition-all hover:-translate-y-0.5 hover:bg-slate-50 ${!alreadyRead ? 'ring-1 ring-primary/20' : ''}`}
              >
                {/* Top row */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${pc.bg} ${pc.text}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${pc.dot}`} />
                      {pc.label}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                      <TypeIcon className="h-2.5 w-2.5" />
                      {TYPE_CFG[n.noticeType]?.label}
                    </span>
                  </div>
                  {!alreadyRead && <span className="h-2 w-2 rounded-full bg-primary" />}
                </div>

                {/* Title */}
                <h3
                  className={`mb-1.5 text-sm font-bold leading-snug group-hover:text-primary ${alreadyRead ? 'text-slate-600' : 'text-slate-900'}`}
                >
                  {n.title}
                </h3>
                <p className="line-clamp-2 text-xs text-slate-600">{n.content}</p>

                {/* Footer */}
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-[10px] text-slate-600">
                    {n.publishedAt ? formatDate(n.publishedAt) : formatDate(n.createdAt)}
                  </span>
                  <div className="flex items-center gap-2">
                    {expired && n.expiryDate && (
                      <span className="text-[10px] text-red-400 font-medium">Expired</span>
                    )}
                    {alreadyRead ? (
                      <span className="flex items-center gap-0.5 text-[10px] text-green-500 font-medium">
                        <CheckCircle2 className="h-3 w-3" /> Read
                      </span>
                    ) : (
                      <span className="text-[10px] text-primary font-medium">New</span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Detail drawer */}
      <AnimatePresence>
        {detailNotice && (
          <NoticeDetailDrawer
            notice={detailNotice}
            isAdmin={false}
            onClose={() => setDetailNotice(null)}
            onEdit={() => undefined}
            onDelete={() => undefined}
            onPublish={() => undefined}
            onMarkRead={handleMarkRead}
            processing={markLoading}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin management board
// ─────────────────────────────────────────────────────────────────────────────
function NoticeManagementBoard() {
  const canCreate = useHasPermission('notice', 'create');
  const canEdit = useHasPermission('notice', 'edit');
  const canPublish = useHasPermission('notice', 'approve');
  const canDelete = useHasPermission('notice', 'delete');
  const [viewMode, setViewMode] = useState<'overview' | 'list' | 'calendar'>('overview');
  const [filterType, setFilterType] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterPublished, setFilterPublished] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editNotice, setEditNotice] = useState<INotice | null>(null);
  const [detailNotice, setDetailNotice] = useState<INotice | null>(null);

  const qp = new URLSearchParams();
  if (filterType) qp.set('noticeType', filterType);
  if (filterPriority) qp.set('priority', filterPriority);
  if (filterPublished) qp.set('isPublished', filterPublished);
  const {
    data: raw,
    isLoading,
    mutate,
  } = useSwr(`notice${qp.toString() ? '?' + qp.toString() : ''}`);
  const { data: statsRaw, isLoading: statsLoading, mutate: refreshStats } = useSwr('notice/stats');
  const stats = (statsRaw as { data?: INoticeStats })?.data;
  const notices = useMemo(() => (raw as { data?: INotice[] })?.data ?? [], [raw]);
  const { mutation, isLoading: processing } = useMutation();

  const handlePublish = async (n: INotice) => {
    const r = await Swal.fire({
      title: 'Publish Notice?',
      text: n.title,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Publish',
      confirmButtonColor: '#0178D7',
    });
    if (!r.isConfirmed) return;
    const res = await mutation(`notice/${n._id}/publish`, { method: 'POST', isAlert: true });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Published');
      mutate();
    } else toast.error('Failed');
  };

  const handleDelete = async (n: INotice) => {
    const r = await Swal.fire({
      title: 'Delete Notice?',
      text: n.title,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#d33',
    });
    if (!r.isConfirmed) return;
    const res = await mutation(`notice/${n._id}`, { method: 'DELETE', isAlert: true });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Deleted');
      mutate();
      if (detailNotice?._id === n._id) setDetailNotice(null);
    } else toast.error('Failed');
  };

  const calEvents: CalendarEvent[] = useMemo(
    () =>
      notices.map((n) => ({
        id: n._id,
        title: n.title,
        date: new Date(n.expiryDate ?? n.publishedAt ?? n.createdAt),
        category: n.priority,
        color: PRIORITY_CFG[n.priority]?.color ?? 'bg-slate-400',
        badge: n.priority.slice(0, 3).toUpperCase(),
        payload: n as unknown as Record<string, unknown>,
      })),
    [notices],
  );

  const columns: Column<INotice>[] = [
    {
      field: 'title',
      title: 'Notice',
      render: (row) => (
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-800">{row.title}</p>
            {!row.isPublished && (
              <span className="rounded px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-600">
                Draft
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-600 line-clamp-1">{row.content}</p>
        </div>
      ),
    },
    {
      field: 'noticeType',
      title: 'Type',
      render: (row) => {
        const TypeIcon = TYPE_CFG[row.noticeType]?.icon ?? Globe;
        return (
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            <TypeIcon className="h-3.5 w-3.5" />
            {TYPE_CFG[row.noticeType]?.label}
          </span>
        );
      },
    },
    {
      field: 'priority',
      title: 'Priority',
      render: (row) => {
        const c = PRIORITY_CFG[row.priority];
        return (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.bg} ${c.text}`}>
            {c.label}
          </span>
        );
      },
    },
    {
      field: 'isPublished',
      title: 'Status',
      render: (row) =>
        row.isPublished ? (
          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
            <Send className="h-3 w-3" /> Published
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-slate-600">
            <BellOff className="h-3 w-3" /> Draft
          </span>
        ),
    },
    {
      field: 'createdAt',
      title: 'Created',
      render: (row) => <span className="text-xs text-slate-500">{formatDate(row.createdAt)}</span>,
    },
    {
      field: 'expiryDate',
      title: 'Expires',
      render: (row) =>
        row.expiryDate ? (
          <span
            className={`text-xs ${isExpired(row.expiryDate) ? 'text-red-500 font-medium' : 'text-slate-500'}`}
          >
            {formatDate(row.expiryDate)}
          </span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        ),
    },
    {
      field: 'readCount',
      title: 'Reads',
      render: (row) => (
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <Eye className="h-3 w-3" />
          {row.readCount}
        </span>
      ),
    },
  ];

  const actions: Action<INotice>[] = [
    {
      tooltip: 'View',
      icon: <Eye className="h-4 w-4 text-primary" />,
      onClick: (row) => setDetailNotice(row),
    },
    {
      tooltip: 'Edit',
      icon: <Edit2 className="h-4 w-4 text-slate-500" />,
      onClick: (row) => {
        setEditNotice(row);
        setShowModal(true);
      },
      hidden: (row) => !canEdit || row.isPublished,
    },
    {
      tooltip: 'Publish',
      icon: <Send className="h-4 w-4 text-green-500" />,
      onClick: (row) => handlePublish(row),
      hidden: (row) => !canPublish || row.isPublished,
    },
    {
      tooltip: 'Delete',
      icon: <Trash2 className="h-4 w-4 text-red-400" />,
      onClick: (row) => handleDelete(row),
      hidden: (row) => !canDelete || row.isPublished,
    },
  ];

  return (
    <div className="space-y-5">
      <EngagementWorkflowBar />
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notice Management</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Create, manage and publish notices to all users
          </p>
        </div>
      </motion.div>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200">
        <div className="flex overflow-x-auto">
          <button
            type="button"
            onClick={() => setViewMode('overview')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${viewMode === 'overview' ? 'border-primary text-primary' : 'border-transparent text-slate-500'}`}
          >
            <BarChart3 className="h-4 w-4" />
            Overview
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${viewMode === 'list' ? 'border-primary text-primary' : 'border-transparent text-slate-500'}`}
          >
            <Bell className="h-4 w-4" /> Notices
          </button>
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${viewMode === 'calendar' ? 'border-primary text-primary' : 'border-transparent text-slate-500'}`}
          >
            <Calendar className="h-4 w-4" /> Calendar
          </button>
        </div>
        {canCreate && (
          <CustomButton
            variant="primary"
            startIcon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setEditNotice(null);
              setShowModal(true);
            }}
            className="w-fit!"
          >
            New Notice
          </CustomButton>
        )}
      </div>

      {viewMode === 'overview' ? (
        <NoticeAnalytics data={stats} loading={statsLoading} onRefresh={() => refreshStats()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: 'Total',
                value: stats?.summary.total ?? notices.length,
                icon: <Bell className="h-4.5 w-4.5" />,
                color: 'bg-primary-50 text-primary',
              },
              {
                label: 'Published',
                value: stats?.summary.published ?? notices.filter((n) => n.isPublished).length,
                icon: <Send className="h-4.5 w-4.5" />,
                color: 'bg-green-50 text-green-600',
              },
              {
                label: 'Drafts',
                value: stats?.summary.drafts ?? notices.filter((n) => !n.isPublished).length,
                icon: <BellOff className="h-4.5 w-4.5" />,
                color: 'bg-slate-100 text-slate-500',
              },
              {
                label: 'Urgent',
                value:
                  stats?.summary.urgent ?? notices.filter((n) => n.priority === 'urgent').length,
                icon: <AlertTriangle className="h-4.5 w-4.5" />,
                color: 'bg-red-50 text-red-500',
              },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="flex items-center gap-3 rounded-xl bg-white p-4"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.color}`}
                >
                  {s.icon}
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900">{isLoading ? '—' : s.value}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4">
            <Filter className="h-3.5 w-3.5 shrink-0 text-slate-600" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:outline-none"
            >
              <option value="">All Types</option>
              <option value="global">Global</option>
              <option value="department">Department</option>
              <option value="role_based">Role Based</option>
              <option value="program">Program</option>
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:outline-none"
            >
              <option value="">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
            <select
              value={filterPublished}
              onChange={(e) => setFilterPublished(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="true">Published</option>
              <option value="false">Drafts</option>
            </select>
            {(filterType || filterPriority || filterPublished) && (
              <button
                type="button"
                onClick={() => {
                  setFilterType('');
                  setFilterPriority('');
                  setFilterPublished('');
                }}
                className="text-xs text-slate-600 underline hover:text-slate-600"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* View */}
          {viewMode === 'calendar' ? (
            <div className="overflow-hidden rounded-2xl">
              <CalendarView
                events={calEvents}
                onAddClick={
                  canCreate
                    ? () => {
                        setEditNotice(null);
                        setShowModal(true);
                      }
                    : undefined
                }
                onEventClick={(ev) => setDetailNotice(ev.payload as unknown as INotice)}
                renderEventPopover={(event, close) => {
                  const n = event.payload as unknown as INotice;
                  const pc = PRIORITY_CFG[n.priority];
                  return (
                    <div className="space-y-2">
                      <div>
                        <p className="font-semibold text-slate-800">{n.title}</p>
                        <div className="mt-1 flex gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${pc.bg} ${pc.text}`}
                          >
                            {pc.label}
                          </span>
                          {!n.isPublished && (
                            <span className="rounded px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-600">
                              Draft
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2">{n.content}</p>
                      {n.expiryDate && (
                        <p className="text-xs text-slate-600">
                          Expires: {formatDate(n.expiryDate)}
                        </p>
                      )}
                      <div className="flex gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setDetailNotice(n);
                            close();
                          }}
                          className="text-xs text-primary hover:underline"
                        >
                          View
                        </button>
                        {canPublish && !n.isPublished && (
                          <button
                            type="button"
                            onClick={() => {
                              handlePublish(n);
                              close();
                            }}
                            className="text-xs text-green-600 hover:underline"
                          >
                            Publish
                          </button>
                        )}
                        {canEdit && !n.isPublished && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditNotice(n);
                              setShowModal(true);
                              close();
                            }}
                            className="text-xs text-slate-500 hover:underline"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }}
              />
            </div>
          ) : (
            <DataViewSwitcher<INotice>
              data={notices}
              isLoading={isLoading}
              storageKey="notice.view"
              searchPlaceholder="Search notices…"
              searchFields={['title', 'noticeType', 'priority']}
              renderCard={(n) => {
                const priorityStyle =
                  n.priority === 'urgent' || n.priority === 'high'
                    ? 'bg-red-50 text-red-500'
                    : n.priority === 'normal'
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
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${n.isPublished ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}
                        >
                          {n.isPublished ? 'Published' : 'Draft'}
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
                      <p className="text-[11px] uppercase tracking-wide text-slate-600">
                        {n.noticeType}
                      </p>
                    </div>
                    <div className="space-y-1 text-xs text-slate-500">
                      <p className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 text-slate-600" />
                        <span>
                          {n.createdAt
                            ? new Date(n.createdAt).toLocaleDateString('en-IN', {
                                dateStyle: 'medium',
                              })
                            : '—'}
                        </span>
                      </p>
                      {n.expiryDate && (
                        <p className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-slate-600" />
                          <span>
                            Expires{' '}
                            {new Date(n.expiryDate).toLocaleDateString('en-IN', {
                              dateStyle: 'medium',
                            })}
                          </span>
                        </p>
                      )}
                      <p className="flex items-center gap-1.5">
                        <Eye className="h-3 w-3 text-slate-600" />
                        <span>{n.readCount ?? 0} reads</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3 text-xs">
                      <button
                        type="button"
                        onClick={() => setDetailNotice(n)}
                        className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-primary"
                      >
                        <Eye className="h-3 w-3" /> View
                      </button>
                      <>
                        {canEdit && !n.isPublished && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditNotice(n);
                              setShowModal(true);
                            }}
                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                          >
                            <Edit2 className="h-3 w-3" /> Edit
                          </button>
                        )}
                        {canPublish && !n.isPublished && (
                          <button
                            type="button"
                            onClick={() => handlePublish(n)}
                            className="inline-flex items-center gap-1 font-medium text-green-600 hover:underline"
                          >
                            <Send className="h-3 w-3" /> Publish
                          </button>
                        )}
                        {canDelete && !n.isPublished && (
                          <button
                            type="button"
                            onClick={() => handleDelete(n)}
                            className="inline-flex items-center gap-1 font-medium text-red-500 hover:underline"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        )}
                      </>
                    </div>
                  </motion.div>
                );
              }}
              table={
                <CustomTable
                  data={notices}
                  columns={columns}
                  actions={actions}
                  isLoading={isLoading}
                  title="Notice register"
                  description="Draft, approved and published institutional communication with audience and readership status."
                  onRefresh={() => mutate()}
                  customActions={
                    canCreate ? (
                      <CustomButton
                        startIcon={<Plus className="h-4 w-4" />}
                        onClick={() => {
                          setEditNotice(null);
                          setShowModal(true);
                        }}
                      >
                        New notice
                      </CustomButton>
                    ) : undefined
                  }
                  options={{
                    search: true,
                    refresh: true,
                    export: true,
                    pagination: true,
                    pageSize: 10,
                  }}
                  localization={{ toolbar: { searchPlaceholder: 'Search notices…' } }}
                />
              }
            />
          )}
        </>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <NoticeModal
          notice={editNotice}
          onClose={() => {
            setShowModal(false);
            setEditNotice(null);
          }}
          onSaved={() => {
            mutate();
            setShowModal(false);
            setEditNotice(null);
          }}
        />
      )}

      {/* Detail Drawer */}
      <AnimatePresence>
        {detailNotice && (
          <NoticeDetailDrawer
            notice={detailNotice}
            isAdmin={true}
            onClose={() => setDetailNotice(null)}
            onEdit={(n) => {
              setEditNotice(n);
              setShowModal(true);
            }}
            onDelete={(n) => handleDelete(n)}
            onPublish={(n) => handlePublish(n)}
            onMarkRead={() => undefined}
            processing={processing}
            canEdit={canEdit}
            canPublish={canPublish}
            canDelete={canDelete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function NoticeAnalytics({
  data,
  loading,
  onRefresh,
}: {
  data?: INoticeStats;
  loading: boolean;
  onRefresh: () => void;
}) {
  const summary = data?.summary;
  const cards = [
    {
      label: 'Active notices',
      value: summary?.active ?? 0,
      icon: Radio,
      tone: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Published',
      value: summary?.published ?? 0,
      icon: Send,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Draft queue',
      value: summary?.drafts ?? 0,
      icon: BellOff,
      tone: 'bg-slate-100 text-slate-700',
    },
    {
      label: 'Urgent notices',
      value: summary?.urgent ?? 0,
      icon: AlertTriangle,
      tone: 'bg-rose-50 text-rose-700',
    },
    {
      label: 'Recorded reads',
      value: summary?.reads ?? 0,
      icon: Eye,
      tone: 'bg-violet-50 text-violet-700',
    },
    {
      label: 'Total notices',
      value: summary?.total ?? 0,
      icon: Bell,
      tone: 'bg-amber-50 text-amber-700',
    },
  ];
  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Communication intelligence</h2>
          <p className="text-sm text-slate-500">
            Publishing health, audience mix, priority distribution and readership momentum.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-primary hover:text-primary"
        >
          Refresh
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, tone }, index) => (
          <motion.article
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: index * 0.035 }}
            className="flex min-h-20 items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tone}`}>
                <Icon className="h-5 w-5" />
              </span>
              <p className="text-sm font-semibold text-slate-600">{label}</p>
            </div>
            <p className="shrink-0 text-2xl font-black text-slate-950">{loading ? '—' : value}</p>
          </motion.article>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <NoticePanel
          title="Publishing & readership trend"
          description="Published notices and accumulated reads by month."
        >
          <NoticeTrend data={data?.publishingTrend ?? []} />
        </NoticePanel>
        <NoticePanel title="Priority mix" description="Communication volume and reads by urgency.">
          <NoticeRank
            data={(data?.byPriority ?? []).map((item) => ({
              label: item._id,
              value: item.count,
              detail: `${item.reads} reads`,
            }))}
          />
        </NoticePanel>
      </div>
      <NoticePanel
        title="Audience targeting"
        description="Distribution by global, department, role and programme audiences."
      >
        <NoticeRank
          data={(data?.byType ?? []).map((item) => ({
            label: TYPE_CFG[item._id]?.label ?? item._id,
            value: item.count,
            detail: `${item.reads} reads`,
          }))}
          horizontal
        />
      </NoticePanel>
    </section>
  );
}
function NoticePanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        <div>
          <h3 className="font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <div className="mt-5 overflow-x-auto">{children}</div>
    </article>
  );
}
function NoticeTrend({ data }: { data: INoticeStats['publishingTrend'] }) {
  if (!data.length)
    return <NoticeEmpty text="Publishing trends appear after the first notice is approved." />;
  const visible = data.slice(-10),
    max = Math.max(...visible.map((item) => Math.max(item.reads, item.published)), 1),
    x = (index: number) => 40 + index * 57,
    y = (value: number) => 150 - (value / max) * 112,
    reads = visible.map((item, index) => `${x(index)},${y(item.reads)}`).join(' '),
    published = visible.map((item, index) => `${x(index)},${y(item.published)}`).join(' ');
  return (
    <svg
      viewBox="0 0 600 190"
      role="img"
      aria-label="Monthly notice publishing and readership trend"
      className="h-48 min-w-[520px] w-full"
    >
      <defs>
        <linearGradient id="noticeReads" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0178d7" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#0178d7" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[38, 75, 112, 150].map((line) => (
        <line
          key={line}
          x1="40"
          x2="554"
          y1={line}
          y2={line}
          stroke="#e2e8f0"
          strokeDasharray="4 5"
        />
      ))}
      <polygon points={`40,150 ${reads} 554,150`} fill="url(#noticeReads)" />
      <polyline
        points={reads}
        fill="none"
        stroke="#0178d7"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points={published}
        fill="none"
        stroke="#7c3aed"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {visible.map((item, index) => (
        <g key={item._id}>
          <circle
            cx={x(index)}
            cy={y(item.reads)}
            r="4"
            fill="white"
            stroke="#0178d7"
            strokeWidth="2.5"
          >
            <title>{`${item._id}: ${item.published} published, ${item.reads} reads`}</title>
          </circle>
          <text x={x(index)} y="177" textAnchor="middle" fontSize="9" fill="#64748b">
            {item._id.slice(5)}
          </text>
        </g>
      ))}
    </svg>
  );
}
function NoticeRank({
  data,
  horizontal = false,
}: {
  data: Array<{ label: string; value: number; detail: string }>;
  horizontal?: boolean;
}) {
  const max = Math.max(...data.map((item) => item.value), 1);
  if (!data.length) return <NoticeEmpty text="No notice distribution data is available yet." />;
  return (
    <div className={horizontal ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4' : 'space-y-4'}>
      {data.map((item) => (
        <div key={item.label}>
          <div className="mb-1.5 flex justify-between gap-3 text-xs">
            <span className="capitalize text-slate-600">{item.label}</span>
            <span>
              <strong>{item.value}</strong> · {item.detail}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
function NoticeEmpty({ text }: { text: string }) {
  return (
    <div className="grid min-h-36 place-items-center rounded-lg border border-dashed border-slate-200 px-5 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export — picks view based on role
// ─────────────────────────────────────────────────────────────────────────────
export default function NoticePage() {
  const canView = useHasPermission('notice', 'view');
  const canCreate = useHasPermission('notice', 'create');
  const canEdit = useHasPermission('notice', 'edit');
  const canApprove = useHasPermission('notice', 'approve');
  const canDelete = useHasPermission('notice', 'delete');
  const canManage = canCreate || canEdit || canApprove || canDelete;
  if (!canView) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Notice access unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">Your active role cannot view notices.</p>
      </div>
    );
  }
  return canManage ? <NoticeManagementBoard /> : <NoticeBulletinBoard />;
}

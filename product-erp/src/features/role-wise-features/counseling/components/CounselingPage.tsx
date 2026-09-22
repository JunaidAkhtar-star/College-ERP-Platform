/**
 * @file CounselingPage.tsx
 * @description Counseling sessions management.
 * Full: list, stats, schedule modal, detail drawer, conduct, follow-up, cancel.
 * @module features/role-wise-features/counseling
 */
'use client';

import React, { useState, useMemo } from 'react';
import StudentSupportWorkflowBar from '@/shared/components/StudentSupportWorkflowBar';
import AsyncSelect from '@/shared/core/AsyncSelect';
import {
  Heart,
  CheckCircle,
  Calendar,
  Plus,
  AlertCircle,
  Search,
  Eye,
  RotateCw,
  SlidersHorizontal,
  ListFilter,
  Tags,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import CustomButton from '@/shared/core/CustomButton';
import useSwr from '@/shared/hooks/useSwr';
import { ICounselingSession, ICounselingStats, TCounselingStatus } from '../types/counseling.types';
import ScheduleSessionModal from './ScheduleSessionModal';
import CounselingDetailDrawer from './CounselingDetailDrawer';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import CounselingInsights from './CounselingInsights';

const STATUS_CFG: Record<
  TCounselingStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  scheduled: { label: 'Scheduled', bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-400' },
  in_progress: {
    label: 'In Progress',
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    dot: 'bg-amber-400',
  },
  completed: { label: 'Completed', bg: 'bg-green-50', text: 'text-green-600', dot: 'bg-green-400' },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    dot: 'bg-slate-400',
  },
  follow_up_required: {
    label: 'Follow-up',
    bg: 'bg-orange-50',
    text: 'text-orange-600',
    dot: 'bg-orange-400',
  },
  parent_meeting_required: {
    label: 'Parent Meeting',
    bg: 'bg-red-50',
    text: 'text-red-500',
    dot: 'bg-red-400',
  },
};

const TYPE_COLORS: Record<string, string> = {
  academic: 'bg-primary-50 text-primary',
  personal: 'bg-purple-50 text-purple-600',
  career: 'bg-cyan-50 text-cyan-600',
  disciplinary: 'bg-red-50 text-red-500',
  medical: 'bg-pink-50 text-pink-600',
  financial: 'bg-amber-50 text-amber-600',
};

function getStudentName(session: ICounselingSession): string {
  if (session.studentName) return session.studentName;
  if (typeof session.student === 'object')
    return (session.student as { name?: string }).name ?? '—';
  return '—';
}

export default function CounselingPage() {
  const canCreate = useHasPermission('counseling', 'create');
  const canEdit = useHasPermission('counseling', 'edit');
  const canViewSensitiveNotes = useHasPermission('counseling_notes', 'view');
  const canEditSensitiveNotes = useHasPermission('counseling_notes', 'edit');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const handleFilterStatus = (v: string) => {
    setFilterStatus(v);
    setPage(1);
  };
  const handleFilterType = (v: string) => {
    setFilterType(v);
    setPage(1);
  };
  const apiUrl = useMemo(() => {
    const q = new URLSearchParams();
    q.set('page', String(page));
    q.set('limit', '15');
    if (filterStatus) q.set('status', filterStatus);
    if (filterType) q.set('type', filterType);
    return `counseling/sessions?${q.toString()}`;
  }, [page, filterStatus, filterType]);

  const { data: raw, error, isLoading, isValidating, mutate } = useSwr(apiUrl);
  const {
    data: statsRaw,
    error: statsError,
    isValidating: statsValidating,
    mutate: mutateStats,
  } = useSwr('counseling/stats');
  const records = useMemo(
    () => (raw as { data?: { data?: ICounselingSession[] } })?.data?.data ?? [],
    [raw],
  );
  const totalCount = useMemo(
    () => (raw as { data?: { total?: number } })?.data?.total ?? records.length,
    [raw, records],
  );

  const stats = (
    statsRaw as {
      data?: {
        totalSessions?: number;
        completedSessions?: number;
        pendingSessions?: number;
        followUpRequired?: number;
      };
    }
  )?.data as ICounselingStats | undefined;

  const refreshAll = () => {
    void Promise.all([mutate(), mutateStats()]);
  };

  const columns: Column<ICounselingSession>[] = [
    {
      field: 'sessionNumber',
      title: 'Session #',
      render: (row) => (
        <span className="font-mono text-xs text-slate-500">{row.sessionNumber}</span>
      ),
    },
    {
      field: 'student',
      title: 'Student',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary">
            {getStudentName(row).charAt(0)}
          </div>
          <span className="text-sm font-medium text-slate-800">{getStudentName(row)}</span>
        </div>
      ),
    },
    {
      field: 'type',
      title: 'Type',
      render: (row) => (
        <span
          className={`capitalize rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_COLORS[row.type] ?? 'bg-slate-100 text-slate-500'}`}
        >
          {row.type}
        </span>
      ),
    },
    {
      field: 'scheduledAt',
      title: 'Scheduled',
      render: (row) => (
        <div>
          <p className="text-sm text-slate-600">
            {new Date(row.scheduledAt).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </p>
          <p className="text-xs text-slate-600">
            {new Date(row.scheduledAt).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      ),
    },
    {
      field: 'mode',
      title: 'Mode',
      render: (row) => (
        <span className="capitalize text-xs text-slate-500">{row.mode.replace('_', ' ')}</span>
      ),
    },
    {
      field: 'status',
      title: 'Status',
      render: (row) => {
        const c = STATUS_CFG[row.status] ?? STATUS_CFG.scheduled;
        return (
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
              {c.label}
            </span>
            {row.status === 'parent_meeting_required' && (
              <AlertCircle className="h-3.5 w-3.5 text-red-400" />
            )}
          </div>
        );
      },
    },
  ];

  const actions: Action<ICounselingSession>[] = [
    {
      tooltip: canEdit ? 'View / Update' : 'View details',
      icon: <Eye className="h-4 w-4 text-primary" />,
      onClick: (row) => setSelectedId(row._id),
    },
  ];

  return (
    <div className="space-y-5">
      <StudentSupportWorkflowBar />
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Counseling</h1>
          <p className="mt-1 text-sm text-slate-500">
            Coordinate private student-support sessions, outcomes, and accountable follow-ups.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refreshAll}
            disabled={isValidating || statsValidating}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-primary-100 hover:bg-primary-50 hover:text-primary disabled:cursor-wait disabled:opacity-60"
          >
            <RotateCw
              className={`h-4 w-4 ${isValidating || statsValidating ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowFilters((visible) => !visible)}
            aria-expanded={showFilters}
            aria-controls="counseling-filter-panel"
            className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors ${
              showFilters || filterStatus || filterType
                ? 'border-primary-100 bg-primary-50 text-primary'
                : 'border-slate-200 bg-white text-slate-600 hover:border-primary-100 hover:bg-primary-50 hover:text-primary'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {(filterStatus || filterType) && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
                {[filterStatus, filterType].filter(Boolean).length}
              </span>
            )}
          </button>
          {canCreate && (
            <CustomButton
              variant="primary"
              startIcon={<Plus className="h-4 w-4" />}
              onClick={() => setModalOpen(true)}
              className="w-fit!"
            >
              Schedule Session
            </CustomButton>
          )}
        </div>
      </motion.div>

      {(error || statsError) && (
        <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          Counseling records or analytics could not be loaded. Missing values are not estimated.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: 'Total Sessions',
            description: 'Current academic year',
            value: stats?.totalSessions ?? '—',
            icon: <Heart className="h-4.5 w-4.5" />,
            color: 'bg-primary-50 text-primary',
          },
          {
            label: 'Scheduled',
            description: 'Waiting to be conducted',
            value: stats?.pendingSessions ?? '—',
            icon: <Calendar className="h-4.5 w-4.5" />,
            color: 'bg-blue-50 text-blue-600',
          },
          {
            label: 'Completed',
            description: 'Outcome recorded',
            value: stats?.completedSessions ?? '—',
            icon: <CheckCircle className="h-4.5 w-4.5" />,
            color: 'bg-green-50 text-green-600',
          },
          {
            label: 'Needs Attention',
            description: 'Follow-up or parent meeting',
            value: stats?.followUpRequired ?? '—',
            icon: <AlertCircle className="h-4.5 w-4.5" />,
            color: 'bg-red-50 text-red-500',
          },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.07 }}
            whileHover={{ y: -3 }}
            className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 transition-colors hover:border-primary-100"
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.color}`}
              >
                {s.icon}
              </div>
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {isLoading ? '—' : s.value}
              </span>
            </div>
            <div className="mt-4">
              <p className="text-sm font-semibold text-slate-700">{s.label}</p>
              <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{s.description}</p>
            </div>
            <motion.span
              className="absolute -bottom-8 -right-8 h-20 w-20 rounded-full bg-primary-50/50"
              initial={false}
              whileHover={{ scale: 1.18 }}
            />
          </motion.div>
        ))}
      </div>

      <CounselingInsights stats={stats} isLoading={isLoading || !stats} />

      {/* Filters */}
      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.div
            id="counseling-filter-panel"
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="overflow-hidden rounded-2xl border border-slate-100 bg-white"
          >
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
                  <SlidersHorizontal className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Session filters</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Refine the register without changing your access scope.
                  </p>
                </div>
              </div>
              {(filterStatus || filterType) && (
                <CustomButton
                  type="button"
                  variant="tertiary"
                  startIcon={<X className="h-3.5 w-3.5" />}
                  onClick={() => {
                    handleFilterStatus('');
                    handleFilterType('');
                  }}
                  className="w-fit! py-1.5! text-xs!"
                >
                  Clear filters
                </CustomButton>
              )}
            </div>

            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
              <div className="rounded-xl bg-slate-50 p-3">
                <label
                  htmlFor="counseling-status-filter"
                  className="flex items-center gap-2 text-xs font-semibold text-slate-700"
                >
                  <ListFilter className="h-3.5 w-3.5 text-blue-500" />
                  Workflow status
                </label>
                <select
                  id="counseling-status-filter"
                  value={filterStatus}
                  onChange={(e) => handleFilterStatus(e.target.value)}
                  className="mt-2 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">All statuses</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="follow_up_required">Follow-up Required</option>
                  <option value="parent_meeting_required">Parent Meeting Required</option>
                </select>
                <p className="mt-2 text-[11px] text-slate-500">
                  {filterStatus
                    ? `Showing ${STATUS_CFG[filterStatus as TCounselingStatus]?.label ?? 'selected'} sessions`
                    : 'Showing every workflow state'}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <label
                  htmlFor="counseling-type-filter"
                  className="flex items-center gap-2 text-xs font-semibold text-slate-700"
                >
                  <Tags className="h-3.5 w-3.5 text-violet-500" />
                  Counseling purpose
                </label>
                <select
                  id="counseling-type-filter"
                  value={filterType}
                  onChange={(e) => handleFilterType(e.target.value)}
                  className="mt-2 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">All counseling types</option>
                  <option value="academic">Academic</option>
                  <option value="personal">Personal</option>
                  <option value="career">Career</option>
                  <option value="disciplinary">Disciplinary</option>
                  <option value="medical">Medical</option>
                  <option value="financial">Financial</option>
                </select>
                <p className="mt-2 text-[11px] text-slate-500">
                  {filterType
                    ? `Focused on ${filterType} counseling`
                    : 'Including every counseling purpose'}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
      >
        <DataViewSwitcher<ICounselingSession>
          data={records}
          isLoading={isLoading}
          storageKey="counseling.view"
          showSearch={false}
          pageSize={15}
          renderCard={(s) => {
            const statusStyle =
              s.status === 'completed'
                ? 'bg-green-50 text-green-600'
                : s.status === 'cancelled'
                  ? 'bg-red-50 text-red-500'
                  : s.status === 'in_progress'
                    ? 'bg-blue-50 text-blue-600'
                    : 'bg-amber-50 text-amber-600';
            return (
              <motion.div
                whileHover={{ y: -2 }}
                onClick={() => setSelectedId(s._id)}
                className="flex cursor-pointer flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 transition-colors hover:border-primary-100"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
                    <Heart className="h-5 w-5" />
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${statusStyle}`}
                  >
                    {(s.status ?? '').replace(/_/g, ' ')}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{getStudentName(s)}</p>
                  <p className="text-xs text-slate-600">
                    Session #{s.sessionNumber} · {s.type ?? '—'}
                  </p>
                </div>
                <div className="space-y-1.5 text-xs text-slate-500">
                  <p className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 text-slate-600" />
                    <span>
                      {s.scheduledAt
                        ? new Date(s.scheduledAt).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </span>
                  </p>
                  {s.mode && (
                    <p className="flex items-center gap-1.5">
                      <AlertCircle className="h-3 w-3 text-slate-600" />
                      <span className="capitalize">{s.mode.replace(/_/g, ' ')}</span>
                    </p>
                  )}
                </div>
              </motion.div>
            );
          }}
          table={
            <div className="rounded-2xl bg-white overflow-hidden">
              <CustomTable
                title="Counseling session register"
                description="Review scheduled meetings, outcomes, delivery modes, and current follow-up status."
                data={records}
                columns={columns}
                actions={actions}
                isLoading={isLoading}
                isValidating={isValidating}
                onRefresh={refreshAll}
                page={page}
                totalCount={totalCount}
                pageSize={15}
                onPageChange={setPage}
                options={{
                  search: false,
                  refresh: true,
                  pagination: true,
                  pageSize: 15,
                  responsive: true,
                }}
              />
            </div>
          }
        />
      </motion.div>

      {canCreate && (
        <ScheduleSessionModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onCreated={refreshAll}
        />
      )}

      {/* Detail Drawer */}
      <CounselingDetailDrawer
        sessionId={selectedId}
        canEdit={canEdit}
        canViewSensitiveNotes={canViewSensitiveNotes}
        canEditSensitiveNotes={canEditSensitiveNotes}
        onClose={() => setSelectedId(null)}
        onUpdated={refreshAll}
      />

      {canEdit && <StudentTimelineLookup onSelectSession={setSelectedId} />}
    </div>
  );
}

// ─── Student Timeline Lookup ────────────────────────────────────────────────────────────
function StudentTimelineLookup({ onSelectSession }: { onSelectSession: (id: string) => void }) {
  const [studentId, setStudentId] = useState('');
  const [submitted, setSubmitted] = useState('');
  const { data, error, isLoading } = useSwr(
    submitted ? `counseling/students/${submitted}/sessions` : null,
  );
  const sessions = (data?.data ?? []) as ICounselingSession[];

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (studentId.trim()) setSubmitted(studentId.trim());
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <Search className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-slate-800">Student Session Timeline</h3>
      </div>
      <form onSubmit={onSubmit} className="mb-4 flex flex-wrap items-end gap-3">
        <AsyncSelect
          type="students"
          label="Student"
          value={studentId || null}
          onChange={(value) => setStudentId(value ?? '')}
          placeholder="Search by student name or roll number"
          className="min-w-72"
        />
        <CustomButton type="submit" className="py-1.5! text-xs! w-fit!">
          Show Timeline
        </CustomButton>
        {submitted && (
          <button
            type="button"
            onClick={() => {
              setSubmitted('');
              setStudentId('');
            }}
            className="text-xs text-slate-600 hover:text-slate-600 underline"
          >
            Clear
          </button>
        )}
      </form>
      <AnimatePresence>
        {error && (
          <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
            This student timeline could not be loaded.
          </p>
        )}
        {isLoading && <div className="h-24 animate-pulse rounded-lg bg-slate-50" />}
        {!isLoading && submitted && sessions.length === 0 && (
          <p className="text-center text-xs text-slate-600 py-8">No sessions found for student</p>
        )}
        {!isLoading && sessions.length > 0 && (
          <div className="relative border-l border-slate-100 pl-5 space-y-3">
            {sessions.map((s) => {
              const c = STATUS_CFG[s.status] ?? STATUS_CFG.scheduled;
              return (
                <motion.div
                  key={s._id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="relative"
                >
                  <span
                    className={`absolute -left-7 top-1.5 h-3 w-3 rounded-full ring-4 ring-white ${c.dot}`}
                  />
                  <button
                    type="button"
                    onClick={() => onSelectSession(s._id!)}
                    className="w-full rounded-lg bg-slate-50 p-3 text-left hover:bg-slate-100"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-800">
                        Session #{s.sessionNumber} · {s.type}
                      </p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${c.bg} ${c.text}`}>
                        {c.label}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {s.scheduledAt
                        ? new Date(s.scheduledAt).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </p>
                    {s.counselorNotes && (
                      <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">
                        {s.counselorNotes}
                      </p>
                    )}
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

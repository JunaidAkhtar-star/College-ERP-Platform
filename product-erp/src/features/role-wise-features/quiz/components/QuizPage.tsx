/**
 * @file QuizPage.tsx
 * @description Quiz module — role-aware:
 *   - Faculty / HOD / admin: manage quizzes, view attempts, proctoring log
 *   - Student: see available quizzes, take quiz, see past results
 * @module features/role-wise-features/quiz
 */
'use client';

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import {
  HelpCircle,
  Plus,
  Play,
  CheckCircle,
  Clock,
  Trash2,
  Edit2,
  Filter,
  BarChart2,
  Shield,
  Trophy,
  BookOpen,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { useAuthStore } from '@/shared/store/authStore';
import { IQuiz } from '../types/quiz.types';

const QuizModal = dynamic(() => import('./QuizModal'), { loading: () => null });
const QuizTakeMode = dynamic(() => import('./QuizTakeMode'), { loading: () => null });

const STAFF_ROLES = [
  'super_admin',
  'admin',
  'principal',
  'dean_academic',
  'hod',
  'faculty',
  'examination_cell',
];
const MANAGE_ROLES = ['super_admin', 'hod', 'faculty'];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Faculty management view ─────────────────────────────────────────────────
function FacultyQuizBoard({ canAuthor, canManage }: { canAuthor: boolean; canManage: boolean }) {
  const [showModal, setShowModal] = useState(false);
  const [editQuiz, setEditQuiz] = useState<IQuiz | null>(null);
  const [filterType, setFilterType] = useState('');
  const [viewProctor, setViewProctor] = useState<IQuiz | null>(null);

  const qp = new URLSearchParams();
  if (filterType) qp.set('quizType', filterType);
  const {
    data: raw,
    error,
    isLoading,
    mutate,
  } = useSwr(`quiz${qp.toString() ? '?' + qp.toString() : ''}`);
  const quizzes: IQuiz[] = useMemo(() => {
    const d = raw as { data?: IQuiz[] };
    return d?.data ?? [];
  }, [raw]);

  const { mutation } = useMutation();

  const handleDelete = async (q: IQuiz) => {
    const r = await Swal.fire({
      title: 'Delete quiz?',
      text: q.title,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#d33',
    });
    if (!r.isConfirmed) return;
    const res = await mutation(`quiz/${q._id}`, { method: 'DELETE', isAlert: true });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Deleted');
      mutate();
    } else toast.error('Failed');
  };

  const handleLifecycle = async (q: IQuiz, action: 'publish' | 'close') => {
    const res = await mutation(`quiz/${q._id}/${action}`, { method: 'POST' });
    if (!res?.results?.success) return;
    toast.success(action === 'publish' ? 'Quiz published' : 'Quiz closed');
    await mutate();
  };

  const { data: proctorRaw, isLoading: proctorLoading } = useSwr(
    viewProctor ? `quiz/${viewProctor._id}/proctor-log` : null,
  );
  const proctorEvents = (proctorRaw as { data?: unknown[] })?.data ?? [];

  const columns: Column<IQuiz>[] = [
    {
      field: 'title',
      title: 'Quiz',
      render: (row) => (
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-800">{row.title}</p>
            {row.quizType === 'surprise' && (
              <span className="flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">
                <Zap className="h-2.5 w-2.5" /> SURPRISE
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            {row.subjectCode} · Sem {row.semester} · {row.section}
          </p>
        </div>
      ),
    },
    {
      field: 'quizType',
      title: 'Type',
      render: (row) => (
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${row.quizType === 'surprise' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'}`}
        >
          {row.quizType}
        </span>
      ),
    },
    {
      field: 'durationMinutes',
      title: 'Duration',
      render: (row) => <span className="text-sm text-slate-600">{row.durationMinutes} min</span>,
    },
    {
      field: 'questions',
      title: 'Questions',
      render: (row) => <span className="text-sm text-slate-600">{row.questions?.length ?? 0}</span>,
    },
    {
      field: 'totalMarks',
      title: 'Marks',
      render: (row) => (
        <span className="text-sm font-semibold text-slate-700">{row.totalMarks}</span>
      ),
    },
    {
      field: 'startDateTime',
      title: 'Start',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.startDateTime ? fmtDate(row.startDateTime) : '—'}
        </span>
      ),
    },
    {
      field: 'isActive',
      title: 'Status',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${row.isActive ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-600'}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${row.isActive ? 'bg-green-400' : 'bg-slate-400'}`}
          />
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      field: 'attempts',
      title: 'Attempts',
      render: (row) => <span className="text-sm text-slate-600">{row.attempts?.length ?? 0}</span>,
    },
    {
      field: 'proctoringEnabled',
      title: 'Proctoring',
      render: (row) =>
        row.proctoringEnabled ? (
          <span className="flex items-center gap-1 text-xs text-primary">
            <Shield className="h-3 w-3" /> On
          </span>
        ) : (
          <span className="text-xs text-slate-300">Off</span>
        ),
    },
  ];

  const actions: Action<IQuiz>[] = [
    {
      tooltip: 'Edit',
      icon: <Edit2 className="h-4 w-4 text-slate-500" />,
      onClick: (q) => {
        setEditQuiz(q);
        setShowModal(true);
      },
      hidden: (q) => !canManage || q.status !== 'draft',
    },
    {
      tooltip: 'Proctor Log',
      icon: <Shield className="h-4 w-4 text-primary" />,
      onClick: (q) => setViewProctor(q),
      hidden: (q) => !canManage || !q.proctoringEnabled,
    },
    {
      tooltip: 'Delete',
      icon: <Trash2 className="h-4 w-4 text-red-400" />,
      onClick: (q) => handleDelete(q),
      hidden: (q) => !canManage || q.status !== 'draft',
    },
    {
      tooltip: 'Publish',
      icon: <Play className="h-4 w-4 text-green-600" />,
      onClick: (q) => void handleLifecycle(q, 'publish'),
      hidden: (q) => !canManage || q.status !== 'draft',
    },
    {
      tooltip: 'Close',
      icon: <CheckCircle className="h-4 w-4 text-amber-600" />,
      onClick: (q) => void handleLifecycle(q, 'close'),
      hidden: (q) => !canManage || q.status !== 'published',
    },
  ];

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Quizzes could not be loaded</h1>
        <p className="mt-2 text-sm text-red-600">{error.message}</p>
        <CustomButton className="mx-auto mt-4 w-fit!" onClick={() => mutate()}>
          Try again
        </CustomButton>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quiz Management</h1>
          <p className="mt-0.5 text-sm text-slate-500">Create, schedule and monitor quizzes</p>
        </div>
        {canAuthor && (
          <CustomButton
            variant="primary"
            startIcon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setEditQuiz(null);
              setShowModal(true);
            }}
            className="w-fit!"
          >
            Create Quiz
          </CustomButton>
        )}
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: 'Total',
            value: quizzes.length,
            icon: <HelpCircle className="h-4.5 w-4.5" />,
            color: 'bg-primary-50 text-primary',
          },
          {
            label: 'Active',
            value: quizzes.filter((q) => q.isActive).length,
            icon: <Play className="h-4.5 w-4.5" />,
            color: 'bg-blue-50 text-blue-600',
          },
          {
            label: 'Surprise',
            value: quizzes.filter((q) => q.quizType === 'surprise').length,
            icon: <Zap className="h-4.5 w-4.5" />,
            color: 'bg-amber-50 text-amber-600',
          },
          {
            label: 'Attempts',
            value: quizzes.reduce((s, q) => s + (q.attempts?.length ?? 0), 0),
            icon: <BarChart2 className="h-4.5 w-4.5" />,
            color: 'bg-green-50 text-green-600',
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

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4">
        <Filter className="h-3.5 w-3.5 text-slate-600" />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:outline-none"
        >
          <option value="">All Types</option>
          <option value="scheduled">Scheduled</option>
          <option value="surprise">Surprise</option>
        </select>
        {filterType && (
          <button
            type="button"
            onClick={() => setFilterType('')}
            className="text-xs text-slate-600 underline"
          >
            Clear
          </button>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <DataViewSwitcher<IQuiz>
          data={quizzes}
          isLoading={isLoading}
          storageKey="quiz.view"
          searchPlaceholder="Search quizzes…"
          searchFields={['title', 'subjectName', 'subjectCode', 'quizType']}
          renderCard={(q) => {
            const isActive = q.isActive !== false;
            return (
              <motion.div
                whileHover={{ y: -2 }}
                className="flex flex-col gap-3 rounded-2xl bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
                    <HelpCircle className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${isActive ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}
                    >
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                    {q.proctoringEnabled && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                        <Shield className="h-2.5 w-2.5" /> Proctored
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 line-clamp-1">{q.title}</p>
                  {q.subjectName && (
                    <p className="text-xs text-slate-500">
                      {q.subjectName}
                      {q.subjectCode ? ` · ${q.subjectCode}` : ''}
                    </p>
                  )}
                  {q.quizType && (
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-600">
                      {q.quizType}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                    <p className="text-[9px] uppercase text-slate-600">Marks</p>
                    <p className="font-bold text-slate-800">{q.totalMarks ?? '—'}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                    <p className="text-[9px] uppercase text-slate-600">Min</p>
                    <p className="font-bold text-slate-800">{q.durationMinutes ?? '—'}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                    <p className="text-[9px] uppercase text-slate-600">Qs</p>
                    <p className="font-bold text-slate-800">
                      {Array.isArray(q.questions) ? q.questions.length : 0}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 text-xs">
                  {canManage && q.status === 'draft' && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditQuiz(q);
                        setShowModal(true);
                      }}
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      <Edit2 className="h-3 w-3" /> Edit
                    </button>
                  )}
                  {canManage && q.proctoringEnabled && (
                    <button
                      type="button"
                      onClick={() => setViewProctor(q)}
                      className="inline-flex items-center gap-1 font-medium text-amber-600 hover:underline"
                    >
                      <Shield className="h-3 w-3" /> Logs
                    </button>
                  )}
                  {canManage && q.status === 'draft' && (
                    <button
                      type="button"
                      onClick={() => handleDelete(q)}
                      className="inline-flex items-center gap-1 font-medium text-red-500 hover:underline"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  )}
                  {canManage && q.status === 'draft' && (
                    <button
                      type="button"
                      onClick={() => void handleLifecycle(q, 'publish')}
                      className="inline-flex items-center gap-1 font-medium text-green-600 hover:underline"
                    >
                      <Play className="h-3 w-3" /> Publish
                    </button>
                  )}
                  {canManage && q.status === 'published' && (
                    <button
                      type="button"
                      onClick={() => void handleLifecycle(q, 'close')}
                      className="inline-flex items-center gap-1 font-medium text-amber-600 hover:underline"
                    >
                      <CheckCircle className="h-3 w-3" /> Close
                    </button>
                  )}
                </div>
              </motion.div>
            );
          }}
          table={
            <div className="overflow-hidden rounded-2xl bg-white">
              <CustomTable
                data={quizzes}
                columns={columns}
                actions={actions}
                isLoading={isLoading}
                options={{ search: true, pagination: true, pageSize: 10 }}
                localization={{ toolbar: { searchPlaceholder: 'Search quizzes…' } }}
              />
            </div>
          }
        />
      </motion.div>

      <AnimatePresence>
        {viewProctor && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
              onClick={() => setViewProctor(null)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative z-10 flex w-full max-w-md flex-col bg-white "
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Proctoring Log</h2>
                  <p className="text-xs text-slate-600">{viewProctor.title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewProctor(null)}
                  className="text-slate-600 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                {proctorLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 rounded-lg bg-slate-100 animate-pulse" />
                    ))}
                  </div>
                ) : proctorEvents.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-slate-300">
                    <Shield className="h-8 w-8 mb-2" />
                    <p className="text-sm text-slate-600">No proctoring events</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(proctorEvents as Record<string, unknown>[]).map((ev, i) => {
                      const student = ev.studentId;
                      const studentLabel =
                        student && typeof student === 'object'
                          ? String(
                              (student as { name?: string; rollNumber?: string }).name ||
                                (student as { name?: string; rollNumber?: string }).rollNumber ||
                                'Student record unavailable',
                            )
                          : 'Student record unavailable';
                      return (
                        <div key={i} className="rounded-lg bg-slate-50 px-4 py-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-700 capitalize">
                              {String(ev.eventType ?? '').replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs text-slate-600">
                              {ev.timestamp
                                ? new Date(String(ev.timestamp)).toLocaleTimeString('en-IN')
                                : ''}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">Student: {studentLabel}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showModal && canManage && (
          <QuizModal
            quiz={editQuiz}
            onClose={() => {
              setShowModal(false);
              setEditQuiz(null);
            }}
            onSaved={() => {
              mutate();
              setShowModal(false);
              setEditQuiz(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Student view ─────────────────────────────────────────────────────────────
function StudentQuizBoard() {
  const [activeQuiz, setActiveQuiz] = useState<IQuiz | null>(null);
  const [filterType, setFilterType] = useState('');
  const [viewAttempt, setViewAttempt] = useState<string | null>(null);

  const qp = new URLSearchParams();
  if (filterType) qp.set('quizType', filterType);
  const {
    data: raw,
    error,
    isLoading,
    mutate,
  } = useSwr(`quiz${qp.toString() ? '?' + qp.toString() : ''}`);
  const quizzes: IQuiz[] = useMemo(() => (raw as { data?: IQuiz[] })?.data ?? [], [raw]);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Quizzes could not be loaded</h1>
        <p className="mt-2 text-sm text-red-600">{error.message}</p>
        <CustomButton className="mx-auto mt-4 w-fit!" onClick={() => mutate()}>
          Try again
        </CustomButton>
      </div>
    );
  }

  if (activeQuiz) {
    return (
      <QuizTakeMode
        quiz={activeQuiz}
        onClose={() => {
          setActiveQuiz(null);
          mutate();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Quizzes</h1>
          <p className="mt-0.5 text-sm text-slate-500">Available assessments for your subjects</p>
        </div>
        <div className="flex gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none"
          >
            <option value="">All Types</option>
            <option value="scheduled">Scheduled</option>
            <option value="surprise">Surprise Test</option>
          </select>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-2xl bg-white animate-pulse" />
          ))}
        </div>
      ) : quizzes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-16 text-slate-300">
          <HelpCircle className="h-10 w-10 mb-2" />
          <p className="text-sm text-slate-600">No quizzes available right now</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((q, i) => {
            const hasAttempt = Boolean(q.myAttempt?.isSubmitted);
            const hasActiveAttempt = Boolean(q.myAttempt && !q.myAttempt.isSubmitted);
            const isExpired = q.endDateTime && new Date(q.endDateTime) < new Date();

            return (
              <motion.div
                key={q._id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl bg-white p-5 flex flex-col"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary shrink-0">
                    {q.quizType === 'surprise' ? (
                      <Zap className="h-5 w-5" />
                    ) : (
                      <BookOpen className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {q.quizType === 'surprise' && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                        SURPRISE
                      </span>
                    )}
                    {(hasAttempt || hasActiveAttempt) && (
                      <span className="flex items-center gap-0.5 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-600">
                        <CheckCircle className="h-2.5 w-2.5" />{' '}
                        {hasAttempt ? 'Done' : 'In progress'}
                      </span>
                    )}
                    {!hasAttempt && q.proctoringEnabled && (
                      <span className="flex items-center gap-0.5 rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary">
                        <Shield className="h-2.5 w-2.5" /> Proctored
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="text-sm font-bold text-slate-900 mb-1">{q.title}</h3>
                {q.description && (
                  <p className="text-xs text-slate-500 line-clamp-2 mb-3">{q.description}</p>
                )}

                <div className="mt-auto space-y-1.5 text-xs text-slate-500 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-3 w-3 shrink-0" />
                    {q.subjectCode} · Sem {q.semester} · {q.section}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 shrink-0" />
                    {q.durationMinutes} minutes · {q.questionCount ?? q.questions?.length ?? 0}{' '}
                    questions · {q.totalMarks} marks
                  </div>
                  {q.startDateTime && (
                    <div className="flex items-center gap-2">
                      <Trophy className="h-3 w-3 shrink-0" />
                      Starts {fmtDate(q.startDateTime)}
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  {hasAttempt ? (
                    <CustomButton
                      variant="secondary"
                      onClick={() => setViewAttempt(q._id)}
                      className="w-full"
                    >
                      View My Result
                    </CustomButton>
                  ) : isExpired && !hasActiveAttempt ? (
                    <div className="rounded-lg bg-slate-100 px-3 py-2 text-center text-xs font-semibold text-slate-600">
                      Expired
                    </div>
                  ) : (
                    <CustomButton
                      variant="primary"
                      startIcon={<Play className="h-4 w-4" />}
                      onClick={() => setActiveQuiz(q)}
                      className="w-full"
                    >
                      {hasActiveAttempt ? 'Resume Quiz' : 'Start Quiz'}
                    </CustomButton>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
      <AnimatePresence>
        {viewAttempt && (
          <MyAttemptDrawer quizId={viewAttempt} onClose={() => setViewAttempt(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Student My Attempt Drawer ───────────────────────────────────────────────────────
function MyAttemptDrawer({ quizId, onClose }: { quizId: string; onClose: () => void }) {
  interface IAttemptDetail {
    score?: number;
    totalMarks?: number;
    submittedAt?: string;
    timeSpentSeconds?: number;
    answers?: {
      questionId?: string;
      questionText?: string;
      selectedOption?: string;
      correctOption?: string;
      isCorrect?: boolean;
      marksObtained?: number;
      maxMarks?: number;
    }[];
  }
  const { data, isLoading } = useSwr<{ data?: IAttemptDetail }>(`quiz/${quizId}/my-attempt`);
  const att = data?.data;

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
        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
        className="relative z-10 h-dvh w-full max-w-lg overflow-y-auto bg-white p-6"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-slate-600 hover:bg-slate-100"
        >
          ✕
        </button>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">My Attempt</h2>
        {isLoading && <div className="h-32 animate-pulse rounded-xl bg-slate-50" />}
        {!isLoading && !att && (
          <p className="text-sm text-slate-600 py-8 text-center">No attempt found</p>
        )}
        {!isLoading && att && (
          <div className="space-y-4">
            <div className="rounded-xl bg-primary-50 p-4">
              <p className="text-xs text-slate-500">Score</p>
              <p className="text-3xl font-bold text-primary">
                {att.score ?? 0}
                <span className="text-sm text-slate-500"> / {att.totalMarks ?? 0}</span>
              </p>
              {att.submittedAt && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Submitted: {new Date(att.submittedAt).toLocaleString('en-IN')}
                </p>
              )}
              {att.timeSpentSeconds !== undefined && (
                <p className="text-[11px] text-slate-500">
                  Time: {Math.round(att.timeSpentSeconds / 60)} min
                </p>
              )}
            </div>
            {att.answers && att.answers.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700">Answers</p>
                {att.answers.map((a, idx) => (
                  <div
                    key={(a.questionId ?? '') + idx}
                    className={`rounded-lg p-3 ${a.isCorrect ? 'bg-green-50' : 'bg-red-50'}`}
                  >
                    <p className="text-xs text-slate-600">
                      <span className="font-semibold">Q{idx + 1}:</span> {a.questionText ?? ''}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-700">
                      Your answer: <span className="font-mono">{a.selectedOption ?? '—'}</span>
                    </p>
                    {!a.isCorrect && a.correctOption && (
                      <p className="text-[11px] text-green-700">
                        Correct: <span className="font-mono">{a.correctOption}</span>
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-slate-500">
                      Marks: {a.marksObtained ?? 0} / {a.maxMarks ?? 0}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
export default function QuizPage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const canView = useHasPermission('quiz', 'view');
  const hasEditPermission = useHasPermission('quiz', 'edit');
  const isStaff = STAFF_ROLES.includes(activeRole ?? '');
  const canAuthor = activeRole === 'faculty' && hasEditPermission;
  const canManage = MANAGE_ROLES.includes(activeRole ?? '') && hasEditPermission;
  if (!canView) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Quiz access unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">Your active role cannot view quizzes.</p>
      </div>
    );
  }
  return isStaff ? (
    <FacultyQuizBoard canAuthor={canAuthor} canManage={canManage} />
  ) : (
    <StudentQuizBoard />
  );
}

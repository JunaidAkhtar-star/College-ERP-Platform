/**
 * @file CounselingDetailDrawer.tsx
 * @description Slide-out drawer for session detail, conduct session form, follow-up actions.
 * @module features/role-wise-features/counseling
 */
'use client';

import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  X,
  User,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  Users,
  MessageSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { TCounselingStatus, IFollowUpAction, IConductSessionDto } from '../types/counseling.types';

const STATUS_CFG: Record<TCounselingStatus, { label: string; bg: string; text: string }> = {
  scheduled: { label: 'Scheduled', bg: 'bg-blue-50', text: 'text-blue-600' },
  in_progress: { label: 'In Progress', bg: 'bg-amber-50', text: 'text-amber-600' },
  completed: { label: 'Completed', bg: 'bg-green-50', text: 'text-green-600' },
  cancelled: { label: 'Cancelled', bg: 'bg-slate-100', text: 'text-slate-500' },
  follow_up_required: { label: 'Follow-up Required', bg: 'bg-orange-50', text: 'text-orange-600' },
  parent_meeting_required: {
    label: 'Parent Meeting Required',
    bg: 'bg-red-50',
    text: 'text-red-500',
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

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';

interface Props {
  sessionId: string | null;
  canEdit: boolean;
  canViewSensitiveNotes: boolean;
  canEditSensitiveNotes: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

const conductSchema = Yup.object({
  durationMinutes: Yup.number().min(1).optional(),
  counselorNotes: Yup.string().optional(),
  outcome: Yup.string().optional(),
});

export default function CounselingDetailDrawer({
  sessionId,
  canEdit,
  canViewSensitiveNotes,
  canEditSensitiveNotes,
  onClose,
  onUpdated,
}: Props) {
  const [showConductForm, setShowConductForm] = useState(false);
  const {
    data: raw,
    isLoading,
    mutate,
  } = useSwr(sessionId ? `counseling/sessions/${sessionId}` : null);
  const session = raw?.data ?? null;
  const { mutation, isLoading: processing } = useMutation();

  const conductFormik = useFormik<IConductSessionDto>({
    initialValues: {
      durationMinutes: undefined,
      counselorNotes: '',
      followUpActions: [],
      outcome: '',
      nextSessionDate: '',
      parentMeetingRequired: false,
      parentMeetingDate: '',
      parentMeetingNotes: '',
    },
    validationSchema: conductSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      const body: Record<string, unknown> = { ...values };
      if (!body.nextSessionDate) delete body.nextSessionDate;
      if (!body.parentMeetingDate) delete body.parentMeetingDate;
      if (!body.durationMinutes) delete body.durationMinutes;
      if (!canEditSensitiveNotes) delete body.counselorNotes;
      const res = await mutation(`counseling/sessions/${sessionId}/conduct`, {
        method: 'PATCH',
        body,
        isAlert: true,
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Session updated');
        mutate();
        onUpdated();
        setShowConductForm(false);
      } else {
        toast.error('Update failed');
      }
    },
  });

  const handleCancel = async () => {
    const res = await mutation(`counseling/sessions/${sessionId}/cancel`, {
      method: 'PATCH',
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Session cancelled');
      mutate();
      onUpdated();
    } else {
      toast.error('Cancel failed');
    }
  };

  const handleCompleteFollowUp = async (index: number) => {
    const res = await mutation(`counseling/sessions/${sessionId}/follow-up/${index}/complete`, {
      method: 'PATCH',
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Follow-up marked complete');
      mutate();
      onUpdated();
    } else {
      toast.error('Action failed');
    }
  };

  const studentName =
    typeof session?.student === 'object'
      ? ((session.student as { name?: string }).name ?? session.studentName)
      : session?.studentName;
  const counselorName =
    typeof session?.counselor === 'object'
      ? ((session.counselor as { name?: string }).name ?? session.counselorName)
      : session?.counselorName;

  return (
    <AnimatePresence>
      {sessionId && (
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
            className="relative z-10 flex w-full max-w-md flex-col overflow-hidden bg-white "
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">Session Details</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
                  ))}
                </div>
              ) : !session ? (
                <p className="text-sm text-slate-600">Session not found</p>
              ) : (
                <>
                  {/* Meta */}
                  <div className="rounded-xl bg-slate-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-slate-500">
                        {session.sessionNumber}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`capitalize rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_COLORS[session.type] ?? 'bg-slate-100 text-slate-500'}`}
                        >
                          {session.type}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CFG[session.status as TCounselingStatus]?.bg} ${STATUS_CFG[session.status as TCounselingStatus]?.text}`}
                        >
                          {STATUS_CFG[session.status as TCounselingStatus]?.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <User className="h-4 w-4 text-slate-600" />
                      <span className="font-medium">{studentName ?? '—'}</span>
                      <span className="text-slate-600">· Counselor: {counselorName ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar className="h-4 w-4 text-slate-600" />
                      {new Date(session.scheduledAt).toLocaleDateString('en-IN', {
                        weekday: 'long',
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                      {' · '}
                      {new Date(session.scheduledAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Clock className="h-4 w-4 text-slate-600" />
                      <span className="capitalize">{session.mode.replace('_', ' ')}</span>
                      {session.venue && <span className="text-slate-600">· {session.venue}</span>}
                      {session.durationMinutes && (
                        <span className="text-slate-600">· {session.durationMinutes} min</span>
                      )}
                    </div>
                    <div className="flex gap-1 text-xs text-slate-500">
                      <span>AY {session.academicYear}</span>
                      {session.semester && <span>· Sem {session.semester}</span>}
                    </div>
                  </div>

                  {/* Issue */}
                  <div>
                    <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Issue
                    </h4>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {session.issueDescription}
                    </p>
                  </div>

                  {/* Outcome */}
                  {session.outcome && (
                    <div>
                      <h4 className="mb-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Outcome
                      </h4>
                      <p className="text-sm text-slate-700 leading-relaxed">{session.outcome}</p>
                    </div>
                  )}

                  {/* Follow-up Actions */}
                  {(session.followUpActions ?? []).length > 0 && (
                    <div>
                      <h4 className="mb-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Follow-up Actions
                      </h4>
                      <div className="space-y-2">
                        {(session.followUpActions as IFollowUpAction[]).map((fa, i) => (
                          <div
                            key={i}
                            className={`flex items-start justify-between gap-3 rounded-xl p-3 ${fa.isCompleted ? 'bg-green-50' : 'bg-slate-50'}`}
                          >
                            <div className="flex-1">
                              <p
                                className={`text-sm ${fa.isCompleted ? 'line-through text-slate-600' : 'text-slate-700'}`}
                              >
                                {fa.action}
                              </p>
                              {fa.dueDate && (
                                <p className="text-xs text-slate-600 mt-0.5">
                                  Due: {new Date(fa.dueDate).toLocaleDateString('en-IN')}
                                </p>
                              )}
                              {fa.completedAt && (
                                <p className="text-xs text-green-500 mt-0.5">
                                  Completed: {new Date(fa.completedAt).toLocaleDateString('en-IN')}
                                </p>
                              )}
                            </div>
                            {canEdit && !fa.isCompleted && (
                              <button
                                type="button"
                                onClick={() => handleCompleteFollowUp(i)}
                                className="shrink-0 rounded-lg p-1.5 text-green-500 hover:bg-green-100"
                                title="Mark complete"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Parent Meeting */}
                  {session.parentMeetingRequired && (
                    <div className="rounded-xl bg-red-50 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4 text-red-500" />
                        <h4 className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                          Parent Meeting Required
                        </h4>
                      </div>
                      {session.parentMeetingDate && (
                        <p className="text-xs text-red-500">
                          Date: {new Date(session.parentMeetingDate).toLocaleDateString('en-IN')}
                        </p>
                      )}
                      {session.parentNotified && (
                        <p className="text-xs text-red-400 mt-1">Parent notified</p>
                      )}
                      {session.parentMeetingNotes && (
                        <p className="mt-1 text-xs text-red-600 italic">
                          &ldquo;{session.parentMeetingNotes}&rdquo;
                        </p>
                      )}
                    </div>
                  )}

                  {/* Next Session */}
                  {session.nextSessionDate && (
                    <div className="rounded-xl bg-blue-50 p-3">
                      <p className="text-xs text-blue-600">
                        Next session scheduled:{' '}
                        <span className="font-semibold">
                          {new Date(session.nextSessionDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </p>
                    </div>
                  )}

                  {canViewSensitiveNotes && session.counselorNotes && (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                        Confidential counselor notes
                      </h4>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-amber-800">
                        {session.counselorNotes}
                      </p>
                    </div>
                  )}

                  {/* Conduct Form */}
                  {canEdit &&
                    showConductForm &&
                    ['scheduled', 'in_progress'].includes(session.status) && (
                      <form
                        onSubmit={conductFormik.handleSubmit}
                        className="space-y-4 rounded-2xl bg-primary-50/50 p-4"
                      >
                        <h4 className="text-sm font-semibold text-primary">Update Session</h4>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            Duration (min)
                          </label>
                          <input
                            type="number"
                            name="durationMinutes"
                            value={conductFormik.values.durationMinutes ?? ''}
                            onChange={conductFormik.handleChange}
                            min={1}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            Outcome
                          </label>
                          <textarea
                            name="outcome"
                            value={conductFormik.values.outcome ?? ''}
                            onChange={conductFormik.handleChange}
                            rows={2}
                            placeholder="Summary of session outcome..."
                            className={inputCls + ' resize-none'}
                          />
                        </div>
                        {canEditSensitiveNotes && (
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                              Counselor Notes (confidential)
                            </label>
                            <textarea
                              name="counselorNotes"
                              value={conductFormik.values.counselorNotes ?? ''}
                              onChange={conductFormik.handleChange}
                              rows={2}
                              placeholder="Private notes visible only to authorized roles..."
                              className={inputCls + ' resize-none'}
                            />
                          </div>
                        )}
                        {/* Follow-up Actions Builder */}
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <label className="text-xs font-medium text-slate-600">
                              Follow-up Actions
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                conductFormik.setFieldValue('followUpActions', [
                                  ...(conductFormik.values.followUpActions ?? []),
                                  { action: '', dueDate: '' },
                                ])
                              }
                              className="flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Add
                            </button>
                          </div>
                          <div className="space-y-2">
                            {(conductFormik.values.followUpActions ?? []).map((fa, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <input
                                  placeholder="Action item"
                                  value={fa.action}
                                  onChange={(e) => {
                                    const arr = [...(conductFormik.values.followUpActions ?? [])];
                                    arr[i] = { ...arr[i], action: e.target.value };
                                    conductFormik.setFieldValue('followUpActions', arr);
                                  }}
                                  className={inputCls + ' flex-1'}
                                />
                                <input
                                  type="date"
                                  value={fa.dueDate ?? ''}
                                  onChange={(e) => {
                                    const arr = [...(conductFormik.values.followUpActions ?? [])];
                                    arr[i] = { ...arr[i], dueDate: e.target.value };
                                    conductFormik.setFieldValue('followUpActions', arr);
                                  }}
                                  className={inputCls + ' max-w-36'}
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    conductFormik.setFieldValue(
                                      'followUpActions',
                                      (conductFormik.values.followUpActions ?? []).filter(
                                        (_, j) => j !== i,
                                      ),
                                    )
                                  }
                                  className="text-red-400 hover:text-red-500"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                        {(conductFormik.values.followUpActions ?? []).length > 0 && (
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                              Next Session Date
                            </label>
                            <input
                              type="date"
                              name="nextSessionDate"
                              value={conductFormik.values.nextSessionDate ?? ''}
                              onChange={conductFormik.handleChange}
                              min={new Date().toISOString().split('T')[0]}
                              className={inputCls}
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="pmr"
                            checked={conductFormik.values.parentMeetingRequired ?? false}
                            onChange={(e) =>
                              conductFormik.setFieldValue('parentMeetingRequired', e.target.checked)
                            }
                            className="h-4 w-4 accent-primary"
                          />
                          <label htmlFor="pmr" className="text-xs font-medium text-slate-600">
                            Parent Meeting Required
                          </label>
                        </div>
                        {conductFormik.values.parentMeetingRequired && (
                          <>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-slate-600">
                                Parent Meeting Date
                              </label>
                              <input
                                type="date"
                                name="parentMeetingDate"
                                value={conductFormik.values.parentMeetingDate ?? ''}
                                onChange={conductFormik.handleChange}
                                className={inputCls}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-slate-600">
                                Parent Meeting Notes
                              </label>
                              <textarea
                                name="parentMeetingNotes"
                                value={conductFormik.values.parentMeetingNotes ?? ''}
                                onChange={conductFormik.handleChange}
                                rows={2}
                                className={inputCls + ' resize-none'}
                              />
                            </div>
                          </>
                        )}
                        <div className="flex justify-end gap-2">
                          <CustomButton
                            variant="tertiary"
                            type="button"
                            onClick={() => setShowConductForm(false)}
                          >
                            Cancel
                          </CustomButton>
                          <CustomButton variant="primary" type="submit" loading={processing}>
                            Save Update
                          </CustomButton>
                        </div>
                      </form>
                    )}
                </>
              )}
            </div>

            {/* Footer Actions */}
            {session && !showConductForm && (
              <div className="border-t border-slate-100 px-5 py-4 flex gap-3">
                {canEdit && ['scheduled', 'in_progress'].includes(session.status) && (
                  <CustomButton
                    variant="primary"
                    startIcon={<CheckCircle className="h-4 w-4" />}
                    onClick={() => setShowConductForm(true)}
                    className="flex-1"
                  >
                    Update Session
                  </CustomButton>
                )}
                {canEdit && ['scheduled', 'in_progress'].includes(session.status) && (
                  <CustomButton
                    variant="cancel"
                    startIcon={<XCircle className="h-4 w-4" />}
                    onClick={handleCancel}
                    loading={processing}
                    className="w-fit!"
                  >
                    Cancel
                  </CustomButton>
                )}
                {(!canEdit || !['scheduled', 'in_progress'].includes(session.status)) && (
                  <CustomButton variant="tertiary" onClick={onClose} className="flex-1">
                    Close
                  </CustomButton>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/**
 * @file GrievancePage.tsx
 * @description Grievance management — role-aware:
 *   Student: Submit grievance, view own (GET grievance/mine)
 *   Admin/HOD: View all, resolve, escalate (GET grievance, PATCH grievance/:id/resolve)
 * @module features/role-wise-features/grievance
 */
'use client';

import React, { useState, useMemo } from 'react';
import StudentSupportWorkflowBar from '@/shared/components/StudentSupportWorkflowBar';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import {
  Plus,
  CheckCircle,
  Clock,
  AlertTriangle,
  Send,
  Eye,
  Search,
  Circle,
  ShieldCheck,
  XCircle,
  RotateCw,
  SlidersHorizontal,
  LockKeyhole,
  CalendarClock,
  History,
  RotateCcw,
  FileText,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { useAuthStore } from '@/shared/store/authStore';
import InlineFileUpload from '@/shared/core/InlineFileUpload';
import AsyncSelect from '@/shared/core/AsyncSelect';
import FileViewer, { type IViewerFile } from '@/shared/core/FileViewer';
import GrievanceInsights from './GrievanceInsights';

interface IGrievance {
  _id: string;
  studentId?: string;
  studentName?: string;
  rollNumber?: string;
  type: string;
  title: string;
  description: string;
  status:
    | 'submitted'
    | 'acknowledged'
    | 'under_review'
    | 'referred'
    | 'resolved'
    | 'closed'
    | 'rejected'
    | 'reopened';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  response?: string;
  satisfactionRating?: number;
  satisfactionFeedback?: string;
  referenceNumber?: string;
  attachments?: string[];
  targetUserId?: string;
  targetName?: string;
  confidentiality?: 'standard' | 'restricted';
  responseDueAt?: string;
  resolutionDueAt?: string;
  escalatedAt?: string;
  appealCount?: number;
  appealReason?: string;
  timeline?: Array<{
    status: IGrievance['status'];
    note: string;
    updatedByName?: string;
    updatedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

interface IGrievanceStats {
  total?: number;
  submitted?: number;
  acknowledged?: number;
  under_review?: number;
  resolved?: number;
  referred?: number;
  closed?: number;
  reopened?: number;
  avgResolutionDays?: number;
  byType?: Record<string, number>;
  byPriority?: Record<string, number>;
}
const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

const STATUS_CFG = {
  submitted: { label: 'Submitted', bg: 'bg-amber-50', text: 'text-amber-600' },
  acknowledged: { label: 'Acknowledged', bg: 'bg-blue-50', text: 'text-blue-600' },
  under_review: { label: 'Under Review', bg: 'bg-blue-50', text: 'text-blue-600' },
  resolved: { label: 'Resolved', bg: 'bg-green-50', text: 'text-green-600' },
  referred: { label: 'Referred', bg: 'bg-red-50', text: 'text-red-500' },
  closed: { label: 'Closed', bg: 'bg-slate-100', text: 'text-slate-500' },
  rejected: { label: 'Rejected', bg: 'bg-red-50', text: 'text-red-500' },
  reopened: { label: 'Reopened', bg: 'bg-amber-50', text: 'text-amber-600' },
};

const PRIORITY_CFG = {
  low: { label: 'Low', color: 'text-slate-600' },
  medium: { label: 'Medium', color: 'text-blue-500' },
  high: { label: 'High', color: 'text-amber-600' },
  urgent: { label: 'Urgent', color: 'text-red-500' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Submit Grievance Modal ───────────────────────────────────────────────────
function SubmitModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { mutation, isLoading } = useMutation();
  const [files, setFiles] = useState<IViewerFile[]>([]);
  const formik = useFormik({
    initialValues: {
      type: 'academic',
      title: '',
      description: '',
      targetUserId: '',
      targetName: '',
    },
    validationSchema: Yup.object({
      title: Yup.string().trim().min(5).required('Title required'),
      description: Yup.string()
        .trim()
        .min(20, 'Min 20 characters')
        .required('Description required'),
    }),
    onSubmit: async (values) => {
      const res = await mutation('grievance', {
        method: 'POST',
        body: { ...values, attachments: files.map((file) => file.url) },
        isAlert: true,
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Grievance submitted');
        onSaved();
      } else toast.error('The grievance could not be submitted. Review the form and try again.');
    },
  });

  const uploadAttachment = async (file: File): Promise<boolean> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await mutation('upload', {
      method: 'POST',
      body: formData,
      isFormData: true,
      dedupe: false,
    });
    const uploaded = response?.results?.data as
      | { url?: string; filename?: string; publicId?: string }
      | undefined;
    if (!uploaded?.url) return false;
    setFiles((current) => [
      ...current,
      {
        url: uploaded.url as string,
        name: uploaded.filename ?? file.name,
        publicId: uploaded.publicId,
      },
    ]);
    return true;
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
        className="relative z-10 w-full max-w-md rounded-2xl bg-white  p-6 max-h-[92dvh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-900">Submit Grievance</h2>
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
            <label className={labelCls}>Grievance type *</label>
            <select
              name="type"
              value={formik.values.type}
              onChange={formik.handleChange}
              className={inputCls}
            >
              <option value="academic">Academic</option>
              <option value="examination">Examination</option>
              <option value="faculty">Faculty</option>
              <option value="facility">Facility</option>
              <option value="hostel">Hostel</option>
              <option value="transport">Transport</option>
              <option value="fee">Fee</option>
              <option value="scholarship">Scholarship</option>
              <option value="library">Library</option>
              <option value="ragging">Anti-ragging</option>
              <option value="harassment">Harassment</option>
              <option value="other">Other</option>
            </select>
          </div>
          {formik.values.type === 'faculty' && (
            <AsyncSelect
              type="faculty"
              label="Concerned faculty member"
              value={formik.values.targetUserId || null}
              onChange={(value, option) => {
                void formik.setFieldValue('targetUserId', value ?? '');
                void formik.setFieldValue('targetName', option?.label ?? '');
              }}
              placeholder="Search faculty by name or ID"
            />
          )}
          <div>
            <label className={labelCls}>Title *</label>
            <input
              name="title"
              value={formik.values.title}
              onChange={formik.handleChange}
              placeholder="Brief subject line…"
              className={inputCls}
            />
            {formik.touched.title && formik.errors.title && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.title}</p>
            )}
          </div>
          {['ragging', 'harassment'].includes(formik.values.type) && (
            <div className="flex gap-2 rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-700">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
              This report is automatically marked urgent and restricted to approval authorities.
            </div>
          )}
          <InlineFileUpload
            label="Supporting evidence"
            multiple
            files={files}
            onUpload={uploadAttachment}
            onRemove={async (_file, index) => {
              setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
            }}
            hint="Optional PDF or images · 5 MB each"
          />
          <div>
            <label className={labelCls}>Description *</label>
            <textarea
              name="description"
              rows={5}
              value={formik.values.description}
              onChange={formik.handleChange}
              placeholder="Describe your grievance in detail…"
              className={inputCls + ' resize-none'}
            />
            {formik.touched.description && formik.errors.description && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.description}</p>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton
              variant="primary"
              type="submit"
              loading={isLoading}
              startIcon={<Send className="h-4 w-4" />}
            >
              Submit
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Resolve Modal (admin) ────────────────────────────────────────────────────
function ResolveModal({
  grievance,
  onClose,
  onSaved,
}: {
  grievance: IGrievance;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const [note, setNote] = useState('');
  const [action, setAction] = useState<'resolve' | 'escalate'>('resolve');
  const [escalatedToId, setEscalatedToId] = useState('');

  const {
    data: authoritiesRaw,
    error: authoritiesError,
    isLoading: authoritiesLoading,
  } = useSwr(action === 'escalate' ? 'grievance/authorities' : null);
  const authorities =
    ((authoritiesRaw as { data?: { _id: string }[] })?.data as Array<{
      _id: string;
      name?: string;
      email?: string;
      roles?: string[];
    }>) ?? [];

  const handleSubmit = async () => {
    if (note.trim().length < 10) {
      toast.error('Enter a meaningful note of at least 10 characters');
      return;
    }
    if (action === 'escalate' && !escalatedToId) {
      toast.error('Select a person to escalate to');
      return;
    }
    const endpoint =
      action === 'resolve'
        ? `grievance/${grievance._id}/respond`
        : `grievance/${grievance._id}/escalate`;
    const body = action === 'resolve' ? { response: note, resolve: true } : { note, escalatedToId };
    const res = await mutation(endpoint, {
      method: 'PATCH',
      body,
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success(action === 'resolve' ? 'Grievance resolved' : 'Grievance escalated');
      onSaved();
    } else
      toast.error(`The grievance could not be ${action === 'resolve' ? 'resolved' : 'escalated'}.`);
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
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className="relative z-10 w-full max-w-md rounded-2xl bg-white  p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-900">Handle Grievance</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-600 hover:text-slate-600 text-xl"
          >
            ✕
          </button>
        </div>
        <div className="mb-3 rounded-xl bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-800">{grievance.title}</p>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{grievance.description}</p>
        </div>
        <div className="space-y-4">
          <div className="flex gap-3">
            {(['resolve', 'escalate'] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAction(a)}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold capitalize transition-colors ${
                  action === a
                    ? a === 'resolve'
                      ? 'bg-green-50 text-green-600 border border-green-200'
                      : 'bg-red-50 text-red-500 border border-red-200'
                    : 'bg-slate-50 text-slate-600 border border-slate-200'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          <div>
            <label className={labelCls}>Resolution Note</label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add notes about the action taken…"
              className={inputCls + ' resize-none'}
            />
          </div>
          {action === 'escalate' && (
            <div>
              <label className={labelCls}>Escalate To *</label>
              <select
                value={escalatedToId}
                onChange={(e) => setEscalatedToId(e.target.value)}
                className={inputCls}
              >
                <option value="">
                  {authoritiesLoading ? 'Loading authorities…' : 'Select an authority…'}
                </option>
                {authorities.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name ?? u.email} {u.roles?.length ? `(${u.roles.join(', ')})` : ''}
                  </option>
                ))}
              </select>
              {authoritiesError && (
                <p className="mt-1 text-xs text-rose-600">
                  Escalation authorities could not be loaded. Refresh and try again.
                </p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton variant="primary" loading={isLoading} onClick={handleSubmit}>
              {action === 'resolve' ? 'Resolve' : 'Escalate'}
            </CustomButton>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Detail Drawer ─────────────────────────────────────────────────────────────
function GrievanceDetailDrawer({
  g,
  isStudent,
  onClose,
  onChanged,
}: {
  g: IGrievance;
  isStudent: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const [rating, setRating] = useState(g.satisfactionRating ?? 0);
  const [appealReason, setAppealReason] = useState('');
  const [showAppeal, setShowAppeal] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const st = STATUS_CFG[g.status] ?? STATUS_CFG.submitted;
  const pr = PRIORITY_CFG[g.priority] ?? PRIORITY_CFG.medium;

  const handleClose = async () => {
    const conf = await Swal.fire({
      title: 'Close grievance?',
      text: 'You can still appeal an eligible decision within 30 days.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, close',
      confirmButtonColor: '#0178D7',
    });
    if (!conf.isConfirmed) return;
    const res = await mutation(`grievance/${g._id}/close`, { method: 'PATCH', isAlert: true });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Grievance closed');
      onChanged();
      onClose();
    }
  };

  const handleRate = async (r: number) => {
    setRating(r);
    const res = await mutation(`grievance/${g._id}/rate`, {
      method: 'PATCH',
      body: { rating: r },
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Rating submitted');
      onChanged();
    }
  };
  const handleAppeal = async () => {
    if (appealReason.trim().length < 20) {
      toast.error('Explain the appeal in at least 20 characters');
      return;
    }
    const res = await mutation(`grievance/${g._id}/appeal`, {
      method: 'PATCH',
      body: { reason: appealReason.trim() },
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Appeal submitted and grievance reopened');
      onChanged();
      onClose();
    } else toast.error('The appeal could not be submitted.');
  };
  const attachmentFiles: IViewerFile[] = (g.attachments ?? []).map((url, index) => ({
    url,
    name: `Evidence ${index + 1}`,
  }));
  const canAppeal =
    isStudent && ['resolved', 'closed', 'rejected'].includes(g.status) && (g.appealCount ?? 0) < 3;
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-200/80"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative z-10 h-full w-full max-w-md overflow-y-auto bg-white  p-5"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-slate-900">Grievance Details</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-600 hover:text-slate-600 text-xl"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl bg-primary-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              Reference number
            </p>
            <p className="mt-1 font-mono text-sm font-bold text-slate-800">
              {g.referenceNumber ?? 'Not available'}
            </p>
          </div>
          <div className="flex gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.bg} ${st.text}`}>
              {st.label}
            </span>
            <span className={`text-xs font-bold ${pr.color}`}>{pr.label} Priority</span>
          </div>
          <div>
            <p className="text-xs text-slate-600">Subject</p>
            <p className="text-sm font-semibold text-slate-800 mt-0.5">{g.title}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-500">
                <CalendarClock className="h-3 w-3" /> Response due
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-700">
                {g.responseDueAt ? fmtDate(g.responseDueAt) : '—'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-500">
                <CalendarClock className="h-3 w-3" /> Resolution due
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-700">
                {g.resolutionDueAt ? fmtDate(g.resolutionDueAt) : '—'}
              </p>
            </div>
          </div>
          {g.confidentiality === 'restricted' && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700">
              <LockKeyhole className="h-4 w-4" /> Restricted case · approval authorities only
            </div>
          )}
          {g.targetName && (
            <div>
              <p className="text-xs text-slate-600">Concerned person</p>
              <p className="mt-0.5 text-sm text-slate-700">{g.targetName}</p>
            </div>
          )}
          {attachmentFiles.length > 0 && (
            <button
              type="button"
              onClick={() => setViewerOpen(true)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-white p-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Supporting evidence
              </span>
              <span className="text-xs text-slate-500">{attachmentFiles.length} file(s)</span>
            </button>
          )}
          <div>
            <p className="text-xs text-slate-600">Category</p>
            <p className="text-sm capitalize text-slate-700 mt-0.5">{g.type}</p>
          </div>
          <div>
            <p className="text-xs text-slate-600">Description</p>
            <p className="text-sm text-slate-700 mt-0.5 leading-relaxed">{g.description}</p>
          </div>
          {g.studentName && (
            <div>
              <p className="text-xs text-slate-600">Submitted by</p>
              <p className="text-sm text-slate-700 mt-0.5">
                {g.studentName} {g.rollNumber ? `(${g.rollNumber})` : ''}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-600">Submitted on</p>
            <p className="text-sm text-slate-700 mt-0.5">{fmtDate(g.createdAt)}</p>
          </div>
          {g.response && (
            <div className="rounded-xl bg-green-50 p-3">
              <p className="text-xs font-bold text-green-600 mb-1">Resolution Note</p>
              <p className="text-sm text-slate-700">{g.response}</p>
            </div>
          )}

          {/* Student-only — rate and close once resolved */}
          {isStudent && g.status === 'resolved' && (
            <div className="space-y-3 rounded-xl bg-amber-50 p-3">
              <p className="text-xs font-bold text-amber-700">Rate this resolution</p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    type="button"
                    key={n}
                    onClick={() => handleRate(n)}
                    aria-label={`Rate resolution ${n} out of 5`}
                  >
                    <Circle
                      className={`h-5 w-5 ${
                        n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <CustomButton
                variant="primary"
                onClick={handleClose}
                loading={isLoading}
                startIcon={<XCircle className="h-4 w-4" />}
              >
                Close grievance
              </CustomButton>
            </div>
          )}
          {isStudent && g.status === 'closed' && g.satisfactionRating != null && (
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-bold text-slate-500">Your rating</p>
              <div className="flex items-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Circle
                    key={n}
                    className={`h-4 w-4 ${
                      n <= (g.satisfactionRating ?? 0)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
          {(g.timeline ?? []).length > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <History className="h-3.5 w-3.5" /> Case timeline
              </h3>
              <div className="space-y-0 border-l border-slate-200 pl-4">
                {(g.timeline ?? []).map((entry, index) => (
                  <motion.div
                    key={`${entry.updatedAt}-${index}`}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="relative pb-4"
                  >
                    <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-white" />
                    <p className="text-xs font-semibold capitalize text-slate-700">
                      {entry.status.replace(/_/g, ' ')}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{entry.note}</p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {fmtDate(entry.updatedAt)}
                      {entry.updatedByName ? ` · ${entry.updatedByName}` : ''}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
          {canAppeal && (
            <div className="rounded-xl border border-orange-100 bg-orange-50 p-3">
              {!showAppeal ? (
                <button
                  type="button"
                  onClick={() => setShowAppeal(true)}
                  className="flex items-center gap-2 text-xs font-semibold text-orange-700"
                >
                  <RotateCcw className="h-4 w-4" /> Appeal this decision
                </button>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-orange-800">
                    Why should this case be reopened?
                  </label>
                  <textarea
                    rows={3}
                    value={appealReason}
                    onChange={(event) => setAppealReason(event.target.value)}
                    className={inputCls}
                    placeholder="Give a clear reason (minimum 20 characters)…"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAppeal(false)}
                      className="px-2 py-1 text-xs font-medium text-slate-500"
                    >
                      Cancel
                    </button>
                    <CustomButton
                      type="button"
                      onClick={handleAppeal}
                      loading={isLoading}
                      className="w-fit! py-1.5! text-xs!"
                    >
                      Submit appeal
                    </CustomButton>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <FileViewer
          open={viewerOpen}
          onClose={() => setViewerOpen(false)}
          files={attachmentFiles}
          title="Grievance evidence"
        />
      </motion.div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function GrievancePage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const canView = useHasPermission('grievance', 'view');
  const canCreate = useHasPermission('grievance', 'create');
  const hasEditPermission = useHasPermission('grievance', 'edit');
  const canApprove = useHasPermission('grievance', 'approve');
  const isStudent = activeRole === 'student';
  const isStaff = !isStudent;
  const { mutation: actMutation } = useMutation();

  const [showSubmit, setShowSubmit] = useState(false);
  const [resolveItem, setResolveItem] = useState<IGrievance | null>(null);
  const [detailItem, setDetailItem] = useState<IGrievance | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [refLookup, setRefLookup] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const { data: statsRaw, mutate: mutateStats } = useSwr(canView ? 'grievance/stats' : null);
  const stats: IGrievanceStats =
    ((statsRaw as { data?: IGrievanceStats })?.data as IGrievanceStats) ?? {};

  const handleFilter = (v: string) => {
    setFilterStatus(v);
    setPage(1);
  };

  const apiUrl = useMemo(() => {
    const base = isStaff ? 'grievance' : 'grievance/mine';
    const q = new URLSearchParams();
    q.set('page', String(page));
    q.set('limit', '15');
    if (filterStatus) q.set('status', filterStatus);
    return `${base}?${q.toString()}`;
  }, [isStaff, page, filterStatus]);

  const { data: raw, error, isLoading, isValidating, mutate } = useSwr(canView ? apiUrl : null);
  const refreshAll = () => void Promise.all([mutate(), mutateStats()]);
  const records: IGrievance[] =
    (raw as { data?: { data?: IGrievance[] } })?.data?.data ??
    (raw as { data?: IGrievance[] })?.data ??
    [];
  const totalCount = (raw as { data?: { total?: number } })?.data?.total ?? records.length;

  if (!canView) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Grievance access unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your active role cannot view grievance records.
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Grievances could not be loaded</h1>
        <p className="mt-2 text-sm text-red-600">{error.message}</p>
        <CustomButton className="mx-auto mt-4 w-fit!" onClick={() => mutate()}>
          Try again
        </CustomButton>
      </div>
    );
  }

  const columns: Column<IGrievance>[] = [
    {
      field: 'title',
      title: 'Title',
      render: (r) => (
        <div>
          <p className="text-sm font-medium text-slate-800">{r.title}</p>
          <p className="text-xs text-slate-600 capitalize">{r.type}</p>
        </div>
      ),
    },
    ...(isStaff && hasEditPermission
      ? [
          {
            field: 'studentName' as keyof IGrievance,
            title: 'Student',
            render: (r: IGrievance) => (
              <span className="text-sm">{String(r.studentName ?? '—')}</span>
            ),
          },
        ]
      : []),
    {
      field: 'priority',
      title: 'Priority',
      render: (r) => (
        <span
          className={`text-xs font-bold capitalize ${PRIORITY_CFG[r.priority]?.color ?? 'text-slate-500'}`}
        >
          {r.priority}
        </span>
      ),
    },
    {
      field: 'status',
      title: 'Status',
      render: (r) => {
        const c = STATUS_CFG[r.status] ?? STATUS_CFG.submitted;
        return (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
            {c.label}
          </span>
        );
      },
    },
    {
      field: 'createdAt',
      title: 'Date',
      render: (r) => <span className="text-xs text-slate-600">{fmtDate(r.createdAt)}</span>,
    },
  ];

  const actions: Action<IGrievance>[] = [
    {
      tooltip: 'View Details',
      icon: <Eye className="h-4 w-4 text-primary" />,
      onClick: (r) => setDetailItem(r),
    },
    ...(isStaff && hasEditPermission
      ? ([
          {
            tooltip: 'Acknowledge',
            icon: <ShieldCheck className="h-4 w-4 text-blue-500" />,
            onClick: async (r: IGrievance) => {
              const res = await actMutation(`grievance/${r._id}/acknowledge`, {
                method: 'PATCH',
                isAlert: true,
              });
              if ((res as { results?: { success?: boolean } })?.results?.success) {
                toast.success('Acknowledged');
                refreshAll();
              }
            },
            hidden: (r: IGrievance) => !['submitted', 'reopened', 'referred'].includes(r.status),
          },
          {
            tooltip: 'Resolve / Escalate',
            icon: <CheckCircle className="h-4 w-4 text-green-500" />,
            onClick: (r: IGrievance) => setResolveItem(r),
            hidden: (r: IGrievance) => r.status === 'resolved' || r.status === 'closed',
          },
        ] as Action<IGrievance>[])
      : []),
  ];

  const open =
    (stats.submitted ?? records.filter((r) => r.status === 'submitted').length) +
    (stats.reopened ?? records.filter((r) => r.status === 'reopened').length);
  const inProgress =
    (stats.acknowledged ?? records.filter((r) => r.status === 'acknowledged').length) +
    (stats.under_review ?? records.filter((r) => r.status === 'under_review').length);
  const resolved = stats.resolved ?? records.filter((r) => r.status === 'resolved').length;
  const escalated = stats.referred ?? records.filter((r) => r.status === 'referred').length;

  return (
    <div className="space-y-5">
      <StudentSupportWorkflowBar />
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Grievance</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {isStaff ? 'Manage student grievances' : 'Submit and track your grievances'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refreshAll}
            disabled={isValidating}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 hover:bg-primary-50 hover:text-primary disabled:opacity-60"
          >
            <RotateCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowFilters((visible) => !visible)}
            aria-expanded={showFilters}
            className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold ${showFilters || filterStatus ? 'border-primary-100 bg-primary-50 text-primary' : 'border-slate-200 bg-white text-slate-600 hover:bg-primary-50 hover:text-primary'}`}
          >
            <SlidersHorizontal className="h-4 w-4" /> Filters
            {filterStatus && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-[10px] text-white">
                1
              </span>
            )}
          </button>
          {isStudent && canCreate && (
            <CustomButton
              variant="primary"
              startIcon={<Plus className="h-4 w-4" />}
              onClick={() => setShowSubmit(true)}
              className="w-fit!"
            >
              Submit Grievance
            </CustomButton>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          {
            label: 'Open',
            description: 'Submitted or reopened cases',
            value: open,
            icon: <Clock className="h-4.5 w-4.5" />,
            color: 'bg-amber-50 text-amber-600',
          },
          {
            label: 'In Progress',
            description: 'Acknowledged and under review',
            value: inProgress,
            icon: <ShieldCheck className="h-4.5 w-4.5" />,
            color: 'bg-blue-50 text-blue-600',
          },
          {
            label: 'Resolved',
            description: 'Official response recorded',
            value: resolved,
            icon: <CheckCircle className="h-4.5 w-4.5" />,
            color: 'bg-green-50 text-green-600',
          },
          {
            label: 'Escalated',
            description: 'Referred to higher authority',
            value: escalated,
            icon: <AlertTriangle className="h-4.5 w-4.5" />,
            color: 'bg-red-50 text-red-500',
          },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
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
            <span className="pointer-events-none absolute -bottom-8 -right-8 h-20 w-20 rounded-full bg-primary-50/50 transition-transform duration-300 group-hover:scale-125" />
          </motion.div>
        ))}
      </div>

      <GrievanceInsights stats={stats} records={records} isLoading={isLoading} />

      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-2xl border border-slate-100 bg-white"
          >
            <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Refine grievance records</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Filter the register or open a case directly using its reference number.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  {totalCount} records
                </span>
                {filterStatus && (
                  <button
                    type="button"
                    onClick={() => handleFilter('')}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Clear status
                  </button>
                )}
              </div>
            </div>
            <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <label
                  htmlFor="grievance-status-filter"
                  className="text-xs font-semibold text-slate-700"
                >
                  Workflow status
                </label>
                <select
                  id="grievance-status-filter"
                  value={filterStatus}
                  onChange={(e) => handleFilter(e.target.value)}
                  className="mt-2 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">All statuses</option>
                  <option value="submitted">Submitted</option>
                  <option value="acknowledged">Acknowledged</option>
                  <option value="under_review">Under Review</option>
                  <option value="resolved">Resolved</option>
                  <option value="referred">Referred</option>
                  <option value="closed">Closed</option>
                  <option value="rejected">Rejected</option>
                  <option value="reopened">Reopened</option>
                </select>
                <p className="mt-2 text-[11px] text-slate-500">
                  {filterStatus
                    ? `Showing ${STATUS_CFG[filterStatus as IGrievance['status']]?.label ?? 'selected'} cases`
                    : 'Showing every workflow state'}
                </p>
              </div>

              <form
                className="rounded-xl bg-slate-50 p-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const ref = refLookup.trim();
                  if (!ref) {
                    toast.info('Enter a grievance reference number');
                    return;
                  }
                  const response = await actMutation(`grievance/ref/${encodeURIComponent(ref)}`, {
                    method: 'GET',
                    silentError: true,
                  });
                  const json = response?.results as
                    | { success?: boolean; data?: IGrievance }
                    | undefined;
                  if (json?.success && json.data) setDetailItem(json.data);
                  else toast.error('No accessible grievance matches that reference');
                }}
              >
                <label
                  htmlFor="grievance-reference-lookup"
                  className="text-xs font-semibold text-slate-700"
                >
                  Open by reference number
                </label>
                <div className="mt-2 flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="grievance-reference-lookup"
                      value={refLookup}
                      onChange={(e) => setRefLookup(e.target.value.toUpperCase())}
                      placeholder="e.g. GRV-2026-0000001"
                      className="block w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 font-mono text-sm text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
                  >
                    <Search className="h-4 w-4" /> Find
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Reference lookup still respects ownership, department, and privacy access.
                </p>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DataViewSwitcher<IGrievance>
        data={records}
        isLoading={isLoading}
        storageKey="grievance.view"
        showSearch={false}
        pageSize={15}
        renderCard={(g) => {
          const statusStyle =
            g.status === 'resolved' || g.status === 'closed'
              ? 'bg-green-50 text-green-600'
              : ['acknowledged', 'under_review'].includes(g.status)
                ? 'bg-blue-50 text-blue-600'
                : g.status === 'referred'
                  ? 'bg-red-50 text-red-500'
                  : 'bg-amber-50 text-amber-600';
          const priorityStyle =
            g.priority === 'high' || g.priority === 'urgent'
              ? 'bg-red-50 text-red-500'
              : g.priority === 'medium'
                ? 'bg-amber-50 text-amber-600'
                : 'bg-slate-100 text-slate-500';
          return (
            <motion.div
              whileHover={{ y: -2 }}
              className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 hover:border-primary-100"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${statusStyle}`}
                  >
                    {(g.status ?? '').replace(/_/g, ' ')}
                  </span>
                  {g.priority && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${priorityStyle}`}
                    >
                      {g.priority}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 line-clamp-2">{g.title}</p>
                <p className="text-[11px] uppercase tracking-wide text-slate-600">{g.type}</p>
              </div>
              <div className="space-y-1 text-xs text-slate-500">
                {g.studentName && (
                  <p>
                    {g.studentName}
                    {g.rollNumber ? ` · ${g.rollNumber}` : ''}
                  </p>
                )}
                {g.createdAt && (
                  <p className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-slate-600" />
                    {new Date(g.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 text-xs">
                <button
                  type="button"
                  onClick={() => setDetailItem(g)}
                  className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-primary"
                >
                  <Eye className="h-3 w-3" /> View
                </button>
                {isStaff &&
                  hasEditPermission &&
                  g.status !== 'resolved' &&
                  g.status !== 'closed' && (
                    <button
                      type="button"
                      onClick={() => setResolveItem(g)}
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      <CheckCircle className="h-3 w-3" /> Resolve
                    </button>
                  )}
              </div>
            </motion.div>
          );
        }}
        table={
          <div className="overflow-hidden rounded-2xl bg-white">
            <CustomTable
              data={records}
              columns={columns}
              actions={actions}
              isLoading={isLoading}
              page={page}
              totalCount={totalCount}
              pageSize={15}
              onPageChange={setPage}
              title="Grievance case register"
              description="Track ownership, priority, workflow state, deadlines, and formal outcomes."
              onRefresh={refreshAll}
              isValidating={isValidating}
              options={{
                search: false,
                refresh: true,
                pagination: true,
                pageSize: 15,
                responsive: true,
                export: canApprove,
              }}
            />
          </div>
        }
      />

      <AnimatePresence>
        {showSubmit && (
          <SubmitModal
            onClose={() => setShowSubmit(false)}
            onSaved={() => {
              refreshAll();
              setShowSubmit(false);
            }}
          />
        )}
        {resolveItem && (
          <ResolveModal
            grievance={resolveItem}
            onClose={() => setResolveItem(null)}
            onSaved={() => {
              refreshAll();
              setResolveItem(null);
            }}
          />
        )}
        {detailItem && (
          <GrievanceDetailDrawer
            g={detailItem}
            isStudent={isStudent}
            onClose={() => setDetailItem(null)}
            onChanged={refreshAll}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

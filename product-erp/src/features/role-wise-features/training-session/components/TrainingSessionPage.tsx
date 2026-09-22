/**
 * @file TrainingSessionPage.tsx
 * @description Training & Placement Sessions — role-aware:
 *   All:        View sessions list & upcoming
 *   Student:    Register / unregister, view own schedule
 *   Coordinator (super_admin, placement_cell): Create, update, mark attendance
 *   Faculty:    Mark attendance
 * @module features/role-wise-features/training-session
 */
'use client';

import React, { useState, useMemo } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import {
  Zap,
  Plus,
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle,
  Edit2,
  Trash2,
  BookOpen,
  Wifi,
  Monitor,
  Award,
  ChevronDown,
  ChevronUp,
  X,
  UserPlus,
  UserMinus,
  Upload,
  Send,
  Play,
  LayoutDashboard,
  TrendingUp,
  Target,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import { useAuthStore } from '@/shared/store/authStore';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import AsyncSelect from '@/shared/core/AsyncSelect';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import UseProtectedRoutes from '@/shared/hooks/UseProtectedRoutes';
import type {
  IRegisteredStudentDetail,
  ITrainingSession,
  TTrainingStatus,
} from '../types/training-session.types';

// ─── Constants ───────────────────────────────────────────────────────────────
const TRAINING_TYPES = [
  'Aptitude & Reasoning',
  'Technical Skills',
  'Soft Skills',
  'Mock Interview',
  'Group Discussion',
  'Resume Building Workshop',
  'Industry Expert Talk',
  'Webinar',
  'Coding Contest',
  'Workshop',
  'Placement Orientation',
];

const MODES = ['Offline', 'Online', 'Hybrid'] as const;

const STATUS_CFG: Record<
  TTrainingStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  draft: { label: 'Draft', bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  scheduled: { label: 'Scheduled', bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-400' },
  ongoing: { label: 'Ongoing', bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-400' },
  completed: { label: 'Completed', bg: 'bg-green-50', text: 'text-green-600', dot: 'bg-green-400' },
  cancelled: { label: 'Cancelled', bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-400' },
  postponed: {
    label: 'Postponed',
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    dot: 'bg-slate-400',
  },
};

const MODE_ICON: Record<string, React.ReactNode> = {
  Offline: <Monitor className="h-3.5 w-3.5" />,
  Online: <Wifi className="h-3.5 w-3.5" />,
  Hybrid: <Zap className="h-3.5 w-3.5" />,
};

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-600 focus:border-primary focus:bg-white focus:outline-none transition-colors';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const mutationSucceeded = (value: unknown) =>
  Boolean((value as { results?: { success?: boolean } } | undefined)?.results?.success);

const commaList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

// ─── Session Form (Create / Edit) ─────────────────────────────────────────────
function SessionForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Partial<ITrainingSession>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const isEdit = !!initial?._id;

  const schema = Yup.object({
    title: Yup.string().required('Required'),
    type: Yup.string().required('Required'),
    mode: Yup.string().required('Required'),
    facilitator: Yup.string().required('Required'),
    scheduledDate: Yup.string().required('Required'),
    registrationStart: Yup.string().required('Registration opening is required'),
    registrationEnd: Yup.string().required('Registration closing is required'),
    startTime: Yup.string().required('Required'),
    endTime: Yup.string().required('Required'),
    duration: Yup.number().min(15, 'Min 15 min').required('Required'),
    venue: Yup.string().required('Required'),
  });

  const formik = useFormik({
    initialValues: {
      title: initial?.title ?? '',
      type: initial?.type ?? '',
      mode: initial?.mode ?? 'Offline',
      description: initial?.description ?? '',
      facilitator: initial?.facilitator ?? '',
      facilitatorOrg: initial?.facilitatorOrg ?? '',
      facilitatorEmail: initial?.facilitatorEmail ?? '',
      scheduledDate: initial?.scheduledDate ? initial.scheduledDate.slice(0, 10) : '',
      registrationStart: initial?.registrationStart ? initial.registrationStart.slice(0, 16) : '',
      registrationEnd: initial?.registrationEnd ? initial.registrationEnd.slice(0, 16) : '',
      startTime: initial?.startTime ?? '',
      endTime: initial?.endTime ?? '',
      duration: initial?.duration ?? 60,
      venue: initial?.venue ?? '',
      meetingLink: initial?.meetingLink ?? '',
      maxParticipants: initial?.maxParticipants ?? '',
      assignmentGiven: initial?.assignmentGiven ?? '',
      targetPrograms: initial?.targetPrograms ?? [],
      targetBranches: initial?.targetBranches ?? [],
      targetBatches: initial?.targetBatches ?? [],
      targetSemesters: initial?.targetSemesters?.join(', ') ?? '',
    },
    validationSchema: schema,
    onSubmit: async (values) => {
      const url = isEdit ? `training-session/${initial!._id}` : 'training-session';
      const method = isEdit ? 'PUT' : 'POST';
      const body = {
        ...values,
        maxParticipants: values.maxParticipants ? Number(values.maxParticipants) : undefined,
        targetPrograms: values.targetPrograms,
        targetBranches: values.targetBranches,
        targetBatches: values.targetBatches,
        targetSemesters: commaList(values.targetSemesters).map(Number),
      };
      const res = await mutation(url, { method, body, isAlert: true });
      if (mutationSucceeded(res)) {
        toast.success(isEdit ? 'Draft updated' : 'Draft created — review and publish when ready');
        onSaved();
        onClose();
      } else toast.error('Failed to save');
    },
  });

  const err = (k: keyof typeof formik.values) =>
    formik.touched[k] && formik.errors[k] ? (
      <p className="mt-1 text-xs text-red-500">{formik.errors[k] as string}</p>
    ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
              Guided readiness programme
            </p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">
              {isEdit ? 'Edit training session' : 'Create training session'}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Define the audience, facilitator, registration window and delivery plan before
              publishing.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={formik.handleSubmit} className="flex flex-col overflow-hidden flex-1">
          <div className="overflow-y-auto flex-1 p-6 space-y-4">
            {/* Title + Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Title *</label>
                <input
                  {...formik.getFieldProps('title')}
                  className={inputCls}
                  placeholder="Session title"
                />
                {err('title')}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Type *</label>
                <select {...formik.getFieldProps('type')} className={inputCls}>
                  <option value="">Select type</option>
                  {TRAINING_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {err('type')}
              </div>
            </div>

            {/* Mode + governed workflow */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Mode *</label>
                <select {...formik.getFieldProps('mode')} className={inputCls}>
                  {MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-700">
                This saves as a draft. Publish it after checking audience, registration dates and
                delivery details.
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Registration window
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">Opens *</label>
                  <input
                    {...formik.getFieldProps('registrationStart')}
                    className={inputCls}
                    type="datetime-local"
                  />
                  {err('registrationStart')}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Closes *
                  </label>
                  <input
                    {...formik.getFieldProps('registrationEnd')}
                    className={inputCls}
                    type="datetime-local"
                  />
                  {err('registrationEnd')}
                </div>
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Eligible audience
              </p>
              <p className="mb-3 text-xs text-slate-600">
                Leave a field blank for everyone. Separate multiple values with commas.
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <AsyncSelect
                  type="programs"
                  label="Programmes"
                  multiple
                  value={formik.values.targetPrograms}
                  onChange={(_, options) =>
                    formik.setFieldValue(
                      'targetPrograms',
                      options?.map((option) => option.label) ?? [],
                    )
                  }
                  placeholder="All programmes"
                />
                <AsyncSelect
                  type="departments"
                  label="Branches"
                  multiple
                  value={formik.values.targetBranches}
                  onChange={(_, options) =>
                    formik.setFieldValue(
                      'targetBranches',
                      options?.map((option) => option.label) ?? [],
                    )
                  }
                  placeholder="All branches"
                />
                <AsyncSelect
                  type="batches"
                  label="Batches"
                  multiple
                  value={formik.values.targetBatches}
                  onChange={(_, options) =>
                    formik.setFieldValue(
                      'targetBatches',
                      options?.map((option) => option.label) ?? [],
                    )
                  }
                  placeholder="All batches"
                />
              </div>
              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Semesters</label>
                <input
                  {...formik.getFieldProps('targetSemesters')}
                  className={inputCls}
                  placeholder="5, 6"
                />
              </div>
            </div>

            {/* Facilitator row */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Facilitator *
                </label>
                <input
                  {...formik.getFieldProps('facilitator')}
                  className={inputCls}
                  placeholder="Name"
                />
                {err('facilitator')}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Organisation
                </label>
                <input
                  {...formik.getFieldProps('facilitatorOrg')}
                  className={inputCls}
                  placeholder="Company / Institute"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Facilitator Email
                </label>
                <input
                  {...formik.getFieldProps('facilitatorEmail')}
                  className={inputCls}
                  placeholder="email@example.com"
                  type="email"
                />
              </div>
            </div>

            {/* Date / Time / Duration */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Date *</label>
                <input
                  {...formik.getFieldProps('scheduledDate')}
                  className={inputCls}
                  type="date"
                />
                {err('scheduledDate')}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Start *</label>
                <input {...formik.getFieldProps('startTime')} className={inputCls} type="time" />
                {err('startTime')}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">End *</label>
                <input {...formik.getFieldProps('endTime')} className={inputCls} type="time" />
                {err('endTime')}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Duration (min) *
                </label>
                <input
                  {...formik.getFieldProps('duration')}
                  className={inputCls}
                  type="number"
                  min={15}
                />
                {err('duration')}
              </div>
            </div>

            {/* Venue + Meeting Link */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Venue *</label>
                <input
                  {...formik.getFieldProps('venue')}
                  className={inputCls}
                  placeholder="Room / Hall / Link"
                />
                {err('venue')}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Meeting Link (Online)
                </label>
                <input
                  {...formik.getFieldProps('meetingLink')}
                  className={inputCls}
                  placeholder="https://meet.google.com/..."
                />
              </div>
            </div>

            {/* Max Participants */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Max Participants
                </label>
                <input
                  {...formik.getFieldProps('maxParticipants')}
                  className={inputCls}
                  type="number"
                  min={1}
                  placeholder="Leave blank for unlimited"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Post-session Assignment
                </label>
                <input
                  {...formik.getFieldProps('assignmentGiven')}
                  className={inputCls}
                  placeholder="Optional task description"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Description</label>
              <textarea
                {...formik.getFieldProps('description')}
                className={inputCls}
                rows={3}
                placeholder="Session overview..."
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <CustomButton variant="secondary" onClick={onClose} type="button">
              Cancel
            </CustomButton>
            <CustomButton variant="primary" type="submit" loading={isLoading}>
              {isEdit ? 'Save Draft' : 'Create Draft'}
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Attendance Drawer ────────────────────────────────────────────────────────
function AttendanceDrawer({
  session,
  onClose,
  onSaved,
}: {
  session: ITrainingSession;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent' | 'late'>>(
    () => {
      const map: Record<string, 'present' | 'absent' | 'late'> = {};
      session.attendance.forEach((a) => {
        map[a.studentId] = a.status;
      });
      return map;
    },
  );

  // We need the registered students list to mark attendance
  const { data: detail } = useSwr(`training-session/${session._id}`);
  const registeredDetails = (detail?.data?.registeredStudentDetails ??
    session.registeredStudentDetails ??
    []) as IRegisteredStudentDetail[];
  const detailByStudent = new Map(
    registeredDetails.map((student) => [String(student.studentId), student]),
  );
  const regStudents: string[] =
    detail?.data?.registeredStudents ?? session.registeredStudents ?? [];

  const handleSubmit = async () => {
    const payload = regStudents.map((sid) => ({
      studentId: sid,
      status: attendance[sid] ?? 'absent',
    }));
    const res = await mutation(`training-session/${session._id}/attendance`, {
      method: 'POST',
      body: { attendance: payload },
      isAlert: true,
    });
    if (mutationSucceeded(res)) {
      toast.success('Attendance marked');
      onSaved();
      onClose();
    } else toast.error('Failed to save attendance');
  };

  const toggle = (sid: string, status: 'present' | 'absent' | 'late') => {
    setAttendance((prev) => ({ ...prev, [sid]: status }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-slate-200/80">
      <motion.div
        initial={{ x: 380 }}
        animate={{ x: 0 }}
        exit={{ x: 380 }}
        className="flex h-full w-full max-w-sm flex-col bg-white"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Mark Attendance</p>
            <p className="text-xs text-slate-500">{session.title}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {regStudents.length === 0 ? (
            <p className="text-center text-sm text-slate-600 py-8">No registered students</p>
          ) : (
            regStudents.map((sid) => (
              <div
                key={sid}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-700">
                    {detailByStudent.get(String(sid))?.name || 'Registered student'}
                  </p>
                  <p className="text-xs text-slate-600">
                    {detailByStudent.get(String(sid))?.rollNumber || 'Roll number unavailable'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {(['present', 'late', 'absent'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => toggle(sid, s)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                        attendance[sid] === s
                          ? s === 'present'
                            ? 'bg-green-500 text-white'
                            : s === 'late'
                              ? 'bg-amber-500 text-white'
                              : 'bg-red-500 text-white'
                          : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-slate-100 p-4">
          <CustomButton
            variant="primary"
            className="w-full"
            onClick={handleSubmit}
            loading={isLoading}
          >
            Save Attendance
          </CustomButton>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Detail Drawer ─────────────────────────────────────────────────────────────
function DetailDrawer({
  session,
  onClose,
  canManage = false,
  onMutate,
}: {
  session: ITrainingSession;
  onClose: () => void;
  canManage?: boolean;
  onMutate?: () => void;
}) {
  const [open, setOpen] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const { mutation } = useMutation();
  const toggle = (k: string) =>
    setOpen((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const cfg = STATUS_CFG[session.status];
  const isOpen = (k: string) => open.includes(k);

  const handleMaterialUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('material', file);
      const res = await mutation(`training-session/${session._id}/material`, {
        method: 'POST',
        body: fd,
        isFormData: true,
      });
      const json = (
        res as { results?: { success?: boolean; error?: { message?: string } } } | undefined
      )?.results;
      if (res && json?.success) {
        toast.success('Material uploaded');
        onMutate?.();
      } else if (res) {
        toast.error(json?.error?.message ?? 'Upload failed');
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-slate-200/80">
      <motion.div
        initial={{ x: 440 }}
        animate={{ x: 0 }}
        exit={{ x: 440 }}
        className="flex h-full w-full max-w-md flex-col bg-white"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex-1 pr-4">
            <div className="mb-1.5 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                {MODE_ICON[session.mode]} {session.mode}
              </span>
            </div>
            <h3 className="text-base font-semibold text-slate-800">{session.title}</h3>
            <p className="text-xs text-slate-500">{session.type}</p>
          </div>
          <button onClick={onClose} className="mt-1 rounded-lg p-1.5 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: 'Date',
                value: fmtDate(session.scheduledDate),
                icon: <Calendar className="h-3.5 w-3.5 text-primary" />,
              },
              {
                label: 'Time',
                value: `${session.startTime} – ${session.endTime}`,
                icon: <Clock className="h-3.5 w-3.5 text-amber-500" />,
              },
              {
                label: 'Duration',
                value: `${session.duration} min`,
                icon: <Clock className="h-3.5 w-3.5 text-slate-600" />,
              },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-slate-50 p-3 text-center">
                <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center">
                  {s.icon}
                </div>
                <p className="text-xs font-semibold text-slate-800">{s.value}</p>
                <p className="text-[10px] text-slate-600">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Venue */}
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3">
            <MapPin className="h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm text-slate-700">{session.venue}</p>
          </div>

          {/* Facilitator */}
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="mb-1 text-xs font-medium text-slate-500">Facilitator</p>
            <p className="text-sm font-semibold text-slate-800">{session.facilitator}</p>
            {session.facilitatorOrg && (
              <p className="text-xs text-slate-500">{session.facilitatorOrg}</p>
            )}
            {session.facilitatorEmail && (
              <p className="text-xs text-primary">{session.facilitatorEmail}</p>
            )}
          </div>

          {/* Registrations */}
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium text-slate-700">Registrations</p>
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {session.registeredStudents?.length ?? 0}
              {session.maxParticipants ? ` / ${session.maxParticipants}` : ''}
            </p>
          </div>

          {/* Attendance */}
          {session.attendanceMarked && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-green-50 px-4 py-3 text-center">
                <p className="text-xl font-bold text-green-600">{session.totalPresent}</p>
                <p className="text-xs text-green-500">Present</p>
              </div>
              <div className="rounded-xl bg-red-50 px-4 py-3 text-center">
                <p className="text-xl font-bold text-red-600">{session.totalAbsent}</p>
                <p className="text-xs text-red-500">Absent</p>
              </div>
            </div>
          )}

          {/* Description */}
          {session.description && (
            <div>
              <button
                onClick={() => toggle('desc')}
                className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
              >
                <span className="text-sm font-medium text-slate-700">Description</span>
                {isOpen('desc') ? (
                  <ChevronUp className="h-4 w-4 text-slate-600" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-600" />
                )}
              </button>
              <AnimatePresence>
                {isOpen('desc') && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <p className="rounded-b-xl bg-slate-50 px-4 pb-3 text-sm text-slate-600">
                      {session.description}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Post-session task */}
          {session.assignmentGiven && (
            <div className="rounded-xl bg-amber-50 px-4 py-3">
              <p className="mb-1 text-xs font-medium text-amber-600">Post-session Task</p>
              <p className="text-sm text-amber-800">{session.assignmentGiven}</p>
            </div>
          )}

          {/* Resources */}
          {(session.materialUrl || session.recordingUrl || session.meetingLink) && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500">Resources</p>
              {session.materialUrl && (
                <a
                  href={session.materialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-100"
                >
                  <BookOpen className="h-4 w-4" /> Study Material
                </a>
              )}
              {session.recordingUrl && (
                <a
                  href={session.recordingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl bg-purple-50 px-4 py-2.5 text-sm text-purple-600 hover:bg-purple-100"
                >
                  <Monitor className="h-4 w-4" /> Recording
                </a>
              )}
              {session.meetingLink && (
                <a
                  href={session.meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-2.5 text-sm text-green-600 hover:bg-green-100"
                >
                  <Wifi className="h-4 w-4" /> Join Meeting
                </a>
              )}
            </div>
          )}

          {/* Material upload (coordinator) */}
          {canManage && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                {session.materialUrl ? 'Replace Study Material' : 'Upload Study Material'}
              </p>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary-50 px-4 py-3 text-sm font-medium text-primary hover:bg-primary-100">
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading…' : 'Choose File'}
                <input
                  type="file"
                  className="hidden"
                  disabled={uploading}
                  onChange={handleMaterialUpload}
                />
              </label>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

interface ITrainingStats {
  sessions?: number;
  scheduled?: number;
  completed?: number;
  draft?: number;
  ongoing?: number;
  registrations?: number;
  capacity?: number;
  present?: number;
  absent?: number;
  trainingMinutes?: number;
  averageRating?: number;
  capacityUtilization?: number;
  attendanceRate?: number;
  types?: Array<{ type: string; sessions: number; registrations: number }>;
  modes?: Array<{ mode: string; count: number }>;
  monthly?: Array<{ month: string; sessions: number; registrations: number; attendance: number }>;
}

function TrainingAnalytics() {
  const { data: raw, isLoading } = useSwr<{ data?: ITrainingStats }>('training-session/stats');
  const stats = raw?.data ?? {};
  if (isLoading)
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
    );
  const kpis = [
    {
      label: 'Training sessions',
      value: stats.sessions ?? 0,
      detail: `${stats.scheduled ?? 0} scheduled · ${stats.ongoing ?? 0} ongoing`,
      icon: Calendar,
      tone: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Student registrations',
      value: stats.registrations ?? 0,
      detail: `${(stats.capacityUtilization ?? 0).toFixed(1)}% capacity utilization`,
      icon: Users,
      tone: 'bg-violet-50 text-violet-700',
    },
    {
      label: 'Attendance rate',
      value: `${(stats.attendanceRate ?? 0).toFixed(1)}%`,
      detail: `${stats.present ?? 0} present · ${stats.absent ?? 0} absent`,
      icon: CheckCircle,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Delivered training',
      value: `${((stats.trainingMinutes ?? 0) / 60).toFixed(1)} hrs`,
      detail: stats.averageRating
        ? `${stats.averageRating.toFixed(1)}/5 average rating`
        : 'Ratings appear after feedback',
      icon: TrendingUp,
      tone: 'bg-amber-50 text-amber-700',
    },
  ];
  const lifecycle = [
    { label: 'Draft', value: stats.draft ?? 0, color: '#94a3b8' },
    { label: 'Scheduled', value: stats.scheduled ?? 0, color: '#2563eb' },
    { label: 'Ongoing', value: stats.ongoing ?? 0, color: '#f59e0b' },
    { label: 'Completed', value: stats.completed ?? 0, color: '#059669' },
  ];
  const lifeMax = Math.max(...lifecycle.map((item) => item.value), 1);
  const types = stats.types ?? [];
  const typeMax = Math.max(...types.map((item) => item.registrations), 1);
  const monthly = stats.monthly ?? [];
  const monthMax = Math.max(...monthly.flatMap((item) => [item.registrations, item.attendance]), 1);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, value, detail, icon: Icon, tone }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
              </div>
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
                <Icon className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-500">{detail}</p>
          </motion.div>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-bold text-slate-900">Programme lifecycle</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Operational progress from draft planning to delivery.
          </p>
          <svg
            viewBox="0 0 520 210"
            className="mt-4 h-auto w-full"
            role="img"
            aria-label="Training session lifecycle"
          >
            {lifecycle.map((item, index) => {
              const y = 12 + index * 47;
              const width = (item.value / lifeMax) * 330;
              return (
                <g key={item.label}>
                  <text x="0" y={y + 17} fill="#64748b" fontSize="12">
                    {item.label}
                  </text>
                  <rect x="88" y={y} width="340" height="25" rx="7" fill="#f1f5f9" />
                  <motion.rect
                    x="88"
                    y={y}
                    height="25"
                    rx="7"
                    fill={item.color}
                    initial={{ width: 0 }}
                    animate={{ width }}
                  />
                  <text x="446" y={y + 17} fill="#0f172a" fontSize="12" fontWeight="700">
                    {item.value}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-bold text-slate-900">Most engaging training formats</h3>
          <p className="mt-0.5 text-xs text-slate-500">Registration demand by training category.</p>
          {types.length ? (
            <svg
              viewBox="0 0 540 230"
              className="mt-3 h-auto w-full"
              role="img"
              aria-label="Registrations by training type"
            >
              {types.slice(0, 5).map((item, index) => {
                const y = 10 + index * 42;
                const width = (item.registrations / typeMax) * 285;
                const label = item.type.length > 18 ? `${item.type.slice(0, 17)}…` : item.type;
                return (
                  <g key={item.type}>
                    <text x="0" y={y + 17} fill="#64748b" fontSize="11">
                      {label}
                    </text>
                    <rect x="142" y={y} width="295" height="24" rx="7" fill="#f5f3ff" />
                    <motion.rect
                      x="142"
                      y={y}
                      height="24"
                      rx="7"
                      fill="#7c3aed"
                      initial={{ width: 0 }}
                      animate={{ width }}
                    />
                    <text x="451" y={y + 17} fill="#334155" fontSize="11">
                      {item.registrations}
                    </text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="mt-4 flex min-h-36 items-center justify-center rounded-xl bg-slate-50 text-xs text-slate-500">
              Demand appears after students register.
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Participation and attendance momentum
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Monthly registrations compared with verified attendance.
              </p>
            </div>
            <div className="flex gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                Registered
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                Present
              </span>
            </div>
          </div>
          {monthly.length ? (
            <svg
              viewBox="0 0 900 235"
              className="mt-4 h-auto w-full"
              role="img"
              aria-label="Monthly training participation"
            >
              {monthly.map((item, index) => {
                const group = 820 / monthly.length;
                const x = 50 + index * group;
                const reg = (item.registrations / monthMax) * 145;
                const att = (item.attendance / monthMax) * 145;
                return (
                  <g key={item.month}>
                    <line x1={x - 6} y1="175" x2={x + group - 14} y2="175" stroke="#e2e8f0" />
                    <motion.rect
                      x={x}
                      y={175 - reg}
                      width={Math.min(22, group / 3)}
                      height={reg}
                      rx="5"
                      fill="#2563eb"
                      initial={{ height: 0, y: 175 }}
                      animate={{ height: reg, y: 175 - reg }}
                    />
                    <motion.rect
                      x={x + Math.min(27, group / 2.5)}
                      y={175 - att}
                      width={Math.min(22, group / 3)}
                      height={att}
                      rx="5"
                      fill="#059669"
                      initial={{ height: 0, y: 175 }}
                      animate={{ height: att, y: 175 - att }}
                    />
                    <text x={x + 18} y="200" textAnchor="middle" fill="#64748b" fontSize="11">
                      {item.month.slice(5)}
                    </text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="mt-4 flex min-h-36 items-center justify-center rounded-xl bg-slate-50 text-xs text-slate-500">
              Monthly trends appear as sessions are delivered.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
function TrainingSessionPage() {
  const { user, activeRole, role } = useAuthStore();
  const activeRoleName = activeRole?.baseRole ?? activeRole?.name ?? role;
  const isStudent = activeRoleName === 'student';
  const canView = useHasPermission('placement', 'view');
  const canCreate = useHasPermission('placement', 'create');
  const canEdit = useHasPermission('placement', 'edit');
  const canApprove = useHasPermission('placement', 'approve');
  const canDelete = useHasPermission('placement', 'delete');
  const canExport = useHasPermission('placement', 'export');
  const canAttend = !isStudent && (canEdit || canApprove);

  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState<TTrainingStatus | ''>('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ITrainingSession | null>(null);
  const [detail, setDetail] = useState<ITrainingSession | null>(null);
  const [attSession, setAttSession] = useState<ITrainingSession | null>(null);
  const [view, setView] = useState<'overview' | 'sessions' | 'schedule'>(
    isStudent ? 'sessions' : 'overview',
  );

  // Fetch
  const { data: raw, isLoading, mutate } = useSwr('training-session');
  const { data: upcoming } = useSwr('training-session/upcoming?days=14');
  const { data: myRaw } = useSwr(isStudent ? 'training-session/my' : null);

  const sessions = useMemo(() => (raw?.data ?? []) as ITrainingSession[], [raw]);
  const upcomingS = useMemo(() => (upcoming?.data ?? []) as ITrainingSession[], [upcoming]);
  const mySessions = useMemo(() => (myRaw?.data ?? []) as ITrainingSession[], [myRaw]);

  const { mutation } = useMutation();

  const filtered = useMemo(
    () =>
      sessions.filter((s) => {
        if (filterType && s.type !== filterType) return false;
        if (filterStatus && s.status !== filterStatus) return false;
        return true;
      }),
    [sessions, filterType, filterStatus],
  );

  // Register / Unregister
  const handleRegister = async (s: ITrainingSession) => {
    const isReg = s.isRegistered || s.registeredStudents?.includes(user?._id ?? '');
    const endpoint = `training-session/${s._id}/register`;
    const method = isReg ? 'DELETE' : 'POST';
    const res = await mutation(endpoint, { method, isAlert: true });
    if (mutationSucceeded(res)) {
      toast.success(isReg ? 'Unregistered successfully' : 'Registered successfully');
      mutate();
    } else toast.error('Action failed');
  };

  const handleTransition = async (
    session: ITrainingSession,
    action: 'publish' | 'start' | 'cancel',
  ) => {
    let body: Record<string, string> | undefined;
    if (action === 'cancel') {
      const result = await Swal.fire({
        title: 'Cancel this session?',
        input: 'textarea',
        inputLabel: 'Reason students will see',
        inputPlaceholder: 'Explain why the session is being cancelled…',
        showCancelButton: true,
        inputValidator: (value) =>
          value.trim().length < 5 ? 'Please provide a meaningful reason' : undefined,
      });
      if (!result.isConfirmed) return;
      body = { reason: result.value.trim() };
    }
    const res = await mutation(`training-session/${session._id}/${action}`, {
      method: 'PUT',
      body,
      isAlert: true,
    });
    if (mutationSucceeded(res)) {
      toast.success(
        action === 'publish'
          ? 'Session published and eligible students notified'
          : action === 'start'
            ? 'Attendance is now open'
            : 'Session cancelled and registered students notified',
      );
      mutate();
    }
  };

  // Delete
  const handleDelete = async (s: ITrainingSession) => {
    const r = await Swal.fire({
      title: 'Delete session?',
      text: s.title,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#d33',
    });
    if (!r.isConfirmed) return;
    const res = await mutation(`training-session/${s._id}`, { method: 'DELETE', isAlert: true });
    if (mutationSucceeded(res)) {
      toast.success('Deleted');
      mutate();
    } else toast.error('Failed to delete');
  };

  // Table columns
  const columns: Column<ITrainingSession>[] = [
    {
      field: 'title',
      title: 'Session',
      render: (row) => (
        <div>
          <p className="text-sm font-semibold text-slate-800">{row.title}</p>
          <p className="text-xs text-slate-600">{row.type}</p>
        </div>
      ),
    },
    {
      field: 'scheduledDate',
      title: 'Date & Time',
      render: (row) => (
        <div>
          <p className="text-sm text-slate-700">{fmtDate(row.scheduledDate)}</p>
          <p className="text-xs text-slate-600">
            {row.startTime} – {row.endTime}
          </p>
        </div>
      ),
    },
    {
      field: 'facilitator',
      title: 'Facilitator',
      render: (row) => (
        <div>
          <p className="text-sm text-slate-700">{row.facilitator}</p>
          {row.facilitatorOrg && <p className="text-xs text-slate-600">{row.facilitatorOrg}</p>}
        </div>
      ),
    },
    {
      field: 'venue',
      title: 'Venue',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-600" />
          <p className="text-sm text-slate-700">{row.venue}</p>
        </div>
      ),
    },
    {
      field: 'mode',
      title: 'Mode',
      render: (row) => (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
          {MODE_ICON[row.mode]} {row.mode}
        </span>
      ),
    },
    {
      field: 'status',
      title: 'Status',
      render: (row) => {
        const cfg = STATUS_CFG[row.status] ?? STATUS_CFG.scheduled;
        return (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        );
      },
    },
    {
      field: 'registeredStudents',
      title: 'Registrations',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-slate-600" />
          <span className="text-sm text-slate-700">{row.registeredStudents?.length ?? 0}</span>
          {row.maxParticipants && (
            <span className="text-xs text-slate-600">/ {row.maxParticipants}</span>
          )}
        </div>
      ),
    },
  ];

  const actions: Action<ITrainingSession>[] = [
    {
      tooltip: 'View Details',
      icon: <BookOpen className="h-4 w-4 text-primary" />,
      onClick: setDetail,
    },
    ...(isStudent
      ? [
          {
            tooltip: 'Register / Unregister',
            icon: <UserPlus className="h-4 w-4 text-green-500" />,
            onClick: handleRegister,
          },
        ]
      : []),
    ...(canAttend
      ? [
          {
            tooltip: 'Mark Attendance',
            icon: <CheckCircle className="h-4 w-4 text-amber-500" />,
            onClick: (s: ITrainingSession) => {
              if (s.status !== 'ongoing')
                return toast.info('Start the scheduled session before marking attendance');
              setAttSession(s);
            },
          },
        ]
      : []),
    ...(canEdit || canDelete
      ? [
          ...(canEdit
            ? ([
                {
                  tooltip: 'Edit',
                  icon: <Edit2 className="h-4 w-4 text-slate-500" />,
                  onClick: (s: ITrainingSession) => {
                    if (s.status !== 'draft')
                      return toast.info('Only draft sessions can be edited');
                    setEditing(s);
                    setShowForm(true);
                  },
                },
              ] as Action<ITrainingSession>[])
            : []),
          ...(canDelete
            ? ([
                {
                  tooltip: 'Delete',
                  icon: <Trash2 className="h-4 w-4 text-red-400" />,
                  onClick: handleDelete,
                },
              ] as Action<ITrainingSession>[])
            : []),
        ]
      : []),
  ];

  if (!canView)
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-bold text-slate-900">Training sessions unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your active role cannot access placement-readiness training.
        </p>
      </div>
    );
  const tabs = isStudent
    ? [
        {
          id: 'sessions' as const,
          label: 'Explore sessions',
          detail: 'Eligible training programmes',
          icon: BookOpen,
        },
        {
          id: 'schedule' as const,
          label: 'My schedule',
          detail: 'Registered sessions and resources',
          icon: Calendar,
        },
      ]
    : [
        {
          id: 'overview' as const,
          label: 'Overview',
          detail: 'Participation and outcomes',
          icon: LayoutDashboard,
        },
        {
          id: 'sessions' as const,
          label: 'Training sessions',
          detail: 'Plan, publish and deliver',
          icon: Target,
        },
      ];

  return (
    <div className="flex flex-col gap-5">
      {/* Page header */}
      <div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Placement readiness &amp; training</h1>
          <p className="mt-1 max-w-4xl text-sm text-slate-500">
            Plan employability programmes, manage registrations and attendance, and measure how
            training prepares students for jobs and placement drives.
          </p>
        </div>
      </div>
      <div
        role="tablist"
        aria-label="Training workspace"
        className="flex w-fit max-w-full gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2"
      >
        {tabs.map(({ id, label, detail, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors ${view === id ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${view === id ? 'bg-white/15' : 'bg-slate-100'}`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-xs font-bold">{label}</span>
              <span className={`text-[10px] ${view === id ? 'text-white/75' : 'text-slate-400'}`}>
                {detail}
              </span>
            </span>
          </button>
        ))}
      </div>
      {!isStudent && view === 'overview' && <TrainingAnalytics />}

      {/* Upcoming banner */}
      {!isStudent && view === 'overview' && upcomingS.length > 0 && (
        <div className="rounded-2xl bg-linear-to-r from-primary/10 to-blue-50 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-slate-800">Upcoming (next 14 days)</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {upcomingS.slice(0, 4).map((s) => (
              <button
                key={s._id}
                onClick={() => setDetail(s)}
                className="flex items-start gap-3 rounded-xl bg-white px-4 py-3 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 line-clamp-1">{s.title}</p>
                  <p className="text-xs text-slate-500">
                    {fmtDate(s.scheduledDate)} · {s.startTime}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* My Schedule (Student) */}
      {isStudent && view === 'schedule' && mySessions.length > 0 && (
        <div className="rounded-2xl bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <UserMinus className="h-4 w-4 text-green-500" />
            <p className="text-sm font-semibold text-slate-800">My Registered Sessions</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {mySessions.map((s) => {
              const cfg = STATUS_CFG[s.status];
              return (
                <div
                  key={s._id}
                  className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{s.title}</p>
                    <p className="text-xs text-slate-500">{fmtDate(s.scheduledDate)}</p>
                  </div>
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${cfg.bg} ${cfg.text}`}>
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isStudent && view === 'schedule' && mySessions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center">
          <Calendar className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-bold text-slate-800">No registered sessions</p>
          <p className="mt-1 text-xs text-slate-500">
            Register from Explore Sessions to build your readiness schedule.
          </p>
        </div>
      )}

      {/* Filters */}
      {view === 'sessions' && (
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-[1fr_220px_auto_auto] xl:items-center">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/10"
          >
            <option value="">All Types</option>
            {TRAINING_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as TTrainingStatus | '')}
            className="h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/10"
          >
            <option value="">All Statuses</option>
            {(Object.keys(STATUS_CFG) as TTrainingStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_CFG[s].label}
              </option>
            ))}
          </select>
          {(filterType || filterStatus) && (
            <button
              type="button"
              className="inline-flex h-[42px] items-center justify-center rounded-lg px-3 text-xs font-bold text-primary hover:bg-primary/5"
              onClick={() => {
                setFilterType('');
                setFilterStatus('');
              }}
            >
              Clear filters
            </button>
          )}
          {canCreate && (
            <CustomButton
              variant="primary"
              startIcon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
              className="w-fit! shrink-0"
            >
              New session
            </CustomButton>
          )}
        </div>
      )}

      {/* Table */}
      {view === 'sessions' && (
        <DataViewSwitcher<ITrainingSession>
          data={filtered}
          isLoading={isLoading}
          storageKey="training-session.view"
          searchPlaceholder="Search sessions…"
          searchFields={['title', 'type', 'facilitator', 'venue']}
          renderCard={(s) => {
            const isReg =
              s.isRegistered ||
              (Array.isArray(s.registeredStudents) &&
                s.registeredStudents.includes(user?._id ?? ''));
            const statusStyle =
              s.status === 'completed'
                ? 'bg-green-50 text-green-600'
                : s.status === 'cancelled'
                  ? 'bg-red-50 text-red-500'
                  : s.status === 'ongoing'
                    ? 'bg-blue-50 text-blue-600'
                    : 'bg-amber-50 text-amber-600';
            return (
              <motion.div
                whileHover={{ y: -2 }}
                className="flex flex-col gap-3 rounded-2xl bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
                    {s.mode === 'Online' ? (
                      <Wifi className="h-5 w-5" />
                    ) : s.mode === 'Hybrid' ? (
                      <Monitor className="h-5 w-5" />
                    ) : (
                      <Award className="h-5 w-5" />
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${statusStyle}`}
                  >
                    {s.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 line-clamp-2">{s.title}</p>
                  <p className="text-[11px] uppercase tracking-wide text-slate-600">{s.type}</p>
                </div>
                <div className="space-y-1.5 text-xs text-slate-500">
                  <p className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 text-slate-600" />
                    {s.scheduledDate ? new Date(s.scheduledDate).toLocaleDateString() : '—'}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-slate-600" />
                    {s.startTime} · {s.duration}h
                  </p>
                  <p className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 text-slate-600" />
                    <span className="truncate">{s.venue}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <BookOpen className="h-3 w-3 text-slate-600" />
                    <span className="truncate">{s.facilitator}</span>
                  </p>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Users className="h-3 w-3" />{' '}
                    {Array.isArray(s.registeredStudents) ? s.registeredStudents.length : 0}
                    {s.maxParticipants ? `/${s.maxParticipants}` : ''}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDetail(s)}
                      className="font-medium text-slate-500 hover:text-primary"
                    >
                      View
                    </button>
                    {isStudent && (
                      <button
                        type="button"
                        onClick={() => handleRegister(s)}
                        className={`inline-flex items-center gap-1 font-medium ${isReg ? 'text-red-500' : 'text-primary'} hover:underline`}
                      >
                        {isReg ? (
                          <>
                            <UserMinus className="h-3 w-3" /> Unregister
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-3 w-3" /> Register
                          </>
                        )}
                      </button>
                    )}
                    {canAttend && (
                      <>
                        {canApprove && s.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => handleTransition(s, 'publish')}
                            className="inline-flex items-center gap-1 font-medium text-green-600 hover:underline"
                          >
                            <Send className="h-3 w-3" /> Publish
                          </button>
                        )}
                        {canApprove && s.status === 'scheduled' && (
                          <button
                            type="button"
                            onClick={() => handleTransition(s, 'start')}
                            className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
                          >
                            <Play className="h-3 w-3" /> Start
                          </button>
                        )}
                        {s.status === 'ongoing' && (
                          <button
                            type="button"
                            onClick={() => setAttSession(s)}
                            className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
                          >
                            <CheckCircle className="h-3 w-3" /> Attendance
                          </button>
                        )}
                      </>
                    )}
                    {(canEdit || canDelete) && s.status === 'draft' && (
                      <>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(s);
                              setShowForm(true);
                            }}
                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                          >
                            <Edit2 className="h-3 w-3" /> Edit
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(s)}
                            className="inline-flex items-center gap-1 font-medium text-red-500 hover:underline"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </>
                    )}
                    {canApprove && s.status === 'scheduled' && (
                      <button
                        type="button"
                        onClick={() => handleTransition(s, 'cancel')}
                        className="font-medium text-red-500 hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          }}
          table={
            <CustomTable<ITrainingSession>
              title="Training session register"
              description="Readiness programmes, facilitators, schedules, registration capacity and delivery status."
              data={filtered}
              columns={columns}
              actions={actions}
              isLoading={isLoading}
              onRefresh={() => void mutate()}
              options={{
                search: true,
                refresh: true,
                export: canExport,
                pagination: true,
                pageSize: 15,
                responsive: true,
              }}
            />
          }
        />
      )}

      {/* Modals */}
      <AnimatePresence>
        {showForm && (
          <SessionForm
            initial={editing ?? undefined}
            onClose={() => {
              setShowForm(false);
              setEditing(null);
            }}
            onSaved={mutate}
          />
        )}
        {detail && (
          <DetailDrawer
            session={detail}
            onClose={() => setDetail(null)}
            canManage={canEdit || canApprove}
            onMutate={mutate}
          />
        )}
        {attSession && (
          <AttendanceDrawer
            session={attSession}
            onClose={() => setAttSession(null)}
            onSaved={mutate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default UseProtectedRoutes(TrainingSessionPage);

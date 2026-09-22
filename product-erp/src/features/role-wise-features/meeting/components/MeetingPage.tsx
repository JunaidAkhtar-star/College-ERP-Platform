/**
 * @file MeetingPage.tsx
 * @description Full meeting management: calendar view, list, schedule, update status, remarks, attendance, delete.
 * @module features/role-wise-features/meeting
 */
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import EngagementWorkflowBar from '@/shared/components/EngagementWorkflowBar';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import {
  Users,
  Video,
  Building2,
  CheckCircle,
  XCircle,
  X,
  Clock,
  Plus,
  Calendar,
  Edit2,
  MessageSquare,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import AsyncSelect from '@/shared/core/AsyncSelect';
import CalendarView, { CalendarEvent } from '@/shared/core/CalendarView';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { useAuthStore } from '@/shared/store/authStore';
import Link from 'next/link';
import MeetingUsageDashboard from './MeetingUsageDashboard';

type MeetingType = 'faculty' | 'student';
type MeetingMode = 'physical' | 'online' | 'hybrid';
type MeetingStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled';

interface IMeeting {
  _id: string;
  title: string;
  meetingType: MeetingType;
  agenda: string;
  scheduledAt: string;
  durationMinutes?: number;
  durationSpecified?: boolean;
  startedAt?: string;
  endedAt?: string;
  updatedAt?: string;
  mode: MeetingMode;
  venue?: string;
  meetingLink?: string;
  conductedBy: string | { _id: string; name?: string };
  createdBy?: string | { _id: string };
  status: MeetingStatus;
  concludingRemarks?: string;
  minutesStatus?: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  minutesSubmittedBy?: string | { _id?: string };
  invitees: string[];
  targetDepartments: string[];
  targetYears: number[];
  attendees: {
    userId:
      | string
      | { _id: string; name?: string; email?: string; studentId?: string; facultyId?: string };
    attended: boolean;
    joinedAt?: string;
  }[];
  [key: string]: unknown;
}
interface IMeetingRecording {
  _id: string;
  title: string;
  playbackUrl: string;
  bytes: number;
  durationSeconds: number;
  expiresAt: string;
  createdAt: string;
}

const STATUS_CFG: Record<MeetingStatus, { label: string; bg: string; text: string; dot: string }> =
  {
    scheduled: { label: 'Scheduled', bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-400' },
    ongoing: { label: 'Ongoing', bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-400' },
    completed: {
      label: 'Completed',
      bg: 'bg-green-50',
      text: 'text-green-600',
      dot: 'bg-green-400',
    },
    cancelled: {
      label: 'Cancelled',
      bg: 'bg-slate-100',
      text: 'text-slate-500',
      dot: 'bg-slate-400',
    },
  };

const MODE_ICON: Record<MeetingMode, React.ReactNode> = {
  physical: <Building2 className="h-3.5 w-3.5" />,
  online: <Video className="h-3.5 w-3.5" />,
  hybrid: <LayoutGrid className="h-3.5 w-3.5" />,
};

const inputCls =
  'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15';
const selectCls = inputCls;

const toLocalDateTimeInput = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const getMeetingTimeSignal = (meeting: IMeeting, now: number) => {
  const startsAt = new Date(meeting.scheduledAt).getTime();
  const hasDuration =
    meeting.durationSpecified === true ||
    (meeting.durationSpecified === undefined && meeting.durationMinutes !== 60);
  const endsAt =
    hasDuration && meeting.durationMinutes
      ? startsAt + Number(meeting.durationMinutes) * 60_000
      : null;
  if (meeting.status === 'cancelled') return 'Cancelled';
  if (meeting.status === 'completed') return 'Ended';
  if (meeting.status === 'ongoing') {
    const actualStart = new Date(
      meeting.startedAt || meeting.updatedAt || meeting.scheduledAt,
    ).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((now - actualStart) / 1000));
    const formatCounter = (seconds: number) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = seconds % 60;
      return hours
        ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
        : `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    };
    if (hasDuration && meeting.durationMinutes) {
      const plannedSeconds = Number(meeting.durationMinutes) * 60;
      return elapsedSeconds <= plannedSeconds
        ? `Live · ${formatCounter(plannedSeconds - elapsedSeconds)} left`
        : `Live · +${formatCounter(elapsedSeconds - plannedSeconds)}`;
    }
    return `Live · ${formatCounter(elapsedSeconds)} running`;
  }
  if (endsAt && now >= endsAt) return 'Ended';
  if (now >= startsAt) return 'Awaiting start';
  const difference = startsAt - now;
  if (difference < 60 * 60_000) return `Starts in ${Math.max(1, Math.ceil(difference / 60_000))}m`;
  return `Starts ${new Date(startsAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
};

const meetingSchema = Yup.object({
  title: Yup.string().required('Required'),
  meetingType: Yup.string().required('Required'),
  agenda: Yup.string().required('Required'),
  scheduledAt: Yup.string().required('Required'),
  durationMinutes: Yup.number().min(5, 'Minimum 5 minutes').max(1440, 'Maximum 24 hours'),
  mode: Yup.string().required('Required'),
  venue: Yup.string().when('mode', {
    is: (value: MeetingMode) => value === 'physical' || value === 'hybrid',
    then: (schema) => schema.trim().required('Venue is required for this mode'),
  }),
  meetingLink: Yup.string().when('mode', {
    is: (value: MeetingMode) => value === 'online' || value === 'hybrid',
    then: (schema) => schema.trim().required('Choose an internal room or provide a link'),
  }),
  recurrence: Yup.string().oneOf(['none', 'daily', 'weekly', 'monthly']).required('Required'),
  recurrenceCount: Yup.number().when('recurrence', {
    is: (value: string) => value !== 'none',
    then: (schema) => schema.min(2, 'Use at least 2 occurrences').max(52).required('Required'),
    otherwise: (schema) => schema.default(1),
  }),
  invitees: Yup.array().when('meetingType', {
    is: 'faculty',
    then: (schema) => schema.min(1, 'At least one invitee is required'),
    otherwise: (schema) => schema.optional(),
  }),
});

export default function MeetingPage() {
  const _role = useAuthStore((s) => s.role);
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role ?? '',
  );
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = ['super_admin', 'admin', 'principal', 'hod'].includes(activeRole);
  const isStudent = activeRole === 'student';
  const isFaculty = activeRole === 'faculty';
  const canCreate = useHasPermission('meeting', 'create');
  const canEdit = useHasPermission('meeting', 'edit');
  const canDelete = useHasPermission('meeting', 'delete');
  const canReviewMinutes = useHasPermission('meeting', 'approve');
  const hasGlobalManage = canReviewMinutes;
  const idOf = (value?: string | { _id?: string }) =>
    typeof value === 'string' ? value : String(value?._id ?? '');
  const canManage = (meeting: IMeeting) =>
    canEdit &&
    (hasGlobalManage ||
      (!!currentUser &&
        [idOf(meeting.conductedBy), idOf(meeting.createdBy)].includes(currentUser._id)));

  const [viewMode, setViewMode] = useState<'calendar' | 'grid'>('calendar');
  const [calendarNow, setCalendarNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setCalendarNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const [showUsageDrawer, setShowUsageDrawer] = useState(false);
  const [calendarScopes, setCalendarScopes] = useState({
    faculty: true,
    student: true,
    completed: true,
  });
  const [showModal, setShowModal] = useState(false);
  const [editMeeting, setEditMeeting] = useState<IMeeting | null>(null);
  const [detailMeeting, setDetailMeeting] = useState<IMeeting | null>(null);
  const [recordingsMeetingId, setRecordingsMeetingId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null);
  const detailHostId = detailMeeting
    ? typeof detailMeeting.conductedBy === 'object'
      ? detailMeeting.conductedBy._id
      : detailMeeting.conductedBy
    : '';
  const canManageRecordings = Boolean(
    detailMeeting && currentUser && detailHostId === currentUser._id,
  );
  const {
    data: recordingResponse,
    mutate: refreshRecordings,
    isLoading: recordingsLoading,
  } = useSwr<{
    data?: IMeetingRecording[];
  }>(
    canManageRecordings && detailMeeting && recordingsMeetingId === detailMeeting._id
      ? `meeting-recording/meeting/${detailMeeting._id}`
      : null,
  );
  const recordings = recordingResponse?.data ?? [];
  const detailCanJoin = Boolean(
    detailMeeting &&
    (detailMeeting.status === 'ongoing' ||
      (!['cancelled', 'completed'].includes(detailMeeting.status) &&
        calendarNow >= new Date(detailMeeting.scheduledAt).getTime() - 10 * 60_000 &&
        calendarNow <
          new Date(detailMeeting.scheduledAt).getTime() +
            Number(detailMeeting.durationMinutes || 60) * 60_000)),
  );

  const basePath = isStudent ? 'meeting/student' : isFaculty && !isAdmin ? 'meeting/my' : 'meeting';
  const { data: raw, error: meetingError, mutate } = useSwr(basePath);
  const meetings = useMemo(() => (raw as { data?: IMeeting[] })?.data ?? [], [raw]);
  const visibleMeetings = useMemo(
    () =>
      meetings.filter(
        (meeting) =>
          calendarScopes[meeting.meetingType] &&
          (calendarScopes.completed || meeting.status !== 'completed'),
      ),
    [calendarScopes, meetings],
  );
  const { mutation, isLoading: saving } = useMutation();

  // ── Calendar events ────────────────────────────────────────────────────────
  const calEvents: CalendarEvent[] = useMemo(
    () =>
      visibleMeetings.map((m) => {
        const displayedStart =
          m.status !== 'scheduled' && m.startedAt ? new Date(m.startedAt) : new Date(m.scheduledAt);
        const displayedEnd =
          m.status === 'completed' && m.endedAt
            ? new Date(m.endedAt)
            : new Date(displayedStart.getTime() + (m.durationMinutes ?? 60) * 60 * 1000);
        return {
          id: m._id,
          title: m.title,
          date: displayedStart,
          endDate: displayedEnd,
          category: m.meetingType,
          color:
            m.status === 'cancelled'
              ? 'bg-slate-400'
              : m.status === 'completed'
                ? 'bg-emerald-500'
                : m.status === 'ongoing'
                  ? 'bg-amber-500'
                  : m.meetingType === 'faculty'
                    ? 'bg-primary'
                    : 'bg-secondary',
          badge: `${displayedStart.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          })} · ${m.title} · ${getMeetingTimeSignal(m, calendarNow)}`,
          statusLabel: getMeetingTimeSignal(m, calendarNow),
          payload: m as unknown as Record<string, unknown>,
        };
      }),
    [calendarNow, visibleMeetings],
  );

  // ── Form ───────────────────────────────────────────────────────────────────
  const formik = useFormik({
    initialValues: {
      title: editMeeting?.title ?? '',
      meetingType: (editMeeting?.meetingType ?? 'faculty') as MeetingType,
      agenda: editMeeting?.agenda ?? '',
      scheduledAt: editMeeting?.scheduledAt
        ? toLocalDateTimeInput(editMeeting.scheduledAt)
        : scheduleDate
          ? toLocalDateTimeInput(scheduleDate)
          : '',
      durationMinutes: editMeeting?.durationMinutes ?? '',
      mode: (editMeeting?.mode ?? 'physical') as MeetingMode,
      recurrence: 'none',
      recurrenceCount: 1,
      venue: editMeeting?.venue ?? '',
      meetingLink: editMeeting?.meetingLink ?? '',
      invitees: editMeeting?.invitees
        ? editMeeting.invitees.map((i) =>
            typeof i === 'object' && i ? (i as { _id: string })._id : (i as string),
          )
        : [],
      targetDepartments: editMeeting?.targetDepartments
        ? editMeeting.targetDepartments.map((d) =>
            typeof d === 'object' && d ? (d as { _id: string })._id : (d as string),
          )
        : [],
      targetYears: editMeeting?.targetYears ?? [],
    },
    enableReinitialize: true,
    validationSchema: meetingSchema,
    onSubmit: async (values, { resetForm }) => {
      const body = {
        ...values,
        scheduledAt: values.scheduledAt ? new Date(values.scheduledAt).toISOString() : '',
        durationMinutes: values.durationMinutes ? Number(values.durationMinutes) : undefined,
      };
      if (!body.venue) delete (body as Record<string, unknown>).venue;
      if (!body.meetingLink) delete (body as Record<string, unknown>).meetingLink;
      if (!body.durationMinutes) delete (body as Record<string, unknown>).durationMinutes;

      // Filter out empty options or clean up fields depending on type
      if (body.meetingType === 'faculty') {
        delete (body as Record<string, unknown>).targetDepartments;
        delete (body as Record<string, unknown>).targetYears;
      } else {
        delete (body as Record<string, unknown>).invitees;
      }

      const isEdit = !!editMeeting;
      const res = await mutation(isEdit ? `meeting/${editMeeting!._id}` : 'meeting', {
        method: isEdit ? 'PUT' : 'POST',
        body,
        isAlert: true,
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success(isEdit ? 'Meeting updated' : 'Meeting scheduled');
        resetForm();
        setShowModal(false);
        setEditMeeting(null);
        mutate();
      } else toast.error('Failed');
    },
  });

  const handleStatusChange = async (m: IMeeting, status: MeetingStatus) => {
    if (status === 'cancelled') {
      const confirmation = await Swal.fire({
        title: 'Cancel this meeting?',
        text: `“${m.title}” will be marked as cancelled. Participants will no longer be able to join it.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, cancel meeting',
        cancelButtonText: 'Keep meeting',
        confirmButtonColor: '#e11d48',
        cancelButtonColor: '#64748b',
        reverseButtons: true,
        focusCancel: true,
      });
      if (!confirmation.isConfirmed) return;
    }

    const res = await mutation(`meeting/${m._id}/status`, {
      method: 'PATCH',
      body: { status },
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success(`Status → ${status}`);
      mutate();
      if (detailMeeting?._id === m._id) setDetailMeeting({ ...detailMeeting, status });
    } else toast.error('Failed');
  };

  const handleRemarks = async (m: IMeeting) => {
    const { value: remarks } = await Swal.fire({
      title: 'Concluding Remarks',
      input: 'textarea',
      inputPlaceholder: 'Write the meeting conclusion...',
      inputValue: m.concludingRemarks ?? '',
      showCancelButton: true,
      confirmButtonText: 'Save',
      confirmButtonColor: '#0178D7',
      preConfirm: (v) => {
        if (!v) {
          Swal.showValidationMessage('Remarks required');
          return false;
        }
        return v;
      },
    });
    if (!remarks) return;
    const res = await mutation(`meeting/${m._id}/remarks`, {
      method: 'POST',
      body: { remarks },
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Remarks saved');
      mutate();
    } else toast.error('Failed');
  };

  const handleDelete = async (m: IMeeting) => {
    const impactResponse = await mutation(`meeting/${m._id}/deletion-impact`, {
      method: 'GET',
      silentError: true,
    });
    const impact = (
      impactResponse as {
        results?: { data?: { recordingCount?: number; recordingBytes?: number } };
      }
    )?.results?.data;
    if (!impact) {
      toast.error('Could not verify the meeting deletion impact. Nothing was deleted.');
      return;
    }
    const recordingCount = Number(impact.recordingCount ?? 0);
    const recordingSize = Number(impact.recordingBytes ?? 0);
    const readableSize =
      recordingSize >= 1_073_741_824
        ? `${(recordingSize / 1_073_741_824).toFixed(2)} GB`
        : `${(recordingSize / 1_048_576).toFixed(recordingSize > 0 ? 1 : 0)} MB`;
    const r = await Swal.fire({
      title: 'Permanently delete meeting?',
      html: `<div style="text-align:left;line-height:1.55"><strong>${m.title.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!)}</strong><p style="margin-top:10px">This removes the meeting and its conversation history.</p>${recordingCount > 0 ? `<p style="margin-top:8px;color:#be123c"><strong>${recordingCount} recording${recordingCount === 1 ? '' : 's'} (${readableSize})</strong> will also be permanently removed from secure Cloudinary storage.</p>` : '<p style="margin-top:8px">No active recordings are attached to this meeting.</p>'}<p style="margin-top:8px">This action cannot be undone.</p></div>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: recordingCount > 0 ? 'Delete meeting and recordings' : 'Delete meeting',
      cancelButtonText: 'Keep meeting',
      confirmButtonColor: '#e11d48',
      reverseButtons: true,
      focusCancel: true,
    });
    if (!r.isConfirmed) return;
    const res = await mutation(`meeting/${m._id}`, { method: 'DELETE', isAlert: true });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success(
        recordingCount > 0
          ? `Meeting and ${recordingCount} recording${recordingCount === 1 ? '' : 's'} deleted`
          : 'Meeting permanently deleted',
      );
      mutate();
      if (detailMeeting?._id === m._id) setDetailMeeting(null);
    } else toast.error('Failed');
  };

  const handleMarkAttendance = async (meetingId: string) => {
    const res = await mutation(`meeting/${meetingId}/attendance`, {
      method: 'POST',
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Attendance marked');
      mutate();
    } else toast.error('Failed');
  };

  const handleMinutesReview = async (meeting: IMeeting, decision: 'approved' | 'rejected') => {
    let note = '';
    if (decision === 'rejected') {
      const result = await Swal.fire({
        title: 'Return meeting minutes',
        input: 'textarea',
        inputPlaceholder: 'Explain the required correction…',
        showCancelButton: true,
        preConfirm: (value) => {
          if (String(value ?? '').trim().length < 10) {
            Swal.showValidationMessage('Enter at least 10 characters');
            return false;
          }
          return String(value).trim();
        },
      });
      if (!result.isConfirmed) return;
      note = String(result.value);
    }
    const response = await mutation(`meeting/${meeting._id}/minutes/review`, {
      method: 'PATCH',
      body: { decision, note: note || undefined },
      isAlert: true,
    });
    if (response?.results?.success) {
      toast.success(decision === 'approved' ? 'Minutes approved' : 'Minutes returned for revision');
      setDetailMeeting({ ...meeting, minutesStatus: decision });
      mutate();
    }
  };

  const deleteRecording = async (recording: IMeetingRecording) => {
    const confirmation = await Swal.fire({
      title: 'Delete recording?',
      text: 'This permanently removes the encrypted recording from storage.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#dc2626',
    });
    if (!confirmation.isConfirmed) return;
    const response = await mutation(`meeting-recording/${recording._id}`, { method: 'DELETE' });
    if (response?.results) {
      toast.success('Recording deleted');
      await refreshRecordings();
    }
  };

  const conductorName = (m: IMeeting) =>
    typeof m.conductedBy === 'object' ? ((m.conductedBy as { name?: string }).name ?? '—') : '—';

  return (
    <div className="space-y-5">
      <EngagementWorkflowBar />
      {meetingError && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {meetingError.message || 'Unable to load meetings.'}
          <button type="button" onClick={() => mutate()} className="ml-2 font-semibold underline">
            Retry
          </button>
        </div>
      )}
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Meetings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Schedule and manage faculty & student meetings
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <div
            className="inline-flex rounded-lg border border-slate-200 bg-white p-1"
            aria-label="Meeting view"
          >
            {(['calendar', 'grid'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  viewMode === mode ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {mode === 'calendar' ? (
                  <Calendar className="h-3.5 w-3.5" />
                ) : (
                  <LayoutGrid className="h-3.5 w-3.5" />
                )}
                {mode}
              </button>
            ))}
          </div>
          {canReviewMinutes && (
            <button
              type="button"
              onClick={() => {
                setDetailMeeting(null);
                setShowUsageDrawer(true);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-primary"
            >
              <BarChart3 className="h-4 w-4" />
              Usage Report
            </button>
          )}
          {canCreate && (
            <CustomButton
              variant="primary"
              startIcon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setEditMeeting(null);
                setScheduleDate(null);
                setShowModal(true);
              }}
              className="w-fit!"
            >
              Schedule Meeting
            </CustomButton>
          )}
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {viewMode === 'calendar' ? (
          <motion.div
            key="calendar"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid-cols-[250px_minmax(0,1fr)]"
          >
            <MeetingCalendarSidebar
              scopes={calendarScopes}
              onScopeChange={(scope) =>
                setCalendarScopes((current) => ({ ...current, [scope]: !current[scope] }))
              }
              onSchedule={
                canCreate
                  ? (date) => {
                      setScheduleDate(date);
                      setEditMeeting(null);
                      setShowModal(true);
                    }
                  : undefined
              }
            />
            <div className="min-w-0 overflow-hidden border-t border-slate-200 bg-white p-2 lg:border-l lg:border-t-0 sm:p-3">
              <CalendarView
                events={calEvents}
                view="week"
                disablePastDates
                onDayClick={
                  canCreate
                    ? (date) => {
                        setScheduleDate(date);
                        setEditMeeting(null);
                        setShowModal(true);
                      }
                    : undefined
                }
                onAddClick={
                  canCreate
                    ? (date) => {
                        setScheduleDate(date);
                        setEditMeeting(null);
                        setShowModal(true);
                      }
                    : undefined
                }
                onEventClick={(ev) => setDetailMeeting(ev.payload as unknown as IMeeting)}
                renderEventPopover={(event, close) => {
                  const m = event.payload as unknown as IMeeting;
                  const sc = STATUS_CFG[m.status];
                  return (
                    <div className="space-y-2">
                      <p className="font-semibold text-slate-800">{m.title}</p>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${sc.bg} ${sc.text}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>
                      <p className="text-xs text-slate-500 line-clamp-2">{m.agenda}</p>
                      <p className="text-xs text-slate-600">
                        {new Date(m.scheduledAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {(m.durationSpecified === true ||
                          (m.durationSpecified === undefined && m.durationMinutes !== 60)) &&
                        m.durationMinutes
                          ? ` · ${m.durationMinutes}m`
                          : ''}
                      </p>
                      <p className="rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-bold text-primary">
                        {getMeetingTimeSignal(m, calendarNow)}
                      </p>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setDetailMeeting(m);
                            close();
                          }}
                          className="text-xs text-primary hover:underline"
                        >
                          View Details
                        </button>
                        {canManage(m) && m.status === 'scheduled' && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditMeeting(m);
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
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <MeetingCardGrid
              meetings={visibleMeetings}
              canManage={canManage}
              canDelete={canDelete}
              onView={setDetailMeeting}
              onEdit={(meeting) => {
                setEditMeeting(meeting);
                setShowModal(true);
              }}
              onDelete={handleDelete}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && ((editMeeting && canManage(editMeeting)) || (!editMeeting && canCreate)) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
              onClick={() => {
                setShowModal(false);
                setEditMeeting(null);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.2 }}
              className="relative z-10 max-h-[94dvh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white"
            >
              <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary">
                  <Calendar className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {editMeeting ? 'Edit meeting' : 'Schedule a meeting'}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Define the purpose, participants, schedule and joining method.
                  </p>
                </div>
              </div>
              <form onSubmit={formik.handleSubmit} className="space-y-5 p-5 sm:p-6">
                <div className="grid gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4 sm:grid-cols-4">
                  {[
                    { step: '1', title: 'Basics', text: 'Purpose, type and mode' },
                    { step: '2', title: 'Recurrence', text: 'One-time or repeating' },
                    { step: '3', title: 'Audience', text: 'Invite the right people' },
                    { step: '4', title: 'Delivery', text: 'Agenda, time and access' },
                  ].map((item) => (
                    <div key={item.step} className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-primary">
                        {item.step}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{item.title}</p>
                        <p className="text-[10px] text-slate-500">{item.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <section className="space-y-4 rounded-xl border border-slate-200 p-4 sm:p-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                      Section 1
                    </p>
                    <h3 className="mt-1 text-sm font-bold text-slate-900">Meeting basics</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Give participants a clear purpose and choose how the meeting will run.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Title *</label>
                    <input
                      name="title"
                      value={formik.values.title}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      placeholder="Example: Department curriculum review"
                      className={inputCls}
                    />
                    {formik.touched.title && formik.errors.title && (
                      <p className="mt-1 text-xs text-red-500">{formik.errors.title}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Type *
                      </label>
                      <select
                        name="meetingType"
                        value={formik.values.meetingType}
                        onChange={formik.handleChange}
                        className={selectCls}
                      >
                        <option value="faculty">Faculty Meeting</option>
                        <option value="student">Student Meeting</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Mode *
                      </label>
                      <select
                        name="mode"
                        value={formik.values.mode}
                        onChange={formik.handleChange}
                        className={selectCls}
                      >
                        <option value="physical">Physical</option>
                        <option value="online">Online</option>
                        <option value="hybrid">Hybrid</option>
                      </select>
                    </div>
                  </div>
                </section>
                {!editMeeting && (
                  <section className="space-y-4 rounded-xl border border-slate-200 p-4 sm:p-5">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                        Section 2
                      </p>
                      <h3 className="mt-1 text-sm font-bold text-slate-900">Recurrence</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Keep it one-time or generate a controlled recurring series.
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Repeat
                        </label>
                        <select
                          name="recurrence"
                          value={formik.values.recurrence}
                          onChange={formik.handleChange}
                          className={selectCls}
                        >
                          <option value="none">Does not repeat</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Occurrences
                        </label>
                        <input
                          type="number"
                          name="recurrenceCount"
                          min={formik.values.recurrence === 'none' ? 1 : 2}
                          max={52}
                          disabled={formik.values.recurrence === 'none'}
                          value={formik.values.recurrenceCount}
                          onChange={formik.handleChange}
                          className={inputCls}
                        />
                        {formik.touched.recurrenceCount && formik.errors.recurrenceCount && (
                          <p className="mt-1 text-xs text-red-500">
                            {formik.errors.recurrenceCount}
                          </p>
                        )}
                      </div>
                    </div>
                  </section>
                )}

                <section className="space-y-4 rounded-xl border border-slate-200 p-4 sm:p-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                      Section 3
                    </p>
                    <h3 className="mt-1 text-sm font-bold text-slate-900">Participants</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Invite only the people or student cohorts who need to attend.
                    </p>
                  </div>
                  {formik.values.meetingType === 'faculty' ? (
                    <div>
                      <AsyncSelect
                        type="users"
                        label="Invitees"
                        required
                        placeholder="Search eligible institution users"
                        params={{ excludeRoles: 'super_admin' }}
                        multiple
                        value={formik.values.invitees}
                        onChange={(val) => formik.setFieldValue('invitees', val)}
                        error={formik.errors.invitees as string}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <AsyncSelect
                        type="departments"
                        label="Target Departments"
                        multiple
                        value={formik.values.targetDepartments}
                        onChange={(val) => formik.setFieldValue('targetDepartments', val)}
                      />
                      <div>
                        <label className="mb-2.5 block text-xs font-medium text-slate-600">
                          Target Years
                        </label>
                        <div className="flex flex-wrap gap-3 py-1">
                          {[1, 2, 3, 4].map((year) => (
                            <label
                              key={year}
                              className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={formik.values.targetYears.includes(year)}
                                onChange={(e) => {
                                  const current = formik.values.targetYears;
                                  const next = e.target.checked
                                    ? [...current, year]
                                    : current.filter((y) => y !== year);
                                  formik.setFieldValue('targetYears', next);
                                }}
                                className="rounded border-slate-300 text-primary focus:ring-primary/20"
                              />
                              Yr {year}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </section>
                <section className="space-y-4 rounded-xl border border-slate-200 p-4 sm:p-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                      Section 4
                    </p>
                    <h3 className="mt-1 text-sm font-bold text-slate-900">
                      Agenda, schedule and access
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Set the discussion outcome, exact time and joining instructions.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Agenda *
                    </label>
                    <textarea
                      name="agenda"
                      value={formik.values.agenda}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      rows={3}
                      placeholder="List the discussion points, decisions required and expected outcome"
                      className={inputCls + ' resize-none'}
                    />
                    {formik.touched.agenda && formik.errors.agenda && (
                      <p className="mt-1 text-xs text-red-500">{formik.errors.agenda}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Date & Time *
                      </label>
                      <input
                        type="datetime-local"
                        name="scheduledAt"
                        value={formik.values.scheduledAt}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        min={toLocalDateTimeInput(new Date())}
                        className={inputCls}
                      />
                      {formik.touched.scheduledAt && formik.errors.scheduledAt && (
                        <p className="mt-1 text-xs text-red-500">{formik.errors.scheduledAt}</p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Duration (min)
                      </label>
                      <input
                        type="number"
                        name="durationMinutes"
                        value={formik.values.durationMinutes}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        min={5}
                        placeholder="e.g. 60"
                        className={inputCls}
                      />
                      {formik.touched.durationMinutes && formik.errors.durationMinutes && (
                        <p className="mt-1 text-xs text-red-500">{formik.errors.durationMinutes}</p>
                      )}
                    </div>
                  </div>
                  {formik.values.mode !== 'online' && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Venue</label>
                      <input
                        name="venue"
                        value={formik.values.venue}
                        onChange={formik.handleChange}
                        placeholder="Room / Hall"
                        className={inputCls}
                      />
                    </div>
                  )}
                  {(formik.values.mode === 'online' || formik.values.mode === 'hybrid') && (
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Meeting Platform
                        </label>
                        <select
                          value={
                            formik.values.meetingLink === 'internal' ||
                            formik.values.meetingLink?.startsWith('/meeting/room/')
                              ? 'internal'
                              : 'external'
                          }
                          onChange={(e) => {
                            if (e.target.value === 'internal') {
                              formik.setFieldValue('meetingLink', 'internal');
                            } else {
                              formik.setFieldValue('meetingLink', '');
                            }
                          }}
                          className={selectCls}
                        >
                          <option value="external">External Link (Google Meet, Zoom, etc.)</option>
                          <option value="internal">Devvelocity Meet (Internal Virtual Room)</option>
                        </select>
                      </div>
                      {(!formik.values.meetingLink ||
                        (formik.values.meetingLink !== 'internal' &&
                          !formik.values.meetingLink.startsWith('/meeting/room/'))) && (
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            External Meeting Link
                          </label>
                          <input
                            name="meetingLink"
                            value={formik.values.meetingLink}
                            onChange={formik.handleChange}
                            placeholder="https://meet.google.com/..."
                            className={inputCls}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </section>
                <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:-mx-6 sm:-mb-6 sm:px-6">
                  <CustomButton
                    variant="tertiary"
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditMeeting(null);
                    }}
                  >
                    Cancel
                  </CustomButton>
                  <CustomButton variant="primary" type="submit" loading={saving}>
                    {editMeeting ? 'Update meeting' : 'Schedule meeting'}
                  </CustomButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Usage report drawer */}
      <AnimatePresence>
        {showUsageDrawer && canReviewMinutes && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.button
              type="button"
              aria-label="Close usage report"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
              onClick={() => setShowUsageDrawer(false)}
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-slate-50"
            >
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-primary">
                    <BarChart3 className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Meeting usage report</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Capacity, participation and recording consumption.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUsageDrawer(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
                  aria-label="Close usage report"
                >
                  <XCircle className="h-4.5 w-4.5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                <MeetingUsageDashboard />
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Detail Drawer */}
      <AnimatePresence>
        {detailMeeting && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
              onClick={() => setDetailMeeting(null)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden border-l border-slate-200 bg-white"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/60 px-6 py-5 sm:flex-nowrap sm:px-8">
                <div className="flex min-w-0 items-center gap-3.5">
                  <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-primary">
                    <b className="text-sm leading-none">
                      {new Date(detailMeeting.scheduledAt).getDate()}
                    </b>
                    <small className="mt-1 text-[8px] font-bold uppercase">
                      {new Date(detailMeeting.scheduledAt).toLocaleDateString('en-IN', {
                        month: 'short',
                      })}
                    </small>
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-bold leading-7 text-slate-950">
                      {detailMeeting.title}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Hosted by {conductorName(detailMeeting)}
                    </p>
                  </div>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-2.5">
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_CFG[detailMeeting.status].bg} ${STATUS_CFG[detailMeeting.status].text}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${STATUS_CFG[detailMeeting.status].dot}`}
                      />
                      {STATUS_CFG[detailMeeting.status].label}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-600">
                      {detailMeeting.meetingType} meeting
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailMeeting(null)}
                    aria-label="Close meeting details"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-200/70 text-slate-600 transition-colors hover:bg-slate-300/70 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <X className="h-5 w-5" strokeWidth={2} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto bg-white px-6 sm:px-8">
                {/* Info */}
                <div className="divide-y divide-slate-100 py-3">
                  {[
                    {
                      label: 'Date',
                      value: new Date(detailMeeting.scheduledAt).toLocaleDateString('en-IN', {
                        weekday: 'long',
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      }),
                    },
                    {
                      label: 'Time',
                      value: `${new Date(detailMeeting.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}${(detailMeeting.durationSpecified === true || (detailMeeting.durationSpecified === undefined && detailMeeting.durationMinutes !== 60)) && detailMeeting.durationMinutes ? ` · ${detailMeeting.durationMinutes} min` : ''}`,
                    },
                    {
                      label: 'Mode',
                      value: (
                        <span className="flex items-center gap-1.5 capitalize">
                          {MODE_ICON[detailMeeting.mode]}
                          {detailMeeting.mode}
                        </span>
                      ),
                    },
                    ...(detailMeeting.venue
                      ? [{ label: 'Venue', value: detailMeeting.venue }]
                      : []),
                    { label: 'Conducted By', value: conductorName(detailMeeting) },
                  ].map((r) => (
                    <div
                      key={r.label}
                      className="grid grid-cols-[110px_minmax(0,1fr)] items-start gap-4 py-3.5"
                    >
                      <span className="text-xs font-semibold text-slate-400">{r.label}</span>
                      <span className="text-sm font-semibold text-slate-700">{r.value}</span>
                    </div>
                  ))}
                </div>
                {detailMeeting.meetingLink && detailMeeting.status !== 'cancelled' && (
                  <div className="border-y border-slate-100 py-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold text-slate-800">Virtual meeting room</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Use the authorized room when the meeting is ready to begin.
                        </p>
                      </div>
                      {!detailCanJoin ? (
                        <span className="shrink-0 text-xs font-bold text-primary">
                          {getMeetingTimeSignal(detailMeeting, calendarNow)}
                        </span>
                      ) : detailMeeting.meetingLink.startsWith('/meeting/room/') ? (
                        <Link
                          href={`/${_role ?? 'dashboard'}${detailMeeting.meetingLink}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-primary-600"
                        >
                          <Video className="h-4 w-4" /> Join room
                        </Link>
                      ) : (
                        <a
                          href={detailMeeting.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-primary-600"
                        >
                          <Video className="h-4 w-4" /> Join meeting
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {/* Agenda */}
                <div className="py-6">
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                    Agenda
                  </h4>
                  <p className="text-sm leading-7 text-slate-700">{detailMeeting.agenda}</p>
                </div>
                {/* Concluding Remarks */}
                {detailMeeting.concludingRemarks && (
                  <div className="mb-6 border-l-2 border-emerald-400 pl-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <MessageSquare className="h-3.5 w-3.5 text-green-600" />
                      <h4 className="text-xs font-semibold text-green-700">Concluding Remarks</h4>
                    </div>
                    <p className="text-sm leading-6 text-slate-600 italic">
                      &ldquo;{detailMeeting.concludingRemarks}&rdquo;
                    </p>
                  </div>
                )}
                {canManageRecordings && (
                  <div className="border-t border-slate-100 py-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Secure recordings
                        </h4>
                        <p className="mt-1 text-xs text-slate-500">
                          Recordings are loaded only when requested.
                        </p>
                      </div>
                      {recordingsMeetingId !== detailMeeting._id && (
                        <button
                          type="button"
                          onClick={() => setRecordingsMeetingId(detailMeeting._id)}
                          className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-primary"
                        >
                          View recordings
                        </button>
                      )}
                    </div>
                    {recordingsMeetingId !== detailMeeting._id ? null : recordingsLoading ? (
                      <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-500">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-primary" />
                        Loading secure recordings…
                      </div>
                    ) : recordings.length === 0 ? (
                      <p className="mt-4 text-xs text-slate-500">
                        No active recording is stored for this meeting.
                      </p>
                    ) : (
                      <div className="mt-4 divide-y divide-slate-100">
                        {recordings.map((recording) => (
                          <div key={recording._id} className="py-4 first:pt-0">
                            <video
                              controls
                              preload="metadata"
                              className="aspect-video w-full rounded-lg bg-slate-200/80"
                              src={recording.playbackUrl}
                            />
                            <div className="mt-2 flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-semibold text-slate-700">
                                  {recording.title}
                                </p>
                                <p className="mt-0.5 text-[10px] text-slate-600">
                                  {Math.ceil(recording.bytes / 1048576)} MB · expires{' '}
                                  {new Date(recording.expiresAt).toLocaleDateString('en-IN')}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => void deleteRecording(recording)}
                                className="text-xs font-semibold text-red-500 hover:text-red-600"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Attendees */}
                {detailMeeting.attendees.length > 0 && (
                  <div className="border-t border-slate-100 py-6">
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Attendees ({detailMeeting.attendees.filter((a) => a.attended).length}/
                      {detailMeeting.attendees.length})
                    </h4>
                    <div className="space-y-1.5">
                      {detailMeeting.attendees.map((a, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between border-b border-slate-100 px-1 py-3 last:border-b-0"
                        >
                          <span className="text-xs text-slate-600">
                            {typeof a.userId === 'object'
                              ? a.userId.name ||
                                a.userId.studentId ||
                                a.userId.facultyId ||
                                a.userId.email ||
                                'User record unavailable'
                              : 'User record unavailable'}
                          </span>
                          <div className="flex items-center gap-2">
                            {a.attended ? (
                              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Clock className="h-3.5 w-3.5 text-slate-300" />
                            )}
                            {!a.attended && idOf(a.userId) === currentUser?._id && (
                              <button
                                type="button"
                                onClick={() => handleMarkAttendance(detailMeeting._id)}
                                className="text-xs text-primary hover:underline"
                              >
                                Mark mine
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {/* Footer actions */}
              <div className="space-y-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
                {canManage(detailMeeting) && detailMeeting.status === 'scheduled' && (
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <button
                      type="button"
                      onClick={() => handleStatusChange(detailMeeting, 'ongoing')}
                      disabled={saving}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Video className="h-4 w-4" />
                      {saving ? 'Starting…' : 'Start meeting'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditMeeting(detailMeeting);
                        setDetailMeeting(null);
                        setShowModal(true);
                      }}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-primary"
                    >
                      <Edit2 className="h-4 w-4" /> Edit details
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(detailMeeting, 'cancelled')}
                      disabled={saving}
                      className="col-span-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-bold text-rose-700 transition-colors hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Cancel meeting
                    </button>
                  </div>
                )}
                {canManage(detailMeeting) && detailMeeting.status === 'ongoing' && (
                  <button
                    type="button"
                    onClick={() => handleRemarks(detailMeeting)}
                    disabled={saving}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {saving ? 'Submitting…' : 'Conclude and submit minutes'}
                  </button>
                )}
                {canReviewMinutes &&
                  detailMeeting.minutesStatus === 'pending_approval' &&
                  idOf(detailMeeting.minutesSubmittedBy) !== currentUser?._id && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleMinutesReview(detailMeeting, 'approved')}
                        disabled={saving}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <CheckCircle className="h-4 w-4" /> Approve minutes
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMinutesReview(detailMeeting, 'rejected')}
                        disabled={saving}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm font-bold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-60"
                      >
                        <MessageSquare className="h-4 w-4" /> Return minutes
                      </button>
                    </div>
                  )}
                {canDelete && canManage(detailMeeting) && detailMeeting.status !== 'ongoing' && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(detailMeeting)}
                    className="inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-4 text-sm font-bold text-rose-700 transition-colors hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" /> Permanently delete meeting
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MeetingCalendarSidebar({
  scopes,
  onScopeChange,
  onSchedule,
}: {
  scopes: { faculty: boolean; student: boolean; completed: boolean };
  onScopeChange: (scope: 'faculty' | 'student' | 'completed') => void;
  onSchedule?: (date: Date) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [
      ...Array.from({ length: first }, () => null),
      ...Array.from(
        { length: days },
        (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1),
      ),
    ];
  }, [month]);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <aside className="bg-slate-50/70 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">
          {month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex gap-1">
          {([-1, 1] as const).map((direction) => (
            <button
              key={direction}
              type="button"
              onClick={() =>
                setMonth(
                  (current) => new Date(current.getFullYear(), current.getMonth() + direction, 1),
                )
              }
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-blue-200 hover:text-primary"
              aria-label={direction === -1 ? 'Previous month' : 'Next month'}
            >
              {direction === -1 ? (
                <ChevronLeft className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <span key={`${day}-${index}`} className="py-1 text-[9px] font-bold text-slate-400">
            {day}
          </span>
        ))}
        {cells.map((date, index) => {
          if (!date) return <span key={`empty-${index}`} />;
          const isToday = date.toDateString() === today.toDateString();
          const isPast = date < startOfToday;
          return (
            <button
              key={date.toISOString()}
              type="button"
              disabled={isPast || !onSchedule}
              onClick={() => onSchedule?.(date)}
              className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold transition-colors ${
                isToday
                  ? 'bg-primary text-white'
                  : isPast
                    ? 'text-slate-300'
                    : 'text-slate-600 hover:bg-blue-100 hover:text-primary'
              }`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-6 border-t border-slate-200 pt-5">
        <h4 className="text-xs font-bold text-slate-800">My calendars</h4>
        <div className="mt-3 space-y-2.5">
          {(
            [
              { key: 'faculty', label: 'Faculty meetings', color: 'bg-blue-400' },
              { key: 'student', label: 'Student meetings', color: 'bg-violet-400' },
              { key: 'completed', label: 'Completed records', color: 'bg-emerald-400' },
            ] as const
          ).map((item) => (
            <label
              key={item.key}
              className="flex cursor-pointer items-center gap-2.5 text-xs text-slate-600"
            >
              <input
                type="checkbox"
                checked={scopes[item.key]}
                onChange={() => onScopeChange(item.key)}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/20"
              />
              <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
              {item.label}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-5">
        <h4 className="text-xs font-bold text-slate-800">Meeting status</h4>
        <div className="mt-3 space-y-2 text-[11px] text-slate-500">
          {(['scheduled', 'ongoing', 'completed', 'cancelled'] as const).map((status) => (
            <div key={status} className="flex items-center gap-2 capitalize">
              <span className={`h-2 w-2 rounded-full ${STATUS_CFG[status].dot}`} />
              {STATUS_CFG[status].label}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function MeetingCardGrid({
  meetings,
  canManage,
  canDelete,
  onView,
  onEdit,
  onDelete,
}: {
  meetings: IMeeting[];
  canManage: (meeting: IMeeting) => boolean;
  canDelete: boolean;
  onView: (meeting: IMeeting) => void;
  onEdit: (meeting: IMeeting) => void;
  onDelete: (meeting: IMeeting) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section>
      <div className="mb-3">
        <h2 className="font-bold text-slate-900">Meeting cards</h2>
        <p className="mt-1 text-xs text-slate-500">
          Open agendas, joining details and meeting outcomes without a table.
        </p>
      </div>
      {meetings.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {meetings.map((meeting, index) => {
            const config = STATUS_CFG[meeting.status];
            const date = new Date(meeting.scheduledAt);
            const hostName =
              typeof meeting.conductedBy === 'object'
                ? meeting.conductedBy.name || 'Meeting host'
                : 'Meeting host';
            const hasDuration =
              meeting.durationSpecified === true ||
              (meeting.durationSpecified === undefined && meeting.durationMinutes !== 60);
            const ModeIcon =
              meeting.mode === 'online'
                ? Video
                : meeting.mode === 'hybrid'
                  ? LayoutGrid
                  : Building2;
            return (
              <motion.article
                key={meeting._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index, 8) * 0.045, duration: 0.28 }}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white transition-[border-color] duration-300 hover:border-blue-200"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-48 overflow-hidden">
                  <Image
                    src="/images/meetings/campus-meeting-card.png"
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                    className="transform-gpu object-contain object-top opacity-[0.2] transition-transform duration-700 ease-out will-change-transform group-hover:scale-[1.025]"
                    style={{
                      WebkitMaskImage:
                        'linear-gradient(to bottom, black 0%, rgba(0,0,0,.9) 48%, transparent 100%)',
                      maskImage:
                        'linear-gradient(to bottom, black 0%, rgba(0,0,0,.9) 48%, transparent 100%)',
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-white via-white/55 to-white/10" />
                </div>
                <div className="relative z-10 p-4.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-primary">
                        <span className="text-base font-bold leading-none">{date.getDate()}</span>
                        <span className="mt-1 text-[9px] font-bold uppercase tracking-wider">
                          {date.toLocaleDateString('en-IN', { month: 'short' })}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="line-clamp-2 text-sm font-bold leading-5 text-slate-900">
                          {meeting.title}
                        </h3>
                        <p className="mt-1 truncate text-[11px] text-slate-500">
                          Hosted by {hostName}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${config.bg} ${config.text}`}
                    >
                      <i className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
                      {config.label}
                    </span>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white/85 px-3 py-2.5 backdrop-blur-[2px]">
                    <div className="flex min-w-0 items-center gap-2">
                      <Clock className="h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-700">
                          {date.toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {hasDuration && meeting.durationMinutes
                            ? ` · ${meeting.durationMinutes} min`
                            : ''}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-slate-500">
                          {date.toLocaleDateString('en-IN', {
                            weekday: 'short',
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-bold text-primary ${meeting.status === 'ongoing' ? 'font-mono tabular-nums' : ''}`}
                    >
                      {getMeetingTimeSignal(meeting, now)}
                    </span>
                  </div>

                  <p className="mt-3 line-clamp-2 min-h-10 text-xs leading-5 text-slate-500">
                    {meeting.agenda}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold capitalize text-blue-700">
                      <ModeIcon className="h-3 w-3" /> {meeting.mode}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold capitalize text-violet-700">
                      <Users className="h-3 w-3" /> {meeting.meetingType}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                      {meeting.attendees.length} participant records
                    </span>
                  </div>
                </div>

                <div className="relative z-10 flex items-center justify-between gap-2 border-t border-slate-100 bg-white px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onView(meeting)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-blue-100"
                  >
                    View details <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <div className="flex items-center gap-1.5">
                    {canManage(meeting) && meeting.status === 'scheduled' && (
                      <button
                        type="button"
                        onClick={() => onEdit(meeting)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Edit
                      </button>
                    )}
                    {canDelete && canManage(meeting) && meeting.status !== 'ongoing' && (
                      <button
                        type="button"
                        onClick={() => onDelete(meeting)}
                        className="inline-flex cursor-pointer items-center rounded-lg border border-rose-100 bg-white p-2 text-rose-600 transition-colors hover:bg-rose-50"
                        aria-label={`Delete ${meeting.title}`}
                        title="Permanently delete meeting"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center">
          <Calendar className="mx-auto h-7 w-7 text-slate-300" />
          <p className="mt-2 text-sm font-bold text-slate-700">No meetings found</p>
          <p className="mt-1 text-xs text-slate-500">
            Adjust the filters or schedule a new meeting.
          </p>
        </div>
      )}
    </section>
  );
}

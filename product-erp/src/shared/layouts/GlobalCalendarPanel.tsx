'use client';

import Image from 'next/image';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { toast } from 'react-toastify';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import AsyncSelect from '@/shared/core/AsyncSelect';
import {
  BellRing,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  GraduationCap,
  HeartHandshake,
  MapPin,
  Plus,
  Repeat2,
  RotateCw,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useRouter } from 'nextjs-toploader/app';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getTenantRolePath } from '@/shared/utils';
import { useSocket } from '@/shared/hooks/useSocket';

interface IHierarchyContext {
  canInspectAnyFaculty: boolean;
  canInspectDeptFaculty: boolean;
  canInspectMentees: boolean;
  departments: Array<{ _id: string; name: string; code?: string }>;
  faculty: Array<{
    _id: string;
    name: string;
    email: string;
    designation: string;
    employeeId?: string;
    departmentId?: string;
    departmentName?: string;
    departmentCode?: string;
  }>;
  mentees: Array<{
    _id: string;
    name: string;
    email: string;
    rollNumber?: string;
    program?: string;
    branch?: string;
    semester?: number;
    section?: string;
  }>;
}

type TCategory =
  | 'all'
  | 'holiday'
  | 'internal_exam'
  | 'university_exam'
  | 'cultural'
  | 'sports'
  | 'technical'
  | 'class'
  | 'meeting'
  | 'personal'
  | 'other';

interface ICalendarEvent {
  _id?: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  category: Exclude<TCategory, 'all'>;
  location?: string;
  source?: string;
  lifecycleStatus?: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  allDay?: boolean;
  attendanceState?: 'recorded' | 'missing' | 'upcoming' | 'in_progress' | 'completed';
  attendanceSummary?: {
    present: number;
    absent: number;
    strength: number;
    locked: boolean;
  };
  sourceId?: string;
  color?: 'blue' | 'green' | 'amber' | 'rose' | 'violet';
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  reminderMinutes?: number[];
}

interface IAcademicCalendar {
  _id: string;
  academicYear: string;
  semesterType: 'odd' | 'even';
  events: ICalendarEvent[];
}

interface ICalendarResponse {
  success: boolean;
  data: IAcademicCalendar[];
}

interface IEventFormValues {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  location: string;
  color: string;
  recurrence: string;
  recurrenceUntil: string;
  reminderMinutes: number[];
}

const emptyEventForm: IEventFormValues = {
  title: '',
  description: '',
  startDate: '',
  endDate: '',
  allDay: false,
  location: '',
  color: 'blue',
  recurrence: 'none',
  recurrenceUntil: '',
  reminderMinutes: [10],
};

const categoryConfig: Record<
  Exclude<TCategory, 'all'>,
  { label: string; marker: string; surface: string; text: string }
> = {
  holiday: {
    label: 'Holiday',
    marker: 'bg-rose-500',
    surface: 'bg-rose-50',
    text: 'text-rose-700',
  },
  internal_exam: {
    label: 'Exam',
    marker: 'bg-amber-500',
    surface: 'bg-amber-50',
    text: 'text-amber-700',
  },
  university_exam: {
    label: 'University Exam',
    marker: 'bg-violet-500',
    surface: 'bg-violet-50',
    text: 'text-violet-700',
  },
  cultural: {
    label: 'Cultural',
    marker: 'bg-pink-500',
    surface: 'bg-pink-50',
    text: 'text-pink-700',
  },
  sports: {
    label: 'Sports',
    marker: 'bg-cyan-500',
    surface: 'bg-cyan-50',
    text: 'text-cyan-700',
  },
  technical: {
    label: 'Workshop',
    marker: 'bg-blue-500',
    surface: 'bg-blue-50',
    text: 'text-blue-700',
  },
  class: {
    label: 'Class',
    marker: 'bg-blue-500',
    surface: 'bg-blue-50',
    text: 'text-blue-700',
  },
  meeting: {
    label: 'Meeting',
    marker: 'bg-emerald-500',
    surface: 'bg-emerald-50',
    text: 'text-emerald-700',
  },
  personal: {
    label: 'Personal',
    marker: 'bg-indigo-500',
    surface: 'bg-indigo-50',
    text: 'text-indigo-700',
  },
  other: {
    label: 'Event',
    marker: 'bg-indigo-500',
    surface: 'bg-indigo-50',
    text: 'text-indigo-700',
  },
};

export function resolveEventCategory(event: {
  category?: string;
  title?: string;
  description?: string;
  location?: string;
}): Exclude<TCategory, 'all'> {
  if (
    event.category &&
    event.category !== 'other' &&
    categoryConfig[event.category as Exclude<TCategory, 'all'>]
  ) {
    return event.category as Exclude<TCategory, 'all'>;
  }
  const title = (event.title || '').toLowerCase();
  const desc = (event.description || '').toLowerCase();
  const location = (event.location || '').toLowerCase();
  const text = `${title} ${desc} ${location}`;

  if (
    text.includes('exam') ||
    text.includes('examination') ||
    text.includes('test') ||
    text.includes('quiz') ||
    text.includes('viva') ||
    text.includes('assessment') ||
    text.includes('evaluation')
  ) {
    return text.includes('university') || text.includes('end semester') || text.includes('final')
      ? 'university_exam'
      : 'internal_exam';
  }

  if (
    text.includes('meeting') ||
    text.includes('council') ||
    text.includes('colloquium') ||
    text.includes('committee') ||
    text.includes('board of') ||
    text.includes('discussion') ||
    text.includes('review')
  ) {
    return 'meeting';
  }

  if (
    text.includes('workshop') ||
    text.includes('fdp') ||
    text.includes('development') ||
    text.includes('technical') ||
    text.includes('seminar') ||
    text.includes('lecture') ||
    text.includes('symposium') ||
    text.includes('training') ||
    text.includes('conference') ||
    text.includes('hackathon') ||
    text.includes('webinar')
  ) {
    return 'technical';
  }

  if (
    text.includes('cultural') ||
    text.includes('fest') ||
    text.includes('celebration') ||
    text.includes('annual day') ||
    text.includes('music') ||
    text.includes('dance') ||
    text.includes('drama')
  ) {
    return 'cultural';
  }

  if (
    text.includes('sports') ||
    text.includes('tournament') ||
    text.includes('match') ||
    text.includes('athletics') ||
    text.includes('cricket') ||
    text.includes('football') ||
    text.includes('game')
  ) {
    return 'sports';
  }

  if (
    text.includes('holiday') ||
    text.includes('vacation') ||
    text.includes('break') ||
    text.includes('recess') ||
    text.includes('diwali') ||
    text.includes('pongal') ||
    text.includes('christmas') ||
    text.includes('eid') ||
    text.includes('independence') ||
    text.includes('republic')
  ) {
    return 'holiday';
  }

  return 'other';
}

export function getEventDestination(
  event: ICalendarEvent,
  role: string,
): { path: string; label: string } | null {
  if (event.source === 'personal') return null;

  const category = resolveEventCategory(event);

  if (category === 'class' || event.source === 'timetable' || event.source === 'extra_class') {
    return {
      path: getTenantRolePath(role, '/timetable'),
      label: 'Open Timetable',
    };
  }

  if (category === 'meeting' || event.source === 'meeting') {
    return {
      path: getTenantRolePath(role, '/meeting'),
      label: 'Open Meetings',
    };
  }

  if (category === 'internal_exam' || category === 'university_exam') {
    return {
      path: getTenantRolePath(role, '/examination'),
      label: 'Open Examination',
    };
  }

  if (category === 'holiday') {
    return {
      path: getTenantRolePath(role, '/academic-calendar'),
      label: 'Open Academic Calendar',
    };
  }

  if (
    category === 'technical' ||
    category === 'cultural' ||
    category === 'sports' ||
    event.source === 'event'
  ) {
    return {
      path: getTenantRolePath(role, '/event'),
      label: 'Open Events',
    };
  }

  return {
    path: getTenantRolePath(role, '/academic-calendar'),
    label: 'Open Academic Calendar',
  };
}

const categoryArtworkPosition: Record<Exclude<TCategory, 'all'>, string> = {
  class: '0% 0%',
  internal_exam: '50% 0%',
  university_exam: '100% 0%',
  cultural: '0% 50%',
  sports: '50% 50%',
  technical: '100% 50%',
  meeting: '0% 100%',
  holiday: '50% 100%',
  personal: '100% 100%',
  other: '100% 50%',
};

function ActivityArtwork({
  category,
  className = '',
}: {
  category: ICalendarEvent['category'];
  className?: string;
}) {
  const safeCategory = categoryArtworkPosition[category] ? category : 'other';
  return (
    <span
      role="img"
      aria-label={`${(categoryConfig[safeCategory] ?? categoryConfig.other).label} illustration`}
      className={`block bg-no-repeat ${className}`}
      style={{
        backgroundImage: "url('/images/calendar/activity-types/activity-sprite.png')",
        backgroundPosition: categoryArtworkPosition[safeCategory],
        backgroundSize: '300% 300%',
      }}
    />
  );
}

function startOfWeek(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

function sameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function occursOn(event: ICalendarEvent, date: Date) {
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return date >= start && date <= end;
}

function arrangeWeekEvents(items: ICalendarEvent[]) {
  const sorted = [...items].sort(
    (left, right) => +new Date(left.startDate) - +new Date(right.startDate),
  );
  const laneEnds: number[] = [];
  const positioned = sorted.map((event) => {
    const start = +new Date(event.startDate);
    const end = +new Date(event.endDate);
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = end;
    return { event, lane };
  });
  const laneCount = Math.max(1, laneEnds.length);
  return positioned.map((item) => ({ ...item, laneCount }));
}

function eventStatusStyle(event: ICalendarEvent) {
  const resolvedCategory = resolveEventCategory(event);
  if (event.category !== 'class') return categoryConfig[resolvedCategory] ?? categoryConfig.other;
  if (event.attendanceState === 'recorded')
    return {
      ...categoryConfig.class,
      marker: 'bg-emerald-500',
      surface: 'bg-emerald-50',
      text: 'text-emerald-700',
    };
  if (event.attendanceState === 'missing')
    return {
      ...categoryConfig.class,
      marker: 'bg-rose-500',
      surface: 'bg-rose-50',
      text: 'text-rose-700',
    };
  if (event.attendanceState === 'in_progress')
    return {
      ...categoryConfig.class,
      marker: 'bg-amber-500',
      surface: 'bg-amber-50',
      text: 'text-amber-800',
    };
  return categoryConfig.class;
}

function statusLabel(event: ICalendarEvent) {
  if (event.attendanceState === 'recorded') return 'Attendance recorded';
  if (event.attendanceState === 'missing') return 'Attendance required';
  if (event.attendanceState === 'in_progress') return 'In progress';
  if (event.attendanceState === 'upcoming') return 'Upcoming';
  const resolvedCategory = resolveEventCategory(event);
  return (categoryConfig[resolvedCategory] ?? categoryConfig.other).label;
}

function reminderLabel(minutes: number) {
  if (minutes === 0) return 'At start';
  if (minutes < 60) return `${minutes} min before`;
  if (minutes === 60) return '1 hour before';
  if (minutes % 1440 === 0) return `${minutes / 1440} day before`;
  return `${minutes / 60} hours before`;
}

export default function GlobalCalendarPanel({
  open,
  role,
  onClose,
}: {
  open: boolean;
  role: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { socket } = useSocket();
  const { mutation, isLoading: isSaving } = useMutation();
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [category, setCategory] = useState<TCategory>('all');
  const [view, setView] = useState<'month' | 'week' | 'day' | 'agenda'>('month');
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ICalendarEvent | null>(null);
  const [eventFormOpenedAt, setEventFormOpenedAt] = useState(() => new Date());
  const eventValidationSchema = useMemo(
    () =>
      Yup.object({
        title: Yup.string().trim().required('Event title is required').max(200),
        description: Yup.string().max(5000, 'Notes cannot exceed 5,000 characters'),
        location: Yup.string().max(500, 'Location cannot exceed 500 characters'),
        startDate: Yup.string()
          .required('Start date and time are required')
          .test('future-start', 'Start time cannot be in the past', (value) => {
            if (!value) return true;
            if (
              editingEvent?.sourceId &&
              new Date(value).getTime() === new Date(editingEvent.startDate).getTime()
            )
              return true;
            return new Date(value).getTime() >= eventFormOpenedAt.getTime() - 60_000;
          }),
        endDate: Yup.string()
          .required('End date and time are required')
          .test('after-start', 'End time must be after the start time', function (value) {
            const start = this.parent.startDate;
            return !value || !start || new Date(value) > new Date(start);
          }),
        recurrence: Yup.string().oneOf(['none', 'daily', 'weekly', 'monthly']).required(),
        recurrenceUntil: Yup.string().when('recurrence', {
          is: (value: string) => value !== 'none',
          then: (schema) =>
            schema
              .required('Choose when this repeating event should end')
              .test('after-start', 'Repeat end cannot be before the event date', function (value) {
                const start = this.parent.startDate;
                return !value || !start || new Date(`${value}T23:59:59`) >= new Date(start);
              }),
          otherwise: (schema) => schema.notRequired(),
        }),
        reminderMinutes: Yup.array()
          .of(Yup.number().integer().min(0).max(10080))
          .max(5, 'Choose no more than five reminders'),
      }),
    [editingEvent, eventFormOpenedAt],
  );
  const eventFormik = useFormik<IEventFormValues>({
    initialValues: emptyEventForm,
    validationSchema: eventValidationSchema,
    enableReinitialize: false,
    onSubmit: async (values) => savePersonalEvent(values),
  });
  const [scope, setScope] = useState<'self' | 'department' | 'faculty' | 'mentee'>('self');
  const [targetDepartmentId, setTargetDepartmentId] = useState<string>('');
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [facultyDeptFilter, setFacultyDeptFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { data: hierarchyRes } = useSwr<{ data?: IHierarchyContext }>(
    open ? 'academic-calendar/hierarchy-context' : null,
    { revalidateOnFocus: false },
  );
  const hierarchy = hierarchyRes?.data;

  const visibleUrl = useMemo(() => {
    if (!open) return null;
    const params = new URLSearchParams();
    if (scope === 'department') {
      if (targetDepartmentId) params.set('targetDepartmentId', targetDepartmentId);
      params.set('scope', 'department');
    } else if (scope === 'faculty' && targetUserId) {
      params.set('targetUserId', targetUserId);
      params.set('scope', 'faculty');
      if (targetDepartmentId) params.set('targetDepartmentId', targetDepartmentId);
    } else if (scope === 'mentee' && targetUserId) {
      params.set('targetUserId', targetUserId);
      params.set('scope', 'mentee');
    }
    const qs = params.toString();
    return `academic-calendar/visible${qs ? `?${qs}` : ''}`;
  }, [open, scope, targetDepartmentId, targetUserId]);

  const {
    data: response,
    isLoading,
    error,
    mutate,
  } = useSwr<ICalendarResponse>(visibleUrl, {
    revalidateOnFocus: true,
    dedupingInterval: 30000,
  });

  useEffect(() => {
    if (!socket || !open) return;
    const refreshCalendar = () => void mutate();
    socket.on('meeting_status_changed', refreshCalendar);
    return () => {
      socket.off('meeting_status_changed', refreshCalendar);
    };
  }, [mutate, open, socket]);

  const closePanel = useCallback(() => {
    setView('month');
    setAnchorDate(new Date());
    setCategory('all');
    setScope('self');
    setTargetDepartmentId('');
    setTargetUserId('');
    setFacultyDeptFilter('');
    setSearchQuery('');
    onClose();
  }, [onClose]);

  const resetToSelf = useCallback(() => {
    setScope('self');
    setTargetDepartmentId('');
    setTargetUserId('');
    setFacultyDeptFilter('');
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePanel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
    };
  }, [closePanel, open]);

  const rawEvents = useMemo(
    () =>
      (response?.data ?? [])
        .flatMap((calendar) => calendar.events)
        .map((event) => ({
          ...event,
          category: resolveEventCategory(event),
        }))
        .filter((event) => category === 'all' || event.category === category)
        .sort((left, right) => +new Date(left.startDate) - +new Date(right.startDate)),
    [response, category],
  );

  const events = useMemo(() => {
    if (!searchQuery.trim()) return rawEvents;
    const q = searchQuery.toLowerCase().trim();
    return rawEvents.filter((event) => {
      const titleMatch = event.title?.toLowerCase().includes(q);
      const descMatch = event.description?.toLowerCase().includes(q);
      const locMatch = event.location?.toLowerCase().includes(q);
      const catMatch = (categoryConfig[event.category]?.label ?? '').toLowerCase().includes(q);
      return titleMatch || descMatch || locMatch || catMatch;
    });
  }, [rawEvents, searchQuery]);

  const facultyList = hierarchy?.faculty;
  const menteeList = hierarchy?.mentees;
  const departmentList = hierarchy?.departments;

  const selectedFaculty = useMemo(
    () => facultyList?.find((f) => f._id === targetUserId),
    [facultyList, targetUserId],
  );
  const selectedMentee = useMemo(
    () => menteeList?.find((m) => m._id === targetUserId),
    [menteeList, targetUserId],
  );
  const selectedDepartment = useMemo(
    () => departmentList?.find((d) => d._id === targetDepartmentId),
    [departmentList, targetDepartmentId],
  );
  const availableFaculty = useMemo(() => {
    if (!facultyList) return [];
    if (!facultyDeptFilter) return facultyList;
    return facultyList.filter((f) => f.departmentId === facultyDeptFilter);
  }, [facultyList, facultyDeptFilter]);
  const hasPublishedCalendar = (response?.data ?? []).some(
    (calendar) => calendar.academicYear !== 'personal',
  );
  const weekStart = startOfWeek(anchorDate);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return date;
  });
  const weekEnd = days[6];
  const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const monthGridStart = startOfWeek(monthStart);
  const monthDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(monthGridStart);
    date.setDate(date.getDate() + index);
    return date;
  });
  const dayStrip = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(anchorDate);
    date.setDate(date.getDate() + index - 3);
    return date;
  });
  const selectedDayEvents = events.filter((event) => occursOn(event, anchorDate));
  const weekEvents = events.filter((event) => days.some((day) => occursOn(event, day)));
  const timedWeekEvents = weekEvents.filter((event) => event.allDay === false);
  const weekStartHour = Math.min(
    8,
    ...timedWeekEvents.map((event) => new Date(event.startDate).getHours()),
  );
  const weekEndHour = Math.max(
    17,
    ...timedWeekEvents.map((event) =>
      Math.ceil(new Date(event.endDate).getHours() + new Date(event.endDate).getMinutes() / 60),
    ),
  );
  const weekHourHeight = 56;
  const weekHours = Array.from(
    { length: weekEndHour - weekStartHour + 1 },
    (_, index) => weekStartHour + index,
  );
  const upcoming = events
    .filter(
      (event) =>
        new Date(event.endDate) >= new Date() &&
        !(
          event.source === 'meeting' &&
          ['completed', 'cancelled'].includes(event.lifecycleStatus ?? '')
        ),
    )
    .slice(0, 10);
  const periodLabel =
    view === 'month'
      ? anchorDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
      : view === 'day'
        ? anchorDate.toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        : `${weekStart.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
          })} – ${weekEnd.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}`;
  const canManageAcademicCalendar = ['super_admin', 'admin', 'principal', 'dean_academic'].includes(
    role,
  );

  const movePeriod = (amount: number) => {
    setAnchorDate((current) => {
      const next = new Date(current);
      if (view === 'month') next.setMonth(next.getMonth() + amount);
      else if (view === 'day') next.setDate(next.getDate() + amount);
      else next.setDate(next.getDate() + amount * 7);
      return next;
    });
  };

  const openEventForm = useCallback(
    (date = anchorDate, event?: ICalendarEvent) => {
      const now = new Date();
      setEventFormOpenedAt(now);
      if (!event) {
        const selectedDayEnd = new Date(date);
        selectedDayEnd.setHours(23, 59, 59, 999);
        if (selectedDayEnd < now) {
          toast.error('Past dates cannot be used for a new event');
          return;
        }
      }
      const start = event ? new Date(event.startDate) : new Date(date);
      if (!event) {
        if (sameDay(start, now)) {
          start.setTime(now.getTime() + 5 * 60 * 1000);
          start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
        } else start.setHours(9, 0, 0, 0);
      }
      const end = event ? new Date(event.endDate) : new Date(start.getTime() + 60 * 60 * 1000);
      const localValue = (value: Date) =>
        new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setEditingEvent(event ?? null);
      eventFormik.resetForm({
        values: {
          title: event?.title ?? '',
          description: event?.description ?? '',
          startDate: localValue(start),
          endDate: localValue(end),
          allDay: Boolean(event?.allDay),
          location: event?.location ?? '',
          color: event?.color ?? 'blue',
          recurrence: event?.recurrence ?? 'none',
          recurrenceUntil: '',
          reminderMinutes: Array.isArray(event?.reminderMinutes)
            ? event.reminderMinutes
            : event?.reminderMinutes === undefined
              ? [10]
              : [Number(event.reminderMinutes)],
        },
      });
      setEventFormOpen(true);
    },
    [anchorDate, eventFormik],
  );

  const navigateToEvent = useCallback(
    (event: ICalendarEvent) => {
      if (event.source === 'personal') {
        openEventForm(new Date(event.startDate), event);
        return;
      }
      const dest = getEventDestination(event, role);
      if (dest) {
        router.push(dest.path);
        closePanel();
      } else {
        setAnchorDate(new Date(event.startDate));
        setView('day');
      }
    },
    [closePanel, openEventForm, role, router],
  );

  const savePersonalEvent = async (eventForm: IEventFormValues) => {
    const id = editingEvent?.sourceId;
    const response = await mutation(
      id ? `academic-calendar/personal-events/${id}` : 'academic-calendar/personal-events',
      {
        method: id ? 'PUT' : 'POST',
        silentError: true,
        returnError: true,
        body: {
          ...eventForm,
          startDate: new Date(eventForm.startDate).toISOString(),
          endDate: new Date(eventForm.endDate).toISOString(),
          recurrenceUntil: eventForm.recurrenceUntil
            ? new Date(`${eventForm.recurrenceUntil}T23:59:59`).toISOString()
            : undefined,
          reminderMinutes: eventForm.reminderMinutes,
        },
      },
    );
    if (!response?.results?.success) {
      toast.error(response?.results?.message || 'Event could not be saved');
      return;
    }
    toast.success(id ? 'Event updated' : 'Event added to your calendar');
    setEventFormOpen(false);
    setEditingEvent(null);
    await mutate();
  };

  const deletePersonalEvent = async () => {
    if (!editingEvent?.sourceId) return;
    const response = await mutation(`academic-calendar/personal-events/${editingEvent.sourceId}`, {
      method: 'DELETE',
      silentError: true,
      returnError: true,
    });
    if (!response?.results?.success) {
      toast.error(response?.results?.message || 'Event could not be deleted');
      return;
    }
    toast.success('Event deleted');
    setEventFormOpen(false);
    setEditingEvent(null);
    await mutate();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 h-dvh w-dvw overflow-hidden overscroll-none">
          <motion.button
            type="button"
            aria-label="Close calendar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closePanel}
            className="absolute inset-0 cursor-default bg-slate-200/80 backdrop-blur-sm"
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="global-calendar-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="fixed inset-0 flex h-dvh w-dvw max-w-none flex-col overflow-hidden overscroll-none bg-slate-50 [&_a]:cursor-pointer [&_button:not(:disabled)]:cursor-pointer [&_select:not(:disabled)]:cursor-pointer"
          >
            <header className="shrink-0 flex flex-wrap items-center gap-2 bg-white px-4 py-3 sm:px-6">
              <div className="min-w-36">
                <p id="global-calendar-title" className="text-lg font-semibold text-slate-950">
                  My calendar
                </p>
                <p className="text-xs text-slate-500">{periodLabel}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => movePeriod(-1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600"
                  aria-label="Previous calendar period"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => movePeriod(1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600"
                  aria-label="Next calendar period"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center">
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as TCategory)}
                  aria-label="Calendar category"
                  className="h-10 min-w-44 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/10"
                >
                  <option value="all">All activity</option>
                  {Object.entries(categoryConfig).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="hidden flex-1 lg:block" />
              <button
                type="button"
                onClick={() => openEventForm(anchorDate)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white  transition hover:bg-primary-700"
              >
                <Plus className="size-4" /> Add event
              </button>
              <div className="flex items-center rounded-xl bg-slate-100 p-1">
                {(['month', 'week', 'day', 'agenda'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setView(item)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${view === item ? 'bg-white text-slate-900' : 'text-slate-500'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setAnchorDate(new Date())}
                className="cursor-pointer rounded-lg border border-primary-100 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary-100"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => void mutate()}
                className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100"
              >
                <RotateCw className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">Refresh</span>
              </button>
              <button
                type="button"
                onClick={closePanel}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
                aria-label="Close calendar"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* ── Organizational Hierarchy & Scope Controls Bar ────────────────────── */}
            <div className="shrink-0 border-t border-slate-200/80 bg-slate-50 px-4 py-2.5 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Scope Navigation Tabs */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setScope('self');
                      setTargetDepartmentId('');
                      setTargetUserId('');
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      scope === 'self'
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 ring-1 ring-slate-200'
                    }`}
                  >
                    <User className="h-3.5 w-3.5" />
                    My Schedule
                  </button>

                  {(hierarchy?.departments?.length ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setScope('department');
                        setTargetUserId('');
                        if (!targetDepartmentId && hierarchy?.departments[0]?._id) {
                          setTargetDepartmentId(hierarchy.departments[0]._id);
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        scope === 'department'
                          ? 'bg-primary text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-slate-100 ring-1 ring-slate-200'
                      }`}
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      Department View
                    </button>
                  )}

                  {(hierarchy?.canInspectAnyFaculty || hierarchy?.canInspectDeptFaculty) && (
                    <button
                      type="button"
                      onClick={() => {
                        setScope('faculty');
                        if (!targetUserId && availableFaculty[0]?._id) {
                          setTargetUserId(availableFaculty[0]._id);
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        scope === 'faculty'
                          ? 'bg-primary text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-slate-100 ring-1 ring-slate-200'
                      }`}
                    >
                      <GraduationCap className="h-3.5 w-3.5" />
                      Faculty Timetable
                    </button>
                  )}

                  {hierarchy?.canInspectMentees && (
                    <button
                      type="button"
                      onClick={() => {
                        setScope('mentee');
                        setTargetDepartmentId('');
                        if (!targetUserId && hierarchy.mentees[0]?._id) {
                          setTargetUserId(hierarchy.mentees[0]._id);
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        scope === 'mentee'
                          ? 'bg-primary text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-slate-100 ring-1 ring-slate-200'
                      }`}
                    >
                      <HeartHandshake className="h-3.5 w-3.5" />
                      My Mentees ({hierarchy.mentees.length})
                    </button>
                  )}
                </div>

                {/* Live Omni-Search Bar */}
                <div className="relative min-w-48 flex-1 sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search subjects, rooms, events..."
                    className="h-8.5 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Contextual Selectors */}
              {scope === 'department' && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-slate-200/60 pt-2">
                  <span className="text-xs font-bold text-slate-600">Select Department:</span>
                  <div className="w-64">
                    <AsyncSelect
                      type="departments"
                      value={targetDepartmentId || null}
                      onChange={(val) => setTargetDepartmentId(val || '')}
                      placeholder="All Departments"
                    />
                  </div>
                </div>
              )}

              {scope === 'faculty' && (
                <div className="mt-2.5 flex flex-wrap items-center gap-3 border-t border-slate-200/60 pt-2">
                  {hierarchy?.canInspectAnyFaculty && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-600">Department:</span>
                      <div className="w-56">
                        <AsyncSelect
                          type="departments"
                          value={facultyDeptFilter || null}
                          onChange={(val) => {
                            setFacultyDeptFilter(val || '');
                            setTargetUserId('');
                          }}
                          placeholder="All Departments"
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-600">Faculty Member:</span>
                    <div className="w-72">
                      <AsyncSelect
                        type="faculty"
                        value={targetUserId || null}
                        params={facultyDeptFilter ? { department: facultyDeptFilter } : undefined}
                        onChange={(val) => setTargetUserId(val || '')}
                        placeholder="Search faculty member..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {scope === 'mentee' && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-slate-200/60 pt-2">
                  <span className="text-xs font-bold text-slate-600">Assigned Mentee Student:</span>
                  <div className="w-80">
                    <AsyncSelect
                      type="students"
                      value={targetUserId || null}
                      onChange={(val) => setTargetUserId(val || '')}
                      placeholder="Select mentee student..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── Active Delegation Inspection Banner ────────────────────────────────── */}
            {scope !== 'self' && (targetUserId || targetDepartmentId) && (
              <div className="flex shrink-0 items-center justify-between border-t border-blue-100 bg-blue-50/90 px-4 py-2 text-xs font-medium text-blue-900 sm:px-6">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white font-bold">
                    ℹ
                  </span>
                  <span>
                    {scope === 'faculty' && selectedFaculty ? (
                      <>
                        Viewing Teaching Timetable for <strong>{selectedFaculty.name}</strong> (
                        {selectedFaculty.designation}
                        {selectedFaculty.departmentName
                          ? ` · ${selectedFaculty.departmentName}`
                          : ''}
                        )
                      </>
                    ) : scope === 'mentee' && selectedMentee ? (
                      <>
                        Viewing Academic Schedule for Mentee <strong>{selectedMentee.name}</strong>{' '}
                        ({selectedMentee.rollNumber} · {selectedMentee.program} Sem{' '}
                        {selectedMentee.semester})
                      </>
                    ) : scope === 'department' && selectedDepartment ? (
                      <>
                        Viewing Events & Timetable for <strong>{selectedDepartment.name}</strong>
                      </>
                    ) : (
                      'Viewing Delegated Institutional Schedule'
                    )}
                  </span>
                  <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-blue-800 font-semibold">
                    Private notes protected
                  </span>
                </div>
                <button
                  type="button"
                  onClick={resetToSelf}
                  className="cursor-pointer font-bold text-blue-700 hover:underline"
                >
                  Reset to My Schedule
                </button>
              </div>
            )}

            <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 bg-white px-4 py-2 sm:px-6">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-bold text-slate-500">Class status:</span>
                {[
                  ['bg-blue-50 text-blue-700', 'bg-blue-500', 'Upcoming class'],
                  ['bg-amber-50 text-amber-700', 'bg-amber-500', 'Class happening now'],
                  ['bg-emerald-50 text-emerald-700', 'bg-emerald-500', 'Attendance completed'],
                  ['bg-rose-50 text-rose-700', 'bg-rose-500', 'Attendance still required'],
                ].map(([surface, dot, label]) => (
                  <span
                    key={label}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ${surface}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> {label}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Other events:</span>
                {[
                  ['bg-violet-500', 'Exam'],
                  ['bg-emerald-500', 'Meeting'],
                  ['bg-pink-500', 'Cultural'],
                  ['bg-cyan-500', 'Sports'],
                  ['bg-indigo-500', 'Personal'],
                ].map(([dot, label]) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500"
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid min-h-0 flex-1 lg:grid-cols-12">
              <main className="min-h-0 overflow-auto p-3 sm:p-4 lg:col-span-8 xl:col-span-9">
                {isLoading ? (
                  <div className="grid h-full grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                    {Array.from({ length: 7 }, (_, index) => (
                      <div key={index} className="animate-pulse rounded-2xl bg-white" />
                    ))}
                  </div>
                ) : error ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <CalendarDays className="h-9 w-9 text-rose-300" />
                    <p className="mt-3 text-sm font-semibold text-slate-700">
                      Calendar could not be loaded
                    </p>
                    <button
                      type="button"
                      onClick={() => void mutate()}
                      className="mt-3 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-primary"
                    >
                      Try again
                    </button>
                  </div>
                ) : view === 'month' ? (
                  <div className="space-y-3">
                    {!hasPublishedCalendar && (
                      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                        <CalendarDays className="mt-0.5 size-5 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold">No published academic calendar</p>
                          <p className="mt-1 text-xs leading-5 text-amber-800/80">
                            The institution has not published semester dates, holidays, exams, or
                            events yet. The calendar grid remains available for date navigation.
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="min-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80">
                        {days.map((day) => (
                          <div
                            key={day.getDay()}
                            className="px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500"
                          >
                            {day.toLocaleDateString('en-IN', { weekday: 'short' })}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-px bg-slate-200">
                        {monthDays.map((day) => {
                          const dayEvents = events.filter((event) => occursOn(event, day));
                          const today = sameDay(day, new Date());
                          const outsideMonth = day.getMonth() !== anchorDate.getMonth();
                          const dayEnd = new Date(day);
                          dayEnd.setHours(23, 59, 59, 999);
                          const isPastDay = dayEnd < new Date();
                          return (
                            <div
                              key={day.toISOString()}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                if (isPastDay) return;
                                setAnchorDate(day);
                                openEventForm(day);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  if (isPastDay) return;
                                  setAnchorDate(day);
                                  openEventForm(day);
                                }
                              }}
                              aria-label={`${isPastDay ? 'View' : 'Add event on'} ${day.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                              className={`group/day relative min-h-24 bg-white p-2 text-left transition duration-200 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${isPastDay ? 'cursor-default bg-slate-50/60' : 'cursor-pointer hover:z-10 hover:bg-blue-50/30 '} ${outsideMonth ? 'bg-slate-50/70' : ''}`}
                            >
                              <div className="flex items-center justify-between">
                                <span
                                  className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${today ? 'bg-primary text-white ' : outsideMonth ? 'text-slate-300' : 'text-slate-700'}`}
                                >
                                  {day.getDate()}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {dayEvents.length > 0 && (
                                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-slate-500">
                                      {dayEvents.length}
                                    </span>
                                  )}
                                  {isPastDay ? (
                                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                                      Past
                                    </span>
                                  ) : (
                                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary text-white opacity-0  transition group-hover/day:opacity-100">
                                      <Plus className="h-3.5 w-3.5" />
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="mt-1.5 space-y-1">
                                {dayEvents.slice(0, 2).map((event, index) => {
                                  const config = eventStatusStyle(event);
                                  const dest = getEventDestination(event, role);
                                  const startsAt = new Date(event.startDate);
                                  return (
                                    <button
                                      type="button"
                                      onClick={(clickEvent) => {
                                        clickEvent.stopPropagation();
                                        navigateToEvent(event);
                                      }}
                                      key={event._id ?? `${event.title}-${index}`}
                                      className={`group/event relative flex w-full cursor-pointer items-start gap-1.5 rounded-md border border-white/60 px-1.5 py-1 text-left transition hover:-translate-y-px ${config.surface}`}
                                    >
                                      <span
                                        className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${config.marker}`}
                                      />
                                      <span className="min-w-0 flex-1">
                                        <span
                                          className={`block truncate text-xs font-bold ${config.text}`}
                                        >
                                          {event.title}
                                        </span>
                                        <span className="block truncate text-xs font-medium text-slate-500">
                                          {event.allDay === false
                                            ? startsAt.toLocaleTimeString('en-IN', {
                                                hour: 'numeric',
                                                minute: '2-digit',
                                              })
                                            : 'All day'}
                                          {event.location ? ` · ${event.location}` : ''}
                                        </span>
                                      </span>
                                      <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 hidden w-64 rounded-xl border border-slate-200 bg-white p-3 text-left text-slate-900 ring-1 ring-slate-950/5 group-hover/event:block">
                                        <div className="flex items-start justify-between gap-3">
                                          <p className="text-xs font-bold leading-5">
                                            {event.title}
                                          </p>
                                          <span
                                            className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold ${config.surface} ${config.text}`}
                                          >
                                            {statusLabel(event)}
                                          </span>
                                        </div>
                                        <p className="mt-2 text-xs text-slate-500">
                                          {event.allDay === false
                                            ? `${new Date(event.startDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} – ${new Date(event.endDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                                            : 'All-day activity'}
                                        </p>
                                        {event.description && (
                                          <p className="mt-1.5 line-clamp-3 text-xs leading-4 text-slate-600">
                                            {event.description}
                                          </p>
                                        )}
                                        {event.location && (
                                          <p className="mt-1.5 text-xs font-medium text-primary">
                                            Room / venue: {event.location}
                                          </p>
                                        )}
                                        {event.attendanceSummary && (
                                          <p className="mt-2 border-t border-slate-100 pt-2 text-xs font-medium text-emerald-700">
                                            Present {event.attendanceSummary.present} · Absent{' '}
                                            {event.attendanceSummary.absent} · Total{' '}
                                            {event.attendanceSummary.strength}
                                          </p>
                                        )}
                                        <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-xs font-semibold text-primary">
                                          <span>
                                            {dest
                                              ? dest.label
                                              : event.source === 'personal'
                                                ? 'Edit personal event'
                                                : 'View in day'}
                                          </span>
                                          <ExternalLink className="h-3.5 w-3.5" />
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                                {dayEvents.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={(clickEvent) => {
                                      clickEvent.stopPropagation();
                                      setAnchorDate(day);
                                      setView('day');
                                    }}
                                    className="w-full cursor-pointer rounded-md px-2 py-1 text-left text-xs font-semibold text-primary hover:bg-primary-50"
                                  >
                                    +{dayEvents.length - 2} more
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : view === 'week' ? (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white ">
                    <div className="flex items-center justify-between border-b border-slate-100 bg-linear-to-r from-blue-50/50 to-indigo-50/30 px-4 py-2.5">
                      <div>
                        <p className="text-xs font-bold text-slate-800">Weekly schedule</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {weekEvents.length} {weekEvents.length === 1 ? 'activity' : 'activities'}{' '}
                          · Double-click empty time to add
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-500 sm:flex">
                          <span className="h-2 w-2 rounded-full bg-rose-500" /> Current time
                        </span>
                        <span className="rounded-lg border border-blue-100 bg-blue-50 px-2 py-1.5 text-xs font-semibold text-blue-700">
                          {weekStartHour}:00–{weekEndHour}:00
                        </span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <div className="min-w-4xl">
                        <div className="sticky top-0 z-40 flex border-b border-slate-200 bg-white/95 backdrop-blur">
                          <div className="w-14 shrink-0 border-r border-slate-100" />
                          <div className="grid flex-1 grid-cols-7">
                            {days.map((day) => {
                              const today = sameDay(day, new Date());
                              const count = weekEvents.filter((event) =>
                                occursOn(event, day),
                              ).length;
                              return (
                                <button
                                  type="button"
                                  key={day.toISOString()}
                                  onClick={() => {
                                    setAnchorDate(day);
                                    setView('day');
                                  }}
                                  className={`cursor-pointer border-r border-slate-100 px-2 py-2 text-center transition last:border-r-0 hover:bg-blue-50/50 ${today ? 'bg-blue-50/40' : ''}`}
                                >
                                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                                    {day.toLocaleDateString('en-IN', { weekday: 'short' })}
                                  </span>
                                  <span
                                    className={`mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold ${today ? 'bg-primary text-white ' : 'text-slate-700'}`}
                                  >
                                    {day.getDate()}
                                  </span>
                                  <span className="mt-1 block text-xs font-medium text-slate-600">
                                    {count ? `${count} ${count === 1 ? 'item' : 'items'}` : 'Free'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {weekEvents.some((event) => event.allDay !== false) && (
                          <div className="flex border-b border-slate-200 bg-slate-50/60">
                            <div className="w-14 shrink-0 border-r border-slate-100 px-2 py-3 text-right text-xs font-medium text-slate-600">
                              All day
                            </div>
                            <div className="grid flex-1 grid-cols-7">
                              {days.map((day) => (
                                <div
                                  key={day.toISOString()}
                                  className="min-h-10 border-r border-slate-100 p-1 last:border-r-0"
                                >
                                  {weekEvents
                                    .filter(
                                      (event) => event.allDay !== false && occursOn(event, day),
                                    )
                                    .slice(0, 2)
                                    .map((event) => {
                                      const config = eventStatusStyle(event);
                                      return (
                                        <button
                                          type="button"
                                          key={event._id ?? event.title}
                                          onClick={() => navigateToEvent(event)}
                                          className={`mb-1 w-full cursor-pointer truncate rounded-md px-2 py-1 text-left text-xs font-semibold ${config.surface} ${config.text}`}
                                        >
                                          {event.title}
                                        </button>
                                      );
                                    })}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex">
                          <div
                            className="relative w-14 shrink-0 border-r border-slate-100"
                            style={{ height: (weekEndHour - weekStartHour) * weekHourHeight }}
                          >
                            {weekHours.slice(0, -1).map((hour, hourIndex) => (
                              <div
                                key={hour}
                                className={`absolute right-2 flex flex-col items-end ${hourIndex === 0 ? '' : '-translate-y-1/2'}`}
                                style={{
                                  top:
                                    hourIndex === 0 ? 6 : (hour - weekStartHour) * weekHourHeight,
                                }}
                              >
                                <span className="text-xs font-semibold text-slate-500">
                                  {new Date(2000, 0, 1, hour).toLocaleTimeString('en-IN', {
                                    hour: 'numeric',
                                  })}
                                </span>
                                <span className="mt-2 text-xs font-medium text-slate-300">:30</span>
                              </div>
                            ))}
                          </div>
                          <div
                            className="relative grid grid-cols-7"
                            style={{
                              height: (weekEndHour - weekStartHour) * weekHourHeight,
                              backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${weekHourHeight / 2 - 1}px, rgb(241 245 249) ${weekHourHeight / 2}px, transparent ${weekHourHeight / 2 + 1}px, transparent ${weekHourHeight - 1}px, rgb(226 232 240) ${weekHourHeight}px)`,
                            }}
                          >
                            {days.map((day) => {
                              const arranged = arrangeWeekEvents(
                                timedWeekEvents.filter((event) => occursOn(event, day)),
                              );
                              return (
                                <div
                                  key={day.toISOString()}
                                  onDoubleClick={(mouseEvent) => {
                                    const bounds = mouseEvent.currentTarget.getBoundingClientRect();
                                    const minutesFromStart = Math.max(
                                      0,
                                      Math.round(
                                        (((mouseEvent.clientY - bounds.top) / weekHourHeight) *
                                          60) /
                                          15,
                                      ) * 15,
                                    );
                                    const selected = new Date(day);
                                    selected.setHours(
                                      weekStartHour + Math.floor(minutesFromStart / 60),
                                      minutesFromStart % 60,
                                      0,
                                      0,
                                    );
                                    openEventForm(selected);
                                  }}
                                  className={`relative cursor-crosshair border-r border-slate-100 transition last:border-r-0 hover:bg-blue-50/20 ${sameDay(day, new Date()) ? 'bg-blue-50/30' : ''}`}
                                >
                                  {arranged.map(({ event, lane, laneCount }, index) => {
                                    const config = eventStatusStyle(event);
                                    const start = new Date(event.startDate);
                                    const end = new Date(event.endDate);
                                    const startMinutes = start.getHours() * 60 + start.getMinutes();
                                    const endMinutes = end.getHours() * 60 + end.getMinutes();
                                    const top =
                                      ((startMinutes - weekStartHour * 60) / 60) * weekHourHeight;
                                    const height = Math.max(
                                      28,
                                      ((endMinutes - startMinutes) / 60) * weekHourHeight,
                                    );
                                    const width = 100 / laneCount;
                                    return (
                                      <motion.button
                                        type="button"
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        whileHover={{ scale: 1.015, zIndex: 20 }}
                                        onClick={() => navigateToEvent(event)}
                                        key={event._id ?? `${event.title}-${index}`}
                                        title={`${event.title}${event.location ? ` · ${event.location}` : ''}`}
                                        className={`absolute cursor-pointer overflow-hidden rounded-lg border border-white/80 px-2 py-1.5 text-left ring-1 ring-inset ring-black/5 transition ${config.surface} ${config.text}`}
                                        style={{
                                          top,
                                          height,
                                          left: `calc(${lane * width}% + 4px)`,
                                          width: `calc(${width}% - 7px)`,
                                        }}
                                      >
                                        <span className="block truncate text-xs font-bold">
                                          {event.title}
                                        </span>
                                        <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold opacity-80">
                                          <Clock3 className="h-2.5 w-2.5" />
                                          {start.toLocaleTimeString('en-IN', {
                                            hour: 'numeric',
                                            minute: '2-digit',
                                          })}
                                        </span>
                                        {height >= 52 && event.location && (
                                          <span className="mt-1 flex items-center gap-1 truncate text-xs opacity-70">
                                            <MapPin className="h-2.5 w-2.5 shrink-0" />
                                            <span className="truncate">{event.location}</span>
                                          </span>
                                        )}
                                      </motion.button>
                                    );
                                  })}
                                  {sameDay(day, new Date()) &&
                                    new Date().getHours() >= weekStartHour &&
                                    new Date().getHours() < weekEndHour && (
                                      <div
                                        className="pointer-events-none absolute left-0 right-0 z-30 border-t border-rose-400"
                                        style={{
                                          top:
                                            ((new Date().getHours() * 60 +
                                              new Date().getMinutes() -
                                              weekStartHour * 60) /
                                              60) *
                                            weekHourHeight,
                                        }}
                                      >
                                        <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-rose-500 " />
                                        <span className="absolute right-1 -top-3 rounded bg-rose-50 px-1 py-0.5 text-xs font-bold text-rose-600">
                                          Now
                                        </span>
                                      </div>
                                    )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : view === 'day' ? (
                  <div className="mx-auto max-w-5xl space-y-3">
                    <div className="overflow-x-auto rounded-2xl bg-white p-2">
                      <div className="grid min-w-xl grid-cols-7 gap-1">
                        {dayStrip.map((day) => {
                          const selected = sameDay(day, anchorDate);
                          const today = sameDay(day, new Date());
                          const count = events.filter((event) => occursOn(event, day)).length;
                          return (
                            <button
                              key={day.toISOString()}
                              type="button"
                              onClick={() => setAnchorDate(day)}
                              aria-pressed={selected}
                              className={`relative flex min-h-20 flex-col items-center justify-center rounded-xl px-2 py-2 transition ${selected ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                              <span
                                className={`text-xs font-semibold uppercase tracking-wider ${selected ? 'text-white/75' : 'text-slate-600'}`}
                              >
                                {day.toLocaleDateString('en-IN', { weekday: 'short' })}
                              </span>
                              <span className="mt-1 text-lg font-bold">{day.getDate()}</span>
                              <span
                                className={`mt-1 text-xs font-medium ${selected ? 'text-white/70' : today ? 'text-primary' : 'text-slate-600'}`}
                              >
                                {today
                                  ? 'Today'
                                  : count
                                    ? `${count} ${count === 1 ? 'event' : 'events'}`
                                    : 'Free'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-2xl bg-white">
                      <div className="flex flex-wrap items-center gap-4 bg-linear-to-r from-blue-50/50 to-indigo-50/30 px-5 py-5 sm:px-6">
                        <div className="flex h-14 w-14 flex-col items-center justify-center rounded-2xl bg-primary text-white">
                          <span className="text-xs font-semibold uppercase">
                            {anchorDate.toLocaleDateString('en-IN', { month: 'short' })}
                          </span>
                          <span className="text-xl font-bold leading-5">
                            {anchorDate.getDate()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {anchorDate.toLocaleDateString('en-IN', { weekday: 'long' })}
                          </p>
                          <p className="text-xs text-slate-500">
                            Your role-visible activity for this day
                          </p>
                        </div>
                        <div className="ml-auto rounded-xl bg-white/80 px-3 py-2 text-right">
                          <p className="text-lg font-bold text-slate-900">
                            {selectedDayEvents.length}
                          </p>
                          <p className="text-xs font-medium text-slate-600">Published activities</p>
                        </div>
                      </div>
                      <div>
                        {selectedDayEvents.length > 0 && (
                          <div className="flex bg-slate-50 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-600 sm:px-6">
                            <span className="w-24 shrink-0 sm:w-28">Schedule</span>
                            <span className="flex-1">All-day institutional activity</span>
                          </div>
                        )}
                        <div className="divide-y divide-slate-100">
                          {selectedDayEvents.map((event, index) => {
                            const config = eventStatusStyle(event);
                            const dest = getEventDestination(event, role);
                            return (
                              <div
                                key={event._id ?? `${event.title}-${index}`}
                                className="flex gap-3 px-5 py-5 sm:gap-4 sm:px-6"
                              >
                                <div className="flex w-24 shrink-0 items-start gap-2 pt-0.5 sm:w-28">
                                  <span
                                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${config.marker}`}
                                  />
                                  <span className="text-xs font-semibold text-slate-500">
                                    {event.allDay === false
                                      ? new Date(event.startDate).toLocaleTimeString('en-IN', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })
                                      : 'All day'}
                                  </span>
                                </div>
                                <div
                                  className={`min-w-0 flex-1 rounded-xl px-4 py-3 transition ${config.surface}`}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="font-semibold text-slate-800">{event.title}</p>
                                    <span
                                      className={`rounded-lg px-2 py-1 text-xs font-semibold ${config.surface} ${config.text}`}
                                    >
                                      {config.label}
                                    </span>
                                  </div>
                                  {event.description && (
                                    <p className="mt-2 text-sm leading-6 text-slate-500">
                                      {event.description}
                                    </p>
                                  )}
                                  <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
                                    <Clock3 className="h-3.5 w-3.5" />
                                    {new Date(event.startDate).toLocaleDateString('en-IN', {
                                      day: '2-digit',
                                      month: 'short',
                                    })}
                                    {' – '}
                                    {new Date(event.endDate).toLocaleDateString('en-IN', {
                                      day: '2-digit',
                                      month: 'short',
                                    })}
                                  </p>
                                  {event.location && (
                                    <p className="mt-1 text-xs text-slate-500">{event.location}</p>
                                  )}
                                  {event.attendanceSummary && (
                                    <div className="mt-3 flex flex-wrap gap-2 border-t border-current/10 pt-3 text-xs font-semibold">
                                      <span className="rounded-lg bg-white/70 px-2 py-1">
                                        Present {event.attendanceSummary.present}
                                      </span>
                                      <span className="rounded-lg bg-white/70 px-2 py-1">
                                        Absent {event.attendanceSummary.absent}
                                      </span>
                                      <span className="rounded-lg bg-white/70 px-2 py-1">
                                        Strength {event.attendanceSummary.strength}
                                      </span>
                                    </div>
                                  )}
                                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200/50 pt-2.5">
                                    {dest && (
                                      <button
                                        type="button"
                                        onClick={() => navigateToEvent(event)}
                                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-xs ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-primary"
                                      >
                                        <span>{dest.label}</span>
                                        <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                                      </button>
                                    )}
                                    {event.source === 'personal' && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openEventForm(new Date(event.startDate), event)
                                        }
                                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-xs ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-primary"
                                      >
                                        Edit personal event
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {!selectedDayEvents.length && (
                            <div className="py-24 text-center">
                              <CalendarDays className="mx-auto h-9 w-9 text-slate-200" />
                              <p className="mt-3 text-sm font-semibold text-slate-500">
                                {hasPublishedCalendar
                                  ? 'No activity this day'
                                  : 'Academic calendar not published'}
                              </p>
                              <p className="mt-1 text-xs text-slate-600">
                                {hasPublishedCalendar
                                  ? 'Choose another date or return to Today.'
                                  : 'Published institutional dates and events will appear here for every eligible role.'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {upcoming.map((event, index) => {
                      const config = eventStatusStyle(event);
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            setAnchorDate(new Date(event.startDate));
                            setView('day');
                          }}
                          key={event._id ?? index}
                          className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left transition hover:-translate-y-0.5 "
                        >
                          <span className={`h-10 w-1 shrink-0 rounded-full ${config.marker}`} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-800">
                              {event.title}
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              {new Date(event.startDate).toLocaleString('en-IN', {
                                weekday: 'short',
                                day: '2-digit',
                                month: 'short',
                                hour: event.allDay === false ? '2-digit' : undefined,
                                minute: event.allDay === false ? '2-digit' : undefined,
                              })}
                              {event.location ? ` · ${event.location}` : ''}
                            </p>
                            {event.description && (
                              <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                                {event.description}
                              </p>
                            )}
                          </div>
                          <span
                            className={`rounded-lg px-2 py-1 text-xs font-semibold ${config.surface} ${config.text}`}
                          >
                            {statusLabel(event)}
                          </span>
                        </button>
                      );
                    })}
                    {!upcoming.length && (
                      <div className="flex flex-col items-center py-12 text-center text-sm text-slate-600">
                        <Image
                          src="/images/calendar/calendar-empty-state.png"
                          alt="Calendar awaiting scheduled activity"
                          width={230}
                          height={158}
                          className="h-auto w-48 object-contain"
                          priority={false}
                        />
                        <p className="mt-3 font-semibold text-slate-600">
                          {hasPublishedCalendar
                            ? 'No upcoming calendar activity'
                            : 'No published academic calendar'}
                        </p>
                        <p className="mt-1 max-w-sm text-xs">
                          New classes, meetings and institutional events will appear here
                          automatically.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </main>

              <aside className="hidden min-h-0 overflow-y-auto bg-white p-5 lg:col-span-4 lg:block xl:col-span-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Upcoming activity</p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      Your next {upcoming.length} scheduled{' '}
                      {upcoming.length === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                  <motion.div
                    animate={{ y: [0, -3, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    className="relative h-16 w-16 shrink-0"
                  >
                    <Image
                      src="/images/calendar/upcoming-activity-illustration.png"
                      alt="Upcoming calendar activities"
                      fill
                      sizes="64px"
                      className="object-contain"
                    />
                  </motion.div>
                </div>
                <div className="mt-3 space-y-2.5">
                  {upcoming.map((event, index) => {
                    const config = eventStatusStyle(event);
                    const dest = getEventDestination(event, role);
                    const startsAt = new Date(event.startDate);
                    const endsAt = new Date(event.endDate);
                    return (
                      <motion.button
                        type="button"
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(index * 0.04, 0.28) }}
                        whileHover={{ y: -1, scale: 1.005 }}
                        onClick={() => navigateToEvent(event)}
                        key={event._id ?? index}
                        className="group relative w-full cursor-pointer overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-3 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50/20"
                      >
                        <span
                          className={`absolute left-0 top-1/2 h-9 w-1 -translate-y-1/2 rounded-r-full ${config.marker}`}
                          aria-hidden="true"
                        />
                        <div className="flex items-start gap-2.5 pl-0.5">
                          <div
                            className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-xl ${config.surface}`}
                          >
                            <ActivityArtwork
                              category={event.category}
                              className="h-full w-full scale-90 transition duration-300 group-hover:scale-105"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-start justify-between gap-1.5">
                              <p className="truncate text-xs font-semibold leading-5 text-slate-800 group-hover:text-primary transition-colors">
                                {event.title}
                              </p>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${config.surface} ${config.text}`}
                              >
                                {statusLabel(event)}
                              </span>
                            </div>
                            <p className="mt-1 flex min-w-0 items-center gap-1 text-xs font-medium text-slate-500">
                              <CalendarDays className="h-3 w-3 text-primary" />
                              <span className="shrink-0">
                                {startsAt.toLocaleDateString('en-IN', {
                                  weekday: 'short',
                                  day: '2-digit',
                                  month: 'short',
                                })}
                              </span>
                              <span className="text-slate-300">·</span>
                              <span className="truncate">
                                {event.allDay === false
                                  ? `${startsAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}–${endsAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`
                                  : 'All day'}
                              </span>
                            </p>
                            <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
                              {event.location && (
                                <span className="flex min-w-0 items-center gap-1 rounded-md bg-slate-50 px-1.5 py-1 text-xs font-medium text-slate-500">
                                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                                  <span className="truncate">{event.location}</span>
                                </span>
                              )}
                              <span
                                className={`shrink-0 rounded-md px-1.5 py-1 text-xs font-semibold ${config.surface} ${config.text}`}
                              >
                                {config.label}
                              </span>
                            </div>
                            {event.description && (
                              <p className="mt-1.5 truncate text-xs leading-4 text-slate-600">
                                {event.description}
                              </p>
                            )}
                            {(event.recurrence && event.recurrence !== 'none') ||
                            event.reminderMinutes?.length ? (
                              <div className="mt-1.5 flex gap-1 overflow-hidden border-t border-slate-100 pt-1.5">
                                {event.recurrence && event.recurrence !== 'none' && (
                                  <span className="flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-1 text-xs font-medium capitalize text-slate-500">
                                    <Repeat2 className="h-2.5 w-2.5" /> {event.recurrence}
                                  </span>
                                )}
                                {event.reminderMinutes?.slice(0, 2).map((minutes) => (
                                  <span
                                    key={minutes}
                                    className="flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-1 text-xs font-medium text-blue-600"
                                  >
                                    <BellRing className="h-2.5 w-2.5" />
                                    {reminderLabel(minutes)}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            {dest ? (
                              <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-xs font-semibold text-primary">
                                <span>{dest.label}</span>
                                <ExternalLink className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                              </div>
                            ) : (
                              <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-xs font-semibold text-slate-500 group-hover:text-primary">
                                <span>
                                  {event.source === 'personal' ? 'Edit event' : 'View in day'}
                                </span>
                                <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                  {!upcoming.length && (
                    <div className="py-12 text-center text-xs text-slate-600">
                      {hasPublishedCalendar
                        ? 'No upcoming calendar activity'
                        : 'Academic calendar not published'}
                    </div>
                  )}
                </div>
                <div className="mt-5 rounded-xl bg-primary-50 p-4">
                  <p className="text-xs font-semibold text-slate-800">Calendar workspace</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    My Calendar shows published activity relevant to your role. Academic Calendar
                    controls institution dates and publication.
                  </p>
                </div>
                {canManageAcademicCalendar && (
                  <button
                    type="button"
                    onClick={() => {
                      router.push(getTenantRolePath(role, '/academic-calendar'));
                      closePanel();
                    }}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white"
                  >
                    Manage Academic Calendar <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                )}
              </aside>
            </div>
            <AnimatePresence>
              {eventFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <motion.button
                    type="button"
                    aria-label="Close event form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setEventFormOpen(false)}
                    className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
                  />
                  <motion.form
                    initial={{ opacity: 0, scale: 0.96, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    onSubmit={eventFormik.handleSubmit}
                    className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl bg-white "
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                      <div>
                        <p className="text-lg font-bold text-slate-900">
                          {editingEvent ? 'Edit personal event' : 'Add personal event'}
                        </p>
                        <p className="text-xs text-slate-500">
                          Saved only to your calendar with an optional reminder.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEventFormOpen(false)}
                        className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"
                      >
                        <X className="size-5" />
                      </button>
                    </div>
                    <div className="grid gap-4 p-6 sm:grid-cols-2">
                      <label className="sm:col-span-2">
                        <span className="mb-1 block text-xs font-semibold text-slate-600">
                          Event title *
                        </span>
                        <input
                          maxLength={200}
                          name="title"
                          value={eventFormik.values.title}
                          onChange={eventFormik.handleChange}
                          onBlur={eventFormik.handleBlur}
                          className={`h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 ${eventFormik.touched.title && eventFormik.errors.title ? 'border-rose-400' : 'border-slate-200'}`}
                          placeholder="What are you planning?"
                        />
                        {eventFormik.touched.title && eventFormik.errors.title && (
                          <span className="mt-1 block text-xs font-medium text-rose-600">
                            {eventFormik.errors.title}
                          </span>
                        )}
                      </label>
                      <label>
                        <span className="mb-1 block text-xs font-semibold text-slate-600">
                          Starts *
                        </span>
                        <input
                          type="datetime-local"
                          name="startDate"
                          min={
                            editingEvent
                              ? undefined
                              : new Date(
                                  eventFormOpenedAt.getTime() -
                                    eventFormOpenedAt.getTimezoneOffset() * 60000,
                                )
                                  .toISOString()
                                  .slice(0, 16)
                          }
                          value={eventFormik.values.startDate}
                          onChange={eventFormik.handleChange}
                          onBlur={eventFormik.handleBlur}
                          className={`h-11 w-full rounded-xl border px-3 text-sm ${eventFormik.touched.startDate && eventFormik.errors.startDate ? 'border-rose-400' : 'border-slate-200'}`}
                        />
                        {eventFormik.touched.startDate && eventFormik.errors.startDate && (
                          <span className="mt-1 block text-xs font-medium text-rose-600">
                            {eventFormik.errors.startDate}
                          </span>
                        )}
                      </label>
                      <label>
                        <span className="mb-1 block text-xs font-semibold text-slate-600">
                          Ends *
                        </span>
                        <input
                          type="datetime-local"
                          name="endDate"
                          min={eventFormik.values.startDate || undefined}
                          value={eventFormik.values.endDate}
                          onChange={eventFormik.handleChange}
                          onBlur={eventFormik.handleBlur}
                          className={`h-11 w-full rounded-xl border px-3 text-sm ${eventFormik.touched.endDate && eventFormik.errors.endDate ? 'border-rose-400' : 'border-slate-200'}`}
                        />
                        {eventFormik.touched.endDate && eventFormik.errors.endDate && (
                          <span className="mt-1 block text-xs font-medium text-rose-600">
                            {eventFormik.errors.endDate}
                          </span>
                        )}
                      </label>
                      <label>
                        <span className="mb-1 block text-xs font-semibold text-slate-600">
                          Location
                        </span>
                        <input
                          name="location"
                          value={eventFormik.values.location}
                          onChange={eventFormik.handleChange}
                          onBlur={eventFormik.handleBlur}
                          className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                          placeholder="Room, building or online"
                        />
                        {eventFormik.touched.location && eventFormik.errors.location && (
                          <span className="mt-1 block text-xs font-medium text-rose-600">
                            {eventFormik.errors.location}
                          </span>
                        )}
                      </label>
                      <fieldset className="sm:col-span-2">
                        <legend className="mb-1 block text-xs font-semibold text-slate-600">
                          Reminder notifications
                        </legend>
                        <div className="flex flex-wrap gap-2">
                          {[
                            [0, 'At start'],
                            [10, '10 min before'],
                            [30, '30 min before'],
                            [60, '1 hour before'],
                            [1440, '1 day before'],
                          ].map(([minutes, label]) => {
                            const value = Number(minutes);
                            const selected = eventFormik.values.reminderMinutes.includes(value);
                            return (
                              <button
                                key={value}
                                type="button"
                                aria-pressed={selected}
                                onClick={() =>
                                  void eventFormik.setFieldValue(
                                    'reminderMinutes',
                                    selected
                                      ? eventFormik.values.reminderMinutes.filter(
                                          (item) => item !== value,
                                        )
                                      : [...eventFormik.values.reminderMinutes, value],
                                  )
                                }
                                className={`cursor-pointer rounded-full border px-3 py-2 text-xs font-semibold transition ${
                                  selected
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50/50'
                                }`}
                              >
                                {selected ? '\u2713 ' : ''}
                                {label}
                              </button>
                            );
                          })}
                        </div>
                        <p className="mt-1.5 text-xs text-slate-500">
                          Select multiple alerts, or leave all unselected for no reminder.
                        </p>
                      </fieldset>
                      <label>
                        <span className="mb-1 block text-xs font-semibold text-slate-600">
                          Repeat
                        </span>
                        <select
                          name="recurrence"
                          value={eventFormik.values.recurrence}
                          onChange={eventFormik.handleChange}
                          onBlur={eventFormik.handleBlur}
                          className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                        >
                          <option value="none">Does not repeat</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </label>
                      <label>
                        <span className="mb-1 block text-xs font-semibold text-slate-600">
                          Repeat until
                        </span>
                        <input
                          type="date"
                          name="recurrenceUntil"
                          disabled={eventFormik.values.recurrence === 'none'}
                          min={eventFormik.values.startDate.slice(0, 10) || undefined}
                          value={eventFormik.values.recurrenceUntil}
                          onChange={eventFormik.handleChange}
                          onBlur={eventFormik.handleBlur}
                          className={`h-11 w-full rounded-xl border px-3 text-sm disabled:bg-slate-100 ${eventFormik.touched.recurrenceUntil && eventFormik.errors.recurrenceUntil ? 'border-rose-400' : 'border-slate-200'}`}
                        />
                        {eventFormik.touched.recurrenceUntil &&
                          eventFormik.errors.recurrenceUntil && (
                            <span className="mt-1 block text-xs font-medium text-rose-600">
                              {eventFormik.errors.recurrenceUntil}
                            </span>
                          )}
                      </label>
                      <label className="sm:col-span-2">
                        <span className="mb-1 block text-xs font-semibold text-slate-600">
                          Notes
                        </span>
                        <textarea
                          rows={3}
                          maxLength={5000}
                          name="description"
                          value={eventFormik.values.description}
                          onChange={eventFormik.handleChange}
                          onBlur={eventFormik.handleBlur}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          placeholder="Add useful details"
                        />
                        {eventFormik.touched.description && eventFormik.errors.description && (
                          <span className="mt-1 block text-xs font-medium text-rose-600">
                            {eventFormik.errors.description}
                          </span>
                        )}
                      </label>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
                      <div>
                        {editingEvent?.sourceId && (
                          <button
                            type="button"
                            onClick={() => void deletePersonalEvent()}
                            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="size-4" /> Delete
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEventFormOpen(false)}
                          className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSaving}
                          className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
                        >
                          {isSaving ? 'Saving…' : 'Save event'}
                        </button>
                      </div>
                    </div>
                  </motion.form>
                </div>
              )}
            </AnimatePresence>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}

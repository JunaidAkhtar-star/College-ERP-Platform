'use client';

import CalendarView, { CalendarEvent } from '@/shared/core/CalendarView';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Action, Column } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import EngagementWorkflowBar from '@/shared/components/EngagementWorkflowBar';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useAuthStore } from '@/shared/store/authStore';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import {
  CalendarDays,
  CheckCircle2,
  CircleGauge,
  ClipboardCheck,
  Eye,
  ListFilter,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  TicketCheck,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { IEvent, TEventType } from '../types/Event.types';
import EventModal from './EventModal';

type TTab = 'overview' | 'events' | 'mine' | 'review';
type TStatus = 'draft' | 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
interface IEventStats {
  summary: {
    total: number;
    drafts: number;
    upcoming: number;
    ongoing: number;
    completed: number;
    cancelled: number;
    registrations: number;
    attended: number;
    capacity: number;
  };
  byType: Array<{ _id: TEventType; events: number; registrations: number }>;
  trend: Array<{ _id: string; events: number; registrations: number }>;
}

const types: TEventType[] = [
  'workshop',
  'seminar',
  'cultural',
  'sports',
  'technical',
  'placement',
  'other',
];
const statusStyle: Record<TStatus, string> = {
  draft: 'bg-amber-50 text-amber-700',
  upcoming: 'bg-blue-50 text-blue-700',
  ongoing: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-rose-50 text-rose-700',
};
const idOf = (value?: string | { _id?: string }) =>
  typeof value === 'string' ? value : String(value?._id ?? '');
function statusOf(event: IEvent): TStatus {
  if (event.isCancelled) return 'cancelled';
  if (!event.isPublished) return 'draft';
  const now = Date.now();
  if (new Date(event.startDate).getTime() > now) return 'upcoming';
  if (new Date(event.endDate).getTime() >= now) return 'ongoing';
  return 'completed';
}
const isRegisteredFor = (event: IEvent) =>
  event.isRegistered === true || Boolean(event.myRegistration);
function formatDate(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-slate-200 px-5 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}
const chartColors = ['#2563eb', '#8b5cf6', '#14b8a6', '#f59e0b', '#ec4899', '#06b6d4', '#94a3b8'];
const chartDotClasses = [
  'bg-blue-600',
  'bg-violet-500',
  'bg-teal-500',
  'bg-amber-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-slate-400',
];

function EventMixDonut({ rows }: { rows: IEventStats['byType'] }) {
  const [active, setActive] = useState<number | null>(null);
  const total = rows.reduce((sum, row) => sum + row.events, 0);
  if (!total)
    return <EmptyChart text="Category distribution will appear when events are created." />;
  const segments = rows.map((row, index) => {
    const length = (row.events / total) * 100;
    const offset = rows
      .slice(0, index)
      .reduce((sum, previous) => sum + (previous.events / total) * 100, 0);
    const segment = {
      ...row,
      length,
      offset,
      color: chartColors[index % chartColors.length],
      dotClass: chartDotClasses[index % chartDotClasses.length],
    };
    return segment;
  });
  const selected = active === null ? undefined : segments[active];
  return (
    <div className="mt-4 grid items-center gap-4 sm:grid-cols-[170px_1fr]">
      <div className="relative mx-auto h-40 w-40">
        <svg
          viewBox="0 0 42 42"
          className="h-full w-full -rotate-90"
          role="img"
          aria-label="Event category distribution"
        >
          <circle cx="21" cy="21" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="5" />
          {segments.map((segment, index) => (
            <motion.circle
              key={segment._id}
              cx="21"
              cy="21"
              r="15.9"
              fill="none"
              stroke={segment.color}
              strokeWidth={active === index ? 6.5 : 5}
              strokeDasharray={`${segment.length} ${100 - segment.length}`}
              strokeDashoffset={-segment.offset}
              strokeLinecap="butt"
              className={`cursor-pointer transition-all duration-300 ${active !== null && active !== index ? 'opacity-25' : 'opacity-100'}`}
              initial={{ strokeDasharray: '0 100' }}
              animate={{ strokeDasharray: `${segment.length} ${100 - segment.length}` }}
              transition={{ duration: 0.65, delay: index * 0.06 }}
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
            >
              <title>{`${segment._id}: ${segment.events} events, ${segment.registrations} registrations`}</title>
            </motion.circle>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <b className="text-2xl text-slate-900">{selected?.events ?? total}</b>
          <span className="max-w-20 text-[10px] capitalize text-slate-500">
            {selected?._id ?? 'all events'}
          </span>
        </div>
      </div>
      <div className="grid gap-2">
        {segments.map((segment, index) => (
          <button
            type="button"
            key={segment._id}
            onMouseEnter={() => setActive(index)}
            onMouseLeave={() => setActive(null)}
            className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-colors ${active === index ? 'bg-slate-50' : ''}`}
          >
            <span className="flex items-center gap-2 font-semibold capitalize text-slate-700">
              <i className={`h-2.5 w-2.5 rounded-full ${segment.dotClass}`} />
              {segment._id}
            </span>
            <span className="text-slate-500">{Math.round(segment.length)}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DeliveryRadar({
  published,
  capacity,
  attendance,
}: {
  published: number;
  capacity: number;
  attendance: number;
}) {
  const values = [published, capacity, attendance].map((value) => Math.min(100, value));
  const center = { x: 70, y: 58 };
  const axes = [
    { x: 70, y: 12 },
    { x: 116, y: 84 },
    { x: 24, y: 84 },
  ];
  const polygonAt = (level: number) =>
    axes
      .map(
        (axis) =>
          `${center.x + (axis.x - center.x) * level},${center.y + (axis.y - center.y) * level}`,
      )
      .join(' ');
  const dataPoints = axes
    .map((axis, index) => {
      const ratio = values[index] / 100;
      return `${center.x + (axis.x - center.x) * ratio},${center.y + (axis.y - center.y) * ratio}`;
    })
    .join(' ');
  const rows = [
    { label: 'Published', value: published, dot: 'bg-blue-600' },
    { label: 'Capacity', value: capacity, dot: 'bg-violet-500' },
    { label: 'Attendance', value: attendance, dot: 'bg-teal-500' },
  ];
  return (
    <div className="mt-3 grid items-center gap-2 sm:grid-cols-[150px_1fr]">
      <svg
        viewBox="0 0 140 104"
        className="mx-auto h-36 w-48 max-w-full"
        role="img"
        aria-label={`Delivery radar: published ${published}%, capacity ${capacity}%, attendance ${attendance}%`}
      >
        {[0.25, 0.5, 0.75, 1].map((level) => (
          <polygon
            key={level}
            points={polygonAt(level)}
            fill={level === 1 ? '#f8fafc' : 'none'}
            stroke="#dbe4ee"
            strokeWidth="0.7"
          />
        ))}
        {axes.map((axis, index) => (
          <line
            key={index}
            x1={center.x}
            y1={center.y}
            x2={axis.x}
            y2={axis.y}
            stroke="#dbe4ee"
            strokeWidth="0.7"
          />
        ))}
        <motion.polygon
          points={dataPoints}
          fill="#8b5cf6"
          fillOpacity="0.18"
          stroke="#7c3aed"
          strokeWidth="2"
          strokeLinejoin="round"
          initial={{
            points: `${center.x},${center.y} ${center.x},${center.y} ${center.x},${center.y}`,
            opacity: 0,
          }}
          animate={{ points: dataPoints, opacity: 1 }}
          transition={{ duration: 0.75, ease: 'easeOut' }}
        />
        {axes.map((axis, index) => {
          const ratio = values[index] / 100;
          return (
            <motion.circle
              key={rows[index].label}
              cx={center.x + (axis.x - center.x) * ratio}
              cy={center.y + (axis.y - center.y) * ratio}
              r="2.5"
              fill="#7c3aed"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5 + index * 0.08 }}
            >
              <title>{`${rows[index].label}: ${rows[index].value}%`}</title>
            </motion.circle>
          );
        })}
      </svg>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs"
          >
            <span className="flex items-center gap-2 font-semibold text-slate-600">
              <i className={`h-2 w-2 rounded-full ${row.dot}`} />
              {row.label}
            </span>
            <b className="text-slate-900">{row.value}%</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EventPage() {
  const canCreate = useHasPermission('event', 'create');
  const canEdit = useHasPermission('event', 'edit');
  const canApprove = useHasPermission('event', 'approve');
  const userId = useAuthStore((state) => state.user?._id ?? '');
  const [tab, setTab] = useState<TTab>('overview');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [calendar, setCalendar] = useState(false);
  const [editing, setEditing] = useState<IEvent | null | undefined>(undefined);
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data: raw, error, isLoading, isValidating, mutate } = useSwr('event?limit=100');
  const { data: statsRaw, isLoading: statsLoading, mutate: refreshStats } = useSwr('event/stats');
  const { mutation, isLoading: processing } = useMutation();
  const events = useMemo(() => (raw as { data?: IEvent[] })?.data ?? [], [raw]);
  const stats = (statsRaw as { data?: IEventStats })?.data;
  const owns = (event: IEvent) =>
    idOf(event.createdBy) === userId ||
    event.coordinators.some((person) => idOf(person) === userId);
  const canManage = (event: IEvent) => canEdit && (owns(event) || canApprove);
  const visible = useMemo(
    () =>
      events.filter((event) => {
        const inTab =
          tab === 'mine'
            ? isRegisteredFor(event)
            : tab === 'review'
              ? statusOf(event) === 'draft'
              : true;
        return (
          inTab && (!status || statusOf(event) === status) && (!type || event.eventType === type)
        );
      }),
    [events, tab, status, type],
  );
  const calendarEvents: CalendarEvent[] = visible
    .filter((event) => statusOf(event) !== 'cancelled')
    .map((event) => ({
      id: event._id,
      title: event.title,
      date: new Date(event.startDate),
      endDate: new Date(event.endDate),
      category: event.eventType,
      badge: event.eventType,
      payload: event,
    }));
  const refresh = async () => {
    await Promise.all([mutate(), refreshStats()]);
  };
  const publish = async (event: IEvent) => {
    const answer = await Swal.fire({
      title: 'Publish this event?',
      text: 'The selected audience will be notified and registration will open.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Publish',
      confirmButtonColor: '#0178D7',
    });
    if (!answer.isConfirmed) return;
    const response = await mutation(`event/${event._id}/publish`, { method: 'POST' });
    if (!response?.results?.success) return;
    toast.success('Event published');
    await refresh();
  };
  const register = async (event: IEvent) => {
    const response = await mutation(`event/${event._id}/register`, { method: 'POST' });
    if (!response?.results?.success) return;
    toast.success('Registration confirmed');
    await refresh();
    setTab('mine');
  };
  const cancel = async (event: IEvent) => {
    const answer = await Swal.fire({
      title: 'Cancel this event?',
      input: 'textarea',
      inputLabel: 'Reason',
      inputPlaceholder: 'Explain why the event is being cancelled',
      inputValidator: (value) =>
        String(value ?? '').trim().length < 3 ? 'Enter a clear reason' : undefined,
      showCancelButton: true,
      confirmButtonText: 'Cancel event',
      confirmButtonColor: '#e11d48',
    });
    if (!answer.isConfirmed) return;
    const response = await mutation(`event/${event._id}/cancel`, {
      method: 'POST',
      body: { reason: String(answer.value).trim() },
    });
    if (!response?.results?.success) return;
    toast.success('Event cancelled');
    await refresh();
  };
  const markAttendance = async (event: IEvent) => {
    const options = Object.fromEntries(
      (event.registrations ?? [])
        .filter((entry) => !entry.attended)
        .map((entry) => [
          idOf(entry.userId),
          typeof entry.userId === 'string'
            ? 'Registered participant'
            : `${entry.userId.name ?? 'Participant'}${entry.userId.email ? ` · ${entry.userId.email}` : ''}`,
        ]),
    );
    const answer = await Swal.fire({
      title: 'Mark attendance',
      input: 'select',
      inputOptions: options,
      inputPlaceholder: 'Select a registered participant',
      inputValidator: (value) => (!value ? 'Select a participant' : undefined),
      showCancelButton: true,
      confirmButtonText: 'Mark present',
    });
    if (!answer.isConfirmed) return;
    const response = await mutation(`event/${event._id}/attendance`, {
      method: 'POST',
      body: { userId: answer.value },
    });
    if (!response?.results?.success) return;
    toast.success('Attendance marked');
    await refresh();
    setDetailId(null);
  };
  const columns: Column<IEvent>[] = [
    { field: 'title', title: 'Event', sortable: true },
    {
      field: 'eventType',
      title: 'Type',
      render: (row) => <span className="capitalize">{row.eventType}</span>,
    },
    { field: 'startDate', title: 'Schedule', render: (row) => formatDate(row.startDate) },
    { field: 'venue', title: 'Venue' },
    {
      field: 'registrationCount',
      title: 'Registered',
      render: (row) =>
        `${row.registrationCount ?? 0}${row.maxRegistrations ? ` / ${row.maxRegistrations}` : ''}`,
    },
    {
      field: 'status',
      title: 'Status',
      render: (row) => (
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyle[statusOf(row)]}`}
        >
          {statusOf(row)}
        </span>
      ),
    },
  ];
  const actions: Action<IEvent>[] = [
    { icon: <Eye size={15} />, tooltip: 'View details', onClick: (row) => setDetailId(row._id) },
    {
      icon: <UserPlus size={15} />,
      tooltip: 'Register',
      onClick: register,
      hidden: (row) => statusOf(row) !== 'upcoming' || isRegisteredFor(row),
    },
    {
      icon: <Send size={15} />,
      tooltip: 'Publish',
      onClick: publish,
      hidden: (row) => !canApprove || statusOf(row) !== 'draft' || idOf(row.createdBy) === userId,
    },
    {
      icon: <Pencil size={15} />,
      tooltip: 'Edit draft',
      onClick: (row) => setEditing(row),
      hidden: (row) => !canManage(row) || statusOf(row) !== 'draft',
    },
    {
      icon: <XCircle size={15} />,
      tooltip: 'Cancel event',
      onClick: cancel,
      hidden: (row) => !canManage(row) || !['upcoming', 'ongoing'].includes(statusOf(row)),
      className: 'text-rose-500',
    },
  ];
  const summary = stats?.summary ?? {
    total: 0,
    drafts: 0,
    upcoming: 0,
    ongoing: 0,
    completed: 0,
    cancelled: 0,
    registrations: 0,
    attended: 0,
    capacity: 0,
  };
  const attendanceRate = summary.registrations
    ? Math.round((summary.attended / summary.registrations) * 100)
    : 0;
  const capacityRate = summary.capacity
    ? Math.min(100, Math.round((summary.registrations / summary.capacity) * 100))
    : 0;
  const tabs: Array<{ id: TTab; label: string; count?: number }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'events', label: 'All events', count: events.length },
    {
      id: 'mine',
      label: 'My registrations',
      count: events.filter(isRegisteredFor).length,
    },
    ...(canApprove ? [{ id: 'review' as TTab, label: 'Review queue', count: summary.drafts }] : []),
  ];

  return (
    <div className="space-y-5 pb-8">
      <EngagementWorkflowBar />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
            <CalendarDays className="h-4 w-4" /> Campus engagement
          </p>
          <h1 className="mt-2 text-2xl font-black text-slate-900">Events workspace</h1>
          <p className="mt-1 text-sm text-slate-500">
            Plan, approve, discover and measure institution events from one place.
          </p>
        </div>
        {canCreate && (
          <CustomButton startIcon={<Plus className="h-4 w-4" />} onClick={() => setEditing(null)}>
            Plan event
          </CustomButton>
        )}
      </header>
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Unable to load events.{' '}
          <button className="font-bold underline" onClick={() => mutate()}>
            Retry
          </button>
        </div>
      )}
      <nav
        className="flex gap-1 overflow-x-auto border-b border-slate-200"
        aria-label="Event workspace views"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${tab === item.id ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {item.label}
            {item.count !== undefined && (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                {item.count}
              </span>
            )}
          </button>
        ))}
      </nav>
      {tab === 'overview' ? (
        <Overview
          events={events}
          stats={stats}
          statsLoading={statsLoading}
          attendanceRate={attendanceRate}
          capacityRate={capacityRate}
          onOpen={setDetailId}
        />
      ) : (
        <section>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3">
              <ListFilter className="h-4 w-4 text-slate-400" />
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="bg-transparent text-sm outline-none"
              >
                <option value="">All statuses</option>
                {Object.keys(statusStyle).map((item) => (
                  <option key={item} value={item}>
                    {item[0].toUpperCase() + item.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              <option value="">All event types</option>
              {types.map((item) => (
                <option key={item} value={item}>
                  {item[0].toUpperCase() + item.slice(1)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setCalendar((value) => !value)}
              className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              {calendar ? 'List view' : 'Calendar view'}
            </button>
            <button
              type="button"
              onClick={refresh}
              disabled={isValidating}
              aria-label="Refresh events"
              className="ml-auto flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {calendar ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-5">
              <CalendarView
                events={calendarEvents}
                onEventClick={(event) => setDetailId(event.id)}
              />
            </div>
          ) : (
            <DataViewSwitcher<IEvent>
              data={visible}
              isLoading={isLoading}
              storageKey={`event.${tab}.view`}
              searchPlaceholder="Search title, type or venue"
              searchFields={['title', 'eventType', 'venue']}
              renderCard={(event) => (
                <EventCard
                  event={event}
                  onView={() => setDetailId(event._id)}
                  onRegister={() => register(event)}
                />
              )}
              table={
                <CustomTable
                  title={
                    tab === 'review'
                      ? 'Events awaiting review'
                      : tab === 'mine'
                        ? 'My event registrations'
                        : 'Event register'
                  }
                  description={
                    tab === 'review'
                      ? 'Draft events requiring an independent publishing decision.'
                      : tab === 'mine'
                        ? 'Events you have registered to attend and their current status.'
                        : 'Event schedule, capacity, venue and publishing status.'
                  }
                  data={visible}
                  columns={columns}
                  actions={actions}
                  isLoading={isLoading}
                  options={{ pagination: true, actionsType: 'dropdown', padding: 'compact' }}
                />
              }
            />
          )}
        </section>
      )}
      <EventModal
        open={editing !== undefined}
        editing={editing}
        onClose={() => setEditing(undefined)}
        onSuccess={async () => {
          setEditing(undefined);
          await refresh();
        }}
      />
      <AnimatePresence>
        {detailId && (
          <EventDrawer
            eventId={detailId}
            canEdit={canEdit}
            onClose={() => setDetailId(null)}
            onRegister={register}
            onAttendance={markAttendance}
            processing={processing}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Overview({
  events,
  stats,
  statsLoading,
  attendanceRate,
  capacityRate,
  onOpen,
}: {
  events: IEvent[];
  stats?: IEventStats;
  statsLoading: boolean;
  attendanceRate: number;
  capacityRate: number;
  onOpen: (id: string) => void;
}) {
  const summary = stats?.summary ?? {
    total: 0,
    drafts: 0,
    upcoming: 0,
    ongoing: 0,
    completed: 0,
    cancelled: 0,
    registrations: 0,
    attended: 0,
    capacity: 0,
  };
  const cards = [
    {
      label: 'Upcoming events',
      value: summary.upcoming,
      note: `${summary.ongoing} happening now`,
      icon: CalendarDays,
      color: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Registrations',
      value: summary.registrations,
      note: `${capacityRate}% of defined capacity`,
      icon: TicketCheck,
      color: 'bg-violet-50 text-violet-700',
    },
    {
      label: 'Attendance rate',
      value: `${attendanceRate}%`,
      note: `${summary.attended} attendees recorded`,
      icon: CheckCircle2,
      color: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Awaiting review',
      value: summary.drafts,
      note: `${summary.cancelled} cancelled`,
      icon: ClipboardCheck,
      color: 'bg-amber-50 text-amber-700',
    },
  ];
  const upcoming = events.filter((event) => statusOf(event) === 'upcoming').slice(0, 4);
  const publishedRate = summary.total
    ? Math.round(((summary.total - summary.drafts) / summary.total) * 100)
    : 0;
  return (
    <div className="space-y-4">
      <section className="grid overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <motion.article
            key={card.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="border-b border-slate-100 p-4 last:border-b-0 sm:[&:nth-child(odd)]:border-r xl:border-b-0 xl:border-r xl:last:border-r-0"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">{card.label}</p>
                <p className="mt-2 text-2xl font-black text-slate-900">
                  {statsLoading ? '—' : card.value}
                </p>
              </div>
              <span className={`rounded-lg p-2.5 ${card.color}`}>
                <card.icon className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">{card.note}</p>
          </motion.article>
        ))}
      </section>
      <section className="grid items-stretch gap-4 xl:grid-cols-[1.45fr_1fr]">
        <motion.article
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-bold text-slate-900">Upcoming schedule</h2>
              <p className="mt-1 text-xs text-slate-500">
                Next published events available in your scope.
              </p>
            </div>
            <span className="text-xs font-semibold text-primary">{summary.upcoming} upcoming</span>
          </div>
          {upcoming.length ? (
            <div className="mt-4 grid flex-1 content-start gap-3 sm:grid-cols-2">
              {upcoming.map((event, index) => (
                <motion.button
                  key={event._id}
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  whileHover={{ y: -2 }}
                  onClick={() => onOpen(event._id)}
                  className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/30"
                >
                  <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <b className="text-sm">{new Date(event.startDate).getDate()}</b>
                    <small className="text-[9px] uppercase">
                      {new Date(event.startDate).toLocaleDateString('en-IN', { month: 'short' })}
                    </small>
                  </span>
                  <span className="min-w-0">
                    <b className="block truncate text-sm text-slate-800">{event.title}</b>
                    <small className="mt-1 flex items-center gap-1 truncate text-slate-500">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {event.venue}
                    </small>
                    <small className="mt-1 block text-slate-400">
                      {event.registrationCount ?? 0} registered
                    </small>
                  </span>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
              <CalendarDays className="h-5 w-5 text-slate-400" />
              No upcoming events are currently available.
            </div>
          )}
        </motion.article>
        <motion.article
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900">Participation profile</h2>
              <p className="mt-1 text-xs text-slate-500">
                Event mix and delivery health in one view.
              </p>
            </div>
            <CircleGauge className="h-5 w-5 text-violet-500" />
          </div>
          <EventMixDonut rows={stats?.byType ?? []} />
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="text-xs font-bold text-slate-700">Delivery effectiveness</p>
            <DeliveryRadar
              published={publishedRate}
              capacity={capacityRate}
              attendance={attendanceRate}
            />
          </div>
        </motion.article>
      </section>
    </div>
  );
}

function EventCard({
  event,
  onView,
  onRegister,
}: {
  event: IEvent;
  onView: () => void;
  onRegister: () => void;
}) {
  const state = statusOf(event);
  return (
    <motion.article
      whileHover={{ y: -2 }}
      className="rounded-xl border border-slate-200 bg-white p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-lg bg-blue-50 p-2.5 text-blue-600">
          <CalendarDays className="h-5 w-5" />
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ${statusStyle[state]}`}
        >
          {state}
        </span>
      </div>
      <h3 className="mt-3 line-clamp-2 text-sm font-bold text-slate-900">{event.title}</h3>
      <p className="mt-1 text-xs capitalize text-slate-500">{event.eventType}</p>
      <div className="mt-4 space-y-2 text-xs text-slate-500">
        <p className="flex gap-2">
          <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
          {formatDate(event.startDate)}
        </p>
        <p className="flex gap-2">
          <MapPin className="h-3.5 w-3.5 text-slate-400" />
          <span className="truncate">{event.venue}</span>
        </p>
        <p className="flex gap-2">
          <Users className="h-3.5 w-3.5 text-slate-400" />
          {event.registrationCount ?? 0}
          {event.maxRegistrations ? ` of ${event.maxRegistrations}` : ''} registered
        </p>
      </div>
      <div className="mt-4 flex justify-end gap-3 border-t border-slate-100 pt-3">
        <button onClick={onView} className="text-xs font-bold text-slate-600">
          View
        </button>
        {state === 'upcoming' && !isRegisteredFor(event) && (
          <button onClick={onRegister} className="text-xs font-bold text-primary">
            Register
          </button>
        )}
      </div>
    </motion.article>
  );
}

function EventDrawer({
  eventId,
  canEdit,
  onClose,
  onRegister,
  onAttendance,
  processing,
}: {
  eventId: string;
  canEdit: boolean;
  onClose: () => void;
  onRegister: (event: IEvent) => void;
  onAttendance: (event: IEvent) => void;
  processing: boolean;
}) {
  const { data, isLoading, error } = useSwr<{ data?: IEvent }>(`event/${eventId}`);
  const event = data?.data;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <motion.button
        aria-label="Close event details"
        onClick={onClose}
        className="absolute inset-0 bg-slate-200/80"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
        className="relative z-10 h-dvh w-full max-w-lg overflow-y-auto border-l border-slate-200 bg-white"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="font-bold text-slate-900">Event details</h2>
            <p className="text-xs text-slate-500">Schedule, audience and participation</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 p-2 text-slate-500"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-5 p-5">
          {isLoading && <div className="h-48 animate-pulse rounded-xl bg-slate-100" />}
          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              Unable to load event details.
            </p>
          )}
          {event && (
            <>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusStyle[statusOf(event)]}`}
                  >
                    {statusOf(event)}
                  </span>
                  <span className="text-xs capitalize text-slate-500">{event.eventType}</span>
                </div>
                <h3 className="mt-3 text-xl font-black text-slate-900">{event.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                  {event.description}
                </p>
              </div>
              {isRegisteredFor(event) && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"
                >
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-sm font-bold text-emerald-800">You are registered</p>
                    <p className="mt-0.5 text-xs text-emerald-700">
                      Your place is confirmed. Registration was recorded{' '}
                      {event.myRegistration?.registeredAt
                        ? formatDate(event.myRegistration.registeredAt)
                        : 'for this event'}
                      .
                    </p>
                  </div>
                </motion.div>
              )}
              <section className="overflow-hidden rounded-xl border border-slate-200">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Schedule and access
                  </p>
                </div>
                <div className="divide-y divide-slate-100">
                  {[
                    {
                      icon: CalendarDays,
                      label: 'Starts',
                      value: formatDate(event.startDate),
                      color: 'text-blue-600 bg-blue-50',
                    },
                    {
                      icon: CalendarDays,
                      label: 'Ends',
                      value: formatDate(event.endDate),
                      color: 'text-violet-600 bg-violet-50',
                    },
                    {
                      icon: MapPin,
                      label: 'Venue',
                      value: event.venue,
                      color: 'text-rose-600 bg-rose-50',
                    },
                    {
                      icon: Users,
                      label: 'Audience',
                      value: event.targetAudience.join(', '),
                      color: 'text-teal-600 bg-teal-50',
                    },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3 px-4 py-3">
                      <span className={`rounded-lg p-2 ${item.color}`}>
                        <item.icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          {item.label}
                        </p>
                        <p className="truncate text-sm font-semibold capitalize text-slate-700">
                          {item.value}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <section className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Organised by
                </p>
                <p className="mt-2 text-sm font-bold text-slate-800">
                  {typeof event.organizingDepartment === 'object'
                    ? (event.organizingDepartment.name ??
                      event.organizingDepartment.code ??
                      'Institution')
                    : 'Institution'}
                </p>
                {event.coordinators.length > 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    Coordinators:{' '}
                    {event.coordinators
                      .map((person) =>
                        typeof person === 'string'
                          ? 'Assigned coordinator'
                          : (person.name ?? person.email ?? 'Coordinator'),
                      )
                      .join(', ')}
                  </p>
                )}
              </section>
              {event.isCancelled && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-xs font-bold text-rose-700">Cancellation reason</p>
                  <p className="mt-1 text-sm text-rose-600">{event.cancellationReason}</p>
                </div>
              )}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-slate-700">Registrations</span>
                  <b>
                    {event.registrationCount ?? 0}
                    {event.maxRegistrations ? ` / ${event.maxRegistrations}` : ''}
                  </b>
                </div>
                {event.maxRegistrations && (
                  <svg
                    viewBox="0 0 100 4"
                    className="mt-3 h-2 w-full"
                    role="img"
                    aria-label={`${event.registrationCount ?? 0} of ${event.maxRegistrations} places filled`}
                  >
                    <rect x="0" y="0" width="100" height="4" rx="2" fill="#f1f5f9" />
                    <motion.rect
                      x="0"
                      y="0"
                      height="4"
                      rx="2"
                      fill="#0178d7"
                      initial={{ width: 0 }}
                      animate={{
                        width: Math.min(
                          100,
                          ((event.registrationCount ?? 0) / event.maxRegistrations) * 100,
                        ),
                      }}
                      transition={{ duration: 0.65, ease: 'easeOut' }}
                    />
                  </svg>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {statusOf(event) === 'upcoming' && !isRegisteredFor(event) && (
                  <CustomButton
                    onClick={() => onRegister(event)}
                    loading={processing}
                    startIcon={<UserPlus className="h-4 w-4" />}
                  >
                    Register
                  </CustomButton>
                )}
                {canEdit &&
                  (event.registrations ?? []).some((entry) => !entry.attended) &&
                  ['ongoing', 'completed'].includes(statusOf(event)) && (
                    <CustomButton
                      variant="secondary"
                      onClick={() => onAttendance(event)}
                      startIcon={<ClipboardCheck className="h-4 w-4" />}
                    >
                      Mark attendance
                    </CustomButton>
                  )}
              </div>
            </>
          )}
        </div>
      </motion.aside>
    </div>
  );
}

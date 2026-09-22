'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'nextjs-toploader/app';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import {
  GraduationCap,
  Bell,
  FileText,
  Megaphone,
  ArrowUpRight,
  ChevronRight,
  ChevronLeft,
  RotateCw,
  Trophy,
  X,
  ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import useSwr from '@/shared/hooks/useSwr';
import { useAuthStore } from '@/shared/store/authStore';
import { getTenantRolePath } from '@/shared/utils';

export type AnyRecord = Record<string, unknown>;

export interface INotice {
  _id: string;
  title: string;
  noticeType?: string;
  priority?: string;
  publishedAt?: string;
  createdAt?: string;
}

export const PIE_COLORS = ['#0178D7', '#9BB94F', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export function fmt(v: unknown) {
  if (v === undefined || v === null) return '—';
  if (typeof v === 'number') return v.toLocaleString('en-IN');
  return String(v);
}

export function fmtRupees(v: unknown) {
  const n = Number(v ?? 0);
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(0)}K`;
  return `₹${n}`;
}

export function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function fmtDateTime(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function useNowMs() {
  const [now] = useState(() => Date.now());
  return now;
}

export function daysAgo(nowMs: number, iso?: string) {
  if (!iso) return 0;
  return Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)));
}

export function useRolePath() {
  const role = useAuthStore((s) => s.role) ?? '';
  return (module: string) => getTenantRolePath(role, module);
}

export interface IStatCard {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  bg: string;
  fg: string;
  sub?: string;
  trend?: { label: string; up: boolean };
  href?: string;
}

export function StatCard({
  label,
  value,
  icon,
  bg,
  fg,
  sub,
  trend,
  href,
  index,
}: IStatCard & { index: number }) {
  const router = useRouter();
  const clickable = !!href;
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={clickable ? { y: -2 } : undefined}
      transition={{ duration: 0.32, delay: index * 0.055 }}
      onClick={clickable ? () => router.push(href!) : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                router.push(href!);
              }
            }
          : undefined
      }
      className={`group relative min-h-[116px] overflow-hidden rounded-[10px] border border-[#e7e9f3] p-3.5 transition duration-300 ${bg} ${
        clickable
          ? 'cursor-pointer hover:-translate-y-0.5 hover:brightness-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30'
          : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-white/80">
          <span className={fg}>{icon}</span>
        </div>
        {trend ? (
          <span className={`text-xs font-semibold ${trend.up ? 'text-secondary' : 'text-red-500'}`}>
            {trend.up ? '↑' : '↓'} {trend.label}
          </span>
        ) : clickable ? (
          <span className="text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-primary">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <p className="mt-2.5 text-xl font-bold leading-6 tracking-[-0.025em] text-[#111947]">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-semibold text-[#4f5679]">{label}</p>
      {sub && <p className="mt-0.5 truncate text-[10px] text-[#747b99]">{sub}</p>}
      {clickable && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100" />
      )}
    </motion.div>
  );
}

export function SkeletonCard() {
  return (
    <div className="min-h-32 animate-pulse rounded-2xl bg-white p-5">
      <div className="h-10 w-10 rounded-lg bg-slate-100" />
      <div className="mt-4 h-7 w-20 rounded bg-slate-100" />
      <div className="mt-2 h-4 w-32 rounded bg-slate-100" />
    </div>
  );
}

export function Section({
  title,
  sub,
  children,
  className = '',
  href,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  className?: string;
  href?: string;
}) {
  const router = useRouter();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`rounded-[10px] border border-[#e7e9f3] bg-white ${className}`}
    >
      <div className="flex min-h-11 items-center justify-between gap-2 border-b border-[#edf0f6] px-4 py-2">
        <div className="min-w-0">
          <p className="text-[13px] font-bold tracking-tight text-[#161d4d]">{title}</p>
          {sub && <p className="mt-0.5 text-[10px] text-[#8b91aa]">{sub}</p>}
        </div>
        {href && (
          <button
            type="button"
            onClick={() => router.push(href)}
            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-[#4d46e5] transition-colors hover:bg-violet-50"
          >
            View all <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </motion.div>
  );
}

export function Badge({ label, color = 'slate' }: { label: string; color?: string }) {
  const map: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-500',
    blue: 'bg-primary-50 text-primary',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-500',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
  };
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${map[color] ?? map.slate}`}
    >
      {label}
    </span>
  );
}

export function RowItem({
  icon,
  primary,
  secondary,
  end,
  href,
  onClick,
}: {
  icon?: React.ReactNode;
  primary: string;
  secondary?: string;
  end?: React.ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const router = useRouter();
  const interactive = !!href || !!onClick;
  const handleClick = () => {
    if (onClick) onClick();
    else if (href) router.push(href);
  };
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? handleClick : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
              }
            }
          : undefined
      }
      className={`group flex items-center gap-3 rounded-lg border border-[#edf0f6] bg-white px-3 py-2.5 ${
        interactive ? 'cursor-pointer transition-colors hover:bg-violet-50/50' : ''
      }`}
    >
      {icon && <span className="shrink-0 text-slate-300">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold text-[#242b57]">{primary}</p>
        {secondary && <p className="truncate text-[10px] text-[#7d849f]">{secondary}</p>}
      </div>
      {end && <div className="shrink-0">{end}</div>}
      {interactive && !end && (
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      )}
    </div>
  );
}

export function AttBar({
  label,
  pct,
  shortage,
}: {
  label: string;
  pct: number;
  shortage?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="truncate max-w-[60%] text-slate-600">{label}</span>
        <span
          className={`font-semibold ${shortage || pct < 75 ? 'text-red-500' : 'text-secondary'}`}
        >
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div
          className={`h-2 rounded-full transition-all ${shortage || pct < 75 ? 'bg-red-400' : 'bg-secondary'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export interface INoticeDetail extends INotice {
  description?: string;
  content?: string;
  body?: string;
  attachments?: { url?: string; name?: string; fileName?: string }[];
  targetRoles?: string[];
  publishedBy?: string;
  publishedByName?: string;
  readCount?: number;
  readBy?: unknown[];
}

export function priorityColor(p?: string) {
  if (p === 'high' || p === 'urgent') return 'red';
  if (p === 'medium') return 'amber';
  return 'blue';
}

export function NoticeDetailDrawer({
  noticeId,
  onClose,
}: {
  noticeId: string;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useSwr(`notice/${noticeId}`);
  const router = useRouter();
  const role = useAuthStore((s) => s.role) ?? '';
  const n = (data as { data?: INoticeDetail } | undefined)?.data;
  const body = n?.description ?? n?.content ?? n?.body ?? '';
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
        className="relative z-10 h-dvh w-full max-w-md overflow-y-auto bg-white p-6"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-slate-600 hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 text-xs text-primary font-semibold uppercase tracking-wide">
          <Megaphone className="h-3.5 w-3.5" /> Notice
        </div>
        {isLoading && <div className="mt-4 h-40 animate-pulse rounded-xl bg-slate-50" />}
        {error && (
          <div role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            Notice details could not be loaded. Close this panel and try again.
          </div>
        )}
        {!isLoading && n && (
          <div className="mt-3 space-y-4">
            <div>
              <p className="text-lg font-bold text-slate-900">{n.title}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {n.priority && <Badge label={n.priority} color={priorityColor(n.priority)} />}
                {n.noticeType && <Badge label={n.noticeType} color="violet" />}
                <span className="text-slate-600">{fmtDate(n.publishedAt ?? n.createdAt)}</span>
              </div>
            </div>
            {body && (
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-wrap">
                {body}
              </div>
            )}
            {Array.isArray(n.attachments) && n.attachments.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500 uppercase">Attachments</p>
                <div className="space-y-2">
                  {n.attachments.map((a, i) => (
                    <a
                      key={i}
                      href={a.url ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-700 hover:bg-primary-50"
                    >
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="truncate">
                        {a.name ?? a.fileName ?? `Attachment ${i + 1}`}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
            {Array.isArray(n.targetRoles) && n.targetRoles.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500 uppercase">Audience</p>
                <div className="flex flex-wrap gap-1.5">
                  {n.targetRoles.map((r) => (
                    <Badge key={r} label={r.replace(/_/g, ' ')} color="slate" />
                  ))}
                </div>
              </div>
            )}
            {(n.publishedByName || n.publishedBy) && (
              <p className="text-xs text-slate-600">
                Posted by {n.publishedByName ?? n.publishedBy}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                onClose();
                router.push(getTenantRolePath(role, '/notice'));
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              View all notices <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export function NoticeCenter({ notices }: { notices: INotice[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const router = useRouter();
  const role = useAuthStore((s) => s.role) ?? '';
  const items = notices.length ? notices : [];
  return (
    <>
      <div className="overflow-hidden rounded-xl bg-white px-3 py-2.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(getTenantRolePath(role, '/notice'))}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 transition-colors hover:bg-primary/90"
          >
            <Megaphone className="h-3.5 w-3.5 text-white" />
            <span className="text-xs font-bold text-white">NOTICES</span>
            {items.length > 0 && (
              <span className="ml-1 rounded-md bg-white/20 px-1.5 text-[10px] font-bold text-white">
                {items.length}
              </span>
            )}
          </button>
          <div className="relative flex-1 overflow-hidden">
            {items.length === 0 ? (
              <p className="text-sm text-slate-600">No new notices at this time.</p>
            ) : (
              <div
                className="flex whitespace-nowrap"
                style={{ animation: 'marquee 50s linear infinite' }}
              >
                <NoticeRunRow items={items} onOpen={setOpenId} />
                <NoticeRunRow items={items} onOpen={setOpenId} ariaHidden />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => router.push(getTenantRolePath(role, '/notice'))}
            className="hidden shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary-50 sm:flex"
          >
            View all <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <style>{`@keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}`}</style>
      </div>
      <AnimatePresence>
        {openId && <NoticeDetailDrawer noticeId={openId} onClose={() => setOpenId(null)} />}
      </AnimatePresence>
    </>
  );
}

export function NoticeRunRow({
  items,
  onOpen,
  ariaHidden,
}: {
  items: INotice[];
  onOpen: (id: string) => void;
  ariaHidden?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-6 pr-12" aria-hidden={ariaHidden}>
      {items.map((n) => (
        <button
          key={`${ariaHidden ? 'b' : 'a'}-${n._id}`}
          type="button"
          onClick={() => onOpen(n._id)}
          className="flex items-center gap-2 text-sm text-slate-600 transition-colors hover:text-primary"
        >
          <span className="text-amber-500">📌</span>
          <span className="truncate max-w-md">{n.title}</span>
          {n.priority === 'high' && (
            <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-500">
              High
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export interface ISchedule {
  title: string;
  startDate?: string;
  endDate?: string;
  category?: string;
}
export interface IUpcomingEvent {
  _id?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  venue?: string;
}
export interface IAttendanceBucket {
  present: number;
  absent: number;
  late: number;
  emergency: number;
  total: number;
  percentage: number;
}
export interface IAttendance {
  students?: IAttendanceBucket;
  teachers?: IAttendanceBucket;
  staff?: IAttendanceBucket;
  [key: string]: IAttendanceBucket | undefined;
}
export interface ILeaveRow {
  _id?: string;
  employeeId?: { name?: string; avatar?: string; roles?: string[] } | string;
  leaveType?: string;
  fromDate?: string;
  toDate?: string;
  createdAt?: string;
}
export interface IFeesQuarter {
  label: string;
  collected: number;
  total: number;
}
export interface ITrendPoint {
  label: string;
  value: number;
}
export interface ITopSubject {
  _id?: string;
  name?: string;
  shortName?: string;
  completion?: number;
}
export interface IStudentActivity {
  _id?: string;
  title?: string;
  eventType?: string;
  venue?: string;
  startDate?: string;
}
export interface ITodoItem {
  label: string;
  count: number;
  status: string;
  link: string;
}
export interface IPerformer {
  name?: string;
  designation?: string;
  avatar?: string;
  weeklyHours?: number;
}
export interface IStarStudent {
  name?: string;
  avatar?: string;
  semester?: string;
  rollNumber?: string;
  percentage?: number;
}

export function MiniCalendar({ events }: { events: ISchedule[] }) {
  const [view, setView] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const today = new Date();

  const isToday = (y: number, m: number, day: number) =>
    today.getFullYear() === y && today.getMonth() === m && today.getDate() === day;

  const isSelected = (y: number, m: number, day: number) =>
    selectedDate &&
    selectedDate.getFullYear() === y &&
    selectedDate.getMonth() === m &&
    selectedDate.getDate() === day;

  const eventDays = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => {
      if (!e.startDate) return;
      const d = new Date(e.startDate);
      set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    });
    return set;
  }, [events]);

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter((e) => {
      if (!e.startDate) return false;
      const d = new Date(e.startDate);
      return (
        d.getFullYear() === selectedDate.getFullYear() &&
        d.getMonth() === selectedDate.getMonth() &&
        d.getDate() === selectedDate.getDate()
      );
    });
  }, [events, selectedDate]);

  const first = new Date(view.year, view.month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const prevDays = new Date(view.year, view.month, 0).getDate();
  const cells: { day: number; current: boolean; full: Date }[] = [];

  for (let i = 0; i < startDay; i++) {
    cells.push({
      day: prevDays - startDay + i + 1,
      current: false,
      full: new Date(view.year, view.month - 1, prevDays - startDay + i + 1),
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, current: true, full: new Date(view.year, view.month, d) });
  }
  while (cells.length % 7 !== 0) {
    const next = cells.length - startDay - daysInMonth + 1;
    cells.push({ day: next, current: false, full: new Date(view.year, view.month + 1, next) });
  }

  const monthLabel = first.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const prev = () =>
    setView((v) =>
      v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 },
    );
  const next = () =>
    setView((v) =>
      v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 },
    );

  return (
    <div>
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={prev}
          className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-slate-700">{monthLabel}</p>
        <button
          type="button"
          onClick={next}
          className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs text-slate-600">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
        {cells.map((c, i) => {
          const activeToday = isToday(c.full.getFullYear(), c.full.getMonth(), c.day);
          const activeSelected = isSelected(c.full.getFullYear(), c.full.getMonth(), c.day);
          const hasEvent = eventDays.has(`${c.full.getFullYear()}-${c.full.getMonth()}-${c.day}`);
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedDate(c.full)}
              className={`relative flex h-8 w-full items-center justify-center rounded-md text-xs transition-colors ${
                activeToday
                  ? 'bg-primary font-semibold text-white'
                  : activeSelected
                    ? 'bg-primary/10 border border-primary/30 text-primary font-semibold'
                    : c.current
                      ? 'text-slate-700 hover:bg-slate-100'
                      : 'text-slate-300'
              }`}
            >
              {c.day}
              {hasEvent && !activeToday && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Date Events */}
      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600 mb-2">
          Schedule for{' '}
          {selectedDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
        {selectedDateEvents.length > 0 ? (
          <div className="space-y-2">
            {selectedDateEvents.map((e, idx) => (
              <div key={idx} className="rounded-lg bg-slate-50 border border-slate-100 p-2 text-xs">
                <p className="font-semibold text-slate-700">{e.title}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">
                  {e.category ? `${e.category}` : 'Schedule Item'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-600 italic">No events or schedules for this date.</p>
        )}
      </div>
    </div>
  );
}

export function AttendanceDonut({ bucket }: { bucket: IAttendanceBucket }) {
  const pct = bucket.percentage ?? 0;
  const data = [
    { name: 'Present', value: bucket.present },
    { name: 'Other', value: Math.max(bucket.total - bucket.present, 0) },
  ];
  return (
    <div className="relative h-44 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <PieChart>
          <Pie
            data={data}
            innerRadius={55}
            outerRadius={75}
            paddingAngle={2}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
          >
            <Cell fill="#0178D7" />
            <Cell fill="#E2E8F0" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <p className="text-sm font-bold text-slate-700">{pct.toFixed(1)}%</p>
      </div>
    </div>
  );
}

export function todoStatusBadge(status: string) {
  if (status === 'completed') return { label: 'Completed', color: 'green' };
  if (status === 'in_progress') return { label: 'Inprogress', color: 'blue' };
  return { label: 'Yet To Start', color: 'amber' };
}

export function leaveTypeColor(t?: string) {
  if (t === 'sick' || t === 'maternity') return 'red';
  if (t === 'casual') return 'amber';
  if (t === 'earned') return 'blue';
  return 'slate';
}

export interface IProfileSummary {
  name?: string;
  email?: string;
  avatar?: string;
  employeeId?: string;
  idCode?: string;
  designation?: string;
  department?: string;
  gender?: 'male' | 'female' | 'other';
}
export interface ITodayClass {
  startTime?: string;
  endTime?: string;
  label?: string;
  section?: string;
  isPast?: boolean;
}
export interface ISyllabusProgress {
  completed?: number;
  pending?: number;
}
export interface IDayAttendance {
  day?: string;
  dayLabel?: string;
  date?: number | string;
  status?: 'P' | 'A' | 'H' | 'L' | 'O' | string;
}
export interface IAttSummary {
  workingDays?: number;
  present?: number;
  absent?: number;
  halfday?: number;
  late?: number;
  donut?: IAttendanceBucket;
}
export interface IBestPerformer {
  name?: string;
  avatar?: string;
  percentage?: number;
  subject?: string;
}
export interface IStudentProgressRow {
  name?: string;
  avatar?: string;
  rollNumber?: string;
  semester?: string | number;
  percentage?: number;
  percent?: number;
  subLabel?: string;
}
export interface ILessonPlanCard {
  subjectCode?: string;
  subjectName?: string;
  unit?: string;
  progress?: number;
  percent?: number;
  section?: string;
  title?: string;
  classLabel?: string;
}
export interface IStudentMarkRow {
  rollNumber?: string;
  name?: string;
  class?: string;
  section?: string;
  marks?: string | number;
  cgpa?: string | number;
  status?: 'Pass' | 'Fail' | string;
}
export interface ILeaveStatus {
  pending?: number;
  approved?: number;
  declined?: number;
}

export function dayBoxColor(status?: string) {
  switch (status) {
    case 'P':
    case 'present':
      return 'bg-secondary-50 text-secondary';
    case 'A':
    case 'absent':
      return 'bg-red-50 text-red-500';
    case 'H':
    case 'half_day':
      return 'bg-amber-50 text-amber-600';
    case 'L':
    case 'late':
      return 'bg-violet-50 text-violet-600';
    case 'O':
      return 'bg-slate-100 text-slate-600';
    default:
      return 'bg-slate-50 text-slate-600';
  }
}

export function SyllabusDonut({
  completed = 0,
  pending = 0,
}: {
  completed?: number;
  pending?: number;
}) {
  const total = completed + pending;
  const pct = total > 0 ? (completed / total) * 100 : 0;
  const data = [
    { name: 'Completed', value: completed },
    { name: 'Pending', value: Math.max(pending, 0) },
  ];
  return (
    <div className="relative h-44 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <PieChart>
          <Pie
            data={data}
            innerRadius={55}
            outerRadius={75}
            paddingAngle={2}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
          >
            <Cell fill="#9BB94F" />
            <Cell fill="#E2E8F0" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-base font-bold text-slate-700">{pct.toFixed(0)}%</p>
        <p className="text-xs text-slate-600">Covered</p>
      </div>
    </div>
  );
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function StaffDashboardView({
  d,
  stats,
  extras,
}: {
  d: AnyRecord;
  role: string;
  roleLabel: string;
  stats: IStatCard[];
  extras?: React.ReactNode;
}) {
  const path = useRolePath();
  const schedules = (d.schedules as ISchedule[] | undefined) ?? [];
  const events = (d.upcomingEvents as IUpcomingEvent[] | undefined) ?? [];
  const notices = (d.notices as INotice[] | undefined) ?? [];
  const leaveStatus = (d.leaveStatus as ILeaveStatus | undefined) ?? {};
  const todaysClass = (d.todaysClass as ITodayClass[] | undefined) ?? [];
  const syllabus = (d.syllabusProgress as ISyllabusProgress | undefined) ?? null;
  const last7 = (d.last7DaysAttendance as IDayAttendance[] | undefined) ?? [];
  const attSummary = (d.attendanceSummary as IAttSummary | undefined) ?? null;
  const bestPerformers = (d.bestPerformers as IBestPerformer[] | undefined) ?? [];
  const studentProgress = (d.studentProgress as IStudentProgressRow[] | undefined) ?? [];
  const lessonPlans = (d.lessonPlans as ILessonPlanCard[] | undefined) ?? [];
  const studentMarks = (d.studentMarks as IStudentMarkRow[] | undefined) ?? [];

  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <>
      {stats.length > 0 && (
        <div
          className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
            stats.length >= 6
              ? 'lg:grid-cols-3 2xl:grid-cols-6'
              : stats.length === 5
                ? 'lg:grid-cols-3 2xl:grid-cols-5'
                : stats.length === 3
                  ? 'lg:grid-cols-3'
                  : 'lg:grid-cols-4'
          }`}
        >
          {stats.map((c, i) => (
            <StatCard key={c.label} {...c} index={i} />
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {extras}

          {todaysClass.length > 0 && (
            <Section title="Today's Class" sub={todayLabel} href={path('timetable')}>
              <div className="flex flex-wrap gap-2">
                {todaysClass.map((c, i) => (
                  <div
                    key={i}
                    className={`rounded-lg px-3 py-2 text-xs font-medium ${
                      c.isPast
                        ? 'bg-red-50 text-red-500 line-through'
                        : 'bg-primary-50 text-primary'
                    }`}
                  >
                    <span className="opacity-75">
                      {c.startTime ?? ''}–{c.endTime ?? ''}
                    </span>
                    <span className="mx-2">·</span>
                    <span>{c.label ?? 'Class'}</span>
                    {c.section && <span className="ml-1 opacity-75">({c.section})</span>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {attSummary && (
            <Section title="Attendance" sub="This week" href={path('faculty-attendance')}>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {(last7.length ? last7 : Array.from({ length: 7 })).map((day, i) => {
                      const item = day as IDayAttendance;
                      return (
                        <div
                          key={i}
                          className={`flex flex-col items-center gap-1 rounded-lg p-2 ${dayBoxColor(item?.status)}`}
                        >
                          <span className="text-[10px] opacity-75">
                            {item?.dayLabel ?? item?.day ?? '—'}
                          </span>
                          <span className="text-sm font-bold">
                            {typeof item?.date === 'number'
                              ? item.date
                              : item?.date
                                ? new Date(item.date).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                  })
                                : '·'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <p className="rounded-lg bg-slate-50 px-3 py-2">
                      Working Days{' '}
                      <span className="ml-1 font-bold text-slate-700">
                        {attSummary.workingDays ?? 0}
                      </span>
                    </p>
                    <p className="rounded-lg bg-secondary-50 px-3 py-2 text-secondary">
                      Present <span className="ml-1 font-bold">{attSummary.present ?? 0}</span>
                    </p>
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-red-500">
                      Absent <span className="ml-1 font-bold">{attSummary.absent ?? 0}</span>
                    </p>
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-600">
                      Half-day <span className="ml-1 font-bold">{attSummary.halfday ?? 0}</span>
                    </p>
                  </div>
                </div>
                {attSummary.donut && <AttendanceDonut bucket={attSummary.donut} />}
              </div>
            </Section>
          )}

          {bestPerformers.length > 0 && (
            <Section title="Best Performers" sub="Top scoring students">
              <div className="space-y-3">
                {bestPerformers.slice(0, 5).map((p, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-slate-100">
                      {p.avatar ? (
                        <Image
                          src={p.avatar}
                          alt={p.name ?? ''}
                          fill
                          className="object-cover"
                          sizes="36px"
                        />
                      ) : (
                        <Trophy className="h-4 w-4 text-amber-500 m-auto mt-2.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">{p.name ?? '—'}</p>
                      <AttBar label={p.subject ?? ''} pct={Number(p.percentage ?? 0)} />
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {studentProgress.length > 0 && (
            <Section
              title="Student Progress"
              sub="Recent updates"
              href={path('student-management')}
            >
              <div className="space-y-2">
                {studentProgress.slice(0, 6).map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5"
                  >
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-slate-200">
                      {s.avatar ? (
                        <Image
                          src={s.avatar}
                          alt={s.name ?? ''}
                          fill
                          className="object-cover"
                          sizes="36px"
                        />
                      ) : (
                        <GraduationCap className="h-4 w-4 text-slate-600 m-auto mt-2.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">{s.name ?? '—'}</p>
                      <p className="truncate text-xs text-slate-600">
                        {s.subLabel ?? s.rollNumber ?? ''}
                        {!s.subLabel && s.semester ? ` · Sem ${s.semester}` : ''}
                      </p>
                    </div>
                    <Badge
                      label={`${Number(s.percentage ?? s.percent ?? 0).toFixed(0)}%`}
                      color={Number(s.percentage ?? s.percent ?? 0) >= 75 ? 'green' : 'red'}
                    />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {lessonPlans.length > 0 && (
            <Section title="Lesson Plan" sub="Current units" href={path('lesson-plan')}>
              <div className="grid gap-3 md:grid-cols-2">
                {lessonPlans.slice(0, 4).map((lp, i) => (
                  <div key={i} className="rounded-xl bg-slate-50 p-4">
                    <div className="flex items-center gap-2">
                      <Badge
                        label={lp.classLabel ?? lp.section ?? lp.subjectCode ?? 'Class'}
                        color="blue"
                      />
                      <Badge label={lp.subjectCode ?? '—'} color="violet" />
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-700">
                      {lp.subjectName ?? lp.title ?? '—'}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">{lp.unit ?? ''}</p>
                    <div className="mt-3">
                      <AttBar label="Progress" pct={Number(lp.progress ?? lp.percent ?? 0)} />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        className="flex-1 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
                      >
                        <RotateCw className="mr-1 inline h-3 w-3" />
                        Reschedule
                      </button>
                      <button
                        type="button"
                        className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90"
                      >
                        <ArrowRight className="mr-1 inline h-3 w-3" />
                        Share
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {studentMarks.length > 0 && (
            <Section title="Student Marks" sub="Recent assessments" href={path('examination')}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-600">
                    <tr>
                      <th className="py-2 font-medium">ID</th>
                      <th className="py-2 font-medium">Name</th>
                      <th className="py-2 font-medium">Class</th>
                      <th className="py-2 font-medium">Section</th>
                      <th className="py-2 font-medium">Marks</th>
                      <th className="py-2 font-medium">CGPA</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentMarks.slice(0, 8).map((s, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="py-2 font-medium text-slate-700">{s.rollNumber ?? '—'}</td>
                        <td className="py-2 text-slate-600">{s.name ?? '—'}</td>
                        <td className="py-2 text-slate-500">{s.class ?? '—'}</td>
                        <td className="py-2 text-slate-500">{s.section ?? '—'}</td>
                        <td className="py-2 text-slate-700">{s.marks ?? '—'}</td>
                        <td className="py-2 text-slate-700">{s.cgpa ?? '—'}</td>
                        <td className="py-2">
                          <Badge
                            label={s.status ?? '—'}
                            color={s.status === 'Pass' ? 'green' : 'red'}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </div>

        <div className="space-y-4">
          <Section title="Schedules" sub="Calendar" href={path('academic-calendar')}>
            <MiniCalendar events={schedules} />
          </Section>

          {syllabus && (
            <Section title="Syllabus" sub="Coverage summary">
              <SyllabusDonut completed={syllabus.completed} pending={syllabus.pending} />
              <div className="mt-2 flex justify-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="h-2 w-2 rounded-full bg-secondary" /> Completed{' '}
                  {syllabus.completed ?? 0}
                </span>
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="h-2 w-2 rounded-full bg-slate-300" /> Pending{' '}
                  {syllabus.pending ?? 0}
                </span>
              </div>
            </Section>
          )}

          {events.length > 0 && (
            <Section title="Upcoming Events" href={path('event')}>
              <div className="space-y-3">
                {events.slice(0, 5).map((e, i) => (
                  <div
                    key={e._id ?? i}
                    className="relative pl-5 before:absolute before:left-1.5 before:top-1.5 before:h-2 before:w-2 before:rounded-full before:bg-primary"
                  >
                    <p className="text-sm font-medium text-slate-700">{e.title ?? '—'}</p>
                    <p className="text-xs text-slate-600">
                      {fmtDateTime(e.startDate)}
                      {e.venue ? ` · ${e.venue}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title="Leave Status" href={path('leave')}>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-amber-50 px-2 py-3">
                <p className="text-xl font-bold text-amber-600">{leaveStatus.pending ?? 0}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">Pending</p>
              </div>
              <div className="rounded-xl bg-secondary-50 px-2 py-3">
                <p className="text-xl font-bold text-secondary">{leaveStatus.approved ?? 0}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">Approved</p>
              </div>
              <div className="rounded-xl bg-red-50 px-2 py-3">
                <p className="text-xl font-bold text-red-500">{leaveStatus.declined ?? 0}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">Declined</p>
              </div>
            </div>
          </Section>

          {notices.length > 0 && (
            <Section title="Notices" href={path('notice')}>
              <div className="space-y-2">
                {notices.slice(0, 5).map((n) => (
                  <RowItem
                    key={n._id}
                    icon={<Bell className="h-4 w-4" />}
                    primary={n.title}
                    secondary={fmtDate(n.publishedAt ?? n.createdAt)}
                    href={path('notice')}
                    end={n.priority === 'high' ? <Badge label="High" color="red" /> : undefined}
                  />
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * @file CalendarView.tsx
 * @description Reusable month/week calendar with event rendering, navigation, and event popover.
 * Supports multi-category events with color coding. No external calendar library — pure React.
 * @module shared/core
 */
'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';

export interface CalendarEvent {
  id: string;
  title: string;
  date: Date; // primary date (start)
  endDate?: Date;
  category: string;
  color?: string; // Tailwind bg class e.g. 'bg-primary'
  badge?: string; // short label shown on calendar chip
  statusLabel?: string; // live countdown or delivery state
  payload?: Record<string, unknown>; // full original object
}

export type CalendarView = 'month' | 'week' | 'day';

interface Props {
  events: CalendarEvent[];
  view?: CalendarView;
  showTodayButton?: boolean;
  disablePastDates?: boolean;
  onEventClick?: (event: CalendarEvent) => void;
  onDayClick?: (date: Date) => void;
  onAddClick?: (date: Date) => void; // called when + on a day is clicked
  renderEventPopover?: (event: CalendarEvent, close: () => void) => React.ReactNode;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEK_START_HOUR = 6;
const WEEK_END_HOUR = 20;
const HALF_HOUR_SLOTS = (WEEK_END_HOUR - WEEK_START_HOUR) * 2;
const ROW_START_CLASSES = [
  'row-start-1',
  'row-start-2',
  'row-start-3',
  'row-start-4',
  'row-start-5',
  'row-start-6',
  'row-start-7',
  'row-start-8',
  'row-start-9',
  'row-start-10',
  'row-start-11',
  'row-start-12',
  'row-start-13',
  '[grid-row-start:14]',
  '[grid-row-start:15]',
  '[grid-row-start:16]',
  '[grid-row-start:17]',
  '[grid-row-start:18]',
  '[grid-row-start:19]',
  '[grid-row-start:20]',
  '[grid-row-start:21]',
  '[grid-row-start:22]',
  '[grid-row-start:23]',
  '[grid-row-start:24]',
  '[grid-row-start:25]',
  '[grid-row-start:26]',
  '[grid-row-start:27]',
  '[grid-row-start:28]',
] as const;
const ROW_SPAN_CLASSES = [
  'row-span-1',
  'row-span-2',
  'row-span-3',
  'row-span-4',
  'row-span-5',
  'row-span-6',
  'row-span-7',
  'row-span-8',
  'row-span-9',
  'row-span-10',
  'row-span-11',
  'row-span-12',
] as const;

const DEFAULT_COLORS: Record<string, string> = {
  holiday: 'bg-red-400',
  internal_exam: 'bg-orange-400',
  university_exam: 'bg-purple-500',
  cultural: 'bg-pink-400',
  sports: 'bg-cyan-400',
  technical: 'bg-blue-500',
  other: 'bg-slate-400',
  // meeting types
  faculty: 'bg-primary',
  student: 'bg-secondary',
  meeting: 'bg-primary',
  // notice
  urgent: 'bg-red-500',
  high: 'bg-orange-400',
  normal: 'bg-blue-400',
  low: 'bg-slate-300',
  notice: 'bg-amber-400',
  // timetable
  timetable: 'bg-indigo-400',
};

function getColor(event: CalendarEvent) {
  return event.color ?? DEFAULT_COLORS[event.category] ?? 'bg-slate-400';
}

function getWeekSurface(event: CalendarEvent) {
  const color = getColor(event);
  const surfaces: Record<string, string> = {
    'bg-primary': 'border-blue-500 bg-blue-50',
    'bg-secondary': 'border-violet-500 bg-violet-50',
    'bg-emerald-500': 'border-emerald-500 bg-emerald-50',
    'bg-amber-500': 'border-amber-500 bg-amber-50',
    'bg-slate-400': 'border-slate-400 bg-slate-100',
    'bg-red-400': 'border-red-500 bg-red-50',
    'bg-orange-400': 'border-orange-500 bg-orange-50',
    'bg-purple-500': 'border-purple-500 bg-purple-50',
    'bg-pink-400': 'border-pink-500 bg-pink-50',
    'bg-cyan-400': 'border-cyan-500 bg-cyan-50',
    'bg-blue-500': 'border-blue-500 bg-blue-50',
  };
  return surfaces[color] ?? 'border-slate-400 bg-slate-50';
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getWeekDays(anchor: Date): Date[] {
  const day = anchor.getDay();
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function isInRange(date: Date, event: CalendarEvent) {
  if (!event.endDate) return isSameDay(date, event.date);
  const d = date.getTime();
  const s = new Date(event.date);
  s.setHours(0, 0, 0, 0);
  const e = new Date(event.endDate);
  e.setHours(23, 59, 59, 999);
  return d >= s.getTime() && d <= e.getTime();
}

export default function CalendarView({
  events,
  view: initialView = 'month',
  showTodayButton = true,
  disablePastDates = false,
  onEventClick,
  onDayClick,
  onAddClick,
  renderEventPopover,
}: Props) {
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState<CalendarView>(initialView);
  const [todayFocusTick, setTodayFocusTick] = useState(0);
  const [anchor, setAnchor] = useState(() =>
    initialView === 'month' ? new Date(today.getFullYear(), today.getMonth(), 1) : new Date(today),
  );
  const [popover, setPopover] = useState<{ event: CalendarEvent; x: number; y: number } | null>(
    null,
  );
  const popoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (popoverCloseTimer.current) clearTimeout(popoverCloseTimer.current);
    },
    [],
  );

  // ── Navigation ─────────────────────────────────────────────────────────────
  const navigate = useCallback(
    (dir: -1 | 1) => {
      setAnchor((prev) => {
        const d = new Date(prev);
        if (view === 'month') d.setMonth(d.getMonth() + dir);
        else if (view === 'week') d.setDate(d.getDate() + 7 * dir);
        else d.setDate(d.getDate() + dir);
        return d;
      });
    },
    [view],
  );

  const goToToday = useCallback(() => {
    setAnchor(
      view === 'month' ? new Date(today.getFullYear(), today.getMonth(), 1) : new Date(today),
    );
    setTodayFocusTick((tick) => tick + 1);
  }, [today, view]);

  // ── Month grid ─────────────────────────────────────────────────────────────
  const monthCells = useMemo(() => {
    const year = anchor.getFullYear();
    const month = anchor.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthTotalDays = new Date(year, month, 0).getDate();
    const cells: Date[] = [];

    // Populate previous month trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      cells.push(new Date(year, month - 1, prevMonthTotalDays - i));
    }

    // Populate current month days
    for (let d = 1; d <= totalDays; d++) {
      cells.push(new Date(year, month, d));
    }

    // Populate next month leading days
    let nextMonthDay = 1;
    while (cells.length % 7 !== 0) {
      cells.push(new Date(year, month + 1, nextMonthDay++));
    }

    return cells;
  }, [anchor]);

  // ── Week days ──────────────────────────────────────────────────────────────
  const weekDays = useMemo(() => getWeekDays(anchor), [anchor]);

  // ── Events lookup ──────────────────────────────────────────────────────────
  const eventsForDay = useCallback(
    (date: Date) => {
      return events.filter((e) => isInRange(date, e));
    },
    [events],
  );

  const timelineDays = view === 'day' ? [anchor] : weekDays;
  const title = `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
  const isShowingToday =
    view === 'month'
      ? anchor.getFullYear() === today.getFullYear() && anchor.getMonth() === today.getMonth()
      : view === 'week'
        ? weekDays.some((date) => isSameDay(date, today))
        : isSameDay(anchor, today);

  const timeLabels = useMemo(
    () =>
      Array.from({ length: HALF_HOUR_SLOTS }, (_, index) => {
        const minutes = index * 30;
        const hour = WEEK_START_HOUR + Math.floor(minutes / 60);
        return index % 2 === 0
          ? new Date(2020, 0, 1, hour).toLocaleTimeString('en-IN', {
              hour: 'numeric',
              minute: '2-digit',
            })
          : '';
      }),
    [],
  );

  // ── Event click ────────────────────────────────────────────────────────────
  const handleEventClick = (e: React.MouseEvent, event: CalendarEvent) => {
    e.stopPropagation();
    setPopover(null);
    onEventClick?.(event);
  };

  const handleEventHover = (e: React.MouseEvent, event: CalendarEvent) => {
    if (!renderEventPopover) return;
    if (popoverCloseTimer.current) clearTimeout(popoverCloseTimer.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopover({ event, x: rect.left, y: rect.bottom + 8 });
  };

  const keepPopoverOpen = () => {
    if (popoverCloseTimer.current) clearTimeout(popoverCloseTimer.current);
  };

  const closePopoverAfterHover = () => {
    if (popoverCloseTimer.current) clearTimeout(popoverCloseTimer.current);
    popoverCloseTimer.current = setTimeout(() => setPopover(null), 140);
  };

  // ── Day cell ───────────────────────────────────────────────────────────────
  const DayCell = ({ date, mini }: { date: Date; mini?: boolean }) => {
    const dayEvents = eventsForDay(date);
    const isToday = isSameDay(date, today);
    const isCurrentMonth = date.getMonth() === anchor.getMonth();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const isPast = date.getTime() < startOfToday.getTime();
    const canSelectDay = Boolean(onDayClick && !(disablePastDates && isPast));
    const MAX_SHOW = mini ? 2 : 3;
    const extra = dayEvents.length - MAX_SHOW;
    return (
      <motion.div
        onClick={() => canSelectDay && onDayClick?.(date)}
        onKeyDown={(event) => {
          if (!canSelectDay || (event.key !== 'Enter' && event.key !== ' ')) return;
          event.preventDefault();
          onDayClick?.(date);
        }}
        role={canSelectDay ? 'button' : undefined}
        tabIndex={canSelectDay ? 0 : undefined}
        aria-disabled={disablePastDates && isPast}
        whileHover={canSelectDay ? { y: -1 } : undefined}
        transition={{ duration: 0.15 }}
        className={`relative flex min-h-22.5 flex-col gap-0.5 rounded-xl p-1.5 transition-colors ${canSelectDay ? 'cursor-pointer hover:bg-blue-50/40 focus-visible:outline-2 focus-visible:outline-primary' : ''} ${!isCurrentMonth ? 'opacity-40' : ''} ${disablePastDates && isPast ? 'bg-slate-50/70 text-slate-400' : ''}`}
      >
        <div
          className={`mb-0.5 flex h-6 w-6 items-center justify-center self-start rounded-full text-xs font-semibold transition-colors ${isToday ? 'bg-primary text-white' : 'text-slate-700'}`}
        >
          {date.getDate()}
        </div>
        {dayEvents.slice(0, MAX_SHOW).map((ev) => (
          <button
            key={ev.id}
            type="button"
            onClick={(e) => handleEventClick(e, ev)}
            onMouseEnter={(e) => handleEventHover(e, ev)}
            onMouseLeave={closePopoverAfterHover}
            className={`w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium text-white ${getColor(ev)} transition-opacity hover:opacity-90 ${disablePastDates && ev.date < today ? 'opacity-60' : ''}`}
          >
            {ev.badge ?? ev.title}
          </button>
        ))}
        {extra > 0 && <span className="pl-1 text-[10px] text-slate-600">+{extra} more</span>}
        {onAddClick && !(disablePastDates && isPast) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddClick(date);
            }}
            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-slate-300 opacity-0 transition-opacity hover:bg-primary hover:text-white group-hover:opacity-100 hover:opacity-100"
            title="Add event"
          >
            +
          </button>
        )}
      </motion.div>
    );
  };

  return (
    <div className="relative flex flex-col gap-0">
      {/* Toolbar */}
      <div className="grid gap-3 rounded-t-2xl bg-white px-4 py-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:px-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-primary">
            <Calendar className="h-4.5 w-4.5" />
          </span>
          <h3 className="text-lg font-bold tracking-tight text-slate-900">{title}</h3>
        </div>
        <div className="order-3 flex w-fit rounded-xl bg-slate-100 p-1 sm:order-none">
          {(['month', 'week', 'day'] as const).map((calendarView) => (
            <button
              key={calendarView}
              type="button"
              onClick={() => setView(calendarView)}
              className={`min-w-16 rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                view === calendarView
                  ? 'border border-slate-200 bg-white text-slate-900'
                  : 'border border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {calendarView}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-primary"
            aria-label="Previous period"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {showTodayButton && (
            <button
              type="button"
              onClick={goToToday}
              aria-pressed={isShowingToday}
              className={`h-9 rounded-xl border px-4 text-xs font-semibold transition-colors ${
                isShowingToday
                  ? 'border-blue-200 bg-blue-50 text-primary'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Today
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate(1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-primary"
            aria-label="Next period"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Month weekday headers */}
      {view === 'month' && (
        <div className="grid grid-cols-7 border-b border-t border-slate-200 bg-slate-50">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="border-r border-slate-200 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600 last:border-r-0"
            >
              {d}
            </div>
          ))}
        </div>
      )}

      {/* Month grid */}
      {view === 'month' && (
        <motion.div
          key={`month-${anchor.getFullYear()}-${anchor.getMonth()}`}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-7 overflow-hidden rounded-b-2xl bg-white"
        >
          {monthCells.map((date, i) => (
            <div
              key={i}
              className={`group border-slate-200 ${i % 7 !== 6 ? 'border-r' : ''} ${i < monthCells.length - 7 ? 'border-b' : ''}`}
            >
              <DayCell date={date} />
            </div>
          ))}
        </motion.div>
      )}

      {/* Week / day timeline */}
      {(view === 'week' || view === 'day') && (
        <motion.div
          key={`${view}-${timelineDays[0].toISOString()}`}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-x-auto rounded-b-2xl border-t border-slate-200 bg-white"
        >
          <div className={view === 'week' ? 'min-w-245' : 'min-w-120'}>
            <div
              className={`${view === 'week' ? 'grid-cols-[72px_repeat(7,minmax(120px,1fr))]' : 'grid-cols-[72px_minmax(320px,1fr)]'} grid gap-2 border-b border-slate-200 bg-slate-50/60 p-2`}
            >
              <div className="border-r border-slate-200" />
              {timelineDays.map((date) => {
                const selected = isSameDay(date, today);
                const dateIsPast =
                  date.getTime() <
                  new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    onClick={() => !(disablePastDates && dateIsPast) && onDayClick?.(date)}
                    disabled={disablePastDates && dateIsPast}
                    className={`rounded-xl border px-2 py-2.5 text-center transition-colors last:border-r-0 enabled:hover:border-blue-200 enabled:hover:bg-blue-50/50 disabled:text-slate-400 ${selected ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'} ${disablePastDates && dateIsPast ? 'bg-slate-50/70' : ''}`}
                  >
                    <span className="block text-[10px] font-semibold text-slate-500">
                      {WEEKDAYS[date.getDay()]}
                    </span>
                    <motion.span
                      key={selected ? `today-${todayFocusTick}` : date.toISOString()}
                      initial={selected ? { scale: 0.82 } : false}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 18 }}
                      className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-base font-bold ${selected ? 'bg-primary text-white' : 'text-slate-800'}`}
                    >
                      {date.getDate()}
                    </motion.span>
                  </button>
                );
              })}
            </div>
            <div
              className={`${view === 'week' ? 'grid-cols-[72px_repeat(7,minmax(120px,1fr))]' : 'grid-cols-[72px_minmax(320px,1fr)]'} grid`}
            >
              <div className="grid grid-rows-[repeat(28,2rem)] border-r border-slate-200">
                {timeLabels.map((label, index) => (
                  <div
                    key={index}
                    className="border-b border-slate-200 pr-2 pt-1 text-right text-[9px] text-slate-500"
                  >
                    {label}
                  </div>
                ))}
              </div>
              {timelineDays.map((date) => (
                <div
                  key={date.toISOString()}
                  className="relative grid grid-rows-[repeat(28,2rem)] border-r border-slate-200 last:border-r-0"
                >
                  {Array.from({ length: HALF_HOUR_SLOTS }, (_, index) =>
                    (() => {
                      const slotDate = new Date(date);
                      slotDate.setHours(
                        WEEK_START_HOUR + Math.floor(index / 2),
                        index % 2 ? 30 : 0,
                        0,
                        0,
                      );
                      const slotIsPast = slotDate.getTime() < today.getTime();
                      return (
                        <button
                          key={`slot-${index}`}
                          type="button"
                          onClick={() => onAddClick?.(slotDate)}
                          disabled={!onAddClick || (disablePastDates && slotIsPast)}
                          className="border-b border-slate-200 text-left transition-colors enabled:hover:bg-blue-50/60 disabled:bg-slate-50/60"
                          aria-label={`Add at ${timeLabels[index] || 'half past'} on ${date.toLocaleDateString('en-IN')}`}
                        />
                      );
                    })(),
                  )}
                  {eventsForDay(date).map((event) => {
                    const start = event.date;
                    const rawSlot =
                      (start.getHours() - WEEK_START_HOUR) * 2 + (start.getMinutes() >= 30 ? 1 : 0);
                    const slot = Math.max(0, Math.min(HALF_HOUR_SLOTS - 1, rawSlot));
                    const durationMinutes =
                      Math.max(
                        30,
                        (event.endDate?.getTime() ?? start.getTime() + 3600000) - start.getTime(),
                      ) / 60000;
                    const span = Math.max(1, Math.min(12, Math.ceil(durationMinutes / 30)));
                    return (
                      <motion.button
                        key={event.id}
                        type="button"
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={(clickEvent) => handleEventClick(clickEvent, event)}
                        onMouseEnter={(hoverEvent) => handleEventHover(hoverEvent, event)}
                        onMouseLeave={closePopoverAfterHover}
                        className={`z-10 m-0.5 overflow-hidden rounded-md border-l-4 px-2 py-1 text-left text-[10px] leading-tight text-slate-800 transition-opacity hover:opacity-90 ${getWeekSurface(event)} ${ROW_START_CLASSES[slot]} ${ROW_SPAN_CLASSES[span - 1]} ${disablePastDates && event.date < today ? 'opacity-65' : ''}`}
                      >
                        <b className="block truncate">{event.title}</b>
                        <span className="mt-0.5 block truncate text-[9px] text-slate-600">
                          {start.toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {event.endDate
                            ? ` – ${event.endDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                            : ''}
                        </span>
                        {event.statusLabel && (
                          <span className="mt-1 block truncate text-[9px] font-bold text-slate-700">
                            {event.statusLabel}
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Popover */}
      <AnimatePresence>
        {popover && renderEventPopover && (
          <motion.div
            onMouseEnter={keepPopoverOpen}
            onMouseLeave={closePopoverAfterHover}
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              left: Math.min(popover.x, window.innerWidth - 300),
              top: Math.min(popover.y, window.innerHeight - 260),
              zIndex: 20,
            }}
            className="w-72 rounded-2xl bg-white p-4  ring-1 ring-slate-200"
          >
            <button
              type="button"
              onClick={() => setPopover(null)}
              className="absolute right-3 top-3 rounded-lg p-1 text-slate-600 hover:bg-slate-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            {renderEventPopover(popover.event, () => setPopover(null))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

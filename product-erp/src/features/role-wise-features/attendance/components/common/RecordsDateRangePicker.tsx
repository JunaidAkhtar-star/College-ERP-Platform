/**
 * @file RecordsDateRangePicker.tsx
 * @description Date range picker with quick presets for attendance records and registers.
 * @module features/attendance
 */

'use client';

import React, { useState } from 'react';
import Popover from '@mui/material/Popover';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { addMonths, endOfWeek, format, startOfMonth, startOfWeek, subDays } from 'date-fns';
import { toast } from 'react-toastify';
import { CalendarCheck2 } from 'lucide-react';
import { localDateKey } from '../../utils/attendance.helpers';

export function RecordsDateRangePicker({
  start,
  end,
  onChange,
  label = 'Records date range',
  singleDate = false,
  compact = false,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  label?: string;
  singleDate?: boolean;
  compact?: boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const committedRange: [Date, Date] = [new Date(`${start}T00:00:00`), new Date(`${end}T00:00:00`)];
  const [draft, setDraft] = useState<[Date | null, Date | null]>(committedRange);
  const [leftMonth, setLeftMonth] = useState(() => startOfMonth(committedRange[0]));

  const apply = (first: Date, second: Date) => {
    const orderedStart = first <= second ? first : second;
    const orderedEnd = first <= second ? second : first;
    const days = Math.round((orderedEnd.getTime() - orderedStart.getTime()) / 86_400_000) + 1;
    if (days > 31) {
      toast.info('Choose a date range of up to 31 days');
      return;
    }
    setDraft([orderedStart, orderedEnd]);
    onChange(localDateKey(orderedStart), localDateKey(orderedEnd));
    setAnchor(null);
  };

  const selectDay = (day: Date) => {
    if (singleDate) {
      apply(day, day);
      return;
    }
    if (!draft[0] || draft[1]) {
      setDraft([day, null]);
      return;
    }
    apply(draft[0], day);
  };

  const dayProps = (day: Date) => {
    const dayKey = localDateKey(day);
    const startKey = draft[0] ? localDateKey(draft[0]) : null;
    const endKey = draft[1] ? localDateKey(draft[1]) : null;
    const isStart = dayKey === startKey;
    const isEnd = dayKey === endKey;
    const inRange = Boolean(startKey && endKey && dayKey >= startKey && dayKey <= endKey);
    const single = Boolean(startKey && endKey && startKey === endKey);
    return {
      selected: isStart || isEnd,
      sx: {
        borderRadius: single
          ? '50%'
          : isStart
            ? '50% 0 0 50%'
            : isEnd
              ? '0 50% 50% 0'
              : inRange
                ? 0
                : '50%',
        backgroundColor: inRange ? '#0878da !important' : undefined,
        color: inRange ? '#fff !important' : undefined,
        fontWeight: inRange ? 700 : undefined,
        '&:hover': { backgroundColor: inRange ? '#0668bd !important' : undefined },
        '&.Mui-selected': { backgroundColor: '#0878da !important', color: '#fff !important' },
        '&.Mui-focusVisible': { outline: '2px solid #fff', outlineOffset: '-3px' },
      },
    };
  };

  const presets = [
    {
      label: 'This Week',
      value: () =>
        [
          startOfWeek(new Date(), { weekStartsOn: 1 }),
          endOfWeek(new Date(), { weekStartsOn: 1 }),
        ] as const,
    },
    { label: 'Today', value: () => [new Date(), new Date()] as const },
    { label: 'Last 7 Days', value: () => [subDays(new Date(), 6), new Date()] as const },
    { label: 'Last 14 Days', value: () => [subDays(new Date(), 13), new Date()] as const },
    { label: 'Last 30 Days', value: () => [subDays(new Date(), 29), new Date()] as const },
    {
      label: 'This Month',
      value: () => [startOfMonth(new Date()), new Date()] as const,
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          setDraft(committedRange);
          setLeftMonth(startOfMonth(committedRange[0]));
          setAnchor(event.currentTarget);
        }}
        className={`flex w-full min-w-0 items-center justify-between border border-slate-200 bg-white text-left transition-colors hover:border-blue-300 hover:bg-blue-50/20 sm:w-auto ${compact ? 'gap-3 rounded-lg px-3 py-2 sm:min-w-56' : 'gap-4 rounded-2xl px-4 py-3 sm:min-w-64'}`}
        aria-label={`Select ${label.toLowerCase()}`}
      >
        <span>
          <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
            {label}
          </span>
          <span
            className={`${compact ? 'mt-0.5 text-[11px]' : 'mt-1 text-sm'} block font-bold text-slate-800`}
          >
            {singleDate
              ? format(committedRange[0], 'EEE, MMM d, yyyy')
              : `${format(committedRange[0], 'MMM d')} – ${format(committedRange[1], 'MMM d, yyyy')}`}
          </span>
        </span>
        <CalendarCheck2 className="h-5 w-5 text-primary" />
      </button>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            elevation: 0,
            sx: {
              mt: 1,
              border: '1px solid #e2e8f0',
              borderRadius: 3,
              boxShadow: 'none',
              maxWidth: 'calc(100vw - 24px)',
            },
          },
        }}
      >
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <div className="max-w-full overflow-x-auto bg-white p-5">
            <div className="mb-3 pl-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
                Select {label.toLowerCase()}
              </p>
              <p className="mt-1 text-xl font-medium text-slate-800">
                {singleDate
                  ? format(draft[0] ?? committedRange[0], 'EEEE, MMM d, yyyy')
                  : `${format(draft[0] ?? committedRange[0], 'MMM d')} – ${format(draft[1] ?? committedRange[1], 'MMM d')}`}
              </p>
            </div>
            <div className="flex min-w-max items-start gap-4">
              <div className="flex w-32 flex-col gap-2 pt-3">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      const [from, to] = preset.value();
                      apply(from, to);
                    }}
                    className="rounded-full bg-slate-100 px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="flex">
                <DateCalendar
                  value={null}
                  disableFuture={singleDate}
                  referenceDate={leftMonth}
                  onMonthChange={(month) => setLeftMonth(startOfMonth(month))}
                  onChange={(day) => day && selectDay(day)}
                  slotProps={{ day: (ownerState) => dayProps(ownerState.day) }}
                  sx={{ '& .MuiPickersCalendarHeader-label': { fontWeight: 600 } }}
                />
                {!singleDate && (
                  <DateCalendar
                    value={null}
                    referenceDate={addMonths(leftMonth, 1)}
                    onMonthChange={(month) => setLeftMonth(startOfMonth(addMonths(month, -1)))}
                    onChange={(day) => day && selectDay(day)}
                    slotProps={{ day: (ownerState) => dayProps(ownerState.day) }}
                    sx={{ '& .MuiPickersCalendarHeader-label': { fontWeight: 600 } }}
                  />
                )}
              </div>
            </div>
          </div>
        </LocalizationProvider>
      </Popover>
    </>
  );
}

export default RecordsDateRangePicker;

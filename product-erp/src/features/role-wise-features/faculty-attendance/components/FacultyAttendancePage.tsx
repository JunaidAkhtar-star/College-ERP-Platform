/**
 * @file FacultyAttendancePage.tsx
 * @description Faculty attendance records + mark attendance + monthly/department summary.
 * @module features/role-wise-features/faculty-attendance
 */
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import { toast } from 'react-toastify';
import {
  UserCheck,
  UserX,
  Clock,
  Calendar,
  TrendingDown,
  PieChart,
  BarChart3,
  Save,
  ChevronLeft,
  ChevronRight,
  CalendarPlus,
  X,
  ChevronDown,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import FacultyHrWorkflowBar from '@/shared/components/FacultyHrWorkflowBar';
import CustomButton from '@/shared/core/CustomButton';
import AsyncSelect from '@/shared/core/AsyncSelect';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { useAuthStore } from '@/shared/store/authStore';
import RecordsDateRangePicker from '../../attendance/components/common/RecordsDateRangePicker';

import { IFacultyAttendance, TFacultyAttendanceStatus } from '../types/faculty-attendance.types';

interface IMonthlyBucket {
  _id: TFacultyAttendanceStatus;
  count: number;
}

interface IDeptSummaryRow {
  _id: string;
  total: number;
  present: number;
  absent: number;
  onLeave: number;
  attendancePercent: number;
  faculty?: { name?: string; email?: string; employeeId?: string };
}

interface IFacultyAttendanceListResponse {
  success?: boolean;
  data?: IFacultyAttendance[];
  total?: number;
  page?: number;
  limit?: number;
  pages?: number;
}

const STATUS_CFG: Record<
  TFacultyAttendanceStatus,
  { label: string; bg: string; text: string; dot: string; color: string }
> = {
  present: {
    label: 'Present',
    bg: 'bg-green-50',
    text: 'text-green-600',
    dot: 'bg-green-400',
    color: '#22c55e',
  },
  absent: {
    label: 'Absent',
    bg: 'bg-red-50',
    text: 'text-red-500',
    dot: 'bg-red-400',
    color: '#ef4444',
  },
  late: {
    label: 'Late',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    dot: 'bg-blue-400',
    color: '#3b82f6',
  },
  half_day: {
    label: 'Half Day',
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    dot: 'bg-amber-400',
    color: '#f59e0b',
  },
  on_leave: {
    label: 'On Approved Leave',
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    dot: 'bg-slate-400',
    color: '#64748b',
  },
};

interface IFacultyRosterOption {
  value: string;
  label: string;
  sub?: string;
}

interface IFacultyRosterEntry {
  facultyId: string;
  facultyName: string;
  facultyMeta?: string;
  status: TFacultyAttendanceStatus;
  checkInTime: string;
  checkOutTime: string;
  remarks: string;
  saved: boolean;
}

const ATTENDANCE_CHOICES: TFacultyAttendanceStatus[] = [
  'present',
  'absent',
  'late',
  'half_day',
  'on_leave',
];
const ATTENDANCE_PAGE_SIZE = 100;

function FacultyDailyRoster({
  date,
  departmentId,
  onDateChange,
  onSaved,
}: {
  date: string;
  departmentId?: string;
  onDateChange: (date: string) => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading: isSaving } = useMutation();
  const facultyParams = new URLSearchParams({ type: 'faculty', limit: '100' });
  if (departmentId) facultyParams.set('departmentId', departmentId);
  const dayParams = new URLSearchParams({ startDate: date, endDate: date, limit: '100' });
  if (departmentId) dayParams.set('departmentId', departmentId);

  const { data: facultyRaw, isLoading: facultyLoading } = useSwr<{
    data?: IFacultyRosterOption[];
  }>(`search/options?${facultyParams.toString()}`);
  const {
    data: dayRaw,
    isLoading: dayLoading,
    mutate: refreshDay,
  } = useSwr<IFacultyAttendanceListResponse>(`faculty-attendance?${dayParams.toString()}`);
  const faculty = useMemo(() => facultyRaw?.data ?? [], [facultyRaw]);
  const savedRecords = useMemo(() => dayRaw?.data ?? [], [dayRaw]);
  const [entries, setEntries] = useState<IFacultyRosterEntry[]>([]);
  const [search, setSearch] = useState('');
  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) =>
      `${entry.facultyName} ${entry.facultyMeta ?? ''}`.toLowerCase().includes(query),
    );
  }, [entries, search]);
  const hasSavedAttendance = entries.some((entry) => entry.saved);

  useEffect(() => {
    if (!faculty.length) return;
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes(),
    ).padStart(2, '0')}`;
    const savedByFaculty = new Map(
      savedRecords.map((record) => [
        typeof record.facultyId === 'string' ? record.facultyId : record.facultyId._id,
        record,
      ]),
    );
    // The roster is rebuilt only when its API-backed faculty/date inputs change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(
      faculty.map((member) => {
        const saved = savedByFaculty.get(member.value);
        return {
          facultyId: member.value,
          facultyName: member.label,
          facultyMeta: member.sub,
          status: saved?.status ?? 'present',
          checkInTime: saved?.checkInTime ?? currentTime,
          checkOutTime: saved?.checkOutTime ?? '',
          remarks: saved?.remarks ?? '',
          saved: Boolean(saved),
        };
      }),
    );
  }, [faculty, savedRecords]);

  const updateEntry = (facultyId: string, patch: Partial<IFacultyRosterEntry>) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.facultyId === facultyId ? { ...entry, ...patch, saved: false } : entry,
      ),
    );
  };

  const markAll = (status: TFacultyAttendanceStatus) => {
    setEntries((current) =>
      current.map((entry) => ({
        ...entry,
        status,
        checkInTime: ['absent', 'on_leave'].includes(status) ? '' : entry.checkInTime,
        checkOutTime: ['absent', 'on_leave'].includes(status) ? '' : entry.checkOutTime,
        saved: false,
      })),
    );
  };

  const saveRoster = async () => {
    const results = await Promise.all(
      entries.map((entry) => {
        const attended = ['present', 'late', 'half_day'].includes(entry.status);
        return mutation('faculty-attendance/mark', {
          method: 'POST',
          silentError: true,
          returnError: true,
          dedupe: false,
          body: {
            facultyId: entry.facultyId,
            date,
            status: entry.status,
            ...(attended && entry.checkInTime ? { checkInTime: entry.checkInTime } : {}),
            ...(attended && entry.checkOutTime ? { checkOutTime: entry.checkOutTime } : {}),
            ...(entry.remarks.trim() ? { remarks: entry.remarks.trim() } : {}),
          },
        });
      }),
    );
    const failed = results.filter(
      (result) => !(result as { results?: { success?: boolean } } | undefined)?.results?.success,
    ).length;
    if (failed) {
      toast.error(
        `${failed} faculty attendance ${failed === 1 ? 'entry' : 'entries'} could not be saved.`,
      );
      return;
    }
    toast.success(`Attendance saved for ${entries.length} faculty members.`);
    await refreshDay();
    onSaved();
  };

  const loading = facultyLoading || dayLoading;
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
            Daily faculty roster
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            Record attendance for{' '}
            {new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Review one compact roster, set each status and save the complete attendance register.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <RecordsDateRangePicker
            start={date}
            end={date}
            label="Attendance date"
            singleDate
            onChange={(selected) => onDateChange(selected)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Mark all:</span>
            {(['present', 'absent', 'late'] as TFacultyAttendanceStatus[]).map((status) => {
              const config = STATUS_CFG[status];
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => markAll(status)}
                  className={`cursor-pointer rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold transition-colors hover:border-primary/30 ${config.bg} ${config.text}`}
                >
                  {config.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="mt-5 space-y-2">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : entries.length ? (
        <>
          <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Department faculty roster</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {filteredEntries.length} of {entries.length} faculty shown
                </p>
              </div>
              <div className="relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search faculty name or employee ID"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-xs text-slate-700 outline-none focus:border-primary focus:bg-white"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 text-[10px] text-slate-500">
              <span className="font-bold uppercase tracking-wider text-slate-600">
                Status guide
              </span>
              {ATTENDANCE_CHOICES.map((status) => (
                <span key={status} className="flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${STATUS_CFG[status].dot}`} />
                  {status === 'on_leave' ? 'Approved leave' : STATUS_CFG[status].label}
                </span>
              ))}
            </div>
            {filteredEntries.length ? (
              <ul className="divide-y divide-slate-100">
                {filteredEntries.map((entry, index) => (
                  <motion.li
                    key={entry.facultyId}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.015 }}
                    className="grid gap-3 px-3 py-2.5 sm:px-4 lg:grid-cols-[minmax(190px,0.55fr)_minmax(0,1.8fr)] lg:items-start"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-5 text-right text-xs font-semibold text-slate-300">
                        {index + 1}
                      </span>
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-sm font-bold text-primary">
                        {entry.facultyName.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800">
                          {entry.facultyName}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          {entry.facultyMeta || 'Teaching faculty'}
                        </p>
                      </div>
                    </div>
                    <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(290px,1fr)_8.5rem_8.5rem] xl:items-end">
                      <div className="grid grid-cols-3 gap-1 sm:col-span-2 sm:grid-cols-5 xl:col-span-1">
                        {ATTENDANCE_CHOICES.map((status) => {
                          const config = STATUS_CFG[status];
                          const active = entry.status === status;
                          return (
                            <button
                              key={status}
                              type="button"
                              title={config.label}
                              aria-pressed={active}
                              onClick={() =>
                                updateEntry(entry.facultyId, {
                                  status,
                                  ...(['absent', 'on_leave'].includes(status)
                                    ? { checkInTime: '', checkOutTime: '' }
                                    : {}),
                                })
                              }
                              className={`min-h-8 cursor-pointer rounded-lg border px-1.5 text-[9px] font-bold transition-colors sm:text-[10px] ${active
                                  ? `${config.bg} ${config.text} border-current`
                                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                                }`}
                            >
                              {status === 'on_leave' ? 'Leave' : config.label}
                            </button>
                          );
                        })}
                      </div>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Check in
                        <input
                          type="time"
                          disabled={['absent', 'on_leave'].includes(entry.status)}
                          value={entry.checkInTime}
                          onChange={(event) =>
                            updateEntry(entry.facultyId, { checkInTime: event.target.value })
                          }
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700 outline-none disabled:opacity-45 focus:border-primary"
                        />
                      </label>
                      <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Check out
                        <input
                          type="time"
                          disabled={['absent', 'on_leave'].includes(entry.status)}
                          value={entry.checkOutTime}
                          onChange={(event) =>
                            updateEntry(entry.facultyId, { checkOutTime: event.target.value })
                          }
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700 outline-none disabled:opacity-45 focus:border-primary"
                        />
                      </label>
                      <label className="min-w-0 text-[9px] font-bold uppercase tracking-wider text-slate-400 sm:col-span-2 xl:col-span-3">
                        Remarks
                        <input
                          value={entry.remarks}
                          onChange={(event) =>
                            updateEntry(entry.facultyId, { remarks: event.target.value })
                          }
                          placeholder="Optional attendance note"
                          className="mt-1 h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-normal normal-case tracking-normal text-slate-700 outline-none focus:border-primary"
                        />
                      </label>
                    </div>
                  </motion.li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                No faculty match “{search}”.
              </p>
            )}
          </section>
          <div className="sticky bottom-3 z-10 mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <p className="text-xs text-slate-500">
              <strong className="text-slate-800">{entries.length} faculty</strong> ·{' '}
              <span className="font-semibold text-emerald-600">
                {entries.filter((entry) => entry.status === 'present').length} present
              </span>{' '}
              ·{' '}
              <span className="font-semibold text-rose-600">
                {entries.filter((entry) => entry.status === 'absent').length} absent
              </span>
            </p>
            <CustomButton
              variant="primary"
              startIcon={<Save className="h-4 w-4" />}
              loading={isSaving}
              onClick={saveRoster}
            >
              {hasSavedAttendance ? 'Update faculty attendance' : 'Submit faculty attendance'}
            </CustomButton>
          </div>
        </>
      ) : (
        <div className="mt-5 grid items-center gap-4 rounded-2xl bg-sky-50/60 px-5 py-6 sm:grid-cols-[minmax(0,1fr)_15rem]">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              No active faculty in this department
            </p>
            <p className="mt-1 max-w-lg text-xs leading-5 text-slate-500">
              Check faculty employment and department assignments. Eligible faculty will appear here
              automatically.
            </p>
          </div>
          <Image
            src="/images/faculty-attendance/faculty-attendance-roster.png"
            alt="Faculty team managing the daily attendance roster"
            width={1402}
            height={1122}
            className="mx-auto h-32 w-auto object-contain"
          />
        </div>
      )}
    </section>
  );
}

function MonthlyStatsCard({ buckets, total }: { buckets: IMonthlyBucket[]; total: number }) {
  const statuses: TFacultyAttendanceStatus[] = [
    'present',
    'late',
    'half_day',
    'on_leave',
    'absent',
  ];
  const composition = statuses.map((status) => ({
    status,
    count: buckets.find((bucket) => bucket._id === status)?.count ?? 0,
  }));
  let ribbonCursor = 12;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4"
    >
      <div className="flex items-center gap-2">
        <PieChart className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Status composition
        </span>
      </div>
      {total === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-6 text-slate-300">
          <PieChart className="h-8 w-8 mb-1" />
          <p className="text-[10px]">No attendance logged</p>
        </div>
      ) : (
        <div className="mt-3 flex flex-1 flex-col">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-black tracking-tight text-slate-900">{total}</p>
              <p className="text-[11px] text-slate-500">attendance entries in this period</p>
            </div>
            <p className="text-right text-[10px] leading-4 text-slate-400">
              Hover each color
              <br />
              for its exact share
            </p>
          </div>
          <svg
            viewBox="0 0 344 48"
            role="img"
            aria-label="Faculty attendance status composition"
            className="mt-3 w-full"
          >
            <rect x="12" y="10" width="320" height="24" rx="12" fill="#f1f5f9" />
            {composition.map(({ status, count }) => {
              const width = total ? (count / total) * 320 : 0;
              const x = ribbonCursor;
              ribbonCursor += width;
              return (
                <motion.rect
                  key={status}
                  x={x}
                  y="10"
                  width={width}
                  height="24"
                  rx={width === 320 ? 12 : 5}
                  fill={STATUS_CFG[status].color}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.45 }}
                >
                  <title>{`${STATUS_CFG[status].label}: ${count} (${Math.round((count / total) * 100)}%)`}</title>
                </motion.rect>
              );
            })}
          </svg>
          <div className="mt-auto grid grid-cols-3 gap-1.5 pt-2 sm:grid-cols-5">
            {composition.map(({ status, count }) => (
              <div
                key={status}
                className={`${STATUS_CFG[status].bg} rounded-xl px-2 py-2 text-center`}
              >
                <p className={`text-sm font-black ${STATUS_CFG[status].text}`}>{count}</p>
                <p className="truncate text-[9px] text-slate-500">
                  {status === 'on_leave' ? 'Leave' : STATUS_CFG[status].label}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── SVG Department Performance Chart ────────────────────────────────────────
function DeptPerformanceCard({
  deptSummary,
  departmentId,
}: {
  deptSummary: IDeptSummaryRow[];
  departmentId: string;
}) {
  const facultyPoints = useMemo(() => {
    const list = [...deptSummary].slice(0, 5);
    return list.map((r, index) => ({
      name: r.faculty?.name || '—',
      pct: Math.round(r.attendancePercent),
      color: ['#2563eb', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e'][index],
    }));
  }, [deptSummary]);
  const radarPoints = facultyPoints
    .map((faculty, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / facultyPoints.length;
      const radius = 54 * (faculty.pct / 100);
      return `${160 + Math.cos(angle) * radius},${70 + Math.sin(angle) * radius}`;
    })
    .join(' ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4"
    >
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="h-4 w-4 text-emerald-500" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Faculty consistency radar
        </span>
      </div>
      {!departmentId ? (
        <div className="flex flex-1 flex-col items-center justify-center py-6 text-slate-300">
          <BarChart3 className="h-8 w-8 mb-1" />
          <p className="text-[10px] text-center px-4">Select department to view performance</p>
        </div>
      ) : facultyPoints.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-6 text-slate-300">
          <p className="text-[10px]">No records found</p>
        </div>
      ) : (
        <div className="mt-2 flex flex-1 flex-col">
          <svg
            viewBox="0 0 320 142"
            role="img"
            aria-label="Faculty attendance consistency radar"
            className="mx-auto min-h-32 w-full max-w-sm"
          >
            {[18, 36, 54].map((radius) => (
              <circle
                key={radius}
                cx="160"
                cy="70"
                r={radius}
                fill="none"
                stroke="#e2e8f0"
                strokeDasharray="3 4"
              />
            ))}
            {facultyPoints.map((faculty, index) => {
              const angle = -Math.PI / 2 + (index * Math.PI * 2) / facultyPoints.length;
              const x = 160 + Math.cos(angle) * 54;
              const y = 70 + Math.sin(angle) * 54;
              return <line key={faculty.name} x1="160" y1="70" x2={x} y2={y} stroke="#e2e8f0" />;
            })}
            <motion.polygon
              points={radarPoints}
              fill="#dbeafe"
              fillOpacity="0.7"
              stroke="#2563eb"
              strokeWidth="2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            />
            {facultyPoints.map((faculty, index) => {
              const angle = -Math.PI / 2 + (index * Math.PI * 2) / facultyPoints.length;
              const radius = 54 * (faculty.pct / 100);
              return (
                <circle
                  key={faculty.name}
                  cx={160 + Math.cos(angle) * radius}
                  cy={70 + Math.sin(angle) * radius}
                  r="5"
                  fill={faculty.color}
                  stroke="white"
                  strokeWidth="2"
                  className="transition-[r] hover:r-[7px]"
                >
                  <title>{`${faculty.name}: ${faculty.pct}%`}</title>
                </circle>
              );
            })}
          </svg>
          <div className="mt-auto grid grid-cols-2 gap-x-3 gap-y-1.5">
            {facultyPoints.map((faculty) => (
              <div key={faculty.name} className="flex min-w-0 items-center gap-2 text-[10px]">
                <svg viewBox="0 0 8 8" className="size-2 shrink-0" aria-hidden="true">
                  <circle cx="4" cy="4" r="4" fill={faculty.color} />
                </svg>
                <span className="truncate text-slate-500">{faculty.name}</span>
                <span className="ml-auto font-bold text-slate-800">{faculty.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function DailyAttendanceTrendCard({ records }: { records: IFacultyAttendance[] }) {
  const days = useMemo(() => {
    const grouped = new Map<string, Record<TFacultyAttendanceStatus, number>>();
    records.forEach((record) => {
      const key = record.date.slice(0, 10);
      const current = grouped.get(key) ?? {
        present: 0,
        absent: 0,
        late: 0,
        half_day: 0,
        on_leave: 0,
      };
      current[record.status] += 1;
      grouped.set(key, current);
    });
    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-7)
      .map(([date, counts]) => ({ date, counts }));
  }, [records]);
  const peak = Math.max(
    1,
    ...days.map(({ counts }) => Object.values(counts).reduce((sum, value) => sum + value, 0)),
  );
  const colors: Record<TFacultyAttendanceStatus, string> = {
    present: '#10b981',
    absent: '#fb7185',
    late: '#38bdf8',
    half_day: '#f59e0b',
    on_leave: '#8b5cf6',
  };
  const statuses: TFacultyAttendanceStatus[] = [
    'present',
    'late',
    'half_day',
    'on_leave',
    'absent',
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4"
    >
      <div className="flex items-center gap-2">
        <TrendingDown className="h-4 w-4 text-violet-500" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Daily attendance mix
        </span>
      </div>
      {days.length ? (
        <>
          <svg
            viewBox="0 0 360 150"
            role="img"
            aria-label="Stacked faculty attendance totals by day"
            className="mt-3 min-h-36 w-full overflow-visible"
          >
            {[0, 1, 2, 3].map((line) => (
              <line
                key={line}
                x1="24"
                x2="352"
                y1={18 + line * 31}
                y2={18 + line * 31}
                stroke="#e2e8f0"
                strokeDasharray="3 5"
              />
            ))}
            {days.map(({ date, counts }, index) => {
              const slot = 320 / days.length;
              const x = 30 + slot * index + Math.max(4, (slot - 24) / 2);
              let cursorY = 112;
              return (
                <g key={date} className="group">
                  {statuses.map((status) => {
                    const height = (counts[status] / peak) * 88;
                    cursorY -= height;
                    return (
                      <rect
                        key={status}
                        x={x}
                        y={cursorY}
                        width={Math.min(24, slot - 8)}
                        height={height}
                        rx="4"
                        fill={colors[status]}
                        className="transition-opacity group-hover:opacity-80"
                      >
                        <title>{`${STATUS_CFG[status].label}: ${counts[status]}`}</title>
                      </rect>
                    );
                  })}
                  <text
                    x={x + Math.min(24, slot - 8) / 2}
                    y="137"
                    textAnchor="middle"
                    className="fill-slate-500 text-[9px]"
                  >
                    {new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1">
            {statuses.map((status) => (
              <span key={status} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <span className="size-2 rounded-full" style={{ backgroundColor: colors[status] }} />
                {STATUS_CFG[status].label}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="flex flex-1 items-center justify-center py-8 text-xs text-slate-400">
          Daily attendance activity will appear here.
        </p>
      )}
    </motion.div>
  );
}

// ─── Stat summary cards ───────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon,
  colorCls,
  delay = 0,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  colorCls: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="flex items-center gap-3 rounded-2xl bg-white p-4 border border-slate-100"
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colorCls}`}>
        {icon}
      </div>
      <div>
        <p className="text-xl font-black text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </motion.div>
  );
}

export default function FacultyAttendancePage() {
  const hasPermission = useHasPermission('faculty_attendance', 'create');
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const isDeanOrAdmin = Boolean(
    activeRole &&
      [
        'dean_academic',
        'principal',
        'super_admin',
        'admin',
        'hr_department',
        'hod',
      ].includes(activeRole),
  );
  const canMark = hasPermission || isDeanOrAdmin;
  const assignedDepartmentId = useAuthStore(
    (state) => state.user?.departmentId ?? state.user?.department ?? '',
  );
  const isHod = activeRole === 'hod';
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [showDailyRoster, setShowDailyRoster] = useState(false);
  const now = new Date();
  const initialStart = new Date(now);
  const mondayOffset = (initialStart.getDay() + 6) % 7;
  initialStart.setDate(initialStart.getDate() - mondayOffset);
  const initialEnd = new Date(initialStart);
  initialEnd.setDate(initialEnd.getDate() + 6);
  const localKey = (date: Date) => {
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  };
  const [rangeStart, setRangeStart] = useState(localKey(initialStart));
  const [rangeEnd, setRangeEnd] = useState(localKey(initialEnd));
  const [attendanceDate, setAttendanceDate] = useState(localKey(now));
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [departmentId, setDepartmentId] = useState<string>(
    isHod && typeof assignedDepartmentId === 'string' ? assignedDepartmentId : '',
  );

  useEffect(() => {
    if (!showDailyRoster) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showDailyRoster]);

  const handleFilter = (v: string) => {
    setFilterStatus(v);
    setPage(1);
  };

  const apiUrl = useMemo(() => {
    const q = new URLSearchParams();
    q.set('page', String(page));
    q.set('limit', String(ATTENDANCE_PAGE_SIZE));
    q.set('startDate', rangeStart);
    q.set('endDate', rangeEnd);
    if (departmentId) q.set('departmentId', departmentId);
    return `faculty-attendance?${q.toString()}`;
  }, [page, rangeStart, rangeEnd, departmentId]);

  const { data: raw, isLoading, mutate } = useSwr<IFacultyAttendanceListResponse>(apiUrl);
  const records = useMemo(() => raw?.data ?? [], [raw]);
  const totalCount = raw?.total ?? records.length;

  // Personal monthly summary
  const monthlyUrl = isHod
    ? null
    : `faculty-attendance/monthly-summary?month=${month}&year=${year}`;
  const { data: monthlyRaw } = useSwr(monthlyUrl);
  const monthlyBuckets: IMonthlyBucket[] = (monthlyRaw as { data?: IMonthlyBucket[] })?.data ?? [];
  const monthlyTotal = monthlyBuckets.reduce((s, b) => s + b.count, 0);

  // Department summary
  const deptSummaryUrl =
    departmentId || isHod
      ? `faculty-attendance/department-summary?${new URLSearchParams({
        ...(departmentId ? { departmentId } : {}),
        startDate: rangeStart,
        endDate: rangeEnd,
      }).toString()}`
      : null;
  const { data: deptSummaryRaw } = useSwr(deptSummaryUrl);
  const deptSummary = useMemo(
    () => (deptSummaryRaw as { data?: IDeptSummaryRow[] })?.data ?? [],
    [deptSummaryRaw],
  );

  const departmentTotals = useMemo(
    () =>
      deptSummary.reduce(
        (summary, row) => ({
          total: summary.total + Number(row.total ?? 0),
          present: summary.present + Number(row.present ?? 0),
          absent: summary.absent + Number(row.absent ?? 0),
          onLeave: summary.onLeave + Number(row.onLeave ?? 0),
        }),
        { total: 0, present: 0, absent: 0, onLeave: 0 },
      ),
    [deptSummary],
  );
  const presentCount = isHod
    ? departmentTotals.present
    : records.filter((record) => record.status === 'present').length;
  const absentCount = isHod
    ? departmentTotals.absent
    : records.filter((record) => record.status === 'absent').length;
  const totalRecords = isHod ? departmentTotals.total : records.length;
  const summaryBuckets: IMonthlyBucket[] = isHod
    ? (
      [
        { _id: 'present', count: departmentTotals.present },
        { _id: 'absent', count: departmentTotals.absent },
        { _id: 'on_leave', count: departmentTotals.onLeave },
      ] satisfies IMonthlyBucket[]
    ).filter((bucket) => bucket.count > 0)
    : monthlyBuckets;
  const summaryTotal = isHod ? departmentTotals.total : monthlyTotal;

  const pageCount = Math.max(1, Math.ceil(totalCount / ATTENDANCE_PAGE_SIZE));
  const [includeSundays, setIncludeSundays] = useState(false);
  const recordsByDate = useMemo(() => {
    const grouped = new Map<string, IFacultyAttendance[]>();
    records.forEach((record) => {
      const key = record.date.slice(0, 10);
      grouped.set(key, [...(grouped.get(key) ?? []), record]);
    });
    return [...grouped.entries()].sort(([left], [right]) => right.localeCompare(left));
  }, [records]);
  const attendanceDays = useMemo(() => {
    const recordsMap = new Map(recordsByDate);
    const days: Array<[string, IFacultyAttendance[]]> = [];
    const cursor = new Date(`${rangeEnd}T00:00:00`);
    const first = new Date(`${rangeStart}T00:00:00`);
    while (cursor >= first) {
      const key = localKey(cursor);
      const isSunday = cursor.getDay() === 0;
      const dayRecs = recordsMap.get(key) ?? [];
      // Only include Sunday if it has recorded attendance or if user explicitly enabled weekend view
      if (!isSunday || dayRecs.length > 0 || includeSundays) {
        days.push([key, dayRecs]);
      }
      cursor.setDate(cursor.getDate() - 1);
    }
    return days;
  }, [rangeStart, rangeEnd, recordsByDate, includeSundays]);
  const todayKey = localKey(now);
  const todayHasAttendance = records.some((record) => record.date.slice(0, 10) === todayKey);
  const selectedDateHasAttendance = records.some(
    (record) => record.date.slice(0, 10) === attendanceDate,
  );

  return (
    <div className="space-y-5">
      <FacultyHrWorkflowBar />

      <section className="rounded-3xl border border-slate-200 bg-linear-to-r from-sky-50 via-white to-emerald-50 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                {isHod ? 'Department Workforce Attendance' : 'Faculty Attendance Governance'}
              </p>
              <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                {isHod ? 'HOD Scope' : canMark ? 'HR / Admin Scope' : 'Dean Academic (Audit)'}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {isHod ? 'Faculty Attendance Control' : 'Faculty Attendance & Compliance'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {isHod
                ? 'Record and manage official daily attendance for faculty in your department. Working days (Mon–Sat) are listed by default.'
                : 'Monitor institution-wide faculty attendance trends, approved leave coverage, and punctuality benchmarks.'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Selected reporting period
              </p>
              <p className="mt-1 font-semibold text-slate-800">
                {new Date(`${rangeStart}T00:00:00`).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}{' '}
                –{' '}
                {new Date(`${rangeEnd}T00:00:00`).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Enterprise Guidance Pill Bar */}
        <div className="mt-4 pt-4 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-slate-600">
          <div className="flex items-center gap-2 rounded-xl bg-white/80 p-2.5 border border-slate-200/60">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Marking Authority:</strong> HOD (own dept) & HR Department (all staff)
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/80 p-2.5 border border-slate-200/60">
            <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
            <span>
              <strong>Working Schedule:</strong> Mon – Sat active; Sundays hidden by default
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/80 p-2.5 border border-slate-200/60">
            <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              <strong>Special Duties:</strong> Use <em>Show / Mark Sunday</em> for weekend duties
            </span>
          </div>
        </div>
      </section>

      {/* ── Stats Summary Row ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label={isHod ? 'Department entries' : 'Total logged'}
          value={totalRecords}
          icon={<Calendar className="h-4.5 w-4.5" />}
          colorCls="bg-primary-50 text-primary"
          delay={0}
        />
        <StatCard
          label="Present"
          value={presentCount}
          icon={<UserCheck className="h-4.5 w-4.5" />}
          colorCls="bg-green-50 text-green-600"
          delay={0.05}
        />
        <StatCard
          label="Absent"
          value={absentCount}
          icon={<UserX className="h-4.5 w-4.5" />}
          colorCls="bg-red-50 text-red-500"
          delay={0.1}
        />
        <StatCard
          label={isHod ? 'Approved leave' : 'Leave / late'}
          value={
            isHod
              ? departmentTotals.onLeave
              : records.filter((record) => ['on_leave', 'late'].includes(record.status)).length
          }
          icon={<Clock className="h-4.5 w-4.5" />}
          colorCls="bg-blue-50 text-blue-600"
          delay={0.15}
        />
      </div>

      {/* ── 3-Column SVG Charts Row ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MonthlyStatsCard buckets={summaryBuckets} total={summaryTotal} />
        <DeptPerformanceCard deptSummary={deptSummary} departmentId={departmentId} />
        <DailyAttendanceTrendCard records={records} />
      </div>

      {/* ── Date range and status controls ── */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="w-full sm:w-48">
            <select
              value={filterStatus}
              onChange={(e) => handleFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-primary focus:bg-white transition h-9"
            >
              <option value="">All Status</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
              <option value="on_leave">On Approved Leave</option>
              <option value="half_day">Half Day</option>
            </select>
          </div>
          {!isHod && (
            <div className="w-60">
              <AsyncSelect
                type="departments"
                placeholder="All Departments"
                value={departmentId || null}
                onChange={(v) => setDepartmentId(v ?? '')}
              />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {canMark && (
            <CustomButton
              variant="primary"
              startIcon={<CalendarPlus className="h-4 w-4" />}
              onClick={() => {
                setAttendanceDate(localKey(new Date()));
                setShowDailyRoster(true);
              }}
            >
              {todayHasAttendance ? "Update today's attendance" : "Add today's attendance"}
            </CustomButton>
          )}
          <RecordsDateRangePicker
            start={rangeStart}
            end={rangeEnd}
            label="Faculty attendance range"
            onChange={(start, end) => {
              setRangeStart(start);
              setRangeEnd(end);
              setMonth(Number(start.slice(5, 7)));
              setYear(Number(start.slice(0, 4)));
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* ── Detailed attendance cards ── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
        className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5"
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Daily faculty attendance</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                Mon – Sat Working Days
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Showing active institutional working days. Sundays are automatically hidden unless attendance is recorded.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIncludeSundays((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${includeSundays
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              {includeSundays ? 'Hide Sundays (Off Days)' : 'Show / Mark Sunday'}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-52 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : attendanceDays.length ? (
          <div className="space-y-3">
            {attendanceDays.map(([dateKey, dayRecords], groupIndex) => {
              const dayPresent = dayRecords.filter((record) => record.status === 'present').length;
              const dayAbsent = dayRecords.filter((record) => record.status === 'absent').length;
              const dayExceptions = dayRecords.length - dayPresent - dayAbsent;
              const displayedRecords = filterStatus
                ? dayRecords.filter((record) => record.status === filterStatus)
                : dayRecords;
              const hasAttendance = dayRecords.length > 0;
              const isFuture = dateKey > localKey(now);
              const editable =
                canMark &&
                !isFuture &&
                (!hasAttendance || dayRecords.some((record) => !record.isLocked));
              return (
                <details
                  key={dateKey}
                  open={groupIndex === 0}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white"
                >
                  <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 transition-colors hover:bg-sky-50/50 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary-50 text-primary">
                        <span className="text-[9px] font-bold uppercase">
                          {new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-IN', {
                            month: 'short',
                          })}
                        </span>
                        <span className="text-lg font-black leading-5">
                          {new Date(`${dateKey}T00:00:00`).getDate()}
                        </span>
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900 sm:text-base">
                          {new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-IN', {
                            weekday: 'long',
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {hasAttendance
                            ? `${dayRecords.length} faculty records saved for this day`
                            : isFuture
                              ? 'Upcoming date · attendance is not open yet'
                              : 'Attendance has not been recorded'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {hasAttendance ? (
                        <>
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                            {dayPresent} present
                          </span>
                          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-600">
                            {dayAbsent} absent
                          </span>
                          {dayExceptions > 0 && (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
                              {dayExceptions} other
                            </span>
                          )}
                        </>
                      ) : (
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${isFuture ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'
                            }`}
                        >
                          {isFuture ? 'Upcoming' : 'Not recorded'}
                        </span>
                      )}
                      <ChevronDown className="size-5 text-slate-400 transition-transform group-open:rotate-180" />
                    </div>
                  </summary>
                  <div className="border-t border-slate-200 bg-slate-50/50 p-3 sm:p-4">
                    {displayedRecords.length ? (
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {displayedRecords.map((record, index) => {
                          const status = STATUS_CFG[record.status] ?? STATUS_CFG.present;
                          const populatedName =
                            typeof record.facultyId === 'string'
                              ? undefined
                              : record.facultyId.name;
                          const facultyName =
                            record.facultyName || populatedName || 'Faculty member';
                          return (
                            <motion.article
                              key={record._id}
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.02 }}
                              className="rounded-2xl border border-slate-200 bg-white p-3"
                            >
                              <div className="flex items-center gap-3">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sm font-bold text-primary">
                                  {facultyName.charAt(0).toUpperCase()}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-slate-900">
                                    {facultyName}
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-slate-500">
                                    {record.checkInTime || 'No check-in'} ·{' '}
                                    {record.checkOutTime || 'No check-out'}
                                  </p>
                                </div>
                                <span
                                  className={`rounded-full px-2 py-1 text-[10px] font-bold ${status.bg} ${status.text}`}
                                >
                                  {status.label}
                                </span>
                              </div>
                              {record.remarks?.trim() && (
                                <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-600">
                                  {record.remarks}
                                </p>
                              )}
                            </motion.article>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-white px-4 py-6 text-center">
                        <p className="text-sm font-semibold text-slate-800">
                          {hasAttendance
                            ? `No ${STATUS_CFG[filterStatus as TFacultyAttendanceStatus]?.label ?? filterStatus} records on this date`
                            : isFuture
                              ? 'Attendance will open on this date'
                              : 'No faculty attendance saved yet'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {hasAttendance
                            ? 'Choose All Status to review the complete daily roster.'
                            : isFuture
                              ? 'Future attendance cannot be entered in advance.'
                              : 'Use Add attendance to complete the daily faculty roster.'}
                        </p>
                      </div>
                    )}
                    <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[11px] text-slate-500">
                        {editable
                          ? hasAttendance
                            ? 'This roster is still inside the permitted update window.'
                            : 'This date is ready for attendance entry.'
                          : isFuture
                            ? 'Attendance entry will become available on this date.'
                            : 'This roster is locked and available for review only.'}
                      </p>
                      {editable && (
                        <CustomButton
                          variant="primary"
                          onClick={() => {
                            setAttendanceDate(dateKey);
                            setShowDailyRoster(true);
                          }}
                        >
                          {hasAttendance ? 'Update attendance' : 'Add attendance'}
                        </CustomButton>
                      )}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        ) : (
          <div className="grid items-center gap-5 rounded-2xl bg-sky-50/60 px-5 py-6 sm:grid-cols-[minmax(0,1fr)_16rem]">
            <div>
              <p className="text-sm font-semibold text-slate-800">No attendance in this range</p>
              <p className="mt-1 max-w-lg text-xs leading-5 text-slate-500">
                Choose another date range or status. New daily attendance will appear here
                automatically after saving.
              </p>
            </div>
            <Image
              src="/images/faculty-attendance/faculty-attendance-roster.png"
              alt="Faculty attendance coordination team"
              width={1402}
              height={1122}
              className="mx-auto h-32 w-auto object-contain"
            />
          </div>
        )}

        {pageCount > 1 && (
          <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((value) => value - 1)}
              className="rounded-xl border border-slate-200 p-2 text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-xs font-semibold text-slate-600">
              Page {page} of {pageCount}
            </span>
            <button
              type="button"
              disabled={page === pageCount}
              onClick={() => setPage((value) => value + 1)}
              className="rounded-xl border border-slate-200 p-2 text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </motion.section>

      {showDailyRoster && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Add faculty attendance"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-50"
        >
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex mmax-w-400 items-center gap-4 px-4 py-3 sm:px-6">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary">
                <CalendarPlus className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                  {selectedDateHasAttendance
                    ? 'Attendance update workspace'
                    : 'New attendance workspace'}
                </p>
                <h2 className="truncate text-lg font-semibold text-slate-900 sm:text-xl">
                  {selectedDateHasAttendance
                    ? `Update attendance · ${new Date(`${attendanceDate}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                    : `Record attendance · ${new Date(`${attendanceDate}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowDailyRoster(false)}
                className="flex size-11 cursor-pointer items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900"
                aria-label="Close attendance workspace"
              >
                <X className="size-5" />
              </button>
            </div>
          </header>

          <main className="mx-auto max-w-400 space-y-4 px-4 py-5 sm:px-6">
            <section className="grid items-center gap-4 overflow-hidden rounded-3xl bg-sky-50 p-4 sm:grid-cols-[minmax(0,1fr)_13rem] sm:p-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                  Current week
                </p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">
                  Select a day and complete the faculty roster
                </h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  Attendance opens on today by default. Previous days within the permitted window
                  can be reviewed or corrected.
                </p>
              </div>
              <Image
                src="/images/faculty-attendance/faculty-attendance-roster.png"
                alt="Faculty attendance coordination team"
                width={1402}
                height={1122}
                priority
                className="mx-auto h-28 w-auto object-contain sm:h-32"
              />
            </section>

            <section className="grid grid-cols-4 overflow-hidden rounded-2xl bg-white sm:grid-cols-7">
              {Array.from({ length: 7 }, (_, index) => {
                const day = new Date(initialStart);
                day.setDate(day.getDate() + index);
                const key = localKey(day);
                const selected = attendanceDate === key;
                const future = day > now;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={future}
                    onClick={() => setAttendanceDate(key)}
                    className={`min-h-20 border-b border-r border-slate-100 px-2 py-3 text-center transition-colors sm:border-b-0 ${selected
                        ? 'cursor-pointer bg-primary text-white'
                        : future
                          ? 'cursor-not-allowed bg-slate-50 text-slate-300'
                          : 'cursor-pointer bg-white text-slate-600 hover:bg-sky-50'
                      }`}
                  >
                    <span className="block text-[10px] font-bold uppercase tracking-wider">
                      {day.toLocaleDateString('en-IN', { weekday: 'short' })}
                    </span>
                    <span className="mt-1 block text-xl font-bold">{day.getDate()}</span>
                    {key === localKey(now) && (
                      <span
                        className={`mt-1 block text-[9px] font-bold ${selected ? 'text-white' : 'text-primary'}`}
                      >
                        Today
                      </span>
                    )}
                  </button>
                );
              })}
            </section>

            <FacultyDailyRoster
              key={`${departmentId}-${attendanceDate}`}
              date={attendanceDate}
              departmentId={departmentId || undefined}
              onDateChange={setAttendanceDate}
              onSaved={() => {
                mutate();
              }}
            />
          </main>
        </motion.div>
      )}
    </div>
  );
}

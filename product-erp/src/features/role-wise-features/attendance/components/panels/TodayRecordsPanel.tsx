/**
 * @file TodayRecordsPanel.tsx
 * @description Faculty and Department Attendance Register panel with multi-filtering, faculty search, and session inspection.
 * @module features/attendance
 */

'use client';

import React, { useState } from 'react';
import { endOfWeek, format, startOfWeek } from 'date-fns';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Lock,
  Search,
  User,
  AlertCircle,
  GraduationCap,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import useSwr from '@/shared/hooks/useSwr';
import { useHasRole, useHasAnyRole } from '@/shared/hooks/useHasRole';
import { TSystemRole } from '@/shared/types';
import type { IAttendanceRecord } from '../../types/attendance.types';
import { ANALYTICS_ROLES, STATUS_COLORS, getMonthTheme } from '../../utils/attendance.constants';
import { downloadCsv, fmtDate, localDateKey } from '../../utils/attendance.helpers';
import AttendanceCardsSkeleton from '../common/AttendanceCardsSkeleton';
import RecordsDateRangePicker from '../common/RecordsDateRangePicker';

export function TodayRecordsPanel() {
  const isHod = useHasRole('hod');
  const isAnalytics = useHasAnyRole(ANALYTICS_ROLES as TSystemRole[]);
  const [viewScope, setViewScope] = useState<'department' | 'my'>(
    isHod || isAnalytics ? 'department' : 'my',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'locked' | 'active' | 'shortage'>(
    'all',
  );
  const [range, setRange] = useState(() => ({
    start: localDateKey(startOfWeek(new Date(), { weekStartsOn: 1 })),
    end: localDateKey(endOfWeek(new Date(), { weekStartsOn: 1 })),
  }));
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const swrQuery = React.useMemo(() => {
    let query = `attendance?from=${range.start}&to=${range.end}`;
    if (viewScope === 'my') {
      query += '&scope=my';
    } else if (selectedFaculty !== 'all') {
      query += `&facultyId=${selectedFaculty}`;
    }
    return query;
  }, [range.start, range.end, viewScope, selectedFaculty]);

  const { data: raw, isLoading } = useSwr(swrQuery);
  const allRecords: IAttendanceRecord[] = [
    ...(Array.isArray(raw) ? raw : ((raw as { data?: IAttendanceRecord[] })?.data ?? [])),
  ].sort((left, right) => {
    const dateDifference = new Date(right.date).getTime() - new Date(left.date).getTime();
    if (dateDifference !== 0) return dateDifference;
    return right.endTime.localeCompare(left.endTime);
  });

  // Extract unique faculty list from loaded records
  const facultyOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const rec of allRecords) {
      if (rec.facultyId && rec.facultyName) {
        map.set(String(rec.facultyId), String(rec.facultyName));
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allRecords]);

  // Client-side filtering for search and status
  const records = React.useMemo(() => {
    return allRecords.filter((rec) => {
      const pct =
        rec.totalStrength > 0 ? Math.round((rec.totalPresent / rec.totalStrength) * 100) : 0;
      if (selectedStatus === 'locked' && !rec.isLocked) return false;
      if (selectedStatus === 'active' && rec.isLocked) return false;
      if (selectedStatus === 'shortage' && pct >= 75) return false;

      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      const matchSubject =
        (rec.subjectCode ?? '').toLowerCase().includes(query) ||
        (rec.subjectName ?? '').toLowerCase().includes(query);
      const matchFaculty = ((rec.facultyName as string | undefined) ?? '')
        .toLowerCase()
        .includes(query);
      const matchCohort =
        `${rec.program ?? ''} ${rec.branch ?? ''} sem ${rec.semester ?? ''} ${rec.section ?? ''}`
          .toLowerCase()
          .includes(query);
      const matchStudent = (rec.entries ?? []).some(
        (e) =>
          (e.studentName ?? '').toLowerCase().includes(query) ||
          (e.rollNumber ?? '').toLowerCase().includes(query),
      );
      return matchSubject || matchFaculty || matchCohort || matchStudent;
    });
  }, [allRecords, selectedStatus, searchQuery]);

  const totalPresent = records.reduce((sum, record) => sum + (record.totalPresent ?? 0), 0);
  const totalMarked = records.reduce((sum, record) => sum + (record.totalStrength ?? 0), 0);
  const averagePresence = totalMarked ? Math.round((totalPresent / totalMarked) * 100) : 0;
  const shortageSessionsCount = records.filter((rec) => {
    const pct = rec.totalStrength > 0 ? (rec.totalPresent / rec.totalStrength) * 100 : 0;
    return pct < 75;
  }).length;
  const recordedDates = new Set(records.map((record) => localDateKey(new Date(record.date)))).size;

  const exportFilteredCsv = () => {
    downloadCsv(
      `attendance-register-${range.start}-${range.end}.csv`,
      [
        'Date',
        'Time',
        'Faculty',
        'Subject Code',
        'Subject Name',
        'Class',
        'Present',
        'Absent',
        'Total',
        'Pct',
        'Status',
      ],
      records.map((r) => {
        const pct = r.totalStrength > 0 ? Math.round((r.totalPresent / r.totalStrength) * 100) : 0;
        return [
          r.date,
          `${r.startTime}-${r.endTime}`,
          (r.facultyName as string) || 'Faculty',
          r.subjectCode,
          r.subjectName,
          `${r.program} Sem ${r.semester} Sec ${r.section}`,
          r.totalPresent,
          r.totalAbsent ?? r.totalStrength - r.totalPresent,
          r.totalStrength,
          `${pct}%`,
          r.isLocked ? 'Locked' : 'Active',
        ];
      }),
    );
  };

  return (
    <div className="space-y-4">
      {/* Header and Scope Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              {isHod
                ? viewScope === 'department'
                  ? 'Department Attendance Register'
                  : 'My Teaching Records'
                : isAnalytics
                  ? 'Institution Attendance Register'
                  : 'My Attendance Records'}
            </h2>
            {isHod && (
              <span className="rounded-md bg-primary-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                HOD Oversight
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {isHod && viewScope === 'department'
              ? 'Review all attendance marked across department faculty and sections'
              : 'Review the teaching sessions you personally recorded'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-5">
          {(isHod || isAnalytics) && (
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setViewScope('department')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  viewScope === 'department'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Department All
              </button>
              <button
                type="button"
                onClick={() => setViewScope('my')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  viewScope === 'my'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                My Sessions
              </button>
            </div>
          )}

          <RecordsDateRangePicker
            start={range.start}
            end={range.end}
            onChange={(start, end) => setRange({ start, end })}
          />

          {records.length > 0 && (
            <CustomButton
              variant="secondary"
              size="sm"
              fullWidth={false}
              onClick={exportFilteredCsv}
              startIcon={<Download className="h-3.5 w-3.5" />}
              className="h-9! w-fit! shrink-0 px-3! py-1.5! text-xs! font-bold"
            >
              Export CSV
            </CustomButton>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      {!isLoading && allRecords.length > 0 && (
        <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label:
                isHod && viewScope === 'department' ? 'Department sessions' : 'Recorded sessions',
              value: records.length,
              detail: `${recordedDates} ${recordedDates === 1 ? 'teaching day' : 'teaching days'}`,
              tone: 'text-blue-700',
            },
            {
              label: 'Students evaluated',
              value: totalMarked.toLocaleString('en-IN'),
              detail: `${totalPresent.toLocaleString('en-IN')} present entries`,
              tone: 'text-violet-700',
            },
            {
              label: 'Average presence',
              value: `${averagePresence}%`,
              detail: `${totalMarked - totalPresent} non-present entries`,
              tone: averagePresence >= 75 ? 'text-emerald-700' : 'text-rose-600',
            },
            {
              label: 'Shortage sessions',
              value: shortageSessionsCount,
              detail: `${shortageSessionsCount === 0 ? 'All sessions ≥ 75%' : 'Sessions with < 75% present'}`,
              tone: shortageSessionsCount > 0 ? 'text-amber-700' : 'text-slate-600',
            },
          ].map((metric, index) => (
            <div
              key={metric.label}
              className={`px-5 py-4 ${index > 0 ? 'border-t border-slate-100 sm:border-t-0 sm:border-l' : ''}`}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                {metric.label}
              </p>
              <div className="mt-1 flex items-end justify-between gap-3">
                <p className={`text-2xl font-black ${metric.tone}`}>{metric.value}</p>
                <p className="pb-0.5 text-xs text-slate-500">{metric.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search subject, faculty, section..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs focus:border-primary focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(isHod || isAnalytics) && viewScope === 'department' && facultyOptions.length > 0 && (
            <select
              value={selectedFaculty}
              onChange={(e) => setSelectedFaculty(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 focus:border-primary focus:outline-none"
            >
              <option value="all">All Faculty ({facultyOptions.length})</option>
              {facultyOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}

          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            {[
              { id: 'all', label: 'All' },
              { id: 'shortage', label: '< 75% Risk' },
              { id: 'active', label: 'Active' },
              { id: 'locked', label: 'Locked' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedStatus(tab.id as typeof selectedStatus)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                  selectedStatus === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <AttendanceCardsSkeleton cards={3} />
      ) : records.length ? (
        <div className="space-y-3">
          {records.map((r) => {
            const pct =
              r.totalStrength > 0 ? Math.round((r.totalPresent / r.totalStrength) * 100) : 0;
            const absent =
              r.totalAbsent ?? r.entries.filter((entry) => entry.status === 'A').length;
            const late = r.entries.filter((entry) => entry.status === 'L').length;
            const recordDate = new Date(r.date);
            const monthTheme = getMonthTheme(recordDate);

            return (
              <div
                key={r._id}
                className="rounded-2xl border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-xs"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === r._id ? null : r._id)}
                  aria-label={`${r.subjectName}, ${format(recordDate, 'dd MMMM yyyy')}${r.isLocked ? '. Attendance finalized and locked' : ''}`}
                  className="grid w-full gap-4 p-4 text-left transition-colors hover:bg-slate-50/70 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                >
                  <div className="flex min-w-0 items-start gap-4">
                    {/* Date Block with Dynamic Month Palette */}
                    <div
                      className={`w-16 shrink-0 overflow-hidden rounded-xl border ${monthTheme.border} ${monthTheme.bg} text-center`}
                    >
                      <span
                        className={`block py-1 text-[10px] font-black uppercase tracking-wider ${monthTheme.headerBg} ${monthTheme.headerText}`}
                      >
                        {format(recordDate, 'MMM')}
                      </span>
                      <span className={`block py-1.5 text-xl font-black ${monthTheme.numText}`}>
                        {format(recordDate, 'dd')}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">
                          {r.subjectCode} — {r.subjectName}
                        </h3>
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                          {r.classType}
                        </span>
                        {pct < 75 && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                            <AlertCircle className="size-3 text-rose-500" /> Shortage &lt;75%
                          </span>
                        )}
                        {r.isLocked && (
                          <span className="group/lock relative inline-flex">
                            <span className="inline-flex cursor-help items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                              <Lock className="size-3" /> Locked
                            </span>
                            <span
                              role="tooltip"
                              className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-20 hidden w-64 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-md group-hover/lock:block"
                            >
                              <strong className="block text-xs font-bold text-slate-800">
                                Attendance is finalized
                              </strong>
                              <span className="mt-1 block text-[11px] font-normal leading-4 text-slate-500">
                                This record is read-only after the allowed editing window.
                              </span>
                            </span>
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {format(recordDate, 'EEEE, dd MMMM yyyy')}
                      </p>

                      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
                        {r.facultyName && (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800">
                            <User className="size-3.5 text-slate-500" />
                            <span className="font-normal text-slate-500">Faculty:</span>{' '}
                            {String(r.facultyName)}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <Clock className="size-3.5 text-slate-400" /> Period {r.periodNumber} ·{' '}
                          {r.startTime}–{r.endTime}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <GraduationCap className="size-3.5 text-slate-400" /> {r.program} · Sem{' '}
                          {r.semester} · Sec {r.section}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Presence Counts & Chevron */}
                  <div className="flex items-center justify-between gap-4 lg:justify-end">
                    <div className="flex overflow-hidden rounded-xl border border-slate-200">
                      <span className="px-3 py-2 text-center">
                        <strong className="block text-sm font-bold text-emerald-700">
                          {r.totalPresent}
                        </strong>
                        <span className="text-[9px] font-bold uppercase text-slate-500">
                          Present
                        </span>
                      </span>
                      <span className="border-l border-slate-100 px-3 py-2 text-center">
                        <strong className="block text-sm font-bold text-rose-600">{absent}</strong>
                        <span className="text-[9px] font-bold uppercase text-slate-500">
                          Absent
                        </span>
                      </span>
                      <span className="border-l border-slate-100 px-3 py-2 text-center">
                        <strong className="block text-sm font-bold text-amber-600">{late}</strong>
                        <span className="text-[9px] font-bold uppercase text-slate-500">Late</span>
                      </span>
                    </div>

                    <div className="min-w-16 text-right">
                      <p
                        className={`text-xl font-black ${pct < 75 ? 'text-rose-600' : 'text-slate-900'}`}
                      >
                        {pct}%
                      </p>
                      <p className="text-[10px] font-semibold text-slate-500">
                        {r.totalPresent}/{r.totalStrength} marked
                      </p>
                    </div>

                    {expandedId === r._id ? (
                      <ChevronUp className="size-5 text-primary" />
                    ) : (
                      <ChevronDown className="size-5 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Expanded Student Roll Call */}
                <AnimatePresence>
                  {expandedId === r._id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-slate-100 px-4 pb-4 sm:px-5 sm:pb-5"
                    >
                      <div className="mt-3.5 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/80">
                              <th className="py-2.5 pr-4 pl-3 text-left font-bold text-slate-700">
                                Student Name
                              </th>
                              <th className="py-2.5 pr-4 text-left font-bold text-slate-700">
                                Roll Number
                              </th>
                              <th className="py-2.5 pr-4 text-left font-bold text-slate-700">
                                Department
                              </th>
                              <th className="py-2.5 pr-4 text-left font-bold text-slate-700">
                                Program / Sem
                              </th>
                              <th className="py-2.5 pr-4 text-left font-bold text-slate-700">
                                Status
                              </th>
                              <th className="py-2.5 text-left font-bold text-slate-700">Remarks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {r.entries.map((e, i) => (
                              <tr
                                key={`${e.studentId}-${i}`}
                                className="hover:bg-slate-50/60 transition-colors"
                              >
                                <td className="py-2.5 pr-4 pl-3 font-semibold text-slate-900">
                                  {e.studentName || 'Student'}
                                </td>
                                <td className="py-2 pr-4 font-mono font-medium text-slate-700">
                                  {e.rollNumber}
                                </td>
                                <td className="py-2 pr-4">
                                  <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                    {e.departmentCode || r.branch || '—'}
                                  </span>
                                </td>
                                <td className="py-2 pr-4 text-slate-600">
                                  <span className="font-semibold text-slate-800">
                                    {e.program || r.program || '—'}
                                  </span>
                                  <span className="ml-1 text-slate-500">
                                    · Sem {e.semester || r.semester}
                                  </span>
                                </td>
                                <td className="py-2 pr-4">
                                  <span
                                    className={`rounded-md px-2.5 py-0.5 text-[11px] font-bold ${STATUS_COLORS[e.status]}`}
                                  >
                                    {e.status}
                                  </span>
                                </td>
                                <td className="py-2 text-slate-500">{e.remarks ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-12">
          <BookOpen className="mb-2 h-10 w-10 text-slate-200" />
          <p className="text-sm font-semibold text-slate-600">No attendance records found</p>
          <p className="mt-1 text-xs text-slate-400">
            {fmtDate(range.start)} – {fmtDate(range.end)}
          </p>
        </div>
      )}
    </div>
  );
}

export default TodayRecordsPanel;

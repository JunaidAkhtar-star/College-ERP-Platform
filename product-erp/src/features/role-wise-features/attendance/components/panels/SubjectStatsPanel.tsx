/**
 * @file SubjectStatsPanel.tsx
 * @description Subject-level attendance explorer with date range filter and session performance graph.
 * @module features/attendance
 */

'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  AlertTriangle,
  BarChart2,
  CalendarCheck2,
  CheckCircle,
  Download,
  Users,
} from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import AsyncSelect from '@/shared/core/AsyncSelect';
import useSwr from '@/shared/hooks/useSwr';
import { useHasRole, useHasAnyRole } from '@/shared/hooks/useHasRole';
import { TSystemRole } from '@/shared/types';
import type { IAttendanceRecord } from '../../types/attendance.types';
import { ANALYTICS_ROLES, getMonthTheme } from '../../utils/attendance.constants';
import { downloadCsv, localDateKey } from '../../utils/attendance.helpers';
import AttendanceCardsSkeleton from '../common/AttendanceCardsSkeleton';
import RecordsDateRangePicker from '../common/RecordsDateRangePicker';

export function SubjectStatsPanel() {
  const isHod = useHasRole('hod');
  const isAnalytics = useHasAnyRole(ANALYTICS_ROLES as TSystemRole[]);
  const [subjectId, setSubjectId] = useState('');
  const today = localDateKey(new Date());
  const monthStart = `${today.slice(0, 8)}01`;
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const { data, isLoading } = useSwr<{ data?: IAttendanceRecord[] }>(
    subjectId ? `attendance/subject/${subjectId}?from=${from}&to=${to}` : null,
  );
  const rows = [
    ...(Array.isArray(data) ? data : ((data as { data?: IAttendanceRecord[] })?.data ?? [])),
  ].sort((left, right) =>
    `${right.date}-${right.endTime}`.localeCompare(`${left.date}-${left.endTime}`),
  );
  const totalPresent = rows.reduce((sum, row) => sum + row.totalPresent, 0);
  const totalAbsent = rows.reduce((sum, row) => sum + row.totalAbsent, 0);
  const totalStrength = rows.reduce((sum, row) => sum + row.totalStrength, 0);
  const averagePresence = totalStrength ? Math.round((totalPresent / totalStrength) * 100) : 0;
  const comparisonRows = [...rows]
    .reverse()
    .slice(-6)
    .map((row) => ({
      ...row,
      percentage: row.totalStrength ? Math.round((row.totalPresent / row.totalStrength) * 100) : 0,
    }));
  const comparisonHeight = comparisonRows.length * 44 + 18;

  const exportSessions = () =>
    downloadCsv(
      `subject-attendance-${from}-${to}.csv`,
      ['Date', 'Subject', 'Period', 'Class', 'Present', 'Absent', 'Strength'],
      rows.map((record) => [
        record.date,
        record.subjectCode,
        record.periodNumber,
        `${record.program} Sem ${record.semester} ${record.section}`,
        record.totalPresent,
        record.totalAbsent,
        record.totalStrength,
      ]),
    );

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
              Subject attendance intelligence
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Session performance explorer</h2>
            <p className="mt-1 text-sm text-slate-500">
              {isHod
                ? 'Select any department subject and date range to review session history and presence rates.'
                : 'Select a subject and date range to review every recorded class without switching between reports.'}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(16rem,1fr)_auto] xl:w-2xl">
            <div>
              <AsyncSelect
                type="subjects"
                label="Subject"
                params={isHod || isAnalytics ? { assignmentScopeVersion: 2 } : { assignedOnly: true, assignmentScopeVersion: 2 }}
                value={subjectId}
                onChange={(value) => setSubjectId(value ?? '')}
                placeholder={isHod ? 'Search any department subject' : 'Search your assigned subjects'}
                emptyMessage={isHod ? 'No department subjects found.' : 'No approved timetable subjects are assigned to your faculty account.'}
              />
            </div>
            <RecordsDateRangePicker
              start={from}
              end={to}
              onChange={(start, end) => {
                setFrom(start);
                setTo(end);
              }}
              label="Sessions date range"
            />
          </div>
        </div>
      </section>

      {!subjectId && (
        <section className="grid items-center gap-5 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-[minmax(0,1fr)_16rem]">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Choose a subject to begin</h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Session totals, attendance movement and individual class insights will update
              automatically from recorded attendance.
            </p>
          </div>
          <div className="rounded-2xl bg-blue-50 p-4">
            <svg viewBox="0 0 240 100" className="h-24 w-full" aria-hidden="true">
              <path
                d="M10 78 C48 65 65 72 92 48 S145 55 170 30 S205 25 230 12"
                fill="none"
                stroke="#0878da"
                strokeWidth="5"
                strokeLinecap="round"
              />
              {[10, 92, 170, 230].map((x, index) => (
                <circle
                  key={x}
                  cx={x}
                  cy={[78, 48, 30, 12][index]}
                  r="6"
                  fill="#fff"
                  stroke="#0878da"
                  strokeWidth="3"
                />
              ))}
            </svg>
          </div>
        </section>
      )}

      {isLoading && subjectId && <AttendanceCardsSkeleton cards={3} />}

      {subjectId && !isLoading && rows.length === 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <BarChart2 className="mx-auto h-8 w-8 text-primary" />
          <h3 className="mt-3 text-base font-bold text-slate-900">No recorded sessions found</h3>
          <p className="mt-1 text-sm text-slate-500">
            Try a wider date range or verify that attendance was submitted for this subject.
          </p>
        </section>
      )}

      {rows.length > 0 && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: 'Recorded sessions',
                value: rows.length,
                detail: `${from} to ${to}`,
                tone: 'text-blue-700 bg-blue-50',
                icon: CalendarCheck2,
              },
              {
                label: 'Average presence',
                value: `${averagePresence}%`,
                detail: `${totalPresent} present entries`,
                tone: 'text-emerald-700 bg-emerald-50',
                icon: CheckCircle,
              },
              {
                label: 'Absent entries',
                value: totalAbsent,
                detail: `Across ${rows.length} sessions`,
                tone: 'text-rose-700 bg-rose-50',
                icon: AlertTriangle,
              },
              {
                label: 'Students marked',
                value: totalStrength,
                detail: 'Total attendance entries',
                tone: 'text-violet-700 bg-violet-50',
                icon: Users,
              },
            ].map(({ label, value, detail, tone, icon: Icon }) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      {label}
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
                  </div>
                  <span className={`flex size-10 items-center justify-center rounded-xl ${tone}`}>
                    <Icon className="size-4" />
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">{detail}</p>
              </motion.div>
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.5fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">Session attendance comparison</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Present and absent students in each recorded class
                  </p>
                </div>
                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                  {averagePresence}% average
                </span>
              </div>
              <div className="mt-4 overflow-x-auto rounded-2xl bg-slate-50 p-4">
                <svg
                  viewBox={`0 0 420 ${comparisonHeight}`}
                  className="min-h-44 min-w-lg w-full"
                  role="img"
                  aria-label="Present and absent attendance comparison by session"
                >
                  {comparisonRows.map((row, index) => {
                    const y = 14 + index * 44;
                    const presentWidth = row.percentage * 2.55;
                    const absentWidth = 255 - presentWidth;
                    return (
                      <g key={row._id}>
                        <text x="2" y={y + 10} fontSize="10" fontWeight="700" fill="#475569">
                          {format(new Date(row.date), 'dd MMM')}
                        </text>
                        <text x="2" y={y + 25} fontSize="8" fill="#94a3b8">
                          P{row.periodNumber} · {row.classType}
                        </text>
                        <rect x="88" y={y} width="255" height="22" rx="7" fill="#e2e8f0" />
                        <motion.rect
                          x="88"
                          y={y}
                          height="22"
                          rx="7"
                          fill="#10b981"
                          initial={{ width: 0 }}
                          animate={{ width: presentWidth }}
                          transition={{ duration: 0.75, delay: index * 0.08, ease: 'easeOut' }}
                        />
                        {absentWidth > 0 && (
                          <motion.rect
                            x={88 + presentWidth}
                            y={y}
                            height="22"
                            rx="7"
                            fill="#fb7185"
                            initial={{ width: 0 }}
                            animate={{ width: absentWidth }}
                            transition={{ duration: 0.55, delay: 0.25 + index * 0.08 }}
                          />
                        )}
                        <text x="359" y={y + 15} fontSize="11" fontWeight="800" fill="#0f172a">
                          {row.percentage}%
                        </text>
                        <title>
                          {format(new Date(row.date), 'dd MMM yyyy')}: {row.totalPresent} present,{' '}
                          {row.totalAbsent} absent, {row.totalStrength} total
                        </title>
                      </g>
                    );
                  })}
                </svg>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 text-[10px] text-slate-500">
                  <span>
                    Latest {comparisonRows.length} recorded{' '}
                    {comparisonRows.length === 1 ? 'session' : 'sessions'}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5">
                      <span className="size-3 rounded bg-emerald-500" /> Present
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-3 rounded bg-rose-400" /> Absent
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  Current range
                </p>
                <h3 className="mt-2 text-lg font-bold text-slate-900">
                  {rows[0].subjectCode} · {rows[0].subjectName}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Reviewable session history for Semester {rows[0].semester}, Section{' '}
                  {rows[0].section}.
                </p>
              </div>
              <button
                type="button"
                onClick={exportSessions}
                className="group mt-5 flex w-full items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-100/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                aria-label={`Export ${rows.length} subject attendance sessions as CSV`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-white text-primary transition-colors group-hover:border-blue-300">
                    <Download className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-900">Export sessions</span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                      {rows.length} {rows.length === 1 ? 'record' : 'records'} · Selected date range
                    </span>
                  </span>
                </span>
                <span className="shrink-0 rounded-md border border-blue-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-wider text-blue-700">
                  CSV
                </span>
              </button>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Recorded class sessions</h3>
                <p className="mt-1 text-xs text-slate-500">Newest session appears first</p>
              </div>
              <span className="text-xs font-semibold text-slate-500">{rows.length} sessions</span>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {rows.map((record, index) => {
                const percentage = record.totalStrength
                  ? Math.round((record.totalPresent / record.totalStrength) * 100)
                  : 0;
                const recordDate = new Date(record.date);
                const monthTheme = getMonthTheme(recordDate);
                return (
                  <motion.article
                    key={record._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.035, 0.25) }}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-16 shrink-0 overflow-hidden rounded-xl border ${monthTheme.border} ${monthTheme.bg} text-center`}>
                        <span className={`block py-1 text-[10px] font-black uppercase tracking-wider ${monthTheme.headerBg} ${monthTheme.headerText}`}>
                          {format(recordDate, 'MMM')}
                        </span>
                        <span className={`block py-1.5 text-xl font-black ${monthTheme.numText}`}>
                          {format(recordDate, 'dd')}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="font-bold text-slate-900">
                            Period {record.periodNumber} · {record.classType}
                          </h4>
                          <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                            {percentage}% present
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {format(recordDate, 'EEEE, dd MMMM yyyy')} · {record.startTime}–
                          {record.endTime}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {record.program} · Semester {record.semester} · Section {record.section}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-xl border border-slate-200 text-center">
                      <div className="px-2 py-2.5">
                        <strong className="block text-emerald-700">{record.totalPresent}</strong>
                        <span className="text-[9px] font-bold uppercase text-slate-600">
                          Present
                        </span>
                      </div>
                      <div className="border-l border-slate-100 px-2 py-2.5">
                        <strong className="block text-rose-600">{record.totalAbsent}</strong>
                        <span className="text-[9px] font-bold uppercase text-slate-600">
                          Absent
                        </span>
                      </div>
                      <div className="border-l border-slate-100 px-2 py-2.5">
                        <strong className="block text-slate-800">{record.totalStrength}</strong>
                        <span className="text-[9px] font-bold uppercase text-slate-600">
                          Strength
                        </span>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default SubjectStatsPanel;

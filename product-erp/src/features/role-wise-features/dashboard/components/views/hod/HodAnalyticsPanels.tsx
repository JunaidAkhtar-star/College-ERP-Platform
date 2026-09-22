/**
 * @file HodAnalyticsPanels.tsx
 * @description Operational analytics, live teaching schedule, curriculum progress, workload, and risk intelligence panels for HODs.
 * @module features/dashboard
 */

'use client';

import { motion } from '@/shared/utils/motion';
import {
  ArrowUpRight,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Flame,
  MapPin,
  Search,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import React, { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useRolePath } from '../shared';
import type { IHodClass, IHodDashboardData } from './hod-dashboard.types';

interface IPanelProps {
  title: string;
  description: string;
  href?: string;
  badge?: string;
  children: React.ReactNode;
  className?: string;
}

/** Provides a consistent, polished analytics surface with optional drill-down. */
function Panel({ title, description, href, badge, children, className = '' }: IPanelProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
      className={`rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 ${className}`}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
            {badge && (
              <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                {badge}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
        {href && (
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-slate-50 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary-50 hover:text-primary-700"
          >
            View details <ArrowUpRight className="size-3.5" />
          </Link>
        )}
      </div>
      {children}
    </motion.section>
  );
}

/** Renders a clean empty state graphic. */
function EmptyState({
  label,
  icon: Icon = CircleAlert,
}: {
  label: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex min-h-28 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-4 text-center">
      <span className="flex size-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500">
        <Icon className="size-5" />
      </span>
      <p className="mt-2 text-sm font-bold text-slate-700">No records available</p>
      <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">{label}</p>
    </div>
  );
}

/** Displays the department's live class sequence for today with filters and real-time status. */
export function TeachingOperations({ data }: { data: IHodDashboardData }) {
  const path = useRolePath();
  const [filter, setFilter] = useState<'all' | 'live' | 'upcoming' | 'past'>('all');
  const [search, setSearch] = useState('');

  const currentMinute = new Date().getHours() * 60 + new Date().getMinutes();
  const toMinute = (timeStr: string) => {
    const [h = 0, m = 0] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const getStatus = (item: IHodClass) => {
    const startMin = toMinute(item.startTime);
    const endMin = toMinute(item.endTime);
    if (currentMinute >= startMin && currentMinute <= endMin) return 'live';
    if (currentMinute > endMin) return 'past';
    return 'upcoming';
  };

  const filteredClasses = data.todayClasses.filter((item) => {
    const status = getStatus(item);
    if (filter !== 'all' && status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.subjectCode.toLowerCase().includes(q) ||
        item.subjectName.toLowerCase().includes(q) ||
        (item.facultyName || '').toLowerCase().includes(q) ||
        (item.roomNo || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const liveCount = data.todayClasses.filter((c) => getStatus(c) === 'live').length;
  const upcomingCount = data.todayClasses.filter((c) => getStatus(c) === 'upcoming').length;
  const pastCount = data.todayClasses.filter((c) => getStatus(c) === 'past').length;

  return (
    <Panel
      title="Today’s teaching schedule"
      description="Real-time class sequence, room allocations, faculty on duty, and attendance status"
      href={path('timetable')}
      badge={`${data.todayClasses.length} Scheduled`}
      className="xl:col-span-12"
    >
      {data.todayClasses.length > 0 ? (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100/80 p-1">
              {[
                { id: 'all', label: `All (${data.todayClasses.length})` },
                { id: 'live', label: `Live (${liveCount})` },
                { id: 'upcoming', label: `Upcoming (${upcomingCount})` },
                { id: 'past', label: `Conducted (${pastCount})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id as typeof filter)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                    filter === tab.id
                      ? 'border border-primary-200 bg-white text-primary'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-48 sm:w-60">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search subject or faculty…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-full rounded-xl border border-slate-200 bg-slate-50 pl-8.5 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-primary focus:bg-white"
              />
            </div>
          </div>

          {filteredClasses.length ? (
            <div className="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
              {filteredClasses.slice(0, 9).map((item, index) => {
                const status = getStatus(item);
                const isLive = status === 'live';
                const isPast = status === 'past';

                return (
                  <motion.div
                    key={`${item.timetableId}-${item.slotId ?? index}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className={`group relative rounded-2xl border p-4 transition-colors ${
                      isLive
                        ? 'border-primary-300 bg-primary-50/40 ring-1 ring-primary/20'
                        : 'border-slate-200/80 bg-slate-50/60 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        {isLive && (
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                          </span>
                        )}
                        <span className="font-mono text-xs font-bold tabular-nums text-slate-800">
                          {item.startTime} – {item.endTime}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isLive ? (
                          <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                            Live Class
                          </span>
                        ) : isPast ? (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-bold text-slate-600">
                            Conducted
                          </span>
                        ) : (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-700">
                            Upcoming
                          </span>
                        )}
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-bold uppercase text-slate-600">
                          {item.classType}
                        </span>
                      </div>
                    </div>

                    <p
                      className="mt-2.5 truncate text-sm font-bold text-slate-950"
                      title={item.subjectName}
                    >
                      {item.subjectCode} · {item.subjectName}
                    </p>

                    <p className="mt-1 flex items-center gap-1.5 truncate text-xs font-medium text-slate-600">
                      <span className="inline-block size-1.5 rounded-full bg-primary" />
                      {item.facultyName || 'Faculty not assigned'}
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100/80 pt-2.5 text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700">
                        {item.program} · Sem {item.semester}
                        {item.section ? ` · Sec ${item.section}` : ''}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 font-medium">
                        <MapPin className="size-3 text-slate-400" /> {item.roomNo || 'Room TBD'}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-slate-500">No classes match the filter.</p>
          )}

          {data.extraClassesToday && data.extraClassesToday.length > 0 && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-3.5">
              <p className="text-xs font-bold text-violet-900">
                ⭐ {data.extraClassesToday.length} Approved Extra Class Scheduled Today
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-violet-700">
                {data.extraClassesToday.map((ec, idx) => (
                  <span
                    key={idx}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-medium"
                  >
                    {ec.subjectCode} ({ec.startTime}–{ec.endTime}) · Room {ec.roomNo || 'TBD'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState label="No published department classes are scheduled for today." />
      )}
    </Panel>
  );
}

/** Compares attendance health over time and across active cohorts. */
export function AttendanceAnalytics({ data }: { data: IHodDashboardData }) {
  const path = useRolePath();
  const trend = (data.attendanceTrend ?? []).map((item) => {
    const raw = Number(item.avgPresent ?? 0);
    const attendance = raw > 1 ? raw : raw * 100;
    return {
      date: new Date(item._id).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      attendance: Number(attendance.toFixed(1)),
    };
  });
  const cohorts = (data.sectionAttendance ?? []).map((item) => ({
    cohort: `${item._id.branch || 'Dept'} S${item._id.semester}${item._id.section ? `-${item._id.section}` : ''}`,
    attendance: item.percentage,
  }));
  const avgTrendAttendance = trend.length
    ? (trend.reduce((sum, item) => sum + item.attendance, 0) / trend.length).toFixed(1)
    : '—';

  return (
    <Panel
      title="Attendance intelligence"
      description="30-day department trend and cohort-level compliance against the 75% threshold"
      href={path('attendance')}
      badge={`${avgTrendAttendance}% Dept Avg`}
      className="xl:col-span-8"
    >
      {trend.length ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
          <div className="h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="hodAttendanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0178D7" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0178D7" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 6" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Attendance Rate']}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '1rem',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="attendance"
                  stroke="#0178D7"
                  strokeWidth={3}
                  fill="url(#hodAttendanceGradient)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#0178D7', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Cohort Compliance
              </p>
              <span className="text-[10px] font-semibold text-slate-400">Min 75% target</span>
            </div>
            {cohorts.length ? (
              <div className="h-56 min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={cohorts} layout="vertical" margin={{ left: 4, right: 8 }}>
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis
                      type="category"
                      dataKey="cohort"
                      width={68}
                      tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [`${value}%`, 'Cohort Attendance']}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '1rem',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="attendance" radius={[0, 8, 8, 0]} barSize={14}>
                      {cohorts.map((item) => (
                        <Cell
                          key={item.cohort}
                          fill={item.attendance < 75 ? '#f43f5e' : '#10b981'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState label="Cohort attendance appears after class attendance is recorded." />
            )}
          </div>
        </div>
      ) : (
        <EmptyState label="Record class attendance to unlock department and cohort trends." />
      )}
    </Panel>
  );
}

/** Shows students requiring attendance intervention with direct drill-down. */
export function StudentRiskPanel({ data }: { data: IHodDashboardData }) {
  const path = useRolePath();
  return (
    <Panel
      title="Students requiring intervention"
      description="Students below the mandatory 75% institutional attendance threshold"
      href={path('student-management')}
      badge={data.studentRisk.length ? `${data.studentRisk.length} At Risk` : undefined}
      className="xl:col-span-4"
    >
      {data.studentRisk.length ? (
        <div className="space-y-2">
          {data.studentRisk.slice(0, 6).map((student, index) => {
            const isCritical = student.attendancePercentage < 65;
            return (
              <Link
                key={student.studentId}
                href={path(`student-management`)}
                className={`group flex items-center gap-3 rounded-2xl border p-3 transition-colors ${
                  isCritical
                    ? 'border-rose-200/80 bg-rose-50/50 hover:bg-rose-100/60'
                    : 'border-amber-200/80 bg-amber-50/40 hover:bg-amber-100/50'
                }`}
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                    isCritical ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'
                  }`}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-900 group-hover:text-primary">
                    {student.name}
                  </span>
                  <span className="block truncate text-[11px] font-medium text-slate-500">
                    Roll No: {student.rollNumber} · {student.missedClasses} classes missed
                  </span>
                </span>
                <div className="text-right">
                  <span
                    className={`block text-sm font-black ${
                      isCritical ? 'text-rose-600' : 'text-amber-700'
                    }`}
                  >
                    {student.attendancePercentage.toFixed(1)}%
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    {isCritical ? 'Critical' : 'Warning'}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl bg-emerald-50/60 px-5 text-center">
          <span className="flex size-11 items-center justify-center rounded-2xl border border-emerald-200 bg-white text-emerald-600">
            <CheckCircle2 className="size-6" />
          </span>
          <p className="mt-3 text-sm font-bold text-slate-800">No attendance risk detected</p>
          <p className="mt-1 text-xs text-slate-500">
            All department students currently meet or exceed the 75% attendance threshold.
          </p>
        </div>
      )}
    </Panel>
  );
}

/** Visualizes syllabus delivery and lesson-plan governance. */
export function CourseDeliveryPanel({ data }: { data: IHodDashboardData }) {
  const path = useRolePath();
  const plans = [
    { name: 'Approved', value: data.lessonPlans.approved, color: '#10b981' },
    { name: 'Under Review', value: data.lessonPlans.submitted, color: '#0178D7' },
    { name: 'Draft', value: data.lessonPlans.draft, color: '#94a3b8' },
    { name: 'Rejected', value: data.lessonPlans.rejected, color: '#f43f5e' },
  ];
  const planTotal = plans.reduce((sum, item) => sum + item.value, 0);

  return (
    <Panel
      title="Curriculum & syllabus delivery"
      description="Subject syllabus progress and faculty lesson plan review governance"
      href={path('course-progress')}
      badge={`${data.courseCompletion?.avgCompletion?.toFixed(0) ?? 0}% Avg Completion`}
      className="xl:col-span-12"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(230px,0.6fr)]">
        {data.subjectProgress.length ? (
          <div className="h-72 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart
                data={data.subjectProgress}
                margin={{ top: 8, right: 8, left: -14, bottom: 42 }}
              >
                <CartesianGrid strokeDasharray="4 6" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="subjectCode"
                  angle={-32}
                  textAnchor="end"
                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => [`${value}%`, 'Syllabus Conducted']}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '1rem',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="completionPercentage" radius={[8, 8, 3, 3]} barSize={22}>
                  {data.subjectProgress.map((item) => (
                    <Cell
                      key={item._id}
                      fill={item.completionPercentage < 50 ? '#f97316' : '#10b981'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState label="Approve lesson plans and record delivered topics to show syllabus velocity." />
        )}

        <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Lesson Plans
              </p>
              <span className="text-[10px] font-bold text-primary">{planTotal} Total</span>
            </div>
            {planTotal ? (
              <div className="mx-auto h-36 max-w-48">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={plans}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={42}
                      outerRadius={62}
                      paddingAngle={3}
                    >
                      {plans.map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '1rem',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="my-6 text-center text-xs text-slate-400">No plans submitted</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {plans.map((item) => (
              <div key={item.name} className="rounded-xl border border-slate-200 bg-white p-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <p className="text-[10px] font-semibold text-slate-500">{item.name}</p>
                </div>
                <p className="mt-1 text-base font-black text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

/** Faculty Teaching Workload Distribution and Overload Alerts. */
export function FacultyWorkloadPanel({ data }: { data: IHodDashboardData }) {
  const path = useRolePath();
  const workload = Number(data.workloadStats?.avgWeeklyHours ?? 0);
  const overloaded = Number(data.workloadStats?.overloadedFaculty ?? 0);
  const maxWeeklyHours = Number(data.workloadStats?.maxWeeklyHours ?? 0);
  const facultyAbsent = data.operations.facultyAbsentToday;

  return (
    <Panel
      title="Faculty teaching capacity"
      description="Weekly teaching load distribution, assigned hours, and workload thresholds"
      href={path('faculty-workload')}
      badge={overloaded ? `${overloaded} Overloaded` : 'Balanced'}
      className="xl:col-span-4"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Avg Weekly Load
            </p>
            <p className="mt-1 text-2xl font-black text-slate-950">{workload.toFixed(1)}h</p>
            <p className="mt-0.5 text-[10px] text-slate-500">Target: 14–18h / week</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Peak Faculty Load
            </p>
            <p className="mt-1 text-2xl font-black text-slate-950">{maxWeeklyHours.toFixed(1)}h</p>
            <p className="mt-0.5 text-[10px] text-slate-500">Highest assigned</p>
          </div>
        </div>

        {overloaded > 0 ? (
          <div className="flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50/80 p-3.5">
            <Flame className="size-5 shrink-0 text-orange-600" />
            <div>
              <p className="text-xs font-bold text-orange-950">
                {overloaded} faculty member{overloaded === 1 ? '' : 's'} above threshold
              </p>
              <p className="mt-0.5 text-[11px] text-orange-800">
                Exceeding 20 hours/week. Rebalancing subjects is recommended.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="size-4.5 text-emerald-600" />
            Faculty teaching distribution is balanced within guidelines.
          </div>
        )}

        {facultyAbsent > 0 && (
          <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50/80 p-3">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-rose-500" />
              <span className="text-xs font-bold text-rose-900">
                {facultyAbsent} Faculty member{facultyAbsent === 1 ? ' is' : 's are'} on leave today
              </span>
            </div>
            <Link
              href={path('faculty-attendance')}
              className="text-xs font-bold text-rose-700 underline"
            >
              Cover classes
            </Link>
          </div>
        )}
      </div>
    </Panel>
  );
}

/** Presents upcoming department examination commitments. */
export function ExamReadinessPanel({ data }: { data: IHodDashboardData }) {
  const path = useRolePath();
  return (
    <Panel
      title="Examination schedule"
      description="Upcoming department papers, examination venues, and start times"
      href={path('examination')}
      badge={data.upcomingExams.length ? `${data.upcomingExams.length} Scheduled` : undefined}
      className="xl:col-span-12"
    >
      {data.upcomingExams.length ? (
        <div className="space-y-2.5">
          {data.upcomingExams.slice(0, 5).map((exam, index) => (
            <div
              key={`${exam.subjectCode}-${exam.examDate}-${index}`}
              className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-3.5 transition-colors hover:bg-amber-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {exam.subjectCode} · {exam.subjectName}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-amber-800">
                    {exam.examType} · {exam.program} Sem {exam.semester}
                  </p>
                </div>
                <span className="shrink-0 rounded-xl border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-bold text-amber-900">
                  {new Date(exam.examDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
                <span className="inline-flex items-center gap-1 font-medium">
                  <Clock3 className="size-3.5 text-slate-400" /> {exam.startTime}
                </span>
                <span className="inline-flex items-center gap-1 font-medium">
                  <MapPin className="size-3.5 text-slate-400" /> {exam.venue || 'Main Hall'}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState label="No upcoming department examinations are currently scheduled." />
      )}
    </Panel>
  );
}

/** Explains today's teaching workflow and attendance recording progress. */
export function DailyOperationsPanel({ data }: { data: IHodDashboardData }) {
  const path = useRolePath();
  const scheduled = data.operations.scheduledClassesToday;
  const recorded = data.operations.attendanceRecordedToday;
  const pending = data.operations.attendancePendingToday;
  const completion = scheduled ? Math.min(100, Math.round((recorded / scheduled) * 100)) : 0;
  const items = [
    {
      label: 'Scheduled',
      value: scheduled,
      icon: BookOpenCheck,
      tone: 'bg-primary-50 text-primary',
    },
    {
      label: 'Recorded',
      value: recorded,
      icon: UserRoundCheck,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Pending',
      value: pending,
      icon: CalendarClock,
      tone: pending ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-600',
    },
    {
      label: 'Coverage / Subs',
      value: data.operations.substitutionsToday + data.operations.extraClassesToday,
      icon: UsersRound,
      tone: 'bg-violet-50 text-violet-700',
    },
  ];

  return (
    <Panel
      title="Today’s teaching workflow"
      description="Real-time attendance capture velocity and period coverage across the department"
      href={path('attendance')}
      badge={`${completion}% Recorded`}
      className="xl:col-span-12"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.55fr)]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 transition-colors hover:border-primary-200 hover:bg-white"
            >
              <span className={`flex size-9 items-center justify-center rounded-xl ${item.tone}`}>
                <item.icon className="size-4.5" />
              </span>
              <p className="mt-4 text-2xl font-black text-slate-900">{item.value}</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">{item.label}</p>
            </motion.div>
          ))}
        </div>
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4.5">
          <div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-slate-900">Attendance Capture</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  {recorded} of {scheduled} scheduled classes logged today.
                </p>
              </div>
              <strong className="text-2xl font-black text-primary">{completion}%</strong>
            </div>
            <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-200">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${completion}%` }}
                transition={{ duration: 0.75, ease: 'easeOut' }}
              />
            </div>
          </div>
          <Link
            href={path('attendance')}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-700"
          >
            Open Attendance Register <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </Panel>
  );
}

/** Compares published semester outcomes using pass rate and SGPA. */
export function AcademicOutcomesPanel({ data }: { data: IHodDashboardData }) {
  const path = useRolePath();
  const rows = (data.academicPerformance ?? []).map((item) => ({
    semester: `Sem ${item._id.semester}`,
    passRate: Number(item.passPercentage.toFixed(1)),
    sgpa: Number(item.averageSgpa.toFixed(2)),
  }));

  return (
    <Panel
      title="Academic outcomes & SGPA"
      description="Published semester outcomes: pass percentage and average SGPA"
      href={path('examination')}
      className="xl:col-span-8"
    >
      {rows.length ? (
        <div className="h-72 min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <ComposedChart data={rows} margin={{ top: 12, right: 12, left: -12, bottom: 4 }}>
              <CartesianGrid strokeDasharray="4 6" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="semester"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
              />
              <YAxis
                yAxisId="rate"
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
              />
              <YAxis
                yAxisId="sgpa"
                orientation="right"
                domain={[0, 10]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#8b5cf6' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '1rem',
                  fontSize: '12px',
                }}
              />
              <Bar
                yAxisId="rate"
                dataKey="passRate"
                name="Pass Rate"
                fill="#10b981"
                radius={[8, 8, 3, 3]}
                barSize={28}
              />
              <Line
                yAxisId="sgpa"
                type="monotone"
                dataKey="sgpa"
                name="Average SGPA"
                stroke="#8b5cf6"
                strokeWidth={3}
                dot={{ r: 4, fill: '#ffffff', stroke: '#8b5cf6', strokeWidth: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState label="Published semester results will activate pass-rate and SGPA comparison." />
      )}
    </Panel>
  );
}

/** Shows how department students are distributed across cohorts. */
export function CohortCompositionPanel({ data }: { data: IHodDashboardData }) {
  const path = useRolePath();
  const cohorts = [...(data.sectionStrength ?? [])].sort((a, b) => b.studentCount - a.studentCount);
  const total = cohorts.reduce((sum, item) => sum + item.studentCount, 0);
  const colors = ['#0178D7', '#8b5cf6', '#10b981', '#f59e0b', '#38bdf8', '#fb7185'];

  return (
    <Panel
      title="Cohort distribution"
      description="Active student strength by program, semester, and section"
      href={path('student-management')}
      className="xl:col-span-4"
    >
      {cohorts.length && total ? (
        <>
          <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100 flex">
            {cohorts.map((item, index) => {
              const widthPct = (item.studentCount / total) * 100;
              return (
                <div
                  key={`${item._id.program}-${item._id.semester}-${item._id.section}`}
                  style={{ width: `${widthPct}%`, backgroundColor: colors[index % colors.length] }}
                  title={`${item._id.program} S${item._id.semester}-${item._id.section}: ${item.studentCount} (${widthPct.toFixed(0)}%)`}
                  className="h-full"
                />
              );
            })}
          </div>
          <div className="mt-4 space-y-2">
            {cohorts.slice(0, 6).map((item, index) => (
              <div
                key={`${item._id.program}-${item._id.semester}-${item._id.section}`}
                className="flex items-center gap-2 text-xs"
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span className="min-w-0 flex-1 truncate font-medium text-slate-700">
                  {item._id.program} · Sem {item._id.semester} · Section {item._id.section}
                </span>
                <strong className="text-slate-900">{item.studentCount}</strong>
                <span className="w-10 text-right font-semibold text-slate-400">
                  {((item.studentCount / total) * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <EmptyState label="Cohort strength appears after active students are allotted to sections." />
      )}
    </Panel>
  );
}

/** Meetings & Department Events Panel */
export function DepartmentMeetingsEventsPanel({ data }: { data: IHodDashboardData }) {
  const path = useRolePath();
  const meetings = data.scheduledMeetings ?? [];
  const events = data.upcomingEvents ?? [];

  return (
    <Panel
      title="Meetings & Department Events"
      description="Scheduled department syncs, faculty meetings, and upcoming academic events"
      href={path('meeting')}
      badge={`${meetings.length + events.length} Active`}
      className="xl:col-span-8"
    >
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Meetings */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Department Meetings
            </h3>
            <Link
              href={path('meeting')}
              className="text-xs font-semibold text-primary hover:underline"
            >
              View all ({meetings.length})
            </Link>
          </div>
          {meetings.length ? (
            <div className="space-y-2">
              {meetings.slice(0, 4).map((m, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {m.title || 'Department Meeting'}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {m.scheduledAt
                        ? new Date(m.scheduledAt).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Date not set'}
                      {m.venue ? ` · ${m.venue}` : ''}
                    </p>
                  </div>
                  {m.mode && (
                    <span className="shrink-0 rounded-lg bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                      {m.mode}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-slate-400">No scheduled meetings</p>
          )}
        </div>

        {/* Events */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Department Events
            </h3>
            <Link
              href={path('event')}
              className="text-xs font-semibold text-primary hover:underline"
            >
              View all ({events.length})
            </Link>
          </div>
          {events.length ? (
            <div className="space-y-2">
              {events.slice(0, 4).map((e, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {e.title || 'Event'}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {e.startDate
                        ? new Date(e.startDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                          })
                        : 'Date TBD'}
                      {e.venue ? ` · ${e.venue}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                    Event
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-slate-400">No upcoming events</p>
          )}
        </div>
      </div>
    </Panel>
  );
}

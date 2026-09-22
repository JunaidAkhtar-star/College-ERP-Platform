/**
 * @file InstitutionCommandCenter.tsx
 * @description Responsive, tenant-scoped executive dashboard for institution Admin and Super Admin.
 * @module features/dashboard/institution-admin
 */
'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'nextjs-toploader/app';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  Megaphone,
  IndianRupee,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import type {
  AnyRecord,
  IAttendance,
  IFeesQuarter,
  ITrendPoint,
  IUpcomingEvent,
} from '../views/shared';
import { fmtDateTime, fmtRupees, useRolePath } from '../views/shared';

interface IAdmissionSummary {
  _id?: string;
  applicantName?: string;
  applicationNumber?: string;
  program?: string;
  status?: string;
}

interface IRoleSummary {
  _id?: string;
  count?: number;
}

interface ITodoSummary {
  label: string;
  count: number;
  status: string;
  link: string;
}

interface IMetricSignalProps {
  label: string;
  percentage: number;
}

const tooltipStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  background: '#ffffff',
  fontSize: 11,
};

/** Converts backend role codes into readable chart labels. */
function formatRoleLabel(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Displays a compact empty state without reserving unnecessary dashboard height. */
function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-28 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-5 text-center text-xs leading-5 text-slate-500">
      {label}
    </div>
  );
}

/** Shows a truthful compact ratio without manufacturing historical trend data. */
function MetricSignal({ label, percentage }: IMetricSignalProps) {
  const safePercentage = Math.min(100, Math.max(0, percentage));
  const filledSegments = Math.round(safePercentage / 10);

  return (
    <div className="mt-3 border-t border-slate-200/80 pt-3">
      <div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-semibold">
        <span className="truncate text-slate-500">{label}</span>
        <span className="shrink-0 text-slate-700">{safePercentage.toFixed(0)}%</span>
      </div>
      <div
        className="grid grid-cols-10 gap-1"
        aria-label={`${label}: ${safePercentage.toFixed(0)}%`}
      >
        {Array.from({ length: 10 }, (_, index) => (
          <motion.span
            key={index}
            initial={{ opacity: 0.25, scaleX: 0.65 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: index * 0.025, duration: 0.2 }}
            className={`h-1.5 rounded-full ${
              index < filledSegments ? 'bg-primary/70' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/** Light dashboard panel with a simple border and an optional governed module action. */
function Panel({
  title,
  description,
  children,
  onOpen,
  className = '',
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onOpen?: () => void;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">{title}</h2>
          {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
        </div>
        {onOpen && (
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-sky-50 px-3 py-2 text-[11px] font-semibold text-primary transition hover:bg-sky-100"
          >
            View <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

/** Renders the complete institution command center using only dashboard API data. */
export default function InstitutionCommandCenter({ d }: { d: AnyRecord }) {
  const router = useRouter();
  const [hoveredWorkforceIndex, setHoveredWorkforceIndex] = useState<number | null>(null);
  const [hoveredAttendanceIndex, setHoveredAttendanceIndex] = useState<number | null>(null);
  const [hoveredAcademicIndex, setHoveredAcademicIndex] = useState<number | null>(null);
  const path = useRolePath();
  const attendance = (d.attendance as IAttendance | undefined) ?? {};
  const studentAttendance = attendance.students;
  const earnings = (d.earningsTrend as ITrendPoint[] | undefined) ?? [];
  const expenses = (d.expensesTrend as ITrendPoint[] | undefined) ?? [];
  const feeQuarters = (d.feesCollection as IFeesQuarter[] | undefined) ?? [];
  const admissions = (d.recentAdmissions as IAdmissionSummary[] | undefined) ?? [];
  const events = (d.upcomingEvents as IUpcomingEvent[] | undefined) ?? [];
  const roleCounts = (d.userBreakdown as IRoleSummary[] | undefined) ?? [];
  const todos = (d.todo as ITodoSummary[] | undefined) ?? [];
  const performance =
    (d.performance as { top?: number; average?: number; belowAverage?: number } | undefined) ?? {};

  const financeTrend = earnings.map((point, index) => ({
    label: point.label,
    income: Number(point.value ?? 0),
    expense: Number(expenses[index]?.value ?? 0),
  }));
  const attendanceData = [
    { name: 'Present', value: Number(studentAttendance?.present ?? 0), color: '#27ae7d' },
    { name: 'Absent', value: Number(studentAttendance?.absent ?? 0), color: '#ef6b7b' },
    { name: 'Late', value: Number(studentAttendance?.late ?? 0), color: '#f2b84b' },
    { name: 'Other', value: Number(studentAttendance?.emergency ?? 0), color: '#64a6f3' },
  ].filter((item) => item.value > 0);
  const academicData = [
    { name: 'High performers', value: Number(performance.top ?? 0), fill: '#6d7df2' },
    { name: 'On track', value: Number(performance.average ?? 0), fill: '#59c3b0' },
    { name: 'Needs support', value: Number(performance.belowAverage ?? 0), fill: '#f29c9c' },
  ];
  const collected = Number(d.totalFeesCollected ?? 0);
  const outstanding = Number(d.totalOutstanding ?? 0);
  const collectionRate =
    collected + outstanding > 0 ? (collected / (collected + outstanding)) * 100 : 0;
  const pendingActions = todos.filter((item) => item.status !== 'completed' && item.count > 0);
  const pendingDecisionCount = pendingActions.reduce((sum, item) => sum + item.count, 0);
  const workforceColors = [
    { color: '#4f8ee8', dot: 'bg-blue-500' },
    { color: '#59c3b0', dot: 'bg-teal-400' },
    { color: '#8b7de8', dot: 'bg-violet-500' },
    { color: '#f0ad4e', dot: 'bg-amber-500' },
    { color: '#ef7f8f', dot: 'bg-rose-400' },
    { color: '#4eb7d8', dot: 'bg-cyan-500' },
    { color: '#7abf73', dot: 'bg-green-500' },
    { color: '#d58ad6', dot: 'bg-fuchsia-400' },
  ];
  const workforceData = roleCounts.slice(0, 8).map((item, index) => ({
    name: formatRoleLabel(item._id ?? 'Unassigned'),
    value: Number(item.count ?? 0),
    color: workforceColors[index]?.color ?? '#4f8ee8',
    dot: workforceColors[index]?.dot ?? 'bg-blue-500',
  }));
  const workforceTotal = workforceData.reduce((sum, item) => sum + item.value, 0);
  const hasAttendance = attendanceData.length > 0;
  const hasAcademicPerformance = academicData.some((item) => item.value > 0);
  const hasFeeActivity = collected > 0 || outstanding > 0 || feeQuarters.length > 0;
  const missingAnalytics = [
    !hasAttendance
      ? {
          label: 'Attendance is awaiting today’s records',
          action: 'Open attendance',
          route: 'attendance',
          icon: UserCheck,
          tone: 'bg-blue-50 text-blue-700',
        }
      : null,
    !hasAcademicPerformance
      ? {
          label: 'Academic analytics require published results',
          action: 'Open examinations',
          route: 'examination',
          icon: GraduationCap,
          tone: 'bg-violet-50 text-violet-700',
        }
      : null,
    !hasFeeActivity
      ? {
          label: 'Fee analytics require invoices or payments',
          action: 'Open fee workspace',
          route: 'fee',
          icon: IndianRupee,
          tone: 'bg-emerald-50 text-emerald-700',
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  const metrics = [
    {
      label: 'Students',
      value: Number(d.totalStudents ?? 0),
      detail: `${Number(d.activeStudents ?? 0).toLocaleString('en-IN')} active`,
      surface: 'bg-white',
      route: 'student-management',
      illustration: '/dashboard/kpis/students.png',
      signalLabel: 'Active students',
      signalPercentage:
        Number(d.totalStudents ?? 0) > 0
          ? (Number(d.activeStudents ?? 0) / Number(d.totalStudents)) * 100
          : 0,
    },
    {
      label: 'Faculty',
      value: Number(d.totalFaculty ?? 0),
      detail: `${Number(d.activeFaculty ?? 0).toLocaleString('en-IN')} active`,
      surface: 'bg-white',
      route: 'faculty-management',
      illustration: '/dashboard/kpis/faculty.png',
      signalLabel: 'Active faculty',
      signalPercentage:
        Number(d.totalFaculty ?? 0) > 0
          ? (Number(d.activeFaculty ?? 0) / Number(d.totalFaculty)) * 100
          : 0,
    },
    {
      label: 'Staff',
      value: Number(d.totalStaff ?? 0),
      detail: `${Number(d.activeStaff ?? 0).toLocaleString('en-IN')} active`,
      surface: 'bg-white',
      route: 'hr',
      illustration: '/dashboard/kpis/staff.png',
      signalLabel: 'Active staff',
      signalPercentage:
        Number(d.totalStaff ?? 0) > 0
          ? (Number(d.activeStaff ?? 0) / Number(d.totalStaff)) * 100
          : 0,
    },
    {
      label: 'Subjects',
      value: Number(d.totalSubjects ?? 0),
      detail: `${Number(d.activeSubjects ?? 0).toLocaleString('en-IN')} active`,
      surface: 'bg-white',
      route: 'subjects',
      illustration: '/dashboard/kpis/subjects.png',
      signalLabel: 'Active subjects',
      signalPercentage:
        Number(d.totalSubjects ?? 0) > 0
          ? (Number(d.activeSubjects ?? 0) / Number(d.totalSubjects)) * 100
          : 0,
    },
    {
      label: 'Admissions',
      value: Number(d.activeAdmissions ?? 0),
      detail: `${Number(d.pendingAdmissions ?? 0).toLocaleString('en-IN')} awaiting review`,
      surface: 'bg-white',
      route: 'admission',
      illustration: '/dashboard/kpis/admissions.png',
      signalLabel: 'Processed pipeline',
      signalPercentage:
        Number(d.activeAdmissions ?? 0) + Number(d.pendingAdmissions ?? 0) > 0
          ? (Number(d.activeAdmissions ?? 0) /
              (Number(d.activeAdmissions ?? 0) + Number(d.pendingAdmissions ?? 0))) *
            100
          : 0,
    },
    {
      label: 'Fees collected',
      value: collected,
      detail: `${collectionRate.toFixed(0)}% collection efficiency`,
      surface: 'bg-white',
      route: 'fee',
      illustration: '/dashboard/kpis/fees-rupee.png',
      currency: true,
      signalLabel: 'Collection efficiency',
      signalPercentage: collectionRate,
    },
  ];
  const nextEvent = events[0];

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r from-sky-50 via-white to-violet-50 p-5 sm:p-6 lg:min-h-72 lg:pr-[45%]">
        <div className="relative z-10 max-w-xl py-1 sm:py-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
            <LayoutDashboard className="h-3.5 w-3.5" /> Institution command center
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Your institution at a glance
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
            Prioritize decisions across academics, people, admissions and finance using live
            institution records.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              ['Admissions', 'admission', ClipboardCheck],
              ['Accounts', 'accounts', Landmark],
              ['Notices', 'notice', Megaphone],
              ['Reports', 'report-center', TrendingUp],
            ].map(([label, route, Icon]) => {
              const ActionIcon = Icon as React.ComponentType<{ className?: string }>;
              return (
                <button
                  key={String(label)}
                  type="button"
                  onClick={() => router.push(path(String(route)))}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-primary/30 hover:bg-sky-100 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98]"
                >
                  <ActionIcon className="h-4 w-4" /> {String(label)}
                </button>
              );
            })}
          </div>
        </div>
        <div className="relative mt-3 h-48 w-full sm:h-56 lg:absolute lg:inset-y-2 lg:right-3 lg:mt-0 lg:h-auto lg:w-[43%]">
          <Image
            src="/dashboard/institution-command-center-v2.png"
            alt="Institution leaders and students reviewing university analytics"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 43vw"
            className="object-contain object-center lg:object-right"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {metrics.map((metric, index) => (
          <motion.button
            key={metric.label}
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            onClick={() => router.push(path(metric.route))}
            className={`group relative min-h-44 overflow-hidden rounded-3xl border border-slate-200 p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-0 ${metric.surface}`}
          >
            <span className="pointer-events-none absolute right-2 top-2 h-32 w-32 opacity-100">
              <Image
                src={metric.illustration}
                alt=""
                fill
                sizes="128px"
                className="object-contain object-right-top"
              />
            </span>
            <div className="relative z-10">
              <p className="text-2xl font-semibold tracking-tight text-slate-900">
                {metric.currency ? fmtRupees(metric.value) : metric.value.toLocaleString('en-IN')}
              </p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {metric.label}
              </p>
              <p className="mt-2 text-xs text-slate-500">{metric.detail}</p>
              <MetricSignal label={metric.signalLabel} percentage={metric.signalPercentage} />
            </div>
          </motion.button>
        ))}
      </div>

      <section className="grid items-stretch gap-4 xl:grid-cols-12">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.17, duration: 0.3 }}
          className="rounded-3xl border border-slate-200 bg-white p-5 xl:col-span-7"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
                Priority focus
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">What needs attention</h2>
            </div>
            <div className="relative h-20 w-20 shrink-0">
              <Image
                src="/dashboard/cards/priority-workflow.png"
                alt="Administrator reviewing institution priorities"
                fill
                sizes="80px"
                className="object-contain"
              />
            </div>
          </div>
          <div className="mt-4 divide-y divide-slate-200">
            {[
              ['Admission reviews', Number(d.pendingAdmissions ?? 0), 'admission'],
              ['Decision items', pendingDecisionCount, pendingActions[0]?.link ?? 'task'],
              ['Outstanding fees', fmtRupees(outstanding), 'fee'],
            ].map(([label, value, route]) => (
              <button
                key={String(label)}
                type="button"
                onClick={() => router.push(path(String(route)))}
                className="group flex min-h-14 w-full items-center justify-between gap-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span className="text-xs font-medium text-slate-600">{String(label)}</span>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
                  <ArrowRight className="h-3.5 w-3.5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-primary" />
                </span>
              </button>
            ))}
          </div>
        </motion.div>

        <motion.button
          type="button"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.3 }}
          onClick={() => router.push(path('event'))}
          className="group min-h-52 overflow-hidden rounded-3xl border border-slate-200 bg-violet-50 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary xl:col-span-5"
        >
          <span className="flex items-center justify-between border-b border-violet-200 px-5 py-4">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-violet-800">
              <CalendarDays className="h-4 w-4" /> Next on schedule
            </span>
            <ArrowRight className="h-4 w-4 text-violet-400 transition group-hover:translate-x-1" />
          </span>
          <span className="relative block min-h-44 p-5 pr-28">
            <strong className="relative z-10 block text-lg font-semibold leading-6 text-slate-900">
              {nextEvent?.title ?? 'Schedule is currently clear'}
            </strong>
            <span className="relative z-10 mt-3 block text-xs leading-5 text-slate-600">
              {nextEvent?.startDate
                ? fmtDateTime(nextEvent.startDate)
                : 'No approved upcoming institution events.'}
            </span>
            {nextEvent?.venue && (
              <span className="relative z-10 mt-2 block text-xs font-medium text-violet-700">
                {nextEvent.venue}
              </span>
            )}
            <span className="relative z-10 mt-5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {events.length.toLocaleString('en-IN')} upcoming events
            </span>
            <span className="absolute bottom-1 right-1 h-36 w-28">
              <Image
                src="/dashboard/cards/event-schedule.png"
                alt="Student organizing the institution event schedule"
                fill
                sizes="112px"
                className="object-contain object-bottom"
              />
            </span>
          </span>
        </motion.button>
      </section>

      <div className="grid gap-4 xl:grid-cols-12">
        <Panel
          title="Financial movement"
          description="Recorded income and expense movement across recent months"
          onOpen={() => router.push(path('accounts'))}
          className="xl:col-span-8"
        >
          {financeTrend.some((item) => item.income > 0 || item.expense > 0) ? (
            <div>
              <div className="mb-2 flex flex-wrap gap-4 text-[10px] font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500" /> Income
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-400" /> Expense
                </span>
              </div>
              <div className="h-64 sm:h-72">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <AreaChart data={financeTrend} margin={{ left: -10, right: 8, top: 10 }}>
                    <defs>
                      <linearGradient id="incomeArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f8ee8" stopOpacity={0.34} />
                        <stop offset="100%" stopColor="#4f8ee8" stopOpacity={0.03} />
                      </linearGradient>
                      <linearGradient id="expenseArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef7f8f" stopOpacity={0.26} />
                        <stop offset="100%" stopColor="#ef7f8f" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#eef3f8" />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area
                      type="monotone"
                      dataKey="income"
                      stroke="#4f8ee8"
                      fill="url(#incomeArea)"
                      strokeWidth={2.5}
                      activeDot={{ r: 5, strokeWidth: 3, stroke: '#ffffff' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="expense"
                      stroke="#ef7f8f"
                      fill="url(#expenseArea)"
                      strokeWidth={2.5}
                      activeDot={{ r: 5, strokeWidth: 3, stroke: '#ffffff' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <EmptyState label="Financial trends will appear when income and expense transactions are posted." />
          )}
        </Panel>

        <Panel
          title="Decisions requiring attention"
          description="Only active exceptions and pending work"
          className="xl:col-span-4"
        >
          {pendingActions.length ? (
            <div className="space-y-2">
              {pendingActions.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => router.push(path(item.link))}
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-amber-50 p-3 text-left transition hover:bg-amber-100"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-amber-700">
                    <Activity className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-slate-800">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-slate-500">
                      Open governed workflow
                    </span>
                  </span>
                  <strong className="text-lg text-amber-800">{item.count}</strong>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-emerald-50 p-5 text-center">
              <p className="text-sm font-semibold text-emerald-800">
                No pending executive decisions
              </p>
              <p className="mt-1 text-xs text-emerald-700">All current action queues are clear.</p>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {hasAttendance && (
          <Panel
            title="Student attendance"
            description="Today’s recorded attendance"
            onOpen={() => router.push(path('attendance'))}
          >
            <div className="grid min-h-56 grid-cols-[1fr_1.1fr] items-center gap-3">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={attendanceData}
                      dataKey="value"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={3}
                      cornerRadius={5}
                      stroke="none"
                      onMouseEnter={(_, index) => setHoveredAttendanceIndex(index)}
                      onMouseLeave={() => setHoveredAttendanceIndex(null)}
                    >
                      {attendanceData.map((item, index) => (
                        <Cell
                          key={item.name}
                          fill={
                            hoveredAttendanceIndex === null || hoveredAttendanceIndex === index
                              ? item.color
                              : '#e2e8f0'
                          }
                          className="transition-colors duration-200"
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-semibold text-slate-900">
                  {Number(studentAttendance?.percentage ?? 0).toFixed(1)}%
                </p>
                <p className="text-xs text-slate-500">Overall recorded attendance</p>
                {attendanceData.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                  >
                    <span className="text-slate-600">{item.name}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        )}

        {hasAcademicPerformance && (
          <Panel
            title="Academic performance"
            description="Published result distribution"
            onOpen={() => router.push(path('examination'))}
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={academicData} margin={{ left: -20, right: 8, top: 10 }}>
                  <CartesianGrid vertical={false} stroke="#eef3f8" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar
                    dataKey="value"
                    radius={[10, 10, 4, 4]}
                    maxBarSize={54}
                    onMouseEnter={(_, index) => setHoveredAcademicIndex(index)}
                    onMouseLeave={() => setHoveredAcademicIndex(null)}
                  >
                    {academicData.map((item, index) => (
                      <Cell
                        key={item.name}
                        fill={
                          hoveredAcademicIndex === null || hoveredAcademicIndex === index
                            ? item.fill
                            : '#e2e8f0'
                        }
                        className="transition-colors duration-200"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        )}

        {hasFeeActivity && (
          <Panel
            title="Fee collection"
            description={`${fmtRupees(outstanding)} currently outstanding`}
            onOpen={() => router.push(path('fee'))}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-emerald-50 p-4">
                <p className="text-[10px] font-bold uppercase text-emerald-700">Collected</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">{fmtRupees(collected)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-rose-50 p-4">
                <p className="text-[10px] font-bold uppercase text-rose-700">Outstanding</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {fmtRupees(outstanding)}
                </p>
              </div>
            </div>
            {feeQuarters.length > 0 && (
              <div className="mt-4 h-44">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={feeQuarters} margin={{ left: -20, right: 8 }}>
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 9 }}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="total" fill="#dbeafe" radius={[5, 5, 0, 0]} />
                    <Bar dataKey="collected" fill="#5a9bea" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>
        )}

        {missingAnalytics.length > 0 && (
          <Panel
            title="Data readiness"
            description="Complete these source workflows to unlock additional analytics"
            className={
              missingAnalytics.length === 3
                ? 'lg:col-span-2 xl:col-span-3'
                : missingAnalytics.length === 2
                  ? 'lg:col-span-2'
                  : ''
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {missingAnalytics.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => router.push(path(item.route))}
                  className="flex min-h-24 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:bg-sky-50"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.tone}`}
                  >
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold leading-5 text-slate-800">
                      {item.label}
                    </span>
                    <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
                      {item.action} <ArrowRight className="h-3 w-3" />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </Panel>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <Panel
          title="Workforce and users"
          description="Active accounts by role"
          onOpen={() => router.push(path('users'))}
        >
          {workforceData.length ? (
            <div className="grid min-h-72 items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(150px,0.8fr)]">
              <div className="relative h-60 min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={workforceData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={66}
                      outerRadius={94}
                      paddingAngle={3}
                      cornerRadius={6}
                      stroke="none"
                      onMouseEnter={(_, index) => setHoveredWorkforceIndex(index)}
                      onMouseLeave={() => setHoveredWorkforceIndex(null)}
                    >
                      {workforceData.map((item, index) => (
                        <Cell
                          key={item.name}
                          fill={
                            hoveredWorkforceIndex === null || hoveredWorkforceIndex === index
                              ? item.color
                              : '#e2e8f0'
                          }
                          className="transition-colors duration-200"
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <strong className="text-2xl font-semibold text-slate-900">
                    {workforceTotal.toLocaleString('en-IN')}
                  </strong>
                  <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Active users
                  </span>
                </div>
              </div>
              <div className="divide-y divide-slate-200">
                {workforceData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 py-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.dot}`} />
                    <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-slate-600">
                      {item.name}
                    </span>
                    <strong className="text-xs text-slate-900">
                      {item.value.toLocaleString('en-IN')}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState label="Role distribution will appear after active accounts are assigned." />
          )}
        </Panel>

        <Panel
          title="Recent admissions"
          description="Latest applications entering the institution pipeline"
          onOpen={() => router.push(path('admission'))}
        >
          {admissions.length ? (
            <div className="space-y-2">
              {admissions.slice(0, 6).map((item, index) => (
                <button
                  key={item._id ?? index}
                  type="button"
                  onClick={() =>
                    router.push(item._id ? path(`admission/${item._id}`) : path('admission'))
                  }
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-blue-50 p-3 text-left transition hover:bg-blue-100"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-700">
                    <GraduationCap className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-slate-800">
                      {item.applicantName ?? 'Applicant'}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                      {item.program ?? item.applicationNumber ?? 'Application'}
                    </span>
                  </span>
                  <span className="rounded-lg bg-white px-2 py-1 text-[10px] font-semibold capitalize text-blue-700">
                    {(item.status ?? 'new').replaceAll('_', ' ')}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState label="No recent admission applications are currently available." />
          )}
        </Panel>

        <Panel
          title="Upcoming institution events"
          description="Approved events and scheduled engagement"
          onOpen={() => router.push(path('event'))}
        >
          {events.length ? (
            <div className="space-y-2">
              {events.slice(0, 6).map((event, index) => (
                <div
                  key={event._id ?? index}
                  className="flex gap-3 rounded-2xl border border-slate-200 bg-violet-50 p-3"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700">
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800">
                      {event.title ?? 'Institution event'}
                    </p>
                    <p className="mt-1 text-[10px] leading-4 text-slate-500">
                      {fmtDateTime(event.startDate)}
                      {event.venue ? ` · ${event.venue}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label="No approved upcoming institution events are scheduled." />
          )}
        </Panel>
      </div>
    </div>
  );
}

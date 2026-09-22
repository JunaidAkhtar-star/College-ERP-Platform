'use client';

import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  FileBarChart,
  GraduationCap,
  Library,
  Megaphone,
  School,
  Users,
} from 'lucide-react';
import { useRouter } from 'nextjs-toploader/app';
import { motion } from '@/shared/utils/motion';
import { useLayoutStore } from '@/shared/store/layoutStore';
import RecordsDateRangePicker from '@/features/role-wise-features/attendance/components/common/RecordsDateRangePicker';
import { localDateKey } from '@/features/role-wise-features/attendance/utils/attendance.helpers';
import AsyncSelect from '@/shared/core/AsyncSelect';
import type { AnyRecord, INotice } from '../views/shared';
import { fmtDate, useRolePath } from '../views/shared';
import { ReferenceEmpty, referenceNumber } from './reference-ui';

interface ICourse {
  _id?: string;
  name?: string;
  avgCompletion?: number;
}
interface IAttendance {
  _id?: string;
  name?: string;
  avgAttendance?: number;
  shortageCount?: number;
}
interface IEvent {
  _id?: string;
  title?: string;
  startDate?: string;
  venue?: string;
}
interface IProgramEnrollment {
  name: string;
  students: number;
}
interface IAttendanceTrend {
  date: string;
  percentage: number | null;
}
interface ICgpaDistribution {
  range: string;
  students: number;
}
interface IFacultyWorkload {
  facultyId?: string;
  name: string;
  department: string;
  teachingHours: number;
  totalHours: number;
  assignments: number;
}
interface IPendingApprovals {
  leaveRequests?: number;
  timetables?: number;
  facultyWorkloads?: number;
  markVerifications?: number;
}
interface IAcademicContext {
  academicYear?: string;
  semesterType?: string;
  semester?: number;
}
interface IAcademicPerformance {
  averageCgpa?: number | null;
  passPercentage?: number | null;
  publishedResults?: number;
}
interface IClassScheduleDay {
  day: string;
  classes: number;
}
interface IPanelProps {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
  className?: string;
  children: React.ReactNode;
}

const tooltipStyle = { border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 };
const chartColors = ['#4f46e5', '#7c3aed', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];
const chartDotClasses = [
  'bg-indigo-600',
  'bg-violet-600',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-pink-500',
  'bg-cyan-500',
];

const noticePriorityTones = {
  urgent: {
    card: 'border-rose-100 bg-gradient-to-r from-white to-rose-50/60 hover:border-rose-200',
    icon: 'bg-rose-100 text-rose-700',
    badge: 'bg-rose-100 text-rose-700',
  },
  high: {
    card: 'border-amber-100 bg-gradient-to-r from-white to-amber-50/60 hover:border-amber-200',
    icon: 'bg-amber-100 text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
  },
  normal: {
    card: 'border-cyan-100 bg-gradient-to-r from-white to-cyan-50/50 hover:border-cyan-200',
    icon: 'bg-cyan-100 text-cyan-700',
    badge: 'bg-cyan-100 text-cyan-700',
  },
  low: {
    card: 'border-slate-200 bg-gradient-to-r from-white to-slate-50 hover:border-slate-300',
    icon: 'bg-slate-100 text-slate-600',
    badge: 'bg-slate-100 text-slate-600',
  },
} as const;

function noticePriorityTone(priority?: string) {
  const normalized = (priority ?? 'normal').trim().toLowerCase();
  if (normalized === 'urgent' || normalized === 'critical') return noticePriorityTones.urgent;
  if (normalized === 'high') return noticePriorityTones.high;
  if (normalized === 'low') return noticePriorityTones.low;
  return noticePriorityTones.normal;
}

function Panel({ title, subtitle, action, onAction, className = '', children }: IPanelProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors duration-300 hover:border-slate-300 ${className}`}
    >
      <header className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3.5 py-3 sm:px-4">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            {action} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1 p-3.5 sm:p-4">{children}</div>
    </motion.section>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone,
  color,
  series,
}: {
  label: string;
  value: React.ReactNode;
  detail: string;
  icon: React.ReactNode;
  tone: string;
  color: string;
  series: number[];
}) {
  const gradientId = `metric-${label.toLowerCase().replaceAll(' ', '-')}`;
  const sparkline = series.map((value, index) => ({ index, value }));
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex min-h-28 flex-col justify-between overflow-hidden rounded-xl border border-slate-200 bg-white p-3.5 transition-colors duration-300 hover:border-indigo-200"
    >
      <div>
        <div className="flex items-center gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}
          >
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-600">{label}</p>
            <p className="mt-0.5 text-xl font-bold leading-tight tracking-tight text-slate-950 sm:text-2xl">
              {value}
            </p>
          </div>
        </div>
        <p className="mt-2 truncate text-xs font-medium text-emerald-600">{detail}</p>
      </div>
      <div className="mt-1 h-7 sm:h-8">
        {sparkline.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={sparkline} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={1.8}
                fill={`url(#${gradientId})`}
                dot={false}
                isAnimationActive
                animationDuration={800}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="mt-2 h-px w-full bg-slate-100" />
        )}
      </div>
    </motion.article>
  );
}

function compactDate(value?: string) {
  if (!value) return { month: '—', day: '—' };
  const date = new Date(value);
  return {
    month: date.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase(),
    day: date.toLocaleDateString('en-IN', { day: '2-digit' }),
  };
}

export default function DeanAcademicDashboard({ d }: { d: AnyRecord }) {
  const router = useRouter();
  const path = useRolePath();
  const courses = (d.courseCompletionStats as ICourse[] | undefined) ?? [];
  const attendance = (d.deptAttendance as IAttendance[] | undefined) ?? [];
  const events = (d.upcomingEvents as IEvent[] | undefined) ?? [];
  const notices = (d.notices as INotice[] | undefined) ?? [];
  const enrolment = (d.programEnrollment as IProgramEnrollment[] | undefined) ?? [];
  const attendanceTrend = (d.attendanceTrend as IAttendanceTrend[] | undefined) ?? [];
  const cgpaDistribution = (d.cgpaDistribution as ICgpaDistribution[] | undefined) ?? [];
  const facultyWorkload = (d.facultyWorkloadDetail as IFacultyWorkload[] | undefined) ?? [];
  const classScheduleByDay = (d.classScheduleByDay as IClassScheduleDay[] | undefined) ?? [];
  const scheduleWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(
    (day) => ({
      day,
      classes: Number(
        classScheduleByDay.find((item) =>
          item.day.toLowerCase().startsWith(day.slice(0, 3).toLowerCase()),
        )?.classes ?? 0,
      ),
    }),
  );
  const busiestScheduleDay = scheduleWeek.reduce(
    (busiest, item) => (item.classes > busiest.classes ? item : busiest),
    scheduleWeek[0],
  );
  const maxDailyClasses = Math.max(...scheduleWeek.map((item) => item.classes), 1);
  const approvals = (d.pendingApprovals as IPendingApprovals | undefined) ?? {};
  const context = (d.academicContext as IAcademicContext | null | undefined) ?? null;
  const academic = (d.academicPerformance as IAcademicPerformance | null | undefined) ?? null;
  const completion = Number(d.overallAvgCompletion ?? 0);
  const totalEnrolled = enrolment.reduce((sum, item) => sum + item.students, 0);
  const validTrendPoints = attendanceTrend.filter(
    (item): item is IAttendanceTrend & { percentage: number } => item.percentage != null,
  );
  const averageAttendance = attendance.length
    ? attendance.reduce((sum, item) => sum + Number(item.avgAttendance ?? 0), 0) / attendance.length
    : validTrendPoints.length
      ? validTrendPoints.reduce((sum, item) => sum + item.percentage, 0) / validTrendPoints.length
      : null;
  const shortageCount = attendance.reduce((sum, item) => sum + Number(item.shortageCount ?? 0), 0);
  const todayKey = localDateKey(new Date());
  const reportingWindowStart = new Date();
  reportingWindowStart.setDate(reportingWindowStart.getDate() - 29);
  const reportingStart = localDateKey(reportingWindowStart);
  const reportingEnd = todayKey;
  const [selectedStartDate, setSelectedStartDate] = React.useState(reportingStart);
  const [selectedEndDate, setSelectedEndDate] = React.useState(reportingEnd);
  const [selectedAcademicYear, setSelectedAcademicYear] = React.useState(
    context?.academicYear ?? '',
  );
  const [selectedSemester, setSelectedSemester] = React.useState(
    context?.semester ? String(context.semester) : '',
  );
  const filteredAttendanceTrend = attendanceTrend.filter(
    (item) =>
      (!selectedStartDate || item.date >= selectedStartDate) &&
      (!selectedEndDate || item.date <= selectedEndDate),
  );
  const approvalItems = [
    [
      'Leave applications',
      approvals.leaveRequests ?? 0,
      CalendarDays,
      'bg-indigo-50 text-indigo-600',
    ],
    ['Timetables', approvals.timetables ?? 0, CalendarRange, 'bg-rose-50 text-rose-600'],
    ['Faculty workloads', approvals.facultyWorkloads ?? 0, Users, 'bg-amber-50 text-amber-600'],
    [
      'Mark verification',
      approvals.markVerifications ?? 0,
      ClipboardCheck,
      'bg-cyan-50 text-cyan-600',
    ],
  ] as const;
  const totalPending = approvalItems.reduce((sum, item) => sum + item[1], 0);
  const clearedApprovalQueues = approvalItems.filter((item) => item[1] === 0).length;
  const leadingProgram = enrolment.reduce<IProgramEnrollment | null>(
    (leader, item) => (!leader || item.students > leader.students ? item : leader),
    null,
  );
  const riskRate = Number(d.totalStudents)
    ? Math.min((shortageCount / Number(d.totalStudents)) * 100, 100)
    : 0;
  const healthyAttendanceStudents = Math.max(Number(d.totalStudents ?? 0) - shortageCount, 0);
  const alertItems = [
    ['Attendance shortage', shortageCount, '#fb7185', 'bg-rose-400'],
    ['Upcoming examinations', Number(d.upcomingExams ?? 0), '#fbbf24', 'bg-amber-400'],
    ['Pending approvals', totalPending, '#a78bfa', 'bg-violet-400'],
    ['Active notices', Number(d.activeNotices ?? 0), '#22d3ee', 'bg-cyan-400'],
  ] as const;
  const totalAlerts = alertItems.reduce((sum, item) => sum + item[1], 0);
  const quickActions = [
    [
      'Publish notice',
      'Share academic updates',
      Megaphone,
      'notice',
      'bg-violet-50 text-violet-700 group-hover:bg-violet-100',
    ],
    [
      'Academic calendar',
      'Plan important dates',
      CalendarDays,
      'academic-calendar',
      'bg-blue-50 text-blue-700 group-hover:bg-blue-100',
    ],
    [
      'Manage timetable',
      'Review class schedules',
      CalendarRange,
      'timetable',
      'bg-rose-50 text-rose-700 group-hover:bg-rose-100',
    ],
    [
      'Course progress',
      'Monitor syllabus delivery',
      BookOpen,
      'course-progress',
      'bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100',
    ],
    [
      'Faculty workload',
      'Balance teaching capacity',
      Users,
      'faculty-workload',
      'bg-amber-50 text-amber-700 group-hover:bg-amber-100',
    ],
    [
      'View reports',
      'Open academic analytics',
      FileBarChart,
      'report-center',
      'bg-cyan-50 text-cyan-700 group-hover:bg-cyan-100',
    ],
  ] as const;

  return (
    <motion.div
      className="space-y-4 pb-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Dashboard Top Header & Filter Controls */}
      <header className="flex flex-col justify-between gap-3 px-0.5 py-1 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl lg:text-3xl">
            Dean Academic Dashboard
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
            Academic overview and institution insights at a glance.
          </p>
        </div>
        <div className="grid w-full grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-3">
          <AsyncSelect
            type="academicYears"
            label="Academic Year"
            placeholder="Select academic year"
            value={selectedAcademicYear || null}
            onChange={(value) => {
              setSelectedAcademicYear(value ?? '');
              setSelectedSemester('');
            }}
            className="w-full min-w-0 lg:min-w-40"
            emptyMessage="No academic years are configured in ERP records."
          />
          <AsyncSelect
            type="semesters"
            label="Semester"
            placeholder={selectedAcademicYear ? 'Select semester' : 'Select academic year first'}
            value={selectedSemester || null}
            onChange={(value) => setSelectedSemester(value ?? '')}
            params={{ configured: true, academicYear: selectedAcademicYear }}
            disabled={!selectedAcademicYear}
            limit={12}
            className="w-full min-w-0 lg:min-w-40"
            emptyMessage="No configured semesters were found for this academic year."
          />
          <div className="min-w-0 sm:col-span-2 lg:col-span-1">
            <RecordsDateRangePicker
              start={selectedStartDate}
              end={selectedEndDate}
              label="Student attendance date range"
              compact
              onChange={(start, end) => {
                setSelectedStartDate(start);
                setSelectedEndDate(end);
              }}
            />
          </div>
        </div>
      </header>

      {/* Primary KPI Metrics Bar */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Total Students"
          value={referenceNumber(d.totalStudents)}
          detail="Active enrolment across programs"
          icon={<Users className="h-5 w-5" />}
          tone="bg-violet-100 text-violet-700"
          color="#7c3aed"
          series={enrolment.map((item) => item.students)}
        />
        <MetricCard
          label="Total Programs"
          value={referenceNumber(d.totalPrograms)}
          detail="Active academic curricula"
          icon={<GraduationCap className="h-5 w-5" />}
          tone="bg-emerald-100 text-emerald-700"
          color="#10b981"
          series={enrolment.map((item) => item.students)}
        />
        <MetricCard
          label="Departments"
          value={referenceNumber(d.totalDepartments)}
          detail="Institution academic departments"
          icon={<School className="h-5 w-5" />}
          tone="bg-amber-100 text-amber-700"
          color="#f59e0b"
          series={attendance.map((item) => Number(item.avgAttendance ?? 0))}
        />
        <MetricCard
          label="Total Faculty"
          value={referenceNumber(d.totalFaculty)}
          detail="Institution faculty strength"
          icon={<Users className="h-5 w-5" />}
          tone="bg-blue-100 text-blue-700"
          color="#2563eb"
          series={facultyWorkload.map((item) => Number(item.totalHours ?? 0))}
        />
        <MetricCard
          label="Courses Offered"
          value={referenceNumber(d.totalCourses)}
          detail="Subjects currently offered"
          icon={<Library className="h-5 w-5" />}
          tone="bg-cyan-100 text-cyan-700"
          color="#06b6d4"
          series={courses.map((item) => Number(item.avgCompletion ?? 0))}
        />
        <MetricCard
          label="Classes Scheduled"
          value={referenceNumber(d.classesScheduled)}
          detail="Approved weekly timetable slots"
          icon={<CalendarRange className="h-5 w-5" />}
          tone="bg-rose-100 text-rose-700"
          color="#ec4899"
          series={classScheduleByDay.map((item) => item.classes)}
        />
      </section>

      {/* Section 1: Academic Schedule & Enrolment */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel
          title="Enrollment Overview"
          subtitle="Active students by program"
          className="lg:col-span-6 2xl:col-span-4"
        >
          {enrolment.length ? (
            <div className="flex h-full min-h-52 flex-col items-center justify-between gap-4 sm:flex-row">
              <div className="relative h-40 w-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={enrolment}
                      dataKey="students"
                      nameKey="name"
                      innerRadius={46}
                      outerRadius={67}
                      paddingAngle={2}
                      cornerRadius={5}
                      animationDuration={900}
                    >
                      {enrolment.map((item, index) => (
                        <Cell key={item.name} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <strong className="text-lg text-slate-900">
                    {referenceNumber(totalEnrolled)}
                  </strong>
                  <span className="text-xs text-slate-500">active students</span>
                </div>
              </div>
              <div className="w-full flex-1 space-y-2">
                {enrolment.map((item, index) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between gap-2 text-xs"
                    title={item.name}
                  >
                    <span className="flex min-w-0 items-center gap-2 truncate text-slate-600">
                      <i
                        className={`h-2 w-2 shrink-0 rounded-full ${chartDotClasses[index % chartDotClasses.length]}`}
                      />
                      <span className="truncate">{item.name}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <strong className="block text-slate-800">
                        {referenceNumber(item.students)}
                      </strong>
                      <small className="text-xs text-slate-400">
                        {totalEnrolled ? ((item.students / totalEnrolled) * 100).toFixed(1) : '0.0'}
                        %
                      </small>
                    </span>
                  </div>
                ))}
                {leadingProgram && (
                  <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
                      Largest programme
                    </p>
                    <p className="mt-1 truncate text-xs font-bold text-slate-700" title={leadingProgram.name}>
                      {leadingProgram.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {leadingProgram.students} students ·{' '}
                      {totalEnrolled
                        ? ((leadingProgram.students / totalEnrolled) * 100).toFixed(1)
                        : 0}
                      % of enrolment
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <ReferenceEmpty
              label="No active program enrolment"
              reason="Student profiles must be active and assigned to a program."
            />
          )}
        </Panel>

        <Panel
          title="Academic Calendar"
          subtitle="Upcoming institution events"
          action="Full calendar"
          onAction={() => useLayoutStore.getState().openCalendar()}
          className="lg:col-span-6 2xl:col-span-3"
        >
          {events.length ? (
            <div className="space-y-2.5">
              {events.slice(0, 5).map((event, index) => {
                const date = compactDate(event.startDate);
                return (
                  <div
                    key={event._id ?? index}
                    role="button"
                    tabIndex={0}
                    onClick={() => useLayoutStore.getState().openCalendar()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        useLayoutStore.getState().openCalendar();
                      }
                    }}
                    className="group flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 bg-linear-to-r from-white to-indigo-50/40 p-2.5 transition-all hover:border-indigo-200 hover:shadow-xs"
                  >
                    <span className="w-10 shrink-0 overflow-hidden rounded-lg border border-indigo-100 text-center">
                      <b className="block bg-indigo-600 py-0.5 text-xs text-white">
                        {date.month}
                      </b>
                      <strong className="block py-1 text-xs text-indigo-700">{date.day}</strong>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-800 group-hover:text-primary transition-colors" title={event.title}>
                        {event.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {fmtDate(event.startDate)}
                        {event.venue ? ` · ${event.venue}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      Upcoming
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <ReferenceEmpty
              label="No upcoming academic events"
              reason="Published future events will appear here automatically."
            />
          )}
        </Panel>

        <Panel
          title="Class Schedule Overview"
          subtitle="Curriculum delivery progress"
          action="Full timetable"
          onAction={() => router.push(path('timetable'))}
          className="lg:col-span-6 2xl:col-span-3"
        >
          <div className="min-h-52 rounded-xl border border-indigo-100 bg-white p-3.5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Weekly timetable density
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  <strong className="text-indigo-600">{busiestScheduleDay.day}</strong> is the
                  busiest with {busiestScheduleDay.classes} classes
                </p>
              </div>
              <span className="rounded-xl border border-indigo-100 bg-white px-3 py-2 text-center">
                <strong className="block text-base text-indigo-600">
                  {referenceNumber(d.classesScheduled)}
                </strong>
                <span className="text-xs uppercase text-slate-400">approved</span>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {scheduleWeek.map((item, index) => {
                const intensity = item.classes / maxDailyClasses;
                const dayTones = [
                  'from-indigo-500 to-violet-500',
                  'from-cyan-500 to-blue-500',
                  'from-emerald-500 to-teal-500',
                  'from-amber-400 to-orange-500',
                  'from-pink-500 to-rose-500',
                  'from-violet-500 to-fuchsia-500',
                ];
                return (
                  <div
                    key={item.day}
                    className={`rounded-lg bg-linear-to-br ${dayTones[index]} p-2 text-center text-white`}
                  >
                    <span className="block text-xs font-semibold uppercase text-white/80">
                      {item.day.slice(0, 3)}
                    </span>
                    <strong className="mt-1 block text-sm text-white">{item.classes}</strong>
                    <div className="mt-1.5 grid grid-cols-2 gap-0.5">
                      {[0.25, 0.5, 0.75, 1].map((level) => (
                        <i
                          key={level}
                          className={`h-1.5 rounded-sm ${intensity >= level ? 'bg-white' : 'bg-white/30'}`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 grid grid-cols-3 divide-x divide-slate-100 rounded-lg border border-slate-100 bg-white/80 py-2 text-center">
              <div>
                <strong className="block text-xs text-slate-700 sm:text-sm">
                  {referenceNumber(d.totalCourses)}
                </strong>
                <span className="text-xs text-slate-400">Subjects</span>
              </div>
              <div>
                <strong className="block text-xs text-slate-700 sm:text-sm">
                  {referenceNumber(d.totalSections)}
                </strong>
                <span className="text-xs text-slate-400">Sections</span>
              </div>
              <div>
                <strong className="block text-xs text-slate-700 sm:text-sm">
                  {completion.toFixed(0)}%
                </strong>
                <span className="text-xs text-slate-400">Delivery</span>
              </div>
            </div>
          </div>
        </Panel>

        <Panel
          title="Pending Approvals"
          subtitle={`${totalPending} items need review`}
          className="lg:col-span-6 2xl:col-span-2"
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <div className="relative h-16 w-16 shrink-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={[
                        { value: clearedApprovalQueues },
                        { value: approvalItems.length - clearedApprovalQueues },
                      ]}
                      dataKey="value"
                      innerRadius={20}
                      outerRadius={28}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#fda4af" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <strong className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-700">
                  {clearedApprovalQueues}/{approvalItems.length}
                </strong>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-700">Workflow readiness</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {totalPending
                    ? `${totalPending} records require review.`
                    : 'All approval queues are clear.'}
                </p>
              </div>
            </div>
            {approvalItems.map(([label, count, Icon, tone]) => (
              <div key={label} className="flex items-center gap-2.5 rounded-lg bg-slate-50 p-2.5">
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{label}</span>
                <strong className={`shrink-0 text-xs ${count ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {count}
                </strong>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Section 2: Performance, Workload & Announcements */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel
          title="Student Performance Overview"
          subtitle="Published result CGPA distribution"
          className="lg:col-span-6 2xl:col-span-4"
        >
          {cgpaDistribution.length ? (
            <div className="h-full min-h-64">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={cgpaDistribution} margin={{ left: -22, right: 8, top: 12, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#eef2f7" />
                  <XAxis
                    dataKey="range"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar
                    dataKey="students"
                    name="Students"
                    radius={[7, 7, 0, 0]}
                    animationDuration={900}
                  >
                    {cgpaDistribution.map((item, index) => (
                      <Cell key={item.range} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ReferenceEmpty
              label="No published CGPA distribution"
              reason="Verified semester results must be published first."
            />
          )}
        </Panel>

        <Panel
          title="Faculty Workload"
          subtitle="Highest allocated weekly workload"
          action="All faculty"
          onAction={() => router.push(path('faculty-workload'))}
          className="lg:col-span-6 2xl:col-span-3"
        >
          {facultyWorkload.length ? (
            <div className="flex h-full min-h-64 flex-col items-center justify-between gap-4 rounded-xl border border-slate-100 bg-white p-3.5 sm:flex-row">
              <div className="w-full max-w-28 shrink-0">
                <svg
                  viewBox="0 0 160 205"
                  className="w-full"
                  role="img"
                  aria-label="Faculty workload ranking funnel"
                >
                  {facultyWorkload.slice(0, 5).map((item, index) => {
                    const widths = [144, 124, 102, 80, 58, 36];
                    const top = 8 + index * 37;
                    const leftTop = (160 - widths[index]) / 2;
                    const leftBottom = (160 - widths[index + 1]) / 2;
                    const fills = ['#818cf8', '#a78bfa', '#38bdf8', '#22d3ee', '#34d399'];
                    return (
                      <g key={item.facultyId ?? item.name}>
                        <polygon
                          points={`${leftTop},${top} ${leftTop + widths[index]},${top} ${leftBottom + widths[index + 1]},${top + 31} ${leftBottom},${top + 31}`}
                          fill={fills[index]}
                          stroke="white"
                          strokeWidth="3"
                          strokeLinejoin="round"
                        />
                        <text
                          x="80"
                          y={top + 19}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="11"
                          fontWeight="700"
                        >
                          {item.totalHours}h
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
              <div className="w-full flex-1 space-y-2">
                {facultyWorkload.slice(0, 5).map((item, index) => (
                  <div
                    key={item.facultyId ?? item.name}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 transition-colors hover:border-indigo-200"
                    title={`${item.name} (${item.department}) - ${item.teachingHours}h teaching`}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-indigo-100 text-xs font-bold text-indigo-600">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-800">
                        {item.name}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {item.department} · {item.assignments} courses
                      </p>
                    </div>
                    <strong className="shrink-0 text-xs text-indigo-700">{item.teachingHours}h</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ReferenceEmpty
              label="No faculty workload allocations"
              reason="Workload records will be summarized here."
            />
          )}
        </Panel>

        <Panel
          title="Recent Announcements"
          subtitle="Published academic notices"
          action="View all"
          onAction={() => router.push(path('notice'))}
          className="lg:col-span-6 2xl:col-span-3"
        >
          {notices.length ? (
            <div className="space-y-2.5">
              {notices.slice(0, 4).map((notice) => {
                const tone = noticePriorityTone(notice.priority);
                return (
                  <div
                    key={notice._id}
                    className={`group flex gap-3 rounded-xl border p-3 transition-all ${tone.card}`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${tone.icon}`}
                    >
                      <Megaphone className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-xs font-semibold leading-4 text-slate-800" title={notice.title}>
                        {notice.title}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <p className="truncate text-xs text-slate-500">
                          {fmtDate(notice.publishedAt ?? notice.createdAt)}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${tone.badge}`}
                        >
                          {notice.priority ?? 'normal'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <ReferenceEmpty
              label="No active announcements"
              reason="Published notices will appear here."
            />
          )}
        </Panel>

        <Panel
          title="Alerts & Notifications"
          subtitle="Live academic attention"
          className="lg:col-span-6 2xl:col-span-2"
        >
          <div className="space-y-2">
            <div className="relative mx-auto h-28 w-28">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={alertItems.map(([name, value]) => ({ name, value }))}
                    dataKey="value"
                    innerRadius={32}
                    outerRadius={46}
                    paddingAngle={3}
                    cornerRadius={4}
                  >
                    {alertItems.map(([label, , svgColor]) => (
                      <Cell key={label} fill={svgColor} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <strong className="text-base text-slate-800">{totalAlerts}</strong>
                <span className="text-xs uppercase text-slate-400">signals</span>
              </div>
            </div>
            {alertItems.map(([label, value, , legendColor]) => (
              <div
                key={String(label)}
                className="flex items-center gap-2.5 border-b border-slate-100 py-2 last:border-0"
              >
                <span className={`h-2 w-2 shrink-0 rotate-45 rounded-sm ${legendColor}`} />
                <strong className="text-xs text-slate-800">{String(value)}</strong>
                <span className="min-w-0 truncate text-xs text-slate-600">{String(label)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Section 3: Attendance, Risk & Quality Insights */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel
          title="Attendance Overview"
          subtitle="Institution trend and department comparison"
          className="lg:col-span-12 2xl:col-span-5"
        >
          {attendanceTrend.length || attendance.length ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-5">
              <div className="rounded-xl bg-linear-to-b from-indigo-50/70 to-white p-3.5">
                <div className="flex items-end gap-2">
                  <strong className="text-2xl text-indigo-700">
                    {averageAttendance == null ? '—' : `${averageAttendance.toFixed(1)}%`}
                  </strong>
                  <span className="pb-1 text-xs text-slate-500">30-day average</span>
                </div>
                <div className="mt-2 h-44">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <AreaChart
                      data={filteredAttendanceTrend}
                      margin={{ left: -24, right: 10, top: 12, bottom: 2 }}
                    >
                      <defs>
                        <linearGradient id="attendanceAreaFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.38} />
                          <stop offset="55%" stopColor="#818cf8" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="#c7d2fe" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 5" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) =>
                          new Date(value).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                          })
                        }
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Attendance']}
                        cursor={{ stroke: '#a5b4fc', strokeDasharray: '4 4' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="percentage"
                        name="Attendance"
                        unit="%"
                        stroke="#4f46e5"
                        strokeWidth={3}
                        fill="url(#attendanceAreaFill)"
                        dot={{ r: 3, fill: '#ffffff', stroke: '#4f46e5', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: '#4f46e5', stroke: '#ffffff', strokeWidth: 3 }}
                        animationDuration={1100}
                        animationEasing="ease-out"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-xl bg-linear-to-b from-cyan-50/70 to-white p-3.5 md:border-l md:border-slate-100">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-700">
                    Attendance by department
                  </p>
                  <span className="text-xs text-slate-400">0–100%</span>
                </div>
                <div className="relative h-52">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <RadarChart
                      data={attendance.slice(0, 6)}
                      outerRadius="52%"
                      margin={{ top: 8, right: 24, bottom: 12, left: 24 }}
                    >
                      <defs>
                        <linearGradient id="departmentRadarFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.48} />
                          <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.12} />
                        </linearGradient>
                      </defs>
                      <PolarGrid stroke="#cbd5e1" strokeDasharray="3 4" />
                      <PolarAngleAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: '#475569' }}
                        tickFormatter={(value) => {
                          const str = String(value);
                          return str.length > 14 ? str.slice(0, 12) + '…' : str;
                        }}
                      />
                      <Radar
                        name="Attendance"
                        dataKey="avgAttendance"
                        stroke="#4f46e5"
                        strokeWidth={2.5}
                        fill="url(#departmentRadarFill)"
                        fillOpacity={1}
                        dot={{ r: 3, fill: '#ffffff', stroke: '#4f46e5', strokeWidth: 2 }}
                        animationDuration={1100}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Attendance']}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full border border-indigo-100 bg-white/90 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                    Department comparison
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <ReferenceEmpty
              label="No attendance analytics yet"
              reason="Attendance records from the last 30 days are required."
            />
          )}
        </Panel>

        <Panel
          title="Academic Risk"
          subtitle="Priority indicators requiring leadership attention"
          className="lg:col-span-6 2xl:col-span-3"
        >
          <div className="space-y-3">
            <div className="rounded-2xl border border-rose-100 bg-linear-to-br from-rose-50 via-white to-orange-50 p-4">
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="relative h-16 w-16 shrink-0 sm:h-20 sm:w-20">
                  <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90" aria-hidden="true">
                    <circle cx="40" cy="40" r="31" fill="none" stroke="#ffe4e6" strokeWidth="8" />
                    <circle
                      cx="40"
                      cy="40"
                      r="31"
                      fill="none"
                      stroke="url(#riskRing)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${Math.min(shortageCount, 100) * 1.948} 194.8`}
                    />
                    <defs>
                      <linearGradient id="riskRing">
                        <stop stopColor="#f43f5e" />
                        <stop offset="1" stopColor="#fb923c" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <strong className="absolute inset-0 flex items-center justify-center text-lg text-rose-700">
                    {referenceNumber(shortageCount)}
                  </strong>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-rose-700">
                    Attendance risk
                  </span>
                  <p className="mt-1.5 text-sm font-bold text-slate-900">Students below threshold</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Review attendance interventions and department follow-ups.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3.5">
                <div className="mb-2 h-1 w-7 rounded-full bg-amber-400" />
                <strong className="block text-xl text-slate-900">
                  {referenceNumber(d.upcomingExams)}
                </strong>
                <p className="mt-0.5 text-xs font-medium text-amber-800">Upcoming exams</p>
              </div>
              <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-3.5">
                <div className="mb-2 h-1 w-7 rounded-full bg-violet-500" />
                <strong className="block text-xl text-slate-900">
                  {referenceNumber(academic?.publishedResults)}
                </strong>
                <p className="mt-0.5 text-xs font-medium text-violet-800">Published results</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
              <div>
                <strong className="block text-sm text-rose-600 sm:text-base">{riskRate.toFixed(1)}%</strong>
                <span className="text-xs text-slate-400">institution risk rate</span>
              </div>
              <div className="border-l border-slate-200">
                <strong className="block text-sm text-emerald-600 sm:text-base">
                  {healthyAttendanceStudents}
                </strong>
                <span className="text-xs text-slate-400">above threshold</span>
              </div>
            </div>
          </div>
        </Panel>

        <Panel
          title="Academic Quality"
          subtitle="Curriculum delivery and learning outcomes"
          className="lg:col-span-6 2xl:col-span-4"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Curriculum coverage', `${completion.toFixed(1)}%`],
                [
                  'Pass percentage',
                  academic?.passPercentage == null ? '—' : `${academic.passPercentage.toFixed(1)}%`,
                ],
                [
                  'Average CGPA',
                  academic?.averageCgpa == null ? '—' : academic.averageCgpa.toFixed(2),
                ],
                ['Research output', referenceNumber(d.publications)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-100 bg-linear-to-br from-white to-slate-50 p-3"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {label}
                  </p>
                  <strong className="mt-1 block text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                    {value}
                  </strong>
                </div>
              ))}
            </div>
            <div className="flex flex-col items-center justify-between gap-4 rounded-xl bg-linear-to-br from-slate-50 via-white to-indigo-50/70 p-3.5 sm:flex-row">
              <div className="relative h-36 w-36 shrink-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    {[
                      { value: completion, inner: 48, outer: 57, color: '#10b981' },
                      {
                        value: Number(academic?.passPercentage ?? 0),
                        inner: 35,
                        outer: 43,
                        color: '#06b6d4',
                      },
                      {
                        value: Number(academic?.averageCgpa ?? 0) * 10,
                        inner: 22,
                        outer: 30,
                        color: '#6366f1',
                      },
                    ].map((ring, index) => (
                      <Pie
                        key={index}
                        data={[{ value: ring.value }, { value: Math.max(100 - ring.value, 0) }]}
                        dataKey="value"
                        innerRadius={ring.inner}
                        outerRadius={ring.outer}
                        startAngle={90}
                        endAngle={-270}
                        cornerRadius={5}
                        paddingAngle={1}
                        animationDuration={1100 + index * 150}
                      >
                        <Cell fill={ring.color} />
                        <Cell fill="#e2e8f0" />
                      </Pie>
                    ))}
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <strong className="text-base text-slate-900">
                    {academic?.averageCgpa?.toFixed(2) ?? '—'}
                  </strong>
                  <span className="text-xs uppercase tracking-wide text-slate-400">CGPA</span>
                </div>
              </div>
              <div className="w-full flex-1 space-y-2.5">
                {[
                  ['Curriculum coverage', completion, 'bg-emerald-500'],
                  ['Pass percentage', Number(academic?.passPercentage ?? 0), 'bg-cyan-500'],
                  ['CGPA score', Number(academic?.averageCgpa ?? 0) * 10, 'bg-indigo-500'],
                ].map(([label, value, tone]) => (
                  <div key={String(label)} className="flex items-center gap-2">
                    <i className={`h-2.5 w-2.5 shrink-0 rounded-full ${String(tone)}`} />
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-500">{String(label)}</span>
                    <strong className="shrink-0 text-xs text-slate-800">
                      {Number(value).toFixed(1)}%
                    </strong>
                  </div>
                ))}
                <p className="border-t border-slate-100 pt-2 text-xs text-slate-400">
                  Each ring uses the same 0–100 scale for direct comparison.
                </p>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* Section 4: Quick Access Workflows */}
      <Panel title="Quick Access" subtitle="Common academic leadership workflows">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {quickActions.map(([label, description, Icon, route, tone]) => (
            <motion.button
              key={label}
              type="button"
              onClick={() => router.push(path(route))}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="group flex min-h-16 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-left transition-colors duration-200 hover:border-indigo-200 hover:bg-indigo-50/30"
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 ${tone}`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-xs font-bold text-slate-800 transition-colors group-hover:text-indigo-700 sm:text-sm">
                  {label}
                </strong>
                <span className="mt-0.5 block truncate text-xs text-slate-500">
                  {description}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-indigo-500" />
            </motion.button>
          ))}
        </div>
      </Panel>
    </motion.div>
  );
}

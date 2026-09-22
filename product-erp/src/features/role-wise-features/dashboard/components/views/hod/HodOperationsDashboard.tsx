/**
 * @file HodOperationsDashboard.tsx
 * @description Responsive department command centre for academic, faculty, student, and teaching operations.
 * @module features/dashboard
 */

'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpenCheck,
  CalendarCheck2,
  Clock3,
  GraduationCap,
  RefreshCw,
  UserRoundX,
  UsersRound,
  Calendar,
  CheckCircle,
  Activity,
} from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import { useRolePath } from '../shared';
import {
  AttendanceAnalytics,
  AcademicOutcomesPanel,
  CohortCompositionPanel,
  CourseDeliveryPanel,
  DailyOperationsPanel,
  ExamReadinessPanel,
  StudentRiskPanel,
  TeachingOperations,
  FacultyWorkloadPanel,
  DepartmentMeetingsEventsPanel,
} from './HodAnalyticsPanels';
import type { IHodDashboardData } from './hod-dashboard.types';

interface IKpiCard {
  label: string;
  value: string;
  detail: string;
  href: string;
  illustration: string;
  signalLabel: string;
  signalPercentage: number;
}

/** Formats API timestamps without showing a misleading live clock. */
function formatUpdatedAt(value?: string) {
  if (!value) return 'Updated just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Updated just now';
  return `Updated ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Main HOD workspace, intentionally ordered from urgent action to deeper analysis. */
export default function HodOperationsDashboard({ data }: { data: IHodDashboardData }) {
  const path = useRolePath();
  const workload = Number(data.workloadStats?.avgWeeklyHours ?? 0);
  const overloaded = Number(data.workloadStats?.overloadedFaculty ?? 0);
  const attention = data.attentionSummary ?? {
    attendanceShortage: 0,
    subjectsBehind: 0,
    pendingLeaves: 0,
    pendingLessonPlans: 0,
    uncoveredAttendance: 0,
    facultyAbsent: 0,
  };
  const totalAttention = Object.values(attention).reduce((sum, value) => sum + value, 0);

  const scheduledToday = data.operations.scheduledClassesToday;
  const recordedToday = data.operations.attendanceRecordedToday;
  const coverageRate = scheduledToday ? Math.round((recordedToday / scheduledToday) * 100) : 0;

  const kpis: IKpiCard[] = [
    {
      label: 'Department students',
      value: data.studentCount.toLocaleString('en-IN'),
      detail: `${data.sectionStrength.length} active cohort${data.sectionStrength.length === 1 ? '' : 's'}`,
      href: path('student-management'),
      illustration: '/dashboard/kpis/students.png',
      signalLabel: 'Department strength',
      signalPercentage: data.studentCount > 0 ? 100 : 0,
    },
    {
      label: 'Department faculty',
      value: data.facultyCount.toLocaleString('en-IN'),
      detail: overloaded ? `${overloaded} overloaded (>20h)` : 'All loads balanced',
      href: path('faculty-management'),
      illustration: '/dashboard/kpis/faculty.png',
      signalLabel: `${workload.toFixed(1)}h average load`,
      signalPercentage: Math.min(100, (workload / 20) * 100),
    },
    {
      label: 'Today class coverage',
      value: `${coverageRate}%`,
      detail: `${recordedToday} of ${scheduledToday} logged`,
      href: path('attendance'),
      illustration: '/dashboard/kpis/staff.png',
      signalLabel: `${data.operations.attendancePendingToday} attendance pending`,
      signalPercentage: coverageRate,
    },
    {
      label: 'Curriculum delivery',
      value: `${data.courseCompletion?.avgCompletion?.toFixed(0) ?? 0}%`,
      detail: `${data.courseCompletion?.totalSubjects ?? data.subjectProgress.length} subjects monitored`,
      href: path('course-progress'),
      illustration: '/dashboard/kpis/subjects.png',
      signalLabel: `${attention.subjectsBehind} behind plan`,
      signalPercentage: data.courseCompletion?.avgCompletion ?? 0,
    },
    {
      label: '30-day attendance',
      value: data.attendanceTrend.length
        ? `${(
            data.attendanceTrend.reduce((sum, item) => {
              const raw = Number(item.avgPresent ?? 0);
              return sum + (raw > 1 ? raw : raw * 100);
            }, 0) / data.attendanceTrend.length
          ).toFixed(0)}%`
        : '—',
      detail: attention.attendanceShortage
        ? `${attention.attendanceShortage} students below 75%`
        : 'No student shortage detected',
      href: path('attendance'),
      illustration: '/dashboard/kpis/admissions.png',
      signalLabel: 'Department attendance health',
      signalPercentage: data.attendanceTrend.length
        ? data.attendanceTrend.reduce((sum, item) => {
            const raw = Number(item.avgPresent ?? 0);
            return sum + (raw > 1 ? raw : raw * 100);
          }, 0) / data.attendanceTrend.length
        : 0,
    },
    {
      label: 'Pending decisions',
      value: `${attention.pendingLeaves + attention.pendingLessonPlans}`,
      detail: `${attention.pendingLeaves} leaves · ${attention.pendingLessonPlans} lesson plans`,
      href: attention.pendingLeaves > 0 ? path('leave') : path('lesson-plan'),
      illustration: '/dashboard/cards/priority-workflow.png',
      signalLabel: 'Decision queue cleared',
      signalPercentage: attention.pendingLeaves + attention.pendingLessonPlans > 0 ? 0 : 100,
    },
  ];

  const attentionItems = [
    {
      label: 'Students below 75% attendance',
      count: attention.attendanceShortage,
      href: path('student-management'),
      tone: 'bg-rose-50 text-rose-700 border-rose-200',
      priority: 'Critical Risk',
      priorityBadge: 'bg-rose-100 text-rose-800',
      detail:
        'Students below the mandatory attendance threshold require intervention and parent alerts.',
      action: 'Review students',
      icon: GraduationCap,
    },
    {
      label: 'Subjects behind syllabus schedule',
      count: attention.subjectsBehind,
      href: path('course-progress'),
      tone: 'bg-orange-50 text-orange-700 border-orange-200',
      priority: 'Delivery Risk',
      priorityBadge: 'bg-orange-100 text-orange-800',
      detail: 'Subject delivery is tracking behind its planned unit / lesson completion timeline.',
      action: 'Inspect progress',
      icon: BookOpenCheck,
    },
    {
      label: 'Lesson plans awaiting review',
      count: attention.pendingLessonPlans,
      href: path('lesson-plan'),
      tone: 'bg-violet-50 text-violet-700 border-violet-200',
      priority: 'Approval Due',
      priorityBadge: 'bg-violet-100 text-violet-800',
      detail: 'Faculty course delivery plans submitted and waiting for HOD approval.',
      action: 'Review plans',
      icon: CalendarCheck2,
    },
    {
      label: 'Leave requests awaiting decision',
      count: attention.pendingLeaves,
      href: path('leave'),
      tone: 'bg-primary-50 text-primary border-primary-200',
      priority: 'Decision Due',
      priorityBadge: 'bg-blue-100 text-blue-800',
      detail: 'Department faculty leave applications are pending HOD approval.',
      action: 'Review leaves',
      icon: UserRoundX,
    },
    {
      label: 'Today’s classes missing attendance',
      count: attention.uncoveredAttendance,
      href: path('attendance'),
      tone: 'bg-amber-50 text-amber-700 border-amber-200',
      priority: 'Due Today',
      priorityBadge: 'bg-amber-100 text-amber-800',
      detail: 'Conducted timetable periods have not yet been marked by faculty in charge.',
      action: 'Check register',
      icon: Clock3,
    },
    {
      label: 'Faculty on leave / absent today',
      count: attention.facultyAbsent,
      href: path('faculty-attendance'),
      tone: 'bg-rose-50 text-rose-700 border-rose-200',
      priority: 'Coverage Needed',
      priorityBadge: 'bg-rose-100 text-rose-800',
      detail: 'Faculty unavailable today may require class rearrangement or substitute assignment.',
      action: 'Assign proxy',
      icon: UsersRound,
    },
  ].filter((item) => item.count > 0);

  return (
    <div className="space-y-5">
      {/* ─── Hero Command Centre Header ─────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative isolate overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r from-sky-50 via-white to-violet-50 p-5 sm:p-6 lg:min-h-72 lg:pr-[45%]"
      >
        <div className="relative z-10 max-w-xl py-1 sm:py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-primary-100 bg-white/90 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-primary">
              {data.department?.code ?? 'DEPT'} Operations
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold text-slate-600">
              <RefreshCw className="size-3" /> {formatUpdatedAt(data.generatedAt)}
            </span>
            {data.academicContext?.academicYear && (
              <span className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-bold text-slate-700">
                AY {data.academicContext.academicYear}
              </span>
            )}
            {data.academicContext?.semesterType && (
              <span className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-bold capitalize text-slate-700">
                {data.academicContext.semesterType} Semester
              </span>
            )}
          </div>

          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-primary">
            Department Leadership Hub
          </p>
          <h1 className="mt-1 text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
            {data.department?.name ?? 'Department'} Command Centre
          </h1>
          <p className="mt-2.5 max-w-2xl text-xs sm:text-sm leading-relaxed text-slate-600 font-medium">
            Monitor real-time class delivery, faculty capacity, student risk matrices, syllabus
            velocity, and academic outcomes across your department.
          </p>

          {/* Quick Action Launchpad */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link
              href={path('attendance')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-primary-600"
            >
              <Activity className="size-3.5" /> Department Attendance
            </Link>
            <Link
              href={path('timetable')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Calendar className="size-3.5 text-primary" /> Timetable
            </Link>
            {attention.pendingLeaves > 0 && (
              <Link
                href={path('leave')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <UserRoundX className="size-3.5 text-blue-600" />
                Leaves ({attention.pendingLeaves})
              </Link>
            )}
            {attention.pendingLessonPlans > 0 && (
              <Link
                href={path('lesson-plan')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <CalendarCheck2 className="size-3.5 text-violet-600" />
                Lesson Plans ({attention.pendingLessonPlans})
              </Link>
            )}
            {attention.attendanceShortage > 0 && (
              <Link
                href={path('student-management')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100"
              >
                <AlertTriangle className="size-3.5 text-rose-600" />
                At-Risk Students ({attention.attendanceShortage})
              </Link>
            )}
          </div>
        </div>

        <div className="relative mt-3 h-48 w-full sm:h-56 lg:absolute lg:inset-y-2 lg:right-3 lg:mt-0 lg:h-auto lg:w-[43%]">
          <Image
            src="/hod-department-command-center.png"
            alt="Department command centre illustration"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 43vw"
            className="object-contain object-center lg:object-right"
          />
        </div>
      </motion.section>

      {/* ─── Department Profile KPI Strip ──────────────────────────────────── */}
      <section aria-labelledby="department-kpis-title">
        <div className="mb-3 flex items-center justify-between">
          <h2
            id="department-kpis-title"
            className="text-sm font-bold uppercase tracking-wider text-slate-500"
          >
            Department Performance Indicators
          </h2>
          <span className="text-[11px] font-semibold text-slate-400">
            Click any card to open governed workspace
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {kpis.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <Link
                href={item.href}
                className="group relative block min-h-44 overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-0"
              >
                <span className="pointer-events-none absolute right-2 top-2 h-32 w-32">
                  <Image
                    src={item.illustration}
                    alt=""
                    fill
                    sizes="128px"
                    className="object-contain object-right-top"
                  />
                </span>
                <p className="relative z-10 text-2xl font-semibold tracking-tight text-slate-900">
                  {item.value}
                </p>
                <p className="relative z-10 mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {item.label}
                </p>
                <p className="relative z-10 mt-2 max-w-[62%] text-xs text-slate-500">
                  {item.detail}
                </p>
                <div className="relative z-10 mt-3 border-t border-slate-200/80 pt-3">
                  <div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-semibold">
                    <span className="truncate text-slate-500">{item.signalLabel}</span>
                    <span className="shrink-0 text-slate-700">
                      {Math.min(100, Math.max(0, item.signalPercentage)).toFixed(0)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-10 gap-1">
                    {Array.from({ length: 10 }, (_, segment) => (
                      <motion.span
                        key={segment}
                        initial={{ opacity: 0.25, scaleX: 0.65 }}
                        animate={{ opacity: 1, scaleX: 1 }}
                        transition={{ delay: segment * 0.025, duration: 0.2 }}
                        className={`h-1.5 rounded-full ${
                          segment < Math.round(item.signalPercentage / 10)
                            ? 'bg-primary/70'
                            : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Urgent Action & Exception Hub ─────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`rounded-3xl border p-5 sm:p-6 ${
          totalAttention
            ? 'border-primary-200/90 bg-primary-50/40 text-slate-800'
            : 'border-secondary-200/80 bg-secondary-50/40 text-slate-800'
        }`}
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span
                className={`flex size-11 items-center justify-center rounded-2xl border border-slate-200 bg-white ${
                  totalAttention ? 'text-primary' : 'text-secondary-600'
                }`}
              >
                {totalAttention ? (
                  <AlertTriangle className="size-5.5" />
                ) : (
                  <CheckCircle className="size-5.5" />
                )}
              </span>
              <div>
                <p className="text-base font-bold text-slate-950">
                  {totalAttention
                    ? 'Urgent Department Action Required'
                    : 'Department Operations on Track'}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  {totalAttention
                    ? `${totalAttention} outstanding item${totalAttention === 1 ? '' : 's'} requiring HOD decision or attention today`
                    : 'No critical operational exception detected across classes, leaves, or syllabus.'}
                </p>
              </div>
            </div>
            {totalAttention > 0 && (
              <span className="w-fit rounded-full border border-primary-100 bg-white px-3 py-1 text-xs font-bold text-primary">
                Action required today
              </span>
            )}
          </div>

          {attentionItems.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {attentionItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="group flex min-h-40 flex-col rounded-2xl border border-slate-200/90 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-primary-50/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`flex size-9 items-center justify-center rounded-xl ${item.tone}`}
                    >
                      <item.icon className="size-4.5" />
                    </span>
                    <div className="text-right">
                      <p className="text-2xl font-black leading-none text-slate-900">
                        {item.count}
                      </p>
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${item.priorityBadge}`}
                      >
                        {item.priority}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs font-bold text-slate-900">{item.label}</p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">{item.detail}</p>
                  <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-bold text-primary group-hover:text-primary-700">
                    {item.action}
                    <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </motion.section>

      <div className="flex flex-col gap-1 border-b border-slate-200 pb-4">
        <h2 className="text-xl font-black tracking-tight text-slate-950">
          Department operations and academic intelligence
        </h2>
        <p className="text-sm text-slate-500">
          One continuous department view, ordered from today’s delivery to longer-term outcomes.
        </p>
      </div>

      {/* ─── Continuous department analytics ───────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="grid items-start gap-4 xl:grid-cols-12"
      >
        <DailyOperationsPanel data={data} />
        <TeachingOperations data={data} />
        <AttendanceAnalytics data={data} />
        <StudentRiskPanel data={data} />
        <CourseDeliveryPanel data={data} />
        <FacultyWorkloadPanel data={data} />
        <DepartmentMeetingsEventsPanel data={data} />
        <AcademicOutcomesPanel data={data} />
        <CohortCompositionPanel data={data} />
        <ExamReadinessPanel data={data} />
      </motion.div>
    </div>
  );
}

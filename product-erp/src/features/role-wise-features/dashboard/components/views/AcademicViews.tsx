'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthStore } from '@/shared/store/authStore';
import { motion } from '@/shared/utils/motion';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from 'recharts';
import {
  GraduationCap,
  Briefcase,
  ClipboardCheck,
  BarChart2,
  Bell,
  Users,
  Clock,
  AlertCircle,
  CalendarDays,
  BookOpen,
  CalendarMinus,
  ClipboardList,
  ArrowUpRight,
  Gauge,
  BookCheck,
  UserRoundSearch,
  FileText,
  Award,
  ChevronLeft,
  ChevronRight,
  FileQuestion,
} from 'lucide-react';
import {
  AnyRecord,
  IStatCard,
  useRolePath,
  fmt,
  fmtDate,
  fmtDateTime,
  Badge,
  Section,
  RowItem,
  AttBar,
  StaffDashboardView,
} from './shared';
import HodOperationsDashboard from './hod/HodOperationsDashboard';
import type { IHodDashboardData } from './hod/hod-dashboard.types';

/** Narrows the expanded HOD API payload while preserving the legacy fallback. */
function isHodOperationsPayload(value: AnyRecord): value is AnyRecord & IHodDashboardData {
  return (
    typeof value.operations === 'object' &&
    value.operations !== null &&
    typeof value.attentionSummary === 'object' &&
    value.attentionSummary !== null &&
    Array.isArray(value.todayClasses) &&
    Array.isArray(value.studentRisk) &&
    Array.isArray(value.subjectProgress)
  );
}

/** Converts stored identifiers such as assistant_professor into presentation labels. */
function humanizeLabel(value?: string) {
  return String(value ?? '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function DeanView({ d }: { d: AnyRecord }) {
  const path = useRolePath();
  const cards: IStatCard[] = [
    {
      label: 'Total Students',
      value: fmt(d.totalStudents),
      icon: <GraduationCap className="h-5 w-5" />,
      bg: 'bg-primary-50',
      fg: 'text-primary',
      href: path('student-management'),
    },
    {
      label: 'Total Faculty',
      value: fmt(d.totalFaculty),
      icon: <Briefcase className="h-5 w-5" />,
      bg: 'bg-violet-50',
      fg: 'text-violet-600',
      href: path('faculty-management'),
    },
    {
      label: 'Upcoming Exams',
      value: fmt(d.upcomingExams),
      icon: <ClipboardCheck className="h-5 w-5" />,
      bg: 'bg-amber-50',
      fg: 'text-amber-600',
      href: path('examination'),
    },
    {
      label: 'Avg Course Progress',
      value: `${Number(d.overallAvgCompletion ?? 0).toFixed(0)}%`,
      icon: <BarChart2 className="h-5 w-5" />,
      bg: 'bg-secondary-50',
      fg: 'text-secondary',
      href: path('course-progress'),
    },
    {
      label: 'Active Notices',
      value: fmt(d.activeNotices),
      icon: <Bell className="h-5 w-5" />,
      bg: 'bg-orange-50',
      fg: 'text-orange-500',
      href: path('notice'),
    },
    {
      label: 'Meetings',
      value: fmt(d.upcomingMeetings),
      icon: <Users className="h-5 w-5" />,
      bg: 'bg-cyan-50',
      fg: 'text-cyan-600',
      href: path('meeting'),
    },
  ];
  const deptAtt = (d.deptAttendance as { _id: string; avgAttendance: number }[] | undefined) ?? [];
  const courseStats =
    (d.courseCompletionStats as { _id: string; avgCompletion: number }[] | undefined) ?? [];
  return (
    <StaffDashboardView
      d={d}
      role="dean_academic"
      roleLabel="Dean Academics"
      stats={cards}
      extras={
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Dept-wise Avg Attendance" sub="Last 30 days" href={path('attendance')}>
            <div className="space-y-3">
              {deptAtt.length ? (
                deptAtt
                  .slice(0, 8)
                  .map((d, i) => (
                    <AttBar
                      key={i}
                      label={String(d._id)}
                      pct={Number(d.avgAttendance ?? 0)}
                      shortage={Number(d.avgAttendance ?? 0) < 75}
                    />
                  ))
              ) : (
                <p className="py-4 text-center text-sm text-slate-600">No data</p>
              )}
            </div>
          </Section>
          <Section
            title="Dept-wise Course Completion"
            sub="Avg syllabus coverage"
            href={path('course-progress')}
          >
            <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0}>
              <BarChart
                data={courseStats.slice(0, 8)}
                margin={{ top: 0, right: 0, left: -20, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="_id"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  angle={-30}
                  textAnchor="end"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: 'none' }} />
                <Bar
                  dataKey="avgCompletion"
                  fill="#9BB94F"
                  radius={[6, 6, 0, 0]}
                  name="% Complete"
                />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        </div>
      }
    />
  );
}

export function HodView({ d }: { d: AnyRecord }) {
  const path = useRolePath();
  if (isHodOperationsPayload(d)) {
    return <HodOperationsDashboard data={d} />;
  }
  const cc =
    (d.courseCompletion as { avgCompletion?: number; overloadedFaculty?: number } | undefined) ??
    {};
  const wl =
    (d.workloadStats as { avgWeeklyHours?: number; overloadedFaculty?: number } | undefined) ?? {};
  const cards: IStatCard[] = [
    {
      label: 'Dept Faculty',
      value: fmt(d.facultyCount),
      icon: <Briefcase className="h-5 w-5" />,
      bg: 'bg-violet-50',
      fg: 'text-violet-600',
      href: path('faculty-management'),
    },
    {
      label: 'Dept Students',
      value: fmt(d.studentCount),
      icon: <GraduationCap className="h-5 w-5" />,
      bg: 'bg-primary-50',
      fg: 'text-primary',
      href: path('student-management'),
    },
    {
      label: 'Pending Leaves',
      value: fmt(d.pendingLeaves),
      icon: <CalendarMinus className="h-5 w-5" />,
      bg: 'bg-red-50',
      fg: 'text-red-500',
      sub: (d.pendingLeaves as number) > 0 ? 'Needs review' : 'All reviewed',
      href: path('leave'),
    },
    {
      label: 'Avg Completion',
      value: `${Number(cc.avgCompletion ?? 0).toFixed(0)}%`,
      icon: <BarChart2 className="h-5 w-5" />,
      bg: 'bg-secondary-50',
      fg: 'text-secondary',
      href: path('course-progress'),
    },
    {
      label: 'Avg Weekly Hours',
      value: `${Number(wl.avgWeeklyHours ?? 0).toFixed(1)}h`,
      icon: <Clock className="h-5 w-5" />,
      bg: 'bg-amber-50',
      fg: 'text-amber-600',
      href: path('faculty-workload'),
    },
    {
      label: 'Overloaded Faculty',
      value: fmt(wl.overloadedFaculty),
      icon: <AlertCircle className="h-5 w-5" />,
      bg: (wl.overloadedFaculty ?? 0) > 0 ? 'bg-orange-50' : 'bg-slate-50',
      fg: (wl.overloadedFaculty ?? 0) > 0 ? 'text-orange-500' : 'text-slate-600',
      sub: (wl.overloadedFaculty ?? 0) > 0 ? 'Rebalance workload' : 'All balanced',
      href: path('faculty-workload'),
    },
  ];
  const attTrend = (d.attendanceTrend as { _id: string; avgPresent: number }[] | undefined) ?? [];
  const events =
    (d.upcomingEvents as { title?: string; startDate?: string; venue?: string }[] | undefined) ??
    [];
  const meetings =
    (d.scheduledMeetings as
      | { title?: string; scheduledAt?: string; mode?: string }[]
      | undefined) ?? [];

  // Quick action alerts
  const pendingLeaves = Number(d.pendingLeaves ?? 0);
  const overloaded = Number(wl.overloadedFaculty ?? 0);
  const alerts = [
    ...(pendingLeaves > 0
      ? [
          {
            label: `${pendingLeaves} leave request${pendingLeaves > 1 ? 's' : ''} pending`,
            color: 'red',
            link: path('leave'),
          },
        ]
      : []),
    ...(overloaded > 0
      ? [
          {
            label: `${overloaded} faculty overloaded this week`,
            color: 'amber',
            link: path('faculty-workload'),
          },
        ]
      : []),
    ...(meetings.length > 0
      ? [
          {
            label: `${meetings.length} scheduled meeting${meetings.length > 1 ? 's' : ''}`,
            color: 'blue',
            link: path('meeting'),
          },
        ]
      : []),
  ];

  return (
    <StaffDashboardView
      d={d}
      role="hod"
      roleLabel="Head of Department"
      stats={cards}
      extras={
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Alerts / action panel */}
          {alerts.length > 0 && (
            <div className="rounded-2xl bg-slate-50 p-4 lg:col-span-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Action Required
              </p>
              <div className="flex flex-wrap gap-2">
                {alerts.map((a, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium ${
                      a.color === 'red'
                        ? 'bg-red-50 text-red-600'
                        : a.color === 'amber'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-primary-50 text-primary'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${a.color === 'red' ? 'bg-red-400' : a.color === 'amber' ? 'bg-amber-400' : 'bg-primary'}`}
                    />
                    {a.label}
                  </span>
                ))}
              </div>
            </div>
          )}
          <Section
            title="Attendance Trend"
            sub="Dept avg last 30 days"
            className="lg:col-span-2"
            href={path('attendance')}
          >
            <ResponsiveContainer width="100%" height={200} minWidth={0} minHeight={0}>
              <AreaChart
                data={attTrend.slice(-14)}
                margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradAttHod" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0178D7" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0178D7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="_id"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0.5, 1]}
                  tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: unknown) => [`${(Number(v) * 100).toFixed(1)}%`, 'Avg Present']}
                  contentStyle={{ fontSize: 12, borderRadius: 12, border: 'none' }}
                />
                <Area
                  type="monotone"
                  dataKey="avgPresent"
                  stroke="#0178D7"
                  fill="url(#gradAttHod)"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Section>
          <Section title="Scheduled Meetings" href={path('meeting')}>
            <div className="space-y-2">
              {meetings.length ? (
                meetings.map((m, i) => (
                  <RowItem
                    key={i}
                    icon={<Users className="h-4 w-4" />}
                    primary={m.title ?? '—'}
                    secondary={fmtDateTime(m.scheduledAt)}
                    href={path('meeting')}
                    end={m.mode ? <Badge label={m.mode} color="blue" /> : undefined}
                  />
                ))
              ) : (
                <p className="py-3 text-center text-xs text-slate-600">No meetings</p>
              )}
            </div>
          </Section>
          {events.length > 0 && (
            <Section
              title="Department Events"
              sub="Recently scheduled"
              className="lg:col-span-3"
              href={path('event')}
            >
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {events.map((e, i) => (
                  <RowItem
                    key={i}
                    icon={<CalendarDays className="h-4 w-4" />}
                    primary={e.title ?? '—'}
                    secondary={`${fmtDate(e.startDate)} · ${e.venue ?? ''}`}
                    href={path('event')}
                  />
                ))}
              </div>
            </Section>
          )}
        </div>
      }
    />
  );
}

export function FacultyView({ d }: { d: AnyRecord }) {
  const user = useAuthStore((state) => state.user);
  const todaySlots =
    (d.todaySlots as
      | {
          subjectName?: string;
          startTime?: string;
          endTime?: string;
          room?: string;
          classType?: string;
          subjectCode?: string;
          subjectId?: string;
          _id?: string;
          timetableId?: string;
          periodNo?: number;
          slotKind?: string;
          program?: string;
          semester?: number;
          section?: string;
          roomNo?: string;
        }[]
      | undefined) ?? [];
  const assignedSubjects =
    (d.assignedSubjects as
      | Array<{
          subjectId?: string;
          subjectCode?: string;
          subjectName?: string;
          program?: string;
          semester?: number;
          section?: string;
        }>
      | undefined) ?? [];
  const attendanceToday =
    (d.attendanceToday as
      | Array<{
          timetableSlotId?: string;
          timetableId?: string;
          subjectId?: string;
          periodNumber?: number;
        }>
      | undefined) ?? [];
  const courseProgress =
    (d.myCourseCompletion as
      | {
          subjectName?: string;
          subjectCode?: string;
          completionPercentage?: number;
          isComplete?: boolean;
        }[]
      | undefined) ?? [];
  const meetings =
    (d.myMeetings as { title?: string; scheduledAt?: string; mode?: string }[] | undefined) ?? [];
  const upcomingEvents =
    (d.upcomingEvents as
      | Array<{
          title?: string;
          startDate?: string;
          endDate?: string;
          venue?: string;
          eventType?: string;
        }>
      | undefined) ?? [];
  const path = useRolePath();
  const lessonPlans =
    (d.lessonPlans as Array<{ title?: string; section?: string; percent?: number }> | undefined) ??
    [];
  const studentProgress =
    (d.studentProgress as
      | Array<{ name?: string; percent?: number; subLabel?: string }>
      | undefined) ?? [];
  const last7DaysAttendance =
    (d.last7DaysAttendance as
      | Array<{ day?: string; date?: string; status?: string }>
      | undefined) ?? [];
  const attendanceTrend = last7DaysAttendance.map((day) => ({
    day: day.day ?? '',
    value:
      day.status === 'present'
        ? 100
        : day.status === 'late'
          ? 75
          : day.status === 'half_day'
            ? 50
            : day.status === 'absent'
              ? 0
              : null,
    status: day.status ?? 'not recorded',
  }));
  const weeklyTeachingSlots = Number(d.weeklyTeachingSlots ?? 0);
  const teachingLoadByDay =
    (d.teachingLoadByDay as Array<{ day: string; classes: number; hours: number }> | undefined) ??
    [];
  const weeklyTeachingHours = Number(d.weeklyTeachingMinutes ?? 0) / 60;
  const averageCoverage = courseProgress.length
    ? Math.round(
        courseProgress.reduce(
          (total, course) => total + Number(course.completionPercentage ?? 0),
          0,
        ) / courseProgress.length,
      )
    : 0;
  const lessonPlanReadiness = lessonPlans.length
    ? Math.round(
        lessonPlans.reduce((total, plan) => total + Number(plan.percent ?? 0), 0) /
          lessonPlans.length,
      )
    : 0;
  const subjectDeliveryData = assignedSubjects.map((subject) => ({
    subject: subject.subjectCode || subject.subjectName || 'Subject',
    coverage: Number(
      courseProgress.find((course) => course.subjectCode === subject.subjectCode)
        ?.completionPercentage ?? 0,
    ),
  }));
  const supportStudents = studentProgress
    .slice()
    .sort((left, right) => Number(left.percent) - Number(right.percent));
  const urgentSupportCount = supportStudents.filter(
    (student) => Number(student.percent ?? 0) < 75,
  ).length;
  const supportAverage = supportStudents.length
    ? Math.round(
        supportStudents.reduce((total, student) => total + Number(student.percent ?? 0), 0) /
          supportStudents.length,
      )
    : 0;

  const cards: IStatCard[] = [
    {
      label: "Today's Classes",
      value: todaySlots.length,
      icon: <CalendarDays className="h-5 w-5" />,
      bg: 'bg-primary-50',
      fg: 'text-primary',
      sub:
        todaySlots.length === 0
          ? 'No classes today'
          : `${todaySlots.length} slot${todaySlots.length > 1 ? 's' : ''} scheduled`,
      href: path('timetable'),
    },
    {
      label: 'Student Count',
      value: Number(d.assignedStudentCount ?? 0),
      icon: <Users className="h-5 w-5" />,
      bg: 'bg-emerald-50',
      fg: 'text-emerald-600',
      sub: `Across ${new Set(assignedSubjects.map((subject) => `${subject.program}-${subject.semester}-${subject.section}`)).size} classes`,
      href: path('student-roster'),
    },
    {
      label: 'Assignments to Grade',
      value: Number((d.assignmentSummary as { pending?: number } | undefined)?.pending ?? 0),
      icon: <ClipboardList className="h-5 w-5" />,
      bg: 'bg-violet-50',
      fg: 'text-violet-600',
      sub: 'Student submissions awaiting review',
      href: path('assignment'),
    },
    {
      label: 'Pending Leave Requests',
      value: fmt(d.myPendingLeaves),
      icon: <CalendarMinus className="h-5 w-5" />,
      bg: 'bg-amber-50',
      fg: 'text-amber-600',
      sub: 'Your leave requests awaiting a decision',
      href: path('leave'),
    },
  ];
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const toMinutes = (time?: string) => {
    const [hour = 0, minute = 0] = (time ?? '').split(':').map(Number);
    return hour * 60 + minute;
  };
  const formatScheduleTime = (time?: string) => {
    if (!time) return '—';
    const [hour = 0, minute = 0] = time.split(':').map(Number);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${String(displayHour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${suffix}`;
  };
  const stateFor = (slot: (typeof todaySlots)[number]) =>
    nowMinutes < toMinutes(slot.startTime)
      ? 'upcoming'
      : nowMinutes <= toMinutes(slot.endTime)
        ? 'live'
        : 'completed';
  const nextClass = todaySlots.find((slot) => stateFor(slot) === 'upcoming');
  const attendanceDue = todaySlots.filter(
    (slot) =>
      stateFor(slot) === 'completed' &&
      !attendanceToday.some(
        (record) =>
          (slot._id && String(record.timetableSlotId ?? '') === String(slot._id)) ||
          (String(record.timetableId ?? '') === String(slot.timetableId ?? '') &&
            String(record.subjectId) === String(slot.subjectId) &&
            record.periodNumber === slot.periodNo),
      ),
  ).length;

  const profile = (d.profileSummary ?? {}) as {
    designation?: string;
    subjectLabel?: string;
    gender?: string;
  };
  const isFemaleFaculty = String(profile.gender ?? '')
    .trim()
    .toLowerCase()
    .startsWith('f');
  const facultyIllustrations = isFemaleFaculty
    ? {
        hero: '/dashboard/faculty/female-command-hero.png',
        grading: '/dashboard/faculty/female-grading-workflow.png',
        performance: '/dashboard/faculty/student-performance.png',
        syllabus: '/dashboard/faculty/syllabus-roadmap.png',
        lesson: '/dashboard/faculty/lesson-support.png',
      }
    : {
        hero: '/dashboard/faculty/faculty-command-hero.png',
        grading: '/dashboard/faculty/grading-workflow.png',
        performance: '/dashboard/faculty/male-student-performance.png',
        syllabus: '/dashboard/faculty/male-syllabus-roadmap.png',
        lesson: '/dashboard/faculty/male-lesson-support.png',
      };
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'Faculty';
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), 1),
  );
  const daysInMonth = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() + 1,
    0,
  ).getDate();
  const firstWeekday = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
  const calendarCells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  const quickLinks = [
    {
      label: 'Class roster',
      icon: Users,
      href: path('student-roster'),
      tone: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Timetable',
      icon: CalendarDays,
      href: path('timetable'),
      tone: 'text-violet-600 bg-violet-50',
    },
    {
      label: 'Lesson plans',
      icon: BookOpen,
      href: path('lesson-plan'),
      tone: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Attendance',
      icon: ClipboardCheck,
      href: path('attendance'),
      tone: 'text-cyan-600 bg-cyan-50',
    },
    {
      label: 'Assignments',
      icon: FileText,
      href: path('assignment'),
      tone: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'Results',
      icon: Award,
      href: path('course-progress'),
      tone: 'text-rose-600 bg-rose-50',
    },
    {
      label: 'AI Quiz Builder',
      icon: FileQuestion,
      href: path('quiz'),
      tone: 'text-fuchsia-600 bg-fuchsia-50',
    },
  ];
  const assignmentSummary = (d.assignmentSummary ?? {}) as {
    totalAssigned?: number;
    graded?: number;
    pending?: number;
  };
  const recentSubmissions =
    (d.recentSubmissions as
      | Array<{
          assignmentTitle?: string;
          subjectCode?: string;
          classLabel?: string;
          studentName?: string;
          submittedAt?: string;
          isLate?: boolean;
          isGraded?: boolean;
        }>
      | undefined) ?? [];
  const studentMarks =
    (d.studentMarks as
      | Array<{ name?: string; marks?: number; subjectCode?: string }>
      | undefined) ?? [];
  const notices =
    (d.notices as Array<{ _id?: string; title?: string; createdAt?: string }> | undefined) ?? [];
  const assignmentCompletion = Number(assignmentSummary.totalAssigned ?? 0)
    ? Math.round(
        (Number(assignmentSummary.graded ?? 0) / Number(assignmentSummary.totalAssigned)) * 100,
      )
    : 0;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateAtTime = (time?: string) => {
    const date = new Date(todayStart);
    const [hour = 0, minute = 0] = (time ?? '').split(':').map(Number);
    date.setHours(hour, minute, 0, 0);
    return date;
  };
  const upcomingActivities = [
    ...todaySlots
      .filter((slot) => stateFor(slot) !== 'completed')
      .map((slot) => ({
        title: slot.subjectName || slot.subjectCode || 'Scheduled class',
        date: dateAtTime(slot.startTime),
        meta: `${stateFor(slot) === 'live' ? 'Happening now · ' : ''}${formatScheduleTime(slot.startTime)}–${formatScheduleTime(slot.endTime)} · ${slot.roomNo || slot.room || 'Room pending'}`,
      })),
    ...meetings
      .filter((meeting) => new Date(meeting.scheduledAt || '').getTime() >= now.getTime())
      .map((meeting) => ({
        title: meeting.title || 'Faculty meeting',
        date: new Date(meeting.scheduledAt || ''),
        meta: `${meeting.mode || 'Meeting'} · ${fmtDateTime(meeting.scheduledAt)}`,
      })),
    ...upcomingEvents
      .filter((event) => {
        const activityEnd = new Date(event.endDate || event.startDate || '');
        if (Number.isNaN(activityEnd.getTime())) return false;
        activityEnd.setHours(23, 59, 59, 999);
        return activityEnd.getTime() >= now.getTime();
      })
      .map((event) => ({
        title: event.title || 'Academic event',
        date: new Date(event.startDate || ''),
        meta: [event.eventType, event.venue].filter(Boolean).join(' · ') || 'Academic calendar',
      })),
  ]
    .filter((activity) => !Number.isNaN(activity.date.getTime()))
    .sort((left, right) => left.date.getTime() - right.date.getTime())
    .slice(0, 4);

  return (
    <div className="faculty-command-center space-y-5 sm:space-y-6 [&_section]:border [&_section]:border-slate-200">
      <div className="space-y-5">
        <div className="space-y-5">
          <div>
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-3xl bg-[linear-gradient(120deg,#eef8ff_0%,#ffffff_52%,#f3f9ee_100%)]"
            >
              <div className="grid min-h-[22rem] items-center md:grid-cols-[minmax(0,1.15fr)_minmax(20rem,.85fr)] md:min-h-80">
                <div className="relative z-10 px-5 py-7 sm:px-8 md:py-10 2xl:px-10">
                  <span className="inline-flex rounded-full border border-sky-200 bg-white/80 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                    Faculty teaching center
                  </span>
                  <p className="mt-5 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                    Good{' '}
                    {now.getHours() < 12
                      ? 'morning'
                      : now.getHours() < 17
                        ? 'afternoon'
                        : 'evening'}
                    , {firstName}
                  </p>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
                    <strong className="rounded-lg bg-sky-100 px-2 py-1 font-extrabold text-primary">
                      {humanizeLabel(profile.designation || profile.subjectLabel) || 'Faculty'}
                    </strong>{' '}
                    workspace for classes, student progress and teaching preparation.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-700">
                      {todaySlots.length} classes today
                    </span>
                    <span className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-bold text-amber-700">
                      {attendanceDue} attendance tasks
                    </span>
                    <span className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-700">
                      {weeklyTeachingHours.toFixed(1)} weekly hours
                    </span>
                  </div>
                  <Link
                    href={path('timetable')}
                    className="mt-5 inline-flex min-h-11 w-fit items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5"
                  >
                    Open today’s timetable <ArrowUpRight className="size-4" />
                  </Link>
                </div>
                <div className="relative min-h-64 self-stretch md:min-h-full">
                  <div className="absolute inset-4 rounded-[2rem] bg-white/55 md:inset-6" />
                  <Image
                    src={facultyIllustrations.hero}
                    alt="Faculty member organizing the teaching day"
                    fill
                    priority
                    className="object-contain object-center p-3 md:p-5"
                    sizes="(min-width: 1536px) 31vw, (min-width: 768px) 40vw, 100vw"
                  />
                </div>
              </div>
            </motion.section>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card, index) => (
              <Link
                key={card.label}
                href={card.href ?? '#'}
                className={`group relative min-h-40 overflow-hidden rounded-2xl border border-slate-200 px-4 pb-14 pt-4 transition hover:-translate-y-0.5 sm:px-5 sm:pt-5 ${card.bg}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-600">{card.label}</p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                      {card.value}
                    </p>
                  </div>
                  <span
                    className={`flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/75 ${card.fg}`}
                  >
                    {card.icon}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 max-w-[85%] text-xs leading-5 text-slate-500">
                  {card.sub}
                </p>
                <svg
                  viewBox="0 0 80 18"
                  className={`absolute bottom-4 left-4 right-4 h-7 w-auto opacity-55 transition-opacity duration-300 group-hover:opacity-90 sm:left-5 sm:right-5 ${card.fg}`}
                  aria-hidden="true"
                >
                  <polyline
                    points={`0,15 10,${12 - index} 20,14 30,7 40,10 50,${4 + index} 60,8 70,2 80,5`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            ))}
          </div>

          <section className="rounded-2xl bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Quick links</h2>
              <span className="hidden text-sm text-slate-500 sm:block">
                Your teaching workspace
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 2xl:grid-cols-7">
              {quickLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="group flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl px-2 py-3 text-center transition hover:bg-slate-50"
                  >
                    <span
                      className={`flex size-12 items-center justify-center rounded-xl ${item.tone}`}
                    >
                      <Icon className="size-5" />
                    </span>
                    <span className="text-xs font-bold text-slate-700 sm:text-sm">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          <div className="columns-1 gap-4 xl:columns-2">
            <section className="mb-4 inline-block w-full break-inside-avoid align-top rounded-2xl bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Upcoming Activities</h2>
                <Link
                  href={path('academic-calendar')}
                  className="text-[10px] font-bold text-primary"
                >
                  View all
                </Link>
              </div>
              <div className="mt-3 divide-y divide-slate-100">
                {upcomingActivities.map((activity, index) => (
                  <div
                    key={`${activity.title}-${activity.date.toISOString()}-${index}`}
                    className="flex min-h-14 items-center gap-3 py-2"
                  >
                    <span className="flex h-10 w-9 shrink-0 flex-col items-center justify-center rounded-md bg-blue-50 text-primary">
                      <b className="text-[8px] uppercase leading-none">
                        {activity.date.toLocaleDateString('en-IN', { month: 'short' })}
                      </b>
                      <strong className="mt-1 text-xs leading-none">
                        {activity.date.getDate()}
                      </strong>
                    </span>
                    <span className="min-w-0">
                      <b className="block truncate text-[10px] font-bold text-slate-800">
                        {activity.title || 'Academic activity'}
                      </b>
                      <span className="mt-1 block truncate text-[8px] text-slate-600">
                        {activity.meta}
                      </span>
                    </span>
                  </div>
                ))}
                {!upcomingActivities.length && (
                  <div className="flex min-h-24 items-center justify-center text-center text-xs text-slate-600">
                    No upcoming academic activities
                  </div>
                )}
              </div>
            </section>

            <section className="mb-4 inline-block w-full break-inside-avoid align-top rounded-2xl bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Homework submissions</h2>
                  <p className="text-[10px] text-slate-600">Live grading workload</p>
                </div>
                <Link href={path('assignment')} className="text-[10px] font-bold text-primary">
                  View all
                </Link>
              </div>
              <div className="mt-4 flex items-center gap-5">
                <div className="relative flex size-24 shrink-0 items-center justify-center rounded-full">
                  <svg
                    viewBox="0 0 40 40"
                    className="absolute inset-0 -rotate-90"
                    aria-hidden="true"
                  >
                    <circle cx="20" cy="20" r="16" fill="none" stroke="#e8eef5" strokeWidth="4" />
                    <circle
                      cx="20"
                      cy="20"
                      r="16"
                      fill="none"
                      stroke="#0178d7"
                      strokeWidth="4"
                      strokeLinecap="round"
                      pathLength="100"
                      strokeDasharray={`${assignmentCompletion} 100`}
                    />
                  </svg>
                  <div className="flex size-16 flex-col items-center justify-center rounded-full bg-white">
                    <b className="text-lg text-slate-900">{assignmentCompletion}%</b>
                    <span className="text-[8px] text-slate-600">GRADED</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2 text-[10px]">
                  <div className="flex justify-between">
                    <span>Total submitted</span>
                    <b>{assignmentSummary.totalAssigned ?? 0}</b>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span>Graded</span>
                    <b>{assignmentSummary.graded ?? 0}</b>
                  </div>
                  <div className="flex justify-between text-amber-600">
                    <span>Pending</span>
                    <b>{assignmentSummary.pending ?? 0}</b>
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {recentSubmissions.slice(0, 3).map((submission, index) => (
                  <div
                    key={`${submission.studentName}-${index}`}
                    className="flex items-center gap-2 rounded-xl bg-slate-50 p-2"
                  >
                    <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-[9px] font-black text-primary">
                      {(submission.studentName || 'S')[0]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[10px] text-slate-800">
                        {submission.studentName}
                      </b>
                      <span className="block truncate text-[9px] text-slate-600">
                        {submission.subjectCode} · {submission.assignmentTitle}
                      </span>
                    </span>
                    <span
                      className={`text-[8px] font-bold ${submission.isGraded ? 'text-emerald-600' : 'text-amber-600'}`}
                    >
                      {submission.isGraded ? 'Graded' : 'Pending'}
                    </span>
                  </div>
                ))}
                {!recentSubmissions.length && (
                  <div className="flex min-h-28 items-center gap-4 rounded-2xl bg-sky-50/70 p-3">
                    <Image
                      src={facultyIllustrations.grading}
                      alt="Faculty reviewing student submissions"
                      width={150}
                      height={100}
                      className="h-24 w-32 shrink-0 object-contain"
                    />
                    <div>
                      <p className="font-bold text-slate-800">Grading queue is clear</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        New student submissions will appear here for review.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="mb-4 inline-block w-full break-inside-avoid align-top rounded-2xl bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Student performance overview</h2>
                  <p className="text-[10px] text-slate-600">Recent published marks</p>
                </div>
                <Link href={path('course-progress')} className="text-[10px] font-bold text-primary">
                  Details
                </Link>
              </div>
              {studentMarks.length ? (
                <div className="mt-4 h-44 [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart
                      accessibilityLayer={false}
                      data={studentMarks.slice(0, 6)}
                      margin={{ top: 8, right: 4, left: -28, bottom: 0 }}
                    >
                      <CartesianGrid vertical={false} stroke="#eef2f7" />
                      <XAxis
                        dataKey="name"
                        tickFormatter={(value) => String(value).split(' ')[0]}
                        tick={{ fontSize: 8, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 8, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip contentStyle={{ border: 0, borderRadius: 12, fontSize: 11 }} />
                      <Bar dataKey="marks" fill="#0178D7" radius={[5, 5, 0, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="mt-4 flex min-h-36 flex-col items-center justify-center rounded-2xl bg-blue-50/60 px-5 text-center sm:flex-row sm:text-left">
                  <Image
                    src={facultyIllustrations.performance}
                    alt="Faculty member reviewing student performance"
                    width={220}
                    height={150}
                    className="h-36 w-48 shrink-0 object-contain"
                  />
                  <div>
                    <p className="font-bold text-slate-800">Performance insights are preparing</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Published assessment marks will activate the student comparison chart.
                    </p>
                  </div>
                </div>
              )}
            </section>
            <section className="mb-4 inline-block w-full break-inside-avoid overflow-hidden align-top rounded-2xl bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                    <UserRoundSearch className="size-5" />
                  </span>
                  <div>
                    <h2 className="font-bold text-slate-900">Student support</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Attendance-led intervention view
                    </p>
                  </div>
                </div>
                <Link
                  href={path('course-progress')}
                  className="shrink-0 rounded-lg bg-sky-50 px-3 py-2 text-xs font-bold text-primary"
                >
                  Review all
                </Link>
              </div>

              {supportStudents.length > 0 ? (
                <>
                  <div
                    className={`mt-4 flex items-center gap-4 rounded-2xl border p-4 ${urgentSupportCount ? 'border-amber-200 bg-amber-50/70' : 'border-emerald-200 bg-emerald-50/70'}`}
                  >
                    <div className="relative flex size-16 shrink-0 items-center justify-center">
                      <svg
                        viewBox="0 0 40 40"
                        className="absolute inset-0 -rotate-90"
                        aria-hidden="true"
                      >
                        <circle
                          cx="20"
                          cy="20"
                          r="16"
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth="4"
                        />
                        <circle
                          cx="20"
                          cy="20"
                          r="16"
                          fill="none"
                          stroke={urgentSupportCount ? '#f59e0b' : '#10b981'}
                          strokeWidth="4"
                          strokeLinecap="round"
                          pathLength="100"
                          strokeDasharray={`${supportAverage} 100`}
                        />
                      </svg>
                      <strong className="text-sm text-slate-900">{supportAverage}%</strong>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">
                        {urgentSupportCount
                          ? `${urgentSupportCount} ${urgentSupportCount === 1 ? 'student needs' : 'students need'} follow-up`
                          : 'Assigned students are on track'}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        Average attendance across {supportStudents.length} visible student records.
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 px-3">
                    {supportStudents.slice(0, 4).map((student, index) => {
                      const percent = Math.min(100, Number(student.percent ?? 0));
                      const needsAttention = percent < 75;
                      return (
                        <motion.div
                          key={`${student.name}-${index}`}
                          initial={{ opacity: 0, x: 8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.06 }}
                          className="group flex min-h-16 items-center gap-3 py-2.5"
                        >
                          <span
                            className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-black ${needsAttention ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-primary'}`}
                          >
                            {(student.name || 'S')[0]}
                          </span>
                          <span className="min-w-0 flex-1">
                            <b className="block truncate text-sm text-slate-800">{student.name}</b>
                            <span className="mt-0.5 block truncate text-xs text-slate-500">
                              {student.subLabel || 'Assigned class'}
                            </span>
                          </span>
                          <span className="relative flex size-11 shrink-0 items-center justify-center">
                            <svg
                              viewBox="0 0 40 40"
                              className="absolute inset-0 -rotate-90"
                              aria-hidden="true"
                            >
                              <circle
                                cx="20"
                                cy="20"
                                r="16"
                                fill="none"
                                stroke="#e8eef5"
                                strokeWidth="3"
                              />
                              <circle
                                cx="20"
                                cy="20"
                                r="16"
                                fill="none"
                                stroke={needsAttention ? '#f59e0b' : '#0ea5e9'}
                                strokeWidth="3"
                                strokeLinecap="round"
                                pathLength="100"
                                strokeDasharray={`${percent} 100`}
                                className="transition-all duration-500 group-hover:stroke-emerald-500"
                              />
                            </svg>
                            <strong className="text-[10px] text-slate-700">{percent}%</strong>
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="mt-4 rounded-2xl bg-sky-50/70 px-5 py-8 text-center">
                  <UserRoundSearch className="mx-auto size-8 text-primary" />
                  <p className="mt-3 font-bold text-slate-800">No support signals yet</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Student attendance records will activate this intervention view.
                  </p>
                </div>
              )}
            </section>
            <section className="mb-4 inline-block w-full break-inside-avoid align-top rounded-2xl bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Notifications</h2>
                  <p className="text-[10px] text-slate-600">Latest faculty updates</p>
                </div>
                <Link href={path('notification')} className="text-[10px] font-bold text-primary">
                  View all
                </Link>
              </div>
              <div className="mt-3 space-y-2">
                {notices.slice(0, 4).map((notice, index) => (
                  <div
                    key={notice._id || index}
                    className="flex items-start gap-3 rounded-xl bg-slate-50 p-2.5"
                  >
                    <span className="mt-0.5 size-2 rounded-full bg-primary" />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[10px] text-slate-800">
                        {notice.title || 'Institution update'}
                      </b>
                      <span className="text-[9px] text-slate-600">
                        {notice.createdAt ? fmtDateTime(notice.createdAt) : 'Recently updated'}
                      </span>
                    </span>
                  </div>
                ))}
                {!notices.length && (
                  <div className="rounded-2xl bg-sky-50/70 px-4 py-5 text-center">
                    <Bell className="mx-auto size-6 text-primary" />
                    <p className="mt-2 font-bold text-slate-800">You’re up to date</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      New institutional notices and faculty updates will appear here.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        <aside className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,.85fr)]">
          <section className="rounded-2xl bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">Calendar</h2>
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() =>
                  setCalendarMonth(
                    (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1),
                  )
                }
                className="cursor-pointer rounded-lg p-1.5 hover:bg-slate-50"
              >
                <ChevronLeft className="size-4" />
              </button>
              <p className="text-center text-xs font-bold text-slate-800">
                {calendarMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </p>
              <button
                type="button"
                aria-label="Next month"
                onClick={() =>
                  setCalendarMonth(
                    (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1),
                  )
                }
                className="cursor-pointer rounded-lg p-1.5 hover:bg-slate-50"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-7 text-center text-[9px] font-bold text-slate-600">
              {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-y-1 text-center text-[10px]">
              {calendarCells.map((day, index) => (
                <span
                  key={`${day}-${index}`}
                  className={`mx-auto flex size-7 items-center justify-center rounded-full ${day === now.getDate() && calendarMonth.getMonth() === now.getMonth() && calendarMonth.getFullYear() === now.getFullYear() ? 'bg-primary font-bold text-white' : day ? 'text-slate-600' : ''}`}
                >
                  {day}
                </span>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
              <h3 className="text-xs font-bold text-slate-900">Today’s Schedule</h3>
              <Link href={path('timetable')} className="text-[10px] font-bold text-primary">
                View timetable
              </Link>
            </div>
            <div className="mt-3 space-y-2.5">
              {todaySlots.slice(0, 5).map((slot, index) => (
                <div
                  key={`${slot._id}-rail-${index}`}
                  className={`relative grid min-h-14 grid-cols-[4.75rem_minmax(0,1fr)_auto] items-center overflow-hidden rounded-lg bg-white ring-1 ring-slate-100 before:absolute before:inset-y-0 before:left-0 before:w-0.5 ${
                    index % 4 === 0
                      ? 'before:bg-blue-500'
                      : index % 4 === 1
                        ? 'before:bg-violet-400'
                        : index % 4 === 2
                          ? 'before:bg-rose-300'
                          : 'before:bg-amber-300'
                  }`}
                >
                  <span className="flex h-full flex-col justify-center bg-slate-50/80 px-2.5 text-[8px] font-bold leading-4 text-slate-700">
                    <span>{formatScheduleTime(slot.startTime)}</span>
                    <span className="font-medium text-slate-600">
                      {formatScheduleTime(slot.endTime)}
                    </span>
                  </span>
                  <span className="min-w-0 px-3 py-2">
                    <b className="block truncate text-[10px] font-bold text-slate-800">
                      {slot.subjectName || slot.subjectCode || 'Scheduled class'}
                    </b>
                    <span className="mt-0.5 block truncate text-[8px] text-slate-600">
                      {slot.program
                        ? `${slot.program}${slot.section ? ` · ${slot.section}` : ''} · `
                        : ''}
                      {slot.roomNo || slot.room || 'Room pending'}
                    </span>
                  </span>
                  {stateFor(slot) === 'live' && (
                    <span className="mr-2 rounded-md bg-primary px-2 py-1 text-[8px] font-bold text-white">
                      Now
                    </span>
                  )}
                </div>
              ))}
              {!todaySlots.length && (
                <p className="rounded-xl bg-slate-50 px-3 py-5 text-center text-[10px] text-slate-600">
                  No classes scheduled for today
                </p>
              )}
            </div>
          </section>
          <section className="self-start rounded-2xl bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">Smart reminders</h2>
                <p className="mt-1 text-xs text-slate-500">Your next teaching priorities</p>
              </div>
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${attendanceDue + Number(assignmentSummary.pending ?? 0) > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}
              >
                {attendanceDue + Number(assignmentSummary.pending ?? 0)} actions
              </span>
            </div>
            <div className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 px-3">
              {[
                {
                  label: nextClass ? 'Next class' : 'Teaching schedule',
                  detail: nextClass
                    ? `${nextClass.subjectName || nextClass.subjectCode} · ${formatScheduleTime(nextClass.startTime)}`
                    : `${todaySlots.length} ${todaySlots.length === 1 ? 'class' : 'classes'} scheduled today`,
                  icon: Clock,
                  href: 'timetable',
                  tone: 'bg-violet-50 text-violet-600',
                },
                {
                  label: 'Class attendance',
                  detail: attendanceDue
                    ? `${attendanceDue} completed ${attendanceDue === 1 ? 'class needs' : 'classes need'} attendance`
                    : 'All completed class attendance is recorded',
                  icon: ClipboardCheck,
                  href: 'attendance',
                  tone: attendanceDue
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-emerald-50 text-emerald-600',
                },
                {
                  label: 'Assignment grading',
                  detail: Number(assignmentSummary.pending ?? 0)
                    ? `${assignmentSummary.pending} submissions waiting for review`
                    : 'No submissions are waiting for review',
                  icon: FileText,
                  href: 'assignment',
                  tone: Number(assignmentSummary.pending ?? 0)
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-sky-50 text-primary',
                },
                {
                  label: 'Leave requests',
                  detail: Number(d.myPendingLeaves ?? 0)
                    ? `${d.myPendingLeaves} requests awaiting a decision`
                    : 'No pending leave requests',
                  icon: CalendarMinus,
                  href: 'leave',
                  tone: 'bg-blue-50 text-blue-600',
                },
              ].map((reminder) => {
                const ReminderIcon = reminder.icon;
                return (
                  <Link
                    key={reminder.label}
                    href={path(reminder.href)}
                    className="group flex min-h-16 items-center gap-3 py-3"
                  >
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${reminder.tone}`}
                    >
                      <ReminderIcon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block text-sm text-slate-800">{reminder.label}</b>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {reminder.detail}
                      </span>
                    </span>
                    <ArrowUpRight className="size-4 shrink-0 text-slate-300 transition group-hover:text-primary" />
                  </Link>
                );
              })}
            </div>
          </section>
        </aside>
      </div>

      <div className="space-y-4">
        <section className="rounded-3xl bg-white p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-base font-bold text-slate-900">Teaching analytics</h2>
              <p className="mt-1 text-xs text-slate-500">
                Live indicators from your timetable, course delivery, lesson plans and student
                records.
              </p>
            </div>
            <Link href={path('course-progress')} className="text-xs font-bold text-primary">
              Open detailed progress
            </Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: 'Weekly teaching load',
                value: `${weeklyTeachingHours.toFixed(1)}h`,
                note: `${weeklyTeachingSlots} assigned teaching periods`,
                icon: Clock,
                tone: 'bg-sky-50 text-sky-700',
                progress: Math.min(100, (weeklyTeachingHours / 20) * 100),
              },
              {
                label: 'Syllabus coverage',
                value: `${averageCoverage}%`,
                note: `${courseProgress.length} subjects reporting progress`,
                icon: Gauge,
                tone: 'bg-emerald-50 text-emerald-700',
                progress: averageCoverage,
              },
              {
                label: 'Lesson-plan readiness',
                value: `${lessonPlanReadiness}%`,
                note: `${lessonPlans.length} recent lesson plans`,
                icon: BookCheck,
                tone: 'bg-violet-50 text-violet-700',
                progress: lessonPlanReadiness,
              },
              {
                label: 'Student signals',
                value: studentProgress.length,
                note: 'Students visible in your progress view',
                icon: UserRoundSearch,
                tone: 'bg-amber-50 text-amber-700',
                progress: Math.min(100, studentProgress.length * 10),
              },
            ].map((metric, index) => {
              const MetricIcon = metric.icon;
              return (
                <motion.article
                  key={metric.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -2 }}
                  className="rounded-2xl bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`flex size-9 items-center justify-center rounded-xl ${metric.tone}`}
                    >
                      <MetricIcon className="size-4" />
                    </span>
                    <span className="text-xl font-black text-slate-900">{metric.value}</span>
                  </div>
                  <p className="mt-3 text-xs font-bold text-slate-800">{metric.label}</p>
                  <p className="mt-1 min-h-8 text-[11px] leading-4 text-slate-500">{metric.note}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${metric.progress}%` }}
                      transition={{ duration: 0.7, delay: 0.1 + index * 0.06 }}
                      className="h-full rounded-full bg-primary"
                    />
                  </div>
                </motion.article>
              );
            })}
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,.65fr)]">
          <section className="rounded-3xl bg-white p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Weekly teaching distribution</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Assigned contact hours and teaching periods by day.
                </p>
              </div>
              <span className="rounded-xl bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700">
                {weeklyTeachingHours.toFixed(1)} hours
              </span>
            </div>
            <div className="mt-4 min-h-64">
              {teachingLoadByDay.length ? (
                <ResponsiveContainer width="100%" height={256} minWidth={0} minHeight={0}>
                  <BarChart
                    data={teachingLoadByDay}
                    margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                    />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid #e2e8f0',
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="hours"
                      name="Teaching hours"
                      fill="#0178D7"
                      radius={[7, 7, 0, 0]}
                      maxBarSize={42}
                      animationDuration={900}
                      animationEasing="ease-out"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex min-h-64 items-center justify-center rounded-2xl bg-sky-50/60 p-5 text-center">
                  <div>
                    <Clock className="mx-auto size-8 text-primary" />
                    <p className="mt-3 font-bold text-slate-800">Teaching load is not scheduled</p>
                    <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
                      Timetable assignments will build the weekly distribution automatically.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-5 sm:p-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">Subject delivery health</h2>
              <p className="mt-1 text-xs text-slate-500">
                Coverage comparison across assigned subjects.
              </p>
            </div>
            <div className="mt-4 min-h-64">
              {courseProgress.length ? (
                <ResponsiveContainer width="100%" height={256} minWidth={0} minHeight={0}>
                  <RadarChart data={subjectDeliveryData.slice(0, 8)} outerRadius="72%">
                    <PolarGrid stroke="#dbe7ef" gridType="polygon" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }}
                    />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Tooltip
                      formatter={(value) => [`${Number(value)}%`, 'Coverage']}
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid #e2e8f0',
                        fontSize: 12,
                      }}
                    />
                    <Radar
                      dataKey="coverage"
                      name="Coverage"
                      stroke="#0f9f75"
                      fill="#6ee7b7"
                      fillOpacity={0.42}
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#ffffff', strokeWidth: 2 }}
                      animationDuration={1100}
                      animationEasing="ease-out"
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl bg-emerald-50/60 p-5 text-center">
                  <Image
                    src={facultyIllustrations.syllabus}
                    alt="Faculty member organizing a syllabus roadmap"
                    width={210}
                    height={140}
                    className="h-36 w-48 object-contain"
                  />
                  <p className="mt-2 font-bold text-slate-800">Course coverage is not recorded</p>
                  <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
                    Update subject delivery to build this comparison automatically.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <section className="rounded-3xl bg-white p-5 sm:p-6 xl:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">My attendance trend</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Your faculty check-in status across the latest seven days.
                </p>
              </div>
              <Link href={path('faculty-attendance')} className="text-xs font-bold text-primary">
                View attendance record
              </Link>
            </div>
            <div className="mt-4 min-h-64">
              {attendanceTrend.some((day) => day.value !== null) ? (
                <ResponsiveContainer width="100%" height={256} minWidth={0} minHeight={0}>
                  <LineChart
                    data={attendanceTrend}
                    margin={{ top: 10, right: 18, left: -22, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 11 }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 50, 100]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                    />
                    <Tooltip
                      formatter={(value, _name, item) => [item.payload.status, 'Status']}
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid #e2e8f0',
                        fontSize: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#0178D7"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#fff', strokeWidth: 3 }}
                      connectNulls={false}
                      animationDuration={1100}
                      animationEasing="ease-out"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex min-h-64 items-center justify-center rounded-2xl bg-sky-50/60 p-6 text-center">
                  <div className="max-w-md">
                    <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-white text-primary">
                      <ClipboardCheck className="size-7" />
                    </span>
                    <p className="mt-4 font-bold text-slate-800">
                      Attendance trend needs check-ins
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Recorded faculty attendance will form a smooth seven-day trend here.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Lesson-plan readiness</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Recent plans requiring teaching preparation.
                </p>
              </div>
              <Link href={path('lesson-plan')} className="text-xs font-bold text-primary">
                Open
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {lessonPlans.slice(0, 5).map((plan, index) => (
                <motion.div
                  key={`${plan.title}-${index}`}
                  whileHover={{ x: 3 }}
                  className="rounded-2xl bg-slate-50 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-xs font-bold text-slate-800">
                      {plan.title || 'Lesson plan'}
                    </p>
                    <span className="text-xs font-black text-primary">
                      {Number(plan.percent ?? 0)}%
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {plan.section || 'Assigned class'}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Number(plan.percent ?? 0))}%` }}
                      className="h-full rounded-full bg-violet-500"
                    />
                  </div>
                </motion.div>
              ))}
              {!lessonPlans.length && (
                <div className="rounded-2xl bg-amber-50/70 p-4 text-center text-amber-900">
                  <Image
                    src={facultyIllustrations.lesson}
                    alt="Faculty preparing a lesson with students"
                    width={230}
                    height={150}
                    className="mx-auto h-36 w-52 object-contain"
                  />
                  <p className="mt-2 font-bold">Start your lesson-planning workflow</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm leading-6">
                    Create plans for assigned subjects to track teaching readiness and evidence.
                  </p>
                  <Link
                    href={path('lesson-plan')}
                    className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-white px-4 text-sm font-bold text-amber-800"
                  >
                    Create lesson plan
                  </Link>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/**
 * @file StudentDashboard.tsx
 * @description Student dashboard composed to match the supplied student reference.
 * @module features/dashboard/role-dashboards
 */
'use client';

import React from 'react';
import { useRouter } from 'nextjs-toploader/app';
import {
  Area,
  AreaChart,
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
  Bell,
  BookOpen,
  Bus,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  FileText,
  GraduationCap,
  Library,
  Wallet,
} from 'lucide-react';
import type { AnyRecord, INotice } from '../views/shared';
import { fmtDate, useRolePath } from '../views/shared';
import {
  ReferenceEmpty,
  ReferenceHeading,
  ReferencePanel,
  ReferenceStat,
  referenceCurrency,
  referenceNumber,
} from './reference-ui';

interface IProfile {
  name?: string;
  program?: string;
  classLabel?: string;
  currentSemester?: number | string;
  academicYear?: string;
}
interface IAttendance {
  workingDays?: number;
  present?: number;
  absent?: number;
  halfday?: number;
  percentage?: number;
  donut?: {
    present?: number;
    absent?: number;
    late?: number;
    emergency?: number;
    percentage?: number;
  };
}
interface IClass {
  subjectName?: string;
  subjectCode?: string;
  startTime?: string;
  endTime?: string;
  facultyName?: string;
  room?: string;
  status?: string;
}
interface IHomework {
  _id?: string;
  title?: string;
  subjectCode?: string;
  dueDate?: string;
  status?: string;
  progress?: number;
}
interface IExam {
  examTitle?: string;
  examType?: string;
  examDate?: string;
  subject?: string;
}
interface IPerformance {
  label?: string;
  examScore?: number;
  attendance?: number;
}
interface IFee {
  balanceDue?: number;
  totalAmount?: number;
  totalPaid?: number;
  dueDate?: string;
}

const tooltipStyle = { border: '1px solid #e7e9f3', borderRadius: 8, fontSize: 10 };

/** Renders the database-backed student dashboard inside the existing ERP shell. */
export default function StudentDashboard({ d }: { d: AnyRecord }) {
  const router = useRouter();
  const path = useRolePath();
  const profile = (d.profileSummary as IProfile | undefined) ?? {};
  const attendance = (d.attendanceSummary as IAttendance | undefined) ?? {};
  const classes = (d.todayClasses as IClass[] | undefined) ?? [];
  const assignments = (d.homeworks as IHomework[] | undefined) ?? [];
  const exams = (d.upcomingExams as IExam[] | undefined) ?? [];
  const notices = (d.notices as INotice[] | undefined) ?? [];
  const performance = (d.performance as IPerformance[] | undefined) ?? [];
  const fees = (d.feesReminder as IFee[] | undefined) ?? [];
  const academic = d.academicSummary as { cgpa?: number | null } | null | undefined;
  const attendancePercentage = attendance.donut?.percentage;
  const pendingAssignments = assignments.filter(
    (item) => !['submitted', 'graded', 'completed'].includes(item.status?.toLowerCase() ?? ''),
  );
  const dueFees = fees.reduce((sum, fee) => sum + Number(fee.balanceDue ?? 0), 0);
  const totalFees = fees.reduce((sum, fee) => sum + Number(fee.totalAmount ?? 0), 0);
  const paidFees = fees.reduce((sum, fee) => sum + Number(fee.totalPaid ?? 0), 0);
  const attendanceChart = [
    { name: 'Present', value: Number(attendance.donut?.present ?? 0), color: '#13a873' },
    { name: 'Absent', value: Number(attendance.donut?.absent ?? 0), color: '#f0445e' },
    { name: 'Late', value: Number(attendance.donut?.late ?? 0), color: '#2979ef' },
    { name: 'Leave', value: Number(attendance.donut?.emergency ?? 0), color: '#ffab25' },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-3">
      <ReferenceHeading
        title="Student Dashboard 👋"
        subtitle={`Welcome back, ${profile.name ?? 'Student'}!`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <ReferenceStat
          label="Attendance"
          value={attendancePercentage == null ? '—' : `${Number(attendancePercentage).toFixed(1)}%`}
          detail="View details"
          icon={<CalendarCheck className="h-6 w-6" />}
          tone="green"
        />
        <ReferenceStat
          label="Overall CGPA"
          value={academic?.cgpa == null ? '—' : `${Number(academic.cgpa).toFixed(2)} / 10`}
          detail="View grades"
          icon={<GraduationCap className="h-6 w-6" />}
          tone="blue"
        />
        <ReferenceStat
          label="Pending Assignments"
          value={referenceNumber(pendingAssignments.length)}
          detail="View assignments"
          icon={<FileText className="h-6 w-6" />}
          tone="amber"
        />
        <ReferenceStat
          label="Due Fees"
          value={referenceCurrency(dueFees)}
          detail="Pay now"
          icon={<Wallet className="h-6 w-6" />}
          tone="rose"
        />
        <ReferenceStat
          label="Library Books"
          value={referenceNumber(d.libraryBooks)}
          detail="View books"
          icon={<BookOpen className="h-6 w-6" />}
          tone="violet"
        />
        <ReferenceStat
          label="Notifications"
          value={referenceNumber(d.unreadNotifications)}
          detail="View all"
          icon={<Bell className="h-6 w-6" />}
          tone="cyan"
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <ReferencePanel title="Today's Timetable" className="xl:col-span-5">
          {classes.length ? (
            <div className="overflow-x-auto">
              <div className="min-w-[570px]">
                <div className="grid grid-cols-[1.1fr_1.25fr_1.2fr_.65fr_.75fr] border-b border-[#edf0f6] pb-2 text-[9px] font-semibold text-[#69708f]">
                  <span>Time</span>
                  <span>Subject</span>
                  <span>Faculty</span>
                  <span>Room</span>
                  <span>Status</span>
                </div>
                {classes.slice(0, 6).map((item, index) => (
                  <div
                    key={`${item.subjectCode ?? item.subjectName}-${index}`}
                    className="grid grid-cols-[1.1fr_1.25fr_1.2fr_.65fr_.75fr] items-center border-b border-[#edf0f6] py-3 text-[10px] last:border-0"
                  >
                    <span>
                      {item.startTime} – {item.endTime}
                    </span>
                    <strong className="truncate pr-2">
                      {item.subjectName ?? item.subjectCode ?? '—'}
                    </strong>
                    <span className="truncate pr-2">{item.facultyName ?? '—'}</span>
                    <span>{item.room ?? '—'}</span>
                    <span className="rounded-md bg-blue-50 px-2 py-1 text-center text-blue-600">
                      {item.status ?? 'Upcoming'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ReferenceEmpty label="No classes scheduled today." />
          )}
        </ReferencePanel>

        <ReferencePanel title="Attendance Overview" className="xl:col-span-3">
          <div className="relative h-[190px]">
            {attendanceChart.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie data={attendanceChart} dataKey="value" innerRadius={54} outerRadius={72}>
                    {attendanceChart.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ReferenceEmpty label="Attendance has not been marked yet." />
            )}
            {attendanceChart.length > 0 && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <strong className="text-xl">
                  {attendancePercentage == null ? '—' : `${attendancePercentage.toFixed(1)}%`}
                </strong>
                <span className="text-[9px] text-[#747b99]">Present</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-[9px]">
            {[
              ['Total Classes', attendance.workingDays ?? 0],
              ['Attended', attendance.present ?? 0],
              ['Absent', attendance.absent ?? 0],
              ['Leaves', attendance.halfday ?? 0],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg bg-[#f8f9fd] p-2">
                <strong className="block text-sm">{referenceNumber(value)}</strong>
                {String(label)}
              </div>
            ))}
          </div>
        </ReferencePanel>

        <ReferencePanel
          title="Upcoming Events"
          actionLabel="View Calendar"
          onAction={() => router.push(path('academic-calendar'))}
          className="xl:col-span-4"
        >
          <div className="space-y-2">
            {exams.length ? (
              exams.slice(0, 5).map((exam, index) => (
                <div
                  key={`${exam.examTitle}-${index}`}
                  className="flex justify-between rounded-lg border border-[#edf0f6] p-3 text-[10px]"
                >
                  <span className="font-semibold">{exam.subject ?? exam.examTitle}</span>
                  <span>{fmtDate(exam.examDate)}</span>
                </div>
              ))
            ) : (
              <ReferenceEmpty label="No upcoming events were returned by the dashboard API." />
            )}
          </div>
        </ReferencePanel>
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <ReferencePanel
          title="My Assignments"
          actionLabel="View All"
          onAction={() => router.push(path('assignment'))}
          className="xl:col-span-4"
        >
          <div className="space-y-1.5">
            {assignments.length ? (
              assignments.slice(0, 4).map((item, index) => (
                <div
                  key={item._id ?? index}
                  className="flex items-center gap-3 border-b border-[#edf0f6] py-2 last:border-0"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <ClipboardList className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-semibold">
                      {item.title ?? item.subjectCode ?? 'Assignment'}
                    </p>
                    <p className="text-[9px] text-[#858ba4]">Due {fmtDate(item.dueDate)}</p>
                  </div>
                  <span className="rounded-md bg-amber-50 px-2 py-1 text-[9px] text-amber-600">
                    {item.status ?? 'Pending'}
                  </span>
                </div>
              ))
            ) : (
              <ReferenceEmpty label="No assignments." />
            )}
          </div>
        </ReferencePanel>
        <ReferencePanel
          title="Important Notices"
          actionLabel="View All"
          onAction={() => router.push(path('notice'))}
          className="xl:col-span-4"
        >
          <div className="space-y-2">
            {notices.length ? (
              notices.slice(0, 4).map((notice) => (
                <div key={notice._id} className="rounded-lg bg-violet-50/60 px-3 py-2">
                  <p className="truncate text-[10px] font-semibold">{notice.title}</p>
                  <p className="mt-0.5 text-[9px] text-[#858ba4]">
                    {fmtDate(notice.publishedAt ?? notice.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <ReferenceEmpty label="No important notices." />
            )}
          </div>
        </ReferencePanel>
        <ReferencePanel
          title="Upcoming Exams"
          actionLabel="View All"
          onAction={() => router.push(path('examination'))}
          className="xl:col-span-4"
        >
          <div className="space-y-2">
            {exams.length ? (
              exams.slice(0, 4).map((exam, index) => (
                <div
                  key={`${exam.examTitle}-${index}`}
                  className="flex items-center gap-3 rounded-lg bg-[#f8f9fd] p-3"
                >
                  <CalendarDays className="h-4 w-4 text-blue-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-semibold">
                      {exam.subject ?? exam.examTitle ?? 'Exam'}
                    </p>
                    <p className="text-[9px] text-[#858ba4]">{exam.examType ?? ''}</p>
                  </div>
                  <strong className="text-[10px]">{fmtDate(exam.examDate)}</strong>
                </div>
              ))
            ) : (
              <ReferenceEmpty label="No upcoming exams." />
            )}
          </div>
        </ReferencePanel>
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <ReferencePanel title="Academic Progress" className="xl:col-span-4">
          <div className="h-[190px]">
            {performance.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={performance} margin={{ left: -30, right: 8 }}>
                  <CartesianGrid vertical={false} stroke="#edf0f6" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="examScore" stroke="#6544e8" fill="#6544e81f" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ReferenceEmpty label="Academic progress is not available yet." />
            )}
          </div>
        </ReferencePanel>
        <ReferencePanel
          title="Fee Payment Status"
          actionLabel="View All"
          onAction={() => router.push(path('fee'))}
          className="xl:col-span-4"
        >
          <div className="grid grid-cols-3 gap-2">
            {[
              ['Total Fees', totalFees],
              ['Paid Fees', paidFees],
              ['Due Fees', dueFees],
            ].map(([label, value], index) => (
              <div
                key={String(label)}
                className={`rounded-lg p-3 ${index === 1 ? 'bg-emerald-50' : index === 2 ? 'bg-rose-50' : 'bg-[#f8f9fd]'}`}
              >
                <p className="text-[9px] text-[#69708f]">{String(label)}</p>
                <strong className="mt-2 block text-sm">{referenceCurrency(value)}</strong>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => router.push(path('fee'))}
            className="mt-4 w-full rounded-lg bg-[#6544e8] py-2.5 text-[10px] font-semibold text-white"
          >
            Pay Now
          </button>
        </ReferencePanel>
        <ReferencePanel title="Quick Links" className="xl:col-span-4">
          <div className="grid grid-cols-4 gap-2">
            {[
              ['Study Material', FileText, 'study-material'],
              ['Library Portal', Library, 'library'],
              ['Exam Portal', GraduationCap, 'examination'],
              ['Transport Pass', Bus, 'transport'],
            ].map(([label, Icon, href]) => {
              const LinkIcon = Icon as React.ComponentType<{ className?: string }>;
              return (
                <button
                  key={String(label)}
                  type="button"
                  onClick={() => router.push(path(String(href)))}
                  className="flex min-h-20 flex-col items-center justify-center rounded-lg border border-[#edf0f6] px-1 text-center text-[9px] font-semibold"
                >
                  <LinkIcon className="mb-2 h-5 w-5 text-blue-600" />
                  {String(label)}
                </button>
              );
            })}
          </div>
        </ReferencePanel>
      </div>
    </div>
  );
}

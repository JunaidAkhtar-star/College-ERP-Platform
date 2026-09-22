/**
 * @file ParentDashboard.tsx
 * @description Parent dashboard matching the supplied parent reference with ward-scoped data.
 * @module features/dashboard/role-dashboards
 */
'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'nextjs-toploader/app';
import {
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
  Bell,
  BookOpen,
  Bus,
  CalendarCheck,
  CalendarDays,
  FileText,
  GraduationCap,
  Library,
  MapPin,
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

interface IChild {
  name?: string;
  program?: string;
  currentSemester?: number;
  academicYear?: string;
  section?: string;
}
interface IAttendanceRow {
  subjectCode?: string;
  percentage?: number;
  totalClasses?: number;
  attended?: number;
}
interface IClass {
  subjectName?: string;
  subjectCode?: string;
  startTime?: string;
  facultyName?: string;
  room?: string;
}
interface IHomework {
  _id?: string;
  title?: string;
  subjectCode?: string;
  dueDate?: string;
}
interface IExam {
  examTitle?: string;
  subject?: string;
  examDate?: string;
}
interface IEvent {
  _id?: string;
  title?: string;
  startDate?: string;
  venue?: string;
}
interface IFee {
  feeType?: string;
  balanceDue?: number;
  dueDate?: string;
  status?: string;
}
interface IFeePayment {
  receiptNumber?: string;
  amountPaid?: number;
  paymentDate?: string;
  paymentMode?: string;
}
interface IGrade {
  subject?: string;
  percentage?: number;
}
interface IRoute {
  routeNo?: string;
  routeName?: string;
  driverName?: string;
  driverPhone?: string;
  vehicleNo?: string;
  gps?: { lat?: number; lng?: number; speed?: number; recordedAt?: string };
}
interface ITransportAllocation {
  stopName?: string;
  routeId?: IRoute;
}

const tooltipStyle = { border: '1px solid #e7e9f3', borderRadius: 8, fontSize: 10 };

/** Renders the parent's live ward overview. */
export default function ParentDashboard({ d }: { d: AnyRecord }) {
  const router = useRouter();
  const path = useRolePath();
  const child = (d.child as IChild | undefined) ?? {};
  const attendance = (d.attendanceSummary as IAttendanceRow[] | undefined) ?? [];
  const classes = (d.todayClasses as IClass[] | undefined) ?? [];
  const assignments = (d.homeworks as IHomework[] | undefined) ?? [];
  const exams = (d.upcomingExams as IExam[] | undefined) ?? [];
  const events = (d.events as IEvent[] | undefined) ?? [];
  const notices = (d.notices as INotice[] | undefined) ?? [];
  const fees = (d.feesReminder as IFee[] | undefined) ?? [];
  const payments = (d.recentFeePayments as IFeePayment[] | undefined) ?? [];
  const grades = (d.examResultBars as IGrade[] | undefined) ?? [];
  const transport = (d.transportAllocation as ITransportAllocation | undefined) ?? {};
  const academic = d.academicSummary as { cgpa?: number | null } | null | undefined;
  const dueFees = fees.reduce((sum, item) => sum + Number(item.balanceDue ?? 0), 0);
  const totalClasses = attendance.reduce((sum, item) => sum + Number(item.totalClasses ?? 0), 0);
  const attendedClasses = attendance.reduce((sum, item) => sum + Number(item.attended ?? 0), 0);
  const attendancePercentage = totalClasses > 0 ? (attendedClasses / totalClasses) * 100 : null;
  const attendanceDonut = [
    { name: 'Present', value: attendedClasses, color: '#12a873' },
    { name: 'Absent', value: Math.max(totalClasses - attendedClasses, 0), color: '#ef476f' },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-3">
      <ReferenceHeading
        title="Parent Dashboard 👋"
        subtitle={`Here’s what’s happening with ${child.name ?? 'your child'} today.`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-5">
        <ReferenceStat
          label="Attendance"
          value={attendancePercentage == null ? '—' : `${Number(attendancePercentage).toFixed(1)}%`}
          detail="Current term"
          icon={<CalendarCheck className="h-6 w-6" />}
          tone="violet"
        />
        <ReferenceStat
          label="Overall Grade"
          value={academic?.cgpa == null ? '—' : `${Number(academic.cgpa).toFixed(2)} / 10`}
          detail="Current grade"
          icon={<GraduationCap className="h-6 w-6" />}
          tone="green"
        />
        <ReferenceStat
          label="Pending Fees"
          value={referenceCurrency(dueFees)}
          detail={fees[0]?.dueDate ? `Due ${fmtDate(fees[0].dueDate)}` : 'No due date'}
          icon={<Wallet className="h-6 w-6" />}
          tone="blue"
        />
        <ReferenceStat
          label="Upcoming Exams"
          value={referenceNumber(exams.length)}
          detail={exams[0]?.examDate ? `Next ${fmtDate(exams[0].examDate)}` : 'No scheduled exam'}
          icon={<CalendarDays className="h-6 w-6" />}
          tone="amber"
        />
        <ReferenceStat
          label="Unread Notices"
          value={referenceNumber(notices.length)}
          detail="New notifications"
          icon={<Bell className="h-6 w-6" />}
          tone="rose"
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <ReferencePanel
          title="Academic Performance"
          actionLabel="View Details"
          onAction={() => router.push(path('examination'))}
          className="xl:col-span-5"
        >
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="h-53.75 lg:col-span-2">
              {grades.length ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={grades} margin={{ left: -28, right: 5 }}>
                    <CartesianGrid vertical={false} stroke="#edf0f6" />
                    <XAxis
                      dataKey="subject"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 9 }}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="percentage" fill="#6544e8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ReferenceEmpty label="Published grades will appear here." />
              )}
            </div>
            <div className="flex items-center justify-center">
              <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full border-14 border-emerald-500">
                <strong className="text-xl">
                  {academic?.cgpa == null ? '—' : Number(academic.cgpa).toFixed(2)}
                </strong>
                <span className="text-[9px] text-[#747b99]">GPA</span>
              </div>
            </div>
          </div>
        </ReferencePanel>

        <ReferencePanel
          title="Today's Schedule"
          actionLabel="View Timetable"
          onAction={() => router.push(path('timetable'))}
          className="xl:col-span-4"
        >
          <div className="space-y-1.5">
            {classes.length ? (
              classes.slice(0, 6).map((item, index) => (
                <div
                  key={`${item.subjectCode}-${index}`}
                  className="grid grid-cols-[60px_1fr_auto] items-center gap-2 rounded-lg bg-[#f8f9fd] p-2.5"
                >
                  <span className="text-[9px] text-[#69708f]">{item.startTime}</span>
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-semibold">
                      {item.subjectName ?? item.subjectCode ?? 'Class'}
                    </p>
                    <p className="truncate text-[9px] text-[#858ba4]">{item.facultyName ?? ''}</p>
                  </div>
                  <strong className="text-[9px]">{item.room ?? '—'}</strong>
                </div>
              ))
            ) : (
              <ReferenceEmpty label="No classes scheduled today." />
            )}
          </div>
        </ReferencePanel>

        <ReferencePanel
          title="Important Announcements"
          actionLabel="View All"
          onAction={() => router.push(path('notice'))}
          className="xl:col-span-3"
        >
          <div className="space-y-2">
            {notices.length ? (
              notices.slice(0, 4).map((notice) => (
                <div key={notice._id} className="flex gap-2 rounded-lg border border-[#edf0f6] p-3">
                  <Bell className="h-4 w-4 shrink-0 text-violet-600" />
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-semibold">{notice.title}</p>
                    <p className="mt-1 text-[9px] text-[#858ba4]">
                      {fmtDate(notice.publishedAt ?? notice.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <ReferenceEmpty label="No announcements." />
            )}
          </div>
        </ReferencePanel>
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <ReferencePanel title="Attendance Overview (This Month)" className="xl:col-span-3">
          <div className="relative h-45">
            {attendanceDonut.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie data={attendanceDonut} dataKey="value" innerRadius={50} outerRadius={69}>
                    {attendanceDonut.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ReferenceEmpty label="Attendance not available." />
            )}{' '}
            {attendanceDonut.length > 0 && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <strong className="text-xl">
                  {attendancePercentage == null ? '—' : `${attendancePercentage.toFixed(1)}%`}
                </strong>
                <span className="text-[9px] text-[#747b99]">Present</span>
              </div>
            )}
          </div>
        </ReferencePanel>
        <ReferencePanel
          title="Recent Assignments"
          actionLabel="View All"
          onAction={() => router.push(path('assignment'))}
          className="xl:col-span-3"
        >
          <div className="space-y-1.5">
            {assignments.length ? (
              assignments.slice(0, 5).map((item, index) => (
                <div
                  key={item._id ?? index}
                  className="flex items-center gap-2 border-b border-[#edf0f6] py-2 last:border-0"
                >
                  <FileText className="h-4 w-4 text-blue-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-semibold">
                      {item.title ?? item.subjectCode}
                    </p>
                    <p className="text-[9px] text-[#858ba4]">Due {fmtDate(item.dueDate)}</p>
                  </div>
                </div>
              ))
            ) : (
              <ReferenceEmpty label="No recent assignments." />
            )}
          </div>
        </ReferencePanel>
        <ReferencePanel
          title="Fee Payment Summary"
          actionLabel="View All"
          onAction={() => router.push(path('fee'))}
          className="xl:col-span-3"
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-[9px] text-[#69708f]">Paid Fees</p>
              <strong className="mt-2 block text-sm text-emerald-600">
                {referenceCurrency(
                  payments.reduce((sum, item) => sum + Number(item.amountPaid ?? 0), 0),
                )}
              </strong>
            </div>
            <div className="rounded-lg bg-rose-50 p-3">
              <p className="text-[9px] text-[#69708f]">Pending Fees</p>
              <strong className="mt-2 block text-sm text-rose-600">
                {referenceCurrency(dueFees)}
              </strong>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push(path('fee'))}
            className="mt-4 w-full rounded-lg bg-[#6544e8] py-2.5 text-[10px] font-semibold text-white"
          >
            Pay Fees Online
          </button>
        </ReferencePanel>
        <ReferencePanel
          title="Upcoming Events"
          actionLabel="View Calendar"
          onAction={() => router.push(path('academic-calendar'))}
          className="xl:col-span-3"
        >
          <div className="space-y-1.5">
            {events.length ? (
              events.slice(0, 5).map((event, index) => (
                <div
                  key={event._id ?? index}
                  className="flex gap-2 border-b border-[#edf0f6] py-2 last:border-0"
                >
                  <CalendarDays className="h-4 w-4 text-blue-600" />
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-semibold">{event.title}</p>
                    <p className="text-[9px] text-[#858ba4]">{fmtDate(event.startDate)}</p>
                  </div>
                </div>
              ))
            ) : (
              <ReferenceEmpty label="No upcoming events." />
            )}
          </div>
        </ReferencePanel>
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <ReferencePanel title="Transport Tracking" className="xl:col-span-5">
          {transport.routeId ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="relative h-40 overflow-hidden rounded-lg sm:col-span-2">
                <Image
                  src="/dashboard/transport-route-map.svg"
                  alt="Live route map"
                  fill
                  className="object-cover"
                  sizes="500px"
                />
              </div>
              <div className="space-y-2 text-[9px]">
                <p>
                  <strong>Bus No.</strong>
                  <br />
                  {transport.routeId.vehicleNo ?? '—'}
                </p>
                <p>
                  <strong>Route</strong>
                  <br />
                  {transport.routeId.routeName ?? transport.routeId.routeNo ?? '—'}
                </p>
                <p>
                  <strong>Driver</strong>
                  <br />
                  {transport.routeId.driverName ?? '—'}
                </p>
                <p>
                  <MapPin className="mr-1 inline h-3 w-3 text-emerald-600" />
                  {transport.stopName ?? '—'}
                </p>
              </div>
            </div>
          ) : (
            <ReferenceEmpty label="No active transport allocation for this ward." />
          )}
        </ReferencePanel>
        <ReferencePanel
          title="Fee Payment History"
          actionLabel="View All"
          onAction={() => router.push(path('fee'))}
          className="xl:col-span-4"
        >
          <div>
            {payments.length ? (
              payments.slice(0, 5).map((payment, index) => (
                <div
                  key={payment.receiptNumber ?? index}
                  className="grid grid-cols-[1fr_auto] border-b border-[#edf0f6] py-2 text-[10px] last:border-0"
                >
                  <div>
                    <p className="font-semibold">{payment.paymentMode ?? 'Payment'}</p>
                    <p className="text-[9px] text-[#858ba4]">{fmtDate(payment.paymentDate)}</p>
                  </div>
                  <strong className="text-emerald-600">
                    {referenceCurrency(payment.amountPaid)}
                  </strong>
                </div>
              ))
            ) : (
              <ReferenceEmpty label="No fee-payment history." />
            )}
          </div>
        </ReferencePanel>
        <ReferencePanel title="Quick Links" className="xl:col-span-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Study Material', FileText, 'study-material'],
              ['Library Portal', Library, 'library'],
              ['Exam Portal', GraduationCap, 'examination'],
              ['Transport', Bus, 'transport'],
              ['Calendar', CalendarDays, 'academic-calendar'],
              ['Contact School', BookOpen, 'chat'],
            ].map(([label, Icon, href]) => {
              const LinkIcon = Icon as React.ComponentType<{ className?: string }>;
              return (
                <button
                  key={String(label)}
                  type="button"
                  onClick={() => router.push(path(String(href)))}
                  className="flex min-h-16 flex-col items-center justify-center rounded-lg border border-[#edf0f6] px-2 text-center text-[9px] font-semibold"
                >
                  <LinkIcon className="mb-1.5 h-4 w-4 text-blue-600" />
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

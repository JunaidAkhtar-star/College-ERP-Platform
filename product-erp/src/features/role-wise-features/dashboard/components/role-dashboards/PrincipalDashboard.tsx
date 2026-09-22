/** Principal institution overview built exclusively from the principal dashboard API. */
'use client';

import React from 'react';
import Image from 'next/image';
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
  ArrowRight,
  Bell,
  BookOpenCheck,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  IndianRupee,
  Megaphone,
  MessageCircle,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import type { AnyRecord, INotice } from '../views/shared';
import { fmtDate, useRolePath } from '../views/shared';
import { motion } from '@/shared/utils/motion';
import CustomTable, { type Column, type RecordWithId } from '@/shared/core/CustomTable';
import { ReferenceEmpty, referenceCurrency, referenceNumber } from './reference-ui';

interface IDepartment {
  departmentId?: string;
  name?: string;
  code?: string;
  students?: number;
  teachers?: number;
  attendancePercentage?: number | null;
  passPercentage?: number | null;
  feeCollected?: number;
  pendingFees?: number;
}
interface IEnrollmentPoint {
  year?: number;
  month?: number;
  value?: number;
}
interface IAttendanceSessionPoint {
  year?: number;
  month?: number;
  present?: number;
  absent?: number;
  total?: number;
}
interface ITopStudent {
  studentId?: string;
  name?: string;
  rollNumber?: string;
  program?: string;
  semester?: number;
  cgpa?: number;
  academicYear?: string;
  subjectScores?: number[];
}
interface ISubjectPerformance {
  name?: string;
  value?: number;
  academicYear?: string;
}
interface IDepartmentSessionResult {
  departmentId?: string;
  academicYear?: string;
  passPercentage?: number | null;
  averageCgpa?: number | null;
}
interface IDepartmentSessionFee {
  departmentId?: string;
  academicYear?: string;
  collected?: number;
  pending?: number;
}
interface IDepartmentAttendancePoint {
  departmentId?: string;
  year?: number;
  month?: number;
  percentage?: number | null;
}
interface IDepartmentTableRow extends RecordWithId {
  department: string;
  students: string;
  teachers: string;
  attendance: string;
  passRate: string;
  feeCollected: string;
  pendingFees: string;
  performance: string;
  attendanceValue: number;
  passRateValue: number;
  trend: number[];
}
interface IStudentTableRow extends RecordWithId {
  rank: string;
  name: string;
  rollNumber: string;
  program: string;
  semester: string;
  cgpa: string;
  performance: string;
  cgpaValue: number;
  trend: number[];
}

const tooltipStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  background: '#fff',
  fontSize: 11,
};
const monthNames = [
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
  'Jan',
  'Feb',
  'Mar',
];

function Panel({
  title,
  children,
  className = '',
  action,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-slate-900 sm:text-base">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ViewButton({ label = 'View All', onClick }: { label?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg border border-blue-200 px-2.5 py-1.5 text-[10px] font-bold text-blue-600 transition hover:bg-blue-50"
    >
      {label} <ArrowRight className="h-3 w-3" />
    </button>
  );
}

function MiniAreaTrend({ values, gradientId }: { values: number[]; gradientId: string }) {
  const validValues = values.filter((value) => Number.isFinite(value));
  if (!validValues.length) return <span className="text-slate-400">—</span>;
  const chartValues =
    validValues.length === 1 ? [validValues[0], validValues[0], validValues[0]] : validValues;
  const minimum = Math.min(...chartValues);
  const maximum = Math.max(...chartValues);
  const range = Math.max(maximum - minimum, 1);
  const points = chartValues.map((value, index) => ({
    x: 6 + (index * 126) / (chartValues.length - 1),
    y: minimum === maximum ? 23 : 36 - ((value - minimum) / range) * 27,
  }));
  const linePath = points.slice(1).reduce((pathValue, point, index) => {
    const previous = points[index];
    const controlX = (previous.x + point.x) / 2;
    return `${pathValue} C${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, `M${points[0].x} ${points[0].y}`);
  const lastPoint = points.at(-1) ?? { x: 132, y: 23 };
  const latestValue = validValues.at(-1) ?? 0;
  const areaPath = `${linePath} L${lastPoint.x} 43 L${points[0].x} 43 Z`;
  return (
    <div className="group relative mx-auto w-36 rounded-lg px-1 py-0.5 transition-colors hover:bg-emerald-50/70">
      <svg
        viewBox="0 0 140 46"
        className="h-12 w-36 overflow-visible"
        role="img"
        aria-label={`Performance trend, latest ${latestValue.toFixed(1)}`}
      >
        <title>{`Latest ${latestValue.toFixed(1)} · ${validValues.length} real data point${validValues.length === 1 ? '' : 's'}`}</title>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34b968" stopOpacity="0.34" />
            <stop offset="70%" stopColor="#69ce8c" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#dcfce7" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[12, 23, 34].map((y) => (
          <line key={y} x1="4" y1={y} x2="136" y2={y} stroke="#e8f3eb" strokeWidth="0.8" />
        ))}
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={linePath}
          fill="none"
          stroke="#26a65b"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-all duration-300 group-hover:stroke-emerald-600"
        />
        <line
          x1={lastPoint.x}
          y1="5"
          x2={lastPoint.x}
          y2="43"
          stroke="#69a77d"
          strokeWidth="1"
          strokeDasharray="2.5 2.5"
        />
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r="3.7"
          fill="#25ad5f"
          stroke="#fff"
          strokeWidth="2"
        />
      </svg>
      <span className="pointer-events-none absolute right-2 top-0 rounded-md border border-emerald-100 bg-white/95 px-1.5 py-0.5 text-[8px] font-bold text-emerald-700 opacity-0 transition-opacity group-hover:opacity-100">
        {latestValue.toFixed(1)}
      </span>
    </div>
  );
}

export default function PrincipalDashboard({ d }: { d: AnyRecord }) {
  const router = useRouter();
  const path = useRolePath();
  const baseDepartments = (d.departmentPerformance as IDepartment[] | undefined) ?? [];
  const allStudents = (d.topPerformingStudents as ITopStudent[] | undefined) ?? [];
  const allSubjects = (d.subjectPerformance as ISubjectPerformance[] | undefined) ?? [];
  const sessionResults =
    (d.departmentSessionResults as IDepartmentSessionResult[] | undefined) ?? [];
  const sessionFees = (d.departmentSessionFees as IDepartmentSessionFee[] | undefined) ?? [];
  const departmentAttendanceHistory =
    (d.departmentAttendanceTrend as IDepartmentAttendancePoint[] | undefined) ?? [];
  const notices = (d.notices as INotice[] | undefined) ?? [];
  const enrollment = (d.enrollmentTrend as IEnrollmentPoint[] | undefined) ?? [];
  const attendanceHistory =
    (d.attendanceSessionSummary as IAttendanceSessionPoint[] | undefined) ?? [];
  const availableAcademicYears =
    (d.availableAcademicYears as string[] | undefined)?.filter((year) => Boolean(year)) ?? [];
  const fallbackStartDate = d.currentAcademicYearStart
    ? new Date(String(d.currentAcademicYearStart))
    : new Date();
  const fallbackStartYear = fallbackStartDate.getFullYear();
  const fallbackSession = `${fallbackStartYear}-${String(fallbackStartYear + 1).slice(-2)}`;
  const sessionLabel = String(
    d.selectedAcademicYear ?? availableAcademicYears[0] ?? fallbackSession,
  );
  const startYear = Number(sessionLabel.slice(0, 4)) || fallbackStartYear;
  const sessionOptions = availableAcademicYears.length ? availableAcademicYears : [sessionLabel];
  const students = allStudents
    .filter((student) => student.academicYear === sessionLabel)
    .slice(0, 5);
  const subjects = allSubjects
    .filter((subject) => subject.academicYear === sessionLabel)
    .slice(0, 6);
  const departments = baseDepartments.map((department) => {
    const result = sessionResults.find(
      (item) =>
        String(item.departmentId) === String(department.departmentId) &&
        item.academicYear === sessionLabel,
    );
    const fee = sessionFees.find(
      (item) =>
        String(item.departmentId) === String(department.departmentId) &&
        item.academicYear === sessionLabel,
    );
    return {
      ...department,
      passPercentage: result?.passPercentage ?? null,
      feeCollected: Number(fee?.collected ?? 0),
      pendingFees: Number(fee?.pending ?? 0),
    };
  });
  const selectedAttendance = attendanceHistory
    .filter((item) => {
      const year = Number(item.year ?? 0);
      const month = Number(item.month ?? 0);
      return (year === startYear && month >= 4) || (year === startYear + 1 && month <= 3);
    })
    .reduce<{ present: number; absent: number; total: number }>(
      (summary, item) => ({
        present: summary.present + Number(item.present ?? 0),
        absent: summary.absent + Number(item.absent ?? 0),
        total: summary.total + Number(item.total ?? 0),
      }),
      { present: 0, absent: 0, total: 0 },
    );
  const selectedAttendancePercentage = selectedAttendance.total
    ? (selectedAttendance.present / selectedAttendance.total) * 100
    : 0;
  const enrollmentData = monthNames.map((label, index) => {
    const cumulativeValue = (sessionStartYear: number) => {
      const historicalBaseline = enrollment.reduce((total, item) => {
        const year = Number(item.year ?? 0);
        const month = Number(item.month ?? 0);
        return year < sessionStartYear || (year === sessionStartYear && month < 4)
          ? total + Number(item.value ?? 0)
          : total;
      }, 0);
      const sessionAdmissions = monthNames
        .slice(0, index + 1)
        .reduce((total, _month, monthIndex) => {
          const calendarMonth = ((monthIndex + 3) % 12) + 1;
          const calendarYear = monthIndex < 9 ? sessionStartYear : sessionStartYear + 1;
          const value = enrollment.find(
            (item) => item.year === calendarYear && item.month === calendarMonth,
          )?.value;
          return total + Number(value ?? 0);
        }, 0);
      return historicalBaseline + sessionAdmissions;
    };
    return {
      label,
      current: cumulativeValue(startYear),
      previous: cumulativeValue(startYear - 1),
    };
  });
  const attendanceData = [
    {
      name: 'Present',
      value: selectedAttendance.present,
      color: '#4f8ff7',
      dot: 'bg-blue-500',
      progress: 'accent-blue-500',
    },
    {
      name: 'Absent',
      value: selectedAttendance.absent,
      color: '#ff8a24',
      dot: 'bg-orange-500',
      progress: 'accent-orange-500',
    },
    {
      name: 'Leave',
      value: 0,
      color: '#f7b84b',
      dot: 'bg-amber-400',
      progress: 'accent-amber-400',
    },
    {
      name: 'Late',
      value: 0,
      color: '#f26872',
      dot: 'bg-rose-400',
      progress: 'accent-rose-400',
    },
  ];
  const attendanceChartTotal = attendanceData.reduce((total, item) => total + item.value, 0);
  const collected = sessionFees
    .filter((item) => item.academicYear === sessionLabel)
    .reduce((total, item) => total + Number(item.collected ?? 0), 0);
  const pending = sessionFees
    .filter((item) => item.academicYear === sessionLabel)
    .reduce((total, item) => total + Number(item.pending ?? 0), 0);
  const feeTotal = collected + pending;
  const feeData = [
    { name: 'Collected', value: collected, color: '#52c58a', dot: 'bg-emerald-400' },
    { name: 'Pending', value: pending, color: '#ff8a24', dot: 'bg-orange-500' },
  ];
  const hasAttendance = attendanceData.some((item) => item.value > 0);
  const hasFeeData = feeData.some((item) => item.value > 0);
  const kpis = [
    {
      label: 'Total Students',
      value: referenceNumber(d.totalStudents),
      detail: `${referenceNumber(d.activeStudents)} active`,
      icon: Users,
      tone: 'bg-blue-50 text-blue-600',
      route: 'student-management',
      query: 'status=active',
      illustration: '/dashboard/kpis/students.png',
    },
    {
      label: 'Total Teachers',
      value: referenceNumber(d.totalFaculty),
      detail: `${referenceNumber(d.activeFaculty)} active`,
      icon: GraduationCap,
      tone: 'bg-emerald-50 text-emerald-600',
      route: 'faculty-management',
      query: 'status=active',
      illustration: '/dashboard/kpis/faculty.png',
    },
    {
      label: 'Total Staff',
      value: referenceNumber(d.totalStaff),
      detail: `${referenceNumber(d.activeStaff)} active`,
      icon: UserPlus,
      tone: 'bg-orange-50 text-orange-600',
      route: 'hr',
      query: 'employmentStatus=active',
      illustration: '/dashboard/kpis/staff.png',
    },
    {
      label: 'Total Classes',
      value: referenceNumber(d.totalClasses),
      detail: `${referenceNumber(d.activeSubjects)} active subjects`,
      icon: BookOpenCheck,
      tone: 'bg-violet-50 text-violet-600',
      route: 'subjects',
      query: 'status=active',
      illustration: '/dashboard/kpis/subjects.png',
    },
    {
      label: 'Total Revenue',
      value: referenceCurrency(collected),
      detail: 'Recorded fee collections',
      icon: IndianRupee,
      tone: 'bg-lime-50 text-lime-600',
      route: 'fee',
      query: 'status=Paid',
      illustration: '/dashboard/kpis/fees-rupee.png',
    },
    {
      label: 'Pending Fees',
      value: referenceCurrency(pending),
      detail: `${referenceNumber(d.studentsNotPaidCount)} accounts due`,
      icon: IndianRupee,
      tone: 'bg-rose-50 text-rose-600',
      route: 'fee',
      query: 'status=Pending',
      illustration: '/dashboard/kpis/fees-rupee.png',
    },
  ];
  const quickLinks = [
    ['Students', 'student', Users, 'text-blue-600'],
    ['Faculty', 'faculty', GraduationCap, 'text-emerald-600'],
    ['Attendance', 'attendance', CalendarDays, 'text-slate-600'],
    ['Fee Collection', 'fee', IndianRupee, 'text-orange-600'],
    ['Exam Results', 'examination', ClipboardCheck, 'text-rose-600'],
    ['Timetable', 'timetable', CalendarDays, 'text-blue-600'],
    ['Reports', 'report-center', Megaphone, 'text-violet-600'],
    ['Messages', 'communication', MessageCircle, 'text-slate-600'],
  ] as const;
  const centeredColumn = {
    headerClassName: '!text-center',
    cellClassName: '!text-center',
  };
  const departmentTableData: IDepartmentTableRow[] = departments.map((item, index) => ({
    id: item.code ?? index,
    department: item.name ?? 'Unassigned',
    students: referenceNumber(item.students),
    teachers: referenceNumber(item.teachers),
    attendance:
      item.attendancePercentage == null ? '—' : `${Number(item.attendancePercentage).toFixed(1)}%`,
    passRate: item.passPercentage == null ? '—' : `${Number(item.passPercentage).toFixed(1)}%`,
    feeCollected: referenceCurrency(item.feeCollected),
    pendingFees: referenceCurrency(item.pendingFees),
    performance: '',
    attendanceValue: Number(item.attendancePercentage ?? 0),
    passRateValue: Number(item.passPercentage ?? 0),
    trend: departmentAttendanceHistory
      .filter((point) => {
        const year = Number(point.year ?? 0);
        const month = Number(point.month ?? 0);
        const isSelectedSession =
          (year === startYear && month >= 4) || (year === startYear + 1 && month <= 3);
        return String(point.departmentId) === String(item.departmentId) && isSelectedSession;
      })
      .sort((left, right) =>
        Number(left.year) === Number(right.year)
          ? Number(left.month) - Number(right.month)
          : Number(left.year) - Number(right.year),
      )
      .map((point) => Number(point.percentage ?? 0)),
  }));
  const departmentColumns: Column<IDepartmentTableRow>[] = [
    { field: 'department', title: 'Department', minWidth: '150px', ...centeredColumn },
    { field: 'students', title: 'Students', ...centeredColumn },
    { field: 'teachers', title: 'Teachers', ...centeredColumn },
    { field: 'attendance', title: 'Attendance', ...centeredColumn },
    { field: 'passRate', title: 'Pass Rate', ...centeredColumn },
    { field: 'feeCollected', title: 'Fee Collected', minWidth: '110px', ...centeredColumn },
    { field: 'pendingFees', title: 'Pending Fees', minWidth: '110px', ...centeredColumn },
    {
      field: 'performance',
      title: 'Performance',
      width: '160px',
      ...centeredColumn,
      render: (row) => (
        <MiniAreaTrend values={row.trend} gradientId={`department-trend-${row.id}`} />
      ),
    },
  ];
  const studentTableData: IStudentTableRow[] = students.map((student, index) => ({
    id: student.studentId ?? index,
    rank: `#${index + 1}`,
    name: student.name ?? 'Student',
    rollNumber: student.rollNumber ?? '—',
    program: student.program ?? '—',
    semester: student.semester == null ? '—' : `Semester ${student.semester}`,
    cgpa: Number(student.cgpa ?? 0).toFixed(2),
    performance: '',
    cgpaValue: Number(student.cgpa ?? 0),
    trend: student.subjectScores?.length
      ? student.subjectScores.map((score) => Number(score))
      : [Number(student.cgpa ?? 0) * 10],
  }));
  const studentColumns: Column<IStudentTableRow>[] = [
    { field: 'rank', title: 'Rank', width: '70px', ...centeredColumn },
    { field: 'name', title: 'Student Name', minWidth: '160px', ...centeredColumn },
    { field: 'rollNumber', title: 'Roll Number', minWidth: '110px', ...centeredColumn },
    { field: 'program', title: 'Program', minWidth: '120px', ...centeredColumn },
    { field: 'semester', title: 'Semester', minWidth: '100px', ...centeredColumn },
    {
      field: 'cgpa',
      title: 'CGPA',
      width: '90px',
      ...centeredColumn,
      render: (row) => <strong className="text-emerald-600">{row.cgpa}</strong>,
    },
    {
      field: 'performance',
      title: 'Performance',
      width: '170px',
      ...centeredColumn,
      render: (row) => <MiniAreaTrend values={row.trend} gradientId={`student-trend-${row.id}`} />,
    },
  ];
  const dashboardTableOptions = {
    toolbar: true,
    search: false,
    filtering: false,
    sorting: false,
    selection: false,
    export: false,
    refresh: false,
    pagination: false,
    responsive: true,
    stickyHeader: false,
    bordered: false,
    padding: 'compact' as const,
  };

  return (
    <div className="space-y-4 bg-slate-50/40">
      <header className="flex flex-col gap-3 px-0.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Welcome, Principal
            </h1>
            <ShieldCheck className="h-5 w-5 text-blue-500" />
          </div>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Leadership turns institutional vision into measurable outcomes.
          </p>
        </div>
        <label className="group relative block w-full min-w-48 sm:w-auto">
          <span className="pointer-events-none absolute -top-2 left-3 z-10 bg-slate-50 px-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 transition-colors group-focus-within:text-blue-600">
            Academic session
          </span>
          <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500" />
          <select
            value={sessionLabel}
            onChange={(event) =>
              router.push(
                `${path('dashboard')}?academicYear=${encodeURIComponent(event.target.value)}`,
              )
            }
            className="h-12 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm font-bold text-slate-800 outline-none transition duration-200 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 sm:min-w-52"
            aria-label="Academic session"
          >
            {sessionOptions.map((academicYear) => (
              <option key={academicYear} value={academicYear}>
                {academicYear}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 min-[1800px]:grid-cols-6">
        {kpis.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.label}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.28 }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => router.push(`${path(item.route)}?${item.query}`)}
              aria-label={`Open ${item.label} with ${item.detail.toLowerCase()} filter`}
              className="group relative flex min-h-32 items-center gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 pr-24 text-left transition-colors duration-300 hover:border-blue-200 hover:bg-blue-50/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl min-[1800px]:hidden ${item.tone}`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="relative z-10 min-w-0 flex-1">
                <p className="text-xs font-semibold leading-4 text-slate-600">{item.label}</p>
                <p className="mt-2 break-words text-lg font-bold leading-6 text-slate-900 sm:text-xl">
                  {item.value}
                </p>
                <p className="mt-1 text-[10px] leading-4 text-slate-500">{item.detail}</p>
              </div>
              <motion.span
                className="pointer-events-none absolute inset-y-3 right-2 w-20"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.04, duration: 0.35 }}
              >
                <Image
                  src={item.illustration}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-contain object-center transition-transform duration-500 ease-out group-hover:-translate-y-1 group-hover:scale-105"
                />
              </motion.span>
              <ArrowRight className="absolute bottom-3 right-3 h-3.5 w-3.5 text-slate-300 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-blue-500" />
            </motion.button>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Panel title="Student Enrollment Trend" className="xl:col-span-4">
          <div className="mb-3 flex gap-4 text-[10px] font-semibold text-slate-500">
            <span className="flex items-center gap-1.5">
              <i className="h-0.5 w-5 bg-blue-500" />
              Current Session
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-0.5 w-5 bg-slate-400" />
              Previous Session
            </span>
          </div>
          <motion.div
            key={sessionLabel}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: 'easeOut' }}
            className="h-64"
          >
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={enrollmentData} margin={{ top: 8, left: -20, right: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="principalEnrollmentCurrent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#397df6" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#397df6" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="principalEnrollmentPrevious" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#e9eef5" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ stroke: '#bfdbfe', strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="previous"
                  name="Previous session"
                  stroke="#9ca3af"
                  strokeWidth={2}
                  fill="url(#principalEnrollmentPrevious)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                  animationDuration={650}
                />
                <Area
                  type="monotone"
                  dataKey="current"
                  name="Current session"
                  stroke="#397df6"
                  strokeWidth={3}
                  fill="url(#principalEnrollmentCurrent)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, fill: '#fff' }}
                  animationDuration={750}
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        </Panel>
        <Panel title="Attendance Overview" className="xl:col-span-4">
          {hasAttendance ? (
            <div className="grid min-h-64 items-center gap-3 sm:grid-cols-[1.25fr_.75fr]">
              <div className="relative h-60">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <defs>
                      {attendanceData.map((item, index) => (
                        <linearGradient
                          key={item.name}
                          id={`attendance-segment-${index}`}
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="1"
                        >
                          <stop offset="0%" stopColor={item.color} stopOpacity="0.95" />
                          <stop offset="100%" stopColor={item.color} stopOpacity="1" />
                        </linearGradient>
                      ))}
                    </defs>
                    <Pie
                      data={[{ value: attendanceChartTotal }]}
                      dataKey="value"
                      innerRadius={65}
                      outerRadius={94}
                      startAngle={90}
                      endAngle={-270}
                      fill="#eef2f7"
                      stroke="none"
                      isAnimationActive={false}
                    />
                    <Pie
                      data={attendanceData.filter((item) => item.value > 0)}
                      dataKey="value"
                      innerRadius={65}
                      outerRadius={94}
                      startAngle={90}
                      endAngle={-270}
                      paddingAngle={2.5}
                      cornerRadius={8}
                      stroke="#fff"
                      strokeWidth={2}
                      animationBegin={100}
                      animationDuration={900}
                    >
                      {attendanceData
                        .filter((item) => item.value > 0)
                        .map((item) => (
                          <Cell
                            key={item.name}
                            fill={`url(#attendance-segment-${attendanceData.indexOf(item)})`}
                          />
                        ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                    Average attendance
                  </span>
                  <strong className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
                    {selectedAttendancePercentage.toFixed(1)}%
                  </strong>
                </div>
              </div>
              <div className="space-y-2">
                {attendanceData.map((item) => (
                  <div
                    key={item.name}
                    className="group flex items-center gap-2.5 rounded-xl border border-transparent px-2 py-2 text-[10px] transition hover:border-slate-100 hover:bg-slate-50"
                  >
                    <i className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-slate-700">{item.name}</strong>
                        <span className="font-bold text-slate-600">
                          {attendanceChartTotal
                            ? `${((item.value / attendanceChartTotal) * 100).toFixed(1)}%`
                            : '0.0%'}
                        </span>
                      </div>
                      <progress
                        value={item.value}
                        max={attendanceChartTotal}
                        className={`mt-1.5 block h-1 w-full overflow-hidden rounded-full ${item.progress}`}
                        aria-label={`${item.name} share`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ReferenceEmpty
              label="Attendance has not been marked today."
              reason="The chart will appear after attendance records are submitted."
            />
          )}
        </Panel>
        <Panel title="Fee Collection Overview" className="xl:col-span-4">
          {hasFeeData ? (
            <div className="grid min-h-64 items-center gap-2 sm:grid-cols-[1.2fr_.8fr]">
              <div className="relative h-56">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={feeData.filter((item) => item.value > 0)}
                      dataKey="value"
                      innerRadius={62}
                      outerRadius={88}
                    >
                      {feeData
                        .filter((item) => item.value > 0)
                        .map((item) => (
                          <Cell key={item.name} fill={item.color} />
                        ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-slate-500">Total Collection</span>
                  <strong className="mt-1 text-sm text-slate-900">
                    {referenceCurrency(collected)}
                  </strong>
                </div>
              </div>
              <div className="space-y-4">
                {feeData.map((item) => (
                  <div key={item.name} className="flex gap-2 text-[10px]">
                    <i className={`mt-1 h-2.5 w-2.5 rounded-full ${item.dot}`} />
                    <div>
                      <strong>{item.name}</strong>
                      <p className="mt-0.5 text-slate-500">
                        {referenceCurrency(item.value)} (
                        {feeTotal ? ((item.value / feeTotal) * 100).toFixed(1) : '0.0'}%)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ReferenceEmpty
              label="No fee ledger activity is available."
              reason="Collections and outstanding balances will appear after fee invoices are posted."
            />
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Panel title="Exam Performance Overview" className="xl:col-span-4">
          {subjects.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={subjects} margin={{ left: -20, right: 4 }}>
                  <CartesianGrid vertical={false} stroke="#e9eef5" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 8 }}
                    interval={0}
                  />
                  <YAxis
                    domain={[0, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9 }}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" name="Average score" radius={[5, 5, 0, 0]}>
                    {subjects.map((_, index) => (
                      <Cell
                        key={index}
                        fill={
                          ['#4f8ff7', '#52c58a', '#ff8a24', '#f26872', '#6558e8', '#f7b718'][
                            index % 6
                          ]
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ReferenceEmpty label="Publish examination results to see subject performance." />
          )}
        </Panel>
        <Panel
          title="Important Notifications"
          className="xl:col-span-4"
          action={<ViewButton onClick={() => router.push(path('notice'))} />}
        >
          {notices.length ? (
            <div className="space-y-1">
              {notices.slice(0, 5).map((notice, index) => (
                <div
                  key={notice._id}
                  className="flex gap-3 border-b border-slate-100 py-2.5 last:border-0"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${['bg-blue-50 text-blue-600', 'bg-lime-50 text-lime-600', 'bg-violet-50 text-violet-600', 'bg-rose-50 text-rose-600'][index % 4]}`}
                  >
                    <Bell className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-800">{notice.title}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {fmtDate(notice.publishedAt ?? notice.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ReferenceEmpty label="No active notifications." />
          )}
        </Panel>
        <Panel title="Quick Links" className="xl:col-span-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
            {quickLinks.map(([label, route, Icon, color]) => (
              <button
                key={label}
                type="button"
                onClick={() => router.push(path(route))}
                className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-center transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/40"
              >
                <Icon className={`h-6 w-6 ${color}`} />
                <span className="text-[10px] font-bold text-slate-700">{label}</span>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <CustomTable<IDepartmentTableRow>
        data={departmentTableData}
        columns={departmentColumns}
        title="Department Wise Summary"
        description="Compare department strength, faculty capacity, attendance, published outcomes and fee position."
        customActions={
          <ViewButton
            label="View Detailed Report"
            onClick={() => router.push(path('report-center'))}
          />
        }
        options={dashboardTableOptions}
        localization={{ body: { emptyDataSourceMessage: 'Department records are not available.' } }}
        containerClassName="border-0"
      />

      <CustomTable<IStudentTableRow>
        data={studentTableData}
        columns={studentColumns}
        title="Top Performing Students"
        description="Highest CGPA records from published semester results across the institution."
        customActions={<ViewButton onClick={() => router.push(path('examination'))} />}
        options={dashboardTableOptions}
        localization={{ body: { emptyDataSourceMessage: 'No published student results yet.' } }}
        containerClassName="border-0"
      />
    </div>
  );
}

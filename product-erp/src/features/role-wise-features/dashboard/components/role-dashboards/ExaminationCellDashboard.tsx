/**
 * @file ExaminationCellDashboard.tsx
 * @description Standalone examination scheduling, evaluation, and results dashboard.
 * @module features/dashboard/role-dashboards
 */
'use client';

import { Award, CalendarDays, ClipboardCheck, FileClock, Files, GraduationCap } from 'lucide-react';
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
  type AnyRecord,
  Badge,
  fmt,
  fmtDate,
  type IStatCard,
  PIE_COLORS,
  RowItem,
  Section,
  StatCard,
  useRolePath,
} from '../views/shared';

interface IScheduleStatus {
  name: string;
  schedules: number;
  subjectExams: number;
}
interface IProgramResult {
  name: string;
  students: number;
  passed: number;
  failed: number;
}
interface ISubjectResult {
  code: string;
  name: string;
  studentsAppeared: number;
  passed: number;
  averageMarks: number;
}
interface IExam {
  scheduleId?: string;
  title: string;
  examType: string;
  program: string;
  branch: string;
  semester: number;
  section: string;
  subjectCode: string;
  subjectName: string;
  examDate: string;
  startTime: string;
  endTime: string;
  venue: string;
}
interface IRevaluation {
  _id?: string;
  studentId?: { name?: string; email?: string };
  rollNumber: string;
  subjectCode: string;
  subjectName: string;
  requestType: string;
  status: string;
  createdAt: string;
}
interface IRecentResult {
  _id?: string;
  program: string;
  branch: string;
  semester: number;
  rollNumber: string;
  result: string;
  sgpa: number;
  publishedAt?: string;
}

/** Maps examination workflow states to badge tones. */
function examTone(status: string): 'green' | 'blue' | 'amber' | 'red' | 'slate' {
  if (['Completed', 'PASS', 'marks_updated', 'no_change'].includes(status)) return 'green';
  if (['Ongoing', 'under_review'].includes(status)) return 'blue';
  if (['Scheduled', 'pending'].includes(status)) return 'amber';
  if (['Cancelled', 'FAIL', 'rejected'].includes(status)) return 'red';
  return 'slate';
}

export default function ExaminationCellDashboard({ d }: { d: AnyRecord }) {
  const path = useRolePath();
  const schedules = (d.scheduleOverview as IScheduleStatus[] | undefined) ?? [];
  const programs = (d.programResults as IProgramResult[] | undefined) ?? [];
  const subjects = (d.topSubjects as ISubjectResult[] | undefined) ?? [];
  const exams = (d.upcomingExams as IExam[] | undefined) ?? [];
  const revaluations = (d.recentRevaluations as IRevaluation[] | undefined) ?? [];
  const recentResults = (d.recentResults as IRecentResult[] | undefined) ?? [];
  const totalScripts = Number(d.totalScripts ?? 0);
  const evaluated = Number(d.evaluated ?? 0);
  const evaluationRate = totalScripts ? (evaluated / totalScripts) * 100 : 0;

  const cards: IStatCard[] = [
    {
      label: 'Upcoming Exams',
      value: fmt(d.upcomingExamCount),
      icon: <CalendarDays className="h-5 w-5" />,
      bg: 'bg-violet-50',
      fg: 'text-violet-600',
      href: path('examination'),
    },
    {
      label: 'Exams Conducted',
      value: fmt(d.completed),
      icon: <ClipboardCheck className="h-5 w-5" />,
      bg: 'bg-blue-50',
      fg: 'text-blue-600',
      href: path('examination'),
    },
    {
      label: 'Students Appeared',
      value: fmt(d.studentsAppeared),
      icon: <GraduationCap className="h-5 w-5" />,
      bg: 'bg-sky-50',
      fg: 'text-sky-600',
      href: path('examination'),
    },
    {
      label: 'Answer Scripts',
      value: fmt(d.totalScripts),
      icon: <Files className="h-5 w-5" />,
      bg: 'bg-orange-50',
      fg: 'text-orange-600',
      href: path('examination'),
    },
    {
      label: 'Results Declared',
      value: fmt(d.resultsDeclared),
      icon: <Award className="h-5 w-5" />,
      bg: 'bg-emerald-50',
      fg: 'text-emerald-600',
      href: path('examination'),
    },
    {
      label: 'Pass Percentage',
      value: `${Number(d.passPercentage ?? 0).toFixed(2)}%`,
      icon: <GraduationCap className="h-5 w-5" />,
      bg: 'bg-rose-50',
      fg: 'text-rose-600',
      href: path('examination'),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {cards.map((card, index) => (
          <StatCard key={card.label} {...card} index={index} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Exam Schedule" className="xl:col-span-1" href={path('examination')}>
          <div className="space-y-2">
            {exams.length ? (
              exams
                .slice(0, 7)
                .map((exam) => (
                  <RowItem
                    key={`${exam.scheduleId}-${exam.subjectCode}-${exam.examDate}`}
                    icon={<CalendarDays className="h-4 w-4" />}
                    primary={`${exam.subjectName} (${exam.subjectCode})`}
                    secondary={`${fmtDate(exam.examDate)} · ${exam.startTime}–${exam.endTime} · ${exam.program} ${exam.branch} semester ${exam.semester}`}
                    end={<Badge label={exam.venue} color="blue" />}
                    href={path('examination')}
                  />
                ))
            ) : (
              <p className="py-12 text-center text-xs text-slate-600">
                No scheduled subject examinations.
              </p>
            )}
          </div>
        </Section>

        <Section title="Examination Overview" href={path('examination')}>
          <div className="relative h-64">
            {schedules.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={schedules}
                    dataKey="subjectExams"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={88}
                    paddingAngle={2}
                  >
                    {schedules.map((row, index) => (
                      <Cell key={row.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No examination schedules.
              </p>
            )}
            {schedules.length > 0 && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <strong className="text-xl text-slate-900">
                  {fmt(schedules.reduce((sum, row) => sum + row.subjectExams, 0))}
                </strong>
                <span className="text-[10px] text-slate-500">Subject Exams</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {schedules.map((row) => (
              <div key={row.name} className="rounded-lg bg-slate-50 p-2 text-xs">
                <span className="capitalize text-slate-500">{row.name}</span>
                <strong className="float-right text-slate-800">{row.subjectExams}</strong>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Evaluation Progress" href={path('examination')}>
          <div className="flex min-h-64 flex-col items-center justify-center">
            <div className="relative h-44 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Evaluated', value: evaluated },
                      { name: 'Pending', value: Math.max(totalScripts - evaluated, 0) },
                    ]}
                    dataKey="value"
                    innerRadius={55}
                    outerRadius={75}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <Cell fill="#20B486" />
                    <Cell fill="#E9EDF5" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <strong className="text-xl text-slate-900">{evaluationRate.toFixed(0)}%</strong>
                <span className="text-[10px] text-slate-500">Completed</span>
              </div>
            </div>
            <div className="w-full space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Evaluated</span>
                <strong className="text-emerald-700">{fmt(evaluated)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pending</span>
                <strong className="text-orange-700">{fmt(d.pendingEvaluation)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pending publication</span>
                <strong>{fmt(d.pendingPublication)}</strong>
              </div>
            </div>
          </div>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Results Summary" className="xl:col-span-2" href={path('examination')}>
          <div className="h-72">
            {programs.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={programs} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="passed" fill="#6D4AFF" radius={[5, 5, 0, 0]} />
                  <Bar dataKey="failed" fill="#EF5366" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No published program results.
              </p>
            )}
          </div>
        </Section>

        <Section title="Pending Revaluation Tasks" href={path('examination')}>
          <div className="space-y-2">
            {revaluations.length ? (
              revaluations.map((request) => (
                <RowItem
                  key={request._id ?? `${request.rollNumber}-${request.subjectCode}`}
                  icon={<FileClock className="h-4 w-4" />}
                  primary={`${request.studentId?.name ?? request.rollNumber} · ${request.subjectName}`}
                  secondary={`${request.requestType} · ${fmtDate(request.createdAt)}`}
                  end={
                    <Badge
                      label={request.status.replaceAll('_', ' ')}
                      color={examTone(request.status)}
                    />
                  }
                  href={path('examination')}
                />
              ))
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">
                No pending revaluation requests.
              </p>
            )}
          </div>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Top Performing Subjects" href={path('examination')}>
          <div className="space-y-2">
            {subjects.length ? (
              subjects.map((subject) => {
                const passRate = subject.studentsAppeared
                  ? (subject.passed / subject.studentsAppeared) * 100
                  : 0;
                return (
                  <div
                    key={subject.code}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl bg-slate-50 p-3 text-xs"
                  >
                    <div className="min-w-0">
                      <strong className="block truncate text-slate-800">
                        {subject.name} ({subject.code})
                      </strong>
                      <span className="text-[10px] text-slate-500">
                        {fmt(subject.studentsAppeared)} appeared · average{' '}
                        {Number(subject.averageMarks ?? 0).toFixed(1)}
                      </span>
                    </div>
                    <strong className="text-emerald-700">{passRate.toFixed(1)}%</strong>
                    <span>{fmt(subject.passed)} passed</span>
                  </div>
                );
              })
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">
                No published subject results.
              </p>
            )}
          </div>
        </Section>

        <Section title="Recently Published Results" href={path('examination')}>
          <div className="space-y-2">
            {recentResults.length ? (
              recentResults.map((result) => (
                <RowItem
                  key={result._id ?? `${result.rollNumber}-${result.semester}`}
                  icon={<Award className="h-4 w-4" />}
                  primary={`${result.rollNumber} · ${result.program} ${result.branch}`}
                  secondary={`Semester ${result.semester} · SGPA ${Number(result.sgpa ?? 0).toFixed(2)} · ${fmtDate(result.publishedAt)}`}
                  end={<Badge label={result.result} color={examTone(result.result)} />}
                  href={path('examination')}
                />
              ))
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">
                No published semester results.
              </p>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}

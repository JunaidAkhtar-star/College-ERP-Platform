/** @file AdmissionInchargeDashboard.tsx @description Institution-wide admission pipeline dashboard. */
'use client';

import { BadgeCheck, FileCheck2, FileClock, Files, GraduationCap, Send } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
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

interface IPipeline {
  totalApplications: number;
  totalSubmitted: number;
  underReview: number;
  approved: number;
  enrolled: number;
  rejected: number;
  conversionRate: number;
}
interface IStage {
  name: string;
  count: number;
}
interface IProgram {
  name: string;
  count: number;
}
interface ITrend {
  year: number;
  month: number;
  applications: number;
  approved: number;
  enrolled: number;
}
interface IDocument {
  name: string;
  count: number;
}
interface IApplication {
  _id?: string;
  applicationNumber: string;
  candidateName: string;
  programPreferences?: string[];
  admissionType: string;
  status: string;
  createdAt: string;
}

const tone = (status: string): 'green' | 'blue' | 'amber' | 'red' | 'slate' =>
  status === 'approved' || status === 'enrolled' || status === 'verified'
    ? 'green'
    : status === 'under_review' || status === 'submitted'
      ? 'blue'
      : status === 'rejected'
        ? 'red'
        : status === 'pending'
          ? 'amber'
          : 'slate';
const month = (value: number) =>
  new Date(2020, Math.max(0, value - 1), 1).toLocaleDateString('en-IN', { month: 'short' });

export default function AdmissionInchargeDashboard({ d }: { d: AnyRecord }) {
  const path = useRolePath();
  const pipeline = (d.pipeline as IPipeline | undefined) ?? {
    totalApplications: 0,
    totalSubmitted: 0,
    underReview: 0,
    approved: 0,
    enrolled: 0,
    rejected: 0,
    conversionRate: 0,
  };
  const stages = (d.pipelineStages as IStage[] | undefined) ?? [];
  const programs = (d.programWise as IProgram[] | undefined) ?? [];
  const trend = (d.applicationTrend as ITrend[] | undefined) ?? [];
  const documents = (d.documentStatus as IDocument[] | undefined) ?? [];
  const applications = (d.recentApplications as IApplication[] | undefined) ?? [];
  const cards: IStatCard[] = [
    {
      label: 'Total Applications',
      value: fmt(pipeline.totalApplications),
      icon: <Files className="h-5 w-5" />,
      bg: 'bg-violet-50',
      fg: 'text-violet-600',
      href: path('admission'),
    },
    {
      label: 'Submitted',
      value: fmt(pipeline.totalSubmitted),
      icon: <Send className="h-5 w-5" />,
      bg: 'bg-blue-50',
      fg: 'text-blue-600',
      href: path('admission'),
    },
    {
      label: 'Under Review',
      value: fmt(pipeline.underReview),
      icon: <FileClock className="h-5 w-5" />,
      bg: 'bg-orange-50',
      fg: 'text-orange-600',
      href: path('admission'),
    },
    {
      label: 'Approved',
      value: fmt(pipeline.approved),
      icon: <BadgeCheck className="h-5 w-5" />,
      bg: 'bg-emerald-50',
      fg: 'text-emerald-600',
      href: path('admission'),
    },
    {
      label: 'Enrolled',
      value: fmt(pipeline.enrolled),
      icon: <GraduationCap className="h-5 w-5" />,
      bg: 'bg-sky-50',
      fg: 'text-sky-600',
      href: path('admission'),
    },
    {
      label: 'Conversion Rate',
      value: `${pipeline.conversionRate.toFixed(1)}%`,
      icon: <FileCheck2 className="h-5 w-5" />,
      bg: 'bg-rose-50',
      fg: 'text-rose-600',
      href: path('admission'),
    },
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {cards.map((card, index) => (
          <StatCard key={card.label} {...card} index={index} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Applications Overview" href={path('admission')}>
          <div className="relative h-72">
            {stages.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={stages}
                    dataKey="count"
                    nameKey="name"
                    innerRadius={64}
                    outerRadius={94}
                    paddingAngle={2}
                  >
                    {stages.map((row, index) => (
                      <Cell key={row.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No applications.
              </p>
            )}
            {stages.length > 0 && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <strong className="text-2xl text-slate-900">
                  {fmt(pipeline.totalApplications)}
                </strong>
                <span className="text-xs text-slate-600">Applications</span>
              </div>
            )}
          </div>
        </Section>
        <Section title="Applications Trend" href={path('admission')}>
          <div className="h-72">
            {trend.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart data={trend} margin={{ left: -20, top: 12 }}>
                  <CartesianGrid stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={month} tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip labelFormatter={(value) => month(Number(value))} />
                  <Line type="monotone" dataKey="applications" stroke="#6545e8" strokeWidth={3} />
                  <Line type="monotone" dataKey="approved" stroke="#16a34a" strokeWidth={2} />
                  <Line type="monotone" dataKey="enrolled" stroke="#f97316" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No application trend.
              </p>
            )}
          </div>
        </Section>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Recent Applications" className="xl:col-span-2" href={path('admission')}>
          <div className="space-y-2">
            {applications.length ? (
              applications.map((application) => (
                <RowItem
                  key={application._id ?? application.applicationNumber}
                  icon={<Files className="h-4 w-4" />}
                  primary={`${application.applicationNumber} · ${application.candidateName}`}
                  secondary={`${application.programPreferences?.join(', ') || 'Program not selected'} · ${fmtDate(application.createdAt)}`}
                  end={<Badge label={application.status} color={tone(application.status)} />}
                  href={path('admission')}
                />
              ))
            ) : (
              <p className="py-12 text-center text-xs text-slate-600">No recent applications.</p>
            )}
          </div>
        </Section>
        <Section title="Document Verification" href={path('admission')}>
          <div className="space-y-3">
            {documents.length ? (
              documents.map((row) => (
                <div
                  key={row.name}
                  className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
                >
                  <p className="text-sm font-semibold capitalize text-slate-700">{row.name}</p>
                  <Badge label={fmt(row.count)} color={tone(row.name)} />
                </div>
              ))
            ) : (
              <p className="py-12 text-center text-xs text-slate-600">
                No document checklist records.
              </p>
            )}
          </div>
        </Section>
      </div>
      <Section title="Top Program Preferences" href={path('admission')}>
        <div className="h-56">
          {programs.length ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={programs.slice(0, 10)} layout="vertical" margin={{ left: 40 }}>
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[0, 7, 7, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-xs text-slate-600">
              No program preference data.
            </p>
          )}
        </div>
      </Section>
    </div>
  );
}

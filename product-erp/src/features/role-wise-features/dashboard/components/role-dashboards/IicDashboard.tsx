/**
 * @file IicDashboard.tsx
 * @description Standalone Institution's Innovation Council dashboard.
 * @module features/dashboard/role-dashboards
 */
'use client';

import {
  Activity,
  BadgeIndianRupee,
  FileBadge,
  Lightbulb,
  Rocket,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
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
  fmtRupees,
  type IStatCard,
  PIE_COLORS,
  RowItem,
  Section,
  StatCard,
  useRolePath,
} from '../views/shared';

interface INameValue {
  name: string;
  value: number;
}
interface IActivityTrend {
  label: string;
  activities: number;
  participants: number;
}
interface IIicActivity {
  _id?: string;
  title: string;
  kind: string;
  startDate: string;
  venue?: string;
  participantCount?: number;
  reportedToMic?: boolean;
}
interface IInnovation {
  _id?: string;
  title: string;
  category: string;
  status: string;
  startupName?: string;
  fundingAllocated?: number;
  submitterId?: { name?: string };
}

/** Maps innovation stages to status badge tones. */
function innovationTone(status: string): 'green' | 'blue' | 'amber' | 'red' | 'slate' {
  if (['approved', 'completed', 'incubating'].includes(status)) return 'green';
  if (['evaluation', 'screening'].includes(status)) return 'blue';
  if (status === 'submitted') return 'amber';
  if (status === 'rejected') return 'red';
  return 'slate';
}

export default function IicDashboard({ d }: { d: AnyRecord }) {
  const path = useRolePath();
  const pipeline = (d.innovationPipeline as INameValue[] | undefined) ?? [];
  const categories = (d.innovationCategories as INameValue[] | undefined) ?? [];
  const activityKinds = (d.categoryStats as INameValue[] | undefined) ?? [];
  const trend = (d.activityTrend as IActivityTrend[] | undefined) ?? [];
  const activities = (d.recentActivities as IIicActivity[] | undefined) ?? [];
  const innovations = (d.recentInnovations as IInnovation[] | undefined) ?? [];
  const fundingAllocated = Number(d.totalFundingAllocated ?? 0);
  const fundingSpent = Number(d.totalFundingSpent ?? 0);

  const cards: IStatCard[] = [
    {
      label: 'IIC Team Members',
      value: fmt(d.totalMembers),
      icon: <Users className="h-5 w-5" />,
      bg: 'bg-violet-50',
      fg: 'text-violet-600',
      href: path('iic'),
    },
    {
      label: 'Ideas Submitted',
      value: fmt(d.totalInnovations),
      icon: <Lightbulb className="h-5 w-5" />,
      bg: 'bg-emerald-50',
      fg: 'text-emerald-600',
      href: path('iic'),
    },
    {
      label: 'Activities Conducted',
      value: fmt(d.totalActivities),
      icon: <Activity className="h-5 w-5" />,
      bg: 'bg-blue-50',
      fg: 'text-blue-600',
      href: path('iic'),
    },
    {
      label: 'Startups Supported',
      value: fmt(d.startupsSupported),
      icon: <Rocket className="h-5 w-5" />,
      bg: 'bg-orange-50',
      fg: 'text-orange-600',
      href: path('iic'),
    },
    {
      label: 'IP Filed / Patents',
      value: fmt(d.totalIpRecords),
      icon: <FileBadge className="h-5 w-5" />,
      bg: 'bg-rose-50',
      fg: 'text-rose-600',
      href: path('iic'),
    },
    {
      label: 'Funding Allocated',
      value: fmtRupees(fundingAllocated),
      icon: <BadgeIndianRupee className="h-5 w-5" />,
      bg: 'bg-sky-50',
      fg: 'text-sky-600',
      href: path('iic'),
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
        <Section title="Innovation Pipeline" href={path('iic')}>
          <div className="space-y-2 py-3">
            {pipeline.length ? (
              pipeline.map((stage, index) => (
                <div
                  key={stage.name}
                  className={`mx-auto flex h-10 items-center justify-between rounded-lg px-4 text-xs font-semibold ${index % 4 === 0 ? 'w-full bg-violet-100 text-violet-700' : index % 4 === 1 ? 'w-11/12 bg-blue-100 text-blue-700' : index % 4 === 2 ? 'w-9/12 bg-emerald-100 text-emerald-700' : 'w-7/12 bg-orange-100 text-orange-700'}`}
                >
                  <span className="capitalize">{stage.name.replaceAll('_', ' ')}</span>
                  <strong>{stage.value}</strong>
                </div>
              ))
            ) : (
              <p className="py-20 text-center text-xs text-slate-600">No innovation submissions.</p>
            )}
          </div>
        </Section>

        <Section title="Activities Trend" className="xl:col-span-2" href={path('iic')}>
          <div className="h-72">
            {trend.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart data={trend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="activities"
                    stroke="#6D4AFF"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="participants"
                    stroke="#16A36A"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No activity trend records.
              </p>
            )}
          </div>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="IIC Performance Overview" href={path('iic')}>
          <div className="relative h-64">
            {activityKinds.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={activityKinds}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={86}
                    paddingAngle={2}
                  >
                    {activityKinds.map((row, index) => (
                      <Cell key={row.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No activity categories.
              </p>
            )}
            {activityKinds.length > 0 && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <strong className="text-xl text-slate-900">{fmt(d.totalActivities)}</strong>
                <span className="text-[10px] text-slate-500">Activities</span>
              </div>
            )}
          </div>
        </Section>

        <Section title="Recent Innovations / Ideas" className="xl:col-span-2" href={path('iic')}>
          <div className="grid gap-2 md:grid-cols-2">
            {innovations.length ? (
              innovations.map((innovation) => (
                <RowItem
                  key={innovation._id ?? innovation.title}
                  icon={<Lightbulb className="h-4 w-4" />}
                  primary={innovation.title}
                  secondary={`${innovation.category} · ${innovation.submitterId?.name ?? 'Unlinked submitter'}${innovation.startupName ? ` · ${innovation.startupName}` : ''}`}
                  end={
                    <Badge label={innovation.status} color={innovationTone(innovation.status)} />
                  }
                  href={path('iic')}
                />
              ))
            ) : (
              <p className="col-span-2 py-10 text-center text-xs text-slate-600">
                No innovation projects found.
              </p>
            )}
          </div>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Recent IIC Activities" href={path('iic')}>
          <div className="space-y-2">
            {activities.length ? (
              activities.map((activity) => (
                <RowItem
                  key={activity._id ?? `${activity.title}-${activity.startDate}`}
                  icon={<Activity className="h-4 w-4" />}
                  primary={activity.title}
                  secondary={`${activity.kind.replaceAll('_', ' ')} · ${fmtDate(activity.startDate)}${activity.venue ? ` · ${activity.venue}` : ''}`}
                  end={
                    <Badge
                      label={
                        activity.reportedToMic
                          ? 'MIC reported'
                          : `${fmt(activity.participantCount)} participants`
                      }
                      color={activity.reportedToMic ? 'green' : 'blue'}
                    />
                  }
                  href={path('iic')}
                />
              ))
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">No IIC activities found.</p>
            )}
          </div>
        </Section>

        <Section title="Grants & Funding Overview" href={path('iic')}>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-violet-50 p-4">
              <BadgeIndianRupee className="h-5 w-5 text-violet-600" />
              <p className="mt-3 text-[10px] text-slate-500">Allocated</p>
              <strong className="mt-1 block text-slate-900">{fmtRupees(fundingAllocated)}</strong>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <p className="mt-3 text-[10px] text-slate-500">Utilized</p>
              <strong className="mt-1 block text-slate-900">{fmtRupees(fundingSpent)}</strong>
            </div>
            <div className="col-span-2 rounded-xl bg-slate-50 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Available balance</span>
                <strong className="text-slate-900">
                  {fmtRupees(Math.max(fundingAllocated - fundingSpent, 0))}
                </strong>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-slate-500">Pending MIC reports</span>
                <strong className="text-orange-600">{fmt(d.pendingMicReport)}</strong>
              </div>
            </div>
          </div>
        </Section>
      </div>

      {categories.length > 0 && (
        <Section title="Innovation Categories">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <span
                key={category.name}
                className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600"
              >
                {category.name} · {category.value}
              </span>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

/** @file AdmissionCounselorDashboard.tsx @description Counselor-owned enquiry dashboard. */
'use client';

import { CalendarClock, CheckCircle2, FileText, Target, UserCheck, Users } from 'lucide-react';
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
  fmtDateTime,
  type IStatCard,
  PIE_COLORS,
  RowItem,
  Section,
  StatCard,
  useRolePath,
} from '../views/shared';

interface IStage {
  name: string;
  count: number;
}
interface ISource {
  name: string;
  count: number;
}
interface ITrend {
  year: number;
  month: number;
  enquiries: number;
  enrolled: number;
}
interface IProgram {
  name?: string;
  code?: string;
}
interface ILead {
  _id?: string;
  firstName: string;
  lastName?: string;
  phone: string;
  source?: string;
  stage: string;
  score?: number;
  programInterest?: IProgram;
  nextFollowUpAt?: string;
  updatedAt?: string;
}
interface IActivity {
  _id?: string;
  type: string;
  subject: string;
  status: string;
  dueAt?: string;
  completedAt?: string;
  createdAt: string;
  leadId?: { firstName?: string; lastName?: string };
}

const tone = (status: string): 'green' | 'blue' | 'amber' | 'red' | 'slate' =>
  status === 'enrolled' || status === 'completed'
    ? 'green'
    : status === 'qualified' || status === 'applied'
      ? 'blue'
      : status === 'lost' || status === 'cancelled'
        ? 'red'
        : status === 'planned' || status === 'application_started'
          ? 'amber'
          : 'slate';
const month = (value: number) =>
  new Date(2020, Math.max(0, value - 1), 1).toLocaleDateString('en-IN', { month: 'short' });

export default function AdmissionCounselorDashboard({ d }: { d: AnyRecord }) {
  const path = useRolePath();
  const stages = (d.stages as IStage[] | undefined) ?? [];
  const sources = (d.sourceSummary as ISource[] | undefined) ?? [];
  const trend = (d.enquiryTrend as ITrend[] | undefined) ?? [];
  const leads = (d.recentLeads as ILead[] | undefined) ?? [];
  const followUps = (d.upcomingFollowUps as ILead[] | undefined) ?? [];
  const activities = (d.recentActivities as IActivity[] | undefined) ?? [];
  const cards: IStatCard[] = [
    {
      label: 'My Enquiries',
      value: fmt(d.totalEnquiries),
      icon: <Users className="h-5 w-5" />,
      bg: 'bg-blue-50',
      fg: 'text-blue-600',
      href: path('recruitment-crm'),
    },
    {
      label: 'Active Follow-ups',
      value: fmt(d.activeFollowUps),
      icon: <CalendarClock className="h-5 w-5" />,
      bg: 'bg-emerald-50',
      fg: 'text-emerald-600',
      href: path('recruitment-crm'),
    },
    {
      label: 'Qualified Leads',
      value: fmt(d.qualified),
      icon: <Target className="h-5 w-5" />,
      bg: 'bg-violet-50',
      fg: 'text-violet-600',
      href: path('recruitment-crm'),
    },
    {
      label: 'Applications',
      value: fmt(d.applications),
      icon: <FileText className="h-5 w-5" />,
      bg: 'bg-orange-50',
      fg: 'text-orange-600',
      href: path('admission'),
    },
    {
      label: 'Admissions',
      value: fmt(d.enrolled),
      icon: <CheckCircle2 className="h-5 w-5" />,
      bg: 'bg-emerald-50',
      fg: 'text-emerald-600',
      href: path('admission'),
    },
    {
      label: 'Conversion Rate',
      value: `${Number(d.conversionRate ?? 0).toFixed(1)}%`,
      icon: <UserCheck className="h-5 w-5" />,
      bg: 'bg-rose-50',
      fg: 'text-rose-600',
      href: path('recruitment-crm'),
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
        <Section title="My Enquiry Pipeline" href={path('recruitment-crm')}>
          <div className="h-72">
            {stages.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={stages} layout="vertical" margin={{ left: 28 }}>
                  <CartesianGrid stroke="#eef2f7" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={105} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6545e8" radius={[0, 7, 7, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No assigned enquiries.
              </p>
            )}
          </div>
        </Section>
        <Section title="Enquiry Conversion Trend" href={path('recruitment-crm')}>
          <div className="h-72">
            {trend.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={trend} margin={{ left: -20, top: 12 }}>
                  <CartesianGrid stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={month} tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip labelFormatter={(value) => month(Number(value))} />
                  <Bar dataKey="enquiries" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="enrolled" fill="#16a34a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No enquiry history.
              </p>
            )}
          </div>
        </Section>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Upcoming Follow-ups" href={path('recruitment-crm')}>
          <div className="space-y-2">
            {followUps.length ? (
              followUps.map((lead) => (
                <RowItem
                  key={lead._id ?? lead.phone}
                  icon={<CalendarClock className="h-4 w-4" />}
                  primary={`${lead.firstName} ${lead.lastName ?? ''}`.trim()}
                  secondary={`${lead.programInterest?.name ?? 'Program not selected'} · ${fmtDateTime(lead.nextFollowUpAt)}`}
                  end={<Badge label={lead.stage} color={tone(lead.stage)} />}
                  href={path('recruitment-crm')}
                />
              ))
            ) : (
              <p className="py-12 text-center text-xs text-slate-600">No scheduled follow-ups.</p>
            )}
          </div>
        </Section>
        <Section title="Recent Leads" href={path('recruitment-crm')}>
          <div className="space-y-2">
            {leads.length ? (
              leads.map((lead) => (
                <RowItem
                  key={lead._id ?? lead.phone}
                  icon={<Users className="h-4 w-4" />}
                  primary={`${lead.firstName} ${lead.lastName ?? ''}`.trim()}
                  secondary={`${lead.programInterest?.name ?? 'Program not selected'} · ${lead.source ?? 'source unavailable'}`}
                  end={<Badge label={lead.stage} color={tone(lead.stage)} />}
                  href={path('recruitment-crm')}
                />
              ))
            ) : (
              <p className="py-12 text-center text-xs text-slate-600">No recent leads.</p>
            )}
          </div>
        </Section>
        <Section title="Recent Activities" href={path('recruitment-crm')}>
          <div className="space-y-2">
            {activities.length ? (
              activities.map((activity) => (
                <RowItem
                  key={activity._id ?? `${activity.subject}-${activity.createdAt}`}
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  primary={activity.subject}
                  secondary={`${activity.type} · ${activity.leadId?.firstName ?? ''} ${activity.leadId?.lastName ?? ''}`.trim()}
                  end={<Badge label={activity.status} color={tone(activity.status)} />}
                  href={path('recruitment-crm')}
                />
              ))
            ) : (
              <p className="py-12 text-center text-xs text-slate-600">No recent activities.</p>
            )}
          </div>
        </Section>
      </div>
      <Section title="Enquiry Sources" href={path('recruitment-crm')}>
        <div className="h-56">
          {sources.length ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={sources}
                  dataKey="count"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {sources.map((source, index) => (
                    <Cell key={source.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-xs text-slate-600">
              No enquiry source data.
            </p>
          )}
        </div>
      </Section>
    </div>
  );
}

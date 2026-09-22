/**
 * @file ResearchDevelopmentDashboard.tsx
 * @description Standalone research-and-development analytics dashboard.
 * @module features/dashboard/role-dashboards
 */
'use client';

import {
  Activity,
  Award,
  Banknote,
  BookOpenText,
  FlaskConical,
  Handshake,
  Landmark,
  Users,
} from 'lucide-react';
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
  type AnyRecord,
  Badge,
  fmt,
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
interface IResearchArea {
  departmentId?: string;
  name: string;
  count: number;
}
interface ITrend {
  label: string;
  value: number;
}
interface IProject {
  _id?: string;
  title: string;
  projectCode?: string;
  status: string;
  grantAmount?: number;
  sanctionedAmount?: number;
  principalInvestigator?: { name?: string };
}
interface IPublication {
  _id?: string;
  title: string;
  kind: string;
  year: number;
  venue?: string;
  authorsText?: string;
  verificationStatus?: string;
}

/** Returns a consistent workflow badge for research records. */
function researchStatus(status: string): 'green' | 'blue' | 'amber' | 'red' | 'slate' {
  if (['completed', 'verified', 'approved', 'granted'].includes(status)) return 'green';
  if (['ongoing', 'submitted', 'published', 'filed'].includes(status)) return 'blue';
  if (['proposed', 'ethics_review', 'draft', 'on_hold'].includes(status)) return 'amber';
  if (['rejected', 'closed', 'abandoned'].includes(status)) return 'red';
  return 'slate';
}

export default function ResearchDevelopmentDashboard({ d }: { d: AnyRecord }) {
  const path = useRolePath();
  const statuses = (d.projectStatus as INameValue[] | undefined) ?? [];
  const areas = (d.researchAreas as IResearchArea[] | undefined) ?? [];
  const trend = (d.publicationsTrend as ITrend[] | undefined) ?? [];
  const projects = (d.recentProjects as IProject[] | undefined) ?? [];
  const publications = (d.recentPublications as IPublication[] | undefined) ?? [];
  const totalGrants = Number(d.totalGrants ?? 0);
  const totalExpenditure = Number(d.totalExpenditure ?? 0);
  const budgetUtilization = totalGrants ? (totalExpenditure / totalGrants) * 100 : 0;
  const milestoneCompletion = Number(d.totalMilestones)
    ? (Number(d.completedMilestones) / Number(d.totalMilestones)) * 100
    : 0;

  const cards: IStatCard[] = [
    {
      label: 'Active Projects',
      value: fmt(d.ongoingProjects),
      icon: <FlaskConical className="h-5 w-5" />,
      bg: 'bg-violet-50',
      fg: 'text-violet-600',
      href: path('research-development'),
    },
    {
      label: 'Publications',
      value: fmt(d.totalPublications),
      icon: <BookOpenText className="h-5 w-5" />,
      bg: 'bg-emerald-50',
      fg: 'text-emerald-600',
      href: path('research-development'),
    },
    {
      label: 'Patents Filed',
      value: fmt(d.totalPatents),
      icon: <Award className="h-5 w-5" />,
      bg: 'bg-blue-50',
      fg: 'text-blue-600',
      href: path('research-development'),
    },
    {
      label: 'Research Grants',
      value: fmtRupees(totalGrants),
      icon: <Banknote className="h-5 w-5" />,
      bg: 'bg-orange-50',
      fg: 'text-orange-600',
      href: path('research-development'),
    },
    {
      label: 'Collaborators',
      value: fmt(d.totalCollaborators),
      icon: <Handshake className="h-5 w-5" />,
      bg: 'bg-rose-50',
      fg: 'text-rose-600',
      href: path('research-development'),
    },
    {
      label: 'R&D Budget Utilized',
      value: `${budgetUtilization.toFixed(1)}%`,
      icon: <Landmark className="h-5 w-5" />,
      bg: 'bg-sky-50',
      fg: 'text-sky-600',
      href: path('research-development'),
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
        <Section title="Research Projects by Status" href={path('research-development')}>
          <div className="relative h-64">
            {statuses.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={statuses}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={88}
                    paddingAngle={2}
                  >
                    {statuses.map((row, index) => (
                      <Cell key={row.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No project status records.
              </p>
            )}
            {statuses.length > 0 && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <strong className="text-xl text-slate-900">{fmt(d.totalProjects)}</strong>
                <span className="text-[10px] text-slate-500">Total Projects</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {statuses.map((row, index) => (
              <div key={row.name} className="flex items-center gap-2 text-[10px]">
                <svg viewBox="0 0 8 8" className="h-2 w-2">
                  <circle cx="4" cy="4" r="4" fill={PIE_COLORS[index % PIE_COLORS.length]} />
                </svg>
                <span className="flex-1 capitalize text-slate-500">
                  {row.name.replaceAll('_', ' ')}
                </span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Projects by Research Area" href={path('research-development')}>
          <div className="h-72">
            {areas.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart
                  data={areas}
                  layout="vertical"
                  margin={{ top: 4, right: 12, left: 12, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f7" />
                  <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={112}
                    tick={{ fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563EB" radius={[0, 6, 6, 0]} barSize={13} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No department-linked projects.
              </p>
            )}
          </div>
        </Section>

        <Section title="Publication Trend" href={path('research-development')}>
          <div className="h-72">
            {trend.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={trend} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="researchPublicationArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity=".24" />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#2563EB"
                    fill="url(#researchPublicationArea)"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No publication trend records.
              </p>
            )}
          </div>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Recent Projects" href={path('research-development')}>
          <div className="space-y-2">
            {projects.length ? (
              projects.map((project) => (
                <RowItem
                  key={project._id ?? project.projectCode ?? project.title}
                  icon={<Activity className="h-4 w-4" />}
                  primary={project.title}
                  secondary={`${project.principalInvestigator?.name ?? 'Unassigned investigator'} · ${fmtRupees(project.sanctionedAmount ?? project.grantAmount)}`}
                  end={<Badge label={project.status} color={researchStatus(project.status)} />}
                  href={path('research-development')}
                />
              ))
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">
                No research projects found.
              </p>
            )}
          </div>
        </Section>
        <Section title="Recent Publications" href={path('research-development')}>
          <div className="space-y-2">
            {publications.length ? (
              publications.map((publication) => (
                <RowItem
                  key={publication._id ?? publication.title}
                  icon={<BookOpenText className="h-4 w-4" />}
                  primary={publication.title}
                  secondary={`${publication.authorsText ?? publication.venue ?? publication.kind} · ${publication.year}`}
                  end={
                    <Badge
                      label={publication.verificationStatus ?? publication.kind}
                      color={researchStatus(publication.verificationStatus ?? publication.kind)}
                    />
                  }
                  href={path('research-development')}
                />
              ))
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">No publications found.</p>
            )}
          </div>
        </Section>
      </div>

      <Section title="Research Delivery" sub="Collection-backed financial and milestone progress">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-violet-50 p-4">
            <Banknote className="h-5 w-5 text-violet-600" />
            <p className="mt-3 text-[10px] text-slate-500">Sanctioned</p>
            <strong className="mt-1 block text-slate-900">{fmtRupees(totalGrants)}</strong>
          </div>
          <div className="rounded-xl bg-orange-50 p-4">
            <Landmark className="h-5 w-5 text-orange-600" />
            <p className="mt-3 text-[10px] text-slate-500">Expenditure</p>
            <strong className="mt-1 block text-slate-900">{fmtRupees(totalExpenditure)}</strong>
          </div>
          <div className="rounded-xl bg-emerald-50 p-4">
            <Activity className="h-5 w-5 text-emerald-600" />
            <p className="mt-3 text-[10px] text-slate-500">Milestones Completed</p>
            <strong className="mt-1 block text-slate-900">
              {fmt(d.completedMilestones)} / {fmt(d.totalMilestones)}
            </strong>
            <p className="mt-1 text-[10px] text-slate-500">{milestoneCompletion.toFixed(1)}%</p>
          </div>
          <div className="rounded-xl bg-sky-50 p-4">
            <Users className="h-5 w-5 text-sky-600" />
            <p className="mt-3 text-[10px] text-slate-500">Collaborators</p>
            <strong className="mt-1 block text-slate-900">{fmt(d.totalCollaborators)}</strong>
          </div>
        </div>
      </Section>
    </div>
  );
}

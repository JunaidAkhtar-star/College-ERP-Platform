/** @file IqacNaacDashboard.tsx @description Standalone NAAC evidence and quality dashboard. */
'use client';

import {
  Award,
  ClipboardCheck,
  FileCheck2,
  Files,
  MessageSquareMore,
  ShieldCheck,
} from 'lucide-react';
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

interface ICriterion {
  criterion: string;
  metrics: number;
  approved: number;
  submitted: number;
  files: number;
  averageScore: number;
}
interface IFeedback {
  name: string;
  count: number;
  averageScore: number;
}
interface IAudit {
  name: string;
  count: number;
  averageCompliance: number;
  findings: number;
}
interface IAttainment {
  name: string;
  records: number;
  averageAttainment: number;
  gaps: number;
}
interface IEvidence {
  _id?: string;
  criterion: string;
  metricNo: string;
  title: string;
  academicYear: string;
  status: string;
  score?: number;
  evidenceFiles?: unknown[];
  updatedAt: string;
}
interface IRecentAudit {
  _id?: string;
  academicYear: string;
  auditType: string;
  departmentId?: { name?: string; code?: string };
  auditDate: string;
  overallCompliance: number;
  status: string;
  findings?: unknown[];
}

const tone = (status: string): 'green' | 'blue' | 'amber' | 'red' | 'slate' =>
  status === 'approved' || status === 'completed' || status === 'closed'
    ? 'green'
    : status === 'submitted' || status === 'ongoing'
      ? 'blue'
      : status === 'revision_requested'
        ? 'red'
        : status === 'scheduled' || status === 'draft'
          ? 'amber'
          : 'slate';

export default function IqacNaacDashboard({ d }: { d: AnyRecord }) {
  const path = useRolePath();
  const criteria = (d.criteriaProgress as ICriterion[] | undefined) ?? [];
  const feedback = (d.feedbackSummary as IFeedback[] | undefined) ?? [];
  const audits = (d.auditSummary as IAudit[] | undefined) ?? [];
  const attainments = (d.attainmentSummary as IAttainment[] | undefined) ?? [];
  const evidence = (d.recentEvidence as IEvidence[] | undefined) ?? [];
  const recentAudits = (d.recentAudits as IRecentAudit[] | undefined) ?? [];
  const cards: IStatCard[] = [
    {
      label: 'NAAC Metrics',
      value: fmt(d.totalMetrics),
      icon: <ShieldCheck className="h-5 w-5" />,
      bg: 'bg-violet-50',
      fg: 'text-violet-600',
      href: path('naac'),
    },
    {
      label: 'Approved Metrics',
      value: fmt(d.approved),
      icon: <FileCheck2 className="h-5 w-5" />,
      bg: 'bg-emerald-50',
      fg: 'text-emerald-600',
      href: path('naac'),
    },
    {
      label: 'Evidence Files',
      value: fmt(d.files),
      icon: <Files className="h-5 w-5" />,
      bg: 'bg-blue-50',
      fg: 'text-blue-600',
      href: path('naac'),
    },
    {
      label: 'Average Score',
      value: `${Number(d.averageScore ?? 0).toFixed(2)} / 4`,
      icon: <Award className="h-5 w-5" />,
      bg: 'bg-orange-50',
      fg: 'text-orange-600',
      href: path('naac'),
    },
    {
      label: 'Feedback Responses',
      value: fmt(d.totalFeedback),
      icon: <MessageSquareMore className="h-5 w-5" />,
      bg: 'bg-rose-50',
      fg: 'text-rose-600',
      href: path('iqac'),
    },
    {
      label: 'Pending Audits',
      value: fmt(d.pendingAudits),
      icon: <ClipboardCheck className="h-5 w-5" />,
      bg: 'bg-sky-50',
      fg: 'text-sky-600',
      href: path('iqac'),
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
        <Section title="NAAC Criteria Progress" className="xl:col-span-2" href={path('naac')}>
          <div className="h-72">
            {criteria.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={criteria} margin={{ left: -20, top: 12 }}>
                  <CartesianGrid stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="criterion" tickFormatter={(value) => `C${value}`} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="metrics" name="Metrics" fill="#c4b5fd" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="approved" name="Approved" fill="#16a34a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No NAAC evidence metrics.
              </p>
            )}
          </div>
        </Section>
        <Section title="Overall Criterion Scores" href={path('naac')}>
          <div className="h-72">
            {criteria.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={criteria}
                    dataKey="averageScore"
                    nameKey="criterion"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {criteria.map((row, index) => (
                      <Cell key={row.criterion} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No scored criteria.
              </p>
            )}
          </div>
        </Section>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Recent Evidence" href={path('naac')}>
          <div className="space-y-2">
            {evidence.length ? (
              evidence.map((row) => (
                <RowItem
                  key={row._id ?? `${row.criterion}-${row.metricNo}`}
                  icon={<Files className="h-4 w-4" />}
                  primary={`${row.metricNo} · ${row.title}`}
                  secondary={`Criterion ${row.criterion} · ${row.evidenceFiles?.length ?? 0} files · ${fmtDate(row.updatedAt)}`}
                  end={<Badge label={row.status} color={tone(row.status)} />}
                  href={path('naac')}
                />
              ))
            ) : (
              <p className="py-12 text-center text-xs text-slate-600">No evidence documents.</p>
            )}
          </div>
        </Section>
        <Section title="IQAC Audits" href={path('iqac')}>
          <div className="space-y-2">
            {recentAudits.length ? (
              recentAudits.map((row) => (
                <RowItem
                  key={row._id ?? `${row.auditType}-${row.auditDate}`}
                  icon={<ClipboardCheck className="h-4 w-4" />}
                  primary={`${row.auditType} audit`}
                  secondary={`${row.departmentId?.name ?? 'Institution'} · ${fmtDate(row.auditDate)} · ${Number(row.overallCompliance ?? 0).toFixed(1)}%`}
                  end={<Badge label={row.status} color={tone(row.status)} />}
                  href={path('iqac')}
                />
              ))
            ) : (
              <p className="py-12 text-center text-xs text-slate-600">No IQAC audit records.</p>
            )}
          </div>
        </Section>
        <Section title="Audit Status" href={path('iqac')}>
          <div className="h-64">
            {audits.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={audits}
                    dataKey="count"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={80}
                  >
                    {audits.map((row, index) => (
                      <Cell key={row.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No audit status data.
              </p>
            )}
          </div>
        </Section>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Feedback Analysis" href={path('iqac')}>
          <div className="h-56">
            {feedback.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={feedback} layout="vertical" margin={{ left: 55 }}>
                  <XAxis type="number" domain={[0, 5]} />
                  <YAxis type="category" dataKey="name" width={125} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="averageScore" fill="#16a34a" radius={[0, 7, 7, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No feedback responses.
              </p>
            )}
          </div>
        </Section>
        <Section title="CO-PO Attainment" href={path('outcome-based-education')}>
          <div className="space-y-3">
            {attainments.length ? (
              attainments.map((row) => (
                <div
                  key={row.name}
                  className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
                >
                  <div>
                    <p className="text-sm font-semibold capitalize text-slate-700">{row.name}</p>
                    <p className="text-xs text-slate-600">
                      {row.records} outcomes · {row.gaps} gaps
                    </p>
                  </div>
                  <strong className="text-emerald-600">
                    {Number(row.averageAttainment ?? 0).toFixed(2)}
                  </strong>
                </div>
              ))
            ) : (
              <p className="py-12 text-center text-xs text-slate-600">
                No attainment calculations.
              </p>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}

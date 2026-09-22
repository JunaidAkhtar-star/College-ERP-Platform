/** @file IqacTeamDashboard.tsx @description Standalone IQAC audit and feedback workspace. */
'use client';

import {
  Activity,
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

interface IFeedback {
  name: string;
  count: number;
  averageScore: number;
}
interface IAuditSummary {
  name: string;
  count: number;
  averageCompliance: number;
  findings: number;
}
interface ICriterion {
  criterion: string;
  metrics: number;
  approved: number;
  submitted: number;
  files: number;
  averageScore: number;
}
interface IAudit {
  _id?: string;
  auditType: string;
  departmentId?: { name?: string };
  auditDate: string;
  overallCompliance: number;
  status: string;
  findings?: unknown[];
}
interface IFeedbackRow {
  _id?: string;
  feedbackType: string;
  averageScore: number;
  semesterType: string;
  academicYear: string;
  isAnonymous: boolean;
  createdAt: string;
}

const tone = (status: string): 'green' | 'blue' | 'amber' | 'red' | 'slate' =>
  status === 'completed' || status === 'closed' || status === 'approved'
    ? 'green'
    : status === 'ongoing' || status === 'submitted'
      ? 'blue'
      : status === 'revision_requested'
        ? 'red'
        : status === 'scheduled' || status === 'draft'
          ? 'amber'
          : 'slate';

export default function IqacTeamDashboard({ d }: { d: AnyRecord }) {
  const path = useRolePath();
  const feedback = (d.feedbackSummary as IFeedback[] | undefined) ?? [];
  const auditSummary = (d.auditSummary as IAuditSummary[] | undefined) ?? [];
  const criteria = (d.criteriaProgress as ICriterion[] | undefined) ?? [];
  const audits = (d.recentAudits as IAudit[] | undefined) ?? [];
  const recentFeedback = (d.recentFeedback as IFeedbackRow[] | undefined) ?? [];
  const cards: IStatCard[] = [
    {
      label: 'Feedback Responses',
      value: fmt(d.totalFeedback),
      icon: <MessageSquareMore className="h-5 w-5" />,
      bg: 'bg-violet-50',
      fg: 'text-violet-600',
      href: path('iqac'),
    },
    {
      label: 'Pending Audits',
      value: fmt(d.pendingAudits),
      icon: <ClipboardCheck className="h-5 w-5" />,
      bg: 'bg-orange-50',
      fg: 'text-orange-600',
      href: path('iqac'),
    },
    {
      label: 'NAAC Metrics',
      value: fmt(d.totalMetrics),
      icon: <ShieldCheck className="h-5 w-5" />,
      bg: 'bg-blue-50',
      fg: 'text-blue-600',
      href: path('naac'),
    },
    {
      label: 'Approved Evidence',
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
      bg: 'bg-sky-50',
      fg: 'text-sky-600',
      href: path('naac'),
    },
    {
      label: 'Revision Requests',
      value: fmt(d.revisionRequested),
      icon: <Activity className="h-5 w-5" />,
      bg: 'bg-rose-50',
      fg: 'text-rose-600',
      href: path('naac'),
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
        <Section title="Feedback Analysis" href={path('iqac')}>
          <div className="h-72">
            {feedback.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={feedback} layout="vertical" margin={{ left: 55 }}>
                  <XAxis type="number" domain={[0, 5]} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Bar dataKey="averageScore" fill="#16a34a" radius={[0, 7, 7, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No feedback data.
              </p>
            )}
          </div>
        </Section>
        <Section title="Audit Status" href={path('iqac')}>
          <div className="h-72">
            {auditSummary.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={auditSummary}
                    dataKey="count"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={2}
                  >
                    {auditSummary.map((row, index) => (
                      <Cell key={row.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No audits.
              </p>
            )}
          </div>
        </Section>
        <Section title="Criteria Readiness" href={path('naac')}>
          <div className="h-72">
            {criteria.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={criteria} margin={{ left: -20, top: 12 }}>
                  <CartesianGrid stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="criterion" tickFormatter={(value) => `C${value}`} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="metrics" fill="#c4b5fd" />
                  <Bar dataKey="approved" fill="#16a34a" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No criteria evidence.
              </p>
            )}
          </div>
        </Section>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Audit Work Queue" href={path('iqac')}>
          <div className="space-y-2">
            {audits.length ? (
              audits.map((audit) => (
                <RowItem
                  key={audit._id ?? `${audit.auditType}-${audit.auditDate}`}
                  icon={<ClipboardCheck className="h-4 w-4" />}
                  primary={`${audit.auditType} audit`}
                  secondary={`${audit.departmentId?.name ?? 'Institution'} · ${fmtDate(audit.auditDate)} · ${audit.findings?.length ?? 0} findings`}
                  end={<Badge label={audit.status} color={tone(audit.status)} />}
                  href={path('iqac')}
                />
              ))
            ) : (
              <p className="py-12 text-center text-xs text-slate-600">No audit work items.</p>
            )}
          </div>
        </Section>
        <Section title="Recent Feedback" href={path('iqac')}>
          <div className="space-y-2">
            {recentFeedback.length ? (
              recentFeedback.map((row) => (
                <RowItem
                  key={row._id ?? `${row.feedbackType}-${row.createdAt}`}
                  icon={<MessageSquareMore className="h-4 w-4" />}
                  primary={row.feedbackType.replaceAll('_', ' ')}
                  secondary={`${row.academicYear} · ${row.semesterType} semester · ${fmtDate(row.createdAt)}`}
                  end={
                    <Badge
                      label={`${Number(row.averageScore ?? 0).toFixed(2)} / 5`}
                      color="green"
                    />
                  }
                  href={path('iqac')}
                />
              ))
            ) : (
              <p className="py-12 text-center text-xs text-slate-600">No recent feedback.</p>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}

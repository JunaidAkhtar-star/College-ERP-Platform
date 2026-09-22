/**
 * @file ScholarshipCellDashboard.tsx
 * @description Standalone scholarship application and disbursement dashboard.
 * @module features/dashboard/role-dashboards
 */
'use client';

import { BadgeCheck, CircleDollarSign, Clock3, FileCheck2, GraduationCap } from 'lucide-react';
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
  fmtRupees,
  type IStatCard,
  PIE_COLORS,
  RowItem,
  Section,
  StatCard,
  useRolePath,
} from '../views/shared';

interface IStatus {
  name: string;
  value: number;
  totalAmount: number;
}
interface ITrend {
  label: string;
  applications: number;
  approved: number;
}
interface IDisbursement {
  label: string;
  amount: number;
  beneficiaries: number;
}
interface IScheme {
  schemeId?: string;
  name: string;
  applications: number;
  approved: number;
  disbursedAmount: number;
}
interface IApplication {
  _id?: string;
  scholarshipName: string;
  scholarshipType?: string;
  studentId?: { name?: string; email?: string };
  status: string;
  amount: number;
  approvedAmount?: number;
  disbursedAmount?: number;
  appliedDate?: string;
  documents?: { docType: string }[];
  schemeId?: { requiredDocumentTypes?: string[]; maxAwardAmount?: number };
}

/** Maps scholarship workflow states to status badge tones. */
function scholarshipTone(status: string): 'green' | 'blue' | 'amber' | 'red' | 'slate' {
  if (['approved', 'disbursed'].includes(status)) return 'green';
  if (status === 'under_review') return 'blue';
  if (['applied', 'document_pending'].includes(status)) return 'amber';
  if (status === 'rejected') return 'red';
  return 'slate';
}

/** Counts required document types not yet uploaded for an application. */
function missingDocuments(application: IApplication) {
  const required = application.schemeId?.requiredDocumentTypes ?? [];
  const uploaded = new Set((application.documents ?? []).map((document) => document.docType));
  return required.filter((document) => !uploaded.has(document)).length;
}

export default function ScholarshipCellDashboard({ d }: { d: AnyRecord }) {
  const path = useRolePath();
  const statuses = (d.byStatus as IStatus[] | undefined) ?? [];
  const trend = (d.applicationTrend as ITrend[] | undefined) ?? [];
  const disbursements = (d.disbursementTrend as IDisbursement[] | undefined) ?? [];
  const schemes = (d.topSchemes as IScheme[] | undefined) ?? [];
  const recent = (d.recentApplications as IApplication[] | undefined) ?? [];
  const pending = (d.pendingVerification as IApplication[] | undefined) ?? [];
  const approvalRate = Number(d.totalApplications)
    ? (Number(d.verifiedApproved) / Number(d.totalApplications)) * 100
    : 0;

  const cards: IStatCard[] = [
    {
      label: 'Total Applications',
      value: fmt(d.totalApplications),
      icon: <FileCheck2 className="h-5 w-5" />,
      bg: 'bg-blue-50',
      fg: 'text-blue-600',
      href: path('scholarship'),
    },
    {
      label: 'Pending Verification',
      value: fmt(d.pendingVerification),
      icon: <Clock3 className="h-5 w-5" />,
      bg: 'bg-orange-50',
      fg: 'text-orange-600',
      href: path('scholarship'),
    },
    {
      label: 'Verified & Approved',
      value: fmt(d.verifiedApproved),
      icon: <BadgeCheck className="h-5 w-5" />,
      bg: 'bg-emerald-50',
      fg: 'text-emerald-600',
      href: path('scholarship'),
    },
    {
      label: 'Disbursed Amount',
      value: fmtRupees(d.disbursedAmount),
      icon: <CircleDollarSign className="h-5 w-5" />,
      bg: 'bg-violet-50',
      fg: 'text-violet-600',
      href: path('scholarship'),
    },
    {
      label: 'Active Schemes',
      value: fmt(d.activeSchemes),
      icon: <GraduationCap className="h-5 w-5" />,
      bg: 'bg-rose-50',
      fg: 'text-rose-600',
      href: path('scholarship'),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card, index) => (
          <StatCard key={card.label} {...card} index={index} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Application Trend" className="xl:col-span-2" href={path('scholarship')}>
          <div className="h-72">
            {trend.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="applications"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="approved"
                    stroke="#16A36A"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No scholarship application history.
              </p>
            )}
          </div>
        </Section>

        <Section title="Application Status" href={path('scholarship')}>
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
                    {statuses.map((status, index) => (
                      <Cell key={status.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No scholarship applications.
              </p>
            )}
            {statuses.length > 0 && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <strong className="text-xl text-slate-900">{fmt(d.totalApplications)}</strong>
                <span className="text-[10px] text-slate-500">Applications</span>
              </div>
            )}
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs">
            <span className="text-slate-500">Approval rate</span>
            <strong className="float-right text-emerald-700">{approvalRate.toFixed(1)}%</strong>
          </div>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Top Schemes by Applications" href={path('scholarship')}>
          <div className="space-y-2">
            {schemes.length ? (
              schemes.map((scheme, index) => (
                <div
                  key={scheme.schemeId ?? scheme.name}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-slate-50 p-3 text-xs"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white font-bold text-primary">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <strong className="block truncate text-slate-800">{scheme.name}</strong>
                    <span className="text-[10px] text-slate-500">
                      {fmt(scheme.approved)} approved · {fmtRupees(scheme.disbursedAmount)}
                    </span>
                  </div>
                  <strong>{fmt(scheme.applications)}</strong>
                </div>
              ))
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">No scheme applications.</p>
            )}
          </div>
        </Section>

        <Section title="Recent Applications" href={path('scholarship')}>
          <div className="space-y-2">
            {recent.length ? (
              recent.map((application) => (
                <RowItem
                  key={
                    application._id ?? `${application.studentId?.email}-${application.appliedDate}`
                  }
                  icon={<GraduationCap className="h-4 w-4" />}
                  primary={`${application.studentId?.name ?? application.studentId?.email ?? 'Unlinked student'} · ${application.scholarshipName}`}
                  secondary={`${fmtDate(application.appliedDate)} · requested ${fmtRupees(application.amount)}`}
                  end={
                    <Badge
                      label={application.status.replaceAll('_', ' ')}
                      color={scholarshipTone(application.status)}
                    />
                  }
                  href={path('scholarship')}
                />
              ))
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">No recent applications.</p>
            )}
          </div>
        </Section>

        <Section title="Pending Verification" href={path('scholarship')}>
          <div className="space-y-2">
            {pending.length ? (
              pending.map((application) => {
                const missing = missingDocuments(application);
                return (
                  <RowItem
                    key={
                      application._id ??
                      `${application.studentId?.email}-${application.appliedDate}`
                    }
                    icon={<FileCheck2 className="h-4 w-4" />}
                    primary={`${application.studentId?.name ?? application.studentId?.email ?? 'Unlinked student'} · ${application.scholarshipName}`}
                    secondary={`${fmtDate(application.appliedDate)} · ${missing} required document${missing === 1 ? '' : 's'} missing`}
                    end={
                      <Badge
                        label={application.status.replaceAll('_', ' ')}
                        color={scholarshipTone(application.status)}
                      />
                    }
                    href={path('scholarship')}
                  />
                );
              })
            ) : (
              <p className="py-10 text-center text-xs text-slate-600">No verification queue.</p>
            )}
          </div>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Disbursement Overview" href={path('scholarship')}>
          <div className="h-64">
            {disbursements.length ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={disbursements} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `${Number(value) / 100000}L`}
                  />
                  <Tooltip formatter={(value) => fmtRupees(Number(value))} />
                  <Bar dataKey="amount" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-xs text-slate-600">
                No disbursements recorded.
              </p>
            )}
          </div>
        </Section>
        <Section title="Scheme Budget Summary" href={path('scholarship')}>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-violet-50 p-4">
              <p className="text-[10px] text-slate-500">Total Budget</p>
              <strong className="mt-2 block text-slate-900">{fmtRupees(d.totalBudget)}</strong>
            </div>
            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-[10px] text-slate-500">Reserved</p>
              <strong className="mt-2 block text-slate-900">{fmtRupees(d.reservedAmount)}</strong>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-[10px] text-slate-500">Scheme Disbursed</p>
              <strong className="mt-2 block text-slate-900">
                {fmtRupees(d.schemeDisbursedAmount)}
              </strong>
            </div>
            <div className="rounded-xl bg-orange-50 p-4">
              <p className="text-[10px] text-slate-500">Available</p>
              <strong className="mt-2 block text-slate-900">
                {fmtRupees(
                  Math.max(
                    Number(d.totalBudget ?? 0) -
                      Number(d.reservedAmount ?? 0) -
                      Number(d.schemeDisbursedAmount ?? 0),
                    0,
                  ),
                )}
              </strong>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

'use client';
import { motion } from '@/shared/utils/motion';
import Empty from '@/shared/core/Empty';
import { Award, CheckCircle2, FileText, RotateCcw } from 'lucide-react';

interface IEvidence {
  status: 'draft' | 'submitted' | 'approved' | 'revision_requested';
  criterion: string;
  score?: number;
}
interface IReport {
  status: 'draft' | 'approved';
  thresholdMet?: boolean;
}

export default function NaacNbaOverview({
  evidences,
  reports,
  loading,
}: {
  evidences: IEvidence[];
  reports: IReport[];
  loading: boolean;
}) {
  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-white" />;
  if (!evidences.length && !reports.length)
    return (
      <div className="rounded-2xl bg-white">
        <Empty
          title="No accreditation evidence yet"
          subTitle="NAAC evidence and NBA reports for the selected academic year will build this overview."
        />
      </div>
    );
  const approvedEvidence = evidences.filter((item) => item.status === 'approved').length;
  const pending = evidences.filter((item) => item.status === 'submitted').length;
  const revision = evidences.filter((item) => item.status === 'revision_requested').length;
  const approvedReports = reports.filter((item) => item.status === 'approved').length;
  const cards = [
    [
      'Evidence approved',
      approvedEvidence,
      'Verified NAAC submissions',
      CheckCircle2,
      'bg-emerald-50 text-emerald-600',
    ],
    [
      'Awaiting review',
      pending,
      'Submitted for independent review',
      Award,
      'bg-blue-50 text-blue-600',
    ],
    [
      'Revision required',
      revision,
      'Returned with reviewer notes',
      RotateCcw,
      'bg-amber-50 text-amber-600',
    ],
    [
      'NBA reports approved',
      approvedReports,
      `${reports.length} reports in scope`,
      FileText,
      'bg-violet-50 text-violet-600',
    ],
  ] as const;
  const status = [
    {
      label: 'Draft',
      value: evidences.filter((item) => item.status === 'draft').length,
      color: '#94a3b8',
    },
    { label: 'Submitted', value: pending, color: '#60a5fa' },
    { label: 'Approved', value: approvedEvidence, color: '#34d399' },
    { label: 'Revision', value: revision, color: '#f59e0b' },
  ];
  const total = Math.max(evidences.length, 1);
  const circumference = 2 * Math.PI * 48;
  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, note, Icon, tone], index) => (
          <motion.article
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="rounded-2xl bg-white p-4 sm:p-5"
          >
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
              <Icon className="h-5 w-5" />
            </span>
            <p className="mt-4 text-2xl font-bold text-slate-800">{value}</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">{label}</p>
            <p className="mt-1 text-xs text-slate-500">{note}</p>
          </motion.article>
        ))}
      </div>
      <article className="rounded-2xl bg-white p-5 sm:p-6">
        <p className="text-sm font-semibold text-slate-800">NAAC review pipeline</p>
        <p className="mt-1 text-xs text-slate-500">
          Live evidence distribution for the selected academic year.
        </p>
        <div className="mt-5 grid items-center gap-5 sm:grid-cols-[170px_1fr]">
          <div className="relative mx-auto h-40 w-40">
            <svg viewBox="0 0 130 130" className="h-full w-full -rotate-90">
              <circle cx="65" cy="65" r="48" fill="none" stroke="#f1f5f9" strokeWidth="16" />
              {status.map((item, index) => {
                const length = (item.value / total) * circumference;
                const offset = status
                  .slice(0, index)
                  .reduce((sum, entry) => sum + (entry.value / total) * circumference, 0);
                return (
                  <motion.circle
                    key={item.label}
                    cx="65"
                    cy="65"
                    r="48"
                    fill="none"
                    stroke={item.color}
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeDasharray={`${Math.max(0, length - 4)} ${circumference}`}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: -offset }}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-slate-800">{evidences.length}</span>
              <span className="text-[10px] text-slate-500">evidence items</span>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {status.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"
              >
                <span className="text-xs font-medium text-slate-600">{item.label}</span>
                <span className="font-bold text-slate-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </article>
    </section>
  );
}

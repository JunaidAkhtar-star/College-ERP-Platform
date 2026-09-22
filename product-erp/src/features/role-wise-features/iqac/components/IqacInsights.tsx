'use client';

import { motion } from '@/shared/utils/motion';
import { BadgeCheck, ClipboardCheck, CircleAlert, MessageSquareText } from 'lucide-react';
import Empty from '@/shared/core/Empty';

interface IAuditInsight {
  status: 'scheduled' | 'ongoing' | 'completed' | 'closed';
  overallCompliance?: number;
  findings?: Array<{ status: 'compliant' | 'partial' | 'non_compliant' }>;
}

interface IFeedbackInsight {
  averageScore: number;
  count: number;
}

interface IProps {
  audits: IAuditInsight[];
  analysis: IFeedbackInsight[];
  isLoading: boolean;
}

const statusMeta = [
  { key: 'scheduled', label: 'Scheduled', color: '#60a5fa', dot: 'bg-blue-400' },
  { key: 'ongoing', label: 'In review', color: '#f59e0b', dot: 'bg-amber-500' },
  { key: 'completed', label: 'Completed', color: '#34d399', dot: 'bg-emerald-400' },
  { key: 'closed', label: 'Closed', color: '#a78bfa', dot: 'bg-violet-400' },
] as const;

function AnimatedDonut({ audits }: { audits: IAuditInsight[] }) {
  const total = audits.length;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="grid items-center gap-5 sm:grid-cols-[160px_1fr]">
      <div className="relative mx-auto h-40 w-40">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" role="img">
          <title>Audit workflow distribution</title>
          <circle cx="70" cy="70" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="16" />
          {total > 0 &&
            statusMeta.map((item, index) => {
              const value = audits.filter((audit) => audit.status === item.key).length;
              const length = (value / total) * circumference;
              const offset = statusMeta
                .slice(0, index)
                .reduce(
                  (sum, previous) =>
                    sum +
                    (audits.filter((audit) => audit.status === previous.key).length / total) *
                      circumference,
                  0,
                );
              return (
                <motion.circle
                  key={item.key}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeDasharray={`${Math.max(0, length - 4)} ${circumference}`}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: -offset }}
                  transition={{ duration: 0.8, delay: index * 0.1 }}
                />
              );
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-slate-800">{total}</span>
          <span className="text-[11px] font-medium text-slate-500">governed audits</span>
        </div>
      </div>
      <div className="space-y-2">
        {statusMeta.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
          >
            <span className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <span className={`h-2.5 w-2.5 rounded-full ${item.dot}`} />
              {item.label}
            </span>
            <span className="text-sm font-bold text-slate-800">
              {audits.filter((audit) => audit.status === item.key).length}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComplianceOrbit({ audits }: { audits: IAuditInsight[] }) {
  const values = audits.slice(0, 10);
  const average = values.length
    ? Math.round(
        values.reduce((sum, audit) => sum + (audit.overallCompliance ?? 0), 0) / values.length,
      )
    : 0;
  return (
    <div className="grid items-center gap-5 sm:grid-cols-[180px_1fr]">
      <div className="relative mx-auto h-44 w-44">
        <svg viewBox="0 0 180 180" className="h-full w-full" role="img">
          <title>Audit compliance orbit</title>
          <motion.circle
            cx="90"
            cy="90"
            r="48"
            fill="#f0fdf4"
            stroke="#bbf7d0"
            strokeWidth="2"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          />
          {values.map((audit, index) => {
            const angle = (Math.PI * 2 * index) / Math.max(values.length, 1);
            const distance = 65 + ((audit.overallCompliance ?? 0) / 100) * 14;
            return (
              <motion.circle
                key={index}
                cx={90 + Math.cos(angle) * distance}
                cy={90 + Math.sin(angle) * distance}
                r={5 + ((audit.overallCompliance ?? 0) / 100) * 5}
                fill={
                  (audit.overallCompliance ?? 0) >= 75
                    ? '#34d399'
                    : (audit.overallCompliance ?? 0) >= 50
                      ? '#fbbf24'
                      : '#fb7185'
                }
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.06 }}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-slate-800">{average}%</span>
          <span className="text-[10px] text-slate-500">average</span>
        </div>
      </div>
      <div className="space-y-3">
        <div className="rounded-xl bg-emerald-50 p-3">
          <p className="text-xs font-semibold text-emerald-700">Healthy · 75–100%</p>
          <p className="mt-1 text-lg font-bold text-emerald-800">
            {audits.filter((audit) => (audit.overallCompliance ?? 0) >= 75).length}
          </p>
        </div>
        <div className="rounded-xl bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-700">Watch · 50–74%</p>
          <p className="mt-1 text-lg font-bold text-amber-800">
            {
              audits.filter(
                (audit) =>
                  (audit.overallCompliance ?? 0) >= 50 && (audit.overallCompliance ?? 0) < 75,
              ).length
            }
          </p>
        </div>
        <div className="rounded-xl bg-rose-50 p-3">
          <p className="text-xs font-semibold text-rose-700">Priority · below 50%</p>
          <p className="mt-1 text-lg font-bold text-rose-800">
            {audits.filter((audit) => (audit.overallCompliance ?? 0) < 50).length}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function IqacInsights({ audits, analysis, isLoading }: IProps) {
  const complianceValues = audits.map((audit) => audit.overallCompliance ?? 0);
  const averageCompliance = complianceValues.length
    ? Math.round(complianceValues.reduce((sum, value) => sum + value, 0) / complianceValues.length)
    : 0;
  const attention = audits.reduce(
    (sum, audit) =>
      sum + (audit.findings ?? []).filter((finding) => finding.status !== 'compliant').length,
    0,
  );
  const responses = analysis.reduce((sum, item) => sum + item.count, 0);
  const feedbackScore = responses
    ? analysis.reduce((sum, item) => sum + item.averageScore * item.count, 0) / responses
    : 0;
  const cards = [
    {
      label: 'Audit register',
      value: audits.length,
      note: 'Records in this reporting cycle',
      icon: ClipboardCheck,
      tone: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Average compliance',
      value: `${averageCompliance}%`,
      note: 'Calculated from recorded audits',
      icon: BadgeCheck,
      tone: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Findings to address',
      value: attention,
      note: 'Partial and non-compliant findings',
      icon: CircleAlert,
      tone: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Feedback health',
      value: responses ? `${feedbackScore.toFixed(1)}/5` : '—',
      note: responses ? `${responses} criterion responses` : 'No responses in scope',
      icon: MessageSquareText,
      tone: 'bg-violet-50 text-violet-600',
    },
  ];

  if (isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-white" />;
  if (!audits.length && !analysis.length)
    return (
      <div className="rounded-2xl bg-white">
        <Empty
          title="No quality evidence yet"
          subTitle="Audits and feedback for the selected reporting period will build this overview."
        />
      </div>
    );

  return (
    <section className="space-y-4" aria-label="IQAC quality overview">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card, index) => (
          <motion.article
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            whileHover={{ y: -2 }}
            className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.tone}`}>
              <card.icon className="h-5 w-5" />
            </div>
            <p className="mt-4 text-2xl font-bold text-slate-800">{card.value}</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">{card.label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{card.note}</p>
          </motion.article>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6"
        >
          <div className="mb-5">
            <p className="text-sm font-semibold text-slate-800">Audit workflow health</p>
            <p className="mt-1 text-xs text-slate-500">
              Live distribution across the selected academic year.
            </p>
          </div>
          {audits.length ? (
            <AnimatedDonut audits={audits} />
          ) : (
            <div className="flex min-h-40 items-center justify-center rounded-xl bg-slate-50 px-5 text-center text-sm text-slate-500">
              Create the first audit to reveal workflow and compliance signals.
            </div>
          )}
        </motion.article>
        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6"
        >
          <div className="mb-5">
            <p className="text-sm font-semibold text-slate-800">Compliance spectrum</p>
            <p className="mt-1 text-xs text-slate-500">
              Each orbit point is a real audit, sized by its recorded compliance.
            </p>
          </div>
          {audits.length ? (
            <ComplianceOrbit audits={audits} />
          ) : (
            <div className="flex min-h-40 items-center justify-center rounded-xl bg-slate-50 px-5 text-center text-sm text-slate-500">
              Compliance signals appear after findings are recorded.
            </div>
          )}
        </motion.article>
      </div>
    </section>
  );
}

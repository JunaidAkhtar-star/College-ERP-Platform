'use client';
import { motion } from '@/shared/utils/motion';
import { Award, CheckCircle2, CircleAlert, FileCheck2 } from 'lucide-react';

interface IEvidence {
  criterion: string;
  status: 'draft' | 'submitted' | 'approved' | 'revision_requested';
  score?: number;
}
interface IReport {
  status: 'draft' | 'approved';
  thresholdMet?: boolean;
  poAttainments: Array<{ attainmentLevel: number }>;
}

export function NaacTabInsights({ records }: { records: IEvidence[] }) {
  if (!records.length) return null;
  const approved = records.filter((item) => item.status === 'approved');
  const scored = approved.filter((item) => typeof item.score === 'number');
  const average = scored.length
    ? scored.reduce((sum, item) => sum + (item.score ?? 0), 0) / scored.length
    : 0;
  const criteria = Array.from({ length: 7 }, (_, index) => ({
    criterion: String(index + 1),
    total: records.filter((item) => item.criterion === String(index + 1)).length,
    approved: approved.filter((item) => item.criterion === String(index + 1)).length,
  }));
  const max = Math.max(...criteria.map((item) => item.total), 1);
  const cards = [
    ['Evidence items', records.length, Award, 'bg-blue-50 text-blue-600'],
    ['Approved', approved.length, CheckCircle2, 'bg-emerald-50 text-emerald-600'],
    [
      'Awaiting decision',
      records.filter((item) => item.status === 'submitted').length,
      FileCheck2,
      'bg-violet-50 text-violet-600',
    ],
    [
      'Average score',
      scored.length ? average.toFixed(1) : '—',
      CircleAlert,
      'bg-amber-50 text-amber-600',
    ],
  ] as const;
  return (
    <section className="space-y-4" aria-label="NAAC evidence analytics">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, Icon, tone], index) => (
          <motion.article
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="rounded-2xl bg-white p-4"
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>
              <Icon className="h-4.5 w-4.5" />
            </span>
            <p className="mt-3 text-2xl font-bold text-slate-800">{value}</p>
            <p className="text-xs font-semibold text-slate-500">{label}</p>
          </motion.article>
        ))}
      </div>
      <article className="rounded-2xl bg-white p-5">
        <p className="text-sm font-semibold text-slate-800">Criterion evidence coverage</p>
        <p className="mt-1 text-xs text-slate-500">
          Real submission and approval coverage across all seven NAAC criteria.
        </p>
        <div className="mt-5 grid grid-cols-4 gap-3 sm:grid-cols-7">
          {criteria.map((item, index) => {
            const size =
              item.total / max > 0.66
                ? 'h-16 w-16'
                : item.total / max > 0.33
                  ? 'h-14 w-14'
                  : 'h-12 w-12';
            return (
              <motion.div
                key={item.criterion}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.06 }}
                className="text-center"
              >
                <div
                  className={`mx-auto flex ${size} items-center justify-center rounded-full bg-primary-50 text-lg font-bold text-primary`}
                >
                  {item.total}
                </div>
                <p className="mt-2 text-[11px] font-semibold text-slate-600">
                  Criterion {item.criterion}
                </p>
                <p className="text-[10px] text-slate-400">{item.approved} approved</p>
              </motion.div>
            );
          })}
        </div>
      </article>
    </section>
  );
}

export function NbaTabInsights({ records }: { records: IReport[] }) {
  if (!records.length) return null;
  const approved = records.filter((item) => item.status === 'approved').length;
  const threshold = records.filter((item) => item.thresholdMet).length;
  const draft = records.length - approved;
  const poValues = records.flatMap((item) => item.poAttainments.map((po) => po.attainmentLevel));
  const average = poValues.length ? poValues.reduce((a, b) => a + b, 0) / poValues.length : 0;
  const radius = 50,
    circ = 2 * Math.PI * radius,
    approvedLength = (approved / records.length) * circ;
  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_1.1fr]" aria-label="NBA report analytics">
      <article className="rounded-2xl bg-white p-5">
        <p className="text-sm font-semibold text-slate-800">Approval distribution</p>
        <p className="mt-1 text-xs text-slate-500">
          Current governance state of programme reports.
        </p>
        <div className="mt-4 grid items-center gap-4 sm:grid-cols-[170px_1fr]">
          <div className="relative mx-auto h-40 w-40">
            <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
              <circle cx="70" cy="70" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="17" />
              <motion.circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke="#34d399"
                strokeWidth="17"
                strokeLinecap="round"
                strokeDasharray={`${approvedLength} ${circ}`}
                initial={{ strokeDashoffset: circ }}
                animate={{ strokeDashoffset: 0 }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-slate-800">{approved}</span>
              <span className="text-[10px] text-slate-500">approved</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              <span>Approved</span>
              <b>{approved}</b>
            </div>
            <div className="flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span>Draft</span>
              <b>{draft}</b>
            </div>
          </div>
        </div>
      </article>
      <article className="rounded-2xl bg-white p-5">
        <p className="text-sm font-semibold text-slate-800">Outcome readiness</p>
        <p className="mt-1 text-xs text-slate-500">
          Threshold and PO evidence across reports in the selected year.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-2xl font-bold text-slate-800">{records.length}</p>
            <p className="mt-1 text-xs text-slate-500">Programme reports</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-4">
            <p className="text-2xl font-bold text-emerald-700">{threshold}</p>
            <p className="mt-1 text-xs text-emerald-600">Threshold met</p>
          </div>
          <div className="rounded-xl bg-blue-50 p-4">
            <p className="text-2xl font-bold text-blue-700">
              {poValues.length ? average.toFixed(1) : '—'}
            </p>
            <p className="mt-1 text-xs text-blue-600">Average PO value</p>
          </div>
        </div>
      </article>
    </section>
  );
}

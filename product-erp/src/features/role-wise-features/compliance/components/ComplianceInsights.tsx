'use client';

import { motion } from '@/shared/utils/motion';
import type { IComplianceDashboard } from '../types/compliance.types';

interface IProps {
  dashboard?: IComplianceDashboard;
  isLoading: boolean;
  onOpenFramework: (framework: string) => void;
}

export default function ComplianceInsights({ dashboard, isLoading, onOpenFramework }: IProps) {
  const approved = dashboard?.approved ?? 0;
  const awaiting = dashboard?.submitted ?? 0;
  const nonCompliant = dashboard?.nonCompliant ?? 0;
  const decidedTotal = approved + awaiting + nonCompliant;
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const segments = [
    { label: 'Approved', value: approved, color: '#34d399', tone: 'bg-emerald-400' },
    { label: 'Awaiting review', value: awaiting, color: '#60a5fa', tone: 'bg-blue-400' },
    { label: 'Non-compliant', value: nonCompliant, color: '#fb7185', tone: 'bg-rose-400' },
  ];
  let offset = 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[0.85fr_1.4fr]">
      <section className="rounded-2xl bg-white p-5" aria-label="Compliance decision distribution">
        <h2 className="text-sm font-semibold text-slate-800">Review decisions</h2>
        <p className="mt-1 text-xs text-slate-500">
          Current evidence workflow for the selected academic year.
        </p>
        <div className="mt-4 grid items-center gap-4 sm:grid-cols-[160px_1fr] lg:grid-cols-1 xl:grid-cols-[160px_1fr]">
          <div className="relative mx-auto h-36 w-36">
            <svg viewBox="0 0 130 130" className="h-full w-full -rotate-90" role="img">
              <title>Compliance review distribution</title>
              <circle cx="65" cy="65" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="16" />
              {decidedTotal > 0 &&
                segments.map((segment) => {
                  const length = (segment.value / decidedTotal) * circumference;
                  const currentOffset = offset;
                  offset += length;
                  return (
                    <motion.circle
                      key={segment.label}
                      cx="65"
                      cy="65"
                      r={radius}
                      fill="none"
                      stroke={segment.color}
                      strokeWidth="16"
                      strokeDasharray={`${length} ${circumference - length}`}
                      strokeDashoffset={-currentOffset}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    />
                  );
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-slate-800">
                {isLoading ? '—' : decidedTotal}
              </span>
              <span className="text-[10px] text-slate-500">recorded</span>
            </div>
          </div>
          <div className="space-y-2">
            {segments.map((segment) => (
              <div key={segment.label} className="flex items-center justify-between gap-4 text-xs">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className={`h-2.5 w-2.5 rounded-full ${segment.tone}`} />
                  {segment.label}
                </span>
                <strong className="text-slate-800">{isLoading ? '—' : segment.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5" aria-label="Framework readiness">
        <h2 className="text-sm font-semibold text-slate-800">Framework readiness</h2>
        <p className="mt-1 text-xs text-slate-500">
          Approved requirements compared across every active framework.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(dashboard?.frameworks ?? []).map((item, index) => (
            <motion.button
              key={item.framework}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onOpenFramework(item.framework)}
              className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-left transition-colors hover:bg-primary-50"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-primary">
                {item.score}%
              </span>
              <span className="min-w-0">
                <strong className="block truncate text-xs text-slate-700">
                  {item.shortName || item.framework}
                </strong>
                <span className="mt-0.5 block text-[11px] text-slate-500">
                  {item.completed} of {item.total} approved
                </span>
              </span>
            </motion.button>
          ))}
          {!isLoading && !(dashboard?.frameworks.length ?? 0) && (
            <p className="text-xs text-slate-500">No active frameworks are configured yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

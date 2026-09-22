/**
 * @file CounselingInsights.tsx
 * @description Animated, API-backed counseling distribution and attention visualizations.
 * @module features/role-wise-features/counseling
 */
'use client';

import { motion } from '@/shared/utils/motion';
import { CalendarCheck, CheckCircle2, CircleAlert } from 'lucide-react';
import { ICounselingStats } from '../types/counseling.types';

interface ICounselingInsightsProps {
  stats?: ICounselingStats;
  isLoading: boolean;
}

interface IStatusDatum {
  label: string;
  shortLabel: string;
  value: number;
  color: string;
  textColor: string;
  icon: React.ReactNode;
}

const RADIUS = 62;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Keeps a calculated percentage finite and inside the SVG range. */
function percentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

/** Renders an honest, useful analytics state before any counseling record exists. */
function EmptyInsights() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-slate-100 bg-white"
    >
      <div className="grid items-center gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_1.15fr] lg:p-7">
        <div>
          <span className="inline-flex rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary">
            Counseling insights
          </span>
          <h2 className="mt-3 text-lg font-semibold text-slate-800">
            Your support picture starts here
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
            Schedule the first session to reveal workload distribution, resolution health, and
            follow-up attention signals. Analytics always use live records—nothing is estimated.
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {[
              ['1', 'Schedule'],
              ['2', 'Record outcome'],
              ['3', 'Close follow-up'],
            ].map(([step, label]) => (
              <div
                key={step}
                className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-primary">
                  {step}
                </span>
                <span className="text-xs font-medium text-slate-600">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto h-44 w-full max-w-md" aria-hidden="true">
          <svg viewBox="0 0 440 180" className="h-full w-full overflow-visible">
            <motion.path
              d="M48 91 C102 18 164 150 225 78 C284 8 342 145 397 72"
              fill="none"
              stroke="#dbeafe"
              strokeWidth="3"
              strokeDasharray="7 9"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.2 }}
            />
            {[
              { cx: 54, cy: 86, r: 30, fill: '#eff6ff', stroke: '#93c5fd' },
              { cx: 224, cy: 79, r: 38, fill: '#f5f3ff', stroke: '#c4b5fd' },
              { cx: 393, cy: 72, r: 30, fill: '#ecfdf5', stroke: '#86efac' },
            ].map((node, index) => (
              <motion.circle
                key={node.cx}
                {...node}
                strokeWidth="2"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', delay: 0.18 + index * 0.15 }}
                style={{ transformOrigin: `${node.cx}px ${node.cy}px` }}
              />
            ))}
            <path
              d="M44 85 l7 7 14 -16"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M210 79 h28 M224 65 v28"
              stroke="#8b5cf6"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M382 72 l7 7 14 -16"
              fill="none"
              stroke="#22c55e"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <text
              x="54"
              y="140"
              textAnchor="middle"
              className="fill-slate-500 text-[11px] font-medium"
            >
              Plan
            </text>
            <text
              x="224"
              y="145"
              textAnchor="middle"
              className="fill-slate-500 text-[11px] font-medium"
            >
              Support
            </text>
            <text
              x="393"
              y="126"
              textAnchor="middle"
              className="fill-slate-500 text-[11px] font-medium"
            >
              Resolve
            </text>
          </svg>
        </div>
      </div>
    </motion.section>
  );
}

/** Displays live distribution as an animated segmented ring. */
function ResolutionDonut({ data, total }: { data: IStatusDatum[]; total: number }) {
  const completed = data[0]?.value ?? 0;

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[180px_1fr]">
      <div className="relative mx-auto h-44 w-44">
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" role="img">
          <title>Counseling session status distribution</title>
          <circle cx="80" cy="80" r={RADIUS} fill="none" stroke="#f1f5f9" strokeWidth="18" />
          {data.map((item, index) => {
            const length = (item.value / total) * CIRCUMFERENCE;
            const currentOffset = data
              .slice(0, index)
              .reduce((sum, entry) => sum + (entry.value / total) * CIRCUMFERENCE, 0);
            return (
              <motion.circle
                key={item.label}
                cx="80"
                cy="80"
                r={RADIUS}
                fill="none"
                stroke={item.color}
                strokeWidth="18"
                strokeLinecap="round"
                strokeDasharray={`${Math.max(0, length - 5)} ${CIRCUMFERENCE}`}
                initial={{ strokeDashoffset: CIRCUMFERENCE }}
                animate={{ strokeDashoffset: -currentOffset }}
                transition={{ duration: 0.8, delay: index * 0.12, ease: 'easeOut' }}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-bold text-slate-900">{percentage(completed, total)}%</span>
          <span className="text-[11px] font-medium text-slate-500">resolved</span>
        </div>
      </div>
      <div className="space-y-2.5">
        {data.map((item) => (
          <motion.div
            key={item.label}
            whileHover={{ x: 3 }}
            className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="truncate text-xs font-medium text-slate-600">{item.label}</span>
            </div>
            <span className="text-sm font-bold text-slate-800">{item.value}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/** Uses live counts to form a radial workload constellation without fabricated trends. */
function AttentionConstellation({ data, total }: { data: IStatusDatum[]; total: number }) {
  const nodes = [
    { x: 92, y: 82 },
    { x: 220, y: 54 },
    { x: 329, y: 102 },
  ];

  return (
    <div className="relative h-56 w-full overflow-hidden rounded-xl bg-slate-50">
      <svg viewBox="0 0 420 220" className="h-full w-full" role="img">
        <title>Relative counseling workload by status</title>
        <motion.path
          d="M92 82 Q158 20 220 54 T329 102"
          fill="none"
          stroke="#dbe4ef"
          strokeWidth="2"
          strokeDasharray="5 8"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9 }}
        />
        {data.map((item, index) => {
          const node = nodes[index];
          const radius = 30 + percentage(item.value, total) * 0.22;
          return (
            <g key={item.label}>
              <motion.circle
                cx={node.x}
                cy={node.y}
                r={radius}
                fill={item.color}
                fillOpacity="0.16"
                stroke={item.color}
                strokeWidth="2"
                initial={{ r: 0, opacity: 0 }}
                animate={{ r: radius, opacity: 1 }}
                transition={{ type: 'spring', delay: index * 0.14 }}
              />
              <text
                x={node.x}
                y={node.y + 5}
                textAnchor="middle"
                fill={item.color}
                className="text-lg font-bold"
              >
                {item.value}
              </text>
              <text
                x={node.x}
                y={node.y + radius + 20}
                textAnchor="middle"
                className="fill-slate-600 text-[11px] font-medium"
              >
                {item.shortLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function CounselingInsights({ stats, isLoading }: ICounselingInsightsProps) {
  const total = stats?.totalSessions ?? 0;
  if (!isLoading && total === 0) return <EmptyInsights />;

  const data: IStatusDatum[] = [
    {
      label: 'Completed sessions',
      shortLabel: 'Completed',
      value: stats?.completedSessions ?? 0,
      color: '#10b981',
      textColor: 'text-emerald-700',
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
    {
      label: 'Scheduled sessions',
      shortLabel: 'Scheduled',
      value: stats?.pendingSessions ?? 0,
      color: '#3b82f6',
      textColor: 'text-blue-700',
      icon: <CalendarCheck className="h-4 w-4" />,
    },
    {
      label: 'Needs attention',
      shortLabel: 'Attention',
      value: stats?.followUpRequired ?? 0,
      color: '#f97316',
      textColor: 'text-orange-700',
      icon: <CircleAlert className="h-4 w-4" />,
    },
  ];

  return (
    <section className="grid gap-4 xl:grid-cols-2" aria-label="Counseling insights">
      <motion.article
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Resolution mix</p>
            <p className="mt-1 text-xs text-slate-500">How current-year sessions are distributed</p>
          </div>
          <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
          </span>
        </div>
        {isLoading ? (
          <div className="h-44 animate-pulse rounded-xl bg-slate-50" />
        ) : (
          <ResolutionDonut data={data} total={total} />
        )}
      </motion.article>

      <motion.article
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Attention landscape</p>
            <p className="mt-1 text-xs text-slate-500">
              Larger circles indicate a greater share of work
            </p>
          </div>
          <span className="rounded-lg bg-orange-50 p-2 text-orange-600">
            <CircleAlert className="h-4 w-4" />
          </span>
        </div>
        {isLoading ? (
          <div className="h-56 animate-pulse rounded-xl bg-slate-50" />
        ) : (
          <AttentionConstellation data={data} total={total} />
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {data.map((item) => (
            <span
              key={item.label}
              className={`inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium ${item.textColor}`}
            >
              {item.icon}
              {item.label}
            </span>
          ))}
        </div>
      </motion.article>
    </section>
  );
}

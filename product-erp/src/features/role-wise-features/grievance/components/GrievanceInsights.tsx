/**
 * @file GrievanceInsights.tsx
 * @description Live animated grievance resolution and urgency visualizations.
 * @module features/role-wise-features/grievance
 */
'use client';

import { useState } from 'react';
import { motion } from '@/shared/utils/motion';
import { Activity, TimerReset } from 'lucide-react';

interface IInsightRecord {
  status: string;
  priority: string;
  resolutionDueAt?: string;
}

interface IInsightStats {
  total?: number;
  submitted?: number;
  acknowledged?: number;
  under_review?: number;
  resolved?: number;
  referred?: number;
  closed?: number;
  avgResolutionDays?: number;
  byPriority?: Record<string, number>;
}

interface IProps {
  stats: IInsightStats;
  records: IInsightRecord[];
  isLoading: boolean;
}

function count(records: IInsightRecord[], statuses: string[]): number {
  return records.filter((record) => statuses.includes(record.status)).length;
}

export default function GrievanceInsights({ stats, records, isLoading }: IProps) {
  const [renderedAt] = useState(() => Date.now());
  const total = stats.total ?? records.length;
  if (!isLoading && total === 0) return null;

  const resolved =
    (stats.resolved ?? count(records, ['resolved'])) + (stats.closed ?? count(records, ['closed']));
  const reviewing =
    (stats.acknowledged ?? count(records, ['acknowledged'])) +
    (stats.under_review ?? count(records, ['under_review']));
  const waiting = (stats.submitted ?? count(records, ['submitted'])) + count(records, ['reopened']);
  const urgent =
    (stats.byPriority?.urgent ?? 0) +
    (stats.byPriority?.high ?? records.filter((record) => record.priority === 'high').length);
  const overdue = records.filter(
    (record) =>
      record.resolutionDueAt &&
      new Date(record.resolutionDueAt).getTime() < renderedAt &&
      !['resolved', 'closed'].includes(record.status),
  ).length;
  const nodes = [
    { label: 'Waiting', value: waiting, x: 70, y: 92, radius: 31, color: '#f59e0b' },
    { label: 'Reviewing', value: reviewing, x: 190, y: 56, radius: 40, color: '#3b82f6' },
    { label: 'Resolved', value: resolved, x: 318, y: 96, radius: 45, color: '#10b981' },
  ];

  return (
    <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]" aria-label="Grievance insights">
      <motion.article
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-100 bg-white p-5"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Case movement</h2>
            <p className="mt-1 text-xs text-slate-500">
              Live movement from intake through resolution
            </p>
          </div>
          <span className="rounded-xl bg-blue-50 p-2 text-blue-600">
            <Activity className="h-4 w-4" />
          </span>
        </div>
        <div className="h-48 overflow-hidden rounded-xl bg-slate-50">
          <svg viewBox="0 0 390 190" className="h-full w-full" role="img">
            <title>Grievance workflow distribution</title>
            <motion.path
              d="M70 92 Q130 22 190 56 T318 96"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="2"
              strokeDasharray="6 8"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1 }}
            />
            {nodes.map((node, index) => (
              <g key={node.label}>
                <motion.circle
                  cx={node.x}
                  cy={node.y}
                  r={node.radius}
                  fill={node.color}
                  fillOpacity="0.14"
                  stroke={node.color}
                  strokeWidth="2"
                  initial={{ r: 0, opacity: 0 }}
                  animate={{ r: node.radius, opacity: 1 }}
                  transition={{ type: 'spring', delay: index * 0.12 }}
                />
                <text
                  x={node.x}
                  y={node.y + 5}
                  textAnchor="middle"
                  fill={node.color}
                  className="text-lg font-bold"
                >
                  {isLoading ? '—' : node.value}
                </text>
                <text
                  x={node.x}
                  y={node.y + node.radius + 18}
                  textAnchor="middle"
                  className="fill-slate-600 text-[11px] font-medium"
                >
                  {node.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </motion.article>

      <motion.article
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="rounded-2xl border border-slate-100 bg-white p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Resolution pulse</h2>
            <p className="mt-1 text-xs text-slate-500">Urgency and service-level health</p>
          </div>
          <span className="rounded-xl bg-orange-50 p-2 text-orange-600">
            <TimerReset className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-rose-50 p-4">
            <p className="text-2xl font-bold text-rose-700">{isLoading ? '—' : urgent}</p>
            <p className="mt-1 text-xs font-semibold text-rose-700">High / urgent</p>
            <p className="mt-1 text-[11px] leading-4 text-rose-600">
              Cases needing prioritized handling
            </p>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4">
            <p className="text-2xl font-bold text-amber-700">{isLoading ? '—' : overdue}</p>
            <p className="mt-1 text-xs font-semibold text-amber-700">Overdue here</p>
            <p className="mt-1 text-[11px] leading-4 text-amber-600">
              Loaded cases past resolution SLA
            </p>
          </div>
        </div>
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          Average resolution time{' '}
          <span className="float-right font-bold text-slate-800">
            {stats.avgResolutionDays != null
              ? `${stats.avgResolutionDays.toFixed(1)} days`
              : 'Scope unavailable'}
          </span>
        </div>
      </motion.article>
    </section>
  );
}

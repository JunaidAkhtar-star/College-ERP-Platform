/**
 * @file AiGovernanceInsights.tsx
 * @description Responsive, API-backed SVG analytics for the responsible AI workspace.
 * @module features/ai-governance
 */
'use client';

import { AlertCircle, CalendarClock, CheckCircle2, Layers3, ShieldAlert } from 'lucide-react';
import { useState } from 'react';

interface IAiGovernanceDashboard {
  registered: number;
  approved: number;
  highRisk: number;
  openIncidents: number;
  overdueReviews: number;
  statusDistribution?: Record<string, number>;
  riskDistribution?: Record<string, number>;
  incidentSeverity?: Record<string, number>;
}

interface IDistributionChartProps {
  title: string;
  description: string;
  values: Record<string, number>;
  colors: Record<string, string>;
}

const label = (value: string) => value.replaceAll('_', ' ');
const swatch = (value: string) =>
  value === 'low'
    ? 'bg-emerald-500'
    : value === 'medium'
      ? 'bg-amber-500'
      : value === 'high'
        ? 'bg-rose-500'
        : 'bg-primary';

/** Renders an accessible horizontal distribution chart using truthful API totals. */
function DistributionChart({ title, description, values, colors }: IDistributionChartProps) {
  const [active, setActive] = useState<string | null>(null);
  const entries = Object.entries(values).filter(([, value]) => value > 0);
  const maximum = Math.max(...entries.map(([, value]) => value), 1);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
      {entries.length === 0 ? (
        <div className="mt-5 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          Data will appear when governance records are created.
        </div>
      ) : (
        <svg
          className="mt-5 h-auto w-full"
          viewBox={`0 0 520 ${entries.length * 52 + 10}`}
          role="img"
          aria-label={`${title} distribution`}
        >
          {entries.map(([key, value], index) => {
            const width = Math.max((value / maximum) * 300, 8);
            const faded = active !== null && active !== key;
            return (
              <g
                key={key}
                className="cursor-default transition-opacity duration-200"
                opacity={faded ? 0.3 : 1}
                onMouseEnter={() => setActive(key)}
                onMouseLeave={() => setActive(null)}
              >
                <text x="0" y={index * 52 + 17} className="fill-slate-600 text-[12px] capitalize">
                  {label(key)}
                </text>
                <rect x="150" y={index * 52} width="300" height="24" rx="12" fill="#f1f5f9" />
                <rect
                  x="150"
                  y={index * 52}
                  width={width}
                  height="24"
                  rx="12"
                  fill={colors[key] ?? '#0178d7'}
                  className="transition-all duration-300"
                />
                <text
                  x="470"
                  y={index * 52 + 17}
                  className="fill-slate-800 text-[12px] font-semibold"
                >
                  {value}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </article>
  );
}

/** Renders a compact donut suited to proportional risk exposure. */
function DistributionDonut({ title, description, values, colors }: IDistributionChartProps) {
  const [active, setActive] = useState<string | null>(null);
  const entries = Object.entries(values).filter(([, value]) => value > 0);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  let offset = 0;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
      {total === 0 ? (
        <div className="mt-5 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          Data will appear when governance records are created.
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:justify-around">
          <svg
            viewBox="0 0 180 180"
            className="h-44 w-44"
            role="img"
            aria-label={`${title} donut chart`}
          >
            <circle cx="90" cy="90" r="60" fill="none" stroke="#f1f5f9" strokeWidth="22" />
            {entries.map(([key, value]) => {
              const portion = value / total;
              const dash = portion * 376.99;
              const currentOffset = offset;
              offset += dash;
              return (
                <circle
                  key={key}
                  cx="90"
                  cy="90"
                  r="60"
                  fill="none"
                  stroke={colors[key] ?? '#0178d7'}
                  strokeWidth={active === key ? 26 : 22}
                  strokeDasharray={`${dash} ${376.99 - dash}`}
                  strokeDashoffset={-currentOffset}
                  strokeLinecap="round"
                  transform="rotate(-90 90 90)"
                  opacity={active !== null && active !== key ? 0.25 : 1}
                  className="cursor-default transition-all duration-200"
                  onMouseEnter={() => setActive(key)}
                  onMouseLeave={() => setActive(null)}
                />
              );
            })}
            <text x="90" y="86" textAnchor="middle" className="fill-slate-500 text-[11px]">
              Total
            </text>
            <text x="90" y="108" textAnchor="middle" className="fill-slate-900 text-xl font-bold">
              {total}
            </text>
          </svg>
          <div className="grid min-w-40 gap-2">
            {entries.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-5 text-sm">
                <span className="flex items-center gap-2 capitalize text-slate-600">
                  <span className={`h-2.5 w-2.5 rounded-full ${swatch(key)}`} />
                  {label(key)}
                </span>
                <b className="text-slate-800">{value}</b>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

/** Displays governance KPIs and distributions returned by the dashboard API. */
export default function AiGovernanceInsights({ data }: { data?: IAiGovernanceDashboard }) {
  const metrics = [
    {
      label: 'Registered systems',
      value: data?.registered ?? 0,
      icon: Layers3,
      tone: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Approved for use',
      value: data?.approved ?? 0,
      icon: CheckCircle2,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'High-risk systems',
      value: data?.highRisk ?? 0,
      icon: ShieldAlert,
      tone: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Open incidents',
      value: data?.openIncidents ?? 0,
      icon: AlertCircle,
      tone: 'bg-rose-50 text-rose-700',
    },
    {
      label: 'Overdue reviews',
      value: data?.overdueReviews ?? 0,
      icon: CalendarClock,
      tone: 'bg-violet-50 text-violet-700',
    },
  ];

  return (
    <section className="space-y-4" aria-label="AI governance overview">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(({ label: metricLabel, value, icon: Icon, tone }) => (
          <article key={metricLabel} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">{metricLabel}</p>
          </article>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <DistributionDonut
          title="Lifecycle posture"
          description="Current position of every registered AI use case."
          values={data?.statusDistribution ?? {}}
          colors={{
            draft: '#94a3b8',
            under_review: '#0ea5e9',
            approved: '#10b981',
            suspended: '#f43f5e',
            retired: '#64748b',
          }}
        />
        <DistributionChart
          title="Active risk exposure"
          description="Risk classification across non-retired AI systems."
          values={data?.riskDistribution ?? {}}
          colors={{ low: '#10b981', medium: '#f59e0b', high: '#f43f5e' }}
        />
      </div>
    </section>
  );
}

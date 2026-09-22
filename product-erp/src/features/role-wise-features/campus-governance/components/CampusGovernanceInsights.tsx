/**
 * @file CampusGovernanceInsights.tsx
 * @description API-backed institutional KPIs and responsive SVG comparisons for multi-campus governance.
 * @module features/campus-governance
 */
'use client';

import {
  ArrowRight,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  Circle,
  IndianRupee,
  Network,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { useState } from 'react';

interface ICampusInsightMetric {
  campus: { _id: string; code: string; name: string; status: string };
  departments: number;
  students: number;
  faculty: number;
  finance: { assessed: number; collected: number; outstanding: number };
}
interface ICampusInsightsProps {
  metrics: ICampusInsightMetric[];
  assignments: Array<{ campusId: string | { _id: string }; scopeRole: string }>;
  calendars: Array<{ campusId: string | { _id: string }; status: string }>;
  services: Array<{ status: string }>;
  onSetupAction?: (action: 'bind' | 'assignment' | 'calendar' | 'service') => void;
}

const campusId = (value: string | { _id: string }) =>
  typeof value === 'string' ? value : value._id;
const money = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 1,
  }).format(value);

/** Compares student and faculty populations without inventing historical values. */
function PopulationChart({ metrics }: { metrics: ICampusInsightMetric[] }) {
  const [active, setActive] = useState<string | null>(null);
  const maximum = Math.max(...metrics.map((item) => item.students), 1);
  if (!metrics.length) return <Empty />;
  return (
    <svg
      className="mt-4 h-auto min-w-140 w-full"
      viewBox={`0 0 680 ${metrics.length * 58 + 20}`}
      role="img"
      aria-label="Student and faculty population by campus"
    >
      {metrics.map((item, index) => {
        const faded = active !== null && active !== item.campus._id;
        return (
          <g
            key={item.campus._id}
            opacity={faded ? 0.3 : 1}
            className="transition-opacity duration-200"
            onMouseEnter={() => setActive(item.campus._id)}
            onMouseLeave={() => setActive(null)}
          >
            <text x="0" y={index * 58 + 19} className="fill-slate-600 text-[11px]">
              {item.campus.code}
            </text>
            <rect x="90" y={index * 58} width="430" height="18" rx="9" fill="#f1f5f9" />
            <rect
              x="90"
              y={index * 58}
              width={Math.max((item.students / maximum) * 430, item.students ? 5 : 0)}
              height="18"
              rx="9"
              fill="#0178d7"
            />
            <rect
              x="90"
              y={index * 58 + 24}
              width={Math.max((item.faculty / maximum) * 430, item.faculty ? 5 : 0)}
              height="10"
              rx="5"
              fill="#9bb94f"
            />
            <text x="540" y={index * 58 + 15} className="fill-slate-700 text-[11px]">
              {item.students} students
            </text>
            <text x="540" y={index * 58 + 34} className="fill-slate-500 text-[10px]">
              {item.faculty} faculty
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Empty() {
  return (
    <div className="mt-4 rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">
      Create and bind campus records to populate this analysis.
    </div>
  );
}

/** Shows the institution-wide collected/outstanding composition as a donut. */
function FinanceDonut({ collected, outstanding }: { collected: number; outstanding: number }) {
  const [active, setActive] = useState<'collected' | 'outstanding' | null>(null);
  const total = collected + outstanding;
  if (!total) return <Empty />;
  const collectedShare = collected / total;
  const circumference = 351.86;
  return (
    <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:justify-around">
      <svg
        viewBox="0 0 180 180"
        className="h-44 w-44"
        role="img"
        aria-label={`Fee collection ${(collectedShare * 100).toFixed(0)} percent`}
      >
        <circle
          cx="90"
          cy="90"
          r="56"
          fill="none"
          stroke="#f59e0b"
          strokeWidth={active === 'outstanding' ? 24 : 20}
          opacity={active === 'collected' ? 0.25 : 1}
          className="transition-all duration-200"
          onMouseEnter={() => setActive('outstanding')}
          onMouseLeave={() => setActive(null)}
        />
        <circle
          cx="90"
          cy="90"
          r="56"
          fill="none"
          stroke="#9bb94f"
          strokeWidth={active === 'collected' ? 24 : 20}
          strokeDasharray={`${circumference * collectedShare} ${circumference * (1 - collectedShare)}`}
          strokeLinecap="round"
          transform="rotate(-90 90 90)"
          opacity={active === 'outstanding' ? 0.25 : 1}
          className="transition-all duration-200"
          onMouseEnter={() => setActive('collected')}
          onMouseLeave={() => setActive(null)}
        />
        <text x="90" y="86" textAnchor="middle" className="fill-slate-500 text-[10px]">
          Collection
        </text>
        <text x="90" y="108" textAnchor="middle" className="fill-slate-900 text-xl font-bold">
          {(collectedShare * 100).toFixed(0)}%
        </text>
      </svg>
      <div className="space-y-3 text-sm">
        <div>
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-2.5 w-2.5 rounded-full bg-secondary" />
            Collected
          </p>
          <p className="mt-1 font-semibold text-slate-800">{money(collected)}</p>
        </div>
        <div>
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            Outstanding
          </p>
          <p className="mt-1 font-semibold text-slate-800">{money(outstanding)}</p>
        </div>
      </div>
    </div>
  );
}

/** Uses concentric radial signals for two independent governance readiness measures. */
function ReadinessRings({
  total,
  calendars,
  leaders,
}: {
  total: number;
  calendars: number;
  leaders: number;
}) {
  if (!total) return <Empty />;
  const calendarRate = Math.min(calendars / total, 1);
  const leaderRate = Math.min(leaders / total, 1);
  return (
    <div className="mt-4 flex items-center justify-center gap-5">
      <svg
        viewBox="0 0 190 190"
        className="h-44 w-44"
        role="img"
        aria-label="Campus governance readiness"
      >
        <circle cx="95" cy="95" r="66" fill="none" stroke="#f1f5f9" strokeWidth="12" />
        <circle
          cx="95"
          cy="95"
          r="66"
          fill="none"
          stroke="#0178d7"
          strokeWidth="12"
          strokeDasharray={`${414.69 * calendarRate} ${414.69 * (1 - calendarRate)}`}
          strokeLinecap="round"
          transform="rotate(-90 95 95)"
        />
        <circle cx="95" cy="95" r="45" fill="none" stroke="#f1f5f9" strokeWidth="12" />
        <circle
          cx="95"
          cy="95"
          r="45"
          fill="none"
          stroke="#9bb94f"
          strokeWidth="12"
          strokeDasharray={`${282.74 * leaderRate} ${282.74 * (1 - leaderRate)}`}
          strokeLinecap="round"
          transform="rotate(-90 95 95)"
        />
        <text x="95" y="91" textAnchor="middle" className="fill-slate-500 text-[9px]">
          Ready
        </text>
        <text x="95" y="109" textAnchor="middle" className="fill-slate-900 text-lg font-bold">
          {Math.round(((calendarRate + leaderRate) / 2) * 100)}%
        </text>
      </svg>
      <div className="space-y-3 text-xs text-slate-600">
        <p>
          <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-primary" />
          Published calendars{' '}
          <b className="ml-1">
            {calendars}/{total}
          </b>
        </p>
        <p>
          <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-secondary" />
          Leadership assigned{' '}
          <b className="ml-1">
            {leaders}/{total}
          </b>
        </p>
      </div>
    </div>
  );
}

/** Dense campus-level signals for operational follow-up. */
function CampusSnapshot({ metrics }: { metrics: ICampusInsightMetric[] }) {
  if (!metrics.length) return <Empty />;
  return (
    <div className="mt-4 divide-y divide-slate-100">
      {metrics.map((item) => {
        const collection =
          item.finance.assessed > 0 ? (item.finance.collected / item.finance.assessed) * 100 : 0;
        const ratio = item.faculty > 0 ? Math.round(item.students / item.faculty) : 0;
        return (
          <div
            key={item.campus._id}
            className="grid grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(72px,0.7fr))] items-center gap-3 py-3 text-xs"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-800">{item.campus.name}</p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                {item.campus.code} · {item.departments} departments
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-700">{ratio ? `${ratio}:1` : '—'}</p>
              <p className="text-[10px] text-slate-400">Student–faculty</p>
            </div>
            <div>
              <p className="font-semibold text-slate-700">{collection.toFixed(0)}%</p>
              <p className="text-[10px] text-slate-400">Fee collected</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-amber-700">{money(item.finance.outstanding)}</p>
              <p className="text-[10px] text-slate-400">Outstanding</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Replaces meaningless zero-value charts with an actionable onboarding state. */
function SetupExperience({
  metrics,
  assignments,
  calendars,
  services,
  onAction,
}: ICampusInsightsProps & { onAction?: ICampusInsightsProps['onSetupAction'] }) {
  const departments = metrics.reduce((sum, item) => sum + item.departments, 0);
  const steps = [
    {
      label: 'Campus location created',
      detail: 'Institutional identity and hierarchy are available.',
      done: metrics.length > 0,
      action: undefined,
    },
    {
      label: 'Bind an academic department',
      detail: 'Connect students, faculty and reporting to a campus.',
      done: departments > 0,
      action: 'bind' as const,
    },
    {
      label: 'Assign campus leadership',
      detail: 'Delegate accountable local authority.',
      done: assignments.some((item) => item.scopeRole === 'leader'),
      action: 'assignment' as const,
    },
    {
      label: 'Publish the academic calendar',
      detail: 'Make approved campus dates operational.',
      done: calendars.some((item) => item.status === 'published'),
      action: 'calendar' as const,
    },
    {
      label: 'Configure a shared service',
      detail: 'Record cross-campus facilities when applicable.',
      done: services.some((item) => item.status === 'active'),
      action: 'service' as const,
    },
  ];
  const completed = steps.filter((step) => step.done).length;
  const progress = (completed / steps.length) * 100;
  const primary = metrics[0]?.campus;
  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Workspace readiness
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Complete campus setup</h2>
            <p className="mt-1 text-xs text-slate-500">
              Finish these governance controls before comparative analytics become meaningful.
            </p>
          </div>
          <div className="rounded-xl bg-primary-50 px-3 py-2 text-right">
            <p className="text-lg font-bold text-primary">
              {completed}/{steps.length}
            </p>
            <p className="text-[10px] text-primary/70">steps complete</p>
          </div>
        </div>
        <svg
          viewBox="0 0 500 10"
          className="mt-5 h-2.5 w-full"
          role="img"
          aria-label={`Campus setup ${progress.toFixed(0)} percent complete`}
        >
          <rect width="500" height="10" rx="5" fill="#e2e8f0" />
          <rect width={progress * 5} height="10" rx="5" fill="#0178d7" />
        </svg>
        <div className="mt-4 divide-y divide-slate-100">
          {steps.map((step) => (
            <div key={step.label} className="flex items-center gap-3 py-3">
              <span className={step.done ? 'text-secondary' : 'text-slate-300'}>
                {step.done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">{step.label}</p>
                <p className="text-[11px] text-slate-500">{step.detail}</p>
              </div>
              {!step.done && step.action && onAction && (
                <button
                  type="button"
                  onClick={() => onAction(step.action!)}
                  className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary-50"
                >
                  Set up <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </article>
      <div className="grid gap-4 sm:grid-cols-2 xl:col-span-5 xl:grid-cols-1">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Primary campus
              </p>
              <h3 className="text-sm font-semibold text-slate-900">
                {primary?.name ?? 'No campus created'}
              </h3>
            </div>
          </div>
          {primary && (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-slate-400">Campus code</dt>
                <dd className="mt-1 font-semibold text-slate-700">{primary.code}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-slate-400">Status</dt>
                <dd className="mt-1 font-semibold capitalize text-slate-700">{primary.status}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-slate-400">Departments</dt>
                <dd className="mt-1 font-semibold text-slate-700">{departments}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-slate-400">Leadership</dt>
                <dd className="mt-1 font-semibold text-slate-700">
                  {steps[2].done ? 'Assigned' : 'Required'}
                </dd>
              </div>
            </dl>
          )}
        </article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="text-sm font-semibold text-amber-900">Why charts are hidden</h3>
          <p className="mt-2 text-xs leading-5 text-amber-800">
            Population and financial comparisons appear automatically after departments are bound
            and operational records exist. Until then, setup progress is more useful than empty
            graphs.
          </p>
        </article>
      </div>
    </div>
  );
}

export default function CampusGovernanceInsights({
  metrics,
  assignments,
  calendars,
  services,
  onSetupAction,
}: ICampusInsightsProps) {
  const totals = metrics.reduce(
    (sum, item) => ({
      departments: sum.departments + item.departments,
      students: sum.students + item.students,
      faculty: sum.faculty + item.faculty,
      assessed: sum.assessed + item.finance.assessed,
      collected: sum.collected + item.finance.collected,
      outstanding: sum.outstanding + item.finance.outstanding,
    }),
    { departments: 0, students: 0, faculty: 0, assessed: 0, collected: 0, outstanding: 0 },
  );
  const publishedCampuses = new Set(
    calendars.filter((item) => item.status === 'published').map((item) => campusId(item.campusId)),
  ).size;
  const ledCampuses = new Set(
    assignments
      .filter((item) => item.scopeRole === 'leader')
      .map((item) => campusId(item.campusId)),
  ).size;
  const cards = [
    {
      label: 'Campus locations',
      value: metrics.length,
      detail: `${totals.departments} departments`,
      icon: Building2,
      tone: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Learner population',
      value: totals.students.toLocaleString('en-IN'),
      detail: `${totals.faculty.toLocaleString('en-IN')} faculty`,
      icon: UsersRound,
      tone: 'bg-violet-50 text-violet-700',
    },
    {
      label: 'Collected fees',
      value: money(totals.collected),
      detail: `${money(totals.outstanding)} outstanding`,
      icon: IndianRupee,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Calendar readiness',
      value: `${publishedCampuses}/${metrics.length}`,
      detail: 'campuses published',
      icon: CalendarCheck2,
      tone: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Leadership coverage',
      value: `${ledCampuses}/${metrics.length}`,
      detail: 'campuses with leaders',
      icon: ShieldCheck,
      tone: 'bg-cyan-50 text-cyan-700',
    },
    {
      label: 'Shared services',
      value: services.filter((item) => item.status === 'active').length,
      detail: `${services.length} total agreements`,
      icon: Network,
      tone: 'bg-rose-50 text-rose-700',
    },
  ];
  const hasOperationalData =
    totals.departments > 0 || totals.students > 0 || totals.faculty > 0 || totals.assessed > 0;
  return (
    <section className="space-y-4" aria-label="Campus governance overview">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {cards.map(({ label, value, detail, icon: Icon, tone }) => (
          <article
            key={label}
            className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5"
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}
            >
              <Icon className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-slate-900">{value}</p>
              <p className="truncate text-xs font-semibold text-slate-600">{label}</p>
              <p className="truncate text-[10px] text-slate-400">{detail}</p>
            </div>
          </article>
        ))}
      </div>
      {!hasOperationalData ? (
        <SetupExperience
          metrics={metrics}
          assignments={assignments}
          calendars={calendars}
          services={services}
          onAction={onSetupAction}
        />
      ) : (
        <>
          <div className="grid items-stretch gap-4 xl:grid-cols-12">
            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-7">
              <h2 className="text-base font-semibold text-slate-800">
                Campus population distribution
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Students and faculty derived from departments bound to each campus.
              </p>
              <div className="overflow-x-auto">
                <PopulationChart metrics={metrics} />
              </div>
            </article>
            <div className="grid gap-4 sm:grid-cols-2 xl:col-span-5 xl:grid-cols-1">
              <article className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">Fee position</h2>
                    <p className="mt-1 text-[11px] text-slate-500">Collected versus outstanding.</p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                    {money(totals.assessed)} assessed
                  </span>
                </div>
                <FinanceDonut collected={totals.collected} outstanding={totals.outstanding} />
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-slate-800">Governance readiness</h2>
                <p className="mt-1 text-[11px] text-slate-500">Calendar and leadership controls.</p>
                <ReadinessRings
                  total={metrics.length}
                  calendars={publishedCampuses}
                  leaders={ledCampuses}
                />
              </article>
            </div>
          </div>
          <article className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-800">
                  Campus operations snapshot
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Ratios and financial signals requiring campus-level follow-up.
                </p>
              </div>
              <p className="text-[11px] text-slate-400">Live from bound academic and fee records</p>
            </div>
            <div className="min-w-155">
              <CampusSnapshot metrics={metrics} />
            </div>
          </article>
        </>
      )}
    </section>
  );
}

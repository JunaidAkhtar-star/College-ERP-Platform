'use client';

import { Clock3, Database, RadioTower, Settings2, UsersRound, Video } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from '@/shared/utils/motion';
import useSwr from '@/shared/hooks/useSwr';
import { useHasRole } from '@/shared/hooks/useHasRole';

interface IUsage {
  plan: string;
  usedMinutes: number;
  meetings: number;
  peakParticipants: number;
  recordingBytes: number;
  activeMeetings?: number;
  periodStart?: string;
  periodEnd?: string;
  limits: {
    maxParticipants: number;
    monthlyMinutes: number;
    concurrentMeetings: number;
    recordingStorageMb: number;
    retentionDays: number;
  };
}

const percentOf = (value: number, limit: number) =>
  limit > 0 ? Math.min(100, Math.round((value / limit) * 100)) : 0;
const isUnlimited = (limit: number) => !Number.isFinite(limit) || limit >= 1_000_000_000;
const formatLimit = (limit: number, unit: string) =>
  isUnlimited(limit) ? `Unlimited ${unit}` : `${limit.toLocaleString()} ${unit}`;
const formatStorage = (megabytes: number) => {
  if (isUnlimited(megabytes)) return 'Unlimited storage';
  if (megabytes >= 1024) {
    return `${(megabytes / 1024).toLocaleString('en-IN', { maximumFractionDigits: 2 })} GB`;
  }
  if (megabytes > 0 && megabytes < 1) return `${Math.ceil(megabytes * 1024)} KB`;
  return `${megabytes.toLocaleString()} MB`;
};

function UsageRing({
  percent,
  color,
  unlimited = false,
}: {
  percent: number;
  color: string;
  unlimited?: boolean;
}) {
  return (
    <svg viewBox="0 0 42 42" className="h-24 w-24" role="img" aria-label={`${percent}% used`}>
      <circle cx="21" cy="21" r="16" fill="none" stroke="#e2e8f0" strokeWidth="4" />
      <motion.circle
        cx="21"
        cy="21"
        r="16"
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray={`${percent} 100`}
        initial={{ strokeDashoffset: 100 }}
        animate={{ strokeDashoffset: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        transform="rotate(-90 21 21)"
      />
      <text x="21" y="20" textAnchor="middle" className="fill-slate-900 text-[7px] font-bold">
        {unlimited ? '∞' : `${percent}%`}
      </text>
      <text x="21" y="27" textAnchor="middle" className="fill-slate-400 text-[4px]">
        {unlimited ? 'UNLIMITED' : 'USED'}
      </text>
    </svg>
  );
}

function UsageBar({ percent, color }: { percent: number; color: string }) {
  return (
    <svg viewBox="0 0 100 7" className="h-3 w-full" aria-hidden="true">
      <rect x="0" y="1" width="100" height="5" rx="2.5" fill="#e2e8f0" />
      <motion.rect
        x="0"
        y="1"
        height="5"
        rx="2.5"
        fill={color}
        initial={{ width: 0 }}
        animate={{ width: percent }}
        transition={{ duration: 0.75, ease: 'easeOut' }}
      />
    </svg>
  );
}

export default function MeetingUsageDashboard() {
  const canManageSubscription = useHasRole('super_admin');
  const params = useParams<{ tenant: string; role: string }>();
  const { data: response, isLoading } = useSwr<{ data?: IUsage }>('meeting/usage/summary');
  const usage = response?.data;
  if (isLoading || !usage) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white"
          />
        ))}
      </div>
    );
  }

  const storageMb = Math.ceil(usage.recordingBytes / 1_048_576);
  const activeMeetings = Number(usage.activeMeetings ?? 0);
  const hasUnlimitedMinutes = isUnlimited(usage.limits.monthlyMinutes);
  const minutePercent = hasUnlimitedMinutes
    ? 0
    : percentOf(usage.usedMinutes, usage.limits.monthlyMinutes);
  const remainingMinutes = hasUnlimitedMinutes
    ? null
    : Math.max(0, usage.limits.monthlyMinutes - usage.usedMinutes);
  const metrics = [
    {
      label: 'Peak participation',
      value: `${usage.peakParticipants.toLocaleString()} people`,
      detail: formatLimit(usage.limits.maxParticipants, 'participants'),
      percent: isUnlimited(usage.limits.maxParticipants)
        ? null
        : percentOf(usage.peakParticipants, usage.limits.maxParticipants),
      color: '#8b5cf6',
      icon: UsersRound,
    },
    {
      label: 'Active meeting rooms',
      value: `${activeMeetings.toLocaleString()} active`,
      detail: formatLimit(usage.limits.concurrentMeetings, 'concurrent rooms'),
      percent: isUnlimited(usage.limits.concurrentMeetings)
        ? null
        : percentOf(activeMeetings, usage.limits.concurrentMeetings),
      color: '#14b8a6',
      icon: RadioTower,
    },
    {
      label: 'Recording storage',
      value: formatStorage(storageMb),
      detail: `${formatStorage(usage.limits.recordingStorageMb)} recording-storage limit`,
      percent: isUnlimited(usage.limits.recordingStorageMb)
        ? null
        : percentOf(storageMb, usage.limits.recordingStorageMb),
      color: '#f59e0b',
      icon: Database,
    },
    {
      label: 'Meetings this period',
      value: usage.meetings.toLocaleString(),
      detail: hasUnlimitedMinutes ? 'Unlimited minute allowance' : `${minutePercent}% of allowance`,
      percent: hasUnlimitedMinutes ? null : minutePercent,
      color: '#ec4899',
      icon: Video,
    },
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-blue-100 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
              Current plan
            </p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">{usage.plan} meeting capacity</h3>
            <p className="mt-1 text-xs text-slate-500">
              {usage.meetings.toLocaleString()} meetings this period · {usage.limits.retentionDays}
              -day recording retention
            </p>
          </div>
          {canManageSubscription && (
            <Link
              href={`/${params.tenant}/${params.role}/settings?tab=subscription`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-blue-100"
            >
              <Settings2 className="h-4 w-4" /> Manage capacity
            </Link>
          )}
        </div>
        <div className="mt-5 grid items-center gap-5 sm:grid-cols-[auto_1fr]">
          <UsageRing percent={minutePercent} color="#2563eb" unlimited={hasUnlimitedMinutes} />
          <div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500">Monthly meeting time</p>
                <p className="mt-1 text-2xl font-black text-slate-900">
                  {usage.usedMinutes.toLocaleString()}{' '}
                  <span className="text-sm font-semibold text-slate-500">min</span>
                </p>
              </div>
              <p className="text-right text-xs text-slate-500">
                {remainingMinutes === null
                  ? 'Unlimited minutes available'
                  : `${remainingMinutes.toLocaleString()} min remaining`}
                <span className="mt-1 block">{(usage.usedMinutes / 60).toFixed(1)} hours used</span>
              </p>
            </div>
            <UsageBar percent={minutePercent} color="#2563eb" />
            <p className="mt-2 text-[10px] text-slate-400">
              {hasUnlimitedMinutes
                ? 'No monthly meeting-minute limit on this plan'
                : `Limit: ${usage.limits.monthlyMinutes.toLocaleString()} minutes per month`}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {metrics.map((metric, index) => (
          <motion.article
            key={metric.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500">{metric.label}</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{metric.value}</p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-primary">
                <metric.icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-4">
              {metric.percent === null ? (
                <div className="rounded-full bg-blue-50 px-3 py-1.5 text-center text-[10px] font-bold text-primary">
                  Unlimited capacity
                </div>
              ) : (
                <UsageBar percent={metric.percent} color={metric.color} />
              )}
              <div className="mt-2 flex justify-between gap-2 text-[10px] text-slate-400">
                <span>{metric.detail}</span>
                <b className="text-slate-600">
                  {metric.percent === null ? 'Unlimited' : `${metric.percent}%`}
                </b>
              </div>
            </div>
          </motion.article>
        ))}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-bold text-slate-900">Reporting details</h4>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Period</p>
            <p className="mt-1 text-xs font-semibold text-slate-700">
              {usage.periodStart && usage.periodEnd
                ? `${new Date(usage.periodStart).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – ${new Date(usage.periodEnd).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                : 'Current billing month'}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Retention</p>
            <p className="mt-1 text-xs font-semibold text-slate-700">
              {usage.limits.retentionDays} days
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Units</p>
            <p className="mt-1 text-xs font-semibold text-slate-700">
              Minutes and adaptive storage units
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

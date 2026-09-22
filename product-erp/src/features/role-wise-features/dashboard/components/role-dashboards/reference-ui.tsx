/**
 * @file reference-ui.tsx
 * @description Compact visual primitives shared by the supplied role-dashboard references.
 * @module features/dashboard/role-dashboards
 */
'use client';

import React from 'react';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

export type TReferenceTone = 'violet' | 'blue' | 'green' | 'amber' | 'rose' | 'cyan';

const TONES: Record<TReferenceTone, { tile: string; text: string; tint: string }> = {
  violet: { tile: 'bg-violet-100', text: 'text-violet-600', tint: 'bg-violet-50/45' },
  blue: { tile: 'bg-blue-100', text: 'text-blue-600', tint: 'bg-blue-50/45' },
  green: { tile: 'bg-emerald-100', text: 'text-emerald-600', tint: 'bg-emerald-50/45' },
  amber: { tile: 'bg-amber-100', text: 'text-amber-600', tint: 'bg-amber-50/45' },
  rose: { tile: 'bg-rose-100', text: 'text-rose-600', tint: 'bg-rose-50/45' },
  cyan: { tile: 'bg-cyan-100', text: 'text-cyan-600', tint: 'bg-cyan-50/45' },
};

interface IReferenceHeadingProps {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}

/** Dashboard-local heading shown below the existing application header. */
export function ReferenceHeading({ title, subtitle, action }: IReferenceHeadingProps) {
  return (
    <header className="flex min-h-12 items-start justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-bold leading-7 tracking-[-0.025em] text-[#111947]">
          {title}
        </h1>
        <p className="mt-0.5 text-[12px] font-medium text-[#69708f]">{subtitle}</p>
      </div>
      {action}
    </header>
  );
}

interface IReferenceStatProps {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  trend?: React.ReactNode;
  icon: React.ReactNode;
  tone: TReferenceTone;
}

/** Compact top statistic card matching the proportions of the references. */
export function ReferenceStat({ label, value, detail, trend, icon, tone }: IReferenceStatProps) {
  const colors = TONES[tone];
  return (
    <article
      className={`min-h-[116px] rounded-[10px] border border-[#e7e9f3] px-4 py-3.5 ${colors.tint}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] ${colors.tile} ${colors.text}`}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="truncate text-[10px] font-semibold text-[#4f5679]">{label}</p>
          <p className="mt-1 truncate text-[20px] font-bold leading-6 tracking-[-0.02em] text-[#111947]">
            {value}
          </p>
          {detail && <p className="mt-1 truncate text-[10px] text-[#747b99]">{detail}</p>}
          {trend && <p className="mt-1 text-[10px] font-semibold text-emerald-600">{trend}</p>}
        </div>
      </div>
    </article>
  );
}

interface IReferencePanelProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Dense bordered panel used for charts, lists, tables, and quick actions. */
export function ReferencePanel({
  title,
  children,
  className = '',
  actionLabel,
  onAction,
}: IReferencePanelProps) {
  return (
    <section className={`rounded-[10px] border border-[#e7e9f3] bg-white ${className}`}>
      <div className="flex h-11 items-center justify-between border-b border-[#edf0f6] px-4">
        <h2 className="text-[13px] font-bold text-[#161d4d]">{title}</h2>
        {actionLabel && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#4d46e5]"
          >
            {actionLabel} <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Consistent empty state for legitimately empty dynamic collections. */
interface IReferenceEmptyProps {
  label: string;
  reason?: string;
  illustrationSrc?: string;
}

export function ReferenceEmpty({ label, reason, illustrationSrc }: IReferenceEmptyProps) {
  return (
    <div className="flex min-h-24 flex-col items-center justify-center rounded-xl bg-[#f8f9fd] px-4 py-5 text-center">
      {illustrationSrc && (
        <div className="relative mb-3 h-24 w-32 sm:h-28 sm:w-40">
          <Image src={illustrationSrc} alt="" fill sizes="160px" className="object-contain" />
        </div>
      )}
      <p className="text-[12px] font-semibold text-slate-700">{label}</p>
      {reason && <p className="mt-1 max-w-sm text-[10px] leading-4 text-slate-500">{reason}</p>}
    </div>
  );
}

/** Shared formatter used by reference dashboards without manufacturing values. */
export function referenceNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return '—';
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('en-IN') : '—';
}

/** Compact Indian currency formatter used by reference dashboards. */
export function referenceCurrency(value: unknown) {
  if (value === undefined || value === null || value === '') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  if (number >= 1_00_00_000) return `₹ ${(number / 1_00_00_000).toFixed(2)} Cr`;
  if (number >= 1_00_000) return `₹ ${(number / 1_00_000).toFixed(2)} L`;
  return `₹ ${number.toLocaleString('en-IN')}`;
}

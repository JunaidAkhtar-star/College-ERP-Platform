import React from 'react';

interface IWorkspaceSkeletonProps {
  compact?: boolean;
  label?: string;
}

const block = 'animate-pulse rounded-xl border border-slate-200 bg-slate-100';

export default function WorkspaceSkeleton({
  compact = false,
  label = 'Loading workspace',
}: IWorkspaceSkeletonProps) {
  return (
    <div className="w-full space-y-5" role="status" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}…</span>
      <div className="space-y-3">
        <div className={`${block} h-8 w-52 max-w-2/3`} />
        <div className={`${block} h-4 w-80 max-w-full`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: compact ? 2 : 4 }, (_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className={`${block} h-4 w-24`} />
            <div className={`${block} mt-5 h-8 w-20`} />
            <div className={`${block} mt-4 h-3 w-full`} />
          </div>
        ))}
      </div>
      {!compact && (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className={`${block} h-5 w-40`} />
            <div className={`${block} mt-5 h-52 w-full`} />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className={`${block} h-5 w-36`} />
            <div className="mt-5 space-y-3">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className={`${block} h-12 w-full`} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

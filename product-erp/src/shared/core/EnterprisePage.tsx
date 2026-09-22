import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function EnterprisePage({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6 pb-8">
      <header className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white px-5 py-6 sm:px-7">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-64 bg-gradient-to-l from-primary-50/70 to-transparent" />
        <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-3xl">
            {eyebrow && (
              <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.17em] text-primary">
                {Icon && (
                  <span className="flex size-7 items-center justify-center rounded-lg bg-primary-50">
                    <Icon className="size-4" />
                  </span>
                )}
                {eyebrow}
              </p>
            )}
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </div>
          {actions && <div className="relative flex flex-wrap gap-2">{actions}</div>}
        </div>
      </header>
      {children}
    </div>
  );
}

export function InsightCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = 'blue',
}: {
  label: string;
  value: ReactNode;
  helper?: string;
  icon: LucideIcon;
  tone?: 'blue' | 'emerald' | 'amber' | 'violet' | 'rose';
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    violet: 'bg-violet-50 text-violet-700 ring-violet-100',
    rose: 'bg-rose-50 text-rose-700 ring-rose-100',
  };
  return (
    <article className="group rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-primary/40 hover:bg-blue-50/20">
      <div className={`flex size-10 items-center justify-center rounded-xl ring-1 ${tones[tone]}`}>
        <Icon className="size-5" />
      </div>
      <p className="mt-4 text-2xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      {helper && <p className="mt-2 text-xs leading-5 text-slate-600">{helper}</p>}
    </article>
  );
}

export function GuidancePanel({
  title,
  description,
  icon: Icon,
  action,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-blue-50/65 p-5 sm:flex-row sm:items-center">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-white text-primary">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
      </div>
      {action}
    </section>
  );
}

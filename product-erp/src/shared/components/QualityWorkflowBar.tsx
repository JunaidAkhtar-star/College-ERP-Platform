'use client';

import { Award } from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useWorkflowNavigation } from '@/shared/hooks/useWorkflowNavigation';

const steps = [
  { label: 'Readiness & Exports', route: 'accreditation' },
  { label: 'NAAC / NBA Evidence', route: 'naac-nba' },
  { label: 'IQAC Improvement', route: 'iqac' },
];

export default function QualityWorkflowBar() {
  const params = useParams<{ tenant: string; role: string }>();
  const pathname = usePathname();
  const roleIdx = pathname.indexOf(`/${params.role}`);
  const base =
    roleIdx !== -1
      ? pathname.slice(0, roleIdx + params.role.length + 1)
      : `/${params.tenant}/${params.role}`;
  const visible = useWorkflowNavigation(steps);

  return (
    <nav aria-label="Accreditation quality workflow" className="rounded-2xl bg-white p-2">
      <div className="flex items-center gap-2 px-2 pb-2 pt-1">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-primary">
          <Award className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-semibold text-slate-800">Evidence to improvement</p>
          <p className="text-[10px] text-slate-600">
            Collect, verify, report, audit and close quality gaps
          </p>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {visible.map((step, index) => {
          const active = pathname.includes(`/${step.route}`);
          return (
            <Link
              key={step.route}
              href={`${base}/${step.route}`}
              aria-current={active ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium ${
                active
                  ? 'bg-primary text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-primary-50 hover:text-primary'
              }`}
            >
              <span className={active ? 'text-white/70' : 'text-slate-600'}>{index + 1}</span>
              {step.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

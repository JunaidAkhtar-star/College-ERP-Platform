'use client';

import { HeartHandshake } from 'lucide-react';
import { useParams, usePathname } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import { useWorkflowNavigation } from '@/shared/hooks/useWorkflowNavigation';

const steps = [
  { label: 'Grievances', route: 'grievance' },
  { label: 'Counselling', route: 'counseling' },
  { label: 'Discipline', route: 'discipline' },
  { label: 'Gate & Visitors', route: 'gate-pass' },
];

export default function StudentSupportWorkflowBar() {
  const params = useParams<{ tenant: string; role: string }>();
  const pathname = usePathname();
  const roleIdx = pathname.indexOf(`/${params.role}`);
  const base =
    roleIdx !== -1
      ? pathname.slice(0, roleIdx + params.role.length + 1)
      : `/${params.tenant}/${params.role}`;
  const router = useRouter();
  const visible = useWorkflowNavigation(steps);
  return (
    <nav aria-label="Student services and welfare journey" className="rounded-2xl bg-white p-4">
      <div className="flex items-center gap-2 px-2 pb-2 pt-1">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-primary">
          <HeartHandshake className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-semibold text-slate-800">Request to resolution</p>
          <p className="text-[10px] text-slate-600">
            Raise safely, review fairly, act, follow up and close
          </p>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto px-2">
        {visible.map((step, index) => {
          const active = pathname.includes(`/${step.route}`);
          return (
            <div
              key={step.route}
              aria-current={active ? 'page' : undefined}
              onClick={() => router.push(`${base}/${step.route}`)}
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium ${
                active
                  ? 'bg-primary text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-primary-50 hover:text-primary'
              }`}
            >
              <span className={active ? 'text-white/70' : 'text-slate-600'}>{index + 1}</span>
              {step.label}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

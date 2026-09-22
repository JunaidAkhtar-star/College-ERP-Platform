'use client';

import { useWorkflowNavigation } from '@/shared/hooks/useWorkflowNavigation';
import type { TSystemRole } from '@/shared/types';
import { WalletCards } from 'lucide-react';
import { useParams, usePathname } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';

const financeRoles: TSystemRole[] = [
  'super_admin',
  'principal',
  'accounts_department',
  'administration_office',
];

const items: Array<{ label: string; route: string; roles: TSystemRole[] }> = [
  {
    label: 'Fees & Invoices',
    route: 'fee',
    roles: [...financeRoles, 'student'],
  },
  {
    label: 'Payment Verification',
    route: 'accounts',
    roles: financeRoles,
  },
  {
    label: 'Scholarships',
    route: 'scholarship',
    roles: [...financeRoles, 'scholarship_cell', 'student'],
  },
  {
    label: 'Financial Aid',
    route: 'financial-aid',
    roles: [...financeRoles, 'scholarship_cell', 'student'],
  },
  {
    label: 'Payment Setup',
    route: 'payment-settings',
    roles: ['super_admin', 'principal', 'accounts_department'],
  },
];

export default function FinanceWorkflowBar() {
  const params = useParams<{ tenant: string; role: string }>();
  const pathname = usePathname();
  const visible = useWorkflowNavigation(items);
  const roleIdx = pathname.indexOf(`/${params.role}`);
  const base =
    roleIdx !== -1
      ? pathname.slice(0, roleIdx + params.role.length + 1)
      : `/${params.tenant}/${params.role}`;
  const router = useRouter();
  return (
    <nav aria-label="Fees and finance workspace" className="rounded-2xl bg-white p-4">
      <div className="flex items-center gap-2 px-2 pb-2 pt-1">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-primary">
          <WalletCards className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-semibold text-slate-800">Student demand to reconciliation</p>
          <p className="text-[10px] text-slate-600">
            Configure fees, collect and verify payments, award aid, then reconcile the ledger
          </p>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto px-2">
        {visible.map((item, index) => {
          const active = pathname.includes(`/${item.route}`);
          return (
            <div
              key={item.route}
              onClick={() => router.push(`${base}/${item.route}`)}
              aria-current={active ? 'page' : undefined}
              className={`flex cursor-pointer shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                active
                  ? 'bg-primary text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-primary-50 hover:text-primary'
              }`}
            >
              <span className={active ? 'text-white/70' : 'text-slate-600'}>{index + 1}</span>
              {item.label}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

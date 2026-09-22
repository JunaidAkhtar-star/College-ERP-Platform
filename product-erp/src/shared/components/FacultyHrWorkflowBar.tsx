'use client';

import { useWorkflowNavigation } from '@/shared/hooks/useWorkflowNavigation';
import type { TSystemRole } from '@/shared/types';
import { UsersRound } from 'lucide-react';
import { useParams, usePathname } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';

interface IItem {
  label: string;
  route: string;
  roles: TSystemRole[];
}

const academic: TSystemRole[] = [
  'super_admin',
  'admin',
  'principal',
  'dean_academic',
  'hod',
  'faculty',
];
const hr: TSystemRole[] = ['super_admin', 'admin', 'principal', 'hr_department'];

const items: IItem[] = [
  {
    label: 'Faculty',
    route: 'faculty-management',
    roles: [...academic, 'hr_department', 'administration_office'],
  },
  { label: 'Teaching Assignments', route: 'faculty-workload', roles: academic },
  { label: 'HR', route: 'hr', roles: hr },
  { label: 'Attendance', route: 'faculty-attendance', roles: [...academic, 'hr_department'] },
  {
    label: 'Leave',
    route: 'leave',
    roles: [...hr, 'hod', 'faculty', 'student'],
  },
  {
    label: 'Payroll',
    route: 'payroll',
    roles: [...hr, 'accounts_department'],
  },
];

export default function FacultyHrWorkflowBar() {
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
    <nav aria-label="Faculty and HR workspace" className="rounded-2xl bg-white p-4">
      <div className="flex items-center gap-2 px-2 pb-2 pt-1">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-primary">
          <UsersRound className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-semibold text-slate-800">Faculty & HR workspace</p>
          <p className="text-[10px] text-slate-600">
            Profiles, workload, attendance, leave, and payroll
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

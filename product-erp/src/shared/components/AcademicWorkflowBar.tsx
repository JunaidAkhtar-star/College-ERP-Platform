/**
 * @file AcademicWorkflowBar.tsx
 * @description Role-aware navigation rail shared by every Academic workspace page.
 * @module shared/components
 */
'use client';

import { useWorkflowNavigation } from '@/shared/hooks/useWorkflowNavigation';
import type { TSystemRole } from '@/shared/types';
import { BookOpenCheck, Map } from 'lucide-react';
import { useParams, usePathname } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';

interface IAcademicNavItem {
  label: string;
  route: string;
  roles: TSystemRole[];
}

const setupRoles: TSystemRole[] = ['super_admin', 'admin', 'principal', 'dean_academic', 'hod'];
const teachingRoles: TSystemRole[] = [...setupRoles, 'faculty'];
const learnerRoles: TSystemRole[] = [...teachingRoles, 'student', 'parent'];

const items: IAcademicNavItem[] = [
  { label: 'Programmes', route: 'curriculum', roles: teachingRoles },
  { label: 'Branches', route: 'departments', roles: setupRoles },
  { label: 'Subjects', route: 'subjects', roles: [...teachingRoles, 'student'] },
  {
    label: 'Classes',
    route: 'academic-structure',
    roles: [...setupRoles, 'administration_office'],
  },
  { label: 'Calendar', route: 'academic-calendar', roles: learnerRoles },
  { label: 'Timetable', route: 'timetable', roles: [...teachingRoles, 'student'] },
  { label: 'Lesson Plans', route: 'lesson-plan', roles: teachingRoles },
  { label: 'Course Progress', route: 'course-progress', roles: teachingRoles },
  {
    label: 'Registration',
    route: 'semester-registration',
    roles: [...setupRoles, 'student'],
  },
  {
    label: 'Degree Planner',
    route: 'degree-audit',
    roles: [...teachingRoles, 'examination_cell', 'student'],
  },
  {
    label: 'LMS Integration',
    route: 'lms-integration',
    roles: [...setupRoles, 'faculty', 'examination_cell'],
  },
];

export default function AcademicWorkflowBar() {
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
    <nav aria-label="Academic workspace" className="rounded-2xl bg-white p-4">
      <div className="flex items-center justify-between gap-3 px-2 pb-2 pt-1">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-primary">
            <BookOpenCheck className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-800">Academic workspace</p>
            <p className="text-[10px] text-slate-600">Role-based academic tools</p>
          </div>
        </div>
        {setupRoles.includes(params.role) && (
          <button
            type="button"
            onClick={() => router.push(`${base}/curriculum#academic-setup-guide`)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
          >
            <Map className="h-3.5 w-3.5" />
            Setup Guide
          </button>
        )}
      </div>
      <div className="flex gap-1 overflow-x-auto px-2">
        {visible.map((item, index) => {
          const active = pathname.endsWith(`/${item.route}`);
          return (
            <div
              key={item.route}
              onClick={() => router.push(`${base}/${item.route}`)}
              aria-current={active ? 'page' : undefined}
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
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

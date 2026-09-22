'use client';

import Image from 'next/image';
import { LayoutDashboard } from 'lucide-react';
import { motion } from '@/shared/utils/motion';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Administrator',
  admin: 'Institution Administrator',
  principal: 'Principal',
  dean_academic: 'Dean Academic',
  administration_office: 'Administration Office',
  assistant_administration_officer: 'Assistant Administration Officer',
  hod: 'Head of Department',
  faculty: 'Faculty',
  student: 'Student',
  parent: 'Parent',
  placement_cell: 'Placement Cell',
  library_staff: 'Library',
  hr_department: 'Human Resources',
  accounts_department: 'Accounts',
  examination_cell: 'Examination Cell',
  iqac_team: 'IQAC',
  iqac_naac: 'Quality & Accreditation',
  scholarship_cell: 'Scholarship Cell',
  admission_counselor: 'Admission Counselor',
  admission_incharge: 'Admission Incharge',
  transportation: 'Transportation',
  hostel_warden: 'Hostel Operations',
  research_development: 'Research & Development',
  club_head: 'Clubs & Engagement',
  iic: 'Innovation Council',
  store: 'Store & Inventory',
};

export default function DashboardRoleHero({ role }: { role: string }) {
  const roleLabel = ROLE_LABELS[role] ?? role.replaceAll('_', ' ');
  const isDeanAcademic = role === 'dean_academic';
  const heroImage = isDeanAcademic
    ? '/dashboard/dean-academics/dean-academic-hero.png'
    : '/dashboard/erp-role-hero.png';

  return (
    <section className="relative mb-5 min-h-[190px] overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-r from-sky-50 via-white to-violet-50 px-5 py-6 sm:min-h-[220px] sm:px-8 sm:py-7 lg:min-h-[250px] lg:pr-[48%]">
      <div className="relative z-10 max-w-xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary ring-1 ring-sky-100">
          <LayoutDashboard className="h-3.5 w-3.5" /> {roleLabel} workspace
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">
          {isDeanAcademic
            ? 'Lead every academic outcome with clarity'
            : 'Welcome to your institution workspace'}
        </h1>
        <p className="mt-2 max-w-lg text-xs leading-5 text-slate-600 sm:text-sm sm:leading-6">
          {isDeanAcademic
            ? 'Monitor curriculum delivery, learning outcomes, attendance, faculty capacity and research performance from one leadership view.'
            : 'Live academic, operational and engagement information for the responsibilities of your active role.'}
        </p>
      </div>
      <motion.div
        className="relative mt-4 h-44 sm:absolute sm:inset-y-0 sm:right-3 sm:mt-0 sm:h-full sm:w-[48%] lg:right-6 lg:w-[44%]"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <Image
          src={heroImage}
          alt={`${roleLabel} education workspace illustration`}
          fill
          priority
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 48vw, 640px"
          className="object-contain object-center drop-shadow-sm"
        />
      </motion.div>
    </section>
  );
}

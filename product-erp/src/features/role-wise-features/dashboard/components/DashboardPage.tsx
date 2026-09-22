/**
 * @file DashboardPage.tsx
 * @description Loads the authenticated role dashboard payload and renders the
 *              dedicated reference-matched dashboard for that role.
 * @module features/dashboard
 */
'use client';

import React from 'react';
import { CircleAlert, RotateCw } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import useSwr from '@/shared/hooks/useSwr';
import { useAuthStore } from '@/shared/store/authStore';
import type { AnyRecord } from './views/shared';
import SuperAdminDashboard from './role-dashboards/SuperAdminDashboard';
import AdminDashboard from './role-dashboards/AdminDashboard';
import PrincipalDashboard from './role-dashboards/PrincipalDashboard';
import DeanAcademicDashboard from './role-dashboards/DeanAcademicDashboard';
import AdministrationOfficeDashboard from './role-dashboards/AdministrationOfficeDashboard';
import AssistantAdministrationOfficerDashboard from './role-dashboards/AssistantAdministrationOfficerDashboard';
import HodDashboard from './role-dashboards/HodDashboard';
import FacultyDashboard from './role-dashboards/FacultyDashboard';
import StudentDashboard from './role-dashboards/StudentDashboard';
import ParentDashboard from './role-dashboards/ParentDashboard';
import ExaminationCellDashboard from './role-dashboards/ExaminationCellDashboard';
import IqacNaacDashboard from './role-dashboards/IqacNaacDashboard';
import IqacTeamDashboard from './role-dashboards/IqacTeamDashboard';
import ScholarshipCellDashboard from './role-dashboards/ScholarshipCellDashboard';
import LibraryStaffDashboard from './role-dashboards/LibraryStaffDashboard';
import HostelWardenDashboard from './role-dashboards/HostelWardenDashboard';
import PlacementCellDashboard from './role-dashboards/PlacementCellDashboard';
import HrDepartmentDashboard from './role-dashboards/HrDepartmentDashboard';
import AccountsDepartmentDashboard from './role-dashboards/AccountsDepartmentDashboard';
import TransportationDashboard from './role-dashboards/TransportationDashboard';
import ResearchDevelopmentDashboard from './role-dashboards/ResearchDevelopmentDashboard';
import ClubHeadDashboard from './role-dashboards/ClubHeadDashboard';
import IicDashboard from './role-dashboards/IicDashboard';
import StoreDashboard from './role-dashboards/StoreDashboard';
import AdmissionInchargeDashboard from './role-dashboards/AdmissionInchargeDashboard';
import AdmissionCounselorDashboard from './role-dashboards/AdmissionCounselorDashboard';
import { CommonStaffView } from './views/SpecialistViews';
import DashboardRoleHero from './DashboardRoleHero';

interface IDashboardResponse {
  data?: AnyRecord;
  role?: string;
}

interface IRoleDashboardProps {
  d: AnyRecord;
}

const ROLE_VIEW_MAP: Record<string, React.ComponentType<IRoleDashboardProps>> = {
  super_admin: SuperAdminDashboard,
  admin: AdminDashboard,
  principal: PrincipalDashboard,
  dean_academic: DeanAcademicDashboard,
  administration_office: AdministrationOfficeDashboard,
  assistant_administration_officer: AssistantAdministrationOfficerDashboard,
  hod: HodDashboard,
  faculty: FacultyDashboard,
  student: StudentDashboard,
  parent: ParentDashboard,
  placement_cell: PlacementCellDashboard,
  library_staff: LibraryStaffDashboard,
  hr_department: HrDepartmentDashboard,
  accounts_department: AccountsDepartmentDashboard,
  examination_cell: ExaminationCellDashboard,
  iqac_team: IqacTeamDashboard,
  iqac_naac: IqacNaacDashboard,
  scholarship_cell: ScholarshipCellDashboard,
  admission_counselor: AdmissionCounselorDashboard,
  admission_incharge: AdmissionInchargeDashboard,
  transportation: TransportationDashboard,
  hostel_warden: HostelWardenDashboard,
  research_development: ResearchDevelopmentDashboard,
  club_head: ClubHeadDashboard,
  iic: IicDashboard,
  store: StoreDashboard,
};

/** Renders a neutral database-backed view for roles without a supplied reference. */
function CommonRoleDashboard({ d }: IRoleDashboardProps) {
  const role = useAuthStore((state) => state.role) ?? 'staff';
  return <CommonStaffView d={d} roleLabel={role.replaceAll('_', ' ')} />;
}

/** Reusable light skeleton surface that mirrors content without presenting fake data. */
function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-100 ${className}`} />;
}

/** Professional responsive loading layout matching the final dashboard hierarchy. */
function DashboardSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-5" aria-label="Loading dashboard" aria-busy="true">
      <div className="relative min-h-56 overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r from-sky-50 via-white to-violet-50 p-5 sm:p-7">
        <div className="max-w-xl space-y-4">
          <SkeletonBlock className="h-7 w-44 bg-white" />
          <SkeletonBlock className="h-8 w-full max-w-md bg-white" />
          <SkeletonBlock className="h-4 w-full max-w-lg bg-white" />
          <SkeletonBlock className="h-4 w-4/5 max-w-md bg-white" />
          <div className="flex flex-wrap gap-2 pt-2">
            {Array.from({ length: 4 }, (_, index) => (
              <SkeletonBlock key={index} className="h-10 w-28 bg-white" />
            ))}
          </div>
        </div>
        <SkeletonBlock className="absolute bottom-4 right-5 hidden h-44 w-[34%] bg-white/80 lg:block" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="min-h-36 rounded-3xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <SkeletonBlock className="h-10 w-10" />
              <SkeletonBlock className="h-5 w-5" />
            </div>
            <SkeletonBlock className="mt-4 h-7 w-24" />
            <SkeletonBlock className="mt-2 h-3 w-20" />
            <SkeletonBlock className="mt-3 h-3 w-28" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 xl:col-span-8">
          <SkeletonBlock className="h-6 w-48" />
          <SkeletonBlock className="mt-2 h-3 w-72 max-w-full" />
          <div className="mt-6 flex h-64 items-end gap-3 rounded-2xl bg-slate-50 p-4">
            {['h-1/3', 'h-1/2', 'h-2/5', 'h-2/3', 'h-3/5', 'h-3/4', 'h-2/3'].map(
              (heightClass, index) => (
                <div
                  key={index}
                  className={`animate-pulse flex-1 rounded-t-xl bg-blue-100 ${heightClass}`}
                />
              ),
            )}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 xl:col-span-4">
          <SkeletonBlock className="h-6 w-52" />
          <SkeletonBlock className="mt-2 h-3 w-40" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }, (_, index) => (
              <SkeletonBlock key={index} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="rounded-3xl border border-slate-200 bg-white p-5">
            <SkeletonBlock className="h-6 w-40" />
            <SkeletonBlock className="mt-2 h-3 w-56 max-w-full" />
            <SkeletonBlock className="mt-6 h-48 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Fetches and renders only the role dashboard content inside the existing ERP shell. */
export default function DashboardPage() {
  const searchParams = useSearchParams();
  const role = useAuthStore((state) => state.role) ?? '';
  const user = useAuthStore((state) => state.user);
  const academicYear = searchParams.get('academicYear');
  const dashboardEndpoint = academicYear
    ? `dashboard?academicYear=${encodeURIComponent(academicYear)}`
    : 'dashboard';
  const {
    data: response,
    isLoading,
    error,
    mutate,
  } = useSwr<IDashboardResponse>(user ? dashboardEndpoint : null);

  if (isLoading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        <CircleAlert className="h-7 w-7" />
        <h1 className="mt-3 text-lg font-semibold">Dashboard could not be loaded</h1>
        <p className="mt-1 text-sm text-rose-600">Check the connection and try again.</p>
        <button
          type="button"
          onClick={() => void mutate()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold"
        >
          <RotateCw className="h-4 w-4" /> Try again
        </button>
      </div>
    );
  }

  // Role switching clears the previous role's SWR cache before navigating.
  // Keep the dashboard boundary mounted with its skeleton until the new,
  // correctly scoped payload arrives instead of rendering a role view with {}.
  if (!response?.data) return <DashboardSkeleton />;

  const activeRole = response?.role ?? role;
  const Dashboard = ROLE_VIEW_MAP[activeRole] ?? CommonRoleDashboard;

  return (
    <div className="role-dashboard w-full">
      {!['admin', 'super_admin', 'principal', 'faculty', 'hod', 'dean_academic'].includes(
        activeRole,
      ) && <DashboardRoleHero role={activeRole} />}
      <Dashboard d={response.data} />
    </div>
  );
}

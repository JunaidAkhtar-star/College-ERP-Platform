/**
 * @file useEntitlements.ts
 * @description Universal hook for Subscription Plan Entitlements + Role RBAC Validation.
 * Provides dynamic validation for tenant subscription modules and role permissions
 * across all ERP portals and views.
 *
 * @module shared/hooks
 */

'use client';

import { useMemo } from 'react';
import { useAuthStore } from '@/shared/store/authStore';
import useNav from './useNav';

export function useEntitlements() {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const { groups: navGroups, isLoading: navLoading } = useNav(Boolean(user));

  const allowedHrefs = useMemo(
    () => navGroups.flatMap((g) => g.items.map((i) => i.href)),
    [navGroups],
  );

  /**
   * Dynamically checks if a module is entitled under the tenant's current subscription plan.
   * Evaluates against the server-verified nav tree (`nav/me`), which combines role permissions
   * and commercial module entitlements.
   */
  const hasModule = useMemo(() => {
    return (moduleKey: string): boolean => {
      if (!user) return false;
      const key = moduleKey.toLowerCase().trim();
      return allowedHrefs.some((h) => {
        const path = h.toLowerCase();
        return path.includes(key) || path === `/${key}`;
      });
    };
  }, [user, allowedHrefs]);

  return {
    user,
    role,
    navGroups,
    navLoading,
    allowedHrefs,
    hasModule,
    hasPermission,

    // Module entitlement shortcuts for subscription gating
    hasCommunication:
      hasModule('communication') || hasModule('notice') || hasModule('notification'),
    hasVirtualClassrooms:
      hasModule('virtual-classrooms') || hasModule('meeting') || hasModule('classroom'),
    hasAdmissions: hasModule('admissions') || hasModule('admission') || hasModule('scholarship'),
    hasAcademics:
      hasModule('academics') || hasModule('student-management') || hasModule('curriculum'),
    hasAttendance: hasModule('attendance'),
    hasExaminations: hasModule('examinations') || hasModule('examination') || hasModule('results'),
    hasFees: hasModule('fees') || hasModule('fee') || hasModule('payment'),
    hasHrPayroll: hasModule('hr-payroll') || hasModule('hr') || hasModule('payroll'),
    hasLibrary: hasModule('library'),
    hasHostel: hasModule('hostel'),
    hasTransport: hasModule('transport'),
    hasPlacements: hasModule('placements') || hasModule('placement') || hasModule('alumni'),
    hasNaacIqac: hasModule('naac-iqac') || hasModule('accreditation') || hasModule('iqac'),
    hasResearch: hasModule('research') || hasModule('iic'),
    hasProcurement: hasModule('procurement') || hasModule('gate-pass') || hasModule('store'),
    hasClubs: hasModule('clubs') || hasModule('club'),
    hasAnalytics: hasModule('analytics') || hasModule('dashboard') || hasModule('report'),
  };
}

export default useEntitlements;

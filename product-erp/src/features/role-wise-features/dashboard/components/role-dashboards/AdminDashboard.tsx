/**
 * @file AdminDashboard.tsx
 * @description Dedicated administrator dashboard sharing the approved super-admin reference.
 * @module features/dashboard/role-dashboards
 */
'use client';

import type { AnyRecord } from '../views/shared';
import InstitutionCommandCenter from '../institution-admin/InstitutionCommandCenter';

/** Administrator entry point for institution-scoped operational data. */
export default function AdminDashboard({ d }: { d: AnyRecord }) {
  return <InstitutionCommandCenter d={d} />;
}

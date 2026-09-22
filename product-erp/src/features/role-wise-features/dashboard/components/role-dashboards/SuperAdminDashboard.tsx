/**
 * @file SuperAdminDashboard.tsx
 * @description Tenant Super Admin entry point for the institution command center.
 * Platform-wide SaaS analytics remain in the separate platform administration product.
 */
'use client';

import type { AnyRecord } from '../views/shared';
import InstitutionCommandCenter from '../institution-admin/InstitutionCommandCenter';

export default function SuperAdminDashboard({ d }: { d: AnyRecord }) {
  return <InstitutionCommandCenter d={d} />;
}

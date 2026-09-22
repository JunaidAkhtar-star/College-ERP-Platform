/**
 * @file HodDashboard.tsx
 * @description Connects the HOD role to the department-scoped operations command centre.
 * @module features/dashboard/role-dashboards
 */
'use client';

import type { AnyRecord } from '../views/shared';
import HodOperationsDashboard from '../views/hod/HodOperationsDashboard';
import type { IHodDashboardData } from '../views/hod/hod-dashboard.types';

/** Renders the authoritative HOD dashboard payload without a legacy visual fallback. */
export default function HodDashboard({ d }: { d: AnyRecord }) {
  return <HodOperationsDashboard data={d as unknown as IHodDashboardData} />;
}

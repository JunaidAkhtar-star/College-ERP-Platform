/**
 * @file FacultyDashboard.tsx
 * @description Connects the faculty role to the full teaching command center.
 * @module features/dashboard/role-dashboards
 */

'use client';

import type { AnyRecord } from '../views/shared';
import { FacultyView } from '../views/AcademicViews';

/** Renders the authenticated faculty member's live teaching workspace. */
export default function FacultyDashboard({ d }: { d: AnyRecord }) {
  return <FacultyView d={d} />;
}

/**
 * @file page.tsx
 * @description Faculty Attendance route — server component wrapper.
 * @module app/[role]/faculty-attendance
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Faculty Attendance',
  description: 'Track faculty attendance and punctuality.',
};

const FacultyAttendancePage = dynamic(
  () => import('@/features/role-wise-features/faculty-attendance/components/FacultyAttendancePage'),
  { loading: () => null },
);

export default function Page() {
  return <FacultyAttendancePage />;
}

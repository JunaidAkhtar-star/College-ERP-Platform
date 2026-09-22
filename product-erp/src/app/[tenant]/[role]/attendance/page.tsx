/**
 * @file page.tsx
 * @description Student Attendance route — server component wrapper.
 * @module app/[role]/attendance
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Student Attendance',
  description: 'Track and manage student attendance records.',
};

const AttendancePage = dynamic(
  () => import('@/features/role-wise-features/attendance/components/AttendancePage'),
  { loading: () => null },
);

export default function Page() {
  return <AttendancePage />;
}

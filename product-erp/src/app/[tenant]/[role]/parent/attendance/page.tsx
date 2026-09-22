/**
 * @file page.tsx
 * @description Parent Portal – Attendance sub-route.
 * @module app/[role]/parent/attendance
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: "Ward's Attendance",
  description: "View your ward's attendance records.",
};

const ParentPage = dynamic(
  () => import('@/features/role-wise-features/parent/components/ParentPage'),
  { loading: () => null },
);

export default function Page() {
  return <ParentPage />;
}

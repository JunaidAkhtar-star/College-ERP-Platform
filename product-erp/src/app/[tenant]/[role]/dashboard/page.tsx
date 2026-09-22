/**
 * @file page.tsx
 * @description Super-admin dashboard route — server component wrapper.
 * @module app/[role]/dashboard
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Overview of institutional metrics, attendance, finance and recent activity.',
};

const DashboardPage = dynamic(
  () => import('@/features/role-wise-features/dashboard/components/DashboardPage'),
  { loading: () => null },
);

export default function Page() {
  return <DashboardPage />;
}

/**
 * @file page.tsx
 * @description Departments route — server component wrapper.
 * @module app/[role]/departments
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Departments',
  description: 'Manage academic and administrative departments.',
};

const DepartmentsPage = dynamic(
  () => import('@/features/role-wise-features/departments/components/DepartmentsPage'),
  { loading: () => null },
);

export default function Page() {
  return <DepartmentsPage />;
}

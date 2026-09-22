/**
 * @file page.tsx
 * @description Role Management route — server component wrapper.
 * @module app/[role]/roles
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Role Management',
  description: 'Manage system roles and permissions.',
};

const RolesPage = dynamic(
  () => import('@/features/role-wise-features/roles/components/RolesPage'),
  { loading: () => null },
);

export default function Page() {
  return <RolesPage />;
}

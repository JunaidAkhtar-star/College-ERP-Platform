/**
 * @file page.tsx
 * @description Navigation Manager route — server component wrapper.
 * @module app/[role]/nav-admin
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Navigation Manager',
  description: 'Manage the sidebar navigation groups, links, ordering, and role-based visibility.',
};

const NavAdminPage = dynamic(
  () => import('@/features/role-wise-features/nav-admin/components/NavAdminPage'),
  { loading: () => null },
);

export default function Page() {
  return <NavAdminPage />;
}

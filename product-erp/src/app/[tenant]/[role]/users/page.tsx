/**
 * @file page.tsx
 * @description User Management route — server component wrapper.
 * @module app/[role]/users
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'User Management',
  description: 'Create, update and manage all system users.',
};

const UsersPage = dynamic(
  () => import('@/features/role-wise-features/users/components/UsersPage'),
  { loading: () => null },
);

export default function Page() {
  return <UsersPage />;
}

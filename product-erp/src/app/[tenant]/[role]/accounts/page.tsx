/**
 * @file page.tsx
 * @description Accounts route — server component wrapper.
 * @module app/[role]/accounts
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Accounts',
  description: 'Institutional accounts and financial records.',
};

const AccountsPage = dynamic(
  () => import('@/features/role-wise-features/accounts/components/AccountsPage'),
  { loading: () => null },
);

export default function Page() {
  return <AccountsPage />;
}

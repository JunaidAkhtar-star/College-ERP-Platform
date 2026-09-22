/**
 * @file page.tsx
 * @description Settings route — server component wrapper.
 * @module app/[role]/settings
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage your account, security, notifications and appearance.',
};

const SettingsPage = dynamic(
  () => import('@/features/role-wise-features/settings/components/SettingsPage'),
  { loading: () => null },
);

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const query = await searchParams;
  return <SettingsPage initialTab={(query.tab as undefined) || 'overview'} />;
}

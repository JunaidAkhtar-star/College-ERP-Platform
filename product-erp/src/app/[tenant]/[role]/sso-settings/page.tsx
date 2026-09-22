'use client';

import dynamic from 'next/dynamic';

const SsoSettingsPage = dynamic(
  () => import('@/features/role-wise-features/sso-settings/components/SsoSettingsPage'),
);

export default function Page() {
  return <SsoSettingsPage />;
}

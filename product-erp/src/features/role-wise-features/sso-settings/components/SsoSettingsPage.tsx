/**
 * @file SsoSettingsPage.tsx
 * @description Compatibility page that keeps the SSO route available while
 *              configuration is consolidated into Settings.
 * @module features/role-wise-features/sso-settings
 */
'use client';

import SettingsPage from '@/features/role-wise-features/settings/components/SettingsPage';

export default function SsoSettingsPage() {
  return <SettingsPage initialTab="integrations" />;
}

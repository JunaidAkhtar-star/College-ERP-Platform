/**
 * @file ExternalConnectorPage.tsx
 * @description Compatibility page that keeps the Connector Center route
 *              available while configuration is consolidated into Settings.
 * @module features/role-wise-features/external-connector
 */
'use client';

import SettingsPage from '@/features/role-wise-features/settings/components/SettingsPage';

export default function ExternalConnectorPage() {
  return <SettingsPage initialTab="integrations" />;
}

/**
 * @file page.tsx
 * @description Payment Settings route — server component wrapper.
 * @module app/[role]/payment-settings
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Payment Settings',
  description: 'Configure institutional payment methods and gateway settings.',
};

const PaymentSettingsPage = dynamic(
  () => import('@/features/role-wise-features/payment-settings/components/PaymentSettingsPage'),
  { loading: () => null },
);

export default function Page() {
  return <PaymentSettingsPage />;
}

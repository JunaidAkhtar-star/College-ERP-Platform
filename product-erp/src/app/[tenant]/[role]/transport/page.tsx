/**
 * @file page.tsx
 * @description Transport route — server component wrapper.
 * @module app/[role]/transport
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Transport',
  description: 'Manage college transport routes and vehicles.',
};

const TransportPage = dynamic(
  () => import('@/features/role-wise-features/transport/components/TransportPage'),
  { loading: () => null },
);

export default function Page() {
  return <TransportPage />;
}

/**
 * @file page.tsx
 * @description Parent Portal – Fee Status sub-route.
 * @module app/[role]/parent/fees
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Fee Status',
  description: "View your ward's fee dues, payment history, and pay online.",
};

const ParentPage = dynamic(
  () => import('@/features/role-wise-features/parent/components/ParentPage'),
  { loading: () => null },
);

export default function Page() {
  return <ParentPage />;
}

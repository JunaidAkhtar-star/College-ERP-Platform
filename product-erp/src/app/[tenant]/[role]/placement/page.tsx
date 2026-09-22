/**
 * @file page.tsx
 * @description Placement route — server component wrapper.
 * @module app/[role]/placement
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Placement',
  description: 'Manage placement drives and company visits.',
};

const PlacementPage = dynamic(
  () => import('@/features/role-wise-features/placement/components/PlacementPage'),
  { loading: () => null },
);

export default function Page() {
  return <PlacementPage />;
}

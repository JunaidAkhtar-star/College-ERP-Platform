/**
 * @file page.tsx
 * @description Store / inventory route.
 * @module app/[role]/store
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Store',
  description: 'Inventory items and departmental requisitions.',
};

const StorePage = dynamic(
  () => import('@/features/role-wise-features/store/components/StorePage'),
  { loading: () => null },
);

export default function Page() {
  return <StorePage />;
}

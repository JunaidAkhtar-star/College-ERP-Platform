/**
 * @file page.tsx
 * @description Fee Management route — server component wrapper.
 * @module app/[role]/fee
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Fee Management',
  description: 'Manage student fee structure and payments.',
};

const FeePage = dynamic(() => import('@/features/role-wise-features/fee/components/FeePage'), {
  loading: () => null,
});

export default function Page() {
  return <FeePage />;
}

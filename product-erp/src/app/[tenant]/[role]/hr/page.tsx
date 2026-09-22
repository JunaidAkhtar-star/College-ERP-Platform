/**
 * @file page.tsx
 * @description HR Management route — server component wrapper.
 * @module app/[role]/hr
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'HR Management',
  description: 'Manage HR operations and staff records.',
};

const HrPage = dynamic(() => import('@/features/role-wise-features/hr/components/HrPage'), {
  loading: () => null,
});

export default function Page() {
  return <HrPage />;
}

/**
 * @file page.tsx
 * @description Leave Management route — server component wrapper.
 * @module app/[role]/leave
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Leave Management',
  description: 'Process and track leave applications.',
};

const LeavePage = dynamic(
  () => import('@/features/role-wise-features/leave/components/LeavePage'),
  { loading: () => null },
);

export default function Page() {
  return <LeavePage />;
}

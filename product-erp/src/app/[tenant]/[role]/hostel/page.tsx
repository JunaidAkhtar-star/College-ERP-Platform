/**
 * @file page.tsx
 * @description Hostel route — server component wrapper.
 * @module app/[role]/hostel
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Hostel',
  description: 'Manage hostel rooms, allotments and fees.',
};

const HostelPage = dynamic(
  () => import('@/features/role-wise-features/hostel/components/HostelPage'),
  { loading: () => null },
);

export default function Page() {
  return <HostelPage />;
}

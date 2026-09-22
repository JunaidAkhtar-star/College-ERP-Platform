/**
 * @file page.tsx
 * @description Clubs & Activities route.
 * @module app/[role]/clubs
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Clubs & Activities',
  description: 'Student clubs, members and activity log.',
};

const ClubsPage = dynamic(
  () => import('@/features/role-wise-features/clubs/components/ClubsPage'),
  { loading: () => null },
);

export default function Page() {
  return <ClubsPage />;
}

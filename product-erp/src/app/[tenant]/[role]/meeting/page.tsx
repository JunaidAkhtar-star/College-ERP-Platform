/**
 * @file page.tsx
 * @description Meetings route — server component wrapper.
 * @module app/[role]/meeting
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Meetings',
  description: 'Schedule and manage faculty meetings.',
};

const MeetingPage = dynamic(
  () => import('@/features/role-wise-features/meeting/components/MeetingPage'),
  { loading: () => null },
);

export default function Page() {
  return <MeetingPage />;
}

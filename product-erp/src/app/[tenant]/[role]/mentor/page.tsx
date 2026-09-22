/**
 * @file page.tsx
 * @description Mentor route — server component wrapper.
 * @module app/[role]/mentor
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Mentor',
  description: 'Faculty mentor-mentee assignments and sessions.',
};

const MentorPage = dynamic(
  () => import('@/features/role-wise-features/mentor/components/MentorPage'),
  { loading: () => null },
);

export default function Page() {
  return <MentorPage />;
}

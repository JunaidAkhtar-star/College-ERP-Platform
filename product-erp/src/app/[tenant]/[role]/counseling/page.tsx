/**
 * @file page.tsx
 * @description Counseling route — server component wrapper.
 * @module app/[role]/counseling
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Counseling',
  description: 'Student counseling sessions and records.',
};

const CounselingPage = dynamic(
  () => import('@/features/role-wise-features/counseling/components/CounselingPage'),
  { loading: () => null },
);

export default function Page() {
  return <CounselingPage />;
}

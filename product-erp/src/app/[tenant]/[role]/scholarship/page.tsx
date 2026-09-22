/**
 * @file page.tsx
 * @description Scholarships route — server component wrapper.
 * @module app/[role]/scholarship
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Scholarships',
  description: 'Manage student scholarship applications.',
};

const ScholarshipPage = dynamic(
  () => import('@/features/role-wise-features/scholarship/components/ScholarshipPage'),
  { loading: () => null },
);

export default function Page() {
  return <ScholarshipPage />;
}

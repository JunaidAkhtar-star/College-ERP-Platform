/**
 * @file page.tsx
 * @description Curriculum route — server component wrapper.
 * @module app/[role]/curriculum
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Curriculum',
  description: 'Define and manage academic curriculum.',
};

const CurriculumPage = dynamic(
  () => import('@/features/role-wise-features/curriculum/components/CurriculumPage'),
  { loading: () => null },
);

export default function Page() {
  return <CurriculumPage />;
}

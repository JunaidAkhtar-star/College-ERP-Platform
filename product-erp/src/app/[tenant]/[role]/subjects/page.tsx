/**
 * @file page.tsx
 * @description Subjects route — server component wrapper.
 * @module app/[role]/subjects
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Subjects',
  description: 'Manage subjects and course catalogue.',
};

const SubjectsPage = dynamic(
  () => import('@/features/role-wise-features/subjects/components/SubjectsPage'),
  { loading: () => null },
);

export default function Page() {
  return <SubjectsPage />;
}

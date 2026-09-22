/**
 * @file page.tsx
 * @description Examinations route — server component wrapper.
 * @module app/[role]/examination
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Examinations',
  description: 'Manage exams, schedules and results.',
};

const ExaminationPage = dynamic(
  () => import('@/features/role-wise-features/examination/components/ExaminationPage'),
  { loading: () => null },
);

export default function Page() {
  return <ExaminationPage />;
}

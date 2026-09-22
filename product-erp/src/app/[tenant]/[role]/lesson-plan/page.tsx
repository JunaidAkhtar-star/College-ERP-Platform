/**
 * @file page.tsx
 * @description Lesson Plans route — server component wrapper.
 * @module app/[role]/lesson-plan
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Lesson Plans',
  description: 'Create and track faculty lesson plans.',
};

const LessonPlanPage = dynamic(
  () => import('@/features/role-wise-features/lesson-plan/components/LessonPlanPage'),
  { loading: () => null },
);

export default function Page() {
  return <LessonPlanPage />;
}

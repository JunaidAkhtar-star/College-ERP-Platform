/**
 * @file page.tsx
 * @description Course Progress route — server component wrapper.
 * @module app/[role]/course-progress
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Course Progress',
  description: 'Track student and subject course progress.',
};

const CourseProgressPage = dynamic(
  () => import('@/features/role-wise-features/course-progress/components/CourseProgressPage'),
  { loading: () => null },
);

export default function Page() {
  return <CourseProgressPage />;
}

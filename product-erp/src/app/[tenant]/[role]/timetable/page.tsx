/**
 * @file page.tsx
 * @description Timetable route — server component wrapper.
 * @module app/[role]/timetable
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Timetable',
  description: 'View and manage class timetables.',
};

const TimetablePage = dynamic(
  () => import('@/features/role-wise-features/timetable/components/TimetablePage'),
  { loading: () => null },
);

export default function Page() {
  return <TimetablePage />;
}

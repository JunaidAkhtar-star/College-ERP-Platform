/**
 * @file page.tsx
 * @description Academic Calendar route — server component wrapper.
 * @module app/[role]/academic-calendar
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Academic Calendar',
  description: 'Manage academic year events and schedules.',
};

const AcademicCalendarPage = dynamic(
  () => import('@/features/role-wise-features/academic-calendar/components/AcademicCalendarPage'),
  { loading: () => null },
);

export default function Page() {
  return <AcademicCalendarPage />;
}

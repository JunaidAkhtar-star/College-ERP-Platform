/**
 * @file page.tsx
 * @description Assignments route — server component wrapper.
 * @module app/[role]/assignment
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Assignments',
  description: 'Manage faculty assignments and submissions.',
};

const AssignmentPage = dynamic(
  () => import('@/features/role-wise-features/assignment/components/AssignmentPage'),
  { loading: () => null },
);

export default function Page() {
  return <AssignmentPage />;
}

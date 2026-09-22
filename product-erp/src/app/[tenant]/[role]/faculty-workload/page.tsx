/**
 * @file page.tsx
 * @description Faculty Workload route — server component wrapper.
 * @module app/[role]/faculty-workload
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Faculty Workload',
  description: 'Monitor and manage faculty teaching workload.',
};

const FacultyWorkloadPage = dynamic(
  () => import('@/features/role-wise-features/faculty-workload/components/FacultyWorkloadPage'),
  { loading: () => null },
);

export default function Page() {
  return <FacultyWorkloadPage />;
}

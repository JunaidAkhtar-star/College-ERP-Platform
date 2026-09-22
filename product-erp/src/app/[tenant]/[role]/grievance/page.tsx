/**
 * @file page.tsx
 * @description Grievances route — server component wrapper.
 * @module app/[role]/grievance
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Grievances',
  description: 'Track and resolve student and staff grievances.',
};

const GrievancePage = dynamic(
  () => import('@/features/role-wise-features/grievance/components/GrievancePage'),
  { loading: () => null },
);

export default function Page() {
  return <GrievancePage />;
}

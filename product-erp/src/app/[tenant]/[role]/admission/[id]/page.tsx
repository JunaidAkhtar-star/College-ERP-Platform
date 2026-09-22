/**
 * @file page.tsx
 * @description Admission application detail route.
 * @module app/[role]/admission/[id]
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Application Detail',
  description: 'View and manage a single admission application.',
};

const ApplicationDetailPage = dynamic(
  () => import('@/features/role-wise-features/admission/components/ApplicationDetailPage'),
  { loading: () => null },
);

export default function Page() {
  return <ApplicationDetailPage />;
}

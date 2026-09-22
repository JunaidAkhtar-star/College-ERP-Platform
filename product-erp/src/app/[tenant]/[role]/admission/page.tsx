/**
 * @file page.tsx
 * @description Admission Applications route — server component wrapper.
 * @module app/[role]/admission
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Admission Applications',
  description: 'Manage student admission applications.',
};

const AdmissionPage = dynamic(
  () => import('@/features/role-wise-features/admission/components/AdmissionPage'),
  { loading: () => null },
);

export default function Page() {
  return <AdmissionPage />;
}

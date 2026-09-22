/**
 * @file page.tsx
 * @description Study Material route — server component wrapper.
 * @module app/[role]/study-material
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Study Material',
  description: 'Upload and manage study materials.',
};

const StudyMaterialPage = dynamic(
  () => import('@/features/role-wise-features/study-material/components/StudyMaterialPage'),
  { loading: () => null },
);

export default function Page() {
  return <StudyMaterialPage />;
}

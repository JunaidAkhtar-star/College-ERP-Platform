/**
 * @file page.tsx
 * @description New admission application form route.
 * @module app/[role]/admission/new
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'New Application',
  description: 'Submit a new admission application.',
};

const ApplicationFormPage = dynamic(
  () => import('@/features/role-wise-features/admission/components/ApplicationFormPage'),
  { loading: () => null },
);

export default function Page() {
  return <ApplicationFormPage />;
}

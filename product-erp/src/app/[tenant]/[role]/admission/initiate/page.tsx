/**
 * @file page.tsx
 * @description Admin route to initiate a new admission application.
 *   Generates a permanent ERP Student ID and temporary password for the applicant.
 * @module app/[role]/admission/initiate
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Initiate Application',
  description: 'Create an applicant account with temporary credentials.',
};

const InitiateApplicationPage = dynamic(
  () => import('@/features/role-wise-features/admission/components/InitiateApplicationPage'),
  { loading: () => null },
);

export default function Page() {
  return <InitiateApplicationPage />;
}

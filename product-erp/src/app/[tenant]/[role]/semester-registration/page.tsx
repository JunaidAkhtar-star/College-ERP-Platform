/**
 * @file page.tsx
 * @description Semester Registration route — server component wrapper.
 * @module app/[role]/semester-registration
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Semester Registration',
  description: 'Manage student semester registrations.',
};

const SemesterRegistrationPage = dynamic(
  () =>
    import('@/features/role-wise-features/semester-registration/components/SemesterRegistrationPage'),
  { loading: () => null },
);

export default function Page() {
  return <SemesterRegistrationPage />;
}

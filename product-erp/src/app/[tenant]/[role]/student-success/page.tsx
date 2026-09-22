/** @file page.tsx @description Student success and retention workspace route. */
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Student Success | Devvelocity ERP',
  description: 'Explainable early-warning, advisor caseload and intervention management.',
};

const StudentSuccessPage = dynamic(
  () => import('@/features/role-wise-features/student-success/components/StudentSuccessPage'),
);

export default function Page() {
  return <StudentSuccessPage />;
}

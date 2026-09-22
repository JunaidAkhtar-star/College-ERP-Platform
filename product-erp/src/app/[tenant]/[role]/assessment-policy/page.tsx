/** @file page.tsx @description Assessment policy and gradebook administration route. @module app/[tenant]/[role]/assessment-policy */
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
export const metadata: Metadata = {
  title: 'Assessment Policies',
  description: 'Configure versioned assessment policies and governed gradebooks.',
};
const AssessmentPolicyPage = dynamic(
  () => import('@/features/role-wise-features/assessment-policy/components/AssessmentPolicyPage'),
  { loading: () => null },
);
export default function Page() {
  return <AssessmentPolicyPage />;
}

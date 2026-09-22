import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
export const metadata: Metadata = {
  title: 'LMS Integration | Devvelocity ERP',
  description: 'Course, roster, assignment and governed grade interoperability.',
};
const LmsIntegrationPage = dynamic(
  () => import('@/features/role-wise-features/lms-integration/components/LmsIntegrationPage'),
);
export default function Page() {
  return <LmsIntegrationPage />;
}

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Faculty Onboarding',
  description: 'Onboard a new faculty member with professional details.',
};

const FacultyOnboardPage = dynamic(
  () => import('@/features/role-wise-features/faculty-profile/components/FacultyOnboardPage'),
  { loading: () => null },
);

export default function Page() {
  return <FacultyOnboardPage />;
}

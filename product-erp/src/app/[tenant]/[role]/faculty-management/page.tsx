import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Faculty Management',
  description: 'Manage faculty academic and professional profiles.',
};

const FacultyProfilePage = dynamic(
  () => import('@/features/role-wise-features/faculty-profile/components/FacultyProfilePage'),
  { loading: () => null },
);

export default function Page() {
  return <FacultyProfilePage />;
}

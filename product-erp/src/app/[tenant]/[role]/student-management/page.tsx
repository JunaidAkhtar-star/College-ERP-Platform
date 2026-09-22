import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Student Management',
  description: 'Manage student academic and personal profiles.',
};

const StudentProfilePage = dynamic(
  () => import('@/features/role-wise-features/student-profile/components/StudentProfilePage'),
  { loading: () => null },
);

export default function Page() {
  return <StudentProfilePage />;
}

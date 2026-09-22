/**
 * @file page.tsx
 * @description Self-service profile route — server component wrapper.
 * @module app/[role]/profile
 */
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'My Profile',
  description: 'View and update your personal details, avatar, and notification preferences.',
};

const ProfilePage = dynamic(
  () => import('@/features/role-wise-features/profile/components/ProfilePage'),
  { loading: () => null },
);

export default function Page() {
  return <ProfilePage />;
}

/**
 * @file page.tsx
 * @description Notification route — server component wrapper.
 * @module app/[role]/notification
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Notifications',
  description: 'Manage and view notifications.',
};

const NotificationPage = dynamic(
  () => import('@/features/role-wise-features/notification/components/NotificationPage'),
  { loading: () => null },
);

export default function Page() {
  return <NotificationPage />;
}

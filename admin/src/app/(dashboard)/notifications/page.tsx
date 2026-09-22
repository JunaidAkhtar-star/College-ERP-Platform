import type { Metadata } from 'next';
import NotificationCenter from '@/features/super-admin/components/NotificationCenter';

export const metadata: Metadata = {
  title: 'Notifications',
  description: 'Review actionable Devvelocity platform notifications.',
};

export default function NotificationsPage() {
  return <NotificationCenter />;
}

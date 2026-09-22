/**
 * @file page.tsx
 * @description Events route — server component wrapper.
 * @module app/[role]/event
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Events',
  description: 'Manage college events and activities.',
};

const EventPage = dynamic(
  () => import('@/features/role-wise-features/event/components/EventPage'),
  { loading: () => null },
);

export default function Page() {
  return <EventPage />;
}

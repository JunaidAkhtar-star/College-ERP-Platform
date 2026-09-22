/**
 * @file page.tsx
 * @description Training Sessions route — server component wrapper.
 * @module app/[role]/training-session
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Training Sessions',
  description: 'Manage Training & Placement programme sessions.',
};

const TrainingSessionPage = dynamic(
  () => import('@/features/role-wise-features/training-session/components/TrainingSessionPage'),
  { loading: () => null },
);

export default function Page() {
  return <TrainingSessionPage />;
}

/**
 * @file page.tsx
 * @description Task Management route — server component wrapper.
 * @module app/[role]/task-management
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Task Management',
  description: 'Manage, assign, and track institutional tasks.',
};

const TaskManagementPage = dynamic(
  () => import('@/features/role-wise-features/task-management/components/TaskManagementPage'),
  { loading: () => null },
);

export default function Page() {
  return <TaskManagementPage />;
}

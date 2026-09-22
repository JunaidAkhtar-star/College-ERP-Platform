/**
 * @file page.tsx
 * @description Audit Log route — server component wrapper.
 * @module app/[role]/audit-log
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Audit Log',
  description: 'View all system activity and audit trail.',
};

const AuditLogPage = dynamic(
  () => import('@/features/role-wise-features/audit-log/components/AuditLogPage'),
  { loading: () => null },
);

export default function Page() {
  return <AuditLogPage />;
}

/** @file page.tsx @description Degree audit and multi-term academic planning route. */
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Degree Audit & Planner | Devvelocity ERP',
  description: 'Review degree progress, plan future terms and govern transfer credits.',
};

const DegreeAuditPage = dynamic(
  () => import('@/features/role-wise-features/degree-audit/components/DegreeAuditPage'),
);

export default function Page() {
  return <DegreeAuditPage />;
}

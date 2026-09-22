/**
 * @file page.tsx
 * @description Payroll route — server component wrapper.
 * @module app/[role]/payroll
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Payroll',
  description: 'Manage staff payroll and salary slips.',
};

const PayrollPage = dynamic(
  () => import('@/features/role-wise-features/payroll/components/PayrollPage'),
  { loading: () => null },
);

export default function Page() {
  return <PayrollPage />;
}

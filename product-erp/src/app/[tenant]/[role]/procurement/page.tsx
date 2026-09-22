import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Procurement & Requisitions | Institution ERP',
  description: 'Department procurement requests, approvals, and PO generation.',
};

const ProcurementPage = dynamic(
  () => import('@/features/role-wise-features/procurement/components/ProcurementPage'),
  { loading: () => null },
);

export default function Page() {
  return <ProcurementPage />;
}

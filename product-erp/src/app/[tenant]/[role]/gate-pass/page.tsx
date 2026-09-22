import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Gate Pass Security | Institution ERP',
  description: 'Visitor management and security gate pass controls.',
};

const GatePassPage = dynamic(
  () => import('@/features/role-wise-features/gate-pass/components/GatePassPage'),
  { loading: () => null },
);

export default function Page() {
  return <GatePassPage />;
}

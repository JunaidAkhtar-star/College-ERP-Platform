import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Compliance Workspace',
  description: 'AICTE, BPUT, NAAC, NBA, Tally and audit compliance workspace.',
};

const ComplianceWorkspacePage = dynamic(
  () => import('@/features/role-wise-features/compliance/components/ComplianceWorkspacePage'),
);

export default function Page() {
  return <ComplianceWorkspacePage />;
}

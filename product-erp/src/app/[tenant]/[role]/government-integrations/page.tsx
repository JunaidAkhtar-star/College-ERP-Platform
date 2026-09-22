import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Government & Regulatory Integrations',
  description: 'Governed institutional onboarding for approved regulatory services.',
};

const GovernmentIntegrationsPage = dynamic(
  () =>
    import('@/features/role-wise-features/government-integrations/components/GovernmentIntegrationsPage'),
);

export default function Page() {
  return <GovernmentIntegrationsPage />;
}

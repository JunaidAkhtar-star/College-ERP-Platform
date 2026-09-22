'use client';

import dynamic from 'next/dynamic';

const CommunicationHubPage = dynamic(
  () => import('@/features/role-wise-features/communication-hub/components/CommunicationHubPage'),
);

export default function Page() {
  return <CommunicationHubPage />;
}

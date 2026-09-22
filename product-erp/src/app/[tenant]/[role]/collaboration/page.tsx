'use client';

import dynamic from 'next/dynamic';

const CollaborationPage = dynamic(
  () => import('@/features/role-wise-features/collaboration/components/CollaborationPage'),
);

export default function Page() {
  return <CollaborationPage />;
}

'use client';

import dynamic from 'next/dynamic';

const DataPortabilityPage = dynamic(
  () => import('@/features/role-wise-features/data-portability/components/DataPortabilityPage'),
);

export default function Page() {
  return <DataPortabilityPage />;
}

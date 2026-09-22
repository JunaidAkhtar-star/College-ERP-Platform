'use client';

import dynamic from 'next/dynamic';

const DisciplinePage = dynamic(
  () => import('@/features/role-wise-features/discipline/components/DisciplinePage'),
);

export default function Page() {
  return <DisciplinePage />;
}

'use client';

import dynamic from 'next/dynamic';

const FormsWorkflowPage = dynamic(
  () => import('@/features/role-wise-features/forms/components/FormsWorkflowPage'),
);

export default function Page() {
  return <FormsWorkflowPage />;
}

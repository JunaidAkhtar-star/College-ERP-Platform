/**
 * @file page.tsx
 * @description Parent Portal – Exam Results sub-route.
 * @module app/[role]/parent/results
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: "Ward's Results",
  description: "View your ward's examination results and academic performance.",
};

const ParentPage = dynamic(
  () => import('@/features/role-wise-features/parent/components/ParentPage'),
  { loading: () => null },
);

export default function Page() {
  return <ParentPage />;
}

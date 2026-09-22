/**
 * @file page.tsx
 * @description Parent Portal route — server component wrapper.
 * @module app/[role]/parent
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Parent Portal',
  description: "View your ward's academic progress, attendance, fees, and notices.",
};

const ParentPage = dynamic(
  () => import('@/features/role-wise-features/parent/components/ParentPage'),
  { loading: () => null },
);

export default function Page() {
  return <ParentPage />;
}

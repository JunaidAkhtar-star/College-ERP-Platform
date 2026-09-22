/**
 * @file page.tsx
 * @description Parent Portal – Ward Profile sub-route.
 * @module app/[role]/parent/ward
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: "Ward's Profile",
  description: "View your ward's academic profile and details.",
};

const ParentPage = dynamic(
  () => import('@/features/role-wise-features/parent/components/ParentPage'),
  { loading: () => null },
);

export default function Page() {
  return <ParentPage />;
}

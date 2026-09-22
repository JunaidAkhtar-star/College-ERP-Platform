/**
 * @file page.tsx
 * @description NAAC / NBA route — server component wrapper.
 * @module app/[role]/naac-nba
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'NAAC / NBA',
  description: 'Accreditation documentation and compliance.',
};

const NaacNbaPage = dynamic(
  () => import('@/features/role-wise-features/naac-nba/components/NaacNbaPage'),
  { loading: () => null },
);

export default function Page() {
  return <NaacNbaPage />;
}

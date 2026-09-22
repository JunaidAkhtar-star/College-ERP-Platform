/**
 * @file page.tsx
 * @description Alumni route — server component wrapper.
 * @module app/[role]/alumni
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Alumni',
  description: 'Manage alumni network and records.',
};

const AlumniPage = dynamic(
  () => import('@/features/role-wise-features/alumni/components/AlumniPage'),
  { loading: () => null },
);

export default function Page() {
  return <AlumniPage />;
}

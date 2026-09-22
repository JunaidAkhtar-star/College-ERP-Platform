/**
 * @file page.tsx
 * @description Documents route — server component wrapper.
 * @module app/[role]/document
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Documents',
  description: 'Manage institutional documents and files.',
};

const DocumentPage = dynamic(
  () => import('@/features/role-wise-features/document/components/DocumentPage'),
  { loading: () => null },
);

export default function Page() {
  return <DocumentPage />;
}

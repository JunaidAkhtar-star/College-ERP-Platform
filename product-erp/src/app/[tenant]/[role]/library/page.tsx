/**
 * @file page.tsx
 * @description Library route — server component wrapper.
 * @module app/[role]/library
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Library',
  description: 'Manage library books, issues and returns.',
};

const LibraryPage = dynamic(
  () => import('@/features/role-wise-features/library/components/LibraryPage'),
  { loading: () => null },
);

export default function Page() {
  return <LibraryPage />;
}

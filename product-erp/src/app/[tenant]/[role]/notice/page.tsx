/**
 * @file page.tsx
 * @description Notice Board route — server component wrapper.
 * @module app/[role]/notice
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Notice Board',
  description: 'Publish and manage institutional notices.',
};

const NoticePage = dynamic(
  () => import('@/features/role-wise-features/notice/components/NoticePage'),
  { loading: () => null },
);

export default function Page() {
  return <NoticePage />;
}

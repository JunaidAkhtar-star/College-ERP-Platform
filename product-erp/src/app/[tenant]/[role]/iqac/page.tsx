/**
 * @file page.tsx
 * @description IQAC route — server component wrapper.
 * @module app/[role]/iqac
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'IQAC',
  description: 'Internal Quality Assurance Cell records.',
};

const IqacPage = dynamic(() => import('@/features/role-wise-features/iqac/components/IqacPage'), {
  loading: () => null,
});

export default function Page() {
  return <IqacPage />;
}

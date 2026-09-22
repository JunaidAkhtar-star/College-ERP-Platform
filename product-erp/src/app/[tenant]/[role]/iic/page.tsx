/**
 * @file page.tsx
 * @description IIC route.
 * @module app/[role]/iic
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'IIC',
  description: 'Institution Innovation Council activities and MIC reporting.',
};

const IicPage = dynamic(() => import('@/features/role-wise-features/iic/components/IicPage'), {
  loading: () => null,
});

export default function Page() {
  return <IicPage />;
}

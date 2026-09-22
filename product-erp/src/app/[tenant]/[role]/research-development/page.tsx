/**
 * @file page.tsx
 * @description Research & Development route.
 * @module app/[role]/research-development
 */

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Research & Development',
  description: 'Track R&D projects, grants and publications.',
};

const ResearchDevelopmentPage = dynamic(
  () =>
    import('@/features/role-wise-features/research-development/components/ResearchDevelopmentPage'),
  { loading: () => null },
);

export default function Page() {
  return <ResearchDevelopmentPage />;
}

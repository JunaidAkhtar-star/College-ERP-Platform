/**
 * @file page.tsx
 * @description Request sandbox demo page. Thin wrapper around the client component.
 * @module src/app/demo
 */

import type { Metadata } from 'next';
import DemoPage from '@/features/landing/components/DemoPage';
import PublicSiteLayout from '@/features/landing/components/PublicSiteLayout';
import { createSeoMetadata } from '@/shared/utils/seo';

export const metadata: Metadata = createSeoMetadata({
  title: 'Request an Education ERP Demo',
  description:
    'Try the full power of Devvelocity higher education ERP in your dedicated client sandbox environment.',
  path: '/demo',
});

export default function Page() {
  return (
    <PublicSiteLayout>
      <DemoPage />
    </PublicSiteLayout>
  );
}

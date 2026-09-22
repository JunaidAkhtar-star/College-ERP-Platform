/**
 * @file page.tsx
 * @description Contact page. Thin wrapper around the client component.
 * @module src/app/contact
 */

import type { Metadata } from 'next';
import ContactPage from '@/features/landing/components/ContactPage';
import PublicSiteLayout from '@/features/landing/components/PublicSiteLayout';
import { createSeoMetadata } from '@/shared/utils/seo';

export const metadata: Metadata = createSeoMetadata({
  title: 'Contact Devvelocity | Products, Engineering & Partnerships',
  description:
    'Contact Devvelocity about software products, College ERP, product engineering services, integrations, partnerships or support.',
  path: '/contact',
});

export default function Page() {
  return (
    <PublicSiteLayout>
      <ContactPage />
    </PublicSiteLayout>
  );
}

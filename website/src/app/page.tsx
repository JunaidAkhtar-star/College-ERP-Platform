import type { Metadata } from 'next';
import CorporateHomePage from '@/features/landing/components/CorporateHomePage';
import { createSeoMetadata } from '@/shared/utils/seo';

export const metadata: Metadata = createSeoMetadata({
  title: 'Software Product Company in India',
  description:
    'Devvelocity is an Indian software product company building secure cloud platforms, College ERP software and dependable digital solutions for modern organisations.',
  path: '/',
  keywords: [
    'software product company India',
    'custom software development',
    'cloud application development',
    'digital product engineering',
    'Devvelocity software',
    'Devvelocity College ERP',
  ],
});

export default function RootPage() {
  return <CorporateHomePage />;
}

import type { Metadata } from 'next';
import CompanyStoryPage from '@/features/landing/components/CompanyStoryPage';
import JsonLd from '@/shared/core/JsonLd';
import { createSeoMetadata, SITE_URL } from '@/shared/utils/seo';

export const metadata: Metadata = createSeoMetadata({
  title: 'About Devvelocity | Our Mission, Vision and Product Direction',
  description:
    'Meet Devvelocity, a modern software product and engineering company. Explore our mission, vision, principles and direction for dependable digital products.',
  path: '/company',
});

export default function CompanyRoute() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'AboutPage',
              '@id': `${SITE_URL}/company/#webpage`,
              url: `${SITE_URL}/company`,
              name: 'About Devvelocity',
              isPartOf: { '@id': `${SITE_URL}/#website` },
              about: { '@id': `${SITE_URL}/#organization` },
              inLanguage: 'en-IN',
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
                { '@type': 'ListItem', position: 2, name: 'Company', item: `${SITE_URL}/company` },
              ],
            },
          ],
        }}
      />
      <CompanyStoryPage />
    </>
  );
}

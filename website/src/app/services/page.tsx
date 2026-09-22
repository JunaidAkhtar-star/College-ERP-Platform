import type { Metadata } from 'next';
import ServicesPage from '@/features/landing/components/ServicesPage';
import JsonLd from '@/shared/core/JsonLd';
import { createSeoMetadata, SITE_URL } from '@/shared/utils/seo';

export const metadata: Metadata = createSeoMetadata({
  title: 'Software Product Design & Engineering Services',
  description:
    'Explore Devvelocity product strategy, UX design, web, React Native, cloud, integration, automation and product modernisation services.',
  path: '/services',
  keywords: [
    'software product engineering India',
    'cloud software development',
    'React Native development',
  ],
});

export default function ServicesRoute() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Service',
              '@id': `${SITE_URL}/services/#service`,
              name: 'Software Product Engineering Services',
              url: `${SITE_URL}/services`,
              provider: { '@id': `${SITE_URL}/#organization` },
              areaServed: 'IN',
              serviceType: [
                'Product engineering',
                'Cloud platform development',
                'Responsive web application development',
                'React Native mobile development',
                'Software integration and automation',
              ],
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: 'Services',
                  item: `${SITE_URL}/services`,
                },
              ],
            },
          ],
        }}
      />
      <ServicesPage />
    </>
  );
}

import type { Metadata } from 'next';
import ProductsPage from '@/features/landing/components/ProductsPage';
import JsonLd from '@/shared/core/JsonLd';
import { createSeoMetadata, SITE_URL } from '@/shared/utils/seo';

export const metadata: Metadata = createSeoMetadata({
  title: 'Software Products',
  description:
    'Explore Devvelocity software products for education, business operations and future digital platforms.',
  path: '/products',
  keywords: ['Devvelocity products', 'education software products', 'college ERP platform'],
});

export default function ProductsRoute() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'CollectionPage',
              '@id': `${SITE_URL}/products/#webpage`,
              url: `${SITE_URL}/products`,
              name: 'Devvelocity Software Products',
              isPartOf: { '@id': `${SITE_URL}/#website` },
              about: { '@id': `${SITE_URL}/#organization` },
              inLanguage: 'en-IN',
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: 'Products',
                  item: `${SITE_URL}/products`,
                },
              ],
            },
          ],
        }}
      />
      <ProductsPage />
    </>
  );
}

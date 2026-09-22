import type { Metadata } from 'next';
import ModulesPage from '@/features/landing/components/ModulesPage';
import PublicSiteLayout from '@/features/landing/components/PublicSiteLayout';
import JsonLd from '@/shared/core/JsonLd';
import { ALL_MODULES } from '@/features/landing/data/modules';
import { createSeoMetadata, SITE_URL } from '@/shared/utils/seo';

export const metadata: Metadata = createSeoMetadata({
  title: 'Education ERP Modules',
  description:
    'Explore Devvelocity modules for admissions, academics, finance, HR, examinations, compliance and campus operations.',
  path: '/modules',
  keywords: ['education ERP modules', 'college management software modules', 'campus ERP'],
});

export default function PublicModulesPage() {
  return (
    <PublicSiteLayout>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'CollectionPage',
              '@id': `${SITE_URL}/modules/#webpage`,
              url: `${SITE_URL}/modules`,
              name: 'College ERP Software Modules',
              isPartOf: { '@id': `${SITE_URL}/#website` },
              about: { '@id': `${SITE_URL}/products/college-erp/#software` },
              mainEntity: {
                '@type': 'ItemList',
                numberOfItems: ALL_MODULES.length,
                itemListElement: ALL_MODULES.map((module, index) => ({
                  '@type': 'ListItem',
                  position: index + 1,
                  name: module.title,
                  url: `${SITE_URL}/modules/${module.id}`,
                })),
              },
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: 'ERP Modules',
                  item: `${SITE_URL}/modules`,
                },
              ],
            },
          ],
        }}
      />
      <ModulesPage />
    </PublicSiteLayout>
  );
}

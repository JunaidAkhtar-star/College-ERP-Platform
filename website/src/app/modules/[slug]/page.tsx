import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ModuleDetailPage from '@/features/landing/components/ModuleDetailPage';
import { ALL_MODULES } from '@/features/landing/data/modules';
import PublicSiteLayout from '@/features/landing/components/PublicSiteLayout';
import JsonLd from '@/shared/core/JsonLd';
import { createSeoMetadata, SITE_URL } from '@/shared/utils/seo';

interface IProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return ALL_MODULES.map((module) => ({ slug: module.id }));
}

export async function generateMetadata({ params }: IProps): Promise<Metadata> {
  const { slug } = await params;
  const productModule = ALL_MODULES.find((item) => item.id === slug);
  if (!productModule) {
    return createSeoMetadata({
      title: 'Module not found',
      description: 'The requested Devvelocity ERP module could not be found.',
      path: `/modules/${slug}`,
      noIndex: true,
    });
  }
  return createSeoMetadata({
    title: `${productModule.title} ERP Software`,
    description: productModule.description,
    path: `/modules/${productModule.id}`,
    keywords: [
      `${productModule.title} ERP software`,
      `${productModule.title} management system`,
      'education ERP software',
    ],
  });
}

export default async function PublicModuleDetailPage({ params }: IProps) {
  const { slug } = await params;
  const productModule = ALL_MODULES.find((item) => item.id === slug);
  if (!productModule) notFound();
  const moduleUrl = `${SITE_URL}/modules/${productModule.id}`;
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: `${productModule.title} - Devvelocity`,
        url: moduleUrl,
        description: productModule.description,
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'Web',
        featureList: productModule.features.map((feature) => feature.title),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'ERP Modules', item: `${SITE_URL}/modules` },
          { '@type': 'ListItem', position: 3, name: productModule.title, item: moduleUrl },
        ],
      },
    ],
  };
  return (
    <PublicSiteLayout>
      <JsonLd data={schema} />
      <ModuleDetailPage mod={productModule} />
    </PublicSiteLayout>
  );
}

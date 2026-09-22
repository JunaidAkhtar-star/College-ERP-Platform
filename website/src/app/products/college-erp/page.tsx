import type { Metadata } from 'next';
import DevvelocityLandingPage from '@/features/landing/components/DevvelocityLandingPage';
import JsonLd from '@/shared/core/JsonLd';
import { createSeoMetadata, SITE_URL } from '@/shared/utils/seo';

export const metadata: Metadata = createSeoMetadata({
  title: 'College ERP Software in India',
  description:
    'Devvelocity College ERP software connects admissions, academics, attendance, fees, examinations, HR, accreditation and multi-campus operations in one secure platform.',
  path: '/products/college-erp',
  keywords: [
    'college ERP software India',
    'best ERP software for colleges',
    'higher education ERP',
    'college management software',
    'campus management system',
    'university ERP software',
    'education ERP platform',
    'multi campus college ERP',
  ],
  imagePath: '/images/company/hero-products-v2.png',
  imageAlt: 'Devvelocity College ERP connected across desktop, tablet and mobile devices',
  imageWidth: 1823,
  imageHeight: 863,
});

const productUrl = `${SITE_URL}/products/college-erp`;
const productSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${productUrl}/#webpage`,
      url: productUrl,
      name: 'College ERP Software in India | Devvelocity',
      description:
        'A secure multi-tenant college ERP for admissions, academics, attendance, fees, examinations, HR, accreditation and campus operations.',
      isPartOf: { '@id': `${SITE_URL}/#website` },
      about: { '@id': `${productUrl}/#software` },
      breadcrumb: { '@id': `${productUrl}/#breadcrumb` },
      inLanguage: 'en-IN',
      primaryImageOfPage: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/images/company/hero-products-v2.png`,
        width: 1823,
        height: 863,
      },
    },
    {
      '@type': ['SoftwareApplication', 'WebApplication'],
      '@id': `${productUrl}/#software`,
      name: 'Devvelocity College ERP',
      alternateName: ['Devvelocity Education ERP', 'Devvelocity Campus Management System'],
      url: productUrl,
      description:
        'College ERP software for connected academic, administrative, financial and campus operations.',
      applicationCategory: 'EducationalApplication',
      applicationSubCategory: 'College management and higher education ERP',
      operatingSystem: 'Modern web browsers',
      browserRequirements: 'Requires JavaScript and a modern web browser',
      provider: { '@id': `${SITE_URL}/#organization` },
      featureList: [
        'Admissions and student lifecycle',
        'Academic structure and curriculum',
        'Attendance and faculty operations',
        'Fees, accounts and payroll',
        'Examinations and assessment',
        'NAAC, NBA, IQAC and compliance',
        'Multi-campus tenant isolation',
        'Role-based access and audit logs',
      ],
      screenshot: `${SITE_URL}/images/company/hero-products-v2.png`,
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${productUrl}/#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Products', item: `${SITE_URL}/products` },
        { '@type': 'ListItem', position: 3, name: 'College ERP', item: productUrl },
      ],
    },
  ],
};

export default function CollegeErpPage() {
  return (
    <>
      <JsonLd data={productSchema} />
      <DevvelocityLandingPage />
    </>
  );
}

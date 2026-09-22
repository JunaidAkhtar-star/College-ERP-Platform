/**
 * @file sitemap.ts
 * @description Sitemap for publicly indexable Devvelocity routes.
 * @module app
 */

import type { MetadataRoute } from 'next';
import { ALL_MODULES } from '@/features/landing/data/modules';
import { SITE_URL } from '@/shared/utils/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date('2026-07-27T00:00:00.000Z');
  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 1,
      images: [`${SITE_URL}/images/devvelocity-social-preview.jpg`],
    },
    { url: `${SITE_URL}/products`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    {
      url: `${SITE_URL}/products/college-erp`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.95,
      images: [`${SITE_URL}/images/company/hero-products-v2.png`],
    },
    { url: `${SITE_URL}/services`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/company`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/modules`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    ...ALL_MODULES.map((module) => ({
      url: `${SITE_URL}/modules/${module.id}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    {
      url: `${SITE_URL}/contact`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
    { url: `${SITE_URL}/demo`, lastModified, changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${SITE_URL}/faq`, lastModified, changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: 'yearly' as const, priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified, changeFrequency: 'yearly' as const, priority: 0.3 },
  ];
}

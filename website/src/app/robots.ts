/**
 * @file robots.ts
 * @description Robots policy for the public Devvelocity company and product website.
 * @module app
 */

import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/shared/utils/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

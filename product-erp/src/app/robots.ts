import type { MetadataRoute } from 'next';

/** ERP portals are private application surfaces and must never be indexed. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', disallow: '/' }] };
}

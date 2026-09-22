/**
 * @file manifest.ts
 * @description PWA web app manifest for the Devvelocity company website.
 *              and provides branding metadata to browsers.
 * @module app
 */

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Devvelocity Software Products',
    short_name: 'Devvelocity',
    description:
      'Modern software products, College ERP and digital engineering solutions from Devvelocity.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#0178D7',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}

/**
 * @file manifest.ts
 * @description PWA web app manifest for Devvelocity ERP. Enables "Add to Home Screen"
 *              and provides branding metadata to browsers.
 * @module app
 */

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Devvelocity ERP',
    short_name: 'Devvelocity',
    description: 'Multi-tenant enterprise resource planning platform for educational institutions.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#0178D7',
  };
}

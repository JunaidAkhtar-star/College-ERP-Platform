/**
 * @file ServicesPage.tsx
 * @description Composes Devvelocity's product strategy and engineering service experience.
 * @module features/landing/components
 */

'use client';

import PublicSiteLayout from './PublicSiteLayout';
import ServicesCapabilities from './services/ServicesCapabilities';
import ServicesDelivery from './services/ServicesDelivery';
import ServicesEngagement from './services/ServicesEngagement';
import ServicesHero from './services/ServicesHero';

export default function ServicesPage() {
  return (
    <PublicSiteLayout>
      <div className="overflow-x-hidden">
        <ServicesHero />
        <ServicesCapabilities />
        <ServicesDelivery />
        <ServicesEngagement />
      </div>
    </PublicSiteLayout>
  );
}

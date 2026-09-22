/**
 * @file CompanyStoryPage.tsx
 * @description Composes Devvelocity's company story, purpose, platform and principles.
 * @module features/landing/components
 */

'use client';

import PublicSiteLayout from './PublicSiteLayout';
import CompanyHero from './company/CompanyHero';
import CompanyPrinciples from './company/CompanyPrinciples';
import CompanyPurpose from './company/CompanyPurpose';
import CompanyPlatform from './company/CompanyPlatform';

export default function CompanyStoryPage() {
  return (
    <PublicSiteLayout>
      <div className="overflow-x-hidden">
        <CompanyHero />
        <CompanyPurpose />
        <CompanyPlatform />
        <CompanyPrinciples />
      </div>
    </PublicSiteLayout>
  );
}

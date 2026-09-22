/**
 * @file DevvelocityLandingPage.tsx
 * @description Light-mode public product homepage driven by the SaaS public catalog.
 * @module features/landing
 */

'use client';

import useSwr from '@/shared/hooks/useSwr';
import {
  IPublicSiteConfig,
  IProductAddon,
  IProductModule,
  ISubscriptionPlan,
} from '@/features/landing/types/public.types';
import LandingHeaderHero from './LandingHeaderHero';
import LandingProductSections from './LandingProductSections';
import PublicSiteLayout from './PublicSiteLayout';

interface IPublicCatalogResponse {
  data?: {
    modules: IProductModule[];
    plans: ISubscriptionPlan[];
    addons: IProductAddon[];
    site: IPublicSiteConfig | null;
  };
}

/** Renders the main-domain marketing site from centrally managed public content. */
export default function DevvelocityLandingPage() {
  const { data, isLoading } = useSwr<IPublicCatalogResponse>('super-admin/public-catalog');
  const catalog = data?.data;
  const productSlug = 'college-erp';
  const modules = (catalog?.modules ?? []).filter((item) => item.productSlug === productSlug);
  const plans = (catalog?.plans ?? []).filter((item) => item.productSlug === productSlug);
  const addons = (catalog?.addons ?? []).filter((item) => item.productSlug === productSlug);

  return (
    <PublicSiteLayout>
      <div className="overflow-x-hidden">
        <LandingHeaderHero site={catalog?.site ?? null} modules={modules} />
        <LandingProductSections
          modules={modules}
          plans={plans}
          addons={addons}
          isLoading={isLoading}
        />
      </div>
    </PublicSiteLayout>
  );
}

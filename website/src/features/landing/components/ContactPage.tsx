/**
 * @file ContactPage.tsx
 * @description Composes the Devvelocity company contact and consultation experience.
 * @module features/landing/components
 */

'use client';

import useSwr from '@/shared/hooks/useSwr';
import type { IPublicSiteConfig } from '@/features/landing/types/public.types';
import ContactConversation from './contact/ContactConversation';
import ContactFaq from './contact/ContactFaq';
import ContactHero from './contact/ContactHero';

interface IPublicCatalogResponse {
  data?: { site: IPublicSiteConfig | null };
}

export default function ContactPage() {
  const { data } = useSwr<IPublicCatalogResponse>('super-admin/public-catalog');

  return (
    <div className="overflow-x-hidden bg-white">
      <ContactHero />
      <ContactConversation site={data?.data?.site} />
      <ContactFaq />
    </div>
  );
}

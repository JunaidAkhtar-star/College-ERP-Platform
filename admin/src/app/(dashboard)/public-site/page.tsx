'use client';

import useSwr from '@/shared/hooks/useSwr';
import PublicProfileTab from '@/features/super-admin/components/PublicProfileTab';
import type { IPublicSiteConfig } from '@/features/super-admin/types/super-admin.types';

export default function PublicSitePage() {
  const query = useSwr<{ data?: IPublicSiteConfig }>('super-admin/public-profile');
  return <PublicProfileTab profile={query.data?.data} refresh={query.mutate} />;
}

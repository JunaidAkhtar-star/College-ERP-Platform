'use client';

import useSwr from '@/shared/hooks/useSwr';
import OverviewTab from '@/features/super-admin/components/OverviewTab';
import type { IPlatformOverview } from '@/features/super-admin/types/super-admin.types';

export default function OverviewPage() {
  const overview = useSwr<{ data?: IPlatformOverview }>('super-admin/overview');
  const data = overview.data?.data;

  return (
    <OverviewTab
      data={data}
      isLoading={overview.isLoading}
      error={overview.error}
      onRetry={() => void overview.mutate()}
    />
  );
}

'use client';

import useSwr from '@/shared/hooks/useSwr';
import LicensesTab from '@/features/super-admin/components/LicensesTab';
import type { ITenant, ITenantUsage } from '@/features/super-admin/types/super-admin.types';

export default function LicensesPage() {
  const tenants = useSwr<{ data?: ITenant[] }>('super-admin/tenants');
  const usage = useSwr<{ data?: ITenantUsage[] }>('super-admin/tenant-usage');
  return (
    <LicensesTab
      tenants={tenants.data?.data ?? []}
      usage={usage.data?.data ?? []}
      isValidating={tenants.isValidating || usage.isValidating}
      onRefresh={async () => {
        await Promise.all([tenants.mutate(), usage.mutate()]);
      }}
    />
  );
}

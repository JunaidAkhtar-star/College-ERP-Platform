'use client';

import useSwr from '@/shared/hooks/useSwr';
import PlansTab from '@/features/super-admin/components/PlansTab';
import type {
  IProductModule,
  ISubscriptionPlan,
} from '@/features/super-admin/types/super-admin.types';

export default function PlansPage() {
  const plans = useSwr<{ data?: ISubscriptionPlan[] }>('super-admin/plans');
  const modules = useSwr<{ data?: IProductModule[] }>('super-admin/product-modules');
  return (
    <PlansTab
      plans={plans.data?.data ?? []}
      modules={modules.data?.data ?? []}
      refresh={plans.mutate}
      isValidating={plans.isValidating}
    />
  );
}

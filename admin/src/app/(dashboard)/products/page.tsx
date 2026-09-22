'use client';

import useSwr from '@/shared/hooks/useSwr';
import ProductCatalogTab from '@/features/super-admin/components/ProductCatalogTab';
import ProductPortfolioStrip from '@/features/super-admin/components/ProductPortfolioStrip';
import type { IProductModule } from '@/features/super-admin/types/super-admin.types';

export default function ProductsPage() {
  const query = useSwr<{ data?: IProductModule[] }>('super-admin/product-modules');
  return (
    <div className="space-y-5">
      <ProductPortfolioStrip />
      <ProductCatalogTab
        modules={query.data?.data ?? []}
        isLoading={query.isLoading}
        isValidating={query.isValidating}
        refresh={query.mutate}
      />
    </div>
  );
}

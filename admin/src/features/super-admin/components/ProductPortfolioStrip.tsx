/**
 * @file ProductPortfolioStrip.tsx
 * @description Shows database-managed Devvelocity products above their module catalogue.
 * @module features/super-admin/components
 */

'use client';

import { Boxes, CircleDot } from 'lucide-react';
import useSwr from '@/shared/hooks/useSwr';
import type { IPlatformProduct } from '../types/super-admin.types';

export default function ProductPortfolioStrip() {
  const { data, isLoading } = useSwr<{ data?: IPlatformProduct[] }>('super-admin/products');
  const products = data?.data ?? [];

  if (isLoading) return <div className="h-32 animate-pulse rounded-2xl bg-slate-50" />;

  return (
    <section className="admin-surface p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary-50 text-primary">
          <Boxes className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Devvelocity products</h2>
          <p className="text-sm text-slate-500">
            Company-level products that own plans, modules and entitlements.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <article key={product._id} className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-slate-800">{product.name}</p>
              <span className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase text-slate-500">
                <CircleDot className="size-3 text-primary" />
                {product.status}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{product.description}</p>
            <p className="mt-3 font-mono text-[10px] text-primary">{product.slug}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

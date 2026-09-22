/**
 * @file ProductsPage.tsx
 * @description Responsive portfolio page for current and planned Devvelocity products.
 * @module features/landing/components
 */

'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import useSwr from '@/shared/hooks/useSwr';
import type { IPlatformProduct } from '../types/public.types';
import PublicSiteLayout from './PublicSiteLayout';
import { productIcon } from '../data/products';

interface IProductCatalogResponse {
  data?: { products: IPlatformProduct[] };
}

export default function ProductsPage() {
  const { data } = useSwr<IProductCatalogResponse>('super-admin/public-catalog');
  const products = data?.data?.products ?? [];

  return (
    <PublicSiteLayout>
      <section className="bg-[#f5fafc] px-5 py-16 sm:py-24 md:px-10 lg:px-16 lg:py-28">
        <div className="mx-auto max-w-[1440px]">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl"
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Devvelocity products
            </p>
            <h1 className="mt-5 text-[clamp(2.8rem,7vw,6.5rem)] font-bold leading-[0.95] tracking-[-0.065em] text-[#123f61]">
              Focused products. One reliable platform.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[#667085] sm:text-lg sm:leading-8">
              Each product is designed for a clear operational challenge and supported by shared
              identity, security, billing and delivery foundations.
            </p>
          </motion.div>
          <div className="mt-14 space-y-4">
            {products.map((product, index) => {
              const Icon = productIcon(product.icon);
              return (
                <motion.article
                  key={product.slug}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08 }}
                  className="grid gap-6 rounded-[2rem] bg-white p-6 sm:p-8 lg:grid-cols-[auto_1fr_auto] lg:items-center"
                >
                  <span className="grid size-14 place-items-center rounded-2xl bg-primary-50 text-primary">
                    <Icon size={25} />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-bold text-[#123f61]">{product.name}</h2>
                      <span className="rounded-full bg-[#f2f6f8] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#6d7888]">
                        {product.status === 'available' ? 'Available' : 'Planned'}
                      </span>
                    </div>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-[#667085]">
                      {product.description}
                    </p>
                  </div>
                  {product.publicPath ? (
                    <Link
                      href={product.publicPath}
                      className="inline-flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white"
                    >
                      View product <ArrowRight size={16} />
                    </Link>
                  ) : (
                    <span className="flex w-fit items-center gap-2 text-xs font-bold text-[#8090a0]">
                      <CheckCircle2 size={16} /> Roadmap
                    </span>
                  )}
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>
    </PublicSiteLayout>
  );
}

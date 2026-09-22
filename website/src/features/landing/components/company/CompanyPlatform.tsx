/**
 * @file CompanyPlatform.tsx
 * @description Explains Devvelocity's focused-product and shared-platform direction.
 * @module features/landing/components/company
 */

'use client';

import Image from 'next/image';
import { Check, CloudCog, Database, Package } from 'lucide-react';
import { motion } from '@/shared/utils/motion';

const layers = [
  {
    icon: Package,
    label: 'Focused products',
    text: 'Purpose-built experiences for a specific industry and customer need.',
  },
  {
    icon: CloudCog,
    label: 'Shared capabilities',
    text: 'Identity, subscriptions, integrations and operational platform services.',
  },
  {
    icon: Database,
    label: 'Dependable foundation',
    text: 'Secure data architecture, observability and scalable infrastructure.',
  },
] as const;

export default function CompanyPlatform() {
  return (
    <section className="bg-[#f2f7fa] px-5 py-20 sm:py-24 md:px-10 lg:px-16 lg:py-32">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-white"
          >
            <Image
              src="/images/company/technology-foundation-v2.png"
              alt="Responsive products connected to secure platform services, data and cloud infrastructure"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </motion.div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Built for what comes next
            </p>
            <h2 className="mt-5 text-3xl font-bold tracking-[-0.05em] text-[#123f61] sm:text-5xl">
              One foundation. Many focused products.
            </h2>
            <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
              College ERP is our flagship product, not the boundary of the company. Future products
              can reuse proven capabilities while keeping their experience focused and their data
              responsibly separated.
            </p>
            <div className="mt-8 space-y-3">
              {[
                'Independent product experiences',
                'Shared security and engineering standards',
                'Scale without premature complexity',
              ].map((item) => (
                <p
                  key={item}
                  className="flex items-center gap-3 text-sm font-semibold text-slate-700"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary-100 text-secondary-700">
                    <Check size={14} />
                  </span>
                  {item}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-[2rem] bg-slate-200 sm:grid-cols-3">
          {layers.map(({ icon: Icon, label, text }, index) => (
            <motion.article
              key={label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
              className="bg-white p-7 sm:p-8"
            >
              <Icon size={22} className="text-primary" />
              <h3 className="mt-6 text-lg font-bold text-[#123f61]">{label}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-500">{text}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * @file ServicesHero.tsx
 * @description Services hero with an animated product delivery workflow.
 * @module features/landing/components/services
 */

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check, CodeXml, PanelsTopLeft, Search, ShieldCheck } from 'lucide-react';
import { motion } from '@/shared/utils/motion';

const stages = [
  { icon: Search, label: 'Discover', tone: 'bg-primary-50 text-primary' },
  { icon: PanelsTopLeft, label: 'Design', tone: 'bg-secondary-50 text-secondary-700' },
  { icon: CodeXml, label: 'Engineer', tone: 'bg-primary-50 text-primary' },
  { icon: ShieldCheck, label: 'Evolve', tone: 'bg-secondary-50 text-secondary-700' },
] as const;

export default function ServicesHero() {
  return (
    <section className="relative isolate min-h-[calc(100dvh-65px)] overflow-hidden bg-[#f5faff] px-5 py-14 md:px-10 lg:px-16">
      <div className="pointer-events-none absolute inset-0 light-grid-overlay opacity-70" />
      <div className="pointer-events-none absolute -left-40 top-10 size-96 rounded-full bg-primary-100/60 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 size-96 rounded-full bg-secondary-100/70 blur-3xl" />

      <div className="relative mx-auto grid min-h-[calc(100dvh-177px)] max-w-[1440px] items-center gap-14 lg:grid-cols-[1.04fr_.96fr]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            <span className="size-2 rounded-full bg-secondary" />
            Product and engineering services
          </div>
          <h1 className="mt-7 max-w-5xl text-[clamp(2.8rem,6vw,6.2rem)] font-bold leading-[0.95] tracking-[-0.065em] text-[#123f61]">
            From difficult problem to dependable product.
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-7 text-slate-600 sm:text-xl sm:leading-9">
            We bring product strategy, experience design and disciplined engineering together to
            create software that works clearly for users and reliably for organisations.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-white transition hover:bg-primary-600"
            >
              Discuss your project <ArrowRight size={16} />
            </Link>
            <a
              href="#capabilities"
              className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-primary-50"
            >
              Explore capabilities
            </a>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.65, delay: 0.12 }}
          className="relative mx-auto w-full max-w-[620px]"
        >
          <div className="relative aspect-[4/3] overflow-hidden rounded-[2.5rem] bg-white">
            <Image
              src="/images/services/product-engineering.png"
              alt="Product strategy, experience design, web, mobile and cloud engineering team"
              fill
              priority
              sizes="(min-width: 1024px) 44vw, 90vw"
              className="object-cover object-center"
            />
            <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#123f61]/75 to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between text-white">
              <div>
                <p className="text-sm font-bold sm:text-base">One connected product team</p>
                <p className="mt-1 text-xs text-white/70">From direction to dependable delivery</p>
              </div>
              <motion.span
                animate={{ scale: [1, 1.16, 1] }}
                transition={{ duration: 2.4, repeat: Infinity }}
                className="size-3 rounded-full bg-secondary-300"
              />
            </div>
          </div>
          <div className="relative -mt-4 grid grid-cols-2 gap-2 px-4 sm:grid-cols-4 sm:px-7">
            {stages.map(({ icon: Icon, label, tone }, index) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.12 }}
                className="relative flex items-center gap-2 rounded-2xl bg-white p-3"
              >
                <span className={`z-10 grid size-8 shrink-0 place-items-center rounded-lg ${tone}`}>
                  <Icon size={15} />
                </span>
                <p className="text-xs font-bold text-[#123f61]">{label}</p>
                <Check size={14} className="ml-auto text-secondary-600" />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/**
 * @file CompanyHero.tsx
 * @description Editorial company hero combining positioning with restrained platform imagery.
 * @module features/landing/components/company
 */

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { motion } from '@/shared/utils/motion';

export default function CompanyHero() {
  return (
    <section className="relative isolate min-h-[calc(100dvh-65px)] overflow-hidden bg-[#eff6fa]">
      <Image
        src="/images/company/hero-platform-source.png"
        alt="Devvelocity digital product platform connecting applications, cloud and data"
        fill
        priority
        sizes="100vw"
        className="object-cover object-[66%_center]"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#f5faff] via-[#f5faff]/95 to-[#f5faff]/10 lg:via-[#f5faff]/80" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#f5faff]/70 via-transparent to-white/25" />

      <div className="relative mx-auto flex min-h-[calc(100dvh-65px)] max-w-[1440px] items-center px-5 py-16 md:px-10 lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65 }}
          className="max-w-3xl"
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            About Devvelocity
          </p>
          <h1 className="mt-6 text-[clamp(3rem,6.5vw,6.8rem)] font-bold leading-[0.93] tracking-[-0.068em] text-[#123f61]">
            Building useful progress.
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-7 text-slate-600 sm:text-xl sm:leading-9">
            We are a software product and engineering company turning complex organisational work
            into clear, dependable digital experiences.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/products"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-white transition hover:bg-primary-600"
            >
              Explore our products <ArrowRight size={16} />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-full bg-white/90 px-6 py-3.5 text-sm font-bold text-slate-700 backdrop-blur-sm transition hover:bg-white"
            >
              Start a conversation
            </Link>
          </div>
          <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-xs font-semibold text-slate-500">
            <span>Product thinking</span>
            <span>Responsible engineering</span>
            <span>Long-term partnership</span>
          </div>
        </motion.div>
      </div>

      <a
        href="#purpose"
        className="absolute bottom-6 right-6 hidden items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-xs font-semibold text-slate-600 backdrop-blur-md lg:flex"
      >
        Our direction <ArrowDown size={15} />
      </a>
    </section>
  );
}

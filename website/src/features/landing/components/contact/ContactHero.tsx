/**
 * @file ContactHero.tsx
 * @description Welcoming contact hero with consultation-focused imagery.
 * @module features/landing/components/contact
 */

'use client';

import Image from 'next/image';
import { ArrowDown, Clock3, MessageSquareText } from 'lucide-react';
import { motion } from '@/shared/utils/motion';

export default function ContactHero() {
  return (
    <section className="relative overflow-hidden bg-[#f3f8fb] px-5 py-14 md:px-10 lg:px-16 lg:py-20">
      <div className="pointer-events-none absolute inset-0 light-grid-overlay opacity-60" />
      <div className="relative mx-auto grid min-h-[calc(100dvh-177px)] max-w-[1440px] items-center gap-12 lg:grid-cols-[.82fr_1.18fr]">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            <MessageSquareText size={15} />
            Start a conversation
          </div>
          <h1 className="mt-7 max-w-3xl text-[clamp(3rem,6vw,6.3rem)] font-bold leading-[0.94] tracking-[-0.065em] text-[#123f61]">
            Tell us what needs to work better.
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-slate-600 sm:text-xl sm:leading-9">
            Explore a product, discuss an engineering challenge or ask a practical question. We will
            listen first and help shape the right next step.
          </p>
          <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-2">
              <Clock3 size={15} className="text-primary" /> Response within one business day
            </span>
            <span>No obligation</span>
            <span>Clear next steps</span>
          </div>
          <a
            href="#contact-form"
            className="mt-9 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-white transition hover:bg-primary-600"
          >
            Contact our team <ArrowDown size={16} />
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.12 }}
          className="relative aspect-[4/3] overflow-hidden rounded-[2.5rem] bg-white"
        >
          <Image
            src="/images/public-pages/contact-success-team.png"
            alt="Devvelocity specialist in a guided consultation with an institution leader"
            fill
            priority
            sizes="(min-width: 1024px) 56vw, 100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#123f61]/75 to-transparent" />
          <div className="absolute bottom-6 left-6 text-white sm:bottom-8 sm:left-8">
            <p className="font-bold">Human guidance from the first conversation</p>
            <p className="mt-1 text-xs text-white/65">
              Product direction · Technical discovery · Practical planning
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

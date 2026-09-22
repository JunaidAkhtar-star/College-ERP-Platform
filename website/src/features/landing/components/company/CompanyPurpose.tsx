/**
 * @file CompanyPurpose.tsx
 * @description Editorial mission, vision and purpose narrative for Devvelocity.
 * @module features/landing/components/company
 */

'use client';

import Image from 'next/image';
import { motion } from '@/shared/utils/motion';

const direction = [
  {
    label: 'Mission',
    title: 'Make capable software feel simple.',
    text: 'Reduce friction, connect fragmented work and help teams make better decisions without adding unnecessary complexity.',
  },
  {
    label: 'Vision',
    title: 'A trusted family of focused products.',
    text: 'Build products that solve meaningful industry problems exceptionally well, supported by one dependable platform.',
  },
  {
    label: 'Purpose',
    title: 'Useful progress, built responsibly.',
    text: 'Make technology a practical organisational advantage through clarity, thoughtful design and engineering discipline.',
  },
] as const;

export default function CompanyPurpose() {
  return (
    <section id="purpose" className="bg-white px-5 py-20 sm:py-24 md:px-10 lg:px-16 lg:py-32">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-12 lg:grid-cols-[.82fr_1.18fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Why we exist
            </p>
            <h2 className="mt-5 text-3xl font-bold tracking-[-0.05em] text-[#123f61] sm:text-5xl">
              Direction before velocity.
            </h2>
            <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
              Speed matters only when it moves people toward something useful. We begin by
              understanding the organisation, the people inside it and the outcome that genuinely
              needs to improve.
            </p>
            <blockquote className="mt-9 bg-[#eef6fa] px-6 py-5 text-lg font-semibold leading-8 text-[#123f61] sm:text-xl">
              “Technology should make important work clearer—not make people adapt to unnecessary
              complexity.”
            </blockquote>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-primary-50"
          >
            <Image
              src="/images/company/hero-team-source.png"
              alt="Devvelocity team discussing a digital product experience"
              fill
              sizes="(min-width: 1024px) 56vw, 100vw"
              className="object-cover object-[62%_center]"
            />
          </motion.div>
        </div>

        <div className="mt-16 grid bg-[#123f61] lg:grid-cols-3">
          {direction.map(({ label, title, text }, index) => (
            <motion.article
              key={label}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
              className="min-h-72 p-7 text-white sm:p-9 lg:p-10"
            >
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-secondary-300">
                {label}
              </p>
              <h3 className="mt-8 text-2xl font-bold tracking-[-0.03em]">{title}</h3>
              <p className="mt-4 text-sm leading-7 text-white/60">{text}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

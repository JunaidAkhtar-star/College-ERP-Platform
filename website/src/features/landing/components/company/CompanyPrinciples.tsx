/**
 * @file CompanyPrinciples.tsx
 * @description Company principles, delivery commitments and closing call to action.
 * @module features/landing/components/company
 */

'use client';

import Link from 'next/link';
import { ArrowRight, Compass, HeartHandshake, ShieldCheck, UsersRound, Zap } from 'lucide-react';
import { motion } from '@/shared/utils/motion';

const principles = [
  {
    icon: Compass,
    number: '01',
    title: 'Clarity first',
    text: 'We make the problem, priorities and trade-offs visible before complexity enters the product.',
  },
  {
    icon: UsersRound,
    number: '02',
    title: 'People in the loop',
    text: 'The people using and operating software shape the decisions that define it.',
  },
  {
    icon: ShieldCheck,
    number: '03',
    title: 'Trust by design',
    text: 'Security, privacy, accessibility and responsible controls begin with architecture.',
  },
  {
    icon: Zap,
    number: '04',
    title: 'Useful momentum',
    text: 'We deliver in meaningful increments, learn from evidence and improve continuously.',
  },
  {
    icon: HeartHandshake,
    number: '05',
    title: 'Long-term ownership',
    text: 'We optimise for dependable outcomes and relationships—not short-term feature volume.',
  },
] as const;

export default function CompanyPrinciples() {
  return (
    <>
      <section className="bg-white px-5 py-20 sm:py-24 md:px-10 lg:px-16 lg:py-32">
        <div className="mx-auto max-w-[1440px]">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              How we choose to build
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.05em] text-[#123f61] sm:text-5xl">
              Principles that stay when technology changes.
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Tools and platforms evolve. These standards shape how we make decisions, work with
              customers and take responsibility for what we create.
            </p>
          </div>

          <div className="mt-14 grid gap-x-12 lg:grid-cols-2">
            {principles.map(({ icon: Icon, number, title, text }, index) => (
              <motion.article
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.45, delay: index * 0.06 }}
                className={`grid grid-cols-[auto_1fr] gap-5 py-7 ${
                  index === principles.length - 1 ? 'lg:col-span-2 lg:max-w-[calc(50%-1.5rem)]' : ''
                }`}
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-primary-50 text-primary">
                  <Icon size={20} />
                </span>
                <div>
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-lg font-bold text-[#123f61]">{title}</h3>
                    <span className="text-xs font-bold text-slate-300">{number}</span>
                  </div>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{text}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 pb-20 md:px-10 lg:px-16 lg:pb-28">
        <div className="relative mx-auto overflow-hidden rounded-[2.5rem] bg-[#123f61] px-7 py-14 text-white sm:px-12 sm:py-16 lg:flex lg:items-center lg:justify-between lg:gap-12">
          <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/30 blur-3xl" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary-300">
              Build with Devvelocity
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.045em] sm:text-5xl">
              Have a meaningful problem worth solving?
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/65 sm:text-base">
              Whether you need a focused product, a connected platform or an engineering partner, we
              would like to understand what progress means for your organisation.
            </p>
          </div>
          <Link
            href="/contact"
            className="relative mt-8 inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-[#123f61] transition hover:bg-primary-50 lg:mt-0"
          >
            Talk to our team <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}

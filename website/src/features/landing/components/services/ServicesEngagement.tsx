/**
 * @file ServicesEngagement.tsx
 * @description Engagement models, technology foundation and services call to action.
 * @module features/landing/components/services
 */

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CalendarRange, Layers3, UsersRound } from 'lucide-react';
import { motion } from '@/shared/utils/motion';

const models = [
  {
    icon: CalendarRange,
    label: 'Focused engagement',
    title: 'Solve a defined challenge',
    text: 'A time-bound engagement for discovery, design, architecture or a focused product release.',
    bestFor: 'Clear problem, specific outcome',
  },
  {
    icon: Layers3,
    label: 'End-to-end delivery',
    title: 'Create a complete product',
    text: 'One connected team takes the product from definition through design, engineering and launch.',
    bestFor: 'New products and major platforms',
  },
  {
    icon: UsersRound,
    label: 'Embedded partnership',
    title: 'Extend your product team',
    text: 'A durable cross-functional partnership that adds product and engineering capability over time.',
    bestFor: 'Continuous delivery and evolution',
  },
] as const;

const technologies = [
  ['TypeScript', '/images/technology-logos/typescript.svg'],
  ['React', '/images/technology-logos/react.svg'],
  ['React Native', '/images/technology-logos/react.svg'],
  ['Next.js', '/images/technology-logos/nextjs.svg'],
  ['Node.js', '/images/technology-logos/nodejs.svg'],
  ['MongoDB', '/images/technology-logos/mongodb.svg'],
  ['Redis', '/images/technology-logos/redis.svg'],
  ['Cloud', '/images/technology-logos/cloud.svg'],
] as const;

export default function ServicesEngagement() {
  return (
    <>
      <section className="bg-white px-5 py-20 sm:py-24 md:px-10 lg:px-16 lg:py-32">
        <div className="mx-auto max-w-[1440px]">
          <div className="grid gap-10 lg:grid-cols-[.82fr_1.18fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                Ways to work together
              </p>
              <h2 className="mt-4 max-w-3xl text-3xl font-bold tracking-[-0.05em] text-[#123f61] sm:text-5xl">
                The right engagement for where you are.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                We shape the team and delivery model around the outcome—not around a fixed
                catalogue.
              </p>
            </div>
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              className="relative aspect-[16/9] overflow-hidden rounded-[2.25rem] bg-primary-50"
            >
              <Image
                src="/images/services/product-partnership.png"
                alt="Client and software product teams collaborating around a shared product roadmap"
                fill
                sizes="(min-width: 1024px) 52vw, 100vw"
                className="object-cover object-left"
              />
            </motion.div>
          </div>
          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {models.map(({ icon: Icon, label, title, text, bestFor }, index) => (
              <motion.article
                key={label}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.09 }}
                className="rounded-[2rem] bg-[#f2f7fa] p-7 sm:p-8"
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-white text-primary">
                  <Icon size={22} />
                </span>
                <p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                  {label}
                </p>
                <h3 className="mt-3 text-2xl font-bold text-[#123f61]">{title}</h3>
                <p className="mt-4 text-sm leading-6 text-slate-500">{text}</p>
                <div className="mt-8 rounded-2xl bg-white px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                    Best for
                  </p>
                  <p className="mt-1 text-xs font-bold text-[#123f61]">{bestFor}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f4f8fa] px-5 py-20 md:px-10 lg:px-16 lg:py-24">
        <div className="mx-auto max-w-[1440px]">
          <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Technology foundation
          </p>
          <h2 className="mx-auto mt-4 max-w-3xl text-center text-3xl font-bold tracking-[-0.05em] text-[#123f61] sm:text-4xl">
            Modern tools, selected with discipline.
          </h2>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {technologies.map(([name, logo], index) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, scale: 0.92 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.04 }}
                className="flex min-h-28 flex-col items-center justify-center rounded-2xl bg-white p-4"
              >
                <Image src={logo} alt={`${name} technology logo`} width={34} height={34} />
                <p className="mt-3 text-center text-xs font-bold text-slate-600">{name}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20 md:px-10 lg:px-16 lg:py-28">
        <div className="relative mx-auto overflow-hidden rounded-[2.5rem] bg-[#e7f3d4] px-7 py-14 sm:px-12 sm:py-16 lg:flex lg:items-center lg:justify-between lg:gap-12">
          <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-secondary-200/70 blur-3xl" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary-700">
              Start with the outcome
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.045em] text-[#38531a] sm:text-5xl">
              Tell us what needs to work better.
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-secondary-800/75 sm:text-base">
              We will help clarify the opportunity, identify the risks and shape a practical first
              step—before asking you to commit to a large feature list.
            </p>
          </div>
          <Link
            href="/contact"
            className="relative mt-8 inline-flex shrink-0 items-center gap-2 rounded-full bg-[#38531a] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-secondary-800 lg:mt-0"
          >
            Start a conversation <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}

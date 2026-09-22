/**
 * @file ServicesDelivery.tsx
 * @description Explains Devvelocity's connected delivery process and client visibility.
 * @module features/landing/components/services
 */

'use client';

import Image from 'next/image';
import { CheckCircle2, CodeXml, Goal, PackageCheck, Search, ShieldCheck } from 'lucide-react';
import { motion } from '@/shared/utils/motion';

const steps = [
  {
    icon: Search,
    number: '01',
    title: 'Understand',
    text: 'Explore users, workflows, constraints and the outcome worth improving.',
  },
  {
    icon: Goal,
    number: '02',
    title: 'Shape',
    text: 'Define the product direction, scope, priorities and measurable success.',
  },
  {
    icon: CodeXml,
    number: '03',
    title: 'Build',
    text: 'Design and engineer in visible increments with continuous stakeholder input.',
  },
  {
    icon: ShieldCheck,
    number: '04',
    title: 'Validate',
    text: 'Test behaviour, usability, performance, accessibility and security.',
  },
  {
    icon: PackageCheck,
    number: '05',
    title: 'Launch & evolve',
    text: 'Release carefully, observe real adoption and improve with evidence.',
  },
] as const;

export default function ServicesDelivery() {
  return (
    <section className="overflow-hidden bg-[#123f61] px-5 py-20 text-white sm:py-24 md:px-10 lg:px-16 lg:py-32">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary-300">
              How delivery works
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.05em] sm:text-5xl">
              Visible progress from first question to release.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-white/60 lg:justify-self-end sm:text-lg sm:leading-8">
            Our process keeps decisions, design and engineering connected. You see what is being
            learned, built and validated throughout the engagement.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          className="relative mt-14 aspect-[16/7] min-h-64 overflow-hidden rounded-[2.5rem] bg-white"
        >
          <Image
            src="/images/services/delivery-lifecycle.png"
            alt="Connected software delivery lifecycle from discovery and design to engineering, validation and secure cloud launch"
            fill
            sizes="(min-width: 1440px) 1440px, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#123f61]/20 via-transparent to-transparent" />
        </motion.div>

        <div className="relative mt-8">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {steps.map(({ icon: Icon, number, title, text }, index) => (
              <motion.article
                key={title}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="relative rounded-[1.75rem] bg-white/[0.07] p-6"
              >
                {index < steps.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute left-12 top-12 hidden h-px w-[calc(100%+1rem)] bg-white/15 lg:block"
                  />
                )}
                <span className="relative z-10 grid size-12 place-items-center rounded-2xl bg-white text-[#123f61]">
                  <Icon size={21} />
                </span>
                <p className="mt-8 text-xs font-bold text-secondary-300">{number}</p>
                <h3 className="mt-2 text-lg font-bold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/55">{text}</p>
              </motion.article>
            ))}
          </div>
        </div>

        <div className="mt-12 grid gap-4 rounded-[2rem] bg-white p-6 text-[#123f61] sm:grid-cols-3 sm:p-8">
          {[
            ['Clear ownership', 'Know who is responsible for every important decision.'],
            ['Frequent visibility', 'Review useful progress throughout—not only at the end.'],
            ['Quality evidence', 'Release with tested behaviour and documented confidence.'],
          ].map(([title, text]) => (
            <div key={title} className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 shrink-0 text-secondary-600" size={19} />
              <div>
                <p className="text-sm font-bold">{title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

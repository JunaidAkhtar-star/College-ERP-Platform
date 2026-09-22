/**
 * @file ServicesCapabilities.tsx
 * @description Detailed service capabilities and the outcomes each capability delivers.
 * @module features/landing/components/services
 */

'use client';

import { CloudCog, CodeXml, DatabaseZap, PanelsTopLeft, Smartphone, Workflow } from 'lucide-react';
import { motion } from '@/shared/utils/motion';

const services = [
  {
    icon: PanelsTopLeft,
    number: '01',
    title: 'Product strategy & UX',
    text: 'Turn an uncertain opportunity into a clear product direction grounded in users and operational reality.',
    items: ['Discovery and research', 'Product definition', 'UX flows and prototypes'],
    outcome: 'A validated direction before heavy investment',
  },
  {
    icon: CodeXml,
    number: '02',
    title: 'Web product engineering',
    text: 'Build responsive, accessible applications designed to make complex workflows feel understandable.',
    items: [
      'Modern web applications',
      'Design system implementation',
      'Performance and accessibility',
    ],
    outcome: 'A maintainable production-ready web product',
  },
  {
    icon: Smartphone,
    number: '03',
    title: 'Mobile experiences',
    text: 'Create connected mobile products designed around how people actually work beyond the desktop.',
    items: ['React Native applications', 'Cross-device journeys', 'Offline-aware experiences'],
    outcome: 'One clear experience across mobile platforms',
  },
  {
    icon: CloudCog,
    number: '04',
    title: 'Cloud platforms',
    text: 'Engineer secure foundations that support multi-tenant products, growth and operational visibility.',
    items: ['Cloud architecture', 'APIs and background services', 'Observability and automation'],
    outcome: 'Infrastructure that scales without slowing teams',
  },
  {
    icon: Workflow,
    number: '05',
    title: 'Integration & automation',
    text: 'Connect fragmented systems and remove repetitive work with governed, observable automation.',
    items: ['System integrations', 'Workflow automation', 'Data synchronisation'],
    outcome: 'Less manual work and more dependable operations',
  },
  {
    icon: DatabaseZap,
    number: '06',
    title: 'Product modernisation',
    text: 'Improve legacy products incrementally without putting business continuity at unnecessary risk.',
    items: ['Architecture assessment', 'Experience redesign', 'Measured migration'],
    outcome: 'A safer path from legacy to modern',
  },
] as const;

export default function ServicesCapabilities() {
  return (
    <section id="capabilities" className="bg-white px-5 py-20 sm:py-24 md:px-10 lg:px-16 lg:py-32">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-7 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              What we deliver
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.05em] text-[#123f61] sm:text-5xl">
              Capability across the product lifecycle.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-slate-600 lg:justify-self-end sm:text-lg sm:leading-8">
            Engage us for one focused capability or for the complete journey. Every service connects
            business direction, user experience and technical quality.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {services.map(({ icon: Icon, number, title, text, items, outcome }, index) => (
            <motion.article
              key={title}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: (index % 3) * 0.08 }}
              className="flex min-h-[420px] flex-col rounded-[2rem] bg-[#f2f7fa] p-6 sm:p-8"
            >
              <div className="flex items-center justify-between">
                <span className="grid size-12 place-items-center rounded-2xl bg-white text-primary">
                  <Icon size={22} />
                </span>
                <span className="text-xs font-bold text-slate-300">{number}</span>
              </div>
              <h3 className="mt-8 text-xl font-bold tracking-tight text-[#123f61]">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-500">{text}</p>
              <div className="mt-6 space-y-2">
                {items.map((item) => (
                  <p
                    key={item}
                    className="flex items-center gap-2 text-xs font-semibold text-slate-600"
                  >
                    <span className="size-1.5 rounded-full bg-secondary" />
                    {item}
                  </p>
                ))}
              </div>
              <div className="mt-auto rounded-2xl bg-white px-4 py-3.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">
                  Outcome
                </p>
                <p className="mt-1 text-xs font-semibold leading-5 text-[#123f61]">{outcome}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

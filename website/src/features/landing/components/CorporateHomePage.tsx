/**
 * @file CorporateHomePage.tsx
 * @description Devvelocity company homepage presenting products, services and company capabilities.
 * @module features/landing/components
 */

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CloudCog,
  CodeXml,
  Compass,
  Database,
  GitBranch,
  Goal,
  PackageCheck,
  PanelsTopLeft,
  Pause,
  Play,
  Search,
  ShieldCheck,
  LockKeyhole,
  ServerCog,
  Smartphone,
  Workflow,
} from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import useSwr from '@/shared/hooks/useSwr';
import type { IPlatformProduct } from '../types/public.types';
import PublicSiteLayout from './PublicSiteLayout';
import CorporateHero from './CorporateHero';
import { productIcon } from '../data/products';

interface IProductCatalogResponse {
  data?: { products: IPlatformProduct[] };
}

const capabilities = [
  {
    icon: CodeXml,
    number: '01',
    title: 'Product engineering',
    text: 'From product strategy and experience design to reliable web and mobile delivery.',
    details: ['Product discovery', 'UX and UI systems', 'Web and mobile engineering'],
    outcome: 'From concept to a production-ready product',
  },
  {
    icon: CloudCog,
    number: '02',
    title: 'Cloud platforms',
    text: 'Secure multi-tenant architecture, integrations, automation and operational visibility.',
    details: [
      'Cloud-native architecture',
      'Secure API integrations',
      'Automation and observability',
    ],
    outcome: 'Infrastructure that grows without slowing teams',
  },
  {
    icon: Smartphone,
    number: '03',
    title: 'Connected experiences',
    text: 'Responsive software that remains clear, fast and consistent across every device.',
    details: ['Responsive interfaces', 'Real-time collaboration', 'Accessible user journeys'],
    outcome: 'One consistent experience across every screen',
  },
];

const technologies = [
  { name: 'TypeScript', logo: '/images/technology-logos/typescript.svg' },
  { name: 'React', logo: '/images/technology-logos/react.svg' },
  { name: 'React Native', logo: '/images/technology-logos/react.svg' },
  { name: 'Next.js', logo: '/images/technology-logos/nextjs.svg' },
  { name: 'Node.js', logo: '/images/technology-logos/nodejs.svg' },
  { name: 'MongoDB', logo: '/images/technology-logos/mongodb.svg' },
  { name: 'Redis', logo: '/images/technology-logos/redis.svg' },
  { name: 'WebSockets', logo: '/images/technology-logos/websockets.svg' },
  { name: 'Cloud delivery', logo: '/images/technology-logos/cloud.svg' },
];

const deliverySteps = [
  {
    number: '01',
    icon: Search,
    title: 'Discover',
    text: 'Understand users, operational reality, constraints and the outcome worth pursuing.',
    output: 'Research brief and opportunity map',
  },
  {
    number: '02',
    icon: Goal,
    title: 'Define',
    text: 'Turn evidence into a focused product direction, priorities and measurable success.',
    output: 'Product scope and delivery roadmap',
  },
  {
    number: '03',
    icon: PanelsTopLeft,
    title: 'Design',
    text: 'Prototype the journeys, interface system and interactions before heavy engineering.',
    output: 'Validated experience and design system',
  },
  {
    number: '04',
    icon: CodeXml,
    title: 'Engineer',
    text: 'Build responsive, secure software in visible increments with disciplined architecture.',
    output: 'Production-ready product increments',
  },
  {
    number: '05',
    icon: ShieldCheck,
    title: 'Validate',
    text: 'Test behaviour, accessibility, performance and security across real usage conditions.',
    output: 'Quality evidence and release confidence',
  },
  {
    number: '06',
    icon: PackageCheck,
    title: 'Launch & evolve',
    text: 'Release carefully, observe adoption and improve the product with measured evidence.',
    output: 'Reliable release and improvement plan',
  },
];

export default function CorporateHomePage() {
  const { data } = useSwr<IProductCatalogResponse>('super-admin/public-catalog');
  const products = data?.data?.products ?? [];
  const processTrackRef = useRef<HTMLDivElement>(null);
  const [processPaused, setProcessPaused] = useState(false);
  const [processHovered, setProcessHovered] = useState(false);

  const scrollProcess = useCallback((direction: 'left' | 'right') => {
    const track = processTrackRef.current;
    if (!track) return;
    const card = track.firstElementChild as HTMLElement | null;
    const distance = (card?.offsetWidth ?? 400) + 16;
    const atStart = track.scrollLeft <= 8;
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;

    track.scrollTo({
      left:
        direction === 'right'
          ? atEnd
            ? 0
            : track.scrollLeft + distance
          : atStart
            ? track.scrollWidth
            : track.scrollLeft - distance,
      behavior: 'smooth',
    });
  }, []);

  useEffect(() => {
    if (
      processPaused ||
      processHovered ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const timer = window.setInterval(() => scrollProcess('right'), 4500);
    return () => window.clearInterval(timer);
  }, [processHovered, processPaused, scrollProcess]);

  return (
    <PublicSiteLayout>
      <div className="overflow-x-hidden">
        <CorporateHero />

        <section className="bg-[#123f61] px-5 py-16 text-white sm:py-20 md:px-10 lg:px-16 lg:py-24">
          <div className="mx-auto grid max-w-[1440px] gap-10 lg:grid-cols-[.7fr_1.3fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b9dc70]">
                About Devvelocity
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-[-0.05em] sm:text-5xl">
                More than one product. One clear standard.
              </h2>
            </div>
            <div>
              <p className="text-lg leading-8 text-white/72 sm:text-2xl sm:leading-10">
                We are a modern software product and services company. College ERP is our flagship
                platform today, while our foundation is designed for a wider family of focused
                products tomorrow.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['Product-led', 'Strategy'],
                  ['Responsive', 'Experience'],
                  ['Secure', 'Architecture'],
                  ['Long-term', 'Partnership'],
                ].map(([value, label]) => (
                  <div key={value} className="rounded-2xl bg-white/8 px-4 py-4">
                    <p className="font-bold text-white">{value}</p>
                    <p className="mt-1 text-xs text-white/50">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white px-5 py-20 sm:py-24 md:px-10 lg:px-16 lg:py-28">
          <div className="mx-auto max-w-[1440px]">
            <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                  Product portfolio
                </p>
                <h2 className="mt-4 text-3xl font-bold tracking-[-0.05em] text-[#123f61] sm:text-5xl">
                  One company. A growing family of products.
                </h2>
              </div>
              <p className="max-w-2xl text-base leading-7 text-[#667085] lg:justify-self-end">
                Our flagship education platform is live today. The same platform foundation will
                support new products without compromising focus, security or customer experience.
              </p>
            </div>
            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              {products.map((product, index) => {
                const Icon = productIcon(product.icon);
                return (
                  <motion.article
                    key={product.slug}
                    initial={{ opacity: 0, y: 22 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ duration: 0.5, delay: index * 0.08 }}
                    className={`flex min-h-[330px] flex-col rounded-[2rem] p-6 sm:p-8 ${
                      product.status === 'available'
                        ? 'bg-[#eaf5fb]'
                        : 'bg-[#f5f7f8] text-[#526173]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="grid size-12 place-items-center rounded-2xl bg-white text-primary">
                        <Icon size={22} />
                      </span>
                      <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#6c7889]">
                        {product.status === 'available' ? 'Available now' : 'On our roadmap'}
                      </span>
                    </div>
                    <p className="mt-9 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                      {product.eyebrow}
                    </p>
                    <h3 className="mt-3 text-2xl font-bold tracking-tight text-[#123f61]">
                      {product.name}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-[#667085]">{product.description}</p>
                    {product.publicPath ? (
                      <Link
                        href={product.publicPath}
                        className="mt-auto flex items-center gap-2 pt-8 text-sm font-bold text-primary"
                      >
                        Explore product <ArrowRight size={16} />
                      </Link>
                    ) : (
                      <p className="mt-auto pt-8 text-xs font-semibold text-[#8893a2]">
                        Product information will be shared when it is ready.
                      </p>
                    )}
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#f3f8fb] px-5 py-20 sm:py-24 md:px-10 lg:px-16 lg:py-28">
          <div className="pointer-events-none absolute -right-40 top-16 size-[32rem] rounded-full bg-primary/6 blur-3xl" />
          <div className="mx-auto max-w-[1440px]">
            <div className="relative grid gap-8 lg:grid-cols-2 lg:items-end lg:gap-14">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55 }}
              >
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                  What we deliver
                </p>
                <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-0.045em] text-[#123f61] sm:text-5xl">
                  Product thinking with engineering discipline.
                </h2>
                <p className="mt-6 max-w-xl text-base leading-7 text-[#667085]">
                  We bring strategy, design and technology into one delivery team. Every decision
                  connects to a user need, a business outcome and a system that can be maintained.
                </p>

                <Link
                  href="/services"
                  className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-primary transition hover:gap-3"
                >
                  Explore our services <ArrowRight size={16} />
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: 0.1 }}
                className="overflow-hidden rounded-[1.75rem] bg-[#123f61] p-6 text-white sm:p-8"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b9dc70]">
                  One connected delivery model
                </p>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">
                  A continuous product cycle keeps design decisions, engineering quality and
                  measurable improvement connected from the beginning.
                </p>
                <div className="mt-7 flex items-center">
                  {['Think', 'Shape', 'Build', 'Improve'].map((step, index) => (
                    <div key={step} className="flex min-w-0 flex-1 items-center">
                      <div className="min-w-0">
                        <span className="grid size-7 place-items-center rounded-full border border-white/25 bg-white/10 text-[9px] font-bold">
                          {index + 1}
                        </span>
                        <p className="mt-2 truncate text-[10px] font-semibold text-white/75 sm:text-xs">
                          {step}
                        </p>
                      </div>
                      {index < 3 && <span className="mx-2 h-px flex-1 bg-white/20" />}
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            <div className="relative mt-10 grid gap-4 md:grid-cols-2 lg:mt-12 lg:grid-cols-3">
              {capabilities.map(({ icon: Icon, number, title, text, details, outcome }, index) => (
                <motion.article
                  key={title}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.55, delay: index * 0.08 }}
                  whileHover={{ y: -4 }}
                  className="group flex h-full flex-col overflow-hidden rounded-[2rem] border border-white bg-white shadow-[0_16px_50px_rgba(18,63,97,.06)] transition-shadow hover:shadow-[0_24px_70px_rgba(18,63,97,.11)]"
                >
                  <div className="flex flex-1 flex-col gap-6 p-6 sm:p-7">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="grid size-12 place-items-center rounded-2xl bg-primary-50 text-primary transition duration-300 group-hover:bg-primary group-hover:text-white">
                          <Icon size={21} />
                        </span>
                        <span className="text-xs font-bold tabular-nums text-[#a5b2bd]">
                          {number}
                        </span>
                      </div>
                      <h3 className="mt-6 text-2xl font-semibold tracking-[-0.025em] text-[#123f61]">
                        {title}
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-[#667085]">{text}</p>
                    </div>
                    <div className="mt-auto rounded-2xl bg-[#f3f8fb] p-5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                        Included
                      </p>
                      <div className="mt-4 space-y-3">
                        {details.map((detail) => (
                          <p
                            key={detail}
                            className="flex items-center gap-2.5 text-xs font-semibold text-[#42566a]"
                          >
                            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white text-primary">
                              <Check size={11} />
                            </span>
                            {detail}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-[#e8eef2] px-6 py-4 sm:px-8">
                    <p className="text-xs font-semibold text-[#5f7181]">{outcome}</p>
                    <Link
                      href="/services"
                      aria-label={`Learn more about ${title}`}
                      className="flex shrink-0 items-center gap-2 rounded-full bg-[#eef6fb] px-3 py-2 text-[10px] font-bold text-primary transition duration-300 hover:bg-primary hover:text-white"
                    >
                      Learn more
                      <ArrowUpRight size={14} />
                    </Link>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-hidden bg-white px-5 py-20 sm:py-24 md:px-10 lg:px-16 lg:py-28">
          <div className="mx-auto max-w-[1440px]">
            <div className="grid gap-8 lg:grid-cols-[.85fr_1.15fr] lg:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                  Technology foundation
                </p>
                <h2 className="mt-4 text-3xl font-bold tracking-[-0.05em] text-[#123f61] sm:text-5xl">
                  A modern stack selected for real product work.
                </h2>
              </div>
              <p className="max-w-2xl text-base leading-7 text-[#667085] lg:justify-self-end">
                We combine proven open technologies with disciplined architecture. The result is
                fast interaction, secure tenant boundaries, dependable APIs and systems that remain
                maintainable as products grow.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-9">
              {technologies.map(({ name, logo }, index) => (
                <motion.div
                  key={name}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.045 }}
                  whileHover={{ y: -5 }}
                  className="group flex min-h-28 flex-col items-center justify-center rounded-2xl border border-[#e6edf2] bg-white px-3 shadow-[0_10px_30px_rgba(18,63,97,.045)] transition hover:border-primary/20 hover:shadow-[0_18px_40px_rgba(18,63,97,.09)]"
                >
                  <span className="grid size-11 place-items-center rounded-xl bg-[#f4f8fa] transition duration-300 group-hover:scale-110 group-hover:bg-primary-50">
                    <Image
                      src={logo}
                      alt={`${name} logo`}
                      width={27}
                      height={27}
                      className="size-7 object-contain"
                    />
                  </span>
                  <p className="mt-3 text-center text-xs font-semibold text-[#42566a]">{name}</p>
                </motion.div>
              ))}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="group relative min-h-[420px] overflow-hidden rounded-[2rem] bg-[#eaf5fb]"
              >
                <motion.div
                  animate={{ scale: [1, 1.035, 1], x: [0, -6, 0] }}
                  transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0"
                >
                  <Image
                    src="/images/company/technology-foundation-v2.png"
                    alt="Modern software architecture connecting responsive devices, secure services, data and cloud infrastructure"
                    fill
                    sizes="(min-width: 1024px) 60vw, 100vw"
                    className="object-cover"
                  />
                </motion.div>
                <div className="absolute inset-0 bg-linear-to-t from-[#123f61]/92 via-[#123f61]/12 to-transparent" />
                <motion.div
                  animate={{ y: [0, -7, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute right-5 top-5 rounded-2xl border border-white/55 bg-white/82 px-4 py-3 shadow-lg backdrop-blur-xl sm:right-7 sm:top-7"
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-primary">
                    Architecture
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#123f61]">Connected by design</p>
                </motion.div>
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                  <p className="max-w-xl text-sm leading-6 text-white/80">
                    One connected foundation for responsive experiences, secure services, governed
                    data and dependable cloud operations.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {[
                      'Experience layer',
                      'Platform services',
                      'Governed data',
                      'Cloud operations',
                    ].map((layer) => (
                      <span
                        key={layer}
                        className="rounded-full border border-white/20 bg-white/14 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur-md sm:text-xs"
                      >
                        {layer}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
              <div className="grid gap-3">
                {[
                  [
                    ServerCog,
                    'Platform services',
                    'Identity, billing, licensing and provisioning.',
                  ],
                  [
                    Database,
                    'Data architecture',
                    'Tenant isolation, governance and resilient storage.',
                  ],
                  [
                    GitBranch,
                    'Delivery systems',
                    'Automated quality checks and repeatable releases.',
                  ],
                  [Workflow, 'Integration layer', 'Secure connections across operational tools.'],
                ].map(([Icon, title, text], index) => {
                  const TechnologyIcon = Icon as typeof ServerCog;
                  return (
                    <motion.div
                      key={title as string}
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.07 }}
                      whileHover={{ x: 5 }}
                      className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-transparent bg-[#f4f7f8] p-5 transition hover:border-primary/10 hover:bg-[#edf6fb]"
                    >
                      <span className="absolute right-4 top-3 text-[10px] font-bold tabular-nums text-[#b1bec7]">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-primary">
                        <TechnologyIcon size={20} />
                      </span>
                      <div>
                        <h3 className="font-bold text-[#123f61]">{title as string}</h3>
                        <p className="mt-1 text-xs leading-5 text-[#667085]">{text as string}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#f3f8fb] px-5 py-20 sm:py-24 md:px-10 lg:px-16 lg:py-28">
          <div className="pointer-events-none absolute -left-36 top-1/3 size-[30rem] rounded-full bg-[#b9dc70]/12 blur-3xl" />
          <div className="mx-auto max-w-[1440px]">
            <div className="relative grid gap-7 lg:grid-cols-[.9fr_1.1fr] lg:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                  How we work
                </p>
                <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-[-0.045em] text-[#123f61] sm:text-5xl">
                  A clear journey from ambition to lasting adoption.
                </h2>
              </div>
              <div className="lg:justify-self-end">
                <p className="max-w-2xl text-base leading-7 text-[#667085]">
                  Our process keeps business direction, user experience and engineering connected.
                  You see decisions, evidence and working progress throughout—not only at the end.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {['Visible progress', 'Shared decisions', 'Measured quality'].map((principle) => (
                    <span
                      key={principle}
                      className="rounded-full bg-white px-3 py-2 text-[10px] font-bold text-[#52677a] shadow-sm"
                    >
                      {principle}
                    </span>
                  ))}
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="View previous process steps"
                    onClick={() => scrollProcess('left')}
                    className="grid size-11 place-items-center rounded-full border border-[#dce7ed] bg-white text-[#123f61] shadow-sm transition hover:border-primary hover:text-primary"
                  >
                    <ArrowLeft size={17} />
                  </button>
                  <button
                    type="button"
                    aria-label="View next process steps"
                    onClick={() => scrollProcess('right')}
                    className="grid size-11 place-items-center rounded-full bg-primary text-white shadow-sm transition hover:bg-primary-600"
                  >
                    <ArrowRight size={17} />
                  </button>
                  <button
                    type="button"
                    aria-label={processPaused ? 'Play process carousel' : 'Pause process carousel'}
                    onClick={() => setProcessPaused((paused) => !paused)}
                    className="grid size-11 place-items-center rounded-full border border-[#dce7ed] bg-white text-[#123f61] shadow-sm transition hover:border-primary hover:text-primary"
                  >
                    {processPaused ? <Play size={16} /> : <Pause size={16} />}
                  </button>
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7b8b99]">
                    {processPaused ? 'Carousel paused' : 'Auto-advancing process'}
                  </span>
                </div>
              </div>
            </div>

            <div className="relative mt-12">
              <div
                ref={processTrackRef}
                onMouseEnter={() => setProcessHovered(true)}
                onMouseLeave={() => setProcessHovered(false)}
                onFocusCapture={() => setProcessHovered(true)}
                onBlurCapture={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setProcessHovered(false);
                }}
                className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {deliverySteps.map(({ number, icon: Icon, title, text, output }, index) => (
                  <motion.article
                    key={number}
                    initial={{ opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.55, delay: index * 0.07 }}
                    whileHover={{ y: -5 }}
                    className="group relative flex min-h-[315px] min-w-[86%] snap-start flex-col rounded-[2rem] border border-white bg-white p-6 shadow-[0_14px_45px_rgba(18,63,97,.05)] transition-shadow after:absolute after:left-16 after:top-[3.1rem] after:h-px after:w-[calc(100%+1rem)] after:bg-primary/35 after:content-[''] last:after:hidden hover:shadow-[0_22px_60px_rgba(18,63,97,.1)] sm:min-w-[48%] sm:p-7 lg:min-w-[31.8%]"
                  >
                    <div className="relative z-10 flex items-center justify-between">
                      <span className="grid size-12 place-items-center rounded-full border-4 border-white bg-primary-50 text-primary shadow-sm transition duration-300 group-hover:bg-primary group-hover:text-white">
                        <Icon size={20} />
                      </span>
                      <span className="rounded-full bg-[#f3f8fb] px-3 py-1.5 text-[10px] font-bold tabular-nums text-[#7c8d9a]">
                        Step {number}
                      </span>
                    </div>
                    <h3 className="mt-7 text-xl font-semibold text-[#123f61]">{title}</h3>
                    <p className="mt-3 text-sm leading-6 text-[#667085]">{text}</p>
                    <div className="mt-auto border-t border-[#e7edf1] pt-5">
                      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-primary">
                        What you receive
                      </p>
                      <p className="mt-2 text-xs font-semibold leading-5 text-[#42566a]">
                        {output}
                      </p>
                    </div>
                  </motion.article>
                ))}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-5 flex flex-col gap-5 rounded-[2rem] bg-[#123f61] p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8"
            >
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-[#b9dc70]">
                  <Compass size={20} />
                </span>
                <div>
                  <h3 className="font-semibold">A process that adapts without losing direction.</h3>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-white/60">
                    The stages stay clear, while the depth and pace adjust to the product,
                    organisation and evidence we discover together.
                  </p>
                </div>
              </div>
              <Link
                href="/contact"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-bold text-[#123f61]"
              >
                Discuss your project <ArrowRight size={15} />
              </Link>
            </motion.div>
          </div>
        </section>

        <section className="bg-white px-5 py-20 sm:py-24 md:px-10 lg:px-16 lg:py-28">
          <div className="mx-auto grid max-w-[1440px] overflow-hidden rounded-[2rem] bg-[#123f61] text-white lg:grid-cols-[1fr_.75fr]">
            <div className="p-7 sm:p-10 lg:p-14">
              <LockKeyhole size={28} className="text-[#b9dc70]" />
              <h2 className="mt-6 max-w-2xl text-3xl font-bold tracking-[-0.05em] sm:text-5xl">
                Software should be easy to trust and enjoyable to use.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/65">
                We combine tenant isolation, governed access, thoughtful automation and responsive
                interaction design from the beginning—not after launch.
              </p>
            </div>
            <div className="grid content-center gap-3 bg-[#e8f3d4] p-7 text-[#38531a] sm:p-10 lg:p-12">
              {[
                'Security and privacy by design',
                'Accessible, responsive interfaces',
                'Observable and maintainable systems',
                'Long-term product partnership',
              ].map((point) => (
                <p key={point} className="flex items-center gap-3 text-sm font-bold">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white">
                    <Check size={14} />
                  </span>
                  {point}
                </p>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#f3f8fb] px-5 py-20 text-center sm:py-24 md:px-10 lg:px-16">
          <div className="mx-auto max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Build what comes next
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.05em] text-[#123f61] sm:text-5xl">
              Have a product or transformation challenge?
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#667085]">
              Tell us where you want to go. We will help shape a practical path from idea to
              reliable software.
            </p>
            <Link
              href="/contact"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-4 text-sm font-bold text-white"
            >
              Talk with Devvelocity <ArrowRight size={17} />
            </Link>
          </div>
        </section>
      </div>
    </PublicSiteLayout>
  );
}

'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import {
  ArrowRight,
  ArrowUpRight,
  Search,
  X,
  GraduationCap,
  BookOpen,
  UserCheck,
  CreditCard,
  Award,
  Video,
  Library,
  Briefcase,
  FileText,
  Home,
  Bus,
  Users,
  MessageSquare,
  Building2,
  ShieldCheck,
  FlaskConical,
  Lock,
  BarChart3,
  CloudCog,
  Landmark,
  Layers,
  CheckCircle2,
  LucideIcon,
} from 'lucide-react';
import { ALL_MODULES } from '../data/modules';
import useSwr from '@/shared/hooks/useSwr';
import type { IProductModule } from '@/features/landing/types/public.types';

type TModuleTier = 'core' | 'standard' | 'premium' | 'ultimate';
type ICatalogModule = (typeof ALL_MODULES)[number] & { tier: TModuleTier };
interface IPublicCatalogResponse {
  data?: { modules: IProductModule[] };
}

/** Map module icon names to actual Lucide Icon components. */
const ICON_MAP: Record<string, LucideIcon> = {
  GraduationCap,
  BookOpen,
  UserCheck,
  CreditCard,
  Award,
  Video,
  Library,
  Briefcase,
  FileText,
  Home,
  Bus,
  Users,
  MessageSquare,
  Building: Building2,
  Building2,
  CloudCog,
  Landmark,
  ShieldCheck,
  FlaskConical,
  Lock,
  BarChart3,
};

const CATEGORIES = [
  { id: 'all', label: 'All Modules', description: 'The complete connected product suite' },
  { id: 'core', label: 'Core', description: 'Essential academic and financial operations' },
  { id: 'standard', label: 'Standard', description: 'Extended administration and campus services' },
  {
    id: 'premium',
    label: 'Premium',
    description: 'Communication, compliance and institutional growth',
  },
  {
    id: 'ultimate',
    label: 'Ultimate',
    description: 'Enterprise intelligence, security and virtual operations',
  },
] as const;

const TIER_STYLES: Record<
  TModuleTier,
  { scene: string; icon: string; badge: string; dot: string }
> = {
  core: {
    scene: 'from-sky-50 to-cyan-50',
    icon: 'bg-sky-600 text-white shadow-sky-200',
    badge: 'bg-sky-100 text-sky-700',
    dot: 'bg-sky-400',
  },
  standard: {
    scene: 'from-emerald-50 to-teal-50',
    icon: 'bg-emerald-600 text-white shadow-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-400',
  },
  premium: {
    scene: 'from-violet-50 to-fuchsia-50',
    icon: 'bg-violet-600 text-white shadow-violet-200',
    badge: 'bg-violet-100 text-violet-700',
    dot: 'bg-violet-400',
  },
  ultimate: {
    scene: 'from-indigo-50 to-blue-50',
    icon: 'bg-indigo-600 text-white shadow-indigo-200',
    badge: 'bg-indigo-100 text-indigo-700',
    dot: 'bg-indigo-400',
  },
};

function fallbackTier(id: string): TModuleTier {
  if (['admissions', 'academics', 'attendance', 'examinations', 'fees'].includes(id)) return 'core';
  if (['communication', 'naac-iqac', 'research'].includes(id)) return 'premium';
  if (['virtual-classrooms', 'security', 'analytics'].includes(id)) return 'ultimate';
  return 'standard';
}

export default function ModulesPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const { data: catalogRaw, isLoading } = useSwr<IPublicCatalogResponse>(
    'super-admin/public-catalog',
  );
  const modules = useMemo<ICatalogModule[]>(() => {
    const live = catalogRaw?.data?.modules?.filter((item) => item.isPublic) ?? [];
    if (!live.length) return ALL_MODULES.map((item) => ({ ...item, tier: fallbackTier(item.id) }));
    return live.map((item) => {
      const detail = ALL_MODULES.find((module) => module.id === item.slug);
      const featureDetails = new Map(
        detail?.features.map((feature) => [feature.title, feature.description]),
      );
      return {
        id: item.slug,
        title: item.name,
        tagline: detail?.tagline ?? `${item.tier} institution capability`,
        description: item.description,
        longDescription: detail?.longDescription ?? item.description,
        color: detail?.color ?? '#0178d7',
        accentColor: detail?.accentColor ?? '#3393df',
        bg: detail?.bg ?? '#edf5fb',
        iconName: item.icon,
        features: item.features.map((title) => ({
          title,
          description:
            featureDetails.get(title) ??
            `Governed ${title.toLowerCase()} workflows connected across the institution.`,
        })),
        sections: detail?.sections ?? [{ heading: item.name, body: item.description }],
        stats: detail?.stats ?? [
          { label: 'Catalogue status', value: item.status },
          { label: 'Capabilities', value: `${item.features.length}` },
        ],
        relatedModules: detail?.relatedModules ?? [],
        tier: item.tier ?? fallbackTier(item.slug),
      };
    });
  }, [catalogRaw]);

  const visibleModules = modules.filter((m) => {
    const matchCat = activeCategory === 'all' || m.tier === activeCategory;
    const matchSearch =
      !search ||
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.tagline.toLowerCase().includes(search.toLowerCase()) ||
      m.description.toLowerCase().includes(search.toLowerCase()) ||
      m.features.some((f) => f.title.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#172033]">
      {/* ── HERO SECTION ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-white px-4 pb-6 pt-5 text-center sm:px-6 sm:pb-12 sm:pt-10 md:px-10 lg:px-16 lg:pb-14 lg:pt-14">
        <div className="relative mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#edf5fb] px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-[#0178d7] sm:mb-4 sm:gap-2 sm:px-4 sm:py-1.5 sm:text-xs"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-[#0178d7]" />
            <span className="sm:hidden">{modules.length} Integrated ERP Modules</span>
            <span className="hidden sm:inline">
              Live Product Catalogue · {modules.length} Integrated Module Families
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="mb-2.5 text-xl font-semibold leading-snug tracking-[-0.025em] text-[#172033] sm:mb-4 sm:text-3xl md:text-5xl lg:text-6xl"
          >
            Every module your campus needs.{' '}
            <span className="mt-0.5 block text-[#0178d7] sm:mt-0 sm:inline">
              One unified platform.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.16 }}
            className="mx-auto mb-4 max-w-xl text-xs leading-5 text-[#667085] sm:mb-7 sm:text-base sm:leading-7"
          >
            Purpose-built ERP capabilities covering every academic, administrative, financial, and
            compliance workflow across your institution.
          </motion.p>

          {/* Interactive Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.24 }}
            className="relative mx-auto max-w-md"
          >
            <div className="relative flex items-center rounded-2xl border border-[#dce7ee] bg-white p-1 shadow-[0_4px_20px_rgba(23,32,51,0.04)] transition-all duration-300 focus-within:border-[#0178d7] focus-within:ring-4 focus-within:ring-[#0178d7]/10 sm:p-1.5">
              <Search className="ml-2.5 h-4 w-4 shrink-0 text-[#8a94a6] sm:ml-3 sm:h-5 sm:w-5" />
              <input
                type="text"
                placeholder="Search modules..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent px-2 py-1.5 text-xs font-medium text-[#172033] placeholder:text-[#8a94a6] focus:outline-none sm:px-3 sm:py-2 sm:text-sm"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="mr-1 grid h-7 w-7 place-items-center rounded-xl bg-[#f2f8fc] text-[#596579] transition-colors hover:bg-[#dceefa] hover:text-[#172033] sm:h-8 sm:w-8"
                >
                  <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              ) : (
                <span className="mr-2 hidden rounded-lg bg-[#f2f8fc] px-2 py-0.5 text-[10px] font-bold text-[#8a94a6] sm:inline-block">
                  Search
                </span>
              )}
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.75, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto mt-7 aspect-[16/8] max-w-5xl overflow-hidden rounded-[2rem] bg-[#edf5fb] sm:mt-10"
          >
            <Image
              src="/images/public-pages/modules-campus-team.png"
              alt="Indian university students, faculty and administrators collaborating with Devvelocity ERP"
              fill
              priority
              sizes="(max-width: 1024px) 92vw, 960px"
              className="object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#172033]/75 to-transparent px-5 pb-5 pt-16 text-left text-white sm:px-8 sm:pb-7">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">
                One connected institution
              </p>
              <p className="mt-2 max-w-xl text-sm font-semibold leading-6 sm:text-lg">
                Daily work becomes accreditation-ready evidence, reliable reports and faster
                decisions.
              </p>
            </div>
            <motion.span
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute right-5 top-5 rounded-2xl bg-white/90 px-4 py-3 text-left backdrop-blur-sm sm:right-8 sm:top-8"
            >
              <span className="block text-lg font-semibold text-[#0178d7]">{modules.length}</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-[#667085]">
                Module families
              </span>
            </motion.span>
          </motion.div>
        </div>
      </section>

      {/* ── MODULE SUITE & CATEGORY FILTER ──────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-4 pb-12 sm:px-6 sm:py-8 sm:pb-16 md:px-10 lg:px-16 lg:pb-24">
        {/* Category Tabs Rail */}
        <div className="mb-4 flex overflow-x-auto pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mb-8 sm:justify-center">
          <div className="flex shrink-0 gap-1.5 rounded-2xl border border-[#dce7ee] bg-white p-1 shadow-sm sm:gap-2 sm:p-1.5">
            {CATEGORIES.map((cat) => {
              const active = activeCategory === cat.id;
              const count =
                cat.id === 'all' ? modules.length : modules.filter((m) => m.tier === cat.id).length;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm ${
                    active ? 'text-white' : 'text-[#596579] hover:bg-[#f2f8fc] hover:text-[#172033]'
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="activeCategoryPill"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="absolute inset-0 rounded-xl bg-[#0178d7] shadow-sm"
                    />
                  )}
                  <span className="relative z-10">{cat.label}</span>
                  <span
                    className={`relative z-10 rounded-full px-1.5 py-0.5 text-[9px] font-semibold sm:px-2 sm:text-[10px] ${
                      active ? 'bg-white/20 text-white' : 'bg-[#edf5fb] text-[#0178d7]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Results Metadata bar */}
        <div className="mb-3.5 flex items-center justify-between sm:mb-6">
          <div>
            <p className="text-xs font-bold text-[#667085]">
              Showing <span className="font-extrabold text-[#172033]">{visibleModules.length}</span>{' '}
              {visibleModules.length === 1 ? 'module' : 'modules'}
              {search && (
                <span className="ml-1 text-[#0178d7]">matching &ldquo;{search}&rdquo;</span>
              )}
            </p>
            <p className="mt-1 text-[11px] text-[#8a94a6]">
              {CATEGORIES.find((category) => category.id === activeCategory)?.description}
            </p>
          </div>
          {(activeCategory !== 'all' || search) && (
            <button
              type="button"
              onClick={() => {
                setActiveCategory('all');
                setSearch('');
              }}
              className="text-xs font-bold text-[#0178d7] transition-colors hover:underline hover:text-[#0165b8]"
            >
              Reset filters
            </button>
          )}
        </div>

        {/* ── DYNAMIC MODULE CARDS GRID ─────────────────────────────── */}
        <motion.div
          layout
          className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3"
        >
          <AnimatePresence mode="popLayout">
            {visibleModules.map((mod, index) => {
              const IconComp = ICON_MAP[mod.iconName] || Layers;
              const tierStyle = TIER_STYLES[mod.tier];

              return (
                <motion.div
                  key={mod.id}
                  layout
                  initial={{ opacity: 0, scale: 0.94, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -12 }}
                  transition={{
                    duration: 0.35,
                    delay: Math.min(index * 0.03, 0.2),
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <Link
                    href={`/modules/${mod.id}`}
                    className="group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-white p-2.5 shadow-[0_18px_50px_-38px_rgba(23,32,51,0.35)] transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_28px_65px_-35px_rgba(1,120,215,0.28)]"
                  >
                    <div
                      className={`relative h-36 overflow-hidden rounded-[1.35rem] bg-gradient-to-br ${tierStyle.scene}`}
                    >
                      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/70" />
                      <div className="absolute bottom-4 left-5 h-2 w-16 rounded-full bg-white/80" />
                      <div className="absolute bottom-4 right-5 h-2 w-8 rounded-full bg-white/80" />
                      <motion.span
                        animate={{ y: [0, -7, 0], rotate: [0, 2, 0] }}
                        transition={{
                          duration: 4 + (index % 3) * 0.5,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                        className={`absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[1.4rem] shadow-lg ${tierStyle.icon}`}
                      >
                        <IconComp className="h-7 w-7" strokeWidth={1.8} />
                      </motion.span>
                      <motion.span
                        animate={{ x: [0, 7, 0], y: [0, -3, 0] }}
                        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                        className={`absolute left-[23%] top-[26%] h-3 w-3 rounded-full ${tierStyle.dot}`}
                      />
                      <motion.span
                        animate={{ x: [0, -6, 0], y: [0, 5, 0] }}
                        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute right-[22%] top-[30%] h-4 w-4 rounded-lg bg-white shadow-sm"
                      />
                      <span
                        className={`absolute left-4 top-4 rounded-full px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.12em] ${tierStyle.badge}`}
                      >
                        {mod.tier}
                      </span>
                      <span className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/80 text-slate-500 backdrop-blur-sm transition-all duration-300 group-hover:bg-white group-hover:text-sky-700">
                        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col px-3 pb-3 pt-5 sm:px-4 sm:pb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold tracking-[-0.015em] text-[#172033] transition-colors group-hover:text-[#0178d7]">
                          {mod.title}
                        </h3>
                        <p className="mt-1 text-xs font-medium text-[#667085]">{mod.tagline}</p>
                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#667085]">
                          {mod.description}
                        </p>

                        <div className="mt-5 space-y-2">
                          {mod.features.slice(0, 2).map((feature) => (
                            <div
                              key={feature.title}
                              className="flex items-center gap-2 text-xs text-slate-600"
                            >
                              <span
                                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${tierStyle.badge}`}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                              </span>
                              <span className="truncate">{feature.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="mt-6 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-medium text-[#0178d7] transition-colors group-hover:bg-sky-50">
                        <span>Explore module</span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
        {isLoading && (
          <p className="mt-4 text-center text-xs font-semibold text-[#8a94a6]">
            Synchronising the latest module catalogue…
          </p>
        )}

        {/* Empty state when query returns no modules */}
        {visibleModules.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mx-auto max-w-md rounded-3xl border border-[#dce7ee] bg-white p-6 text-center shadow-sm sm:p-10"
          >
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[#edf5fb] text-[#0178d7] sm:mb-4 sm:h-14 sm:w-14">
              <Search className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <h3 className="mb-1 text-base font-bold text-[#172033] sm:mb-2 sm:text-lg">
              No modules found
            </h3>
            <p className="mb-4 text-xs text-[#667085] sm:mb-6">
              We couldn&apos;t find any modules matching &ldquo;{search}&rdquo;. Try searching for
              another term or reset the category filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveCategory('all');
                setSearch('');
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0178d7] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0165b8] sm:px-5 sm:py-2.5"
            >
              Reset search filters
            </button>
          </motion.div>
        )}
      </section>

      {/* ── CONVERSION CTA BANNER ───────────────────────────────────── */}
      <section className="px-4 py-8 text-center sm:px-6 sm:py-14 md:px-10 lg:px-16 lg:py-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-6 text-[#172033] sm:p-10 lg:p-16"
        >
          <motion.div
            animate={{ x: [0, 12, 0], y: [0, -8, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -right-10 -top-12 h-44 w-44 rounded-full bg-sky-200/45 blur-2xl"
          />
          <motion.div
            animate={{ x: [0, -9, 0], y: [0, 10, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -bottom-16 -left-8 h-44 w-44 rounded-full bg-indigo-200/40 blur-2xl"
          />
          <div className="relative mx-auto max-w-3xl">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1 text-[10px] font-medium uppercase tracking-wider text-sky-700 sm:mb-4 sm:gap-2 sm:px-4 sm:py-1.5 sm:text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 sm:h-4 sm:w-4" />
              <span>Tailored Sandbox Provisioning</span>
            </span>

            <h2 className="mb-3 text-xl font-semibold tracking-[-0.025em] sm:mb-4 sm:text-3xl lg:text-5xl">
              Ready to experience all {modules.length} modules in action?
            </h2>

            <p className="mb-5 text-xs leading-relaxed text-slate-600 sm:mb-8 sm:text-base sm:leading-7">
              Request access to your dedicated sandbox portal pre-loaded with institutional sample
              data. Explore administrator, faculty, and student workflows live.
            </p>

            <div className="flex flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:items-center sm:gap-4">
              <Link
                href="/demo"
                className="flex items-center justify-center gap-2 rounded-full bg-[#0178d7] px-6 py-3 text-xs font-semibold text-white shadow-md transition-transform hover:-translate-y-0.5 hover:bg-[#0165b8] sm:px-8 sm:py-4 sm:text-base"
              >
                Request Sandbox Demo <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-xs font-medium text-slate-700 transition-colors hover:bg-sky-100 sm:px-8 sm:py-4 sm:text-base"
              >
                Talk to Support
              </Link>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

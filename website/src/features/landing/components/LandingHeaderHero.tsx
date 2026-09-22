/**
 * @file LandingHeaderHero.tsx
 * @description Responsive light navigation and product-led hero for the public site.
 * @module features/landing
 */

'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  GraduationCap,
  LayoutDashboard,
  MessageCircle,
  ShieldCheck,
  UsersRound,
  Video,
  WalletCards,
} from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import { IPublicSiteConfig, IProductModule } from '@/features/landing/types/public.types';

interface ILandingHeaderHeroProps {
  site: IPublicSiteConfig | null;
  modules: IProductModule[];
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function LandingHeaderHero({ site, modules }: ILandingHeaderHeroProps) {
  const greeting = getGreeting();

  const headline = site?.headline || 'Run your institution with one connected operating system.';
  const description =
    site?.description ||
    'Bring academics, finance, people and campus operations into one dependable workspace.';
  const activeModules = modules.filter((module) => module.status === 'active').slice(0, 3);
  const moduleLabels = activeModules.length
    ? activeModules.map((module) => module.name)
    : ['Academic Management', 'Fees & Accounts', 'Communication'];

  return (
    <section className="relative overflow-hidden px-5 pt-4 pb-12 sm:px-8 sm:pt-6 sm:pb-16 md:px-10 md:pt-8 md:pb-20 lg:px-16 lg:pt-10 lg:pb-24">
      <div className="absolute -left-32 top-16 h-96 w-96 rounded-full bg-[#e1f2fc] blur-3xl" />
      <div className="absolute -right-40 top-0 h-[520px] w-[520px] rounded-full bg-[#fff0e8] opacity-70 blur-3xl" />

      <div className="relative mx-auto grid max-w-[1440px] items-center gap-6 sm:gap-10 lg:grid-cols-[.86fr_1.14fr] lg:gap-16">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="max-w-2xl"
        >
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#edf5fb] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#0178d7] sm:px-4 sm:py-1.5 sm:text-[11px]">
            <ShieldCheck size={14} /> Multi-campus education ERP
          </div>
          <h1 className="mt-2.5 text-2xl font-bold leading-[1.12] tracking-tight text-[#172033] sm:mt-5 sm:text-4xl md:text-5xl lg:text-[3.9rem] xl:text-[4.35rem]">
            {headline}
          </h1>
          <p className="mt-2 text-xs font-medium leading-5 text-[#596579] sm:mt-4 sm:text-base sm:leading-7">
            {description}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-7 sm:gap-3">
            <Link
              href="/demo"
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#0178d7] px-4 py-2 text-xs font-bold text-white shadow-sm transition-all duration-300 hover:bg-[#0165b8] hover:shadow-md active:scale-95 sm:gap-2 sm:px-6 sm:py-3.5 sm:text-sm"
            >
              Explore a live demo <ArrowRight size={14} className="sm:hidden" />
              <ArrowRight size={18} className="hidden sm:block" />
            </Link>
            <a
              href="#collaboration"
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#dce7ee] bg-[#edf5fb] px-4 py-2 text-xs font-bold text-[#172033] transition-all duration-300 hover:bg-[#dceefa] active:scale-95 sm:px-6 sm:py-3.5 sm:text-sm"
            >
              See connected collaboration
            </a>
          </div>
          <div className="mt-3.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-[#596579] sm:mt-7 sm:gap-x-5 sm:gap-y-2 sm:text-xs">
            {['Tenant isolated', 'Role-based access', 'Audit ready'].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-[#7da13d] sm:hidden" />
                <CheckCircle2 size={14} className="hidden text-[#7da13d] sm:block" />
                {item}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.75, delay: 0.12, ease: 'easeOut' }}
          className="relative mx-auto w-full max-w-3xl"
        >
          <div className="absolute -inset-5 rounded-[3rem] bg-white/60 blur-xl" />
          <div className="relative overflow-hidden rounded-2xl bg-white p-2.5 shadow-[0_35px_100px_rgba(23,32,51,0.14)] sm:rounded-[2rem] sm:p-4">
            <div className="flex items-center justify-between px-2 pb-2.5 sm:pb-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="h-2 w-2 rounded-full bg-[#ff7657] sm:h-2.5 sm:w-2.5" />
                <span className="h-2 w-2 rounded-full bg-[#f4c95d] sm:h-2.5 sm:w-2.5" />
                <span className="h-2 w-2 rounded-full bg-[#9bb94f] sm:h-2.5 sm:w-2.5" />
              </div>
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8a94a6] sm:text-[10px]">
                Institution command centre
              </p>
            </div>
            <div className="grid min-h-[360px] overflow-hidden rounded-[1.2rem] bg-[#f4f8fb] sm:min-h-[460px] sm:grid-cols-[82px_1fr] sm:rounded-[1.45rem]">
              <div className="hidden flex-col items-center bg-[#172033] py-6 text-white sm:flex">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0178d7]">
                  <GraduationCap size={20} />
                </span>
                <div className="mt-10 space-y-3">
                  {[LayoutDashboard, UsersRound, WalletCards, MessageCircle, BarChart3].map(
                    (Icon, index) => (
                      <span
                        key={index}
                        className={`grid h-10 w-10 place-items-center rounded-xl ${index === 0 ? 'bg-white text-[#172033]' : 'text-[#9ba8ba]'}`}
                      >
                        <Icon size={18} />
                      </span>
                    ),
                  )}
                </div>
              </div>
              <div className="p-3 sm:p-6">
                <div className="flex items-start justify-between gap-2 sm:gap-4">
                  <div>
                    <p className="text-[10px] font-semibold text-[#8a94a6] sm:text-[11px]">
                      {greeting}
                    </p>
                    <h2 className="mt-0.5 text-base font-bold tracking-[-0.03em] text-[#172033] sm:mt-1 sm:text-xl">
                      Institution overview
                    </h2>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#e8f3d4] px-2 py-0.5 text-[8px] font-bold text-[#63812d] sm:px-3 sm:py-1.5 sm:text-[10px]">
                    All systems healthy
                  </span>
                </div>
                <div className="mt-3.5 grid grid-cols-3 gap-1.5 sm:mt-6 sm:gap-3">
                  {[
                    {
                      label: 'Active students',
                      value: '4,820',
                      icon: UsersRound,
                      color: 'bg-[#dceefa] text-[#0178d7]',
                    },
                    {
                      label: 'Fee collection',
                      value: '94.2%',
                      icon: WalletCards,
                      color: 'bg-[#e8f3d4] text-[#63812d]',
                    },
                    {
                      label: 'Attendance',
                      value: '91.8%',
                      icon: BarChart3,
                      color: 'bg-[#fff0e8] text-[#d55235]',
                    },
                  ].map((metric) => (
                    <div
                      key={metric.label}
                      className="rounded-xl bg-white p-2 sm:rounded-2xl sm:p-4"
                    >
                      <span
                        className={`grid h-7 w-7 place-items-center rounded-lg sm:h-9 sm:w-9 sm:rounded-xl ${metric.color}`}
                      >
                        <metric.icon size={13} className="sm:hidden" />
                        <metric.icon size={16} className="hidden sm:block" />
                      </span>
                      <p className="mt-1.5 text-sm font-bold text-[#172033] sm:mt-4 sm:text-xl">
                        {metric.value}
                      </p>
                      <p className="truncate text-[8px] font-semibold text-[#8a94a6] sm:mt-1 sm:text-[10px]">
                        {metric.label}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid gap-2.5 sm:gap-3 lg:grid-cols-[1.15fr_.85fr]">
                  <div className="rounded-xl bg-white p-3 sm:rounded-2xl sm:p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-bold text-[#172033] sm:text-xs">
                          Today across campus
                        </p>
                        <p className="mt-0.5 text-[9px] text-[#8a94a6] sm:mt-1 sm:text-[10px]">
                          Live operational activity
                        </p>
                      </div>
                      <span className="rounded-full bg-[#edf5fb] px-2 py-0.5 text-[8px] font-bold text-[#0178d7] sm:px-2.5 sm:py-1 sm:text-[9px]">
                        LIVE
                      </span>
                    </div>
                    <div className="mt-3 space-y-2 sm:mt-5 sm:space-y-3">
                      {moduleLabels.map((label, index) => (
                        <div key={label} className="flex items-center gap-2 sm:gap-3">
                          <span
                            className={`h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2 ${index === 0 ? 'bg-[#0178d7]' : index === 1 ? 'bg-[#9bb94f]' : 'bg-[#ff7657]'}`}
                          />
                          <span className="flex-1 truncate text-[10px] font-semibold text-[#596579] sm:text-[11px]">
                            {label}
                          </span>
                          <span className="text-[8px] text-[#98a2b3] sm:text-[9px]">
                            Updated now
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col rounded-xl bg-[#dceefa] p-3 sm:rounded-2xl sm:p-4">
                    <div className="flex items-center justify-between">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-[#0178d7] sm:h-9 sm:w-9 sm:rounded-xl">
                        <Video size={14} className="sm:hidden" />
                        <Video size={16} className="hidden sm:block" />
                      </span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[8px] font-bold text-[#16846b] sm:py-1 sm:text-[9px]">
                        LIVE
                      </span>
                    </div>
                    <p className="mt-3 text-xs font-bold text-[#172033] sm:mt-5 sm:text-sm">
                      Academic review meeting
                    </p>
                    <p className="mt-0.5 text-[9px] leading-4 text-[#667085] sm:mt-1 sm:text-[10px] sm:leading-5">
                      12 participants · attendance tracked
                    </p>
                    <div className="mt-auto flex items-center justify-between pt-3 sm:pt-5">
                      <div className="flex -space-x-1.5 sm:-space-x-2">
                        {['AD', 'EX', 'FI'].map((name) => (
                          <span
                            key={name}
                            className="grid h-6 w-6 place-items-center rounded-full border-2 border-[#dceefa] bg-white text-[7px] font-bold text-[#0178d7] sm:h-7 sm:w-7 sm:text-[8px]"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                      <span className="text-[9px] font-bold text-[#0178d7] sm:text-[10px]">
                        Open room
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <motion.div
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -bottom-6 -left-4 hidden items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_18px_50px_rgba(23,32,51,0.14)] sm:flex"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e8f3d4] text-[#63812d]">
              <MessageCircle size={17} />
            </span>
            <div>
              <p className="text-[10px] font-bold text-[#172033]">Connected collaboration</p>
              <p className="mt-0.5 text-[9px] text-[#8a94a6]">Chat · Voice · Video · Meetings</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

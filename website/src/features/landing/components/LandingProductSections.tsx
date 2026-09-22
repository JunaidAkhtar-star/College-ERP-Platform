/**
 * @file LandingProductSections.tsx
 * @description Dynamic module, capability, plan, conversion, and footer sections.
 * @module features/landing
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudCog,
  FileCheck2,
  GraduationCap,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  UsersRound,
  MessageCircle,
  Phone,
  Video,
  MonitorUp,
  Hand,
  RadioTower,
  Mic,
  Send,
  Paperclip,
  Search,
} from 'lucide-react';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import {
  IProductAddon,
  IProductModule,
  ISubscriptionPlan,
} from '@/features/landing/types/public.types';

interface ILandingProductSectionsProps {
  modules: IProductModule[];
  plans: ISubscriptionPlan[];
  addons: IProductAddon[];
  isLoading: boolean;
}

const COLLABORATION_EXPERIENCES = [
  {
    id: 'chat',
    label: 'Chat',
    icon: MessageCircle,
    title: 'Conversations stay connected to campus work.',
    description:
      'Move from a direct or group conversation into a call without switching tools or losing institutional context.',
    points: [
      'Direct and governed group chat',
      'Persistent messages and presence',
      'One-click escalation to a call',
    ],
  },
  {
    id: 'voice',
    label: 'Voice call',
    icon: Phone,
    title: 'Fast voice calls for decisions that cannot wait.',
    description:
      'Reach colleagues securely from the ERP directory with availability, missed-call history and conversation continuity.',
    points: [
      'One-to-one voice calls',
      'Availability and call history',
      'Secure tenant-scoped signalling',
    ],
  },
  {
    id: 'video',
    label: 'Video call',
    icon: Video,
    title: 'Face-to-face collaboration inside the same workspace.',
    description:
      'Start a private video call, share the screen and continue the discussion in persistent chat.',
    points: [
      'Single and group video',
      'Screen sharing and device controls',
      'Network-aware Agora media',
    ],
  },
  {
    id: 'meeting',
    label: 'Meetings',
    icon: RadioTower,
    title: 'A governed meeting experience built into your ERP.',
    description:
      'Schedule institutional meetings with attendance, host controls, secure recordings and plan-aware capacity managed automatically.',
    points: [
      'Lobby, co-hosts, lock and moderation',
      'Recording, retention and attendance',
      'Recurring meetings and usage governance',
    ],
  },
] as const;

/** Highlights the governed communication workflow built directly into the ERP. */
function CollaborationShowcase() {
  const experiences = COLLABORATION_EXPERIENCES;
  const [activeId, setActiveId] =
    useState<(typeof COLLABORATION_EXPERIENCES)[number]['id']>('meeting');
  const [paused, setPaused] = useState(false);
  const active = experiences.find((experience) => experience.id === activeId) ?? experiences[3];

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const interval = setInterval(() => {
      setActiveId((currentId) => {
        const currentIndex = COLLABORATION_EXPERIENCES.findIndex((e) => e.id === currentId);
        const nextIndex = (currentIndex + 1) % COLLABORATION_EXPERIENCES.length;
        return COLLABORATION_EXPERIENCES[nextIndex].id;
      });
    }, 4500);
    return () => clearInterval(interval);
  }, [paused]);

  return (
    <section
      id="collaboration"
      className="bg-white px-5 py-16 sm:py-20 md:px-10 md:py-24 lg:px-16 lg:py-28"
    >
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.65 }}
        className="mx-auto max-w-[1440px]"
      >
        <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr] lg:items-end lg:gap-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0178d7]">
              Connected collaboration
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-[-0.045em] text-[#172033] sm:mt-5 sm:text-4xl md:text-5xl lg:text-6xl">
              From a message to a meeting.{' '}
              <span className="text-[#6f7d92]">Without leaving the ERP.</span>
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-[#667085] sm:text-lg sm:leading-8 lg:justify-self-end">
            Chat, voice, video and Devvelocity Meetings work as one governed communication layer for
            academic and administrative teams.
          </p>
        </div>

        <div
          className="mt-10 grid overflow-hidden rounded-2xl bg-[#f2f8fc] sm:mt-14 sm:rounded-[2.5rem] lg:grid-cols-[.85fr_1.15fr]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <div className="p-5 sm:p-9 lg:p-12">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
              {experiences.map((experience) => {
                const Icon = experience.icon;
                const selected = experience.id === active.id;
                return (
                  <button
                    key={experience.id}
                    type="button"
                    onClick={() => setActiveId(experience.id)}
                    className={`relative flex items-center gap-2 overflow-hidden rounded-xl px-3 py-2.5 text-left text-xs font-bold transition-all sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm ${selected ? 'bg-[#0178d7] text-white shadow-md' : 'bg-white text-[#596579] hover:text-[#0178d7]'}`}
                  >
                    {selected && (
                      <motion.span
                        key={`collab-progress-${experience.id}`}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 4.5, ease: 'linear' }}
                        className="absolute inset-x-0 bottom-0 h-1 origin-left bg-white/40"
                      />
                    )}
                    <Icon className="h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px]" />
                    <span>{experience.label}</span>
                  </button>
                );
              })}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <h3 className="mt-6 text-xl font-bold tracking-[-0.035em] text-[#172033] sm:mt-9 sm:text-3xl">
                  {active.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[#667085] sm:mt-4 sm:text-base sm:leading-7">
                  {active.description}
                </p>
                <div className="mt-5 space-y-2.5 sm:mt-7 sm:space-y-3">
                  {active.points.map((point) => (
                    <p
                      key={point}
                      className="flex items-center gap-2.5 text-xs font-semibold text-[#475467] sm:gap-3 sm:text-sm"
                    >
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#e8f3d4] text-[#63812d] sm:h-6 sm:w-6">
                        <Check size={12} />
                      </span>
                      {point}
                    </p>
                  ))}
                </div>
                <Link
                  href="/modules/virtual-classrooms"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#0178d7] sm:mt-9"
                >
                  Explore connected collaboration <ArrowRight size={16} />
                </Link>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="relative min-h-[400px] overflow-hidden bg-[#e4f1fa] p-3.5 sm:p-8 lg:p-10">
            <div className="absolute inset-x-10 top-8 h-48 rounded-full bg-white/70 blur-3xl" />
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.98 }}
                transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
                className="relative mx-auto h-full max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-[0_28px_80px_rgba(23,32,51,0.12)]"
              >
                {active.id === 'chat' && (
                  <div className="grid h-full min-h-[420px] grid-cols-1 sm:grid-cols-[.38fr_.62fr]">
                    <div className="hidden bg-[#f5f8fa] p-4 sm:block sm:p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-[#172033]">Campus chat</p>
                          <p className="mt-1 text-[10px] text-[#7b8798]">18 colleagues online</p>
                        </div>
                        <MessageCircle size={18} className="text-[#0178d7]" />
                      </div>
                      <div className="mt-4 flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[#98a2b3]">
                        <Search size={14} />
                        <span className="text-[10px]">Search conversations</span>
                      </div>
                      <div className="mt-4 space-y-2">
                        {[
                          'Examination Cell',
                          'Academic Council',
                          'Finance Office',
                          'Dr. Meera Rao',
                        ].map((name, index) => (
                          <div
                            key={name}
                            className={`flex items-center gap-2 rounded-xl p-2.5 ${index === 0 ? 'bg-[#dceefa]' : 'bg-transparent'}`}
                          >
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[10px] font-bold text-[#0178d7]">
                              {name
                                .split(' ')
                                .map((part) => part[0])
                                .join('')
                                .slice(0, 2)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-bold text-[#354052]">
                                {name}
                              </p>
                              <p className="truncate text-[9px] text-[#8a94a6]">
                                {index === 0 ? 'Semester review updated' : 'Active recently'}
                              </p>
                            </div>
                            {index === 0 && (
                              <span className="ml-auto grid h-5 w-5 place-items-center rounded-full bg-[#ff7657] text-[9px] font-bold text-white">
                                3
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-col p-3.5 sm:p-5">
                      <div className="flex items-center justify-between border-b border-[#edf1f4] pb-3">
                        <div>
                          <p className="text-xs font-bold text-[#172033]">Examination Cell</p>
                          <p className="mt-0.5 text-[9px] text-[#16846b]">6 members · online</p>
                        </div>
                        <div className="flex gap-2">
                          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#edf5fb] text-[#0178d7]">
                            <Phone size={13} />
                          </span>
                          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#0178d7] text-white">
                            <Video size={13} />
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col justify-end gap-3 py-4">
                        <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-[#f2f5f7] px-3 py-2 text-[10px] leading-5 text-[#475467] sm:max-w-[82%] sm:py-2.5">
                          The revised seating matrix is ready for approval.
                        </div>
                        <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-[#0178d7] px-3 py-2 text-[10px] leading-5 text-white sm:max-w-[82%] sm:py-2.5">
                          Reviewed. Let&apos;s start a video call and confirm allocation.
                        </div>
                        <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-[#fff0e8] px-3 py-2 text-[10px] font-semibold leading-5 text-[#9f432d] sm:max-w-[82%] sm:py-2.5">
                          Video room created · Join now
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl bg-[#f5f8fa] px-3 py-2">
                        <Paperclip size={14} className="text-[#7b8798]" />
                        <span className="flex-1 text-[10px] text-[#98a2b3]">Write a message…</span>
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#0178d7] text-white">
                          <Send size={12} />
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {(active.id === 'voice' || active.id === 'video') && (
                  <div className="flex h-full min-h-[420px] flex-col items-center justify-center bg-[#f6f9fb] p-6 text-center sm:p-8">
                    <div className="relative">
                      <span className="absolute inset-0 animate-ping rounded-full bg-[#b8d9ef]/50" />
                      <span className="relative grid h-16 w-16 place-items-center rounded-full bg-white text-lg font-bold text-[#0178d7] shadow-[0_18px_45px_rgba(23,32,51,0.1)] sm:h-24 sm:w-24 sm:text-2xl">
                        MR
                      </span>
                    </div>
                    <p className="mt-5 text-lg font-bold text-[#172033] sm:mt-7 sm:text-xl">
                      Dr. Meera Rao
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#16846b] sm:mt-2">
                      {active.id === 'voice' ? 'Voice call connected' : 'Private video call · HD'}
                    </p>
                    {active.id === 'video' && (
                      <div className="mt-5 grid h-24 w-full max-w-xs place-items-center rounded-2xl bg-[#dceefa] text-[10px] font-bold text-[#0178d7] sm:mt-7 sm:h-32 sm:max-w-sm sm:text-xs">
                        Live video preview
                      </div>
                    )}
                    <div className="mt-6 flex gap-3 sm:mt-8">
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#475467] sm:h-12 sm:w-12">
                        <Mic size={16} />
                      </span>
                      {active.id === 'video' && (
                        <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#475467] sm:h-12 sm:w-12">
                          <Video size={16} />
                        </span>
                      )}
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-[#ff7657] text-white sm:h-12 sm:w-12">
                        <Phone size={16} />
                      </span>
                    </div>
                  </div>
                )}
                {active.id === 'meeting' && (
                  <div className="flex h-full min-h-[420px] flex-col p-3 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8eef3] pb-3">
                      <div>
                        <p className="text-xs font-bold text-[#172033] sm:text-sm">
                          Academic operations review
                        </p>
                        <p className="mt-0.5 text-[9px] text-[#7b8798] sm:text-[10px]">
                          12 participants · Recording governed
                        </p>
                      </div>
                      <span className="flex items-center gap-1 rounded-full bg-[#e8f3d4] px-2.5 py-1 text-[9px] font-bold text-[#63812d] sm:gap-2 sm:px-3 sm:py-1.5 sm:text-[10px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#7da13d]" />
                        Live
                      </span>
                    </div>
                    <div className="grid flex-1 grid-cols-2 gap-2 py-3 sm:gap-3 sm:py-4">
                      {['Academic Dean', 'Examination Cell', 'Finance Office', 'Quality Team'].map(
                        (name, index) => (
                          <div
                            key={name}
                            className={`relative flex min-h-24 flex-col items-center justify-center rounded-xl p-2 sm:min-h-32 sm:rounded-2xl ${index === 0 ? 'bg-[#dceefa]' : 'bg-[#f3f6f8]'}`}
                          >
                            <div className="grid h-10 w-10 place-items-center rounded-full bg-white text-xs font-bold text-[#0178d7] sm:h-14 sm:w-14 sm:text-lg">
                              {name
                                .split(' ')
                                .map((part) => part[0])
                                .join('')
                                .slice(0, 2)}
                            </div>
                            <p className="mt-2 text-[10px] font-bold text-[#475467] sm:absolute sm:bottom-3 sm:left-3 sm:mt-0 sm:text-xs">
                              {name}
                            </p>
                            {index === 2 && (
                              <span className="rounded-full bg-[#fff0e8] px-1.5 py-0.5 text-[8px] font-bold text-[#d55235] sm:absolute sm:right-3 sm:top-3 sm:px-2 sm:py-1 sm:text-[9px]">
                                HAND RAISED
                              </span>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-[#f6f8fa] p-2.5 sm:gap-2 sm:p-3">
                      {/* Control Buttons */}
                      <div className="flex gap-1">
                        {[Mic, Video, MonitorUp, Hand].map((Icon, idx) => (
                          <span
                            key={idx}
                            className={`grid h-8 w-8 place-items-center rounded-full bg-white text-[#475467] sm:h-10 sm:w-10 ${idx === 3 ? 'bg-[#fff0e8] text-[#d55235]' : ''}`}
                          >
                            <Icon size={14} className="sm:hidden" />
                            <Icon size={17} className="hidden sm:block" />
                          </span>
                        ))}
                      </div>
                      <span className="ml-2 rounded-full bg-[#ff7657] px-3.5 py-2 text-[10px] font-bold text-white sm:ml-3 sm:px-5 sm:py-2.5 sm:text-xs">
                        End meeting
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

/** Displays an API-backed skeleton while public catalog content is loading. */
function CatalogSkeleton() {
  return (
    <div className="mx-auto grid max-w-[1440px] gap-5 px-5 py-24 md:grid-cols-3 md:px-10 lg:px-16">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-72 animate-pulse rounded-[2rem] bg-[#edf5fb]" />
      ))}
    </div>
  );
}

/** Renders a selectable product-module narrative inspired by the supplied reference. */
function PlatformStory() {
  const valuableFeatures = useMemo(
    () => [
      {
        id: 'tenant-core',
        name: 'Multi-tenant Institution Core',
        badge: 'Platform foundation',
        description:
          'Give every institution an isolated, configurable workspace while Devvelocity manages plans, entitlements, provisioning and platform operations centrally.',
        features: [
          'Tenant-isolated data context',
          'Institution branding and configuration',
          'Dynamic plans, modules and limits',
          'Automated tenant provisioning',
        ],
      },
      {
        id: 'collaboration',
        name: 'Real-time Chat & Collaboration',
        badge: 'Premium collaboration',
        description:
          'Bring direct and team communication into the same governed workspace where academic and operational work already happens.',
        features: [
          'Direct and group conversations',
          'Role-aware communication',
          'Message and attachment governance',
          'Real-time notifications',
        ],
      },
      {
        id: 'voice-video',
        name: 'Voice & Video Calling',
        badge: 'Premium communication',
        description:
          'Move naturally from a conversation to secure voice or video without sending users into disconnected communication tools.',
        features: [
          'One-to-one voice calls',
          'Video meetings and classrooms',
          'Participant controls',
          'Responsive browser experience',
        ],
      },
      {
        id: 'meeting-experience',
        name: 'Connected Meeting Experience',
        badge: 'Premium meetings',
        description:
          'Schedule and run classes, team discussions and institutional sessions inside Devvelocity through its own familiar, browser-based meeting experience.',
        features: [
          'Devvelocity meeting rooms',
          'Familiar Meet-style experience',
          'Calendar-linked scheduling',
          'Meeting lifecycle and attendance',
        ],
      },
      {
        id: 'automation',
        name: 'Business-rule Automation',
        badge: 'Operational intelligence',
        description:
          'Turn institutional policy into dependable workflows that calculate, validate, approve, notify and transition records consistently.',
        features: [
          'Governed lifecycle transitions',
          'Eligibility and policy validation',
          'Automated alerts and approvals',
          'Reduced duplicate data entry',
        ],
      },
      {
        id: 'security',
        name: 'Security, Roles & Audit',
        badge: 'Enterprise governance',
        description:
          'Protect sensitive operations with backend-enforced permissions, commercial entitlements and traceable activity across every institution.',
        features: [
          'Role and permission enforcement',
          'Backend module entitlements',
          'Audit history and accountability',
          'Security-focused tenant boundaries',
        ],
      },
      {
        id: 'intelligence',
        name: 'Compliance-ready Intelligence',
        badge: 'Leadership insight',
        description:
          'Connect daily work to management dashboards, evidence and reports so leadership can act without rebuilding information manually.',
        features: [
          'Cross-functional dashboards',
          'Evidence-ready operational records',
          'NAAC, NBA and OBE support',
          'Actionable institutional reporting',
        ],
      },
    ],
    [],
  );
  const [selectedId, setSelectedId] = useState(valuableFeatures[0].id);
  const [paused, setPaused] = useState(false);
  const moduleRailRef = useRef<HTMLDivElement>(null);
  const selected =
    valuableFeatures.find((feature) => feature.id === selectedId) ?? valuableFeatures[0];
  const selectedIndex = Math.max(
    0,
    valuableFeatures.findIndex((feature) => feature.id === selected.id),
  );

  const selectRelative = useCallback(
    (direction: 1 | -1) => {
      const nextIndex =
        (selectedIndex + direction + valuableFeatures.length) % valuableFeatures.length;
      setSelectedId(valuableFeatures[nextIndex].id);
    },
    [selectedIndex, valuableFeatures],
  );

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => selectRelative(1), 5200);
    return () => window.clearInterval(timer);
  }, [paused, selectRelative]);

  useEffect(() => {
    const rail = moduleRailRef.current;
    const activeItem = moduleRailRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    if (!rail || !activeItem) return;
    const targetTop =
      activeItem.offsetTop - rail.offsetTop - (rail.clientHeight - activeItem.offsetHeight) / 2;
    rail.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
  }, [selected.id]);

  return (
    <section
      id="platform"
      className="bg-[#f2f8fc] px-5 py-16 sm:py-20 md:px-10 md:py-24 lg:px-16 lg:py-28"
    >
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2, margin: '0px 0px -18% 0px' }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
        className="mx-auto max-w-[1440px]"
      >
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0178d7]">
            Connected platform
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.045em] text-[#172033] sm:mt-5 sm:text-4xl md:text-5xl lg:text-6xl">
            Every campus function. <span className="text-[#6f7d92]">One calm workspace.</span>
          </h2>
        </div>

        <div
          className="mt-8 grid overflow-hidden rounded-2xl bg-white sm:mt-14 sm:rounded-[2.5rem] lg:grid-cols-[.72fr_1.28fr]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          {/* Mobile horizontal tab strip */}
          <div className="flex gap-2 overflow-x-auto bg-[#e6f2fb] p-3 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
            {valuableFeatures.map((feature, index) => {
              const active = feature.id === selected.id;
              return (
                <button
                  key={feature.id}
                  type="button"
                  onClick={() => setSelectedId(feature.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all ${
                    active
                      ? 'bg-[#0178d7] text-white shadow-md'
                      : 'bg-white/80 text-[#596579] hover:bg-white'
                  }`}
                >
                  <span className={active ? 'text-white' : 'text-[#ff7657]'}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="max-w-[150px] truncate">{feature.name}</span>
                </button>
              );
            })}
          </div>

          {/* Desktop vertical rail */}
          <div
            ref={moduleRailRef}
            className="hidden max-h-[760px] overflow-y-auto bg-[#e6f2fb] p-3 [scrollbar-width:thin] sm:p-5 lg:block"
          >
            {valuableFeatures.map((feature, index) => {
              const active = feature.id === selected.id;
              return (
                <button
                  key={feature.id}
                  data-active={active}
                  type="button"
                  onClick={() => setSelectedId(feature.id)}
                  className={`relative flex w-full items-center gap-4 overflow-hidden rounded-2xl px-4 py-4 text-left transition-colors sm:px-5 ${
                    active ? 'bg-white text-[#172033]' : 'text-[#637086] hover:bg-white/60'
                  }`}
                >
                  {active && (
                    <motion.span
                      key={`progress-${selected.id}`}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 5.2, ease: 'linear' }}
                      className="absolute inset-x-0 bottom-0 h-1 origin-left bg-[#0178d7]"
                    />
                  )}
                  <span
                    className={`text-xl font-bold ${active ? 'text-[#ff7657]' : 'text-[#8aa9be]'}`}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="flex-1 font-semibold">
                    {feature.name}
                    {index === 2 && (
                      <span className="ml-2 inline-flex rounded-full bg-[#fff0e8] px-2 py-0.5 align-middle text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#d55235]">
                        Most valuable
                      </span>
                    )}
                    {index === 3 && (
                      <span className="ml-2 inline-flex rounded-full bg-[#e8f3d4] px-2 py-0.5 align-middle text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#63812d]">
                        New
                      </span>
                    )}
                  </span>
                  <ChevronRight size={18} />
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="p-4 sm:p-8 lg:p-14"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
                <span className="inline-flex rounded-full bg-[#fff0e8] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#d55235] sm:px-4 sm:py-2 sm:text-xs">
                  {selected.badge}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => selectRelative(-1)}
                    aria-label="Previous platform module"
                    className="grid h-9 w-9 place-items-center rounded-full border border-[#dce7ee] text-[#596579] hover:border-[#0178d7] hover:text-[#0178d7] sm:h-10 sm:w-10"
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => selectRelative(1)}
                    aria-label="Next platform module"
                    className="grid h-9 w-9 place-items-center rounded-full bg-[#172033] text-white hover:bg-[#0178d7] sm:h-10 sm:w-10"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
              <h3 className="mt-4 text-xl font-bold tracking-[-0.035em] text-[#172033] sm:mt-7 sm:text-3xl lg:text-4xl">
                {selected.name}
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#667085] sm:mt-5 sm:text-base sm:leading-7 lg:text-lg lg:leading-8">
                {selected.description}
              </p>
              <div className="mt-5 grid gap-2.5 sm:mt-8 sm:grid-cols-2">
                {selected.features.map((feature) => (
                  <div
                    key={feature}
                    className="flex items-start gap-2.5 rounded-2xl bg-[#f6f8fa] p-3 sm:p-4"
                  >
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#e8f3d4] text-[#63812d] sm:h-6 sm:w-6">
                      <Check size={13} />
                    </span>
                    <span className="text-xs font-semibold leading-5 text-[#475467] sm:text-sm sm:leading-6">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
              <Link
                href="/demo"
                className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#0178d7] sm:mt-9 sm:text-base"
              >
                See this capability in a tailored demo <ArrowRight size={17} />
              </Link>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </section>
  );
}

/** Converts every active module into a concise capability card. */
function CapabilityGrid({ modules }: { modules: IProductModule[] }) {
  const capabilities = modules.filter((module) => module.isPublic && module.status === 'active');
  const trackRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const move = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.firstElementChild as HTMLElement | null;
    const distance = (card?.offsetWidth || 360) + 20;
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
    const atStart = track.scrollLeft <= 8;
    if (direction === 1 && atEnd) track.scrollTo({ left: 0, behavior: 'smooth' });
    else if (direction === -1 && atStart)
      track.scrollTo({ left: track.scrollWidth, behavior: 'smooth' });
    else track.scrollBy({ left: direction * distance, behavior: 'smooth' });
  };

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => move(1), 4500);
    return () => window.clearInterval(timer);
  }, [paused]);

  if (!capabilities.length) return null;

  const colors = ['bg-[#fff0e8]', 'bg-[#edf5fb]', 'bg-[#f0f5e5]', 'bg-[#f5efff]'];
  return (
    <section id="capabilities" className="px-5 py-16 sm:py-20 md:px-10 md:py-24 lg:px-16 lg:py-28">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2, margin: '0px 0px -18% 0px' }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
        className="mx-auto max-w-[1440px]"
      >
        <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr] lg:items-end lg:gap-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff7657]">
              Core capabilities
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.045em] sm:mt-5 sm:text-4xl md:text-5xl">
              Precision at every layer.
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-[#667085] sm:text-base sm:leading-7 lg:justify-self-end lg:text-lg lg:leading-8">
            Purpose-built workflows help institutions replace disconnected tools with governed,
            measurable operations.
          </p>
        </div>
        <div className="mt-6 flex items-center justify-between gap-4 sm:mt-10">
          <p className="text-xs font-semibold text-[#667085] sm:text-sm">
            Swipe or use the arrows to explore every capability.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label="Previous capability"
              className="grid h-9 w-9 place-items-center rounded-full border border-[#dbe5ec] bg-white text-[#172033] transition hover:border-[#0178d7] hover:text-[#0178d7] sm:h-11 sm:w-11"
            >
              <ChevronLeft size={18} className="sm:hidden" />
              <ChevronLeft size={20} className="hidden sm:block" />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label="Next capability"
              className="grid h-9 w-9 place-items-center rounded-full bg-[#172033] text-white transition hover:bg-[#0178d7] sm:h-11 sm:w-11"
            >
              <ChevronRight size={18} className="sm:hidden" />
              <ChevronRight size={20} className="hidden sm:block" />
            </button>
          </div>
        </div>
        <div
          ref={trackRef}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none] sm:mt-5 sm:gap-5 sm:pb-5 [&::-webkit-scrollbar]:hidden"
        >
          {capabilities.map((module, index) => (
            <motion.article
              key={module._id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25, margin: '0px 0px -12% 0px' }}
              className={`flex min-h-72 w-[84vw] shrink-0 snap-start flex-col rounded-2xl p-5 sm:w-[430px] sm:rounded-[2rem] sm:p-8 lg:w-[410px] xl:w-[430px] ${colors[index % colors.length]}`}
            >
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#637086]">
                Capability {String(index + 1).padStart(2, '0')}
              </p>
              <h3 className="mt-4 text-xl font-bold tracking-[-0.035em] text-[#172033] sm:mt-7 sm:text-2xl">
                {module.name}
              </h3>
              <p className="mt-2 line-clamp-3 text-xs leading-5 text-[#667085] sm:mt-4 sm:line-clamp-4 sm:text-sm sm:leading-7">
                {module.description}
              </p>
              <div className="mt-auto flex flex-wrap gap-1.5 pt-5 sm:gap-2 sm:pt-8">
                {module.features.slice(0, 3).map((feature) => (
                  <span
                    key={feature}
                    className="rounded-full bg-white/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#596579] sm:px-3 sm:py-1.5 sm:text-[11px]"
                  >
                    {feature}
                  </span>
                ))}
              </div>
              <Link
                href={`/modules/${module.slug}`}
                className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-[#0178d7] sm:mt-7 sm:text-sm"
              >
                View module details <ArrowRight size={15} />
              </Link>
            </motion.article>
          ))}
        </div>
        <div className="mt-8 text-center sm:mt-10">
          <Link
            href="/modules"
            className="inline-flex items-center gap-2 rounded-full bg-[#172033] px-6 py-3.5 text-sm font-bold text-white sm:px-7 sm:py-4 sm:text-base"
          >
            Explore all ERP modules <ArrowRight size={17} />
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

function BusinessOutcomes() {
  const audiences = [
    {
      icon: GraduationCap,
      title: 'Academic leadership',
      text: 'Plan semesters, govern curricula, monitor delivery and publish evidence-ready outcomes from one academic record.',
      accent: '#1677c8',
      surface: 'from-[#f4faff] to-[#edf6fd]',
      iconSurface: 'bg-[#dceffc] text-[#0869b5]',
    },
    {
      icon: UsersRound,
      title: 'Faculty and students',
      text: 'Give every user a focused workspace for classes, attendance, assignments, requests, communication and progress.',
      accent: '#6d5bd0',
      surface: 'from-[#faf8ff] to-[#f1effd]',
      iconSurface: 'bg-[#e8e4fb] text-[#5a49bd]',
    },
    {
      icon: BarChart3,
      title: 'Finance and operations',
      text: 'Connect fees, accounting, payroll, procurement, hostel, transport and inventory without duplicate data entry.',
      accent: '#16846b',
      surface: 'from-[#f5fcf9] to-[#eaf7f2]',
      iconSurface: 'bg-[#d9f1e8] text-[#0e745c]',
    },
    {
      icon: FileCheck2,
      title: 'Accreditation teams',
      text: 'Maintain traceable evidence for NAAC, NBA, OBE and institutional reviews throughout the year.',
      accent: '#c96a45',
      surface: 'from-[#fffaf6] to-[#faeee7]',
      iconSurface: 'bg-[#f8e2d7] text-[#b65b39]',
    },
  ];
  return (
    <section className="bg-white px-5 py-16 sm:py-20 md:px-10 md:py-24 lg:px-16 lg:py-28">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2, margin: '0px 0px -18% 0px' }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
        className="mx-auto max-w-[1440px]"
      >
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0178d7]">
            Built around real responsibilities
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.045em] sm:mt-5 sm:text-4xl md:text-5xl">
            One platform. Clear value for every team.
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#667085] sm:mt-5 sm:text-base sm:leading-7 lg:text-lg lg:leading-8">
            Devvelocity connects the people doing the work with the leaders accountable for quality,
            compliance and growth.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:mt-14 sm:gap-5 md:grid-cols-2">
          {audiences.map((item, index) => (
            <motion.article
              key={item.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3, margin: '0px 0px -12% 0px' }}
              transition={{ duration: 0.45, delay: index * 0.06 }}
              whileHover={{ y: -4 }}
              className={`group relative overflow-hidden rounded-2xl border border-white/80 bg-gradient-to-br ${item.surface} p-5 shadow-[0_18px_55px_rgba(23,32,51,0.06)] transition-shadow duration-300 hover:shadow-[0_24px_65px_rgba(23,32,51,0.1)] sm:rounded-[2rem] sm:p-9`}
            >
              <span
                className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100"
                style={{ backgroundColor: item.accent }}
                aria-hidden="true"
              />
              <div className="flex items-start justify-between gap-6">
                <div
                  className={`grid h-11 w-11 place-items-center rounded-xl sm:h-14 sm:w-14 sm:rounded-2xl ${item.iconSurface}`}
                >
                  <item.icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.8} />
                </div>
                <span className="text-xs font-bold tracking-[0.14em] text-[#172033]/20 sm:text-sm">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-4 text-xl font-bold tracking-[-0.03em] text-[#172033] sm:mt-7 sm:text-2xl">
                {item.title}
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#5f6b7d] sm:mt-4 sm:text-base sm:leading-7">
                {item.text}
              </p>
              <div className="mt-5 flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#596579] sm:mt-8 sm:gap-3 sm:text-xs">
                <span className="h-px w-5 sm:w-7" style={{ backgroundColor: item.accent }} />
                Purpose-built workspace
              </div>
            </motion.article>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

function ConnectedWorkflow() {
  const steps = [
    {
      number: '01',
      title: 'Capture once',
      text: 'Admissions, employee and institutional records become governed sources used across permitted modules.',
    },
    {
      number: '02',
      title: 'Automate decisions',
      text: 'Configured policies drive eligibility, approvals, calculations, alerts and lifecycle transitions.',
    },
    {
      number: '03',
      title: 'Act in context',
      text: 'Role-based workspaces show each user the tasks, records and actions relevant to their responsibility.',
    },
    {
      number: '04',
      title: 'Prove every outcome',
      text: 'Dashboards, audit trails and reports connect operational work to management and compliance evidence.',
    },
  ];
  return (
    <section className="bg-[#172033] px-5 py-16 text-white sm:py-20 md:px-10 md:py-24 lg:px-16 lg:py-28">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2, margin: '0px 0px -18% 0px' }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
        className="mx-auto max-w-[1440px]"
      >
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7dc7ff]">
              How the platform works
            </p>
            <h2 className="mt-2 max-w-xl text-2xl font-bold tracking-[-0.045em] sm:mt-5 sm:text-4xl md:text-5xl">
              From operational activity to institutional intelligence.
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-[#b7c1cf] sm:text-base sm:leading-7 lg:justify-self-end lg:text-lg lg:leading-8">
            Instead of isolated modules, Devvelocity uses shared identity, policy and audit
            foundations so information moves safely through the institution.
          </p>
        </div>
        <div className="mt-8 grid gap-px overflow-hidden rounded-2xl bg-white/10 sm:mt-14 sm:rounded-[2rem] md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => (
            <motion.article
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35, margin: '0px 0px -10% 0px' }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              className="bg-[#1d283a] p-5 sm:p-8"
            >
              <span className="text-xs font-bold text-[#ff8b70] sm:text-sm">{step.number}</span>
              <h3 className="mt-5 text-lg font-bold sm:mt-10 sm:text-xl">{step.title}</h3>
              <p className="mt-2 text-xs leading-5 text-[#aeb9c8] sm:mt-3 sm:text-sm sm:leading-7">
                {step.text}
              </p>
            </motion.article>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

function TrustAndDelivery() {
  const trust = [
    {
      icon: ShieldCheck,
      title: 'Tenant-isolated architecture',
      text: 'Institution data and configuration remain scoped to the correct tenant context.',
    },
    {
      icon: LockKeyhole,
      title: 'Role and entitlement controls',
      text: 'Permissions and purchased modules are enforced by the backend, not only hidden in the interface.',
    },
    {
      icon: RefreshCw,
      title: 'Auditable lifecycle rules',
      text: 'Governed transitions and audit records reduce unauthorized or unexplained operational changes.',
    },
    {
      icon: CloudCog,
      title: 'Operational resilience',
      text: 'Health monitoring, retention routines and controlled migrations support dependable operations.',
    },
  ];
  const delivery = [
    'Discovery and process mapping',
    'Configuration and data preparation',
    'Pilot rollout and validation',
    'Role-based training and launch',
    'Ongoing support and optimization',
  ];
  return (
    <section id="security" className="px-5 py-16 sm:py-20 md:px-10 md:py-24 lg:px-16 lg:py-28">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2, margin: '0px 0px -18% 0px' }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
        className="mx-auto max-w-[1440px]"
      >
        <div className="grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff7657]">
              Trust by design
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.045em] sm:mt-5 sm:text-4xl md:text-5xl">
              Enterprise controls without enterprise friction.
            </h2>
            <div className="mt-6 grid gap-3 sm:mt-10 sm:gap-4 sm:grid-cols-2">
              {trust.map((item, index) => (
                <motion.article
                  key={item.title}
                  initial={{ opacity: 0, scale: 0.97 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, amount: 0.35, margin: '0px 0px -10% 0px' }}
                  transition={{ duration: 0.4, delay: index * 0.07 }}
                  whileHover={{ y: -3 }}
                  className="rounded-2xl bg-[#f2f8fc] p-4.5 sm:rounded-3xl sm:p-6"
                >
                  <item.icon className="h-5 w-5 text-[#0178d7] sm:h-6 sm:w-6" />
                  <h3 className="mt-3 text-sm font-bold sm:mt-5 sm:text-base">{item.title}</h3>
                  <p className="mt-1.5 text-xs leading-5 text-[#667085] sm:mt-2 sm:text-sm sm:leading-6">
                    {item.text}
                  </p>
                </motion.article>
              ))}
            </div>
          </div>
          <aside className="rounded-2xl bg-[#fff0e8] p-5 sm:rounded-[2.5rem] sm:p-8 lg:p-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#d55235] sm:px-4 sm:py-2 sm:text-xs">
              Guided implementation
            </div>
            <h3 className="mt-4 text-xl font-bold tracking-[-0.035em] sm:mt-7 sm:text-3xl">
              A rollout your teams can absorb.
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#667085] sm:mt-4 sm:text-base sm:leading-7">
              Adopt priority workflows first, validate them with real users, then expand through a
              controlled implementation plan.
            </p>
            <ol className="mt-6 space-y-2.5 sm:mt-8 sm:space-y-3">
              {delivery.map((item, index) => (
                <li
                  key={item}
                  className="flex items-center gap-3 rounded-xl bg-white/80 p-3 sm:gap-4 sm:rounded-2xl sm:p-4"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#ff7657] text-xs font-bold text-white sm:h-8 sm:w-8">
                    {index + 1}
                  </span>
                  <span className="text-xs font-semibold text-[#354052] sm:text-sm">{item}</span>
                </li>
              ))}
            </ol>
            <Link
              href="/demo"
              className="mt-6 flex items-center justify-center gap-2 rounded-full bg-[#172033] px-6 py-3.5 text-sm font-bold text-white sm:mt-8 sm:py-4 sm:text-base"
            >
              Plan your rollout <ArrowRight size={17} />
            </Link>
          </aside>
        </div>
      </motion.div>
    </section>
  );
}

function FrequentlyAsked() {
  const questions = [
    [
      'Can we begin with selected modules?',
      'Yes. Plans and entitlements allow an institution to start with priority modules and add capabilities without replacing the platform.',
    ],
    [
      'Does each institution get its own branding and settings?',
      'Yes. Tenant administrators can maintain institution identity, communication, operational settings and permitted module configuration.',
    ],
    [
      'Are yearly and lifetime commercial options supported?',
      'Annual subscriptions are the standard offering. Capacity and specialist modules can be added independently, while exceptional commercial arrangements require an approved quotation.',
    ],
    [
      'How is implementation handled?',
      'The rollout follows discovery, configuration, data preparation, pilot validation, training and controlled launch phases.',
    ],
  ];
  return (
    <section className="bg-[#f2f8fc] px-5 py-16 sm:py-20 md:px-10 md:py-24 lg:px-16 lg:py-28">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25, margin: '0px 0px -18% 0px' }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
        className="mx-auto grid max-w-[1200px] gap-8 lg:grid-cols-[.7fr_1.3fr] lg:gap-12"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0178d7]">
            Common questions
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.045em] sm:mt-5 sm:text-4xl md:text-5xl">
            Know what adoption looks like.
          </h2>
          <Link
            href="/contact"
            className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#0178d7] sm:mt-7"
          >
            Ask another question <ArrowRight size={16} />
          </Link>
        </div>
        <div className="space-y-2.5 sm:space-y-3">
          {questions.map(([question, answer], index) => (
            <motion.details
              key={question}
              initial={{ opacity: 0, x: 18 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.35, margin: '0px 0px -10% 0px' }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
              className="group rounded-xl bg-white p-4 sm:rounded-2xl sm:p-5"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-[#172033] sm:gap-4 sm:text-base">
                <span>{question}</span>
                <span className="shrink-0 text-lg font-normal text-[#0178d7] transition-transform duration-200 group-open:rotate-45 sm:text-xl">
                  +
                </span>
              </summary>
              <p className="mt-2.5 max-w-2xl text-xs leading-5 text-[#667085] sm:mt-4 sm:text-sm sm:leading-7">
                {answer}
              </p>
            </motion.details>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

/** Presents active SaaS plans without introducing client-side pricing constants. */
function Plans({
  plans,
  modules,
  addons,
}: {
  plans: ISubscriptionPlan[];
  modules: IProductModule[];
  addons: IProductAddon[];
}) {
  const activePlans = plans.filter((plan) => plan.isActive);
  const trialPlan = activePlans.find((plan) => plan.planType === 'free');
  const paidPlans = activePlans.filter((plan) => plan.planType === 'paid');
  const hasAddons = addons.some((addon) => addon.isActive);
  void modules;
  return (
    <section
      id="plans"
      className="relative scroll-mt-24 overflow-hidden bg-[#f6f9fc] px-5 py-16 sm:py-20 md:px-10 md:py-24 lg:px-16 lg:py-28"
    >
      <div className="pointer-events-none absolute -left-32 top-20 size-80 rounded-full bg-[#dceefa]/60 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-20 size-96 rounded-full bg-[#edf4d9]/70 blur-3xl" />
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.18, margin: '0px 0px -18% 0px' }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
        className="mx-auto max-w-[1440px]"
      >
        <div className="relative text-center">
          <p className="mx-auto w-fit rounded-full bg-[#e5f2fb] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#0178d7]">
            Plans that scale
          </p>
          <h2 className="mx-auto mt-5 max-w-3xl text-3xl font-bold tracking-[-0.05em] text-[#124c75] sm:text-4xl md:text-5xl">
            Choose a plan that fits today.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#667085] sm:text-base">
            Fixed annual institutional pricing with clear capacity and room to grow.
          </p>
          <p className="mt-2 text-xs font-medium text-[#8a94a6]">All prices exclude 18% GST.</p>
        </div>
        {activePlans.length ? (
          <div className="relative mt-10 sm:mt-14">
            {trialPlan && (
              <motion.article
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
                className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0178d7] to-[#54a8e4] text-white md:grid-cols-[1.15fr_.85fr]"
              >
                <div className="relative overflow-hidden p-6 sm:p-8 lg:p-10">
                  <div className="pointer-events-none absolute -bottom-20 -right-14 size-64 rounded-full bg-white/10" />
                  <div className="pointer-events-none absolute right-12 top-8 hidden size-40 sm:block">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                      className="absolute inset-0 rounded-full border border-dashed border-white/35"
                    />
                    <motion.div
                      animate={{ y: [0, -8, 0] }}
                      transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm"
                    >
                      <GraduationCap size={30} />
                    </motion.div>
                    <motion.div
                      animate={{ x: [0, 6, 0], y: [0, -5, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute -left-3 top-10 flex size-10 items-center justify-center rounded-full bg-[#cfe995] text-[#416412]"
                    >
                      <UsersRound size={18} />
                    </motion.div>
                    <motion.div
                      animate={{ x: [0, -5, 0], y: [0, 6, 0] }}
                      transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute -right-2 bottom-8 flex size-10 items-center justify-center rounded-full bg-white text-[#0178d7]"
                    >
                      <ShieldCheck size={18} />
                    </motion.div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a9d7f5]">
                      Start here
                    </span>
                    <span className="text-xs font-medium text-white/55">No payment required</span>
                  </div>
                  <h3 className="mt-5 text-2xl font-bold tracking-[-0.03em] sm:text-3xl">
                    {trialPlan.name}
                  </h3>
                  <p className="relative mt-3 max-w-md text-sm leading-6 text-white/75">
                    {trialPlan.description}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold text-white/75">
                    <span className="rounded-full bg-white/8 px-3 py-2">
                      {trialPlan.priceLabel}
                    </span>
                    <span className="rounded-full bg-white/8 px-3 py-2">
                      Up to {trialPlan.studentLimit.toLocaleString('en-IN')} students
                    </span>
                    <span className="rounded-full bg-white/8 px-3 py-2">
                      {trialPlan.moduleSlugs.length} core modules
                    </span>
                  </div>
                </div>
                <div className="flex flex-col justify-center bg-[#e8f5fc] p-6 text-[#15527b] sm:p-8 lg:p-10">
                  <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#4f82a3]">
                    Explore with confidence
                  </p>
                  <div className="mt-4 space-y-2.5">
                    {trialPlan.highlights.slice(0, 3).map((highlight) => (
                      <p key={highlight} className="flex items-start gap-2.5 text-sm font-medium">
                        <Check size={16} className="mt-0.5 shrink-0 text-[#73942e]" />
                        {highlight}
                      </p>
                    ))}
                  </div>
                  <Link
                    href={`/checkout?product=college-erp&plan=${trialPlan.slug}`}
                    className="mt-6 flex items-center justify-center gap-2 rounded-full bg-[#0178d7] px-5 py-3 text-sm font-bold text-white transition-transform duration-300 hover:scale-[1.02]"
                  >
                    Start free trial <ArrowRight size={16} />
                  </Link>
                </div>
              </motion.article>
            )}

            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {paidPlans.map((plan, index) => (
                <motion.article
                  key={plan._id}
                  initial={{ opacity: 0, y: 26 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25, margin: '0px 0px -10% 0px' }}
                  transition={{ duration: 0.5, delay: index * 0.07, ease: 'easeOut' }}
                  whileHover={{ y: -7 }}
                  className={`relative flex min-h-[470px] flex-col overflow-hidden rounded-[1.75rem] p-6 text-[#15527b] transition-colors duration-300 ${
                    plan.isPopular ? 'bg-[#e3f1fa]' : 'bg-white/95'
                  }`}
                >
                  <div
                    className={`absolute inset-x-6 top-0 h-1 rounded-b-full ${
                      plan.isPopular ? 'bg-[#0178d7]' : 'bg-[#d7e4ec]'
                    }`}
                  />
                  <div className="mt-2 flex min-h-8 items-center justify-between gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7a8798]">
                      Annual subscription
                    </p>
                    {plan.isPopular && (
                      <span className="rounded-full bg-[#0178d7] px-3 py-1 text-[10px] font-bold text-white">
                        RECOMMENDED
                      </span>
                    )}
                  </div>
                  <h3 className="mt-4 text-2xl font-bold tracking-[-0.035em]">{plan.name}</h3>
                  <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-[#667085]">
                    {plan.description}
                  </p>
                  <p className="mt-5 text-3xl font-bold tracking-[-0.05em] text-[#124c75]">
                    {plan.priceLabel}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-[#8a94a6]">
                    Annual billing · excludes GST
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-2 text-xs font-semibold text-[#536174]">
                    <span className="rounded-2xl bg-[#f3f7f9] px-3 py-3">
                      <strong className="block text-base text-[#124c75]">
                        {plan.studentLimit.toLocaleString('en-IN')}
                      </strong>
                      students
                    </span>
                    <span className="rounded-2xl bg-[#f3f7f9] px-3 py-3">
                      <strong className="block text-base text-[#124c75]">
                        {plan.employeeLimit.toLocaleString('en-IN')}
                      </strong>
                      faculty & staff
                    </span>
                  </div>
                  <div className="mt-5 space-y-2.5 pb-5">
                    {plan.highlights.slice(0, 3).map((highlight) => (
                      <p
                        key={highlight}
                        className="flex items-start gap-2.5 text-xs font-medium leading-5 text-[#48566a]"
                      >
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#edf5d9]">
                          <Check size={12} className="text-[#66822c]" />
                        </span>
                        {highlight}
                      </p>
                    ))}
                  </div>
                  {hasAddons && (
                    <p className="mb-4 w-fit rounded-full bg-[#edf5fb] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#0178d7]">
                      Add-ons available
                    </p>
                  )}
                  <Link
                    href={`/checkout?product=college-erp&plan=${plan.slug}`}
                    className={`mt-auto flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition-all duration-300 ${
                      plan.isPopular
                        ? 'bg-[#0178d7] text-white hover:bg-[#015eac]'
                        : 'bg-[#2f91d5] text-white hover:bg-[#0178d7]'
                    }`}
                  >
                    Explore plan <ArrowRight size={16} />
                  </Link>
                </motion.article>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto mt-8 max-w-2xl rounded-2xl bg-white p-6 text-center shadow-[0_18px_55px_rgba(23,32,51,0.06)] sm:mt-12 sm:rounded-[2rem] sm:p-10">
            <h3 className="text-xl font-bold sm:text-2xl">
              Plans are being prepared for your institution.
            </h3>
            <p className="mt-3 text-sm leading-6 text-[#667085] sm:mt-4 sm:text-base sm:leading-7">
              Talk with our team for current module bundles, capacity and implementation pricing.
            </p>
            <Link
              href="/contact"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#0178d7] px-6 py-3.5 text-sm font-bold text-white sm:mt-7 sm:text-base"
            >
              Request pricing <ArrowRight size={17} />
            </Link>
          </div>
        )}
        <div className="mx-auto mt-8 flex w-fit flex-col items-center gap-2.5 rounded-2xl bg-white/80 px-5 py-3.5 text-center sm:mt-10 sm:flex-row sm:gap-3 sm:px-6 sm:py-4 sm:text-left">
          <ShieldCheck size={20} className="shrink-0 text-[#16846b] sm:size-[22px]" />
          <div>
            <p className="text-xs font-bold text-[#354052] sm:text-sm">
              Secure invoice-based payment
            </p>
            <p className="mt-0.5 text-[10px] text-[#748095] sm:text-xs">
              Verified bank transfer or UPI with billing-team confirmation
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

/** Renders the final light-mode conversion panel. */
function ContactCallToAction() {
  return (
    <>
      <section className="px-5 py-16 sm:py-20 md:px-10 md:py-24 lg:px-16 lg:py-28">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.985 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.3, margin: '0px 0px -16% 0px' }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="mx-auto grid max-w-[1440px] overflow-hidden rounded-2xl bg-[#fff0e8] sm:rounded-[2.5rem] lg:grid-cols-[1.25fr_.75fr]"
        >
          <div className="p-5 sm:p-10 lg:p-16">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d55235]">
              Ready when you are
            </p>
            <h2 className="mt-2 max-w-3xl text-2xl font-bold tracking-[-0.045em] sm:mt-5 sm:text-4xl md:text-5xl lg:text-6xl">
              See how your institution works as one.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#667085] sm:mt-6 sm:text-base sm:leading-7 lg:text-lg lg:leading-8">
              Book a focused discovery session. We will map your current workflows, priorities, and
              a practical rollout path.
            </p>
          </div>
          <div className="flex flex-col justify-center bg-[#ff7657] p-5 text-white sm:p-10 lg:p-12">
            <p className="text-xs font-bold uppercase tracking-[0.16em] sm:text-sm">
              Your next step
            </p>
            <p className="mt-3 text-lg font-bold sm:mt-5 sm:text-2xl">
              A guided product walkthrough tailored to your campus.
            </p>
            <Link
              href="/demo"
              className="mt-6 flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-[#172033] sm:mt-8 sm:py-4 sm:text-base"
            >
              Schedule consultation <ArrowRight size={17} />
            </Link>
          </div>
        </motion.div>
      </section>
    </>
  );
}

/** Composes the lower homepage sections from public catalog data. */
export default function LandingProductSections({
  modules,
  plans,
  addons,
  isLoading,
}: ILandingProductSectionsProps) {
  if (isLoading) return <CatalogSkeleton />;
  return (
    <>
      <PlatformStory />
      <CollaborationShowcase />
      <BusinessOutcomes />
      <ConnectedWorkflow />
      <CapabilityGrid modules={modules} />
      <TrustAndDelivery />
      <Plans plans={plans} modules={modules} addons={addons} />
      <FrequentlyAsked />
      <ContactCallToAction />
    </>
  );
}

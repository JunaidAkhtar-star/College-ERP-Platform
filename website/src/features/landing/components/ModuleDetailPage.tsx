'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from '@/shared/utils/motion';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BedDouble,
  BookOpen,
  Briefcase,
  Bus,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  ExternalLink,
  FileCheck2,
  FlaskConical,
  GraduationCap,
  Heart,
  LayoutDashboard,
  LucideIcon,
  MessageSquare,
  Package,
  Route,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Trophy,
  Users,
  Utensils,
  Video,
  Wrench,
} from 'lucide-react';
import { getModuleById, getModulesByIds, ALL_MODULES, type ErpModule } from '../data/modules';
import useSwr from '@/shared/hooks/useSwr';
import type { IProductModule } from '@/features/landing/types/public.types';

interface IModuleDetailPageProps {
  mod: ErpModule;
}

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
};

const featureVisuals = [
  { icon: BedDouble, tone: 'bg-sky-100 text-sky-700' },
  { icon: Utensils, tone: 'bg-amber-100 text-amber-700' },
  { icon: ShieldCheck, tone: 'bg-emerald-100 text-emerald-700' },
  { icon: Users, tone: 'bg-indigo-100 text-indigo-700' },
  { icon: Wrench, tone: 'bg-violet-100 text-violet-700' },
  { icon: CheckCircle2, tone: 'bg-rose-100 text-rose-700' },
];

interface IModuleVisual {
  primary: LucideIcon;
  nodes: [LucideIcon, LucideIcon, LucideIcon];
  gradient: string;
  primaryTone: string;
  nodeTones: [string, string, string];
}

const MODULE_VISUALS: Record<string, IModuleVisual> = {
  admissions: {
    primary: GraduationCap,
    nodes: [FileCheck2, Users, BadgeCheck],
    gradient: 'from-indigo-50 via-sky-50 to-white',
    primaryTone: 'bg-indigo-600 text-white shadow-indigo-200',
    nodeTones: [
      'bg-sky-100 text-sky-700',
      'bg-violet-100 text-violet-700',
      'bg-emerald-100 text-emerald-700',
    ],
  },
  academics: {
    primary: BookOpen,
    nodes: [Video, ClipboardList, Trophy],
    gradient: 'from-cyan-50 via-sky-50 to-white',
    primaryTone: 'bg-cyan-600 text-white shadow-cyan-200',
    nodeTones: [
      'bg-indigo-100 text-indigo-700',
      'bg-sky-100 text-sky-700',
      'bg-amber-100 text-amber-700',
    ],
  },
  attendance: {
    primary: ClipboardList,
    nodes: [Users, BadgeCheck, BarChart3],
    gradient: 'from-emerald-50 via-teal-50 to-white',
    primaryTone: 'bg-emerald-600 text-white shadow-emerald-200',
    nodeTones: [
      'bg-teal-100 text-teal-700',
      'bg-emerald-100 text-emerald-700',
      'bg-sky-100 text-sky-700',
    ],
  },
  examinations: {
    primary: Trophy,
    nodes: [ClipboardList, BadgeCheck, BarChart3],
    gradient: 'from-amber-50 via-orange-50 to-white',
    primaryTone: 'bg-amber-500 text-white shadow-amber-200',
    nodeTones: [
      'bg-orange-100 text-orange-700',
      'bg-emerald-100 text-emerald-700',
      'bg-indigo-100 text-indigo-700',
    ],
  },
  fees: {
    primary: CreditCard,
    nodes: [BadgeCheck, BarChart3, FileCheck2],
    gradient: 'from-violet-50 via-indigo-50 to-white',
    primaryTone: 'bg-violet-600 text-white shadow-violet-200',
    nodeTones: [
      'bg-emerald-100 text-emerald-700',
      'bg-indigo-100 text-indigo-700',
      'bg-sky-100 text-sky-700',
    ],
  },
  'hr-payroll': {
    primary: Briefcase,
    nodes: [Users, CreditCard, ClipboardList],
    gradient: 'from-blue-50 via-sky-50 to-white',
    primaryTone: 'bg-blue-600 text-white shadow-blue-200',
    nodeTones: [
      'bg-indigo-100 text-indigo-700',
      'bg-emerald-100 text-emerald-700',
      'bg-amber-100 text-amber-700',
    ],
  },
  transport: {
    primary: Bus,
    nodes: [Route, Users, CreditCard],
    gradient: 'from-orange-50 via-amber-50 to-white',
    primaryTone: 'bg-orange-500 text-white shadow-orange-200',
    nodeTones: [
      'bg-sky-100 text-sky-700',
      'bg-indigo-100 text-indigo-700',
      'bg-emerald-100 text-emerald-700',
    ],
  },
  library: {
    primary: BookOpen,
    nodes: [Users, BadgeCheck, BarChart3],
    gradient: 'from-rose-50 via-orange-50 to-white',
    primaryTone: 'bg-rose-500 text-white shadow-rose-200',
    nodeTones: [
      'bg-indigo-100 text-indigo-700',
      'bg-amber-100 text-amber-700',
      'bg-sky-100 text-sky-700',
    ],
  },
  placements: {
    primary: TrendingUp,
    nodes: [Briefcase, Users, BadgeCheck],
    gradient: 'from-emerald-50 via-sky-50 to-white',
    primaryTone: 'bg-emerald-600 text-white shadow-emerald-200',
    nodeTones: [
      'bg-indigo-100 text-indigo-700',
      'bg-sky-100 text-sky-700',
      'bg-amber-100 text-amber-700',
    ],
  },
  research: {
    primary: FlaskConical,
    nodes: [FileCheck2, Users, BarChart3],
    gradient: 'from-fuchsia-50 via-violet-50 to-white',
    primaryTone: 'bg-fuchsia-600 text-white shadow-fuchsia-200',
    nodeTones: [
      'bg-violet-100 text-violet-700',
      'bg-indigo-100 text-indigo-700',
      'bg-sky-100 text-sky-700',
    ],
  },
  'naac-iqac': {
    primary: BadgeCheck,
    nodes: [FileCheck2, BarChart3, ShieldCheck],
    gradient: 'from-teal-50 via-emerald-50 to-white',
    primaryTone: 'bg-teal-600 text-white shadow-teal-200',
    nodeTones: [
      'bg-sky-100 text-sky-700',
      'bg-indigo-100 text-indigo-700',
      'bg-emerald-100 text-emerald-700',
    ],
  },
  clubs: {
    primary: Heart,
    nodes: [Users, Trophy, MessageSquare],
    gradient: 'from-rose-50 via-pink-50 to-white',
    primaryTone: 'bg-rose-500 text-white shadow-rose-200',
    nodeTones: [
      'bg-indigo-100 text-indigo-700',
      'bg-amber-100 text-amber-700',
      'bg-sky-100 text-sky-700',
    ],
  },
  communication: {
    primary: MessageSquare,
    nodes: [Users, Video, BadgeCheck],
    gradient: 'from-sky-50 via-blue-50 to-white',
    primaryTone: 'bg-sky-600 text-white shadow-sky-200',
    nodeTones: [
      'bg-indigo-100 text-indigo-700',
      'bg-violet-100 text-violet-700',
      'bg-emerald-100 text-emerald-700',
    ],
  },
  security: {
    primary: ShieldAlert,
    nodes: [BadgeCheck, Users, ClipboardList],
    gradient: 'from-red-50 via-orange-50 to-white',
    primaryTone: 'bg-red-500 text-white shadow-red-200',
    nodeTones: [
      'bg-emerald-100 text-emerald-700',
      'bg-indigo-100 text-indigo-700',
      'bg-amber-100 text-amber-700',
    ],
  },
  analytics: {
    primary: BarChart3,
    nodes: [TrendingUp, FileCheck2, Users],
    gradient: 'from-indigo-50 via-violet-50 to-white',
    primaryTone: 'bg-indigo-600 text-white shadow-indigo-200',
    nodeTones: [
      'bg-emerald-100 text-emerald-700',
      'bg-sky-100 text-sky-700',
      'bg-violet-100 text-violet-700',
    ],
  },
  procurement: {
    primary: Package,
    nodes: [CreditCard, ClipboardList, BadgeCheck],
    gradient: 'from-amber-50 via-yellow-50 to-white',
    primaryTone: 'bg-amber-500 text-white shadow-amber-200',
    nodeTones: [
      'bg-emerald-100 text-emerald-700',
      'bg-sky-100 text-sky-700',
      'bg-indigo-100 text-indigo-700',
    ],
  },
  'virtual-classrooms': {
    primary: Video,
    nodes: [Users, BookOpen, MessageSquare],
    gradient: 'from-violet-50 via-sky-50 to-white',
    primaryTone: 'bg-violet-600 text-white shadow-violet-200',
    nodeTones: [
      'bg-indigo-100 text-indigo-700',
      'bg-amber-100 text-amber-700',
      'bg-sky-100 text-sky-700',
    ],
  },
};

function HostelOperationsPreview() {
  return (
    <div className="relative mx-auto max-w-[620px]">
      <div className="absolute inset-8 rounded-full bg-sky-200/50 blur-3xl" />
      <motion.svg
        viewBox="0 0 680 520"
        role="img"
        aria-labelledby="hostel-illustration-title hostel-illustration-description"
        className="relative h-auto w-full drop-shadow-[0_28px_30px_rgba(56,189,248,0.16)]"
      >
        <title id="hostel-illustration-title">Connected hostel operations</title>
        <desc id="hostel-illustration-description">
          Students beside a modern hostel with digital room, meal and maintenance indicators.
        </desc>
        <defs>
          <linearGradient id="hostel-sky" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#eff6ff" />
            <stop offset="1" stopColor="#ecfeff" />
          </linearGradient>
          <linearGradient id="hostel-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#dbeafe" />
          </linearGradient>
        </defs>
        <rect x="24" y="20" width="632" height="462" rx="58" fill="url(#hostel-sky)" />
        <circle cx="550" cy="105" r="43" fill="#fde68a" opacity=".9" />
        <motion.g
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <path
            d="M85 118c18-28 58-27 74 2 27-11 56 5 58 34H68c-3-18 4-30 17-36Z"
            fill="#fff"
            opacity=".9"
          />
        </motion.g>
        <ellipse cx="340" cy="443" rx="260" ry="28" fill="#bae6fd" opacity=".55" />
        <path d="M122 410h438v34H122z" fill="#a7f3d0" />
        <path d="M202 180h283v230H202z" fill="url(#hostel-wall)" />
        <path d="m180 190 165-92 163 92Z" fill="#38bdf8" />
        <path d="M327 120h36v55h-36z" fill="#fff" opacity=".9" />
        <path d="M312 147h66v18h-66z" fill="#0ea5e9" />
        <path d="M309 324h72v86h-72z" fill="#818cf8" />
        <path d="M320 337h50v73h-50z" fill="#c7d2fe" />
        {[235, 293, 409, 467].map((x) =>
          [220, 274].map((y) => (
            <g key={`${x}-${y}`}>
              <rect x={x} y={y} width="36" height="31" rx="5" fill="#bae6fd" />
              <path d={`M${x + 18} ${y}v31M${x} ${y + 15.5}h36`} stroke="#fff" strokeWidth="3" />
            </g>
          )),
        )}
        <path d="M150 322c-32 0-45 40-21 58h41c23-20 10-58-20-58Z" fill="#34d399" />
        <path d="M147 367h7v47h-7z" fill="#a16207" />
        <path d="M531 304c-34 0-47 43-22 62h44c25-21 11-62-22-62Z" fill="#22c55e" />
        <path d="M528 354h7v59h-7z" fill="#a16207" />
        <motion.g
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <rect x="74" y="185" width="142" height="68" rx="18" fill="#fff" />
          <circle cx="101" cy="219" r="15" fill="#dbeafe" />
          <path d="M94 219h14M101 212v14" stroke="#0284c7" strokeWidth="3" strokeLinecap="round" />
          <text x="124" y="213" fill="#64748b" fontSize="11" fontWeight="600">
            AVAILABLE ROOMS
          </text>
          <text x="124" y="234" fill="#0f172a" fontSize="19" fontWeight="800">
            124 beds
          </text>
        </motion.g>
        <motion.g
          animate={{ y: [0, 9, 0] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <rect x="460" y="196" width="145" height="68" rx="18" fill="#fff" />
          <circle cx="488" cy="230" r="15" fill="#dcfce7" />
          <path
            d="m481 230 5 5 10-12"
            fill="none"
            stroke="#16a34a"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text x="511" y="224" fill="#64748b" fontSize="11" fontWeight="600">
            OCCUPANCY
          </text>
          <text x="511" y="245" fill="#0f172a" fontSize="19" fontWeight="800">
            92% live
          </text>
        </motion.g>
        <g>
          <circle cx="236" cy="382" r="15" fill="#f8c7a7" />
          <path d="M217 430c1-28 6-37 19-37s20 9 22 37Z" fill="#6366f1" />
          <path
            d="m221 428-7 38M253 428l8 38"
            stroke="#334155"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path d="M225 374c6-15 24-12 25 4-10-5-16-5-25-4Z" fill="#334155" />
        </g>
        <motion.g
          animate={{ rotate: [-3, 5, -3] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="origin-[455px_404px]"
        >
          <circle cx="455" cy="379" r="15" fill="#9a673f" />
          <path d="M435 431c2-29 7-38 20-38s20 9 22 38Z" fill="#f59e0b" />
          <path
            d="m440 428-6 38M471 428l7 38"
            stroke="#334155"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path d="M441 373c5-15 23-14 28 0-11-4-19-4-28 0Z" fill="#1e293b" />
        </motion.g>
      </motion.svg>
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white/90 px-4 py-2 text-[11px] font-medium text-slate-600 shadow-lg shadow-sky-100 backdrop-blur-md">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Every hostel
        workflow, connected
      </div>
    </div>
  );
}

function GenericOperationsPreview({ mod }: { mod: ErpModule }) {
  const visual = MODULE_VISUALS[mod.id] ?? {
    primary: LayoutDashboard,
    nodes: [Users, FileCheck2, BarChart3] as [LucideIcon, LucideIcon, LucideIcon],
    gradient: 'from-sky-50 via-indigo-50 to-white',
    primaryTone: 'bg-sky-600 text-white shadow-sky-200',
    nodeTones: [
      'bg-indigo-100 text-indigo-700',
      'bg-emerald-100 text-emerald-700',
      'bg-amber-100 text-amber-700',
    ] as [string, string, string],
  };
  const PrimaryIcon = visual.primary;

  return (
    <div
      className={`relative mx-auto min-h-[420px] max-w-[620px] overflow-hidden rounded-[2.5rem] bg-gradient-to-br p-6 ${visual.gradient}`}
    >
      <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-white/70 blur-xl" />
      <div className="absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-white/60 blur-2xl" />
      <div className="absolute inset-x-[14%] top-1/2 h-px bg-gradient-to-r from-transparent via-sky-200 to-transparent" />
      <div className="absolute bottom-[16%] top-[16%] left-1/2 w-px bg-gradient-to-b from-transparent via-indigo-200 to-transparent" />

      <motion.div
        animate={{ y: [0, -9, 0], rotate: [0, 2, 0] }}
        transition={{ duration: 4.6, repeat: Infinity, ease: 'easeInOut' }}
        className={`absolute left-1/2 top-1/2 z-20 grid h-24 w-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[2rem] shadow-xl ${visual.primaryTone}`}
      >
        <PrimaryIcon className="h-11 w-11" strokeWidth={1.6} />
      </motion.div>

      {visual.nodes.map((NodeIcon, index) => {
        const positions = [
          'left-[8%] top-[16%]',
          'right-[8%] top-[19%]',
          'bottom-[13%] left-[18%]',
        ];
        const motions = [
          { x: [0, 8, 0], y: [0, -4, 0] },
          { x: [0, -7, 0], y: [0, 6, 0] },
          { x: [0, 6, 0], y: [0, -7, 0] },
        ];
        return (
          <motion.div
            key={index}
            animate={motions[index]}
            transition={{ duration: 4.2 + index * 0.6, repeat: Infinity, ease: 'easeInOut' }}
            className={`absolute z-10 grid h-14 w-14 place-items-center rounded-2xl shadow-sm ${positions[index]} ${visual.nodeTones[index]}`}
          >
            <NodeIcon className="h-6 w-6" strokeWidth={1.8} />
          </motion.div>
        );
      })}

      <motion.div
        animate={{ y: [0, 7, 0] }}
        transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-[12%] right-[7%] z-20 w-[46%] rounded-2xl bg-white/90 p-3.5 shadow-lg shadow-slate-200/50 backdrop-blur-sm"
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="truncate text-[10px] font-semibold text-slate-700">
            {mod.features[0]?.title ?? mod.title}
          </p>
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <motion.div
            initial={{ width: '28%' }}
            whileInView={{ width: '84%' }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: 0.4 }}
            className="h-full rounded-full bg-sky-500"
          />
        </div>
        <p className="mt-2 truncate text-[9px] text-slate-400">
          {mod.features[1]?.title ?? 'Connected workflow'}
        </p>
      </motion.div>

      <div className="absolute left-1/2 top-6 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/80 px-4 py-2 text-[10px] font-medium text-slate-500 backdrop-blur-sm">
        {mod.title} · Live workflow
      </div>
    </div>
  );
}

function GuidedDemoIllustration() {
  return (
    <motion.svg
      viewBox="0 0 560 390"
      role="img"
      aria-labelledby="demo-illustration-title demo-illustration-description"
      className="h-auto w-full"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.6 }}
    >
      <title id="demo-illustration-title">Guided ERP product demonstration</title>
      <desc id="demo-illustration-description">
        An institution team exploring connected workflows on an interactive product screen.
      </desc>
      <defs>
        <linearGradient id="demo-panel" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#f0f9ff" />
        </linearGradient>
      </defs>
      <ellipse cx="280" cy="350" rx="215" ry="24" fill="#bfdbfe" opacity=".42" />
      <rect x="76" y="38" width="408" height="270" rx="28" fill="url(#demo-panel)" />
      <rect x="96" y="58" width="368" height="34" rx="12" fill="#eff6ff" />
      <circle cx="116" cy="75" r="5" fill="#38bdf8" />
      <rect x="131" y="69" width="73" height="11" rx="5.5" fill="#cbd5e1" />
      <circle cx="432" cy="75" r="10" fill="#bae6fd" />
      <rect x="96" y="110" width="102" height="178" rx="18" fill="#f8fafc" />
      {[0, 1, 2, 3].map((item) => (
        <g key={item}>
          <rect
            x="112"
            y={128 + item * 35}
            width="15"
            height="15"
            rx="5"
            fill={item === 0 ? '#38bdf8' : '#dbeafe'}
          />
          <rect
            x="137"
            y={131 + item * 35}
            width={item === 0 ? 43 : 35}
            height="8"
            rx="4"
            fill={item === 0 ? '#0284c7' : '#cbd5e1'}
          />
        </g>
      ))}
      <rect x="216" y="110" width="248" height="85" rx="18" fill="#e0f2fe" />
      <path
        d="M238 171c23-18 37-11 55-30 19-20 35 3 52-12 19-17 35 5 57-1 15-4 25-14 40-6"
        fill="none"
        stroke="#0ea5e9"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {[238, 293, 345, 402, 442].map((x, index) => (
        <circle
          key={x}
          cx={x}
          cy={[171, 141, 129, 128, 122][index]}
          r="5"
          fill="#fff"
          stroke="#0284c7"
          strokeWidth="3"
        />
      ))}
      <rect x="216" y="213" width="116" height="75" rx="17" fill="#ecfdf5" />
      <circle cx="245" cy="241" r="12" fill="#a7f3d0" />
      <path
        d="m239 241 4 4 8-10"
        fill="none"
        stroke="#059669"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="266" y="232" width="47" height="8" rx="4" fill="#94a3b8" />
      <rect x="266" y="249" width="34" height="7" rx="3.5" fill="#cbd5e1" />
      <rect x="348" y="213" width="116" height="75" rx="17" fill="#eef2ff" />
      <rect x="369" y="232" width="12" height="30" rx="5" fill="#a5b4fc" />
      <rect x="388" y="244" width="12" height="18" rx="5" fill="#818cf8" />
      <rect x="407" y="225" width="12" height="37" rx="5" fill="#6366f1" />
      <motion.g
        animate={{ y: [0, -7, 0] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <rect x="27" y="107" width="116" height="64" rx="18" fill="#fff" />
        <circle cx="53" cy="139" r="13" fill="#dbeafe" />
        <path d="M47 139h12M53 133v12" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="75" y="129" width="48" height="8" rx="4" fill="#64748b" />
        <rect x="75" y="145" width="36" height="6" rx="3" fill="#cbd5e1" />
      </motion.g>
      <motion.g
        animate={{ y: [0, 7, 0] }}
        transition={{ duration: 4.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <rect x="414" y="278" width="120" height="62" rx="18" fill="#fff" />
        <circle cx="440" cy="309" r="13" fill="#dcfce7" />
        <path
          d="m434 309 4 4 8-10"
          fill="none"
          stroke="#16a34a"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="462" y="299" width="52" height="8" rx="4" fill="#64748b" />
        <rect x="462" y="315" width="38" height="6" rx="3" fill="#cbd5e1" />
      </motion.g>
      <g>
        <circle cx="167" cy="302" r="17" fill="#efb38f" />
        <path d="M147 292c5-18 31-18 38 0-12-6-25-6-38 0Z" fill="#334155" />
        <path d="M139 356c2-36 10-46 28-46s27 10 29 46Z" fill="#6366f1" />
        <path
          d="m146 352-6 26M188 352l6 26"
          stroke="#334155"
          strokeWidth="9"
          strokeLinecap="round"
        />
      </g>
      <motion.g
        animate={{ rotate: [-2, 4, -2] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        className="origin-[382px_330px]"
      >
        <circle cx="382" cy="305" r="17" fill="#8d5b3d" />
        <path d="M361 292c8-16 34-15 42 2-13-4-28-5-42-2Z" fill="#1e293b" />
        <path d="M353 359c3-37 11-47 29-47s27 10 30 47Z" fill="#f59e0b" />
        <path
          d="m361 354-7 25M404 354l7 25"
          stroke="#334155"
          strokeWidth="9"
          strokeLinecap="round"
        />
      </motion.g>
    </motion.svg>
  );
}

export default function ModuleDetailPage({ mod: initialMod }: IModuleDetailPageProps) {
  const { data: catalogRaw } = useSwr<{ data?: { modules: IProductModule[] } }>(
    'super-admin/public-catalog',
  );
  const liveModule = catalogRaw?.data?.modules?.find((item) => item.slug === initialMod.id);
  const mod = React.useMemo<ErpModule>(() => {
    if (!liveModule) return initialMod;
    const descriptions = new Map(
      initialMod.features.map((feature) => [feature.title, feature.description]),
    );
    return {
      ...initialMod,
      title: liveModule.name,
      description: liveModule.description,
      longDescription: liveModule.description,
      iconName: liveModule.icon,
      features: liveModule.features.map((title) => ({
        title,
        description:
          descriptions.get(title) ??
          `Governed ${title.toLowerCase()} workflows connected to authorised institution data.`,
      })),
    };
  }, [initialMod, liveModule]);

  const relatedMods = getModulesByIds(mod.relatedModules);
  const currentIdx = ALL_MODULES.findIndex((item) => item.id === mod.id);
  const prevModule = currentIdx > 0 ? ALL_MODULES[currentIdx - 1] : null;
  const nextModule = currentIdx < ALL_MODULES.length - 1 ? ALL_MODULES[currentIdx + 1] : null;
  const isHostel = mod.id === 'hostel';

  return (
    <main className="overflow-hidden bg-white text-slate-900">
      <section className="relative isolate px-5 pb-20 pt-10 sm:px-8 sm:pb-28 lg:pt-16">
        <div className="absolute inset-x-0 top-0 -z-10 h-[44rem] bg-[radial-gradient(circle_at_78%_22%,rgba(14,165,233,0.14),transparent_30%),radial-gradient(circle_at_12%_15%,rgba(99,102,241,0.1),transparent_28%),linear-gradient(to_bottom,#f8fafc,white)]" />
        <div className="mx-auto max-w-7xl">
          <nav
            aria-label="Breadcrumb"
            className="mb-12 flex items-center gap-2 text-xs font-medium text-slate-400"
          >
            <Link href="/" className="transition-colors hover:text-slate-700">
              Home
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/modules" className="transition-colors hover:text-slate-700">
              Modules
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-sky-700">{mod.title}</span>
          </nav>

          <div className="grid items-center gap-14 lg:grid-cols-[.92fr_1.08fr] lg:gap-20">
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> {mod.tagline}
              </div>
              <h1 className="max-w-2xl text-4xl font-bold leading-[1.1] tracking-[-0.03em] text-slate-950 sm:text-5xl lg:text-6xl">
                {mod.title}
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                {mod.longDescription}
              </p>
              <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
                {mod.stats.map((stat) => (
                  <div key={stat.label}>
                    <p className="text-xl font-semibold tracking-tight text-sky-700 sm:text-2xl">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/demo"
                  className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-6 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-sky-700 hover:shadow-xl hover:shadow-sky-200"
                >
                  Explore in a live demo{' '}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/modules"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-6 py-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
                >
                  <ArrowLeft className="h-4 w-4" /> Browse modules
                </Link>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 24, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.08, ease: 'easeOut' }}
            >
              {isHostel ? <HostelOperationsPreview /> : <GenericOperationsPreview mod={mod} />}
            </motion.div>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <motion.div {...reveal} className="mb-12 max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
              One connected workflow
            </p>
            <h2 className="text-3xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-4xl">
              From allocation to everyday operations
            </h2>
            <p className="mt-4 leading-7 text-slate-500">
              Give every team a clear view of the work that matters, without spreadsheets or
              disconnected registers.
            </p>
          </motion.div>
          <div className="grid gap-5 lg:grid-cols-2">
            {mod.sections.map((section, index) => (
              <motion.article
                key={section.heading}
                {...reveal}
                transition={{ duration: 0.45, delay: index * 0.07 }}
                className="group rounded-[1.75rem] bg-slate-50 p-7 transition-colors duration-300 hover:bg-sky-50/70 sm:p-9"
              >
                <div className="mb-6 flex items-center gap-4">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-sm font-semibold text-sky-700">
                    0{index + 1}
                  </span>
                  <h3 className="text-xl font-semibold tracking-tight text-slate-900">
                    {section.heading}
                  </h3>
                </div>
                <p className="leading-7 text-slate-600">{section.body}</p>
                {section.items && (
                  <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                    {section.items.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-sm font-medium text-slate-600"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative bg-gradient-to-b from-sky-50/80 to-white px-5 py-20 sm:px-8 sm:py-28">
        <div className="absolute left-0 top-1/3 h-72 w-72 rounded-full bg-indigo-100/60 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-cyan-100/60 blur-3xl" />
        <div className="mx-auto max-w-7xl">
          <motion.div
            {...reveal}
            className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end"
          >
            <div className="max-w-2xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                Complete capability
              </p>
              <h2 className="text-3xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-4xl">
                Everything your team needs
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-slate-500">
              Configured for your institution, governed by role-based access, and connected to your
              existing ERP data.
            </p>
          </motion.div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {mod.features.map((feature, index) => {
              const visual = featureVisuals[index % featureVisuals.length];
              const FeatureIcon = visual.icon;
              return (
                <motion.article
                  key={feature.title}
                  {...reveal}
                  transition={{ duration: 0.4, delay: (index % 3) * 0.06 }}
                  className="group relative rounded-3xl bg-white/90 p-6 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.25)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_55px_-30px_rgba(14,165,233,0.3)]"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <span
                      className={`grid h-11 w-11 place-items-center rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 ${visual.tone}`}
                    >
                      <FeatureIcon className="h-5 w-5" />
                    </span>
                    <span className="text-[10px] font-bold tracking-widest text-slate-300">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-900">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{feature.description}</p>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      {relatedMods.length > 0 && (
        <section className="px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 flex items-end justify-between">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                  Works better together
                </p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                  Related modules
                </h2>
              </div>
              <Link
                href="/modules"
                className="hidden items-center gap-2 text-sm font-bold text-slate-500 hover:text-sky-700 sm:flex"
              >
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {relatedMods.map((related) => (
                <Link
                  key={related.id}
                  href={`/modules/${related.id}`}
                  className="group rounded-3xl bg-slate-50 p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-sky-50"
                >
                  <div className="mb-8 flex items-center justify-between">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-sky-700">
                      <ShieldCheck className="h-5 w-5" />
                    </span>
                    <ExternalLink className="h-4 w-4 text-slate-300 transition-colors group-hover:text-sky-600" />
                  </div>
                  <h3 className="font-semibold text-slate-900">{related.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{related.tagline}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="px-5 pb-20 sm:px-8 sm:pb-28">
        <div className="relative mx-auto grid max-w-7xl items-center gap-8 overflow-hidden rounded-[2rem] bg-gradient-to-br from-sky-50 via-white to-indigo-50 px-6 py-8 sm:px-10 sm:py-10 lg:grid-cols-[.88fr_1.12fr] lg:px-14">
          <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-cyan-100/60 blur-3xl" />
          <motion.div
            {...reveal}
            className="relative z-10 order-2 max-w-xl pb-4 lg:order-1 lg:pb-0"
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
              A demo built around you
            </p>
            <h2 className="text-3xl font-semibold leading-tight tracking-[-0.025em] text-slate-950 sm:text-4xl">
              See {mod.title} working with your process
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-7 text-slate-600 sm:text-base">
              Explore your real configuration, permissions, workflows, and reports through a guided
              institutional scenario—not a generic product tour.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-slate-500">
              {['Role-based walkthrough', 'Your questions answered', 'No setup required'].map(
                (item) => (
                  <span key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> {item}
                  </span>
                ),
              )}
            </div>
            <Link
              href="/demo"
              className="group mt-8 inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-6 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-sky-700 hover:shadow-xl hover:shadow-sky-200"
            >
              Book a guided demo
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
          <div className="relative z-10 order-1 mx-auto w-full max-w-xl lg:order-2">
            <GuidedDemoIllustration />
          </div>
        </div>
      </section>

      <nav aria-label="Module navigation" className="bg-slate-50 px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          {prevModule ? (
            <Link
              href={`/modules/${prevModule.id}`}
              className="group flex min-w-0 items-center gap-3"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-slate-500 group-hover:text-sky-700">
                <ArrowLeft className="h-4 w-4" />
              </span>
              <span className="hidden min-w-0 sm:block">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Previous
                </span>
                <span className="block truncate text-sm font-bold text-slate-700">
                  {getModuleById(prevModule.id)?.title}
                </span>
              </span>
            </Link>
          ) : (
            <span />
          )}
          <Link
            href="/modules"
            className="text-xs font-semibold uppercase tracking-widest text-slate-500 transition-colors hover:text-sky-700"
          >
            All modules
          </Link>
          {nextModule ? (
            <Link
              href={`/modules/${nextModule.id}`}
              className="group flex min-w-0 items-center gap-3 text-right"
            >
              <span className="hidden min-w-0 sm:block">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Next
                </span>
                <span className="block truncate text-sm font-bold text-slate-700">
                  {getModuleById(nextModule.id)?.title}
                </span>
              </span>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-slate-500 group-hover:text-sky-700">
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ) : (
            <span />
          )}
        </div>
      </nav>
    </main>
  );
}

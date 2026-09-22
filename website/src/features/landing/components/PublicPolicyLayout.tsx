'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft, FileCheck2, ShieldCheck } from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import PublicSiteLayout from './PublicSiteLayout';

interface IProps {
  eyebrow: string;
  title: string;
  summary: string;
  updated: string;
  children: ReactNode;
}

export default function PublicPolicyLayout({ eyebrow, title, summary, updated, children }: IProps) {
  return (
    <PublicSiteLayout>
      <section className="relative overflow-hidden bg-[#f2f8fc] px-5 py-16 md:px-10 lg:py-24">
        <motion.div
          animate={{ x: [0, 18, 0], y: [0, -12, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-[#dceefa]"
        />
        <motion.div
          animate={{ x: [0, -12, 0], y: [0, 10, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute -bottom-20 left-[8%] h-56 w-56 rounded-full bg-[#fff0e8]"
        />
        <div className="relative mx-auto grid max-w-[1100px] items-center gap-12 lg:grid-cols-[1fr_320px]">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-bold text-[#0178d7]"
            >
              <ArrowLeft size={16} /> Back to home
            </Link>
            <p className="mt-10 text-xs font-bold uppercase tracking-[0.2em] text-[#ff7657]">
              {eyebrow}
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-[-0.05em] sm:text-6xl">{title}</h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-[#667085]">{summary}</p>
            <p className="mt-6 text-sm font-semibold text-[#596579]">Last updated: {updated}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.94, rotate: 2 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.7, delay: 0.12 }}
            className="relative hidden min-h-72 overflow-hidden rounded-[2rem] bg-white p-7 lg:block"
          >
            <div className="flex items-center justify-between">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-[#0178d7]">
                <FileCheck2 className="h-6 w-6" />
              </span>
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Clear & governed
              </span>
            </div>
            <div className="mt-8 space-y-3">
              <span className="block h-3 w-4/5 rounded-full bg-[#dceefa]" />
              <span className="block h-3 w-full rounded-full bg-[#edf5fb]" />
              <span className="block h-3 w-3/5 rounded-full bg-[#edf5fb]" />
            </div>
            <div className="mt-8 flex items-center gap-3 rounded-2xl bg-[#f2f8fc] p-4">
              <ShieldCheck className="h-5 w-5 text-[#16846b]" />
              <p className="text-xs font-semibold leading-5 text-[#596579]">
                Designed to make responsibilities, safeguards and commercial terms easier to
                understand.
              </p>
            </div>
            <motion.span
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -bottom-7 -right-5 h-28 w-28 rounded-full bg-[#ff7657]/15"
            />
          </motion.div>
        </div>
      </section>
      <motion.article
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.05 }}
        transition={{ duration: 0.65 }}
        className="policy-content mx-auto max-w-[1000px] px-5 py-16 md:px-10 lg:py-24"
      >
        {children}
      </motion.article>
    </PublicSiteLayout>
  );
}

export function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.45 }}
      className="mb-12 scroll-mt-24 rounded-2xl bg-[#f8fafc] p-5 sm:p-7"
    >
      <h2 className="text-2xl font-bold tracking-[-0.025em]">{title}</h2>
      <div className="mt-4 space-y-4 leading-7 text-[#596579]">{children}</div>
    </motion.section>
  );
}

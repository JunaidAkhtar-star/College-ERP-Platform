'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import { LockKeyhole } from 'lucide-react';
import { motion } from '@/shared/utils/motion';

const websiteUrl = process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://devvelocity.in';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh w-full overflow-hidden bg-white">
      <div className="flex min-h-dvh w-full flex-col px-6 py-6 sm:px-10 lg:w-[54%] lg:px-16 xl:px-20">
        <div className="flex items-center justify-between">
          <a href={websiteUrl} aria-label="Devvelocity website">
            <Image
              src="/devvelocitylogo.webp"
              alt="Devvelocity"
              width={210}
              height={58}
              priority
              className="h-11 w-auto object-contain"
            />
          </a>
          <a
            href={websiteUrl}
            className="text-sm font-semibold text-[#667085] transition hover:text-[#0178d7]"
          >
            Back to website
          </a>
        </div>

        <div className="my-auto w-full py-14">
          <div className="mx-auto w-full max-w-md">{children}</div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#e6edf3] pt-5 text-xs text-[#8a94a6]">
          <span>© {new Date().getFullYear()} Devvelocity</span>
          <div className="flex items-center gap-4 font-semibold">
            <a href={`${websiteUrl}/privacy`} className="hover:text-[#0178d7]">
              Privacy
            </a>
            <a href={`${websiteUrl}/terms`} className="hover:text-[#0178d7]">
              Terms
            </a>
            <a href={`${websiteUrl}/contact`} className="hover:text-[#0178d7]">
              Support
            </a>
          </div>
        </div>
      </div>

      <div className="relative hidden min-h-dvh overflow-hidden border-l border-[#dbe6ed] bg-[#edf4f8] lg:flex lg:w-[46%] lg:items-center">
        <span className="absolute right-10 top-10 text-xs font-bold tracking-[0.22em] text-[#97a9b7]">
          PLATFORM ADMIN
        </span>
        <span
          className="absolute bottom-8 left-1/2 w-full -translate-x-1/2 select-none whitespace-nowrap text-center text-[clamp(3rem,5.7vw,6.5rem)] font-black leading-none tracking-[-0.075em] text-[#dfeaf0]"
          aria-hidden="true"
        >
          Devvelocity
        </span>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative mx-auto w-full max-w-lg px-12 xl:px-16"
        >
          <div className="h-1 w-14 bg-[#0178d7]" />
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-[#0178d7]">
            Devvelocity operator workspace
          </p>
          <h2 className="mt-6 text-4xl font-bold leading-[1.08] tracking-[-0.045em] text-[#172033] xl:text-[3.25rem]">
            Control with clarity.
          </h2>
          <p className="mt-6 max-w-sm text-lg leading-8 text-[#5f6d7b]">
            Manage institutions, subscriptions, billing, platform configuration and operational
            security from one focused workspace.
          </p>
          <div className="mt-12 grid grid-cols-3 border-y border-[#cfdee7] py-6">
            {['Tenant operations', 'Plans and billing', 'Security controls'].map((item, index) => (
              <div
                key={item}
                className="border-r border-[#cfdee7] px-4 first:pl-0 last:border-0 last:pr-0"
              >
                <span className="text-xs font-bold text-[#0178d7]">0{index + 1}</span>
                <p className="mt-2 text-xs font-semibold leading-5 text-[#536170]">{item}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex items-center gap-3 text-xs font-semibold text-[#667684]">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-[#0178d7]">
              <LockKeyhole size={16} />
            </span>
            Protected authentication with MFA and controlled administrator sessions.
          </div>
        </motion.div>
      </div>
    </div>
  );
}

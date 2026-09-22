/**
 * Global 404 — Not Found page
 *
 * Rendered by Next.js App Router whenever a route is unmatched or
 * `notFound()` is called. Uses the shared brand styling, animated
 * digits, and a CTA back to a safe route.
 */

'use client';

import { useRouter } from 'nextjs-toploader/app';
import { ArrowLeft, Home, Search } from 'lucide-react';

import CustomButton from '@/shared/core/CustomButton';
import { motion } from '@/shared/utils/motion';

const NotFoundPage = () => {
  const router = useRouter();

  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-linear-to-br from-[#eaf4ff] via-white to-[#f3eaff] px-4 py-10">
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[#0178D7]/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 -bottom-32 h-96 w-96 rounded-full bg-[#6160b0]/20 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center"
      >
        <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-black text-white">
          D
        </span>

        <div className="flex items-center justify-center gap-2 sm:gap-4">
          {['4', '0', '4'].map((digit, idx) => (
            <motion.span
              key={idx}
              initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ delay: 0.15 * idx, type: 'spring', stiffness: 180, damping: 14 }}
              className="bg-linear-to-br from-primary-700 via-[#0178D7] to-primary-400 bg-clip-text text-[7rem] leading-none font-extrabold tracking-tight text-transparent sm:text-[10rem]"
            >
              {digit}
            </motion.span>
          ))}
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
          className="mt-4 text-2xl font-semibold text-slate-800 sm:text-3xl"
        >
          Page not found
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.4 }}
          className="mt-3 max-w-md text-sm text-slate-500 sm:text-base"
        >
          The page you are looking for doesn&apos;t exist, was moved, or is temporarily unavailable.
          Let&apos;s get you back on track.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.4 }}
          className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <CustomButton
            variant="secondary"
            startIcon={<ArrowLeft size={18} />}
            onClick={() => router.back()}
            fullWidth={false}
          >
            Go back
          </CustomButton>

          <CustomButton
            variant="primary"
            startIcon={<Home size={18} />}
            onClick={() => router.push('/')}
            fullWidth={false}
          >
            Back to home
          </CustomButton>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85, duration: 0.4 }}
          className="mt-10 flex items-center gap-2 text-xs text-slate-600"
        >
          <Search size={14} />
          <span>Error code: 404 · Resource not found</span>
        </motion.div>
      </motion.div>
    </main>
  );
};

export default NotFoundPage;

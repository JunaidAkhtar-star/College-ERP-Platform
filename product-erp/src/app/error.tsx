/**
 * Route-level Error Boundary
 *
 * Catches runtime errors thrown anywhere inside the app's route tree
 * (without replacing the root layout). Shows a friendly UI with the
 * real-time error message, digest, and an expandable stack trace.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'nextjs-toploader/app';
import { AlertTriangle, RefreshCcw, Home, Copy, Check, ChevronDown } from 'lucide-react';

import CustomButton from '@/shared/core/CustomButton';
import { motion } from '@/shared/utils/motion';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

const RouteError = ({ error, reset }: Props) => {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    console.error('[RouteError]', error);
  }, [error]);

  const handleCopy = async () => {
    const payload = [
      `Message: ${error.message}`,
      error.digest ? `Digest: ${error.digest}` : null,
      error.stack ? `\nStack:\n${error.stack}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-linear-to-br from-rose-50 via-white to-amber-50 px-4 py-10">
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-rose-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 -bottom-32 h-96 w-96 rounded-full bg-amber-300/30 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center"
      >
        <motion.div
          initial={{ scale: 0.6, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 180, damping: 14 }}
          className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-rose-100"
        >
          <AlertTriangle className="h-10 w-10 text-rose-600" />
        </motion.div>

        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Something went wrong
        </h1>
        <p className="mt-3 max-w-md text-sm text-slate-500 sm:text-base">
          An unexpected error occurred. You can try again, head back home, or copy the details below
          to share with support.
        </p>

        <div className="mt-8 w-full rounded-2xl bg-white p-6 text-left">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-wide text-rose-600 uppercase">
                Error message
              </p>
              <p className="mt-1 wrap-break-word font-mono text-sm text-slate-800">
                {error.message || 'Unknown error'}
              </p>
              {error.digest && (
                <p className="mt-3 text-xs text-slate-600">
                  Digest: <span className="font-mono text-slate-600">{error.digest}</span>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
              aria-label="Copy error details"
            >
              {copied ? (
                <>
                  <Check size={14} /> Copied
                </>
              ) : (
                <>
                  <Copy size={14} /> Copy
                </>
              )}
            </button>
          </div>

          {error.stack && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowDetails((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                <ChevronDown
                  size={14}
                  className={`transition-transform ${showDetails ? 'rotate-180' : ''}`}
                />
                {showDetails ? 'Hide' : 'Show'} stack trace
              </button>
              {showDetails && (
                <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-left font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-slate-700">
                  {error.stack}
                </pre>
              )}
            </div>
          )}
        </div>

        <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
          <CustomButton
            variant="secondary"
            startIcon={<Home size={18} />}
            onClick={() => router.push('/')}
            fullWidth={false}
          >
            Back to home
          </CustomButton>
          <CustomButton
            variant="primary"
            startIcon={<RefreshCcw size={18} />}
            onClick={() => reset()}
            fullWidth={false}
          >
            Try again
          </CustomButton>
        </div>

        <p className="mt-10 text-xs text-slate-600">Error code: 500 · Internal application error</p>
      </motion.div>
    </main>
  );
};

export default RouteError;

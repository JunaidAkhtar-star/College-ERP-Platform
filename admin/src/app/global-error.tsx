/**
 * Global Error Boundary
 *
 * Catches errors thrown in the root layout itself. Must define its own
 * <html> and <body> since it replaces the root layout on render.
 * See: https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertOctagon, RefreshCcw, Home, Copy, Check, ChevronDown } from 'lucide-react';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

const GlobalError = ({ error, reset }: Props) => {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    console.error('[GlobalError]', error);
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
    <html lang="en" data-scroll-behavior="smooth">
      <body className="min-h-dvh bg-slate-50 font-sans antialiased">
        <main className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-linear-to-br from-rose-50 via-white to-amber-50 px-4 py-10">
          <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-rose-300/30 blur-3xl" />
          <div className="pointer-events-none absolute -right-32 -bottom-32 h-96 w-96 rounded-full bg-amber-300/30 blur-3xl" />

          <div className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-rose-100">
              <AlertOctagon className="h-10 w-10 text-rose-600" />
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Something went wrong
            </h1>
            <p className="mt-3 max-w-md text-sm text-slate-500 sm:text-base">
              An unexpected error occurred while loading this page. The technical details are shown
              below — you can copy them and share with the support team.
            </p>

            <div className="mt-8 w-full rounded-2xl bg-white p-6 text-left">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold tracking-wide text-rose-600 uppercase">
                    Error message
                  </p>
                  <p className="mt-1 font-mono text-sm wrap-break-word text-slate-800">
                    {error.message || 'Unknown error'}
                  </p>
                  {error.digest && (
                    <p className="mt-3 text-xs text-slate-400">
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
                    <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-slate-900 p-4 text-left font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-slate-100">
                      {error.stack}
                    </pre>
                  )}
                </div>
              )}
            </div>

            <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-linear-to-br from-primary-700 via-[#0178D7] to-primary-400 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
              >
                <RefreshCcw size={16} /> Try again
              </button>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                <Home size={16} /> Back to home
              </Link>
            </div>

            <p className="mt-10 text-xs text-slate-400">
              Error code: 500 · Internal application error
            </p>
          </div>
        </main>
      </body>
    </html>
  );
};

export default GlobalError;

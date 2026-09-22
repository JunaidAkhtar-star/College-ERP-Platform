'use client';

import useMutation from '@/shared/hooks/useMutation';
import { useAuthStore } from '@/shared/store/authStore';
import { ILoginResponse, IMfaLoginResponse, TSystemRole } from '@/shared/types';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  LockKeyhole,
} from 'lucide-react';
import { useRouter } from 'nextjs-toploader/app';
import { useCallback, useEffect, useRef, useState } from 'react';

type TCallbackStatus = 'verifying' | 'mfa' | 'success' | 'error';

const providerMessages: Record<string, string> = {
  access_denied: 'The sign-in request was cancelled or access was denied.',
  interaction_required: 'Your identity provider needs another sign-in step.',
  login_required: 'Please sign in to your administrator identity account.',
  temporarily_unavailable: 'The identity provider is temporarily unavailable. Please try again.',
};

export default function PlatformSsoCallbackPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const { mutation } = useMutation();
  const started = useRef(false);
  const [status, setStatus] = useState<TCallbackStatus>('verifying');
  const [message, setMessage] = useState('Confirming your identity and platform permissions.');
  const [mfaChallenge, setMfaChallenge] = useState<IMfaLoginResponse | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  const finishLogin = useCallback(
    (data: ILoginResponse) => {
      const activeRole = (data.user?.role || data.user?.roles?.[0]) as TSystemRole | undefined;
      if (!data.accessToken || !data.user || activeRole !== 'super_admin') {
        setStatus('error');
        setMessage('This account does not have permission to access the administrator platform.');
        return;
      }
      setAuth(data.user, data.accessToken, data.refreshToken, activeRole, data.role ?? null);
      setStatus('success');
      setMessage(`Welcome ${data.user.name}. Your secure session is ready.`);
      window.setTimeout(() => router.replace('/'), 900);
    },
    [router, setAuth],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const providerError = params.get('error');

    if (providerError || !code || !state) {
      window.queueMicrotask(() => {
        setStatus('error');
        setMessage(
          providerMessages[providerError ?? ''] ??
            'The administrator sign-in response was incomplete. Please start again.',
        );
      });
      return;
    }

    void (async () => {
      const response = await mutation('sso/complete', { method: 'POST', body: { code, state } });
      const data = response?.results?.data as ILoginResponse | IMfaLoginResponse | undefined;
      if (data && 'mfaRequired' in data && data.mfaRequired) {
        setMfaChallenge(data);
        setStatus('mfa');
        setMessage(`Enter the authenticator code for ${data.email ?? 'your account'}.`);
        return;
      }
      if (!data || !('accessToken' in data)) {
        setStatus('error');
        setMessage(
          response
            ? 'This account does not have permission to access the administrator platform.'
            : 'We could not verify this administrator account. Please review the SSO configuration and try again.',
        );
        return;
      }
      finishLogin(data);
    })();
  }, [finishLogin, mutation]);

  const verifyMfa = async () => {
    if (!mfaChallenge || mfaCode.length !== 6) return;
    const response = await mutation('auth/mfa/login-verify', {
      method: 'POST',
      body: { mfaToken: mfaChallenge.mfaToken, code: mfaCode },
    });
    const data = response?.results?.data as ILoginResponse | undefined;
    if (!data?.accessToken) {
      setMessage('The code was invalid or expired. Check your authenticator and try again.');
      return;
    }
    finishLogin(data);
  };

  const isVerifying = status === 'verifying';

  return (
    <main className="relative grid min-h-dvh overflow-hidden bg-[#f5f9fc] px-5 py-10">
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-cyan-100/60 blur-3xl" />

      <section className="relative m-auto w-full max-w-lg overflow-hidden rounded-[2rem] bg-white p-6 sm:p-9">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-primary">
              <LockKeyhole className="h-4 w-4" />
            </span>
            Devvelocity Admin
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
            Secure SSO
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={status}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="py-10 text-center"
          >
            <motion.span
              initial={{ scale: 0.85 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 18 }}
              className={`mx-auto grid h-20 w-20 place-items-center rounded-[1.7rem] ${
                status === 'success'
                  ? 'bg-emerald-50 text-emerald-600'
                  : status === 'error'
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-blue-50 text-primary'
              }`}
            >
              {status === 'success' ? (
                <CheckCircle2 className="h-9 w-9" />
              ) : status === 'error' ? (
                <CircleAlert className="h-9 w-9" />
              ) : status === 'mfa' ? (
                <LockKeyhole className="h-9 w-9" />
              ) : (
                <LoaderCircle className="h-9 w-9 animate-spin" />
              )}
            </motion.span>

            <p className="mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              {status === 'success'
                ? 'Verification complete'
                : status === 'error'
                  ? 'Sign-in not completed'
                  : status === 'mfa'
                    ? 'MFA verification'
                    : 'Identity verification'}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-slate-900 sm:text-3xl">
              {status === 'success'
                ? 'You’re securely signed in'
                : status === 'error'
                  ? 'We couldn’t sign you in'
                  : status === 'mfa'
                    ? 'Enter your security code'
                    : 'Securing your access'}
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">{message}</p>

            {status === 'mfa' && (
              <div className="mx-auto mt-7 max-w-xs">
                <input
                  value={mfaCode}
                  onChange={(event) =>
                    setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void verifyMfa();
                  }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-label="Six-digit authenticator code"
                  placeholder="000000"
                  className="w-full rounded-xl bg-slate-50 px-4 py-3 text-center font-mono text-xl tracking-[0.35em] text-slate-900 outline-none ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="button"
                  disabled={mfaCode.length !== 6}
                  onClick={() => void verifyMfa()}
                  className="mt-3 w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Verify and continue
                </button>
              </div>
            )}

            {status === 'error' && (
              <button
                type="button"
                onClick={() => router.replace('/auth/signin')}
                className="mx-auto mt-7 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </button>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            {['Identity received', 'Access verified', 'Open dashboard'].map((label, index) => {
              const completed = status === 'success' || (isVerifying && index === 0);
              return (
                <div key={label} className="flex min-w-0 flex-1 items-center gap-2">
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                      completed ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {completed ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </span>
                  <span className="hidden truncate text-[11px] font-medium text-slate-500 sm:block">
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">
          Protected with encrypted session exchange and role verification.
        </p>
      </section>
    </main>
  );
}

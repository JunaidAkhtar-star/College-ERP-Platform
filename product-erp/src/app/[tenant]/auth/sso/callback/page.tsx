'use client';

import useMutation from '@/shared/hooks/useMutation';
import { useAuthStore } from '@/shared/store/authStore';
import { ILoginResponse, IMfaLoginResponse, TSystemRole } from '@/shared/types';
import { LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useRouter } from 'nextjs-toploader/app';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';

export default function SsoCallbackPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const { mutation } = useMutation();
  const started = useRef(false);
  const [mfaChallenge, setMfaChallenge] = useState<IMfaLoginResponse | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  const finishLogin = useCallback(
    (data: ILoginResponse) => {
      const activeRole = (data.user.role || data.user.roles?.[0]) as TSystemRole;
      if (!activeRole) {
        toast.error('Your account has no assigned ERP role');
        return;
      }
      setAuth(data.user, data.accessToken, data.refreshToken, activeRole, data.role ?? null);

      const tenantPrefix = window.location.pathname.slice(0, -'/auth/sso/callback'.length);
      router.replace(
        `${tenantPrefix}/${activeRole}/${data.onboardingRequired && ['super_admin', 'admin'].includes(activeRole) ? 'onboarding' : 'dashboard'}`,
      );
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
    const signInPath = window.location.pathname.replace(
      /\/auth\/sso\/callback\/?$/,
      '/auth/signin',
    );
    if (providerError || !code || !state) {
      const providerMessages: Record<string, string> = {
        access_denied: 'Single sign-on was cancelled or access was denied.',
        interaction_required: 'Your identity provider requires another sign-in step.',
        login_required: 'Please sign in to your institution account and try again.',
        temporarily_unavailable: 'The identity provider is temporarily unavailable.',
      };
      toast.error(
        providerMessages[providerError ?? ''] ?? 'Single sign-on could not be completed.',
      );
      router.replace(signInPath);
      return;
    }
    void (async () => {
      const response = await mutation('sso/complete', { method: 'POST', body: { code, state } });
      const data = response?.results?.data as ILoginResponse | IMfaLoginResponse | undefined;
      if (data && 'mfaRequired' in data && data.mfaRequired) {
        setMfaChallenge(data);
        return;
      }
      if (!data || !('accessToken' in data) || !data.user) {
        router.replace(signInPath);
        return;
      }
      finishLogin(data);
    })();
  }, [finishLogin, mutation, router]);

  const verifyMfa = async () => {
    if (!mfaChallenge || mfaCode.length !== 6) return;
    const response = await mutation('auth/mfa/login-verify', {
      method: 'POST',
      body: { mfaToken: mfaChallenge.mfaToken, code: mfaCode },
    });
    const data = response?.results?.data as ILoginResponse | undefined;
    if (!data?.accessToken) {
      toast.error('Invalid or expired authenticator code');
      return;
    }
    finishLogin(data);
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 p-6">
      <div className="rounded-3xl bg-white p-10 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-primary">
          {mfaChallenge ? <LockKeyhole className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />}
        </span>
        <h1 className="mt-5 text-xl font-black text-slate-900">
          {mfaChallenge ? 'Verify your security code' : 'Securing your session'}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {mfaChallenge
            ? `Enter the authenticator code for ${mfaChallenge.email ?? 'your account'}.`
            : 'Verifying your institution identity…'}
        </p>
        {mfaChallenge ? (
          <div className="mt-6">
            <input
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
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
        ) : (
          <LoaderCircle className="mx-auto mt-5 h-5 w-5 animate-spin text-primary" />
        )}
      </div>
    </main>
  );
}

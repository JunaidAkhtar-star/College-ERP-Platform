/**
 * @file SignIn.tsx
 * @description Premium animated enterprise sign-in page for tenant workspaces.
 *  - Split layout: animated brand panel (left) + form panel (right)
 *  - Staggered Framer Motion entrance animations
 *  - Floating-style inputs with focus micro-interactions
 *  - Show/hide password, optional role selector
 *  - Redirects to /{role}/dashboard on success
 * @module features/auth/components/signin
 */

'use client';

import { signinSchema } from '@/features/auth/validations/auth.schema';
import CustomButton from '@/shared/core/CustomButton';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useAuthStore } from '@/shared/store/authStore';
import { ILoginResponse, IMfaLoginResponse, TSystemRole } from '@/shared/types';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import { useFormik } from 'formik';
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LogIn,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'nextjs-toploader/app';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import AuthLayout from '../../layouts/AuthLayout';
import ChangePasswordModal from '@/shared/components/ChangePasswordModal';
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0 },
};

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.98-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.93A6 6 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.64.39 3.19 1.04 4.55l3.35-2.62Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"
      />
    </svg>
  );
}

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0">
      <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
      <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
      <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  );
}

export default function SignIn() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearSessionExpired = useAuthStore((s) => s.clearSessionExpired);
  const { mutation, isLoading } = useMutation();
  const { mutation: startSsoRequest } = useMutation();
  const {
    data: ssoRaw,
    error: ssoError,
    isLoading: isSsoLoading,
    mutate: retrySso,
  } = useSwr<{ success: boolean; data: Array<'google' | 'microsoft'> }>('sso/providers');
  const ssoProviders = ssoRaw?.data ?? [];
  const [showPassword, setShowPassword] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);
  const [mustChange, setMustChange] = useState(false);
  const [mfaState, setMfaState] = useState<{ mfaToken: string; email: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [connectingProvider, setConnectingProvider] = useState<'google' | 'microsoft' | null>(null);
  // Check for error query parameter and show warning
  useEffect(() => {
    // Reaching the sign-in page implies any prior "session expired" state has
    // been acknowledged \u2014 dismiss the flag so the modal can't reappear after a
    // successful login.
    clearSessionExpired();
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (error === 'invalid_role') {
      toast.warning('Your session is invalid. Please sign in again.', {
        position: 'top-center',
        autoClose: 5000,
      });
      // Clean up URL
      window.history.replaceState({}, '', '/auth/signin');
    }
  }, [clearSessionExpired]);
  const formik = useFormik({
    initialValues: { email: '', password: '', role: '' as TSystemRole | '' },
    validationSchema: signinSchema,
    onSubmit: async (values) => {
      try {
        const payload: { email: string; password: string; role?: TSystemRole } = {
          email: values.email,
          password: values.password,
        };
        if (values.role) payload.role = values.role as TSystemRole;

        const res = await mutation('auth/login', {
          method: 'POST',
          body: payload,
          isAlert: false,
          platformContext: true,
        });
        if (res?.status === 200) {
          const data = res.results?.data as
            | (ILoginResponse & Partial<IMfaLoginResponse>)
            | undefined;
          // MFA challenge — password is correct, ask for TOTP code.
          if (data && 'mfaRequired' in data && data.mfaRequired && data.mfaToken) {
            setMfaState({ mfaToken: data.mfaToken, email: data.email || values.email });
            return;
          }

          if (!data?.accessToken || !data?.user) {
            toast.error('Unexpected response from server.');
            return;
          }
          // Backend returns user.roles[] array, extract the active role
          // Check if backend included role property, otherwise use first role from roles array
          const activeRole = (data.user.role || data.user.roles?.[0]) as TSystemRole;
          if (!activeRole) {
            toast.error('Login failed: No role assigned to your account.');
            return;
          }

          if (activeRole !== 'super_admin') {
            toast.error('This portal is restricted to Devvelocity platform administrators.');
            return;
          }

          setAuth(data.user, data.accessToken, data.refreshToken, activeRole, data.role ?? null);
          const redirect = '/';
          if (data.mustChangePassword) {
            setPendingRedirect(redirect);
            setMustChange(true);
            toast.info('Please set a new password to continue.');
            return;
          }
          toast.success(`Welcome back, ${data.user.name}!`);
          router.replace(redirect);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Login failed. Please try again.');
      }
    },
  });

  const err = (f: keyof typeof formik.values) =>
    formik.touched[f] && formik.errors[f] ? (formik.errors[f] as string) : '';
  const tenantId = null;
  const startSso = async (provider: 'google' | 'microsoft') => {
    setConnectingProvider(provider);
    try {
      const response = await startSsoRequest('sso/start', {
        method: 'POST',
        body: { provider, returnUrl: `${window.location.origin}/auth/sso/callback` },
      });
      const authorizationUrl = (
        response?.results?.data as { authorizationUrl?: string } | undefined
      )?.authorizationUrl;
      if (authorizationUrl) window.location.assign(authorizationUrl);
    } finally {
      setConnectingProvider(null);
    }
  };

  return (
    <AuthLayout>
      {!tenantId ? (
        // ──── CASE 1: GLOBAL DEVELOCITY LOGIN (MATCHING THE ATTACHED DESIGN IMAGE) ────
        <div className="mx-auto w-full max-w-md space-y-7">
          {/* Heading Title */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="space-y-3"
          >
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0178d7]">
              Secure operator access
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-[-0.04em] text-[#172033]">
              Welcome back.
            </h1>
            <p className="text-base leading-7 text-[#667085]">
              Sign in to manage tenants, subscriptions and platform operations.
            </p>
          </motion.div>

          {/* Sign In Form */}
          <motion.form
            variants={stagger}
            initial="hidden"
            animate="show"
            onSubmit={formik.handleSubmit}
            noValidate
            className="space-y-5 rounded-[1.75rem] border border-[#e2ebf2] bg-white p-6 shadow-[0_20px_60px_rgba(23,32,51,0.07)] sm:p-7"
          >
            {/* Unified Input Card box */}
            <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden shadow-2xs">
              {/* Email section */}
              <div
                className={`py-2.5 pr-4 pl-4 transition-all duration-200
                  ${
                    err('email')
                      ? 'border-l-4 border-l-red-500 bg-red-50/10'
                      : 'border-l-4 border-l-primary-600 bg-white'
                  }`}
              >
                <label
                  htmlFor="email"
                  className="block text-[9px] font-bold uppercase tracking-wider text-slate-400"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@devvelocity.com"
                  {...formik.getFieldProps('email')}
                  className={`w-full bg-transparent outline-none text-slate-900 font-semibold text-sm pt-0.5 placeholder:text-slate-300
                        ${err('email') ? 'shake-input text-red-600' : ''}`}
                />
                {err('email') && (
                  <p className="text-[10px] font-semibold text-red-500 mt-1 select-none">
                    {err('email')}
                  </p>
                )}
              </div>
              {/* Password section */}
              <div
                className={`py-2.5 pr-4 pl-4 relative transition-all duration-200
                  ${
                    err('password')
                      ? 'border-l-4 border-l-red-500 bg-red-50/10'
                      : 'border-l-4 border-l-primary-600 bg-white'
                  }`}
              >
                <label
                  htmlFor="password"
                  className="block text-[9px] font-bold uppercase tracking-wider text-slate-400"
                >
                  Password
                </label>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••••••••••"
                  {...formik.getFieldProps('password')}
                  className={`w-full bg-transparent outline-none text-slate-900 font-semibold text-sm pt-0.5 placeholder:text-slate-300 pr-8
                        ${err('password') ? 'shake-input text-red-600' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-4 rounded-md p-0.5 text-slate-400 transition-colors hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                {err('password') && (
                  <p className="text-[10px] font-semibold text-red-500 mt-1 select-none">
                    {err('password')}
                  </p>
                )}
              </div>
            </div>

            {/* Remember & Forgot */}
            <div className="flex justify-end text-xs font-semibold text-slate-500">
              <Link
                href="/auth/forgot-password"
                className="hover:text-primary-600 transition-colors"
              >
                Forgot Password?
              </Link>
            </div>

            {/* Submit Button */}
            <div className="pt-1">
              <CustomButton
                type="submit"
                loading={isLoading}
                loadingText="Logging in…"
                className="w-full! bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg py-3.5 shadow-sm transition-all duration-200 text-sm"
              >
                Login
              </CustomButton>
            </div>

            <p className="text-center text-xs leading-5 text-[#8a94a6]">
              Access is restricted to authorized Devvelocity platform operators.
            </p>
          </motion.form>
          {ssoProviders.length > 0 && (
            <div className="rounded-[1.5rem] bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                Administrator SSO
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              <div className={`grid gap-2 ${ssoProviders.length > 1 ? 'sm:grid-cols-2' : ''}`}>
                {ssoProviders.map((provider) => (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => startSso(provider)}
                    disabled={connectingProvider !== null}
                    className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-50 hover:text-primary disabled:translate-y-0 disabled:cursor-wait disabled:opacity-60"
                  >
                    {connectingProvider === provider ? (
                      <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
                    ) : provider === 'google' ? (
                      <GoogleLogo />
                    ) : (
                      <MicrosoftLogo />
                    )}
                    {connectingProvider === provider
                      ? `Connecting to ${provider === 'google' ? 'Google' : 'Microsoft'}…`
                      : `Continue with ${provider === 'google' ? 'Google' : 'Microsoft'}`}
                  </button>
                ))}
              </div>
            </div>
          )}
          {isSsoLoading && (
            <p className="text-center text-xs text-slate-400">
              Checking administrator sign-in options…
            </p>
          )}
          {ssoError && (
            <div className="rounded-xl bg-amber-50 p-3 text-center text-xs text-amber-800">
              Administrator SSO is temporarily unavailable. Password login still works.
              <button
                type="button"
                onClick={() => void retrySso()}
                className="ml-2 inline-flex items-center gap-1 font-bold"
              >
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </div>
          )}
        </div>
      ) : (
        // ──── CASE 2: PROPER TENANT LOGIN (WITH TENANT RESOLVED) ────
        <div className="w-full max-w-md mx-auto space-y-6">
          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-8 text-center md:text-left"
          >
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-primary-600">
              Welcome Back
            </p>
            <h2 className="text-3xl font-extrabold text-slate-900">Sign in to portal</h2>
            <p className="mt-1.5 text-sm text-slate-500">Access your unified workspace dashboard</p>
          </motion.div>

          {/* Form card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="w-full max-w-md mx-auto"
          >
            <motion.form
              variants={stagger}
              initial="hidden"
              animate="show"
              onSubmit={formik.handleSubmit}
              noValidate
              className="space-y-5"
            >
              {/* Email */}
              <motion.div variants={fadeUp} className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@develocity.com"
                  {...formik.getFieldProps('email')}
                  className={`w-full rounded-xl border-2 px-4 py-3 text-sm text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 focus:ring-4
                        ${
                          err('email')
                            ? 'border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-red-100 shake-input'
                            : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 focus:border-primary-500 focus:bg-white focus:ring-primary-50'
                        }`}
                />
                <AnimatePresence>
                  {err('email') && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                      className="text-xs font-semibold text-red-600 mt-1"
                    >
                      {err('email')}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Password */}
              <motion.div variants={fadeUp} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                    Password
                  </label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs font-semibold text-primary-600 hover:text-primary-500 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    {...formik.getFieldProps('password')}
                    className={`w-full rounded-xl border-2 px-4 py-3 pr-11 text-sm text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 focus:ring-4
                          ${
                            err('password')
                              ? 'border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-red-100 shake-input'
                              : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 focus:border-primary-500 focus:bg-white focus:ring-primary-50'
                          }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 transition-colors hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4.5 w-4.5" />
                    ) : (
                      <Eye className="h-4.5 w-4.5" />
                    )}
                  </button>
                </div>
                <AnimatePresence>
                  {err('password') && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                      className="text-xs font-semibold text-red-600 mt-1"
                    >
                      {err('password')}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Submit */}
              <motion.div variants={fadeUp} className="pt-1 btn-shine-container">
                <CustomButton
                  type="submit"
                  loading={isLoading}
                  loadingText="Signing in…"
                  startIcon={!isLoading ? <LogIn className="h-4 w-4" /> : undefined}
                  endIcon={!isLoading ? <ArrowRight className="h-4 w-4" /> : undefined}
                  fullWidth
                  className="w-full! btn-shine-effect relative overflow-hidden bg-primary-600 hover:bg-primary-700 text-white font-semibold tracking-wide rounded-xl py-3 shadow-xs hover:shadow-md transition-all duration-200"
                >
                  Sign in
                </CustomButton>
              </motion.div>
            </motion.form>
          </motion.div>
        </div>
      )}
      <ChangePasswordModal
        open={mustChange}
        requireCurrent
        onSuccess={() => {
          setMustChange(false);
          if (pendingRedirect) router.replace(pendingRedirect);
        }}
      />
      <AnimatePresence>
        {mfaState && (
          <MfaChallenge
            email={mfaState.email}
            code={mfaCode}
            onCodeChange={setMfaCode}
            onCancel={() => {
              setMfaState(null);
              setMfaCode('');
            }}
            onSubmit={async () => {
              if (mfaCode.length !== 6) {
                toast.error('Enter the 6-digit code from your authenticator app');
                return;
              }
              const res = await mutation('auth/mfa/login-verify', {
                method: 'POST',
                body: { mfaToken: mfaState.mfaToken, code: mfaCode },
                platformContext: true,
              });
              const data = res?.results?.data as ILoginResponse | undefined;
              if (!data?.accessToken || !data?.user) return;
              const activeRole = (data.user.role || data.user.roles?.[0]) as TSystemRole;
              if (activeRole !== 'super_admin') {
                toast.error('This portal is restricted to Devvelocity platform administrators.');
                return;
              }
              setAuth(
                data.user,
                data.accessToken,
                data.refreshToken,
                activeRole,
                data.role ?? null,
              );
              const redirect = '/';
              setMfaState(null);
              setMfaCode('');
              if (data.mustChangePassword) {
                setPendingRedirect(redirect);
                setMustChange(true);
                return;
              }
              toast.success(`Welcome back, ${data.user.name}!`);
              router.replace(redirect);
            }}
            loading={isLoading}
          />
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}

function MfaChallenge({
  email,
  code,
  onCodeChange,
  onCancel,
  onSubmit,
  loading,
}: {
  email: string;
  code: string;
  onCodeChange: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, i) => code[i] ?? '');

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const setDigit = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      const next = digits.slice();
      next[index] = '';
      onCodeChange(next.join(''));
      return;
    }
    // Allow pasting full code into a single box
    if (clean.length > 1) {
      const merged = (code.slice(0, index) + clean).replace(/\D/g, '').slice(0, 6);
      onCodeChange(merged);
      const focusIdx = Math.min(merged.length, 5);
      inputsRef.current[focusIdx]?.focus();
      return;
    }
    const next = digits.slice();
    next[index] = clean[0];
    onCodeChange(next.join(''));
    if (index < 5) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = digits.slice();
        next[index] = '';
        onCodeChange(next.join(''));
      } else if (index > 0) {
        inputsRef.current[index - 1]?.focus();
        const next = digits.slice();
        next[index - 1] = '';
        onCodeChange(next.join(''));
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputsRef.current[index + 1]?.focus();
    } else if (e.key === 'Enter' && code.length === 6) {
      onSubmit();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    onCodeChange(pasted);
    const focusIdx = Math.min(pasted.length, 5);
    inputsRef.current[focusIdx]?.focus();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mfa-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.22 }}
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white"
      >
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        <div className="px-7 pb-2 pt-7">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-(--color-primary)">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h3 id="mfa-title" className="mt-4 text-center text-xl font-bold text-slate-900">
            Two-factor authentication
          </h3>
          <p className="mt-1.5 text-center text-sm text-slate-500">
            Enter the 6-digit code from your authenticator app for{' '}
            <span className="font-semibold text-slate-700">{email}</span>
          </p>
        </div>

        <div className="px-7 pb-2 pt-5">
          <div className="flex justify-between gap-2" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputsRef.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                maxLength={6}
                value={d}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onFocus={(e) => e.target.select()}
                aria-label={`Digit ${i + 1}`}
                className={`h-14 w-12 rounded-xl border-2 bg-slate-50 text-center text-xl font-bold text-slate-900 outline-none transition-all duration-150 focus:ring-4
                  ${
                    d
                      ? 'border-(--color-primary) bg-white'
                      : 'border-slate-200 hover:border-slate-300 focus:border-(--color-primary) focus:bg-white focus:ring-primary-50'
                  }`}
              />
            ))}
          </div>

          <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-slate-50 p-3.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-(--color-primary)" />
            <p className="text-xs leading-relaxed text-slate-600">
              Open Google Authenticator, Authy, or your TOTP app and enter the rotating 6-digit
              code. Lost access? Use one of your saved backup codes.
            </p>
          </div>
        </div>

        <div className="flex gap-3 px-7 pb-7 pt-5">
          <CustomButton variant="secondary" onClick={onCancel} fullWidth disabled={loading}>
            Cancel
          </CustomButton>
          <CustomButton
            onClick={onSubmit}
            loading={loading}
            loadingText="Verifying…"
            disabled={code.length !== 6}
            fullWidth
          >
            Verify &amp; sign in
          </CustomButton>
        </div>
      </motion.div>
    </div>
  );
}

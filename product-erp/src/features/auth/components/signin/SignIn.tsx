/**
 * @file SignIn.tsx
 * @description Animated enterprise sign-in page for a dynamically branded tenant ERP.
 *  - Split layout: animated brand panel (left) + form panel (right)
 *  - Staggered Framer Motion entrance animations
 *  - Floating-style inputs with focus micro-interactions
 *  - Show/hide password, optional role selector
 *  - Redirects to /{role}/dashboard on success
 * @module features/auth/components/signin
 */

'use client';

import { signinSchema } from '@/features/auth/validations/auth.schema';
import ChangePasswordModal from '@/shared/components/ChangePasswordModal';
import CustomButton from '@/shared/core/CustomButton';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useAuthStore } from '@/shared/store/authStore';
import { ILoginResponse, IMfaLoginResponse, TSystemRole } from '@/shared/types';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import { useFormik } from 'formik';
import {
  AlertCircle,
  Building2,
  Eye,
  EyeOff,
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
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0 },
};

export default function SignIn() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearSessionExpired = useAuthStore((s) => s.clearSessionExpired);
  const { mutation, isLoading } = useMutation();
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
  const [authError, setAuthError] = useState<string | null>(null);
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
    initialValues: { identifier: '', password: '', role: '' as TSystemRole | '' },
    validationSchema: signinSchema,
    onSubmit: async (values) => {
      setAuthError(null);
      try {
        const payload: { identifier: string; password: string; role?: TSystemRole } = {
          identifier: values.identifier,
          password: values.password,
        };
        if (values.role) payload.role = values.role as TSystemRole;

        const res = await mutation('auth/login', {
          method: 'POST',
          body: payload,
          isAlert: false,
          silentError: true,
          returnError: true,
        });
        if (res?.status === 401) {
          setAuthError('The login ID or password does not match. Check both fields and try again.');
          return;
        }
        if (res?.status === 403) {
          setAuthError(
            res.results?.message ??
              res.results?.error?.message ??
              'This account cannot sign in. Contact your administrator.',
          );
          return;
        }
        if (res?.status === 429) {
          setAuthError('Too many sign-in attempts. Wait a moment before trying again.');
          return;
        }
        if (!res) {
          setAuthError('Unable to reach the sign-in service. Check your connection and try again.');
          return;
        }
        if (res?.status === 200) {
          const data = res.results?.data as
            | (ILoginResponse & Partial<IMfaLoginResponse>)
            | undefined;
          // MFA challenge — password is correct, ask for TOTP code.
          if (data && 'mfaRequired' in data && data.mfaRequired && data.mfaToken) {
            setMfaState({ mfaToken: data.mfaToken, email: data.email || values.identifier });
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

          setAuth(data.user, data.accessToken, data.refreshToken, activeRole, data.role ?? null);
          const pendingApplicant =
            !!data.user.applicationStatus && data.user.applicationStatus !== 'enrolled';
          const redirect = pendingApplicant
            ? '/admission-portal'
            : data.onboardingRequired && ['super_admin', 'admin'].includes(activeRole)
              ? `/${activeRole}/onboarding`
              : `/${activeRole}/dashboard`;
          if (data.mustChangePassword) {
            setPendingRedirect(redirect);
            setMustChange(true);
            toast.info('Please set a new password to continue.');
            return;
          }

          router.replace(redirect);
          return;
        }
        setAuthError('Sign-in is temporarily unavailable. Please try again.');
      } catch (error) {
        setAuthError(
          error instanceof Error
            ? error.message
            : 'An unexpected sign-in error occurred. Please try again.',
        );
      }
    },
  });

  const err = (f: keyof typeof formik.values) =>
    formik.touched[f] && formik.errors[f] ? (formik.errors[f] as string) : '';
  const startSso = async (provider: 'google' | 'microsoft') => {
    const callbackPath = window.location.pathname.replace(
      /\/auth\/signin\/?$/,
      '/auth/sso/callback',
    );
    const res = await mutation('sso/start', {
      method: 'POST',
      body: { provider, returnUrl: `${window.location.origin}${callbackPath}` },
    });
    const authorizationUrl = (res?.results?.data as { authorizationUrl?: string } | undefined)
      ?.authorizationUrl;
    if (!authorizationUrl) return;
    window.location.assign(authorizationUrl);
  };

  return (
    <AuthLayout>
      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.12 }}
        className="mb-7"
      >
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-(--color-primary)">
          Welcome back
        </p>
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
          Sign in to continue
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Use your institution account to access the ERP workspace.
        </p>
      </motion.div>

      {/* Form card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="rounded-xl bg-slate-50 p-6 sm:p-7"
      >
        <motion.form
          variants={stagger}
          initial="hidden"
          animate="show"
          onSubmit={formik.handleSubmit}
          noValidate
          className="space-y-5"
        >
          {/* Institutional login identity */}
          <motion.div variants={fadeUp} className="space-y-1.5">
            <label htmlFor="identifier" className="block text-sm font-semibold text-slate-700">
              Login ID
            </label>
            <input
              id="identifier"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              placeholder="Student ID, registration number, faculty ID or staff email"
              {...formik.getFieldProps('identifier')}
              onChange={(event) => {
                formik.handleChange(event);
                setAuthError(null);
              }}
              aria-invalid={Boolean(err('identifier') || authError)}
              aria-describedby={err('identifier') ? 'identifier-error' : undefined}
              className={`w-full rounded-xl border-2 px-4 py-3 text-sm text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-600 focus:ring-4
                    ${
                      err('identifier')
                        ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300 focus:border-(--color-primary) focus:bg-white focus:ring-primary-50'
                    }`}
            />
            <AnimatePresence>
              {err('identifier') && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="text-xs font-medium text-red-600"
                  id="identifier-error"
                >
                  {err('identifier')}
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
                className="text-xs font-semibold text-(--color-primary) transition-opacity hover:opacity-75"
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
                onChange={(event) => {
                  formik.handleChange(event);
                  setAuthError(null);
                }}
                aria-invalid={Boolean(err('password') || authError)}
                aria-describedby={err('password') ? 'password-error' : undefined}
                className={`w-full rounded-xl border-2 px-4 py-3 pr-11 text-sm text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-600 focus:ring-4
                      ${
                        err('password')
                          ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100'
                          : 'border-slate-200 bg-slate-50 hover:border-slate-300 focus:border-(--color-primary) focus:bg-white focus:ring-primary-50'
                      }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-600 transition-colors hover:text-slate-700"
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
                  className="text-xs font-medium text-red-600"
                  id="password-error"
                >
                  {err('password')}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          <AnimatePresence>
            {authError && (
              <motion.div
                role="alert"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-start gap-3 rounded-xl bg-red-50 px-4 py-3 text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Sign-in unsuccessful</p>
                  <p className="mt-0.5 text-xs leading-5 text-red-600">{authError}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <motion.div variants={fadeUp} className="pt-1 w-full flex items-center justify-end">
            <CustomButton
              type="submit"
              loading={isLoading}
              loadingText="Signing in…"
              startIcon={!isLoading ? <LogIn className="h-4 w-4" /> : undefined}
              fullWidth
              className="w-full!"
            >
              Sign in
            </CustomButton>
          </motion.div>
        </motion.form>
      </motion.div>
      {ssoProviders.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-xl bg-slate-50 p-4"
        >
          <div className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <span className="h-px flex-1 bg-slate-200" /> Single sign-on{' '}
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {ssoProviders.map((provider) => (
              <button
                key={provider}
                type="button"
                onClick={() => startSso(provider)}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold capitalize text-slate-700 transition-colors hover:bg-blue-50 hover:text-primary disabled:opacity-50"
              >
                {provider === 'google' ? (
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-xs font-black text-blue-600">
                    G
                  </span>
                ) : (
                  <Building2 className="h-4 w-4 text-blue-600" />
                )}
                Continue with {provider}
              </button>
            ))}
          </div>
        </motion.div>
      )}
      {isSsoLoading && (
        <p className="mt-4 text-center text-xs text-slate-600">
          Checking institution sign-in options…
        </p>
      )}
      {ssoError && (
        <div className="mt-4 rounded-xl bg-amber-50 p-3 text-center text-xs text-amber-800">
          Institution sign-in options are temporarily unavailable. Password sign-in still works.
          <button
            type="button"
            onClick={() => void retrySso()}
            className="ml-2 inline-flex items-center gap-1 font-bold text-amber-900"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
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
              });
              const data = res?.results?.data as ILoginResponse | undefined;
              if (!data?.accessToken || !data?.user) return;
              const activeRole = (data.user.role || data.user.roles?.[0]) as TSystemRole;
              setAuth(
                data.user,
                data.accessToken,
                data.refreshToken,
                activeRole,
                data.role ?? null,
              );
              const pendingApplicant =
                !!data.user.applicationStatus && data.user.applicationStatus !== 'enrolled';
              const redirect = pendingApplicant
                ? '/admission-portal'
                : data.onboardingRequired && ['super_admin', 'admin'].includes(activeRole)
                  ? `/${activeRole}/onboarding`
                  : `/${activeRole}/dashboard`;
              setMfaState(null);
              setMfaCode('');
              if (data.mustChangePassword) {
                setPendingRedirect(redirect);
                setMustChange(true);
                return;
              }

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 px-4 backdrop-blur-sm"
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
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-700"
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

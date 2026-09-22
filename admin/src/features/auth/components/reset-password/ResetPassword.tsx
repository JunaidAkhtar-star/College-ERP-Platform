/**
 * @file ResetPassword.tsx
 * @description Reset-password page — split layout matching SignIn / ForgotPassword.
 *  - Left: animated brand panel with college name + rotating quotes
 *  - Right: OTP + new password + confirm form with strength bar
 *  - Success state with countdown auto-redirect
 * @module features/auth/components/reset-password
 */

'use client';

import { resetPasswordSchema } from '@/features/auth/validations/auth.schema';
import CustomButton from '@/shared/core/CustomButton';
import useMutation from '@/shared/hooks/useMutation';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import { useFormik } from 'formik';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'nextjs-toploader/app';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import AuthLayout from '../../layouts/AuthLayout';

// ── Password-strength helper ──────────────────────────────────────────────────
function getStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const map: Record<number, { label: string; color: string }> = {
    0: { label: 'Too short', color: 'bg-slate-200' },
    1: { label: 'Weak', color: 'bg-red-400' },
    2: { label: 'Fair', color: 'bg-amber-400' },
    3: { label: 'Good', color: 'bg-secondary-400' },
    4: { label: 'Strong', color: 'bg-secondary-500' },
  };
  return { score, ...map[score] };
}

// ── Animation variants ────────────────────────────────────────────────────────
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.12 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface IResetPasswordProps {
  email?: string;
}

export default function ResetPassword({ email = '' }: IResetPasswordProps) {
  const router = useRouter();
  const { mutation, isLoading } = useMutation();
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);
  useEffect(() => {
    if (!success) return;
    const timer = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          clearInterval(timer);
          router.replace('/auth/signin');
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [success, router]);

  const formik = useFormik({
    initialValues: { email, otp: '', newPassword: '', confirmPassword: '' },
    validationSchema: resetPasswordSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      const res = await mutation('auth/reset-password', {
        method: 'POST',
        body: { email: values.email, otp: values.otp, newPassword: values.newPassword },
      });
      if (!res) return;
      setSuccess(true);
      toast.success('Password reset successfully!');
    },
  });

  const err = (f: keyof typeof formik.values) =>
    formik.touched[f] && formik.errors[f] ? (formik.errors[f] as string) : '';

  const strength = getStrength(formik.values.newPassword);

  return (
    <AuthLayout>
      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.12 }}
        className="mb-8"
      >
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-(--color-primary)">
          Password Reset
        </p>
        <h2 className="text-3xl font-extrabold text-slate-900">Set a new password</h2>
        <p className="mt-1.5 text-sm text-slate-500">
          Enter the OTP sent to{' '}
          {email ? <span className="font-semibold text-slate-700">{email}</span> : 'your email'}
        </p>
      </motion.div>

      {/* Form card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="rounded-2xl bg-white p-8"
      >
        <AnimatePresence mode="wait">
          {!success ? (
            <motion.div
              key="form"
              variants={stagger}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -16, transition: { duration: 0.2 } }}
              className="space-y-5"
            >
              {/* Animated key icon */}
              <motion.div variants={fadeUp} className="flex justify-center">
                <div className="relative flex h-16 w-16 items-center justify-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary-200/50 [animation-duration:1.8s]" />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-primary-500 to-primary-600">
                    <KeyRound className="h-7 w-7 text-white" />
                  </div>
                </div>
              </motion.div>

              {/* Step progress pills */}
              <motion.div variants={fadeUp} className="flex items-center gap-1.5">
                {['OTP', 'New Password', 'Confirm'].map((step, i) => {
                  const filled =
                    i === 0
                      ? formik.values.otp.length === 6
                      : i === 1
                        ? formik.values.newPassword.length >= 8
                        : !!formik.values.confirmPassword &&
                          formik.values.confirmPassword === formik.values.newPassword;
                  return (
                    <React.Fragment key={step}>
                      <div
                        className={`flex h-6 flex-1 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-300
                            ${filled ? 'bg-(--color-primary) text-white' : 'bg-slate-100 text-slate-400'}`}
                      >
                        {step}
                      </div>
                      {i < 2 && (
                        <div
                          className={`h-0.5 w-4 shrink-0 rounded-full transition-all duration-300 ${filled ? 'bg-(--color-primary)' : 'bg-slate-200'}`}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </motion.div>

              <form onSubmit={formik.handleSubmit} noValidate className="space-y-5">
                {/* Email (only if not pre-filled) */}
                {!email && (
                  <motion.div variants={fadeUp} className="space-y-1.5">
                    <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@institution.edu"
                      {...formik.getFieldProps('email')}
                      className={`w-full rounded-xl border-2 px-4 py-3 text-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:ring-4
                            ${err('email') ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 bg-slate-50 hover:border-slate-300 focus:border-(--color-primary) focus:bg-white focus:ring-primary-50'}`}
                    />
                    <AnimatePresence>
                      {err('email') && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.18 }}
                          className="text-xs font-medium text-red-600"
                        >
                          {err('email')}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* OTP */}
                <motion.div variants={fadeUp} className="space-y-1.5">
                  <label htmlFor="otp" className="block text-sm font-semibold text-slate-700">
                    One-Time Password (OTP)
                  </label>
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    placeholder="6-digit code"
                    {...formik.getFieldProps('otp')}
                    className={`w-full rounded-xl border-2 px-4 py-3 text-center text-xl font-bold tracking-[0.5em] outline-none transition-all duration-200
                          placeholder:text-base placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-300 focus:ring-4
                          ${err('otp') ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 bg-slate-50 hover:border-slate-300 focus:border-(--color-primary) focus:bg-white focus:ring-primary-50'}`}
                  />
                  <AnimatePresence>
                    {err('otp') && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18 }}
                        className="text-xs font-medium text-red-600"
                      >
                        {err('otp')}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* New Password */}
                <motion.div variants={fadeUp} className="space-y-1.5">
                  <label
                    htmlFor="newPassword"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    New password
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <Lock className="h-4 w-4" />
                    </span>
                    <input
                      id="newPassword"
                      type={showNew ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      {...formik.getFieldProps('newPassword')}
                      className={`w-full rounded-xl border-2 py-3 pl-10 pr-11 text-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:ring-4
                            ${err('newPassword') ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 bg-slate-50 hover:border-slate-300 focus:border-(--color-primary) focus:bg-white focus:ring-primary-50'}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 transition-colors hover:text-slate-700"
                      aria-label={showNew ? 'Hide' : 'Show'}
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {formik.values.newPassword.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-1"
                    >
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength.score ? strength.color : 'bg-slate-100'}`}
                          />
                        ))}
                      </div>
                      <p
                        className={`text-xs font-medium ${strength.score >= 3 ? 'text-secondary-600' : strength.score === 2 ? 'text-amber-600' : 'text-red-500'}`}
                      >
                        {strength.label}
                      </p>
                    </motion.div>
                  )}
                  <AnimatePresence>
                    {err('newPassword') && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18 }}
                        className="text-xs font-medium text-red-600"
                      >
                        {err('newPassword')}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Confirm Password */}
                <motion.div variants={fadeUp} className="space-y-1.5">
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-semibold text-slate-700"
                  >
                    Confirm password
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <ShieldCheck className="h-4 w-4" />
                    </span>
                    <input
                      id="confirmPassword"
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Repeat your password"
                      {...formik.getFieldProps('confirmPassword')}
                      className={`w-full rounded-xl border-2 py-3 pl-10 pr-11 text-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:ring-4
                            ${
                              err('confirmPassword')
                                ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100'
                                : formik.values.confirmPassword &&
                                    formik.values.confirmPassword === formik.values.newPassword
                                  ? 'border-secondary-300 bg-secondary-50 focus:border-secondary-400 focus:ring-secondary-100'
                                  : 'border-slate-200 bg-slate-50 hover:border-slate-300 focus:border-(--color-primary) focus:bg-white focus:ring-primary-50'
                            }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 transition-colors hover:text-slate-700"
                      aria-label={showConfirm ? 'Hide' : 'Show'}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <AnimatePresence>
                    {err('confirmPassword') && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18 }}
                        className="text-xs font-medium text-red-600"
                      >
                        {err('confirmPassword')}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Submit */}
                <motion.div variants={fadeUp} className="pt-1">
                  <CustomButton
                    type="submit"
                    loading={isLoading}
                    loadingText="Resetting password…"
                    endIcon={!isLoading ? <ArrowRight className="h-4 w-4" /> : undefined}
                    fullWidth
                  >
                    Reset Password
                  </CustomButton>
                </motion.div>
              </form>

              {/* Back */}
              <motion.div variants={fadeUp} className="flex justify-center">
                <Link
                  href="/auth/forgot-password"
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-400 transition-colors hover:text-(--color-primary)"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Request a new OTP
                </Link>
              </motion.div>
            </motion.div>
          ) : (
            /* ── Success state ──────────────────────────────────────────── */
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.94, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center gap-6 py-6 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 250, damping: 16 }}
                className="relative flex h-24 w-24 items-center justify-center"
              >
                <span className="absolute inset-0 animate-ping rounded-full bg-secondary-200/60 [animation-duration:2s]" />
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-linear-to-br from-secondary-400 to-secondary-600">
                  <CheckCircle2 className="h-12 w-12 text-white" />
                </div>
              </motion.div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">Password reset!</h2>
                <p className="text-sm text-slate-500">
                  Your password has been updated successfully.
                </p>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 ring-1 ring-primary-200">
                  <span className="text-lg font-bold text-(--color-primary)">{countdown}</span>
                </div>
                <p className="text-xs text-slate-400">Redirecting to sign in…</p>
              </div>
              <CustomButton
                onClick={() => router.replace('/auth/signin')}
                startIcon={<ArrowLeft className="h-4 w-4" />}
                fullWidth
              >
                Go to sign in now
              </CustomButton>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AuthLayout>
  );
}

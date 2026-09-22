/**
 * @file ForgotPassword.tsx
 * @description Forgot-password page — split layout matching SignIn design.
 *  - Left: animated brand panel with college name + rotating quotes
 *  - Right: email form (idle) → success view (sent)
 *  - Redirects to /auth/reset-password?email=... on success
 * @module features/auth/components/forgot-password
 */

'use client';

import { forgotPasswordSchema } from '@/features/auth/validations/auth.schema';
import CustomButton from '@/shared/core/CustomButton';
import useMutation from '@/shared/hooks/useMutation';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import { useFormik } from 'formik';
import { ArrowLeft, ArrowRight, CheckCircle2, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'nextjs-toploader/app';
import { useState } from 'react';
import { toast } from 'react-toastify';
import AuthLayout from '../../layouts/AuthLayout';

// ── Animation variants ────────────────────────────────────────────────────────
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

export default function ForgotPassword() {
  const router = useRouter();
  const { mutation, isLoading } = useMutation();
  const [sent, setSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const formik = useFormik({
    initialValues: { email: '' },
    validationSchema: forgotPasswordSchema,
    onSubmit: async (values) => {
      const res = await mutation('auth/forgot-password', {
        method: 'POST',
        body: { email: values.email },
      });
      if (!res) return;
      setSubmittedEmail(values.email);
      setSent(true);
      toast.success('OTP sent! Check your email.');
    },
  });

  const handleProceed = () => {
    router.push(`/auth/reset-password?email=${encodeURIComponent(submittedEmail)}`);
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
          Account Recovery
        </p>
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
          Forgot your password?
        </h2>
        <p className="mt-1.5 text-sm text-slate-500">
          Enter your registered email to receive a one-time code
        </p>
      </motion.div>

      {/* Form card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="rounded-xl bg-slate-50 p-6 sm:p-7"
      >
        <AnimatePresence mode="wait">
          {!sent ? (
            <motion.div
              key="form"
              variants={stagger}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -12, transition: { duration: 0.2 } }}
              className="space-y-5"
            >
              {/* Animated mail icon */}
              <motion.div variants={fadeUp} className="flex justify-center">
                <div className="relative flex h-16 w-16 items-center justify-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary-200/50 [animation-duration:1.8s]" />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-primary-500 to-primary-600">
                    <Mail className="h-7 w-7 text-white" />
                  </div>
                </div>
              </motion.div>

              {/* Email input */}
              <motion.div variants={fadeUp} className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
                  Email address
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@institution.edu"
                    {...formik.getFieldProps('email')}
                    className={`w-full rounded-xl border-2 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-600 focus:ring-4
                          ${
                            formik.touched.email && formik.errors.email
                              ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100'
                              : 'border-slate-200 bg-slate-50 hover:border-slate-300 focus:border-(--color-primary) focus:bg-white focus:ring-primary-50'
                          }`}
                  />
                </div>
                <AnimatePresence>
                  {formik.touched.email && formik.errors.email && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                      className="text-xs font-medium text-red-600"
                    >
                      {formik.errors.email}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Submit */}
              <motion.div variants={fadeUp}>
                <CustomButton
                  type="submit"
                  loading={isLoading}
                  loadingText="Sending OTP…"
                  endIcon={!isLoading ? <ArrowRight className="h-4 w-4" /> : undefined}
                  fullWidth
                  onClick={() => formik.handleSubmit()}
                >
                  Send OTP
                </CustomButton>
              </motion.div>

              {/* Back */}
              <motion.div variants={fadeUp} className="flex justify-center pt-1">
                <Link
                  href="/auth/signin"
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-(--color-primary)"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to sign in
                </Link>
              </motion.div>
            </motion.div>
          ) : (
            /* ── Success view ───────────────────────────────────────────── */
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center gap-6 py-4 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 260, damping: 18 }}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary-50 ring-1 ring-secondary-200"
              >
                <CheckCircle2 className="h-10 w-10 text-secondary-500" />
              </motion.div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-slate-900">Check your inbox</h3>
                <p className="text-sm text-slate-500">We sent a 6-digit OTP to</p>
                <p className="text-sm font-semibold text-slate-800">{submittedEmail}</p>
                <p className="text-xs text-slate-600">
                  Didn&apos;t receive it? Check spam or try again.
                </p>
              </div>
              <div className="flex w-full flex-col gap-3">
                <CustomButton
                  onClick={handleProceed}
                  endIcon={<ArrowRight className="h-4 w-4" />}
                  fullWidth
                >
                  Enter OTP &amp; Reset Password
                </CustomButton>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="text-sm font-medium text-slate-600 transition-colors hover:text-(--color-primary)"
                >
                  Use a different email
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AuthLayout>
  );
}

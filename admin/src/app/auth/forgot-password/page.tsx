/**
 * @file page.tsx
 * @description Forgot password route — /auth/forgot-password
 * @module app/auth/forgot-password
 */
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Forgot Password',
  description: 'Request a password reset OTP for your institution account.',
};

const ForgotPassword = dynamic(
  () => import('@/features/auth/components/forgot-password/ForgotPassword'),
  {
    loading: () => (
      <div className="flex h-dvh w-full items-center justify-center bg-slate-50">
        <span className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-(--color-primary)" />
      </div>
    ),
  },
);

export default function ForgotPasswordPage() {
  return <ForgotPassword />;
}

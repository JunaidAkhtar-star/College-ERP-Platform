/**
 * @file page.tsx
 * @description Forgot password route — /auth/forgot-password
 * @module app/auth/forgot-password
 */
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { AuthLayoutSkeleton } from '@/features/auth/layouts/AuthLayout';

export const metadata: Metadata = {
  title: 'Forgot Password',
  description: 'Request a password reset OTP for your institution account.',
};

const ForgotPassword = dynamic(
  () => import('@/features/auth/components/forgot-password/ForgotPassword'),
  {
    loading: () => <AuthLayoutSkeleton />,
  },
);

export default function ForgotPasswordPage() {
  return <ForgotPassword />;
}

/**
 * @file page.tsx
 * @description Reset password route — /auth/reset-password
 *  Reads the `email` query param set by the forgot-password flow.
 * @module app/auth/reset-password
 */
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { AuthLayoutSkeleton } from '@/features/auth/layouts/AuthLayout';

export const metadata: Metadata = {
  title: 'Reset Password',
  description: 'Reset your institution account password using the OTP sent to your email.',
};

const ResetPassword = dynamic(
  () => import('@/features/auth/components/reset-password/ResetPassword'),
  {
    loading: () => <AuthLayoutSkeleton />,
  },
);

interface IResetPasswordPageProps {
  searchParams: Promise<{ email?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: IResetPasswordPageProps) {
  const { email } = await searchParams;
  return <ResetPassword email={email ?? ''} />;
}

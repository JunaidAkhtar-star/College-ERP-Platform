/**
 * @file page.tsx
 * @description Reset password route — /auth/reset-password
 *  Reads the `email` query param set by the forgot-password flow.
 * @module app/auth/reset-password
 */
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Reset Password',
  description: 'Reset your institution account password using the OTP sent to your email.',
};

const ResetPassword = dynamic(
  () => import('@/features/auth/components/reset-password/ResetPassword'),
  {
    loading: () => (
      <div className="flex h-dvh w-full items-center justify-center bg-slate-50">
        <span className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-(--color-primary)" />
      </div>
    ),
  },
);

interface IResetPasswordPageProps {
  searchParams: Promise<{ email?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: IResetPasswordPageProps) {
  const { email } = await searchParams;
  return <ResetPassword email={email ?? ''} />;
}

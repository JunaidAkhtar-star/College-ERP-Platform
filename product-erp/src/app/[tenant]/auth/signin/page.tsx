/**
 * @file page.tsx
 * @description Sign-in route — /auth/signin
 * @module app/auth/signin
 */
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { AuthLayoutSkeleton } from '@/features/auth/layouts/AuthLayout';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your institution portal to access your dashboard.',
};

// Client-side only — avoids SSR for auth state reads
const SignIn = dynamic(() => import('@/features/auth/components/signin/SignIn'), {
  loading: () => <AuthLayoutSkeleton />,
});

export default function SignInPage() {
  return <SignIn />;
}

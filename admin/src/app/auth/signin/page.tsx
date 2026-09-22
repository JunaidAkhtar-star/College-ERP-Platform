/**
 * @file page.tsx
 * @description Sign-in route — /auth/signin
 * @module app/auth/signin
 */
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your institution portal to access your dashboard.',
};

// Client-side only — avoids SSR for auth state reads
const SignIn = dynamic(() => import('@/features/auth/components/signin/SignIn'), {
  loading: () => (
    <div className="flex h-dvh w-full items-center justify-center bg-slate-50">
      <span className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-(--color-primary)" />
    </div>
  ),
});

export default function SignInPage() {
  return <SignIn />;
}

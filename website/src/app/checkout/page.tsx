import type { Metadata } from 'next';
import CheckoutPage from '@/features/landing/components/CheckoutPage';
import { Suspense } from 'react';
import { createSeoMetadata } from '@/shared/utils/seo';

export const metadata: Metadata = createSeoMetadata({
  title: 'Secure Subscription Checkout',
  description: 'Secure Devvelocity subscription registration and payment confirmation.',
  path: '/checkout',
  noIndex: true,
});

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-[#f4f8fb] text-sm font-semibold text-[#124c75]">
          Loading secure checkout…
        </main>
      }
    >
      <CheckoutPage />
    </Suspense>
  );
}

/**
 * @file layout.tsx
 * @description Root HTML layout for the multi-tenant ERP application. Registers global
 *              fonts, metadata, and the AppProvider wrapper.
 * @module app
 */

import type { Metadata } from 'next';
import NextTopLoader from 'nextjs-toploader';
import AppProvider from '@/shared/provider/AppProvider';
import './globals.css';

import { headers } from 'next/headers';

export async function generateMetadata(): Promise<Metadata> {
  const reqHeaders = await headers();
  const tenantId = reqHeaders.get('x-tenant-id');

  if (!tenantId) {
    return {
      title: 'Devvelocity | Enterprise Education ERP SaaS',
      description:
        'The ultimate next-generation cloud multi-tenant ERP for colleges and universities.',
    };
  }

  return {
    title: {
      default: 'Institution ERP Portal',
      template: '%s | Institution ERP',
    },
    description: 'Secure enterprise resource planning portal for your institution.',
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-dvh flex flex-col bg-slate-50 font-sans">
        <NextTopLoader color="#0178D7" showSpinner={false} height={3} />
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}

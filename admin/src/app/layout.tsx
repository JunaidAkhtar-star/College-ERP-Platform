import type { Metadata } from 'next';
import NextTopLoader from 'nextjs-toploader';
import AppProvider from '@/shared/provider/AppProvider';
import './globals.css';

const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.devvelocity.in';

export const metadata: Metadata = {
  metadataBase: new URL(adminUrl),
  title: {
    default: 'Devvelocity Admin',
    template: '%s | Devvelocity Admin',
  },
  description: 'Secure SaaS operations workspace for authorized Devvelocity administrators.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="flex min-h-dvh flex-col bg-slate-50 font-sans">
        <NextTopLoader color="#0178D7" showSpinner={false} height={3} />
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}

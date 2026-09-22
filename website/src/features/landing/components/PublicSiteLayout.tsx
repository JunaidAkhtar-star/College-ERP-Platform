'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Mail, MapPin, Menu, Phone, X } from 'lucide-react';
import useSwr from '@/shared/hooks/useSwr';
import { IPublicSiteConfig } from '@/features/landing/types/public.types';
import { AnimatePresence, motion, MotionConfig } from '@/shared/utils/motion';

interface IPublicCatalogResponse {
  data?: { site: IPublicSiteConfig | null };
}

/** Shared navigation and footer used by every main-domain public page. */
export default function PublicSiteLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const { data } = useSwr<IPublicCatalogResponse>('super-admin/public-catalog');
  const site = data?.data?.site;
  const company = site?.companyName || 'Devvelocity';
  const isErpProduct = pathname.startsWith('/products/college-erp');
  const links = isErpProduct
    ? [
        ['Overview', '/products/college-erp'],
        ['Modules', '/modules'],
        ['Plans', '/products/college-erp#plans'],
        ['Company', '/'],
      ]
    : [
        ['Products', '/products'],
        ['Services', '/services'],
        ['Company', '/company'],
        ['Contact', '/contact'],
      ];

  const isActiveLink = (href: string) => {
    if (href.includes('#')) return false;
    const route = href.split('#')[0] || '/';
    return route === '/'
      ? pathname === '/'
      : pathname === route || pathname.startsWith(`${route}/`);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-dvh bg-[#fffdf9] text-[#172033]">
        <header className="sticky inset-x-0 top-0 z-50 border-b border-[#e2ebf2] bg-white/95 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-3 md:px-10 lg:px-16">
            <Link href="/" aria-label={`${company} home`}>
              <Image
                src="/devvelocitylogo.webp"
                alt={`${company} software products and services home`}
                width={210}
                height={58}
                priority
                className="h-10 w-auto object-contain"
              />
            </Link>
            <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation">
              {links.map(([label, href]) => {
                const isActive = isActiveLink(href);
                return (
                  <Link
                    key={label}
                    href={href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`relative py-2 text-sm font-semibold transition after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:origin-center after:rounded-full after:bg-primary after:transition-transform after:duration-300 ${
                      isActive
                        ? 'text-primary after:scale-x-100'
                        : 'text-[#5b6475] after:scale-x-0 hover:text-primary hover:after:scale-x-100'
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex items-center gap-2">
              <Link
                href={process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.devvelocity.in'}
                className="hidden px-3 py-2 text-sm font-semibold text-[#354052] sm:block"
              >
                Sign in
              </Link>
              <Link
                href="/demo"
                className="hidden items-center gap-2 rounded-full bg-[#0178d7] px-5 py-3 text-sm font-semibold text-white sm:flex"
              >
                Book a demo <ArrowRight size={15} />
              </Link>
              <button
                type="button"
                aria-label="Toggle navigation"
                aria-expanded={menuOpen}
                className="rounded-full bg-[#edf5fb] p-3 md:hidden"
                onClick={() => setMenuOpen((open) => !open)}
              >
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
          {menuOpen && (
            <nav className="mx-4 mb-4 rounded-3xl border border-[#e2ebf2] bg-white p-4 shadow-xl md:hidden">
              {links.map(([label, href]) => {
                const isActive = isActiveLink(href);
                return (
                  <Link
                    key={label}
                    href={href}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setMenuOpen(false)}
                    className={`block rounded-2xl px-4 py-3 font-semibold transition ${
                      isActive ? 'bg-primary-50 text-primary' : 'text-[#354052] hover:bg-[#f3f7fa]'
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
              <Link
                href="/demo"
                onClick={() => setMenuOpen(false)}
                className="mt-2 flex items-center justify-center gap-2 rounded-full bg-[#0178d7] px-5 py-3 font-semibold text-white"
              >
                Book a demo <ArrowRight size={16} />
              </Link>
            </nav>
          )}
        </header>

        <AnimatePresence mode="wait">
          <motion.main
            key={pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.32, ease: 'easeOut' }}
          >
            {children}
          </motion.main>
        </AnimatePresence>

        <footer className="relative overflow-hidden border-t border-[#e2ebf2] bg-white px-5 py-16 md:px-10 md:py-20 lg:px-16 lg:py-24">
          <div
            className="pointer-events-none absolute bottom-0 left-1/2 z-0 -translate-x-1/2 select-none whitespace-nowrap text-[clamp(4.5rem,14.5vw,17.5rem)] font-bold leading-none tracking-[-0.03em] text-[#ebf3fc] sm:-mb-3"
            aria-hidden="true"
          >
            Devvelocity
          </div>
          <div className="relative z-10 mx-auto grid max-w-[1440px] gap-14 lg:grid-cols-[1.2fr_.8fr]">
            <div>
              <Image
                src="/devvelocitylogo.webp"
                alt={`${company} software products and services`}
                width={240}
                height={66}
                className="h-12 w-auto object-contain"
              />
              <p className="mt-7 max-w-2xl text-base leading-7 text-[#667085] sm:text-lg sm:leading-8">
                Devvelocity creates modern software products and digital solutions that help
                organisations simplify work, connect people and grow with confidence.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                {site?.salesEmail && (
                  <a
                    href={`mailto:${site.salesEmail}`}
                    className="inline-flex items-center gap-2 rounded-full border border-[#e2ebf2] bg-[#f8fbfe] px-4 py-2.5 text-xs font-semibold text-[#445166] shadow-sm transition hover:border-[#0178d7]/30 hover:bg-[#edf5fc] hover:text-[#0178d7]"
                  >
                    <Mail size={15} className="text-[#0178d7]" />
                    {site.salesEmail}
                  </a>
                )}
                {site?.phone && (
                  <a
                    href={`tel:${site.phone}`}
                    className="inline-flex items-center gap-2 rounded-full border border-[#e2ebf2] bg-[#f8fbfe] px-4 py-2.5 text-xs font-semibold text-[#445166] shadow-sm transition hover:border-[#0178d7]/30 hover:bg-[#edf5fc] hover:text-[#0178d7]"
                  >
                    <Phone size={15} className="text-[#0178d7]" />
                    {site.phone}
                  </a>
                )}
              </div>
              {site?.address && (
                <p className="mt-5 flex max-w-xl items-start gap-2 text-sm leading-6 text-[#667085]">
                  <MapPin size={16} className="mt-1 shrink-0 text-[#0178d7]" />
                  {site.address}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              {[
                [
                  'Products',
                  [
                    ['All products', '/products'],
                    ['College ERP', '/products/college-erp'],
                    ['ERP modules', '/modules'],
                  ],
                ],
                [
                  'Company',
                  [
                    ['About us', '/company'],
                    ['Services', '/services'],
                    ['Contact', '/contact'],
                  ],
                ],
                [
                  'Legal',
                  [
                    ['Privacy policy', '/privacy'],
                    ['Terms & conditions', '/terms'],
                    [
                      'Sign in',
                      process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.devvelocity.in',
                    ],
                  ],
                ],
              ].map(([heading, items]) => (
                <div key={heading as string}>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0178d7]">
                    {heading as string}
                  </p>
                  <div className="mt-6 space-y-3 text-sm font-medium text-[#667085]">
                    {(items as string[][]).map(([label, href]) => (
                      <Link
                        key={label}
                        className="block transition hover:text-[#0178d7]"
                        href={href}
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative z-10 mx-auto mt-16 flex max-w-[1440px] flex-col gap-4 border-t border-[#dfe8ef] pt-6 text-xs text-[#748095] sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()}{' '}
              <span className="font-semibold text-[#354052]">{company}</span>. All rights reserved.
            </p>
            <p>Modern products, dependable engineering and responsible delivery.</p>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}

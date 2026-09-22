'use client';

import Image from 'next/image';
import React from 'react';
import { motion } from '@/shared/utils/motion';
import {
  ArrowUpRight,
  Building2,
  Check,
  Clock3,
  Globe,
  LifeBuoy,
  LockKeyhole,
  RefreshCw,
  SearchX,
  ShieldCheck,
} from 'lucide-react';
import useSwr from '@/shared/hooks/useSwr';
import { useParams } from 'next/navigation';

interface IInstitutionBranding {
  name?: string;
  shortCode?: string;
  tagline?: string;
  address?: string;
  logoUrl?: string;
}
interface ITenantAccessStatus {
  tenantId: string;
  institutionName: string;
  accessible: boolean;
  status: string;
  billingStatus: string;
  reason?: string;
  subscriptionExpiresAt?: string;
  checkedAt: string;
}

const capabilities = ['Role-aware access', 'Tenant-isolated records', 'Auditable operations'];

/** Detects whether the API error means the tenant simply doesn't exist */
function isTenantNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('does not exist') ||
    msg.includes('not found') ||
    msg.includes('workspace was not found')
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ tenant?: string }>();
  const tenantId = typeof params.tenant === 'string' ? params.tenant : '';
  const {
    data: accessResponse,
    isLoading: accessLoading,
    error: accessError,
    mutate: refreshAccess,
  } = useSwr<{
    success: boolean;
    data: ITenantAccessStatus;
  }>(tenantId ? `tenant-domain/access-status?tenantId=${encodeURIComponent(tenantId)}` : null, {
    // ✅ Do NOT retry on error — tenant-not-found is permanent, not transient
    shouldRetryOnError: false,
    // ✅ Do NOT revalidate on reconnect for auth layout — avoid noise
    revalidateOnReconnect: false,
  });
  const access = accessResponse?.data;
  const { data: settingsResponse } = useSwr<{
    success: boolean;
    data: IInstitutionBranding;
  }>(access?.accessible ? 'institution-setting/public' : null);

  if (accessLoading) return <TenantAccessLoading />;
  if (access && !access.accessible) {
    return <TenantUnavailable access={access} onRefresh={() => void refreshAccess()} />;
  }
  if (accessError) {
    // Distinguish between "tenant does not exist" and other network/server errors
    if (isTenantNotFoundError(accessError)) {
      return <TenantNotFound tenantId={tenantId} />;
    }
    return (
      <TenantAccessError
        message={
          accessError instanceof Error ? accessError.message : 'Workspace status unavailable'
        }
        onRefresh={() => void refreshAccess()}
      />
    );
  }

  const settings = settingsResponse?.data;
  const institutionName =
    settings?.name && settings.name !== 'Institution setup required'
      ? settings.name
      : 'Your institution';
  const portalName = settings?.shortCode ? `${settings.shortCode} ERP` : 'Institution ERP';

  return (
    <main className="min-h-dvh bg-slate-100 p-0 lg:p-4">
      <div className="mx-auto grid min-h-dvh w-full overflow-hidden bg-white lg:min-h-[calc(100dvh-2rem)] lg:max-w-385 lg:grid-cols-[minmax(390px,0.86fr)_minmax(520px,1.14fr)] lg:rounded-2xl">
        <motion.aside
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="tenant-auth-brand relative hidden overflow-hidden text-white lg:flex lg:flex-col"
        >
          <div className="pointer-events-none absolute inset-0 opacity-10 tenant-brand-grid" />
          <div className="pointer-events-none absolute -right-24 top-28 size-72 rounded-full bg-white/10" />
          <div className="relative flex h-full flex-col px-10 py-9 xl:px-14 xl:py-11">
            <div className="flex items-center gap-3">
              {settings?.logoUrl ? (
                <span className="flex size-12 items-center justify-center rounded-xl bg-white p-1.5">
                  <Image
                    src={settings.logoUrl}
                    alt={`${institutionName} logo`}
                    width={42}
                    height={42}
                    className="h-auto max-h-full w-auto max-w-full object-contain"
                    priority
                    unoptimized
                  />
                </span>
              ) : (
                <span className="flex size-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
                  <Building2 className="size-5" />
                </span>
              )}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
                  Secure workspace
                </p>
                <p className="mt-0.5 text-sm font-semibold">{portalName}</p>
              </div>
            </div>

            <div className="my-auto max-w-lg py-14">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/65">
                Connected institution operations
              </p>
              <h1 className="mt-5 text-[2.65rem] font-semibold leading-[1.08] tracking-[-0.04em] xl:text-5xl">
                Welcome to
                <br />
                {institutionName}
              </h1>
              <p className="mt-5 max-w-md text-sm leading-7 text-white/72">
                {settings?.tagline ||
                  'A focused workspace for academics, people, finance and campus administration.'}
              </p>

              <div className="mt-9 space-y-3">
                {capabilities.map((capability) => (
                  <div key={capability} className="flex items-center gap-3 text-sm text-white/80">
                    <span className="flex size-6 items-center justify-center rounded-md bg-white/10">
                      <Check className="size-3.5" />
                    </span>
                    {capability}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 text-[11px] text-white/55">
              <span>{settings?.address || 'Private tenant workspace'}</span>
              <span>Powered by Devvelocity</span>
            </div>
          </div>
        </motion.aside>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="relative flex min-h-dvh flex-col bg-white lg:min-h-0"
        >
          <header className="flex items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
            <div className="flex min-w-0 items-center gap-3 lg:hidden">
              {settings?.logoUrl ? (
                <Image
                  src={settings.logoUrl}
                  alt={`${institutionName} logo`}
                  width={38}
                  height={38}
                  className="h-auto w-auto rounded-lg object-contain"
                  priority
                  unoptimized
                />
              ) : (
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary-50 text-primary">
                  <Building2 className="size-4" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{institutionName}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
                  {portalName}
                </p>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2 text-xs font-medium text-slate-500">
              <LockKeyhole className="size-3.5 text-primary" />
              Secure access
            </div>
          </header>

          <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8 lg:px-14 xl:px-20">
            <div className="w-full max-w-117.5">{children}</div>
          </div>

          <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-5 py-5 text-[11px] text-slate-600">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-secondary" />
              Encrypted in transit
            </span>
            <span>Role-based access</span>
            <span>Activity audited</span>
          </footer>
        </motion.section>
      </div>
    </main>
  );
}

function TenantAccessLoading() {
  return <AuthLayoutSkeleton />;
}

export function AuthLayoutSkeleton() {
  return (
    <main className="min-h-dvh bg-slate-100 p-0 lg:p-4">
      <div className="mx-auto grid min-h-dvh w-full overflow-hidden bg-white lg:min-h-[calc(100dvh-2rem)] lg:max-w-385 lg:grid-cols-[minmax(390px,0.86fr)_minmax(520px,1.14fr)] lg:rounded-2xl">
        {/* Left Brand Panel (Desktop) Skeleton */}
        <aside className="tenant-auth-brand relative hidden overflow-hidden text-white lg:flex lg:flex-col">
          <div className="pointer-events-none absolute inset-0 opacity-10 tenant-brand-grid" />
          <div className="pointer-events-none absolute -right-24 top-28 size-72 rounded-full bg-white/10" />

          <div className="relative flex h-full flex-col px-10 py-9 xl:px-14 xl:py-11">
            {/* Logo + Heading */}
            <div className="flex items-center gap-3">
              <div className="size-12 shrink-0 animate-pulse rounded-xl bg-white/20" />
              <div className="space-y-1.5">
                <div className="h-2.5 w-24 animate-pulse rounded bg-white/20" />
                <div className="h-4 w-32 animate-pulse rounded bg-white/30" />
              </div>
            </div>

            {/* Main content */}
            <div className="my-auto max-w-lg py-14">
              <div className="h-3.5 w-44 animate-pulse rounded-full bg-white/20" />
              <div className="mt-5 space-y-2.5">
                <div className="h-10 w-4/5 animate-pulse rounded-lg bg-white/25" />
                <div className="h-10 w-3/5 animate-pulse rounded-lg bg-white/25" />
              </div>
              <div className="mt-5 space-y-2">
                <div className="h-4 w-full animate-pulse rounded bg-white/15" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-white/15" />
              </div>

              {/* Capability bullet points skeleton */}
              <div className="mt-9 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="size-6 animate-pulse rounded-md bg-white/20" />
                    <div className="h-4 w-36 animate-pulse rounded bg-white/20" />
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-4">
              <div className="h-3 w-36 animate-pulse rounded bg-white/20" />
              <div className="h-3 w-28 animate-pulse rounded bg-white/20" />
            </div>
          </div>
        </aside>

        {/* Right Form Panel Skeleton */}
        <section className="relative flex min-h-dvh flex-col bg-white lg:min-h-0">
          {/* Header */}
          <header className="flex items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="size-9 animate-pulse rounded-lg bg-slate-200" />
              <div className="space-y-1">
                <div className="h-3.5 w-28 animate-pulse rounded bg-slate-200" />
                <div className="h-2.5 w-20 animate-pulse rounded bg-slate-200/70" />
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="size-3.5 animate-pulse rounded-full bg-slate-200" />
              <div className="h-3.5 w-24 animate-pulse rounded bg-slate-200" />
            </div>
          </header>

          {/* Form center container */}
          <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8 lg:px-14 xl:px-20">
            <div className="w-full max-w-117.5">
              {/* Form heading */}
              <div className="mb-7">
                <div className="mb-2 h-3.5 w-24 animate-pulse rounded bg-primary-100" />
                <div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200" />
                <div className="mt-2.5 h-4 w-4/5 animate-pulse rounded bg-slate-200/70" />
              </div>

              {/* Form Card Skeleton */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-6 sm:p-7">
                <div className="space-y-5">
                  {/* Field 1: Email */}
                  <div className="space-y-2">
                    <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                    <div className="h-12 w-full animate-pulse rounded-xl bg-slate-200/80" />
                  </div>
                  {/* Field 2: Password */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
                      <div className="h-3.5 w-28 animate-pulse rounded bg-slate-200" />
                    </div>
                    <div className="h-12 w-full animate-pulse rounded-xl bg-slate-200/80" />
                  </div>
                  {/* Submit Button */}
                  <div className="h-12 w-full animate-pulse rounded-xl bg-primary-500/80" />
                </div>
              </div>
            </div>
          </div>

          {/* Footer security badges */}
          <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-5 py-5 text-[11px] text-slate-600">
            <div className="h-3.5 w-32 animate-pulse rounded bg-slate-200" />
            <div className="h-3.5 w-28 animate-pulse rounded bg-slate-200" />
            <div className="h-3.5 w-24 animate-pulse rounded bg-slate-200" />
          </footer>
        </section>
      </div>
    </main>
  );
}

function TenantUnavailable({
  access,
  onRefresh,
}: {
  access: ITenantAccessStatus;
  onRefresh: () => void;
}) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <motion.section
        initial={{ opacity: 0, scale: 0.98, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-7 sm:p-10  "
      >
        {/* Header branding row */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary-50 text-primary">
              <Building2 className="size-4" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Devvelocity ERP Workspace
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200/50">
            <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
            Temporarily Restricted
          </span>
        </div>

        {/* Main Hero Card Section */}
        <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-start">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100 ">
            <Clock3 className="size-7" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {access.institutionName}
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
              {access.reason ||
                'Access to this institution workspace is currently unavailable. All institution data remains safe, encrypted, and isolated.'}
            </p>
          </div>
        </div>

        {/* Info Pill Grid */}
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3.5 rounded-2xl bg-slate-50/80 p-4 border border-slate-200/70">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
              <Globe className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-600">Workspace Address</p>
              <p className="truncate text-sm font-bold text-slate-800">{access.tenantId}</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-2xl bg-slate-50/80 p-4 border border-slate-200/70">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <ShieldCheck className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-600">Subscription Status</p>
              <p className="truncate text-sm font-bold capitalize text-slate-800">
                {access.status.replaceAll('_', ' ')}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-primary-600 to-primary-700 px-6 text-sm font-bold text-white   transition-all   active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-primary-100"
          >
            <RefreshCw className="size-4" /> Re-check status
          </button>
          <a
            href="mailto:support@devvelocity.in"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            <LifeBuoy className="size-4" /> Contact support
            <ArrowUpRight className="size-3.5 text-slate-600" />
          </a>
        </div>

        <div className="mt-7 border-t border-slate-100 pt-4 flex items-center justify-between text-xs text-slate-600">
          <span>Contact your institution admin to resolve access.</span>
          <span>Audited & Encrypted</span>
        </div>
      </motion.section>
    </main>
  );
}

/** Shown when the tenant ID in the URL simply doesn't exist in the system */
function TenantNotFound({ tenantId }: { tenantId: string }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <motion.section
        initial={{ opacity: 0, scale: 0.98, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-7 sm:p-10  "
      >
        {/* Header branding */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <Building2 className="size-4" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Devvelocity ERP System
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200/50">
            Workspace Not Found
          </span>
        </div>

        {/* Main Hero Card Section */}
        <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-start">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100 ">
            <SearchX className="size-7" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              This workspace doesn&apos;t exist
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
              No organization workspace is registered under{' '}
              <code className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-800">
                {tenantId}
              </code>
              . Please check the workspace URL provided by your administrator.
            </p>
          </div>
        </div>

        {/* Info Pill Grid */}
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50/80 p-4 border border-slate-200/70">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
              <Globe className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-600">Workspace</p>
              <p className="truncate text-xs font-bold text-slate-800">{tenantId}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-rose-50/50 p-4 border border-rose-200/70">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <SearchX className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-rose-500">Status</p>
              <p className="truncate text-xs font-bold text-rose-700">Unregistered</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-slate-50/80 p-4 border border-slate-200/70">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <ShieldCheck className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-600">Platform</p>
              <p className="truncate text-xs font-bold text-slate-800">Devvelocity</p>
            </div>
          </div>
        </div>

        {/* Action Steps Checklist Card */}
        <div className="mt-6 rounded-2xl bg-slate-50/60 p-5 border border-slate-200/60">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" /> Recommended Steps
          </p>
          <ul className="mt-3.5 space-y-2.5">
            {[
              'Double-check the subdomain or custom URL in your browser address bar.',
              'Ask your institution administrator for the official workspace link.',
              'Reach out to Devvelocity support if your organization was recently onboarded.',
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-3 text-sm text-slate-600">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary mt-0.5">
                  <Check className="size-3" />
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a
            href="mailto:devvelocity2006@gmail.com"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-white  transition-all hover:bg-primary/90 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-primary/20"
          >
            <LifeBuoy className="size-4" />
            Contact support
            <ArrowUpRight className="size-3.5 opacity-70" />
          </a>
        </div>

        <div className="mt-7 border-t border-slate-100 pt-4 text-xs text-slate-600">
          Workspace IDs are provisioned securely by Devvelocity during institution setup.
        </div>
      </motion.section>
    </main>
  );
}

function TenantAccessError({ message, onRefresh }: { message: string; onRefresh: () => void }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <motion.section
        initial={{ opacity: 0, scale: 0.98, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-7 sm:p-10  "
      >
        {/* Header branding */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Building2 className="size-4" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Devvelocity System Access
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200/50">
            Connection Issue
          </span>
        </div>

        {/* Main Hero Card Section */}
        <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-start">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 ">
            <Clock3 className="size-7" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Unable to reach workspace
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
              We couldn&apos;t verify access to this workspace right now. This is typically caused
              by a transient network issue or momentary server response delay.
            </p>
          </div>
        </div>

        {/* Technical log detail */}
        <div className="mt-6 rounded-2xl bg-slate-50/80 p-4 border border-slate-200/70">
          <p className="text-xs font-semibold text-slate-600">Technical Log Detail</p>
          <p className="mt-1 font-mono text-xs text-slate-700 wrap-break-word">{message}</p>
        </div>

        {/* Recovery checklist */}
        <div className="mt-5 rounded-2xl bg-indigo-50/30 p-5 border border-indigo-100/60">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-2">
            <ShieldCheck className="size-4" /> Recommended Recovery Steps
          </p>
          <ul className="mt-3 space-y-2.5">
            {[
              'Check network connectivity and click "Try again".',
              'Wait a few seconds — background services may be re-synchronizing.',
              'If this message persists, contact Devvelocity technical support.',
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-3 text-sm text-slate-600">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 mt-0.5">
                  <Check className="size-3" />
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-primary-600 to-primary-700 px-6 text-sm font-bold text-white   transition-all   active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-primary-100"
          >
            <RefreshCw className="size-4" /> Try again
          </button>
          <a
            href="mailto:devvelocity2006@gmail.com"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            <LifeBuoy className="size-4" /> Contact support
            <ArrowUpRight className="size-3.5 text-slate-600" />
          </a>
        </div>

        <div className="mt-7 border-t border-slate-100 pt-4 text-xs text-slate-600">
          Your user records and sessions remain encrypted and uncompromised.
        </div>
      </motion.section>
    </main>
  );
}

/**
 * @file OverviewTab.tsx
 * @description API-backed SaaS operating overview with real KPIs, charts and attention queues.
 * @module features/super-admin/components
 */

'use client';

import dynamic from 'next/dynamic';
import {
  Activity,
  ArrowUpRight,
  Boxes,
  Building2,
  CircleAlert,
  Database,
  Globe2,
  PackageCheck,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import OverviewIllustration from './OverviewIllustration';
import {
  ILead,
  IMonthlyPlatformMetric,
  IPlatformOverview,
  ITenant,
} from '../types/super-admin.types';

const PlatformAnalytics = dynamic(() => import('./PlatformAnalytics'), {
  ssr: false,
  loading: () => <div className="h-80 animate-pulse admin-surface" />,
});

interface IOverviewTabProps {
  data?: IPlatformOverview;
  isLoading: boolean;
  error?: Error;
  onRetry: () => void;
}

const REFERENCE_TIME = Date.now();

/** Builds a six-month activity timeline from API timestamps. */
function buildTimeline(tenants: ITenant[], leads: ILead[]): IMonthlyPlatformMetric[] {
  const formatter = new Intl.DateTimeFormat('en-IN', { month: 'short' });
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(REFERENCE_TIME);
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));
    const matchesMonth = (value: string) => {
      const candidate = new Date(value);
      return (
        candidate.getMonth() === date.getMonth() && candidate.getFullYear() === date.getFullYear()
      );
    };
    return {
      month: formatter.format(date),
      tenants: tenants.filter((tenant) => matchesMonth(tenant.createdAt)).length,
      leads: leads.filter((lead) => matchesMonth(lead.createdAt)).length,
      conversions: leads.filter(
        (lead) => lead.status === 'converted' && matchesMonth(lead.createdAt),
      ).length,
    };
  });
}

export default function OverviewTab({ data, isLoading, error, onRetry }: IOverviewTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-5" aria-label="Loading platform overview">
        <div className="h-72 animate-pulse rounded-[2rem] bg-primary-50" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-40 animate-pulse rounded-3xl bg-white" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-3xl bg-rose-50 p-8 text-center">
        <CircleAlert className="mx-auto h-8 w-8 text-rose-600" />
        <h2 className="mt-3 text-lg font-semibold text-slate-800">Operations data unavailable</h2>
        <p className="mt-1 text-sm text-slate-600">
          {error?.message || 'Check the API connection and refresh this page.'}
        </p>
        <div className="mt-5 flex justify-center">
          <CustomButton onClick={onRetry}>Try again</CustomButton>
        </div>
      </div>
    );
  }

  const { tenants, leads, modules, plans, publicProfile, tenantUsage } = data;

  const activeTenants = tenants.filter((tenant) => tenant.status === 'active').length;
  const pendingLeads = leads.filter((lead) => lead.status === 'pending').length;
  const convertedLeads = leads.filter((lead) => lead.status === 'converted').length;
  const attentionTenants = tenants.filter(
    (tenant) =>
      tenant.status !== 'active' ||
      new Date(tenant.subscriptionExpiresAt).getTime() < REFERENCE_TIME + 30 * 86_400_000,
  );
  const conversionRate = leads.length ? Math.round((convertedLeads / leads.length) * 100) : 0;
  const activeModules = modules.filter((module) => module.status === 'active').length;
  const activePlans = plans.filter((plan) => plan.isActive).length;
  const unreachableDatabases = tenantUsage.filter((item) => !item.databaseReachable).length;
  const totalStudents = tenantUsage.reduce((sum, item) => sum + item.students, 0);
  const totalEmployees = tenantUsage.reduce((sum, item) => sum + item.employees, 0);
  const licensedStudents = tenants.reduce((sum, tenant) => sum + (tenant.maxStudents ?? 0), 0);
  const studentUtilization = licensedStudents
    ? Math.round((totalStudents / licensedStudents) * 100)
    : 0;
  const publicProfileFields = publicProfile
    ? [
        publicProfile.companyName,
        publicProfile.headline,
        publicProfile.description,
        publicProfile.salesEmail,
        publicProfile.supportEmail,
        publicProfile.phone,
        publicProfile.address,
      ]
    : [];
  const publishingReadiness = publicProfileFields.length
    ? Math.round((publicProfileFields.filter(Boolean).length / publicProfileFields.length) * 100)
    : 0;
  const stats = [
    {
      label: 'Active tenants',
      value: activeTenants,
      detail: `${tenants.length} total`,
      icon: Building2,
    },
    {
      label: 'Open leads',
      value: pendingLeads,
      detail: `${leads.length} total inquiries`,
      icon: UsersRound,
    },
    {
      label: 'Conversions',
      value: convertedLeads,
      detail: `${conversionRate}% conversion rate`,
      icon: UserRoundCheck,
    },
    {
      label: 'Database health',
      value: `${tenants.length - unreachableDatabases}/${tenants.length}`,
      detail: unreachableDatabases ? `${unreachableDatabases} require attention` : 'All reachable',
      icon: Database,
    },
    {
      label: 'Product modules',
      value: activeModules,
      detail: `${modules.length} registered in master catalogue`,
      icon: Boxes,
    },
    {
      label: 'Active plans',
      value: activePlans,
      detail: `${plans.length} subscription plans`,
      icon: PackageCheck,
    },
    {
      label: 'Website readiness',
      value: `${publishingReadiness}%`,
      detail: publicProfile ? 'Public profile configured' : 'Public profile not published',
      icon: Globe2,
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      <section className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#eaf5fd_0%,#ffffff_48%,#f5f8ec_100%)] p-5 sm:p-7 lg:grid lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:p-9">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-primary">
            <span className="relative flex h-2 w-2">
              <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Platform synchronized
          </div>
          <h2 className="mt-5 max-w-xl text-2xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-3xl lg:text-[2.25rem] lg:leading-[1.12]">
            Every institution, signal and subscription in one calm workspace.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600 sm:text-[15px]">
            Monitor adoption, tenant health and commercial momentum without moving between reports.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/tenants"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600"
            >
              Manage tenants <ArrowUpRight className="h-4 w-4" />
            </a>
            <div className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">
              <Activity className="h-4 w-4 text-secondary-600" /> Updated{' '}
              {new Date(data.measuredAt).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        </div>
        <div className="mt-5 lg:mt-0">
          <OverviewIllustration />
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.slice(0, 4).map((stat, index) => (
          <motion.article
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className="rounded-3xl bg-white p-5 transition-transform duration-300 hover:-translate-y-1"
          >
            <div className="flex items-start justify-between">
              <div className="rounded-2xl bg-primary-50 p-3 text-primary">
                <stat.icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-emerald-600">Live</span>
            </div>
            <p className="mt-5 text-3xl font-bold tracking-tight text-slate-900">{stat.value}</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">{stat.label}</p>
            <p className="mt-1 text-xs text-slate-500">{stat.detail}</p>
          </motion.article>
        ))}
      </div>

      <PlatformAnalytics timeline={buildTimeline(tenants, leads)} tenants={tenants} />

      <section className="grid gap-4 md:grid-cols-3">
        <article className="admin-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Active learners
          </p>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {totalStudents.toLocaleString('en-IN')}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {studentUtilization}% of platform student capacity
          </p>
          <progress
            className="mt-4 h-2 w-full overflow-hidden rounded-full accent-primary"
            max={100}
            value={Math.min(studentUtilization, 100)}
            aria-label="Student license utilization"
          />
        </article>
        <article className="admin-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Active employees
          </p>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {totalEmployees.toLocaleString('en-IN')}
          </p>
          <p className="mt-1 text-xs text-slate-500">Across reachable tenant databases</p>
        </article>
        <article
          className={`rounded-3xl p-5 ${unreachableDatabases ? 'bg-rose-50' : 'bg-emerald-50'}`}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Isolation health
          </p>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {unreachableDatabases ? `${unreachableDatabases} offline` : 'Healthy'}
          </p>
          <p className="mt-1 text-xs text-slate-600">Latest tenant database connectivity check</p>
        </article>
      </section>

      <div className="grid gap-5 xl:grid-cols-5">
        <section className="admin-surface p-5 sm:p-6 xl:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Product availability</h2>
              <p className="mt-1 text-sm text-slate-500">
                Live status from the master product catalogue.
              </p>
            </div>
            <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary">
              {modules.length} modules
            </span>
          </div>
          {modules.length ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {modules.slice(0, 8).map((module) => (
                <div key={module._id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{module.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {module.features.length} available features
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                        module.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {module.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-700">
              No master product modules are registered.
            </p>
          )}
        </section>

        <section className="admin-surface p-5 sm:p-6 xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Published plans</h2>
              <p className="mt-1 text-sm text-slate-500">
                Commercial packages available to tenants.
              </p>
            </div>
            <span className="rounded-full bg-secondary-50 px-3 py-1 text-xs font-semibold text-secondary-600">
              {activePlans} active
            </span>
          </div>
          {plans.length ? (
            <div className="mt-5 space-y-3">
              {plans.slice(0, 5).map((plan) => (
                <div key={plan._id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-800">{plan.name}</p>
                    <p className="text-sm font-bold text-primary">{plan.priceLabel}</p>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {plan.moduleSlugs.length} modules · {plan.studentLimit.toLocaleString('en-IN')}{' '}
                    students
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-700">
              No subscription plans have been published.
            </p>
          )}
        </section>
      </div>

      <section className="admin-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Requires attention</h2>
            <p className="mt-1 text-sm text-slate-500">
              Provisioning, suspended or expiring tenants.
            </p>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            {attentionTenants.length} records
          </span>
        </div>
        {attentionTenants.length ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {attentionTenants.slice(0, 6).map((tenant) => (
              <div key={tenant._id} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-slate-800">{tenant.name}</p>
                  <span className="text-[11px] font-semibold uppercase text-amber-700">
                    {tenant.status.replaceAll('_', ' ')}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Subscription ends{' '}
                  {new Date(tenant.subscriptionExpiresAt).toLocaleDateString('en-IN')}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">
            Every tenant is active and outside the 30-day renewal window.
          </p>
        )}
      </section>
    </motion.div>
  );
}

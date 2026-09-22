/**
 * @file TenantsTab.tsx
 * @description College tenants list tab view supporting tabular display and provisioning links.
 * @module features/super-admin/components
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import { PlusCircle, Table, LayoutGrid, LoaderCircle, Trash2, RotateCcw } from 'lucide-react';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Column } from '@/shared/core/CustomTable';
import { ITenant, ITenantUsage } from '../types/super-admin.types';

interface ITenantsTabProps {
  tenants: ITenant[];
  searchQuery: string;
  isLoading: boolean;
  onToggleStatus: (tenant: ITenant) => void;
  onRemoveTenant: (tenant: ITenant) => void;
  onOpenProvision: () => void;
  usage: ITenantUsage[];
  onManageSubscription?: (tenant: ITenant) => void;
  onViewTenant: (tenant: ITenant) => void;
  statusChangingTenantId?: string;
  removingTenantId?: string;
  retryingTenantId?: string;
  onRetryProvisioning: (tenant: ITenant) => void;
  onRefresh?: () => void;
  isValidating?: boolean;
}

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
} as const;

const DAY_MS = 86_400_000;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

function expiryTone(value: string): 'critical' | 'warning' | 'normal' {
  const remainingDays = Math.ceil((new Date(value).getTime() - Date.now()) / DAY_MS);
  if (remainingDays <= 3) return 'critical';
  if (remainingDays <= 30) return 'warning';
  return 'normal';
}

function lifecycleExpiry(tenant: ITenant): string {
  if (tenant.billingStatus === 'trialing' && tenant.trialEndsAt) return tenant.trialEndsAt;
  if (tenant.billingStatus === 'past_due' && tenant.graceEndsAt) return tenant.graceEndsAt;
  return tenant.subscriptionExpiresAt;
}

export default function TenantsTab({
  tenants,
  searchQuery,
  isLoading,
  onToggleStatus,
  onRemoveTenant,
  onOpenProvision,
  usage,
  onViewTenant,
  statusChangingTenantId,
  removingTenantId,
  retryingTenantId,
  onRetryProvisioning,
  onRefresh,
  isValidating,
}: ITenantsTabProps) {
  const [view, setView] = useState<'table' | 'grid'>('table');
  const filtered = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tenantId.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const usageByTenant = new Map(usage.map((item) => [item.tenantId, item]));

  const columns: Column<ITenant>[] = [
    {
      field: 'name',
      title: 'Organization',
      sortable: true,
      render: (row) => (
        <span className="block w-fit mx-auto max-w-sm truncate rounded  font-semibold text-slate-700">
          {row.name}
        </span>
      ),
    },
    {
      field: 'tenantId',
      title: 'Subdomain ID',
      sortable: true,
      render: (row) => (
        <span className="block w-fit mx-auto max-w-sm truncate rounded text-sm font-medium text-slate-700">
          {row.tenantId}
        </span>
      ),
    },
    {
      field: 'databaseName',
      title: 'Database',
      render: (row) => (
        <span className="block w-fit mx-auto truncate rounded bg-blue-50 px-2 py-0.5 font-mono text-sm text-slate-800">
          {row.databaseName}
        </span>
      ),
    },
    {
      field: 'status',
      title: 'Status',
      render: (row) => (
        <span
          className={`flex items-center text-nowrap justify-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold capitalize ${
            row.status === 'active'
              ? 'bg-emerald-100 text-emerald-700'
              : row.status === 'provisioning'
                ? 'bg-primary-50 text-primary-700'
                : row.status === 'provisioning_failed'
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-amber-100 text-amber-700'
          }`}
        >
          {row.status === 'provisioning' && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
          {row.status.replaceAll('_', ' ')}
        </span>
      ),
    },
    {
      field: '_id',
      title: 'Current usage',
      render: (row) => {
        const current = usageByTenant.get(row._id);
        return current ? (
          <span className="text-sm flex items-center text-left justify-center font-normal text-slate-600">
            {current.students.toLocaleString('en-IN')} Students <br />
            {current.employees.toLocaleString('en-IN')} Staff
          </span>
        ) : (
          <span className="text-xs text-slate-400">Pending measurement</span>
        );
      },
    },
    {
      field: 'subscriptionExpiresAt',
      title: 'Expires At',
      render: (row) => (
        <span
          className={`flex items-center justify-center text-center text-sm font-semibold ${
            expiryTone(lifecycleExpiry(row)) === 'critical'
              ? 'text-rose-700'
              : expiryTone(lifecycleExpiry(row)) === 'warning'
                ? 'text-amber-700'
                : 'text-slate-600'
          }`}
        >
          <span>
            {row.billingStatus === 'trialing' ? 'Trial ends ' : 'Expires '}
            {formatDate(lifecycleExpiry(row))}
          </span>
        </span>
      ),
    },
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Tenant directory</h2>
          <p className="mt-1 text-sm font-medium text-slate-800/80">
            Provision, inspect and govern every isolated institution workspace from one dependable
            directory.
          </p>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex w-full justify-end">
            <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100/80 p-1 border border-slate-200/60 shadow-xs">
              <div className="relative group flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setView('table')}
                  aria-label="Table view"
                  className={`relative cursor-pointer inline-flex items-center justify-center rounded-lg p-2 text-xs font-medium transition-colors duration-200 ${
                    view === 'table'
                      ? 'text-primary-600 font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {view === 'table' && (
                    <motion.div
                      layoutId="tenantViewActivePill"
                      className="absolute inset-0 rounded-lg bg-white shadow-xs border border-slate-200/50"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Table className="relative z-10 h-4 w-4" />
                </button>
                <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 z-30 shadow-md">
                  Table view
                </span>
              </div>

              <div className="relative group flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setView('grid')}
                  aria-label="Grid view"
                  className={`relative cursor-pointer inline-flex items-center justify-center rounded-lg p-2 text-xs font-medium transition-colors duration-200 ${
                    view === 'grid'
                      ? 'text-primary-600 font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {view === 'grid' && (
                    <motion.div
                      layoutId="tenantViewActivePill"
                      className="absolute inset-0 rounded-lg bg-white shadow-xs border border-slate-200/50"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <LayoutGrid className="relative z-10 h-4 w-4" />
                </button>
                <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 z-30 shadow-md">
                  Grid view
                </span>
              </div>
            </div>
          </div>
          <div className="w-fit">
            <CustomButton
              variant="primary"
              size="medium"
              onClick={onOpenProvision}
              className="text-nowrap"
              startIcon={<PlusCircle className="w-4 h-4" />}
            >
              Provision College
            </CustomButton>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {view === 'table' ? (
            <CustomTable
              data={filtered as unknown as Record<string, unknown>[]}
              columns={columns as unknown as Column<Record<string, unknown>>[]}
              isLoading={isLoading}
              actions={[
                {
                  icon: () => <span>View details</span>,
                  className:
                    'inline-flex items-center justify-center rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 active:scale-95 cursor-pointer',
                  tooltip: 'Open tenant details',
                  onClick: (row) => onViewTenant(row as unknown as ITenant),
                },
                {
                  icon: (row) => (
                    <span className="flex items-center gap-1.5">
                      {statusChangingTenantId === (row as unknown as ITenant)._id && (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      )}
                      {(row as unknown as ITenant).status === 'active' ? 'Suspend' : 'Activate'}
                    </span>
                  ),
                  className: (row) =>
                    (row as unknown as ITenant).status === 'active'
                      ? 'inline-flex items-center justify-center rounded-md bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700  transition hover:bg-rose-100 active:scale-95 cursor-pointer shadow-2xs'
                      : 'inline-flex items-center justify-center rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700  transition hover:bg-emerald-100 active:scale-95 cursor-pointer shadow-2xs',
                  tooltip: 'Toggle status',
                  onClick: (row) => onToggleStatus(row as unknown as ITenant),
                  hidden: (row) =>
                    !['active', 'suspended'].includes((row as unknown as ITenant).status),
                },
                {
                  icon: (row) => (
                    <span className="flex items-center gap-1.5">
                      {retryingTenantId === (row as unknown as ITenant)._id ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      Retry provisioning
                    </span>
                  ),
                  className:
                    'inline-flex items-center justify-center rounded-md bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 active:scale-95 cursor-pointer',
                  tooltip: 'Retry approved tenant database provisioning',
                  onClick: (row) => onRetryProvisioning(row as unknown as ITenant),
                  hidden: (row) =>
                    !['provisioning', 'provisioning_failed'].includes(
                      (row as unknown as ITenant).status,
                    ),
                },
                {
                  icon: (row) => (
                    <span className="flex items-center gap-1.5">
                      {removingTenantId === (row as unknown as ITenant)._id ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Remove
                    </span>
                  ),
                  className:
                    'inline-flex items-center justify-center rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700 active:scale-95 cursor-pointer shadow-2xs',
                  tooltip: 'Permanently remove suspended tenant',
                  onClick: (row) => onRemoveTenant(row as unknown as ITenant),
                  hidden: (row) => (row as unknown as ITenant).status !== 'suspended',
                },
              ]}
              title="Tenant operations"
              description="Govern subdomains, isolated databases and subscription access."
              onRefresh={onRefresh}
              isValidating={isValidating}
              getRowClassName={(row) => {
                const tenant = row as unknown as ITenant;
                if (tenant.status === 'provisioning') return 'bg-primary-50/50';
                const tone = expiryTone(lifecycleExpiry(tenant));
                if (tone === 'critical') return 'bg-rose-50/70';
                if (tone === 'warning') return 'bg-amber-50/70';
                return '';
              }}
              onRowClick={(row) => onViewTenant(row as unknown as ITenant)}
              options={{
                pagination: true,
                search: false,
                sorting: true,
                export: true,
                refresh: true,
              }}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((tenant) => (
                <article
                  key={tenant._id}
                  className={`rounded-3xl p-5 ${
                    tenant.status === 'provisioning'
                      ? 'bg-primary-50'
                      : expiryTone(lifecycleExpiry(tenant)) === 'critical'
                        ? 'bg-rose-50'
                        : expiryTone(lifecycleExpiry(tenant)) === 'warning'
                          ? 'bg-amber-50'
                          : 'bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{tenant.name}</h3>
                      <p className="mt-1 font-mono text-[11px] text-slate-500">
                        {tenant.databaseName}
                      </p>
                    </div>
                    <span className="flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-600">
                      {tenant.status === 'provisioning' && (
                        <LoaderCircle className="h-3 w-3 animate-spin text-primary" />
                      )}
                      {tenant.status.replaceAll('_', ' ')}
                    </span>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-lg font-bold text-slate-900">
                        {(tenant.maxStudents ?? 0).toLocaleString('en-IN')}
                      </p>
                      <p className="text-xs text-slate-500">Student limit</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-lg font-bold text-slate-900">
                        {(tenant.maxEmployees ?? 0).toLocaleString('en-IN')}
                      </p>
                      <p className="text-xs text-slate-500">Employee limit</p>
                    </div>
                  </div>
                  {usageByTenant.get(tenant._id) && (
                    <div className="mt-3 rounded-2xl bg-primary-50 p-3">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-semibold text-slate-600">
                          {usageByTenant.get(tenant._id)?.planName || 'Custom plan'} ·{' '}
                          {usageByTenant.get(tenant._id)?.enabledModuleCount} modules
                        </span>
                        <span
                          className={`font-bold ${usageByTenant.get(tenant._id)?.databaseReachable ? 'text-emerald-700' : 'text-rose-700'}`}
                        >
                          {usageByTenant.get(tenant._id)?.databaseReachable
                            ? 'Database online'
                            : 'Database unavailable'}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <span className="rounded-xl bg-white/70 px-3 py-2">
                          <strong className="text-slate-900">
                            {usageByTenant.get(tenant._id)?.students.toLocaleString('en-IN')}
                          </strong>{' '}
                          / {(tenant.maxStudents ?? 0).toLocaleString('en-IN')} students
                        </span>
                        <span className="rounded-xl bg-white/70 px-3 py-2">
                          <strong className="text-slate-900">
                            {usageByTenant.get(tenant._id)?.employees.toLocaleString('en-IN')}
                          </strong>{' '}
                          / {(tenant.maxEmployees ?? 0).toLocaleString('en-IN')} staff
                        </span>
                      </div>
                      {(((tenant.maxStudents ?? 0) > 0 &&
                        (usageByTenant.get(tenant._id)?.students ?? 0) /
                          (tenant.maxStudents ?? 1) >=
                          0.8) ||
                        ((tenant.maxEmployees ?? 0) > 0 &&
                          (usageByTenant.get(tenant._id)?.employees ?? 0) /
                            (tenant.maxEmployees ?? 1) >=
                            0.8)) && (
                        <p className="mt-2 rounded-xl bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800">
                          Capacity is above 80%. Discuss an add-on or plan upgrade before onboarding
                          more active users.
                        </p>
                      )}
                    </div>
                  )}
                  <p className="mt-4 text-xs text-slate-500">
                    {tenant.billingStatus === 'trialing' ? 'Trial ends' : 'Expires'}{' '}
                    {formatDate(lifecycleExpiry(tenant))}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <CustomButton
                      variant="tertiary"
                      size="small"
                      onClick={() => onViewTenant(tenant)}
                    >
                      View details
                    </CustomButton>
                    {['active', 'suspended'].includes(tenant.status) && (
                      <CustomButton
                        variant={tenant.status === 'active' ? 'cancel' : 'primary'}
                        size="small"
                        onClick={() => onToggleStatus(tenant)}
                      >
                        {tenant.status === 'active' ? 'Suspend' : 'Activate'}
                      </CustomButton>
                    )}
                    {['provisioning', 'provisioning_failed'].includes(tenant.status) && (
                      <CustomButton
                        variant="tertiary"
                        size="small"
                        onClick={() => onRetryProvisioning(tenant)}
                        startIcon={
                          retryingTenantId === tenant._id ? (
                            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )
                        }
                      >
                        Retry provisioning
                      </CustomButton>
                    )}
                    {tenant.status === 'suspended' && (
                      <CustomButton
                        variant="cancel"
                        size="small"
                        onClick={() => onRemoveTenant(tenant)}
                        startIcon={
                          removingTenantId === tenant._id ? (
                            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )
                        }
                      >
                        Remove
                      </CustomButton>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

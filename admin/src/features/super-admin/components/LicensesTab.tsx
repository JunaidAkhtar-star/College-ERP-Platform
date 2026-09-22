/**
 * @file LicensesTab.tsx
 * @description Subscription portfolio rendered from live tenant limits and renewal dates.
 * @module features/super-admin/components
 */

'use client';

import { useState } from 'react';
import { CalendarClock, Table, LayoutGrid, UsersRound } from 'lucide-react';
import CustomTable, { Column } from '@/shared/core/CustomTable';
import { motion } from '@/shared/utils/motion';
import { ITenant, ITenantUsage } from '../types/super-admin.types';

interface ILicensesTabProps {
  tenants: ITenant[];
  usage: ITenantUsage[];
  onManageSubscription?: (tenant: ITenant) => void;
  onRefresh?: () => void;
  isValidating?: boolean;
}

type TView = 'grid' | 'table';
const REFERENCE_TIME = Date.now();

export default function LicensesTab({
  tenants,
  usage,
  onRefresh,
  isValidating,
}: ILicensesTabProps) {
  const [view, setView] = useState<TView>('grid');
  const usageByTenant = new Map(usage.map((item) => [item.tenantId, item]));

  const columns: Column<ITenant>[] = [
    {
      field: 'name',
      title: 'Tenant',
      sortable: true,
      render: (row) => (
        <span className="block w-fit mx-auto max-w-sm truncate rounded  font-semibold text-slate-700">
          {row.name}
        </span>
      ),
    },
    {
      field: 'tenantId',
      title: 'Code',
      sortable: true,
      render: (row) => (
        <span className="block w-fit mx-auto max-w-sm truncate rounded text-sm font-medium text-slate-700">
          {row.tenantId}
        </span>
      ),
    },
    {
      field: 'status',
      title: 'State',
      render: (row) => (
        <span
          className={`rounded-sm flex items-center justify-center px-3.5 py-1 text-sm capitalize font-semibold ${
            row.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      field: 'maxStudents',
      title: 'Student Limit',
      render: (row) => (
        <span className="text-sm text-center flex items-center justify-center font-normal text-slate-600">
          {(row.maxStudents ?? 0).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      field: 'maxEmployees',
      title: 'Employee Limit',
      render: (row) => (
        <span className="text-sm text-center flex items-center justify-center font-normal text-slate-600">
          {(row.maxEmployees ?? 0).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      field: 'subscriptionExpiresAt',
      title: 'Renews / Expires',
      render: (row) => (
        <span className="text-sm text-center flex items-center justify-center font-normal text-slate-600">
          {new Date(row.subscriptionExpiresAt).toLocaleDateString('en-IN')}
        </span>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Subscription portfolio</h2>
          <p className="mt-1 text-sm text-slate-500">
            Real tenant limits, state and renewal dates. License tokens are issued only by the
            backend.
          </p>
        </div>
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
                  layoutId="licensesViewActivePill"
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
                  layoutId="licensesViewActivePill"
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
      {view === 'grid' ? (
        tenants.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tenants.map((tenant) => {
              const currentUsage = usageByTenant.get(tenant._id);
              const days = Math.ceil(
                (new Date(tenant.subscriptionExpiresAt).getTime() - REFERENCE_TIME) / 86_400_000,
              );
              return (
                <article key={tenant._id} className="admin-surface p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{tenant.name}</p>
                      <p className="mt-1 font-mono text-[11px] text-slate-500">
                        {tenant.databaseName}
                      </p>
                    </div>
                    <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-bold uppercase text-primary">
                      {tenant.status.replaceAll('_', ' ')}
                    </span>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <UsersRound className="h-4 w-4 text-primary" />
                      <p className="mt-2 text-lg font-bold text-slate-900">
                        {(currentUsage?.students ?? 0).toLocaleString('en-IN')}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        of {(tenant.maxStudents ?? 0).toLocaleString('en-IN')} students
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <CalendarClock className="h-4 w-4 text-secondary-600" />
                      <p className="mt-2 text-lg font-bold text-slate-900">{days > 0 ? days : 0}</p>
                      <p className="text-[11px] text-slate-500">Days remaining</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-xs">
                    <span className="font-semibold text-slate-600">
                      {currentUsage?.planName || 'Custom plan'} ·{' '}
                      {currentUsage?.enabledModuleCount ?? 0} modules
                    </span>
                    <span
                      className={`font-bold ${currentUsage?.databaseReachable ? 'text-emerald-700' : 'text-rose-700'}`}
                    >
                      {currentUsage?.databaseReachable ? 'Healthy' : 'Check database'}
                    </span>
                  </div>
                  <p className="mt-4 text-xs text-slate-500">
                    Renews {new Date(tenant.subscriptionExpiresAt).toLocaleDateString('en-IN')}
                  </p>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="admin-surface p-8 text-center text-sm text-slate-500">
            No tenants have been provisioned.
          </div>
        )
      ) : (
        <CustomTable
          data={tenants as unknown as Record<string, unknown>[]}
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          onRefresh={onRefresh}
          isValidating={isValidating}
          options={{ pagination: true, search: true, sorting: true, refresh: true }}
        />
      )}
    </motion.div>
  );
}

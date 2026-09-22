'use client';

/**
 * @file FeeSummaryTab.tsx
 * @description Admin tab — fee collection summary by academic year (aggregated by status).
 * @module features/role-wise-features/fee/components
 */

import React, { useState } from 'react';
import { TrendingUp, DollarSign, Hash, AlertCircle } from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import useSwr from '@/shared/hooks/useSwr';
import type { IFeeCollectionSummaryBucket, TFeePaymentStatus } from '../types/Fee.types';
import AsyncSelect from '@/shared/core/AsyncSelect';

const STATUS_TONE: Record<TFeePaymentStatus, string> = {
  Pending: 'bg-amber-50 text-amber-700',
  Partial: 'bg-blue-50 text-blue-700',
  Paid: 'bg-secondary-50 text-secondary',
  Overdue: 'bg-red-50 text-red-600',
  Waived: 'bg-purple-50 text-purple-600',
  Refunded: 'bg-slate-100 text-slate-600',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);

export default function FeeSummaryTab() {
  const [year, setYear] = useState('');

  const { data: raw, error, isLoading } = useSwr(year ? `fee/summary?academicYear=${year}` : null);
  const buckets: IFeeCollectionSummaryBucket[] =
    (raw as { data?: IFeeCollectionSummaryBucket[] })?.data ?? [];

  const totals = buckets.reduce(
    (acc, b) => ({
      count: acc.count + b.count,
      due: acc.due + (b.totalDue ?? 0),
      paid: acc.paid + (b.totalPaid ?? 0),
      balance: acc.balance + (b.totalBalance ?? 0),
    }),
    { count: 0, due: 0, paid: 0, balance: 0 },
  );

  const collectionRate = totals.due > 0 ? Math.round((totals.paid / totals.due) * 100) : 0;

  return (
    <div className="space-y-5">
      {error && (
        <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          Fee summary could not be loaded. Collection totals are not estimated.
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Collection Summary</h3>
          <p className="text-xs text-slate-500">Fee collection performance by academic year</p>
        </div>
        <div className="min-w-48">
          <AsyncSelect
            type="academicYears"
            value={year || null}
            onChange={(value) => setYear(value ?? '')}
            placeholder="Select academic year"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: 'Total Records',
            value: raw ? totals.count : '—',
            icon: <Hash className="h-4.5 w-4.5" />,
            cls: 'bg-primary-50 text-primary',
          },
          {
            label: 'Total Due',
            value: raw ? fmt(totals.due) : '—',
            icon: <DollarSign className="h-4.5 w-4.5" />,
            cls: 'bg-slate-100 text-slate-700',
          },
          {
            label: 'Collected',
            value: raw ? fmt(totals.paid) : '—',
            icon: <TrendingUp className="h-4.5 w-4.5" />,
            cls: 'bg-secondary-50 text-secondary',
          },
          {
            label: 'Outstanding',
            value: raw ? fmt(totals.balance) : '—',
            icon: <AlertCircle className="h-4.5 w-4.5" />,
            cls: 'bg-red-50 text-red-500',
          },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="flex items-center gap-3 rounded-xl bg-white p-4"
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.cls}`}
            >
              {s.icon}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-slate-900">
                {isLoading ? '—' : s.value}
              </p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">Collection Rate</p>
          <span className="text-sm font-bold text-primary">{raw ? `${collectionRate}%` : '—'}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: raw ? `${collectionRate}%` : '0%' }}
            transition={{ duration: 0.5 }}
            className="h-full bg-secondary"
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {raw
            ? `${fmt(totals.paid)} collected of ${fmt(totals.due)} due`
            : 'Select an academic year to load governed totals.'}
        </p>
      </div>

      <div className="rounded-2xl bg-white p-5">
        <p className="mb-4 text-sm font-semibold text-slate-800">Breakdown by Status</p>
        {isLoading ? (
          <p className="py-6 text-center text-xs text-slate-600">Loading…</p>
        ) : buckets.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-600">No data for {year}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-600">
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Count</th>
                  <th className="pb-2 font-medium">Net Due</th>
                  <th className="pb-2 font-medium">Paid</th>
                  <th className="pb-2 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {buckets.map((b) => (
                  <tr key={b._id}>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[b._id] ?? 'bg-slate-100'}`}
                      >
                        {b._id}
                      </span>
                    </td>
                    <td className="py-2 text-slate-700">{b.count}</td>
                    <td className="py-2 text-slate-700">{fmt(b.totalDue ?? 0)}</td>
                    <td className="py-2 text-secondary">{fmt(b.totalPaid ?? 0)}</td>
                    <td className="py-2 text-red-500">{fmt(b.totalBalance ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

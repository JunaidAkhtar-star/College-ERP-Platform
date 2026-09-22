'use client';

/**
 * @file FeeOverdueTab.tsx
 * @description Admin tab — list overdue fee records (past due date, not fully paid).
 * @module features/role-wise-features/fee/components
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import CustomTable, { Column } from '@/shared/core/CustomTable';
import useSwr from '@/shared/hooks/useSwr';
import type { IFeeRecord } from '../types/Fee.types';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);

function daysOverdue(due: string): number {
  const diff = Date.now() - new Date(due).getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

export default function FeeOverdueTab() {
  const { data: raw, isLoading, isValidating, error, mutate } = useSwr('fee/overdue');
  const overdue: IFeeRecord[] =
    (raw as { data?: IFeeRecord[] | { data?: IFeeRecord[] } })?.data &&
    Array.isArray((raw as { data?: IFeeRecord[] }).data)
      ? ((raw as { data: IFeeRecord[] }).data as IFeeRecord[])
      : ((raw as { data?: { data?: IFeeRecord[] } })?.data?.data ?? []);

  const totalOutstanding = overdue.reduce((s, r) => s + r.balanceDue, 0);

  const columns: Column<IFeeRecord>[] = [
    { field: 'invoiceNumber', title: 'Invoice #' },
    {
      field: 'studentName',
      title: 'Student',
      render: (r) => (
        <div>
          <p className="text-sm font-medium text-slate-800">{r.studentName}</p>
          <p className="text-xs text-slate-600">
            {r.rollNumber} · {r.branch} · Sem {r.semester}
          </p>
        </div>
      ),
    },
    {
      field: 'academicYear',
      title: 'Year',
      render: (r) => <span className="text-xs text-slate-500">{r.academicYear}</span>,
    },
    {
      field: 'dueDate',
      title: 'Due Date',
      render: (r) => (
        <span className="text-xs text-slate-700">
          {new Date(r.dueDate).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      field: 'balanceDue',
      title: 'Balance',
      render: (r) => (
        <span className="text-sm font-semibold text-red-500">{fmt(r.balanceDue)}</span>
      ),
    },
    {
      field: 'lateFee',
      title: 'Late Fee',
      render: (r) => (
        <span className="text-xs text-slate-600">{r.lateFee ? fmt(r.lateFee) : '—'}</span>
      ),
    },
    {
      field: 'daysOverdue',
      title: 'Days Overdue',
      render: (r) => {
        const days = daysOverdue(r.dueDate);
        const tone = days > 60 ? 'text-red-600' : days > 30 ? 'text-amber-600' : 'text-slate-600';
        return <span className={`text-sm font-semibold ${tone}`}>{days}d</span>;
      },
    },
  ];

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          Overdue fee records could not be loaded. Totals are unavailable until the request
          succeeds.
        </div>
      )}
      {!error && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-3 rounded-xl bg-red-50 p-4"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-500">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-bold text-slate-900">
              {overdue.length} overdue · {fmt(totalOutstanding)} outstanding
            </p>
            <p className="text-xs text-slate-500">Records past their due date that remain unpaid</p>
          </div>
        </motion.div>
      )}

      <div className="rounded-2xl bg-white overflow-hidden">
        <CustomTable
          title="Overdue Payments"
          description="View and manage all student fee records that are past their due date."
          onRefresh={mutate}
          isRefreshing={isValidating}
          isValidating={isValidating}
          data={error ? [] : overdue}
          columns={columns}
          isLoading={isLoading}
          options={{ pagination: true, search: true, pageSize: 15 }}
          localization={{ toolbar: { searchPlaceholder: 'Search overdue…' } }}
        />
      </div>
    </div>
  );
}

/**
 * @file AccountDetailDrawer.tsx
 * @description Slide-over detail panel for a single accounts transaction.
 *              Fetches GET /accounts/:id — shows all fields from the model.
 * @module features/role-wise-features/accounts/components
 */

'use client';

import React from 'react';
import {
  X,
  TrendingUp,
  TrendingDown,
  Calendar,
  Landmark,
  Tag,
  Hash,
  Building2,
  FileText,
  User,
} from 'lucide-react';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import useSwr from '@/shared/hooks/useSwr';
import type { IAccountTransaction, IDeptRef } from '../types/accounts.types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// ── Detail row ────────────────────────────────────────────────────────────────

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-600">{label}</p>
        <div className="mt-0.5 text-sm font-medium text-slate-800 wrap-break-word">{value}</div>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function DrawerSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-24 rounded-2xl bg-slate-100" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-3 py-3">
          <div className="h-7 w-7 rounded-lg bg-slate-100" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-16 rounded bg-slate-100" />
            <div className="h-4 w-36 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface IProps {
  id: string | null;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AccountDetailDrawer({ id, onClose }: IProps) {
  const { data: raw, isLoading, error } = useSwr(id ? `accounts/${id}` : null);
  const rawRecord = (raw as { data?: unknown })?.data ?? raw;
  const tx = (
    rawRecord && typeof rawRecord === 'object' && 'data' in rawRecord
      ? (rawRecord as { data: IAccountTransaction }).data
      : rawRecord
  ) as IAccountTransaction | undefined;

  const isIncome = tx?.transactionType === 'income';
  const dept = tx?.departmentId as IDeptRef | undefined;

  return (
    <AnimatePresence>
      {id && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-200/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 z-50 flex h-dvh w-full max-w-md flex-col bg-white"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">Transaction Details</p>
                <p className="text-xs text-slate-600 font-mono mt-0.5">{id}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {error ? (
                <div
                  role="alert"
                  className="m-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  Transaction details could not be loaded. Close this panel and try again.
                </div>
              ) : isLoading || !tx ? (
                <DrawerSkeleton />
              ) : (
                <>
                  {/* Hero amount block */}
                  <div className={`px-6 py-6 ${isIncome ? 'bg-secondary-50' : 'bg-red-50'}`}>
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                        isIncome ? 'bg-secondary text-white' : 'bg-red-500 text-white'
                      }`}
                    >
                      {isIncome ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" />
                      )}
                      {isIncome ? 'Income' : 'Expense'}
                    </div>
                    <p
                      className={`mt-3 text-3xl font-bold ${isIncome ? 'text-secondary' : 'text-red-500'}`}
                    >
                      {isIncome ? '+' : '−'} {fmt(tx.amount)}
                    </p>
                    <p className="mt-1 text-sm text-slate-600 font-medium">{tx.description}</p>
                    <p className="text-xs text-slate-600">{fmtDate(tx.date)}</p>
                  </div>

                  {/* Detail rows */}
                  <div className="px-5">
                    <Row
                      icon={<Tag className="h-3.5 w-3.5" />}
                      label="Category"
                      value={
                        <span className="inline-flex items-center gap-1">
                          {tx.category}
                          {tx.subCategory && (
                            <span className="text-slate-600"> / {tx.subCategory}</span>
                          )}
                        </span>
                      }
                    />
                    <Row
                      icon={<Landmark className="h-3.5 w-3.5" />}
                      label="Payment Mode"
                      value={<span className="capitalize">{tx.paymentMode.replace('_', ' ')}</span>}
                    />
                    {tx.referenceNo && (
                      <Row
                        icon={<Hash className="h-3.5 w-3.5" />}
                        label="Reference No."
                        value={<span className="font-mono">{tx.referenceNo}</span>}
                      />
                    )}
                    <Row
                      icon={<Calendar className="h-3.5 w-3.5" />}
                      label="Financial Year"
                      value={tx.financialYear}
                    />
                    {tx.budgetHead && (
                      <Row
                        icon={<FileText className="h-3.5 w-3.5" />}
                        label="Budget Head"
                        value={tx.budgetHead}
                      />
                    )}
                    {dept && (
                      <Row
                        icon={<Building2 className="h-3.5 w-3.5" />}
                        label="Department"
                        value={`${dept.name} (${dept.code})`}
                      />
                    )}
                    <Row
                      icon={<User className="h-3.5 w-3.5" />}
                      label="Recorded By"
                      value={typeof tx.createdBy === 'string' ? tx.createdBy : '—'}
                    />
                    <Row
                      icon={<Calendar className="h-3.5 w-3.5" />}
                      label="Created At"
                      value={new Date(tx.createdAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    />
                    {tx.updatedAt !== tx.createdAt && (
                      <Row
                        icon={<Calendar className="h-3.5 w-3.5" />}
                        label="Last Updated"
                        value={new Date(tx.updatedAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      />
                    )}
                    {tx.receiptUrl && (
                      <Row
                        icon={<FileText className="h-3.5 w-3.5" />}
                        label="Receipt"
                        value={
                          <a
                            href={tx.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline underline-offset-2"
                          >
                            View Receipt
                          </a>
                        }
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * @file AnalyticsTab.tsx
 * @description Category-wise summary + 12-month income/expense flow chart.
 * @module features/role-wise-features/accounts/components
 */
'use client';

import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import useSwr from '@/shared/hooks/useSwr';
import type { ISummaryItem, IMonthlyFlowItem } from '../types/accounts.types';

interface Props {
  financialYear: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export default function AnalyticsTab({ financialYear }: Props) {
  const {
    data: sumRaw,
    error: sumError,
    isLoading: sumLoading,
  } = useSwr(`accounts/summary?financialYear=${financialYear}`);
  const {
    data: flowRaw,
    error: flowError,
    isLoading: flowLoading,
  } = useSwr(`accounts/monthly-flow?financialYear=${financialYear}`);

  const summary: ISummaryItem[] = useMemo(
    () => (sumRaw as { data?: ISummaryItem[] })?.data ?? [],
    [sumRaw],
  );
  const flow: IMonthlyFlowItem[] = useMemo(
    () => (flowRaw as { data?: IMonthlyFlowItem[] })?.data ?? [],
    [flowRaw],
  );

  const { incomeRows, expenseRows } = useMemo(() => {
    const inc = summary.filter((s) => s._id.type === 'income');
    const exp = summary.filter((s) => s._id.type === 'expense');
    return {
      incomeRows: inc.sort((a, b) => b.total - a.total),
      expenseRows: exp.sort((a, b) => b.total - a.total),
    };
  }, [summary]);

  const monthly = useMemo(() => {
    const map = new Map<string, { income: number; expense: number; year: number; month: number }>();
    flow.forEach((f) => {
      const key = `${f._id.year}-${f._id.month}`;
      const slot = map.get(key) ?? { income: 0, expense: 0, year: f._id.year, month: f._id.month };
      if (f._id.type === 'income') slot.income = f.total;
      else slot.expense = f.total;
      map.set(key, slot);
    });
    return Array.from(map.values()).sort((a, b) =>
      a.year === b.year ? a.month - b.month : a.year - b.year,
    );
  }, [flow]);

  const maxFlow = Math.max(1, ...monthly.flatMap((m) => [m.income, m.expense]));
  const totalIncome = incomeRows.reduce((a, r) => a + r.total, 0);
  const totalExpense = expenseRows.reduce((a, r) => a + r.total, 0);

  return (
    <div className="space-y-6">
      {(sumError || flowError) && (
        <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          Financial analytics could not be loaded. Totals and trends are not estimated.
        </div>
      )}
      {/* Monthly flow chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl bg-white p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Monthly Flow</h3>
            <p className="text-xs text-slate-500">Income vs expense by month for {financialYear}</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-secondary">
              <span className="h-2 w-2 rounded-full bg-secondary" /> Income
            </span>
            <span className="flex items-center gap-1.5 text-red-500">
              <span className="h-2 w-2 rounded-full bg-red-500" /> Expense
            </span>
          </div>
        </div>
        {flowLoading ? (
          <div className="h-44 animate-pulse rounded-lg bg-slate-100" />
        ) : flowError ? (
          <p className="py-10 text-center text-sm text-rose-600">Monthly flow unavailable.</p>
        ) : monthly.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-600">
            No transactions in this period.
          </p>
        ) : (
          <div className="flex items-end gap-3 overflow-x-auto pb-2">
            {monthly.map((m) => (
              <div key={`${m.year}-${m.month}`} className="flex min-w-12 flex-col items-center">
                <div className="flex h-40 items-end gap-1">
                  <div
                    className="w-3 rounded-t bg-secondary"
                    style={{ height: `${(m.income / maxFlow) * 100}%` }}
                    title={`Income: ${fmt(m.income)}`}
                  />
                  <div
                    className="w-3 rounded-t bg-red-400"
                    style={{ height: `${(m.expense / maxFlow) * 100}%` }}
                    title={`Expense: ${fmt(m.expense)}`}
                  />
                </div>
                <span className="mt-1.5 text-xs text-slate-500">{MONTH_LABELS[m.month - 1]}</span>
                <span className="text-[10px] text-slate-600">{String(m.year).slice(2)}</span>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Category summaries */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="rounded-2xl bg-white p-5"
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary-50 text-secondary">
              <TrendingUp className="h-4 w-4" />
            </span>
            <div>
              <h4 className="text-sm font-semibold text-slate-800">Income by Category</h4>
              <p className="text-xs text-slate-600">
                Total {sumError ? 'unavailable' : fmt(totalIncome)}
              </p>
            </div>
          </div>
          {sumLoading ? (
            <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
          ) : sumError ? (
            <p className="py-6 text-center text-sm text-rose-600">Income summary unavailable.</p>
          ) : incomeRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-600">No income recorded.</p>
          ) : (
            <ul className="space-y-2.5">
              {incomeRows.map((r) => {
                const pct = totalIncome ? (r.total / totalIncome) * 100 : 0;
                return (
                  <li key={r._id.category}>
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-700">{r._id.category}</span>
                      <span className="text-slate-500">
                        {fmt(r.total)} · {r.count} txn
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-secondary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="rounded-2xl bg-white p-5"
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500">
              <TrendingDown className="h-4 w-4" />
            </span>
            <div>
              <h4 className="text-sm font-semibold text-slate-800">Expense by Category</h4>
              <p className="text-xs text-slate-600">
                Total {sumError ? 'unavailable' : fmt(totalExpense)}
              </p>
            </div>
          </div>
          {sumLoading ? (
            <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
          ) : sumError ? (
            <p className="py-6 text-center text-sm text-rose-600">Expense summary unavailable.</p>
          ) : expenseRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-600">No expense recorded.</p>
          ) : (
            <ul className="space-y-2.5">
              {expenseRows.map((r) => {
                const pct = totalExpense ? (r.total / totalExpense) * 100 : 0;
                return (
                  <li key={r._id.category}>
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-700">{r._id.category}</span>
                      <span className="text-slate-500">
                        {fmt(r.total)} · {r.count} txn
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-red-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </motion.div>
      </div>
    </div>
  );
}

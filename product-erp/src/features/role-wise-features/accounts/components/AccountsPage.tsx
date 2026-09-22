/**
 * @file AccountsPage.tsx
 * @description Institutional Accounts — list, filter by financial year
 *              and transaction type, live balance stats, full CRUD with detail.
 * @module features/role-wise-features/accounts/components
 */

'use client';

import React, { useState } from 'react';
import UseProtectedRoutes from '@/shared/hooks/UseProtectedRoutes';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import {
  Landmark,
  TrendingUp,
  TrendingDown,
  Wallet,
  Plus,
  Eye,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import CustomButton from '@/shared/core/CustomButton';
import AsyncSelect from '@/shared/core/AsyncSelect';
import Empty from '@/shared/core/Empty';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import type {
  IAccountTransaction,
  IAccountListResponse,
  IBalanceResponse,
  ICreateTransactionDto,
} from '../types/accounts.types';
import AccountModal from './AccountModal';
import AccountDetailDrawer from './AccountDetailDrawer';
import PaymentSubmissionsTab from './PaymentSubmissionsTab';
import AnalyticsTab from './AnalyticsTab';
import FinanceControlsTab from './FinanceControlsTab';
import FinanceWorkflowBar from '@/shared/components/FinanceWorkflowBar';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { useAuthStore } from '@/shared/store/authStore';

type TAccountsTab = 'transactions' | 'submissions' | 'analytics' | 'controls';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

// ── Main component ────────────────────────────────────────────────────────────

function AccountsPage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const canView = useHasPermission('accounts', 'view');
  const canCreate = useHasPermission('accounts', 'create');
  const canEdit = useHasPermission('accounts', 'edit');
  const canApprovePermission = useHasPermission('accounts', 'approve');
  const isPreparerRole = ['super_admin', 'accounts_department'].includes(activeRole ?? '');
  const isApproverRole = ['super_admin', 'principal'].includes(activeRole ?? '');
  const canManage = isPreparerRole && (canCreate || canEdit);
  const canApprove = isApproverRole && canApprovePermission;
  const [tab, setTab] = useState<TAccountsTab>('transactions');
  const [fy, setFy] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<IAccountTransaction | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  // ── Data ───────────────────────────────────────────────────────────────────
  const listParams = [
    `financialYear=${fy}`,
    typeFilter !== 'all' ? `transactionType=${typeFilter}` : '',
  ]
    .filter(Boolean)
    .join('&');

  const {
    data: listRaw,
    isLoading,
    mutate,
  } = useSwr(canView && fy ? `accounts?${listParams}` : null);
  const transactions: IAccountTransaction[] = (listRaw as IAccountListResponse)?.data ?? [];
  const totalCount = (listRaw as IAccountListResponse)?.total ?? 0;

  const { data: balRaw } = useSwr(canView && fy ? `accounts/balance?financialYear=${fy}` : null);
  const balance = (balRaw as IBalanceResponse)?.data ?? {
    income: 0,
    expense: 0,
    balance: 0,
  };

  const { mutation, isLoading: saving } = useMutation();

  // ── Governed reversal ───────────────────────────────────────────────────────
  const handleReverse = async (row: IAccountTransaction) => {
    const result = await Swal.fire({
      title: 'Reverse this transaction?',
      text: 'The original entry remains in the audit trail and a balancing reversal is posted.',
      icon: 'warning',
      input: 'textarea',
      inputLabel: 'Reversal reason',
      inputValidator: (value) =>
        value.trim().length < 5 ? 'Enter a reason containing at least 5 characters' : undefined,
      showCancelButton: true,
      confirmButtonText: 'Post reversal',
      confirmButtonColor: '#0178D7',
    });
    if (!result.isConfirmed) return;
    const res = await mutation(`accounts/${row._id}/reverse`, {
      method: 'POST',
      body: { reason: result.value.trim() },
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Reversal posted');
      mutate();
    } else {
      toast.error('Reversal failed');
    }
  };

  // ── Save (create / update) ─────────────────────────────────────────────────
  const handleSave = async (values: ICreateTransactionDto) => {
    const path = editing ? `accounts/${editing._id}` : 'accounts';
    const method = editing ? 'PUT' : 'POST';
    const res = await mutation(path, { method, body: values });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success(editing ? 'Transaction updated' : 'Transaction recorded');
      mutate();
      setModalOpen(false);
      setEditing(null);
    } else {
      toast.error('Operation failed');
    }
  };

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: Column<IAccountTransaction>[] = [
    {
      field: 'date',
      title: 'Date',
      render: (row) => (
        <span className="whitespace-nowrap text-sm text-slate-700">
          {new Date(row.date).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      field: 'description',
      title: 'Description',
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-slate-800">{row.description}</p>
          {row.subCategory && <p className="text-xs text-slate-600">{row.subCategory}</p>}
        </div>
      ),
    },
    {
      field: 'category',
      title: 'Category',
      render: (row) => (
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          {row.category}
        </span>
      ),
    },
    {
      field: 'transactionType',
      title: 'Type',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            row.transactionType === 'income'
              ? 'bg-secondary-50 text-secondary'
              : 'bg-red-50 text-red-500'
          }`}
        >
          {row.transactionType === 'income' ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {row.transactionType === 'income' ? 'Income' : 'Expense'}
        </span>
      ),
    },
    {
      field: 'amount',
      title: 'Amount',
      render: (row) => (
        <span
          className={`text-sm font-semibold ${
            row.transactionType === 'income' ? 'text-secondary' : 'text-red-500'
          }`}
        >
          {row.transactionType === 'income' ? '+' : '−'} {fmt(row.amount)}
        </span>
      ),
    },
    {
      field: 'paymentMode',
      title: 'Mode',
      render: (row) => (
        <span className="text-xs capitalize text-slate-500">
          {row.paymentMode.replace('_', ' ')}
        </span>
      ),
    },
    {
      field: 'referenceNo',
      title: 'Ref. No.',
      render: (row) => (
        <span className="font-mono text-xs text-slate-500">{row.referenceNo ?? '—'}</span>
      ),
    },
  ];

  const actions: Action<IAccountTransaction>[] = [
    {
      tooltip: 'View Details',
      icon: <Eye className="h-4 w-4 text-primary" />,
      onClick: (row) => setDetailId(row._id),
    },
    ...(canManage
      ? [
          {
            tooltip: 'Edit draft details',
            icon: <Pencil className="h-4 w-4" />,
            onClick: (row: IAccountTransaction) => {
              setEditing(row);
              setModalOpen(true);
            },
          },
          {
            tooltip: 'Reverse transaction',
            icon: <RotateCcw className="h-4 w-4 text-amber-500" />,
            onClick: handleReverse,
          },
        ]
      : []),
  ];

  if (!canView) {
    return (
      <Empty
        title="Accounts access unavailable"
        subTitle="Your active role does not have permission to view the institutional ledger."
      />
    );
  }

  return (
    <div className="space-y-5">
      <FinanceWorkflowBar />
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Accounts</h1>
          <p className="mt-1 text-sm text-slate-500">
            Institutional financial transactions and ledger
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="min-w-48">
            <AsyncSelect
              type="academicYears"
              value={fy || null}
              onChange={(value) => setFy(value ?? '')}
              placeholder="Select financial year"
              emptyMessage="No configured financial years are available."
            />
          </div>
          {tab === 'transactions' && canManage && (
            <CustomButton
              startIcon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="w-fit!"
            >
              Add Transaction
            </CustomButton>
          )}
        </div>
      </motion.div>

      {/* ── Tab nav ─────────────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto rounded-xl bg-white p-1">
        {(
          [
            { k: 'transactions', l: 'Ledger' },
            { k: 'submissions', l: 'Payment Submissions' },
            { k: 'analytics', l: 'Analytics' },
            { k: 'controls', l: 'Finance Controls' },
          ] as { k: TAccountsTab; l: string }[]
        ).map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => setTab(t.k)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.k ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'submissions' && <PaymentSubmissionsTab canManage={canManage} />}
      {tab === 'analytics' && <AnalyticsTab financialYear={fy} />}
      {tab === 'controls' && (
        <FinanceControlsTab financialYear={fy} canPrepare={canManage} canApprove={canApprove} />
      )}

      {tab === 'transactions' && (
        <>
          {/* ── Stats cards ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              {
                label: 'Total Income',
                value: fmt(balance.income),
                icon: <TrendingUp className="h-5 w-5" />,
                bg: 'bg-secondary-50',
                text: 'text-secondary',
              },
              {
                label: 'Total Expense',
                value: fmt(balance.expense),
                icon: <TrendingDown className="h-5 w-5" />,
                bg: 'bg-red-50',
                text: 'text-red-500',
              },
              {
                label: 'Net Balance',
                value: fmt(balance.balance),
                icon: <Wallet className="h-5 w-5" />,
                bg: balance.balance >= 0 ? 'bg-primary-50' : 'bg-red-50',
                text: balance.balance >= 0 ? 'text-primary' : 'text-red-500',
              },
              {
                label: 'Transactions',
                value: isLoading ? '—' : totalCount,
                icon: <Landmark className="h-5 w-5" />,
                bg: 'bg-slate-100',
                text: 'text-slate-600',
              },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.07 }}
                className="rounded-2xl bg-white p-5"
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.bg}`}>
                  <span className={s.text}>{s.icon}</span>
                </div>
                <p className="mt-4 text-xl font-bold text-slate-900">{s.value}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {s.label} · {fy}
                </p>
              </motion.div>
            ))}
          </div>

          {/* ── Type filter pills ────────────────────────────────────────────── */}
          <div className="flex gap-2">
            {(['all', 'income', 'expense'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  typeFilter === t
                    ? 'bg-primary text-white'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {t === 'all'
                  ? 'All Transactions'
                  : t === 'income'
                    ? 'Income Only'
                    : 'Expenses Only'}
              </button>
            ))}
          </div>

          {/* ── Table ───────────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="rounded-2xl bg-white overflow-hidden"
          >
            <CustomTable
              data={transactions}
              columns={columns}
              actions={actions}
              isLoading={isLoading}
              options={{ search: true, pagination: true, pageSize: 15 }}
              localization={{ toolbar: { searchPlaceholder: 'Search transactions…' } }}
            />
          </motion.div>
        </>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <AccountModal
        open={modalOpen}
        editing={editing}
        saving={saving}
        defaultFy={fy}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
      />

      <AccountDetailDrawer id={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

export default UseProtectedRoutes(AccountsPage, [
  'super_admin',
  'admin',
  'principal',
  'accounts_department',
  'administration_office',
]);

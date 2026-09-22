/**
 * @file DonationsTab.tsx
 * @description Alumni donations — list, stats, record new, confirm pending (admin).
 * @module features/role-wise-features/alumni
 */
'use client';
import React, { useState, useMemo } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { HandCoins, CheckCircle, Plus, X, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import CustomButton from '@/shared/core/CustomButton';
import AsyncSelect from '@/shared/core/AsyncSelect';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useAuthStore } from '@/shared/store/authStore';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import type { IDonation, IDonationStat } from '../types/alumni.types';

const STATUS_CFG: Record<string, { cls: string; label: string }> = {
  pending: { cls: 'bg-amber-50 text-amber-700', label: 'Pending' },
  confirmed: { cls: 'bg-secondary-50 text-secondary', label: 'Confirmed' },
  failed: { cls: 'bg-red-50 text-red-600', label: 'Failed' },
};

const METHODS: IDonation['paymentMethod'][] = ['online', 'cheque', 'dd', 'cash'];
const PURPOSES = ['General', 'Infrastructure', 'Scholarship', 'Sports', 'Library', 'Research'];

const fmtMoney = (v: number, c = 'INR') =>
  `${c === 'INR' ? '₹' : c} ${(v ?? 0).toLocaleString('en-IN')}`;

const fmtDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

export default function DonationsTab() {
  const userId = useAuthStore((state) => state.user?._id ?? '');
  const canCreate = useHasPermission('alumni', 'create');
  const canApprove = useHasPermission('alumni', 'approve');

  const [status, setStatus] = useState<'' | IDonation['status']>('');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);

  const url = useMemo(() => {
    const q = new URLSearchParams();
    q.set('page', String(page));
    q.set('limit', '15');
    if (status) q.set('status', status);
    return `alumni/donations?${q.toString()}`;
  }, [page, status]);

  const { data: raw, error, isLoading, mutate } = useSwr(url);
  const records: IDonation[] = (raw as { data?: IDonation[] })?.data ?? [];
  const total = (raw as { total?: number })?.total ?? records.length;

  const { data: statsRaw, error: statsError } = useSwr('alumni/donations/stats');
  const stats: IDonationStat[] = (statsRaw as { data?: IDonationStat[] })?.data ?? [];

  const totalConfirmed = stats.reduce((s, x) => s + x.total, 0);
  const totalCount = stats.reduce((s, x) => s + x.count, 0);

  const { mutation } = useMutation();

  const handleConfirm = async (row: IDonation) => {
    const ok = await Swal.fire({
      title: 'Confirm Donation?',
      text: `Mark ${fmtMoney(row.amount, row.currency)} donation as confirmed?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirm',
      confirmButtonColor: '#0178D7',
    });
    if (!ok.isConfirmed) return;
    const res = await mutation(`alumni/donations/${row._id}/confirm`, { method: 'PUT' });
    if (res?.results?.success) {
      toast.success('Donation confirmed');
      mutate();
    }
  };
  const handleReject = async (row: IDonation) => {
    const result = await Swal.fire({
      title: 'Reject donation record?',
      text: 'The record remains auditable and will not be posted to the ledger.',
      input: 'textarea',
      inputPlaceholder: 'Reason for rejection',
      inputValidator: (value) =>
        value.trim().length < 5 ? 'Enter a meaningful reason' : undefined,
      showCancelButton: true,
      confirmButtonText: 'Reject record',
      confirmButtonColor: '#dc2626',
    });
    if (!result.isConfirmed) return;
    const response = await mutation(`alumni/donations/${row._id}/fail`, {
      method: 'PUT',
      body: { reason: result.value },
    });
    if (!response?.results?.success) return;
    toast.success('Donation record rejected');
    mutate();
  };

  const columns: Column<IDonation>[] = [
    {
      field: 'alumniId',
      title: 'Alumni',
      render: (r) =>
        typeof r.alumniId === 'object' ? (
          <div>
            <p className="text-sm font-medium text-slate-800">{r.alumniId.fullName ?? '—'}</p>
            <p className="text-xs text-slate-600">{r.alumniId.email}</p>
          </div>
        ) : (
          <span className="text-xs text-slate-600">{r.alumniId}</span>
        ),
    },
    {
      field: 'amount',
      title: 'Amount',
      render: (r) => (
        <span className="text-sm font-semibold text-slate-800">
          {fmtMoney(r.amount, r.currency)}
        </span>
      ),
    },
    {
      field: 'purpose',
      title: 'Purpose',
      render: (r) => <span className="text-sm text-slate-600">{r.purpose}</span>,
    },
    {
      field: 'paymentMethod',
      title: 'Method',
      render: (r) => (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 capitalize">
          {r.paymentMethod}
        </span>
      ),
    },
    {
      field: 'transactionId',
      title: 'Txn Id',
      render: (r) => (
        <span className="font-mono text-xs text-slate-500">{r.transactionId ?? '—'}</span>
      ),
    },
    {
      field: 'donatedAt',
      title: 'Date',
      render: (r) => <span className="text-xs text-slate-500">{fmtDate(r.donatedAt)}</span>,
    },
    {
      field: 'status',
      title: 'Status',
      render: (r) => (
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CFG[r.status]?.cls ?? 'bg-slate-100'}`}
        >
          {STATUS_CFG[r.status]?.label ?? r.status}
        </span>
      ),
    },
    {
      field: 'receiptNumber',
      title: 'Receipt',
      render: (row) => (
        <span className="text-xs font-semibold text-slate-600">
          {row.receiptNumber ?? (row.status === 'pending' ? 'After confirmation' : '—')}
        </span>
      ),
    },
  ];

  const actions: Action<IDonation>[] = [
    {
      tooltip: 'Confirm',
      icon: <CheckCircle className="h-4 w-4 text-green-500" />,
      onClick: handleConfirm,
      hidden: (r) => !canApprove || r.status !== 'pending' || r.createdBy === userId,
    },
    {
      tooltip: 'Reject',
      icon: <XCircle className="h-4 w-4 text-red-500" />,
      onClick: handleReject,
      hidden: (r) => !canApprove || r.status !== 'pending',
    },
  ];

  return (
    <div className="space-y-5">
      {(error || statsError) && (
        <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          Contribution data could not be loaded. Refresh and try again; totals are not estimated.
        </div>
      )}
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          {
            label: 'Total Raised',
            value: fmtMoney(totalConfirmed),
            color: 'bg-secondary-50 text-secondary',
          },
          { label: 'Donations', value: totalCount, color: 'bg-primary-50 text-primary' },
          {
            label: 'Pending',
            value: records.filter((r) => r.status === 'pending').length,
            color: 'bg-amber-50 text-amber-600',
          },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06 }}
            className="flex items-center gap-3 rounded-xl bg-white p-4"
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.color}`}
            >
              <HandCoins className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
      >
        <DataViewSwitcher<IDonation>
          data={records}
          isLoading={isLoading}
          storageKey="alumni.donations.view"
          searchPlaceholder="Search donations…"
          searchFields={['purpose', 'paymentMethod', 'transactionId', 'currency', 'status']}
          pageSize={20}
          renderCard={(d) => {
            const alum = typeof d.alumniId === 'object' ? d.alumniId : null;
            const cfg =
              d.status === 'confirmed'
                ? 'bg-green-50 text-green-600'
                : d.status === 'pending'
                  ? 'bg-amber-50 text-amber-600'
                  : d.status === 'failed'
                    ? 'bg-red-50 text-red-500'
                    : 'bg-slate-100 text-slate-500';
            return (
              <motion.div
                whileHover={{ y: -2 }}
                className="flex flex-col gap-3 rounded-2xl bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
                    <HandCoins className="h-5 w-5" />
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${cfg}`}
                  >
                    {d.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {fmtMoney(d.amount, d.currency)}
                  </p>
                  <p className="text-xs text-slate-500 line-clamp-2">{d.purpose}</p>
                </div>
                <div className="space-y-1 text-xs text-slate-500">
                  {alum && (
                    <p>
                      By{' '}
                      <span className="font-medium text-slate-700">
                        {alum.fullName ?? alum.email ?? 'Alumnus'}
                      </span>
                    </p>
                  )}
                  <p className="capitalize">
                    Mode:{' '}
                    <span className="text-slate-700">{d.paymentMethod.replace(/_/g, ' ')}</span>
                  </p>
                  {d.transactionId && (
                    <p className="font-mono text-[11px] text-slate-600 truncate">
                      {d.transactionId}
                    </p>
                  )}
                  {d.donatedAt && (
                    <p className="text-[11px] text-slate-600">
                      {new Date(d.donatedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {canApprove && d.status === 'pending' && d.createdBy !== userId && (
                  <div className="flex items-center justify-end border-t border-slate-100 pt-3 text-xs">
                    <button
                      type="button"
                      onClick={() => handleConfirm(d)}
                      className="inline-flex items-center gap-1 font-medium text-green-600 hover:underline"
                    >
                      <CheckCircle className="h-3 w-3" /> Confirm
                    </button>
                  </div>
                )}
              </motion.div>
            );
          }}
          table={
            <CustomTable
              data={records}
              columns={columns}
              actions={actions}
              isLoading={isLoading}
              title="Contribution register"
              description="Auditable alumni contributions, payment references, receipts and accounting status."
              onRefresh={() => mutate()}
              customActions={
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="contribution-status" className="sr-only">
                    Filter contributions by status
                  </label>
                  <select
                    id="contribution-status"
                    value={status}
                    onChange={(event) => {
                      setStatus(event.target.value as '' | IDonation['status']);
                      setPage(1);
                    }}
                    className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  >
                    <option value="">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="failed">Failed</option>
                  </select>
                  {canCreate && (
                    <CustomButton
                      startIcon={<Plus className="h-4 w-4" />}
                      onClick={() => setShowAdd(true)}
                      className="w-fit!"
                    >
                      Record contribution
                    </CustomButton>
                  )}
                </div>
              }
              page={page}
              totalCount={total}
              pageSize={15}
              onPageChange={setPage}
              options={{ search: false, refresh: true, pagination: true, pageSize: 15 }}
            />
          }
        />
      </motion.div>

      <AnimatePresence>
        {showAdd && (
          <RecordDonationModal
            onClose={() => setShowAdd(false)}
            onSaved={() => {
              setShowAdd(false);
              mutate();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function RecordDonationModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { mutation, isLoading: saving } = useMutation();

  const formik = useFormik({
    initialValues: {
      alumniId: '',
      amount: '',
      currency: 'INR',
      purpose: 'General',
      paymentMethod: 'online' as IDonation['paymentMethod'],
      transactionId: '',
      notes: '',
    },
    validationSchema: Yup.object({
      alumniId: Yup.string().required('Required'),
      amount: Yup.number().positive('Must be > 0').required('Required'),
      currency: Yup.string().oneOf(['INR']).required(),
      purpose: Yup.string().required('Required'),
      paymentMethod: Yup.string().required('Required'),
    }),
    onSubmit: async (values) => {
      const res = await mutation('alumni/donations', {
        method: 'POST',
        body: { ...values, amount: Number(values.amount) },
      });
      if (res?.results?.success) {
        toast.success('Donation recorded');
        onSaved();
      }
    },
  });

  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary focus:bg-white';
  const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 16 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 w-full max-w-lg rounded-2xl bg-white"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-800">Record Donation</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={formik.handleSubmit} className="space-y-4 p-6">
          <div>
            <label className={labelCls}>Alumni *</label>
            <AsyncSelect
              type="alumni"
              required
              value={formik.values.alumniId || null}
              onChange={(value) => formik.setFieldValue('alumniId', value ?? '')}
              placeholder="Search verified alumni by name or roll number"
            />
            {formik.touched.alumniId && formik.errors.alumniId && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.alumniId}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Amount *</label>
              <input
                type="number"
                min={1}
                className={inputCls}
                {...formik.getFieldProps('amount')}
              />
              {formik.touched.amount && formik.errors.amount && (
                <p className="mt-1 text-xs text-red-500">{formik.errors.amount}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <select className={inputCls} {...formik.getFieldProps('currency')} disabled>
                <option value="INR">INR</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Purpose *</label>
              <select className={inputCls} {...formik.getFieldProps('purpose')}>
                {PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Payment Method *</label>
              <select className={inputCls} {...formik.getFieldProps('paymentMethod')}>
                {METHODS.map((m) => (
                  <option key={m} value={m} className="capitalize">
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Transaction ID</label>
            <input
              className={inputCls}
              placeholder="UTR / Cheque No. / Receipt"
              {...formik.getFieldProps('transactionId')}
            />
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              rows={2}
              className={inputCls}
              placeholder="Optional notes"
              {...formik.getFieldProps('notes')}
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <CustomButton variant="cancel" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton type="submit" loading={saving} loadingText="Saving…">
              Save Donation
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

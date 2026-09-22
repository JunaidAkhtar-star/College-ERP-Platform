/**
 * @file PaymentSubmissionsTab.tsx
 * @description Accounts verification queue for student-uploaded fee payment proofs.
 *              Lists submissions, supports filter by status, mark-under-review, approve, reject.
 * @module features/role-wise-features/accounts/components
 */
'use client';

import React, { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { Eye, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import CustomButton from '@/shared/core/CustomButton';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import type { IPaymentSubmission, TSubmissionStatus } from '../types/accounts.types';

const STATUS_CFG: Record<TSubmissionStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-600' },
  under_review: { label: 'Under Review', cls: 'bg-primary-50 text-primary' },
  approved: { label: 'Approved', cls: 'bg-secondary-50 text-secondary' },
  rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-500' },
  resubmit_required: { label: 'Resubmit', cls: 'bg-orange-50 text-orange-500' },
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function isSuccessResponse(res: unknown) {
  return (
    (res as { results?: { success?: boolean } } | undefined)?.results?.success === true ||
    (res as { data?: { success?: boolean } } | undefined)?.data?.success === true
  );
}

function responseMessage(res: unknown) {
  return (
    (res as { results?: { message?: string } } | undefined)?.results?.message ||
    (res as { data?: { message?: string } } | undefined)?.data?.message
  );
}

interface ICounts {
  pending?: number;
  under_review?: number;
  approved?: number;
  rejected?: number;
}

export default function PaymentSubmissionsTab({ canManage }: { canManage: boolean }) {
  const [statusFilter, setStatusFilter] = useState<TSubmissionStatus | 'all'>('pending');
  const [viewing, setViewing] = useState<IPaymentSubmission | null>(null);

  const url =
    statusFilter === 'all'
      ? 'accounts/payment-submissions'
      : `accounts/payment-submissions?status=${statusFilter}`;

  const { data: raw, isLoading, mutate } = useSwr(url);
  const { data: countsRaw } = useSwr('accounts/payment-submissions/counts');
  const extractArray = <T,>(rData: unknown): T[] => {
    if (!rData || typeof rData !== 'object') return [];
    const r = rData as Record<string, unknown>;
    if (Array.isArray(r.data)) return r.data as T[];
    if (
      r.data &&
      typeof r.data === 'object' &&
      Array.isArray((r.data as Record<string, unknown>).data)
    ) {
      return (r.data as Record<string, unknown>).data as T[];
    }
    if (Array.isArray(r.results)) return r.results as T[];
    return [];
  };

  const submissions: IPaymentSubmission[] = useMemo(
    () => extractArray<IPaymentSubmission>(raw),
    [raw],
  );
  const counts: ICounts = (countsRaw as { data?: ICounts })?.data ?? (countsRaw as ICounts) ?? {};

  const { mutation, isLoading: processing } = useMutation();

  const handleMarkReview = async (row: IPaymentSubmission) => {
    const res = await mutation(`accounts/payment-submissions/${row._id}/review`, {
      method: 'PUT',
      body: {},
    });
    if ((res as { data?: { success?: boolean } })?.data?.success) {
      toast.success('Marked under review');
      mutate();
    } else {
      toast.error('Action failed');
    }
  };

  const handleApprove = async (row: IPaymentSubmission) => {
    const result = await Swal.fire<{
      officialInvoiceNumber?: string;
      officialReceiptNumber?: string;
      approvalReferenceNo?: string;
      ddNumber?: string;
      chequeNumber?: string;
      remarks?: string;
      receipt?: File;
    }>({
      title: 'Approve Payment?',
      html: `
        <div class="space-y-3 text-left">
          <p class="text-sm">Approving <b>${row.studentName}</b> (${row.rollNumber}) for <b>${fmt(row.amountSubmitted)}</b>.</p>
          <p class="text-xs text-slate-500">This records the payment in the student's fee record. Accounts ledger posting remains manual.</p>
          <input id="officialInvoiceNumber" class="swal2-input" placeholder="Official invoice no. (optional)" />
          <input id="officialReceiptNumber" class="swal2-input" placeholder="Official receipt no. (optional)" />
          <input id="approvalReferenceNo" class="swal2-input" placeholder="Bank / office reference no. (optional)" />
          <input id="ddNumber" class="swal2-input" placeholder="DD number (optional)" />
          <input id="chequeNumber" class="swal2-input" placeholder="Cheque number (optional)" />
          <textarea id="remarks" class="swal2-textarea" placeholder="Approval remarks (optional)"></textarea>
          <label class="block text-xs font-medium text-slate-500">Official receipt upload (optional)</label>
          <input id="receipt" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp,image/tiff,image/heic,image/heif" class="swal2-file" />
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Approve',
      confirmButtonColor: '#0178D7',
      preConfirm: () => {
        const popup = Swal.getPopup();
        const field = (id: string) =>
          (
            popup?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)?.value ?? ''
          ).trim();
        const receipt = popup?.querySelector<HTMLInputElement>('#receipt')?.files?.[0];
        return {
          officialInvoiceNumber: field('officialInvoiceNumber') || undefined,
          officialReceiptNumber: field('officialReceiptNumber') || undefined,
          approvalReferenceNo: field('approvalReferenceNo') || undefined,
          ddNumber: field('ddNumber') || undefined,
          chequeNumber: field('chequeNumber') || undefined,
          remarks: field('remarks') || undefined,
          receipt,
        };
      },
    });
    if (!result.isConfirmed) return;
    const body = new FormData();
    Object.entries(result.value ?? {}).forEach(([key, value]) => {
      if (!value) return;
      if (key === 'receipt' && value instanceof File) body.append('receipt', value);
      else if (typeof value === 'string') body.append(key, value);
    });
    const res = await mutation(`accounts/payment-submissions/${row._id}/approve`, {
      method: 'PUT',
      body,
      isFormData: true,
    });
    if (isSuccessResponse(res)) {
      toast.success('Payment approved');
      mutate();
      setViewing(null);
    } else {
      toast.error(responseMessage(res) ?? 'Approval failed');
    }
  };

  const handleReject = async (row: IPaymentSubmission) => {
    const result = await Swal.fire({
      title: 'Reject Submission?',
      input: 'textarea',
      inputLabel: 'Rejection reason',
      inputPlaceholder: 'Explain why this is being rejected…',
      inputValidator: (v) => (!v ? 'Reason is required' : null),
      showCancelButton: true,
      confirmButtonText: 'Reject',
      confirmButtonColor: '#dc2626',
    });
    if (!result.isConfirmed) return;
    const res = await mutation(`accounts/payment-submissions/${row._id}/reject`, {
      method: 'PUT',
      body: { reason: result.value },
    });
    if ((res as { data?: { success?: boolean } })?.data?.success) {
      toast.success('Submission rejected');
      mutate();
      setViewing(null);
    } else {
      toast.error('Rejection failed');
    }
  };

  const columns: Column<IPaymentSubmission>[] = [
    {
      field: 'studentName',
      title: 'Student',
      render: (r) => (
        <div>
          <p className="text-sm font-medium text-slate-800">{r.studentName}</p>
          <p className="text-xs text-slate-600">
            {r.rollNumber} · Sem {r.semester} · {r.branch}
          </p>
        </div>
      ),
    },
    {
      field: 'amountSubmitted',
      title: 'Amount',
      render: (r) => (
        <span className="text-sm font-semibold text-slate-800">{fmt(r.amountSubmitted)}</span>
      ),
    },
    {
      field: 'paymentMode',
      title: 'Mode',
      render: (r) => (
        <span className="text-xs capitalize text-slate-500">{r.paymentMode.replace('_', ' ')}</span>
      ),
    },
    {
      field: 'utrNumber',
      title: 'UTR / Ref',
      render: (r) => <span className="font-mono text-xs text-slate-500">{r.utrNumber ?? '—'}</span>,
    },
    {
      field: 'submittedAt',
      title: 'Submitted',
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-slate-500">
          {new Date(r.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
        </span>
      ),
    },
    {
      field: 'status',
      title: 'Status',
      render: (r) => (
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CFG[r.status].cls}`}
        >
          {STATUS_CFG[r.status].label}
        </span>
      ),
    },
  ];

  const actions: Action<IPaymentSubmission>[] = [
    {
      tooltip: 'View',
      icon: <Eye className="h-4 w-4 text-primary" />,
      onClick: (r) => setViewing(r),
    },
    ...(canManage
      ? [
          {
            tooltip: 'Mark Under Review',
            icon: <Clock className="h-4 w-4 text-primary" />,
            onClick: handleMarkReview,
            hidden: (r: IPaymentSubmission) => r.status !== 'pending',
          },
          {
            tooltip: 'Approve',
            icon: <CheckCircle className="h-4 w-4 text-secondary" />,
            onClick: handleApprove,
            hidden: (r: IPaymentSubmission) => r.status === 'approved' || r.status === 'rejected',
          },
          {
            tooltip: 'Reject',
            icon: <XCircle className="h-4 w-4 text-red-500" />,
            onClick: handleReject,
            hidden: (r: IPaymentSubmission) => r.status === 'approved' || r.status === 'rejected',
          },
        ]
      : []),
  ];

  const statTiles: { key: TSubmissionStatus | 'all'; label: string; value: number; cls: string }[] =
    [
      { key: 'all', label: 'All', value: submissions.length, cls: 'bg-slate-100 text-slate-700' },
      {
        key: 'pending',
        label: 'Pending',
        value: counts.pending ?? 0,
        cls: 'bg-amber-50 text-amber-600',
      },
      {
        key: 'under_review',
        label: 'Under Review',
        value: counts.under_review ?? 0,
        cls: 'bg-primary-50 text-primary',
      },
      {
        key: 'approved',
        label: 'Approved',
        value: counts.approved ?? 0,
        cls: 'bg-secondary-50 text-secondary',
      },
      {
        key: 'rejected',
        label: 'Rejected',
        value: counts.rejected ?? 0,
        cls: 'bg-red-50 text-red-500',
      },
    ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {statTiles.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setStatusFilter(t.key)}
            className={`rounded-xl bg-white p-4 text-left transition-all ${statusFilter === t.key ? 'ring-2 ring-primary' : 'hover:bg-slate-50'}`}
          >
            <span
              className={`inline-flex h-7 items-center rounded-full px-2.5 text-xs font-semibold ${t.cls}`}
            >
              {t.label}
            </span>
            <p className="mt-2 text-xl font-bold text-slate-900">{t.value}</p>
          </button>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl bg-white overflow-hidden"
      >
        <CustomTable
          data={submissions}
          columns={columns}
          actions={actions}
          isLoading={isLoading || processing}
          options={{ search: true, pagination: true, pageSize: 15 }}
          localization={{ toolbar: { searchPlaceholder: 'Search submissions…' } }}
        />
      </motion.div>

      <AnimatePresence>
        {viewing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-200/80 backdrop-blur-sm sm:items-center sm:p-6"
            onClick={() => setViewing(null)}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl rounded-t-3xl bg-white p-6 sm:rounded-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Payment Submission</h3>
                  <p className="text-xs text-slate-500">
                    {viewing.studentName} · {viewing.rollNumber}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CFG[viewing.status].cls}`}
                >
                  {STATUS_CFG[viewing.status].label}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-600">Amount</p>
                  <p className="font-semibold text-slate-800">{fmt(viewing.amountSubmitted)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600">Payment Mode</p>
                  <p className="capitalize text-slate-700">
                    {viewing.paymentMode.replace('_', ' ')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-600">UTR / Reference</p>
                  <p className="font-mono text-slate-700">{viewing.utrNumber ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600">Payment Date</p>
                  <p className="text-slate-700">
                    {new Date(viewing.paymentDate).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-600">Academic Year</p>
                  <p className="text-slate-700">{viewing.academicYear}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600">Semester</p>
                  <p className="text-slate-700">{viewing.semester}</p>
                </div>
                {viewing.reviewRemarks && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-600">Review Remarks</p>
                    <p className="text-slate-700">{viewing.reviewRemarks}</p>
                  </div>
                )}
                {(viewing.officialInvoiceNumber ||
                  viewing.officialReceiptNumber ||
                  viewing.approvalReferenceNo ||
                  viewing.ddNumber ||
                  viewing.chequeNumber) && (
                  <div className="col-span-2 rounded-xl bg-slate-50 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Accounts Approval
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-slate-600">Invoice No.</p>
                        <p className="font-mono text-xs text-slate-700">
                          {viewing.officialInvoiceNumber ?? '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600">Receipt No.</p>
                        <p className="font-mono text-xs text-slate-700">
                          {viewing.officialReceiptNumber ?? '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600">Approval Ref.</p>
                        <p className="font-mono text-xs text-slate-700">
                          {viewing.approvalReferenceNo ?? '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600">DD / Cheque</p>
                        <p className="font-mono text-xs text-slate-700">
                          {viewing.ddNumber ?? viewing.chequeNumber ?? '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {viewing.screenshotUrl && (
                <div className="mt-5">
                  <p className="mb-2 text-xs text-slate-600">Payment Screenshot</p>
                  <a
                    href={viewing.screenshotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Open Proof <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {viewing.officialReceiptUrl && (
                <div className="mt-3">
                  <p className="mb-2 text-xs text-slate-600">Official Receipt</p>
                  <a
                    href={viewing.officialReceiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-secondary-50 px-3 py-1.5 text-xs font-medium text-secondary hover:bg-secondary-100"
                  >
                    Open Receipt <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <CustomButton variant="cancel" onClick={() => setViewing(null)}>
                  Close
                </CustomButton>
                {canManage && viewing.status !== 'approved' && viewing.status !== 'rejected' && (
                  <>
                    <CustomButton
                      onClick={() => handleReject(viewing)}
                      className="bg-red-500! hover:bg-red-600!"
                    >
                      Reject
                    </CustomButton>
                    <CustomButton onClick={() => handleApprove(viewing)} loading={processing}>
                      Approve
                    </CustomButton>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

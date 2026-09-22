/**
 * @file StudentFeeView.tsx
 * @description Student-facing fee view: outstanding records, submit payment proof, view submission status, resubmit.
 *   GET fee/student/:studentId  ·  POST fee/submissions  ·  GET fee/submissions/my  ·  PUT fee/submissions/:id/resubmit
 * @module features/role-wise-features/fee
 */
'use client';

import React, { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import { Receipt, Upload, Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useAuthStore } from '@/shared/store/authStore';

interface IFeeRecord {
  _id: string;
  invoiceNumber: string;
  program: string;
  branch: string;
  semester: number;
  academicYear: string;
  netDue: number;
  totalPaid: number;
  balanceDue: number;
  status: string;
  dueDate: string;
}

interface ISubmission {
  _id: string;
  feeRecordId: string;
  amountSubmitted: number;
  paymentMode: string;
  paymentDate: string;
  utrNumber?: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'resubmit_required';
  reviewRemarks?: string;
  submittedAt: string;
  screenshotUrl?: string;
  officialReceiptUrl?: string;
}

interface IBankAccount {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  branchName?: string;
  accountType: 'savings' | 'current';
}

interface IPaymentSettings {
  institutionName: string;
  qrCodeUrl?: string;
  upiId?: string;
  upiName?: string;
  bankAccounts: IBankAccount[];
  paymentInstructions?: string;
  acceptedModes: string[];
  requireScreenshot: boolean;
  requireUtrNumber: boolean;
  maxVerificationDays: number;
}

const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: 'Cash',
  dd: 'Demand Draft',
  neft: 'NEFT',
  rtgs: 'RTGS',
  upi: 'UPI',
  imps: 'IMPS',
  net_banking: 'Net Banking',
  netbanking: 'Net Banking',
  card: 'Card',
  cheque: 'Cheque',
  online_portal: 'Online Portal',
};

const DEFAULT_PAYMENT_MODES = ['upi', 'neft', 'rtgs', 'net_banking', 'card', 'online_portal'];
const PARENT_PAYMENT_MODES = new Set([
  'upi',
  'neft',
  'rtgs',
  'imps',
  'net_banking',
  'card',
  'online_portal',
]);

const SUB_STATUS = {
  pending: { label: 'Pending Review', bg: 'bg-amber-50', text: 'text-amber-600' },
  under_review: { label: 'Under Review', bg: 'bg-blue-50', text: 'text-blue-600' },
  approved: { label: 'Approved', bg: 'bg-green-50', text: 'text-green-600' },
  rejected: { label: 'Rejected', bg: 'bg-red-50', text: 'text-red-500' },
  resubmit_required: {
    label: 'Resubmit Required',
    bg: 'bg-orange-50',
    text: 'text-orange-600',
  },
} as const;

const inputCls =
  'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function SubmitModal({
  record,
  settings,
  resubmitOf,
  onClose,
  onSaved,
  isParent,
}: {
  record: IFeeRecord;
  settings?: IPaymentSettings;
  resubmitOf?: ISubmission | null;
  onClose: () => void;
  onSaved: () => void;
  isParent: boolean;
}) {
  const { mutation, isLoading } = useMutation();
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const user = useAuthStore((s) => s.user) as
    | { _id?: string; fullName?: string; rollNumber?: string }
    | null
    | undefined;
  const configuredModes = settings?.acceptedModes?.length
    ? settings.acceptedModes
    : DEFAULT_PAYMENT_MODES;
  const acceptedModes = isParent
    ? configuredModes.filter((mode) => PARENT_PAYMENT_MODES.has(mode))
    : configuredModes;

  const formik = useFormik({
    initialValues: {
      amountSubmitted: resubmitOf?.amountSubmitted ?? record.balanceDue,
      paymentMode: resubmitOf?.paymentMode ?? acceptedModes[0] ?? 'upi',
      paymentDate: resubmitOf?.paymentDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      utrNumber: resubmitOf?.utrNumber ?? '',
      bankReference: '',
    },
    validationSchema: Yup.object({
      amountSubmitted: Yup.number().positive('Must be positive').required('Amount required'),
      paymentMode: Yup.string().required('Payment mode required'),
      paymentDate: Yup.string().required('Date required'),
      utrNumber:
        settings?.requireUtrNumber === false
          ? Yup.string().trim()
          : Yup.string().trim().required('UTR / transaction ID required'),
    }),
    onSubmit: async (values) => {
      if (settings?.requireScreenshot !== false && !screenshot && !resubmitOf?.screenshotUrl) {
        toast.error('Payment screenshot is required');
        return;
      }
      const isResubmit = !!resubmitOf && !isParent;
      const endpoint = isResubmit
        ? `fee/submissions/${resubmitOf!._id}/resubmit`
        : isParent
          ? 'parent/fees/pay'
          : 'fee/submissions';
      const body = new FormData();
      body.append(isParent ? 'amountPaid' : 'amountSubmitted', String(values.amountSubmitted));
      body.append('paymentDate', new Date(values.paymentDate).toISOString());
      body.append('utrNumber', values.utrNumber);
      body.append('bankReference', values.bankReference);
      if (screenshot) body.append('screenshot', screenshot);
      if (!isResubmit) {
        body.append('feeRecordId', record._id);
        body.append('paymentMode', values.paymentMode);
        body.append('studentName', user?.fullName ?? '');
        body.append('rollNumber', user?.rollNumber ?? '');
        body.append('program', record.program);
        body.append('branch', record.branch);
        body.append('semester', String(record.semester));
        body.append('academicYear', record.academicYear);
      }
      const res = await mutation(endpoint, {
        method: isResubmit ? 'PUT' : 'POST',
        body,
        isFormData: true,
        isAlert: true,
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success(isResubmit ? 'Resubmitted' : 'Payment submitted for review');
        onSaved();
      }
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {resubmitOf ? 'Resubmit Payment' : 'Submit Payment Proof'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xl text-slate-600 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        <div className="mb-4 rounded-xl bg-slate-50 p-3 text-xs">
          <p className="font-medium text-slate-800">Invoice #{record.invoiceNumber}</p>
          <p className="text-slate-500">
            {record.program} · Sem {record.semester} · Balance ₹
            {record.balanceDue.toLocaleString('en-IN')}
          </p>
        </div>
        {settings && (
          <div className="mb-4 grid gap-3 rounded-xl border border-slate-100 p-3 text-xs md:grid-cols-[140px_1fr]">
            <div className="flex items-center justify-center rounded-lg bg-slate-50 p-3">
              {settings.qrCodeUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={settings.qrCodeUrl}
                  alt="Payment QR"
                  className="h-28 w-28 object-contain"
                />
              ) : (
                <Receipt className="h-8 w-8 text-slate-300" />
              )}
            </div>
            <div className="space-y-2">
              {settings.upiId && (
                <p>
                  <span className="font-medium text-slate-700">UPI:</span>{' '}
                  <span className="font-mono">{settings.upiId}</span>
                  {settings.upiName ? ` (${settings.upiName})` : ''}
                </p>
              )}
              {settings.bankAccounts?.map((bank, index) => (
                <div key={`${bank.bankName}-${index}`} className="rounded-lg bg-slate-50 p-2">
                  <p className="font-medium text-slate-700">{bank.bankName}</p>
                  <p>Holder: {bank.accountHolderName}</p>
                  <p>
                    A/C: <span className="font-mono">{bank.accountNumber}</span> · IFSC:{' '}
                    <span className="font-mono">{bank.ifscCode}</span>
                  </p>
                  {bank.branchName && <p>Branch: {bank.branchName}</p>}
                </div>
              ))}
              {settings.paymentInstructions && (
                <p className="whitespace-pre-line text-slate-500">{settings.paymentInstructions}</p>
              )}
            </div>
          </div>
        )}
        <form onSubmit={formik.handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Amount Paid *</label>
              <input
                type="number"
                name="amountSubmitted"
                min={1}
                value={formik.values.amountSubmitted}
                onChange={formik.handleChange}
                className={inputCls}
              />
              {formik.touched.amountSubmitted && formik.errors.amountSubmitted && (
                <p className="mt-1 text-xs text-red-500">
                  {formik.errors.amountSubmitted as string}
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>Payment Mode *</label>
              <select
                name="paymentMode"
                value={formik.values.paymentMode}
                onChange={formik.handleChange}
                disabled={!!resubmitOf}
                className={inputCls}
              >
                {acceptedModes.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_MODE_LABELS[m] ?? m}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Payment Date *</label>
            <input
              type="date"
              name="paymentDate"
              value={formik.values.paymentDate}
              onChange={formik.handleChange}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              UTR / Transaction ID {settings?.requireUtrNumber === false ? '' : '*'}
            </label>
            <input
              name="utrNumber"
              value={formik.values.utrNumber}
              onChange={formik.handleChange}
              placeholder="e.g. UTR123456789"
              className={inputCls}
            />
            {formik.touched.utrNumber && formik.errors.utrNumber && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.utrNumber}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Bank Reference (optional)</label>
            <input
              name="bankReference"
              value={formik.values.bankReference}
              onChange={formik.handleChange}
              placeholder="Bank reference no."
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              Payment Screenshot {settings?.requireScreenshot === false ? '(optional)' : '*'}
            </label>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp,image/tiff,image/heic,image/heif"
              onChange={(event) => setScreenshot(event.currentTarget.files?.[0] ?? null)}
              className={inputCls}
            />
            {screenshot && <p className="mt-1 text-xs text-slate-500">{screenshot.name}</p>}
          </div>
          <div className="flex justify-end gap-3">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton variant="primary" type="submit" loading={isLoading}>
              {resubmitOf ? 'Resubmit' : 'Submit'}
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function StudentFeeView({ isParent = false }: { isParent?: boolean }) {
  const user = useAuthStore((s) => s.user) as { _id?: string } | null | undefined;
  const studentId = user?._id;

  const {
    data: feesRaw,
    isLoading: loadingFees,
    mutate: mutateFees,
  } = useSwr(isParent ? 'parent/fees' : studentId ? `fee/student/${studentId}` : null);
  const {
    data: subsRaw,
    isLoading: loadingSubs,
    mutate: mutateSubs,
  } = useSwr(isParent ? 'parent/fees/history' : 'fee/submissions/my');
  const { data: settingsRaw } = useSwr('payment-settings/active');

  const records: IFeeRecord[] =
    (feesRaw as { data?: IFeeRecord[] })?.data ??
    (feesRaw as { data?: { data?: IFeeRecord[] } })?.data?.data ??
    [];
  const submissions: ISubmission[] =
    (subsRaw as { data?: ISubmission[] })?.data ??
    (subsRaw as { data?: { data?: ISubmission[] } })?.data?.data ??
    [];
  const settings: IPaymentSettings | undefined = (settingsRaw as { data?: IPaymentSettings })?.data;

  const [activeSubmit, setActiveSubmit] = useState<{
    record: IFeeRecord;
    resubmit?: ISubmission | null;
  } | null>(null);

  const submissionFor = (recordId: string) =>
    submissions
      .filter((s) => s.feeRecordId === recordId)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];

  const outstandingTotal = records
    .filter((r) => r.status !== 'Paid')
    .reduce((sum, r) => sum + r.balanceDue, 0);
  const pendingSubs = submissions.filter(
    (s) => s.status === 'pending' || s.status === 'under_review',
  ).length;

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Fees</h1>
          <p className="mt-1 text-sm text-slate-500">View dues and submit payment proof</p>
        </div>
        <Receipt className="h-7 w-7 text-primary opacity-80" />
      </motion.div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          {
            label: 'Outstanding',
            value: `₹${outstandingTotal.toLocaleString('en-IN')}`,
            color: 'bg-red-50 text-red-500',
            icon: <AlertCircle className="h-4.5 w-4.5" />,
          },
          {
            label: 'Submissions Pending',
            value: pendingSubs,
            color: 'bg-amber-50 text-amber-600',
            icon: <Clock className="h-4.5 w-4.5" />,
          },
          {
            label: 'Approved',
            value: submissions.filter((s) => s.status === 'approved').length,
            color: 'bg-green-50 text-green-600',
            icon: <CheckCircle className="h-4.5 w-4.5" />,
          },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl bg-white p-4">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.color}`}
            >
              {s.icon}
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {settings && (
        <section className="grid gap-4 rounded-2xl bg-white p-4 md:grid-cols-[160px_1fr]">
          <div className="flex min-h-36 items-center justify-center rounded-xl bg-slate-50">
            {settings.qrCodeUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.qrCodeUrl} alt="Payment QR" className="h-32 w-32 object-contain" />
            ) : (
              <Receipt className="h-8 w-8 text-slate-300" />
            )}
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Payment Details - {settings.institutionName}
              </h2>
              <p className="text-xs text-slate-500">
                Accounts verifies submitted payments within {settings.maxVerificationDays} day
                {settings.maxVerificationDays === 1 ? '' : 's'}.
              </p>
            </div>
            {settings.upiId && (
              <p className="text-xs text-slate-600">
                UPI: <span className="font-mono font-medium text-slate-800">{settings.upiId}</span>
                {settings.upiName ? ` (${settings.upiName})` : ''}
              </p>
            )}
            {settings.bankAccounts?.length > 0 && (
              <div className="grid gap-2 md:grid-cols-2">
                {settings.bankAccounts.map((bank, index) => (
                  <div
                    key={`${bank.bankName}-${index}`}
                    className="rounded-lg bg-slate-50 p-3 text-xs"
                  >
                    <p className="font-medium text-slate-800">{bank.bankName}</p>
                    <p>{bank.accountHolderName}</p>
                    <p>
                      A/C <span className="font-mono">{bank.accountNumber}</span> · IFSC{' '}
                      <span className="font-mono">{bank.ifscCode}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
            {settings.paymentInstructions && (
              <p className="whitespace-pre-line text-xs text-slate-500">
                {settings.paymentInstructions}
              </p>
            )}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Fee Records</h2>
        {loadingFees ? (
          <div className="h-24 animate-pulse rounded-xl bg-white" />
        ) : records.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-600">
            No fee records yet
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {records.map((r) => {
              const sub = submissionFor(r._id);
              const canSubmit =
                r.status !== 'Paid' &&
                (!sub || sub.status === 'rejected' || sub.status === 'resubmit_required');
              const canResubmit =
                !isParent &&
                sub &&
                (sub.status === 'resubmit_required' || sub.status === 'rejected');
              return (
                <div key={r._id} className="rounded-2xl bg-white p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        Invoice #{r.invoiceNumber}
                      </p>
                      <p className="text-xs text-slate-500">
                        {r.program} · Sem {r.semester} · {r.academicYear}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">Due: {fmtDate(r.dueDate)}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.status === 'Paid'
                          ? 'bg-green-50 text-green-600'
                          : r.status === 'Overdue'
                            ? 'bg-red-50 text-red-500'
                            : 'bg-amber-50 text-amber-600'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-slate-600">Net</p>
                      <p className="font-semibold">₹{r.netDue.toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <p className="text-slate-600">Paid</p>
                      <p className="font-semibold text-green-600">
                        ₹{r.totalPaid.toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-600">Balance</p>
                      <p className="font-semibold text-red-500">
                        ₹{r.balanceDue.toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                  {sub && (
                    <div className="mt-3 rounded-lg bg-slate-50 p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span
                          className={`rounded-full px-2 py-0.5 font-medium ${SUB_STATUS[sub.status].bg} ${SUB_STATUS[sub.status].text}`}
                        >
                          {SUB_STATUS[sub.status].label}
                        </span>
                        <span className="text-slate-600">UTR: {sub.utrNumber}</span>
                      </div>
                      {sub.reviewRemarks && (
                        <p className="mt-1 text-slate-600">{sub.reviewRemarks}</p>
                      )}
                      {sub.officialReceiptUrl && (
                        <a
                          href={sub.officialReceiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-primary"
                        >
                          Download Receipt
                        </a>
                      )}
                    </div>
                  )}
                  <div className="mt-3 flex justify-end gap-2">
                    {canResubmit && (
                      <CustomButton
                        variant="tertiary"
                        startIcon={<RefreshCw className="h-3.5 w-3.5" />}
                        onClick={() => setActiveSubmit({ record: r, resubmit: sub })}
                      >
                        Resubmit
                      </CustomButton>
                    )}
                    {canSubmit && !canResubmit && (
                      <CustomButton
                        variant="primary"
                        startIcon={<Upload className="h-3.5 w-3.5" />}
                        onClick={() => setActiveSubmit({ record: r })}
                      >
                        Submit Payment
                      </CustomButton>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">My Submissions</h2>
        {loadingSubs ? (
          <div className="h-24 animate-pulse rounded-xl bg-white" />
        ) : submissions.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-600">
            No submissions yet
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Amount</th>
                  <th className="px-4 py-2 text-left">Mode</th>
                  <th className="px-4 py-2 text-left">UTR</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s._id} className="border-t border-slate-100">
                    <td className="px-4 py-2 text-xs">{fmtDate(s.paymentDate)}</td>
                    <td className="px-4 py-2 text-xs font-medium">
                      ₹{s.amountSubmitted.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-2 text-xs">{s.paymentMode}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">{s.utrNumber ?? '—'}</td>
                    <td className="px-4 py-2 text-xs">
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${SUB_STATUS[s.status].bg} ${SUB_STATUS[s.status].text}`}
                      >
                        {SUB_STATUS[s.status].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AnimatePresence>
        {activeSubmit && (
          <SubmitModal
            record={activeSubmit.record}
            settings={settings}
            resubmitOf={activeSubmit.resubmit}
            isParent={isParent}
            onClose={() => setActiveSubmit(null)}
            onSaved={() => {
              mutateSubs();
              mutateFees();
              setActiveSubmit(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

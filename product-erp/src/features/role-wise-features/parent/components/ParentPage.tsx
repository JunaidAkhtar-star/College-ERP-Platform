/**
 * @file ParentPage.tsx
 * @description Parent Portal — read-only view of ward's data:
 *   Ward profile (GET parent/ward)
 *   Attendance summary (GET parent/attendance?semester=&academicYear=)
 *   Exam results (GET parent/results)
 *   Fee details + payment history (GET parent/fees, GET parent/fees/history, POST parent/fees/pay)
 *   Notices (GET parent/notices)
 *   Messaging with faculty (GET parent/messages, POST parent/messages)
 * @module features/role-wise-features/parent
 */
'use client';

import React, { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import {
  User,
  BarChart2,
  CreditCard,
  Bell,
  MessageSquare,
  AlertTriangle,
  Send,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  RotateCw,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Column } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import AsyncSelect from '@/shared/core/AsyncSelect';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface IWard {
  _id?: string;
  userId?: string;
  fullName?: string;
  rollNumber?: string;
  program?: string;
  branch?: string;
  currentSemester?: number;
  academicYear?: string;
  section?: string;
  photo?: string;
  email?: string;
  phone?: string;
  [key: string]: unknown;
}

interface IAttendanceSummary {
  subjectCode: string;
  subjectName?: string;
  totalClasses: number;
  attended: number;
  absent: number;
  late: number;
  percentage: number;
  [key: string]: unknown;
}

interface IResult {
  _id?: string;
  examName?: string;
  semester?: number;
  academicYear?: string;
  subjects?: IResultSubject[];
  sgpa?: number;
  cgpa?: number;
  status?: string;
  [key: string]: unknown;
}

interface IResultSubject {
  subjectCode?: string;
  subjectName?: string;
  marksObtained?: number;
  maxMarks?: number;
  grade?: string;
  [key: string]: unknown;
}

interface IFeeRecord {
  _id: string;
  feeType?: string;
  amount: number;
  dueDate?: string;
  status?: string;
  paidAmount?: number;
  balance?: number;
  semester?: number;
  academicYear?: string;
  [key: string]: unknown;
}

interface IPaymentHistory {
  _id: string;
  amountPaid: number;
  paymentMode?: string;
  paymentDate?: string;
  bankRef?: string;
  remarks?: string;
  feeType?: string;
  [key: string]: unknown;
}

interface INotice {
  _id: string;
  title: string;
  content?: string;
  category?: string;
  createdAt?: string;
  publishedAt?: string;
  isPublished?: boolean;
  [key: string]: unknown;
}

interface IConversation {
  _id: string;
  participants?: { _id?: string; name?: string; role?: string }[];
  lastMessage?: { content?: string; createdAt?: string };
  unreadCount?: number;
  [key: string]: unknown;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtCurrency(n?: number) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function currentAcademicYear() {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 5 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

// ─── Ward Profile ───────────────────────────────────────────────────────────────

function WardProfilePanel() {
  const { data: raw, isLoading, mutate } = useSwr('parent/ward');
  const ward: IWard = (raw as { data?: IWard })?.data ?? {};

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-2xl bg-white" />;
  }

  const initials = ward.fullName
    ? ward.fullName
        .split(' ')
        .map((w: string) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  return (
    <div className="rounded-2xl bg-white p-6 relative">
      <button
        type="button"
        onClick={() => {
          mutate();
          toast.success('Ward profile refreshed');
        }}
        className="absolute right-6 top-6 rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all"
        title="Refresh Profile"
      >
        <RotateCw className="h-4 w-4" />
      </button>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-2xl font-black text-primary">
          {initials}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-900">{ward.fullName ?? '—'}</h2>
          <p className="mt-0.5 text-sm text-slate-500 font-mono">{ward.rollNumber ?? '—'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { label: 'Program', value: ward.program },
              { label: 'Branch', value: ward.branch },
              {
                label: 'Semester',
                value: ward.currentSemester != null ? `Sem ${ward.currentSemester}` : undefined,
              },
              { label: 'Section', value: ward.section },
              { label: 'Year', value: ward.academicYear },
            ]
              .filter((x) => x.value)
              .map((x) => (
                <span
                  key={x.label}
                  className="rounded-lg bg-slate-100 px-3 py-1 text-xs text-slate-600"
                >
                  <span className="font-medium text-slate-600">{x.label}:</span> {String(x.value)}
                </span>
              ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm text-slate-500">
          {ward.email && <span>{ward.email}</span>}
          {ward.phone && <span>{ward.phone}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Attendance Panel ──────────────────────────────────────────────────────────

function AttendancePanel() {
  const [semester, setSemester] = useState(1);
  const [academicYear, setAcademicYear] = useState(currentAcademicYear());
  const [query, setQuery] = useState(`semester=1&academicYear=${currentAcademicYear()}`);

  const { data: raw, isLoading, mutate } = useSwr(`parent/attendance?${query}`);
  const subjects: IAttendanceSummary[] = (raw as { data?: IAttendanceSummary[] })?.data ?? [];
  const overall = subjects.length
    ? Math.round(subjects.reduce((s, r) => s + r.percentage, 0) / subjects.length)
    : 0;

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Sem</label>
          <div className="min-w-35">
            <AsyncSelect
              type="semesters"
              value={String(semester)}
              onChange={(v) => setSemester(Number(v ?? 1))}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Year</label>
          <div className="w-52">
            <AsyncSelect
              type="academicYears"
              value={academicYear || null}
              onChange={(value) => setAcademicYear(value ?? '')}
              placeholder="Select configured year"
            />
          </div>
        </div>
        <CustomButton
          variant="primary"
          onClick={() => setQuery(`semester=${semester}&academicYear=${academicYear}`)}
          className="py-1.5! text-xs! w-fit!"
        >
          Load
        </CustomButton>
        <CustomButton
          variant="tertiary"
          onClick={() => {
            mutate();
            toast.success('Attendance data refreshed');
          }}
          className="py-1.5! px-3! text-xs! w-fit! flex items-center gap-1"
        >
          <RotateCw className="h-3.5 w-3.5" /> Refresh
        </CustomButton>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      ) : subjects.length ? (
        <>
          {/* Overall badge */}
          <div className="flex items-center gap-4 rounded-2xl bg-white p-5">
            <div
              className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-xl font-black ${
                overall >= 75
                  ? 'bg-green-50 text-green-600'
                  : overall >= 65
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-red-50 text-red-500'
              }`}
            >
              {overall}%
            </div>
            <div>
              <p className="text-base font-bold">Overall Attendance</p>
              <p className="text-xs text-slate-600">
                {subjects.length} subject{subjects.length > 1 ? 's' : ''}
              </p>
              {overall < 75 && (
                <p className="mt-1 text-xs font-medium text-red-500">
                  ⚠ Below 75% — action required
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {subjects.map((s, i) => {
              const pct = Math.round(s.percentage);
              const barColor =
                pct >= 75 ? 'bg-green-400' : pct >= 65 ? 'bg-amber-400' : 'bg-red-400';
              const textColor =
                pct >= 75 ? 'text-green-600' : pct >= 65 ? 'text-amber-600' : 'text-red-500';
              return (
                <motion.div
                  key={s.subjectCode}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-2xl bg-white p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold">{s.subjectName ?? s.subjectCode}</p>
                      <p className="text-xs text-slate-600 font-mono">{s.subjectCode}</p>
                    </div>
                    <span className={`text-lg font-black ${textColor}`}>{pct}%</span>
                  </div>
                  <div className="mb-2 h-2 rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full ${barColor}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span className="text-green-600">P: {s.attended}</span>
                    <span className="text-red-400">A: {s.absent}</span>
                    <span className="text-amber-500">L: {s.late}</span>
                    <span>Total: {s.totalClasses}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-14">
          <BarChart2 className="h-10 w-10 text-slate-200 mb-2" />
          <p className="text-sm text-slate-600">No attendance data for selected semester</p>
        </div>
      )}
    </div>
  );
}

// ─── Results Panel ─────────────────────────────────────────────────────────────

function ResultsPanel() {
  const { data: raw, isLoading, mutate } = useSwr('parent/results');
  const results: IResult[] = (raw as { data?: IResult[] })?.data ?? [];
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading)
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
    );

  if (!results.length)
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-14">
        <GraduationCap className="h-10 w-10 text-slate-200 mb-2" />
        <p className="text-sm text-slate-600">No exam results available</p>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Exam Results</h3>
        <CustomButton
          variant="tertiary"
          onClick={() => {
            mutate();
            toast.success('Results data refreshed');
          }}
          className="py-1.5! px-3! text-xs! w-fit! flex items-center gap-1"
        >
          <RotateCw className="h-3.5 w-3.5" /> Refresh
        </CustomButton>
      </div>
      <div className="space-y-2">
        {results.map((r) => {
          const id = String(r._id ?? r.examName ?? '');
          return (
            <div key={id} className="rounded-2xl bg-white">
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === id ? null : id)}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <div>
                  <p className="text-sm font-semibold">{r.examName ?? 'Exam'}</p>
                  <p className="text-xs text-slate-600">
                    Sem {r.semester} · {r.academicYear}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {r.sgpa != null && (
                    <span className="rounded-lg bg-primary-50 px-2 py-1 text-xs font-bold text-primary">
                      SGPA: {r.sgpa}
                    </span>
                  )}
                  {r.cgpa != null && (
                    <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                      CGPA: {r.cgpa}
                    </span>
                  )}
                  {expandedId === id ? (
                    <ChevronUp className="h-4 w-4 text-slate-300" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-300" />
                  )}
                </div>
              </button>

              <AnimatePresence>
                {expandedId === id && r.subjects?.length && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-slate-50 px-4 pb-4"
                  >
                    <table className="mt-3 w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="pb-2 pr-4 text-left font-medium text-slate-600">
                            Subject
                          </th>
                          <th className="pb-2 pr-4 text-left font-medium text-slate-600">Marks</th>
                          <th className="pb-2 text-left font-medium text-slate-600">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {r.subjects.map((s, i) => (
                          <tr key={i}>
                            <td className="py-1.5 pr-4">
                              <p className="font-mono">{s.subjectCode}</p>
                              <p className="text-slate-600">{s.subjectName}</p>
                            </td>
                            <td className="py-1.5 pr-4">
                              {s.marksObtained ?? '—'}/{s.maxMarks ?? '—'}
                            </td>
                            <td className="py-1.5">
                              <span
                                className={`rounded-md px-2 py-0.5 font-bold ${
                                  s.grade === 'F'
                                    ? 'bg-red-50 text-red-500'
                                    : 'bg-green-50 text-green-600'
                                }`}
                              >
                                {s.grade ?? '—'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Fee Payment Modal ─────────────────────────────────────────────────────────

interface PayFeeModalProps {
  fee: IFeeRecord;
  onClose: () => void;
  onPaid: () => void;
}

const PAYMENT_MODES = ['Cash', 'Online Transfer', 'UPI', 'Cheque', 'DD', 'Card'];

function PayFeeModal({ fee, onClose, onPaid }: PayFeeModalProps) {
  const { mutation, isLoading } = useMutation();
  const balance = fee.balance ?? fee.amount - (fee.paidAmount ?? 0);

  const formik = useFormik({
    initialValues: {
      amountPaid: balance > 0 ? balance : fee.amount,
      paymentMode: 'Online Transfer',
      bankRef: '',
      upiId: '',
      chequeNumber: '',
      ddNumber: '',
      remarks: '',
    },
    validationSchema: Yup.object({
      amountPaid: Yup.number()
        .min(1, 'Must be > 0')
        .max(balance, `Max payable: ₹${balance}`)
        .required('Amount required'),
      paymentMode: Yup.string().required('Payment mode required'),
    }),
    onSubmit: async (values) => {
      const body = {
        feeRecordId: fee._id,
        amountPaid: values.amountPaid,
        paymentMode: values.paymentMode,
        bankRef: values.bankRef || undefined,
        upiId: values.upiId || undefined,
        chequeNumber: values.chequeNumber || undefined,
        ddNumber: values.ddNumber || undefined,
        remarks: values.remarks || undefined,
      };
      const res = await mutation('parent/fees/pay', { method: 'POST', body, isAlert: true });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Payment recorded');
        onPaid();
        onClose();
      } else {
        toast.error('Payment failed');
      }
    },
  });

  const mode = formik.values.paymentMode;

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
        className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Pay Fee</h2>
            <p className="text-xs text-slate-600 mt-0.5">
              {fee.feeType} · Balance: {fmtCurrency(balance)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-600 hover:text-slate-600 text-xl"
          >
            ✕
          </button>
        </div>

        <form onSubmit={formik.handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Amount (₹) *</label>
            <input
              type="number"
              name="amountPaid"
              value={formik.values.amountPaid}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              className={inputCls}
            />
            {formik.touched.amountPaid && formik.errors.amountPaid && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.amountPaid as string}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Payment Mode *</label>
            <select
              name="paymentMode"
              value={mode}
              onChange={formik.handleChange}
              className={inputCls}
            >
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          {mode === 'UPI' && (
            <div>
              <label className={labelCls}>UPI ID</label>
              <input
                name="upiId"
                value={formik.values.upiId}
                onChange={formik.handleChange}
                placeholder="name@upi"
                className={inputCls}
              />
            </div>
          )}
          {(mode === 'Online Transfer' || mode === 'Card') && (
            <div>
              <label className={labelCls}>Bank Reference / Transaction ID</label>
              <input
                name="bankRef"
                value={formik.values.bankRef}
                onChange={formik.handleChange}
                placeholder="TXN123…"
                className={inputCls}
              />
            </div>
          )}
          {mode === 'Cheque' && (
            <div>
              <label className={labelCls}>Cheque Number</label>
              <input
                name="chequeNumber"
                value={formik.values.chequeNumber}
                onChange={formik.handleChange}
                placeholder="000123"
                className={inputCls}
              />
            </div>
          )}
          {mode === 'DD' && (
            <div>
              <label className={labelCls}>DD Number</label>
              <input
                name="ddNumber"
                value={formik.values.ddNumber}
                onChange={formik.handleChange}
                placeholder="DD-123456"
                className={inputCls}
              />
            </div>
          )}
          <div>
            <label className={labelCls}>Remarks</label>
            <input
              name="remarks"
              value={formik.values.remarks}
              onChange={formik.handleChange}
              placeholder="Optional"
              className={inputCls}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton
              variant="primary"
              type="submit"
              loading={isLoading}
              startIcon={<CreditCard className="h-4 w-4" />}
            >
              Pay {fmtCurrency(formik.values.amountPaid)}
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Fees Panel ────────────────────────────────────────────────────────────────

function FeesPanel() {
  const { data: rawFees, isLoading: loadingFees, mutate } = useSwr('parent/fees');
  const { data: rawHistory, isLoading: loadingHistory } = useSwr('parent/fees/history');
  const fees: IFeeRecord[] = (rawFees as { data?: IFeeRecord[] })?.data ?? [];
  const history: IPaymentHistory[] = (rawHistory as { data?: IPaymentHistory[] })?.data ?? [];
  const [payTarget, setPayTarget] = useState<IFeeRecord | null>(null);

  const statusColor: Record<string, string> = {
    paid: 'bg-green-50 text-green-600',
    partial: 'bg-amber-50 text-amber-600',
    unpaid: 'bg-red-50 text-red-500',
    pending: 'bg-slate-100 text-slate-500',
    overdue: 'bg-red-100 text-red-600',
  };

  const feeCols: Column<IFeeRecord>[] = [
    {
      field: 'feeType',
      title: 'Fee Type',
      render: (r) => <span className="text-sm font-medium">{String(r.feeType ?? '—')}</span>,
    },
    {
      field: 'semester',
      title: 'Sem / Year',
      render: (r) => (
        <span className="text-xs text-slate-500">
          Sem {r.semester} · {String(r.academicYear ?? '')}
        </span>
      ),
    },
    {
      field: 'amount',
      title: 'Total',
      render: (r) => <span className="text-sm font-semibold">{fmtCurrency(r.amount)}</span>,
    },
    {
      field: 'paidAmount',
      title: 'Paid',
      render: (r) => (
        <span className="text-sm text-green-600">{fmtCurrency(r.paidAmount ?? 0)}</span>
      ),
    },
    {
      field: 'balance',
      title: 'Balance',
      render: (r) => (
        <span className="text-sm text-red-500 font-medium">
          {fmtCurrency(r.balance ?? r.amount - (r.paidAmount ?? 0))}
        </span>
      ),
    },
    {
      field: 'dueDate',
      title: 'Due',
      render: (r) => <span className="text-xs text-slate-600">{fmtDate(r.dueDate)}</span>,
    },
    {
      field: 'status',
      title: 'Status',
      render: (r) => (
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${statusColor[r.status ?? 'pending'] ?? 'bg-slate-100 text-slate-500'}`}
        >
          {String(r.status ?? 'pending')}
        </span>
      ),
    },
  ];

  const payable = fees.filter(
    (f) => f.status !== 'paid' && (f.balance ?? f.amount - (f.paidAmount ?? 0)) > 0,
  );
  const totalDue = payable.reduce((s, f) => s + (f.balance ?? f.amount - (f.paidAmount ?? 0)), 0);

  const histCols: Column<IPaymentHistory>[] = [
    {
      field: 'paymentDate',
      title: 'Date',
      render: (r) => <span className="text-xs">{fmtDate(r.paymentDate)}</span>,
    },
    {
      field: 'feeType',
      title: 'For',
      render: (r) => <span className="text-sm">{String(r.feeType ?? '—')}</span>,
    },
    {
      field: 'amountPaid',
      title: 'Amount',
      render: (r) => (
        <span className="text-sm font-semibold text-green-600">{fmtCurrency(r.amountPaid)}</span>
      ),
    },
    {
      field: 'paymentMode',
      title: 'Mode',
      render: (r) => <span className="text-xs text-slate-500">{String(r.paymentMode ?? '—')}</span>,
    },
    {
      field: 'bankRef',
      title: 'Ref',
      render: (r) => (
        <span className="text-xs font-mono text-slate-600">{String(r.bankRef ?? '—')}</span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Summary */}
      {totalDue > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-red-50 px-5 py-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
          <div>
            <p className="text-sm font-semibold text-red-600">Outstanding Balance</p>
            <p className="text-xl font-black text-red-500">{fmtCurrency(totalDue)}</p>
          </div>
        </div>
      )}

      {/* Fee Records */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Fee Records</h3>
        <DataViewSwitcher<IFeeRecord>
          data={fees}
          isLoading={loadingFees}
          storageKey="parent.fees.view"
          searchPlaceholder="Search fees…"
          searchFields={['feeType', 'academicYear', 'status']}
          renderCard={(r) => {
            const balance = r.balance ?? r.amount - (r.paidAmount ?? 0);
            const paid = r.status === 'paid' || balance <= 0;
            const cfg = paid
              ? 'bg-green-50 text-green-600'
              : r.status === 'partial'
                ? 'bg-amber-50 text-amber-600'
                : 'bg-red-50 text-red-500';
            return (
              <motion.div
                whileHover={{ y: -2 }}
                className="flex flex-col gap-3 rounded-2xl bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${cfg}`}
                  >
                    {paid ? 'paid' : (r.status ?? 'pending')}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{r.feeType ?? 'Fee'}</p>
                  <p className="text-[11px] text-slate-600">
                    AY {r.academicYear ?? '—'}
                    {r.semester ? ` · Sem ${r.semester}` : ''}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                    <p className="text-[9px] uppercase text-slate-600">Amount</p>
                    <p className="font-bold text-slate-800">₹{r.amount}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                    <p className="text-[9px] uppercase text-slate-600">Paid</p>
                    <p className="font-bold text-green-600">₹{r.paidAmount ?? 0}</p>
                  </div>
                  <div
                    className={`rounded-lg px-2 py-1.5 ${balance > 0 ? 'bg-red-50' : 'bg-slate-50'}`}
                  >
                    <p className="text-[9px] uppercase text-slate-600">Balance</p>
                    <p className={`font-bold ${balance > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                      ₹{balance}
                    </p>
                  </div>
                </div>
                {r.dueDate && (
                  <p className="text-[11px] text-slate-500">
                    Due {new Date(r.dueDate).toLocaleDateString()}
                  </p>
                )}
                {!paid && (
                  <div className="flex items-center justify-end border-t border-slate-100 pt-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setPayTarget(r)}
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      <CreditCard className="h-3 w-3" /> Pay
                    </button>
                  </div>
                )}
              </motion.div>
            );
          }}
          table={
            <div className="overflow-hidden rounded-2xl bg-white">
              <CustomTable<IFeeRecord>
                data={fees}
                columns={feeCols}
                isLoading={loadingFees}
                actions={[
                  {
                    tooltip: 'Pay',
                    icon: <CreditCard className="h-4 w-4" />,
                    onClick: (row: IFeeRecord) => setPayTarget(row),
                    hidden: (row: IFeeRecord) =>
                      row.status === 'paid' ||
                      (row.balance ?? row.amount - (row.paidAmount ?? 0)) <= 0,
                  },
                ]}
                options={{ pagination: true, pageSize: 10 }}
              />
            </div>
          }
        />
      </div>

      {/* Payment History */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Payment History</h3>
        <DataViewSwitcher<IPaymentHistory>
          data={history}
          isLoading={loadingHistory}
          storageKey="parent.history.view"
          searchPlaceholder="Search payments…"
          searchFields={['feeType', 'paymentMode', 'bankRef']}
          renderCard={(h) => (
            <motion.div
              whileHover={{ y: -2 }}
              className="flex flex-col gap-3 rounded-2xl bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-600">
                  <CreditCard className="h-5 w-5" />
                </div>
                {h.paymentMode && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium capitalize text-slate-600">
                    {h.paymentMode}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">₹{h.amountPaid}</p>
                {h.feeType && <p className="text-xs text-slate-500">{h.feeType}</p>}
                {h.paymentDate && (
                  <p className="text-[11px] text-slate-600">
                    {new Date(h.paymentDate).toLocaleDateString()}
                  </p>
                )}
              </div>
              {h.bankRef && (
                <p className="text-[11px] font-mono text-slate-600">Ref: {h.bankRef}</p>
              )}
              {h.remarks && <p className="text-xs text-slate-500 line-clamp-2">{h.remarks}</p>}
            </motion.div>
          )}
          table={
            <div className="overflow-hidden rounded-2xl bg-white">
              <CustomTable<IPaymentHistory>
                data={history}
                columns={histCols}
                isLoading={loadingHistory}
                options={{ pagination: true, pageSize: 10 }}
              />
            </div>
          }
        />
      </div>

      <AnimatePresence>
        {payTarget && (
          <PayFeeModal fee={payTarget} onClose={() => setPayTarget(null)} onPaid={() => mutate()} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Notices Panel ─────────────────────────────────────────────────────────────

function NoticesPanel() {
  const { data: raw, isLoading, mutate } = useSwr('parent/notices?limit=30');
  const notices: INotice[] = (raw as { data?: INotice[] })?.data ?? [];
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading)
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
    );

  if (!notices.length)
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-14">
        <Bell className="h-10 w-10 text-slate-200 mb-2" />
        <p className="text-sm text-slate-600">No notices at the moment</p>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Notices & Circulars</h3>
        <CustomButton
          variant="tertiary"
          onClick={() => {
            mutate();
            toast.success('Notices refreshed');
          }}
          className="py-1.5! px-3! text-xs! w-fit! flex items-center gap-1"
        >
          <RotateCw className="h-3.5 w-3.5" /> Refresh
        </CustomButton>
      </div>
      <div className="space-y-2">
        {notices.map((n) => (
          <div key={n._id} className="rounded-2xl bg-white">
            <button
              type="button"
              onClick={() => setExpandedId(expandedId === n._id ? null : n._id)}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <div>
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="text-xs text-slate-600">
                  {n.category ?? 'General'} · {fmtDate(n.publishedAt ?? n.createdAt)}
                </p>
              </div>
              {expandedId === n._id ? (
                <ChevronUp className="h-4 w-4 text-slate-300" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-300" />
              )}
            </button>
            <AnimatePresence>
              {expandedId === n._id && n.content && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-slate-50 px-4 pb-4"
                >
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{n.content}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Messaging Panel ────────────────────────────────────────────────────────────

function MessagingPanel() {
  const { data: raw, isLoading, mutate } = useSwr('parent/messages');
  const conversations: IConversation[] = (raw as { data?: IConversation[] })?.data ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const [newRecipientId, setNewRecipientId] = useState('');
  const [messageText, setMessageText] = useState('');
  const { mutation, isLoading: sending } = useMutation();

  const handleSend = async (conversationId?: string) => {
    if (!messageText.trim()) return;
    const body: Record<string, string> = { content: messageText.trim() };
    if (conversationId) body.conversationId = conversationId;
    else if (newRecipientId.trim()) body.recipientId = newRecipientId.trim();
    else {
      toast.error('Select a conversation or recipient');
      return;
    }

    const res = await mutation('parent/messages', { method: 'POST', body, isAlert: true });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Message sent');
      setMessageText('');
    } else {
      toast.error('Failed to send message');
    }
  };

  return (
    <div className="space-y-4">
      {/* New message */}
      <div className="rounded-2xl bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">New Message</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <AsyncSelect
            type="faculty"
            value={newRecipientId || null}
            onChange={(value) => setNewRecipientId(value ?? '')}
            placeholder="Search faculty…"
            className="sm:max-w-xs"
          />
          <input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type your message…"
            className={inputCls + ' flex-1'}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          />
          <CustomButton
            variant="primary"
            onClick={() => handleSend()}
            loading={sending}
            startIcon={<Send className="h-4 w-4" />}
            className="w-fit!"
          >
            Send
          </CustomButton>
        </div>
      </div>

      {/* Conversations */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Conversations</h3>
          <button
            type="button"
            onClick={() => {
              mutate();
              toast.success('Conversations refreshed');
            }}
            className="rounded-lg border border-slate-200 bg-white p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            title="Refresh Conversations"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        </div>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-white" />
            ))}
          </div>
        ) : conversations.length ? (
          <div className="space-y-2">
            {conversations.map((c) => {
              const others = (c.participants ?? []).filter((p) => p.role !== 'parent');
              const name = others.map((o) => o.name ?? 'Unknown').join(', ') || 'Unknown';
              return (
                <div
                  key={c._id}
                  className={`flex cursor-pointer items-center justify-between rounded-xl p-4 transition-colors ${
                    selected === c._id ? 'bg-primary-50' : 'bg-white hover:bg-slate-50'
                  }`}
                  onClick={() => {
                    setSelected(c._id);
                    setNewRecipientId('');
                  }}
                >
                  <div>
                    <p className="text-sm font-medium">{name}</p>
                    {c.lastMessage?.content && (
                      <p className="text-xs text-slate-600 truncate max-w-xs">
                        {c.lastMessage.content}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {(c.unreadCount ?? 0) > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                        {c.unreadCount}
                      </span>
                    )}
                    <span className="text-xs text-slate-600">
                      {fmtDate(c.lastMessage?.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-10">
            <MessageSquare className="h-10 w-10 text-slate-200 mb-2" />
            <p className="text-sm text-slate-600">No conversations yet</p>
          </div>
        )}

        {/* Quick reply in selected conversation */}
        {selected && (
          <div className="mt-3 flex gap-2">
            <input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Reply…"
              className={inputCls + ' flex-1'}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend(selected)}
            />
            <CustomButton
              variant="primary"
              onClick={() => handleSend(selected)}
              loading={sending}
              startIcon={<Send className="h-4 w-4" />}
              className="w-fit!"
            >
              Reply
            </CustomButton>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'ward' | 'attendance' | 'results' | 'fees' | 'notices' | 'messages';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'ward', label: 'Ward', icon: User },
  { id: 'attendance', label: 'Attendance', icon: BarChart2 },
  { id: 'results', label: 'Results', icon: GraduationCap },
  { id: 'fees', label: 'Fees', icon: CreditCard },
  { id: 'notices', label: 'Notices', icon: Bell },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
];

export default function ParentPage() {
  const [active, setActive] = useState<Tab>('ward');

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-slate-900">Parent Portal</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Monitor your ward&apos;s academic progress, fees, and communicate with faculty
        </p>
      </motion.div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl bg-white p-1.5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                active === tab.id ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          {active === 'ward' && <WardProfilePanel />}
          {active === 'attendance' && <AttendancePanel />}
          {active === 'results' && <ResultsPanel />}
          {active === 'fees' && <FeesPanel />}
          {active === 'notices' && <NoticesPanel />}
          {active === 'messages' && <MessagingPanel />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

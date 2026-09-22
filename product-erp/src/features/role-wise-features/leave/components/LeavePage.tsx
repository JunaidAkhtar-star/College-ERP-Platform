/**
 * @file LeavePage.tsx
 * @description Leave management — role-aware:
 *   All roles: apply leave (POST leave), see own (GET leave/my), see balance (GET leave/balance)
 *   HOD: hod-approve / hod-reject
 *   Super_admin / Principal: approve / reject
 * @module features/role-wise-features/leave
 */
'use client';

import React, { useState, useMemo } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import {
  Plus,
  CheckCircle,
  Clock,
  XCircle,
  CalendarDays,
  TrendingUp,
  Users,
  X,
  BarChart3,
  PieChart,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import AsyncSelect from '@/shared/core/AsyncSelect';
import FacultyHrWorkflowBar from '@/shared/components/FacultyHrWorkflowBar';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useAuthStore } from '@/shared/store/authStore';

interface ILeave {
  _id: string;
  employeeId?: string | { _id: string; name?: string; email?: string };
  employeeName?: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  totalDays?: number;
  hodApproval?: 'pending' | 'approved' | 'rejected';
  adminApproval?: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: string;
  [key: string]: unknown;
}

interface ILeaveBalance {
  leaveType: string;
  entitled: number;
  used: number;
  available: number;
  [key: string]: unknown;
}

interface ILeaveBalanceLedger {
  casual: number;
  sick: number;
  earned: number;
  onDuty: number;
  casualUsed: number;
  sickUsed: number;
  earnedUsed: number;
  onDutyUsed: number;
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

const STATUS_CFG = {
  pending: {
    label: 'Pending',
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    dot: 'bg-amber-400',
    color: '#f59e0b',
  },
  approved: {
    label: 'Approved',
    bg: 'bg-green-50',
    text: 'text-green-600',
    dot: 'bg-green-400',
    color: '#22c55e',
  },
  rejected: {
    label: 'Rejected',
    bg: 'bg-red-50',
    text: 'text-red-500',
    dot: 'bg-red-400',
    color: '#ef4444',
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    dot: 'bg-slate-400',
    color: '#94a3b8',
  },
};

const LEAVE_TYPES = [
  'casual',
  'sick',
  'earned',
  'on_duty',
  'maternity',
  'paternity',
  'special',
  'loss_of_pay',
];

const BALANCE_COLORS = [
  '#6366f1',
  '#0ea5e9',
  '#22c55e',
  '#f59e0b',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#8b5cf6',
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function daysBetween(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(Math.ceil(ms / 86400000) + 1, 1);
}

// ─── SVG Donut Chart ────────────────────────────────────────────────────────
function DonutChart({
  segments,
  size = 100,
  strokeWidth = 10,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
  strokeWidth?: number;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;

  const offsets = useMemo(() => {
    const res: number[] = [];
    let cumulative = 0;
    for (let i = 0; i < segments.length; i++) {
      res.push(cumulative);
      const pct = segments[i].value / total;
      cumulative += pct * circ;
    }
    return res;
  }, [segments, total, circ]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#f1f5f9"
        strokeWidth={strokeWidth}
      />
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const dash = pct * circ;
        const gap = circ - dash;
        const startOffset = offsets[i];
        return (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-startOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        );
      })}
    </svg>
  );
}

// ─── Apply Modal ─────────────────────────────────────────────────────────────
function ApplyModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { mutation, isLoading } = useMutation();
  const formik = useFormik({
    initialValues: { leaveType: 'casual', fromDate: '', toDate: '', reason: '' },
    validationSchema: Yup.object({
      leaveType: Yup.string().required(),
      fromDate: Yup.string().required('Start date required'),
      toDate: Yup.string()
        .required('End date required')
        .test('after', 'End must be on or after start', function (val) {
          return !this.parent.fromDate || !val || val >= this.parent.fromDate;
        }),
      reason: Yup.string().trim().min(5, 'Min 5 chars').required('Reason required'),
    }),
    onSubmit: async (values) => {
      const totalDays = daysBetween(values.fromDate, values.toDate);
      const res = await mutation('leave', {
        method: 'POST',
        body: { ...values, totalDays },
        isAlert: true,
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Leave applied');
        onSaved();
      }
    },
  });

  const days =
    formik.values.fromDate && formik.values.toDate
      ? daysBetween(formik.values.fromDate, formik.values.toDate)
      : 0;

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
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative z-10 w-full max-w-md rounded-2xl bg-white  border border-slate-100"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
            <CalendarDays className="h-4.5 w-4.5" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">Apply for Leave</h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg p-1 text-slate-600 hover:bg-slate-50 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={formik.handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>Leave Type *</label>
            <select
              name="leaveType"
              value={formik.values.leaveType}
              onChange={formik.handleChange}
              className={inputCls}
            >
              {LEAVE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>From Date *</label>
              <input
                type="date"
                name="fromDate"
                value={formik.values.fromDate}
                onChange={formik.handleChange}
                className={inputCls}
              />
              {formik.touched.fromDate && formik.errors.fromDate && (
                <p className="mt-1 text-xs text-red-500">{formik.errors.fromDate}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>To Date *</label>
              <input
                type="date"
                name="toDate"
                value={formik.values.toDate}
                onChange={formik.handleChange}
                className={inputCls}
              />
              {formik.touched.toDate && formik.errors.toDate && (
                <p className="mt-1 text-xs text-red-500">{formik.errors.toDate}</p>
              )}
            </div>
          </div>
          {days > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-2"
            >
              <CalendarDays className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-primary">
                {days} day{days > 1 ? 's' : ''}
              </p>
            </motion.div>
          )}
          <div>
            <label className={labelCls}>Reason *</label>
            <textarea
              name="reason"
              rows={3}
              value={formik.values.reason}
              onChange={formik.handleChange}
              placeholder="Reason for leave…"
              className={inputCls + ' resize-none'}
            />
            {formik.touched.reason && formik.errors.reason && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.reason}</p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton variant="primary" type="submit" loading={isLoading}>
              Apply Leave
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Decision Modal ───────────────────────────────────────────────────────────
function DecisionModal({
  leave,
  isHod,
  isAdminApprover,
  onClose,
  onSaved,
}: {
  leave: ILeave;
  isHod: boolean;
  isAdminApprover: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const [reason, setReason] = useState('');
  const [action, setAction] = useState<'approved' | 'rejected'>('approved');

  const atHodStage = leave.hodApproval === 'pending' || leave.hodApproval === undefined;
  const endpoint = useMemo(() => {
    if (atHodStage && isHod)
      return action === 'approved'
        ? `leave/${leave._id}/hod-approve`
        : `leave/${leave._id}/hod-reject`;
    if (!atHodStage && isAdminApprover)
      return action === 'approved' ? `leave/${leave._id}/approve` : `leave/${leave._id}/reject`;
    return null;
  }, [action, atHodStage, isAdminApprover, isHod, leave._id]);

  const handleSubmit = async () => {
    if (!endpoint) return;
    if (action === 'rejected' && !reason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    const res = await mutation(endpoint, {
      method: 'PUT',
      body: action === 'rejected' ? { reason } : {},
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success(action === 'approved' ? 'Leave approved' : 'Leave rejected');
      onSaved();
    }
  };

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
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative z-10 w-full max-w-sm rounded-2xl bg-white  border border-slate-100"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
            <CheckCircle className="h-4.5 w-4.5" />
          </div>
          <h2 className="text-sm font-semibold text-slate-900">
            {atHodStage ? 'Department Review' : 'Final Leave Decision'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg p-1 text-slate-600 hover:bg-slate-50 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-800 capitalize">
              {leave.leaveType.replace('_', ' ')} Leave · {leave.totalDays ?? '—'} days
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              {fmtDate(leave.fromDate)} – {fmtDate(leave.toDate)}
            </p>
            {leave.employeeName && (
              <p className="mt-1 text-xs text-slate-500">By: {leave.employeeName}</p>
            )}
            <p className="mt-1 text-xs text-slate-500 italic">&ldquo;{leave.reason}&rdquo;</p>
          </div>
          <div className="flex gap-3">
            {(['approved', 'rejected'] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAction(a)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold capitalize transition-all border ${
                  action === a
                    ? a === 'approved'
                      ? 'border-green-200 bg-green-50 text-green-600'
                      : 'border-red-200 bg-red-50 text-red-500'
                    : 'border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          {action === 'rejected' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <label className={labelCls}>Rejection Reason *</label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this being rejected?"
                className={inputCls + ' resize-none'}
              />
            </motion.div>
          )}
          <div className="flex justify-end gap-3 pt-1">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton variant="primary" loading={isLoading} onClick={handleSubmit}>
              Submit Decision
            </CustomButton>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Graph 1: Status Donut Chart ─────────────────────────────────────────────
function StatusDonutCard({ records }: { records: ILeave[] }) {
  const total = records.length;
  const pending = records.filter((r) => r.status === 'pending').length;
  const approved = records.filter((r) => r.status === 'approved').length;
  const rejected = records.filter((r) => r.status === 'rejected').length;
  const cancelled = records.filter((r) => r.status === 'cancelled').length;

  const segments = useMemo(
    () =>
      [
        { value: pending, color: STATUS_CFG.pending.color, label: 'Pending' },
        { value: approved, color: STATUS_CFG.approved.color, label: 'Approved' },
        { value: rejected, color: STATUS_CFG.rejected.color, label: 'Rejected' },
        { value: cancelled, color: STATUS_CFG.cancelled.color, label: 'Cancelled' },
      ].filter((s) => s.value > 0),
    [pending, approved, rejected, cancelled],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white p-4 h-full border border-slate-100 flex flex-col justify-between"
    >
      <div className="flex items-center gap-2 mb-2">
        <PieChart className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Status Breakdown
        </span>
      </div>
      {total === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-6 text-slate-300">
          <PieChart className="h-8 w-8 mb-1" />
          <p className="text-[10px]">No leave data</p>
        </div>
      ) : (
        <div className="flex items-center gap-4 py-2">
          <div className="relative shrink-0">
            <DonutChart segments={segments} size={88} strokeWidth={9} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-base font-black text-slate-900">{total}</p>
              <p className="text-[9px] text-slate-600">Total</p>
            </div>
          </div>
          <div className="flex-1 space-y-1 text-[11px]">
            {segments.map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                </span>
                <span className="font-semibold text-slate-800">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Graph 2: Monthly Trends Bar Chart ────────────────────────────────────────
function MonthlyTrendsCard({ records }: { records: ILeave[] }) {
  const data = useMemo(() => {
    const months = [
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
    const counts = Array(12).fill(0);
    records.forEach((r) => {
      const m = new Date(r.fromDate).getMonth();
      counts[m] += r.totalDays ?? 0;
    });

    const max = Math.max(...counts, 1);
    return months.map((label, i) => ({
      label,
      value: counts[i],
      heightPct: Math.round((counts[i] / max) * 100),
    }));
  }, [records]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="rounded-2xl bg-white p-4 h-full border border-slate-100 flex flex-col justify-between"
    >
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="h-4 w-4 text-emerald-500" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Leave Duration Trend
        </span>
      </div>
      <div className="flex h-24 items-end gap-1.5 pt-2 border-b border-slate-100">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex flex-1 flex-col items-center group relative h-full justify-end"
          >
            {d.value > 0 && (
              <div className="absolute bottom-full mb-1 scale-0 rounded bg-slate-850 px-1 py-0.5 text-[9px] text-white transition-all group-hover:scale-100">
                {d.value}d
              </div>
            )}
            <div
              className={`w-full rounded-t-xs transition-all duration-500 ${d.value > 0 ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-50'}`}
              style={{ height: `${Math.max(d.heightPct, 4)}%` }}
            />
            <span className="mt-1.5 text-[8px] text-slate-600 font-semibold">{d.label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Graph 3: Leave Type Gauge Card ───────────────────────────────────────────
function LeaveTypeGaugeCard({ records }: { records: ILeave[] }) {
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    records.forEach((r) => {
      map[r.leaveType] = (map[r.leaveType] || 0) + 1;
    });
    const sorted = Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    const max = sorted[0]?.[1] || 1;
    return sorted.map(([type, count]) => ({
      type,
      count,
      pct: Math.round((count / max) * 100),
    }));
  }, [records]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl bg-white p-4 h-full border border-slate-100 flex flex-col justify-between"
    >
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="h-4 w-4 text-indigo-500" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Top Types Applied
        </span>
      </div>
      {counts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-6 text-slate-300">
          <TrendingUp className="h-8 w-8 mb-1" />
          <p className="text-[10px]">No leave types logged</p>
        </div>
      ) : (
        <div className="space-y-3 py-1 flex-1 flex flex-col justify-center">
          {counts.map((c, i) => (
            <div key={c.type} className="text-[11px]">
              <div className="flex justify-between mb-1 text-slate-600">
                <span className="capitalize">{c.type.replace('_', ' ')}</span>
                <span className="font-semibold text-slate-800">{c.count}</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${c.pct}%`,
                    backgroundColor: BALANCE_COLORS[i % BALANCE_COLORS.length],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── Balance Panel ────────────────────────────────────────────────────────────
function BalancePanel({ academicYear }: { academicYear: string }) {
  const {
    data: raw,
    error,
    isLoading,
    mutate,
  } = useSwr(
    academicYear ? `leave/balance?academicYear=${encodeURIComponent(academicYear)}` : null,
  );
  const ledger = (raw as { data?: ILeaveBalanceLedger | null })?.data;
  const balances: ILeaveBalance[] = ledger
    ? [
        {
          leaveType: 'casual',
          entitled: ledger.casual,
          used: ledger.casualUsed,
          available: ledger.casual - ledger.casualUsed,
        },
        {
          leaveType: 'sick',
          entitled: ledger.sick,
          used: ledger.sickUsed,
          available: ledger.sick - ledger.sickUsed,
        },
        {
          leaveType: 'earned',
          entitled: ledger.earned,
          used: ledger.earnedUsed,
          available: ledger.earned - ledger.earnedUsed,
        },
        {
          leaveType: 'on_duty',
          entitled: ledger.onDuty,
          used: ledger.onDutyUsed,
          available: ledger.onDuty - ledger.onDutyUsed,
        },
      ]
    : [];
  if (!academicYear) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        Select an academic year to load your recorded leave balance.
      </div>
    );
  }
  if (isLoading)
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
    );
  if (error) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">Leave balance could not be loaded.</p>
        <CustomButton variant="tertiary" type="button" onClick={() => mutate()}>
          Retry
        </CustomButton>
      </div>
    );
  }
  if (!balances.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        No leave balance ledger has been configured for {academicYear}.
      </div>
    );
  }
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
        Available Balance
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {balances.slice(0, 4).map((b, i) => {
          const color = BALANCE_COLORS[i % BALANCE_COLORS.length];
          const pct = b.entitled > 0 ? Math.round((b.available / b.entitled) * 100) : 0;
          return (
            <motion.div
              key={b.leaveType}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative rounded-2xl bg-white p-3 border border-slate-100 overflow-hidden"
            >
              <div
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ backgroundColor: color }}
              />
              <div className="flex items-center justify-between gap-1.5">
                <div className="pl-1">
                  <p className="text-[9px] font-semibold  tracking-wider text-slate-600 truncate max-w-24 capitalize">
                    {b.leaveType.replace('_', ' ')}
                  </p>
                  <p className="mt-0.5 text-xl font-black text-slate-900">{b.available}</p>
                </div>
                <div className="shrink-0 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-slate-500 px-1.5 py-0.5 bg-slate-50 rounded border border-slate-100">
                    {pct}%
                  </span>
                </div>
              </div>
              <progress
                className="mt-2 h-1.5 w-full accent-primary"
                value={Math.max(0, b.available)}
                max={Math.max(1, b.entitled)}
                aria-label={`${b.leaveType.replace('_', ' ')} leave available`}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Mini stat cards ──────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon,
  colorCls,
  delay = 0,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  colorCls: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="flex items-center gap-3 rounded-2xl bg-white p-4 border border-slate-100"
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colorCls}`}>
        {icon}
      </div>
      <div>
        <p className="text-xl font-black text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LeavePage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const isHod = ['super_admin', 'hod'].includes(activeRole ?? '');
  const isAdminApprover = ['super_admin', 'principal'].includes(activeRole ?? '');
  const isApprover = isHod || isAdminApprover;
  const canUseLeave = Boolean(activeRole && !['student', 'parent'].includes(activeRole));
  const { mutation: actMutation } = useMutation();

  const [showApply, setShowApply] = useState(false);
  const [decisionItem, setDecisionItem] = useState<ILeave | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [tab, setTab] = useState<'mine' | 'all'>(isApprover ? 'all' : 'mine');
  const visibleTab: 'mine' | 'all' = !isApprover && tab === 'all' ? 'mine' : tab;
  const [page, setPage] = useState(1);

  const handleFilter = (v: string) => {
    setFilterStatus(v);
    setPage(1);
  };
  const handleTypeFilter = (v: string) => {
    setFilterType(v);
    setPage(1);
  };
  const handleTab = (v: 'mine' | 'all') => {
    setTab(v);
    setPage(1);
  };

  const allEndpointUrl = useMemo(() => {
    const q = new URLSearchParams();
    q.set('page', String(page));
    q.set('limit', '15');
    if (filterStatus) q.set('status', filterStatus);
    if (filterType) q.set('leaveType', filterType);
    return `leave?${q.toString()}`;
  }, [page, filterStatus, filterType]);

  const mineEndpointUrl = useMemo(() => {
    const q = new URLSearchParams();
    q.set('page', String(page));
    q.set('limit', '15');
    if (filterStatus) q.set('status', filterStatus);
    if (filterType) q.set('leaveType', filterType);
    return `leave/my?${q.toString()}`;
  }, [page, filterStatus, filterType]);

  const {
    data: rawMine,
    error: mineError,
    isLoading: loadingMine,
    mutate: mutateMine,
  } = useSwr(canUseLeave && visibleTab === 'mine' ? mineEndpointUrl : null);
  const {
    data: rawAll,
    error: allError,
    isLoading: loadingAll,
    mutate: mutateAll,
  } = useSwr(visibleTab === 'all' && isApprover ? allEndpointUrl : null);

  const myRecords: ILeave[] =
    (rawMine as { data?: { data?: ILeave[] } })?.data?.data ??
    (rawMine as { data?: ILeave[] })?.data ??
    [];
  const allRecords: ILeave[] =
    (rawAll as { data?: { data?: ILeave[] } })?.data?.data ??
    (rawAll as { data?: ILeave[] })?.data ??
    [];

  const records = visibleTab === 'mine' ? myRecords : allRecords;
  const totalCount =
    visibleTab === 'mine'
      ? ((rawMine as { data?: { total?: number } })?.data?.total ?? myRecords.length)
      : ((rawAll as { data?: { total?: number } })?.data?.total ?? allRecords.length);
  const isLoading = visibleTab === 'mine' ? loadingMine : loadingAll;
  const loadError = visibleTab === 'mine' ? mineError : allError;

  const pending = records.filter((r) => r.status === 'pending').length;
  const approved = records.filter((r) => r.status === 'approved').length;
  const total = records.length;

  const canActOn = (r: ILeave) => {
    if (r.status !== 'pending') return false;
    const atHodStage = r.hodApproval === 'pending' || r.hodApproval === undefined;
    if (atHodStage) return isHod;
    if (r.hodApproval === 'approved') return isAdminApprover && r.adminApproval === 'pending';
    return false;
  };

  const columns: Column<ILeave>[] = [
    ...(visibleTab === 'all'
      ? [
          {
            field: 'employeeName' as keyof ILeave,
            title: 'Applicant',
            render: (r: ILeave) => (
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary">
                  {(r.employeeName ?? 'E').charAt(0)}
                </div>
                <p className="text-sm text-slate-700">
                  {r.employeeName ??
                    (typeof r.employeeId === 'object' ? r.employeeId.name : undefined) ??
                    'Employee'}
                </p>
              </div>
            ),
          },
        ]
      : []),
    {
      field: 'leaveType',
      title: 'Type',
      render: (r) => (
        <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary capitalize">
          {r.leaveType.replace('_', ' ')}
        </span>
      ),
    },
    {
      field: 'fromDate',
      title: 'Duration',
      render: (r) => (
        <div>
          <p className="text-xs font-medium text-slate-700">{fmtDate(r.fromDate)}</p>
          <p className="text-xs text-slate-600">→ {fmtDate(r.toDate)}</p>
        </div>
      ),
    },
    {
      field: 'totalDays',
      title: 'Days',
      render: (r) => (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
          {r.totalDays ?? '—'}
        </span>
      ),
    },
    {
      field: 'status',
      title: 'Status',
      render: (r) => {
        const c = STATUS_CFG[r.status] ?? STATUS_CFG.pending;
        return (
          <span
            className={`flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
            {c.label}
          </span>
        );
      },
    },
  ];

  const actions: Action<ILeave>[] = [
    ...(isApprover
      ? ([
          {
            tooltip: 'Approve / Reject',
            icon: <CheckCircle className="h-4 w-4 text-green-500" />,
            onClick: (r: ILeave) => setDecisionItem(r),
            hidden: (r: ILeave) => !canActOn(r),
          },
        ] as Action<ILeave>[])
      : []),
    {
      tooltip: 'Cancel',
      icon: <XCircle className="h-4 w-4 text-red-500" />,
      onClick: async (r: ILeave) => {
        const conf = await Swal.fire({
          title: 'Cancel leave request?',
          text: 'This will withdraw the request.',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Yes, cancel',
          confirmButtonColor: '#0178D7',
        });
        if (!conf.isConfirmed) return;
        const res = await actMutation(`leave/${r._id}/cancel`, { method: 'PUT', isAlert: true });
        if ((res as { results?: { success?: boolean } })?.results?.success) {
          toast.success('Leave cancelled');
          if (visibleTab === 'mine') mutateMine();
          else mutateAll();
        }
      },
      hidden: (r: ILeave) => visibleTab !== 'mine' || r.status !== 'pending',
    },
  ];

  if (!canUseLeave) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-lg font-semibold text-slate-900">Employee leave access unavailable</h1>
        <p className="mt-1 text-sm text-slate-600">
          The active role is not an employee role authorized for leave requests.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <FacultyHrWorkflowBar />

      {/* ── Section Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isApprover
              ? activeRole === 'hod'
                ? 'Department Leave Approvals'
                : 'Institution Leave Control'
              : 'My Leave Applications'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isApprover
              ? 'Review, approve, or reject employee leave requests and monitor entitlement balances'
              : 'Apply for leaves, track approval status, and check your available entitlement balances'}
          </p>
        </div>
        <div>
          <CustomButton startIcon={<Plus className="h-4 w-4" />} onClick={() => setShowApply(true)}>
            Apply Leave
          </CustomButton>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Requests"
          value={total}
          icon={<Users className="h-4.5 w-4.5" />}
          colorCls="bg-primary-50 text-primary"
          delay={0}
        />
        <StatCard
          label="Pending Review"
          value={pending}
          icon={<Clock className="h-4.5 w-4.5" />}
          colorCls="bg-amber-50 text-amber-600"
          delay={0.06}
        />
        <StatCard
          label="Approved"
          value={approved}
          icon={<CheckCircle className="h-4.5 w-4.5" />}
          colorCls="bg-green-50 text-green-600"
          delay={0.12}
        />
      </div>

      {/* ── 3-Column SVG Charts Row ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatusDonutCard records={records} />
        <MonthlyTrendsCard records={records} />
        <LeaveTypeGaugeCard records={records} />
      </div>

      <div className="max-w-xs">
        <AsyncSelect
          type="academicYears"
          label="Leave balance academic year"
          value={academicYear || null}
          onChange={(value) => setAcademicYear(value ?? '')}
          placeholder="Select academic year"
        />
      </div>

      <BalancePanel academicYear={academicYear} />

      {/* ── Filters & Small Tab switcher ── */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4  flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-40">
            <select
              value={filterStatus}
              onChange={(e) => handleFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-primary focus:bg-white transition h-9"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="w-40">
            <select
              value={filterType}
              onChange={(e) => handleTypeFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-primary focus:bg-white transition h-9"
            >
              <option value="">All Types</option>
              {LEAVE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
          {(filterStatus || filterType) && (
            <button
              type="button"
              onClick={() => {
                handleFilter('');
                handleTypeFilter('');
              }}
              className="text-xs text-slate-600 hover:text-slate-600 underline h-9 flex items-center"
            >
              Clear filters
            </button>
          )}
        </div>

        {isApprover && (
          <div className="flex w-68 gap-1 rounded-xl bg-slate-100 p-1 h-10 shrink-0">
            {[
              {
                id: 'all' as const,
                label: 'All Requests',
                icon: <Users className="h-3.5 w-3.5" />,
              },
              {
                id: 'mine' as const,
                label: 'My Leaves',
                icon: <CalendarDays className="h-3.5 w-3.5" />,
              },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all ${
                  visibleTab === t.id
                    ? 'bg-primary text-white  px-3'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Table ── */}
      {loadError && (
        <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-red-800">Leave requests could not be loaded</p>
            <p className="text-sm text-red-700">Check your connection or access, then try again.</p>
          </div>
          <CustomButton
            variant="tertiary"
            type="button"
            onClick={() => (visibleTab === 'mine' ? mutateMine() : mutateAll())}
          >
            Retry
          </CustomButton>
        </div>
      )}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
      >
        <CustomTable<ILeave>
          title={visibleTab === 'all' ? 'All Leave Requests' : 'My Leave Applications'}
          description={
            visibleTab === 'all'
              ? 'Review and action leave requests from all employees'
              : 'Track your leave applications and their status'
          }
          onRefresh={() => {
            if (visibleTab === 'mine') mutateMine();
            else mutateAll();
          }}
          isRefreshing={isLoading}
          data={records}
          columns={columns}
          actions={actions}
          isLoading={isLoading}
          page={page}
          totalCount={totalCount}
          pageSize={15}
          onPageChange={setPage}
          options={{
            search: false,
            pagination: true,
            pageSize: 15,
            actionsType: 'dropdown',
            export: false,
          }}
          customActions={
            <CustomButton
              variant="primary"
              startIcon={<Plus className="h-4 w-4" />}
              onClick={() => setShowApply(true)}
            >
              Apply Leave
            </CustomButton>
          }
        />
      </motion.div>

      <AnimatePresence>
        {showApply && (
          <ApplyModal
            onClose={() => setShowApply(false)}
            onSaved={() => {
              mutateMine();
              setShowApply(false);
            }}
          />
        )}
        {decisionItem && (
          <DecisionModal
            leave={decisionItem}
            isHod={isHod}
            isAdminApprover={isAdminApprover}
            onClose={() => setDecisionItem(null)}
            onSaved={() => {
              mutateAll();
              mutateMine();
              setDecisionItem(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

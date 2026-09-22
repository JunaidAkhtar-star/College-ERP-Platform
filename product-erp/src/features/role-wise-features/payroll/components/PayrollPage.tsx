/**
 * @file PayrollPage.tsx
 * @description Payroll management — list payslips, generate payroll, mark as paid.
 * @module features/role-wise-features/payroll
 */

'use client';

import React, { FormEvent, useState, useMemo } from 'react';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import {
  Banknote,
  CheckCircle,
  Clock,
  Users,
  Zap,
  FileText,
  Mail,
  ShieldCheck,
  Settings2,
  PieChart,
  BarChart3,
  TrendingUp,
  X,
} from 'lucide-react';
import { downloadPdf } from '@/shared/utils';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import CustomButton from '@/shared/core/CustomButton';
import FacultyHrWorkflowBar from '@/shared/components/FacultyHrWorkflowBar';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { IPayslip } from '../types/payroll.types';
import { useHasPermission } from '@/shared/hooks/useHasPermission';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

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

// ─── Graph 1: Cost Breakdown Donut ──────────────────────────────────────────
function CostBreakdownCard({
  netTotal,
  pfTotal,
  tdsTotal,
}: {
  netTotal: number;
  pfTotal: number;
  tdsTotal: number;
}) {
  const total = netTotal + pfTotal + tdsTotal;
  const segments = useMemo(
    () =>
      [
        { value: netTotal, color: '#6366f1', label: 'Net Salary' },
        { value: pfTotal, color: '#f59e0b', label: 'PF Contribution' },
        { value: tdsTotal, color: '#ef4444', label: 'TDS Deduction' },
      ].filter((s) => s.value > 0),
    [netTotal, pfTotal, tdsTotal],
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
          Payroll Fund Split
        </span>
      </div>
      {total === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-6 text-slate-300">
          <PieChart className="h-8 w-8 mb-1" />
          <p className="text-[10px]">No payroll data</p>
        </div>
      ) : (
        <div className="flex items-center gap-4 py-2">
          <div className="relative shrink-0">
            <DonutChart segments={segments} size={88} strokeWidth={9} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-sm font-black text-slate-900">₹{(total / 1000).toFixed(0)}k</p>
              <p className="text-[9px] text-slate-600">Total Fund</p>
            </div>
          </div>
          <div className="flex-1 space-y-1 text-[11px]">
            {segments.map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                </span>
                <span className="font-semibold text-slate-800">
                  ₹{s.value.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Graph 2: Net Pay Trends ──────────────────────────────────────────────────
function NetPayTrendsCard({ records }: { records: IPayslip[] }) {
  const data = useMemo(() => {
    const list = [...records].slice(0, 6).reverse();
    const max = Math.max(...list.map((r) => r.grossPay), 1);
    return list.map((r) => ({
      name: r.employeeName,
      netPct: Math.round((r.netPay / max) * 100),
      grossPct: Math.round((r.grossPay / max) * 100),
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
          Salary Structure (Net vs Gross)
        </span>
      </div>
      {data.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-6 text-slate-300">
          <BarChart3 className="h-8 w-8 mb-1" />
          <p className="text-[10px]">No salary logs</p>
        </div>
      ) : (
        <div className="space-y-3 py-1 flex-1 flex flex-col justify-center">
          {data.map((d, i) => (
            <div key={i} className="text-[11px] space-y-1">
              <span className="truncate block font-medium text-slate-600 max-w-44">{d.name}</span>
              <div className="h-3 w-full bg-slate-50 rounded overflow-hidden flex flex-col gap-0.5">
                <div className="h-1 rounded bg-indigo-500" style={{ width: `${d.netPct}%` }} />
                <div className="h-1 rounded bg-slate-300" style={{ width: `${d.grossPct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── Graph 3: Paid Ratio Gauge ───────────────────────────────────────────────
function PaidRatioCard({ paid, total }: { paid: number; total: number }) {
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
  const strokeColor = pct < 50 ? '#f59e0b' : '#22c55e';

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
          Disbursement Progress
        </span>
      </div>
      <div className="flex items-center gap-4 py-2">
        <div className="relative shrink-0 flex items-center justify-center">
          <svg width={72} height={72} viewBox="0 0 72 72" className="-rotate-90">
            <circle cx="36" cy="36" r="30" fill="none" stroke="#f1f5f9" strokeWidth={6} />
            <circle
              cx="36"
              cy="36"
              r="30"
              fill="none"
              stroke={strokeColor}
              strokeWidth={6}
              strokeDasharray={`${pct * 1.88} 188`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.7s ease' }}
            />
          </svg>
          <span className="absolute text-xs font-bold text-slate-800">{pct}%</span>
        </div>
        <div className="text-[11px] text-slate-500 flex-1 space-y-1.5">
          <div className="flex justify-between">
            <span>Paid Slips:</span>
            <span className="font-bold text-slate-800">{paid}</span>
          </div>
          <div className="flex justify-between">
            <span>Pending Slips:</span>
            <span className="font-bold text-slate-800">{total - paid}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Stat summary card component ──────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon,
  colorCls,
  delay = 0,
}: {
  label: string;
  value: string | number;
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
export default function PayrollPage() {
  const canView = useHasPermission('payroll', 'view');
  const hasCreatePermission = useHasPermission('payroll', 'create');
  const hasEditPermission = useHasPermission('payroll', 'edit');
  const hasApprovePermission = useHasPermission('payroll', 'approve');
  const hasExportPermission = useHasPermission('payroll', 'export');
  const canMarkPaid = hasApprovePermission;
  const canReview = hasEditPermission;
  const canApprove = hasApprovePermission;
  const canGenerate = hasCreatePermission;
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterPaid, setFilterPaid] = useState('');
  const [page, setPage] = useState(1);
  const [showPolicy, setShowPolicy] = useState(false);

  const handleMonth = (v: string) => {
    setFilterMonth(v);
    setPage(1);
  };
  const handleYear = (v: string) => {
    setFilterYear(v);
    setPage(1);
  };
  const handlePaid = (v: string) => {
    setFilterPaid(v);
    setPage(1);
  };

  const apiUrl = useMemo(() => {
    const q = new URLSearchParams();
    q.set('page', String(page));
    q.set('limit', '15');
    if (filterMonth) q.set('month', filterMonth);
    if (filterYear) q.set('year', filterYear);
    if (filterPaid === 'paid') q.set('isPaid', 'true');
    if (filterPaid === 'unpaid') q.set('isPaid', 'false');
    return `payroll?${q.toString()}`;
  }, [page, filterMonth, filterYear, filterPaid]);

  const { data: raw, error, isLoading, isValidating, mutate } = useSwr(canView ? apiUrl : null);
  const records = useMemo(
    () => (raw as { data?: { data?: IPayslip[]; total?: number } })?.data?.data ?? [],
    [raw],
  );
  const totalCount = useMemo(
    () => (raw as { data?: { total?: number } })?.data?.total ?? records.length,
    [raw, records],
  );
  const { mutation, isLoading: acting } = useMutation();
  const policyQuery = useSwr(canGenerate ? 'payroll/policy' : null);
  const policies =
    (policyQuery.data as { data?: Array<{ name: string; effectiveFrom: string }> } | undefined)
      ?.data ?? [];

  const summaryUrl = useMemo(() => {
    if (!filterMonth || !filterYear) return null;
    return `payroll/summary?month=${filterMonth}&year=${filterYear}`;
  }, [filterMonth, filterYear]);
  interface ISummaryAgg {
    totalGross?: number;
    totalNet?: number;
    totalPF?: number;
    totalTDS?: number;
    count?: number;
  }
  const { data: summaryRaw } = useSwr<{ data?: ISummaryAgg[] }>(canView ? summaryUrl : null);
  const summary = summaryRaw?.data?.[0];

  const totalNetPay = records.reduce((s, r) => s + r.netPay, 0);
  const totalPaid = records.filter((r) => r.isPaid).length;

  const handleGenerate = async () => {
    if (!filterMonth || !filterYear) {
      toast.error('Select a payroll month and year first');
      return;
    }
    const currentMonth = Number(filterMonth);
    const currentYear = Number(filterYear);
    const confirm = await Swal.fire({
      title: 'Generate Payroll',
      html: `<p class="text-sm text-gray-500">Generate payslips for <strong>${MONTHS[currentMonth - 1]} ${currentYear}</strong>?</p>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Generate',
      confirmButtonColor: '#0178D7',
    });
    if (confirm.isConfirmed) {
      await mutation('payroll/generate-monthly', {
        method: 'POST',
        body: { month: currentMonth, year: currentYear },
        isAlert: true,
      });
      mutate();
    }
  };

  const transition = async (row: IPayslip, action: 'review' | 'approve') => {
    const answer = await Swal.fire({
      title: action === 'review' ? 'Confirm payroll review?' : 'Approve payroll for payment?',
      text: `${row.employeeName} · ${MONTHS[row.month - 1]} ${row.year} · ₹${row.netPay.toLocaleString('en-IN')}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: action === 'review' ? 'Mark reviewed' : 'Approve payroll',
    });
    if (!answer.isConfirmed) return;
    const result = await mutation(`payroll/${row._id}/${action}`, {
      method: 'PUT',
      body: {},
      isAlert: true,
    });
    if (result) mutate();
  };

  const handleMarkPaid = async (row: IPayslip) => {
    const confirm = await Swal.fire({
      title: 'Mark as Paid?',
      text: `${row.employeeName} — ₹${row.netPay.toLocaleString()} for ${MONTHS[row.month - 1]} ${row.year}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Mark Paid',
      confirmButtonColor: '#0178D7',
    });
    if (confirm.isConfirmed) {
      await mutation(`payroll/${row._id}/pay`, {
        method: 'PUT',
        body: { paymentMode: 'bank_transfer', paymentDate: new Date().toISOString() },
        isAlert: true,
      });
      mutate();
    }
  };

  const handleDownloadForm16 = async (row: IPayslip) => {
    const ok = await downloadPdf(
      `payroll/employee/${row.employeeId}/form16`,
      `form-16-${row.employeeName.replace(/\s+/g, '-').toLowerCase()}-${row.year}.pdf`,
    );
    if (!ok) toast.error('Unable to download Form 16');
  };

  const handleSendPayslip = async (row: IPayslip) => {
    const res = await mutation(`payroll/${row._id}/send-email`, { method: 'POST', isAlert: true });
    if (res) toast.success('Payslip emailed successfully');
  };

  if (!canView) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Payroll access unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">Your active role cannot view payroll records.</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Payroll could not be loaded</h1>
        <p className="mt-2 text-sm text-red-600">{error.message}</p>
        <CustomButton className="mx-auto mt-4 w-fit!" onClick={() => mutate()}>
          Try again
        </CustomButton>
      </div>
    );
  }

  const columns: Column<IPayslip>[] = [
    {
      field: 'employeeName',
      title: 'Employee',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary">
            {row.employeeName.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">{row.employeeName}</p>
            <p className="text-xs text-slate-600">{row.designation}</p>
          </div>
        </div>
      ),
    },
    {
      field: 'month',
      title: 'Period',
      render: (row) => (
        <span className="text-sm text-slate-700 font-medium">
          {MONTHS[row.month - 1]} {row.year}
        </span>
      ),
    },
    {
      field: 'grossPay',
      title: 'Gross Pay',
      render: (row) => (
        <span className="text-sm font-medium text-slate-700">₹{row.grossPay.toLocaleString()}</span>
      ),
    },
    {
      field: 'totalDeductions',
      title: 'Deductions',
      render: (row) => (
        <span className="text-sm text-red-500 font-medium">
          −₹{row.totalDeductions.toLocaleString()}
        </span>
      ),
    },
    {
      field: 'netPay',
      title: 'Net Pay',
      render: (row) => (
        <span className="text-sm font-bold text-slate-800">₹{row.netPay.toLocaleString()}</span>
      ),
    },
    {
      field: 'status',
      title: 'Status',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            row.status === 'paid'
              ? 'bg-secondary-50 text-secondary'
              : row.status === 'approved'
                ? 'bg-green-50 text-green-600'
                : row.status === 'reviewed'
                  ? 'bg-blue-50 text-blue-600'
                  : 'bg-amber-50 text-amber-600'
          }`}
        >
          {(row.status ?? (row.isPaid ? 'paid' : 'draft')).replaceAll('_', ' ')}
        </span>
      ),
    },
  ];

  const actions: Action<IPayslip>[] = [
    {
      tooltip: 'Review payroll',
      icon: <ShieldCheck className="h-4 w-4 text-blue-500" />,
      onClick: (row) => transition(row, 'review'),
      hidden: (row) => (row.status ?? 'draft') !== 'draft' || !canReview,
    },
    {
      tooltip: 'Approve payroll',
      icon: <CheckCircle className="h-4 w-4 text-green-600" />,
      onClick: (row) => transition(row, 'approve'),
      hidden: (row) => row.status !== 'reviewed' || !canApprove,
    },
    {
      tooltip: 'Mark as Paid',
      icon: <CheckCircle className="h-4 w-4 text-secondary" />,
      onClick: handleMarkPaid,
      hidden: (row) => row.status !== 'approved' || !canMarkPaid,
    },
    {
      tooltip: 'Download Form 16',
      icon: <FileText className="h-4 w-4 text-blue-500" />,
      onClick: handleDownloadForm16,
      hidden: (row) => !row.isPaid || !hasExportPermission,
    },
    {
      tooltip: 'Send Payslip by Email',
      icon: <Mail className="h-4 w-4 text-slate-500" />,
      onClick: handleSendPayslip,
      hidden: () => !hasCreatePermission,
    },
  ];

  return (
    <div className="space-y-5">
      <FacultyHrWorkflowBar />

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-base font-bold text-slate-900">Monthly payroll workflow</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Salary preparation moves through four controlled stages before payment.
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold text-blue-700">
            HR prepares · Accounts approves
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['01', 'Policy ready', 'HR confirms salary rules and approved leave.'],
            ['02', 'Payroll prepared', 'Monthly gross pay and deductions are calculated.'],
            ['03', 'Reviewed & approved', 'HR reviews; Accounts authorizes payment.'],
            ['04', 'Paid & published', 'Payment is recorded before payslips are shared.'],
          ].map(([step, title, description]) => (
            <div key={step} className="flex gap-3 rounded-xl bg-slate-50 p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-black text-blue-600">
                {step}
              </span>
              <div>
                <p className="text-xs font-bold text-slate-800">{title}</p>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats Summary Row ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total Payslips"
          value={totalCount}
          icon={<Users className="h-4.5 w-4.5" />}
          colorCls="bg-primary-50 text-primary"
          delay={0}
        />
        <StatCard
          label="Total Net Pay"
          value={`₹${totalNetPay.toLocaleString('en-IN')}`}
          icon={<Banknote className="h-4.5 w-4.5" />}
          colorCls="bg-secondary-50 text-secondary"
          delay={0.05}
        />
        <StatCard
          label="Paid Slips"
          value={totalPaid}
          icon={<CheckCircle className="h-4.5 w-4.5" />}
          colorCls="bg-green-50 text-green-600"
          delay={0.1}
        />
        <StatCard
          label="Pending Payment"
          value={totalCount - totalPaid}
          icon={<Clock className="h-4.5 w-4.5" />}
          colorCls="bg-amber-50 text-amber-600"
          delay={0.15}
        />
      </div>

      {/* ── 3-Column SVG Charts Row ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <CostBreakdownCard
          netTotal={summary?.totalNet ?? 0}
          pfTotal={summary?.totalPF ?? 0}
          tdsTotal={summary?.totalTDS ?? 0}
        />
        <NetPayTrendsCard records={records} />
        <PaidRatioCard paid={totalPaid} total={totalCount} />
      </div>

      {/* ── Filters ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3">
          <h2 className="text-sm font-bold text-slate-900">Reporting period</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Choose a month and year to review or prepare one payroll cycle.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-40">
            <select
              value={filterMonth}
              onChange={(e) => handleMonth(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-primary focus:bg-white transition h-9"
            >
              <option value="">All Months</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={String(i + 1)}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <input
              type="number"
              value={filterYear}
              onChange={(e) => handleYear(e.target.value)}
              placeholder="Year"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-primary focus:bg-white transition h-9"
            />
          </div>
          <div className="w-40">
            <select
              value={filterPaid}
              onChange={(e) => handlePaid(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-primary focus:bg-white transition h-9"
            >
              <option value="">All Status</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Pending</option>
            </select>
          </div>
          {(filterMonth || filterPaid) && (
            <button
              type="button"
              onClick={() => {
                handleMonth('');
                handlePaid('');
              }}
              className="text-xs text-slate-600 hover:text-slate-600 underline h-9 flex items-center"
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      {/* ── Table ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
      >
        <CustomTable<IPayslip>
          title="Payroll & Payslips"
          description={
            canGenerate
              ? 'Prepare, review and track salary payments for the selected reporting period.'
              : 'Read-only payroll register for institutional oversight and reporting.'
          }
          onRefresh={() => void mutate()}
          isRefreshing={isValidating}
          data={records}
          columns={columns}
          actions={actions.length ? actions : undefined}
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
            <div className="flex items-center gap-2 whitespace-nowrap">
              {canReview && (
                <CustomButton
                  variant="secondary"
                  startIcon={<Settings2 className="h-4 w-4" />}
                  onClick={() => setShowPolicy(true)}
                >
                  Payroll Policy
                </CustomButton>
              )}
              {canGenerate && (
                <CustomButton
                  startIcon={<Zap className="h-4 w-4" />}
                  onClick={handleGenerate}
                  loading={acting}
                >
                  Prepare Monthly Payroll
                </CustomButton>
              )}
            </div>
          }
          localization={{
            body: {
              emptyDataSourceMessage:
                filterMonth && filterYear
                  ? `No payroll has been prepared for ${MONTHS[Number(filterMonth) - 1]} ${filterYear}.`
                  : 'No payroll records are available. Select a month and year to review a payroll cycle.',
            },
          }}
        />
      </motion.div>

      <AnimatePresence>
        {showPolicy && (
          <PayrollPolicyModal
            current={policies[0]}
            onClose={() => setShowPolicy(false)}
            onSaved={() => {
              policyQuery.mutate();
              setShowPolicy(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function PayrollPolicyModal({
  current,
  onClose,
  onSaved,
}: {
  current?: { name: string; effectiveFrom: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const [slabs, setSlabs] = useState([{ from: 0, to: '', ratePercent: 0 }]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await mutation('payroll/policy', {
      method: 'POST',
      body: {
        name: String(form.get('name') ?? ''),
        effectiveFrom: String(form.get('effectiveFrom') ?? ''),
        daPercent: Number(form.get('daPercent')),
        hraPercent: Number(form.get('hraPercent')),
        transportAllowance: Number(form.get('transportAllowance')),
        employeePfPercent: Number(form.get('employeePfPercent')),
        pfWageCeiling: Number(form.get('pfWageCeiling')) || undefined,
        professionalTax: Number(form.get('professionalTax')),
        standardDeduction: Number(form.get('standardDeduction')),
        taxSlabs: slabs.map((slab) => ({
          from: slab.from,
          to: slab.to === '' ? undefined : Number(slab.to),
          ratePercent: slab.ratePercent,
        })),
      },
      isAlert: true,
    });
    if (result) onSaved();
  };
  const field =
    'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-primary/20 transition';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white  border border-slate-100">
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
            <Settings2 className="h-4.5 w-4.5" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">Effective Payroll Policy</h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg p-1 text-slate-600 hover:bg-slate-50 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            {current
              ? `Current: ${current.name}, effective ${new Date(current.effectiveFrom).toLocaleDateString('en-IN')}. A new policy takes effect from its selected date.`
              : 'Create the first governed payroll policy before processing salaries.'}
          </p>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['name', 'Policy name', 'text'],
                ['effectiveFrom', 'Effective from', 'date'],
                ['daPercent', 'DA percentage', 'number'],
                ['hraPercent', 'HRA percentage', 'number'],
                ['transportAllowance', 'Monthly transport allowance', 'number'],
                ['employeePfPercent', 'Employee PF percentage', 'number'],
                ['pfWageCeiling', 'PF wage ceiling (optional)', 'number'],
                ['professionalTax', 'Monthly professional tax', 'number'],
                ['standardDeduction', 'Annual standard deduction', 'number'],
              ].map(([name, title, type]) => (
                <label key={name}>
                  <span className="mb-1 block text-xs font-semibold text-slate-600">{title}</span>
                  <input
                    name={name}
                    type={type}
                    min={type === 'number' ? 0 : undefined}
                    step={type === 'number' ? '0.01' : undefined}
                    className={field}
                    required={name !== 'pfWageCeiling'}
                  />
                </label>
              ))}
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800">Annual tax slabs</p>
                  <p className="text-xs text-slate-500">
                    Enter continuous ranges in ascending order.
                  </p>
                </div>
                <CustomButton
                  variant="tertiary"
                  onClick={() =>
                    setSlabs((rows) => [
                      ...rows,
                      { from: Number(rows.at(-1)?.to || 0), to: '', ratePercent: 0 },
                    ])
                  }
                >
                  Add slab
                </CustomButton>
              </div>
              <div className="space-y-2">
                {slabs.map((slab, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 rounded-lg bg-slate-50 p-2 border border-slate-100"
                  >
                    <input
                      aria-label={`Slab ${index + 1} from`}
                      type="number"
                      min={0}
                      className={field}
                      value={slab.from}
                      onChange={(e) =>
                        setSlabs((rows) =>
                          rows.map((row, i) =>
                            i === index ? { ...row, from: Number(e.target.value) } : row,
                          ),
                        )
                      }
                    />
                    <input
                      aria-label={`Slab ${index + 1} to`}
                      type="number"
                      min={0}
                      className={field}
                      value={slab.to}
                      placeholder="No upper limit"
                      onChange={(e) =>
                        setSlabs((rows) =>
                          rows.map((row, i) =>
                            i === index ? { ...row, to: e.target.value } : row,
                          ),
                        )
                      }
                    />
                    <input
                      aria-label={`Slab ${index + 1} rate`}
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      className={field}
                      value={slab.ratePercent}
                      onChange={(e) =>
                        setSlabs((rows) =>
                          rows.map((row, i) =>
                            i === index ? { ...row, ratePercent: Number(e.target.value) } : row,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      disabled={slabs.length === 1}
                      onClick={() => setSlabs((rows) => rows.filter((_, i) => i !== index))}
                      className="text-xs text-red-500 disabled:opacity-30 px-2 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <CustomButton variant="cancel" onClick={onClose}>
                Cancel
              </CustomButton>
              <CustomButton type="submit" loading={isLoading}>
                Save new policy
              </CustomButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

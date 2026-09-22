/**
 * @file AdmissionPage.tsx
 * @description Admission Management - applications, merit list, counseling.
 * @module features/role-wise-features/admission
 */

'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'nextjs-toploader/app';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import {
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  Search,
  Filter,
  Eye,
  Check,
  X,
  Calendar,
  Award,
  Plus,
  UserPlus,
  Banknote,
  Upload,
  Download,
  Trash2,
  Edit2,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import CustomButton from '@/shared/core/CustomButton';
import AsyncSelect from '@/shared/core/AsyncSelect';
import AdmissionWorkflowBar from '@/shared/components/AdmissionWorkflowBar';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useAuthStore } from '@/shared/store/authStore';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { downloadPdf } from '@/shared/utils';
import {
  IAdmissionApplication,
  IAdmissionFilters,
  TApplicationStatus,
} from '../types/admission.types';

const STATUS_CONFIG: Record<
  TApplicationStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  draft: {
    label: 'Draft',
    color: 'bg-slate-100 text-slate-500',
    icon: <FileText className="h-3 w-3" />,
  },
  submitted: {
    label: 'Submitted',
    color: 'bg-blue-50 text-blue-600',
    icon: <Check className="h-3 w-3" />,
  },
  under_review: {
    label: 'Under Review',
    color: 'bg-yellow-50 text-yellow-700',
    icon: <Clock className="h-3 w-3" />,
  },
  document_verification: {
    label: 'Doc Verification',
    color: 'bg-yellow-50 text-yellow-600',
    icon: <Clock className="h-3 w-3" />,
  },
  merit_list: {
    label: 'Merit List',
    color: 'bg-purple-50 text-purple-600',
    icon: <Award className="h-3 w-3" />,
  },
  counseling_scheduled: {
    label: 'Counseling',
    color: 'bg-indigo-50 text-indigo-600',
    icon: <Calendar className="h-3 w-3" />,
  },
  seat_allocated: {
    label: 'Seat Allocated',
    color: 'bg-cyan-50 text-cyan-600',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  pending_approval: {
    label: 'Pending Approval',
    color: 'bg-orange-50 text-orange-600',
    icon: <Clock className="h-3 w-3" />,
  },
  approved: {
    label: 'Approved',
    color: 'bg-secondary-50 text-secondary',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  fee_pending: {
    label: 'Fee Pending',
    color: 'bg-amber-50 text-amber-600',
    icon: <Clock className="h-3 w-3" />,
  },
  enrolled: {
    label: 'Enrolled',
    color: 'bg-secondary-50 text-secondary',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-red-50 text-red-500',
    icon: <XCircle className="h-3 w-3" />,
  },
  withdrawn: {
    label: 'Withdrawn',
    color: 'bg-slate-100 text-slate-500',
    icon: <X className="h-3 w-3" />,
  },
};

const programmeLabel = (value: string) =>
  value.includes('_')
    ? value
        .split('_')
        .map((part) => part.toUpperCase())
        .join(' ')
    : value;

/** Extracts the first uploaded passport photo URL from the checklist. */
function getPassportPhotoUrl(app: IAdmissionApplication): string | undefined {
  const item = app.documentChecklist?.find((d) => d.docType === 'passport_photo');
  return item?.files?.[0]?.url ?? item?.uploadedFileUrl;
}

function CandidateAvatar({ app, size = 36 }: { app: IAdmissionApplication; size?: number }) {
  const url = getPassportPhotoUrl(app);
  const initials = (app.candidateName ?? '?')
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  if (url) {
    return (
      <Image
        src={url}
        alt={app.candidateName ?? 'Candidate'}
        width={size}
        height={size}
        unoptimized
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary"
      style={{ width: size, height: size }}
    >
      {initials || '?'}
    </div>
  );
}

function AdmissionPage() {
  const router = useRouter();
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const canView = useHasPermission('admission', 'view');
  const hasEditPermission = useHasPermission('admission', 'edit');
  const hasApprovePermission = useHasPermission('admission', 'approve');
  const canOperate =
    [
      'super_admin',
      'admin',
      'administration_office',
      'assistant_administration_officer',
      'admission_incharge',
      'admission_counselor',
    ].includes(activeRole ?? '') && hasEditPermission;
  const canDecide =
    [
      'super_admin',
      'admin',
      'administration_office',
      'assistant_administration_officer',
      'admission_incharge',
    ].includes(activeRole ?? '') && hasApprovePermission;
  const canManagePayment = ['super_admin', 'admin', 'accounts_department'].includes(
    activeRole ?? '',
  );
  const [filters, setFilters] = useState<IAdmissionFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  // Public status checker state
  const [appNo, setAppNo] = useState('');
  const [submittedNo, setSubmittedNo] = useState<string | null>(null);
  const [statusLookupLoading, setStatusLookupLoading] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.academicYear) params.append('academicYear', filters.academicYear);
    if (filters.program) params.append('program', filters.program);
    if (searchQuery) params.append('search', searchQuery);
    return params.toString() ? `?${params.toString()}` : '';
  }, [filters, searchQuery]);

  const {
    data: admissionsRaw,
    error,
    isLoading,
    isValidating,
    mutate,
  } = useSwr(canView ? `admission/applications${queryString}` : null);

  const applications = useMemo(() => admissionsRaw?.data?.data ?? [], [admissionsRaw]);
  const pagination = useMemo(() => admissionsRaw?.data?.pagination, [admissionsRaw]);

  const { data: dash } = useSwr<{
    byStatus?: { _id: string; count: number }[];
    byProgram?: { _id: string; count: number }[];
    total?: number;
    enrolled?: number;
    pending?: number;
    breakdown?: Record<string, number>;
  }>(
    canView && filters.academicYear
      ? `admission/dashboard?academicYear=${encodeURIComponent(filters.academicYear)}`
      : null,
  );

  const { mutation } = useMutation();

  const handleStartReview = async (app: IAdmissionApplication) => {
    const result = await Swal.fire({
      title: 'Start review?',
      text: `Begin reviewing ${app.candidateName}'s application`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, start',
      confirmButtonColor: '#0178D7',
    });

    if (result.isConfirmed) {
      const res = await mutation(`admission/applications/${app._id}/start-review`, {
        method: 'PATCH',
      });

      if (res?.results?.success) {
        toast.success('Review started');
        mutate();
      }
    }
  };

  const handleApprove = async (app: IAdmissionApplication) => {
    const { value: remarks } = await Swal.fire({
      title: 'Approve Application?',
      input: 'textarea',
      inputLabel: `Remarks for ${app.candidateName}`,
      inputPlaceholder: 'Approval remarks',
      showCancelButton: true,
      confirmButtonText: 'Yes, approve',
      confirmButtonColor: '#0178D7',
      inputValidator: (value) => {
        if (!value) return 'Remarks are required';
      },
    });

    if (remarks) {
      const res = await mutation(`admission/applications/${app._id}/decide`, {
        method: 'PATCH',
        body: { decision: 'approved', remarks },
      });

      if (res?.results?.success) {
        toast.success('Application approved');
        mutate();
      }
    }
  };

  const handleRecordPayment = async (app: IAdmissionApplication) => {
    const result = await Swal.fire({
      title: 'Record Payment',
      html: `
        <input id="amt" type="number" class="swal2-input" placeholder="Amount" />
        <input id="amtWords" class="swal2-input" placeholder="Amount in words" />
        <input id="rcpt" class="swal2-input" placeholder="Receipt No." />
        <input id="rcptDate" type="date" class="swal2-input" />
        <select id="mode" class="swal2-select">
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="net_banking">Net Banking</option>
          <option value="card">Card</option>
        </select>`,
      showCancelButton: true,
      confirmButtonText: 'Record',
      confirmButtonColor: '#0178D7',
      preConfirm: () => {
        const amt = Number((document.getElementById('amt') as HTMLInputElement).value);
        const amtWords = (document.getElementById('amtWords') as HTMLInputElement).value;
        const rcpt = (document.getElementById('rcpt') as HTMLInputElement).value;
        const rcptDate = (document.getElementById('rcptDate') as HTMLInputElement).value;
        const mode = (document.getElementById('mode') as HTMLSelectElement).value;
        if (!amt || !amtWords || !rcpt || !rcptDate || !mode) {
          Swal.showValidationMessage('Fill all fields');
          return null;
        }
        return { amt, amtWords, rcpt, rcptDate, mode };
      },
    });
    if (!result.value) return;
    const { amt, amtWords, rcpt, rcptDate, mode } = result.value as {
      amt: number;
      amtWords: string;
      rcpt: string;
      rcptDate: string;
      mode: string;
    };
    const res = await mutation(`admission/applications/${app._id}/payment`, {
      method: 'PATCH',
      body: {
        amountInNumber: amt,
        amountInWords: amtWords,
        receiptNo: rcpt,
        receiptDate: rcptDate,
        paymentMode: mode,
      },
    });
    if (res?.results?.success) {
      toast.success('Payment recorded');
      mutate();
    } else toast.error('Failed to record payment');
  };

  const handleReject = async (app: IAdmissionApplication) => {
    const { value: reason } = await Swal.fire({
      title: 'Reject Application',
      input: 'textarea',
      inputLabel: 'Rejection Reason',
      inputPlaceholder: 'Enter reason for rejection',
      showCancelButton: true,
      confirmButtonText: 'Reject',
      confirmButtonColor: '#EF4444',
      inputValidator: (value) => {
        if (!value) return 'Please provide a reason';
      },
    });

    if (reason) {
      const res = await mutation(`admission/applications/${app._id}/decide`, {
        method: 'PATCH',
        body: { decision: 'rejected', remarks: reason },
      });

      if (res?.results?.success) {
        toast.success('Application rejected');
        mutate();
      }
    }
  };

  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
  };

  const handleDelete = async (app: IAdmissionApplication) => {
    const result = await Swal.fire({
      title: 'Delete Application & User Account?',
      text: `Are you sure you want to permanently delete application #${app.applicationNumber} for ${app.candidateName}? This will permanently delete the user account and all uploaded documents from Cloudinary.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete permanently',
      cancelButtonText: 'Cancel',
    });

    if (result.isConfirmed) {
      Swal.fire({
        title: 'Deleting Application...',
        text: 'Removing candidate record, user account, and Cloudinary files...',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const res = await mutation(`admission/applications/${app._id}`, {
        method: 'DELETE',
      });

      Swal.close();

      if (res?.results?.success) {
        toast.success('Application and candidate user permanently deleted.');
        mutate();
      }
    }
  };

  const columns: Column<IAdmissionApplication>[] = [
    {
      field: 'applicationNumber',
      title: 'Applicant',
      render: (app) => (
        <div className="flex items-center gap-2.5 whitespace-nowrap">
          <CandidateAvatar app={app} />
          <div>
            <p className="text-sm font-semibold text-slate-800 whitespace-nowrap">
              {app.candidateName}
            </p>
            <p className="text-[11px] font-mono text-slate-600 whitespace-nowrap">
              #{app.applicationNumber}
            </p>
            <span className="inline-block mt-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-600 whitespace-nowrap">
              {app.category}
            </span>
          </div>
        </div>
      ),
    },
    {
      field: 'programPreferences',
      title: 'Program / Stream',
      headerClassName: '!text-center',
      cellClassName: '!text-center',
      render: (app) => {
        const programs = app.programPreferences ?? [];
        return (
          <div className="space-y-1 whitespace-nowrap text-center">
            {app.allocatedProgram ? (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200 whitespace-nowrap">
                {programmeLabel(app.allocatedProgram)}
              </span>
            ) : (
              <div className="space-y-0.5 whitespace-nowrap">
                {programs.slice(0, 2).map((prog: string, i: number) => (
                  <span key={i} className="block text-xs text-slate-600 whitespace-nowrap">
                    {programmeLabel(prog)}
                  </span>
                ))}
                {programs.length > 2 && (
                  <span className="text-xs text-slate-600 whitespace-nowrap">
                    +{programs.length - 2} more
                  </span>
                )}
              </div>
            )}
          </div>
        );
      },
    },
    {
      field: 'status',
      title: 'Status',
      headerClassName: '!text-center',
      cellClassName: '!text-center',
      render: (app) => {
        const config = STATUS_CONFIG[app.status];
        return (
          <span
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${config.color}`}
          >
            {config.icon}
            {config.label}
          </span>
        );
      },
    },
    {
      field: 'paymentDetails' as keyof IAdmissionApplication,
      title: 'Verification & Payment',
      headerClassName: '!text-center',
      cellClassName: '!text-center',
      render: (app) => {
        const docs = app.documentChecklist ?? [];
        const verifiedDocs = docs.filter((d) => d.status === 'verified').length;
        const totalDocs = docs.length;
        const amount = app.paymentDetails?.amountInNumber;
        const isPaid = amount != null && amount > 0;
        return (
          <div className="space-y-1 whitespace-nowrap text-center text-xs">
            {totalDocs > 0 ? (
              <p className="text-slate-700 font-medium whitespace-nowrap">
                Docs:{' '}
                <span className="font-bold text-slate-900">
                  {verifiedDocs}/{totalDocs} Verified
                </span>
              </p>
            ) : (
              <p className="text-slate-600 whitespace-nowrap">No docs checklist</p>
            )}
            {isPaid ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 whitespace-nowrap">
                ₹{amount.toLocaleString('en-IN')} Paid
              </span>
            ) : (
              <span className="text-[11px] text-slate-600 whitespace-nowrap">Payment Pending</span>
            )}
          </div>
        );
      },
    },
    {
      field: 'createdAt',
      title: 'Applied Date',
      headerClassName: '!text-center',
      cellClassName: '!text-center',
      render: (app) => (
        <div className="whitespace-nowrap text-center text-xs">
          <p className="font-medium text-slate-700 whitespace-nowrap">
            {new Date(app.createdAt).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </p>
          {app.updatedAt && app.status !== 'draft' && (
            <p className="text-[10px] text-slate-600 whitespace-nowrap">
              Updated{' '}
              {new Date(app.updatedAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
              })}
            </p>
          )}
        </div>
      ),
    },
  ];

  const actions: Action<IAdmissionApplication>[] = [
    {
      tooltip: 'View details',
      icon: <Eye className="h-4 w-4 text-slate-600" />,
      onClick: (app) => router.push(`admission/${app._id}`),
    },
    {
      tooltip: 'Edit application form',
      icon: <Edit2 className="h-4 w-4 text-primary" />,
      onClick: (app) => router.push(`admission/new?appId=${app._id}`),
      hidden: (app) => !canOperate || !['draft', 'submitted'].includes(app.status),
    },
    {
      tooltip: 'Start review',
      icon: <Check className="h-4 w-4 text-blue-600" />,
      onClick: (app) => void handleStartReview(app),
      hidden: (app) => !canOperate || app.status !== 'submitted',
    },
    {
      tooltip: 'Approve application',
      icon: <CheckCircle className="h-4 w-4 text-emerald-600" />,
      onClick: (app) => void handleApprove(app),
      hidden: (app) => !canDecide || app.status !== 'under_review',
    },
    {
      tooltip: 'Delete application and user account',
      icon: <Trash2 className="h-4 w-4 text-rose-600" />,
      onClick: (app) => void handleDelete(app),
      hidden: () => !canOperate,
    },
  ];

  const stats = useMemo(() => {
    return [
      {
        label: 'Total Applications',
        value: dash?.total ?? pagination?.total ?? applications.length,
        icon: <FileText className="h-4.5 w-4.5" />,
        color: 'bg-primary-50 text-primary',
      },
      {
        label: 'Pending Review',
        value:
          dash?.pending ??
          applications.filter((a: IAdmissionApplication) =>
            ['submitted', 'document_verification', 'pending_approval'].includes(a.status),
          ).length,
        icon: <Clock className="h-4.5 w-4.5" />,
        color: 'bg-yellow-50 text-yellow-600',
      },
      {
        label: 'Enrolled / Approved',
        value:
          dash?.enrolled ??
          applications.filter(
            (a: IAdmissionApplication) => a.status === 'approved' || a.status === 'enrolled',
          ).length,
        icon: <CheckCircle className="h-4.5 w-4.5" />,
        color: 'bg-secondary-50 text-secondary',
      },
      {
        label: 'Rejected',
        value: applications.filter((a: IAdmissionApplication) => a.status === 'rejected').length,
        icon: <XCircle className="h-4.5 w-4.5" />,
        color: 'bg-red-50 text-red-500',
      },
    ];
  }, [applications, dash, pagination]);

  if (!canView) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Admission access unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your active role cannot view admission records.
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">
          Admission applications could not be loaded
        </h1>
        <p className="mt-2 text-sm text-red-600">{error.message}</p>
        <CustomButton className="mx-auto mt-4 w-fit!" onClick={() => mutate()}>
          Try again
        </CustomButton>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-2 mb-10">
      <AdmissionWorkflowBar />
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {activeRole === 'admission_counselor'
              ? 'Counseling & Applicant Desk'
              : activeRole === 'admission_incharge'
                ? 'Admission Control Desk'
                : 'Admission Management'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {activeRole === 'admission_counselor'
              ? 'Manage candidate counseling sessions, applications, and student follow-ups'
              : activeRole === 'admission_incharge'
                ? 'Review applications, allocate seats, publish merit lists, and manage enrollments'
                : 'Manage applications, merit list, and enrollment'}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {canOperate && (
            <>
              {/* Bulk Import — ghost outline */}
              <button
                title="Bulk Import"
                onClick={() => setBulkOpen(true)}
                className="group inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600  transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 active:scale-[0.98]"
              >
                <Upload className="h-4 w-4 text-slate-600 transition-transform group-hover:-translate-y-0.5" />
                Bulk Import
              </button>
              {/* Initiate ERP ID — soft outline with accent hint */}
              <button
                onClick={() => router.push('admission/initiate')}
                className="group inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary  transition-all hover:border-primary/60 hover:bg-primary/10 active:scale-[0.98]"
              >
                <UserPlus className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
                Initiate ERP ID
              </button>
              {/* New Application — solid primary */}
              <button
                onClick={() => router.push('admission/new')}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white  transition-all hover:brightness-110 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                New Application
              </button>
            </>
          )}
        </div>
      </motion.div>

      <BulkImportModal open={bulkOpen} onClose={() => setBulkOpen(false)} onDone={() => mutate()} />

      {/* Unified Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl bg-white p-4"
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${stat.color}`}>
              {stat.icon}
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{stat.value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Search & Filters toolbar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl bg-white p-3"
      >
        {/* Compact toolbar row */}
        <div className="flex items-center gap-2">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
            <input
              type="text"
              placeholder="Search by name, application number…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-50 transition-colors"
            />
          </div>

          {/* Filter toggle icon-button */}
          <button
            title="Filters"
            onClick={() => setShowFilters(!showFilters)}
            className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all active:scale-95 ${
              showFilters || Object.keys(filters).length > 0
                ? 'border-primary bg-primary text-white '
                : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-primary hover:text-primary'
            }`}
          >
            <Filter className="h-4 w-4" />
            {Object.keys(filters).length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                {Object.keys(filters).length}
              </span>
            )}
          </button>

          {/* Clear filters — only visible when active */}
          {Object.keys(filters).length > 0 && (
            <button
              title="Clear all filters"
              onClick={clearFilters}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-500 transition-all hover:bg-rose-100 active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Expandable filter + public status checker panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {/* Filter fields */}
              <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">Status</label>
                  <select
                    value={filters.status ?? ''}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        status: e.target.value as TApplicationStatus,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-50"
                  >
                    <option value="">All Status</option>
                    {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                      <option key={value} value={value}>
                        {config.label}
                      </option>
                    ))}
                  </select>
                </div>
                <AsyncSelect
                  type="academicYears"
                  label="Academic Year"
                  value={filters.academicYear ?? null}
                  onChange={(value) =>
                    setFilters((prev) => ({ ...prev, academicYear: value ?? undefined }))
                  }
                  placeholder="All academic years"
                />
                <AsyncSelect
                  type="programs"
                  label="Programme"
                  value={filters.program ?? null}
                  onChange={(value) =>
                    setFilters((prev) => ({ ...prev, program: value ?? undefined }))
                  }
                  placeholder="All active programmes"
                />
              </div>

              {/* Public Application Status Checker */}
              <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-slate-700">
                    Check Application Status (Public)
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    value={appNo}
                    onChange={(e) => setAppNo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && appNo.trim()) setSubmittedNo(appNo.trim());
                    }}
                    placeholder="e.g. APP2025123456"
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-50"
                  />
                  <button
                    type="button"
                    disabled={!appNo.trim() || statusLookupLoading}
                    onClick={() => {
                      if (!appNo.trim()) {
                        toast.error('Enter an application number');
                        return;
                      }
                      setSubmittedNo(appNo.trim());
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50 active:scale-95"
                  >
                    {statusLookupLoading ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Search className="h-3.5 w-3.5" />
                    )}
                    Check
                  </button>
                </div>
                {/* Status result — fetched inline */}
                <PublicStatusResult
                  submittedNo={submittedNo}
                  onLoadingChange={setStatusLookupLoading}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <DataViewSwitcher<IAdmissionApplication>
          data={applications}
          isLoading={isLoading}
          storageKey="admission.view"
          searchPlaceholder="Search applications…"
          searchFields={['applicationNumber', 'candidateName', 'email', 'phone']}
          showSearch={false}
          renderCard={(app) => {
            const config = STATUS_CONFIG[app.status];
            return (
              <motion.div
                whileHover={{ y: -2 }}
                className="flex flex-col gap-3 rounded-2xl bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <CandidateAvatar app={app} size={44} />
                  {config && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${config.color}`}
                    >
                      {config.label ?? app.status}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{app.candidateName}</p>
                  <p className="text-[11px] font-mono text-slate-600">{app.applicationNumber}</p>
                  {app.allocatedProgram && (
                    <p className="text-xs text-slate-500">Allocated: {app.allocatedProgram}</p>
                  )}
                  {!app.allocatedProgram &&
                    Array.isArray(app.programPreferences) &&
                    app.programPreferences.length > 0 && (
                      <p className="text-xs text-slate-500">
                        Prefs: {app.programPreferences.slice(0, 2).join(', ')}
                        {app.programPreferences.length > 2 ? '…' : ''}
                      </p>
                    )}
                </div>
                <div className="space-y-1 text-xs text-slate-500">
                  <p className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 text-slate-600" />
                    {app.academicYear}
                    {app.session ? ` · ${app.session}` : ''}
                  </p>
                  {app.meritRank != null && (
                    <p className="flex items-center gap-1.5">
                      <Award className="h-3 w-3 text-amber-500" />
                      Rank #{app.meritRank}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3 text-xs">
                  {app.status === 'draft' ? (
                    <button
                      type="button"
                      onClick={() => router.push(`admission/${app._id}`)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white  hover:bg-primary/90 active:scale-[0.97] transition-all"
                    >
                      <FileText className="h-3.5 w-3.5" /> Fill Form
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => router.push(`admission/${app._id}`)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700  hover:bg-slate-50 hover:border-slate-300 active:scale-[0.97] transition-all"
                    >
                      <Eye className="h-3.5 w-3.5 text-slate-500" /> View Details
                    </button>
                  )}
                  {canOperate && app.status === 'submitted' && (
                    <button
                      type="button"
                      onClick={() => handleStartReview(app)}
                      className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
                    >
                      <CheckCircle className="h-3 w-3" /> Start Review
                    </button>
                  )}
                  {canManagePayment && app.status === 'approved' && (
                    <button
                      type="button"
                      onClick={() => handleRecordPayment(app)}
                      className="inline-flex items-center gap-1 font-medium text-green-600 hover:underline"
                    >
                      <Banknote className="h-3 w-3" /> Payment
                    </button>
                  )}
                  {canDecide && app.status === 'under_review' && (
                    <button
                      type="button"
                      onClick={() => handleApprove(app)}
                      className="inline-flex items-center gap-1 font-medium text-green-600 hover:underline"
                    >
                      <Check className="h-3 w-3" /> Approve
                    </button>
                  )}
                  {['submitted', 'under_review'].includes(app.status) && (
                    <button
                      type="button"
                      onClick={() => handleReject(app)}
                      className="inline-flex items-center gap-1 font-medium text-red-500 hover:underline"
                    >
                      <X className="h-3 w-3" /> Reject
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(app)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100 active:scale-[0.97] transition-all"
                    title="Delete Application & User Account"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </motion.div>
            );
          }}
          table={
            <CustomTable
              title="Admission Applications"
              description="Review applicant details, update forms, verify submissions and manage admission decisions."
              onRefresh={() => void mutate()}
              isRefreshing={isValidating}
              data={applications}
              columns={columns}
              actions={actions}
              isLoading={isLoading}
              options={{ search: false, pagination: true, pageSize: 10, actionsType: 'dropdown' }}
            />
          }
        />
      </motion.div>
    </div>
  );
}

export default AdmissionPage;

// ─── Bulk Import Modal ───────────────────────────────────────────────────────────────────
function BulkImportModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [academicYear, setAcademicYear] = useState('');
  const [result, setResult] = useState<{
    total: number;
    created: number;
    failed: number;
    errors: { row: number; email?: string; error: string }[];
  } | null>(null);
  const { mutation, isLoading } = useMutation();

  if (!open) return null;

  const handleTemplate = async () => {
    const ok = await downloadPdf(
      'admission/bulk-import/template',
      'admission-bulk-import-template.csv',
    );
    if (!ok) toast.error('Failed to download template');
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Choose a CSV file first');
      return;
    }
    if (!academicYear) {
      toast.error('Choose an academic year');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    const res = await mutation(
      `admission/bulk-import?academicYear=${encodeURIComponent(academicYear)}`,
      {
        method: 'POST',
        body: fd,
        isFormData: true,
      },
    );
    const data = (res as { results?: { data?: typeof result; success?: boolean } })?.results;
    if (data?.success && data.data) {
      setResult(data.data);
      toast.success(`Imported ${data.data.created} of ${data.data.total} applications`);
      onDone();
    } else {
      toast.error('Bulk import failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">Bulk Import Applications</h2>
          <button type="button" onClick={onClose} className="text-slate-600 hover:text-slate-600">
            ✕
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-700">
            Upload a CSV file with one applicant per row. Download the template below to see all
            required columns. Programs in <code className="font-mono">programPreferences</code>{' '}
            should be semicolon-separated using exact active programme names from Academic master
            data.
          </div>
          <CustomButton
            variant="tertiary"
            startIcon={<Download className="h-4 w-4" />}
            onClick={handleTemplate}
            className="w-fit!"
          >
            Download CSV Template
          </CustomButton>
          <AsyncSelect
            type="academicYears"
            label="Academic Year"
            required
            value={academicYear}
            onChange={(value) => setAcademicYear(value ?? '')}
            placeholder="Select import academic year"
          />
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">CSV File</label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
            />
          </div>

          {result && (
            <div className="space-y-2 rounded-xl bg-slate-50 p-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-base font-bold text-slate-700">{result.total}</p>
                  <p className="text-[10px] text-slate-600">Total</p>
                </div>
                <div>
                  <p className="text-base font-bold text-green-600">{result.created}</p>
                  <p className="text-[10px] text-slate-600">Created</p>
                </div>
                <div>
                  <p className="text-base font-bold text-red-500">{result.failed}</p>
                  <p className="text-[10px] text-slate-600">Failed</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-lg bg-white p-2">
                  {result.errors.map((er, i) => (
                    <div
                      key={i}
                      className="flex gap-2 border-b border-slate-100 py-1 last:border-0"
                    >
                      <span className="shrink-0 text-xs font-medium text-red-500">
                        Row {er.row}
                      </span>
                      <span className="text-xs text-slate-600">
                        {er.email ? `${er.email} — ` : ''}
                        {er.error}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <CustomButton variant="tertiary" onClick={onClose} className="w-fit!">
            Close
          </CustomButton>
          <CustomButton
            variant="primary"
            onClick={handleUpload}
            loading={isLoading}
            disabled={!file}
            className="w-fit!"
          >
            Upload & Import
          </CustomButton>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Public Status Result ──────────────────────────────────────────────
function PublicStatusResult({
  submittedNo,
  onLoadingChange,
}: {
  submittedNo: string | null;
  onLoadingChange: (loading: boolean) => void;
}) {
  const { data: lookupRaw, isLoading: busy } = useSwr<{
    success?: boolean;
    data?: {
      applicationNumber?: string;
      status?: TApplicationStatus;
      meritRank?: number;
      allocatedProgram?: string;
    };
  }>(submittedNo ? `admission/status/${encodeURIComponent(submittedNo)}` : null);

  // Propagate loading state up
  React.useEffect(() => {
    onLoadingChange(busy);
  }, [busy, onLoadingChange]);

  const result = lookupRaw?.data;

  if (!submittedNo) return null;

  if (busy) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Looking up application…
      </div>
    );
  }

  if (!result) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-500">
        <XCircle className="h-3.5 w-3.5" />
        No application found for <span className="font-mono font-semibold">{submittedNo}</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2 rounded-lg border border-primary/20 bg-white p-3"
    >
      <p className="font-mono text-[11px] text-slate-600">{result.applicationNumber}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-3">
        {result.status && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CONFIG[result.status]?.color ?? 'bg-slate-100 text-slate-600'}`}
          >
            {STATUS_CONFIG[result.status]?.label ?? result.status}
          </span>
        )}
        {result.meritRank != null && (
          <span className="text-xs text-slate-600">
            Merit Rank: <span className="font-bold text-primary">#{result.meritRank}</span>
          </span>
        )}
        {result.allocatedProgram && (
          <span className="text-xs text-slate-600">
            Allocated:{' '}
            <span className="font-semibold">{programmeLabel(result.allocatedProgram)}</span>
          </span>
        )}
      </div>
    </motion.div>
  );
}

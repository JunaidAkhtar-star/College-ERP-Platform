/**
 * @file ScholarshipPage.tsx
 * @description Scholarship management — role-aware:
 *   Student: Apply (POST scholarship), view own
 *   Admin: Full list, approve, reject, disburse (PUT scholarship/:id)
 * @module features/role-wise-features/scholarship
 */
'use client';

import React, { useState, useMemo } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { Award, Plus, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import AsyncSelect from '@/shared/core/AsyncSelect';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import FinanceWorkflowBar from '@/shared/components/FinanceWorkflowBar';
import { useAuthStore } from '@/shared/store/authStore';

interface IScholarship {
  _id: string;
  studentId?: string;
  studentName?: string;
  rollNo?: string;
  scholarshipName: string;
  amount: number;
  category: string;
  documents?: string[];
  status: 'applied' | 'under_review' | 'approved' | 'rejected' | 'disbursed';
  remarks?: string;
  disbursedAt?: string;
  createdAt: string;
  [key: string]: unknown;
}

interface IScholarshipScheme {
  _id: string;
  name: string;
  awardingBody: string;
  academicYear: string;
  benefitMode: 'fee_credit' | 'bank_transfer';
  applicationEnd: string;
  maxAwardAmount: number;
  requiredDocumentTypes: string[];
}

interface IOwnedDocument {
  _id: string;
  type: string;
  name: string;
  url: string;
  status: string;
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

const STATUS_CFG = {
  applied: { label: 'Applied', bg: 'bg-blue-50', text: 'text-blue-600' },
  under_review: { label: 'Under Review', bg: 'bg-amber-50', text: 'text-amber-600' },
  approved: { label: 'Approved', bg: 'bg-green-50', text: 'text-green-600' },
  rejected: { label: 'Rejected', bg: 'bg-red-50', text: 'text-red-500' },
  disbursed: { label: 'Disbursed', bg: 'bg-purple-50', text: 'text-purple-600' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
function fmtCurrency(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

// ─── Apply Modal (student) ────────────────────────────────────────────────────
function ApplyModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { mutation, isLoading } = useMutation();
  const { data: schemesRaw } = useSwr('scholarship/schemes');
  const { data: documentsRaw } = useSwr('document/my');
  const schemes: IScholarshipScheme[] = (schemesRaw as { data?: IScholarshipScheme[] })?.data ?? [];
  const documents: IOwnedDocument[] =
    (documentsRaw as { data?: IOwnedDocument[] | { data?: IOwnedDocument[] } })?.data &&
    Array.isArray((documentsRaw as { data?: IOwnedDocument[] }).data)
      ? ((documentsRaw as { data: IOwnedDocument[] }).data as IOwnedDocument[])
      : ((documentsRaw as { data?: { data?: IOwnedDocument[] } })?.data?.data ?? []);
  const formik = useFormik({
    initialValues: {
      schemeId: '',
      amount: 0,
      documentIds: [] as string[],
    },
    validationSchema: Yup.object({
      schemeId: Yup.string().required('Select a scholarship scheme'),
      amount: Yup.number().min(1, 'Amount must be > 0').required(),
    }),
    onSubmit: async (values) => {
      const selectedDocuments = documents
        .filter((document) => values.documentIds.includes(document._id))
        .map((document) => ({ docType: document.type, fileUrl: document.url }));
      const res = await mutation('scholarship', {
        method: 'POST',
        body: {
          schemeId: values.schemeId,
          amount: values.amount,
          documents: selectedDocuments,
        },
        isAlert: true,
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Application submitted');
        onSaved();
      } else toast.error('Failed');
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
        className="relative z-10 w-full max-w-md rounded-2xl bg-white  p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-900">Apply for Scholarship</h2>
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
            <label className={labelCls}>Available Scheme *</label>
            <select
              name="schemeId"
              value={formik.values.schemeId}
              onChange={(event) => {
                const scheme = schemes.find((item) => item._id === event.target.value);
                formik.setFieldValue('schemeId', event.target.value);
                formik.setFieldValue('amount', scheme?.maxAwardAmount ?? 0);
                formik.setFieldValue('documentIds', []);
              }}
              className={inputCls}
            >
              <option value="">Select an open scheme</option>
              {schemes.map((scheme) => (
                <option key={scheme._id} value={scheme._id}>
                  {scheme.name} · {scheme.academicYear} · up to {fmtCurrency(scheme.maxAwardAmount)}
                </option>
              ))}
            </select>
            {formik.touched.schemeId && formik.errors.schemeId && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.schemeId}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Requested Amount (₹) *</label>
            <input
              type="number"
              name="amount"
              min={1}
              max={schemes.find((scheme) => scheme._id === formik.values.schemeId)?.maxAwardAmount}
              value={formik.values.amount}
              onChange={formik.handleChange}
              className={inputCls}
            />
          </div>
          {formik.values.schemeId && (
            <div>
              <label className={labelCls}>Supporting Documents</label>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3">
                {documents.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Upload and verify documents in Document Studio before applying.
                  </p>
                ) : (
                  documents.map((document) => (
                    <label key={document._id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={formik.values.documentIds.includes(document._id)}
                        onChange={(event) =>
                          formik.setFieldValue(
                            'documentIds',
                            event.target.checked
                              ? [...formik.values.documentIds, document._id]
                              : formik.values.documentIds.filter((id) => id !== document._id),
                          )
                        }
                      />
                      <span className="flex-1">{document.name}</span>
                      <span className="capitalize text-slate-600">{document.status}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton variant="primary" type="submit" loading={isLoading}>
              Apply
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Admin Action Modal ───────────────────────────────────────────────────────
function ActionModal({
  scholarship,
  onClose,
  onSaved,
}: {
  scholarship: IScholarship;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const canEdit = useHasPermission('scholarship', 'edit');
  const canReview = activeRole === 'scholarship_cell' && canEdit;
  const canApprove = useHasPermission('scholarship', 'approve');
  const canDisburse = activeRole === 'accounts_department' && canEdit;
  type TAction = 'reviewed' | 'approved' | 'rejected' | 'disbursed';
  const allowedActions: TAction[] =
    scholarship.status === 'applied' && canReview
      ? ['reviewed', 'rejected']
      : scholarship.status === 'under_review' && canApprove
        ? ['approved', 'rejected']
        : scholarship.status === 'approved' && canDisburse
          ? ['disbursed']
          : [];
  const [action, setAction] = useState<TAction>(allowedActions[0] ?? 'rejected');
  const [remarks, setRemarks] = useState('');

  const handleSubmit = async () => {
    const r = await Swal.fire({
      title: `Confirm ${action}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes',
      confirmButtonColor: '#0178D7',
    });
    if (!r.isConfirmed) return;
    const actionPath =
      action === 'reviewed'
        ? 'review'
        : action === 'approved'
          ? 'approve'
          : action === 'rejected'
            ? 'reject'
            : 'disburse';
    const res = await mutation(`scholarship/${scholarship._id}/${actionPath}`, {
      method: 'PUT',
      body: action === 'disbursed' ? { referenceNo: remarks } : { remarks },
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success(`Scholarship ${action}`);
      onSaved();
    } else toast.error('Failed');
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
        exit={{ opacity: 0 }}
        className="relative z-10 w-full max-w-sm rounded-2xl bg-white  p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Update Scholarship</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-600 hover:text-slate-600 text-xl"
          >
            ✕
          </button>
        </div>
        <div className="mb-3 rounded-xl bg-slate-50 p-3">
          <p className="text-sm font-medium">{scholarship.scholarshipName}</p>
          <p className="text-xs text-slate-600">
            {scholarship.studentName} · {fmtCurrency(scholarship.amount)}
          </p>
        </div>
        <div className="space-y-4">
          <div className="flex gap-2">
            {allowedActions.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAction(a)}
                className={`flex-1 rounded-xl py-1.5 text-xs font-semibold capitalize transition-colors ${
                  action === a
                    ? a === 'reviewed'
                      ? 'bg-amber-50 text-amber-700 border border-current/20'
                      : STATUS_CFG[a].bg + ' ' + STATUS_CFG[a].text + ' border border-current/20'
                    : 'bg-slate-50 text-slate-600'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          <div>
            <label className={labelCls}>
              {action === 'disbursed' ? 'Bank / transaction reference *' : 'Remarks'}
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add notes…"
              className={inputCls + ' resize-none'}
            />
          </div>
          <div className="flex justify-end gap-3">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton variant="primary" loading={isLoading} onClick={handleSubmit}>
              Submit
            </CustomButton>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ScholarshipPage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const canView = useHasPermission('scholarship', 'view');
  const canEdit = useHasPermission('scholarship', 'edit');
  const canApprove = useHasPermission('scholarship', 'approve');
  const isStudent = activeRole === 'student';
  const canProcess = canEdit || canApprove;
  const isAdmin = canView && !isStudent;

  const [showApply, setShowApply] = useState(false);
  const [actionItem, setActionItem] = useState<IScholarship | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [page, setPage] = useState(1);

  const handleFilter = (v: string) => {
    setFilterStatus(v);
    setPage(1);
  };

  const apiUrl = useMemo(() => {
    if (isStudent) return 'scholarship/my';
    const q = new URLSearchParams();
    q.set('page', String(page));
    q.set('limit', '15');
    if (filterStatus) q.set('status', filterStatus);
    if (academicYear) q.set('academicYear', academicYear);
    return `scholarship?${q.toString()}`;
  }, [page, filterStatus, academicYear, isStudent]);

  const { data: raw, error, isLoading, mutate } = useSwr(canView ? apiUrl : null);
  const records: IScholarship[] =
    (raw as { data?: { data?: IScholarship[] } })?.data?.data ??
    (raw as { data?: IScholarship[] })?.data ??
    [];
  const totalCount = (raw as { data?: { total?: number } })?.data?.total ?? records.length;

  // Admin aggregate stats — backend summary is the source of truth (full-year totals,
  // not just the current page).
  const { data: summaryRaw } = useSwr(
    isAdmin
      ? `scholarship/summary${academicYear ? `?academicYear=${encodeURIComponent(academicYear)}` : ''}`
      : null,
  );
  const summaryBuckets =
    (summaryRaw as { data?: { _id: string; count: number; totalAmount: number }[] })?.data ?? [];
  const getBucket = (status: string) => summaryBuckets.find((b) => b._id === status);
  const applied = isAdmin
    ? (getBucket('applied')?.count ?? 0) + (getBucket('under_review')?.count ?? 0)
    : records.filter((r) => r.status === 'applied' || r.status === 'under_review').length;
  const approved = isAdmin
    ? (getBucket('approved')?.count ?? 0)
    : records.filter((r) => r.status === 'approved').length;
  const disbursed = isAdmin
    ? (getBucket('disbursed')?.count ?? 0)
    : records.filter((r) => r.status === 'disbursed').length;
  const totalAmt = isAdmin
    ? (getBucket('approved')?.totalAmount ?? 0) + (getBucket('disbursed')?.totalAmount ?? 0)
    : records
        .filter((r) => r.status === 'approved' || r.status === 'disbursed')
        .reduce((s, r) => s + r.amount, 0);

  const columns: Column<IScholarship>[] = [
    {
      field: 'scholarshipName',
      title: 'Scholarship',
      render: (r) => (
        <div>
          <p className="text-sm font-medium">{r.scholarshipName}</p>
          <p className="text-xs text-slate-600 capitalize">{r.category}</p>
        </div>
      ),
    },
    ...(isAdmin
      ? [
          {
            field: 'studentName' as keyof IScholarship,
            title: 'Student',
            render: (r: IScholarship) => (
              <div>
                <p className="text-sm">{String(r.studentName ?? '—')}</p>
                <p className="text-xs font-mono text-slate-600">{String(r.rollNo ?? '')}</p>
              </div>
            ),
          },
        ]
      : []),
    {
      field: 'amount',
      title: 'Amount',
      render: (r) => (
        <span className="text-sm font-bold text-green-600">{fmtCurrency(r.amount)}</span>
      ),
    },
    {
      field: 'status',
      title: 'Status',
      render: (r) => {
        const c = STATUS_CFG[r.status] ?? STATUS_CFG.applied;
        return (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
            {c.label}
          </span>
        );
      },
    },
    {
      field: 'createdAt',
      title: 'Applied',
      render: (r) => <span className="text-xs text-slate-600">{fmtDate(r.createdAt)}</span>,
    },
  ];

  const actions: Action<IScholarship>[] = [
    ...(canProcess
      ? ([
          {
            tooltip: 'Update Status',
            icon: <CheckCircle className="h-4 w-4 text-green-500" />,
            onClick: (r: IScholarship) => setActionItem(r),
            hidden: (r: IScholarship) => r.status === 'disbursed',
          },
        ] as Action<IScholarship>[])
      : []),
  ];

  if (!canView) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Scholarship access unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your active role cannot view scholarship records.
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Scholarships could not be loaded</h1>
        <p className="mt-2 text-sm text-red-600">{error.message}</p>
        <CustomButton className="mx-auto mt-4 w-fit!" onClick={() => mutate()}>
          Try again
        </CustomButton>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <FinanceWorkflowBar />
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Scholarships</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {isAdmin ? 'Manage scholarship applications' : 'Apply and track your scholarships'}
          </p>
        </div>
        {isStudent && (
          <CustomButton
            variant="primary"
            startIcon={<Plus className="h-4 w-4" />}
            onClick={() => setShowApply(true)}
            className="w-fit!"
          >
            Apply
          </CustomButton>
        )}
      </motion.div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: 'Pending',
            value: applied,
            icon: <Clock className="h-4.5 w-4.5" />,
            color: 'bg-amber-50 text-amber-600',
          },
          {
            label: 'Approved',
            value: approved,
            icon: <CheckCircle className="h-4.5 w-4.5" />,
            color: 'bg-green-50 text-green-600',
          },
          {
            label: 'Disbursed',
            value: disbursed,
            icon: <DollarSign className="h-4.5 w-4.5" />,
            color: 'bg-purple-50 text-purple-600',
          },
          {
            label: 'Total Amt',
            value: fmtCurrency(totalAmt),
            icon: <Award className="h-4.5 w-4.5" />,
            color: 'bg-primary-50 text-primary',
          },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="flex items-center gap-3 rounded-xl bg-white p-4"
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.color}`}
            >
              {s.icon}
            </div>
            <div>
              <p className="text-base font-bold text-slate-900">{isLoading ? '—' : s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-white p-3">
        {isAdmin && (
          <div className="min-w-52">
            <AsyncSelect
              type="academicYears"
              placeholder="All academic years"
              value={academicYear || null}
              onChange={(value) => {
                setAcademicYear(value ?? '');
                setPage(1);
              }}
              emptyMessage="No configured academic years are available."
            />
          </div>
        )}
        <select
          value={filterStatus}
          onChange={(e) => handleFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:outline-none"
        >
          <option value="">All</option>
          <option value="applied">Applied</option>
          <option value="under_review">Under Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="disbursed">Disbursed</option>
        </select>
        <span className="ml-auto text-xs text-slate-600">{totalCount} records</span>
      </div>

      <DataViewSwitcher<IScholarship>
        data={records}
        isLoading={isLoading}
        storageKey="scholarship.view"
        searchPlaceholder="Search scholarships…"
        searchFields={['scholarshipName', 'studentName', 'rollNo', 'status']}
        pageSize={20}
        renderCard={(s) => {
          const statusStyle =
            s.status === 'disbursed'
              ? 'bg-green-50 text-green-600'
              : s.status === 'approved'
                ? 'bg-blue-50 text-blue-600'
                : s.status === 'rejected'
                  ? 'bg-red-50 text-red-500'
                  : 'bg-amber-50 text-amber-600';
          return (
            <motion.div
              whileHover={{ y: -2 }}
              className="flex flex-col gap-3 rounded-2xl bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
                  <Award className="h-5 w-5" />
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${statusStyle}`}
                >
                  {(s.status ?? '').replace(/_/g, ' ')}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 line-clamp-2">
                  {s.scholarshipName}
                </p>
                {s.studentName && (
                  <p className="text-xs text-slate-500">
                    {s.studentName}
                    {s.rollNo ? ` · ${s.rollNo}` : ''}
                  </p>
                )}
              </div>
              {s.amount != null && (
                <p className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-800">
                  <DollarSign className="h-4 w-4 text-amber-500" />₹{' '}
                  {Number(s.amount).toLocaleString('en-IN')}
                </p>
              )}
              {canProcess && s.status !== 'disbursed' && (
                <div className="flex items-center justify-end border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setActionItem(s)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <CheckCircle className="h-3 w-3" /> Action
                  </button>
                </div>
              )}
            </motion.div>
          );
        }}
        table={
          <div className="overflow-hidden rounded-2xl bg-white">
            <CustomTable
              data={records}
              columns={columns}
              actions={actions}
              isLoading={isLoading}
              page={page}
              totalCount={totalCount}
              pageSize={15}
              onPageChange={setPage}
              options={{ search: false, pagination: true, pageSize: 15 }}
            />
          </div>
        }
      />

      <AnimatePresence>
        {showApply && (
          <ApplyModal
            onClose={() => setShowApply(false)}
            onSaved={() => {
              mutate();
              setShowApply(false);
            }}
          />
        )}
        {actionItem && (
          <ActionModal
            scholarship={actionItem}
            onClose={() => setActionItem(null)}
            onSaved={() => {
              mutate();
              setActionItem(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

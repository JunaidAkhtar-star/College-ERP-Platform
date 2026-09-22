/**
 * @file SemesterRegistrationPage.tsx
 * @description Semester Registration — role-aware:
 *   Student: build draft & submit registration (POST semester-registration),
 *            view own registrations (GET semester-registration/mine)
 *   HOD/Admin: list/filter, approve, reject (with remarks), bulk approve,
 *              freeze semester window.
 * @module features/role-wise-features/semester-registration
 */
'use client';

import AcademicWorkflowBar from '@/shared/components/AcademicWorkflowBar';
import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Action, Column } from '@/shared/core/CustomTable';
import Empty from '@/shared/core/Empty';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useAuthStore } from '@/shared/store/authStore';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import { useFormik } from 'formik';
import {
  CheckCircle,
  Clock,
  Eye,
  Layers,
  ListChecks,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import * as Yup from 'yup';

import type {
  IRegisteredSubject,
  ISemesterRegistration,
  TRegStatus,
  TSubjectType,
} from '../types/semester-registration.types';

interface ISubject {
  _id: string;
  code: string;
  name: string;
  credits: number;
  type?: TSubjectType;
  semester?: number;
  isElective?: boolean;
  electiveGroup?: string;
  isBacklogEligible?: boolean;
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

const STATUS_CFG: Record<TRegStatus, { label: string; bg: string; text: string; dot: string }> = {
  draft: { label: 'Draft', bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  submitted: { label: 'Submitted', bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-400' },
  approved: { label: 'Approved', bg: 'bg-green-50', text: 'text-green-600', dot: 'bg-green-400' },
  rejected: { label: 'Rejected', bg: 'bg-red-50', text: 'text-red-500', dot: 'bg-red-400' },
  frozen: { label: 'Frozen', bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-400' },
  withdrawn: {
    label: 'Withdrawn',
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    dot: 'bg-slate-400',
  },
};

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function deptName(d: ISemesterRegistration['departmentId']) {
  if (!d) return '—';
  return typeof d === 'object' ? d.name : d;
}

// ─── Register Modal (student) ─────────────────────────────────────────────────
function RegisterModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { mutation, isLoading } = useMutation();
  const [submitMode, setSubmitMode] = useState<'draft' | 'submit'>('draft');

  const formik = useFormik({
    initialValues: {
      targetSemester: 1,
      academicYear: '',
      registeredSubjects: [] as IRegisteredSubject[],
    },
    validationSchema: Yup.object({
      targetSemester: Yup.number().min(1).max(10).required('Target semester required'),
      academicYear: Yup.string().trim().required('Academic year required'),
      registeredSubjects: Yup.array().of(Yup.object()),
    }),
    onSubmit: async (values) => {
      const body = {
        ...values,
        targetSemester: context?.targetSemester ?? Number(values.targetSemester),
        submit: submitMode === 'submit',
      };
      const res = await mutation('semester-registration', {
        method: 'POST',
        body,
        isAlert: true,
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success(
          submitMode === 'submit' ? 'Registration submitted for approval' : 'Draft saved',
        );
        onSaved();
      } else {
        toast.error('Failed to save registration');
      }
    },
  });

  const contextUrl = formik.values.academicYear
    ? `semester-registration/context?academicYear=${encodeURIComponent(formik.values.academicYear)}`
    : null;
  const { data: contextRaw, isLoading: loadingContext } = useSwr(contextUrl);
  const context = (
    contextRaw as
      | {
          data?: {
            rollNumber: string;
            studentName: string;
            program: string;
            branch: string;
            departmentId: string;
            targetSemester: number;
            subjects: ISubject[];
          };
        }
      | undefined
  )?.data;
  const subjects = context?.subjects ?? [];
  const selectableSubjects = subjects.filter(
    (subject) => subject.isElective || subject.isBacklogEligible,
  );

  const totalCredits = formik.values.registeredSubjects.reduce((s, r) => s + (r.credits || 0), 0);

  const addSubject = (sub: ISubject) => {
    if (formik.values.registeredSubjects.some((r) => r.subjectId === sub._id)) return;
    const mandatory = subjects
      .filter((subject) => !subject.isElective && !subject.isBacklogEligible)
      .filter(
        (subject) => !formik.values.registeredSubjects.some((row) => row.subjectId === subject._id),
      )
      .map(
        (subject) =>
          ({
            subjectId: subject._id,
            subjectCode: subject.code,
            subjectName: subject.name,
            credits: subject.credits,
            type: subject.type ?? 'theory',
            isBacklog: false,
          }) as IRegisteredSubject,
      );
    formik.setFieldValue('registeredSubjects', [
      ...formik.values.registeredSubjects,
      ...mandatory,
      {
        subjectId: sub._id,
        subjectCode: sub.code,
        subjectName: sub.name,
        credits: sub.credits,
        type: sub.type ?? 'theory',
        isBacklog: sub.isBacklogEligible ?? false,
      } as IRegisteredSubject,
    ]);
  };

  const removeSubject = (idx: number) => {
    const next = [...formik.values.registeredSubjects];
    next.splice(idx, 1);
    formik.setFieldValue('registeredSubjects', next);
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
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 "
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Register for Semester</h2>
            <p className="text-xs text-slate-500">
              Regular subjects are loaded from your curriculum plan by the backend.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xl text-slate-600 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        <form onSubmit={formik.handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <AsyncSelect
              type="academicYears"
              label="Academic Year"
              required
              value={formik.values.academicYear || null}
              onChange={(value) => {
                formik.setFieldValue('academicYear', value ?? '');
                formik.setFieldValue('registeredSubjects', []);
              }}
              error={formik.touched.academicYear ? formik.errors.academicYear : undefined}
              emptyMessage="No configured academic years are available."
            />
          </div>

          {loadingContext ? (
            <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
          ) : context ? (
            <div className="grid gap-3 rounded-xl bg-primary-50 p-4 text-sm sm:grid-cols-5">
              <div>
                <p className="text-xs text-primary/60">Student</p>
                <p className="font-semibold text-primary">{context.studentName}</p>
              </div>
              <div>
                <p className="text-xs text-primary/60">Roll Number</p>
                <p className="font-semibold text-primary">{context.rollNumber}</p>
              </div>
              <div>
                <p className="text-xs text-primary/60">Programme</p>
                <p className="font-semibold text-primary">{context.program}</p>
              </div>
              <div>
                <p className="text-xs text-primary/60">Branch</p>
                <p className="font-semibold text-primary">{context.branch}</p>
              </div>
              <div>
                <p className="text-xs text-primary/60">Current Semester</p>
                <p className="font-semibold text-primary">Semester {context.targetSemester}</p>
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
              Select your current semester and academic year. Your active section allotment and
              curriculum will be loaded automatically.
            </p>
          )}

          <div className="rounded-xl bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">
                Add Subjects ({totalCredits} credits selected)
              </p>
              <span className="text-[11px] text-slate-600">
                Use this only for elective choices or backlog re-registrations.
              </span>
            </div>
            {!context ? (
              <p className="text-xs text-slate-500">
                Student academic context is not available yet.
              </p>
            ) : subjects.length === 0 ? (
              <p className="text-xs text-slate-500">
                No subjects found for this department/semester.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectableSubjects.map((s) => {
                  const added = formik.values.registeredSubjects.some((r) => r.subjectId === s._id);
                  return (
                    <button
                      key={s._id}
                      type="button"
                      onClick={() => addSubject(s)}
                      disabled={added}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        added
                          ? 'cursor-not-allowed bg-slate-200 text-slate-600'
                          : 'bg-white text-slate-700 hover:bg-primary hover:text-white'
                      }`}
                    >
                      {s.code} · {s.name} ({s.credits}c)
                      {s.isBacklogEligible ? ' · Outstanding backlog' : ' · Elective choice'}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {formik.values.registeredSubjects.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Credits</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Backlog</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {formik.values.registeredSubjects.map((s, idx) => (
                    <tr key={s.subjectId} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-mono">{s.subjectCode}</td>
                      <td className="px-3 py-2">{s.subjectName}</td>
                      <td className="px-3 py-2">{s.credits}</td>
                      <td className="px-3 py-2 capitalize">{s.type.replace('_', ' ')}</td>
                      <td className="px-3 py-2">{s.isBacklog ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeSubject(idx)}
                          className="text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {formik.values.registeredSubjects.length === 0 && (
            <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
              No manual subjects selected. The ERP will register regular curriculum subjects for
              this semester automatically.
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton
              variant="secondary"
              type="submit"
              loading={isLoading && submitMode === 'draft'}
              startIcon={<Save className="h-4 w-4" />}
              onClick={() => setSubmitMode('draft')}
            >
              Save Draft
            </CustomButton>
            <CustomButton
              variant="primary"
              type="submit"
              loading={isLoading && submitMode === 'submit'}
              startIcon={<Send className="h-4 w-4" />}
              onClick={() => setSubmitMode('submit')}
            >
              Submit for Approval
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Detail Drawer ─────────────────────────────────────────────────────────────
function RegistrationDetail({ reg, onClose }: { reg: ISemesterRegistration; onClose: () => void }) {
  const st = STATUS_CFG[reg.status] ?? STATUS_CFG.draft;
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-200/80"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative z-10 h-full w-full max-w-sm overflow-y-auto bg-white p-5 "
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-bold">Registration Details</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xl text-slate-600 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        <div className="space-y-3">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.bg} ${st.text}`}>
            {st.label}
          </span>
          <Row label="Student" value={`${reg.studentName} (${reg.rollNumber})`} />
          <Row label="Program / Branch" value={`${reg.program} · ${reg.branch}`} />
          <Row label="Department" value={deptName(reg.departmentId)} />
          <Row label="Target Semester" value={String(reg.targetSemester)} />
          <Row label="Academic Year" value={reg.academicYear} />
          <Row label="Total Credits" value={String(reg.totalCredits)} />
          {reg.registeredSubjects?.length ? (
            <div>
              <p className="mb-1.5 text-xs text-slate-600">Subjects</p>
              <div className="space-y-1.5">
                {reg.registeredSubjects.map((s) => (
                  <div
                    key={s.subjectId}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="font-mono font-semibold">{s.subjectCode}</p>
                      <p className="text-slate-500">{s.subjectName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-700">{s.credits}c</p>
                      <p className="capitalize text-slate-600">
                        {s.type.replace('_', ' ')}
                        {s.isBacklog ? ' · backlog' : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {reg.remarks && <Row label="Remarks" value={reg.remarks} />}
          {reg.reviewedByName && (
            <Row label="Reviewed By" value={`${reg.reviewedByName} (${fmtDate(reg.reviewedAt)})`} />
          )}
          <Row label="Submitted" value={fmtDate(reg.submittedAt ?? reg.createdAt)} />
        </div>
      </motion.div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-600">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SemesterRegistrationPage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const canView = useHasPermission('semester_registration', 'view');
  const canCreate = useHasPermission('semester_registration', 'create');
  const canReview = useHasPermission('semester_registration', 'approve');
  const isStudent = activeRole === 'student';
  const isStaffRole = ['super_admin', 'principal', 'dean_academic', 'hod'].includes(
    activeRole ?? '',
  );
  const isAdmin = isStaffRole && canReview;

  const [showRegister, setShowRegister] = useState(false);
  const [detailItem, setDetailItem] = useState<ISemesterRegistration | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [showFreeze, setShowFreeze] = useState(false);

  const endpoint = !canView
    ? null
    : isAdmin
      ? `semester-registration${filterStatus ? `?status=${filterStatus}` : ''}`
      : isStudent
        ? 'semester-registration/mine'
        : null;
  const { data: raw, isLoading, isValidating, mutate } = useSwr(endpoint);

  const records: ISemesterRegistration[] = useMemo(() => {
    const r = raw as
      | {
          data?: ISemesterRegistration[] | { data?: ISemesterRegistration[]; pagination?: unknown };
        }
      | undefined;
    const inner = r?.data;
    const rows = Array.isArray(inner)
      ? inner
      : ((inner as { data?: ISemesterRegistration[] } | undefined)?.data ?? []);
    return isStudent && filterStatus ? rows.filter((row) => row.status === filterStatus) : rows;
  }, [raw, isStudent, filterStatus]);

  const { data: statsRaw } = useSwr(isAdmin ? 'semester-registration/stats' : null);
  const stats = useMemo(() => {
    const r = statsRaw as
      | {
          data?:
            | { _id: string; count: number }[]
            | { byStatus?: { _id: string; count: number }[]; total?: number };
        }
      | undefined;
    const inner = r?.data;
    if (Array.isArray(inner)) {
      const total = inner.reduce((a, b) => a + b.count, 0);
      return { total, byStatus: inner };
    }
    return inner as { total?: number; byStatus?: { _id: string; count: number }[] } | undefined;
  }, [statsRaw]);

  const { mutation } = useMutation();

  const handleApprove = async (reg: ISemesterRegistration) => {
    const r = await Swal.fire({
      title: 'Approve registration?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Approve',
      confirmButtonColor: '#0178D7',
    });
    if (!r.isConfirmed) return;
    const res = await mutation(`semester-registration/${reg._id}/approve`, {
      method: 'PATCH',
      body: {},
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Registration approved');
      mutate();
    } else toast.error('Approve failed');
  };

  const handleReject = async (reg: ISemesterRegistration) => {
    const r = await Swal.fire({
      title: 'Reject registration?',
      input: 'textarea',
      inputPlaceholder: 'Explain what the student must correct…',
      inputValidator: (value) =>
        value.trim().length < 5 ? 'Provide at least five characters of feedback' : undefined,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Reject',
      confirmButtonColor: '#dc2626',
    });
    if (!r.isConfirmed) return;
    const res = await mutation(`semester-registration/${reg._id}/reject`, {
      method: 'PATCH',
      body: { remarks: String(r.value).trim() },
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Registration rejected');
      mutate();
    } else toast.error('Reject failed');
  };

  const handleWithdraw = async (reg: ISemesterRegistration) => {
    const confirmation = await Swal.fire({
      title: 'Withdraw this registration?',
      text: 'You can create a corrected registration while the add/drop window remains open.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Withdraw',
      confirmButtonColor: '#dc2626',
    });
    if (!confirmation.isConfirmed) return;
    const response = await mutation(`semester-registration/mine/${reg._id}/withdraw`, {
      method: 'PATCH',
      body: {},
      isAlert: true,
    });
    if ((response as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Registration withdrawn');
      mutate();
    }
  };

  const statusCounts = new Map(stats?.byStatus?.map((item) => [item._id, item.count]) ?? []);
  const submittedCount = isAdmin
    ? (statusCounts.get('submitted') ?? 0)
    : records.filter((r) => r.status === 'submitted').length;
  const approvedCount = isAdmin
    ? (statusCounts.get('approved') ?? 0)
    : records.filter((r) => r.status === 'approved').length;
  const rejectedCount = isAdmin
    ? (statusCounts.get('rejected') ?? 0)
    : records.filter((r) => r.status === 'rejected').length;

  const statsList = useMemo(() => {
    return [
      {
        label: 'Total Registrations',
        value: isAdmin ? (stats?.total ?? records.length) : records.length,
        icon: <Layers className="h-5 w-5" />,
        color: 'bg-primary/10 text-primary border border-primary/20',
      },
      {
        label: 'Submitted (Pending)',
        value: submittedCount,
        icon: <Clock className="h-5 w-5" />,
        color: 'bg-amber-50 text-amber-600 border border-amber-100',
      },
      {
        label: 'Approved',
        value: approvedCount,
        icon: <CheckCircle className="h-5 w-5" />,
        color: 'bg-green-50 text-green-600 border border-green-100',
      },
      {
        label: 'Rejected',
        value: rejectedCount,
        icon: <XCircle className="h-5 w-5" />,
        color: 'bg-red-50 text-red-600 border border-red-100',
      },
    ];
  }, [isAdmin, stats, records.length, submittedCount, approvedCount, rejectedCount]);

  const columns: Column<ISemesterRegistration>[] = [
    ...(isAdmin
      ? [
          {
            field: 'studentName' as keyof ISemesterRegistration,
            title: 'Student',
            render: (r: ISemesterRegistration) => (
              <div>
                <p className="text-sm">{r.studentName}</p>
                <p className="font-mono text-xs text-slate-600">{r.rollNumber}</p>
              </div>
            ),
          },
        ]
      : []),
    {
      field: 'targetSemester',
      title: 'Semester',
      cellClassName: '!text-center',
      render: (r) => (
        <div className="flex justify-center">
          <span className="text-sm font-semibold">Sem {r.targetSemester}</span>
        </div>
      ),
    },
    {
      field: 'academicYear',
      title: 'Year',
      cellClassName: '!text-center',
      render: (r) => (
        <div className="flex justify-center">
          <span className="text-sm">{r.academicYear}</span>
        </div>
      ),
    },
    {
      field: 'branch',
      title: 'Branch',
      cellClassName: '!text-center',
      render: (r) => (
        <div className="flex justify-center">
          <span className="text-sm">{r.branch ?? '—'}</span>
        </div>
      ),
    },
    {
      field: 'totalCredits',
      title: 'Credits',
      cellClassName: '!text-center',
      render: (r) => (
        <div className="flex justify-center">
          <span className="text-sm">{r.totalCredits}</span>
        </div>
      ),
    },
    {
      field: 'status',
      title: 'Status',
      cellClassName: '!text-center',
      render: (r) => {
        const c = STATUS_CFG[r.status] ?? STATUS_CFG.draft;
        return (
          <div className="flex justify-center">
            <span
              className={`flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
              {c.label}
            </span>
          </div>
        );
      },
    },
    {
      field: 'createdAt',
      title: 'Applied',
      cellClassName: '!text-center',
      render: (r) => (
        <div className="flex justify-center">
          <span className="text-xs text-slate-600">{fmtDate(r.submittedAt ?? r.createdAt)}</span>
        </div>
      ),
    },
  ];

  const actions: Action<ISemesterRegistration>[] = [
    {
      tooltip: 'View',
      icon: <Eye className="h-4 w-4 text-violet-600" />,
      onClick: (r) => setDetailItem(r),
    },
    ...(isAdmin
      ? [
          {
            tooltip: 'Approve',
            icon: <CheckCircle className="h-4 w-4 text-green-500" />,
            onClick: (r: ISemesterRegistration) => handleApprove(r),
            hidden: (r: ISemesterRegistration) => r.status !== 'submitted',
          },
          {
            tooltip: 'Reject',
            icon: <XCircle className="h-4 w-4 text-red-500" />,
            onClick: (r: ISemesterRegistration) => handleReject(r),
            hidden: (r: ISemesterRegistration) => r.status !== 'submitted',
          },
        ]
      : []),
    ...(isStudent && canCreate
      ? [
          {
            tooltip: 'Withdraw registration',
            icon: <RotateCcw className="h-4 w-4 text-red-500" />,
            onClick: (r: ISemesterRegistration) => handleWithdraw(r),
            hidden: (r: ISemesterRegistration) =>
              !(['draft', 'submitted', 'rejected'] as TRegStatus[]).includes(r.status),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-5">
      <AcademicWorkflowBar />

      {!endpoint && (
        <Empty
          title="Semester registration access unavailable"
          subTitle="Your active role does not have permission to view or review registrations."
        />
      )}

      {/* Metrics Dashboard */}
      {endpoint && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statsList.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 "
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${s.color}`}
              >
                {s.icon}
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900 leading-none mb-1">
                  {isLoading ? '—' : s.value}
                </p>
                <p className="text-xs font-semibold text-slate-500">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {endpoint && (
        <div className="overflow-hidden rounded-2xl bg-white">
          <CustomTable<ISemesterRegistration>
            title="Semester Registration"
            description={
              isAdmin
                ? 'Review and approve semester registrations'
                : 'Register for your current semester'
            }
            onRefresh={() => mutate()}
            isRefreshing={isValidating}
            data={records}
            columns={columns}
            actions={actions}
            isLoading={isLoading}
            customActions={
              <div className="flex items-center gap-3">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none cursor-pointer"
                >
                  <option value="">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="frozen">Frozen</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
                {isStudent && canCreate && (
                  <CustomButton
                    variant="primary"
                    startIcon={<Plus className="h-4 w-4" />}
                    onClick={() => setShowRegister(true)}
                    className="w-fit!"
                  >
                    New Registration
                  </CustomButton>
                )}
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <CustomButton
                      variant="primary"
                      startIcon={<ListChecks className="h-4 w-4" />}
                      onClick={() => setShowBulk(true)}
                      disabled={records.length === 0}
                      className="w-fit! whitespace-nowrap"
                    >
                      Bulk Approve
                    </CustomButton>
                    <CustomButton
                      variant="secondary"
                      startIcon={<Lock className="h-4 w-4" />}
                      onClick={() => setShowFreeze(true)}
                      disabled={records.length === 0}
                      className="w-fit! whitespace-nowrap"
                    >
                      Freeze Semester
                    </CustomButton>
                  </div>
                )}
              </div>
            }
            options={{
              search: true,
              pagination: true,
              pageSize: 12,
              actionsType: 'dropdown',
              export: false,
            }}
            localization={{ toolbar: { searchPlaceholder: 'Search…' } }}
          />
        </div>
      )}

      <AnimatePresence>
        {showRegister && (
          <RegisterModal
            onClose={() => setShowRegister(false)}
            onSaved={() => {
              mutate();
              setShowRegister(false);
            }}
          />
        )}
        {detailItem && <RegistrationDetail reg={detailItem} onClose={() => setDetailItem(null)} />}
        {showBulk && (
          <BulkApproveModal
            onClose={() => setShowBulk(false)}
            onDone={() => {
              setShowBulk(false);
              mutate();
            }}
          />
        )}
        {showFreeze && (
          <FreezeModal
            onClose={() => setShowFreeze(false)}
            onDone={() => {
              setShowFreeze(false);
              mutate();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Bulk Approve modal ──────────────────────────────────────────────────────
function BulkApproveModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { mutation, isLoading } = useMutation();
  const formik = useFormik({
    initialValues: { departmentId: '', targetSemester: 1, academicYear: '' },
    validationSchema: Yup.object({
      departmentId: Yup.string().trim().required('Required'),
      targetSemester: Yup.number().min(1).max(10).required('Required'),
      academicYear: Yup.string().trim().required('Required'),
    }),
    onSubmit: async (values) => {
      const r = await Swal.fire({
        title: 'Bulk approve registrations?',
        text: 'All submitted registrations matching the filters will be approved.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Approve all',
        confirmButtonColor: '#0178D7',
      });
      if (!r.isConfirmed) return;
      const res = await mutation('semester-registration/bulk-approve', {
        method: 'POST',
        body: { ...values, targetSemester: Number(values.targetSemester) },
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        const count =
          (res as { results?: { data?: { modifiedCount?: number; approvedCount?: number } } })
            ?.results?.data?.modifiedCount ??
          (res as { results?: { data?: { approvedCount?: number } } })?.results?.data
            ?.approvedCount ??
          0;
        toast.success(`Approved ${count} registration(s)`);
        onDone();
      } else toast.error('Bulk approve failed');
    },
  });
  return (
    <BulkFreezeShell
      title="Bulk Approve"
      onClose={onClose}
      formik={formik}
      loading={isLoading}
      submitLabel="Approve"
    />
  );
}

// ─── Freeze modal ────────────────────────────────────────────────────────────
function FreezeModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { mutation, isLoading } = useMutation();
  const formik = useFormik({
    initialValues: { departmentId: '', targetSemester: 1, academicYear: '' },
    validationSchema: Yup.object({
      departmentId: Yup.string().trim().required('Required'),
      targetSemester: Yup.number().min(1).max(10).required('Required'),
      academicYear: Yup.string().trim().required('Required'),
    }),
    onSubmit: async (values) => {
      const r = await Swal.fire({
        title: 'Freeze semester?',
        text: 'No further changes to approved registrations will be allowed.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Freeze',
        confirmButtonColor: '#0178D7',
      });
      if (!r.isConfirmed) return;
      const res = await mutation('semester-registration/freeze', {
        method: 'POST',
        body: { ...values, targetSemester: Number(values.targetSemester) },
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Semester frozen');
        onDone();
      } else toast.error('Freeze failed');
    },
  });
  return (
    <BulkFreezeShell
      title="Freeze Semester"
      onClose={onClose}
      formik={formik}
      loading={isLoading}
      submitLabel="Freeze"
    />
  );
}

// Shared shell for BulkApprove + Freeze
function BulkFreezeShell({
  title,
  onClose,
  formik,
  loading,
  submitLabel,
}: {
  title: string;
  onClose: () => void;
  formik: ReturnType<
    typeof useFormik<{ departmentId: string; targetSemester: number; academicYear: string }>
  >;
  loading: boolean;
  submitLabel: string;
}) {
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
        className="relative z-10 w-full max-w-md rounded-2xl bg-white"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={formik.handleSubmit} className="space-y-4 p-6">
          <div>
            <label className={labelCls}>Department *</label>
            <AsyncSelect
              type="departments"
              placeholder="— Select department —"
              value={formik.values.departmentId || null}
              onChange={(v) => formik.setFieldValue('departmentId', v ?? '')}
              error={
                formik.touched.departmentId && formik.errors.departmentId
                  ? String(formik.errors.departmentId)
                  : undefined
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Target Semester *</label>
              <select className={inputCls} {...formik.getFieldProps('targetSemester')}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((s) => (
                  <option key={s} value={s}>
                    Semester {s}
                  </option>
                ))}
              </select>
            </div>
            <AsyncSelect
              type="academicYears"
              label="Academic Year"
              required
              value={formik.values.academicYear || null}
              onChange={(value) => formik.setFieldValue('academicYear', value ?? '')}
              error={
                formik.touched.academicYear && formik.errors.academicYear
                  ? String(formik.errors.academicYear)
                  : undefined
              }
              emptyMessage="No configured academic years are available."
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <CustomButton variant="cancel" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton type="submit" loading={loading}>
              {submitLabel}
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

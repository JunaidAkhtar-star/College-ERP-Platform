/**
 * @file IqacPage.tsx
 * @description IQAC management — Audits CRUD, Feedback submission and analysis.
 * @module features/role-wise-features/iqac
 */
'use client';
import React, { useEffect, useState, useMemo } from 'react';
import {
  ClipboardList,
  MessageSquare,
  Plus,
  Edit2,
  CircleGauge,
  Target,
  Calculator,
  Save,
  RefreshCw,
  SlidersHorizontal,
  X,
  LayoutDashboard,
  ChevronDown,
  CalendarRange,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import CustomButton from '@/shared/core/CustomButton';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import QualityWorkflowBar from '@/shared/components/QualityWorkflowBar';
import AsyncSelect from '@/shared/core/AsyncSelect';
import Empty from '@/shared/core/Empty';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { useAuthStore } from '@/shared/store/authStore';
import IqacInsights from './IqacInsights';
import IqacFeedbackInsights from './IqacFeedbackInsights';

// ── Types ─────────────────────────────────────────────────────────────────────
type TAuditType = 'academic' | 'administrative' | 'infrastructure' | 'documentation';
type TAuditStatus = 'scheduled' | 'ongoing' | 'completed' | 'closed';
type TFeedbackType =
  | 'student_on_faculty'
  | 'student_course_exit'
  | 'faculty_on_curriculum'
  | 'alumni'
  | 'employer'
  | 'parent';

interface IIQACAudit {
  _id: string;
  academicYear: string;
  auditType: TAuditType;
  auditDate: string;
  status: TAuditStatus;
  overallCompliance?: number;
  actionPlan?: string;
  departmentName?: string;
  departmentId?: string;
  auditedBy?: Array<string | { _id?: string }>;
  findings?: Array<{
    criterion: string;
    observation: string;
    status: 'compliant' | 'partial' | 'non_compliant';
    remark?: string;
  }>;
  [key: string]: unknown;
}

interface IIQACFeedback {
  _id: string;
  feedbackType: TFeedbackType;
  academicYear: string;
  averageScore: number;
  textFeedback?: string;
  createdAt: string;
  [key: string]: unknown;
}

interface IFeedbackAnalysis {
  criterion: string;
  averageScore: number;
  count: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const AUDIT_STATUS_CFG: Record<TAuditStatus, { label: string; bg: string; text: string }> = {
  scheduled: { label: 'Scheduled', bg: 'bg-blue-50', text: 'text-blue-600' },
  ongoing: { label: 'Ongoing', bg: 'bg-amber-50', text: 'text-amber-600' },
  completed: { label: 'Completed', bg: 'bg-green-50', text: 'text-green-600' },
  closed: { label: 'Closed', bg: 'bg-slate-100', text: 'text-slate-500' },
};
const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

function WorkflowGuide({
  title,
  description,
  steps,
}: {
  title: string;
  description: string;
  steps: string[];
}) {
  return (
    <section className="rounded-2xl bg-white p-4 sm:p-5">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-primary">
              {index + 1}
            </span>
            <span className="text-xs font-medium text-slate-600">{step}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Audit Modal ───────────────────────────────────────────────────────────────
const auditSchema = Yup.object({
  academicYear: Yup.string().required('Academic year is required'),
  auditType: Yup.string().required('Audit type is required'),
  auditDate: Yup.string().required('Audit date is required'),
  status: Yup.string().required('Status is required'),
});

function AuditModal({
  audit,
  onClose,
  onSaved,
}: {
  audit: IIQACAudit | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const [departmentId, setDepartmentId] = useState(audit?.departmentId ?? '');
  const [auditedBy, setAuditedBy] = useState<string[]>(
    audit?.auditedBy?.map((user) => (typeof user === 'object' ? String(user._id ?? '') : user)) ??
      [],
  );
  const [findings, setFindings] = useState(audit?.findings ?? []);
  const [criterion, setCriterion] = useState('');
  const [observation, setObservation] = useState('');
  const [findingStatus, setFindingStatus] = useState<'compliant' | 'partial' | 'non_compliant'>(
    'compliant',
  );

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      academicYear: audit?.academicYear ?? '',
      auditType: audit?.auditType ?? 'academic',
      auditDate: audit?.auditDate ? audit.auditDate.slice(0, 10) : '',
      status: audit?.status ?? 'scheduled',
      actionPlan: audit?.actionPlan ?? '',
    },
    validationSchema: auditSchema,
    onSubmit: async (values) => {
      const path = audit ? `iqac/audits/${audit._id}` : 'iqac/audits';
      const method = (audit ? 'PUT' : 'POST') as 'PUT' | 'POST';
      const res = await mutation(path, {
        method,
        body: { ...values, departmentId: departmentId || undefined, auditedBy, findings },
        isAlert: true,
      });
      if (res) {
        onSaved();
        onClose();
      }
    },
  });

  const err = (k: keyof typeof formik.errors) =>
    formik.touched[k] && formik.errors[k] ? String(formik.errors[k]) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 sm:p-6"
      >
        <h2 className="mb-5 text-lg font-semibold text-slate-900">
          {audit ? 'Edit Audit' : 'Create Audit'}
        </h2>
        <form onSubmit={formik.handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <AsyncSelect
                type="academicYears"
                label="Academic Year"
                required
                value={formik.values.academicYear}
                onChange={(value) => formik.setFieldValue('academicYear', value ?? '')}
              />
              {err('academicYear') && (
                <p className="mt-1 text-xs text-red-500">{err('academicYear')}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Audit Type *</label>
              <select className={inputCls} {...formik.getFieldProps('auditType')}>
                <option value="academic">Academic</option>
                <option value="administrative">Administrative</option>
                <option value="infrastructure">Infrastructure</option>
                <option value="documentation">Documentation</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Audit Date *</label>
              <input className={inputCls} type="date" {...formik.getFieldProps('auditDate')} />
              {err('auditDate') && <p className="mt-1 text-xs text-red-500">{err('auditDate')}</p>}
            </div>
            <div>
              <label className={labelCls}>Status *</label>
              <select className={inputCls} {...formik.getFieldProps('status')}>
                {(audit?.status === 'scheduled'
                  ? ['scheduled', 'ongoing']
                  : audit?.status === 'ongoing'
                    ? ['ongoing', 'completed']
                    : audit?.status === 'completed'
                      ? ['completed', 'closed']
                      : [audit?.status ?? 'scheduled']
                ).map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <AsyncSelect
              type="departments"
              label="Department"
              value={departmentId}
              onChange={(value) => setDepartmentId(value ?? '')}
            />
            <AsyncSelect
              type="faculty"
              label="Audit team"
              multiple
              value={auditedBy}
              onChange={(value) => setAuditedBy(value)}
            />
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-700">Audit findings</p>
            <div className="mt-2 space-y-2">
              {findings.map((finding, index) => (
                <div
                  key={`${finding.criterion}-${index}`}
                  className="flex items-start gap-2 rounded-lg bg-white p-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-700">{finding.criterion}</p>
                    <p className="text-[11px] text-slate-500">{finding.observation}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFindings((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    aria-label={`Remove ${finding.criterion} finding`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input
                value={criterion}
                onChange={(event) => setCriterion(event.target.value)}
                placeholder="Criterion / control"
                className={inputCls}
              />
              <select
                value={findingStatus}
                onChange={(event) => setFindingStatus(event.target.value as typeof findingStatus)}
                className={inputCls}
              >
                <option value="compliant">Compliant</option>
                <option value="partial">Partially compliant</option>
                <option value="non_compliant">Non-compliant</option>
              </select>
              <textarea
                value={observation}
                onChange={(event) => setObservation(event.target.value)}
                placeholder="Evidence-based observation"
                rows={2}
                className={`${inputCls} sm:col-span-2`}
              />
            </div>
            <button
              type="button"
              className="mt-2 text-xs font-medium text-primary"
              onClick={() => {
                if (!criterion.trim() || !observation.trim()) {
                  toast.error('Criterion and observation are required');
                  return;
                }
                setFindings((current) => [
                  ...current,
                  {
                    criterion: criterion.trim(),
                    observation: observation.trim(),
                    status: findingStatus,
                  },
                ]);
                setCriterion('');
                setObservation('');
              }}
            >
              Add Finding
            </button>
          </div>
          <div>
            <label className={labelCls}>Action Plan</label>
            <textarea
              className={inputCls}
              rows={3}
              {...formik.getFieldProps('actionPlan')}
              placeholder="Describe corrective actions..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <CustomButton variant="cancel" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton type="submit" loading={isLoading}>
              {audit ? 'Update' : 'Create Audit'}
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Feedback Form ─────────────────────────────────────────────────────────────
const feedbackSchema = Yup.object({
  feedbackType: Yup.string().required('Feedback type is required'),
  academicYear: Yup.string().required('Academic year is required'),
  semesterType: Yup.string().required('Semester type is required'),
  textFeedback: Yup.string().required('Feedback text is required'),
});

function FeedbackForm({ onSaved }: { onSaved: () => void }) {
  const { mutation, isLoading } = useMutation();
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role ?? '',
  );
  const [targetId, setTargetId] = useState('');
  const [ratings, setRatings] = useState([
    { criterion: 'Quality and relevance', score: 3 },
    { criterion: 'Delivery and engagement', score: 3 },
    { criterion: 'Resources and support', score: 3 },
    { criterion: 'Overall satisfaction', score: 3 },
  ]);
  const allowedTypes = [
    activeRole === 'student' && {
      value: 'student_on_faculty',
      label: 'Student feedback on faculty',
    },
    activeRole === 'student' && {
      value: 'student_course_exit',
      label: 'Course-exit outcome survey',
    },
    activeRole === 'faculty' && {
      value: 'faculty_on_curriculum',
      label: 'Faculty feedback on curriculum',
    },
    activeRole === 'placement_cell' && {
      value: 'employer',
      label: 'Employer feedback',
    },
    activeRole === 'parent' && { value: 'parent', label: 'Parent feedback' },
    activeRole === 'alumni' && { value: 'alumni', label: 'Alumni feedback' },
  ].filter(Boolean) as Array<{ value: string; label: string }>;

  const formik = useFormik({
    initialValues: {
      feedbackType: allowedTypes[0]?.value ?? '',
      academicYear: '',
      semesterType: 'odd',
      textFeedback: '',
      isAnonymous: false,
    },
    validationSchema: feedbackSchema,
    onSubmit: async (values, { resetForm }) => {
      const res = await mutation('iqac/feedback', {
        method: 'POST',
        body: { ...values, targetId: targetId || undefined, ratings },
        isAlert: true,
      });
      if (res) {
        resetForm();
        onSaved();
      }
    },
  });
  const courseOutcomeUrl =
    formik.values.feedbackType === 'student_course_exit' && targetId
      ? `iqac/copo/course-outcomes?subjectId=${encodeURIComponent(targetId)}`
      : null;
  const { data: courseOutcomeRaw } = useSwr<{
    data?: { outcomes?: Array<{ coCode: string; description: string }> };
  }>(courseOutcomeUrl);
  useEffect(() => {
    if (formik.values.feedbackType !== 'student_course_exit') return;
    const outcomes = courseOutcomeRaw?.data?.outcomes ?? [];
    if (!outcomes.length) return;
    // Course outcomes arrive asynchronously from the authoritative curriculum.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRatings(outcomes.map((outcome) => ({ criterion: outcome.coCode, score: 3 })));
  }, [courseOutcomeRaw, formik.values.feedbackType]);

  const err = (k: keyof typeof formik.errors) =>
    formik.touched[k] && formik.errors[k] ? String(formik.errors[k]) : undefined;

  return (
    <div className="rounded-2xl bg-white p-6">
      <h3 className="mb-4 text-base font-semibold text-slate-800">Submit Feedback</h3>
      <form onSubmit={formik.handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Feedback Type *</label>
          <select
            className={inputCls}
            value={formik.values.feedbackType}
            onChange={(event) => {
              formik.setFieldValue('feedbackType', event.target.value);
              setTargetId('');
              if (event.target.value !== 'student_course_exit') {
                setRatings([
                  { criterion: 'Quality and relevance', score: 3 },
                  { criterion: 'Delivery and engagement', score: 3 },
                  { criterion: 'Resources and support', score: 3 },
                  { criterion: 'Overall satisfaction', score: 3 },
                ]);
              } else setRatings([]);
            }}
            onBlur={formik.handleBlur}
            name="feedbackType"
          >
            <option value="">Select feedback type</option>
            {allowedTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          {err('feedbackType') && (
            <p className="mt-1 text-xs text-red-500">{err('feedbackType')}</p>
          )}
        </div>
        <div>
          <label className={labelCls}>Academic Year *</label>
          <AsyncSelect
            type="academicYears"
            value={formik.values.academicYear}
            onChange={(value) => formik.setFieldValue('academicYear', value ?? '')}
          />
          {err('academicYear') && (
            <p className="mt-1 text-xs text-red-500">{err('academicYear')}</p>
          )}
        </div>
        <div>
          <label className={labelCls}>Semester *</label>
          <select className={inputCls} {...formik.getFieldProps('semesterType')}>
            <option value="odd">Odd</option>
            <option value="even">Even</option>
          </select>
        </div>
        {formik.values.feedbackType === 'student_on_faculty' && (
          <AsyncSelect
            type="faculty"
            label="Faculty member"
            required
            value={targetId}
            onChange={(value) => setTargetId(value ?? '')}
          />
        )}
        {formik.values.feedbackType === 'student_course_exit' && (
          <AsyncSelect
            type="subjects"
            label="Completed course"
            required
            value={targetId}
            onChange={(value) => setTargetId(value ?? '')}
            placeholder="Select subject to load course outcomes"
          />
        )}
        {formik.values.feedbackType === 'faculty_on_curriculum' && (
          <AsyncSelect
            type="curricula"
            label="Curriculum"
            required
            value={targetId}
            onChange={(value) => setTargetId(value ?? '')}
          />
        )}
        <div className="flex items-center gap-2 pt-5">
          <input
            type="checkbox"
            id="anon"
            {...formik.getFieldProps('isAnonymous')}
            className="h-4 w-4 accent-primary"
          />
          <label htmlFor="anon" className="text-sm text-slate-600">
            Submit anonymously
          </label>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Quality ratings *</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {ratings.map((rating, index) => (
              <div
                key={rating.criterion}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
              >
                <span className="text-xs text-slate-600">{rating.criterion}</span>
                <select
                  value={rating.score}
                  onChange={(event) =>
                    setRatings((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, score: Number(event.target.value) } : item,
                      ),
                    )
                  }
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                >
                  {[1, 2, 3, 4, 5].map((score) => (
                    <option key={score} value={score}>
                      {score} / 5
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Feedback *</label>
          <textarea
            className={inputCls}
            rows={4}
            {...formik.getFieldProps('textFeedback')}
            placeholder="Your detailed feedback..."
          />
          {err('textFeedback') && (
            <p className="mt-1 text-xs text-red-500">{err('textFeedback')}</p>
          )}
        </div>
        <div className="flex justify-end sm:col-span-2">
          <CustomButton
            type="submit"
            loading={isLoading}
            startIcon={<MessageSquare className="h-4 w-4" />}
          >
            Submit Feedback
          </CustomButton>
        </div>
      </form>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function IqacPage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role ?? '',
  );
  const feedbackSubmitters = ['student', 'faculty', 'placement_cell', 'parent', 'alumni'];
  const canViewIqac = useHasPermission('iqac', 'view');
  const canCreateIqac = useHasPermission('iqac', 'create');
  const canEditIqac = useHasPermission('iqac', 'edit');
  const canViewAudits = canViewIqac;
  const canCreateAudits = canCreateIqac;
  const canEditAudits = canEditIqac;
  const canViewFeedback = canViewIqac;
  const canViewAnalysis = canViewIqac;
  const canSubmitFeedback = feedbackSubmitters.includes(activeRole) && canCreateIqac;
  const [academicYear, setAcademicYear] = useState('');
  const [analysisType, setAnalysisType] = useState<TFeedbackType>('student_on_faculty');

  const [tab, setTab] = useState<'overview' | 'audits' | 'feedback' | 'copo'>('overview');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editAudit, setEditAudit] = useState<IIQACAudit | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const handleFilterType = (v: string) => {
    setFilterType(v);
    setPage(1);
  };
  const handleFilterStatus = (v: string) => {
    setFilterStatus(v);
    setPage(1);
  };

  const auditUrl = useMemo(() => {
    const q = new URLSearchParams();
    q.set('page', String(page));
    q.set('limit', '15');
    q.set('academicYear', academicYear);
    if (filterType) q.set('auditType', filterType);
    if (filterStatus) q.set('status', filterStatus);
    return academicYear ? `iqac/audits?${q.toString()}` : null;
  }, [page, filterType, filterStatus, academicYear]);

  const {
    data: auditRaw,
    isLoading: auditLoading,
    mutate: mutateAudits,
    error: auditError,
    isValidating: auditsValidating,
  } = useSwr(canViewAudits ? auditUrl : null);
  const {
    data: feedbackRaw,
    isLoading: fbLoading,
    mutate: mutateFeedback,
    error: feedbackError,
    isValidating: feedbackValidating,
  } = useSwr(
    canViewFeedback && tab === 'feedback' && academicYear
      ? `iqac/feedback?academicYear=${encodeURIComponent(academicYear)}`
      : null,
  );
  const { data: analysisRaw, error: analysisError } = useSwr(
    canViewAnalysis && academicYear
      ? `iqac/feedback/analysis?academicYear=${encodeURIComponent(academicYear)}&feedbackType=${encodeURIComponent(analysisType)}`
      : null,
  );

  const audits: IIQACAudit[] = useMemo(
    () =>
      (auditRaw as { data?: { data?: IIQACAudit[] } })?.data?.data ??
      (auditRaw as { data?: IIQACAudit[] })?.data ??
      [],
    [auditRaw],
  );
  const totalAudits = useMemo(
    () => (auditRaw as { data?: { total?: number } })?.data?.total ?? audits.length,
    [auditRaw, audits],
  );

  const feedbacks: IIQACFeedback[] = useMemo(
    () =>
      (feedbackRaw as { data?: { data?: IIQACFeedback[] } })?.data?.data ??
      (feedbackRaw as { data?: IIQACFeedback[] })?.data ??
      [],
    [feedbackRaw],
  );
  const analysis: IFeedbackAnalysis[] = useMemo(
    () =>
      (
        (analysisRaw as { data?: Array<{ _id: string; avg: number; count: number }> })?.data ?? []
      ).map((row) => ({ criterion: row._id, averageScore: row.avg, count: row.count })),
    [analysisRaw],
  );

  const auditColumns: Column<IIQACAudit>[] = [
    {
      field: 'academicYear',
      title: 'Year',
      render: (r) => <span className="text-sm font-medium text-slate-700">{r.academicYear}</span>,
    },
    {
      field: 'auditType',
      title: 'Type',
      render: (r) => <span className="capitalize text-sm text-slate-600">{r.auditType}</span>,
    },
    {
      field: 'auditDate',
      title: 'Date',
      render: (r) => (
        <span className="text-xs text-slate-500">
          {r.auditDate ? new Date(r.auditDate).toLocaleDateString('en-IN') : '—'}
        </span>
      ),
    },
    {
      field: 'overallCompliance',
      title: 'Compliance',
      render: (r) => (
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary">
          {r.overallCompliance ?? 0}%
        </span>
      ),
    },
    {
      field: 'status',
      title: 'Status',
      render: (r) => {
        const c = AUDIT_STATUS_CFG[r.status] ?? AUDIT_STATUS_CFG.scheduled;
        return (
          <span className={'rounded-full px-2.5 py-0.5 text-xs font-medium ' + c.bg + ' ' + c.text}>
            {c.label}
          </span>
        );
      },
    },
  ];

  const auditActions: Action<IIQACAudit>[] = canEditAudits
    ? [
        {
          tooltip: 'Edit',
          icon: <Edit2 className="h-3.5 w-3.5" />,
          onClick: (r: IIQACAudit) => {
            setEditAudit(r);
            setModalOpen(true);
          },
        },
      ]
    : [];

  const feedbackColumns: Column<IIQACFeedback>[] = [
    {
      field: 'feedbackType',
      title: 'Type',
      render: (r) => (
        <span className="capitalize text-sm text-slate-700">
          {r.feedbackType.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      field: 'academicYear',
      title: 'Year',
      render: (r) => <span className="text-sm text-slate-600">{r.academicYear}</span>,
    },
    {
      field: 'averageScore',
      title: 'Score',
      render: (r) => (
        <div className="flex items-center gap-1">
          <CircleGauge className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-sm font-medium text-slate-700">{r.averageScore?.toFixed(1)}</span>
        </div>
      ),
    },
    {
      field: 'createdAt',
      title: 'Date',
      render: (r) => (
        <span className="text-xs text-slate-500">
          {new Date(r.createdAt).toLocaleDateString('en-IN')}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <QualityWorkflowBar />
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">IQAC</h1>
          <p className="mt-1 text-sm text-slate-500">Internal Quality Assurance Cell</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tab === 'audits' && (
            <button
              type="button"
              onClick={() => setShowFilters((visible) => !visible)}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors ${showFilters || filterType || filterStatus ? 'border-primary-100 bg-primary-50 text-primary' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              <SlidersHorizontal className="h-4 w-4" /> Filters
              {(filterType || filterStatus) && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-white">
                  {[filterType, filterStatus].filter(Boolean).length}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => void Promise.all([mutateAudits(), mutateFeedback()])}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          {canCreateAudits && tab === 'audits' && (
            <CustomButton
              startIcon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setEditAudit(null);
                setModalOpen(true);
              }}
            >
              Create Audit
            </CustomButton>
          )}
        </div>
      </motion.div>

      {/* Tabs */}
      <nav
        className="flex w-fit max-w-full gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2"
        role="tablist"
        aria-label="IQAC workspace sections"
      >
        {(
          [
            {
              id: 'overview',
              label: 'Overview',
              description: 'Quality health',
              icon: LayoutDashboard,
            },
            {
              id: 'audits',
              label: 'Audits',
              description: 'Reviews & findings',
              icon: ClipboardList,
            },
            {
              id: 'feedback',
              label: 'Feedback',
              description: 'Voice & analysis',
              icon: MessageSquare,
            },
            { id: 'copo', label: 'CO–PO', description: 'Outcome attainment', icon: Target },
          ] as const
        ).map(({ id, label, description, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`iqac-${id}-panel`}
            onClick={() => setTab(id)}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors ${tab === id ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tab === id ? 'bg-white/15' : 'bg-slate-100'}`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-xs font-bold">{label}</span>
              <span
                className={`mt-0.5 block text-[10px] ${tab === id ? 'text-white/75' : 'text-slate-400'}`}
              >
                {description}
              </span>
            </span>
          </button>
        ))}
      </nav>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
        aria-labelledby="iqac-reporting-period-title"
      >
        <div
          className={`grid gap-4 lg:items-center ${tab === 'feedback' && canViewAnalysis ? 'lg:grid-cols-[minmax(260px,1fr)_minmax(220px,280px)_minmax(220px,280px)]' : 'lg:grid-cols-[minmax(260px,1fr)_minmax(220px,280px)]'}`}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-primary">
              <CalendarRange className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p id="iqac-reporting-period-title" className="text-sm font-bold text-slate-800">
                  Reporting period
                </p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  {academicYear ? `AY ${academicYear}` : 'Selection required'}
                </span>
              </div>
              <p className="mt-1 max-w-lg text-xs leading-5 text-slate-500">
                Keep audits, feedback, and attainment evidence aligned to one academic review cycle.
              </p>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Academic year
            </label>
            <AsyncSelect
              type="academicYears"
              value={academicYear}
              onChange={(value) => {
                setAcademicYear(value ?? '');
                setPage(1);
              }}
              placeholder="Select academic year"
            />
          </div>
          {tab === 'feedback' && canViewAnalysis ? (
            <label className="text-xs font-semibold text-slate-600">
              Feedback analysis
              <span className="relative mt-1.5 block">
                <select
                  value={analysisType}
                  onChange={(event) => setAnalysisType(event.target.value as TFeedbackType)}
                  className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-9 text-sm font-normal text-slate-800 outline-none [color-scheme:light] transition-all hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/10"
                >
                  <option className="bg-white text-slate-800" value="student_on_faculty">
                    Student on faculty
                  </option>
                  <option className="bg-white text-slate-800" value="student_course_exit">
                    Course-exit survey
                  </option>
                  <option className="bg-white text-slate-800" value="faculty_on_curriculum">
                    Faculty on curriculum
                  </option>
                  <option className="bg-white text-slate-800" value="alumni">
                    Alumni
                  </option>
                  <option className="bg-white text-slate-800" value="employer">
                    Employer
                  </option>
                  <option className="bg-white text-slate-800" value="parent">
                    Parent
                  </option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
              </span>
            </label>
          ) : null}
        </div>
      </motion.section>

      {tab === 'overview' && academicYear && (
        <div id="iqac-overview-panel" role="tabpanel">
          <IqacInsights audits={audits} analysis={analysis} isLoading={auditLoading} />
        </div>
      )}

      {tab === 'overview' && !academicYear && (
        <div className="rounded-2xl bg-white">
          <Empty
            title="Select a reporting period"
            subTitle="Choose an academic year above to combine audit health, findings, compliance and feedback evidence."
          />
        </div>
      )}

      {tab === 'audits' && (
        <div id="iqac-audits-panel" role="tabpanel" className="space-y-5">
          <WorkflowGuide
            title="How quality audits work"
            description="Use this workspace to move a planned review through evidence capture and accountable closure."
            steps={['Schedule the audit', 'Record findings and actions', 'Complete and close']}
          />
          {!canViewAudits && (
            <div className="rounded-xl bg-white p-6 text-sm text-slate-600">
              Audit records are not available for the active role.
            </div>
          )}
          {canViewAudits && !academicYear && (
            <div className="rounded-2xl bg-white">
              <Empty
                title="Choose an academic year"
                subTitle="Select the reporting period above to load its governed audit register."
              />
            </div>
          )}
          {auditError && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
              {auditError.message || 'Unable to load audits.'}
            </div>
          )}
          {/* Filters */}
          {canViewAudits && (showFilters || filterType || filterStatus) && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Find the right audits</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Narrow the register by audit purpose and workflow state.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                  aria-label="Close filters"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
                <label className="text-xs font-medium text-slate-600">
                  Audit type
                  <select
                    value={filterType}
                    onChange={(e) => handleFilterType(e.target.value)}
                    className={`${inputCls} mt-1`}
                  >
                    <option value="">All Types</option>
                    <option value="academic">Academic</option>
                    <option value="administrative">Administrative</option>
                    <option value="infrastructure">Infrastructure</option>
                    <option value="documentation">Documentation</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Workflow status
                  <select
                    value={filterStatus}
                    onChange={(e) => handleFilterStatus(e.target.value)}
                    className={`${inputCls} mt-1`}
                  >
                    <option value="">All Status</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="closed">Closed</option>
                  </select>
                </label>
              </div>
              {(filterType || filterStatus) && (
                <button
                  type="button"
                  onClick={() => {
                    handleFilterType('');
                    handleFilterStatus('');
                  }}
                  className="mt-3 text-xs font-semibold text-primary hover:underline"
                >
                  Clear
                </button>
              )}
            </motion.div>
          )}
          {canViewAudits && academicYear && (
            <DataViewSwitcher<IIQACAudit>
              data={audits}
              isLoading={auditLoading}
              storageKey="iqac-audits.view"
              searchPlaceholder="Search audits…"
              searchFields={['academicYear', 'auditType', 'status']}
              pageSize={20}
              renderCard={(a) => {
                const statusStyle =
                  a.status === 'completed'
                    ? 'bg-green-50 text-green-600'
                    : a.status === 'ongoing'
                      ? 'bg-blue-50 text-blue-600'
                      : 'bg-amber-50 text-amber-600';
                return (
                  <motion.div
                    whileHover={{ y: -2 }}
                    className="flex flex-col gap-3 rounded-2xl bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
                        <ClipboardList className="h-5 w-5" />
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${statusStyle}`}
                      >
                        {(a.status ?? '').replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{a.auditType}</p>
                      <p className="text-xs text-slate-600">AY {a.academicYear}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                        <p className="text-[10px] uppercase text-slate-600">Date</p>
                        <p className="font-bold text-slate-800">
                          {a.auditDate
                            ? new Date(a.auditDate).toLocaleDateString('en-IN', {
                                dateStyle: 'medium',
                              })
                            : '—'}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                        <p className="text-[10px] uppercase text-slate-600">Compliance</p>
                        <p className="font-bold text-slate-800">
                          {a.overallCompliance ?? '—'}
                          {a.overallCompliance != null ? '%' : ''}
                        </p>
                      </div>
                    </div>
                    {canEditAudits && (
                      <div className="flex items-center justify-end border-t border-slate-100 pt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditAudit(a);
                            setModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          <Edit2 className="h-3 w-3" /> Edit
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              }}
              table={
                <div className="overflow-hidden rounded-2xl bg-white">
                  <CustomTable
                    data={audits}
                    columns={auditColumns}
                    actions={auditActions}
                    isLoading={auditLoading}
                    isValidating={auditsValidating}
                    page={page}
                    totalCount={totalAudits}
                    pageSize={15}
                    onPageChange={setPage}
                    title="Audit register"
                    description="Review governed audits, assigned dates, workflow state, compliance and corrective-action ownership."
                    onRefresh={() => void mutateAudits()}
                    options={{ search: false, refresh: true, pagination: true, pageSize: 15 }}
                  />
                </div>
              }
            />
          )}
        </div>
      )}

      {tab === 'feedback' && (
        <div id="iqac-feedback-panel" role="tabpanel" className="space-y-5">
          <WorkflowGuide
            title="How stakeholder feedback works"
            description="Select the audience lens, review aggregated ratings, and use qualitative evidence for improvement planning."
            steps={[
              'Choose feedback audience',
              'Review scores and responses',
              'Act on low-rated criteria',
            ]}
          />
          {/* Analysis cards */}
          {canViewAnalysis && analysis.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {analysis.slice(0, 4).map((a) => (
                <div key={a.criterion} className="rounded-xl bg-white p-4">
                  <p className="text-xs text-slate-600 capitalize">
                    {a.criterion.replace(/_/g, ' ')}
                  </p>
                  <div className="mt-1 flex items-center gap-1">
                    <CircleGauge className="h-4 w-4 text-amber-500" />
                    <p className="text-xl font-bold text-slate-900">{a.averageScore?.toFixed(1)}</p>
                  </div>
                  <p className="text-xs text-slate-500">{a.count} responses</p>
                </div>
              ))}
            </div>
          )}
          {canViewAnalysis && <IqacFeedbackInsights data={analysis} />}
          {canSubmitFeedback && <FeedbackForm onSaved={() => mutateFeedback()} />}
          {/* Feedback list for admin */}
          {canViewFeedback && (
            <DataViewSwitcher<IIQACFeedback>
              data={feedbacks}
              isLoading={fbLoading}
              storageKey="iqac.feedback.view"
              searchPlaceholder="Search feedback…"
              searchFields={['feedbackType', 'academicYear', 'textFeedback']}
              pageSize={16}
              renderCard={(f) => {
                const score = f.averageScore ?? 0;
                const scoreColor =
                  score >= 4 ? 'text-green-600' : score >= 3 ? 'text-amber-600' : 'text-red-500';
                return (
                  <motion.div
                    whileHover={{ y: -2 }}
                    className="flex flex-col gap-3 rounded-2xl bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        AY {f.academicYear}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold capitalize text-slate-800">
                        {f.feedbackType.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <CircleGauge className="h-4 w-4 text-amber-500" />
                      <span className={`text-2xl font-bold ${scoreColor}`}>{score.toFixed(1)}</span>
                      <span className="text-xs text-slate-600">/5</span>
                    </div>
                    {f.textFeedback && (
                      <p className="text-xs text-slate-500 line-clamp-3">{f.textFeedback}</p>
                    )}
                    {f.createdAt && (
                      <p className="text-[11px] text-slate-600">
                        {new Date(f.createdAt).toLocaleDateString()}
                      </p>
                    )}
                  </motion.div>
                );
              }}
              table={
                <div className="overflow-hidden rounded-2xl bg-white">
                  <CustomTable
                    data={feedbacks}
                    columns={feedbackColumns}
                    isLoading={fbLoading}
                    isValidating={feedbackValidating}
                    title="Feedback register"
                    description="Review stakeholder type, reporting cycle, response score and submitted qualitative evidence."
                    onRefresh={() => void mutateFeedback()}
                    options={{ search: true, refresh: true, pagination: true, pageSize: 10 }}
                  />
                </div>
              }
            />
          )}
          {!canSubmitFeedback && !canViewFeedback && !canViewAnalysis && (
            <div className="rounded-xl bg-white p-6 text-sm text-slate-600">
              Feedback is not available for the active role.
            </div>
          )}
          {(feedbackError || analysisError) && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
              {feedbackError?.message || analysisError?.message || 'Unable to load feedback.'}
            </div>
          )}
        </div>
      )}

      {tab === 'copo' && (
        <div id="iqac-copo-panel" role="tabpanel">
          <CoPoPanel key={academicYear || 'no-year'} academicYear={academicYear} />
        </div>
      )}

      <AnimatePresence>
        {modalOpen && (
          <AuditModal
            audit={editAudit}
            onClose={() => {
              setModalOpen(false);
              setEditAudit(null);
            }}
            onSaved={() => mutateAudits()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── CO‑PO Panel ────────────────────────────────────────────────────────────────
interface ICoAttainment {
  coCode: string;
  targetLevel?: number;
  targetPercentage?: number;
  directAttainment?: number;
  indirectAttainment?: number;
  finalAttainment?: number;
  attainmentLevel?: number;
  attainedStudents?: number;
  assessedStudents?: number;
  indirectResponseCount?: number;
  [key: string]: unknown;
}
interface ICoPoRecord {
  _id?: string;
  academicYear: string;
  subjectId: string;
  section: string;
  coAttainments?: ICoAttainment[];
  poAttainments?: {
    poCode: string;
    attainmentLevel?: number;
    attainmentPercentage?: number;
  }[];
  directWeight?: number;
  indirectWeight?: number;
  evidence?: {
    quizCount: number;
    attemptCount: number;
    mappedQuestionCount: number;
    feedbackResponseCount: number;
  };
  gaps?: Array<{ coCode: string; gap: number; message: string; actionPlan?: string }>;
  status?: 'draft' | 'submitted' | 'approved';
  calculationVersion?: number;
  calculatedAt?: string;
  calculatedBy?: string | { _id?: string };
  submittedBy?: string | { _id?: string };
}
interface IPoSummaryRow {
  poCode: string;
  averagePercentage: number;
  subjectCount?: number;
}

function CoPoPanel({ academicYear }: { academicYear: string }) {
  const userId = useAuthStore((state) => state.user?._id ?? '');
  const canCreateIqac = useHasPermission('iqac', 'create');
  const canEditIqac = useHasPermission('iqac', 'edit');
  const hasApprovalAuthority = useHasPermission('iqac', 'approve');
  const canCalculate = canCreateIqac;
  const canEditPlans = canEditIqac;
  const canSubmit = canEditIqac;
  const canApprove = hasApprovalAuthority;
  const [filter, setFilter] = useState({
    academicYear,
    subjectId: '',
    sectionId: '',
    section: '',
    program: '',
    programId: '',
    departmentId: '',
    departmentName: '',
    subjectCode: '',
    subjectName: '',
    semester: '',
  });
  const [coRows, setCoRows] = useState([{ coCode: 'CO1', targetPercent: 60, poCodes: '' }]);
  const [weights, setWeights] = useState({ direct: 80, indirect: 20 });
  const [gapActions, setGapActions] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const { mutation } = useMutation();
  const outcomeUrl = filter.subjectId
    ? `iqac/copo/course-outcomes?subjectId=${encodeURIComponent(filter.subjectId)}`
    : null;
  const { data: outcomeRaw, error: outcomeError } = useSwr<{
    data?: {
      program?: string;
      outcomes?: Array<{ coCode: string; description: string }>;
      programOutcomes?: Array<{ poCode: string; description: string }>;
    };
  }>(outcomeUrl);
  useEffect(() => {
    const outcomes = outcomeRaw?.data?.outcomes ?? [];
    if (!outcomes.length) return;
    // Reset the editor when a newly selected subject's curriculum metadata arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCoRows(
      outcomes.map((outcome) => ({ coCode: outcome.coCode, targetPercent: 60, poCodes: '' })),
    );
    if (outcomeRaw?.data?.program) {
      setFilter((current) => ({
        ...current,
        program: outcomeRaw.data?.program ?? current.program,
      }));
    }
  }, [outcomeRaw]);

  const attUrl = useMemo(() => {
    const sectionName = filter.section.trim();
    if (!filter.academicYear || !filter.subjectId || !sectionName) return null;
    const q = new URLSearchParams();
    q.set('academicYear', filter.academicYear);
    q.set('subjectId', filter.subjectId);
    q.set('section', sectionName);
    return `iqac/copo?${q.toString()}`;
  }, [filter]);
  const {
    data: attRaw,
    error: attainmentError,
    mutate: refetchAtt,
    isValidating: attainmentValidating,
  } = useSwr<{
    data?: ICoPoRecord | null;
  }>(attUrl);
  const record = attRaw?.data ?? null;

  const summaryUrl = useMemo(() => {
    if (!filter.academicYear || !filter.program) return null;
    const q = new URLSearchParams({ academicYear: filter.academicYear, program: filter.program });
    return `iqac/copo/po-summary?${q.toString()}`;
  }, [filter]);
  const { data: summRaw, error: summaryError } = useSwr<{
    data?: Array<{ _id: string; avgAttainment: number }>;
  }>(summaryUrl);
  const summary: IPoSummaryRow[] = (summRaw?.data ?? []).map((row) => ({
    poCode: row._id,
    averagePercentage: row.avgAttainment,
  }));
  const idOf = (value?: string | { _id?: string }) =>
    typeof value === 'string' ? value : String(value?._id ?? '');
  const isIndependentApprover =
    !!record && idOf(record.calculatedBy) !== userId && idOf(record.submittedBy) !== userId;
  const contextReady = Boolean(
    filter.academicYear &&
    filter.program &&
    filter.departmentId &&
    filter.semester &&
    filter.sectionId &&
    filter.subjectId &&
    filter.section,
  );
  const attainmentColumns: Column<ICoAttainment>[] = [
    {
      field: 'coCode',
      title: 'Course outcome',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-700">{row.coCode}</span>
      ),
    },
    {
      field: 'attainmentLevel',
      title: 'Level',
      render: (row) => (
        <span className="text-sm text-slate-600">
          L{row.attainmentLevel ?? 0} / target L{row.targetLevel ?? '—'}
        </span>
      ),
    },
    {
      field: 'finalAttainment',
      title: 'Final attainment',
      render: (row) => (
        <span className="inline-flex rounded-full bg-primary-50 px-2.5 py-1 text-xs font-bold text-primary">
          {row.finalAttainment?.toFixed(1) ?? '—'}%
        </span>
      ),
    },
    {
      field: 'directAttainment',
      title: 'Evidence mix',
      render: (row) => (
        <div className="text-xs leading-5 text-slate-500">
          <p>
            Direct {row.directAttainment ?? 0}% · Indirect {row.indirectAttainment ?? 0}%
          </p>
          <p>
            {row.attainedStudents ?? 0}/{row.assessedStudents ?? 0} students ·{' '}
            {row.indirectResponseCount ?? 0} surveys
          </p>
        </div>
      ),
    },
  ];

  const runAutoCalc = async () => {
    if (!filter.academicYear || !filter.subjectId || !filter.section) {
      toast.error('Year, Subject ID & Section required');
      return;
    }
    if (!filter.subjectCode || !filter.semester || !filter.program) {
      toast.error('Subject Code, Semester and Program are required for auto-calc');
      return;
    }
    const coMappings = coRows.map(({ coCode, targetPercent }) => ({
      coCode: coCode.trim().toUpperCase(),
      targetPercent: Number(targetPercent),
    }));
    const coPOMatrix = Object.fromEntries(
      coRows.map((row) => [
        row.coCode.trim().toUpperCase(),
        row.poCodes
          .split(',')
          .map((code) => code.trim().toUpperCase())
          .filter(Boolean),
      ]),
    );
    setBusy(true);
    const res = await mutation('iqac/copo/auto-calculate', {
      method: 'POST',
      body: {
        academicYear: filter.academicYear,
        sectionId: filter.sectionId,
        subjectId: filter.subjectId,
        subjectCode: filter.subjectCode,
        program: filter.program,
        semester: Number(filter.semester),
        section: filter.section,
        coMappings,
        coPOMatrix,
        directWeight: weights.direct,
        indirectWeight: weights.indirect,
      },
    });
    setBusy(false);
    if (res?.results?.success) {
      toast.success('CO-PO attainment recalculated');
      refetchAtt();
    } else toast.error('Auto-calc failed');
  };

  const saveActionPlans = async () => {
    if (!record?._id) return;
    setBusy(true);
    const res = await mutation(`iqac/copo/${record._id}/action-plans`, {
      method: 'POST',
      body: {
        actions: (record.gaps ?? []).map((gap) => ({
          coCode: gap.coCode,
          actionPlan: gapActions[gap.coCode] ?? gap.actionPlan ?? '',
        })),
      },
      isAlert: true,
    });
    setBusy(false);
    if (res?.results?.success) {
      toast.success('Improvement plans saved');
      refetchAtt();
    }
  };

  const transitionAttainment = async (action: 'submit' | 'approve') => {
    if (!record?._id) return;
    setBusy(true);
    const res = await mutation(`iqac/copo/${record._id}/${action}`, {
      method: 'POST',
      isAlert: true,
    });
    setBusy(false);
    if (res?.results?.success) {
      toast.success(
        action === 'submit' ? 'Attainment submitted' : 'Attainment approved and frozen',
      );
      refetchAtt();
    }
  };

  const filterInput =
    'rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:outline-none';

  return (
    <div className="space-y-5">
      <WorkflowGuide
        title="How CO–PO attainment works"
        description="The workspace reveals each decision only after its required academic context is selected."
        steps={[
          'Choose session and programme',
          'Confirm department and cohort',
          'Calculate, review and approve',
        ]}
      />
      {filter.academicYear && (
        <section className="rounded-2xl bg-white p-4 sm:p-5">
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                Step 1 of 3
              </span>
              <p className="text-sm font-semibold text-slate-800">Academic context</p>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Select from left to right. Each choice limits the valid options in the next field.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="min-w-52 flex-1 sm:max-w-xs">
              <AsyncSelect
                type="programs"
                label="1. Programme"
                params={{ academicYear: filter.academicYear }}
                value={filter.programId}
                onChange={(value, option) =>
                  setFilter({
                    ...filter,
                    programId: value ?? '',
                    program: option?.label ?? '',
                    departmentId: '',
                    departmentName: '',
                    semester: '',
                    sectionId: '',
                    section: '',
                    subjectId: '',
                    subjectCode: '',
                  })
                }
                placeholder="Select programme"
              />
            </div>
            <div className="min-w-52 flex-1 sm:max-w-xs">
              <AsyncSelect
                type="departments"
                label="2. Department"
                params={{ program: filter.program, academicYear: filter.academicYear }}
                value={filter.departmentId}
                disabled={!filter.program}
                onChange={(value, option) =>
                  setFilter({
                    ...filter,
                    departmentId: value ?? '',
                    departmentName: option?.label ?? '',
                    semester: '',
                    sectionId: '',
                    section: '',
                    subjectId: '',
                    subjectCode: '',
                  })
                }
                placeholder="Select department"
              />
            </div>
            <div className="min-w-40 flex-1 sm:max-w-52">
              <AsyncSelect
                type="semesters"
                label="3. Semester"
                params={{
                  configured: true,
                  academicYear: filter.academicYear,
                  program: filter.program,
                  departmentId: filter.departmentId,
                }}
                value={filter.semester}
                disabled={!filter.departmentId}
                onChange={(value) =>
                  setFilter({
                    ...filter,
                    semester: value ?? '',
                    sectionId: '',
                    section: '',
                    subjectId: '',
                    subjectCode: '',
                  })
                }
                placeholder="Select semester"
              />
            </div>
            <div className="min-w-60 flex-1 sm:max-w-xs">
              <AsyncSelect
                type="sections"
                label="4. Section"
                params={{
                  master: true,
                  academicYear: filter.academicYear,
                  program: filter.program,
                  departmentId: filter.departmentId,
                  semesterNo: filter.semester,
                }}
                value={filter.sectionId || null}
                disabled={!filter.semester}
                onChange={(value, option) =>
                  setFilter({
                    ...filter,
                    sectionId: value ?? '',
                    section: String(
                      option?.meta?.sectionName ?? option?.label.split('Section ').at(-1) ?? '',
                    ),
                    subjectId: '',
                    subjectCode: '',
                  })
                }
                placeholder="Select academic section"
              />
            </div>
            <div className="min-w-52 flex-1 sm:max-w-xs">
              <AsyncSelect
                type="subjects"
                label="5. Subject"
                params={{
                  sectionId: filter.sectionId,
                  departmentId: filter.departmentId,
                  program: filter.program,
                  semesterNo: filter.semester,
                }}
                value={filter.subjectId}
                disabled={!filter.sectionId}
                onChange={(value, option) =>
                  setFilter({
                    ...filter,
                    subjectId: value ?? '',
                    subjectCode: option?.sub?.split(' · ')[0] ?? option?.label ?? '',
                    subjectName: option?.label ?? '',
                  })
                }
                placeholder="Select subject"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            {!contextReady && (
              <p className="text-xs text-slate-500">
                Complete the fields in order to enable outcome calculation.
              </p>
            )}
            {canCalculate && contextReady && (
              <CustomButton
                type="button"
                variant="tertiary"
                loading={busy}
                startIcon={<Calculator className="h-3.5 w-3.5" />}
                onClick={runAutoCalc}
                className="py-1.5! text-xs! w-fit!"
              >
                Auto Calculate
              </CustomButton>
            )}
            {canEditPlans && record?._id && record.status === 'draft' && (
              <CustomButton
                type="button"
                variant="tertiary"
                loading={busy}
                startIcon={<Save className="h-3.5 w-3.5" />}
                onClick={saveActionPlans}
                className="py-1.5! text-xs! w-fit!"
              >
                Save Action Plans
              </CustomButton>
            )}
            {canSubmit && record?._id && record.status === 'draft' && (
              <CustomButton
                type="button"
                variant="primary"
                loading={busy}
                onClick={() => transitionAttainment('submit')}
                className="py-1.5! text-xs! w-fit!"
              >
                Submit for Approval
              </CustomButton>
            )}
            {canApprove &&
              isIndependentApprover &&
              record?._id &&
              record.status === 'submitted' && (
                <CustomButton
                  type="button"
                  variant="primary"
                  loading={busy}
                  onClick={() => transitionAttainment('approve')}
                  className="py-1.5! text-xs! w-fit!"
                >
                  Approve & Freeze
                </CustomButton>
              )}
          </div>
        </section>
      )}

      {!filter.academicYear && (
        <div className="rounded-2xl bg-white">
          <Empty
            title="Choose a reporting period"
            subTitle="Select an academic year above to begin the CO–PO attainment workflow."
          />
        </div>
      )}

      {canCalculate && contextReady && (
        <div className="rounded-xl bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-700">Course outcome mapping</p>
              <p className="text-[11px] text-slate-600">
                Define the assessment target and mapped programme outcomes.
              </p>
            </div>
            <button
              type="button"
              className="text-xs font-medium text-primary"
              onClick={() =>
                setCoRows((current) => [
                  ...current,
                  {
                    coCode: `CO${current.length + 1}`,
                    targetPercent: 60,
                    poCodes: '',
                  },
                ])
              }
            >
              Add CO
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {coRows.map((row, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[90px_140px_1fr]">
                {(
                  [
                    ['coCode', 'CO code', 'text'],
                    ['targetPercent', 'Target %', 'number'],
                    ['poCodes', 'Mapped POs: PO1, PO2', 'text'],
                  ] as const
                ).map(([field, placeholder, type]) => (
                  <input
                    key={field}
                    type={type}
                    min={type === 'number' ? 1 : undefined}
                    max={field === 'targetPercent' ? 100 : undefined}
                    value={row[field]}
                    placeholder={placeholder}
                    className={filterInput}
                    onChange={(event) =>
                      setCoRows((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                [field]:
                                  type === 'number'
                                    ? Number(event.target.value)
                                    : event.target.value,
                              }
                            : item,
                        ),
                      )
                    }
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-600">
              Direct evidence weight (%)
              <input
                type="number"
                min={0}
                max={100}
                value={weights.direct}
                onChange={(event) =>
                  setWeights({
                    direct: Number(event.target.value),
                    indirect: 100 - Number(event.target.value),
                  })
                }
                className={`${filterInput} mt-1 w-full`}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Course-exit survey weight (%)
              <input value={weights.indirect} disabled className={`${filterInput} mt-1 w-full`} />
            </label>
          </div>
        </div>
      )}

      {record && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <CustomTable
            data={record.coAttainments ?? []}
            columns={attainmentColumns}
            title={`CO attainment register — ${filter.academicYear} / ${filter.section}`}
            description="Review calculated levels, direct and indirect evidence, student coverage, and outcome gaps."
            onRefresh={() => void refetchAtt()}
            isValidating={attainmentValidating}
            customActions={
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase text-slate-600">
                {record.status ?? 'draft'} · v{record.calculationVersion ?? 1}
              </span>
            }
            options={{ search: false, refresh: true, pagination: false }}
          />
          {record.poAttainments && record.poAttainments.length > 0 && (
            <div className="rounded-2xl bg-white p-4 sm:p-5">
              <p className="text-sm font-semibold text-slate-800">Programme outcome summary</p>
              <p className="mb-3 mt-1 text-xs text-slate-500">
                Consolidated PO percentages and attained levels from the calculated course outcomes.
              </p>
              <div className="flex flex-wrap gap-2">
                {record.poAttainments.map((po) => (
                  <span key={po.poCode} className="rounded-lg bg-slate-50 px-2 py-1 text-xs">
                    <span className="font-mono text-slate-700">{po.poCode}</span>
                    <span className="ml-1 text-primary font-semibold">
                      {po.attainmentPercentage?.toFixed(1) ?? '—'}% · L{po.attainmentLevel ?? 0}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {record.evidence && (
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-4 text-xs sm:grid-cols-4 sm:p-5">
              {[
                ['Closed quizzes', record.evidence.quizCount],
                ['Attempts', record.evidence.attemptCount],
                ['CO questions', record.evidence.mappedQuestionCount],
                ['Exit surveys', record.evidence.feedbackResponseCount],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg bg-slate-50 p-2">
                  <p className="text-slate-600">{label}</p>
                  <p className="font-semibold text-slate-800">{value}</p>
                </div>
              ))}
            </div>
          )}
          {!!record.gaps?.length && (
            <div className="mt-4 rounded-xl bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-800">Improvement gaps</p>
              {record.gaps.map((gap) => (
                <div key={gap.coCode} className="mt-2">
                  <p className="text-xs text-amber-700">{gap.message}</p>
                  <textarea
                    rows={2}
                    disabled={!canEditPlans || record.status !== 'draft'}
                    value={gapActions[gap.coCode] ?? gap.actionPlan ?? ''}
                    onChange={(event) =>
                      setGapActions((current) => ({
                        ...current,
                        [gap.coCode]: event.target.value,
                      }))
                    }
                    placeholder="Document measurable improvement action, owner and review timeline…"
                    className="mt-1 w-full rounded-lg bg-white p-2 text-xs text-slate-700 outline-none ring-1 ring-amber-200 disabled:bg-amber-50"
                  />
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {contextReady && !record && !attainmentValidating && !attainmentError && (
        <div className="rounded-2xl bg-white">
          <Empty
            title="No attainment record yet"
            subTitle="Use Auto Calculate to create the first evidence-based CO–PO attainment record for this selection."
          />
        </div>
      )}

      {(outcomeError || attainmentError || summaryError) && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {outcomeError?.message || attainmentError?.message || summaryError?.message}
        </div>
      )}

      {summary.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-white p-5"
        >
          <h3 className="mb-3 text-sm font-semibold text-slate-800">
            Program-level PO Summary — {filter.program}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {summary.map((s) => (
              <div key={s.poCode} className="rounded-xl bg-slate-50 p-3">
                <p className="font-mono text-xs text-slate-500">{s.poCode}</p>
                <p className="text-lg font-bold text-primary">
                  {s.averagePercentage?.toFixed(1) ?? '—'}%
                </p>
                <p className="text-[10px] text-slate-600">{s.subjectCount ?? 0} subjects</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

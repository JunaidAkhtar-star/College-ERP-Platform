/**
 * @file JobPostingPage.tsx
 * @description Job Posting module — role-aware:
 *   Admin/Placement Cell: Create (POST job-posting), list all statuses (GET job-posting/admin), edit (PUT job-posting/:id), close (PUT job-posting/:id/close)
 *   Student: Browse active postings (GET job-posting), mark interest (POST job-posting/:id/interest), apply (POST job-posting/:id/apply), remove interest (DELETE job-posting/:id/interest)
 * @module features/role-wise-features/job-posting
 */
'use client';

import React, { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import {
  Briefcase,
  Plus,
  Bookmark,
  BookmarkX,
  Edit2,
  Lock,
  MapPin,
  Clock,
  Building,
  ExternalLink,
  CheckCircle,
  Upload,
  LayoutDashboard,
  UsersRound,
  Eye,
  Target,
  X,
  Send,
  IndianRupee,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import AsyncSelect from '@/shared/core/AsyncSelect';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { useAuthStore } from '@/shared/store/authStore';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface IJobPosting {
  _id: string;
  companyName: string;
  jobTitle: string;
  jobType: string;
  location: string;
  description: string;
  requirements?: string;
  responsibilities?: string;
  companyWebsite?: string;
  companyDescription?: string;
  isRemote?: boolean;
  salaryMin?: number;
  salaryMax?: number;
  isSalaryDisclosed?: boolean;
  stipend?: number;
  eligiblePrograms: string[];
  eligibleBranches: string[];
  eligibleBatches: string[];
  minCgpa?: number;
  maxBacklogs?: number;
  graduationYear?: number;
  applyMode: 'internal' | 'external';
  externalApplyLink?: string;
  applyEmail?: string;
  applicationDeadline: string;
  status?: 'active' | 'closed' | 'draft' | 'expired';
  isActive?: boolean;
  interestCount?: number;
  appliedCount?: number;
  hasInterest?: boolean;
  hasApplied?: boolean;
  jobDescriptionFileUrl?: string;
  viewCount?: number;
  eligible?: boolean;
  reasons?: string[];
  createdAt?: string;
  [key: string]: unknown;
}

interface IJobStats {
  total?: number;
  active?: number;
  draft?: number;
  expired?: number;
  closed?: number;
  views?: number;
  interests?: number;
  applications?: number;
  closingSoon?: number;
  remote?: number;
  averageSalary?: number;
  viewToApplicationRate?: number;
  interestToApplicationRate?: number;
  byType?: Array<{ type: string; count: number; applications: number }>;
  byApplyMode?: Array<{ mode: string; count: number; applications: number }>;
  monthly?: Array<{ month: string; postings: number; applications: number }>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

const JOB_TYPES = ['Full Time', 'Internship', 'Part Time', 'Contract', 'Apprenticeship'];

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function deadlineStatus(iso?: string) {
  if (!iso) return { label: '—', cls: 'text-slate-600' };
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (diff < 0) return { label: 'Expired', cls: 'text-red-500' };
  if (diff === 0) return { label: 'Today', cls: 'text-red-500 font-bold' };
  if (diff <= 3) return { label: `${diff}d left`, cls: 'text-amber-500 font-medium' };
  return { label: `${diff}d left`, cls: 'text-slate-500' };
}

function OpportunityAnalytics() {
  const { data: raw, isLoading } = useSwr<{ data?: IJobStats }>('job-posting/stats');
  const stats = raw?.data ?? {};
  if (isLoading)
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
    );
  const kpis = [
    {
      label: 'Active opportunities',
      value: stats.active ?? 0,
      detail: `${stats.closingSoon ?? 0} deadlines within 7 days`,
      icon: Briefcase,
      tone: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Student reach',
      value: stats.views ?? 0,
      detail: `${stats.interests ?? 0} saved opportunities`,
      icon: Eye,
      tone: 'bg-violet-50 text-violet-700',
    },
    {
      label: 'Applications',
      value: stats.applications ?? 0,
      detail: `${(stats.viewToApplicationRate ?? 0).toFixed(1)}% view conversion`,
      icon: UsersRound,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Average advertised salary',
      value: stats.averageSalary ? `${stats.averageSalary.toFixed(1)} LPA` : '—',
      detail: `${stats.remote ?? 0} active remote roles`,
      icon: IndianRupee,
      tone: 'bg-amber-50 text-amber-700',
    },
  ];
  const lifecycle = [
    { label: 'Active', value: stats.active ?? 0, color: '#2563eb' },
    { label: 'Draft', value: stats.draft ?? 0, color: '#f59e0b' },
    { label: 'Expired', value: stats.expired ?? 0, color: '#64748b' },
    { label: 'Closed', value: stats.closed ?? 0, color: '#e11d48' },
  ];
  const lifecycleMax = Math.max(...lifecycle.map((item) => item.value), 1);
  const types = stats.byType ?? [];
  const typeMax = Math.max(...types.map((item) => item.count), 1);
  const monthly = stats.monthly ?? [];
  const monthlyMax = Math.max(...monthly.flatMap((item) => [item.postings, item.applications]), 1);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, value, detail, icon: Icon, tone }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
              </div>
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
                <Icon className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-500">{detail}</p>
          </motion.div>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-bold text-slate-900">Opportunity lifecycle</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Publishing health across drafts, active and completed opportunities.
          </p>
          <svg
            viewBox="0 0 520 210"
            className="mt-4 h-auto w-full"
            role="img"
            aria-label="Opportunity lifecycle"
          >
            {lifecycle.map((item, index) => {
              const y = 12 + index * 47;
              const width = (item.value / lifecycleMax) * 330;
              return (
                <g key={item.label}>
                  <text x="0" y={y + 17} fill="#64748b" fontSize="12">
                    {item.label}
                  </text>
                  <rect x="82" y={y} width="340" height="25" rx="7" fill="#f1f5f9" />
                  <motion.rect
                    x="82"
                    y={y}
                    height="25"
                    rx="7"
                    fill={item.color}
                    initial={{ width: 0 }}
                    animate={{ width }}
                  />
                  <text x="440" y={y + 17} fill="#0f172a" fontSize="12" fontWeight="700">
                    {item.value}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-bold text-slate-900">Opportunity mix</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Jobs and internships compared with received applications.
          </p>
          {types.length ? (
            <svg
              viewBox="0 0 520 210"
              className="mt-4 h-auto w-full"
              role="img"
              aria-label="Opportunity types"
            >
              {types.slice(0, 4).map((item, index) => {
                const y = 12 + index * 47;
                const width = (item.count / typeMax) * 280;
                return (
                  <g key={item.type}>
                    <text x="0" y={y + 17} fill="#64748b" fontSize="11">
                      {item.type}
                    </text>
                    <rect x="110" y={y} width="290" height="25" rx="7" fill="#eef2ff" />
                    <motion.rect
                      x="110"
                      y={y}
                      height="25"
                      rx="7"
                      fill="#7c3aed"
                      initial={{ width: 0 }}
                      animate={{ width }}
                    />
                    <text x="415" y={y + 17} fill="#334155" fontSize="11">
                      {item.count} · {item.applications} applied
                    </text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="mt-4 flex min-h-36 items-center justify-center rounded-xl bg-slate-50 text-xs text-slate-500">
              Opportunity mix appears after postings are created.
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Publishing and application momentum
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Monthly opportunity publishing compared with student applications.
              </p>
            </div>
            <div className="flex gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                Postings
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                Applications
              </span>
            </div>
          </div>
          {monthly.length ? (
            <svg
              viewBox="0 0 900 235"
              className="mt-4 h-auto w-full"
              role="img"
              aria-label="Monthly opportunity momentum"
            >
              {monthly.map((item, index) => {
                const group = 820 / monthly.length;
                const x = 48 + index * group;
                const p = (item.postings / monthlyMax) * 145;
                const a = (item.applications / monthlyMax) * 145;
                return (
                  <g key={item.month}>
                    <line x1={x - 5} y1="175" x2={x + group - 12} y2="175" stroke="#e2e8f0" />
                    <motion.rect
                      x={x}
                      y={175 - p}
                      width={Math.min(22, group / 3)}
                      height={p}
                      rx="5"
                      fill="#2563eb"
                      initial={{ height: 0, y: 175 }}
                      animate={{ height: p, y: 175 - p }}
                    />
                    <motion.rect
                      x={x + Math.min(27, group / 2.5)}
                      y={175 - a}
                      width={Math.min(22, group / 3)}
                      height={a}
                      rx="5"
                      fill="#059669"
                      initial={{ height: 0, y: 175 }}
                      animate={{ height: a, y: 175 - a }}
                    />
                    <text x={x + 18} y="200" textAnchor="middle" fill="#64748b" fontSize="11">
                      {item.month.slice(5)}
                    </text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="mt-4 flex min-h-36 items-center justify-center rounded-xl bg-slate-50 text-xs text-slate-500">
              Monthly trends appear as opportunities are published.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Create / Edit Modal ───────────────────────────────────────────────────────

interface JobModalProps {
  editing?: IJobPosting | null;
  onClose: () => void;
  onSaved: () => void;
}

function JobModal({ editing, onClose, onSaved }: JobModalProps) {
  const { mutation, isLoading } = useMutation();
  const isEdit = !!editing;

  const formik = useFormik({
    initialValues: {
      companyName: editing?.companyName ?? '',
      companyWebsite: editing?.companyWebsite ?? '',
      companyDescription: editing?.companyDescription ?? '',
      jobTitle: editing?.jobTitle ?? '',
      jobType: editing?.jobType ?? 'Full Time',
      location: editing?.location ?? '',
      isRemote: editing?.isRemote ?? false,
      description: editing?.description ?? '',
      responsibilities: editing?.responsibilities ?? '',
      requirements: editing?.requirements ?? '',
      salaryMin: editing?.salaryMin ?? '',
      salaryMax: editing?.salaryMax ?? '',
      isSalaryDisclosed: editing?.isSalaryDisclosed ?? true,
      stipend: editing?.stipend ?? '',
      eligiblePrograms: editing?.eligiblePrograms ?? [],
      eligibleBranches: editing?.eligibleBranches ?? [],
      eligibleBatches: editing?.eligibleBatches ?? [],
      minCgpa: editing?.minCgpa ?? '',
      maxBacklogs: editing?.maxBacklogs ?? '',
      graduationYear: editing?.graduationYear ?? '',
      applyMode: editing?.applyMode ?? ('internal' as 'internal' | 'external'),
      externalApplyLink: editing?.externalApplyLink ?? '',
      applyEmail: editing?.applyEmail ?? '',
      applicationDeadline: editing?.applicationDeadline
        ? String(editing.applicationDeadline).slice(0, 10)
        : '',
    },
    validationSchema: Yup.object({
      companyName: Yup.string().trim().required('Company name required'),
      jobTitle: Yup.string().trim().required('Job title required'),
      jobType: Yup.string().required('Job type required'),
      location: Yup.string().trim().required('Location required'),
      description: Yup.string().trim().required('Description required'),
      applicationDeadline: Yup.string().required('Deadline required'),
      externalApplyLink: Yup.string().when('applyMode', {
        is: 'external',
        then: (schema) => schema.url('Enter a complete application URL'),
      }),
      applyEmail: Yup.string().email('Enter a valid application email'),
      salaryMax: Yup.number().when('salaryMin', {
        is: (value: unknown) => Number(value) > 0,
        then: (schema) => schema.min(Yup.ref('salaryMin'), 'Maximum must be above minimum'),
      }),
    }),
    onSubmit: async (values) => {
      const url = isEdit ? `job-posting/${editing!._id}` : 'job-posting';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await mutation(url, { method, body: values, isAlert: true });
      if (
        (res as { success?: boolean })?.success ||
        (res as { results?: { success?: boolean } })?.results?.success
      ) {
        toast.success(isEdit ? 'Job posting updated' : 'Job posting created');
        onSaved();
        onClose();
      } else {
        toast.error('Failed');
      }
    },
  });

  const E = formik.errors as Record<string, string>;
  const T = formik.touched as Record<string, boolean>;

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
        role="dialog"
        aria-modal="true"
        className="relative z-10 max-h-[92dvh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-5 sm:p-7"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
              Guided opportunity setup
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {isEdit ? 'Edit job or internship' : 'Create job or internship'}
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Create a draft with employer details, compensation, eligibility and a clear
              application route. Publish only after review.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close form"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={formik.handleSubmit} className="space-y-6">
          <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
            <span className="font-semibold">Draft workflow:</span> saving does not expose the
            opportunity to students. Upload the JD and verify eligibility before publishing.
          </div>
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Employer and role</h3>
              <p className="text-xs text-slate-500">
                Identify the organisation, opportunity and work arrangement.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className={labelCls}>Company Name *</label>
                <input
                  name="companyName"
                  value={formik.values.companyName}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder="Google, Infosys…"
                  className={inputCls}
                />
                {T.companyName && E.companyName && (
                  <p className="mt-1 text-xs text-red-500">{E.companyName}</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Company website</label>
                <input
                  name="companyWebsite"
                  value={formik.values.companyWebsite}
                  onChange={formik.handleChange}
                  placeholder="https://company.com"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Job Title *</label>
                <input
                  name="jobTitle"
                  value={formik.values.jobTitle}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder="Software Engineer"
                  className={inputCls}
                />
                {T.jobTitle && E.jobTitle && (
                  <p className="mt-1 text-xs text-red-500">{E.jobTitle}</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Job Type *</label>
                <select
                  name="jobType"
                  value={formik.values.jobType}
                  onChange={formik.handleChange}
                  className={inputCls}
                >
                  {JOB_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Location *</label>
                <input
                  name="location"
                  value={formik.values.location}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder="Bangalore, Remote…"
                  className={inputCls}
                />
                {T.location && E.location && (
                  <p className="mt-1 text-xs text-red-500">{E.location}</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Application Deadline *</label>
                <input
                  type="date"
                  name="applicationDeadline"
                  value={formik.values.applicationDeadline}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className={inputCls}
                />
                {T.applicationDeadline && E.applicationDeadline && (
                  <p className="mt-1 text-xs text-red-500">{E.applicationDeadline}</p>
                )}
              </div>
            </div>
            <label className="flex w-fit items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                name="isRemote"
                checked={formik.values.isRemote}
                onChange={formik.handleChange}
                className="h-4 w-4 rounded border-slate-300 text-primary"
              />
              Remote work is available
            </label>

            <div>
              <label className={labelCls}>Description *</label>
              <textarea
                name="description"
                rows={4}
                value={formik.values.description}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="Role description, responsibilities…"
                className={inputCls + ' resize-none'}
              />
              {T.description && E.description && (
                <p className="mt-1 text-xs text-red-500">{E.description}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Responsibilities</label>
              <textarea
                name="responsibilities"
                rows={3}
                value={formik.values.responsibilities}
                onChange={formik.handleChange}
                placeholder="What the selected candidate will own and deliver…"
                className={inputCls + ' resize-none'}
              />
            </div>
            <div>
              <label className={labelCls}>Requirements</label>
              <textarea
                name="requirements"
                rows={3}
                value={formik.values.requirements}
                onChange={formik.handleChange}
                placeholder="Skills, technologies and experience needed…"
                className={inputCls + ' resize-none'}
              />
            </div>
          </section>
          <section className="space-y-4 border-t border-slate-100 pt-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Compensation</h3>
              <p className="text-xs text-slate-500">
                Use LPA for salaries and monthly amount for internship stipend.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className={labelCls}>Minimum salary (LPA)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  name="salaryMin"
                  value={formik.values.salaryMin}
                  onChange={formik.handleChange}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Maximum salary (LPA)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  name="salaryMax"
                  value={formik.values.salaryMax}
                  onChange={formik.handleChange}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Monthly stipend</label>
                <input
                  type="number"
                  min="0"
                  name="stipend"
                  value={formik.values.stipend}
                  onChange={formik.handleChange}
                  className={inputCls}
                />
              </div>
              <label className="flex items-center gap-2 self-end pb-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  name="isSalaryDisclosed"
                  checked={formik.values.isSalaryDisclosed}
                  onChange={formik.handleChange}
                  className="h-4 w-4 rounded border-slate-300 text-primary"
                />
                Show compensation to students
              </label>
            </div>
          </section>
          <section className="space-y-4 border-t border-slate-100 pt-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Student eligibility</h3>
              <p className="text-xs text-slate-500">
                Leave a group empty to make the opportunity available to all groups.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <AsyncSelect
                type="programs"
                label="Eligible programmes"
                multiple
                value={formik.values.eligiblePrograms}
                onChange={(_, options) =>
                  formik.setFieldValue(
                    'eligiblePrograms',
                    options?.map((option) => option.label) ?? [],
                  )
                }
                placeholder="All programmes"
              />
              <AsyncSelect
                type="departments"
                label="Eligible branches"
                multiple
                value={formik.values.eligibleBranches}
                onChange={(_, options) =>
                  formik.setFieldValue(
                    'eligibleBranches',
                    options?.map((option) => option.label) ?? [],
                  )
                }
                placeholder="All branches"
              />
              <AsyncSelect
                type="batches"
                label="Eligible batches"
                multiple
                value={formik.values.eligibleBatches}
                onChange={(_, options) =>
                  formik.setFieldValue(
                    'eligibleBatches',
                    options?.map((option) => option.label) ?? [],
                  )
                }
                placeholder="All batches"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={labelCls}>Minimum CGPA</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  name="minCgpa"
                  value={formik.values.minCgpa}
                  onChange={formik.handleChange}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Maximum active backlogs</label>
                <input
                  type="number"
                  min="0"
                  name="maxBacklogs"
                  value={formik.values.maxBacklogs}
                  onChange={formik.handleChange}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Graduation year</label>
                <input
                  type="number"
                  min="2000"
                  max="2200"
                  name="graduationYear"
                  value={formik.values.graduationYear}
                  onChange={formik.handleChange}
                  className={inputCls}
                />
              </div>
            </div>
          </section>
          <section className="space-y-4 border-t border-slate-100 pt-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Application route</h3>
              <p className="text-xs text-slate-500">
                Choose whether applications are collected in the ERP or acknowledged after an
                external application.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelCls}>Application method *</label>
                <select
                  name="applyMode"
                  value={formik.values.applyMode}
                  onChange={formik.handleChange}
                  className={inputCls}
                >
                  <option value="internal">Apply inside ERP</option>
                  <option value="external">Employer website or email</option>
                </select>
              </div>
              {formik.values.applyMode === 'external' && (
                <>
                  <div>
                    <label className={labelCls}>External application link</label>
                    <input
                      name="externalApplyLink"
                      value={formik.values.externalApplyLink}
                      onChange={formik.handleChange}
                      placeholder="https://careers.company.com/job"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Application email</label>
                    <input
                      type="email"
                      name="applyEmail"
                      value={formik.values.applyEmail}
                      onChange={formik.handleChange}
                      placeholder="careers@company.com"
                      className={inputCls}
                    />
                  </div>
                </>
              )}
            </div>
          </section>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton
              variant="primary"
              type="submit"
              loading={isLoading}
              startIcon={<Briefcase className="h-4 w-4" />}
            >
              {isEdit ? 'Update Posting' : 'Create Posting'}
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Job Detail Drawer ─────────────────────────────────────────────────────────

interface JobDetailProps {
  job: IJobPosting;
  isStudent: boolean;
  onClose: () => void;
  onMutate: () => void;
}

function JobDetailDrawer({ job, isStudent, onClose, onMutate }: JobDetailProps) {
  const { mutation, isLoading } = useMutation();
  const ds = deadlineStatus(job.applicationDeadline);

  const handleInterest = async () => {
    const hasIt = job.hasInterest;
    const url = `job-posting/${job._id}/interest`;
    const method = hasIt ? 'DELETE' : 'POST';
    const res = await mutation(url, { method, body: {} });
    if (
      (res as { success?: boolean })?.success ||
      (res as { results?: { success?: boolean } })?.results?.success
    ) {
      toast.success(hasIt ? 'Interest removed' : 'Interest marked');
      onMutate();
    } else toast.error('Failed');
  };

  const handleApply = async () => {
    const r = await Swal.fire({
      title: `Apply to ${job.companyName}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Apply',
      confirmButtonColor: '#0178D7',
    });
    if (!r.isConfirmed) return;
    const res = await mutation(`job-posting/${job._id}/apply`, { method: 'POST', body: {} });
    if (
      (res as { success?: boolean })?.success ||
      (res as { results?: { success?: boolean } })?.results?.success
    ) {
      toast.success(
        job.applyMode === 'external'
          ? 'External application acknowledged'
          : 'Application submitted',
      );
      if (job.applyMode === 'external' && job.externalApplyLink) {
        window.open(job.externalApplyLink, '_blank', 'noopener,noreferrer');
      } else if (job.applyMode === 'external' && job.applyEmail) {
        window.location.href = `mailto:${job.applyEmail}`;
      }
      onMutate();
    } else toast.error('Failed');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="relative z-10 w-full max-w-xl rounded-2xl bg-white max-h-[85vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white px-6 pt-6 pb-4 border-b border-slate-50">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{job.jobTitle}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Building className="h-3.5 w-3.5" />
                  {job.companyName}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {job.location}
                </span>
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  {job.jobType}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 text-slate-600 hover:text-slate-600 text-xl mt-0.5"
            >
              ✕
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {job.isSalaryDisclosed && (job.salaryMin || job.stipend) && (
              <span className="rounded-lg bg-green-50 px-3 py-1 text-xs font-semibold text-green-600">
                {job.jobType === 'Internship' && job.stipend
                  ? `₹${job.stipend.toLocaleString('en-IN')} monthly stipend`
                  : `${job.salaryMin ?? 0}${job.salaryMax && job.salaryMax !== job.salaryMin ? `–${job.salaryMax}` : ''} LPA`}
              </span>
            )}
            <span className={`rounded-lg bg-slate-100 px-3 py-1 text-xs ${ds.cls}`}>
              <Clock className="inline h-3 w-3 mr-1" />
              Deadline: {fmtDate(job.applicationDeadline)} ({ds.label})
            </span>
            {job.status && (
              <span
                className={`rounded-lg px-3 py-1 text-xs font-medium capitalize ${job.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-600'}`}
              >
                {job.status}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {job.description && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">
                Description
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {job.description}
              </p>
            </div>
          )}
          {job.requirements && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">
                Requirements
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {job.requirements}
              </p>
            </div>
          )}
          {job.responsibilities && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">
                Responsibilities
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {job.responsibilities}
              </p>
            </div>
          )}
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-600">
              Eligibility
            </h3>
            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-lg bg-slate-50 px-2.5 py-1.5">CGPA {job.minCgpa ?? 0}+</span>
              <span className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                Up to {job.maxBacklogs ?? 'any'} backlogs
              </span>
              {job.eligiblePrograms?.length > 0 && (
                <span className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                  {job.eligiblePrograms.join(', ')}
                </span>
              )}
              {job.eligibleBranches?.length > 0 && (
                <span className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                  {job.eligibleBranches.join(', ')}
                </span>
              )}
            </div>
            {job.eligible === false && (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                Not eligible: {job.reasons?.join(' · ')}
              </p>
            )}
          </div>
          {job.jobDescriptionFileUrl && (
            <a
              href={job.jobDescriptionFileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open job description
            </a>
          )}
          {!job.description && !job.requirements && !job.responsibilities && (
            <p className="text-sm text-slate-600">No additional details available.</p>
          )}
        </div>

        {/* Student actions */}
        {isStudent && (
          <div className="sticky bottom-0 bg-white border-t border-slate-50 px-6 py-4 flex gap-3 justify-end">
            <CustomButton
              variant="secondary"
              onClick={handleInterest}
              loading={isLoading}
              startIcon={
                job.hasInterest ? (
                  <BookmarkX className="h-4 w-4" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )
              }
              className="w-fit!"
            >
              {job.hasInterest ? 'Remove Interest' : 'Mark Interest'}
            </CustomButton>
            <CustomButton
              variant="primary"
              onClick={handleApply}
              loading={isLoading}
              disabled={job.hasApplied || job.status !== 'active' || job.eligible === false}
              startIcon={<CheckCircle className="h-4 w-4" />}
              className="w-fit!"
            >
              {job.hasApplied ? 'Applied ✓' : 'Apply Now'}
            </CustomButton>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Coordinator Admin Panel ───────────────────────────────────────────────────

function CoordinatorPanel({
  canCreate,
  canEdit,
  canApprove,
  canExport,
}: {
  canCreate: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canExport: boolean;
}) {
  const { data: raw, isLoading, mutate } = useSwr('job-posting/admin');
  const list: IJobPosting[] =
    (raw as { jobs?: IJobPosting[] })?.jobs ?? (raw as { data?: IJobPosting[] })?.data ?? [];
  const { mutation } = useMutation();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<IJobPosting | null>(null);
  const [viewing, setViewing] = useState<IJobPosting | null>(null);

  const handleClose = async (row: IJobPosting) => {
    const r = await Swal.fire({
      title: `Close "${row.jobTitle}"?`,
      text: 'No more applications will be accepted.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Close Posting',
      confirmButtonColor: '#dc2626',
    });
    if (!r.isConfirmed) return;
    const res = await mutation(`job-posting/${row._id}/close`, { method: 'PUT', body: {} });
    if (
      (res as { success?: boolean })?.success ||
      (res as { results?: { success?: boolean } })?.results?.success
    ) {
      toast.success('Posting closed');
      mutate();
    } else toast.error('Failed');
  };

  const handlePublish = async (row: IJobPosting) => {
    const answer = await Swal.fire({
      title: `Publish ${row.jobTitle}?`,
      text: 'Eligible students will be notified and the opportunity becomes visible immediately.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Publish opportunity',
      confirmButtonColor: '#0178D7',
    });
    if (!answer.isConfirmed) return;
    const result = await mutation(`job-posting/${row._id}/publish`, {
      method: 'PUT',
      body: {},
      isAlert: true,
    });
    if (result) {
      toast.success('Opportunity published');
      mutate();
    }
  };

  const cols: Column<IJobPosting>[] = [
    {
      field: 'companyName',
      title: 'Company',
      render: (r) => <p className="text-sm font-semibold">{String(r.companyName)}</p>,
    },
    {
      field: 'jobTitle',
      title: 'Role',
      render: (r) => (
        <div>
          <p className="text-sm">{String(r.jobTitle)}</p>
          <p className="text-xs text-slate-600">{String(r.jobType ?? '')}</p>
        </div>
      ),
    },
    {
      field: 'location',
      title: 'Location',
      render: (r) => <span className="text-xs text-slate-500">{String(r.location)}</span>,
    },
    {
      field: 'salaryMin',
      title: 'Compensation',
      render: (r) => (
        <span className="text-xs font-medium text-green-600">
          {r.jobType === 'Internship' && r.stipend
            ? `₹${r.stipend.toLocaleString('en-IN')}/month`
            : r.salaryMin
              ? `${r.salaryMin}${r.salaryMax && r.salaryMax !== r.salaryMin ? `–${r.salaryMax}` : ''} LPA`
              : 'Not disclosed'}
        </span>
      ),
    },
    {
      field: 'applicationDeadline',
      title: 'Deadline',
      render: (r) => {
        const ds = deadlineStatus(r.applicationDeadline);
        return <span className={`text-xs ${ds.cls}`}>{fmtDate(r.applicationDeadline)}</span>;
      },
    },
    {
      field: 'interestCount',
      title: 'Interest',
      render: (r) => <span className="text-sm font-medium">{r.interestCount ?? 0}</span>,
    },
    {
      field: 'appliedCount',
      title: 'Applied',
      render: (r) => <span className="text-sm font-medium">{r.appliedCount ?? 0}</span>,
    },
    {
      field: 'status',
      title: 'Status',
      render: (r) => (
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${r.status === 'active' ? 'bg-green-50 text-green-600' : r.status === 'closed' ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-600'}`}
        >
          {String(r.status ?? 'draft')}
        </span>
      ),
    },
  ];

  const actions: Action<IJobPosting>[] = [
    {
      tooltip: 'View',
      icon: <ExternalLink className="h-4 w-4" />,
      onClick: (r: IJobPosting) => setViewing(r),
    },
    ...(canEdit
      ? ([
          {
            tooltip: 'Edit',
            icon: <Edit2 className="h-4 w-4" />,
            onClick: (r: IJobPosting) => {
              setEditing(r);
              setShowModal(true);
            },
          },
        ] as Action<IJobPosting>[])
      : []),
    ...(canEdit
      ? ([
          {
            tooltip: 'Upload JD',
            icon: <Upload className="h-4 w-4" />,
            onClick: (r: IJobPosting) => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'application/pdf';
              input.onchange = async () => {
                const file = input.files?.[0];
                if (!file) return;
                const fd = new FormData();
                fd.append('jd', file);
                const resp = await mutation(`job-posting/${r._id}/jd`, {
                  method: 'POST',
                  body: fd,
                  isFormData: true,
                });
                const j = (
                  resp as
                    | {
                        results?: {
                          success?: boolean;
                          data?: { success?: boolean };
                          message?: string;
                        };
                      }
                    | undefined
                )?.results;
                if (resp && j?.data?.success !== false) {
                  toast.success('JD uploaded');
                  mutate();
                } else if (resp) toast.error(j?.message ?? 'Upload failed');
              };
              input.click();
            },
          },
        ] as Action<IJobPosting>[])
      : []),
    ...(canApprove
      ? ([
          {
            tooltip: 'Publish',
            icon: <Send className="h-4 w-4 text-primary" />,
            onClick: handlePublish,
            hidden: (r: IJobPosting) => r.status !== 'draft',
          },
        ] as Action<IJobPosting>[])
      : []),
    ...(canApprove
      ? ([
          {
            tooltip: 'Close',
            icon: <Lock className="h-4 w-4" />,
            onClick: handleClose,
            hidden: (r: IJobPosting) => r.status === 'closed',
            className: 'text-red-500',
          },
        ] as Action<IJobPosting>[])
      : []),
  ];

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <CustomButton
            variant="primary"
            onClick={() => {
              setEditing(null);
              setShowModal(true);
            }}
            startIcon={<Plus className="h-4 w-4" />}
            className="w-fit!"
          >
            New opportunity
          </CustomButton>
        </div>
      )}
      <DataViewSwitcher<IJobPosting>
        data={list}
        isLoading={isLoading}
        storageKey="job-posting.view"
        searchPlaceholder="Search companies or roles…"
        searchFields={['companyName', 'jobTitle', 'location', 'jobType']}
        renderCard={(j) => (
          <motion.div
            whileHover={{ y: -2 }}
            className="flex flex-col gap-3 rounded-2xl bg-white p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
                <Building className="h-5 w-5" />
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${j.status === 'closed' ? 'bg-slate-100 text-slate-500' : j.status === 'draft' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}
              >
                {j.status ?? 'active'}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{j.companyName}</p>
              <p className="text-xs text-slate-500">{j.jobTitle}</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-600">
                {j.jobType}
              </p>
            </div>
            <div className="space-y-1.5 text-xs text-slate-500">
              {j.location && (
                <p className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-slate-600" />
                  <span className="truncate">{j.location}</span>
                </p>
              )}
              {j.isSalaryDisclosed && (j.salaryMin || j.stipend) && (
                <p className="flex items-center gap-1.5">
                  <Bookmark className="h-3 w-3 text-amber-500" />
                  <span>
                    {j.jobType === 'Internship' && j.stipend
                      ? `₹${j.stipend.toLocaleString('en-IN')}/month`
                      : `${j.salaryMin ?? 0}${j.salaryMax && j.salaryMax !== j.salaryMin ? `–${j.salaryMax}` : ''} LPA`}
                  </span>
                </p>
              )}
              {j.applicationDeadline && (
                <p className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-slate-600" />
                  <span>Deadline: {String(j.applicationDeadline).slice(0, 10)}</span>
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                <p className="text-[10px] uppercase text-slate-600">Interested</p>
                <p className="font-bold text-slate-800">{j.interestCount ?? 0}</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                <p className="text-[10px] uppercase text-slate-600">Applied</p>
                <p className="font-bold text-slate-800">{j.appliedCount ?? 0}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3 text-xs">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(j);
                    setShowModal(true);
                  }}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  <Edit2 className="h-3 w-3" /> Edit
                </button>
              )}
              {canApprove && j.status === 'draft' && (
                <button
                  type="button"
                  onClick={() => handlePublish(j)}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  <Send className="h-3 w-3" />
                  Publish
                </button>
              )}
              {canApprove && j.status === 'active' && (
                <button
                  type="button"
                  onClick={() => handleClose(j)}
                  className="inline-flex items-center gap-1 font-medium text-red-500 hover:underline"
                >
                  <Lock className="h-3 w-3" /> Close
                </button>
              )}
            </div>
          </motion.div>
        )}
        table={
          <CustomTable<IJobPosting>
            title="Opportunity register"
            description="Draft, published and closed jobs or internships with engagement and application outcomes."
            data={list}
            columns={cols}
            actions={actions}
            isLoading={isLoading}
            onRefresh={() => void mutate()}
            options={{
              search: true,
              refresh: true,
              export: canExport,
              pagination: true,
              pageSize: 15,
              responsive: true,
            }}
            localization={{ toolbar: { searchPlaceholder: 'Search companies or roles…' } }}
          />
        }
      />
      <AnimatePresence>
        {showModal && (
          <JobModal editing={editing} onClose={() => setShowModal(false)} onSaved={mutate} />
        )}
        {viewing && (
          <JobDetailDrawer
            job={viewing}
            isStudent={false}
            onClose={() => setViewing(null)}
            onMutate={mutate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Student Browse Panel ──────────────────────────────────────────────────────

function StudentBrowsePanel() {
  const { data: raw, isLoading, mutate } = useSwr('job-posting');
  const list: IJobPosting[] =
    (raw as { jobs?: IJobPosting[] })?.jobs ?? (raw as { data?: IJobPosting[] })?.data ?? [];
  const [viewing, setViewing] = useState<IJobPosting | null>(null);
  const [filter, setFilter] = useState<'all' | 'interested' | 'applied'>('all');

  const filtered =
    filter === 'interested'
      ? list.filter((j) => j.hasInterest)
      : filter === 'applied'
        ? list.filter((j) => j.hasApplied)
        : list;

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-1 rounded-xl bg-white p-1.5 w-fit">
        {(['all', 'interested', 'applied'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors ${
              filter === f ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      ) : filtered.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((job, i) => {
            const ds = deadlineStatus(job.applicationDeadline);
            return (
              <motion.div
                key={job._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="cursor-pointer rounded-2xl bg-white p-4 transition-colors hover:bg-slate-50"
                onClick={() => setViewing(job)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{job.jobTitle}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{job.companyName}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {job.hasInterest && <Bookmark className="h-4 w-4 text-amber-500" />}
                    {job.hasApplied && <CheckCircle className="h-4 w-4 text-green-500" />}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    {job.jobType}
                  </span>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {job.location}
                  </span>
                  {job.isSalaryDisclosed && (job.salaryMin || job.stipend) && (
                    <span className="rounded-md bg-green-50 px-2 py-0.5 text-xs text-green-600 font-medium">
                      {job.jobType === 'Internship' && job.stipend
                        ? `₹${job.stipend.toLocaleString('en-IN')}/month`
                        : `${job.salaryMin ?? 0}${job.salaryMax && job.salaryMax !== job.salaryMin ? `–${job.salaryMax}` : ''} LPA`}
                    </span>
                  )}
                </div>
                <p className={`mt-2 text-xs ${ds.cls}`}>
                  <Clock className="inline h-3 w-3 mr-0.5" />
                  Deadline: {fmtDate(job.applicationDeadline)} · {ds.label}
                </p>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-14">
          <Briefcase className="h-10 w-10 text-slate-200 mb-2" />
          <p className="text-sm text-slate-600">
            {filter === 'all' ? 'No active job postings' : `No ${filter} postings`}
          </p>
        </div>
      )}

      <AnimatePresence>
        {viewing && (
          <JobDetailDrawer
            job={viewing}
            isStudent
            onClose={() => setViewing(null)}
            onMutate={mutate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function JobPostingPage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const canView = useHasPermission('placement', 'view');
  const canCreate = useHasPermission('placement', 'create');
  const canEdit = useHasPermission('placement', 'edit');
  const canApprove = useHasPermission('placement', 'approve');
  const canExport = useHasPermission('placement', 'export');
  const isStudent = activeRole === 'student';
  const [view, setView] = useState<'overview' | 'opportunities' | 'manage'>(
    isStudent ? 'opportunities' : 'overview',
  );
  if (!canView)
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-bold text-slate-900">Jobs and internships unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your active role cannot access opportunity management.
        </p>
      </div>
    );
  const tabs = isStudent
    ? [
        {
          id: 'opportunities' as const,
          label: 'Opportunities',
          detail: 'Jobs, internships and saved items',
          icon: Briefcase,
        },
      ]
    : [
        {
          id: 'overview' as const,
          label: 'Overview',
          detail: 'Reach, conversion and trends',
          icon: LayoutDashboard,
        },
        {
          id: 'manage' as const,
          label: 'Manage opportunities',
          detail: 'Draft, publish and monitor',
          icon: Target,
        },
      ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Jobs &amp; internships</h1>
        <p className="mt-1 max-w-4xl text-sm text-slate-500">
          Publish trusted off-campus opportunities, match eligible students and measure engagement
          from discovery through application.
        </p>
      </div>
      <div
        role="tablist"
        aria-label="Jobs and internships workspace"
        className="flex w-fit max-w-full gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2"
      >
        {tabs.map(({ id, label, detail, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors ${view === id ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${view === id ? 'bg-white/15' : 'bg-slate-100'}`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-xs font-bold">{label}</span>
              <span className={`text-[10px] ${view === id ? 'text-white/75' : 'text-slate-400'}`}>
                {detail}
              </span>
            </span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          {!isStudent && view === 'overview' && <OpportunityAnalytics />}
          {!isStudent && view === 'manage' && (
            <CoordinatorPanel
              canCreate={canCreate}
              canEdit={canEdit}
              canApprove={canApprove}
              canExport={canExport}
            />
          )}
          {isStudent && view === 'opportunities' && <StudentBrowsePanel />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

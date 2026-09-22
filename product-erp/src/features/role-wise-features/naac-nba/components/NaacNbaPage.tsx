/**
 * @file NaacNbaPage.tsx
 * @description NAAC Evidence management and NBA Report management.
 * @module features/role-wise-features/naac-nba
 */
'use client';
import React, { useState, useMemo } from 'react';
import {
  Award,
  FileText,
  Plus,
  Edit2,
  CheckCircle,
  Send,
  BarChart3,
  Stamp,
  LayoutDashboard,
  LockKeyhole,
  SlidersHorizontal,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import Swal from 'sweetalert2';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import CustomButton from '@/shared/core/CustomButton';
import AsyncSelect from '@/shared/core/AsyncSelect';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useAuthStore } from '@/shared/store/authStore';
import QualityWorkflowBar from '@/shared/components/QualityWorkflowBar';
import InlineFileUpload from '@/shared/core/InlineFileUpload';
import type { IViewerFile } from '@/shared/core/FileViewer';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import Empty from '@/shared/core/Empty';
import NaacNbaOverview from './NaacNbaOverview';
import { NaacTabInsights, NbaTabInsights } from './AccreditationTabInsights';

// ── Types ─────────────────────────────────────────────────────────────────────
type TNaacStatus = 'draft' | 'submitted' | 'approved' | 'revision_requested';
type TNaacCriterion = '1' | '2' | '3' | '4' | '5' | '6' | '7';

interface INaacEvidence {
  _id: string;
  criterion: TNaacCriterion;
  metricNo: string;
  title: string;
  description?: string;
  academicYear: string;
  status: TNaacStatus;
  score?: number;
  reviewNotes?: string;
  evidenceFiles: Array<{ url: string; name: string }>;
  submittedBy?: string | { _id: string; name?: string; email?: string };
  createdAt: string;
  [key: string]: unknown;
}

interface INbaReport {
  _id: string;
  programId: string;
  academicYear: string;
  program: string;
  departmentId: string | { _id: string; name?: string; code?: string };
  department?: string;
  semester: number;
  coAttainments: Array<{
    courseCode: string;
    courseName: string;
    coCode: string;
    coStatement: string;
    directAttainment: number;
    indirectAttainment: number;
    finalAttainment: number;
    attainmentLevel: 1 | 2 | 3;
  }>;
  poAttainments: Array<{ poCode: string; poStatement: string; attainmentLevel: number }>;
  thresholdMet?: boolean;
  status: 'draft' | 'approved';
  generatedBy?: string | { _id: string; name?: string; email?: string };
  createdAt: string;
  [key: string]: unknown;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const NAAC_STATUS_CFG: Record<TNaacStatus, { label: string; bg: string; text: string }> = {
  draft: { label: 'Draft', bg: 'bg-slate-100', text: 'text-slate-500' },
  submitted: { label: 'Submitted', bg: 'bg-blue-50', text: 'text-blue-600' },
  approved: { label: 'Approved', bg: 'bg-green-50', text: 'text-green-600' },
  revision_requested: { label: 'Revision Requested', bg: 'bg-amber-50', text: 'text-amber-600' },
};
const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';
const entityId = (value: string | { _id: string } | undefined) =>
  typeof value === 'string' ? value : (value?._id ?? '');
const reportDepartment = (report: INbaReport) =>
  report.department ??
  (typeof report.departmentId === 'object' ? report.departmentId.name : undefined) ??
  '—';

// ── NAAC Evidence Modal ────────────────────────────────────────────────────────
const naacSchema = Yup.object({
  criterion: Yup.string().required('Criterion is required'),
  metricNo: Yup.string().required('Metric number is required'),
  title: Yup.string().required('Title is required'),
  academicYear: Yup.string().required('Academic year is required'),
});

function NaacModal({
  evidence,
  onClose,
  onSaved,
}: {
  evidence: INaacEvidence | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const [files, setFiles] = useState<IViewerFile[]>(
    evidence?.evidenceFiles?.map((file) => ({ name: file.name, url: file.url })) ?? [],
  );

  const uploadEvidence = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const response = await mutation('upload', {
      method: 'POST',
      body: form,
      isFormData: true,
      dedupe: false,
    });
    const uploaded = response?.results?.data as { url?: string; filename?: string } | undefined;
    if (!uploaded?.url) return false;
    const url = uploaded.url;
    setFiles((current) => [...current, { name: uploaded.filename ?? file.name, url }]);
    return true;
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      criterion: evidence?.criterion ?? '1',
      metricNo: evidence?.metricNo ?? '',
      title: evidence?.title ?? '',
      description: evidence?.description ?? '',
      academicYear: evidence?.academicYear ?? '',
    },
    validationSchema: naacSchema,
    onSubmit: async (values) => {
      const path = evidence ? `naac-nba/naac/evidence/${evidence._id}` : 'naac-nba/naac/evidence';
      const method = (evidence ? 'PUT' : 'POST') as 'PUT' | 'POST';
      const res = await mutation(path, {
        method,
        body: {
          ...values,
          evidenceFiles: files.map((file) => ({ name: file.name, url: file.url })),
        },
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
        className="w-full max-w-md rounded-2xl bg-white p-6"
      >
        <h2 className="mb-5 text-lg font-semibold text-slate-900">
          {evidence ? 'Edit Evidence' : 'Add Evidence'}
        </h2>
        <form onSubmit={formik.handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Criterion *</label>
              <select className={inputCls} {...formik.getFieldProps('criterion')}>
                {['1', '2', '3', '4', '5', '6', '7'].map((c) => (
                  <option key={c} value={c}>
                    Criterion {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Metric No. *</label>
              <input
                className={inputCls}
                {...formik.getFieldProps('metricNo')}
                placeholder="e.g. 3.2.1"
              />
              {err('metricNo') && <p className="mt-1 text-xs text-red-500">{err('metricNo')}</p>}
            </div>
          </div>
          <div>
            <label className={labelCls}>Title *</label>
            <input
              className={inputCls}
              {...formik.getFieldProps('title')}
              placeholder="Evidence title..."
            />
            {err('title') && <p className="mt-1 text-xs text-red-500">{err('title')}</p>}
          </div>
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
            <label className={labelCls}>Description</label>
            <textarea
              className={inputCls}
              rows={3}
              {...formik.getFieldProps('description')}
              placeholder="Describe the evidence..."
            />
          </div>
          <InlineFileUpload
            label="Supporting evidence"
            required
            multiple
            files={files}
            onUpload={uploadEvidence}
            onRemove={async (_file, index) =>
              setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))
            }
            hint="Upload verified PDFs or images before submission"
          />
          <div className="flex justify-end gap-3 pt-1">
            <CustomButton variant="cancel" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton type="submit" loading={isLoading}>
              {evidence ? 'Update' : 'Add Evidence'}
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── NBA Report Modal ───────────────────────────────────────────────────────────
const nbaSchema = Yup.object({
  programId: Yup.string().required('Program is required'),
  academicYear: Yup.string().required('Academic year is required'),
  program: Yup.string().required('Program is required'),
  departmentId: Yup.string().required('Department is required'),
  semester: Yup.number().min(1).max(10).required(),
});

function NbaModal({
  report,
  onClose,
  onSaved,
}: {
  report?: INbaReport | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const isEdit = !!report;

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      programId: report?.programId ?? '',
      academicYear: report?.academicYear ?? '',
      program: report?.program ?? '',
      departmentId: entityId(report?.departmentId),
      semester: report?.semester ?? 0,
      coAttainments: report?.coAttainments?.length
        ? report.coAttainments
        : [
            {
              courseCode: '',
              courseName: '',
              coCode: 'CO1',
              coStatement: '',
              directAttainment: 0,
              indirectAttainment: 0,
              finalAttainment: 0,
              attainmentLevel: 1 as const,
            },
          ],
      poAttainments: report?.poAttainments?.length
        ? report.poAttainments
        : [{ poCode: 'PO1', poStatement: '', attainmentLevel: 0 }],
    },
    validationSchema: nbaSchema,
    onSubmit: async (values) => {
      const path = isEdit ? `naac-nba/nba/reports/${report!._id}` : 'naac-nba/nba/reports';
      const method = (isEdit ? 'PUT' : 'POST') as 'PUT' | 'POST';
      const res = await mutation(path, { method, body: values, isAlert: true });
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
        className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6"
      >
        <h2 className="mb-5 text-lg font-semibold text-slate-900">
          {isEdit ? 'Edit NBA Report' : 'Create NBA Report'}
        </h2>
        <form onSubmit={formik.handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <AsyncSelect
              type="academicYears"
              label="Academic Year"
              required
              value={formik.values.academicYear}
              onChange={(value) => formik.setFieldValue('academicYear', value ?? '')}
            />
            <AsyncSelect
              type="curricula"
              label="Programme curriculum"
              required
              value={formik.values.programId}
              onChange={(value, option) => {
                formik.setFieldValue('programId', value ?? '');
                formik.setFieldValue('program', option?.label ?? '');
                formik.setFieldValue('departmentId', '');
                formik.setFieldValue('semester', 0);
              }}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <AsyncSelect
              type="departments"
              label="Department"
              required
              params={{ curriculumId: formik.values.programId }}
              disabled={!formik.values.programId}
              value={formik.values.departmentId}
              onChange={(value) => {
                formik.setFieldValue('departmentId', value ?? '');
                formik.setFieldValue('semester', 0);
              }}
            />
            <AsyncSelect
              type="semesters"
              label="Semester"
              required
              params={{
                curriculumId: formik.values.programId,
                departmentId: formik.values.departmentId,
                academicYear: formik.values.academicYear,
                configured: true,
              }}
              disabled={!formik.values.departmentId}
              value={String(formik.values.semester || '')}
              onChange={(value) => formik.setFieldValue('semester', Number(value ?? 0))}
            />
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-700">Course outcome attainment</p>
                <p className="text-[11px] text-slate-600">
                  Record direct and indirect attainment. Final attainment is calculated as 80:20.
                </p>
              </div>
              <button
                type="button"
                className="text-xs font-medium text-primary"
                onClick={() =>
                  formik.setFieldValue('coAttainments', [
                    ...formik.values.coAttainments,
                    {
                      courseCode: '',
                      courseName: '',
                      coCode: `CO${formik.values.coAttainments.length + 1}`,
                      coStatement: '',
                      directAttainment: 0,
                      indirectAttainment: 0,
                      finalAttainment: 0,
                      attainmentLevel: 1,
                    },
                  ])
                }
              >
                Add CO
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {formik.values.coAttainments.map((co, index) => (
                <div
                  key={index}
                  className="grid gap-2 rounded-lg bg-white p-3 sm:grid-cols-2 lg:grid-cols-4"
                >
                  <input
                    value={co.courseCode}
                    placeholder="Course code"
                    className={inputCls}
                    onChange={(event) =>
                      formik.setFieldValue(`coAttainments.${index}.courseCode`, event.target.value)
                    }
                  />
                  <input
                    value={co.courseName}
                    placeholder="Course name"
                    className={inputCls}
                    onChange={(event) =>
                      formik.setFieldValue(`coAttainments.${index}.courseName`, event.target.value)
                    }
                  />
                  <input
                    value={co.coCode}
                    placeholder="CO1"
                    className={inputCls}
                    onChange={(event) =>
                      formik.setFieldValue(`coAttainments.${index}.coCode`, event.target.value)
                    }
                  />
                  <input
                    value={co.coStatement}
                    placeholder="CO statement"
                    className={inputCls}
                    onChange={(event) =>
                      formik.setFieldValue(`coAttainments.${index}.coStatement`, event.target.value)
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={co.directAttainment}
                    placeholder="Direct %"
                    className={inputCls}
                    onChange={(event) => {
                      const direct = Number(event.target.value);
                      const final = direct * 0.8 + Number(co.indirectAttainment) * 0.2;
                      formik.setFieldValue(`coAttainments.${index}.directAttainment`, direct);
                      formik.setFieldValue(`coAttainments.${index}.finalAttainment`, final);
                      formik.setFieldValue(
                        `coAttainments.${index}.attainmentLevel`,
                        final >= 70 ? 3 : final >= 60 ? 2 : 1,
                      );
                    }}
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={co.indirectAttainment}
                    placeholder="Indirect %"
                    className={inputCls}
                    onChange={(event) => {
                      const indirect = Number(event.target.value);
                      const final = Number(co.directAttainment) * 0.8 + indirect * 0.2;
                      formik.setFieldValue(`coAttainments.${index}.indirectAttainment`, indirect);
                      formik.setFieldValue(`coAttainments.${index}.finalAttainment`, final);
                      formik.setFieldValue(
                        `coAttainments.${index}.attainmentLevel`,
                        final >= 70 ? 3 : final >= 60 ? 2 : 1,
                      );
                    }}
                  />
                  <div className="col-span-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Final: {Number(co.finalAttainment).toFixed(1)}% · Level {co.attainmentLevel}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700">Programme outcome attainment</p>
              <button
                type="button"
                className="text-xs font-medium text-primary"
                onClick={() =>
                  formik.setFieldValue('poAttainments', [
                    ...formik.values.poAttainments,
                    {
                      poCode: `PO${formik.values.poAttainments.length + 1}`,
                      poStatement: '',
                      attainmentLevel: 0,
                    },
                  ])
                }
              >
                Add PO
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {formik.values.poAttainments.map((po, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[100px_1fr_130px]">
                  <input
                    value={po.poCode}
                    className={inputCls}
                    onChange={(event) =>
                      formik.setFieldValue(`poAttainments.${index}.poCode`, event.target.value)
                    }
                  />
                  <input
                    value={po.poStatement}
                    placeholder="PO statement"
                    className={inputCls}
                    onChange={(event) =>
                      formik.setFieldValue(`poAttainments.${index}.poStatement`, event.target.value)
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={po.attainmentLevel}
                    placeholder="Attainment %"
                    className={inputCls}
                    onChange={(event) =>
                      formik.setFieldValue(
                        `poAttainments.${index}.attainmentLevel`,
                        Number(event.target.value),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="hidden">
            {err('academicYear') && (
              <p className="mt-1 text-xs text-red-500">{err('academicYear')}</p>
            )}
            {err('program') && <p className="mt-1 text-xs text-red-500">{err('program')}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <CustomButton variant="cancel" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton type="submit" loading={isLoading}>
              {isEdit ? 'Save' : 'Create Report'}
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function NaacNbaPage() {
  const userId = useAuthStore((state) => state.user?._id);
  const canViewNaac = useHasPermission('naac', 'view');
  const canCreateNaac = useHasPermission('naac', 'create');
  const canReviewNaac = useHasPermission('naac', 'approve');
  const canViewNba = useHasPermission('nba', 'view');
  const canCreateNba = useHasPermission('nba', 'create');
  const canEditNba = useHasPermission('nba', 'edit');
  const canApproveNba = useHasPermission('nba', 'approve');
  const canView = canViewNaac || canViewNba;
  const canReview = canReviewNaac;
  const canGenerateReport = canCreateNba || canEditNba;

  const [tab, setTab] = useState<'overview' | 'naac' | 'nba'>('overview');
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCrit, setFilterCrit] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editEvidence, setEditEvidence] = useState<INaacEvidence | null>(null);
  const [nbaModalOpen, setNbaModalOpen] = useState(false);
  const [editReport, setEditReport] = useState<INbaReport | null>(null);
  const [nbaPage, setNbaPage] = useState(1);

  const handleFilterStatus = (v: string) => {
    setFilterStatus(v);
    setPage(1);
  };
  const handleFilterCrit = (v: string) => {
    setFilterCrit(v);
    setPage(1);
  };

  const naacUrl = useMemo(() => {
    const q = new URLSearchParams();
    q.set('page', String(page));
    q.set('limit', '15');
    if (academicYear) q.set('academicYear', academicYear);
    if (filterStatus) q.set('status', filterStatus);
    if (filterCrit) q.set('criterion', filterCrit);
    return `naac-nba/naac/evidence?${q.toString()}`;
  }, [page, filterStatus, filterCrit, academicYear]);

  const nbaUrl = useMemo(() => {
    const q = new URLSearchParams();
    q.set('page', String(nbaPage));
    q.set('limit', '15');
    if (academicYear) q.set('academicYear', academicYear);
    return `naac-nba/nba/reports?${q.toString()}`;
  }, [nbaPage, academicYear]);

  const {
    data: naacRaw,
    error: naacError,
    isLoading: naacLoading,
    mutate: mutateNaac,
    isValidating: naacValidating,
  } = useSwr(canViewNaac && academicYear ? naacUrl : null);
  const {
    data: nbaRaw,
    error: nbaError,
    isLoading: nbaLoading,
    mutate: mutateNba,
    isValidating: nbaValidating,
  } = useSwr(canViewNba && academicYear ? nbaUrl : null);
  const { mutation } = useMutation();

  const evidences: INaacEvidence[] = useMemo(
    () =>
      (naacRaw as { data?: { data?: INaacEvidence[] } })?.data?.data ??
      (naacRaw as { data?: INaacEvidence[] })?.data ??
      [],
    [naacRaw],
  );
  const totalEvidences = useMemo(
    () => (naacRaw as { data?: { total?: number } })?.data?.total ?? evidences.length,
    [naacRaw, evidences],
  );

  const reports: INbaReport[] = useMemo(
    () =>
      (nbaRaw as { data?: { data?: INbaReport[] } })?.data?.data ??
      (nbaRaw as { data?: INbaReport[] })?.data ??
      [],
    [nbaRaw],
  );
  const totalReports = useMemo(
    () => (nbaRaw as { data?: { total?: number } })?.data?.total ?? reports.length,
    [nbaRaw, reports],
  );

  const evidenceOwnerId = (row: INaacEvidence) =>
    typeof row.submittedBy === 'string' ? row.submittedBy : row.submittedBy?._id;
  const reportGeneratorId = (row: INbaReport) =>
    typeof row.generatedBy === 'string' ? row.generatedBy : row.generatedBy?._id;

  const handleSubmit = async (ev: INaacEvidence) => {
    const conf = await Swal.fire({
      title: 'Submit Evidence?',
      text: ev.title,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Submit',
      confirmButtonColor: '#0178D7',
    });
    if (conf.isConfirmed) {
      const res = await mutation(`naac-nba/naac/evidence/${ev._id}/submit`, {
        method: 'POST',
        body: {},
        isAlert: true,
      });
      if (res) mutateNaac();
    }
  };

  const handleReview = async (ev: INaacEvidence, approved: boolean) => {
    const conf = await Swal.fire({
      title: approved ? 'Approve Evidence?' : 'Request Revision?',
      input: 'textarea',
      inputLabel: 'Review notes',
      inputPlaceholder: approved
        ? 'Record the verification performed'
        : 'Explain exactly what must be corrected',
      inputValidator: (value) =>
        value.trim().length < 5 ? 'Provide review notes of at least 5 characters' : undefined,
      showCancelButton: true,
      confirmButtonText: approved ? 'Approve' : 'Request Revision',
      confirmButtonColor: '#0178D7',
    });
    if (conf.isConfirmed) {
      let score: number | undefined;
      if (approved) {
        const scoreAnswer = await Swal.fire({
          title: 'NAAC metric score',
          input: 'number',
          inputAttributes: { min: '0', max: '4', step: '0.1' },
          inputValidator: (value) =>
            value === '' || Number(value) < 0 || Number(value) > 4
              ? 'Enter a score from 0 to 4'
              : undefined,
          showCancelButton: true,
        });
        if (!scoreAnswer.isConfirmed) return;
        score = Number(scoreAnswer.value);
      }
      const res = await mutation(`naac-nba/naac/evidence/${ev._id}/review`, {
        method: 'PUT',
        body: {
          status: approved ? 'approved' : 'revision_requested',
          reviewNotes: conf.value.trim(),
          score,
        },
        isAlert: true,
      });
      if (res) mutateNaac();
    }
  };

  const naacColumns: Column<INaacEvidence>[] = [
    {
      field: 'criterion',
      title: 'Criterion',
      render: (r) => (
        <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-bold text-primary">
          C{r.criterion}
        </span>
      ),
    },
    {
      field: 'metricNo',
      title: 'Metric',
      render: (r) => <span className="text-sm font-mono text-slate-700">{r.metricNo}</span>,
    },
    {
      field: 'title',
      title: 'Title',
      render: (r) => <p className="text-sm text-slate-800 line-clamp-1">{r.title}</p>,
    },
    {
      field: 'academicYear',
      title: 'Year',
      render: (r) => <span className="text-xs text-slate-500">{r.academicYear}</span>,
    },
    {
      field: 'score',
      title: 'Score',
      render: (r) => <span className="text-sm font-medium text-slate-700">{r.score ?? '—'}</span>,
    },
    {
      field: 'status',
      title: 'Status',
      render: (r) => {
        const c = NAAC_STATUS_CFG[r.status] ?? NAAC_STATUS_CFG.draft;
        return (
          <span className={'rounded-full px-2.5 py-0.5 text-xs font-medium ' + c.bg + ' ' + c.text}>
            {c.label}
          </span>
        );
      },
    },
  ];

  const naacActions: Action<INaacEvidence>[] = [
    {
      tooltip: 'Edit',
      icon: <Edit2 className="h-3.5 w-3.5" />,
      onClick: (r: INaacEvidence) => {
        setEditEvidence(r);
        setModalOpen(true);
      },
      hidden: (r: INaacEvidence) =>
        evidenceOwnerId(r) !== userId || !['draft', 'revision_requested'].includes(r.status),
    },
    {
      tooltip: 'Submit',
      icon: <Send className="h-3.5 w-3.5" />,
      onClick: handleSubmit,
      hidden: (r: INaacEvidence) =>
        evidenceOwnerId(r) !== userId || !['draft', 'revision_requested'].includes(r.status),
    },
    {
      tooltip: 'Approve',
      icon: <CheckCircle className="h-3.5 w-3.5" />,
      onClick: (r: INaacEvidence) => handleReview(r, true),
      hidden: (r: INaacEvidence) =>
        !canReview || r.status !== 'submitted' || evidenceOwnerId(r) === userId,
    },
    {
      tooltip: 'Revise',
      icon: <Edit2 className="h-3.5 w-3.5" />,
      onClick: (r: INaacEvidence) => handleReview(r, false),
      hidden: (r: INaacEvidence) =>
        !canReview || r.status !== 'submitted' || evidenceOwnerId(r) === userId,
    },
  ];

  const nbaColumns: Column<INbaReport>[] = [
    {
      field: 'academicYear',
      title: 'Year',
      render: (r) => <span className="text-sm font-medium text-slate-700">{r.academicYear}</span>,
    },
    {
      field: 'program',
      title: 'Program',
      render: (r) => <span className="text-sm text-slate-700">{r.program}</span>,
    },
    {
      field: 'department',
      title: 'Dept',
      render: (r) => <span className="text-sm text-slate-500">{reportDepartment(r)}</span>,
    },
    {
      field: 'status',
      title: 'Status',
      render: (r) => (
        <span
          className={
            'rounded-full px-2.5 py-0.5 text-xs font-medium ' +
            (r.status === 'approved' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500')
          }
        >
          {r.status === 'approved' ? 'Approved' : 'Draft'}
        </span>
      ),
    },
    {
      field: 'createdAt',
      title: 'Created',
      render: (r) => (
        <span className="text-xs text-slate-600">
          {new Date(r.createdAt).toLocaleDateString('en-IN')}
        </span>
      ),
    },
  ];

  const handleApproveReport = async (r: INbaReport) => {
    const conf = await Swal.fire({
      title: 'Approve NBA Report?',
      text: `${r.program} — ${r.academicYear}`,
      icon: 'question',
      input: 'textarea',
      inputPlaceholder: 'Approval comments (optional)',
      showCancelButton: true,
      confirmButtonText: 'Approve',
      confirmButtonColor: '#0178D7',
    });
    if (conf.isConfirmed) {
      const res = await mutation(`naac-nba/nba/reports/${r._id}/approve`, {
        method: 'POST',
        body: { comments: conf.value ?? '' },
        isAlert: true,
      });
      if (res) mutateNba();
    }
  };

  const nbaActions: Action<INbaReport>[] = [
    {
      tooltip: 'Edit',
      icon: <Edit2 className="h-3.5 w-3.5" />,
      onClick: (r: INbaReport) => setEditReport(r),
      hidden: (r: INbaReport) => !canEditNba || r.status === 'approved',
    },
    {
      tooltip: 'Approve',
      icon: <Stamp className="h-3.5 w-3.5" />,
      onClick: handleApproveReport,
      hidden: (r: INbaReport) =>
        !canApproveNba || r.status === 'approved' || reportGeneratorId(r) === userId,
    },
  ];

  const NaacRegisterEmptyState = () => (
    <Empty
      title="No NAAC evidence for this academic year"
      subTitle={
        canCreateNaac
          ? 'Start with one criterion metric and attach its supporting institutional documents.'
          : 'Your role can view this register, but it does not have permission to add evidence. An authorized quality-team member must create the first record.'
      }
      pathName={canCreateNaac ? 'Add first evidence' : undefined}
      onClick={
        canCreateNaac
          ? () => {
              setEditEvidence(null);
              setModalOpen(true);
            }
          : undefined
      }
    />
  );

  const NbaRegisterEmptyState = () => (
    <Empty
      title="No NBA outcome report for this academic year"
      subTitle={
        canGenerateReport
          ? 'Create the first programme report with its CO and PO attainment evidence.'
          : 'Your role can view this register, but it does not have permission to prepare reports. An authorized quality or academic owner must create the first record.'
      }
      pathName={canGenerateReport ? 'Create first report' : undefined}
      onClick={canGenerateReport ? () => setNbaModalOpen(true) : undefined}
    />
  );

  if (!canView) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-lg font-semibold text-slate-900">Accreditation access unavailable</h1>
        <p className="mt-1 text-sm text-slate-600">
          The active role is not authorized for NAAC or NBA records.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <QualityWorkflowBar />
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">NAAC / NBA</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage institutional accreditation evidence and programme outcome reports.
          </p>
        </div>
        <div className="w-56">
          <AsyncSelect
            type="academicYears"
            label="Academic year"
            value={academicYear || null}
            onChange={(value) => {
              setAcademicYear(value ?? '');
              setPage(1);
              setNbaPage(1);
            }}
            placeholder="Select academic year"
          />
        </div>
        {tab === 'naac' && academicYear && canCreateNaac && (
          <CustomButton
            startIcon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setEditEvidence(null);
              setModalOpen(true);
            }}
          >
            Add Evidence
          </CustomButton>
        )}
        {tab === 'naac' && academicYear && !canCreateNaac && (
          <button
            type="button"
            disabled
            title="Your active role does not include NAAC create permission"
            className="inline-flex min-h-10 cursor-not-allowed items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-400"
          >
            <LockKeyhole className="h-4 w-4" /> Add Evidence
          </button>
        )}
        {tab === 'nba' && academicYear && canGenerateReport && (
          <CustomButton
            startIcon={<Plus className="h-4 w-4" />}
            onClick={() => setNbaModalOpen(true)}
          >
            Create Report
          </CustomButton>
        )}
        {tab === 'nba' && academicYear && !canGenerateReport && (
          <button
            type="button"
            disabled
            title="Your active role does not include NBA create or edit permission"
            className="inline-flex min-h-10 cursor-not-allowed items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-400"
          >
            <LockKeyhole className="h-4 w-4" /> Create Report
          </button>
        )}
      </motion.div>

      <nav
        className="flex w-fit max-w-full gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2"
        role="tablist"
        aria-label="Accreditation workspace"
      >
        {(
          [
            {
              id: 'overview',
              label: 'Overview',
              detail: 'Readiness & pipeline',
              icon: LayoutDashboard,
            },
            { id: 'naac', label: 'NAAC', detail: 'Institution evidence', icon: Award },
            { id: 'nba', label: 'NBA', detail: 'Programme outcomes', icon: FileText },
          ] as const
        )
          .filter(
            (item) => item.id === 'overview' || (item.id === 'naac' ? canViewNaac : canViewNba),
          )
          .map(({ id, label, detail, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors ${tab === id ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${tab === id ? 'bg-white/15' : 'bg-slate-100'}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-xs font-bold">{label}</span>
                <span
                  className={`mt-0.5 block text-[10px] ${tab === id ? 'text-white/75' : 'text-slate-400'}`}
                >
                  {detail}
                </span>
              </span>
            </button>
          ))}
      </nav>

      {(naacError || nbaError) && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-5">
          <div>
            <p className="font-semibold text-red-800">Accreditation records could not be loaded</p>
            <p className="text-sm text-red-700">Check your connection or access, then retry.</p>
          </div>
          <button
            type="button"
            onClick={() => void Promise.all([mutateNaac(), mutateNba()])}
            className="min-h-10 rounded-xl border border-red-200 bg-white px-3.5 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      )}

      {!academicYear && (
        <div className="rounded-2xl bg-white">
          <Empty
            title="Select an academic year"
            subTitle="Choose the accreditation reporting period above to load evidence, readiness and outcome reports."
          />
        </div>
      )}
      {tab === 'overview' && academicYear && (
        <NaacNbaOverview
          evidences={evidences}
          reports={reports}
          loading={naacLoading || nbaLoading}
        />
      )}

      {tab === 'naac' && academicYear && (
        <>
          <section className="rounded-2xl bg-white p-4 sm:p-5">
            <p className="text-sm font-semibold text-slate-800">NAAC institutional evidence</p>
            <p className="mt-1 text-xs text-slate-500">
              Use this workspace to prove institution-level quality metrics during NAAC
              accreditation. Each record connects one criterion and metric to supporting documents
              and reviewer decisions.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {[
                ['1', 'Document', 'Add criterion evidence and verified supporting files.'],
                ['2', 'Submit', 'Send the completed metric to an independent reviewer.'],
                ['3', 'Resolve', 'Approve the evidence or return it with clear revision notes.'],
              ].map(([step, title, detail]) => (
                <div key={step} className="flex gap-3 rounded-xl bg-slate-50 p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-primary">
                    {step}
                  </span>
                  <span>
                    <span className="block text-xs font-semibold text-slate-700">{title}</span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">
                      {detail}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>
          <NaacTabInsights records={evidences} />
          {canReview && <NaacCriterionSummary academicYear={academicYear} />}
          <DataViewSwitcher<INaacEvidence>
            data={evidences}
            isLoading={naacLoading}
            storageKey="naac.view"
            searchPlaceholder="Search evidences…"
            searchFields={['title', 'criterion', 'metricNo', 'academicYear', 'status']}
            pageSize={20}
            emptyMessage="No NAAC evidence for this academic year"
            emptySubTitle={
              canCreateNaac
                ? 'Use Add Evidence to create the first criterion metric record.'
                : 'Your role has view access only. An authorized quality-team member must add evidence.'
            }
            toolbarLeft={
              <button
                type="button"
                onClick={() => setShowFilters((value) => !value)}
                className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  showFilters || filterCrit || filterStatus
                    ? 'border-primary-100 bg-primary-50 text-primary'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
                aria-expanded={showFilters}
                aria-controls="naac-register-filters"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
                {(filterCrit || filterStatus) && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-white">
                    {[filterCrit, filterStatus].filter(Boolean).length}
                  </span>
                )}
              </button>
            }
            toolbarPanel={
              <AnimatePresence initial={false}>
                {showFilters && (
                  <motion.section
                    id="naac-register-filters"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden rounded-xl bg-white"
                    aria-label="NAAC evidence filters"
                  >
                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
                      <label className="w-full sm:w-48">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                          Criterion
                        </span>
                        <select
                          value={filterCrit}
                          onChange={(e) => handleFilterCrit(e.target.value)}
                          className="min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          <option value="">All criteria</option>
                          {['1', '2', '3', '4', '5', '6', '7'].map((criterion) => (
                            <option key={criterion} value={criterion}>
                              Criterion {criterion}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="w-full sm:w-52">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                          Review status
                        </span>
                        <select
                          value={filterStatus}
                          onChange={(e) => handleFilterStatus(e.target.value)}
                          className="min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          <option value="">All statuses</option>
                          <option value="draft">Draft</option>
                          <option value="submitted">Submitted</option>
                          <option value="approved">Approved</option>
                          <option value="revision_requested">Revision requested</option>
                        </select>
                      </label>
                      {(filterCrit || filterStatus) && (
                        <button
                          type="button"
                          onClick={() => {
                            handleFilterCrit('');
                            handleFilterStatus('');
                          }}
                          className="min-h-10 w-fit rounded-lg px-3 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  </motion.section>
                )}
              </AnimatePresence>
            }
            renderCard={(e) => {
              const statusStyle =
                e.status === 'approved'
                  ? 'bg-green-50 text-green-600'
                  : e.status === 'submitted'
                    ? 'bg-blue-50 text-blue-600'
                    : e.status === 'revision_requested'
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-slate-100 text-slate-500';
              const canEdit =
                evidenceOwnerId(e) === userId && ['draft', 'revision_requested'].includes(e.status);
              const rowCanReview =
                canReview && e.status === 'submitted' && evidenceOwnerId(e) !== userId;
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
                      {(e.status ?? '').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 line-clamp-2">{e.title}</p>
                    <p className="text-xs text-slate-600">
                      Criterion {e.criterion} · Metric {e.metricNo}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">AY {e.academicYear}</p>
                  </div>
                  {e.score != null && (
                    <p className="text-sm font-bold text-slate-800">Score: {e.score}</p>
                  )}
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3 text-xs">
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditEvidence(e);
                            setModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                        >
                          <Edit2 className="h-3 w-3" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSubmit(e)}
                          className="inline-flex items-center gap-1 font-medium text-green-600 hover:underline"
                        >
                          <Send className="h-3 w-3" /> Submit
                        </button>
                      </>
                    )}
                    {rowCanReview && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleReview(e, true)}
                          className="inline-flex items-center gap-1 font-medium text-green-600 hover:underline"
                        >
                          <CheckCircle className="h-3 w-3" /> Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReview(e, false)}
                          className="inline-flex items-center gap-1 font-medium text-red-500 hover:underline"
                        >
                          <Stamp className="h-3 w-3" /> Revision
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            }}
            table={
              <div className="rounded-2xl bg-white overflow-hidden">
                <CustomTable
                  data={evidences}
                  columns={naacColumns}
                  actions={naacActions}
                  isLoading={naacLoading}
                  isValidating={naacValidating}
                  page={page}
                  totalCount={totalEvidences}
                  pageSize={15}
                  onPageChange={setPage}
                  title="NAAC evidence register"
                  description="Track criterion, metric, evidence ownership, review score and accreditation workflow status."
                  onRefresh={() => void mutateNaac()}
                  options={{ search: false, refresh: true, pagination: true, pageSize: 15 }}
                  components={{ emptyState: NaacRegisterEmptyState }}
                />
              </div>
            }
          />
        </>
      )}

      {tab === 'nba' && academicYear && (
        <>
          <section className="rounded-2xl bg-white p-4 sm:p-5">
            <p className="text-sm font-semibold text-slate-800">NBA programme outcome reports</p>
            <p className="mt-1 text-xs text-slate-500">
              Use this workspace to demonstrate programme-level outcome attainment during NBA
              accreditation. Each report consolidates CO and PO performance for one programme and
              review period.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {[
                ['1', 'Prepare', 'Compile programme, CO and PO attainment evidence.'],
                ['2', 'Verify', 'Review threshold performance and identify outcome gaps.'],
                ['3', 'Approve', 'Lock the verified report through independent approval.'],
              ].map(([step, title, detail]) => (
                <div key={step} className="flex gap-3 rounded-xl bg-slate-50 p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-primary">
                    {step}
                  </span>
                  <span>
                    <span className="block text-xs font-semibold text-slate-700">{title}</span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">
                      {detail}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>
          <NbaTabInsights records={reports} />
          {canApproveNba && <NbaPoSummary academicYear={academicYear} />}
          <DataViewSwitcher<INbaReport>
            data={reports}
            isLoading={nbaLoading}
            storageKey="naac-nba.nba.view"
            searchPlaceholder="Search reports…"
            searchFields={['academicYear', 'program', 'department', 'status']}
            pageSize={20}
            emptyMessage="No NBA outcome report for this academic year"
            emptySubTitle={
              canGenerateReport
                ? 'Use Create Report to add the first programme outcome record.'
                : 'Your role has view access only. An authorized quality or academic owner must create the report.'
            }
            renderCard={(r) => {
              const cfg =
                r.status === 'approved'
                  ? 'bg-green-50 text-green-600'
                  : 'bg-amber-50 text-amber-600';
              return (
                <motion.div
                  whileHover={{ y: -2 }}
                  className="flex flex-col gap-3 rounded-2xl bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${cfg}`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{r.program}</p>
                    <p className="text-xs text-slate-500">{reportDepartment(r)}</p>
                    <p className="text-[11px] text-slate-600">AY {r.academicYear}</p>
                  </div>
                  {r.createdAt && (
                    <p className="text-[11px] text-slate-600">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                  )}
                  {(canEditNba || canApproveNba) && r.status !== 'approved' && (
                    <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3 text-xs">
                      {canEditNba && (
                        <button
                          type="button"
                          onClick={() => setEditReport(r)}
                          className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-primary"
                        >
                          <Edit2 className="h-3 w-3" /> Edit
                        </button>
                      )}
                      {canApproveNba && reportGeneratorId(r) !== userId && (
                        <button
                          type="button"
                          onClick={() => handleApproveReport(r)}
                          className="inline-flex items-center gap-1 font-medium text-green-600 hover:underline"
                        >
                          <CheckCircle className="h-3 w-3" /> Approve
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            }}
            table={
              <div className="rounded-2xl bg-white overflow-hidden">
                <CustomTable
                  data={reports}
                  columns={nbaColumns}
                  actions={nbaActions}
                  isLoading={nbaLoading}
                  isValidating={nbaValidating}
                  page={nbaPage}
                  totalCount={totalReports}
                  pageSize={15}
                  onPageChange={setNbaPage}
                  title="NBA outcome report register"
                  description="Review programme, department, reporting period, preparation status and approval readiness."
                  onRefresh={() => void mutateNba()}
                  options={{ search: false, refresh: true, pagination: true, pageSize: 15 }}
                  components={{ emptyState: NbaRegisterEmptyState }}
                />
              </div>
            }
          />
        </>
      )}

      <AnimatePresence>
        {modalOpen && (
          <NaacModal
            evidence={editEvidence}
            onClose={() => {
              setModalOpen(false);
              setEditEvidence(null);
            }}
            onSaved={() => mutateNaac()}
          />
        )}
        {nbaModalOpen && (
          <NbaModal onClose={() => setNbaModalOpen(false)} onSaved={() => mutateNba()} />
        )}
        {editReport && (
          <NbaModal
            report={editReport}
            onClose={() => setEditReport(null)}
            onSaved={() => mutateNba()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── NAAC Criterion Summary ────────────────────────────────────────────────────────
function NaacCriterionSummary({ academicYear }: { academicYear: string }) {
  interface ISummaryRow {
    _id: string;
    total: number;
    approved?: number;
    submitted?: number;
    averageScore?: number;
  }
  const { data, isLoading } = useSwr<{ data?: ISummaryRow[] }>(
    academicYear
      ? `naac-nba/naac/evidence/summary?academicYear=${encodeURIComponent(academicYear)}`
      : null,
  );
  const rows = data?.data ?? [];
  if (isLoading)
    return (
      <div className="rounded-xl bg-white p-4 text-xs text-slate-600">
        Loading criterion summary…
      </div>
    );
  if (rows.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-slate-800">Criterion Summary</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {rows.map((r) => (
          <div key={r._id} className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] font-semibold text-primary">CRITERION {r._id}</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{r.total}</p>
            <p className="text-[10px] text-slate-500">
              {r.approved ?? 0} approved · {r.submitted ?? 0} submitted
            </p>
            {typeof r.averageScore === 'number' && (
              <p className="mt-1 text-[10px] text-amber-600">Avg: {r.averageScore.toFixed(1)}</p>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── NBA PO Department Summary ────────────────────────────────────────────────────
function NbaPoSummary({ academicYear }: { academicYear: string }) {
  interface IPoRow {
    program: string;
    averagePo?: number;
    poBreakdown?: { poCode: string; averagePercentage: number }[];
  }
  const [departmentId, setDepartmentId] = useState('');

  const url = useMemo(() => {
    if (!departmentId || !academicYear) return null;
    const q = new URLSearchParams({ departmentId, academicYear });
    return `naac-nba/nba/reports/po-summary?${q.toString()}`;
  }, [departmentId, academicYear]);

  const { data, isLoading } = useSwr<{ data?: IPoRow[] }>(url);
  const rows = data?.data ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-slate-800">Department PO Summary</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-50">
            <AsyncSelect
              type="departments"
              placeholder="Select department"
              value={departmentId || null}
              onChange={(v) => setDepartmentId(v ?? '')}
            />
          </div>
        </div>
      </div>
      {!url ? (
        <Empty
          title="Select a department"
          subTitle="Choose a department to view approved PO performance for the selected academic year."
        />
      ) : isLoading ? (
        <p className="text-xs text-slate-600">Loading PO summary…</p>
      ) : rows.length === 0 ? (
        <Empty
          title="No approved PO data"
          subTitle="Approved NBA reports for this department and academic year will appear here."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.program} className="rounded-xl bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{r.program}</p>
                </div>
                {typeof r.averagePo === 'number' && (
                  <p className="text-lg font-bold text-primary">{r.averagePo.toFixed(1)}%</p>
                )}
              </div>
              {r.poBreakdown && r.poBreakdown.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.poBreakdown.map((p) => (
                    <span key={p.poCode} className="rounded bg-white px-2 py-0.5 text-[10px]">
                      <span className="font-mono text-slate-600">{p.poCode}</span>{' '}
                      <span className="font-semibold text-primary">
                        {p.averagePercentage.toFixed(1)}%
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/**
 * @file LessonPlanPage.tsx
 * @description Lesson plan management with submit/approve workflow.
 * @module features/role-wise-features/lesson-plan
 */
'use client';
import React, { useState, useMemo } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { FileText, CheckCircle, Clock, Send, XCircle, Plus, Trash2, Pencil } from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import CustomButton from '@/shared/core/CustomButton';
import AsyncSelect from '@/shared/core/AsyncSelect';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { useAuthStore } from '@/shared/store/authStore';
import { ILessonPlan, TLessonPlanStatus } from '../types/lesson-plan.types';
import AcademicWorkflowBar from '@/shared/components/AcademicWorkflowBar';

const STATUS_CFG: Record<
  TLessonPlanStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  draft: { label: 'Draft', bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400' },
  submitted: { label: 'Submitted', bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-400' },
  approved: { label: 'Approved', bg: 'bg-green-50', text: 'text-green-600', dot: 'bg-green-400' },
  rejected: { label: 'Needs Revision', bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-400' },
};

interface IUnitForm {
  unitTitle: string;
  plannedTopics: string;
  plannedClasses: number;
  plannedStartDate: string;
  plannedEndDate: string;
  coMappings: string;
}

const emptyUnit = (): IUnitForm => ({
  unitTitle: '',
  plannedTopics: '',
  plannedClasses: 1,
  plannedStartDate: '',
  plannedEndDate: '',
  coMappings: '',
});

/**
 * Guided faculty editor for a governed, section-linked lesson plan.
 */
function LessonPlanModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: ILessonPlan | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const formik = useFormik({
    initialValues: {
      sectionId:
        typeof editing?.sectionId === 'object' ? editing.sectionId._id : (editing?.sectionId ?? ''),
      subjectId:
        typeof editing?.subjectId === 'object' ? editing.subjectId._id : (editing?.subjectId ?? ''),
      units: editing?.unitPlans?.map((unit) => ({
        unitTitle: unit.unitTitle,
        plannedTopics: unit.plannedTopics.join('\n'),
        plannedClasses: unit.plannedClasses,
        plannedStartDate: unit.plannedStartDate.slice(0, 10),
        plannedEndDate: unit.plannedEndDate.slice(0, 10),
        coMappings: unit.coMappings.join(', '),
      })) ?? [emptyUnit()],
    },
    validationSchema: Yup.object({
      sectionId: Yup.string().required('Select a class section'),
      subjectId: Yup.string().required('Select a subject'),
      units: Yup.array()
        .of(
          Yup.object({
            unitTitle: Yup.string().trim().min(2).required('Unit title is required'),
            plannedTopics: Yup.string().trim().required('Add at least one topic'),
            plannedClasses: Yup.number().integer().min(1).required(),
            plannedStartDate: Yup.string().required('Start date is required'),
            plannedEndDate: Yup.string().required('End date is required'),
            coMappings: Yup.string().trim().required('Map at least one course outcome'),
          }),
        )
        .min(1)
        .max(20),
    }),
    onSubmit: async (values) => {
      const body = {
        sectionId: values.sectionId,
        subjectId: values.subjectId,
        unitPlans: values.units.map((unit, index) => ({
          unitNo: index + 1,
          unitTitle: unit.unitTitle.trim(),
          plannedTopics: unit.plannedTopics
            .split('\n')
            .map((topic) => topic.trim())
            .filter(Boolean),
          plannedClasses: Number(unit.plannedClasses),
          plannedStartDate: unit.plannedStartDate,
          plannedEndDate: unit.plannedEndDate,
          coMappings: unit.coMappings
            .split(',')
            .map((code) => code.trim().toUpperCase())
            .filter(Boolean),
        })),
      };
      const response = await mutation(editing ? `lesson-plan/${editing._id}` : 'lesson-plan', {
        method: editing ? 'PUT' : 'POST',
        body,
        isAlert: true,
      });
      if ((response as { results?: { success?: boolean } })?.results?.success) {
        toast.success(editing ? 'Lesson plan updated' : 'Lesson plan draft created');
        onSaved();
      } else {
        toast.error('Unable to save the lesson plan');
      }
    },
  });

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close lesson-plan editor"
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white">
        <div className="flex items-start justify-between bg-slate-50 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Faculty planning workspace
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              {editing ? 'Edit lesson-plan draft' : 'Create lesson-plan draft'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Choose an assigned class and plan ordered units from the approved curriculum.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-600 hover:text-slate-700">
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={formik.handleSubmit} className="flex-1 space-y-5 overflow-y-auto p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <AsyncSelect
              label="Class Section"
              type="sections"
              params={{ master: true }}
              value={formik.values.sectionId || null}
              onChange={(sectionId) => {
                formik.setFieldValue('sectionId', sectionId ?? '');
                formik.setFieldValue('subjectId', '');
              }}
              error={
                formik.touched.sectionId && formik.errors.sectionId
                  ? String(formik.errors.sectionId)
                  : undefined
              }
              required
              placeholder="Search programme, branch, semester or section…"
            />
            <AsyncSelect
              label="Subject"
              type="subjects"
              params={{ sectionId: formik.values.sectionId }}
              value={formik.values.subjectId || null}
              onChange={(subjectId) => formik.setFieldValue('subjectId', subjectId ?? '')}
              error={
                formik.touched.subjectId && formik.errors.subjectId
                  ? String(formik.errors.subjectId)
                  : undefined
              }
              required
              disabled={!formik.values.sectionId}
              placeholder="Search assigned subject…"
            />
          </div>

          <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-700">
            Only a subject assigned to you in an approved timetable can be saved. Course-outcome
            codes must match the curriculum, for example CO1 or CO2.
          </div>

          <div className="space-y-4">
            {formik.values.units.map((unit, index) => (
              <section key={index} className="rounded-xl bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">Unit {index + 1}</h3>
                  {formik.values.units.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        formik.setFieldValue(
                          'units',
                          formik.values.units.filter((_, unitIndex) => unitIndex !== index),
                        )
                      }
                      className="text-red-500"
                      aria-label={`Remove unit ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    value={unit.unitTitle}
                    onChange={(event) =>
                      formik.setFieldValue(`units.${index}.unitTitle`, event.target.value)
                    }
                    placeholder="Unit title"
                    className="rounded-lg bg-white px-3 py-2 text-sm outline-none ring-1 ring-slate-200 focus:ring-primary"
                  />
                  <input
                    type="number"
                    min={1}
                    value={unit.plannedClasses}
                    onChange={(event) =>
                      formik.setFieldValue(`units.${index}.plannedClasses`, event.target.value)
                    }
                    placeholder="Planned classes"
                    className="rounded-lg bg-white px-3 py-2 text-sm outline-none ring-1 ring-slate-200 focus:ring-primary"
                  />
                  <textarea
                    value={unit.plannedTopics}
                    onChange={(event) =>
                      formik.setFieldValue(`units.${index}.plannedTopics`, event.target.value)
                    }
                    rows={4}
                    placeholder={'Planned topics\nOne topic per line'}
                    className="rounded-lg bg-white px-3 py-2 text-sm outline-none ring-1 ring-slate-200 focus:ring-primary sm:col-span-2"
                  />
                  <input
                    type="date"
                    value={unit.plannedStartDate}
                    onChange={(event) =>
                      formik.setFieldValue(`units.${index}.plannedStartDate`, event.target.value)
                    }
                    className="rounded-lg bg-white px-3 py-2 text-sm outline-none ring-1 ring-slate-200 focus:ring-primary"
                  />
                  <input
                    type="date"
                    value={unit.plannedEndDate}
                    onChange={(event) =>
                      formik.setFieldValue(`units.${index}.plannedEndDate`, event.target.value)
                    }
                    className="rounded-lg bg-white px-3 py-2 text-sm outline-none ring-1 ring-slate-200 focus:ring-primary"
                  />
                  <input
                    value={unit.coMappings}
                    onChange={(event) =>
                      formik.setFieldValue(`units.${index}.coMappings`, event.target.value)
                    }
                    placeholder="Course outcomes: CO1, CO2"
                    className="rounded-lg bg-white px-3 py-2 text-sm outline-none ring-1 ring-slate-200 focus:ring-primary sm:col-span-2"
                  />
                </div>
              </section>
            ))}
          </div>
          <CustomButton
            type="button"
            variant="tertiary"
            startIcon={<Plus className="h-4 w-4" />}
            disabled={formik.values.units.length >= 20}
            onClick={() => formik.setFieldValue('units', [...formik.values.units, emptyUnit()])}
          >
            Add Unit
          </CustomButton>
          <div className="sticky bottom-0 flex justify-end gap-2 bg-white py-3">
            <CustomButton type="button" variant="cancel" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton type="submit" loading={isLoading}>
              Save Draft
            </CustomButton>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LessonPlanPage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const canView = useHasPermission('lesson_plan', 'view');
  const canEdit = useHasPermission('lesson_plan', 'edit') && activeRole === 'faculty';
  const canApprove =
    useHasPermission('lesson_plan', 'approve') &&
    ['super_admin', 'dean_academic', 'hod'].includes(activeRole ?? '');
  const [editingPlan, setEditingPlan] = useState<ILessonPlan | null | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(0);

  const handleFilter = (v: string) => {
    setFilterStatus(v);
    setPage(0);
  };

  const apiUrl = useMemo(() => {
    const q = new URLSearchParams();
    q.set('page', String(page + 1));
    q.set('limit', '15');
    if (filterStatus) q.set('status', filterStatus);
    return `lesson-plan?${q.toString()}`;
  }, [page, filterStatus]);

  const { data: raw, error, isLoading, isValidating, mutate } = useSwr(canView ? apiUrl : null);
  const records = useMemo(
    () =>
      (raw as { data?: ILessonPlan[] | { data?: ILessonPlan[] } })?.data instanceof Array
        ? ((raw as { data: ILessonPlan[] }).data ?? [])
        : ((raw as { data?: { data?: ILessonPlan[] } })?.data?.data ?? []),
    [raw],
  );
  const totalCount = useMemo(
    () =>
      (raw as { total?: number })?.total ??
      (raw as { data?: { total?: number } })?.data?.total ??
      records.length,
    [raw, records],
  );

  const { mutation } = useMutation();

  const handleAction = async (row: ILessonPlan, endpoint: string, label: string) => {
    let body: { remark: string } | undefined;
    if (endpoint === 'reject') {
      const result = await Swal.fire({
        title: 'Reject lesson plan?',
        input: 'textarea',
        inputLabel: 'Reviewer feedback',
        inputPlaceholder: 'Explain what the faculty should correct…',
        inputValidator: (value) =>
          value.trim().length < 3 ? 'Provide at least three characters of feedback' : undefined,
        showCancelButton: true,
        confirmButtonText: 'Reject and return',
        confirmButtonColor: '#dc2626',
      });
      if (!result.isConfirmed) return;
      body = { remark: String(result.value).trim() };
    }
    const confirmed =
      endpoint === 'reject'
        ? true
        : (
            await Swal.fire({
              title: `${label}?`,
              icon: 'question',
              showCancelButton: true,
              confirmButtonText: label,
              confirmButtonColor: '#0178D7',
            })
          ).isConfirmed;
    if (confirmed) {
      const res = await mutation(`lesson-plan/${row._id}/${endpoint}`, {
        method: 'PATCH',
        body,
        isAlert: true,
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) mutate();
      else toast.error(`${label} failed`);
    }
  };

  const columns: Column<ILessonPlan>[] = [
    {
      field: 'subjectName',
      title: 'Subject',
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-slate-800">{row.subjectName ?? '—'}</p>
          <p className="text-xs text-slate-600">{row.subjectCode ?? ''}</p>
        </div>
      ),
    },
    {
      field: 'totalUnits',
      title: 'Plan',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex justify-center">
          <span className="text-sm text-slate-700">
            {row.totalUnits} units · {row.totalPlannedClasses} classes
          </span>
        </div>
      ),
    },
    {
      field: 'facultyName',
      title: 'Faculty',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex justify-center">
          <span className="text-sm text-slate-600">
            {row.facultyName ??
              (typeof row.facultyId === 'object' ? row.facultyId.name : undefined) ??
              '—'}
          </span>
        </div>
      ),
    },
    {
      field: 'semester',
      title: 'Class',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex justify-center">
          <span className="text-sm text-slate-700">
            Sem {row.semester} · Section {row.section}
          </span>
        </div>
      ),
    },
    {
      field: 'academicYear',
      title: 'Academic Year',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex justify-center">
          <span className="text-sm text-slate-700">{row.academicYear}</span>
        </div>
      ),
    },
    {
      field: 'status',
      title: 'Status',
      cellClassName: '!text-center',
      render: (row) => {
        const c = STATUS_CFG[row.status];
        return (
          <div className="flex justify-center">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
              {c.label}
            </span>
          </div>
        );
      },
    },
  ];

  const actions: Action<ILessonPlan>[] = [
    {
      tooltip: 'Edit Draft',
      icon: <Pencil className="h-4 w-4 text-primary" />,
      onClick: (row) => setEditingPlan(row),
      hidden: (row) => !canEdit || !['draft', 'rejected'].includes(row.status),
    },
    {
      tooltip: 'Submit',
      icon: <Send className="h-4 w-4 text-blue-500" />,
      onClick: (row) => handleAction(row, 'submit', 'Submit'),
      hidden: (row) => !canEdit || !['draft', 'rejected'].includes(row.status),
    },
    {
      tooltip: 'Approve',
      icon: <CheckCircle className="h-4 w-4 text-green-500" />,
      onClick: (row) => handleAction(row, 'approve', 'Approve'),
      hidden: (row) => !canApprove || row.status !== 'submitted',
    },
    {
      tooltip: 'Reject',
      icon: <XCircle className="h-4 w-4 text-red-500" />,
      onClick: (row) => handleAction(row, 'reject', 'Reject'),
      hidden: (row) => !canApprove || row.status !== 'submitted',
    },
  ];

  if (!canView) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Lesson plan access unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">Your active role cannot view lesson plans.</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Lesson plans could not be loaded</h1>
        <p className="mt-2 text-sm text-red-600">{error.message}</p>
        <CustomButton className="mx-auto mt-4 w-fit!" onClick={() => mutate()}>
          Try again
        </CustomButton>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <AcademicWorkflowBar />

      <div className="grid gap-3 rounded-xl bg-white p-4 sm:grid-cols-3">
        {[
          ['1. Faculty Draft', 'Plan ordered units for an assigned class and subject.'],
          ['2. Academic Review', 'HOD or Dean approves the submitted teaching plan.'],
          ['3. Track Delivery', 'Approval automatically creates the course-progress record.'],
        ].map(([title, description]) => (
          <div key={title} className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-800">{title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          {
            label: 'Total Plans',
            value: records.length,
            icon: <FileText className="h-4.5 w-4.5" />,
            color: 'bg-primary-50 text-primary',
          },
          {
            label: 'Submitted',
            value: records.filter((r) => r.status === 'submitted').length,
            icon: <Clock className="h-4.5 w-4.5" />,
            color: 'bg-blue-50 text-blue-600',
          },
          {
            label: 'Approved',
            value: records.filter((r) => r.status === 'approved').length,
            icon: <CheckCircle className="h-4.5 w-4.5" />,
            color: 'bg-green-50 text-green-600',
          },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.07 }}
            className="flex items-center gap-3 rounded-xl bg-white p-4"
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.color}`}
            >
              {s.icon}
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{isLoading ? '—' : s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
      >
        <DataViewSwitcher<ILessonPlan>
          data={records}
          isLoading={isLoading}
          storageKey="lesson-plan.view"
          searchPlaceholder="Search lesson plans…"
          searchFields={['subjectName', 'subjectCode', 'facultyName', 'academicYear', 'status']}
          pageSize={20}
          renderCard={(p) => {
            const statusStyle =
              p.status === 'approved'
                ? 'bg-green-50 text-green-600'
                : p.status === 'submitted'
                  ? 'bg-blue-50 text-blue-600'
                  : 'bg-amber-50 text-amber-600';
            const planned = p.totalPlannedClasses ?? 0;
            const completed = (p.unitPlans ?? []).reduce(
              (sum, unit) => sum + (unit.actualClasses ?? 0),
              0,
            );
            const pct = planned > 0 ? Math.min(100, Math.round((completed / planned) * 100)) : 0;
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
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${statusStyle}`}
                  >
                    {p.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {(p as { subjectName?: string }).subjectName ?? '—'}
                  </p>
                  <p className="font-mono text-[11px] text-slate-600">
                    {(p as { subjectCode?: string }).subjectCode}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {p.totalUnits} units · Sem {p.semester} · Section {p.section}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Progress</span>
                    <span className="font-bold text-slate-800">
                      {completed}/{planned} classes
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
                  <span className="text-slate-500">
                    {p.facultyName ??
                      (typeof p.facultyId === 'object' ? p.facultyId.name : undefined) ??
                      ''}
                  </span>
                  <div className="flex items-center gap-2">
                    {canEdit && ['draft', 'rejected'].includes(p.status) && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingPlan(p)}
                          className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-primary"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAction(p, 'submit', 'Submit')}
                          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                        >
                          <Send className="h-3 w-3" /> Submit
                        </button>
                      </>
                    )}
                    {canApprove && p.status === 'submitted' && (
                      <button
                        type="button"
                        onClick={() => handleAction(p, 'approve', 'Approve')}
                        className="inline-flex items-center gap-1 font-medium text-green-600 hover:underline"
                      >
                        <CheckCircle className="h-3 w-3" /> Approve
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          }}
          table={
            <div className="rounded-2xl bg-white overflow-hidden">
              <CustomTable<ILessonPlan>
                title="Lesson Plans"
                description="Plan curriculum delivery, submit for review, and generate verified course progress"
                onRefresh={() => mutate()}
                isRefreshing={isValidating}
                data={records}
                columns={columns}
                actions={actions}
                isLoading={isLoading}
                page={page}
                totalCount={totalCount}
                pageSize={15}
                onPageChange={setPage}
                customActions={
                  <div className="flex items-center gap-3">
                    <select
                      value={filterStatus}
                      onChange={(e) => handleFilter(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700  transition-all hover:border-slate-300 focus:border-primary focus:outline-none cursor-pointer"
                    >
                      <option value="">All Status</option>
                      <option value="draft">Draft</option>
                      <option value="submitted">Submitted</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Needs Revision</option>
                    </select>
                    {canEdit && (
                      <CustomButton
                        startIcon={<Plus className="h-4 w-4" />}
                        onClick={() => setEditingPlan(null)}
                      >
                        New Lesson Plan
                      </CustomButton>
                    )}
                  </div>
                }
                options={{
                  search: false,
                  pagination: true,
                  pageSize: 15,
                  actionsType: 'dropdown',
                  export: false,
                }}
              />
            </div>
          }
        />
      </motion.div>
      {editingPlan !== undefined && (
        <LessonPlanModal
          editing={editingPlan}
          onClose={() => setEditingPlan(undefined)}
          onSaved={() => {
            setEditingPlan(undefined);
            mutate();
          }}
        />
      )}
    </div>
  );
}

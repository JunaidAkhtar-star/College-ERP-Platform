/**
 * @file CurriculumPage.tsx
 * @description Curriculum management — list + create + edit for super_admin/dean_academic/hod.
 * @module features/role-wise-features/curriculum
 */
'use client';
import AcademicWorkflowBar from '@/shared/components/AcademicWorkflowBar';
import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Action, Column } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import { useFormik } from 'formik';
import {
  Archive,
  BookOpen,
  Calendar,
  CheckCircle,
  Edit2,
  Info,
  Layers,
  Plus,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import Swal from 'sweetalert2';
import AcademicSetupJourney from '../../academic-structure/components/AcademicSetupJourney';
import ImportMigrationDialog from '../../import-center/components/ImportMigrationDialog';

import { ICurriculum } from '../types/curriculum.types';

function subjectCount(curriculum: ICurriculum) {
  return (curriculum.semesterPlans ?? []).reduce(
    (total, plan) => total + (plan.subjects?.length ?? 0),
    0,
  );
}

function CurriculumModal({
  editing,
  onClose,
  onSaved,
}: {
  editing?: ICurriculum | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const isEdit = !!editing;
  const formik = useFormik({
    initialValues: {
      program: editing?.program ?? '',
      academicLevel: editing?.academicLevel ?? '',
      openForAdmissions: editing?.academicLevel ? (editing.openForAdmissions ?? false) : false,
      regulationYear: editing?.regulationYear ?? String(new Date().getFullYear()),
      totalSemesters: editing?.totalSemesters ?? 8,
      totalCreditsRequired: editing?.totalCreditsRequired ?? 160,
      version: editing?.version ?? 1,
      isActive: editing?.isActive ?? true,
    },
    validationSchema: Yup.object({
      program: Yup.string().trim().required('Program / Core Course name is required'),
      academicLevel: Yup.string().required('Academic level is required'),
      regulationYear: Yup.string()
        .trim()
        .matches(/^\d{4}$/, 'Must be a valid 4-digit year (e.g. 2024)')
        .required('Regulation year is required'),
      totalSemesters: Yup.number()
        .typeError('Semesters must be a valid number')
        .min(1, 'Minimum 1 semester required')
        .max(12, 'Maximum 12 semesters allowed')
        .required('Total semesters is required'),
      totalCreditsRequired: Yup.number()
        .typeError('Credits must be a valid number')
        .min(1, 'Minimum 1 credit required')
        .max(500, 'Maximum 500 credits allowed')
        .required('Total credits is required'),
      version: Yup.number()
        .typeError('Version must be a number')
        .min(1, 'Minimum version is 1')
        .required('Version is required'),
      openForAdmissions: Yup.boolean(),
      isActive: Yup.boolean(),
    }),
    onSubmit: async (values) => {
      const url = isEdit ? `curriculum/${editing!._id}` : 'curriculum';
      const res = await mutation(url, {
        method: isEdit ? 'PUT' : 'POST',
        body: values,
        isAlert: true,
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success(
          isEdit ? 'Curriculum updated successfully' : 'Curriculum created successfully',
        );
        onSaved();
      }
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
        className="relative z-10 w-full max-w-4xl rounded-2xl bg-white p-6 md:p-8  max-h-[90vh] overflow-y-auto"
      >
        <div className="mb-6 flex items-center justify-between pb-2">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {isEdit ? 'Edit Curriculum Structure' : 'Create New Curriculum'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Set up or update degree program regulation rules, credit requirements, and semesters.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={formik.handleSubmit} className="space-y-6">
          {/* Main Program & Academic Level Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Core Course / Degree Program <span className="text-red-500">*</span>
              </label>
              <input
                name="program"
                value={formik.values.program}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="e.g. B.Tech Computer Science"
                className={`w-full rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 border ${
                  formik.touched.program && formik.errors.program
                    ? 'border-red-400 focus:ring-red-400/20'
                    : 'border-slate-200 focus:ring-primary/20'
                }`}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Enter the full degree program title (e.g., B.Tech, M.Sc, MBA).
              </p>
              {formik.touched.program && formik.errors.program && (
                <p className="mt-1 text-xs font-medium text-red-500 flex items-center gap-1">
                  <span>⚠</span> {formik.errors.program}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Academic Level <span className="text-red-500">*</span>
              </label>
              <select
                name="academicLevel"
                value={formik.values.academicLevel}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className={`w-full rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 border ${
                  formik.touched.academicLevel && formik.errors.academicLevel
                    ? 'border-red-400 focus:ring-red-400/20'
                    : 'border-slate-200 focus:ring-primary/20'
                }`}
              >
                <option value="">Select academic level</option>
                <option value="certificate">Certificate</option>
                <option value="diploma">Diploma</option>
                <option value="undergraduate">Undergraduate</option>
                <option value="postgraduate">Postgraduate</option>
                <option value="doctoral">Doctoral</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                Select the educational qualification tier for this curriculum.
              </p>
              {formik.touched.academicLevel && formik.errors.academicLevel && (
                <p className="mt-1 text-xs font-medium text-red-500 flex items-center gap-1">
                  <span>⚠</span> {formik.errors.academicLevel}
                </p>
              )}
            </div>
          </div>

          {/* Academic Structure Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Regulation Year <span className="text-red-500">*</span>
              </label>
              <input
                name="regulationYear"
                value={formik.values.regulationYear}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="e.g. 2024"
                className={`w-full rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 border ${
                  formik.touched.regulationYear && formik.errors.regulationYear
                    ? 'border-red-400 focus:ring-red-400/20'
                    : 'border-slate-200 focus:ring-primary/20'
                }`}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Year of batch regulation scheme (e.g. R2024).
              </p>
              {formik.touched.regulationYear && formik.errors.regulationYear && (
                <p className="mt-1 text-xs font-medium text-red-500 flex items-center gap-1">
                  <span>⚠</span> {formik.errors.regulationYear}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Total Semesters <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="totalSemesters"
                value={formik.values.totalSemesters}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                min={1}
                max={12}
                placeholder="8"
                className={`w-full rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 border ${
                  formik.touched.totalSemesters && formik.errors.totalSemesters
                    ? 'border-red-400 focus:ring-red-400/20'
                    : 'border-slate-200 focus:ring-primary/20'
                }`}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Number of total term periods (1 - 12).
              </p>
              {formik.touched.totalSemesters && formik.errors.totalSemesters && (
                <p className="mt-1 text-xs font-medium text-red-500 flex items-center gap-1">
                  <span>⚠</span> {formik.errors.totalSemesters}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Total Credits Required <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="totalCreditsRequired"
                value={formik.values.totalCreditsRequired}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                min={1}
                max={500}
                placeholder="160"
                className={`w-full rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 border ${
                  formik.touched.totalCreditsRequired && formik.errors.totalCreditsRequired
                    ? 'border-red-400 focus:ring-red-400/20'
                    : 'border-slate-200 focus:ring-primary/20'
                }`}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Target total credits for degree completion.
              </p>
              {formik.touched.totalCreditsRequired && formik.errors.totalCreditsRequired && (
                <p className="mt-1 text-xs font-medium text-red-500 flex items-center gap-1">
                  <span>⚠</span> {formik.errors.totalCreditsRequired}
                </p>
              )}
            </div>
          </div>

          {/* Additional Settings & Enhanced Checkbox Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 rounded-2xl bg-slate-50 p-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Version <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="version"
                value={formik.values.version}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                min={1}
                className={`w-full rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 border ${
                  formik.touched.version && formik.errors.version
                    ? 'border-red-400 focus:ring-red-400/20'
                    : 'border-slate-200 focus:ring-primary/20'
                }`}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Revision iteration number of this scheme.
              </p>
              {formik.touched.version && formik.errors.version && (
                <p className="mt-1 text-xs font-medium text-red-500 flex items-center gap-1">
                  <span>⚠</span> {formik.errors.version}
                </p>
              )}
            </div>

            {/* Enhanced Checkbox Card 1: Open for Admissions */}
            <div
              onClick={() =>
                formik.setFieldValue('openForAdmissions', !formik.values.openForAdmissions)
              }
              className={`group flex items-start gap-3 rounded-xl p-3.5 border transition-all cursor-pointer select-none ${
                formik.values.openForAdmissions
                  ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                  formik.values.openForAdmissions
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-white border-slate-300 group-hover:border-slate-400'
                }`}
              >
                {formik.values.openForAdmissions && <CheckCircle className="h-3.5 w-3.5" />}
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 group-hover:text-slate-900 block">
                  Open for Admissions
                </span>
                <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                  Allow active student enrollment for this scheme.
                </p>
              </div>
            </div>

            {/* Enhanced Checkbox Card 2: Active Curriculum */}
            <div
              onClick={() => formik.setFieldValue('isActive', !formik.values.isActive)}
              className={`group flex items-start gap-3 rounded-xl p-3.5 border transition-all cursor-pointer select-none ${
                formik.values.isActive
                  ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                  formik.values.isActive
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-slate-300 group-hover:border-slate-400'
                }`}
              >
                {formik.values.isActive && <CheckCircle className="h-3.5 w-3.5" />}
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 group-hover:text-slate-900 block">
                  Active Curriculum
                </span>
                <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                  Enable this curriculum for institutional operations.
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton variant="primary" type="submit" loading={isLoading}>
              {isEdit ? 'Update Curriculum' : 'Create Curriculum'}
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function CurriculumPlanModal({
  curriculum,
  onClose,
  onSaved,
}: {
  curriculum: ICurriculum;
  onClose: () => void;
  onSaved: (updated?: ICurriculum) => void;
}) {
  const { mutation, isLoading } = useMutation();
  const [semesterNo, setSemesterNo] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string | null>(null);

  const plans = useMemo(
    () =>
      Array.from({ length: curriculum.totalSemesters }, (_, i) => {
        const semesterNo = i + 1;
        return (
          curriculum.semesterPlans?.find((p) => p.semesterNo === semesterNo) ?? {
            semesterNo,
            subjects: [],
            totalCredits: 0,
            totalTheoryHours: 0,
            totalLabHours: 0,
          }
        );
      }),
    [curriculum],
  );

  const totalPlannedCredits = useMemo(
    () => plans.reduce((acc, plan) => acc + (plan.totalCredits ?? 0), 0),
    [plans],
  );

  const totalPlannedSubjects = useMemo(
    () => plans.reduce((acc, plan) => acc + (plan.subjects?.length ?? 0), 0),
    [plans],
  );

  const creditProgress = useMemo(() => {
    if (!curriculum.totalCreditsRequired) return 0;
    return Math.min(100, Math.round((totalPlannedCredits / curriculum.totalCreditsRequired) * 100));
  }, [totalPlannedCredits, curriculum.totalCreditsRequired]);

  const handleAdd = async () => {
    if (!semesterNo || !subjectId) return;
    const res = await mutation(`curriculum/${curriculum._id}/semester-subjects`, {
      method: 'POST',
      body: { semesterNo: Number(semesterNo), subjectId },
      silentError: true,
      returnError: true,
    });
    if (res?.results?.success) {
      toast.success('Subject added to curriculum');
      setSubjectId(null);
      onSaved(res.results.data as ICurriculum);
    } else if (res) {
      toast.error(res.results?.message || 'Failed to add subject');
    }
  };

  const handleRemove = async (sem: number, subId: string) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to remove this subject from this semester?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--color-primary, #3b82f6)',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Yes, remove it!',
    });

    if (result.isConfirmed) {
      const res = await mutation(`curriculum/${curriculum._id}/semester-subjects/${sem}/${subId}`, {
        method: 'DELETE',
        silentError: true,
        returnError: true,
      });
      if (res?.status === 409) {
        Swal.fire({
          title: 'Cannot Delete Subject',
          text: 'This subject cannot be removed because active student batches have already started using this curriculum. To delete this subject, you must first remove/unlink any batches using this curriculum under Batches & Sections, or create a new curriculum version.',
          icon: 'error',
          confirmButtonColor: 'var(--color-primary, #3b82f6)',
        });
        return;
      }
      if (res?.results?.success) {
        toast.success('Subject removed');
        onSaved(res.results.data as ICurriculum);
      } else if (res) {
        toast.error(res.results?.message || 'Failed to remove subject');
      }
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
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="relative z-10 flex h-full max-h-[92dvh] w-full max-w-6xl flex-col rounded-2xl border border-slate-100 bg-white  overflow-hidden"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Plan Curriculum Subjects</h2>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-medium text-slate-700">{curriculum.program}</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">
                  <Calendar className="h-3 w-3" /> Regulation {curriculum.regulationYear}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stats Panel & Add Subject (Left Sidebar) and Semesters List (Right Pane) */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar */}
          <div className="w-96 shrink-0 border-r border-slate-100 bg-slate-50/40 p-5 overflow-y-auto flex flex-col gap-5">
            {/* Stats Panel */}
            <div className="flex flex-col justify-center rounded-xl border border-slate-150 bg-white p-4 ">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                Structure Overview
              </span>
              <span className="mt-1 text-base font-bold text-slate-800">
                {curriculum.totalSemesters} Semesters
              </span>
              <span className="text-xs text-slate-500">Planned duration template</span>
            </div>

            <div className="flex flex-col justify-center rounded-xl border border-slate-150 bg-white p-4 ">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  Credits Progress
                </span>
              </div>
              <span className="mt-1.5 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary w-fit">
                {totalPlannedCredits} / {curriculum.totalCreditsRequired} Credits
              </span>
              <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${creditProgress}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>{totalPlannedSubjects} subjects planned</span>
                <span className="font-semibold text-slate-700">{creditProgress}% complete</span>
              </div>
            </div>

            {/* Add Subject Section */}
            <div className="rounded-xl border border-slate-200 bg-white p-4  flex flex-col gap-4">
              <div className="text-sm font-bold text-slate-800">
                <span>Map Subject to Semester</span>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-500">Select Semester</span>
                  <AsyncSelect
                    type="semesters"
                    value={semesterNo || null}
                    onChange={(v) => setSemesterNo(v ?? '')}
                    params={{ curriculumId: curriculum._id }}
                    placeholder="Choose sem..."
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-500">Choose Subject</span>
                  <AsyncSelect
                    type="subjects"
                    value={subjectId}
                    onChange={(v) => setSubjectId(v)}
                    placeholder="Search catalogue..."
                  />
                </div>
                <CustomButton
                  type="button"
                  variant="primary"
                  loading={isLoading}
                  disabled={!semesterNo || !subjectId}
                  onClick={handleAdd}
                  className="w-full h-10 text-sm font-bold "
                >
                  Add Subject
                </CustomButton>
              </div>
            </div>
          </div>

          {/* Right Scrollable Content Pane */}
          <div className="flex-1 overflow-y-auto bg-slate-50/10 p-6">
            <div className="grid gap-6 md:grid-cols-2">
              {plans.map((plan) => (
                <div
                  key={plan.semesterNo}
                  className="flex flex-col rounded-xl border border-slate-200/60 bg-white p-4  transition-all hover:border-slate-300 "
                >
                  {/* Semester Header */}
                  <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-700">
                        S{plan.semesterNo}
                      </span>
                      <span className="text-sm font-bold text-slate-800">
                        Semester {plan.semesterNo}
                      </span>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {plan.totalCredits} credits
                    </span>
                  </div>

                  {/* Semester Subjects */}
                  {plan.subjects.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
                      <Info className="mb-1 h-5 w-5 text-slate-300" />
                      <p className="text-xs font-medium text-slate-600">No subjects mapped yet</p>
                    </div>
                  ) : (
                    <div className="flex-1 space-y-2">
                      {plan.subjects.map((subject) => {
                        const ltpParts = [];
                        if (subject.theoryHours) ltpParts.push(`L: ${subject.theoryHours}`);
                        if (subject.tutorialHours) ltpParts.push(`T: ${subject.tutorialHours}`);
                        if (subject.labHours) ltpParts.push(`P: ${subject.labHours}`);
                        const ltpString = ltpParts.length > 0 ? ltpParts.join(' · ') : null;

                        return (
                          <div
                            key={String(subject.subjectId)}
                            className="group relative flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 transition-colors hover:border-slate-200 hover:bg-slate-50"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate text-xs font-bold text-slate-700">
                                  {subject.subjectName}
                                </span>
                                {subject.isElective && (
                                  <span className="shrink-0 rounded bg-slate-100 px-1 py-0.2 text-[9px] font-bold text-slate-600 uppercase tracking-wide">
                                    Elective
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-600">
                                <span className="font-semibold text-slate-500">
                                  {subject.subjectCode}
                                </span>
                                <span>•</span>
                                <span>{subject.credits} Credits</span>
                                {ltpString && (
                                  <>
                                    <span>•</span>
                                    <span className="text-slate-600">{ltpString}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleRemove(plan.semesterNo, String(subject.subjectId))
                              }
                              className="rounded-md p-1.5 text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="Remove subject"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function CurriculumPage() {
  const canEdit = useHasPermission('curriculum', 'edit');
  const canCreate = useHasPermission('curriculum', 'create');
  const canStageImport = useHasPermission('import_center', 'create');
  const canImport = canCreate && canStageImport;
  const [filterProgram, setFilterProgram] = useState('');
  const [editing, setEditing] = useState<ICurriculum | null>(null);
  const [planning, setPlanning] = useState<ICurriculum | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.append('page', String(page + 1));
    params.append('limit', String(pageSize));
    if (filterProgram) params.append('program', filterProgram);
    return params.toString();
  }, [page, pageSize, filterProgram]);

  const { data: raw, isLoading, isValidating, mutate } = useSwr(`curriculum?${queryString}`);
  const { data: allRaw } = useSwr('curriculum?limit=1000');

  const records = useMemo(() => (raw as { data?: ICurriculum[] })?.data ?? [], [raw]);
  const allRecords = useMemo(() => (allRaw as { data?: ICurriculum[] })?.data ?? [], [allRaw]);

  const programs = useMemo(
    () => [...new Set(allRecords.map((r) => r.program))].sort(),
    [allRecords],
  );
  const filtered = records;

  const columns: Column<ICurriculum>[] = [
    {
      field: 'program',
      title: 'Core Course',
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-slate-800">{row.program}</p>
          <p className="text-xs text-slate-600">Regulation {row.regulationYear}</p>
        </div>
      ),
    },
    {
      field: 'regulationYear',
      title: 'Regulation',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex justify-center">
          <span className="text-sm text-slate-700">{row.regulationYear}</span>
        </div>
      ),
    },
    {
      field: 'academicLevel',
      title: 'Admission setup',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="text-center">
          <p className="text-sm capitalize text-slate-700">
            {row.academicLevel?.replace('_', ' ') ?? 'Needs classification'}
          </p>
          <p
            className={`text-xs font-medium ${row.openForAdmissions ? 'text-emerald-600' : 'text-slate-600'}`}
          >
            {row.openForAdmissions ? 'Open for admission' : 'Closed for admission'}
          </p>
        </div>
      ),
    },
    {
      field: 'totalSemesters',
      title: 'Semesters',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex justify-center">
          <span className="text-sm text-slate-700">{row.totalSemesters}</span>
        </div>
      ),
    },
    {
      field: 'totalCreditsRequired',
      title: 'Credits Required',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex justify-center">
          <span className="text-sm font-medium text-slate-700">{row.totalCreditsRequired}</span>
        </div>
      ),
    },
    {
      field: 'semesterPlans',
      title: 'Subjects',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex justify-center">
          <span className="text-sm text-slate-600">{subjectCount(row)}</span>
        </div>
      ),
    },
    {
      field: 'isActive',
      title: 'Status',
      cellClassName: '!text-center',
      render: (row) => (
        <div className="flex justify-center">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${row.isActive ? 'bg-secondary-50 text-secondary' : 'bg-slate-100 text-slate-500'}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${row.isActive ? 'bg-secondary' : 'bg-slate-400'}`}
            />
            {row.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <AcademicWorkflowBar />
      <AcademicSetupJourney />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          {
            label: 'Total Curricula',
            value: allRecords.length,
            icon: <BookOpen className="h-4.5 w-4.5" />,
            color: 'bg-primary-50 text-primary',
          },
          {
            label: 'Active',
            value: allRecords.filter((r) => r.isActive).length,
            icon: <CheckCircle className="h-4.5 w-4.5" />,
            color: 'bg-secondary-50 text-secondary',
          },
          {
            label: 'Degree Programs',
            value: programs.length,
            icon: <Archive className="h-4.5 w-4.5" />,
            color: 'bg-blue-50 text-blue-600',
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
        <DataViewSwitcher<ICurriculum>
          data={filtered}
          isLoading={isLoading}
          storageKey="curriculum.view"
          searchPlaceholder="Search curriculum…"
          searchFields={['program', 'regulationYear']}
          defaultView="table"
          table={
            <div className="rounded-2xl bg-white overflow-hidden">
              <CustomTable<ICurriculum>
                title="Curriculum"
                description="Department-wise curriculum structure"
                onRefresh={() => mutate()}
                isRefreshing={isValidating}
                data={filtered}
                columns={columns}
                actions={
                  canEdit
                    ? ([
                        {
                          tooltip: 'Plan Subjects',
                          icon: <BookOpen className="h-4 w-4 text-violet-600" />,
                          onClick: (r: ICurriculum) => setPlanning(r),
                        },
                        {
                          tooltip: 'Edit',
                          icon: <Edit2 className="h-4 w-4 text-primary" />,
                          onClick: (r: ICurriculum) => {
                            setEditing(r);
                            setShowCreate(true);
                          },
                        },
                      ] as Action<ICurriculum>[])
                    : []
                }
                isLoading={isLoading}
                page={page}
                pageSize={pageSize}
                totalCount={(raw as { total?: number })?.total ?? filtered.length}
                onPageChange={setPage}
                onRowsPerPageChange={setPageSize}
                customActions={
                  <div className="flex items-center gap-3">
                    <div className="min-w-64">
                      <AsyncSelect
                        type="programs"
                        placeholder="All Degree Programs"
                        value={filterProgram || null}
                        onChange={(v) => {
                          setFilterProgram(v ?? '');
                          setPage(0);
                        }}
                      />
                    </div>
                    {canEdit && (
                      <CustomButton
                        variant="primary"
                        startIcon={<Plus className="h-4 w-4" />}
                        onClick={() => {
                          setEditing(null);
                          setShowCreate(true);
                        }}
                      >
                        New Curriculum
                      </CustomButton>
                    )}
                    {canImport && (
                      <CustomButton
                        variant="secondary"
                        startIcon={<UploadCloud className="h-4 w-4" />}
                        onClick={() => setShowImport(true)}
                      >
                        Import programs
                      </CustomButton>
                    )}
                  </div>
                }
                options={{
                  search: false,
                  pagination: true,
                  pageSize: pageSize,
                  actionsType: 'dropdown',
                  export: false,
                }}
              />
            </div>
          }
          renderCard={(c) => (
            <motion.div
              whileHover={{ y: -2 }}
              className="flex flex-col gap-3 rounded-2xl bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
                  <BookOpen className="h-5 w-5" />
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c.isActive ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}
                >
                  {c.isActive ? 'Active' : 'Archived'}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{c.program}</p>
                <p className="text-xs text-slate-500">
                  Regulation {c.regulationYear} · {c.totalSemesters} semesters
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                  <p className="text-[10px] uppercase text-slate-600">Subjects</p>
                  <p className="font-bold text-slate-800">{subjectCount(c)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                  <p className="text-[10px] uppercase text-slate-600">Required Credits</p>
                  <p className="font-bold text-slate-800">{c.totalCreditsRequired}</p>
                </div>
              </div>
              {canEdit && (
                <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setPlanning(c)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-primary"
                  >
                    <BookOpen className="h-3 w-3" /> Plan
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(c);
                      setShowCreate(true);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Edit2 className="h-3 w-3" /> Edit
                  </button>
                </div>
              )}
            </motion.div>
          )}
        />
      </motion.div>
      <AnimatePresence>
        {showCreate && (
          <CurriculumModal
            editing={editing}
            onClose={() => setShowCreate(false)}
            onSaved={() => {
              mutate();
              setShowCreate(false);
            }}
          />
        )}
        <ImportMigrationDialog
          open={showImport}
          target="curricula"
          title="Programs / Curricula"
          onClose={() => setShowImport(false)}
          onImported={() => void mutate()}
        />
        {planning && (
          <CurriculumPlanModal
            curriculum={planning}
            onClose={() => setPlanning(null)}
            onSaved={(updated) => {
              mutate();
              if (updated) setPlanning(updated);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

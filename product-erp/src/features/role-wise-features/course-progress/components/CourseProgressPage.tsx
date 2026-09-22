/**
 * @file CourseProgressPage.tsx
 * @description Course progress tracking — Faculty/HOD can create, update, add topic entries.
 *   Drill-down into a record shows all topic entries with progress bar.
 * @module features/role-wise-features/course-progress
 */
'use client';

import React, { useState, useMemo } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import { TrendingUp, CheckCircle, BookOpen, Plus, ClipboardList, Info } from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import AsyncSelect from '@/shared/core/AsyncSelect';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { useAuthStore } from '@/shared/store/authStore';
import AcademicWorkflowBar from '@/shared/components/AcademicWorkflowBar';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ITopicEntry {
  _id?: string;
  date: string;
  unitNo: number;
  topicCovered: string;
  noOfClasses: number;
  teachingMethod?: string;
  remarks?: string;
}

interface ICourseProgress {
  _id: string;
  academicYear: string;
  semesterType: 'odd' | 'even';
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  facultyId: string | { _id: string; name?: string; email?: string } | null;
  facultyName?: string;
  departmentId?: string;
  program: string;
  semester: number;
  section: string;
  totalPlanedClasses: number;
  totalConductedClasses: number;
  completionPercentage: number;
  topicEntries: ITopicEntry[];
  isComplete: boolean;
  lessonPlanId?:
    | string
    | {
        status: string;
        totalPlannedClasses: number;
        unitPlans: Array<{
          unitNo: number;
          unitTitle: string;
          plannedTopics: string[];
          plannedClasses: number;
        }>;
      };
  createdAt: string;
  [key: string]: unknown;
}

function facultyDisplayName(record: ICourseProgress, fallback = '—') {
  if (record.facultyName?.trim()) return record.facultyName;
  if (record.facultyId && typeof record.facultyId === 'object') {
    return record.facultyId.name?.trim() || fallback;
  }
  return fallback;
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

// ─── Create/Edit Progress Modal ────────────────────────────────────────────────
function ProgressModal({
  record,
  onClose,
  onSaved,
}: {
  record?: ICourseProgress | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const formik = useFormik({
    initialValues: {
      academicYear: record?.academicYear ?? '',
      semesterType: record?.semesterType ?? 'odd',
      subjectId: record?.subjectId ?? '',
      subjectCode: record?.subjectCode ?? '',
      subjectName: record?.subjectName ?? '',
      program: record?.program ?? '',
      semester: record?.semester ?? 1,
      section: record?.section ?? 'A',
      totalPlanedClasses: record?.totalPlanedClasses ?? 0,
    },
    validationSchema: Yup.object({
      academicYear: Yup.string().trim().required('Academic year required'),
      subjectId: Yup.string().trim().required('Select a subject'),
      subjectCode: Yup.string().trim().required('Subject code required'),
      subjectName: Yup.string().trim().required('Subject name required'),
      program: Yup.string().trim().required('Program required'),
      semester: Yup.number().min(1).max(8).required(),
      section: Yup.string().trim().required('Section required'),
      totalPlanedClasses: Yup.number().min(0).required(),
    }),
    onSubmit: async (values) => {
      const isEdit = !!record?._id;
      const res = await mutation(isEdit ? `course-progress/${record!._id}` : 'course-progress', {
        method: isEdit ? 'PUT' : 'POST',
        body: values,
        isAlert: true,
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Saved');
        onSaved();
      } else toast.error('Failed to save');
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
        className="relative z-10 w-full max-w-lg rounded-2xl bg-white  max-h-[92dvh] overflow-y-auto"
      >
        <div className="sticky top-0 flex items-center gap-3 border-b border-slate-100 bg-white px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary">
            <BookOpen className="h-4.5 w-4.5" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">
            {record?._id ? 'Edit Progress Record' : 'New Progress Record'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-slate-600 hover:text-slate-600 text-xl"
          >
            ✕
          </button>
        </div>
        <form onSubmit={formik.handleSubmit} className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Academic Year *</label>
              <AsyncSelect
                type="academicYears"
                value={formik.values.academicYear || null}
                onChange={(value) => formik.setFieldValue('academicYear', value ?? '')}
                placeholder="Select configured academic year"
              />
              {formik.touched.academicYear && formik.errors.academicYear && (
                <p className="mt-1 text-xs text-red-500">{formik.errors.academicYear}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Semester Type *</label>
              <select
                name="semesterType"
                value={formik.values.semesterType}
                onChange={formik.handleChange}
                className={inputCls}
              >
                <option value="odd">Odd</option>
                <option value="even">Even</option>
              </select>
            </div>
          </div>
          <AsyncSelect
            label="Subject"
            type="subjects"
            value={formik.values.subjectId || null}
            onChange={(subjectId, option) => {
              formik.setFieldValue('subjectId', subjectId ?? '');
              formik.setFieldValue('subjectName', option?.label ?? '');
              formik.setFieldValue('subjectCode', option?.sub?.split(' · ')[0] ?? '');
            }}
            error={
              formik.touched.subjectId && formik.errors.subjectId
                ? String(formik.errors.subjectId)
                : undefined
            }
            required
            placeholder="Search subject name or code…"
          />
          <div className="grid grid-cols-3 gap-4">
            <AsyncSelect
              label="Program"
              type="programs"
              value={formik.values.program || null}
              onChange={(program) => formik.setFieldValue('program', program ?? '')}
              required
              placeholder="Select programme…"
            />
            <div>
              <label className={labelCls}>Semester *</label>
              <input
                type="number"
                name="semester"
                min={1}
                max={8}
                value={formik.values.semester}
                onChange={formik.handleChange}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Section *</label>
              <input
                name="section"
                value={formik.values.section}
                onChange={formik.handleChange}
                placeholder="A"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Total Planned Classes *</label>
            <input
              type="number"
              name="totalPlanedClasses"
              min={0}
              value={formik.values.totalPlanedClasses}
              onChange={formik.handleChange}
              className={inputCls}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton variant="primary" type="submit" loading={isLoading}>
              Save
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// Course-progress records are system-generated from approved lesson plans.
// This legacy editor remains isolated until its historical form is removed in a dedicated cleanup.
void ProgressModal;

// ─── Add Topic Modal ───────────────────────────────────────────────────────────
function AddTopicModal({
  progressId,
  onClose,
  onSaved,
}: {
  progressId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const { data: detailRaw, isLoading: loadingPlan } = useSwr(`course-progress/${progressId}`);
  const detail = (detailRaw as { data?: ICourseProgress } | undefined)?.data;
  const lessonPlan =
    detail?.lessonPlanId && typeof detail.lessonPlanId === 'object'
      ? detail.lessonPlanId
      : undefined;
  const unitPlans = lessonPlan?.unitPlans ?? [];
  const formik = useFormik({
    initialValues: {
      date: new Date().toISOString().slice(0, 10),
      unitNo: 1,
      plannedTopic: '',
      topicCovered: '',
      teachingMethod: '',
      remarks: '',
    },
    validationSchema: Yup.object({
      date: Yup.string().required(),
      unitNo: Yup.number().min(1).required(),
      plannedTopic: Yup.string().trim().required('Select a planned topic'),
      topicCovered: Yup.string().trim().required('Coverage notes are required'),
    }),
    onSubmit: async (values) => {
      const res = await mutation(`course-progress/${progressId}/topics`, {
        method: 'POST',
        body: values,
        isAlert: true,
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Topic entry added');
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
          <h2 className="text-base font-semibold text-slate-900">Add Topic Entry</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-600 hover:text-slate-600 text-xl"
          >
            ✕
          </button>
        </div>
        <form onSubmit={formik.handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Date *</label>
              <input
                type="date"
                name="date"
                value={formik.values.date}
                onChange={formik.handleChange}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Unit *</label>
              <select
                name="unitNo"
                value={formik.values.unitNo}
                onChange={(event) => {
                  formik.setFieldValue('unitNo', Number(event.target.value));
                  formik.setFieldValue('plannedTopic', '');
                }}
                className={inputCls}
                disabled={loadingPlan}
              >
                {unitPlans.map((unit) => (
                  <option key={unit.unitNo} value={unit.unitNo}>
                    Unit {unit.unitNo}: {unit.unitTitle}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Planned Topic *</label>
            <select
              name="plannedTopic"
              value={formik.values.plannedTopic}
              onChange={(event) => {
                formik.handleChange(event);
                formik.setFieldValue('topicCovered', event.target.value);
              }}
              className={inputCls}
              disabled={loadingPlan || unitPlans.length === 0}
            >
              <option value="">Select from approved lesson plan</option>
              {(
                unitPlans.find((unit) => unit.unitNo === formik.values.unitNo)?.plannedTopics ?? []
              ).map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
            {formik.touched.plannedTopic && formik.errors.plannedTopic && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.plannedTopic}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Coverage Notes *</label>
            <textarea
              name="topicCovered"
              value={formik.values.topicCovered}
              onChange={formik.handleChange}
              rows={3}
              placeholder="Describe what was completed during the class…"
              className={inputCls}
            />
            {formik.touched.topicCovered && formik.errors.topicCovered && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.topicCovered}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Teaching Method</label>
              <input
                name="teachingMethod"
                value={formik.values.teachingMethod}
                onChange={formik.handleChange}
                placeholder="Lecture / PPT…"
                className={inputCls}
              />
            </div>
          </div>
          <p className="rounded-lg bg-primary-50 px-3 py-2 text-xs leading-5 text-primary">
            Matching attendance for this subject, section, faculty and date is attached
            automatically as teaching evidence.
          </p>
          <div>
            <label className={labelCls}>Remarks</label>
            <input
              name="remarks"
              value={formik.values.remarks}
              onChange={formik.handleChange}
              placeholder="Optional remarks…"
              className={inputCls}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton
              variant="primary"
              type="submit"
              loading={isLoading}
              disabled={loadingPlan || unitPlans.length === 0}
            >
              Add Topic
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Detail Drawer ─────────────────────────────────────────────────────────────
function ProgressDetailDrawer({
  record,
  onClose,
  canEdit,
  onAddTopic,
}: {
  record: ICourseProgress;
  onClose: () => void;
  canEdit: boolean;
  onAddTopic: () => void;
}) {
  // Group topics by unit
  const byUnit: Record<number, ITopicEntry[]> = {};
  record.topicEntries?.forEach((t) => {
    if (!byUnit[t.unitNo]) byUnit[t.unitNo] = [];
    byUnit[t.unitNo].push(t);
  });

  const pct = Math.min(record.completionPercentage, 100);
  const color = pct >= 75 ? 'bg-green-400' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400';

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
        className="relative z-10 h-full w-full max-w-md overflow-y-auto bg-white "
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">{record.subjectName}</h2>
            <p className="text-xs text-slate-600">
              {record.subjectCode} · Sem {record.semester} · {record.section}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <CustomButton
                variant="primary"
                onClick={onAddTopic}
                className="py-1.5! text-xs! w-fit!"
              >
                <Plus className="h-3 w-3 mr-1" />
                Topic
              </CustomButton>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-600 hover:text-slate-600 text-xl"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="p-5 space-y-5">
          {/* Progress ring */}
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-500">Completion</p>
              <p className="text-sm font-bold text-slate-800">{pct}%</p>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-200">
              <div
                className={`h-2.5 rounded-full transition-all ${color}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-600">
              <span>{record.totalConductedClasses} conducted</span>
              <span>{record.totalPlanedClasses} planned</span>
            </div>
          </div>

          {/* Topic entries by unit */}
          {Object.keys(byUnit).length > 0 ? (
            Object.entries(byUnit)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([unit, topics]) => (
                <div key={unit}>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Unit {unit}
                  </h3>
                  <div className="space-y-2">
                    {topics.map((t, i) => (
                      <div key={t._id ?? i} className="rounded-xl bg-slate-50 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-800">{t.topicCovered}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <span>
                              {t.noOfClasses} class{t.noOfClasses > 1 ? 'es' : ''}
                            </span>
                          </div>
                        </div>
                        {t.teachingMethod && (
                          <p className="text-xs text-slate-600 mt-0.5">
                            Method: {t.teachingMethod}
                          </p>
                        )}
                        {t.remarks && <p className="text-xs text-slate-600 mt-0.5">{t.remarks}</p>}
                        <p className="text-[10px] text-slate-300 mt-1">
                          {new Date(t.date).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
          ) : (
            <p className="text-center text-sm text-slate-600 py-6">No topic entries yet</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function CourseProgressPage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const canView = useHasPermission('course_progress', 'view');
  const hasEditPermission = useHasPermission('course_progress', 'edit');
  const canRecordTeaching = hasEditPermission && activeRole === 'faculty';

  const [detailRecord, setDetailRecord] = useState<ICourseProgress | null>(null);
  const [addTopicFor, setAddTopicFor] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const apiUrl = useMemo(() => {
    const q = new URLSearchParams();
    q.set('page', String(page + 1));
    q.set('limit', '15');
    return `course-progress?${q.toString()}`;
  }, [page]);

  const { data: raw, error, isLoading, isValidating, mutate } = useSwr(canView ? apiUrl : null);
  const records: ICourseProgress[] =
    (raw as { data?: { data?: ICourseProgress[] } })?.data?.data ??
    (raw as { data?: ICourseProgress[] })?.data ??
    [];
  const totalCount = (raw as { data?: { total?: number } })?.data?.total ?? records.length;

  const avgCompletion =
    records.length > 0
      ? Math.round(records.reduce((s, r) => s + r.completionPercentage, 0) / records.length)
      : 0;
  const fullyCompleted = records.filter((r) => r.completionPercentage >= 100).length;

  const columns: Column<ICourseProgress>[] = [
    {
      field: 'subjectName',
      title: 'Subject',
      render: (r) => (
        <div>
          <p className="text-sm font-semibold text-slate-800">{r.subjectName}</p>
          <p className="text-xs text-slate-600">{r.subjectCode}</p>
        </div>
      ),
    },
    {
      field: 'facultyName',
      title: 'Faculty',
      cellClassName: '!text-center',
      render: (r) => (
        <div className="flex justify-center">
          <span className="text-sm text-slate-600">{facultyDisplayName(r)}</span>
        </div>
      ),
    },
    {
      field: 'semester',
      title: 'Sem/Sec',
      cellClassName: '!text-center',
      render: (r) => (
        <div className="flex justify-center">
          <span className="text-xs text-slate-500">
            Sem {r.semester} · {r.section}
          </span>
        </div>
      ),
    },
    {
      field: 'completionPercentage',
      title: 'Progress',
      cellClassName: '!text-center',
      render: (r) => {
        const pct = Math.min(Math.round(r.completionPercentage), 100);
        const color = pct >= 75 ? 'bg-green-400' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400';
        return (
          <div className="flex justify-center">
            <div className="flex items-center gap-2 min-w-32">
              <div className="flex-1 h-2 rounded-full bg-slate-100">
                <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-bold text-slate-700 w-8">{pct}%</span>
            </div>
          </div>
        );
      },
    },
    {
      field: 'totalConductedClasses',
      title: 'Conducted',
      cellClassName: '!text-center',
      render: (r) => (
        <div className="flex justify-center">
          <span className="text-sm">
            {r.totalConductedClasses}/{r.totalPlanedClasses}
          </span>
        </div>
      ),
    },
    {
      field: 'isComplete',
      title: 'Status',
      cellClassName: '!text-center',
      render: (r) => (
        <div className="flex justify-center">
          {r.isComplete ? (
            <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs text-green-600 font-medium">
              Complete
            </span>
          ) : (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-600 font-medium">
              In Progress
            </span>
          )}
        </div>
      ),
    },
  ];

  const actions: Action<ICourseProgress>[] = [
    {
      tooltip: 'View Topics',
      icon: <ClipboardList className="h-4 w-4 text-primary" />,
      onClick: (r) => setDetailRecord(r),
    },
    ...(canRecordTeaching
      ? ([
          {
            tooltip: 'Add Topic',
            icon: <Plus className="h-4 w-4 text-green-500" />,
            onClick: (r: ICourseProgress) => setAddTopicFor(r._id),
          },
        ] as Action<ICourseProgress>[])
      : []),
  ];

  if (!canView) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Course progress access unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your active role cannot view delivery records.
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">
          Course progress could not be loaded
        </h1>
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

      <div className="flex gap-3 rounded-xl bg-primary-50 p-4 text-sm text-primary">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">Progress starts from an approved lesson plan</p>
          <p className="mt-0.5 text-xs leading-5 text-primary/80">
            Records are created automatically after approval. Faculty record planned topics here,
            and matching attendance is attached as verified teaching evidence.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          {
            label: 'Total Subjects',
            value: records.length,
            icon: <BookOpen className="h-4.5 w-4.5" />,
            color: 'bg-primary-50 text-primary',
          },
          {
            label: 'Avg Completion',
            value: `${avgCompletion}%`,
            icon: <TrendingUp className="h-4.5 w-4.5" />,
            color: 'bg-secondary-50 text-secondary',
          },
          {
            label: 'Fully Completed',
            value: fullyCompleted,
            icon: <CheckCircle className="h-4.5 w-4.5" />,
            color: 'bg-green-50 text-green-600',
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
              <p className="text-xl font-bold text-slate-900">{isLoading ? '—' : s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <DataViewSwitcher<ICourseProgress>
        data={records}
        isLoading={isLoading}
        storageKey="course-progress.view"
        searchPlaceholder="Search subjects…"
        searchFields={['subjectCode', 'subjectName', 'facultyName', 'program', 'section']}
        pageSize={20}
        renderCard={(r) => {
          const pct = r.completionPercentage ?? 0;
          const barColor = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
          return (
            <motion.div
              whileHover={{ y: -2 }}
              className="flex flex-col gap-3 rounded-2xl bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
                  <BookOpen className="h-5 w-5" />
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${r.isComplete ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}
                >
                  {r.isComplete ? 'Complete' : 'In Progress'}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 line-clamp-1">{r.subjectName}</p>
                <p className="text-[11px] font-mono text-slate-600">{r.subjectCode}</p>
                <p className="text-xs text-slate-500">
                  {facultyDisplayName(r, 'Unassigned faculty')}
                </p>
                <p className="text-[11px] text-slate-600">
                  {r.program} Sem {r.semester} · {r.section} · AY {r.academicYear}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Progress</span>
                  <span className="font-medium text-slate-700">
                    {r.totalConductedClasses}/{r.totalPlanedClasses}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full ${barColor}`}
                    style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                  />
                </div>
                <p className="text-right text-[10px] font-bold text-slate-700">{pct}%</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3 text-xs">
                <button
                  type="button"
                  onClick={() => setDetailRecord(r)}
                  className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-primary"
                >
                  <ClipboardList className="h-3 w-3" /> Topics
                </button>
                {canRecordTeaching && (
                  <button
                    type="button"
                    onClick={() => setAddTopicFor(r._id)}
                    className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
                  >
                    <Plus className="h-3 w-3" /> Record Teaching
                  </button>
                )}
              </div>
            </motion.div>
          );
        }}
        table={
          <div className="overflow-hidden rounded-2xl bg-white">
            <CustomTable<ICourseProgress>
              title="Course Progress"
              description="Subject-wise syllabus completion tracking"
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

      <AnimatePresence>
        {addTopicFor && (
          <AddTopicModal
            progressId={addTopicFor}
            onClose={() => setAddTopicFor(null)}
            onSaved={() => {
              mutate();
              setAddTopicFor(null);
            }}
          />
        )}
        {detailRecord && (
          <ProgressDetailDrawer
            record={detailRecord}
            onClose={() => setDetailRecord(null)}
            canEdit={canRecordTeaching}
            onAddTopic={() => {
              setAddTopicFor(detailRecord._id);
              setDetailRecord(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

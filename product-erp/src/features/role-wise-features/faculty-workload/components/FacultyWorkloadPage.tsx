/**
 * @file FacultyWorkloadPage.tsx
 * @description Faculty workload management — Dean/HOD/Admin assignment, approval & AICTE compliance.
 * @module features/role-wise-features/faculty-workload
 */
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import {
  Activity,
  AlertTriangle,
  BarChart2,
  BookOpen,
  Briefcase,
  Building2,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit2,
  Info,
  Plus,
  Scale,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import Empty from '@/shared/core/Empty';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import AsyncSelect from '@/shared/core/AsyncSelect';
import FacultyHrWorkflowBar from '@/shared/components/FacultyHrWorkflowBar';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { useAuthStore } from '@/shared/store/authStore';

// ─── Types ────────────────────────────────────────────────────────────────────
interface IAssignment {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  program: string;
  semester: number;
  section?: string;
  classType: 'theory' | 'lab' | 'tutorial';
  weeklyHours: number;
  totalHours: number;
  batch?: string;
}

interface IExtraDuty {
  type: 'iqac' | 'exam_duty' | 'mentor' | 'committee' | 'placement' | 'other';
  description: string;
  weeklyHours: number;
}

interface IWorkload {
  _id: string;
  facultyId: string | { _id: string; firstName?: string; lastName?: string; name?: string; employeeId?: string };
  facultyName?: string;
  departmentId: string | { _id: string; name?: string; code?: string };
  departmentName?: string;
  academicYear: string;
  semesterType: 'odd' | 'even';
  teachingAssignments: IAssignment[];
  extraDuties: IExtraDuty[];
  totalWeeklyTeachingHours: number;
  totalWeeklyHours: number;
  isApproved: boolean;
  createdAt: string;
  [key: string]: unknown;
}

interface IDeptSummary {
  departmentId: string;
  departmentName: string;
  totalFaculty: number;
  avgWeeklyHours: number;
  overloadedCount: number;
  [key: string]: unknown;
}

interface IOperationalSummary {
  plannedWeeklyTeachingHours: number;
  plannedWeeklyTotalHours: number;
  substituteTakenMinutes: number;
  substituteReleasedMinutes: number;
  extraClassMinutes: number;
  netOperationalMinutes: number;
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 transition hover:border-slate-300';
const labelCls = 'mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wider';
const idOf = (value: string | { _id: string }) => (typeof value === 'string' ? value : value._id);

function formatDutyLabel(type: string) {
  return type.replace(/_/g, ' ').toUpperCase();
}

// ─── Workload Modal (Widescreen max-w-5xl with Real-time AICTE Calculator) ────
function WorkloadModal({
  workload,
  onClose,
  onSaved,
}: {
  workload?: IWorkload | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const [assignments, setAssignments] = useState<IAssignment[]>(
    workload?.teachingAssignments ?? [],
  );
  const [extraDuties, setExtraDuties] = useState<IExtraDuty[]>(workload?.extraDuties ?? []);

  // Computed Live Workload Totals
  const totalWeeklyTeachingHours = useMemo(() => {
    return assignments.reduce((sum, a) => sum + (Number(a.weeklyHours) || 0), 0);
  }, [assignments]);

  const totalWeeklyExtraHours = useMemo(() => {
    return extraDuties.reduce((sum, d) => sum + (Number(d.weeklyHours) || 0), 0);
  }, [extraDuties]);

  const totalWeeklyHours = totalWeeklyTeachingHours + totalWeeklyExtraHours;

  const theoryHours = useMemo(() => {
    return assignments.filter((a) => a.classType === 'theory').reduce((sum, a) => sum + (Number(a.weeklyHours) || 0), 0);
  }, [assignments]);

  const labHours = useMemo(() => {
    return assignments.filter((a) => a.classType === 'lab').reduce((sum, a) => sum + (Number(a.weeklyHours) || 0), 0);
  }, [assignments]);

  const tutorialHours = useMemo(() => {
    return assignments.filter((a) => a.classType === 'tutorial').reduce((sum, a) => sum + (Number(a.weeklyHours) || 0), 0);
  }, [assignments]);

  // AICTE Compliance status
  const complianceStatus = useMemo(() => {
    if (totalWeeklyHours > 20) return { label: 'Overloaded (>20h)', color: 'text-rose-700 bg-rose-50 border-rose-200', alert: 'Exceeds standard 20h threshold' };
    if (totalWeeklyHours < 10) return { label: 'Underloaded (<10h)', color: 'text-amber-700 bg-amber-50 border-amber-200', alert: 'Below 10h baseline target' };
    return { label: 'Normal (10–20h)', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', alert: 'Within standard AICTE benchmark' };
  }, [totalWeeklyHours]);

  const formik = useFormik({
    initialValues: {
      facultyId: workload ? idOf(workload.facultyId) : '',
      departmentId: workload ? idOf(workload.departmentId) : '',
      academicYear: workload?.academicYear ?? '',
      semesterType: workload?.semesterType ?? 'odd',
    },
    validationSchema: Yup.object({
      facultyId: Yup.string().trim().required('Select a faculty member'),
      departmentId: Yup.string().trim().required('Select a department'),
      academicYear: Yup.string().trim().required('Academic year required'),
      semesterType: Yup.string().oneOf(['odd', 'even']).required('Semester term required'),
    }),
    onSubmit: async (values) => {
      if (assignments.length === 0 && extraDuties.length === 0) {
        toast.warning('Please add at least one teaching assignment or extra duty');
        return;
      }
      // Check for unselected subjects
      const emptySubjectIdx = assignments.findIndex((a) => !a.subjectId);
      if (emptySubjectIdx !== -1) {
        toast.error(`Course #${emptySubjectIdx + 1} has no subject selected. Please choose a subject.`);
        return;
      }
      // Check for duplicate course assignments
      const keys = assignments.map(
        (a) => `${a.subjectId}:${a.program || 'B.Tech'}:${a.semester}:${a.section || 'All'}:${a.classType}`,
      );
      if (new Set(keys).size !== keys.length) {
        toast.error('Duplicate course assignments detected for the same subject and section.');
        return;
      }
      // Check total weekly hours limit
      if (totalWeeklyHours > 60) {
        toast.error('Total weekly workload cannot exceed 60 hours per statutory norms.');
        return;
      }
      const body = {
        ...values,
        teachingAssignments: assignments.map((a) => ({
          ...a,
          program: a.program || 'B.Tech',
          section: a.section || 'All',
          totalHours: (Number(a.weeklyHours) || 0) * 15,
        })),
        extraDuties,
      };
      const isEdit = !!workload?._id;
      const res = await mutation(
        isEdit ? `faculty-workload/${workload!._id}` : 'faculty-workload',
        { method: isEdit ? 'PUT' : 'POST', body, isAlert: true },
      );
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success(isEdit ? 'Workload updated successfully' : 'Workload assigned successfully');
        onSaved();
      } else {
        toast.error('Failed to save workload');
      }
    },
  });

  const addAssignment = (preset?: 'theory_3' | 'lab_2' | 'tutorial_1') => {
    let weekly = 3;
    let type: 'theory' | 'lab' | 'tutorial' = 'theory';
    if (preset === 'lab_2') {
      weekly = 2;
      type = 'lab';
    } else if (preset === 'tutorial_1') {
      weekly = 1;
      type = 'tutorial';
    }
    setAssignments((a) => [
      {
        subjectId: '',
        subjectCode: '',
        subjectName: '',
        program: '',
        semester: 1,
        section: 'A',
        classType: type,
        weeklyHours: weekly,
        totalHours: weekly * 15, // standard 15-week semester
      },
      ...a,
    ]);
  };

  const removeAssignment = (i: number) => setAssignments((a) => a.filter((_, j) => j !== i));
  const updateAssignment = (i: number, field: keyof IAssignment, val: unknown) =>
    setAssignments((a) =>
      a.map((x, j) => {
        if (j !== i) return x;
        const updated = { ...x, [field]: val };
        if (field === 'weeklyHours') {
          updated.totalHours = (Number(val) || 0) * 15;
        }
        return updated;
      }),
    );

  const addExtraDuty = (type: IExtraDuty['type'] = 'mentor') =>
    setExtraDuties((d) => [{ type, description: '', weeklyHours: 2 }, ...d]);
  const removeExtraDuty = (i: number) => setExtraDuties((d) => d.filter((_, j) => j !== i));
  const updateExtraDuty = (i: number, field: keyof IExtraDuty, val: unknown) =>
    setExtraDuties((d) => d.map((x, j) => (j === i ? { ...x, [field]: val } : x)));

  const isCoordinatesReady = Boolean(
    formik.values.academicYear && formik.values.departmentId && formik.values.facultyId,
  );

  const isClient = React.useSyncExternalStore(
    () => () => { },
    () => true,
    () => false,
  );

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  if (!isClient || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-3 sm:p-6">
      {/* Full viewport backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 h-full w-full bg-slate-950/60 backdrop-blur-xs"
        onClick={onClose}
      />
      {/* Centered Dialog Content */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', damping: 26, stiffness: 280 }}
        className="relative z-10 flex max-h-[95vh] h-full w-[96vw] max-w-6xl flex-col rounded-2xl bg-white border border-slate-200 overflow-hidden"
      >
        {/* Light Minimal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-7 py-4.5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-primary border border-blue-100">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {workload?._id ? 'Edit Faculty Workload Assignment' : 'Assign Faculty Academic Workload'}
              </h2>
              <p className="text-xs text-slate-500">
                AICTE / UGC Norm Teaching Load & Institutional Duties Allocation
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-all hover:bg-slate-50 hover:text-slate-700 active:scale-95 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={formik.handleSubmit} className="flex-1 overflow-y-auto p-6 sm:p-7 space-y-6 bg-slate-50/50">
          {/* Section 1: Academic & Faculty Coordinates (Clean Integrated Card) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <Building2 className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Academic & Faculty Coordinates
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className={labelCls}>
                  Academic Year <span className="text-red-500">*</span>
                </label>
                <AsyncSelect
                  type="academicYears"
                  value={formik.values.academicYear || null}
                  onChange={(value) => formik.setFieldValue('academicYear', value ?? '')}
                  placeholder="Select academic year"
                />
                {formik.touched.academicYear && formik.errors.academicYear && (
                  <p className="mt-1 text-xs text-red-500">{formik.errors.academicYear}</p>
                )}
              </div>
              <div>
                <label className={labelCls}>
                  Semester Term <span className="text-red-500">*</span>
                </label>
                <select
                  name="semesterType"
                  value={formik.values.semesterType}
                  onChange={formik.handleChange}
                  className={inputCls}
                >
                  <option value="odd">Odd Semester (July – Dec)</option>
                  <option value="even">Even Semester (Jan – June)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>
                  Department <span className="text-red-500">*</span>
                </label>
                <AsyncSelect
                  type="departments"
                  value={formik.values.departmentId || null}
                  onChange={(value) => {
                    formik.setFieldValue('departmentId', value ?? '');
                    formik.setFieldValue('facultyId', '');
                  }}
                  error={formik.touched.departmentId ? formik.errors.departmentId : undefined}
                  placeholder="Select department"
                />
              </div>
              <div>
                <label className={labelCls}>
                  Faculty Member <span className="text-red-500">*</span>
                </label>
                <AsyncSelect
                  type="faculty"
                  value={formik.values.facultyId}
                  params={{ departmentId: formik.values.departmentId }}
                  disabled={!formik.values.departmentId}
                  onChange={(value) => formik.setFieldValue('facultyId', value ?? '')}
                  placeholder="Select faculty member"
                  error={formik.touched.facultyId ? formik.errors.facultyId : undefined}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Live AICTE Workload Telemetry Bar (Sleek Horizontal Metric Strip) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Live Workload & AICTE Telemetry
                </h3>
              </div>
              <span className={`rounded-md border px-2.5 py-0.5 text-xs font-bold ${complianceStatus.color}`}>
                {complianceStatus.label}
              </span>
            </div>

            {/* Center Metric & Stacked Progress Bar */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-center pt-1">
              {/* Left KPI */}
              <div className="lg:col-span-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">{totalWeeklyHours}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">hrs / week</span>
                <span className="text-xs text-slate-400 font-normal">({complianceStatus.alert})</span>
              </div>

              {/* Middle: 4-Color Segmented Multi-Bar */}
              <div className="lg:col-span-9 space-y-2">
                <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex border border-slate-200">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${Math.min(100, (theoryHours / 24) * 100)}%` }}
                    title={`Theory: ${theoryHours}h`}
                  />
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, (labHours / 24) * 100)}%` }}
                    title={`Lab: ${labHours}h`}
                  />
                  <div
                    className="h-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, (tutorialHours / 24) * 100)}%` }}
                    title={`Tutorial: ${tutorialHours}h`}
                  />
                  <div
                    className="h-full bg-purple-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, (totalWeeklyExtraHours / 24) * 100)}%` }}
                    title={`Extra Duties: ${totalWeeklyExtraHours}h`}
                  />
                </div>

                {/* 4 Clean Legend Pills */}
                <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 font-medium pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                    <span>Theory: <strong className="text-slate-900">{theoryHours}h</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span>Practical Lab: <strong className="text-slate-900">{labHours}h</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    <span>Tutorial: <strong className="text-slate-900">{tutorialHours}h</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
                    <span>Extra Duty: <strong className="text-slate-900">{totalWeeklyExtraHours}h</strong></span>
                  </div>
                  <span className="text-slate-400 text-xs hidden sm:inline">
                    AICTE Norm: 16h (Asst) · 14h (Assoc) · 12h (Prof)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Teaching Assignments Builder */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Teaching Course Allocations ({assignments.length} Allocated)
                </h3>
                <p className="text-xs text-slate-500">
                  Assign Theory courses, Practical labs, or Tutorials with weekly and semester hours
                </p>
              </div>

              {/* Preset Action Chips with standard rounded-lg */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!isCoordinatesReady}
                  onClick={() => addAssignment('theory_3')}
                  className={`inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/80 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-all ${isCoordinatesReady
                      ? 'hover:bg-blue-100 hover:border-blue-300 active:scale-95 cursor-pointer'
                      : 'opacity-50 cursor-not-allowed'
                    }`}
                  title={!isCoordinatesReady ? 'Please select Academic Coordinates first' : undefined}
                >
                  <Plus className="h-3.5 w-3.5" /> Theory (3h)
                </button>
                <button
                  type="button"
                  disabled={!isCoordinatesReady}
                  onClick={() => addAssignment('lab_2')}
                  className={`inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-all ${isCoordinatesReady
                      ? 'hover:bg-emerald-100 hover:border-emerald-300 active:scale-95 cursor-pointer'
                      : 'opacity-50 cursor-not-allowed'
                    }`}
                  title={!isCoordinatesReady ? 'Please select Academic Coordinates first' : undefined}
                >
                  <Plus className="h-3.5 w-3.5" /> Lab (2h)
                </button>
                <button
                  type="button"
                  disabled={!isCoordinatesReady}
                  onClick={() => addAssignment('tutorial_1')}
                  className={`inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-all ${isCoordinatesReady
                      ? 'hover:bg-amber-100 hover:border-amber-300 active:scale-95 cursor-pointer'
                      : 'opacity-50 cursor-not-allowed'
                    }`}
                  title={!isCoordinatesReady ? 'Please select Academic Coordinates first' : undefined}
                >
                  <Plus className="h-3.5 w-3.5" /> Tutorial (1h)
                </button>
                <button
                  type="button"
                  disabled={!isCoordinatesReady}
                  onClick={() => addAssignment()}
                  className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all ${isCoordinatesReady
                      ? 'hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 active:scale-95 cursor-pointer'
                      : 'opacity-50 cursor-not-allowed'
                    }`}
                  title={!isCoordinatesReady ? 'Please select Academic Coordinates first' : undefined}
                >
                  <Plus className="h-3.5 w-3.5 text-primary" /> Custom Course
                </button>
              </div>
            </div>

            <div className="space-y-3.5">
              {assignments.map((a, i) => (
                <div
                  key={i}
                  className="relative rounded-xl border border-slate-200 bg-slate-50/40 p-4.5 transition-all hover:border-slate-300 hover:bg-white space-y-3.5"
                >
                  {/* Top Bar inside Card */}
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5.5 items-center justify-center rounded-md bg-slate-100 px-2 text-2xs font-bold text-slate-700">
                        Course #{assignments.length - i}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-2xs font-bold uppercase tracking-wider ${a.classType === 'theory'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : a.classType === 'lab'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                      >
                        {a.classType}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeAssignment(i)}
                      className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:scale-90 cursor-pointer"
                      title="Remove course"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Row 1: Programme (First) & Subject Course */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                    <div className="sm:col-span-5">
                      <label className={labelCls}>Programme</label>
                      <AsyncSelect
                        type="programs"
                        value={a.program || null}
                        onChange={(value) => updateAssignment(i, 'program', value ?? '')}
                        placeholder="Select program (e.g. B.Tech)"
                      />
                    </div>

                    <div className="sm:col-span-7">
                      <label className={labelCls}>
                        Subject / Course <span className="text-red-500">*</span>
                      </label>
                      <AsyncSelect
                        type="subjects"
                        required
                        value={a.subjectId || null}
                        params={
                          a.program
                            ? { program: a.program, ...(a.semester ? { semesterNo: a.semester } : {}) }
                            : { departmentId: formik.values.departmentId }
                        }
                        disabled={!formik.values.departmentId}
                        onChange={(value, option) => {
                          updateAssignment(i, 'subjectId', value ?? '');
                          updateAssignment(i, 'subjectName', option?.label ?? '');
                          updateAssignment(i, 'subjectCode', option?.sub?.split(' · ')[0] ?? '');
                        }}
                        placeholder="Search subject name or code..."
                      />
                    </div>
                  </div>

                  {/* Row 2: Semester, Section, Class Type, Weekly Hours & Term Hours */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-3">
                      <label className={labelCls}>
                        Semester <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={a.semester || ''}
                        onChange={(e) => updateAssignment(i, 'semester', Number(e.target.value))}
                        className={inputCls}
                      >
                        <option value="">Select Semester</option>
                        <option value="1">Semester 1 (Odd)</option>
                        <option value="2">Semester 2 (Even)</option>
                        <option value="3">Semester 3 (Odd)</option>
                        <option value="4">Semester 4 (Even)</option>
                        <option value="5">Semester 5 (Odd)</option>
                        <option value="6">Semester 6 (Even)</option>
                        <option value="7">Semester 7 (Odd)</option>
                        <option value="8">Semester 8 (Even)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label className={labelCls}>Section (Optional)</label>
                      <select
                        value={a.section || ''}
                        onChange={(e) => updateAssignment(i, 'section', e.target.value)}
                        className={inputCls}
                      >
                        <option value="">No Section / All Students</option>
                        <option value="A">Section A</option>
                        <option value="B">Section B</option>
                        <option value="C">Section C</option>
                        <option value="D">Section D</option>
                        <option value="E">Section E</option>
                        <option value="Combined">Combined / Whole Cohort</option>
                        <option value="NA">Not Applicable (NA)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className={labelCls}>Class Type</label>
                      <select
                        value={a.classType}
                        onChange={(e) => updateAssignment(i, 'classType', e.target.value)}
                        className={inputCls}
                      >
                        <option value="theory">Theory</option>
                        <option value="lab">Practical Lab</option>
                        <option value="tutorial">Tutorial</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className={labelCls}>Weekly Load</label>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={a.weeklyHours}
                          onChange={(e) => updateAssignment(i, 'weeklyHours', Number(e.target.value))}
                          className={inputCls + ' pr-8'}
                        />
                        <span className="absolute right-2.5 top-2.5 text-xs text-slate-500 font-semibold">
                          h/wk
                        </span>
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className={labelCls}>Term Hours</label>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          value={a.totalHours}
                          onChange={(e) => updateAssignment(i, 'totalHours', Number(e.target.value))}
                          className={inputCls + ' pr-6'}
                        />
                        <span className="absolute right-2.5 top-2.5 text-xs text-slate-500 font-semibold">
                          h
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {isCoordinatesReady && assignments.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-dashed border-slate-200">
                  <span className="text-2xs font-semibold text-slate-500">
                    Add another course to this workload:
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => addAssignment('theory_3')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/80 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 active:scale-95 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" /> + Theory (3h)
                    </button>
                    <button
                      type="button"
                      onClick={() => addAssignment('lab_2')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/80 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 active:scale-95 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" /> + Lab (2h)
                    </button>
                    <button
                      type="button"
                      onClick={() => addAssignment('tutorial_1')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/80 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 active:scale-95 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" /> + Tutorial (1h)
                    </button>
                    <button
                      type="button"
                      onClick={() => addAssignment()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 cursor-pointer"
                    >
                      <Plus className="h-3 w-3 text-primary" /> + Custom
                    </button>
                  </div>
                </div>
              )}

              {!isCoordinatesReady ? (
                <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 p-6 text-center">
                  <AlertTriangle className="mx-auto h-7 w-7 text-amber-500" />
                  <p className="mt-2 text-xs font-bold text-slate-800">Academic Coordinates Required</p>
                  <p className="text-xs text-slate-500 mt-0.5 max-w-md mx-auto">
                    Please select Academic Year, Semester Term, Department, and Faculty Member above to unlock course allocations.
                  </p>
                </div>
              ) : !assignments.length ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-7 text-center">
                  <BookOpen className="mx-auto h-7 w-7 text-slate-300" />
                  <p className="mt-2 text-xs font-bold text-slate-700">No teaching subjects assigned yet</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Click one of the buttons above to assign Theory lectures, Practical labs, or Tutorials.
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          {/* Section 4: Institutional Extra Duties & Governance */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" />
                  Institutional Extra Duties & Committees ({extraDuties.length} Duties)
                </h3>
                <p className="text-xs text-slate-500">
                  Allocated administrative hours for IQAC, Exam Duty, Mentorship, and Committee Work
                </p>
              </div>

              {/* Extra Duty Action Chips with standard rounded-lg */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!isCoordinatesReady}
                  onClick={() => addExtraDuty('mentor')}
                  className={`inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50/80 px-3 py-1.5 text-xs font-semibold text-purple-700 transition-all ${isCoordinatesReady
                      ? 'hover:bg-purple-100 hover:border-purple-300 active:scale-95 cursor-pointer'
                      : 'opacity-50 cursor-not-allowed'
                    }`}
                  title={!isCoordinatesReady ? 'Please select Academic Coordinates first' : undefined}
                >
                  <Plus className="h-3.5 w-3.5" /> Mentorship (2h)
                </button>
                <button
                  type="button"
                  disabled={!isCoordinatesReady}
                  onClick={() => addExtraDuty('exam_duty')}
                  className={`inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-all ${isCoordinatesReady
                      ? 'hover:bg-amber-100 hover:border-amber-300 active:scale-95 cursor-pointer'
                      : 'opacity-50 cursor-not-allowed'
                    }`}
                  title={!isCoordinatesReady ? 'Please select Academic Coordinates first' : undefined}
                >
                  <Plus className="h-3.5 w-3.5" /> Exam Duty (2h)
                </button>
                <button
                  type="button"
                  disabled={!isCoordinatesReady}
                  onClick={() => addExtraDuty('iqac')}
                  className={`inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/80 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-all ${isCoordinatesReady
                      ? 'hover:bg-blue-100 hover:border-blue-300 active:scale-95 cursor-pointer'
                      : 'opacity-50 cursor-not-allowed'
                    }`}
                  title={!isCoordinatesReady ? 'Please select Academic Coordinates first' : undefined}
                >
                  <Plus className="h-3.5 w-3.5" /> IQAC (3h)
                </button>
                <button
                  type="button"
                  disabled={!isCoordinatesReady}
                  onClick={() => addExtraDuty('other')}
                  className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all ${isCoordinatesReady
                      ? 'hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 active:scale-95 cursor-pointer'
                      : 'opacity-50 cursor-not-allowed'
                    }`}
                  title={!isCoordinatesReady ? 'Please select Academic Coordinates first' : undefined}
                >
                  <Plus className="h-3.5 w-3.5 text-primary" /> Custom Duty
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {extraDuties.map((d, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 transition-all hover:border-slate-300 hover:bg-white"
                >
                  <button
                    type="button"
                    onClick={() => removeExtraDuty(i)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:scale-90 cursor-pointer"
                    title="Remove duty"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>

                  <div className="w-48 shrink-0">
                    <select
                      value={d.type}
                      onChange={(e) => updateExtraDuty(i, 'type', e.target.value)}
                      className={inputCls}
                    >
                      <option value="iqac">IQAC Coordinator</option>
                      <option value="exam_duty">Exam Invigilator</option>
                      <option value="mentor">Student Mentor</option>
                      <option value="committee">Committee Member</option>
                      <option value="placement">Placement Officer</option>
                      <option value="other">Other Institutional Duty</option>
                    </select>
                  </div>

                  <input
                    value={d.description}
                    onChange={(e) => updateExtraDuty(i, 'description', e.target.value)}
                    placeholder="Specific portfolio responsibility or description..."
                    className={inputCls + ' flex-1 min-w-50'}
                  />

                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={d.weeklyHours}
                      onChange={(e) => updateExtraDuty(i, 'weeklyHours', Number(e.target.value))}
                      className={inputCls + ' w-20 text-center'}
                      placeholder="Hrs"
                    />
                    <span className="text-xs font-semibold text-slate-500">h/wk</span>
                  </div>
                </div>
              ))}

              {!extraDuties.length && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-center">
                  <p className="text-xs text-slate-400">
                    {!isCoordinatesReady
                      ? 'Select Academic Coordinates above to allocate extra duties.'
                      : 'No extra institutional duties assigned. Click one of the duty buttons above to add.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Modal Footer with CustomButton */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-white px-7 py-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <Info className="h-4 w-4 text-primary" />
            <span>
              Total Planned Load: <strong className="text-slate-900">{totalWeeklyHours} hrs/week</strong> ({complianceStatus.alert})
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <CustomButton
              variant="tertiary"
              type="button"
              onClick={onClose}
            >
              Cancel
            </CustomButton>
            <CustomButton
              variant="primary"
              type="button"
              disabled={!isCoordinatesReady}
              loading={isLoading}
              onClick={() => formik.handleSubmit()}
              startIcon={<CheckCircle className="h-4 w-4" />}
            >
              {workload?._id ? 'Update Faculty Workload' : 'Save & Assign Workload'}
            </CustomButton>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

// ─── Widescreen Detail Drawer (max-w-3xl with Rich Operational Classes) ────────
function WorkloadDetailDrawer({ workload, onClose }: { workload: IWorkload; onClose: () => void }) {
  const { data: operationalRaw } = useSwr(`faculty-workload/${workload._id}/operational-summary`);
  const operational = (operationalRaw as { data?: IOperationalSummary } | undefined)?.data;

  const minutesLabel = (minutes: number) => {
    const sign = minutes < 0 ? '−' : '';
    const absolute = Math.abs(minutes);
    return `${sign}${Math.floor(absolute / 60)}h ${absolute % 60}m`;
  };

  const facObj =
    workload.facultyId && typeof workload.facultyId === 'object'
      ? (workload.facultyId as Record<string, unknown>)
      : null;
  const facultyName =
    (facObj ? [facObj.firstName, facObj.lastName].filter(Boolean).join(' ') || (facObj.name as string) : null) ||
    workload.facultyName ||
    'Faculty Member';

  const deptObj =
    workload.departmentId && typeof workload.departmentId === 'object'
      ? (workload.departmentId as Record<string, unknown>)
      : null;
  const deptName = (deptObj?.name as string) || workload.departmentName || 'Academic Department';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        className="relative z-10 flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl overflow-hidden"
      >
        {/* Light Drawer Header */}
        <div className="border-b border-slate-200/90 bg-linear-to-r from-slate-50 via-blue-50/40 to-indigo-50/20 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold text-lg border border-primary/20 shadow-2xs">
                {facultyName.charAt(0)}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{facultyName}</h2>
                <p className="text-xs font-semibold text-slate-600 mt-0.5">{deptName}</p>
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-mono font-bold text-slate-700 shadow-2xs">
                    {workload.academicYear} · {workload.semesterType.toUpperCase()} SEM
                  </span>
                  {workload.isApproved ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" /> Approved
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                      <Clock className="h-3 w-3" /> Pending Review
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-2xs transition hover:bg-slate-100 hover:text-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/40">
          {/* Key Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
              <p className="text-xs font-semibold text-slate-500">Weekly Teaching</p>
              <p className="mt-1 text-lg font-bold text-primary">
                {workload.totalWeeklyTeachingHours}h / wk
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
              <p className="text-xs font-semibold text-slate-500">Extra Duties</p>
              <p className="mt-1 text-lg font-bold text-purple-700">
                {workload.totalWeeklyHours - workload.totalWeeklyTeachingHours}h / wk
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
              <p className="text-xs font-semibold text-slate-500">Total Workload</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{workload.totalWeeklyHours}h / wk</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
              <p className="text-xs font-semibold text-slate-500">Subjects Count</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {workload.teachingAssignments?.length ?? 0} Courses
              </p>
            </div>
          </div>

          {/* Operational Classes Section */}
          {operational && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-primary" />
                  Real-Time Operational Classes & Substitutions
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 p-3">
                  <p className="text-[11px] font-medium text-emerald-700">Substitute Taken</p>
                  <p className="mt-0.5 text-sm font-bold text-emerald-950">
                    {minutesLabel(operational.substituteTakenMinutes)}
                  </p>
                </div>
                <div className="rounded-xl bg-amber-50/70 border border-amber-100 p-3">
                  <p className="text-[11px] font-medium text-amber-700">Classes Released</p>
                  <p className="mt-0.5 text-sm font-bold text-amber-950">
                    {minutesLabel(operational.substituteReleasedMinutes)}
                  </p>
                </div>
                <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-3">
                  <p className="text-[11px] font-medium text-blue-700">Extra Classes</p>
                  <p className="mt-0.5 text-sm font-bold text-blue-950">
                    {minutesLabel(operational.extraClassMinutes)}
                  </p>
                </div>
                <div className="rounded-xl bg-purple-50/70 border border-purple-100 p-3">
                  <p className="text-[11px] font-medium text-purple-700">Net Operational</p>
                  <p className="mt-0.5 text-sm font-bold text-purple-950">
                    {minutesLabel(operational.netOperationalMinutes)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Teaching Assignments List */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-primary" />
              Assigned Subjects & Timetable Sessions
            </h3>

            {workload.teachingAssignments?.length > 0 ? (
              <div className="space-y-2.5">
                {workload.teachingAssignments.map((a, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50/60 p-3.5 transition hover:bg-white"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {a.subjectName}{' '}
                        <span className="font-mono text-xs font-semibold text-slate-500">
                          ({a.subjectCode || 'Code —'})
                        </span>
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">
                          {a.program || 'B.Tech'} · Sem {a.semester} · Sec {a.section}
                        </span>
                        <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-bold text-blue-700 uppercase">
                          {a.classType}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-extrabold text-primary">{a.weeklyHours}h / wk</p>
                      <p className="text-xs text-slate-500">{a.totalHours}h total</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">No teaching assignments recorded</p>
            )}
          </div>

          {/* Extra Duties List */}
          {workload.extraDuties?.length > 0 && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 text-primary" />
                Institutional Extra Duties & Portfolio
              </h3>
              <div className="space-y-2">
                {workload.extraDuties.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl border border-amber-200/70 bg-amber-50/50 p-3"
                  >
                    <div>
                      <p className="text-xs font-bold text-amber-800 uppercase">
                        {formatDutyLabel(d.type)}
                      </p>
                      {d.description && <p className="text-xs text-slate-600 mt-0.5">{d.description}</p>}
                    </div>
                    <span className="text-xs font-bold text-amber-700">{d.weeklyHours}h / wk</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Department Summary Panel (Multi-Color Real Comparison) ───────────────────
function DeptSummaryPanel({ summaries }: { summaries: IDeptSummary[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {!summaries.length ? (
        <div className="col-span-full rounded-2xl bg-white p-8 text-center text-xs text-slate-500 border border-slate-200">
          No department workload summaries available for this academic term.
        </div>
      ) : (
        summaries.map((s, i) => (
          <motion.div
            key={s.departmentId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl bg-white p-4.5 border border-slate-200/90 shadow-2xs hover:shadow-md transition"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <p className="text-sm font-bold text-slate-900 truncate">{s.departmentName}</p>
              {s.overloadedCount > 0 ? (
                <span className="rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                  {s.overloadedCount} Overloaded
                </span>
              ) : (
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                  Balanced Load
                </span>
              )}
            </div>

            <div className="mt-3.5 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-slate-50 p-2.5 text-center">
                <p className="text-base font-extrabold text-slate-900">{s.totalFaculty}</p>
                <p className="text-[10px] text-slate-500 font-medium">Faculty</p>
              </div>
              <div className="rounded-xl bg-blue-50/60 p-2.5 text-center">
                <p className="text-base font-extrabold text-primary">{s.avgWeeklyHours}h</p>
                <p className="text-[10px] text-blue-700 font-medium">Avg Load / Wk</p>
              </div>
              <div
                className={`rounded-xl p-2.5 text-center ${s.overloadedCount > 0 ? 'bg-rose-50/70 text-rose-700' : 'bg-emerald-50/70 text-emerald-700'}`}
              >
                <p className="text-base font-extrabold">{s.overloadedCount}</p>
                <p className="text-[10px] font-medium">Overloaded</p>
              </div>
            </div>
          </motion.div>
        ))
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function FacultyWorkloadPage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const canView = useHasPermission('faculty_workload', 'view');
  const hasEditPermission = useHasPermission('faculty_workload', 'edit');
  const hasApprovePermission = useHasPermission('faculty_workload', 'approve');

  const canEdit =
    ['super_admin', 'admin', 'principal', 'dean_academic', 'hod'].includes(activeRole ?? '') &&
    (hasEditPermission || ['super_admin', 'dean_academic', 'principal', 'hod'].includes(activeRole ?? ''));
  const canApprove =
    ['super_admin', 'principal', 'dean_academic'].includes(activeRole ?? '') &&
    (hasApprovePermission || ['super_admin', 'dean_academic', 'principal'].includes(activeRole ?? ''));
  const isHodOnly = activeRole === 'hod';
  const isFacultySelfView = activeRole === 'faculty';
  const canViewSummary =
    ['super_admin', 'admin', 'principal', 'dean_academic', 'hod'].includes(activeRole ?? '') &&
    (canView || ['super_admin', 'dean_academic', 'principal', 'hod'].includes(activeRole ?? ''));

  const [scopeTab, setScopeTab] = useState<'dept' | 'own'>('dept');
  const [filterStatus, setFilterStatus] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('');
  const [ayFilter, setAyFilter] = useState<string>('');
  const [semFilter, setSemFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<IWorkload | null>(null);
  const [detailItem, setDetailItem] = useState<IWorkload | null>(null);
  const [showDeptSummary, setShowDeptSummary] = useState(false);

  const url = `faculty-workload?limit=100${isHodOnly && scopeTab === 'own' ? '&scope=own' : ''}${deptFilter ? `&departmentId=${deptFilter}` : ''
    }${facultyFilter ? `&facultyId=${facultyFilter}` : ''}${ayFilter ? `&academicYear=${ayFilter}` : ''}${semFilter ? `&semesterType=${semFilter}` : ''}`;

  const { data: raw, isLoading, isValidating, mutate } = useSwr(canView ? url : null);
  const records = useMemo(() => (raw as { data?: IWorkload[] })?.data ?? [], [raw]);
  const { mutation } = useMutation();

  const filtered = useMemo(
    () =>
      filterStatus
        ? records.filter((r) => {
          const total = r.totalWeeklyHours;
          if (filterStatus === 'overloaded') return total > 20;
          if (filterStatus === 'underloaded') return total < 10;
          return total >= 10 && total <= 20;
        })
        : records,
    [records, filterStatus],
  );

  // 4 Top Metrics & Chart Calculations
  const overloadedCount = useMemo(
    () => records.filter((r) => r.totalWeeklyHours > 20).length,
    [records],
  );
  const approvedCount = useMemo(() => records.filter((r) => r.isApproved).length, [records]);
  const avgCampusHours = useMemo(() => {
    if (!records.length) return 0;
    const sum = records.reduce((acc, r) => acc + (r.totalWeeklyHours || 0), 0);
    return Math.round((sum / records.length) * 10) / 10;
  }, [records]);

  const approvalRate = useMemo(() => {
    if (!records.length) return 0;
    return Math.round((approvedCount / records.length) * 100);
  }, [records.length, approvedCount]);

  const summaries: IDeptSummary[] = useMemo(() => {
    const map: Record<
      string,
      {
        departmentName: string;
        totalWeeklyHoursSum: number;
        count: number;
        overloadedCount: number;
      }
    > = {};
    records.forEach((r) => {
      const deptObj =
        r.departmentId && typeof r.departmentId === 'object'
          ? (r.departmentId as Record<string, unknown>)
          : null;
      const deptId = deptObj
        ? String(deptObj._id ?? 'unknown')
        : typeof r.departmentId === 'string'
          ? r.departmentId
          : 'unknown';
      const deptName = deptObj
        ? String(deptObj.name ?? r.departmentName ?? 'Unknown Dept')
        : String(r.departmentName ?? 'Unknown Dept');

      if (!map[deptId]) {
        map[deptId] = {
          departmentName: deptName,
          totalWeeklyHoursSum: 0,
          count: 0,
          overloadedCount: 0,
        };
      }
      map[deptId].totalWeeklyHoursSum += Number(r.totalWeeklyHours || 0);
      map[deptId].count += 1;
      if (Number(r.totalWeeklyHours || 0) > 20) {
        map[deptId].overloadedCount += 1;
      }
    });
    return Object.entries(map).map(([deptId, data]) => ({
      departmentId: deptId,
      departmentName: data.departmentName,
      totalFaculty: data.count,
      avgWeeklyHours: data.count ? Math.round(data.totalWeeklyHoursSum / data.count) : 0,
      overloadedCount: data.overloadedCount,
    }));
  }, [records]);

  const handleApprove = async (w: IWorkload) => {
    const res = await mutation(`faculty-workload/${w._id}/approve`, {
      method: 'POST',
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Workload approved successfully');
      mutate();
    } else {
      toast.error('Failed to approve workload');
    }
  };

  const columns: Column<IWorkload>[] = [
    {
      field: 'facultyName',
      title: 'Faculty Member',
      render: (r) => {
        const facObj =
          r.facultyId && typeof r.facultyId === 'object'
            ? (r.facultyId as Record<string, unknown>)
            : null;
        const nameFromObj = facObj
          ? [facObj.firstName, facObj.lastName].filter(Boolean).join(' ') || (facObj.name as string)
          : null;
        const displayName = nameFromObj || r.facultyName || '—';

        const deptObj =
          r.departmentId && typeof r.departmentId === 'object'
            ? (r.departmentId as Record<string, unknown>)
            : null;
        const displayDept = (deptObj?.name as string) || r.departmentName || '';

        return (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary border border-primary/20 shadow-2xs">
              {displayName.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{displayName}</p>
              {displayDept && <p className="text-xs text-slate-500">{displayDept}</p>}
            </div>
          </div>
        );
      },
    },
    {
      field: 'academicYear',
      title: 'Term',
      headerClassName: 'text-center justify-center',
      cellClassName: 'text-center',
      render: (r) => (
        <div className="flex items-center justify-center">
          <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-mono font-bold text-slate-700">
            {r.academicYear} · {r.semesterType.toUpperCase()}
          </span>
        </div>
      ),
    },
    {
      field: 'totalWeeklyTeachingHours',
      title: 'Teaching Load',
      headerClassName: 'text-center justify-center',
      cellClassName: 'text-center',
      render: (r) => (
        <div className="space-y-0.5 text-center flex flex-col items-center justify-center">
          <span className="text-sm font-bold text-primary">{r.totalWeeklyTeachingHours}h / wk</span>
          <p className="text-[11px] text-slate-500">{r.teachingAssignments?.length ?? 0} courses</p>
        </div>
      ),
    },
    {
      field: 'totalWeeklyHours',
      title: 'Total Load (AICTE)',
      headerClassName: 'text-center justify-center',
      cellClassName: 'text-center',
      render: (r) => {
        const isOver = r.totalWeeklyHours > 20;
        const isUnder = r.totalWeeklyHours < 10;
        return (
          <div className="space-y-0.5 text-center flex flex-col items-center justify-center">
            <span
              className={`text-sm font-extrabold ${isOver ? 'text-rose-600' : isUnder ? 'text-amber-600' : 'text-slate-900'}`}
            >
              {r.totalWeeklyHours}h / wk
            </span>
            <p className="text-[10px] font-semibold text-slate-500">
              {isOver ? '⚠️ Overloaded' : isUnder ? '⚠️ Underloaded' : '✅ Standard'}
            </p>
          </div>
        );
      },
    },
    {
      field: 'isApproved',
      title: 'Approval Status',
      headerClassName: 'text-center justify-center',
      cellClassName: 'text-center',
      render: (r) => (
        <div className="flex items-center justify-center">
          {r.isApproved ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> Approved
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-700">
              <Clock className="h-3 w-3" /> Pending
            </span>
          )}
        </div>
      ),
    },
  ];

  const actions: Action<IWorkload>[] = [
    {
      tooltip: 'View Full Workload Details',
      icon: <BarChart2 className="h-4 w-4 text-primary" />,
      onClick: (w) => setDetailItem(w),
    },
    ...(canApprove
      ? ([
        {
          tooltip: 'Approve Workload',
          icon: <CheckCircle className="h-4 w-4 text-emerald-600" />,
          onClick: (w: IWorkload) => handleApprove(w),
          hidden: (w: IWorkload) => w.isApproved,
        },
      ] as Action<IWorkload>[])
      : []),
    ...(canEdit
      ? ([
        {
          tooltip: 'Edit Workload',
          icon: <Edit2 className="h-4 w-4 text-slate-600" />,
          onClick: (w: IWorkload) => {
            setEditItem(w);
            setShowModal(true);
          },
        },
      ] as Action<IWorkload>[])
      : []),
  ];

  if (!canView) {
    return (
      <Empty
        title="Faculty workload access unavailable"
        subTitle="Your active role does not have permission to view teaching workloads."
      />
    );
  }

  return (
    <div className="space-y-6">
      <FacultyHrWorkflowBar />

      {/* ── AICTE Workload Guidance Banner ── */}
      <div className="rounded-2xl border border-blue-100 bg-linear-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 p-4 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Institutional AICTE / UGC Faculty Workload Benchmark
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Standard Norms: <strong>16 hrs/wk</strong> (Assistant Prof) · <strong>14 hrs/wk</strong> (Associate Prof) · <strong>12 hrs/wk</strong> (Professor) · Max Aggregate: <strong>60 hrs</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-lg bg-white border border-blue-200/80 px-2.5 py-1 text-xs font-bold text-blue-900 shadow-2xs">
            Balanced: 10–20h/wk
          </span>
          <span className="rounded-lg bg-white border border-rose-200/80 px-2.5 py-1 text-xs font-bold text-rose-800 shadow-2xs">
            Overload: &gt;20h/wk
          </span>
        </div>
      </div>

      {/* ── 4 Top KPI Statistic Cards with 4 Distinct Real SVG Charts ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Faculty in Workload Plan */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Total Faculty Planned</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{isLoading ? '—' : records.length}</p>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">Active Teaching Staff</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Users className="h-5 w-5" />
            </div>
          </div>
          {/* Smooth SVG Spline Area Wave */}
          <div className="mt-3 h-10 w-full">
            <svg viewBox="0 0 120 32" className="h-full w-full overflow-visible" preserveAspectRatio="none">
              <defs>
                <linearGradient id="splineGradWorkload" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d="M 0,26 C 25,18 45,30 70,12 C 95,6 108,18 120,8 L 120,32 L 0,32 Z" fill="url(#splineGradWorkload)" />
              <path d="M 0,26 C 25,18 45,30 70,12 C 95,6 108,18 120,8" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Card 2: Overloaded Faculty Alert */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Overloaded Alert (&gt;20h)</p>
              <p className="mt-1 text-2xl font-black text-rose-600">{isLoading ? '—' : overloadedCount}</p>
              <p className="text-[11px] font-semibold text-rose-700 mt-0.5">
                {records.length ? `${Math.round((overloadedCount / records.length) * 100)}% of Staff` : '0%'}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          {/* SVG Alert Pulse Radar Wave */}
          <div className="mt-3 h-10 w-full flex items-center justify-center">
            <svg viewBox="0 0 100 24" className="h-full w-full">
              <rect x="0" y="4" width="100" height="16" rx="8" fill="#ffe4e6" />
              <rect
                x="0"
                y="4"
                width={Math.max(8, Math.min(100, (overloadedCount / Math.max(1, records.length)) * 100))}
                height="16"
                rx="8"
                fill="#f43f5e"
              />
              <text x="50" y="15" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#881337">
                {overloadedCount > 0 ? `${overloadedCount} High Burnout Risk` : '0 Overload Risks'}
              </text>
            </svg>
          </div>
        </div>

        {/* Card 3: Workload Approval Rate */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Institutional Approval</p>
              <p className="mt-1 text-2xl font-black text-emerald-600">{isLoading ? '—' : `${approvalRate}%`}</p>
              <p className="text-[11px] font-semibold text-emerald-700 mt-0.5">
                {approvedCount} / {records.length} Approved
              </p>
            </div>
            {/* SVG Concentric Progress Donut */}
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
              <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90 transform">
                <circle cx="22" cy="22" r="18" fill="none" stroke="#d1fae5" strokeWidth="4" />
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="4"
                  strokeDasharray={113.1}
                  strokeDashoffset={113.1 - (113.1 * approvalRate) / 100}
                  strokeLinecap="round"
                />
              </svg>
              <CheckCircle className="absolute h-4 w-4 text-emerald-600" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>Pending Review: {records.length - approvedCount}</span>
            <span className="text-emerald-700 font-bold">{approvedCount} Ready</span>
          </div>
        </div>

        {/* Card 4: Campus Average Weekly Load */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Campus Avg. Weekly Load</p>
              <p className="mt-1 text-2xl font-black text-indigo-950">{isLoading ? '—' : `${avgCampusHours}h`}</p>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">AICTE Target: ~15h / wk</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          {/* Stepped Histogram Cadence Bars */}
          <div className="mt-3 flex items-end justify-between h-8 gap-1.5 px-1">
            {[12, 16, 14, 18, 15, 17, 13, 16].map((val, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full rounded-t-sm bg-indigo-500/80 transition-all hover:bg-indigo-600"
                  style={{ height: `${(val / 20) * 100}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Scope Tab for HOD ── */}
      {isHodOnly && (
        <div className="flex items-center gap-1 rounded-xl bg-white p-1 border border-slate-200 w-fit shadow-2xs">
          <button
            type="button"
            onClick={() => setScopeTab('dept')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${scopeTab === 'dept'
              ? 'bg-primary text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
          >
            <Building2 className="h-4 w-4" />
            Department Faculty Workloads
          </button>
          <button
            type="button"
            onClick={() => setScopeTab('own')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${scopeTab === 'own'
              ? 'bg-primary text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
          >
            <UserCheck className="h-4 w-4" />
            My Workload & Assignments
          </button>
        </div>
      )}

      {/* ── Filter Controls Section ── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4.5 shadow-2xs grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Department
          </label>
          <AsyncSelect
            type="departments"
            value={deptFilter || null}
            onChange={(val) => {
              setDeptFilter(val ?? '');
              setFacultyFilter('');
            }}
            placeholder="All Departments"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Faculty Member
          </label>
          <AsyncSelect
            type="faculty"
            value={facultyFilter || null}
            params={{
              ...(deptFilter ? { departmentId: deptFilter } : { includeAllTeachingFaculty: true }),
            }}
            onChange={(val) => setFacultyFilter(val ?? '')}
            placeholder="All Faculty Members"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Academic Year
          </label>
          <AsyncSelect
            type="academicYears"
            value={ayFilter || null}
            onChange={(val) => setAyFilter(val ?? '')}
            placeholder="All Years"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Semester Term
          </label>
          <select
            value={semFilter}
            onChange={(e) => setSemFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/10 h-10.5 cursor-pointer"
          >
            <option value="">All Terms</option>
            <option value="odd">Odd Semester (July–Dec)</option>
            <option value="even">Even Semester (Jan–Jun)</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Load Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/10 h-10.5 cursor-pointer"
          >
            <option value="">All Load Status</option>
            <option value="normal">Normal Load (10–20h)</option>
            <option value="overloaded">⚠️ Overloaded (&gt;20h)</option>
            <option value="underloaded">⚠️ Underloaded (&lt;10h)</option>
          </select>
        </div>
      </div>

      {/* ── Department Summary Expandable Panel ── */}
      <AnimatePresence>
        {showDeptSummary && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <DeptSummaryPanel summaries={summaries} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Workload Table ── */}
      <div className="overflow-hidden rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
        <CustomTable<IWorkload>
          title={isFacultySelfView || scopeTab === 'own' ? 'My Teaching Assignments & Load' : 'Faculty Workload Distribution'}
          description={
            isFacultySelfView || scopeTab === 'own'
              ? 'View your assigned theory courses, lab sessions, and institutional extra duties.'
              : 'Audit, assign, and approve weekly teaching workloads across all departments.'
          }
          onRefresh={() => void mutate()}
          isRefreshing={isValidating}
          isValidating={isValidating}
          isLoading={isLoading}
          data={filtered}
          columns={columns}
          actions={actions}
          options={{
            search: true,
            pagination: true,
            pageSize: 12,
            actionsType: 'dropdown',
            export: false,
          }}
          customActions={
            <div className="flex items-center gap-2 whitespace-nowrap">
              {canViewSummary && (
                <CustomButton
                  variant="secondary"
                  onClick={() => setShowDeptSummary(!showDeptSummary)}
                  className="whitespace-nowrap"
                >
                  {showDeptSummary ? (
                    <>
                      <ChevronUp className="mr-1.5 h-3.5 w-3.5" /> Hide Dept Summary
                    </>
                  ) : (
                    <>
                      <ChevronDown className="mr-1.5 h-3.5 w-3.5" /> Department Summary
                    </>
                  )}
                </CustomButton>
              )}
              {canEdit && (
                <CustomButton
                  variant="primary"
                  onClick={() => {
                    setEditItem(null);
                    setShowModal(true);
                  }}
                  className="whitespace-nowrap"
                  startIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  Assign Workload
                </CustomButton>
              )}
            </div>
          }
        />
      </div>

      {/* ── Modals & Drawers ── */}
      <AnimatePresence>
        {showModal && (
          <WorkloadModal
            workload={editItem}
            onClose={() => {
              setShowModal(false);
              setEditItem(null);
            }}
            onSaved={() => {
              mutate();
              setShowModal(false);
              setEditItem(null);
            }}
          />
        )}
        {detailItem && (
          <WorkloadDetailDrawer workload={detailItem} onClose={() => setDetailItem(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

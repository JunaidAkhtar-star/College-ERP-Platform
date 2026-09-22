/** @file GradebookPanel.tsx @description Activity setup, attendance-gated score entry and approval workflow. @module features/assessment-policy */
'use client';
import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { type Column } from '@/shared/core/CustomTable';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useFormik } from 'formik';
import { CheckCheck, ClipboardCheck, LockKeyhole, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import type {
  IAssessmentActivity,
  IAssessmentPolicy,
  IScoreLedger,
  ISubject,
} from '../types/assessment-policy.types';
interface IUser {
  _id: string;
  name: string;
  email: string;
  roles?: string[];
}
interface IAttendance {
  _id: string;
  subjectId: string;
  date: string;
  periodNumber: number;
  classType: string;
}
interface IProps {
  policies: IAssessmentPolicy[];
  subjects: ISubject[];
}

export default function GradebookPanel({ policies, subjects }: IProps) {
  const canCreate = useHasPermission('internal_assessment', 'create');
  const canEdit = useHasPermission('internal_assessment', 'edit');
  const canApprove = useHasPermission('internal_assessment', 'approve');
  const canFreeze = useHasPermission('result', 'approve');
  const [mode, setMode] = useState<'activity' | 'score' | null>(null);
  const [bulkMarks, setBulkMarks] = useState<Record<string, string>>({});
  const { mutation, isLoading: saving } = useMutation();
  const { data: activitiesRaw, mutate: refreshActivities } = useSwr(
    'assessment-gradebook/activities',
  );
  const {
    data: ledgersRaw,
    isLoading,
    isValidating,
    mutate: refreshLedgers,
  } = useSwr('assessment-gradebook/ledgers');
  const activities = (activitiesRaw as { data?: IAssessmentActivity[] })?.data ?? [];
  const ledgers = (ledgersRaw as { data?: IScoreLedger[] })?.data ?? [];
  const { data: usersRaw } = useSwr('user?role=student&limit=500');
  const usersPayload = (usersRaw as { data?: { data?: IUser[] } | IUser[] })?.data;
  const students = useMemo(
    () => (Array.isArray(usersPayload) ? usersPayload : (usersPayload?.data ?? [])),
    [usersPayload],
  );
  const [filterAcademicYear, setFilterAcademicYear] = useState<string>('');
  const [filterProgram, setFilterProgram] = useState<string>('');
  const [filterSemester, setFilterSemester] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState<string>('');

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      if (studentSearch.trim()) {
        const q = studentSearch.toLowerCase();
        const matches =
          student.name?.toLowerCase().includes(q) ||
          student.email?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [students, studentSearch]);

  const published = policies.filter((policy) => policy.status === 'published');
  const activityForm = useFormik({
    initialValues: {
      policyId: '',
      componentKey: '',
      subjectId: '',
      sectionId: '',
      semester: 1,
      academicYear: `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(-2)}`,
      sequence: 1,
      title: '',
      scheduledAt: new Date().toISOString().slice(0, 16),
      maximumMarks: 1,
      attendanceRecordId: '',
      status: 'open',
    },
    validationSchema: Yup.object({
      policyId: Yup.string().required(),
      componentKey: Yup.string().required(),
      subjectId: Yup.string().required(),
      academicYear: Yup.string()
        .matches(/^\d{4}-(?:\d{2}|\d{4})$/)
        .required(),
      sequence: Yup.number().min(1).required(),
      title: Yup.string().trim().required(),
      maximumMarks: Yup.number().positive().required(),
    }),
    onSubmit: async (values) => {
      const response = await mutation('assessment-gradebook/activities', {
        method: 'POST',
        body: {
          ...values,
          sectionId: values.sectionId || undefined,
          attendanceRecordId: values.attendanceRecordId || undefined,
        },
      });
      if ((response as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Assessment activity configured');
        activityForm.resetForm();
        setMode(null);
        refreshActivities();
      }
    },
  });
  const selectedPolicy = published.find((policy) => policy._id === activityForm.values.policyId);
  const scoreForm = useFormik({
    initialValues: {
      policyId: '',
      activityId: '',
      studentId: '',
      subjectId: '',
      sectionId: '',
      semester: 1,
      academicYear: `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(-2)}`,
      componentKey: '',
      rawMarks: 0,
      attendanceRecordId: '',
      isMakeup: false,
    },
    validationSchema: Yup.object({
      policyId: Yup.string().required(),
      studentId: Yup.string().required(),
      subjectId: Yup.string().required(),
      componentKey: Yup.string().required(),
      rawMarks: Yup.number().min(0).required(),
    }),
    onSubmit: async (values) => {
      const response = await mutation('assessment-gradebook/scores', {
        method: 'POST',
        body: {
          ...values,
          activityId: values.activityId || undefined,
          sectionId: values.sectionId || undefined,
          attendanceRecordId: values.attendanceRecordId || undefined,
        },
      });
      if ((response as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Score saved to draft gradebook');
        scoreForm.resetForm();
        setMode(null);
        refreshLedgers();
      }
    },
  });
  const selectedActivity = activities.find(
    (activity) => activity._id === scoreForm.values.activityId,
  );
  const attendanceTo = new Date().toISOString().slice(0, 10);
  const attendanceFrom = `${scoreForm.values.academicYear.slice(0, 4) || new Date().getFullYear()}-01-01`;
  const attendancePath = scoreForm.values.subjectId
    ? `attendance/subject/${scoreForm.values.subjectId}?from=${attendanceFrom}&to=${attendanceTo}`
    : null;
  const { data: attendanceRaw } = useSwr(attendancePath);
  const attendancePayload = (attendanceRaw as { data?: { data?: IAttendance[] } | IAttendance[] })
    ?.data;
  const attendance = Array.isArray(attendancePayload)
    ? attendancePayload
    : (attendancePayload?.data ?? []);
  const transition = async (row: IScoreLedger, action: 'submit' | 'verify' | 'freeze') => {
    const response = await mutation(`assessment-gradebook/ledgers/${row._id}/${action}`, {
      method: 'POST',
    });
    if ((response as { results?: { success?: boolean } })?.results?.success) {
      toast.success(`Ledger ${action} successful`);
      refreshLedgers();
    }
  };
  const saveBulkMarks = async () => {
    if (!selectedActivity) return;
    const entries = Object.entries(bulkMarks).filter(([, marks]) => marks !== '');
    if (entries.length === 0) {
      toast.info('No marks entered to save');
      return;
    }
    const response = await mutation('assessment-gradebook/scores/bulk', {
      method: 'POST',
      body: {
        activityId: selectedActivity._id,
        policyId: selectedActivity.policyId,
        componentKey: selectedActivity.componentKey,
        subjectId: selectedActivity.subjectId,
        sectionId: selectedActivity.sectionId,
        semester: selectedActivity.semester,
        academicYear: selectedActivity.academicYear,
        scores: entries.map(([studentId, rawMarks]) => ({
          studentId,
          rawMarks: Number(rawMarks),
        })),
      },
    });
    if ((response as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Bulk marks recorded');
      setBulkMarks({});
      setMode(null);
      refreshLedgers();
    }
  };
  const columns: Column<IScoreLedger>[] = useMemo(
    () => [
      {
        field: 'policyCode',
        title: 'Policy Code',
        render: (row) => (
          <div>
            <p className="font-semibold text-slate-900">{row.policyCode}</p>
            <p className="text-xs text-slate-500">
              Version {row.policyVersion} · Sem {row.semester} · {row.academicYear}
            </p>
          </div>
        ),
      },
      {
        field: 'studentId',
        title: 'Student',
        render: (row) => (
          <span className="text-xs font-medium text-slate-800">
            {typeof row.studentId === 'object'
              ? row.studentId.name || row.studentId.studentId || 'Student record'
              : students.find((item) => item._id === row.studentId)?.name || row.studentId}
          </span>
        ),
      },
      {
        field: 'totalMarks',
        title: 'Total Score',
        render: (row) => (
          <span className="font-semibold text-slate-900">
            {row.totalMarks} / {row.maximumMarks} ({row.percentage?.toFixed(1) ?? '0.0'}%)
          </span>
        ),
      },
      {
        field: 'gradeLetter',
        title: 'Grade',
        render: (row) => (
          <span className="font-bold text-primary">
            {row.gradeLetter || '—'} {row.gradePoint ? `(${row.gradePoint} GP)` : ''}
          </span>
        ),
      },
      {
        field: 'status',
        title: 'Workflow Status',
        render: (row) => {
          const colors: Record<string, string> = {
            draft: 'bg-slate-100 text-slate-700',
            submitted: 'bg-amber-100 text-amber-800',
            verified: 'bg-blue-100 text-blue-800',
            frozen: 'bg-emerald-100 text-emerald-800',
          };
          return (
            <span
              className={`inline-block rounded px-2.5 py-0.5 text-xs font-semibold capitalize ${colors[row.status] ?? 'bg-slate-100 text-slate-700'}`}
            >
              {row.status}
            </span>
          );
        },
      },
    ],
    [students],
  );
  return (
    <div className="space-y-5">
      {mode === 'activity' && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 sm:p-6">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMode(null)}
          />
          <div className="relative z-10 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                  Continuous Assessment (CIE) & Lab Setup
                </span>
                <h3 className="mt-1 text-lg font-bold text-slate-900">
                  Configure Assessment or Practical Activity
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Schedule a graded test, assignment, quiz, or practical lab session bound to a published policy.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMode(null)}
                className="flex size-8 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer shadow-xs transition-colors"
              >
                ✕
              </button>
            </div>
            <form onSubmit={activityForm.handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3.5 text-xs text-blue-900 flex items-start gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded bg-blue-600 text-white font-bold text-[11px]">i</span>
                <div className="space-y-0.5">
                  <p className="font-bold">Activity Governance Guidelines</p>
                  <p className="text-blue-700">
                    Each activity links directly to a policy component (e.g. Lab #1 to #10, Midterm 1, or Quiz 1). Maximum marks and scoring rules are verified against the published curriculum policy.
                  </p>
                </div>
              </div>
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <span className="flex size-4 items-center justify-center rounded bg-slate-200 text-[10px] font-bold text-slate-700">1</span>
                  Academic Scope & Policy Mapping
                </h4>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Published Policy <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="policyId"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                      value={activityForm.values.policyId}
                      onChange={activityForm.handleChange}
                    >
                      <option value="">Choose published policy…</option>
                      {published.map((policy) => (
                        <option key={policy._id} value={policy._id}>
                          {policy.name} (v{policy.version})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Policy Component <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="componentKey"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                      value={activityForm.values.componentKey}
                      onChange={activityForm.handleChange}
                    >
                      <option value="">Choose component…</option>
                      {selectedPolicy?.components.map((component) => (
                        <option key={component.key} value={component.key}>
                          {component.name} ({component.maximumMarks} Max Marks)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Subject / Course <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="subjectId"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                      value={activityForm.values.subjectId}
                      onChange={activityForm.handleChange}
                    >
                      <option value="">Choose subject…</option>
                      {subjects.map((subject) => (
                        <option key={subject._id} value={subject._id}>
                          {subject.code} · {subject.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <span className="flex size-4 items-center justify-center rounded bg-slate-200 text-[10px] font-bold text-slate-700">2</span>
                  Activity Parameters & Schedule
                </h4>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Activity Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="title"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                      placeholder="e.g. Lab Session 1: Syntax & Variables"
                      value={activityForm.values.title}
                      onChange={activityForm.handleChange}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Sequence / Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="sequence"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                      type="number"
                      min="1"
                      placeholder="e.g. 1"
                      value={activityForm.values.sequence}
                      onChange={activityForm.handleChange}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Maximum Marks <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="maximumMarks"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="e.g. 10.00"
                      value={activityForm.values.maximumMarks}
                      onChange={activityForm.handleChange}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Semester / Term <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="semester"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                      type="number"
                      min="1"
                      placeholder="e.g. 1"
                      value={activityForm.values.semester}
                      onChange={activityForm.handleChange}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Scheduled Date & Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="scheduledAt"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                      type="datetime-local"
                      value={activityForm.values.scheduledAt}
                      onChange={activityForm.handleChange}
                    />
                  </div>
                  <div>
                    <AsyncSelect
                      type="academicYears"
                      label="Academic Year"
                      value={activityForm.values.academicYear || null}
                      onChange={(value) => activityForm.setFieldValue('academicYear', value ?? '')}
                      placeholder="Select academic year"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 pt-4">
                <CustomButton
                  variant="tertiary"
                  type="button"
                  onClick={() => setMode(null)}
                >
                  Cancel
                </CustomButton>
                <CustomButton
                  variant="primary"
                  type="submit"
                  loading={saving}
                  startIcon={<Plus size={15} />}
                >
                  Create & Schedule Activity
                </CustomButton>
              </div>
            </form>
          </div>
        </div>
      )}
      {mode === 'score' && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 sm:p-6">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMode(null)}
          />
          <div className="relative z-10 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  Continuous Marks Entry
                </span>
                <h3 className="mt-1 text-lg font-bold text-slate-900">
                  Record & Enter Assessment Marks
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Record individual marks or enter grades in bulk for all students registered in the selected activity.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMode(null)}
                className="flex size-8 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer shadow-xs transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <span className="flex size-4 items-center justify-center rounded bg-slate-200 text-[10px] font-bold text-slate-700">1</span>
                  Target Assessment & Student Selection
                </h4>
                <form onSubmit={scoreForm.handleSubmit} className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3 border-b border-slate-200 pb-3 bg-white p-3 rounded-lg border">
                    <div>
                      <AsyncSelect
                        type="academicYears"
                        label="Academic Year"
                        value={filterAcademicYear || scoreForm.values.academicYear || null}
                        onChange={(val) => {
                          setFilterAcademicYear(val ?? '');
                          if (val) scoreForm.setFieldValue('academicYear', val);
                        }}
                        placeholder="Select Academic Year"
                      />
                    </div>
                    <div>
                      <AsyncSelect
                        type="programs"
                        label="Program / Degree"
                        value={filterProgram || null}
                        onChange={(val) => setFilterProgram(val ?? '')}
                        placeholder="Filter by Program (e.g. B.Tech)"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700">
                        Semester / Term
                      </label>
                      <select
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                        value={filterSemester}
                        onChange={(e) => setFilterSemester(e.target.value)}
                      >
                        <option value="">All Semesters</option>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                          <option key={s} value={s}>
                            Semester {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-bold text-slate-700">
                        Assessment / Lab Activity <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="activityId"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                        value={scoreForm.values.activityId}
                        onChange={(event) => {
                          scoreForm.handleChange(event);
                          const activity = activities.find((item) => item._id === event.target.value);
                          if (activity) {
                            scoreForm.setValues({
                              ...scoreForm.values,
                              activityId: activity._id,
                              policyId: activity.policyId,
                              componentKey: activity.componentKey,
                              subjectId: activity.subjectId,
                              semester: activity.semester,
                              academicYear: activity.academicYear,
                              attendanceRecordId: activity.attendanceRecordId ?? '',
                            });
                          }
                        }}
                      >
                        <option value="">Select scheduled activity…</option>
                        {activities
                          .filter((item) => item.status !== 'cancelled')
                          .map((item) => (
                            <option key={item._id} value={item._id}>
                              {item.title} (Max: {item.maximumMarks} Marks · Sem {item.semester})
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <AsyncSelect
                        type="students"
                        label="Individual Student"
                        required
                        value={scoreForm.values.studentId || null}
                        onChange={(val) => scoreForm.setFieldValue('studentId', val ?? '')}
                        placeholder="Search student by Name or Roll No…"
                        params={{
                          ...(filterAcademicYear ? { academicYear: filterAcademicYear } : {}),
                          ...(filterProgram ? { program: filterProgram } : {}),
                          ...(filterSemester ? { semester: filterSemester } : {}),
                        }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700">
                        Marks Obtained <span className="text-red-500">*</span>
                      </label>
                      <input
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                        type="number"
                        min="0"
                        max={selectedActivity?.maximumMarks}
                        step="0.01"
                        name="rawMarks"
                        placeholder={selectedActivity ? `Max ${selectedActivity.maximumMarks}` : 'e.g. 9.5'}
                        value={scoreForm.values.rawMarks}
                        onChange={scoreForm.handleChange}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-bold text-slate-700">
                        Linked Attendance Session (Optional)
                      </label>
                      <select
                        name="attendanceRecordId"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                        value={scoreForm.values.attendanceRecordId}
                        onChange={scoreForm.handleChange}
                      >
                        <option value="">No attendance link (Direct test)</option>
                        {attendance.map((item) => (
                          <option key={item._id} value={item._id}>
                            {new Date(item.date).toLocaleDateString('en-IN')} · Period {item.periodNumber} ({item.classType})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                        <input
                          name="isMakeup"
                          type="checkbox"
                          className="size-4 rounded border-slate-300 text-primary focus:ring-primary"
                          checked={scoreForm.values.isMakeup}
                          onChange={scoreForm.handleChange}
                        />
                        <span>Authorized Retest / Makeup</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <CustomButton variant="primary" type="submit" loading={saving}>
                      Save Single Student Score
                    </CustomButton>
                  </div>
                </form>
              </div>
              {selectedActivity ? (
                <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span className="flex size-4 items-center justify-center rounded bg-emerald-100 text-[10px] font-bold text-emerald-700">2</span>
                        Bulk Roster Scoring: <span className="text-primary">{selectedActivity.title}</span>
                      </h4>
                      <p className="text-xs text-slate-500">
                        {filteredStudents.length} of {students.length} students shown · Max score: <strong>{selectedActivity.maximumMarks} Marks</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <input
                        type="text"
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="Search student or email…"
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-primary focus:ring-1 focus:ring-primary w-48 sm:w-60"
                      />
                      <CustomButton variant="primary" loading={saving} onClick={saveBulkMarks}>
                        Save All Entered Marks
                      </CustomButton>
                    </div>
                  </div>
                  <div className="grid max-h-96 gap-2.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3 p-1">
                    {filteredStudents.map((student) => (
                      <label
                        key={student._id}
                        className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 hover:border-slate-300 hover:bg-white transition-all"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-slate-800">{student.name}</p>
                          <p className="truncate text-[10px] text-slate-500">{student.email}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            className="w-18 rounded-md border border-slate-300 bg-white px-2 py-1 text-center text-sm font-bold text-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            type="number"
                            min="0"
                            max={selectedActivity.maximumMarks}
                            step="0.01"
                            placeholder="Score"
                            value={bulkMarks[student._id] ?? ''}
                            onChange={(event) =>
                              setBulkMarks((current) => ({
                                ...current,
                                [student._id]: event.target.value,
                              }))
                            }
                          />
                          <span className="text-[11px] font-medium text-slate-400">/{selectedActivity.maximumMarks}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center bg-slate-50/50">
                  <ClipboardCheck className="mx-auto size-7 text-slate-400 mb-1.5" />
                  <p className="text-sm font-bold text-slate-700">Select an Assessment Activity Above</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Choose an activity from the dropdown to load the bulk class roster and score students rapidly.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <section>
        <CustomTable
          title="Student Assessment Ledgers"
          description="Capture, verify, and freeze continuous assessment marks and course grade scores."
          onRefresh={() => refreshLedgers()}
          isRefreshing={isLoading || isValidating}
          isValidating={isValidating}
          customActions={
            <div className="flex items-center gap-2.5">
              {canCreate && (
                <CustomButton
                  variant="primary"
                  startIcon={<Plus size={16} />}
                  onClick={() => setMode(mode === 'activity' ? null : 'activity')}
                  className="shadow-xs! cursor-pointer"
                >
                  New activity
                </CustomButton>
              )}
              {canEdit && (
                <CustomButton
                  variant="secondary"
                  startIcon={<ClipboardCheck size={16} />}
                  onClick={() => setMode(mode === 'score' ? null : 'score')}
                  className="shadow-xs! cursor-pointer"
                >
                  Enter marks
                </CustomButton>
              )}
            </div>
          }
          data={ledgers as unknown as Record<string, unknown>[]}
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          isLoading={isLoading}
          actions={[
            {
              tooltip: 'Submit for verification',
              icon: <ClipboardCheck size={15} />,
              hidden: (row) => !canEdit || (row as unknown as IScoreLedger).status !== 'draft',
              onClick: (row) => transition(row as unknown as IScoreLedger, 'submit'),
            },
            {
              tooltip: 'Verify marks',
              icon: <CheckCheck size={15} />,
              hidden: (row) =>
                !canApprove || (row as unknown as IScoreLedger).status !== 'submitted',
              onClick: (row) => transition(row as unknown as IScoreLedger, 'verify'),
            },
            {
              tooltip: 'Freeze result record',
              icon: <LockKeyhole size={15} />,
              hidden: (row) => !canFreeze || (row as unknown as IScoreLedger).status !== 'verified',
              onClick: (row) => transition(row as unknown as IScoreLedger, 'freeze'),
            },
          ]}
          options={{ search: true, sorting: true, pagination: true, export: false, refresh: true }}
        />
      </section>

      {/* Gradebook Workflow Guidance Cards */}
      <div className="grid gap-3.5 sm:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex size-9 items-center justify-center rounded-lg bg-slate-900 text-white font-bold text-xs">
            1
          </div>
          <h4 className="mt-3 text-sm font-bold text-slate-900">Schedule Activities & Labs</h4>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Create scheduled instances (e.g. Lab 1 to 10, Midterm 1, or Quiz 1) bound to a published policy component with specified maximum marks.
          </p>
        </article>
        <article className="rounded-xl border border-emerald-100 bg-white p-4 shadow-xs">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-xs">
            2
          </div>
          <h4 className="mt-3 text-sm font-bold text-slate-900">Record Scores & Link Attendance</h4>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Enter marks individually or in bulk by selecting Academic Year and Program. Link attendance sessions to ensure only eligible present students get recorded.
          </p>
        </article>
        <article className="rounded-xl border border-blue-100 bg-white p-4 shadow-xs">
          <div className="flex size-9 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs">
            3
          </div>
          <h4 className="mt-3 text-sm font-bold text-slate-900">Submit, Verify & Freeze</h4>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Subject teachers submit drafts for HOD verification. Once verified, the Dean/Exam Cell freezes ledgers into official transcripts.
          </p>
        </article>
      </div>
    </div>
  );
}

/**
 * @file ExaminationPage.tsx
 * @description Complete examination module — role-aware tabs:
 *
 *  Admin / Exam-cell tabs: Schedules · Marks Entry · Results · Rank List · Hall Ticket · Seating · Recheck
 *  Student / Parent tab: My Results · Recheck Request
 *  Faculty tab: Marks Entry (for own subjects)
 *
 * APIs:
 *  GET  examination/schedules
 *  POST examination/schedules
 *  PUT  examination/schedules/:id
 *  POST examination/marks
 *  GET  examination/marks/student/:studentId
 *  POST examination/results/compile
 *  POST examination/results/publish
 *  GET  examination/results
 *  GET  examination/results/ranklist
 *  GET  examination/results/student/:studentId
 *  POST examination/hall-ticket
 *  POST examination/schedules/:id/seating
 *  POST examination/recheck
 *  GET  examination/recheck
 *  PUT  examination/recheck/:id/review
 *  GET  examination/results/student/:studentId/marksheet  (PDF)
 *  GET  examination/results/student/:studentId/transcript (PDF)
 * @module features/role-wise-features/examination
 */
'use client';

import AsyncSelect from '@/shared/core/AsyncSelect';
import ExaminationWorkflowBar from '@/shared/components/ExaminationWorkflowBar';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Action, Column } from '@/shared/core/CustomTable';
import Empty from '@/shared/core/Empty';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useAuthStore } from '@/shared/store/authStore';
import { downloadPdf, downloadPdfBlob, fetchPdf } from '@/shared/utils';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import { useFormik } from 'formik';
import {
  BarChart2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Download,
  Edit2,
  FileText,
  Layers,
  Plus,
  RefreshCw,
  Send,
  Trophy,
  XCircle,
} from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import * as Yup from 'yup';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ISchedule {
  _id: string;
  sectionId?: string;
  departmentId?: string;
  title?: string;
  status?: string;
  examType: string;
  semester: number;
  program: string;
  subjectCode: string;
  subjectName: string;
  examDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  totalMarks: number;
  passingMarks: number;
  subjects?: Array<{
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    examDate: string;
    startTime: string;
    endTime: string;
    venueId?: string;
    venue: string;
    maxMarks: number;
    passMarks: number;
    invigilators?: Array<string | { _id?: string }>;
  }>;
  academicYear: string;
  createdAt: string;
  [key: string]: unknown;
}

interface IMarkEntry {
  scheduleId: string;
  studentId: string;
  rollNumber: string;
  subjectId: string;
  subjectCode: string;
  semester: number;
  examType: string;
  internalTotal: number;
  internalMax: number;
  externalMarks: number;
  externalMax: number;
  isAbsent: boolean;
  academicYear: string;
}

interface IResult {
  _id: string;
  studentId: string;
  studentName?: string;
  rollNo?: string;
  rollNumber?: string;
  semester: number;
  academicYear: string;
  subjectResults: {
    subjectCode: string;
    subjectName?: string;
    internalMarks: number;
    externalMarks: number;
    totalMarks: number;
    gradeLetter?: string;
  }[];
  totalCreditsRegistered: number;
  totalCreditsEarned: number;
  sgpa: number;
  cgpa: number;
  result: 'PASS' | 'FAIL' | 'WITHHELD';
  isPublished: boolean;
  [key: string]: unknown;
}

interface IPendingMark {
  _id: string;
  studentId: string | { _id: string; name?: string };
  subjectId: string | { _id: string; name?: string; code?: string };
  enteredBy: string | { _id: string; name?: string };
  rollNumber: string;
  subjectCode: string;
  examType: string;
  internalTotal: number;
  externalMarks: number;
  totalMarks: number;
  updatedAt: string;
}

interface IRankEntry {
  studentId: string;
  studentName?: string;
  rollNo?: string;
  rollNumber?: string;
  sgpa: number;
  cgpa: number;
  result: string;
  rank: number;
  [key: string]: unknown;
}

interface IRecheckRequest {
  _id: string;
  studentId: string | { _id?: string; name?: string; email?: string };
  studentName?: string;
  subjectCode: string;
  semester: number;
  examType: string;
  reason: string;
  status: 'pending' | 'under_review' | 'marks_updated' | 'no_change' | 'rejected';
  reviewNotes?: string;
  feePaid?: boolean;
  createdAt: string;
  [key: string]: unknown;
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Schedule Modal ────────────────────────────────────────────────────────────
function ScheduleModal({
  schedule,
  onClose,
  onSaved,
}: {
  schedule?: ISchedule | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const [additionalSubjects, setAdditionalSubjects] = useState<ISchedule['subjects']>(
    schedule?.subjects?.slice(1) ?? [],
  );
  const formik = useFormik({
    initialValues: {
      title: schedule?.title ?? '',
      sectionId: schedule?.sectionId ?? '',
      departmentId: schedule?.departmentId ?? '',
      subjectId: schedule?.subjects?.[0]?.subjectId ?? '',
      evaluatorId:
        typeof schedule?.subjects?.[0]?.invigilators?.[0] === 'object'
          ? String(schedule.subjects[0].invigilators[0]._id ?? '')
          : String(schedule?.subjects?.[0]?.invigilators?.[0] ?? ''),
      examType: schedule?.examType ?? 'Mid Semester 1',
      semester: schedule?.semester ?? 1,
      program: schedule?.program ?? '',
      subjectCode: schedule?.subjects?.[0]?.subjectCode ?? '',
      subjectName: schedule?.subjects?.[0]?.subjectName ?? '',
      examDate: schedule?.subjects?.[0]?.examDate ? schedule.subjects[0].examDate.slice(0, 10) : '',
      startTime: schedule?.subjects?.[0]?.startTime ?? '',
      endTime: schedule?.subjects?.[0]?.endTime ?? '',
      venueId: schedule?.subjects?.[0]?.venueId ?? '',
      venue: schedule?.subjects?.[0]?.venue ?? '',
      totalMarks: schedule?.subjects?.[0]?.maxMarks ?? 100,
      passingMarks: schedule?.subjects?.[0]?.passMarks ?? 40,
      academicYear:
        schedule?.academicYear ?? new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
    },
    validationSchema: Yup.object({
      title: Yup.string().trim().required('Schedule title required'),
      sectionId: Yup.string().required('Select a section'),
      departmentId: Yup.string().required('Select a department'),
      subjectId: Yup.string().required('Select a subject'),
      evaluatorId: Yup.string().required('Assign an evaluator'),
      examType: Yup.string().required(),
      semester: Yup.number().min(1).max(8).required(),
      program: Yup.string().trim().required('Program required'),
      subjectCode: Yup.string().trim().required('Subject code required'),
      examDate: Yup.string().required('Date required'),
      startTime: Yup.string().required('Start time required'),
      venue: Yup.string().trim().required('Venue required'),
      totalMarks: Yup.number().min(1).required(),
      passingMarks: Yup.number().min(0).required(),
    }),
    onSubmit: async (values) => {
      const isEdit = !!schedule?._id;
      const body = {
        title: values.title,
        examType: values.examType,
        sectionId: values.sectionId,
        departmentId: values.departmentId,
        program: values.program,
        semester: values.semester,
        academicYear: values.academicYear,
        subjects: [
          {
            subjectId: values.subjectId,
            examDate: values.examDate,
            startTime: values.startTime,
            endTime: values.endTime,
            venueId: values.venueId,
            venue: values.venue,
            invigilators: [values.evaluatorId],
          },
          ...(additionalSubjects ?? []),
        ],
      };
      const res = await mutation(
        isEdit ? `examination/schedules/${schedule!._id}` : 'examination/schedules',
        { method: isEdit ? 'PUT' : 'POST', body, isAlert: true },
      );
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Saved');
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
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative z-10 w-full max-w-lg overflow-y-auto max-h-[92dvh] rounded-2xl bg-white "
      >
        <div className="sticky top-0 flex items-center gap-3 border-b border-slate-100 bg-white px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary">
            <Calendar className="h-4.5 w-4.5" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">
            {schedule?._id ? 'Edit Schedule' : 'New Schedule'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-slate-600 hover:text-slate-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <form onSubmit={formik.handleSubmit} className="space-y-4 p-6">
          <div>
            <label className={labelCls}>Schedule Title *</label>
            <input
              name="title"
              value={formik.values.title}
              onChange={formik.handleChange}
              placeholder="Semester 3 End-Term Examination"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <AsyncSelect
              type="departments"
              label="Department"
              required
              value={formik.values.departmentId}
              onChange={(value) => {
                formik.setFieldValue('departmentId', value ?? '');
                formik.setFieldValue('sectionId', '');
                formik.setFieldValue('subjectId', '');
              }}
            />
            <AsyncSelect
              type="sections"
              label="Section / Class"
              required
              value={formik.values.sectionId}
              params={{
                master: true,
                departmentId: formik.values.departmentId,
                academicYear: formik.values.academicYear,
              }}
              disabled={!formik.values.departmentId}
              onChange={(value, option) => {
                formik.setFieldValue('sectionId', value ?? '');
                const semester = option?.label.match(/Sem\s+(\d+)/i)?.[1];
                if (semester) formik.setFieldValue('semester', Number(semester));
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Exam Type *</label>
              <select
                name="examType"
                value={formik.values.examType}
                onChange={formik.handleChange}
                className={inputCls}
              >
                <option value="Mid Semester 1">Mid Semester 1</option>
                <option value="Mid Semester 2">Mid Semester 2</option>
                <option value="End Semester">End Semester</option>
                <option value="Practical">Practical</option>
                <option value="Viva">Viva</option>
                <option value="Supplementary">Supplementary</option>
                <option value="Back Paper">Back Paper</option>
              </select>
            </div>
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
          </div>
          <div className="grid grid-cols-2 gap-4">
            <AsyncSelect
              type="programs"
              label="Program"
              required
              value={formik.values.program}
              onChange={(value) => formik.setFieldValue('program', value ?? '')}
            />
            <AsyncSelect
              type="academicYears"
              label="Academic Year"
              required
              value={formik.values.academicYear}
              onChange={(value) => {
                formik.setFieldValue('academicYear', value ?? '');
                formik.setFieldValue('sectionId', '');
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <AsyncSelect
              type="subjects"
              label="Subject"
              required
              value={formik.values.subjectId}
              params={{
                sectionId: formik.values.sectionId,
                departmentId: formik.values.departmentId,
              }}
              disabled={!formik.values.sectionId}
              onChange={(value, option) => {
                formik.setFieldValue('subjectId', value ?? '');
                formik.setFieldValue('subjectCode', option?.sub?.split(' · ')[0] ?? '');
                formik.setFieldValue('subjectName', option?.label ?? '');
              }}
            />
            <AsyncSelect
              type="faculty"
              label="Evaluator / Invigilator"
              required
              value={formik.values.evaluatorId}
              params={{ departmentId: formik.values.departmentId }}
              disabled={!formik.values.departmentId}
              onChange={(value) => formik.setFieldValue('evaluatorId', value ?? '')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Exam Date *</label>
              <input
                type="date"
                name="examDate"
                value={formik.values.examDate}
                onChange={formik.handleChange}
                className={inputCls}
              />
            </div>
            <AsyncSelect
              type="facilitySpaces"
              label="Exam Venue"
              required
              value={formik.values.venueId || null}
              onChange={(venueId, option) => {
                formik.setFieldValue('venueId', venueId ?? '');
                formik.setFieldValue('venue', option?.label.split(' — ')[0] ?? '');
              }}
              placeholder={formik.values.venue ? `Current: ${formik.values.venue}` : 'Search hall…'}
              error={formik.touched.venue ? formik.errors.venue : undefined}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Start Time *</label>
              <input
                type="time"
                name="startTime"
                value={formik.values.startTime}
                onChange={formik.handleChange}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>End Time</label>
              <input
                type="time"
                name="endTime"
                value={formik.values.endTime}
                onChange={formik.handleChange}
                className={inputCls}
              />
            </div>
          </div>
          <p className="rounded-xl bg-primary-50 p-3 text-xs text-slate-600">
            Maximum and passing marks are taken from the selected subject master.
          </p>
          <div className="rounded-xl border border-slate-100 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-700">Additional exam subjects</p>
                <p className="text-[11px] text-slate-600">
                  Build the complete section timetable before saving.
                </p>
              </div>
              <CustomButton
                type="button"
                variant="tertiary"
                disabled={
                  !formik.values.subjectId ||
                  !formik.values.examDate ||
                  !formik.values.startTime ||
                  !formik.values.endTime ||
                  !formik.values.evaluatorId
                }
                onClick={() => {
                  if (
                    additionalSubjects?.some(
                      (subject) => String(subject.subjectId) === formik.values.subjectId,
                    )
                  ) {
                    toast.error('This subject is already in the schedule');
                    return;
                  }
                  setAdditionalSubjects((current) => [
                    ...(current ?? []),
                    {
                      subjectId: formik.values.subjectId,
                      subjectCode: formik.values.subjectCode,
                      subjectName: formik.values.subjectName,
                      examDate: formik.values.examDate,
                      startTime: formik.values.startTime,
                      endTime: formik.values.endTime,
                      venueId: formik.values.venueId,
                      venue: formik.values.venue,
                      invigilators: [formik.values.evaluatorId],
                      maxMarks: formik.values.totalMarks,
                      passMarks: formik.values.passingMarks,
                    },
                  ]);
                  formik.setFieldValue('subjectId', '');
                  formik.setFieldValue('subjectCode', '');
                  formik.setFieldValue('subjectName', '');
                }}
                className="w-fit!"
              >
                Add Another Subject
              </CustomButton>
            </div>
            {!!additionalSubjects?.length && (
              <div className="mt-3 space-y-2">
                {additionalSubjects.map((subject, index) => (
                  <div
                    key={`${String(subject.subjectId)}-${index}`}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <span className="text-xs text-slate-600">
                      {subject.subjectCode} · {fmtDate(subject.examDate)} · {subject.startTime}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setAdditionalSubjects((current) =>
                          current?.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      className="text-xs font-medium text-red-500"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton variant="primary" type="submit" loading={isLoading}>
              Save Schedule
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Marks Entry Panel ────────────────────────────────────────────────────────
function MarksEntryPanel({ isAdmin }: { isAdmin: boolean }) {
  const { mutation, isLoading } = useMutation();
  const { data: schedulesRaw } = useSwr('examination/schedules');
  const schedules: ISchedule[] = (schedulesRaw as { data?: ISchedule[] })?.data ?? [];
  const { data: pendingRaw, mutate: mutatePending } = useSwr(
    isAdmin ? 'examination/marks/pending-verification' : null,
  );
  const pendingMarks: IPendingMark[] = (pendingRaw as { data?: IPendingMark[] })?.data ?? [];
  const [selectedMarks, setSelectedMarks] = useState<string[]>([]);
  const formik = useFormik<IMarkEntry>({
    initialValues: {
      scheduleId: '',
      studentId: '',
      rollNumber: '',
      subjectId: '',
      subjectCode: '',
      semester: 1,
      examType: 'Mid Semester 1',
      internalTotal: 0,
      internalMax: 30,
      externalMarks: 0,
      externalMax: 70,
      isAbsent: false,
      academicYear: '',
    },
    validationSchema: Yup.object({
      scheduleId: Yup.string().trim().required('Select a completed exam schedule'),
      studentId: Yup.string().trim().required('Select a student'),
      rollNumber: Yup.string().trim().required('Student roll number is required'),
      subjectId: Yup.string().trim().required('Select a scheduled subject'),
      subjectCode: Yup.string().trim().required(),
      semester: Yup.number().min(1).max(8).required(),
      examType: Yup.string().required(),
      internalTotal: Yup.number().min(0).required(),
      internalMax: Yup.number().min(1).required(),
      externalMarks: Yup.number().min(0).required(),
      externalMax: Yup.number().min(1).required(),
      academicYear: Yup.string().trim().required(),
    }),
    onSubmit: async (values) => {
      // Backend accepts an array or { marks: [...] }; send array of one entry.
      const res = await mutation('examination/marks', {
        method: 'POST',
        body: { marks: [values] },
        isAlert: true,
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Marks saved');
        formik.resetForm();
        mutatePending();
      } else toast.error('Failed');
    },
  });
  const selectedSchedule = schedules.find((schedule) => schedule._id === formik.values.scheduleId);

  const verifySelected = async () => {
    if (!selectedMarks.length) return;
    const res = await mutation('examination/marks/verify', {
      method: 'POST',
      body: { markIds: selectedMarks },
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success(`${selectedMarks.length} marks record(s) verified`);
      setSelectedMarks([]);
      mutatePending();
    }
  };

  return (
    <div className="space-y-4">
      <div className="max-w-3xl space-y-4 rounded-2xl bg-white p-6">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Enter Governed Marks</h2>
          <p className="mt-1 text-xs text-slate-500">
            Select a completed schedule first; subject and maximum marks stay tied to that exam.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelCls}>Completed Exam Schedule *</label>
            <select
              name="scheduleId"
              value={formik.values.scheduleId}
              onChange={(event) => {
                const schedule = schedules.find((item) => item._id === event.target.value);
                formik.setValues({
                  ...formik.values,
                  scheduleId: event.target.value,
                  subjectId: '',
                  subjectCode: '',
                  examType: schedule?.examType ?? 'Mid Semester 1',
                  semester: schedule?.semester ?? 1,
                  academicYear: schedule?.academicYear ?? '',
                });
              }}
              className={inputCls}
            >
              <option value="">Select completed schedule</option>
              {schedules
                .filter((schedule) => String(schedule.status).toLowerCase() === 'completed')
                .map((schedule) => (
                  <option key={schedule._id} value={schedule._id}>
                    {schedule.title ?? schedule.examType} · Sem {schedule.semester} ·{' '}
                    {schedule.academicYear}
                  </option>
                ))}
            </select>
          </div>
          <AsyncSelect
            type="students"
            label="Student"
            required
            value={formik.values.studentId}
            onChange={(value, option) => {
              formik.setFieldValue('studentId', value ?? '');
              formik.setFieldValue('rollNumber', option?.sub?.split(' · ')[0] ?? '');
            }}
            placeholder="Search student name or roll number"
            error={formik.touched.studentId ? formik.errors.studentId : undefined}
          />
          <div>
            <label className={labelCls}>Scheduled Subject *</label>
            <select
              name="subjectId"
              value={formik.values.subjectId}
              disabled={!selectedSchedule}
              onChange={(event) => {
                const subject = selectedSchedule?.subjects?.find(
                  (item) => String(item.subjectId) === event.target.value,
                );
                formik.setFieldValue('subjectId', event.target.value);
                formik.setFieldValue('subjectCode', subject?.subjectCode ?? '');
                formik.setFieldValue('externalMax', subject?.maxMarks ?? 70);
              }}
              className={inputCls}
            >
              <option value="">Select subject</option>
              {selectedSchedule?.subjects?.map((subject) => (
                <option key={String(subject.subjectId)} value={String(subject.subjectId)}>
                  {subject.subjectCode} · {subject.subjectName}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Exam Type *</label>
            <input value={formik.values.examType.replace('_', ' ')} disabled className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Semester *</label>
            <input value={formik.values.semester} disabled className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className={labelCls}>Internal Marks *</label>
            <input
              type="number"
              name="internalTotal"
              min={0}
              max={formik.values.internalMax}
              value={formik.values.internalTotal}
              onChange={formik.handleChange}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Internal Maximum *</label>
            <input
              type="number"
              name="internalMax"
              min={1}
              value={formik.values.internalMax}
              onChange={formik.handleChange}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>External Marks *</label>
            <input
              type="number"
              name="externalMarks"
              min={0}
              max={formik.values.externalMax}
              value={formik.values.externalMarks}
              onChange={formik.handleChange}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>External Maximum *</label>
            <input value={formik.values.externalMax} disabled className={inputCls} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            name="isAbsent"
            checked={formik.values.isAbsent}
            onChange={formik.handleChange}
          />
          Student was absent for the external examination
        </label>
        <CustomButton variant="primary" loading={isLoading} onClick={() => formik.handleSubmit()}>
          Save Marks
        </CustomButton>
      </div>
      {isAdmin && (
        <div className="rounded-2xl bg-white p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Pending verification</h2>
              <p className="mt-1 text-xs text-slate-500">
                Independent verification is required before semester results can be compiled.
              </p>
            </div>
            <CustomButton
              variant="primary"
              disabled={!selectedMarks.length}
              loading={isLoading}
              onClick={verifySelected}
              className="w-fit!"
            >
              Verify selected ({selectedMarks.length})
            </CustomButton>
          </div>
          <div className="mt-4 space-y-2">
            {pendingMarks.map((mark) => {
              const studentName =
                typeof mark.studentId === 'object' ? mark.studentId.name : undefined;
              const enteredBy =
                typeof mark.enteredBy === 'object' ? mark.enteredBy.name : undefined;
              return (
                <label
                  key={mark._id}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 p-3 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selectedMarks.includes(mark._id)}
                    onChange={(event) =>
                      setSelectedMarks((current) =>
                        event.target.checked
                          ? [...current, mark._id]
                          : current.filter((id) => id !== mark._id),
                      )
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800">
                      {studentName ?? mark.rollNumber} · {mark.subjectCode}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {mark.examType} · {mark.internalTotal} internal + {mark.externalMarks}{' '}
                      external = {mark.totalMarks} · Entered by {enteredBy ?? 'staff'}
                    </span>
                  </span>
                </label>
              );
            })}
            {!pendingMarks.length && (
              <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">
                No marks are waiting for verification.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Results Panel ─────────────────────────────────────────────────────────────
function ResultsPanel({ isAdmin }: { isAdmin: boolean }) {
  interface IResultFilters {
    academicYear: string;
    program: string;
    departmentId: string;
    batchId: string;
    semester: string;
  }

  const emptyFilters: IResultFilters = {
    academicYear: '',
    program: '',
    departmentId: '',
    batchId: '',
    semester: '',
  };
  const [filters, setFilters] = useState<IResultFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<IResultFilters | null>(null);
  const resultUrl = appliedFilters
    ? `examination/results?${new URLSearchParams({ ...appliedFilters, limit: '500' }).toString()}`
    : null;
  const { data: raw, isLoading, mutate } = useSwr(resultUrl);
  const results: IResult[] = (raw as { data?: IResult[] })?.data ?? [];
  const { mutation, isLoading: compiling } = useMutation();
  const [compileSem, setCompileSem] = useState('');
  const [compileYear, setCompileYear] = useState('');
  const [compileStudentId, setCompileStudentId] = useState('');

  const allFiltersSelected = Object.values(filters).every(Boolean);
  const hasSelectedFilters = Object.values(filters).some(Boolean);

  const updateFilter = (field: keyof IResultFilters, value: string) => {
    setAppliedFilters(null);
    setFilters((current) => {
      if (field === 'academicYear') {
        return { ...emptyFilters, academicYear: value };
      }
      if (field === 'program') {
        return { ...current, program: value, departmentId: '', batchId: '', semester: '' };
      }
      if (field === 'departmentId') {
        return { ...current, departmentId: value, batchId: '', semester: '' };
      }
      if (field === 'batchId') return { ...current, batchId: value, semester: '' };
      return { ...current, [field]: value };
    });
  };

  const handleCompile = async () => {
    if (!compileStudentId || !compileSem || !compileYear) {
      toast.error('Select student, semester and academic year first');
      return;
    }
    const r = await Swal.fire({
      title: 'Compile this student result?',
      text: `Semester ${compileSem} · ${compileYear}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Compile',
      confirmButtonColor: '#0178D7',
    });
    if (!r.isConfirmed) return;
    const res = await mutation('examination/results/compile', {
      method: 'POST',
      body: {
        studentId: compileStudentId,
        semester: Number(compileSem),
        academicYear: compileYear,
      },
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success)
      toast.success('Result compiled and ready for verification');
    mutate();
  };

  const handlePublish = async () => {
    if (!compileSem || !compileYear) {
      toast.error('Select semester & academic year first');
      return;
    }
    const r = await Swal.fire({
      title: 'Publish Results?',
      text: `Sem ${compileSem} · AY ${compileYear}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Publish',
      confirmButtonColor: '#0178D7',
    });
    if (!r.isConfirmed) return;
    const res = await mutation('examination/results/publish', {
      method: 'POST',
      body: { semester: Number(compileSem), academicYear: compileYear },
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Results published!');
      mutate();
    } else toast.error('Failed');
  };

  const columns: Column<IResult>[] = [
    {
      field: 'rollNumber',
      title: 'Roll No',
      render: (row) => (
        <span className="text-sm font-mono">{String(row.rollNumber ?? row.rollNo ?? '—')}</span>
      ),
    },
    {
      field: 'studentName',
      title: 'Student',
      render: (row) => (
        <span className="text-sm">{row.studentName || 'Student record unavailable'}</span>
      ),
    },
    {
      field: 'semester',
      title: 'Sem',
      render: (row) => <span className="text-sm">{row.semester}</span>,
    },
    {
      field: 'sgpa',
      title: 'SGPA',
      render: (row) => (
        <span className="text-sm font-bold text-primary">{row.sgpa.toFixed(2)}</span>
      ),
    },
    {
      field: 'totalCreditsEarned',
      title: 'Credits',
      render: (row) => (
        <span className="text-sm">
          {row.totalCreditsEarned}/{row.totalCreditsRegistered}
        </span>
      ),
    },
    {
      field: 'result',
      title: 'Result',
      render: (row) => (
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold">{row.result}</span>
      ),
    },
    {
      field: 'isPublished',
      title: 'Published',
      render: (row) =>
        row.isPublished ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <XCircle className="h-4 w-4 text-slate-300" />
        ),
    },
  ];

  const actions: Action<IResult>[] = [
    {
      tooltip: 'Download Marksheet',
      icon: <Download className="h-4 w-4 text-primary" />,
      onClick: async (row) => {
        const sem = compileSem || String(row.semester);
        const year = compileYear || (row as { academicYear?: string }).academicYear;
        if (!year) {
          toast.error('Set academic year (sem & year required for marksheet)');
          return;
        }
        const q = new URLSearchParams({ semester: String(sem), academicYear: year });
        const ok = await downloadPdf(
          `examination/results/student/${row.studentId}/marksheet?${q.toString()}`,
          `marksheet-${row.rollNumber ?? row.studentId}-sem${sem}.pdf`,
        );
        if (!ok) toast.error('Failed to download marksheet');
      },
    },
    {
      tooltip: 'Download Transcript',
      icon: <Download className="h-4 w-4 text-emerald-600" />,
      onClick: async (row) => {
        const ok = await downloadPdf(
          `examination/results/student/${row.studentId}/transcript`,
          `transcript-${row.rollNumber ?? row.studentId}.pdf`,
        );
        if (!ok) toast.error('Failed to download transcript');
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Choose the academic result scope</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Select every field to load only the students from that session, programme, department,
              batch and semester.
            </p>
          </div>
          {appliedFilters && (
            <span className="mt-2 w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 sm:mt-0">
              {results.length} result{results.length === 1 ? '' : 's'} loaded
            </span>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <AsyncSelect
            type="academicYears"
            label="Session"
            required
            placeholder="Select session"
            value={filters.academicYear || null}
            onChange={(value) => updateFilter('academicYear', value ?? '')}
          />
          <AsyncSelect
            type="programs"
            label="Programme"
            required
            disabled={!filters.academicYear}
            placeholder={filters.academicYear ? 'Select programme' : 'Select session first'}
            value={filters.program || null}
            onChange={(value) => updateFilter('program', value ?? '')}
          />
          <AsyncSelect
            type="departments"
            label="Department"
            required
            disabled={!filters.program}
            params={{ program: filters.program }}
            placeholder={filters.program ? 'Select department' : 'Select programme first'}
            value={filters.departmentId || null}
            onChange={(value) => updateFilter('departmentId', value ?? '')}
          />
          <AsyncSelect
            type="batches"
            label="Batch"
            required
            disabled={!filters.departmentId}
            params={{
              master: true,
              program: filters.program,
              departmentId: filters.departmentId,
            }}
            placeholder={filters.departmentId ? 'Select batch' : 'Select department first'}
            value={filters.batchId || null}
            onChange={(value) => updateFilter('batchId', value ?? '')}
          />
          <AsyncSelect
            type="semesters"
            label="Semester"
            required
            disabled={!filters.batchId}
            params={{
              configured: true,
              academicYear: filters.academicYear,
              program: filters.program,
              departmentId: filters.departmentId,
            }}
            placeholder={filters.batchId ? 'Select semester' : 'Select batch first'}
            value={filters.semester || null}
            onChange={(value) => updateFilter('semester', value ?? '')}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <CustomButton
            variant="primary"
            startIcon={<BarChart2 className="h-4 w-4" />}
            disabled={!allFiltersSelected}
            onClick={() => setAppliedFilters(filters)}
          >
            View Results
          </CustomButton>
          {hasSelectedFilters && (
            <CustomButton
              variant="secondary"
              onClick={() => {
                setFilters(emptyFilters);
                setAppliedFilters(null);
              }}
            >
              Clear Filters
            </CustomButton>
          )}
        </div>
      </div>
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3">
          <div className="min-w-40">
            <AsyncSelect
              type="students"
              placeholder="Select student…"
              value={compileStudentId || null}
              onChange={(value) => setCompileStudentId(value ?? '')}
            />
          </div>
          <div className="min-w-40">
            <AsyncSelect
              type="semesters"
              placeholder="Semester…"
              value={compileSem || null}
              onChange={(v) => setCompileSem(v ?? '')}
            />
          </div>
          <AsyncSelect
            type="academicYears"
            placeholder="Academic year…"
            value={compileYear || null}
            onChange={(value) => setCompileYear(value ?? '')}
            className="min-w-40"
          />
          <CustomButton
            variant="secondary"
            startIcon={<RefreshCw className="h-4 w-4" />}
            onClick={handleCompile}
            loading={compiling}
          >
            Compile Results
          </CustomButton>
          <CustomButton
            variant="primary"
            startIcon={<Send className="h-4 w-4" />}
            onClick={handlePublish}
            loading={compiling}
          >
            Publish Results
          </CustomButton>
        </div>
      )}
      {appliedFilters ? (
        <div className="overflow-hidden rounded-2xl bg-white">
          <CustomTable
            data={results}
            columns={columns}
            actions={actions}
            isLoading={isLoading}
            options={{ search: true, pagination: true, pageSize: 15 }}
            localization={{
              toolbar: { searchPlaceholder: 'Search within the selected result scope…' },
              body: { emptyDataSourceMessage: 'No results exist for the selected academic scope.' },
            }}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <Empty
            title="Student results are not loaded yet"
            subTitle="Complete the academic filters above, then select View Results."
          />
        </div>
      )}
    </div>
  );
}

// ─── Rank List ────────────────────────────────────────────────────────────────
function RankListPanel() {
  interface IRankFilters {
    academicYear: string;
    program: string;
    departmentId: string;
    batchId: string;
    semester: string;
  }

  const emptyRankFilters: IRankFilters = {
    academicYear: '',
    program: '',
    departmentId: '',
    batchId: '',
    semester: '',
  };
  const [filters, setFilters] = useState<IRankFilters>(emptyRankFilters);
  const [appliedFilters, setAppliedFilters] = useState<IRankFilters | null>(null);
  const allFiltersSelected = Object.values(filters).every(Boolean);
  const hasSelectedFilters = Object.values(filters).some(Boolean);
  const url = appliedFilters
    ? `examination/results/ranklist?${new URLSearchParams({ ...appliedFilters }).toString()}`
    : null;
  const { data: raw, isLoading } = useSwr(url);
  const ranks: IRankEntry[] = ((raw as { data?: IRankEntry[] })?.data ?? []).map((row, index) => ({
    ...row,
    rank: index + 1,
  }));

  const updateFilter = (field: keyof IRankFilters, value: string) => {
    setAppliedFilters(null);
    setFilters((current) => {
      if (field === 'academicYear') return { ...emptyRankFilters, academicYear: value };
      if (field === 'program') {
        return { ...current, program: value, departmentId: '', batchId: '', semester: '' };
      }
      if (field === 'departmentId') {
        return { ...current, departmentId: value, batchId: '', semester: '' };
      }
      if (field === 'batchId') return { ...current, batchId: value, semester: '' };
      return { ...current, [field]: value };
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-slate-800">Choose the rank-list scope</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Rankings are calculated only within the selected academic group.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <AsyncSelect
            type="academicYears"
            label="Session"
            required
            placeholder="Select session"
            value={filters.academicYear || null}
            onChange={(value) => updateFilter('academicYear', value ?? '')}
          />
          <AsyncSelect
            type="programs"
            label="Programme"
            required
            disabled={!filters.academicYear}
            placeholder={filters.academicYear ? 'Select programme' : 'Select session first'}
            value={filters.program || null}
            onChange={(value) => updateFilter('program', value ?? '')}
          />
          <AsyncSelect
            type="departments"
            label="Department"
            required
            disabled={!filters.program}
            params={{ program: filters.program }}
            placeholder={filters.program ? 'Select department' : 'Select programme first'}
            value={filters.departmentId || null}
            onChange={(value) => updateFilter('departmentId', value ?? '')}
          />
          <AsyncSelect
            type="batches"
            label="Batch"
            required
            disabled={!filters.departmentId}
            params={{ master: true, program: filters.program, departmentId: filters.departmentId }}
            placeholder={filters.departmentId ? 'Select batch' : 'Select department first'}
            value={filters.batchId || null}
            onChange={(value) => updateFilter('batchId', value ?? '')}
          />
          <AsyncSelect
            type="semesters"
            label="Semester"
            required
            disabled={!filters.batchId}
            params={{
              configured: true,
              academicYear: filters.academicYear,
              program: filters.program,
              departmentId: filters.departmentId,
            }}
            placeholder={filters.batchId ? 'Select semester' : 'Select batch first'}
            value={filters.semester || null}
            onChange={(value) => updateFilter('semester', value ?? '')}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <CustomButton
            variant="primary"
            startIcon={<Trophy className="h-4 w-4" />}
            disabled={!allFiltersSelected}
            onClick={() => setAppliedFilters(filters)}
          >
            View Rank List
          </CustomButton>
          {hasSelectedFilters && (
            <CustomButton
              variant="secondary"
              onClick={() => {
                setFilters(emptyRankFilters);
                setAppliedFilters(null);
              }}
            >
              Clear Filters
            </CustomButton>
          )}
        </div>
      </div>
      {!url && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <Empty
            title="Rank list is not loaded yet"
            subTitle="Select the academic scope above, then choose View Rank List."
          />
        </div>
      )}
      {url && (
        <div className="overflow-hidden rounded-2xl bg-white">
          <CustomTable
            data={ranks}
            columns={
              [
                {
                  field: 'rank',
                  title: '#',
                  render: (row) => (
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        row.rank === 1
                          ? 'bg-amber-400 text-white'
                          : row.rank === 2
                            ? 'bg-slate-300 text-slate-800'
                            : row.rank === 3
                              ? 'bg-orange-300 text-white'
                              : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {row.rank}
                    </span>
                  ),
                },
                {
                  field: 'rollNumber',
                  title: 'Roll No',
                  render: (row) => (
                    <span className="text-sm font-mono">
                      {String(row.rollNumber ?? row.rollNo ?? '—')}
                    </span>
                  ),
                },
                {
                  field: 'studentName',
                  title: 'Student',
                  render: (row) => (
                    <span className="text-sm font-medium">{String(row.studentName ?? '—')}</span>
                  ),
                },
                {
                  field: 'cgpa',
                  title: 'CGPA',
                  render: (row) => <span className="text-sm">{row.cgpa.toFixed(2)}</span>,
                },
                {
                  field: 'sgpa',
                  title: 'SGPA',
                  render: (row) => (
                    <span className="text-sm font-bold text-green-600">{row.sgpa.toFixed(2)}</span>
                  ),
                },
              ] satisfies Column<IRankEntry>[]
            }
            isLoading={isLoading}
            options={{ search: true, pagination: true, pageSize: 20 }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Hall Ticket ──────────────────────────────────────────────────────────────
function HallTicketPanel() {
  const [busy, setBusy] = useState(false);
  const [studentId, setStudentId] = useState('');
  const { data: schedulesRaw } = useSwr('examination/schedules');
  const schedules: ISchedule[] = (schedulesRaw as { data?: ISchedule[] })?.data ?? [];
  const formik = useFormik({
    initialValues: {
      scheduleId: '',
      studentName: '',
      fatherName: '',
      rollNumber: '',
      enrollmentNumber: '',
      bputExamRoll: '',
      program: '',
      branch: '',
      semester: 1,
      academicYear: '',
      examType: 'End Semester',
      examCentre: '',
      subjects: [] as Array<{
        code: string;
        name: string;
        date: string;
        time: string;
        duration: string;
      }>,
    },
    validationSchema: Yup.object({
      rollNumber: Yup.string().required(),
      scheduleId: Yup.string().required('Select an examination schedule'),
      academicYear: Yup.string().required(),
    }),
    onSubmit: async (values) => {
      setBusy(true);
      const blob = await fetchPdf('examination/hall-ticket', {
        method: 'POST',
        body: values,
      });
      setBusy(false);
      if (!blob) {
        toast.error('Failed to generate hall ticket');
        return;
      }
      downloadPdfBlob(blob, `hall-ticket-${values.rollNumber}.pdf`);
      toast.success('Hall ticket downloaded');
    },
  });

  return (
    <div className="max-w-2xl space-y-4 rounded-2xl bg-white p-6">
      <h2 className="text-base font-semibold text-slate-900">Generate Hall Ticket</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AsyncSelect
          type="students"
          label="Student"
          required
          value={studentId}
          onChange={(value, option) => {
            setStudentId(value ?? '');
            formik.setFieldValue('studentName', option?.label ?? '');
            formik.setFieldValue('rollNumber', option?.sub?.split(' · ')[0] ?? '');
          }}
          placeholder="Search student name or roll number"
        />
        <div>
          <label className={labelCls}>Examination Schedule *</label>
          <select
            className={inputCls}
            value={formik.values.scheduleId}
            onChange={(event) => {
              const schedule = schedules.find((item) => item._id === event.target.value);
              formik.setFieldValue('scheduleId', event.target.value);
              formik.setFieldValue('semester', schedule?.semester ?? 1);
              formik.setFieldValue('academicYear', schedule?.academicYear ?? '');
              formik.setFieldValue('examType', schedule?.examType ?? 'End Semester');
            }}
          >
            <option value="">Select schedule</option>
            {schedules.map((schedule) => (
              <option key={schedule._id} value={schedule._id}>
                {schedule.title ?? schedule.examType} · Sem {schedule.semester} ·{' '}
                {schedule.academicYear}
              </option>
            ))}
          </select>
        </div>
        <p className="rounded-xl bg-primary-50 p-3 text-xs text-slate-600 sm:col-span-2">
          Student identity, registered subjects, dates, timings and venue are loaded automatically.
          Eligibility is checked against semester registration, fees and attendance.
        </p>
      </div>
      <CustomButton
        variant="primary"
        loading={busy}
        onClick={() => formik.handleSubmit()}
        startIcon={<FileText className="h-4 w-4" />}
      >
        Generate Hall Ticket
      </CustomButton>
    </div>
  );
}

// ─── Seating Plan ─────────────────────────────────────────────────────────────
function SeatingPanel() {
  const { data: rawSchedules } = useSwr('examination/schedules');
  const schedules: ISchedule[] = (rawSchedules as { data?: ISchedule[] })?.data ?? [];
  const { mutation, isLoading } = useMutation();
  const [selectedId, setSelectedId] = useState('');
  const [summary, setSummary] = useState<{ totalStudents: number; assignedSeats: number } | null>(
    null,
  );

  const handleGenerate = async () => {
    if (!selectedId) {
      toast.error('Select a schedule');
      return;
    }
    const res = await mutation(`examination/schedules/${selectedId}/seating`, {
      method: 'POST',
      body: {},
      isAlert: true,
    });
    const payload = (
      res as {
        results?: {
          success?: boolean;
          data?: { totalStudents?: number; seatingMap?: unknown[] };
        };
      }
    )?.results;
    if (payload?.success) {
      const totalStudents = payload.data?.totalStudents ?? 0;
      const assignedSeats = payload.data?.seatingMap?.length ?? 0;
      setSummary({ totalStudents, assignedSeats });
      toast.success(`Seating assigned for ${assignedSeats} students`);
    } else toast.error('Failed');
  };

  return (
    <div className="max-w-sm space-y-4 rounded-2xl bg-white p-6">
      <h2 className="text-base font-semibold text-slate-900">Generate Seating Plan</h2>
      <div>
        <label className={labelCls}>Select Schedule *</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className={inputCls}
        >
          <option value="">-- Select --</option>
          {schedules.map((s) => (
            <option key={s._id} value={s._id}>
              {s.title ?? s.examType} — Sem {s.semester} · {s.academicYear}
            </option>
          ))}
        </select>
      </div>
      <CustomButton
        variant="primary"
        loading={isLoading}
        onClick={handleGenerate}
        startIcon={<Layers className="h-4 w-4" />}
      >
        Generate Seating
      </CustomButton>
      {summary && (
        <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
          <p className="font-semibold">Seating plan ready</p>
          <p className="mt-1 text-xs">
            {summary.assignedSeats} of {summary.totalStudents} eligible students have assigned
            seats.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Recheck Panel ────────────────────────────────────────────────────────────
function RecheckPanel({ isAdmin, isStudent }: { isAdmin: boolean; isStudent: boolean }) {
  const { user } = useAuthStore();
  const [filters, setFilters] = useState({
    academicYear: '',
    semester: '',
    requestType: '',
    status: '',
    feePaid: '',
  });
  const filterQuery = new URLSearchParams({
    limit: '500',
    ...(filters.academicYear ? { academicYear: filters.academicYear } : {}),
    ...(filters.semester ? { semester: filters.semester } : {}),
    ...(filters.requestType ? { requestType: filters.requestType } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.feePaid ? { feePaid: filters.feePaid } : {}),
  }).toString();
  const {
    data: raw,
    isLoading,
    isValidating,
    mutate,
  } = useSwr(`examination/recheck${isStudent ? '/my' : ''}?${filterQuery}`);
  const requests: IRecheckRequest[] = (raw as { data?: IRecheckRequest[] })?.data ?? [];
  const { mutation, isLoading: processing } = useMutation();
  const { data: publishedRaw } = useSwr(
    isStudent && user?._id ? `examination/results/student/${user._id}` : null,
  );
  const publishedResults: IResult[] =
    (publishedRaw as { data?: IResult[] } | undefined)?.data ?? [];

  const [showForm, setShowForm] = useState(false);
  const hasFilters = Object.values(filters).some(Boolean);
  const formik = useFormik({
    initialValues: {
      academicYear: '',
      subjectCode: '',
      semester: 1,
      requestType: 'recheck' as 'recheck' | 'revaluation',
      reason: '',
    },
    validationSchema: Yup.object({
      academicYear: Yup.string().trim().required('Academic Year required'),
      subjectCode: Yup.string().trim().required(),
      semester: Yup.number().min(1).max(8).required(),
      requestType: Yup.string().oneOf(['recheck', 'revaluation']).required(),
      reason: Yup.string().trim().required('Reason required'),
    }),
    onSubmit: async (values) => {
      const result = publishedResults.find(
        (item) =>
          item.semester === Number(values.semester) && item.academicYear === values.academicYear,
      );
      const subject = result?.subjectResults.find(
        (item) => item.subjectCode === values.subjectCode,
      );
      const res = await mutation('examination/recheck', {
        method: 'POST',
        body: {
          ...values,
          subjectName: subject?.subjectName ?? subject?.subjectCode ?? values.subjectCode,
          currentMarks: subject?.externalMarks ?? 0,
        },
        isAlert: true,
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Recheck request submitted');
        mutate();
        setShowForm(false);
        formik.resetForm();
      } else toast.error('Failed');
    },
  });

  const handleReview = async (
    req: IRecheckRequest,
    status: 'marks_updated' | 'no_change' | 'rejected',
  ) => {
    const prompt = await Swal.fire({
      title:
        status === 'marks_updated'
          ? 'Record revised marks'
          : status === 'no_change'
            ? 'Complete with no change'
            : 'Reject request',
      input: 'textarea',
      inputLabel: 'Review notes',
      inputPlaceholder: 'Document the verification performed',
      inputValidator: (value) =>
        value.trim().length < 5 ? 'Review notes must contain at least 5 characters' : undefined,
      showCancelButton: true,
      confirmButtonText: 'Continue',
      confirmButtonColor: status === 'rejected' ? '#dc2626' : '#0178D7',
    });
    if (!prompt.isConfirmed) return;
    let revisedMarks: number | undefined;
    if (status === 'marks_updated') {
      const marksPrompt = await Swal.fire({
        title: 'Revised marks',
        input: 'number',
        inputAttributes: { min: '0', step: '0.01' },
        showCancelButton: true,
        inputValidator: (value) =>
          value === '' || Number(value) < 0 ? 'Enter valid revised marks' : undefined,
      });
      if (!marksPrompt.isConfirmed) return;
      revisedMarks = Number(marksPrompt.value);
    }
    const res = await mutation(`examination/recheck/${req._id}/review`, {
      method: 'PUT',
      body: { status, reviewNotes: prompt.value.trim(), revisedMarks },
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Updated');
      mutate();
    } else toast.error('Failed');
  };

  const STATUS_COLOR: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-600',
    under_review: 'bg-blue-50 text-blue-600',
    marks_updated: 'bg-green-50 text-green-600',
    no_change: 'bg-slate-100 text-slate-600',
    rejected: 'bg-red-50 text-red-500',
    completed: 'bg-blue-50 text-blue-600',
  };

  const columns: Column<IRecheckRequest>[] = [
    {
      field: 'studentName',
      title: 'Student',
      render: (row) => (
        <span className="text-sm">
          {row.studentName ||
            (typeof row.studentId === 'object' ? row.studentId.name : undefined) ||
            'Student record unavailable'}
        </span>
      ),
    },
    {
      field: 'subjectCode',
      title: 'Subject',
      render: (row) => <span className="text-sm font-mono">{row.subjectCode}</span>,
    },
    {
      field: 'semester',
      title: 'Sem',
      render: (row) => <span className="text-sm">{row.semester}</span>,
    },
    {
      field: 'examType',
      title: 'Exam',
      render: (row) => (
        <span className="text-xs capitalize">{String(row.examType).replace('_', ' ')}</span>
      ),
    },
    {
      field: 'reason',
      title: 'Reason',
      render: (row) => <span className="text-xs text-slate-500 line-clamp-1">{row.reason}</span>,
    },
    {
      field: 'status',
      title: 'Status',
      render: (row) => (
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLOR[row.status] ?? 'bg-slate-100 text-slate-500'}`}
        >
          {row.status}
        </span>
      ),
    },
    {
      field: 'createdAt',
      title: 'Requested',
      render: (row) => <span className="text-xs text-slate-600">{fmtDate(row.createdAt)}</span>,
    },
  ];

  const actions: Action<IRecheckRequest>[] = isAdmin
    ? [
        {
          tooltip: 'Update Marks',
          icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
          onClick: (r) => handleReview(r, 'marks_updated'),
          hidden: (r) => r.status !== 'under_review',
        },
        {
          tooltip: 'No Change',
          icon: <CheckCircle2 className="h-4 w-4 text-blue-500" />,
          onClick: (r) => handleReview(r, 'no_change'),
          hidden: (r) => r.status !== 'under_review',
        },
        {
          tooltip: 'Reject',
          icon: <XCircle className="h-4 w-4 text-red-400" />,
          onClick: (r) => handleReview(r, 'rejected'),
          hidden: (r) => r.status !== 'under_review',
        },
        {
          tooltip: 'Mark Fee Paid',
          icon: <CheckCircle2 className="h-4 w-4 text-amber-500" />,
          onClick: async (r) => {
            const conf = await Swal.fire({
              title: 'Mark recheck fee as paid?',
              text: `${r.subjectCode} — ${r.studentName ?? ''}`,
              icon: 'question',
              showCancelButton: true,
              confirmButtonText: 'Confirm',
              confirmButtonColor: '#0178D7',
            });
            if (!conf.isConfirmed) return;
            const res = await mutation(`examination/recheck/${r._id}/fee-paid`, {
              method: 'PUT',
              body: {},
              isAlert: true,
            });
            if ((res as { data?: { success?: boolean } })?.data?.success !== false) {
              toast.success('Fee marked as paid');
              mutate();
            } else toast.error('Failed');
          },
          hidden: (r) => r.status !== 'pending' || r.feePaid === true,
        },
      ]
    : [];

  return (
    <div className="space-y-4">
      {isStudent && (
        <div>
          <CustomButton
            variant="secondary"
            startIcon={<Plus className="h-4 w-4" />}
            onClick={() => setShowForm(!showForm)}
            className="w-fit!"
          >
            Request Recheck
          </CustomButton>
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-3"
              >
                <div className="max-w-md space-y-4 rounded-2xl bg-white p-5">
                  <p className="rounded-xl bg-primary-50 p-3 text-xs text-slate-600">
                    Choose one published result and subject. Your identity and recorded marks are
                    verified automatically.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Published Result *</label>
                      <select
                        className={inputCls}
                        value={`${formik.values.semester}|${formik.values.academicYear}`}
                        onChange={(event) => {
                          const [semester, academicYear] = event.target.value.split('|');
                          formik.setFieldValue('semester', Number(semester || 1));
                          formik.setFieldValue('academicYear', academicYear ?? '');
                          formik.setFieldValue('subjectCode', '');
                        }}
                      >
                        <option value="1|">Select result</option>
                        {publishedResults.map((result) => (
                          <option
                            key={result._id}
                            value={`${result.semester}|${result.academicYear}`}
                          >
                            Semester {result.semester} · {result.academicYear}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Subject *</label>
                      <select
                        className={inputCls}
                        name="subjectCode"
                        value={formik.values.subjectCode}
                        onChange={formik.handleChange}
                        disabled={!formik.values.academicYear}
                      >
                        <option value="">Select subject</option>
                        {publishedResults
                          .find(
                            (result) =>
                              result.semester === Number(formik.values.semester) &&
                              result.academicYear === formik.values.academicYear,
                          )
                          ?.subjectResults.map((subject) => (
                            <option key={subject.subjectCode} value={subject.subjectCode}>
                              {subject.subjectCode} · {subject.subjectName}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Request Type *</label>
                      <select
                        name="requestType"
                        value={formik.values.requestType}
                        onChange={formik.handleChange}
                        className={inputCls}
                      >
                        <option value="recheck">Recheck</option>
                        <option value="revaluation">Revaluation</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Reason *</label>
                    <textarea
                      name="reason"
                      rows={3}
                      value={formik.values.reason}
                      onChange={formik.handleChange}
                      placeholder="Explain why you are requesting a recheck…"
                      className={inputCls + ' resize-none'}
                    />
                    {formik.touched.reason && formik.errors.reason && (
                      <p className="mt-1 text-xs text-red-500">{formik.errors.reason}</p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <CustomButton
                      variant="tertiary"
                      type="button"
                      onClick={() => setShowForm(false)}
                    >
                      Cancel
                    </CustomButton>
                    <CustomButton
                      variant="primary"
                      loading={processing}
                      onClick={() => formik.handleSubmit()}
                    >
                      Submit Request
                    </CustomButton>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isStudent ? 'My Recheck Requests' : 'Recheck & Revaluation Requests'}
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {isStudent
                ? 'Track submitted requests, payment status and the final review decision.'
                : 'Review student applications, payment confirmation and mark-verification outcomes.'}
            </p>
          </div>
          <CustomButton
            variant="secondary"
            startIcon={<RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} />}
            loading={isValidating}
            onClick={() => mutate()}
            className="w-fit!"
          >
            Refresh
          </CustomButton>
        </div>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <AsyncSelect
            type="academicYears"
            label="Session"
            placeholder="All sessions"
            value={filters.academicYear || null}
            onChange={(value) =>
              setFilters((current) => ({ ...current, academicYear: value ?? '' }))
            }
          />
          <AsyncSelect
            type="semesters"
            label="Semester"
            placeholder="All semesters"
            value={filters.semester || null}
            onChange={(value) =>
              setFilters((current) => ({ ...current, semester: value ?? '' }))
            }
          />
          <div>
            <label className={labelCls}>Request Type</label>
            <select
              className={inputCls}
              value={filters.requestType}
              onChange={(event) =>
                setFilters((current) => ({ ...current, requestType: event.target.value }))
              }
            >
              <option value="">All request types</option>
              <option value="recheck">Recheck</option>
              <option value="revaluation">Revaluation</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select
              className={inputCls}
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({ ...current, status: event.target.value }))
              }
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under review</option>
              <option value="marks_updated">Marks updated</option>
              <option value="no_change">No change</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Fee Status</label>
            <select
              className={inputCls}
              value={filters.feePaid}
              onChange={(event) =>
                setFilters((current) => ({ ...current, feePaid: event.target.value }))
              }
            >
              <option value="">All payments</option>
              <option value="true">Paid</option>
              <option value="false">Unpaid</option>
            </select>
          </div>
          {hasFilters && (
            <CustomButton
              variant="secondary"
              className="w-fit! lg:col-span-5"
              onClick={() =>
                setFilters({
                  academicYear: '',
                  semester: '',
                  requestType: '',
                  status: '',
                  feePaid: '',
                })
              }
            >
              Clear Filters
            </CustomButton>
          )}
        </div>
        <CustomTable
          data={requests}
          columns={columns}
          actions={actions}
          isLoading={isLoading}
          options={{ search: true, pagination: true, pageSize: 10 }}
          localization={{
            toolbar: { searchPlaceholder: 'Search requests…' },
            body: { emptyDataSourceMessage: 'No recheck requests match the selected filters.' },
          }}
        />
      </div>
    </div>
  );
}

// ─── Schedules Panel ──────────────────────────────────────────────────────────
function SchedulesPanel({ isAdmin }: { isAdmin: boolean }) {
  const [showModal, setShowModal] = useState(false);
  const [editSchedule, setEditSchedule] = useState<ISchedule | null>(null);
  const [filterType, setFilterType] = useState('');
  const { mutation, isLoading: changingStatus } = useMutation();

  const qp = filterType ? `?examType=${filterType}` : '';
  const { data: raw, isLoading, mutate } = useSwr(`examination/schedules${qp}`);
  const schedules: ISchedule[] = (raw as { data?: ISchedule[] })?.data ?? [];

  const columns: Column<ISchedule>[] = [
    {
      field: 'title',
      title: 'Schedule',
      render: (row) => (
        <div>
          <p className="text-sm font-semibold">{row.title ?? row.examType.replace('_', ' ')}</p>
          <p className="text-xs text-slate-600">
            {row.subjects?.length ?? 0} subject{row.subjects?.length === 1 ? '' : 's'}
          </p>
        </div>
      ),
    },
    {
      field: 'examType',
      title: 'Type',
      render: (row) => (
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs capitalize">
          {String(row.examType).replace('_', ' ')}
        </span>
      ),
    },
    {
      field: 'semester',
      title: 'Sem',
      render: (row) => <span className="text-sm">{row.semester}</span>,
    },
    {
      field: 'program',
      title: 'Program',
      render: (row) => <span className="text-xs text-slate-500">{row.program}</span>,
    },
    {
      field: 'subjects',
      title: 'First Exam',
      render: (row) => (
        <span className="text-sm">
          {row.subjects?.[0]
            ? `${row.subjects[0].subjectCode} · ${fmtDate(row.subjects[0].examDate)}`
            : '—'}
        </span>
      ),
    },
    {
      field: 'academicYear',
      title: 'Time',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.subjects?.[0] ? `${row.subjects[0].startTime} – ${row.subjects[0].endTime}` : '—'}
        </span>
      ),
    },
    {
      field: 'venue',
      title: 'Venue',
      render: (row) => <span className="text-xs">{row.subjects?.[0]?.venue ?? '—'}</span>,
    },
    {
      field: 'totalMarks',
      title: 'Marks',
      render: (row) => (
        <span className="text-sm">
          {row.subjects?.[0] ? `${row.subjects[0].maxMarks} / ${row.subjects[0].passMarks}` : '—'}
        </span>
      ),
    },
  ];

  const changeStatus = async (schedule: ISchedule, status: string) => {
    const answer = await Swal.fire({
      title: `Mark exam as ${status}?`,
      text:
        status === 'Completed'
          ? 'Marks entry will become available for this schedule.'
          : `The schedule will move from ${schedule.status ?? 'Scheduled'} to ${status}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: `Mark ${status}`,
      confirmButtonColor: '#0178D7',
    });
    if (!answer.isConfirmed) return;
    const response = await mutation(`examination/schedules/${schedule._id}`, {
      method: 'PUT',
      body: { status },
      isAlert: true,
    });
    if ((response as { results?: { success?: boolean } })?.results?.success) {
      toast.success(`Schedule marked ${status}`);
      mutate();
    }
  };

  const actions: Action<ISchedule>[] = isAdmin
    ? [
        {
          tooltip: 'Edit',
          icon: <Edit2 className="h-4 w-4 text-slate-500" />,
          onClick: (s) => {
            setEditSchedule(s);
            setShowModal(true);
          },
        },
        {
          tooltip: 'Start Examination',
          icon: <CheckCircle2 className="h-4 w-4 text-blue-500" />,
          onClick: (schedule) => changeStatus(schedule, 'Ongoing'),
          hidden: (schedule) => String(schedule.status ?? 'Scheduled') !== 'Scheduled',
        },
        {
          tooltip: 'Complete Examination',
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
          onClick: (schedule) => changeStatus(schedule, 'Completed'),
          hidden: (schedule) => schedule.status !== 'Ongoing',
        },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {isAdmin && (
          <CustomButton
            variant="primary"
            startIcon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setEditSchedule(null);
              setShowModal(true);
            }}
            className="w-fit!"
          >
            Add Schedule
          </CustomButton>
        )}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:outline-none"
        >
          <option value="">All Types</option>
          <option value="Mid Semester 1">Mid Semester 1</option>
          <option value="Mid Semester 2">Mid Semester 2</option>
          <option value="End Semester">End Semester</option>
          <option value="Practical">Practical</option>
          <option value="Viva">Viva</option>
          <option value="Supplementary">Supplementary</option>
          <option value="Back Paper">Back Paper</option>
        </select>
      </div>
      <div className="overflow-hidden rounded-2xl bg-white">
        {!isLoading && !schedules.length ? (
          <Empty
            title="No examination schedules yet"
            subTitle={
              isAdmin
                ? 'Create the first schedule from a section and its mapped subjects.'
                : 'Published examination schedules will appear here.'
            }
            pathName={isAdmin ? 'Create Schedule' : undefined}
            onClick={
              isAdmin
                ? () => {
                    setEditSchedule(null);
                    setShowModal(true);
                  }
                : undefined
            }
          />
        ) : (
          <CustomTable
            data={schedules}
            columns={columns}
            actions={actions}
            isLoading={isLoading || changingStatus}
            options={{ search: true, pagination: true, pageSize: 12 }}
            localization={{ toolbar: { searchPlaceholder: 'Search schedules…' } }}
          />
        )}
      </div>
      <AnimatePresence>
        {showModal && (
          <ScheduleModal
            schedule={editSchedule}
            onClose={() => {
              setShowModal(false);
              setEditSchedule(null);
            }}
            onSaved={() => {
              mutate();
              setShowModal(false);
              setEditSchedule(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Student My Results ───────────────────────────────────────────────────────
function StudentResultsPanel() {
  const { user } = useAuthStore();
  const [semFilter, setSemFilter] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>('');
  const url = user?._id
    ? semFilter
      ? `examination/results/student/${user._id}/semester?semester=${semFilter}${
          yearFilter ? `&academicYear=${encodeURIComponent(yearFilter)}` : ''
        }`
      : `examination/results/student/${user._id}`
    : null;
  const { data: raw, isLoading } = useSwr(url);
  const rawData = (raw as { data?: IResult | IResult[] })?.data;
  const results: IResult[] = Array.isArray(rawData) ? rawData : rawData ? [rawData] : [];

  if (isLoading)
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-44 rounded-2xl bg-white animate-pulse" />
        ))}
      </div>
    );
  if (!results.length)
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-16 text-slate-300">
        <Trophy className="h-10 w-10 mb-2" />
        <p className="text-sm text-slate-600">No results published yet</p>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Filter:</label>
          <div className="min-w-40">
            <AsyncSelect
              type="semesters"
              placeholder="All Semesters"
              value={semFilter || null}
              onChange={(v) => setSemFilter(v ?? '')}
            />
          </div>
          <input
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            placeholder="Academic Year"
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:outline-none"
          />
        </div>
        <div className="flex gap-3">
          <CustomButton
            variant="secondary"
            startIcon={<Download className="h-4 w-4" />}
            className="w-fit!"
            onClick={async () => {
              if (!user?._id || !semFilter || !yearFilter) {
                toast.error('Choose semester and academic year first');
                return;
              }
              const q = new URLSearchParams({
                semester: semFilter,
                academicYear: yearFilter,
              });
              const ok = await downloadPdf(
                `examination/results/student/${user._id}/marksheet?${q.toString()}`,
                `marksheet-sem${semFilter}.pdf`,
              );
              if (!ok) toast.error('Failed to download marksheet');
            }}
          >
            Marksheet
          </CustomButton>
          <CustomButton
            variant="secondary"
            startIcon={<FileText className="h-4 w-4" />}
            className="w-fit!"
            onClick={async () => {
              if (!user?._id) return;
              const ok = await downloadPdf(
                `examination/results/student/${user._id}/transcript`,
                `transcript.pdf`,
              );
              if (!ok) toast.error('Failed to download transcript');
            }}
          >
            Transcript
          </CustomButton>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {results.map((res, i) => {
          const color =
            res.result === 'PASS'
              ? 'text-green-600'
              : res.result === 'WITHHELD'
                ? 'text-amber-600'
                : 'text-red-500';
          return (
            <motion.div
              key={res._id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl bg-white p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-bold text-slate-800">Semester {res.semester}</p>
                  <p className="text-xs text-slate-600">{res.academicYear}</p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-black ${color}`}>{res.sgpa.toFixed(2)}</p>
                  <p className="text-xs text-slate-600">SGPA · CGPA {res.cgpa.toFixed(2)}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                {res.subjectResults?.map((sr, j) => (
                  <div
                    key={j}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5"
                  >
                    <span className="text-xs text-slate-600">
                      {sr.subjectName ?? sr.subjectCode}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{sr.totalMarks}</span>
                      {sr.gradeLetter && (
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold">
                          {sr.gradeLetter}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Credits {res.totalCreditsEarned}/{res.totalCreditsRegistered}
                </span>
                <span className="rounded-full bg-primary-50 px-3 py-0.5 text-xs font-bold text-primary">
                  {res.result}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type Tab =
  | 'schedules'
  | 'marks'
  | 'results'
  | 'ranklist'
  | 'hall-ticket'
  | 'seating'
  | 'recheck'
  | 'my-results';

export default function ExaminationPage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const hasViewPermission = useHasPermission('examination', 'view');
  const canView = hasViewPermission;
  const canCreate = useHasPermission('examination', 'create');
  const canEdit = useHasPermission('examination', 'edit');
  const isAdmin = canCreate || canEdit;
  const isFaculty = activeRole === 'faculty';
  const isDepartmentViewer = activeRole === 'hod';
  const isStudent = activeRole === 'student';

  const adminTabs: {
    id: Tab;
    label: string;
    description: string;
    icon: React.ElementType;
  }[] = [
    { id: 'schedules', label: 'Schedules', description: 'Plan exams', icon: Calendar },
    { id: 'marks', label: 'Marks Entry', description: 'Enter and verify', icon: ClipboardList },
    { id: 'results', label: 'Results', description: 'Compile outcomes', icon: BarChart2 },
    { id: 'ranklist', label: 'Rank List', description: 'Compare merit', icon: Trophy },
    { id: 'hall-ticket', label: 'Hall Ticket', description: 'Issue documents', icon: FileText },
    { id: 'seating', label: 'Seating', description: 'Allocate venues', icon: Layers },
    { id: 'recheck', label: 'Recheck', description: 'Resolve requests', icon: RefreshCw },
  ];
  const facultyTabs = [
    { id: 'schedules' as const, label: 'Schedules', description: 'Assigned exams', icon: Calendar },
    { id: 'marks' as const, label: 'Marks Entry', description: 'Enter marks', icon: ClipboardList },
    { id: 'recheck' as const, label: 'Recheck', description: 'Review requests', icon: RefreshCw },
  ];
  const departmentTabs = [
    {
      id: 'schedules' as const,
      label: 'Schedules',
      description: 'Department exams',
      icon: Calendar,
    },
    {
      id: 'results' as const,
      label: 'Results',
      description: 'Department outcomes',
      icon: BarChart2,
    },
    { id: 'ranklist' as const, label: 'Rank List', description: 'Department merit', icon: Trophy },
    {
      id: 'recheck' as const,
      label: 'Recheck',
      description: 'Department requests',
      icon: RefreshCw,
    },
  ];
  const institutionViewerTabs = [
    { id: 'schedules' as const, label: 'Schedules', description: 'Exam calendar', icon: Calendar },
    {
      id: 'results' as const,
      label: 'Results',
      description: 'Published outcomes',
      icon: BarChart2,
    },
    { id: 'ranklist' as const, label: 'Rank List', description: 'Institution merit', icon: Trophy },
    { id: 'recheck' as const, label: 'Recheck', description: 'Request status', icon: RefreshCw },
  ];
  const studentTabs = [
    {
      id: 'my-results' as const,
      label: 'My Results',
      description: 'Grades and credits',
      icon: Trophy,
    },
    { id: 'recheck' as const, label: 'Recheck', description: 'Request a review', icon: RefreshCw },
  ];

  const tabs = !canView
    ? []
    : isStudent
      ? studentTabs
      : isFaculty
        ? facultyTabs
        : isDepartmentViewer
          ? departmentTabs
          : isAdmin
            ? adminTabs
            : institutionViewerTabs;
  const [activeTab, setActiveTab] = useState<Tab>('schedules');
  const visibleActiveTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : tabs[0]?.id;

  // Stats (admin only)
  const { data: schedRaw } = useSwr(canView ? 'examination/schedules' : null);
  const schedules: ISchedule[] = (schedRaw as { data?: ISchedule[] })?.data ?? [];
  const { data: reRaw } = useSwr(canView && !isStudent ? 'examination/recheck' : null);
  const recheck: IRecheckRequest[] = (reRaw as { data?: IRecheckRequest[] })?.data ?? [];

  return (
    <div className="space-y-5 p-2 mb-10">
      <ExaminationWorkflowBar />
      {!tabs.length && (
        <Empty
          title="Examination access unavailable"
          subTitle="Your active role does not have access to examination records."
        />
      )}
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Examination</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {isAdmin
              ? 'Plan examinations, govern marks and publish verified outcomes.'
              : isStudent
                ? 'Review your published results and submit recheck requests.'
                : 'Institution-wide, read-only examination outcomes and operational status.'}
          </p>
        </div>
      </motion.div>

      {/* Admin stats */}
      {canView && !isStudent && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            {
              label: 'Schedules',
              value: schedules.length,
              icon: <Calendar className="h-4.5 w-4.5" />,
              color: 'bg-primary-50 text-primary',
            },
            {
              label: 'Completed Exams',
              value: schedules.filter((schedule) => schedule.status === 'completed').length,
              icon: <BarChart2 className="h-4.5 w-4.5" />,
              color: 'bg-green-50 text-green-600',
            },
            {
              label: 'Recheck Requests',
              value: recheck.length,
              icon: <Send className="h-4.5 w-4.5" />,
              color: 'bg-blue-50 text-blue-600',
            },
            {
              label: 'Pending Rechecks',
              value: recheck.filter((r) => r.status === 'pending').length,
              icon: <RefreshCw className="h-4.5 w-4.5" />,
              color: 'bg-amber-50 text-amber-600',
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
                <p className="text-xl font-bold text-slate-900">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex w-fit max-w-full gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex min-w-0 shrink-0 items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors ${
                visibleActiveTab === tab.id
                  ? 'bg-primary text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${visibleActiveTab === tab.id ? 'bg-white/15' : 'bg-slate-100'}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold">{tab.label}</span>
                <span
                  className={`mt-0.5 block truncate text-[10px] ${visibleActiveTab === tab.id ? 'text-white/75' : 'text-slate-400'}`}
                >
                  {tab.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab panels */}
      {tabs.length > 0 && (
        <AnimatePresence mode="wait">
          <motion.div
            key={visibleActiveTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {visibleActiveTab === 'schedules' && <SchedulesPanel isAdmin={isAdmin} />}
            {visibleActiveTab === 'marks' && <MarksEntryPanel isAdmin={isAdmin} />}
            {visibleActiveTab === 'results' && <ResultsPanel isAdmin={isAdmin} />}
            {visibleActiveTab === 'ranklist' && <RankListPanel />}
            {visibleActiveTab === 'hall-ticket' && <HallTicketPanel />}
            {visibleActiveTab === 'seating' && <SeatingPanel />}
            {visibleActiveTab === 'recheck' && (
              <RecheckPanel isAdmin={isAdmin} isStudent={isStudent} />
            )}
            {visibleActiveTab === 'my-results' && <StudentResultsPanel />}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

/**
 * @file MentorPage.tsx
 * @description Mentor-mentee management — role-aware:
 *   Admin/HOD: all assignments, create, assign mentees
 *   Faculty: own mentees list, log meeting
 *   Student: "My Mentor" view with meeting history
 * @module features/role-wise-features/mentor
 */
'use client';

import React, { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import { Users, MessageSquare, Plus, Eye, UserPlus, Calendar, Check, Search } from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import Empty from '@/shared/core/Empty';
import StudentWorkflowBar from '@/shared/components/StudentWorkflowBar';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { useAuthStore } from '@/shared/store/authStore';
import MentorAnalytics from './MentorAnalytics';

// ─── Types ────────────────────────────────────────────────────────────────────
interface IMentorMeeting {
  _id?: string;
  studentId?: string | { _id: string; name?: string; studentId?: string };
  date: string;
  type: 'academic' | 'personal' | 'parent' | 'career' | 'disciplinary';
  agenda: string;
  notes: string;
  nextActionDate?: string;
  nextAction?: string;
  parentPresent: boolean;
}

interface IMentorRecord {
  _id: string;
  facultyId: string | { _id: string; name?: string; email?: string; phone?: string };
  facultyName?: string;
  departmentId?: string | { _id: string; name?: string; code?: string };
  departmentName?: string;
  academicYear: string;
  menteeIds: Array<string | { _id: string; name?: string; email?: string; studentId?: string }>;
  maxMentees: number;
  meetings: IMentorMeeting[];
  totalMeetings: number;
  isActive: boolean;
  createdAt: string;
  [key: string]: unknown;
}

interface IMyMentor {
  _id: string;
  facultyId: { _id: string; name?: string; email?: string; phone?: string };
  departmentId?: { _id: string; name?: string; code?: string };
  meetings: IMentorMeeting[];
  [key: string]: unknown;
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

const MEETING_TYPE_COLOR: Record<string, string> = {
  academic: 'bg-blue-50 text-blue-600',
  personal: 'bg-purple-50 text-purple-600',
  parent: 'bg-green-50 text-green-600',
  career: 'bg-amber-50 text-amber-600',
  disciplinary: 'bg-red-50 text-red-500',
};

const currentAcademicYear = () => {
  const now = new Date();
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
};

// ─── Create Assignment Modal ───────────────────────────────────────────────────
function AssignmentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { mutation, isLoading } = useMutation();
  const formik = useFormik({
    initialValues: {
      facultyId: '',
      departmentId: '',
      academicYear: currentAcademicYear(),
      maxMentees: 20,
    },
    validationSchema: Yup.object({
      facultyId: Yup.string().trim().required('Select a faculty mentor'),
      departmentId: Yup.string().trim().required('Select a department'),
      academicYear: Yup.string().trim().required('Academic year required'),
      maxMentees: Yup.number().min(1).required(),
    }),
    onSubmit: async (values) => {
      const res = await mutation('mentor', { method: 'POST', body: values, isAlert: true });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Mentor assignment created');
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
        className="relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50 via-white to-cyan-50 px-5 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-500">
              Mentoring setup
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Create Mentor Assignment</h2>
            <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
              Select the academic year first, then choose a department and faculty mentor. After
              creation, students can be added up to the defined mentee capacity.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close create mentor assignment"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-lg text-slate-500 transition-colors hover:border-indigo-200 hover:text-indigo-600"
          >
            ✕
          </button>
        </div>
        <form onSubmit={formik.handleSubmit} className="space-y-5 p-5 sm:p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-600">
                  1
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Academic year</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                    Start with the reporting period that will own this mentor assignment.
                  </p>
                </div>
              </div>
              <label className={labelCls}>Academic Year *</label>
              <AsyncSelect
                type="academicYears"
                value={formik.values.academicYear || null}
                onChange={(value) => formik.setFieldValue('academicYear', value ?? '')}
                placeholder="Select configured academic year"
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-xs font-bold text-cyan-700">
                  2
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Academic department</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                    Narrows the faculty and students available in the selected reporting period.
                  </p>
                </div>
              </div>
              <AsyncSelect
                type="departments"
                label="Department"
                required
                value={formik.values.departmentId}
                onChange={(value) => {
                  formik.setFieldValue('departmentId', value ?? '');
                  formik.setFieldValue('facultyId', '');
                }}
                error={formik.touched.departmentId ? formik.errors.departmentId : undefined}
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-xs font-bold text-violet-600">
                  3
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Faculty mentor</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                    Choose the faculty member responsible for mentoring and meeting records.
                  </p>
                </div>
              </div>
              <AsyncSelect
                type="faculty"
                label="Faculty Mentor"
                required
                value={formik.values.facultyId}
                params={{ departmentId: formik.values.departmentId }}
                disabled={!formik.values.departmentId}
                placeholder={
                  formik.values.departmentId
                    ? 'Search faculty name or employee code'
                    : 'Select department first'
                }
                onChange={(value) => formik.setFieldValue('facultyId', value ?? '')}
                error={formik.touched.facultyId ? formik.errors.facultyId : undefined}
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-xs font-bold text-amber-700">
                  4
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Mentee capacity</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                    Set the maximum number of students this mentor can support.
                  </p>
                </div>
              </div>
              <label className={labelCls}>Max Mentees *</label>
              <input
                type="number"
                name="maxMentees"
                min={1}
                value={formik.values.maxMentees}
                onChange={formik.handleChange}
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton variant="primary" type="submit" loading={isLoading}>
              Create
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Assign Mentee Modal ───────────────────────────────────────────────────────
function AssignMenteeModal({
  mentor,
  onClose,
  onSaved,
}: {
  mentor: IMentorRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    mentor.menteeIds.map((student) => (typeof student === 'object' ? student._id : student)),
  );
  const [search, setSearch] = useState('');
  const departmentId =
    typeof mentor.departmentId === 'object' ? mentor.departmentId._id : mentor.departmentId;
  const optionQuery = new URLSearchParams({
    type: 'students',
    limit: '100',
    ...(departmentId ? { departmentId } : {}),
    ...(mentor.academicYear ? { academicYear: mentor.academicYear } : {}),
  }).toString();
  const { data: studentRaw, isLoading: studentsLoading } = useSwr(`search/options?${optionQuery}`);
  const fetchedOptions =
    (studentRaw as { data?: Array<{ value: string; label: string; sub?: string }> })?.data ?? [];
  const existingOptions = mentor.menteeIds.map((student) =>
    typeof student === 'object'
      ? { value: student._id, label: student.name ?? 'Assigned student', sub: student.email }
      : { value: student, label: 'Assigned student', sub: 'Already assigned' },
  );
  const options = [
    ...new Map(
      [...existingOptions, ...fetchedOptions].map((option) => [option.value, option]),
    ).values(),
  ];
  const initialIds = new Set(existingOptions.map((student) => student.value));
  const students = options.filter((student) =>
    `${student.label} ${student.sub ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const usedCapacity = selectedIds.length;
  const capacityPercent =
    mentor.maxMentees > 0 ? Math.min(100, (usedCapacity / mentor.maxMentees) * 100) : 0;

  const toggleStudent = (studentId: string) => {
    if (selectedIds.includes(studentId)) {
      setSelectedIds((current) => current.filter((id) => id !== studentId));
      return;
    }
    if (selectedIds.length >= mentor.maxMentees) {
      toast.warning(
        `Mentor capacity is full (${mentor.maxMentees} students). Deselect one student before adding another.`,
        { toastId: `mentor-capacity-${mentor._id}` },
      );
      return;
    }
    setSelectedIds((current) =>
      current.includes(studentId) || current.length >= mentor.maxMentees
        ? current
        : [...current, studentId],
    );
  };

  const handleSubmit = async () => {
    const res = await mutation(`mentor/${mentor._id}/mentees`, {
      method: 'PUT',
      body: { studentIds: selectedIds },
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Mentor assignments updated');
      onSaved();
    } else toast.error('Could not update mentor assignments');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className="relative z-10 flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white sm:max-h-[calc(100dvh-2rem)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50 via-white to-cyan-50 px-4 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-500">
              Student allocation
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              Manage mentees for {mentor.facultyName ?? 'mentor'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Select multiple students, deselect existing mentees when needed, then save all changes
              together for academic year {mentor.academicYear}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close student selection"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-lg text-slate-500 hover:text-indigo-600"
          >
            ✕
          </button>
        </div>
        <div className="grid shrink-0 gap-3 border-b border-slate-200 p-4 sm:grid-cols-[minmax(0,1fr)_260px] sm:px-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, roll number or programme"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-300 focus:bg-white"
            />
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-cyan-50 px-3 py-2">
            <svg
              viewBox="0 0 42 42"
              className="h-9 w-9 shrink-0"
              role="img"
              aria-label={`${capacityPercent.toFixed(0)} percent capacity used`}
            >
              <circle cx="21" cy="21" r="16" fill="none" stroke="#cffafe" strokeWidth="5" />
              <circle
                cx="21"
                cy="21"
                r="16"
                fill="none"
                stroke="#06b6d4"
                strokeWidth="5"
                pathLength="100"
                strokeDasharray={`${capacityPercent} ${100 - capacityPercent}`}
                strokeLinecap="round"
                transform="rotate(-90 21 21)"
              />
            </svg>
            <div>
              <p className="text-[10px] uppercase text-cyan-700">Mentor capacity</p>
              <p className="text-sm font-bold text-slate-800">
                {usedCapacity} of {mentor.maxMentees} assigned
              </p>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 p-4 sm:p-6">
          {studentsLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : students.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {students.map((student, index) => {
                const selected = selectedIds.includes(student.value);
                const previouslyAssigned = initialIds.has(student.value);
                return (
                  <motion.button
                    key={student.value}
                    type="button"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index, 8) * 0.03 }}
                    onClick={() => toggleStudent(student.value)}
                    className={`flex min-h-28 w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${selected ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-200'}`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${selected ? 'bg-indigo-600 text-white' : 'bg-cyan-50 text-cyan-700'}`}
                    >
                      {selected ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        student.label.charAt(0).toUpperCase()
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm text-slate-900">
                        {student.label}
                      </strong>
                      <span className="mt-1 block text-[11px] leading-5 text-slate-500">
                        {student.sub || 'Student profile'}
                      </span>
                      <span
                        className={`mt-2 inline-block text-[10px] font-semibold ${selected ? 'text-indigo-700' : 'text-slate-400'}`}
                      >
                        {selected
                          ? previouslyAssigned
                            ? 'Already assigned · click to remove'
                            : 'New selection · click to remove'
                          : previouslyAssigned
                            ? 'Will be removed when saved'
                            : 'Select student'}
                      </span>
                    </span>
                  </motion.button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-14 text-center">
              <Users className="mx-auto h-7 w-7 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-600">
                No eligible students found
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Try another search or verify department and academic-year records.
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase text-slate-400">Selection summary</p>
            <p className="truncate text-sm font-semibold text-slate-800">
              {selectedIds.length} selected ·{' '}
              {selectedIds.filter((id) => !initialIds.has(id)).length} new ·{' '}
              {existingOptions.filter((student) => !selectedIds.includes(student.value)).length}{' '}
              removed
            </p>
          </div>
          <div className="flex gap-3">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton
              variant="primary"
              loading={isLoading}
              disabled={usedCapacity > mentor.maxMentees}
              onClick={handleSubmit}
            >
              Save mentee assignments
            </CustomButton>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Log Meeting Modal ────────────────────────────────────────────────────────
function LogMeetingModal({
  mentor,
  onClose,
  onSaved,
}: {
  mentor: IMentorRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const formik = useFormik({
    initialValues: {
      studentId: '',
      date: new Date().toISOString().slice(0, 10),
      type: 'academic' as const,
      agenda: '',
      notes: '',
      nextActionDate: '',
      nextAction: '',
      parentPresent: false,
    },
    validationSchema: Yup.object({
      studentId: Yup.string().required('Select a mentee'),
      date: Yup.string().required('Date required'),
      agenda: Yup.string().trim().required('Agenda required'),
      notes: Yup.string().trim().required('Notes required'),
    }),
    onSubmit: async (values) => {
      const res = await mutation(`mentor/${mentor._id}/meetings`, {
        method: 'POST',
        body: values,
        isAlert: true,
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Meeting logged');
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
        className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6  max-h-[92dvh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-900">Log Meeting</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-600 hover:text-slate-600 text-xl"
          >
            ✕
          </button>
        </div>
        <form onSubmit={formik.handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Mentee *</label>
            <select
              name="studentId"
              value={formik.values.studentId}
              onChange={formik.handleChange}
              className={inputCls}
            >
              <option value="">Select assigned student</option>
              {mentor.menteeIds.map((student) => {
                const value = typeof student === 'string' ? student : student._id;
                const label =
                  typeof student === 'string'
                    ? student
                    : [student.name, student.studentId].filter(Boolean).join(' · ');
                return (
                  <option key={value} value={value}>
                    {label}
                  </option>
                );
              })}
            </select>
            {formik.touched.studentId && formik.errors.studentId && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.studentId}</p>
            )}
          </div>
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
              <label className={labelCls}>Meeting Type *</label>
              <select
                name="type"
                value={formik.values.type}
                onChange={formik.handleChange}
                className={inputCls}
              >
                <option value="academic">Academic</option>
                <option value="personal">Personal</option>
                <option value="parent">Parent</option>
                <option value="career">Career</option>
                <option value="disciplinary">Disciplinary</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Agenda *</label>
            <input
              name="agenda"
              value={formik.values.agenda}
              onChange={formik.handleChange}
              placeholder="Meeting agenda…"
              className={inputCls}
            />
            {formik.touched.agenda && formik.errors.agenda && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.agenda}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Notes *</label>
            <textarea
              name="notes"
              rows={3}
              value={formik.values.notes}
              onChange={formik.handleChange}
              placeholder="Meeting notes and outcomes…"
              className={inputCls + ' resize-none'}
            />
            {formik.touched.notes && formik.errors.notes && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.notes}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Next Action Date</label>
              <input
                type="date"
                name="nextActionDate"
                value={formik.values.nextActionDate}
                onChange={formik.handleChange}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Next Action</label>
              <input
                name="nextAction"
                value={formik.values.nextAction}
                onChange={formik.handleChange}
                placeholder="Follow-up…"
                className={inputCls}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="parentPresent"
              checked={formik.values.parentPresent}
              onChange={formik.handleChange}
              className="rounded"
            />
            <span className="text-sm text-slate-600">Parent was present</span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton variant="primary" type="submit" loading={isLoading}>
              Log Meeting
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Mentor Detail Drawer ─────────────────────────────────────────────────────
function MentorDetailDrawer({
  mentor,
  onClose,
  canLogMeeting,
  onLogMeeting,
}: {
  mentor: IMentorRecord;
  onClose: () => void;
  canLogMeeting: boolean;
  onLogMeeting: () => void;
}) {
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
            <h2 className="text-sm font-bold text-slate-900">
              {mentor.facultyName ?? 'Mentor Details'}
            </h2>
            <p className="text-xs text-slate-600">
              {mentor.academicYear} · {mentor.menteeIds?.length ?? 0}/{mentor.maxMentees} mentees
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canLogMeeting && (
              <CustomButton
                variant="primary"
                onClick={onLogMeeting}
                className="py-1.5! text-xs! w-fit!"
              >
                <Plus className="h-3 w-3 mr-1" />
                Log Meeting
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
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-600">Department</p>
              <p className="text-sm font-bold text-slate-800 mt-0.5">
                {mentor.departmentName ?? '—'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-600">Total Meetings</p>
              <p className="text-sm font-bold text-slate-800 mt-0.5">{mentor.totalMeetings}</p>
            </div>
          </div>

          {/* Meetings history */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Meeting History
            </h3>
            {mentor.meetings?.length ? (
              <div className="space-y-2">
                {[...mentor.meetings].reverse().map((m, i) => (
                  <div key={m._id ?? i} className="rounded-xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${MEETING_TYPE_COLOR[m.type] ?? 'bg-slate-100 text-slate-500'}`}
                      >
                        {m.type}
                      </span>
                      <span className="text-xs text-slate-600">
                        {new Date(m.date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    {typeof m.studentId === 'object' && (
                      <p className="mb-1 text-[11px] font-semibold text-slate-600">
                        {m.studentId.name ?? m.studentId.studentId ?? 'Student'}
                      </p>
                    )}
                    <p className="text-xs font-medium text-slate-700">{m.agenda}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{m.notes}</p>
                    {m.nextAction && <p className="text-xs text-primary mt-1">→ {m.nextAction}</p>}
                    {m.parentPresent && (
                      <span className="text-[10px] text-green-600 font-medium">Parent Present</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600 text-center py-4">No meetings logged yet</p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Student "My Mentor" View ──────────────────────────────────────────────────
function MyMentorView() {
  const { data: raw, isLoading } = useSwr('mentor/my');
  const mentor = (raw as { data?: IMyMentor })?.data;

  if (isLoading) return <div className="h-40 rounded-2xl bg-white animate-pulse" />;
  if (!mentor)
    return (
      <div className="rounded-2xl bg-white">
        <Empty
          title="No mentor assigned yet"
          subTitle="Your mentor details and meeting history will appear here after the department completes the assignment."
        />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-2xl bg-white p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-2xl font-black text-primary">
          {(mentor.facultyId?.name ?? 'M').charAt(0)}
        </div>
        <div>
          <p className="text-base font-bold text-slate-900">{mentor.facultyId?.name ?? '—'}</p>
          <p className="text-xs text-slate-600">{mentor.departmentId?.name ?? ''}</p>
          {mentor.facultyId?.email && (
            <p className="text-xs text-slate-500 mt-0.5">{mentor.facultyId.email}</p>
          )}
          {mentor.facultyId?.phone && (
            <p className="text-xs text-slate-500">{mentor.facultyId.phone}</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Meeting History</h3>
        <div className="space-y-3">
          {mentor.meetings?.length ? (
            [...mentor.meetings].reverse().map((m, i) => (
              <motion.div
                key={m._id ?? i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl bg-white p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${MEETING_TYPE_COLOR[m.type] ?? 'bg-slate-100'}`}
                  >
                    {m.type}
                  </span>
                  <span className="text-xs text-slate-600">
                    {new Date(m.date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-700">{m.agenda}</p>
                <p className="text-xs text-slate-500 mt-1">{m.notes}</p>
                {m.nextAction && <p className="text-xs text-primary mt-1">Next: {m.nextAction}</p>}
              </motion.div>
            ))
          ) : (
            <div className="rounded-2xl bg-white py-10 text-center">
              <p className="text-sm text-slate-600">No meetings recorded yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function MentorPage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const canView = useHasPermission('mentor', 'view');
  const hasCreatePermission = useHasPermission('mentor', 'create');
  const hasEditPermission = useHasPermission('mentor', 'edit');
  const isAcademicLeader = ['super_admin', 'dean_academic', 'hod'].includes(activeRole ?? '');
  const canCreateAssignment = isAcademicLeader && hasCreatePermission;
  const canAssignMentee = isAcademicLeader && hasEditPermission;
  const isFaculty = activeRole === 'faculty';
  const isStudent = activeRole === 'student';

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [assignMenteeFor, setAssignMenteeFor] = useState<IMentorRecord | null>(null);
  const [logMeetingFor, setLogMeetingFor] = useState<IMentorRecord | null>(null);
  const [detailMentor, setDetailMentor] = useState<IMentorRecord | null>(null);

  const { data: raw, error, isLoading, mutate } = useSwr(canView && !isStudent ? 'mentor' : null);
  const records: IMentorRecord[] = ((raw as { data?: IMentorRecord[] })?.data ?? []).map(
    (record) => ({
      ...record,
      facultyName:
        typeof record.facultyId === 'object' ? record.facultyId.name : record.facultyName,
      departmentName:
        typeof record.departmentId === 'object' ? record.departmentId.name : record.departmentName,
    }),
  );

  if (!canView) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Mentoring access unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your active role cannot view mentoring records.
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">
          Mentoring records could not be loaded
        </h1>
        <p className="mt-2 text-sm text-red-600">{error.message}</p>
        <CustomButton className="mx-auto mt-4 w-fit!" onClick={() => mutate()}>
          Try again
        </CustomButton>
      </div>
    );
  }

  // Student sees own mentor
  if (isStudent)
    return (
      <div className="space-y-5">
        <StudentWorkflowBar />
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-slate-900">My Mentor</h1>
          <p className="mt-0.5 text-sm text-slate-500">Your assigned mentor and meeting history</p>
        </motion.div>
        <MyMentorView />
      </div>
    );

  const columns: Column<IMentorRecord>[] = [
    {
      field: 'facultyName',
      title: 'Mentor',
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary">
            {(r.facultyName ?? 'M').charAt(0)}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">{r.facultyName ?? '—'}</p>
            <p className="text-xs text-slate-600">{r.departmentName ?? ''}</p>
          </div>
        </div>
      ),
    },
    {
      field: 'menteeIds',
      title: 'Mentees',
      headerClassName: 'text-center',
      render: (r) => (
        <div className="flex w-full justify-center">
          <span className="text-sm font-medium">
            {r.menteeIds?.length ?? 0} / {r.maxMentees}
          </span>
        </div>
      ),
    },
    {
      field: 'academicYear',
      title: 'Academic Year',
      headerClassName: 'text-center',
      render: (r) => (
        <div className="flex w-full justify-center text-sm">{r.academicYear || '—'}</div>
      ),
    },
    {
      field: 'totalMeetings',
      title: 'Meetings',
      headerClassName: 'text-center',
      render: (r) => <div className="flex w-full justify-center text-sm">{r.totalMeetings}</div>,
    },
    {
      field: 'isActive',
      title: 'Status',
      headerClassName: 'text-center',
      render: (r) => (
        <div className="flex w-full justify-center">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${r.isActive ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}
          >
            {r.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      ),
    },
  ];

  const actions: Action<IMentorRecord>[] = [
    {
      tooltip: 'View Meetings',
      icon: <MessageSquare className="h-4 w-4 text-primary" />,
      onClick: (r) => setDetailMentor(r),
    },
    ...(canAssignMentee
      ? ([
          {
            tooltip: 'Assign Mentee',
            icon: <Users className="h-4 w-4 text-slate-500" />,
            onClick: (r: IMentorRecord) => setAssignMenteeFor(r),
          },
        ] as Action<IMentorRecord>[])
      : []),
    ...(isFaculty
      ? ([
          {
            tooltip: 'Log Meeting',
            icon: <Plus className="h-4 w-4 text-green-500" />,
            onClick: (r: IMentorRecord) => setLogMeetingFor(r),
            hidden: (r: IMentorRecord) => r.menteeIds.length === 0,
          },
        ] as Action<IMentorRecord>[])
      : []),
  ];

  return (
    <div className="space-y-5">
      <StudentWorkflowBar />
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mentor</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Mentor-mentee assignments and meeting logs
          </p>
        </div>
        {canCreateAssignment && (
          <CustomButton
            variant="primary"
            startIcon={<Plus className="h-4 w-4" />}
            onClick={() => setShowCreateModal(true)}
            className="w-fit!"
          >
            Create Assignment
          </CustomButton>
        )}
      </motion.div>

      <MentorAnalytics records={records} isLoading={isLoading} />

      <DataViewSwitcher<IMentorRecord>
        data={records}
        isLoading={isLoading}
        storageKey="mentor.view"
        searchPlaceholder="Search mentors…"
        searchFields={['facultyName', 'departmentName', 'academicYear']}
        renderCard={(m) => (
          <motion.div
            whileHover={{ y: -2 }}
            className="flex flex-col gap-3 rounded-2xl bg-white p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary">
                {(m.facultyName ?? 'M').charAt(0).toUpperCase()}
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${m.isActive ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}
              >
                {m.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{m.facultyName ?? '—'}</p>
              <p className="text-xs text-slate-600">{m.departmentName ?? ''}</p>
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500">
                <Calendar className="h-3 w-3" /> AY {m.academicYear}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                <p className="text-[10px] uppercase text-slate-600">Mentees</p>
                <p className="font-bold text-slate-800">
                  {m.menteeIds?.length ?? 0}/{m.maxMentees}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                <p className="text-[10px] uppercase text-slate-600">Meetings</p>
                <p className="font-bold text-slate-800">{m.totalMeetings}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3 text-xs">
              <button
                type="button"
                onClick={() => setDetailMentor(m)}
                className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-primary"
              >
                <Eye className="h-3 w-3" /> View
              </button>
              {canAssignMentee && (
                <button
                  type="button"
                  onClick={() => setAssignMenteeFor(m)}
                  disabled={m.menteeIds.length >= m.maxMentees}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <UserPlus className="h-3 w-3" /> Assign
                </button>
              )}
              {isFaculty && (
                <button
                  type="button"
                  onClick={() => setLogMeetingFor(m)}
                  disabled={m.menteeIds.length === 0}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <MessageSquare className="h-3 w-3" /> Log Meeting
                </button>
              )}
            </div>
          </motion.div>
        )}
        table={
          <div className="overflow-hidden rounded-2xl bg-white">
            <CustomTable
              data={records}
              columns={columns}
              actions={actions}
              isLoading={isLoading}
              title="Mentor Assignment Directory"
              description="Review faculty mentors, assigned student capacity, meeting activity and current assignment status."
              onRefresh={() => void mutate()}
              options={{
                search: false,
                export: false,
                refresh: true,
                pagination: true,
                pageSize: 10,
                actionsType: 'dropdown',
              }}
            />
          </div>
        }
      />

      <AnimatePresence>
        {showCreateModal && (
          <AssignmentModal
            onClose={() => setShowCreateModal(false)}
            onSaved={() => {
              mutate();
              setShowCreateModal(false);
            }}
          />
        )}
        {assignMenteeFor && (
          <AssignMenteeModal
            mentor={assignMenteeFor}
            onClose={() => setAssignMenteeFor(null)}
            onSaved={() => {
              mutate();
              setAssignMenteeFor(null);
            }}
          />
        )}
        {logMeetingFor && (
          <LogMeetingModal
            mentor={logMeetingFor}
            onClose={() => {
              setLogMeetingFor(null);
            }}
            onSaved={() => {
              mutate();
              setLogMeetingFor(null);
            }}
          />
        )}
        {detailMentor && (
          <MentorDetailDrawer
            mentor={detailMentor}
            onClose={() => setDetailMentor(null)}
            canLogMeeting={isFaculty}
            onLogMeeting={() => {
              setLogMeetingFor(detailMentor);
              setDetailMentor(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

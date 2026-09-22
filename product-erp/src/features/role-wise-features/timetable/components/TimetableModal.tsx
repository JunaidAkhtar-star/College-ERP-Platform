/**
 * @file TimetableModal.tsx
 * @description Create/edit timetable header modal + SlotModal for adding/editing individual slots.
 * Includes full Yup validation and client-side conflict detection.
 * @module features/role-wise-features/timetable/components
 */
'use client';

import React from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { motion } from '@/shared/utils/motion';
import { X, Clock, BookOpen, Info } from 'lucide-react';
import CustomButton from '@/shared/core/CustomButton';
import AsyncSelect from '@/shared/core/AsyncSelect';
import useMutation from '@/shared/hooks/useMutation';
import { toast } from 'react-toastify';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { ITimetable, ITimetableSlot, ICreateTimetableDto, TDay } from '../types/timetable.types';

// ─── Shared input style ────────────────────────────────────────────────────────
const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';
const errCls = 'mt-1 text-xs text-red-500';

const DAYS: TDay[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─── Conflict check ────────────────────────────────────────────────────────────
function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function addMinutes(time: string, amount: number): string {
  const total = timeToMin(time) + amount;
  const hours = Math.floor(total / 60) % 24;
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function detectConflict(
  newSlot: { day: string; startTime: string; endTime: string; facultyId?: string; roomNo?: string },
  existing: ITimetableSlot[],
  excludeIndex?: number,
): string | null {
  const nStart = timeToMin(newSlot.startTime);
  const nEnd = timeToMin(newSlot.endTime);
  for (let i = 0; i < existing.length; i++) {
    if (i === excludeIndex) continue;
    const s = existing[i]!;
    if (s.day !== newSlot.day) continue;
    const eStart = timeToMin(s.startTime);
    const eEnd = timeToMin(s.endTime);
    const overlaps = nStart < eEnd && nEnd > eStart;
    if (!overlaps) continue;
    const subjectLabel = s.subjectName
      ? `${s.subjectName}${s.subjectCode ? ` (${s.subjectCode})` : ''}`
      : s.subjectCode || s.title || 'another scheduled class';
    if (newSlot.facultyId && s.facultyId && newSlot.facultyId === s.facultyId) {
      return `Faculty conflict: ${s.facultyName} is already teaching ${subjectLabel} at ${s.startTime}–${s.endTime}`;
    }
    if (newSlot.roomNo && s.roomNo && newSlot.roomNo === s.roomNo) {
      return `Room conflict: Room ${s.roomNo} is occupied by ${subjectLabel} at ${s.startTime}–${s.endTime}`;
    }
  }
  return null;
}

// ─── Timetable Header Schema ───────────────────────────────────────────────────
const ttSchema = Yup.object({
  sectionId: Yup.string().optional(),
  academicYear: Yup.string()
    .matches(/^\d{4}-\d{2,4}$/, 'Format: 2024-25')
    .required('Required'),
  semesterType: Yup.string().oneOf(['odd', 'even']).required('Required'),
  departmentId: Yup.string().required('Department required'),
  program: Yup.string().required('Required'),
  semester: Yup.number().min(1, 'Min 1').max(12, 'Max 12').required('Required'),
  section: Yup.string().optional(),
  scheduleStartTime: Yup.string().required('Start time required'),
  effectiveFrom: Yup.string().required('Effective date required for the official timetable'),
  scheduleEndTime: Yup.string()
    .required('End time required')
    .test('after-schedule-start', 'End time must be after start time', function (value) {
      const { scheduleStartTime } = this.parent as { scheduleStartTime?: string };
      return !value || !scheduleStartTime || timeToMin(value) > timeToMin(scheduleStartTime);
    }),
});

// ─── Slot Schema ───────────────────────────────────────────────────────────────
const slotSchema = Yup.object({
  day: Yup.string().oneOf(DAYS).required('Required'),
  startTime: Yup.string().required('Required'),
  endTime: Yup.string()
    .required('Required')
    .test('after-start', 'End must be after start', function (val) {
      const { startTime } = this.parent as { startTime: string };
      if (!val || !startTime) return true;
      return timeToMin(val) > timeToMin(startTime);
    }),
  slotKind: Yup.string().oneOf(['teaching', 'break', 'activity']).required('Required'),
  title: Yup.string().max(120),
  subjectId: Yup.string(),
  subjectCode: Yup.string(),
  subjectName: Yup.string(),
  facultyId: Yup.string(),
  facultyName: Yup.string(),
  roomNo: Yup.string(),
  roomId: Yup.string().optional(),
  classType: Yup.string().oneOf(['theory', 'lab', 'tutorial']).required('Required'),
  labBatch: Yup.string(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// TIMETABLE HEADER MODAL (create/edit timetable itself)
// ═══════════════════════════════════════════════════════════════════════════════
interface TimetableModalProps {
  editing: ITimetable | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function TimetableModal({ editing, onClose, onSaved }: TimetableModalProps) {
  const { mutation, isLoading: saving } = useMutation();
  const canCreateSections = useHasPermission('academic_structure', 'create');
  const [scopeMode, setScopeMode] = React.useState<'sections' | 'direct'>('direct');
  const [planner, setPlanner] = React.useState({
    academicYear: '',
    curriculumId: '',
    program: '',
    semesterNo: '',
    departmentIds: [] as string[],
    sectionIds: [] as string[],
  });
  const [selectedDepartment, setSelectedDepartment] = React.useState(() => {
    if (typeof editing?.departmentId === 'object') {
      return editing.departmentId.name || editing.departmentId.code;
    }
    return '';
  });

  const formik = useFormik<ICreateTimetableDto>({
    initialValues: {
      sectionId:
        typeof editing?.sectionId === 'object'
          ? editing.sectionId._id
          : ((editing?.sectionId as string | undefined) ?? ''),
      academicYear: editing?.academicYear ?? '',
      scheduleStartTime: editing?.scheduleStartTime ?? editing?.slots?.[0]?.startTime ?? '09:00',
      scheduleEndTime:
        editing?.scheduleEndTime ??
        editing?.slots?.reduce(
          (latest, slot) => (timeToMin(slot.endTime) > timeToMin(latest) ? slot.endTime : latest),
          '17:00',
        ) ??
        '17:00',
      title: editing?.title ?? '',
      effectiveFrom: editing?.effectiveFrom?.slice(0, 10) ?? '',
      effectiveTo: editing?.effectiveTo?.slice(0, 10) ?? '',
      documentNo: editing?.documentNo ?? '',
      semesterType: editing?.semesterType ?? 'odd',
      departmentId:
        typeof editing?.departmentId === 'object'
          ? editing.departmentId._id
          : (editing?.departmentId ?? ''),
      program: editing?.program ?? '',
      semester: editing?.semester ?? 1,
      section: editing?.section ?? 'A',
      branches: editing?.branches ?? [],
      branchDepartmentIds: editing?.branchDepartmentIds ?? [],
      slots: editing?.slots ?? [],
    },
    enableReinitialize: true,
    validationSchema: ttSchema,
    onSubmit: async (values) => {
      const isEdit = !!editing;
      const targetSectionIds = isEdit
        ? values.sectionId
          ? [values.sectionId]
          : []
        : planner.sectionIds;
      if (!isEdit && scopeMode === 'sections' && !targetSectionIds.length) {
        toast.error('Select at least one configured section');
        return;
      }
      if (
        !isEdit &&
        scopeMode === 'direct' &&
        (!planner.academicYear ||
          !planner.curriculumId ||
          !planner.program ||
          !planner.semesterNo ||
          !planner.departmentIds.length)
      ) {
        toast.error('Complete the academic scope before creating the timetable');
        return;
      }
      const scheduleChanged = Boolean(
        editing &&
        (values.scheduleStartTime !== editing.scheduleStartTime ||
          values.scheduleEndTime !== editing.scheduleEndTime),
      );
      const metadataOnly = Boolean(isEdit && (editing?.isApproved || !scheduleChanged));
      const res = await mutation(
        metadataOnly
          ? `timetable/${editing!._id}/publication-details`
          : isEdit
            ? `timetable/${editing!._id}`
            : 'timetable/batch',
        {
          method: metadataOnly ? 'PATCH' : isEdit ? 'PUT' : 'POST',
          body: metadataOnly
            ? {
                title: values.title,
                effectiveFrom: values.effectiveFrom,
                effectiveTo: values.effectiveTo,
                documentNo: values.documentNo,
              }
            : isEdit
              ? {
                  ...values,
                  sectionId: targetSectionIds[0] || undefined,
                  section: targetSectionIds.length ? values.section : undefined,
                  slots: values.slots.map((slot) => ({
                    ...slot,
                    branch: slot.branch || undefined,
                    branchDepartmentId: slot.branchDepartmentId || undefined,
                    facultyId: slot.facultyId || undefined,
                    roomId: slot.roomId || undefined,
                    subjectId: slot.subjectId || undefined,
                  })),
                }
              : {
                  sectionIds: targetSectionIds,
                  directScopes:
                    scopeMode === 'direct'
                      ? [
                          {
                            academicYear: planner.academicYear,
                            curriculumId: planner.curriculumId,
                            departmentId: planner.departmentIds[0],
                            program: planner.program,
                            semester: Number(planner.semesterNo),
                            semesterType: Number(planner.semesterNo) % 2 === 0 ? 'even' : 'odd',
                            branchDepartmentIds: planner.departmentIds,
                          },
                        ]
                      : undefined,
                  title: values.title,
                  effectiveFrom: values.effectiveFrom,
                  effectiveTo: values.effectiveTo,
                  documentNo: values.documentNo,
                  scheduleStartTime: values.scheduleStartTime,
                  scheduleEndTime: values.scheduleEndTime,
                },
        },
      );
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success(
          isEdit
            ? metadataOnly
              ? 'Document details updated'
              : 'Timetable updated'
            : `${scopeMode === 'direct' ? 1 : targetSectionIds.length} timetable${scopeMode === 'direct' || targetSectionIds.length === 1 ? '' : 's'} created`,
        );
        onSaved();
      }
    },
  });

  const f = formik.values;
  const e = formik.errors;
  const t = formik.touched;

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
        transition={{ duration: 0.2 }}
        className="relative z-10 flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white "
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
        >
          <X className="h-4.5 w-4.5" />
        </button>
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary">
            <Clock className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {editing ? 'Edit Timetable' : 'Create Timetable'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {editing
                ? 'Update this timetable and its publication details.'
                : 'Choose the academic context, then target sections or the whole cohort.'}
            </p>
          </div>
        </div>

        <form onSubmit={formik.handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3">
              <div className="flex gap-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">
                    {editing ? 'Section-controlled timetable' : 'Academic timetable planner'}
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-blue-700">
                    All choices come from Academic Structure. Timetable creation never invents
                    programmes, branches, semesters, or sections.
                  </p>
                </div>
              </div>
            </div>

            {editing && editing.sectionId ? (
              <div>
                <AsyncSelect
                  label="Class Section"
                  type="sections"
                  placeholder="Search programme, branch, semester or section"
                  params={{ master: true }}
                  disabled={Boolean(editing?.isApproved)}
                  value={f.sectionId || null}
                  onChange={(v, opt) => {
                    formik.setFieldValue('sectionId', v ?? '');
                    const meta = opt?.meta;
                    if (!v || !meta) {
                      setSelectedDepartment('');
                      return;
                    }
                    const semester = Number(meta.semesterNo);
                    formik.setFieldValue('academicYear', String(meta.academicYear ?? ''));
                    formik.setFieldValue('semesterType', semester % 2 === 0 ? 'even' : 'odd');
                    formik.setFieldValue('departmentId', String(meta.departmentId ?? ''));
                    setSelectedDepartment(String(meta.departmentCode ?? ''));
                    formik.setFieldValue(
                      'branchDepartmentIds',
                      meta.departmentId ? [String(meta.departmentId)] : [],
                    );
                    formik.setFieldValue(
                      'branches',
                      meta.departmentCode ? [String(meta.departmentCode)] : [],
                    );
                    formik.setFieldValue('program', String(meta.program ?? ''));
                    formik.setFieldValue('semester', semester);
                    formik.setFieldValue('section', String(meta.sectionName ?? ''));
                  }}
                  error={t.sectionId && e.sectionId ? String(e.sectionId) : undefined}
                  emptyMessage="No configured sections found. Create a batch and section in Academic Structure first."
                />
              </div>
            ) : editing ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">Whole-cohort timetable</p>
                <p className="mt-1 text-xs text-slate-500">
                  {editing.program} · Semester {editing.semester} · {selectedDepartment} ·{' '}
                  {editing.academicYear}. This timetable intentionally has no section.
                </p>
              </div>
            ) : (
              <section className="space-y-4 rounded-xl bg-slate-50 p-4">
                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-700">Timetable applies to</p>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setScopeMode('direct');
                        setPlanner((current) => ({ ...current, sectionIds: [] }));
                        formik.setFieldValue('sectionId', '');
                        formik.setFieldValue('section', '');
                      }}
                      className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        scopeMode === 'direct'
                          ? 'bg-primary text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Whole cohort (no sections) · Select departments
                    </button>
                    <button
                      type="button"
                      onClick={() => setScopeMode('sections')}
                      className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        scopeMode === 'sections'
                          ? 'bg-primary text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Specific sections
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Use whole cohort when the institution does not divide this semester into
                    sections.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <AsyncSelect
                    label="Academic Year"
                    type="academicYears"
                    value={planner.academicYear || null}
                    onChange={(academicYear) => {
                      setPlanner({
                        academicYear: academicYear ?? '',
                        curriculumId: '',
                        program: '',
                        semesterNo: '',
                        departmentIds: [],
                        sectionIds: [],
                      });
                      formik.setFieldValue('sectionId', '');
                    }}
                    required
                    placeholder="Select academic year"
                  />
                  {scopeMode === 'direct' ? (
                    <AsyncSelect
                      label="Curriculum / Programme"
                      type="curricula"
                      value={planner.curriculumId || null}
                      onChange={(curriculumId, option) => {
                        const program = option?.label ?? '';
                        setPlanner((current) => ({
                          ...current,
                          curriculumId: curriculumId ?? '',
                          program,
                          semesterNo: '',
                          departmentIds: [],
                          sectionIds: [],
                        }));
                        formik.setFieldValue('curriculumId', curriculumId ?? '');
                        formik.setFieldValue('program', program);
                      }}
                      disabled={!planner.academicYear}
                      required
                      placeholder="Select curriculum"
                    />
                  ) : (
                    <AsyncSelect
                      label="Programme"
                      type="programs"
                      value={planner.program || null}
                      onChange={(program) => {
                        setPlanner((current) => ({
                          ...current,
                          curriculumId: '',
                          program: program ?? '',
                          semesterNo: '',
                          departmentIds: [],
                          sectionIds: [],
                        }));
                        formik.setFieldValue('sectionId', '');
                      }}
                      disabled={!planner.academicYear}
                      required
                      placeholder={
                        planner.academicYear ? 'Select programme' : 'Select academic year first'
                      }
                    />
                  )}
                  <AsyncSelect
                    label="Semester"
                    type="semesters"
                    params={{
                      configured: scopeMode === 'sections',
                      academicYear: planner.academicYear,
                      program: planner.program,
                      curriculumId: planner.curriculumId,
                    }}
                    value={planner.semesterNo || null}
                    onChange={(semesterNo) => {
                      setPlanner((current) => ({
                        ...current,
                        semesterNo: semesterNo ?? '',
                        departmentIds: [],
                        sectionIds: [],
                      }));
                      formik.setFieldValue('sectionId', '');
                      formik.setFieldValue('academicYear', planner.academicYear);
                      formik.setFieldValue('semester', Number(semesterNo));
                      formik.setFieldValue(
                        'semesterType',
                        Number(semesterNo) % 2 === 0 ? 'even' : 'odd',
                      );
                    }}
                    disabled={!planner.program}
                    required
                    placeholder={
                      planner.program ? 'Select configured semester' : 'Select programme first'
                    }
                    emptyMessage={
                      scopeMode === 'direct'
                        ? 'No semester is configured in the selected curriculum.'
                        : 'No configured sections exist for this programme and academic year.'
                    }
                  />
                  {scopeMode === 'direct' ? (
                    <div className="rounded-xl bg-blue-50 px-4 py-3 sm:col-span-2">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-blue-900">
                            Departments rendered in the calendar
                          </p>
                          <p className="mt-1 text-xs leading-5 text-blue-700">
                            All linked departments are selected initially. Remove any department to
                            render only the remaining rows.
                          </p>
                        </div>
                        {planner.departmentIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setPlanner((current) => ({ ...current, departmentIds: [] }))
                            }
                            className="shrink-0 text-xs font-semibold text-primary hover:underline"
                          >
                            Select all
                          </button>
                        )}
                      </div>
                      {planner.curriculumId && planner.semesterNo ? (
                        <AsyncSelect
                          label="Departments / Branches"
                          type="departments"
                          multiple
                          limit={100}
                          params={{
                            program: planner.program,
                            curriculumId: planner.curriculumId,
                          }}
                          value={planner.departmentIds}
                          autoSelectAll={planner.departmentIds.length === 0}
                          onChange={(departmentIds) => {
                            setPlanner((current) => ({
                              ...current,
                              departmentIds,
                              sectionIds: [],
                            }));
                            formik.setFieldValue('sectionId', '');
                            formik.setFieldValue('departmentId', departmentIds[0] ?? '');
                            formik.setFieldValue('branchDepartmentIds', departmentIds);
                          }}
                          required
                          placeholder="Select one or more departments"
                          emptyMessage="No active department is linked to this programme."
                        />
                      ) : (
                        <p className="rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-500">
                          Select the programme and semester to load its departments.
                        </p>
                      )}
                    </div>
                  ) : (
                    <AsyncSelect
                      label="Departments / Branches"
                      type="departments"
                      multiple
                      params={{ program: planner.program }}
                      value={planner.departmentIds}
                      onChange={(departmentIds) => {
                        setPlanner((current) => ({ ...current, departmentIds, sectionIds: [] }));
                        formik.setFieldValue('sectionId', '');
                        formik.setFieldValue('departmentId', departmentIds[0] ?? '');
                        formik.setFieldValue('branchDepartmentIds', departmentIds);
                      }}
                      disabled={!planner.semesterNo}
                      required
                      placeholder={
                        planner.semesterNo ? 'Select one or more branches' : 'Select semester first'
                      }
                    />
                  )}
                </div>
                {scopeMode === 'sections' && (
                  <AsyncSelect
                    label="Sections"
                    type="sections"
                    multiple
                    limit={100}
                    params={{
                      academicYear: planner.academicYear,
                      program: planner.program,
                      semesterNo: planner.semesterNo,
                      departmentIds: planner.departmentIds.join(','),
                    }}
                    value={planner.sectionIds}
                    onChange={(sectionIds, options) => {
                      setPlanner((current) => ({ ...current, sectionIds }));
                      const first = options?.[0];
                      const meta = first?.meta;
                      formik.setFieldValue('sectionId', sectionIds[0] ?? '');
                      if (meta) {
                        const semester = Number(meta.semesterNo);
                        formik.setFieldValue('academicYear', String(meta.academicYear ?? ''));
                        formik.setFieldValue('semesterType', semester % 2 === 0 ? 'even' : 'odd');
                        formik.setFieldValue('departmentId', String(meta.departmentId ?? ''));
                        formik.setFieldValue('program', String(meta.program ?? ''));
                        formik.setFieldValue('semester', semester);
                        formik.setFieldValue('section', String(meta.sectionName ?? ''));
                      }
                    }}
                    disabled={!planner.departmentIds.length}
                    required
                    placeholder={
                      planner.departmentIds.length
                        ? 'Select sections to prepare'
                        : 'Select branches first'
                    }
                    emptyMessage="No sections match this academic context. Configure them in Academic Structure."
                  />
                )}
                {scopeMode === 'sections' && planner.departmentIds.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                    <span>
                      {canCreateSections
                        ? 'Missing a section? Create it in Academic Structure, then reopen this selector.'
                        : 'Missing sections must be configured by an authorized Academic Structure administrator.'}
                    </span>
                    {canCreateSections && (
                      <a
                        href="academic-structure"
                        className="font-semibold text-primary hover:underline"
                      >
                        Create Sections
                      </a>
                    )}
                  </div>
                )}
              </section>
            )}

            {editing && f.sectionId && (
              <section className="overflow-hidden rounded-xl border border-slate-200">
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-800">Selected class details</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    These values are controlled by Academic Structure and cannot conflict.
                  </p>
                </div>
                <dl className="grid sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ['Programme', f.program || '—'],
                    ['Academic Year', f.academicYear || '—'],
                    ['Semester', f.semester ? `Semester ${f.semester}` : '—'],
                    ['Term', f.semesterType === 'odd' ? 'Odd Semester' : 'Even Semester'],
                    ['Section', f.section ? `Section ${f.section}` : '—'],
                    ['Department / Branch', selectedDepartment || '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="border-b border-r border-slate-100 px-4 py-3">
                      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                        {label}
                      </dt>
                      <dd className="mt-1 text-sm font-medium text-slate-700">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            <section className="rounded-xl bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-800">Calendar time range</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                The timetable calendar will render from this start time through this end time.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Start time *</label>
                  <input
                    type="time"
                    name="scheduleStartTime"
                    value={f.scheduleStartTime ?? ''}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    disabled={Boolean(editing?.isApproved)}
                    className={inputCls}
                  />
                  {t.scheduleStartTime && e.scheduleStartTime && (
                    <p className={errCls}>{String(e.scheduleStartTime)}</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>End time *</label>
                  <input
                    type="time"
                    name="scheduleEndTime"
                    value={f.scheduleEndTime ?? ''}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    disabled={Boolean(editing?.isApproved)}
                    className={inputCls}
                  />
                  {t.scheduleEndTime && e.scheduleEndTime && (
                    <p className={errCls}>{String(e.scheduleEndTime)}</p>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-xl bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-800">Publication details</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                These details appear on the official printable timetable.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelCls}>Timetable title</label>
                  <input
                    name="title"
                    value={f.title ?? ''}
                    onChange={formik.handleChange}
                    placeholder="For example, 7th Semester B.Tech Timetable"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Effective from *</label>
                  <input
                    type="date"
                    name="effectiveFrom"
                    value={f.effectiveFrom ?? ''}
                    onChange={formik.handleChange}
                    className={inputCls}
                  />
                  {t.effectiveFrom && e.effectiveFrom && (
                    <p className={errCls}>{String(e.effectiveFrom)}</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Effective to</label>
                  <input
                    type="date"
                    name="effectiveTo"
                    value={f.effectiveTo ?? ''}
                    onChange={formik.handleChange}
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Document / reference number</label>
                  <input
                    name="documentNo"
                    value={f.documentNo ?? ''}
                    onChange={formik.handleChange}
                    placeholder="Optional"
                    className={inputCls}
                  />
                </div>
              </div>
            </section>
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton
              variant="primary"
              type="submit"
              loading={saving}
              disabled={
                editing
                  ? Boolean(editing.sectionId && !f.sectionId)
                  : scopeMode === 'sections'
                    ? planner.sectionIds.length === 0
                    : !planner.academicYear ||
                      !planner.curriculumId ||
                      !planner.semesterNo ||
                      planner.departmentIds.length === 0
              }
            >
              {editing
                ? editing.isApproved
                  ? 'Update Document Details'
                  : 'Update Timetable'
                : scopeMode === 'direct'
                  ? 'Create Whole-Cohort Timetable'
                  : `Create ${planner.sectionIds.length || ''} Timetable${planner.sectionIds.length === 1 ? '' : 's'}`}
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLOT MODAL (add/edit individual period slot inside a timetable)
// ═══════════════════════════════════════════════════════════════════════════════
interface SlotModalProps {
  timetable: ITimetable;
  editSlot?: { slot: ITimetableSlot; index: number } | null;
  defaultDay?: TDay;
  defaultStartTime?: string;
  defaultBranchDepartmentId?: string;
  defaultBranch?: string;
  onClose: () => void;
  onSaved: (updatedTimetable?: ITimetable) => void;
}

type SlotForm = {
  day: TDay;
  periodNo: number;
  startTime: string;
  endTime: string;
  slotKind: 'teaching' | 'break' | 'activity';
  title: string;
  subjectId: string;
  subjectCode: string;
  subjectShortName: string;
  subjectName: string;
  facultyId: string;
  facultyName: string;
  facultyCode: string;
  roomId: string;
  roomNo: string;
  classType: 'theory' | 'lab' | 'tutorial';
  labBatch: string;
  branchDepartmentId: string;
  branch: string;
  branchDepartmentIds: string[];
  branches: string[];
  isCombined: boolean;
};

export function SlotModal({
  timetable,
  editSlot,
  defaultDay,
  defaultStartTime,
  defaultBranchDepartmentId,
  defaultBranch,
  onClose,
  onSaved,
}: SlotModalProps) {
  const { mutation, isLoading: saving } = useMutation();
  const [combinedMode, setCombinedMode] = React.useState(Boolean(editSlot?.slot.isCombined));
  const initialStartTime =
    editSlot?.slot.startTime ?? defaultStartTime ?? timetable.scheduleStartTime ?? '09:00';

  const formik = useFormik<SlotForm>({
    initialValues: {
      day: editSlot?.slot.day ?? defaultDay ?? 'Monday',
      periodNo: editSlot?.slot.periodNo ?? 1,
      startTime: initialStartTime,
      endTime: editSlot?.slot.endTime ?? addMinutes(initialStartTime, 50),
      slotKind: editSlot?.slot.slotKind ?? 'teaching',
      title: editSlot?.slot.title ?? '',
      subjectId: editSlot?.slot.subjectId ?? '',
      subjectCode: editSlot?.slot.subjectCode ?? '',
      subjectShortName: editSlot?.slot.subjectShortName ?? '',
      subjectName: editSlot?.slot.subjectName ?? '',
      facultyId: editSlot?.slot.facultyId ?? '',
      facultyName: editSlot?.slot.facultyName ?? '',
      facultyCode: editSlot?.slot.facultyCode ?? '',
      roomNo: editSlot?.slot.roomNo ?? '',
      roomId: editSlot?.slot.roomId ?? '',
      classType: editSlot?.slot.classType ?? 'theory',
      labBatch: editSlot?.slot.labBatch ?? '',
      branchDepartmentId:
        editSlot?.slot.branchDepartmentId ??
        defaultBranchDepartmentId ??
        (timetable.branchDepartmentIds?.length === 1 ? timetable.branchDepartmentIds[0]! : ''),
      branch:
        editSlot?.slot.branch ??
        defaultBranch ??
        (timetable.branches?.length === 1 ? timetable.branches[0]! : ''),
      branchDepartmentIds:
        editSlot?.slot.branchDepartmentIds ??
        (defaultBranchDepartmentId ? [defaultBranchDepartmentId] : []),
      branches: editSlot?.slot.branches ?? (defaultBranch ? [defaultBranch] : []),
      isCombined: editSlot?.slot.isCombined ?? false,
    },
    enableReinitialize: true,
    validationSchema: slotSchema,
    validate: (values) => {
      const errors: Partial<Record<keyof SlotForm, string>> = {};
      if (values.slotKind === 'teaching') {
        if (combinedMode && values.branchDepartmentIds.length < 2) {
          errors.branchDepartmentIds = 'Select at least two branches';
        } else if (!values.isCombined && !values.branchDepartmentId) {
          errors.branchDepartmentId = 'Select a branch';
        }
        if (!values.subjectId) errors.subjectId = 'Select a subject';
        if (!values.facultyId) errors.facultyId = 'Select a faculty member';
        if (!values.roomNo) errors.roomNo = 'Select a room or laboratory';
      } else if (!values.title.trim()) {
        errors.title = 'Enter a title for this block';
      }
      const excludeIndex = editSlot?.index;
      const existingSlots = timetable.slots ?? [];
      const conflict = detectConflict(
        {
          day: values.day,
          startTime: values.startTime,
          endTime: values.endTime,
          facultyId: values.facultyId,
          roomNo: values.roomNo,
        },
        existingSlots,
        excludeIndex,
      );
      if (conflict) errors.startTime = conflict;
      return errors;
    },
    onSubmit: async (values) => {
      // Build updated slots array
      const slots = [...(timetable.slots ?? [])];
      const combinedDepartmentIds = combinedMode
        ? values.branchDepartmentIds.length >= 2
          ? values.branchDepartmentIds
          : (timetable.branchDepartmentIds ?? [])
        : [values.branchDepartmentId].filter(Boolean);
      const combinedBranchCodes = combinedDepartmentIds
        .map((departmentId) => {
          const index = (timetable.branchDepartmentIds ?? []).indexOf(departmentId);
          return index >= 0 ? timetable.branches?.[index] : undefined;
        })
        .filter((branch): branch is string => Boolean(branch));
      const saveAsCombined = combinedMode && combinedDepartmentIds.length >= 2;
      const slotData: ITimetableSlot = {
        day: values.day,
        periodNo: values.periodNo,
        startTime: values.startTime,
        endTime: values.endTime,
        slotKind: values.slotKind,
        title: values.title || undefined,
        subjectId: values.slotKind === 'teaching' ? values.subjectId || undefined : undefined,
        subjectCode: values.slotKind === 'teaching' ? values.subjectCode : '',
        subjectShortName: values.slotKind === 'teaching' ? values.subjectShortName : undefined,
        subjectName: values.slotKind === 'teaching' ? values.subjectName : values.title,
        facultyId: values.slotKind === 'teaching' ? values.facultyId || undefined : undefined,
        facultyName: values.slotKind === 'teaching' ? values.facultyName : '',
        facultyCode: values.slotKind === 'teaching' ? values.facultyCode || undefined : undefined,
        roomId: values.slotKind === 'teaching' ? values.roomId || undefined : undefined,
        roomNo: values.slotKind === 'teaching' ? values.roomNo : '',
        classType: values.classType,
        labBatch: values.labBatch || undefined,
        isCombined: saveAsCombined,
        branches: saveAsCombined ? combinedBranchCodes : [values.branch].filter(Boolean),
        branchDepartmentId: values.branchDepartmentId,
        branchDepartmentIds: combinedDepartmentIds,
        branch: saveAsCombined ? undefined : values.branch,
      };

      if (editSlot !== undefined && editSlot !== null) {
        slots[editSlot.index] = slotData;
      } else {
        slots.push(slotData);
      }

      const res = await mutation(`timetable/${timetable._id}`, {
        method: 'PUT',
        body: {
          ...timetable,
          curriculumId:
            typeof timetable.curriculumId === 'object'
              ? timetable.curriculumId._id
              : timetable.curriculumId,
          departmentId:
            typeof timetable.departmentId === 'object'
              ? timetable.departmentId._id
              : timetable.departmentId,
          sectionId:
            typeof timetable.sectionId === 'object' ? timetable.sectionId._id : timetable.sectionId,
          slots: slots.map((slot) => {
            const { branch, ...rest } = slot;
            return {
              ...rest,
              ...(typeof branch === 'string' && branch.trim()
                ? { branch: branch.trim().toUpperCase() }
                : {}),
            };
          }),
        },
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success(editSlot ? 'Slot updated' : 'Slot added');
        onSaved((res as { results?: { data?: ITimetable } }).results?.data);
      }
    },
  });

  const f = formik.values;
  const e = formik.errors;
  const t = formik.touched;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
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
        transition={{ duration: 0.2 }}
        className="relative z-10 flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white "
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
        >
          <X className="h-4.5 w-4.5" />
        </button>
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary">
            <BookOpen className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {editSlot ? 'Edit Slot' : 'Add Slot'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {timetable.program} · Semester {timetable.semester} ·{' '}
              {timetable.section ? `Section ${timetable.section}` : 'Whole cohort'} ·{' '}
              {timetable.academicYear}
            </p>
          </div>
        </div>

        <form onSubmit={formik.handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {e.startTime && t.startTime && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {e.startTime}
              </div>
            )}

            <div className="grid items-start gap-4 lg:grid-cols-[0.9fr_1.4fr]">
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-slate-800">Schedule</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Choose the day, period and exact class timing.
                  </p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>Block type *</label>
                    <select
                      name="slotKind"
                      value={f.slotKind}
                      onChange={formik.handleChange}
                      className={inputCls}
                    >
                      <option value="teaching">Teaching class</option>
                      <option value="break">Break / lunch</option>
                      <option value="activity">Activity / seminar / sports</option>
                    </select>
                  </div>
                  {f.slotKind !== 'teaching' && (
                    <div>
                      <label className={labelCls}>Block title *</label>
                      <input
                        name="title"
                        value={f.title}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        placeholder={f.slotKind === 'break' ? 'Lunch' : 'Seminar / Yoga / Project'}
                        className={inputCls}
                      />
                      {t.title && e.title && <p className={errCls}>{e.title}</p>}
                    </div>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <div>
                      <label className={labelCls}>Day *</label>
                      <select
                        name="day"
                        value={f.day}
                        onChange={formik.handleChange}
                        className={inputCls}
                      >
                        {DAYS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Period Number *</label>
                      <input
                        type="number"
                        name="periodNo"
                        value={f.periodNo}
                        onChange={formik.handleChange}
                        min={1}
                        max={10}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Start Time *</label>
                      <input
                        type="time"
                        name="startTime"
                        value={f.startTime}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>End Time *</label>
                      <input
                        type="time"
                        name="endTime"
                        value={f.endTime}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        className={inputCls}
                      />
                      {t.endTime && e.endTime && !e.startTime?.includes('conflict') && (
                        <p className={errCls}>{e.endTime}</p>
                      )}
                    </div>
                  </div>
                  {f.slotKind === 'teaching' && (
                    <div className="space-y-4">
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-900">
                        <input
                          type="checkbox"
                          checked={combinedMode}
                          onChange={(event) => {
                            const combined = event.target.checked;
                            setCombinedMode(combined);
                            formik.setFieldValue('isCombined', combined);
                            formik.setFieldValue(
                              'branchDepartmentIds',
                              combined ? (timetable.branchDepartmentIds ?? []) : [],
                            );
                            formik.setFieldValue(
                              'branches',
                              combined ? (timetable.branches ?? []) : [],
                            );
                            if (combined) {
                              formik.setFieldValue(
                                'branchDepartmentId',
                                timetable.branchDepartmentIds?.[0] ?? f.branchDepartmentId,
                              );
                              formik.setFieldValue('branch', timetable.branches?.[0] ?? f.branch);
                            }
                          }}
                          className="h-4 w-4 accent-emerald-600"
                        />
                        Combined / common class for multiple branches
                      </label>
                      {combinedMode ? (
                        <div>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className={labelCls}>Participating branches *</span>
                            <button
                              type="button"
                              onClick={() => {
                                formik.setFieldValue(
                                  'branchDepartmentIds',
                                  timetable.branchDepartmentIds ?? [],
                                );
                                formik.setFieldValue('branches', timetable.branches ?? []);
                                formik.setFieldValue(
                                  'branchDepartmentId',
                                  timetable.branchDepartmentIds?.[0] ?? '',
                                );
                                formik.setFieldValue('branch', timetable.branches?.[0] ?? '');
                              }}
                              className="text-[11px] font-semibold text-primary hover:underline"
                            >
                              Select all branches
                            </button>
                          </div>
                          <AsyncSelect
                            type="departments"
                            multiple
                            limit={100}
                            params={{
                              curriculumId:
                                typeof timetable.curriculumId === 'object'
                                  ? timetable.curriculumId._id
                                  : timetable.curriculumId,
                              departmentIds: timetable.branchDepartmentIds?.join(','),
                            }}
                            value={f.branchDepartmentIds}
                            onChange={(values, options) => {
                              const codes = values.map((departmentId) => {
                                const timetableIndex = (
                                  timetable.branchDepartmentIds ?? []
                                ).indexOf(departmentId);
                                if (timetableIndex >= 0) {
                                  return timetable.branches?.[timetableIndex] ?? '';
                                }
                                const option = (options ?? []).find(
                                  (candidate) => candidate.value === departmentId,
                                );
                                return String(option?.meta?.code ?? option?.sub ?? '');
                              });
                              formik.setFieldValue('branchDepartmentIds', values);
                              formik.setFieldValue('branches', codes);
                              formik.setFieldValue('branchDepartmentId', values[0] ?? '');
                              formik.setFieldValue('branch', codes[0] ?? '');
                              formik.setFieldValue('subjectId', '');
                              formik.setFieldValue('subjectCode', '');
                              formik.setFieldValue('subjectShortName', '');
                              formik.setFieldValue('subjectName', '');
                              formik.setFieldValue('facultyId', '');
                              formik.setFieldValue('facultyName', '');
                            }}
                            error={
                              t.branchDepartmentIds && e.branchDepartmentIds
                                ? String(e.branchDepartmentIds)
                                : undefined
                            }
                            placeholder="Select two or more branches"
                          />
                        </div>
                      ) : (
                        <AsyncSelect
                          label="Department / Branch"
                          type="departments"
                          params={{
                            curriculumId:
                              typeof timetable.curriculumId === 'object'
                                ? timetable.curriculumId._id
                                : timetable.curriculumId,
                            departmentIds: timetable.branchDepartmentIds?.join(','),
                          }}
                          value={f.branchDepartmentId || null}
                          onChange={(value, option) => {
                            formik.setFieldValue('branchDepartmentId', value ?? '');
                            formik.setFieldValue(
                              'branch',
                              String(option?.meta?.code ?? option?.sub ?? ''),
                            );
                            formik.setFieldValue('subjectId', '');
                            formik.setFieldValue('subjectCode', '');
                            formik.setFieldValue('subjectShortName', '');
                            formik.setFieldValue('subjectName', '');
                            formik.setFieldValue('facultyId', '');
                            formik.setFieldValue('facultyName', '');
                          }}
                          error={
                            t.branchDepartmentId && e.branchDepartmentId
                              ? String(e.branchDepartmentId)
                              : undefined
                          }
                          required
                          disabled={(timetable.branchDepartmentIds?.length ?? 0) === 1}
                          placeholder="Select the branch lane"
                          emptyMessage="No active branch is linked to this timetable curriculum."
                        />
                      )}
                      <label className={labelCls}>Class Type *</label>
                      <select
                        name="classType"
                        value={f.classType}
                        onChange={(event) => {
                          formik.handleChange(event);
                          formik.setFieldValue('roomId', '');
                          formik.setFieldValue('roomNo', '');
                          if (event.target.value !== 'lab') formik.setFieldValue('labBatch', '');
                        }}
                        className={inputCls}
                      >
                        <option value="theory">Theory</option>
                        <option value="lab">Laboratory</option>
                        <option value="tutorial">Tutorial</option>
                      </select>
                    </div>
                  )}

                  <div className="rounded-lg bg-blue-50 px-3 py-2.5 text-[11px] leading-5 text-blue-700">
                    This slot belongs to the selected timetable scope and configured branch.
                    Institution-wide schedules are assembled in the master timetable view.
                  </div>
                </div>
              </section>

              {f.slotKind === 'teaching' && (
                <section className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-800">Teaching assignment</h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Subject options follow this class curriculum and semester.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <AsyncSelect
                      label="Subject"
                      type="subjects"
                      params={{
                        curriculumId:
                          typeof timetable.curriculumId === 'object'
                            ? timetable.curriculumId._id
                            : timetable.curriculumId,
                        semesterNo: timetable.semester,
                      }}
                      value={f.subjectId || null}
                      disabled={!timetable.curriculumId || !timetable.semester}
                      onChange={(value, option) => {
                        formik.setFieldValue('subjectId', value ?? '');
                        formik.setFieldValue('subjectName', option?.label ?? '');
                        formik.setFieldValue('subjectCode', option?.sub?.split(' · ')[0] ?? '');
                        formik.setFieldValue(
                          'subjectShortName',
                          String(option?.meta?.shortName ?? option?.label ?? ''),
                        );
                      }}
                      error={t.subjectId && e.subjectId ? String(e.subjectId) : undefined}
                      required
                      placeholder="Search curriculum subjects"
                      emptyMessage="No active subject is assigned to this programme curriculum semester."
                    />

                    <AsyncSelect
                      label="Faculty"
                      type="faculty"
                      params={{
                        includeAllTeachingFaculty: true,
                        departmentId: f.branchDepartmentId,
                        academicYear: timetable.academicYear,
                        semesterType: timetable.semesterType,
                        day: f.day,
                        startTime: f.startTime,
                        endTime: f.endTime,
                        excludeTimetableId: timetable._id,
                      }}
                      value={f.facultyId || null}
                      onChange={(value, option) => {
                        formik.setFieldValue('facultyId', value ?? '');
                        formik.setFieldValue('facultyName', option?.label ?? '');
                        formik.setFieldValue('facultyCode', option?.sub?.split(' · ')[0] ?? '');
                      }}
                      error={t.facultyId && e.facultyId ? String(e.facultyId) : undefined}
                      required
                      placeholder="Search faculty name or employee code"
                      emptyMessage="No active teaching faculty is configured for this institution."
                    />

                    <div className={f.classType === 'lab' ? 'grid gap-4 sm:grid-cols-2' : ''}>
                      <div>
                        <AsyncSelect
                          label={f.classType === 'lab' ? 'Laboratory' : 'Classroom'}
                          type="facilitySpaces"
                          params={{ spaceType: f.classType === 'lab' ? 'laboratory' : undefined }}
                          value={f.roomId || null}
                          onChange={(roomId, option) => {
                            formik.setFieldValue('roomId', roomId ?? '');
                            formik.setFieldValue('roomNo', option?.label.split(' — ')[0] ?? '');
                          }}
                          error={t.roomNo && e.roomNo ? String(e.roomNo) : undefined}
                          required
                          placeholder={
                            f.roomNo ? `Current: ${f.roomNo}` : 'Search room or laboratory'
                          }
                          emptyMessage="No matching active facility space is configured."
                        />
                      </div>
                      {f.classType === 'lab' && (
                        <div>
                          <label className={labelCls}>Student Lab Batch</label>
                          <input
                            name="labBatch"
                            value={f.labBatch}
                            onChange={formik.handleChange}
                            placeholder="For example, A1"
                            className={inputCls}
                          />
                          <p className="mt-1 text-[11px] text-slate-600">
                            Optional group for split practical sessions.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton variant="primary" type="submit" loading={saving}>
              {editSlot ? 'Update Slot' : 'Add Slot'}
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

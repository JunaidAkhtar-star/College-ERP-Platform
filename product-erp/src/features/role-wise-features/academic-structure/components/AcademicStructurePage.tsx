'use client';

import AcademicWorkflowBar from '@/shared/components/AcademicWorkflowBar';
import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Column } from '@/shared/core/CustomTable';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { useAuthStore } from '@/shared/store/authStore';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import {
  ArrowRightLeft,
  Award,
  BookOpen,
  CheckCircle,
  Edit2,
  Info,
  Layers,
  Plus,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
  UploadCloud,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import type { IBatch, ISection, IStudentSectionAllotment } from '../types/academic-structure.types';
import ImportMigrationDialog from '../../import-center/components/ImportMigrationDialog';

const inputCls =
  'w-full rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none ring-1 ring-slate-200 focus:bg-white focus:ring-primary';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

type Tab = 'batches' | 'sections' | 'allotments';
type BatchForm = {
  id?: string;
  curriculumId: string;
  departmentId: string;
  admissionYear: string;
  intake: string;
};
type SectionForm = {
  id?: string;
  academicYear: string;
  batchId: string;
  semesterNo: string;
  sectionName: string;
  capacity: string;
};
type Filters = {
  academicYear: string;
  departmentId: string;
  curriculumId: string;
  batchId: string;
  semesterNo: string;
};
type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
type BulkStrategy = 'sequential' | 'balanced' | 'merit_rank';
type BulkPreview = {
  eligibleCount: number;
  alreadyAllotted: number;
  unassigned: Array<{ userId: string }>;
  assignments: Array<{ userId: string }>;
  sections: Array<{
    id: string;
    name: string;
    capacity: number;
    allottedCount: number;
    plannedCount: number;
    newStudents: number;
  }>;
};

function statusTone(status: string): StatusTone {
  const normalized = status.toLowerCase();
  if (normalized.includes('active') || normalized.includes('open')) return 'success';
  if (normalized.includes('planned')) return 'neutral';
  if (normalized.includes('pending')) return 'warning';
  if (normalized.includes('cancel') || normalized.includes('full')) return 'danger';
  if (normalized.includes('passed') || normalized.includes('locked')) return 'info';
  return 'neutral';
}

function statusToneClass(status: string) {
  const tone = statusTone(status);
  switch (tone) {
    case 'success':
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
    case 'warning':
      return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
    case 'danger':
      return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200';
    case 'info':
      return 'bg-sky-50 text-sky-700 ring-1 ring-sky-200';
    default:
      return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
  }
}

function unwrapList<T>(raw: unknown): T[] {
  const payload = (raw as { data?: T[] | { data?: T[] } })?.data;
  return Array.isArray(payload) ? payload : ((payload as { data?: T[] })?.data ?? []);
}

function formatAcademicYear(startYear: number) {
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

function useDebounce<T>(value: T, delay = 250): T {
  const [v, setV] = useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

function displayBatchName(batch: IBatch) {
  const standardizedName = `${batch.program} ${batch.departmentCode} ${formatAcademicYear(batch.admissionYear)}`;
  return batch.name?.replace(/\s\d{4}(?:-\d{2})?$/, '')
    ? `${batch.name.replace(/\s\d{4}(?:-\d{2})?$/, '')} ${formatAcademicYear(batch.admissionYear)}`
    : standardizedName;
}

function academicYearsForBatch(batch?: IBatch) {
  if (!batch) return [];
  const finalStartYear = Math.max(batch.admissionYear, batch.expectedGraduationYear - 1);
  return Array.from({ length: finalStartYear - batch.admissionYear + 1 }, (_, index) =>
    formatAcademicYear(batch.admissionYear + index),
  );
}

function academicYearForSemester(
  batch: IBatch | undefined,
  semester: string,
  fallbackAdmissionYear?: number,
) {
  if (!semester) return '';
  const startYear = batch?.admissionYear ?? fallbackAdmissionYear;
  if (!startYear) return '';
  return formatAcademicYear(startYear + Math.floor((Number(semester) - 1) / 2));
}

const emptyBatchForm = (): BatchForm => ({
  curriculumId: '',
  departmentId: '',
  admissionYear: '',
  intake: '60',
});

const emptySectionForm = (): SectionForm => ({
  academicYear: '',
  batchId: '',
  semesterNo: '1',
  sectionName: 'A',
  capacity: '60',
});

function idOf(value: unknown) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return ((value as { _id?: string })?._id ?? '').toString();
}

function displayStudent(value: unknown, fallback: string) {
  if (!value || typeof value === 'string') return fallback;
  const student = value as { name?: string; email?: string; firstName?: string; lastName?: string };
  return (
    student.name || [student.firstName, student.lastName].filter(Boolean).join(' ') || fallback
  );
}

function displaySection(value: unknown, fallback: string) {
  if (!value || typeof value === 'string') return fallback;
  const section = value as { sectionName?: string; semesterNo?: number; academicYear?: string };
  return `Sem ${section.semesterNo ?? '-'} - ${section.sectionName ?? '-'} · ${section.academicYear ?? ''}`;
}

export default function AcademicStructurePage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const user = useAuthStore((state) => state.user);
  const isDepartmentHod = activeRole === 'hod';
  const hodDepartmentId = isDepartmentHod ? (user?.departmentId ?? user?.department ?? '') : '';
  const canCreateBatch = useHasPermission('batch_management', 'create');
  const canStageImport = useHasPermission('import_center', 'create');
  const canImport = canCreateBatch && canStageImport;
  const canEditBatch = useHasPermission('batch_management', 'edit');
  const canCreateSection = useHasPermission('section_management', 'create');
  const canEditSection = useHasPermission('section_management', 'edit');
  const canApproveSection = useHasPermission('section_management', 'approve');
  const canPreviewAllotment = useHasPermission('student_allotment', 'view');
  const canCreateAllotment = useHasPermission('student_allotment', 'create');
  const canTransferAllotment = useHasPermission('student_allotment', 'edit');
  const canApproveAllotment = useHasPermission('student_allotment', 'approve');
  const [tab, setTab] = useState<Tab>('batches');
  const [filters, setFilters] = useState<Filters>({
    academicYear: '',
    departmentId: hodDepartmentId,
    curriculumId: '',
    batchId: '',
    semesterNo: '',
  });
  const { mutation, isLoading } = useMutation();
  const [batchSearch, setBatchSearch] = useState('');
  const debouncedBatchSearch = useDebounce(batchSearch.trim(), 300);

  const batchQuery = useMemo(() => {
    const qs = new URLSearchParams({ limit: '500' });
    if (debouncedBatchSearch) qs.set('q', debouncedBatchSearch);
    if (filters.curriculumId) qs.set('curriculumId', filters.curriculumId);
    if (filters.departmentId) qs.set('departmentId', filters.departmentId);
    if (filters.academicYear) {
      const startYear = Number(filters.academicYear.slice(0, 4));
      if (!isNaN(startYear)) qs.set('admissionYear', String(startYear));
    }
    return `batch?${qs.toString()}`;
  }, [debouncedBatchSearch, filters.curriculumId, filters.departmentId, filters.academicYear]);

  const {
    data: batchesRaw,
    mutate: reloadBatches,
    isValidating: isValidatingBatches,
  } = useSwr(batchQuery);
  const { data: sectionsRaw, mutate: reloadSections } = useSwr('section?limit=500');
  const { data: allotmentsRaw, mutate: reloadAllotments } = useSwr(
    'student-section-allotment?limit=500',
  );

  const batches = useMemo(() => unwrapList<IBatch>(batchesRaw), [batchesRaw]);
  const sections = useMemo(() => unwrapList<ISection>(sectionsRaw), [sectionsRaw]);
  const allotments = useMemo(
    () => unwrapList<IStudentSectionAllotment>(allotmentsRaw),
    [allotmentsRaw],
  );

  const [batchForm, setBatchForm] = useState<BatchForm>(emptyBatchForm);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showAutoAllotModal, setShowAutoAllotModal] = useState(false);
  const [showManualAllotModal, setShowManualAllotModal] = useState(false);

  const batchColumns = useMemo<Column<IBatch>[]>(
    () => [
      {
        field: 'admissionYear',
        title: 'Batch Name',
        cellClassName: '!text-center',
        headerClassName: '!text-center',
        render: (row) => (
          <div className="flex flex-col items-center justify-center">
            <p className="text-sm font-bold text-slate-800">{displayBatchName(row)}</p>
            <p className="text-xs text-slate-600">
              {row.program} · {row.departmentCode}
            </p>
          </div>
        ),
      },
      {
        field: 'regulationYear',
        title: 'Regulation',
        cellClassName: '!text-center',
        headerClassName: '!text-center',
        render: (row) => (
          <div className="flex justify-center">
            <span className="text-sm text-slate-600 font-medium">Reg {row.regulationYear}</span>
          </div>
        ),
      },
      {
        field: 'intake',
        title: 'Intake',
        cellClassName: '!text-center',
        headerClassName: '!text-center',
        render: (row) => (
          <div className="flex justify-center">
            <span className="text-sm font-medium text-slate-700">{row.intake} seats</span>
          </div>
        ),
      },
      {
        field: 'status',
        title: 'Status',
        cellClassName: '!text-center',
        headerClassName: '!text-center',
        render: (row) => (
          <div className="flex justify-center">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusToneClass(row.status)}`}
            >
              {row.status}
            </span>
          </div>
        ),
      },
    ],
    [],
  );

  const [sectionForm, setSectionForm] = useState<SectionForm>(emptySectionForm);
  const [allotForm, setAllotForm] = useState({ studentId: '', sectionId: '', rollNo: '' });
  const [bulkForm, setBulkForm] = useState<{
    batchId: string;
    academicYear: string;
    semesterNo: string;
    strategy: BulkStrategy;
  }>({
    batchId: '',
    academicYear: '',
    semesterNo: '',
    strategy: 'balanced',
  });
  const [bulkPreview, setBulkPreview] = useState<BulkPreview | null>(null);
  const [allotmentAction, setAllotmentAction] = useState<'preview' | 'execute' | 'manual' | null>(
    null,
  );
  const [transferForm, setTransferForm] = useState({
    allotmentId: '',
    toSectionId: '',
    reason: '',
  });

  const selectedSectionBatch = useMemo(
    () => batches.find((batch) => batch._id === sectionForm.batchId),
    [batches, sectionForm.batchId],
  );
  const sectionSemesterOptions = useMemo(() => {
    const curriculum = selectedSectionBatch?.curriculumId;
    const totalSemesters =
      curriculum && typeof curriculum !== 'string' ? curriculum.totalSemesters : undefined;
    return Array.from({ length: totalSemesters ?? 0 }, (_, index) => String(index + 1));
  }, [selectedSectionBatch]);
  const [bulkBatchMeta, setBulkBatchMeta] = useState<{
    totalSemesters?: number;
    admissionYear?: number;
  } | null>(null);
  const selectedBulkBatch = useMemo(
    () => batches.find((batch) => batch._id === bulkForm.batchId),
    [batches, bulkForm.batchId],
  );
  const bulkSemesterOptions = useMemo(() => {
    const curriculum = selectedBulkBatch?.curriculumId;
    const totalSemesters =
      (curriculum && typeof curriculum !== 'string' ? curriculum.totalSemesters : undefined) ??
      bulkBatchMeta?.totalSemesters ??
      (bulkForm.batchId ? 8 : 0);
    return Array.from({ length: totalSemesters }, (_, index) => String(index + 1));
  }, [selectedBulkBatch, bulkBatchMeta, bulkForm.batchId]);

  const sectionStrength = useMemo(() => {
    const map = new Map<string, number>();
    allotments.forEach((a) => {
      if (a.status !== 'Active') return;
      const sectionId = idOf(a.sectionId);
      map.set(sectionId, (map.get(sectionId) ?? 0) + 1);
    });
    return map;
  }, [allotments]);

  const sectionColumns = useMemo<Column<ISection>[]>(
    () => [
      {
        field: 'sectionName',
        title: 'Section Name',
        cellClassName: '!text-center',
        headerClassName: '!text-center',
        render: (row) => (
          <div className="flex flex-col items-center justify-center">
            <p className="text-sm font-bold text-slate-800">
              {row.program} {row.departmentCode} Sem {row.semesterNo} - {row.sectionName}
            </p>
          </div>
        ),
      },
      {
        field: 'academicYear',
        title: 'Academic Year',
        cellClassName: '!text-center',
        headerClassName: '!text-center',
        render: (row) => (
          <span className="text-sm text-slate-600 font-medium">{row.academicYear}</span>
        ),
      },
      {
        field: 'capacity',
        title: 'Capacity / Strength',
        cellClassName: '!text-center',
        headerClassName: '!text-center',
        render: (row) => {
          const strength = sectionStrength.get(row._id) ?? 0;
          const isFull = strength >= row.capacity;
          return (
            <div className="flex flex-col items-center justify-center gap-1">
              <span className="text-sm font-medium text-slate-700">
                {strength} / {row.capacity} students
              </span>
              {isFull && (
                <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                  Full
                </span>
              )}
            </div>
          );
        },
      },
      {
        field: 'status',
        title: 'Status',
        cellClassName: '!text-center',
        headerClassName: '!text-center',
        render: (row) => (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusToneClass(row.status)}`}
          >
            {row.status}
          </span>
        ),
      },
    ],
    [sectionStrength],
  );

  const allotmentColumns = useMemo<Column<IStudentSectionAllotment>[]>(
    () => [
      {
        field: 'studentId',
        title: 'Student Details',
        cellClassName: '!text-center',
        headerClassName: '!text-center',
        render: (row) => (
          <div className="flex flex-col items-center justify-center">
            <p className="text-sm font-bold text-slate-800">
              {displayStudent(row.studentId, 'Student')}
            </p>
            {row.rollNo && <p className="text-xs text-slate-600">Roll: {row.rollNo}</p>}
          </div>
        ),
      },
      {
        field: 'sectionId',
        title: 'Assigned Section',
        cellClassName: '!text-center',
        headerClassName: '!text-center',
        render: (row) => (
          <span className="text-sm font-medium text-slate-700">
            {displaySection(row.sectionId, 'Unknown')}
          </span>
        ),
      },
      {
        field: 'academicYear',
        title: 'Academic Year / Sem',
        cellClassName: '!text-center',
        headerClassName: '!text-center',
        render: (row) => (
          <span className="text-sm text-slate-600 font-medium">
            {row.academicYear} · Sem {row.semesterNo}
          </span>
        ),
      },
      {
        field: 'status',
        title: 'Status',
        cellClassName: '!text-center',
        headerClassName: '!text-center',
        render: (row) => (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusToneClass(row.status)}`}
          >
            {row.status}
          </span>
        ),
      },
    ],
    [],
  );

  const filteredBatches = batches;

  const filteredSections = useMemo(
    () =>
      sections.filter((s) => {
        if (filters.academicYear && s.academicYear !== filters.academicYear) return false;
        if (filters.curriculumId && idOf(s.curriculumId) !== filters.curriculumId) return false;
        if (filters.departmentId && idOf(s.departmentId) !== filters.departmentId) return false;
        if (filters.batchId && idOf(s.batchId) !== filters.batchId) return false;
        if (filters.semesterNo && String(s.semesterNo) !== filters.semesterNo) return false;
        return true;
      }),
    [sections, filters],
  );

  const filteredAllotments = useMemo(
    () =>
      allotments.filter((a) => {
        const section = sections.find((s) => s._id === idOf(a.sectionId));
        if (filters.academicYear && a.academicYear !== filters.academicYear) return false;
        if (filters.batchId && idOf(a.batchId) !== filters.batchId) return false;
        if (filters.semesterNo && String(a.semesterNo) !== filters.semesterNo) return false;
        if (filters.departmentId && section && idOf(section.departmentId) !== filters.departmentId)
          return false;
        if (filters.curriculumId && section && idOf(section.curriculumId) !== filters.curriculumId)
          return false;
        return true;
      }),
    [allotments, sections, filters],
  );

  const reloadAll = () => {
    reloadBatches();
    reloadSections();
    reloadAllotments();
  };

  const saveBatch = async () => {
    if (!/^\d{4}-\d{2}$/.test(batchForm.admissionYear)) {
      toast.error('Admission year must use the YYYY-YY format, for example 2026-27');
      return;
    }
    const admissionStartYear = Number(batchForm.admissionYear.slice(0, 4));
    if (Number(batchForm.admissionYear.slice(5)) !== (admissionStartYear + 1) % 100) {
      toast.error('Admission year must contain consecutive years, for example 2026-27');
      return;
    }
    const body = {
      ...batchForm,
      admissionYear: admissionStartYear,
      intake: Number(batchForm.intake),
    };
    const res = await mutation(batchForm.id ? `batch/${batchForm.id}` : 'batch', {
      method: batchForm.id ? 'PUT' : 'POST',
      body,
    });
    if (res?.results?.success) {
      toast.success(batchForm.id ? 'Batch updated' : 'Batch created');
      setBatchForm(emptyBatchForm());
      setShowBatchModal(false);
      reloadAll();
    }
  };

  const saveSection = async () => {
    const body = {
      ...sectionForm,
      semesterNo: Number(sectionForm.semesterNo),
      capacity: Number(sectionForm.capacity),
    };
    const res = await mutation(sectionForm.id ? `section/${sectionForm.id}` : 'section', {
      method: sectionForm.id ? 'PUT' : 'POST',
      body,
    });
    if (res?.results?.success) {
      toast.success(sectionForm.id ? 'Section updated' : 'Section created');
      setSectionForm(emptySectionForm());
      setShowSectionModal(false);
      reloadAll();
    }
  };

  const allotStudent = async () => {
    setAllotmentAction('manual');
    try {
      const res = await mutation('student-section-allotment', {
        method: 'POST',
        body: allotForm,
      });
      if (res?.results?.success) {
        toast.success('Student allotted');
        setAllotForm({ studentId: '', sectionId: '', rollNo: '' });
        setShowManualAllotModal(false);
        reloadAll();
      }
    } finally {
      setAllotmentAction(null);
    }
  };

  const previewBulkAllotment = async () => {
    setAllotmentAction('preview');
    try {
      const res = await mutation('student-section-allotment/bulk/preview', {
        method: 'POST',
        body: { ...bulkForm, semesterNo: Number(bulkForm.semesterNo) },
      });
      const preview = res?.results?.data as BulkPreview | undefined;
      if (preview) {
        setBulkPreview(preview);
        setShowAutoAllotModal(false);
      }
    } finally {
      setAllotmentAction(null);
    }
  };

  const executeBulkAllotment = async () => {
    if (!bulkPreview || bulkPreview.unassigned.length) return;
    setAllotmentAction('execute');
    try {
      const res = await mutation('student-section-allotment/bulk/execute', {
        method: 'POST',
        body: { ...bulkForm, semesterNo: Number(bulkForm.semesterNo) },
      });
      if (res?.results?.success) {
        toast.success(`Successfully allotted ${bulkPreview.assignments.length} students`);
        setBulkPreview(null);
        setShowAutoAllotModal(false);
        reloadAll();
      }
    } finally {
      setAllotmentAction(null);
    }
  };

  const transferAllotment = async () => {
    if (!transferForm.allotmentId || !transferForm.toSectionId) return;
    const res = await mutation(`student-section-allotment/${transferForm.allotmentId}/transfer`, {
      method: 'POST',
      body: {
        toSectionId: transferForm.toSectionId,
        reason: transferForm.reason || 'Section transfer',
      },
    });
    if (res?.results?.success) {
      toast.success('Allotment transferred');
      setTransferForm({ allotmentId: '', toSectionId: '', reason: '' });
      reloadAll();
    }
  };

  const cancelAllotment = async (allotmentId: string) => {
    const result = await Swal.fire({
      title: 'Cancel student allotment?',
      input: 'textarea',
      inputLabel: 'Cancellation reason',
      inputPlaceholder: 'Explain why this allotment is being cancelled…',
      inputValidator: (value) =>
        value.trim().length < 5 ? 'Provide a clear cancellation reason' : undefined,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Cancel allotment',
      confirmButtonColor: '#dc2626',
    });
    if (!result.isConfirmed) return;
    const reason = String(result.value).trim();
    const res = await mutation(`student-section-allotment/${allotmentId}/cancel`, {
      method: 'POST',
      body: { reason },
    });
    if (res?.results?.success) {
      toast.success('Allotment cancelled');
      reloadAll();
    }
  };

  const tabs = [
    { id: 'batches' as Tab, label: 'Batches', icon: <Layers className="h-4 w-4" /> },
    { id: 'sections' as Tab, label: 'Sections', icon: <Users className="h-4 w-4" /> },
    {
      id: 'allotments' as Tab,
      label: 'Allotment',
      icon: <ArrowRightLeft className="h-4 w-4" />,
    },
  ];

  return (
    <div className="space-y-5">
      <AcademicWorkflowBar />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Academic Structure</h1>
            {tab === 'batches' && !canCreateBatch && (
              <span className="group relative inline-flex" tabIndex={0}>
                <Info className="size-4 cursor-help text-primary" aria-hidden="true" />
                <span
                  role="tooltip"
                  className="pointer-events-none absolute top-7 left-1/2 z-30 w-72 -translate-x-1/2 rounded-xl bg-white px-3 py-2.5 text-xs leading-5 font-normal text-slate-600 opacity-0 ring-1 ring-slate-200 transition-opacity group-hover:opacity-100 group-focus:opacity-100"
                >
                  Batches are governed by Academic Administration. You can review your department
                  batches; creation, activation, intake changes, and graduation are centrally
                  controlled.
                </span>
                <span className="sr-only">Batch governance information</span>
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Set up programmes, branches, classes and student allotments in one guided flow.
          </p>
        </div>

        <div className="flex shrink-0 gap-2 rounded-xl bg-white p-2 border border-slate-100 ">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setFilters({
                  academicYear: '',
                  departmentId: hodDepartmentId,
                  curriculumId: '',
                  batchId: '',
                  semesterNo: '',
                });
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all cursor-pointer ${
                tab === item.id ? 'bg-primary text-white ' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <FiltersBar
        tab={tab}
        filters={filters}
        setFilters={setFilters}
        batches={batches}
        departmentLocked={isDepartmentHod}
      />

      {tab === 'sections' && canCreateSection && !canApproveSection && (
        <div className="rounded-2xl bg-secondary-50 px-4 py-3 text-sm text-slate-600">
          <span className="font-bold text-slate-800">Department section planning.</span> New
          sections remain Planned until Dean Academic or an authorized administrator approves and
          activates them.
        </div>
      )}
      {tab === 'allotments' && canPreviewAllotment && !canApproveAllotment && (
        <div className="rounded-2xl bg-violet-50 px-4 py-3 text-sm text-slate-600">
          <span className="font-bold text-slate-800">Review and recommend.</span> You can preview
          distribution and make justified transfers within your department. Initial allotment
          publication and cancellations require Academic Administration approval.
        </div>
      )}

      {tab === 'batches' && (
        <div className="rounded-2xl bg-white overflow-hidden">
          <CustomTable<IBatch>
            title="Batches"
            description="Student cohorts linked to curriculum plans and department structures."
            onRefresh={reloadBatches}
            isRefreshing={isValidatingBatches}
            data={filteredBatches}
            columns={batchColumns}
            onSearch={setBatchSearch}
            actions={
              canEditBatch
                ? [
                    {
                      tooltip: 'Edit',
                      icon: <Edit2 className="h-4 w-4 text-primary" />,
                      onClick: (row: IBatch) => {
                        setBatchForm({
                          id: row._id,
                          curriculumId: idOf(row.curriculumId),
                          departmentId: idOf(row.departmentId),
                          admissionYear: formatAcademicYear(row.admissionYear),
                          intake: String(row.intake),
                        });
                        setShowBatchModal(true);
                      },
                    },
                    {
                      tooltip: 'Activate Batch',
                      icon: <CheckCircle className="h-4 w-4 text-emerald-600" />,
                      hidden: (row: IBatch) => row.status !== 'Planned',
                      onClick: async (row: IBatch) => {
                        const result = await mutation(`batch/${row._id}`, {
                          method: 'PUT',
                          body: { status: 'Active' },
                        });
                        if (result?.results?.success) {
                          toast.success('Batch activated successfully');
                          reloadAll();
                        }
                      },
                    },
                    {
                      tooltip: 'Graduate Batch',
                      icon: <Award className="h-4 w-4 text-indigo-600" />,
                      hidden: (row: IBatch) => row.status !== 'Active',
                      onClick: async (row: IBatch) => {
                        Swal.fire({
                          title: 'Graduate Batch?',
                          text: 'Are you sure you want to transition this batch to Passed Out? This requires all sections in this batch to be archived first.',
                          icon: 'warning',
                          showCancelButton: true,
                          confirmButtonText: 'Yes, graduate batch',
                          cancelButtonText: 'Cancel',
                        }).then(async (res) => {
                          if (res.isConfirmed) {
                            const result = await mutation(`batch/${row._id}`, {
                              method: 'PUT',
                              body: { status: 'Passed Out' },
                            });
                            if (result?.results?.success) {
                              toast.success('Batch status updated to Passed Out');
                              reloadAll();
                            }
                          }
                        });
                      },
                    },
                  ]
                : []
            }
            customActions={
              (canCreateBatch || canImport) && (
                <div className="flex items-center gap-2">
                  {canImport && (
                    <CustomButton
                      variant="secondary"
                      startIcon={<UploadCloud className="h-4 w-4" />}
                      onClick={() => setShowBatchImport(true)}
                    >
                      Import batches
                    </CustomButton>
                  )}
                  {canCreateBatch && (
                    <CustomButton
                      variant="primary"
                      startIcon={<Plus className="h-4 w-4" />}
                      onClick={() => {
                        setBatchForm(emptyBatchForm());
                        setShowBatchModal(true);
                      }}
                    >
                      Add New Batch
                    </CustomButton>
                  )}
                </div>
              )
            }
            options={{
              search: true,
              pagination: false,
              actionsType: 'dropdown',
              export: false,
            }}
          />
        </div>
      )}

      {tab === 'sections' && (
        <div className="rounded-2xl bg-white overflow-hidden">
          <CustomTable<ISection>
            title="Sections"
            description="Semester-wise groups for active batches."
            onRefresh={reloadSections}
            data={filteredSections}
            columns={sectionColumns}
            actions={
              canEditSection || canApproveSection
                ? [
                    ...(canEditSection
                      ? [
                          {
                            tooltip: 'Edit',
                            icon: <Edit2 className="h-4 w-4 text-primary" />,
                            onClick: (row: ISection) => {
                              setSectionForm({
                                id: row._id,
                                academicYear: row.academicYear,
                                batchId: idOf(row.batchId),
                                semesterNo: String(row.semesterNo),
                                sectionName: row.sectionName,
                                capacity: String(row.capacity),
                              });
                              setShowSectionModal(true);
                            },
                          },
                        ]
                      : []),
                    ...(canApproveSection
                      ? [
                          {
                            tooltip: 'Approve Section',
                            icon: <CheckCircle className="h-4 w-4 text-emerald-600" />,
                            hidden: (row: ISection) => row.status !== 'Planned',
                            onClick: async (row: ISection) => {
                              const result = await mutation(`section/${row._id}/approve`, {
                                method: 'POST',
                              });
                              if (result?.results?.success) {
                                toast.success('Section approved and activated');
                                reloadAll();
                              }
                            },
                          },
                        ]
                      : []),
                  ]
                : []
            }
            customActions={
              canCreateSection && (
                <CustomButton
                  variant="primary"
                  startIcon={<Plus className="h-4 w-4" />}
                  onClick={() => {
                    setSectionForm(emptySectionForm());
                    setShowSectionModal(true);
                  }}
                >
                  Add New Section
                </CustomButton>
              )
            }
            options={{
              search: true,
              pagination: false,
              actionsType: 'dropdown',
              export: false,
            }}
          />
        </div>
      )}
      <ImportMigrationDialog
        open={showBatchImport}
        target="batches"
        title="Batches"
        onClose={() => setShowBatchImport(false)}
        onImported={() => void reloadBatches()}
      />

      {tab === 'allotments' && (
        <div className="space-y-5">
          {(canPreviewAllotment || canCreateAllotment) && (
            <div className="grid items-stretch gap-5 lg:grid-cols-2">
              {canPreviewAllotment && (
                <article className="flex flex-col rounded-2xl bg-violet-50 p-5">
                  <h3 className="font-bold text-slate-900">Automatic Allotment</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Capacity and duplicate allotment rules are checked automatically. Preview a
                    balanced, sequential, or merit-rank distribution before saving any placement.
                  </p>
                  <CustomButton
                    className="mt-auto"
                    variant="primary"
                    onClick={() => {
                      setBulkForm({
                        batchId: '',
                        academicYear: '',
                        semesterNo: '',
                        strategy: 'balanced',
                      });
                      setBulkPreview(null);
                      setShowAutoAllotModal(true);
                    }}
                  >
                    Configure automatic allotment
                  </CustomButton>
                </article>
              )}
              {canCreateAllotment && (
                <article className="flex flex-col rounded-2xl bg-emerald-50 p-5">
                  <h3 className="font-bold text-slate-900">Manual Allotment</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Use this for one student at a time when an individual placement or exception is
                    required.
                  </p>
                  <CustomButton
                    className="mt-auto"
                    variant="secondary"
                    onClick={() => {
                      setAllotForm({ studentId: '', sectionId: '', rollNo: '' });
                      setShowManualAllotModal(true);
                    }}
                  >
                    Allot Student
                  </CustomButton>
                </article>
              )}
            </div>
          )}
          <div className="rounded-2xl bg-white overflow-hidden">
            <CustomTable<IStudentSectionAllotment>
              title="Allotments"
              description="Student section enrollments and transfers."
              onRefresh={reloadAllotments}
              data={filteredAllotments}
              columns={allotmentColumns}
              actions={
                canTransferAllotment || canApproveAllotment
                  ? [
                      ...(canTransferAllotment
                        ? [
                            {
                              tooltip: 'Transfer Student',
                              icon: <ArrowRightLeft className="h-4 w-4 text-primary" />,
                              hidden: (row: IStudentSectionAllotment) => row.status !== 'Active',
                              onClick: (row: IStudentSectionAllotment) => {
                                setTransferForm({
                                  allotmentId: row._id,
                                  toSectionId: '',
                                  reason: '',
                                });
                              },
                            },
                          ]
                        : []),
                      ...(canApproveAllotment
                        ? [
                            {
                              tooltip: 'Cancel Allotment',
                              icon: <Trash2 className="h-4 w-4 text-rose-600" />,
                              hidden: (row: IStudentSectionAllotment) => row.status !== 'Active',
                              onClick: (row: IStudentSectionAllotment) => cancelAllotment(row._id),
                            },
                          ]
                        : []),
                    ]
                  : []
              }
              options={{
                search: true,
                pagination: false,
                actionsType: 'dropdown',
                export: false,
              }}
            />
          </div>

          {bulkPreview && (
            <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-200/80 px-4 py-6 backdrop-blur-sm">
              <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white ">
                <div className="flex items-start justify-between border-b border-slate-100 bg-linear-to-r from-violet-50 to-white px-6 py-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Automatic Allotment Preview
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Review the planned section distribution before making any changes.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBulkPreview(null)}
                    disabled={allotmentAction === 'execute'}
                    className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Close automatic allotment preview"
                  >
                    ✕
                  </button>
                </div>
                <div className="overflow-y-auto p-6">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[
                      ['Eligible', bulkPreview.eligibleCount, 'text-slate-900'],
                      ['Planned', bulkPreview.assignments.length, 'text-emerald-700'],
                      ['Already allotted', bulkPreview.alreadyAllotted, 'text-blue-700'],
                    ].map(([label, value, tone]) => (
                      <div
                        key={String(label)}
                        className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                      >
                        <p className={`text-2xl font-bold ${tone}`}>{value}</p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                          {label}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                    {bulkPreview.sections.map((section) => (
                      <div
                        key={section.id}
                        className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm last:border-b-0"
                      >
                        <div>
                          <p className="font-semibold text-slate-800">Section {section.name}</p>
                          <p className="text-xs text-slate-500">
                            Current strength: {section.allottedCount} · Capacity: {section.capacity}
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                          +{section.newStudents} → {section.plannedCount}/{section.capacity}
                        </span>
                      </div>
                    ))}
                  </div>
                  {bulkPreview.unassigned.length > 0 && (
                    <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                      Capacity is short by {bulkPreview.unassigned.length}. Add a section or
                      increase capacity before confirming.
                    </p>
                  )}
                </div>
                <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
                  <CustomButton
                    variant="cancel"
                    disabled={allotmentAction === 'execute'}
                    onClick={() => setBulkPreview(null)}
                  >
                    Close Preview
                  </CustomButton>
                  {canApproveAllotment ? (
                    <CustomButton
                      loading={allotmentAction === 'execute'}
                      disabled={bulkPreview.unassigned.length > 0}
                      onClick={executeBulkAllotment}
                    >
                      Approve & Publish Allotment
                    </CustomButton>
                  ) : (
                    <span className="rounded-xl bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700">
                      Preview only · Academic approval required
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {canTransferAllotment && transferForm.allotmentId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 px-4 backdrop-blur-sm">
              <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white ">
                <div className="flex items-start justify-between border-b border-slate-100 bg-linear-to-r from-blue-50 to-white px-5 py-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Transfer Student</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Choose another section in the same cohort and record the reason.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setTransferForm({ allotmentId: '', toSectionId: '', reason: '' })
                    }
                    className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Close transfer dialog"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-4 p-5">
                  <AsyncSelect
                    label="Destination Section"
                    type="sections"
                    params={{ master: true }}
                    value={transferForm.toSectionId || null}
                    onChange={(value) =>
                      setTransferForm((form) => ({ ...form, toSectionId: value ?? '' }))
                    }
                    required
                  />
                  <Field
                    label="Transfer Reason"
                    value={transferForm.reason}
                    onChange={(value) => setTransferForm((form) => ({ ...form, reason: value }))}
                    placeholder="Explain why the student is being transferred"
                  />
                  <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                    <CustomButton
                      variant="cancel"
                      onClick={() =>
                        setTransferForm({ allotmentId: '', toSectionId: '', reason: '' })
                      }
                    >
                      Cancel
                    </CustomButton>
                    <CustomButton
                      startIcon={<ArrowRightLeft className="h-4 w-4" />}
                      loading={isLoading}
                      disabled={!transferForm.toSectionId || transferForm.reason.trim().length < 5}
                      onClick={transferAllotment}
                    >
                      Confirm Transfer
                    </CustomButton>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Batch Form Dialog/Modal Overlay */}
      <AnimatePresence>
        {showBatchModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
              onClick={() => setShowBatchModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="relative z-10 flex w-full max-w-md flex-col rounded-2xl border border-slate-100 bg-white  overflow-hidden"
            >
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800">
                      {batchForm.id ? 'Edit Batch' : 'Create Batch'}
                    </h2>
                    <p className="text-xs text-slate-600">
                      A batch connects curriculum, branch and admission-year cohort.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Content */}
              <div className="space-y-4 p-6">
                <AsyncSelect
                  label="Curriculum"
                  type="curricula"
                  value={batchForm.curriculumId || null}
                  onChange={(v) =>
                    setBatchForm((f) => ({ ...f, curriculumId: v ?? '', departmentId: '' }))
                  }
                  required
                />
                <AsyncSelect
                  label="Department"
                  type="departments"
                  params={{ curriculumId: batchForm.curriculumId }}
                  value={batchForm.departmentId || null}
                  onChange={(v) => setBatchForm((f) => ({ ...f, departmentId: v ?? '' }))}
                  required
                  disabled={!batchForm.curriculumId}
                />
                <AsyncSelect
                  label="Admission Year"
                  type="academicYears"
                  value={batchForm.admissionYear || null}
                  onChange={(value) =>
                    setBatchForm((form) => ({ ...form, admissionYear: value ?? '' }))
                  }
                  placeholder="Select configured academic year"
                  required
                />
                <Field
                  label="Intake"
                  value={batchForm.intake}
                  onChange={(v) => setBatchForm((f) => ({ ...f, intake: v }))}
                />
                {!batchForm.id && batchForm.curriculumId && batchForm.departmentId && (
                  <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
                    New batches start as Planned. After creation, add semester-wise sections from
                    the Sections tab, then allot students from the Allotment tab.
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                <CustomButton
                  variant="cancel"
                  onClick={() => {
                    setBatchForm(emptyBatchForm());
                    setShowBatchModal(false);
                  }}
                >
                  Cancel
                </CustomButton>
                <CustomButton
                  variant="primary"
                  loading={isLoading}
                  disabled={
                    !batchForm.curriculumId ||
                    !batchForm.departmentId ||
                    !batchForm.admissionYear ||
                    (batchForm.id ? !canEditBatch : !canCreateBatch)
                  }
                  onClick={saveBatch}
                >
                  {batchForm.id ? 'Save Changes' : 'Create Batch'}
                </CustomButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Section Form Dialog/Modal Overlay */}
      <AnimatePresence>
        {showSectionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
              onClick={() => setShowSectionModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="relative z-10 flex w-full max-w-md flex-col rounded-2xl border border-slate-100 bg-white  overflow-hidden"
            >
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800">
                      {sectionForm.id ? 'Edit Section' : 'Create Section'}
                    </h2>
                    <p className="text-xs text-slate-600">
                      Define section name, capacity, and active semester.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSectionModal(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Content */}
              <div className="space-y-4 p-6 overflow-y-auto max-h-[70vh]">
                <Field
                  label="Academic Year (automatic)"
                  value={sectionForm.academicYear}
                  onChange={() => undefined}
                  disabled
                  placeholder="Select a batch and semester"
                />
                <AsyncSelect
                  label="Batch"
                  type="batches"
                  params={{ master: true }}
                  value={sectionForm.batchId || null}
                  onChange={(v) => {
                    setSectionForm((f) => ({
                      ...f,
                      batchId: v ?? '',
                      academicYear: '',
                      semesterNo: '',
                    }));
                  }}
                  required
                />
                <SelectField
                  label="Semester *"
                  optionPrefix="Semester"
                  value={sectionForm.semesterNo}
                  options={sectionSemesterOptions}
                  onChange={(v) =>
                    setSectionForm((f) => ({
                      ...f,
                      semesterNo: v,
                      academicYear: academicYearForSemester(selectedSectionBatch, v),
                    }))
                  }
                  disabled={!sectionForm.batchId || sectionSemesterOptions.length === 0}
                  placeholder={
                    sectionForm.batchId ? 'Select an available semester' : 'Select a batch first'
                  }
                />
                {selectedSectionBatch && (
                  <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs text-blue-800">
                    <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      <strong>{selectedSectionBatch.name}</strong> follows regulation{' '}
                      {selectedSectionBatch.regulationYear} with {sectionSemesterOptions.length}{' '}
                      available semesters. Available semesters come directly from its curriculum.
                    </span>
                  </div>
                )}
                <Field
                  label="Section Name"
                  value={sectionForm.sectionName}
                  onChange={(v) => setSectionForm((f) => ({ ...f, sectionName: v }))}
                />
                <Field
                  label="Capacity"
                  value={sectionForm.capacity}
                  onChange={(v) => setSectionForm((f) => ({ ...f, capacity: v }))}
                />
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                <CustomButton
                  variant="cancel"
                  onClick={() => {
                    setSectionForm(emptySectionForm());
                    setShowSectionModal(false);
                  }}
                >
                  Cancel
                </CustomButton>
                <CustomButton
                  variant="primary"
                  loading={isLoading}
                  disabled={
                    !sectionForm.batchId ||
                    !sectionForm.academicYear ||
                    !sectionForm.semesterNo ||
                    (sectionForm.id ? !canEditSection : !canCreateSection)
                  }
                  onClick={saveSection}
                >
                  {sectionForm.id ? 'Save Changes' : 'Create Section'}
                </CustomButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Automatic Allotment Dialog/Modal Overlay */}
      <AnimatePresence>
        {showAutoAllotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
              onClick={() => setShowAutoAllotModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="relative z-10 flex w-full max-w-md flex-col rounded-2xl border border-slate-100 bg-white  overflow-hidden"
            >
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                    <ArrowRightLeft className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800">Automatic Allotment</h2>
                    <p className="text-xs text-slate-600">
                      Distribute unallotted students to active sections.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAutoAllotModal(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Content */}
              <div className="space-y-4 p-6 overflow-y-auto max-h-[70vh]">
                <AsyncSelect
                  label="Batch"
                  type="batches"
                  params={{ status: 'Active', master: true }}
                  value={bulkForm.batchId || null}
                  onChange={(value, option) => {
                    setBulkForm((form) => ({
                      ...form,
                      batchId: value ?? '',
                      academicYear: '',
                      semesterNo: '',
                    }));
                    if (option?.meta) {
                      setBulkBatchMeta({
                        totalSemesters:
                          typeof option.meta.totalSemesters === 'number'
                            ? option.meta.totalSemesters
                            : undefined,
                        admissionYear:
                          typeof option.meta.admissionYear === 'number'
                            ? option.meta.admissionYear
                            : undefined,
                      });
                    } else {
                      setBulkBatchMeta(null);
                    }
                    setBulkPreview(null);
                  }}
                  required
                />
                <Field
                  label="Academic Year (automatic)"
                  value={bulkForm.academicYear}
                  onChange={() => undefined}
                  disabled
                  placeholder="Select a batch and semester"
                />
                <SelectField
                  label="Semester *"
                  optionPrefix="Semester"
                  value={bulkForm.semesterNo}
                  options={bulkSemesterOptions}
                  onChange={(value) => {
                    setBulkForm((form) => ({
                      ...form,
                      semesterNo: value,
                      academicYear: academicYearForSemester(
                        selectedBulkBatch,
                        value,
                        bulkBatchMeta?.admissionYear,
                      ),
                    }));
                    setBulkPreview(null);
                  }}
                  disabled={!bulkForm.batchId || bulkSemesterOptions.length === 0}
                  placeholder={bulkForm.batchId ? 'Select semester' : 'Select a batch first'}
                />
                <div>
                  <p className={labelCls}>Distribution method</p>
                  <select
                    value={bulkForm.strategy}
                    onChange={(event) => {
                      setBulkForm((form) => ({
                        ...form,
                        strategy: event.target.value as BulkStrategy,
                      }));
                      setBulkPreview(null);
                    }}
                    className={inputCls}
                  >
                    <option value="sequential">Fill sections in order</option>
                    <option value="balanced">Balanced distribution</option>
                    <option value="merit_rank">Merit-rank order</option>
                  </select>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    {bulkForm.strategy === 'sequential'
                      ? 'Fills the first active section to capacity, then continues to the next active section.'
                      : bulkForm.strategy === 'balanced'
                        ? 'Keeps student strength as equal as possible across all active sections.'
                        : 'Orders students from highest to lowest merit rank, then fills active sections in order.'}
                  </p>
                </div>
                <div className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-2.5 text-xs leading-relaxed text-violet-800">
                  Only sections already created and marked Active for this batch, academic year and
                  semester are used. This workflow never creates Section A, B or C automatically.
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                <CustomButton
                  variant="cancel"
                  onClick={() => {
                    setShowAutoAllotModal(false);
                  }}
                >
                  Cancel
                </CustomButton>
                <CustomButton
                  variant="primary"
                  loading={allotmentAction === 'preview'}
                  disabled={!bulkForm.batchId || !bulkForm.academicYear || !bulkForm.semesterNo}
                  onClick={previewBulkAllotment}
                >
                  Preview Distribution
                </CustomButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Allotment Dialog/Modal Overlay */}
      <AnimatePresence>
        {showManualAllotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-200/80 backdrop-blur-sm"
              onClick={() => setShowManualAllotModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="relative z-10 flex w-full max-w-md flex-col rounded-2xl border border-slate-100 bg-white  overflow-hidden"
            >
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800">Allot Student</h2>
                    <p className="text-xs text-slate-600">
                      Place an enrolled student into an active section.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowManualAllotModal(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Content */}
              <div className="space-y-4 p-6 overflow-y-auto max-h-[70vh]">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs leading-relaxed text-emerald-800">
                  Use this for one student at a time—for example, a late admission, transfer-in, or
                  an exception after automatic allotment. The selected section must have available
                  capacity.
                </div>
                <AsyncSelect
                  label="Student"
                  type="students"
                  value={allotForm.studentId || null}
                  onChange={(v) => setAllotForm((f) => ({ ...f, studentId: v ?? '' }))}
                  required
                />
                <AsyncSelect
                  label="Section"
                  type="sections"
                  params={{ master: true }}
                  value={allotForm.sectionId || null}
                  onChange={(v) => setAllotForm((f) => ({ ...f, sectionId: v ?? '' }))}
                  required
                />
                <Field
                  label="Roll No"
                  value={allotForm.rollNo}
                  onChange={(v) => setAllotForm((f) => ({ ...f, rollNo: v }))}
                  placeholder="Use student roll if empty"
                />
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                <CustomButton
                  variant="cancel"
                  onClick={() => {
                    setAllotForm({ studentId: '', sectionId: '', rollNo: '' });
                    setShowManualAllotModal(false);
                  }}
                >
                  Cancel
                </CustomButton>
                <CustomButton
                  variant="primary"
                  loading={allotmentAction === 'manual'}
                  disabled={!allotForm.studentId || !allotForm.sectionId}
                  onClick={allotStudent}
                >
                  Allot Student
                </CustomButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FiltersBar({
  tab,
  filters,
  setFilters,
  batches,
  departmentLocked,
}: {
  tab: Tab;
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  batches: IBatch[];
  departmentLocked: boolean;
}) {
  const relevantBatches = batches.filter((batch) => {
    if (filters.batchId) return batch._id === filters.batchId;
    if (filters.curriculumId && idOf(batch.curriculumId) !== filters.curriculumId) return false;
    if (filters.departmentId && idOf(batch.departmentId) !== filters.departmentId) return false;
    return true;
  });
  const maxSemesters = Math.max(
    0,
    ...relevantBatches.map((batch) => {
      const curriculum = batch.curriculumId;
      return curriculum && typeof curriculum !== 'string' ? (curriculum.totalSemesters ?? 0) : 0;
    }),
  );
  const semesterOptions = Array.from({ length: maxSemesters }, (_, index) => String(index + 1));
  const academicYearOptions = Array.from(
    new Set(relevantBatches.flatMap((batch) => academicYearsForBatch(batch))),
  ).sort();
  const batchAdmissionYearOptions = Array.from(
    new Set(batches.map((batch) => formatAcademicYear(batch.admissionYear))),
  ).sort();
  const isBatchTab = tab === 'batches';
  const gridColumns = isBatchTab
    ? departmentLocked
      ? 'md:grid-cols-2'
      : 'md:grid-cols-3'
    : departmentLocked
      ? 'md:grid-cols-4'
      : 'md:grid-cols-5';
  const headerColumns = isBatchTab
    ? departmentLocked
      ? 'md:col-span-2'
      : 'md:col-span-3'
    : departmentLocked
      ? 'md:col-span-4'
      : 'md:col-span-5';

  return (
    <div className={`grid gap-3 rounded-2xl border border-slate-100 bg-white p-5  ${gridColumns}`}>
      <div
        className={`flex items-center gap-2 text-sm font-semibold text-slate-700 ${headerColumns}`}
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filters
      </div>
      <SelectField
        label={isBatchTab ? 'Admission Year' : 'Academic Year'}
        value={filters.academicYear}
        options={isBatchTab ? batchAdmissionYearOptions : academicYearOptions}
        onChange={(v) => setFilters((f) => ({ ...f, academicYear: v }))}
        placeholder={isBatchTab ? 'All admission years' : 'All academic years'}
      />
      <AsyncSelect
        label="Program / Curriculum"
        type="curricula"
        value={filters.curriculumId || null}
        onChange={(v) =>
          setFilters((f) => ({
            ...f,
            curriculumId: v ?? '',
            departmentId: departmentLocked ? f.departmentId : '',
            batchId: '',
            semesterNo: '',
          }))
        }
      />
      {!departmentLocked && (
        <AsyncSelect
          label="Department"
          type="departments"
          params={{ curriculumId: filters.curriculumId }}
          value={filters.departmentId || null}
          onChange={(v) =>
            setFilters((f) => ({ ...f, departmentId: v ?? '', batchId: '', semesterNo: '' }))
          }
        />
      )}
      {!isBatchTab && (
        <>
          <AsyncSelect
            label="Batch"
            type="batches"
            params={{
              master: true,
              curriculumId: filters.curriculumId,
              departmentId: filters.departmentId,
            }}
            value={filters.batchId || null}
            onChange={(v) => setFilters((f) => ({ ...f, batchId: v ?? '', semesterNo: '' }))}
          />
          <SelectField
            label="Semester"
            optionPrefix="Semester"
            value={filters.semesterNo}
            options={semesterOptions}
            onChange={(v) => setFilters((f) => ({ ...f, semesterNo: v }))}
            disabled={semesterOptions.length === 0}
            placeholder={semesterOptions.length ? 'All semesters' : 'Select curriculum or batch'}
          />
        </>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`${inputCls} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600`}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
  optionPrefix,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  optionPrefix?: string;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={`${inputCls} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {optionPrefix ? `${optionPrefix} ${option}` : option}
          </option>
        ))}
      </select>
    </div>
  );
}

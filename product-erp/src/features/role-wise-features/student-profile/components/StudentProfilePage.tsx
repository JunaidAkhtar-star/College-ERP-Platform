/**
 * @file StudentProfilePage.tsx
 * @description Student Profile management — role-aware:
 *   Student:        View own profile (GET student-profile/me)
 *   Staff/Faculty:  Browse all profiles, view detail
 *   Admin/HOD:      Full CRUD, promote semester, generate bonafide
 * @module features/role-wise-features/student-profile
 */
'use client';

import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Action, Column } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import Empty from '@/shared/core/Empty';
import FileViewer, { type IViewerFile } from '@/shared/core/FileViewer';
import StudentWorkflowBar from '@/shared/components/StudentWorkflowBar';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useAuthStore } from '@/shared/store/authStore';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import { useFormik } from 'formik';
import {
  ArrowUpCircle,
  Award,
  BookOpen,
  ChevronRight,
  Edit2,
  Eye,
  FileText,
  Filter,
  GraduationCap,
  HeartPulse,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  TrendingUp,
  User,
  Users,
  X,
  UploadCloud,
} from 'lucide-react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import * as Yup from 'yup';

import UseProtectedRoutes from '@/shared/hooks/UseProtectedRoutes';
import { downloadPdf } from '@/shared/utils';
import type {
  IDocumentChecklistItem,
  IStudentProfile,
  IStudentStats,
  TStudentStatus,
} from '../types/student-profile.types';
import StudentTabIllustration, { type TStudentDetailTab } from './StudentTabIllustration';
import StudentStatsOverview from './StudentStatsOverview';
import StudentAbcPanel from './StudentAbcPanel';
import ImportMigrationDialog from '../../import-center/components/ImportMigrationDialog';

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'obc', label: 'OBC' },
  { value: 'sebc', label: 'SEBC' },
  { value: 'sc', label: 'SC' },
  { value: 'st', label: 'ST' },
  { value: 'ph', label: 'Physically Challenged' },
];
const GENDERS = ['male', 'female', 'other'];

const STATUS_CFG: Record<TStudentStatus, { label: string; bg: string; text: string; dot: string }> =
  {
    active: { label: 'Active', bg: 'bg-green-50', text: 'text-green-600', dot: 'bg-green-400' },
    detained: { label: 'Detained', bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-400' },
    dropped: { label: 'Dropped', bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-400' },
    passed_out: {
      label: 'Passed Out',
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      dot: 'bg-blue-400',
    },
    transferred: {
      label: 'Transferred',
      bg: 'bg-slate-100',
      text: 'text-slate-500',
      dot: 'bg-slate-400',
    },
    lateral_promoted: {
      label: 'Lateral',
      bg: 'bg-purple-50',
      text: 'text-purple-600',
      dot: 'bg-purple-400',
    },
    rusticated: { label: 'Rusticated', bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-600' },
  };

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-600 focus:border-primary focus:bg-white focus:outline-none transition-colors';

function fullName(s: IStudentProfile) {
  return [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ');
}
function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
function deptName(d: IStudentProfile['department']) {
  if (!d) return '—';
  if (typeof d === 'string') return d;
  return d.name;
}

function formatDetailValue(label: string, value: string | number) {
  if (value === '' || value == null) return '—';

  const text = String(value).replace(/_/g, ' ');
  if (label === 'Category') {
    const category = CATEGORIES.find((item) => item.value === text.toLowerCase());
    return category?.label ?? text.toUpperCase();
  }

  if (['Gender', 'Admission Type', 'Nationality', 'Religion'].includes(label)) {
    return text.replace(/\b\w/g, (character) => character.toUpperCase());
  }

  return text;
}

function StudentTableDetailPanel({
  student,
  onSetRegistrationNumber,
  canSetRegistrationNumber,
}: {
  student: IStudentProfile;
  onSetRegistrationNumber: (student: IStudentProfile) => void;
  canSetRegistrationNumber: boolean;
}) {
  const [showAadhaar, setShowAadhaar] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<IViewerFile[]>([]);
  const [previewTitle, setPreviewTitle] = useState('Document Preview');
  const cfg = STATUS_CFG[student.status] ?? STATUS_CFG.active;
  const detailGroups: Array<{
    title: string;
    description: string;
    values: Array<[string, string | number]>;
  }> = [
    {
      title: 'Academic profile',
      description: 'Current programme and class placement',
      values: [
        ['Programme', student.program],
        ['Department / Branch', deptName(student.department)],
        ['Admission Batch', student.batch],
        ['Academic Year', student.academicYear],
        ['Current Semester', `Semester ${student.currentSemester}`],
        ['Current Study Year', `Year ${student.currentYear}`],
        ['Section', student.section ? `Section ${student.section}` : 'Not allotted'],
        ['Admission Type', student.admissionType],
        ['Enrollment No.', student.enrollmentNumber || '—'],
        ['Current CGPA', student.currentCgpa ?? '—'],
        ['Active Backlogs', student.totalBacklogs ?? 0],
      ],
    },
    {
      title: 'Entrance details',
      description: 'Entrance examination information submitted during admission',
      values: [
        ['Examination', student.entranceExam || 'Not provided'],
        ['Rank', student.entranceRank ?? '—'],
        ['Score / Percentile', student.entranceScore ?? '—'],
      ],
    },
    {
      title: 'Personal and contact',
      description: 'Identity and primary communication details',
      values: [
        ['College Email', student.collegeEmail],
        ['Personal Email', student.personalEmail || '—'],
        ['Phone', student.phone],
        ['WhatsApp', student.whatsappPhone || '—'],
        ['Date of Birth', fmtDate(student.dateOfBirth)],
        ['Gender', student.gender],
        ['Category', student.category],
        ['Nationality', student.nationality || '—'],
        ['Religion', student.religion || '—'],
        ['Blood Group', student.bloodGroup || '—'],
        ['Admission Date', fmtDate(student.admissionDate)],
      ],
    },
  ];
  const address = student.permanentAddress;
  const addressText = address
    ? [address.line1, address.line2, address.city, address.district, address.state, address.pincode]
        .filter(Boolean)
        .join(', ')
    : '—';
  const currentAddress = student.currentAddress;
  const currentAddressText = currentAddress
    ? [
        currentAddress.line1,
        currentAddress.line2,
        currentAddress.city,
        currentAddress.district,
        currentAddress.state,
        currentAddress.pincode,
      ]
        .filter(Boolean)
        .join(', ')
    : 'Same as permanent address';
  const documents = student.documents ?? [];
  const academicRecords = student.academicRecords ?? [];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-sm font-bold text-primary">
            {student.firstName?.charAt(0)}
            {student.lastName?.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-slate-900">{fullName(student)}</p>
            <p className="text-xs text-slate-500">
              {student.rollNumber} · {student.program}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
          {canSetRegistrationNumber &&
            (student.registrationNumber ? (
              <button
                type="button"
                onClick={() => onSetRegistrationNumber(student)}
                className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-primary-50 hover:text-primary"
              >
                Reg. No. {student.registrationNumber} · Edit
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSetRegistrationNumber(student)}
                className="rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700"
              >
                + Add Registration Number
              </button>
            ))}
        </div>
      </div>

      <div className="border-b border-slate-200 bg-amber-50/70 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
              Aadhaar Number
            </p>
            <p className="mt-1 font-mono text-sm font-semibold tracking-wider text-slate-800">
              {student.aadhaarNumber
                ? showAadhaar
                  ? student.aadhaarNumber.replace(/(\d{4})(?=\d)/g, '$1 ')
                  : `•••• •••• ${student.aadhaarNumber.slice(-4)}`
                : 'Not provided'}
            </p>
          </div>
          {student.aadhaarNumber && (
            <button
              type="button"
              onClick={() => setShowAadhaar((visible) => !visible)}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 "
            >
              {showAadhaar ? 'Hide' : 'Show'}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4 border-b border-slate-200 bg-white p-4">
        {detailGroups.map((group) => (
          <section key={group.title} className="overflow-hidden rounded-xl border border-slate-200">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-800">{group.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{group.description}</p>
            </div>
            <dl className="grid sm:grid-cols-2 lg:grid-cols-3">
              {group.values.map(([label, value]) => {
                const displayValue = formatDetailValue(label, value);
                return (
                  <div
                    key={label}
                    className="min-w-0 border-b border-slate-100 px-4 py-3 sm:border-r"
                  >
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                      {label}
                    </dt>
                    <dd
                      className="mt-1 truncate text-sm font-medium text-slate-700"
                      title={displayValue}
                    >
                      {displayValue}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
      </div>

      <div className="grid gap-3 p-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Permanent Address
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{addressText}</p>
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              Current Address
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-700">{currentAddressText}</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Parent / Guardian
          </p>
          <div className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <p>
              <span className="text-slate-600">Father:</span>{' '}
              {student.parentInfo?.fatherName || '—'}
            </p>
            <p>
              <span className="text-slate-600">Mother:</span>{' '}
              {student.parentInfo?.motherName || '—'}
            </p>
            <p>
              <span className="text-slate-600">Guardian:</span>{' '}
              {student.parentInfo?.guardianName || '—'}
            </p>
            <p>
              <span className="text-slate-600">Emergency:</span>{' '}
              {student.emergencyContactPhone || student.parentInfo?.guardianPhone || '—'}
            </p>
            <p>
              <span className="text-slate-600">Father phone:</span>{' '}
              {student.parentInfo?.fatherPhone || '—'}
            </p>
            <p>
              <span className="text-slate-600">Father occupation:</span>{' '}
              {student.parentInfo?.fatherOccupation || '—'}
            </p>
            <p>
              <span className="text-slate-600">Father email:</span>{' '}
              {student.parentInfo?.fatherEmail || '—'}
            </p>
            <p>
              <span className="text-slate-600">Mother phone:</span>{' '}
              {student.parentInfo?.motherPhone || '—'}
            </p>
            <p>
              <span className="text-slate-600">Mother occupation:</span>{' '}
              {student.parentInfo?.motherOccupation || '—'}
            </p>
            <p>
              <span className="text-slate-600">Mother email:</span>{' '}
              {student.parentInfo?.motherEmail || '—'}
            </p>
            <p>
              <span className="text-slate-600">Family income:</span>{' '}
              {student.parentInfo?.annualFamilyIncome
                ? `₹${Number(student.parentInfo.annualFamilyIncome).toLocaleString('en-IN')}`
                : '—'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 px-4 pb-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Previous Education
            </p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              {academicRecords.length} record{academicRecords.length === 1 ? '' : 's'}
            </span>
          </div>
          {academicRecords.length ? (
            <div className="mt-3 space-y-2">
              {academicRecords.map((record, index) => (
                <div
                  key={`${record.level}-${index}`}
                  className="rounded-xl bg-slate-50 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold capitalize text-slate-700">
                        {record.level.replace(/_/g, ' ')} · {record.examName}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {record.instituteName} · {record.boardOrUniversity}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-primary">
                      {record.percentage}%
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600">
                    Passed {record.passingYear} ·{' '}
                    {record.verified ? 'Verified' : 'Verification pending'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">No previous education records available.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Documents
            </p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              {documents.length} document{documents.length === 1 ? '' : 's'}
            </span>
          </div>
          {documents.length ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {documents.map((document, index) => {
                const documentFiles: IViewerFile[] = document.files?.length
                  ? document.files
                      .filter((file) => Boolean(file.url))
                      .map((file) => ({
                        url: file.url,
                        name:
                          file.name ||
                          DOC_LABELS[document.docType] ||
                          document.docType.replace(/_/g, ' '),
                        mimeType: file.mimeType,
                      }))
                  : document.uploadedFileUrl
                    ? [
                        {
                          url: document.uploadedFileUrl,
                          name: DOC_LABELS[document.docType] || document.docType.replace(/_/g, ' '),
                        },
                      ]
                    : [];
                const status = document.status || (document.verifiedAt ? 'verified' : 'pending');
                return (
                  <div
                    key={`${document.docType}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-700">
                        {DOC_LABELS[document.docType] ?? document.docType.replace(/_/g, ' ')}
                      </p>
                      <p
                        className={`mt-0.5 text-[10px] font-semibold capitalize ${status === 'verified' ? 'text-emerald-600' : status === 'rejected' ? 'text-red-600' : 'text-amber-600'}`}
                      >
                        {status}
                      </p>
                    </div>
                    {documentFiles.length ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewTitle(
                            DOC_LABELS[document.docType] ?? document.docType.replace(/_/g, ' '),
                          );
                          setPreviewFiles(documentFiles);
                        }}
                        className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-primary  hover:bg-primary-50"
                      >
                        Preview{documentFiles.length > 1 ? ` (${documentFiles.length})` : ''}
                      </button>
                    ) : (
                      <span className="shrink-0 text-[10px] text-slate-600">No file</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              No documents are attached to this profile.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-3 px-4 pb-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Semester Results
          </p>
          {student.semesterResults?.length ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {student.semesterResults.map((result) => (
                <div
                  key={`${result.semesterNo}-${result.academicYear}`}
                  className="rounded-xl bg-slate-50 p-3"
                >
                  <p className="text-xs font-semibold text-slate-700">
                    Semester {result.semesterNo}
                  </p>
                  <p className="mt-1 text-lg font-bold text-primary">{result.sgpa ?? '—'} SGPA</p>
                  <p className="mt-1 text-[11px] capitalize text-slate-600">
                    {result.academicYear} · {result.result} · {result.backlogs} backlog(s)
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">No semester results have been published.</p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Administrative Notes
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {student.remarks || 'No administrative notes.'}
          </p>
        </div>
      </div>

      <FileViewer
        open={previewFiles.length > 0}
        onClose={() => setPreviewFiles([])}
        files={previewFiles}
        title={previewTitle}
      />
    </div>
  );
}
function academicYearFromBatch(batch: string, semester: number) {
  const startYear = Number.parseInt(batch, 10);
  if (!startYear || !semester) return '';
  const sessionStart = startYear + Math.floor((semester - 1) / 2);
  return `${sessionStart}-${String(sessionStart + 1).slice(-2)}`;
}

// ─── Profile Card (Own view for student) ─────────────────────────────────────
function OwnProfileCard({ profile }: { profile: IStudentProfile }) {
  const [tab, setTab] = useState<'overview' | 'results' | 'parents' | 'academic' | 'learning'>(
    'overview',
  );
  const cfg = STATUS_CFG[profile.status] ?? STATUS_CFG.active;
  const { data: credentialsRaw } = useSwr<{
    data?: Array<{
      _id: string;
      title: string;
      type: 'certificate' | 'badge';
      issuedAt: string;
      verificationUrl?: string;
      courseId?: { title?: string; provider?: string };
    }>;
  }>('lms-integration/credentials/me');
  const credentials = credentialsRaw?.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <div className="flex flex-col gap-4 rounded-2xl bg-linear-to-br from-primary/10 via-blue-50 to-white p-6 sm:flex-row sm:items-center">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-200">
          {profile.passportPhotoUrl ? (
            <Image
              src={profile.passportPhotoUrl}
              alt={fullName(profile)}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-slate-600">
              {profile.firstName[0]}
              {profile.lastName[0]}
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800">{fullName(profile)}</h2>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} /> {cfg.label}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            {profile.program} · Sem {profile.currentSemester} · {profile.batch} Batch
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3 text-primary" />
              {profile.rollNumber}
            </span>
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3 text-primary" />
              {profile.collegeEmail}
            </span>
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3 text-primary" />
              {profile.phone}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {profile.currentCgpa && (
            <div className="rounded-2xl bg-white px-4 py-2 text-center">
              <p className="text-2xl font-bold text-primary">{profile.currentCgpa.toFixed(2)}</p>
              <p className="text-xs text-slate-500">CGPA</p>
            </div>
          )}
          {profile.totalBacklogs > 0 && (
            <p className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-500">
              {profile.totalBacklogs} Backlogs
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {(['overview', 'results', 'learning', 'parents', 'academic'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-xs font-medium capitalize transition-colors ${
              tab === t ? 'bg-white text-slate-800' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'academic' ? 'Prev. Education' : t.replace('_', ' ')}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
        >
          {tab === 'overview' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                { label: 'Roll Number', value: profile.rollNumber },
                { label: 'University Reg. No.', value: profile.registrationNumber ?? 'Pending' },
                { label: 'Enrollment', value: profile.enrollmentNumber ?? '—' },
                { label: 'Program', value: profile.program },
                { label: 'Department', value: deptName(profile.department) },
                { label: 'Batch', value: profile.batch },
                { label: 'Semester', value: `${profile.currentSemester}` },
                { label: 'Section', value: profile.section ?? '—' },
                { label: 'Date of Birth', value: fmtDate(profile.dateOfBirth) },
                { label: 'Gender', value: profile.gender },
                { label: 'Blood Group', value: profile.bloodGroup ?? '—' },
                { label: 'Category', value: profile.category },
                { label: 'Admission Date', value: fmtDate(profile.admissionDate) },
                { label: 'Admission Type', value: profile.admissionType },
              ].map((f) => (
                <div key={f.label} className="rounded-xl bg-white p-4">
                  <p className="mb-0.5 text-xs text-slate-600">{f.label}</p>
                  <p className="text-sm font-medium text-slate-800 capitalize">{f.value}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'results' && (
            <div className="space-y-3">
              {(profile.semesterResults ?? []).length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-600">
                  No semester results available
                </p>
              ) : (
                (profile.semesterResults ?? []).map((r) => (
                  <div
                    key={r.semesterNo}
                    className="flex items-center justify-between rounded-xl bg-white px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        Semester {r.semesterNo}
                      </p>
                      <p className="text-xs text-slate-600">{r.academicYear}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      {r.sgpa && (
                        <div className="text-center">
                          <p className="text-sm font-bold text-primary">{r.sgpa.toFixed(2)}</p>
                          <p className="text-[10px] text-slate-600">SGPA</p>
                        </div>
                      )}
                      {r.cgpa && (
                        <div className="text-center">
                          <p className="text-sm font-bold text-slate-700">{r.cgpa.toFixed(2)}</p>
                          <p className="text-[10px] text-slate-600">CGPA</p>
                        </div>
                      )}
                      {r.backlogs > 0 && (
                        <span className="rounded-lg bg-red-50 px-2 py-0.5 text-xs text-red-500">
                          {r.backlogs} KT
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          r.result === 'pass'
                            ? 'bg-green-50 text-green-600'
                            : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {r.result}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'parents' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                { label: "Father's Name", value: profile.parentInfo?.fatherName },
                {
                  label: "Father's Occupation",
                  value: profile.parentInfo?.fatherOccupation ?? '—',
                },
                { label: "Father's Phone", value: profile.parentInfo?.fatherPhone },
                { label: "Father's Email", value: profile.parentInfo?.fatherEmail ?? '—' },
                { label: "Mother's Name", value: profile.parentInfo?.motherName },
                {
                  label: "Mother's Occupation",
                  value: profile.parentInfo?.motherOccupation ?? '—',
                },
                { label: "Mother's Phone", value: profile.parentInfo?.motherPhone ?? '—' },
                {
                  label: 'Family Income',
                  value: profile.parentInfo?.annualFamilyIncome
                    ? `₹${profile.parentInfo.annualFamilyIncome.toLocaleString('en-IN')}`
                    : '—',
                },
              ].map((f) => (
                <div key={f.label} className="rounded-xl bg-white p-4">
                  <p className="mb-0.5 text-xs text-slate-600">{f.label}</p>
                  <p className="text-sm font-medium text-slate-800">{f.value}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'academic' && (
            <div className="space-y-3">
              {(profile.academicRecords ?? []).length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-600">No academic records</p>
              ) : (
                (profile.academicRecords ?? []).map((r, i) => (
                  <div key={i} className="rounded-xl bg-white p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-800 capitalize">
                          {r.level.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-slate-500">
                          {r.examName} · {r.boardOrUniversity}
                        </p>
                        <p className="text-xs text-slate-600">
                          {r.instituteName} · {r.passingYear}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">{r.percentage}%</p>
                        <span
                          className={`text-xs ${r.verified ? 'text-green-500' : 'text-amber-500'}`}
                        >
                          {r.verified ? '✓ Verified' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          {tab === 'learning' && (
            <div className="grid gap-3 sm:grid-cols-2">
              {credentials.length ? (
                credentials.map((credential) => (
                  <div key={credential._id} className="rounded-xl bg-white p-4">
                    <div className="flex items-start gap-3">
                      <span className="rounded-xl bg-amber-100 p-2 text-amber-700">
                        <Award className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800">{credential.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {credential.courseId?.title ?? 'External course'} · {credential.type}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Issued {new Date(credential.issuedAt).toLocaleDateString('en-IN')}
                        </p>
                        {credential.verificationUrl && (
                          <a
                            href={credential.verificationUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
                          >
                            Verify credential
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="sm:col-span-2 rounded-xl bg-white px-4 py-8 text-center">
                  <Award className="mx-auto size-8 text-slate-300" />
                  <p className="mt-2 text-sm font-medium text-slate-600">
                    No learning credentials yet
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Completed provider certificates and badges will appear here.
                  </p>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Student Form (Create / Edit) ─────────────────────────────────────────────
function StudentFormSection({
  sectionId,
  icon,
  title,
  description,
  children,
}: {
  sectionId: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={sectionId}
      className="scroll-mt-28 overflow-hidden rounded-2xl border border-slate-200 bg-white"
    >
      <div className="flex items-start gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
          {icon}
        </span>
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

function StudentForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Partial<IStudentProfile>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const isEdit = !!initial?._id;

  const schema = Yup.object({
    firstName: Yup.string().required('Required'),
    lastName: Yup.string().required('Required'),
    rollNumber: Yup.string().required('Required'),
    // BPUT / university registration number is issued weeks after enrollment.
    // AO updates it via the dedicated endpoint when received.
    registrationNumber: Yup.string().nullable(),
    aadhaarNumber: Yup.string()
      .transform((value) => (value === '' ? null : value))
      .matches(/^\d{12}$/, 'Aadhaar number must contain exactly 12 digits')
      .nullable(),
    program: Yup.string().required('Required'),
    department: Yup.string().required('Required'),
    batch: Yup.string().required('Required'),
    currentSemester: Yup.number().min(1).max(12).required('Required'),
    phone: Yup.string().required('Required'),
    collegeEmail: Yup.string().email().required('Required'),
    personalEmail: Yup.string().email('Enter a valid email').nullable(),
    gender: Yup.string().required('Required'),
    dateOfBirth: Yup.string().required('Required'),
    admissionDate: Yup.string().required('Required'),
    permanentAddress: Yup.object({
      line1: Yup.string().required('Address line is required'),
      city: Yup.string().required('City is required'),
      district: Yup.string().required('District is required'),
      state: Yup.string().required('State is required'),
      pincode: Yup.string().matches(/^\d{6}$/, 'Enter a valid 6-digit PIN code'),
    }),
  });

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      firstName: initial?.firstName ?? '',
      middleName: initial?.middleName ?? '',
      lastName: initial?.lastName ?? '',
      rollNumber: initial?.rollNumber ?? '',
      registrationNumber: initial?.registrationNumber ?? '',
      enrollmentNumber: initial?.enrollmentNumber ?? '',
      aadhaarNumber: initial?.aadhaarNumber ?? '',
      program: initial?.program ?? '',
      department:
        typeof initial?.department === 'object'
          ? initial.department._id
          : (initial?.department ?? ''),
      batch: initial?.batch ?? '',
      academicYear: initial?.academicYear ?? '',
      currentSemester: initial?.currentSemester ?? 1,
      currentYear: initial?.currentYear ?? 1,
      section: initial?.section ?? '',
      admissionType: initial?.admissionType ?? 'regular',
      category: initial?.category?.toLowerCase() ?? 'general',
      gender: initial?.gender ?? '',
      dateOfBirth: initial?.dateOfBirth ? initial.dateOfBirth.slice(0, 10) : '',
      admissionDate: initial?.admissionDate ? initial.admissionDate.slice(0, 10) : '',
      phone: initial?.phone ?? '',
      personalEmail: initial?.personalEmail ?? '',
      collegeEmail: initial?.collegeEmail ?? '',
      bloodGroup: initial?.bloodGroup ?? '',
      nationality: String(initial?.nationality ?? 'Indian'),
      religion: String(initial?.religion ?? ''),
      status: initial?.status ?? 'active',
      whatsappPhone: String(initial?.whatsappPhone ?? ''),
      emergencyContactName: String(initial?.emergencyContactName ?? ''),
      emergencyContactRelationship: String(initial?.emergencyContactRelationship ?? ''),
      emergencyContactPhone: String(initial?.emergencyContactPhone ?? ''),
      permanentAddress: {
        line1: initial?.permanentAddress?.line1 ?? '',
        line2: initial?.permanentAddress?.line2 ?? '',
        city: initial?.permanentAddress?.city ?? '',
        district: initial?.permanentAddress?.district ?? '',
        state: initial?.permanentAddress?.state ?? '',
        pincode: initial?.permanentAddress?.pincode ?? '',
        country: initial?.permanentAddress?.country ?? 'India',
      },
      currentAddress: {
        line1: initial?.currentAddress?.line1 ?? '',
        line2: initial?.currentAddress?.line2 ?? '',
        city: initial?.currentAddress?.city ?? '',
        district: initial?.currentAddress?.district ?? '',
        state: initial?.currentAddress?.state ?? '',
        pincode: initial?.currentAddress?.pincode ?? '',
        country: initial?.currentAddress?.country ?? '',
      },
      parentInfo: {
        fatherName: initial?.parentInfo?.fatherName ?? '',
        fatherOccupation: initial?.parentInfo?.fatherOccupation ?? '',
        fatherPhone: initial?.parentInfo?.fatherPhone ?? '',
        fatherEmail: initial?.parentInfo?.fatherEmail ?? '',
        motherName: initial?.parentInfo?.motherName ?? '',
        motherOccupation: initial?.parentInfo?.motherOccupation ?? '',
        motherPhone: initial?.parentInfo?.motherPhone ?? '',
        motherEmail: initial?.parentInfo?.motherEmail ?? '',
        guardianName: initial?.parentInfo?.guardianName ?? '',
        guardianPhone: initial?.parentInfo?.guardianPhone ?? '',
        annualFamilyIncome: initial?.parentInfo?.annualFamilyIncome ?? '',
      },
      remarks: initial?.remarks ?? '',
    },
    validationSchema: schema,
    onSubmit: async (values) => {
      const url = isEdit ? `student-profile/${initial!._id}` : 'student-profile';
      const method = isEdit ? 'PUT' : 'POST';
      const body: Partial<typeof values> = { ...values };
      if (!Object.values(values.currentAddress).some((value) => String(value).trim())) {
        delete body.currentAddress;
      }
      delete body.currentSemester;
      delete body.currentYear;
      if (isEdit && (initial?.currentSemester ?? 1) > 1) {
        delete body.program;
        delete body.department;
        delete body.batch;
        delete body.academicYear;
      }
      const res = await mutation(url, { method, body });
      if (res?.results?.success) {
        toast.success(isEdit ? 'Profile updated' : 'Student profile created');
        await onSaved();
        onClose();
      }
    },
  });

  const err = (k: keyof typeof formik.values) =>
    formik.touched[k] && formik.errors[k] ? (
      <p className="mt-1 text-xs text-red-500">{formik.errors[k] as string}</p>
    ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-0 backdrop-blur-sm md:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="flex h-full w-full max-w-7xl flex-col overflow-hidden bg-white  md:h-[calc(100vh-2rem)] md:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {isEdit ? 'Edit Student Profile' : 'New Student Profile'}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Review each section carefully. Required fields are marked with an asterisk.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={formik.handleSubmit} className="flex flex-col overflow-hidden flex-1">
          <nav className="flex shrink-0 gap-2 overflow-x-auto border-b border-slate-100 bg-white px-4 py-3 sm:px-6">
            {[
              ['student-personal', 'Personal'],
              ['student-academic', 'Academic'],
              ['student-contact', 'Contact'],
              ['student-address', 'Address'],
              ['student-family', 'Parent & Guardian'],
              ['student-notes', 'Notes'],
            ].map(([sectionId, label]) => (
              <button
                key={sectionId}
                type="button"
                onClick={() =>
                  document
                    .getElementById(sectionId)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
                className="shrink-0 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-primary-50 hover:text-primary"
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="flex-1 space-y-5 overflow-y-auto bg-slate-50/60 p-4 sm:p-6">
            {/* Personal */}
            <StudentFormSection
              sectionId="student-personal"
              icon={<User className="h-5 w-5" />}
              title="Personal information"
              description="Student identity, background and demographic information."
            >
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    First Name *
                  </label>
                  <input {...formik.getFieldProps('firstName')} className={inputCls} />
                  {err('firstName')}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Middle Name
                  </label>
                  <input {...formik.getFieldProps('middleName')} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Last Name *
                  </label>
                  <input {...formik.getFieldProps('lastName')} className={inputCls} />
                  {err('lastName')}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Gender *
                  </label>
                  <select {...formik.getFieldProps('gender')} className={inputCls}>
                    <option value="">Select</option>
                    {GENDERS.map((g) => (
                      <option key={g} value={g} className="capitalize">
                        {g}
                      </option>
                    ))}
                  </select>
                  {err('gender')}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Date of Birth *
                  </label>
                  <input
                    {...formik.getFieldProps('dateOfBirth')}
                    className={inputCls}
                    type="date"
                  />
                  {err('dateOfBirth')}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Blood Group
                  </label>
                  <input
                    {...formik.getFieldProps('bloodGroup')}
                    className={inputCls}
                    placeholder="A+, B-, O+"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Category
                  </label>
                  <select {...formik.getFieldProps('category')} className={inputCls}>
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Nationality
                  </label>
                  <input {...formik.getFieldProps('nationality')} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">Status</label>
                  <select {...formik.getFieldProps('status')} className={inputCls}>
                    {(Object.keys(STATUS_CFG) as TStudentStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_CFG[s].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Religion
                  </label>
                  <input {...formik.getFieldProps('religion')} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Aadhaar Number
                  </label>
                  <input
                    {...formik.getFieldProps('aadhaarNumber')}
                    className={inputCls}
                    inputMode="numeric"
                    maxLength={12}
                    autoComplete="off"
                    placeholder="12-digit Aadhaar number"
                  />
                  {err('aadhaarNumber')}
                </div>
                <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                  Aadhaar is visible only to authorized administrators and remains encrypted in
                  storage. Supporting files stay in Documents.
                </div>
              </div>
            </StudentFormSection>

            {/* Academic */}
            <StudentFormSection
              sectionId="student-academic"
              icon={<GraduationCap className="h-5 w-5" />}
              title="Academic assignment"
              description="Connect the student to the correct programme, branch, batch and section cohort."
            >
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Roll Number *
                  </label>
                  <input {...formik.getFieldProps('rollNumber')} className={inputCls} />
                  {err('rollNumber')}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    University Reg. No.
                  </label>
                  <input
                    {...formik.getFieldProps('registrationNumber')}
                    className={inputCls}
                    placeholder="Added later by AO when BPUT issues it"
                  />
                  {err('registrationNumber')}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Enrollment No.
                  </label>
                  <input {...formik.getFieldProps('enrollmentNumber')} className={inputCls} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <AsyncSelect
                    label="Program"
                    type="programs"
                    required
                    disabled={isEdit && (initial?.currentSemester ?? 1) > 1}
                    value={formik.values.program || null}
                    onChange={(v) => {
                      void formik.setFieldValue('program', v ?? '');
                      void formik.setFieldValue('department', '');
                      void formik.setFieldValue('batch', '');
                      void formik.setFieldValue('section', '');
                    }}
                  />
                  {err('program')}
                </div>
                <div>
                  <AsyncSelect
                    label="Branch / Department"
                    type="departments"
                    required
                    params={{ program: formik.values.program }}
                    disabled={
                      !formik.values.program || (isEdit && (initial?.currentSemester ?? 1) > 1)
                    }
                    value={formik.values.department || null}
                    onChange={(value) => {
                      void formik.setFieldValue('department', value ?? '');
                      void formik.setFieldValue('batch', '');
                      void formik.setFieldValue('section', '');
                    }}
                  />
                  {err('department')}
                </div>
                <div>
                  <AsyncSelect
                    label="Batch"
                    type="batches"
                    required
                    params={{
                      master: true,
                      valueMode: 'year',
                      program: formik.values.program,
                      departmentId: formik.values.department,
                    }}
                    disabled={
                      !formik.values.department || (isEdit && (initial?.currentSemester ?? 1) > 1)
                    }
                    value={formik.values.batch || null}
                    onChange={(value) => {
                      const batch = value ?? '';
                      void formik.setFieldValue('batch', batch);
                      void formik.setFieldValue(
                        'academicYear',
                        academicYearFromBatch(batch, Number(formik.values.currentSemester)),
                      );
                      void formik.setFieldValue('section', '');
                    }}
                  />
                  {err('batch')}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Admission Type
                  </label>
                  <select {...formik.getFieldProps('admissionType')} className={inputCls}>
                    <option value="regular">Regular</option>
                    <option value="lateral_entry">Lateral Entry</option>
                    <option value="management_quota">Management Quota</option>
                    <option value="nri">NRI</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Current Semester
                  </label>
                  <input
                    value={`Semester ${formik.values.currentSemester}`}
                    className={inputCls}
                    disabled
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Use Promote Semester from Student Management to change this value.
                  </p>
                </div>
                <div>
                  <AsyncSelect
                    label="Section"
                    type="sections"
                    params={{
                      master: true,
                      valueMode: 'name',
                      departmentId: formik.values.department,
                      program: formik.values.program,
                      academicYear: formik.values.academicYear,
                      semesterNo: formik.values.currentSemester,
                    }}
                    disabled={!formik.values.department || !formik.values.batch}
                    value={formik.values.section || null}
                    onChange={(value) => formik.setFieldValue('section', value ?? '')}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Admission Date *
                </label>
                <input
                  {...formik.getFieldProps('admissionDate')}
                  className={inputCls}
                  type="date"
                />
                {err('admissionDate')}
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                Programme, branch and batch determine section-allotment eligibility. Semester
                changes use the governed Promote Semester action.
              </div>
            </StudentFormSection>

            {/* Contact */}
            <StudentFormSection
              sectionId="student-contact"
              icon={<Phone className="h-5 w-5" />}
              title="Contact and emergency details"
              description="Primary communication channels and the person to contact in an emergency."
            >
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">Phone *</label>
                  <input {...formik.getFieldProps('phone')} className={inputCls} />
                  {err('phone')}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    College Email *
                  </label>
                  <input
                    {...formik.getFieldProps('collegeEmail')}
                    className={inputCls}
                    type="email"
                  />
                  {err('collegeEmail')}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Personal Email
                  </label>
                  <input
                    {...formik.getFieldProps('personalEmail')}
                    className={inputCls}
                    type="email"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    WhatsApp Number
                  </label>
                  <input {...formik.getFieldProps('whatsappPhone')} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Emergency Contact
                  </label>
                  <input {...formik.getFieldProps('emergencyContactName')} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Relationship
                  </label>
                  <input
                    {...formik.getFieldProps('emergencyContactRelationship')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Emergency Phone
                  </label>
                  <input {...formik.getFieldProps('emergencyContactPhone')} className={inputCls} />
                </div>
              </div>
            </StudentFormSection>

            <StudentFormSection
              sectionId="student-address"
              icon={<MapPin className="h-5 w-5" />}
              title="Address information"
              description="Permanent address is required. Add the current address only when it is different."
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Permanent address
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Address Line 1 *
                  </label>
                  <input {...formik.getFieldProps('permanentAddress.line1')} className={inputCls} />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Address Line 2
                  </label>
                  <input {...formik.getFieldProps('permanentAddress.line2')} className={inputCls} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {(['city', 'district', 'state', 'pincode', 'country'] as const).map((field) => (
                  <div key={field}>
                    <label className="mb-1.5 block text-xs font-medium capitalize text-slate-600">
                      {field} *
                    </label>
                    <input
                      {...formik.getFieldProps(`permanentAddress.${field}`)}
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-100 pt-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Current address (optional)
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    {...formik.getFieldProps('currentAddress.line1')}
                    className={inputCls}
                    placeholder="Address line 1"
                  />
                  <input
                    {...formik.getFieldProps('currentAddress.line2')}
                    className={inputCls}
                    placeholder="Address line 2"
                  />
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  {(['city', 'district', 'state', 'pincode', 'country'] as const).map((field) => (
                    <input
                      key={field}
                      {...formik.getFieldProps(`currentAddress.${field}`)}
                      className={inputCls}
                      placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                    />
                  ))}
                </div>
              </div>
            </StudentFormSection>

            <StudentFormSection
              sectionId="student-family"
              icon={<Users className="h-5 w-5" />}
              title="Parent and guardian information"
              description="Family contacts used for official communication and student support."
            >
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Father Name
                  </label>
                  <input {...formik.getFieldProps('parentInfo.fatherName')} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Father Occupation
                  </label>
                  <input
                    {...formik.getFieldProps('parentInfo.fatherOccupation')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Father Phone
                  </label>
                  <input {...formik.getFieldProps('parentInfo.fatherPhone')} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Father Email
                  </label>
                  <input
                    type="email"
                    {...formik.getFieldProps('parentInfo.fatherEmail')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Mother Name
                  </label>
                  <input {...formik.getFieldProps('parentInfo.motherName')} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Mother Occupation
                  </label>
                  <input
                    {...formik.getFieldProps('parentInfo.motherOccupation')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Mother Phone
                  </label>
                  <input {...formik.getFieldProps('parentInfo.motherPhone')} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Mother Email
                  </label>
                  <input
                    type="email"
                    {...formik.getFieldProps('parentInfo.motherEmail')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Guardian Name
                  </label>
                  <input
                    {...formik.getFieldProps('parentInfo.guardianName')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Guardian Phone
                  </label>
                  <input
                    {...formik.getFieldProps('parentInfo.guardianPhone')}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Annual Family Income
                  </label>
                  <input
                    type="number"
                    min="0"
                    {...formik.getFieldProps('parentInfo.annualFamilyIncome')}
                    className={inputCls}
                  />
                </div>
              </div>
            </StudentFormSection>

            <StudentFormSection
              sectionId="student-notes"
              icon={<HeartPulse className="h-5 w-5" />}
              title="Administrative notes"
              description="Internal context for authorized staff. These notes are not shown in the public student profile."
            >
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Remarks</label>
                <textarea {...formik.getFieldProps('remarks')} className={inputCls} rows={4} />
              </div>
            </StudentFormSection>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <CustomButton variant="secondary" onClick={onClose} type="button">
              Cancel
            </CustomButton>
            <CustomButton variant="primary" type="submit" loading={isLoading}>
              {isEdit ? 'Save Changes' : 'Create Profile'}
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Profile Detail Drawer ────────────────────────────────────────────────────
function ProfileDetailDrawer({
  profile,
  onClose,
  canPromote,
  canBonafide,
  canSetRegNo,
  canViewSensitive,
  onPromote,
  onBonafide,
  onSetRegNo,
}: {
  profile: IStudentProfile;
  onClose: () => void;
  canPromote: boolean;
  canBonafide: boolean;
  canSetRegNo: boolean;
  canViewSensitive: boolean;
  onPromote: () => void;
  onBonafide: () => void;
  onSetRegNo: () => void;
}) {
  const [tab, setTab] = useState<'info' | 'results' | 'parents' | 'documents' | 'learning'>('info');
  const cfg = STATUS_CFG[profile.status] ?? STATUS_CFG.active;
  const studentUserId =
    typeof profile.userId === 'object' && profile.userId !== null
      ? ((profile.userId as { _id?: string })._id ?? String(profile.userId))
      : typeof profile.userId === 'string'
        ? profile.userId
        : null;

  const { data: learningRaw } = useSwr<{
    data?: Array<{
      _id: string;
      title: string;
      type: 'certificate' | 'badge';
      issuedAt: string;
      verificationUrl?: string;
      courseId?: { title?: string; provider?: string };
    }>;
  }>(studentUserId ? `lms-integration/credentials?studentId=${studentUserId}` : null);
  const learningCredentials = learningRaw?.data ?? [];
  const semesterResults = profile.semesterResults ?? [];
  const latestResult = semesterResults.at(-1);
  const passedSemesters = semesterResults.filter((result) => result.result === 'pass').length;
  const resultTrendPoints = semesterResults.map((result, index) => {
    const x =
      semesterResults.length === 1 ? 150 : 20 + (index * 260) / (semesterResults.length - 1);
    const y = 112 - (Math.max(0, Math.min(10, result.sgpa ?? 0)) / 10) * 88;
    return { x, y, result };
  });
  const profileSignals = [
    profile.collegeEmail,
    profile.phone,
    profile.registrationNumber,
    profile.department,
    profile.section,
    profile.currentCgpa,
    profile.parentInfo?.fatherName || profile.parentInfo?.motherName,
    profile.permanentAddress,
  ];
  const profileCompleteness = Math.round(
    (profileSignals.filter((signal) => Boolean(signal)).length / profileSignals.length) * 100,
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end bg-slate-200/80 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        role="dialog"
        aria-modal="true"
        aria-label={`Student details for ${fullName(profile)}`}
        className="flex h-[96dvh] w-full flex-col overflow-hidden rounded-t-3xl border-l border-slate-200 bg-slate-50 sm:h-full sm:w-[94vw] sm:rounded-none lg:w-[82vw] xl:max-w-6xl"
      >
        {/* Header */}
        <div className="relative overflow-hidden border-b border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 px-4 py-4 sm:px-6 sm:py-5">
          <div className="pointer-events-none absolute -right-12 -top-20 h-48 w-48 rounded-full bg-violet-200/30 blur-3xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-gradient-to-br from-indigo-100 to-cyan-100 sm:h-16 sm:w-16">
                {profile.passportPhotoUrl ? (
                  <Image
                    src={profile.passportPhotoUrl}
                    alt={fullName(profile)}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-bold text-slate-600">
                    {profile.firstName[0]}
                    {profile.lastName[0]}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-base font-bold text-slate-900 sm:text-lg">
                    {fullName(profile)}
                  </p>
                  <span className="inline-flex shrink-0 items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-700">
                    Profile {profileCompleteness}% complete
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {profile.rollNumber} · {profile.program}
                </p>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.text}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} /> {cfg.label}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close student details"
              className="mt-1 shrink-0 rounded-xl border border-slate-200 bg-white/80 p-2.5 transition hover:bg-white"
            >
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Admin actions */}
        {(canPromote || canBonafide) && (
          <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
            {canPromote && (
              <CustomButton
                variant="tertiary"
                className="py-1.5! text-xs! flex-1"
                startIcon={<ArrowUpCircle className="h-3.5 w-3.5" />}
                onClick={onPromote}
              >
                Promote Sem
              </CustomButton>
            )}
            {canBonafide && (
              <CustomButton
                variant="tertiary"
                className="py-1.5! text-xs! flex-1"
                startIcon={<FileText className="h-3.5 w-3.5" />}
                onClick={onBonafide}
              >
                Bonafide
              </CustomButton>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 sm:px-6">
          {(
            [
              'info',
              'results',
              'learning',
              ...(canViewSensitive ? (['parents', 'documents'] as const) : []),
            ] as const
          ).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 rounded-xl px-4 py-2 text-xs font-semibold capitalize transition-all ${
                tab === t
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 hover:bg-indigo-50 hover:text-indigo-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-5 lg:p-6">
          <StudentTabIllustration tab={tab as TStudentDetailTab} />
          {tab === 'info' && (
            <div className="space-y-4">
              {canSetRegNo && (
                <button
                  type="button"
                  onClick={onSetRegNo}
                  className="flex w-full items-center justify-between rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-white px-4 py-3 text-left transition hover:border-indigo-200"
                >
                  <div>
                    <p className="text-xs text-slate-500">University Reg. No.</p>
                    <p className="text-sm font-medium text-slate-800">
                      {profile.registrationNumber ?? 'Pending — click to add'}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-primary">
                    {profile.registrationNumber ? 'Edit' : 'Add'}
                  </span>
                </button>
              )}
              <section className="overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-4 sm:p-5">
                <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(240px,.6fr)]">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-500">
                      Semester pathway
                    </p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">{profile.program}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {deptName(profile.department)} · Academic year {profile.academicYear}
                    </p>
                    <svg
                      viewBox="0 0 620 84"
                      className="mt-3 w-full"
                      role="img"
                      aria-label="Student semester journey"
                    >
                      <defs>
                        <linearGradient id="journeyPath" x1="0" y1="0" x2="1" y2="0">
                          <stop stopColor="#6366f1" />
                          <stop offset=".55" stopColor="#06b6d4" />
                          <stop offset="1" stopColor="#10b981" />
                        </linearGradient>
                      </defs>
                      <line
                        x1="45"
                        y1="39"
                        x2="575"
                        y2="39"
                        stroke="#dbeafe"
                        strokeWidth="10"
                        strokeLinecap="round"
                      />
                      <line
                        x1="45"
                        y1="39"
                        x2={45 + (530 * Math.max(Math.min(profile.currentSemester, 8) - 1, 0)) / 7}
                        y2="39"
                        stroke="url(#journeyPath)"
                        strokeWidth="10"
                        strokeLinecap="round"
                      />
                      {Array.from({ length: 8 }, (_, index) => {
                        const semester = index + 1;
                        const x = 45 + (530 * index) / 7;
                        const active = semester === profile.currentSemester;
                        const complete = semester < profile.currentSemester;
                        return (
                          <g key={semester}>
                            <circle
                              cx={x}
                              cy="39"
                              r={active ? 12 : 8}
                              fill={active ? '#4f46e5' : complete ? '#22c55e' : 'white'}
                              stroke={active ? '#c7d2fe' : complete ? '#bbf7d0' : '#cbd5e1'}
                              strokeWidth="4"
                            />
                            <text
                              x={x}
                              y="72"
                              textAnchor="middle"
                              fontSize="9"
                              fontWeight={active ? '700' : '500'}
                              fill={active ? '#4338ca' : '#64748b'}
                            >
                              {semester}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Semester numbers · Current: Semester {profile.currentSemester}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-5 gap-y-3 border-t border-indigo-100 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                    {[
                      ['Study year', profile.currentYear],
                      ['Section', profile.section ?? '—'],
                      ['Admission batch', profile.batch],
                      ['Academic year', profile.academicYear],
                    ].map(([label, value]) => (
                      <div key={String(label)}>
                        <p className="text-[9px] uppercase tracking-wide text-slate-400">{label}</p>
                        <strong className="mt-1 block text-base text-slate-800">{value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="mb-4">
                  <p className="text-sm font-bold text-slate-800">Academic and contact profile</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Current institutional identity, placement and communication records.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {[
                    ...(canSetRegNo
                      ? []
                      : [
                          {
                            label: 'University Reg. No.',
                            value: profile.registrationNumber ?? 'Pending',
                          },
                        ]),
                    { label: 'College Email', value: profile.collegeEmail },
                    { label: 'Personal Email', value: profile.personalEmail ?? 'Not provided' },
                    { label: 'Phone', value: profile.phone },
                    { label: 'WhatsApp', value: profile.whatsappPhone ?? 'Not provided' },
                    { label: 'Department', value: deptName(profile.department) },
                    { label: 'Section', value: profile.section ?? '—' },
                    { label: 'Category', value: profile.category },
                    { label: 'Gender', value: profile.gender },
                    { label: 'Date of Birth', value: fmtDate(profile.dateOfBirth) },
                    { label: 'Blood Group', value: profile.bloodGroup ?? 'Not provided' },
                    { label: 'Nationality', value: profile.nationality ?? 'Not provided' },
                    { label: 'Religion', value: profile.religion ?? 'Not provided' },
                    { label: 'Admission Type', value: profile.admissionType },
                    { label: 'Admission Date', value: fmtDate(profile.admissionDate) },
                    { label: 'Enrollment No.', value: profile.enrollmentNumber ?? 'Pending' },
                  ].map((f) => {
                    const displayValue = formatDetailValue(f.label, f.value ?? '—');
                    return (
                      <div key={f.label} className="min-w-0 border-b border-slate-100 px-1 py-3">
                        <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                          {f.label}
                        </p>
                        <p
                          className="mt-1 truncate text-sm font-semibold text-slate-800"
                          title={displayValue}
                        >
                          {displayValue}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
              {profile.placedCompany && (
                <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-cyan-50 px-5 py-4">
                  <p className="text-xs text-green-600 font-medium">Placed</p>
                  <p className="text-sm font-semibold text-green-800">{profile.placedCompany}</p>
                  {profile.placementPackage && (
                    <p className="text-xs text-green-600">{profile.placementPackage} LPA</p>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'results' &&
            (semesterResults.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-14 text-center">
                <TrendingUp className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-600">
                  No semester results available
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Published academic results will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                    <p className="text-[9px] font-semibold uppercase text-indigo-500">
                      Latest SGPA
                    </p>
                    <strong className="mt-1 block text-2xl text-indigo-700">
                      {latestResult?.sgpa?.toFixed(2) ?? '—'}
                    </strong>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <p className="text-[9px] font-semibold uppercase text-emerald-600">
                      Semesters passed
                    </p>
                    <strong className="mt-1 block text-2xl text-emerald-700">
                      {passedSemesters}/{semesterResults.length}
                    </strong>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                    <p className="text-[9px] font-semibold uppercase text-amber-600">
                      Active backlogs
                    </p>
                    <strong className="mt-1 block text-2xl text-amber-700">
                      {profile.totalBacklogs ?? 0}
                    </strong>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-3">
                    <p className="text-sm font-bold text-slate-800">Semester performance trend</p>
                    <p className="text-xs text-slate-500">
                      Published SGPA progression on a 10-point scale.
                    </p>
                  </div>
                  <svg
                    viewBox="0 0 300 135"
                    className="h-48 w-full"
                    role="img"
                    aria-label="Semester SGPA trend"
                  >
                    <defs>
                      <linearGradient id="studentResultArea" x1="0" y1="0" x2="0" y2="1">
                        <stop stopColor="#6366f1" stopOpacity="0.32" />
                        <stop offset="1" stopColor="#6366f1" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>
                    {[24, 46, 68, 90, 112].map((y) => (
                      <line
                        key={y}
                        x1="20"
                        x2="280"
                        y1={y}
                        y2={y}
                        stroke="#e2e8f0"
                        strokeDasharray="3 4"
                      />
                    ))}
                    <path
                      d={`M ${resultTrendPoints.map((point) => `${point.x} ${point.y}`).join(' L ')} L ${resultTrendPoints.at(-1)?.x} 112 L ${resultTrendPoints[0]?.x} 112 Z`}
                      fill="url(#studentResultArea)"
                    />
                    <polyline
                      points={resultTrendPoints.map((point) => `${point.x},${point.y}`).join(' ')}
                      fill="none"
                      stroke="#4f46e5"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {resultTrendPoints.map(({ x, y, result }) => (
                      <g key={result.semesterNo}>
                        <circle cx={x} cy={y} r="5" fill="white" stroke="#4f46e5" strokeWidth="3" />
                        <text x={x} y="128" textAnchor="middle" fontSize="8" fill="#64748b">
                          Semester {result.semesterNo}
                        </text>
                        <text
                          x={x}
                          y={y - 9}
                          textAnchor="middle"
                          fontSize="8"
                          fontWeight="700"
                          fill="#4338ca"
                        >
                          {result.sgpa?.toFixed(1) ?? '—'}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {semesterResults.map((r) => (
                    <div
                      key={r.semesterNo}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Sem {r.semesterNo}</p>
                        <p className="text-xs text-slate-600">{r.academicYear}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {r.sgpa && (
                          <div className="text-center">
                            <p className="text-sm font-bold text-primary">{r.sgpa.toFixed(2)}</p>
                            <p className="text-[10px] text-slate-600">SGPA</p>
                          </div>
                        )}
                        {r.backlogs > 0 && (
                          <span className="rounded-lg bg-red-50 px-2 py-0.5 text-xs text-red-500">
                            {r.backlogs} KT
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${r.result === 'pass' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}
                        >
                          {r.result}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

          {tab === 'parents' && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="grid items-center gap-4 border-b border-slate-200 bg-gradient-to-r from-violet-50 to-rose-50 p-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:p-5">
                <svg
                  viewBox="0 0 180 92"
                  className="mx-auto w-44"
                  role="img"
                  aria-label="Registered family contacts"
                >
                  <path
                    d="M90 20 V45 M28 45 H152 M28 45 V68 M90 45 V68 M152 45 V68"
                    fill="none"
                    stroke="#c4b5fd"
                    strokeWidth="2"
                  />
                  <circle cx="90" cy="16" r="12" fill="#c7d2fe" />
                  <circle cx="28" cy="72" r="12" fill="#bfdbfe" />
                  <circle cx="90" cy="72" r="12" fill="#fbcfe8" />
                  <circle cx="152" cy="72" r="12" fill="#bbf7d0" />
                  <text
                    x="90"
                    y="19"
                    textAnchor="middle"
                    fontSize="7"
                    fontWeight="700"
                    fill="#4338ca"
                  >
                    Student
                  </text>
                  <text x="28" y="91" textAnchor="middle" fontSize="7" fill="#475569">
                    Father
                  </text>
                  <text x="90" y="91" textAnchor="middle" fontSize="7" fill="#475569">
                    Mother
                  </text>
                  <text x="152" y="91" textAnchor="middle" fontSize="7" fill="#475569">
                    Guardian
                  </text>
                </svg>
                <div>
                  <p className="text-sm font-bold text-slate-800">Family and emergency contacts</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Primary contacts registered for communication, consent and emergencies.
                  </p>
                </div>
              </div>
              <div className="divide-y divide-slate-100 px-4 sm:px-5">
                {[
                  [
                    'Father',
                    profile.parentInfo?.fatherName,
                    profile.parentInfo?.fatherPhone,
                    profile.parentInfo?.fatherEmail,
                  ],
                  [
                    'Mother',
                    profile.parentInfo?.motherName,
                    profile.parentInfo?.motherPhone,
                    profile.parentInfo?.motherEmail,
                  ],
                  [
                    'Guardian',
                    profile.parentInfo?.guardianName,
                    profile.parentInfo?.guardianPhone,
                    null,
                  ],
                  [
                    'Emergency',
                    profile.emergencyContactName ?? profile.parentInfo?.guardianName,
                    profile.emergencyContactPhone ?? profile.parentInfo?.guardianPhone,
                    profile.emergencyContactRelationship,
                  ],
                ].map(([label, name, phone, detail]) => (
                  <div
                    key={String(label)}
                    className="grid gap-2 py-4 sm:grid-cols-[110px_minmax(0,1fr)_180px]"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {label}
                    </p>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {name || 'Not provided'}
                      </p>
                      {detail && <p className="mt-0.5 text-xs text-slate-500">{detail}</p>}
                    </div>
                    <p className="text-sm text-slate-600 sm:text-right">
                      {phone || 'No phone recorded'}
                    </p>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-5">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                  <div>
                    <p className="text-xs font-semibold text-slate-700">Permanent address</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {profile.permanentAddress
                        ? [
                            profile.permanentAddress.line1,
                            profile.permanentAddress.line2,
                            profile.permanentAddress.city,
                            profile.permanentAddress.district,
                            profile.permanentAddress.state,
                            profile.permanentAddress.pincode,
                          ]
                            .filter(Boolean)
                            .join(', ')
                        : 'No permanent address recorded.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'documents' && <DocumentsTabContent profile={profile} />}
          {tab === 'learning' &&
            (learningCredentials.length ? (
              <div className="relative space-y-0 pl-10 before:absolute before:bottom-6 before:left-[19px] before:top-6 before:w-0.5 before:bg-gradient-to-b before:from-amber-300 before:via-violet-300 before:to-cyan-300">
                {learningCredentials.map((credential) => (
                  <div
                    key={credential._id}
                    className="relative border-b border-slate-200 bg-transparent py-5 last:border-0"
                  >
                    <span className="absolute -left-10 top-6 z-10 flex h-9 w-9 items-center justify-center rounded-full border-4 border-slate-50 bg-amber-400 text-white">
                      <Award className="h-4 w-4" />
                    </span>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-semibold text-slate-800">{credential.title}</p>
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-semibold capitalize text-amber-700">
                            {credential.type}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {credential.courseId?.title ?? 'External learning'} · {credential.type} ·{' '}
                          {new Date(credential.issuedAt).toLocaleDateString('en-IN')}
                        </p>
                        {credential.verificationUrl && (
                          <a
                            href={credential.verificationUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
                          >
                            Verify credential
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-slate-50 px-4 py-8 text-center">
                <Award className="mx-auto size-7 text-slate-300" />
                <p className="mt-2 text-sm font-medium text-slate-600">
                  No synchronized learning credentials
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Provider certificates and badges will appear after verified progress sync.
                </p>
              </div>
            ))}
        </div>
      </motion.div>
    </div>
  );
}

const DOC_LABELS: Record<string, string> = {
  hsc_10th_marksheet: 'HSC (10th) Marksheet',
  hsc_10th_certificate: 'HSC (10th) Pass Certificate',
  plus_two_marksheet: '+2 / Diploma Marksheet',
  plus_two_certificate: '+2 / Diploma / Degree Certificate',
  plus_three_marksheet: '+3 / B.Tech Marksheet',
  plus_three_certificate: '+3 / B.Tech / Degree Certificate',
  school_leaving_certificate: 'School / College Leaving Certificate',
  aadhaar_card: 'Aadhaar Card',
  caste_certificate: 'Caste Certificate',
  residence_certificate: 'Residence Certificate',
  income_certificate: 'Income Certificate',
  anti_ragging_student: 'Anti-Ragging Affidavit (Student)',
  anti_ragging_guardian: 'Anti-Ragging Affidavit (Guardian)',
  passport_photo: 'Passport Size Photo',
  apaar_id: 'APAAR ID',
};

const DOC_STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pending review', cls: 'bg-slate-100 text-slate-500' },
  verified: { label: 'Verified', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
};

function DocumentsTabContent({ profile }: { profile: IStudentProfile }) {
  const [previewFiles, setPreviewFiles] = useState<IViewerFile[]>([]);
  const [previewTitle, setPreviewTitle] = useState('Student document');

  const app =
    typeof profile.admissionApplicationId === 'object' && profile.admissionApplicationId !== null
      ? profile.admissionApplicationId
      : null;
  const appId =
    typeof profile.admissionApplicationId === 'string'
      ? profile.admissionApplicationId
      : (app as { _id?: string })?._id;

  const { data: fetchedApp } = useSwr<{ data?: { documentChecklist?: IDocumentChecklistItem[] } }>(
    !app && appId ? `admission/applications/${appId}` : null,
  );

  const rawDocs =
    app?.documentChecklist ?? fetchedApp?.data?.documentChecklist ?? profile.documents ?? [];

  const docs: IDocumentChecklistItem[] = Array.isArray(rawDocs) ? rawDocs : [];
  const verifiedDocuments = docs.filter((document) => document.status === 'verified').length;
  const pendingDocuments = docs.filter(
    (document) => !document.status || document.status === 'pending',
  ).length;

  if (docs.length === 0) {
    return (
      <div className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No documents were uploaded or submitted for this student.
      </div>
    );
  }

  return (
    <>
      <div className="grid items-center gap-5 rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-emerald-50 p-5 sm:grid-cols-[190px_minmax(0,1fr)]">
        <div className="relative mx-auto h-40 w-40">
          <svg
            viewBox="0 0 160 160"
            className="h-full w-full -rotate-90"
            role="img"
            aria-label="Document verification progress"
          >
            <circle cx="80" cy="80" r="58" fill="white" stroke="#e2e8f0" strokeWidth="15" />
            <circle
              cx="80"
              cy="80"
              r="58"
              fill="none"
              stroke="#10b981"
              strokeWidth="15"
              strokeLinecap="round"
              strokeDasharray={`${docs.length ? (verifiedDocuments / docs.length) * 364.4 : 0} 364.4`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <strong className="text-2xl text-emerald-700">
              {docs.length ? Math.round((verifiedDocuments / docs.length) * 100) : 0}%
            </strong>
            <span className="text-[9px] uppercase tracking-wide text-slate-400">verified</span>
          </div>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800">Document readiness</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Verification status across all submitted admission and identity records.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              ['Submitted', docs.length, 'text-indigo-700'],
              ['Verified', verifiedDocuments, 'text-emerald-700'],
              ['Pending', pendingDocuments, 'text-amber-700'],
            ].map(([label, value, tone]) => (
              <div key={String(label)} className="border-l-2 border-slate-200 pl-3">
                <strong className={`block text-xl ${tone}`}>{value}</strong>
                <span className="text-[9px] text-slate-400">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {docs.map((d: IDocumentChecklistItem, idx: number) => {
          const cfg = DOC_STATUS_CFG[d.status ?? 'verified'] ?? DOC_STATUS_CFG.verified;
          const label = DOC_LABELS[d.docType] ?? d.docType;
          const files = d.files?.length
            ? d.files
            : d.uploadedFileUrl
              ? [{ url: d.uploadedFileUrl, name: undefined }]
              : [];
          return (
            <div
              key={d.docType || `doc-${idx}`}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-4 transition hover:border-indigo-200"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-800">{label}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.cls}`}>
                  {cfg.label}
                </span>
              </div>
              {d.status === 'rejected' && d.rejectionReason && (
                <p className="mb-2 text-xs text-red-600">Reason: {d.rejectionReason}</p>
              )}
              {files.length === 0 ? (
                <p className="text-xs text-slate-500">
                  {d.originalSubmitted || d.photocopySubmitted
                    ? `Physical copy submitted (${d.originalSubmitted ? 'Original' : ''}${d.originalSubmitted && d.photocopySubmitted ? ' + ' : ''}${d.photocopySubmitted ? 'Photocopy' : ''})`
                    : 'No digital file uploaded.'}
                </p>
              ) : (
                <ul className="space-y-1">
                  {files.map((f: { url: string; name?: string }, i: number) => (
                    <li
                      key={`${d.docType}-${i}`}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="truncate text-xs text-slate-600">
                        {f.name ?? `Uploaded File ${files.length > 1 ? `#${i + 1}` : ''}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewTitle(label);
                          setPreviewFiles(
                            files.map((file, fileIndex) => ({
                              url: file.url,
                              name: file.name ?? `${label} ${fileIndex + 1}`,
                            })),
                          );
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Preview
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <FileViewer
        open={previewFiles.length > 0}
        onClose={() => setPreviewFiles([])}
        files={previewFiles}
        title={previewTitle}
      />
    </>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────
const PAGE_SIZE = 10;

function buildStudentUrl(params: {
  page: number;
  search: string;
  program: string;
  semester: string;
  status: string;
}) {
  const q = new URLSearchParams();
  q.set('page', String(params.page));
  q.set('limit', String(PAGE_SIZE));
  if (params.search) q.set('search', params.search);
  if (params.program) q.set('program', params.program);
  if (params.semester) q.set('semester', params.semester);
  if (params.status) q.set('status', params.status);
  return `student-profile?${q.toString()}`;
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
function StudentProfilePage() {
  const searchParams = useSearchParams();
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const isStudent = activeRole === 'student';
  const staffRoles = [
    'super_admin',
    'admin',
    'principal',
    'dean_academic',
    'hod',
    'faculty',
    'examination_cell',
    'accounts_department',
    'administration_office',
    'assistant_administration_officer',
    'admission_incharge',
    'placement_cell',
    'scholarship_cell',
  ];
  const lifecycleRoles = [
    'super_admin',
    'admin',
    'principal',
    'dean_academic',
    'administration_office',
  ];
  const statsRoles = [...lifecycleRoles, 'hod', 'assistant_administration_officer'];
  const sensitiveRoles = [
    ...lifecycleRoles,
    'assistant_administration_officer',
    'admission_incharge',
    'scholarship_cell',
  ];
  const registrationNumberRoles = [
    'super_admin',
    'admin',
    'principal',
    'administration_office',
    'assistant_administration_officer',
    'admission_incharge',
  ];
  const hasEditPerm = useHasPermission('student_profile', 'edit');
  const hasCreatePerm = useHasPermission('student_profile', 'create');
  const canStageImport = useHasPermission('import_center', 'create');
  const canImport = hasCreatePerm && canStageImport;
  const hasViewPerm = useHasPermission('student_profile', 'view');
  const isStaff = !isStudent && staffRoles.includes(activeRole ?? '') && hasViewPerm;
  const canLifecycleManage = lifecycleRoles.includes(activeRole ?? '') && hasEditPerm;
  const canCreateStudent = lifecycleRoles.includes(activeRole ?? '') && hasCreatePerm;
  const canViewStats = statsRoles.includes(activeRole ?? '') && hasViewPerm;
  const canViewSensitive = sensitiveRoles.includes(activeRole ?? '') && hasViewPerm;
  const canSetRegistrationNumber =
    registrationNumberRoles.includes(activeRole ?? '') && hasEditPerm;
  const canIssueBonafide = statsRoles.includes(activeRole ?? '') && hasCreatePerm;

  const initialSearch = searchParams.get('search') ?? '';
  const initialStatus = searchParams.get('status') ?? '';
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [filterProg, setFilterProg] = useState('');
  const [filterSem, setFilterSem] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<IStudentProfile | null>(null);
  const [editMeOpen, setEditMeOpen] = useState(false);
  const [detail, setDetail] = useState<IStudentProfile | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [search]);

  // Reset page on filter change
  const handleSearch = (v: string) => {
    setSearch(v);
  };
  const handleProgram = (v: string) => {
    setFilterProg(v);
    setPage(1);
  };
  const handleSemester = (v: string) => {
    setFilterSem(v);
    setPage(1);
  };

  const apiUrl = useMemo(
    () =>
      isStaff
        ? buildStudentUrl({
            page,
            search: debouncedSearch,
            program: filterProg,
            semester: filterSem,
            status: initialStatus,
          })
        : null,
    [isStaff, page, debouncedSearch, filterProg, filterSem, initialStatus],
  );

  // Fetch
  const { data: raw, isLoading, isValidating, mutate } = useSwr(apiUrl);
  const {
    data: meRaw,
    isLoading: isLoadingMe,
    error: meError,
    mutate: mutateMe,
  } = useSwr(isStudent ? 'student-profile/me' : null);
  const { data: statsRaw, mutate: mutateStats } = useSwr(
    canViewStats ? 'student-profile/stats' : null,
  );

  const profiles = useMemo(
    () =>
      (raw as { data?: IStudentProfile[] })?.data ??
      (raw as { data?: { data?: IStudentProfile[] } })?.data?.data ??
      [],
    [raw],
  );
  const totalCount = useMemo(
    () =>
      (raw as { data?: { total?: number } })?.data?.total ??
      (raw as { data?: { data?: IStudentProfile[]; total?: number } })?.data?.total ??
      profiles.length,
    [raw, profiles],
  );
  const me = meRaw?.data;

  const stats: IStudentStats = useMemo(() => {
    const s = (statsRaw as { data?: IStudentStats })?.data ?? (statsRaw as IStudentStats);
    if (
      s &&
      typeof s.total === 'number' &&
      typeof s.active === 'number' &&
      typeof s.detained === 'number' &&
      typeof s.passedOut === 'number'
    ) {
      return s;
    }
    // Keep fallback values on one scope. Mixing the server pagination total with
    // status counts from the currently loaded collection can produce impossible
    // combinations such as 300 active students out of 140 total students.
    return {
      total: profiles.length,
      active: profiles.filter((p) => p.status === 'active').length,
      detained: profiles.filter((p) => p.status === 'detained').length,
      passedOut: profiles.filter((p) => p.status === 'passed_out').length,
    };
  }, [statsRaw, profiles]);

  const { mutation } = useMutation();

  const handleDelete = async (s: IStudentProfile) => {
    const r = await Swal.fire({
      title: 'Delete profile?',
      text: fullName(s),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#d33',
    });
    if (!r.isConfirmed) return;
    const res = await mutation(`student-profile/${s._id}`, { method: 'DELETE', isAlert: true });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Deleted');
      mutate();
    } else toast.error('Failed to delete');
  };

  const handlePromote = async (s: IStudentProfile) => {
    const r = await Swal.fire({
      title: `Promote to Sem ${s.currentSemester + 1}?`,
      text: fullName(s),
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Promote',
      confirmButtonColor: '#0178D7',
    });
    if (!r.isConfirmed) return;
    const res = await mutation(`student-profile/${s._id}/promote`, {
      method: 'POST',
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Promoted');
      mutate();
      setDetail(null);
    } else toast.error('Failed');
  };

  const handleBonafide = async (s: IStudentProfile) => {
    const request = await Swal.fire({
      title: 'Issue bonafide certificate',
      input: 'text',
      inputLabel: `Purpose for ${fullName(s)}`,
      inputPlaceholder: 'Enter the certificate purpose',
      showCancelButton: true,
      confirmButtonText: 'Generate',
      confirmButtonColor: '#0178D7',
      inputValidator: (value) =>
        value.trim().length < 3 ? 'Purpose must contain at least 3 characters' : undefined,
    });
    if (!request.isConfirmed) return;
    const ok = await downloadPdf(
      `student-profile/${s._id}/bonafide`,
      `bonafide-${s.rollNumber ?? s._id}.pdf`,
      { method: 'POST', body: { purpose: String(request.value).trim() } },
    );
    if (ok) toast.success('Bonafide certificate downloaded');
    else toast.error('Failed to generate bonafide');
  };

  const handleSetRegNo = async (s: IStudentProfile) => {
    const { value } = await Swal.fire({
      title: 'University Registration No.',
      input: 'text',
      inputLabel: `For ${fullName(s)} (${s.rollNumber})`,
      inputValue: s.registrationNumber ?? '',
      inputPlaceholder: 'e.g. BPUT/2026/CSE/12345',
      showCancelButton: true,
      confirmButtonText: 'Save',
      confirmButtonColor: '#0178D7',
      inputValidator: (v) => (!v || !v.trim() ? 'Registration number is required' : null),
    });
    if (!value) return;
    const res = await mutation(`student-profile/${s._id}/registration-number`, {
      method: 'PATCH',
      body: { registrationNumber: value.trim() },
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('University registration number saved');
      mutate();
      setDetail(null);
    } else toast.error('Failed to save registration number');
  };

  const columns: Column<IStudentProfile>[] = [
    {
      field: 'firstName',
      title: 'Student',
      render: (row) => {
        const cfg = STATUS_CFG[row.status] ?? STATUS_CFG.active;
        return (
          <div className="flex items-center gap-3">
            <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-primary/10">
              {row.passportPhotoUrl ? (
                <Image
                  src={row.passportPhotoUrl}
                  alt={fullName(row)}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full  w-full items-center justify-center text-xs font-bold text-primary">
                  {row.firstName[0]}
                  {row.lastName[0]}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 text-nowrap">{fullName(row)}</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-600 text-nowrap">{row.rollNumber}</p>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} /> {cfg.label}
                </span>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      field: 'program',
      title: 'Academic Cohort',
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-nowrap text-slate-700">{row.program}</p>
          <p className="text-xs text-slate-600">Batch {row.batch}</p>
        </div>
      ),
    },
    {
      field: 'department',
      title: 'Department',
      render: (row) => (
        <span className="text-sm text-nowrap text-slate-700">{deptName(row.department)}</span>
      ),
    },
    {
      field: 'section',
      title: 'Current Class',
      render: (row) => (
        <div className="w-full flex flex-col items-center justify-center">
          <p className="text-sm font-medium text-slate-700">Semester {row.currentSemester}</p>
          <div className="mt-1 flex flex-wrap flex-col items-center gap-1.5">
            <span className="text-xs text-slate-600">{row.academicYear || 'Year pending'}</span>
            {row.section ? (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                Section {row.section}
              </span>
            ) : (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                Not allotted
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      field: 'currentCgpa',
      title: 'CGPA',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-bold ${(row.currentCgpa ?? 0) >= 7 ? 'text-green-600' : (row.currentCgpa ?? 0) >= 5 ? 'text-amber-600' : 'text-red-600'}`}
          >
            {row.currentCgpa?.toFixed(2) ?? '—'}
          </span>
          {row.totalBacklogs > 0 && (
            <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] text-red-500">
              {row.totalBacklogs} KT
            </span>
          )}
        </div>
      ),
    },
  ];

  const actions: Action<IStudentProfile>[] = [
    {
      tooltip: 'View Details',
      icon: <ChevronRight className="h-4 w-4 text-primary" />,
      onClick: setDetail,
    },
    ...(canLifecycleManage
      ? [
          {
            tooltip: 'Edit',
            icon: <Edit2 className="h-4 w-4 text-slate-500" />,
            onClick: async (student: IStudentProfile) => {
              const response = await mutation(`student-profile/${student._id}`, {
                method: 'GET',
              });
              const fullProfile = response?.results?.data as IStudentProfile | undefined;
              if (!fullProfile) return;
              setEditing(fullProfile);
              setShowForm(true);
            },
          },
          {
            tooltip: 'Delete',
            icon: <Trash2 className="h-4 w-4 text-red-400" />,
            onClick: handleDelete,
          },
        ]
      : []),
  ];

  // Student view: own profile
  if (isStudent) {
    if (isLoadingMe)
      return (
        <div className="flex h-64 items-center justify-center">
          <div className="h-32 w-full max-w-3xl animate-pulse rounded-2xl bg-slate-100" />
        </div>
      );
    if (meError || !me)
      return (
        <Empty
          title="Student profile unavailable"
          subTitle="Your student record could not be loaded. Contact the administration office if this continues."
        />
      );
    return (
      <div className="space-y-6 p-6">
        <StudentWorkflowBar />
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
            <p className="text-sm text-slate-500">Your academic and personal information</p>
          </div>
          {hasEditPerm && (
            <CustomButton
              variant="primary"
              startIcon={<Edit2 className="h-4 w-4" />}
              onClick={() => setEditMeOpen(true)}
            >
              Edit My Profile
            </CustomButton>
          )}
        </div>
        <OwnProfileCard profile={me} />
        <StudentAbcPanel />
        <SelfEditModal
          open={editMeOpen}
          profile={me}
          onClose={() => setEditMeOpen(false)}
          onSaved={() => {
            setEditMeOpen(false);
            mutateMe();
          }}
        />
      </div>
    );
  }

  if (!isStaff) {
    return (
      <Empty
        title="Student records access unavailable"
        subTitle="Your active role does not have permission to view the student directory."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 p-2">
      <StudentWorkflowBar />

      {/* Stats */}
      {canViewStats && stats && <StudentStatsOverview stats={stats} />}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4">
        <Filter className="h-3.5 w-3.5 text-slate-600" />
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name or roll number…"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-sm focus:outline-none"
          />
        </div>
        <div className="min-w-45">
          <AsyncSelect
            type="programs"
            placeholder="All Programs"
            value={filterProg || null}
            onChange={(v) => handleProgram(v ?? '')}
          />
        </div>
        <div className="min-w-45">
          <AsyncSelect
            type="semesters"
            placeholder="All Semesters"
            value={filterSem || null}
            onChange={(v) => handleSemester(v ?? '')}
          />
        </div>
        {(search || filterProg || filterSem) && (
          <CustomButton
            variant="tertiary"
            className="py-1.5! text-xs! w-fit!"
            onClick={() => {
              handleSearch('');
              handleProgram('');
              handleSemester('');
            }}
          >
            Clear
          </CustomButton>
        )}
        <span className="ml-auto text-xs text-slate-600">
          {totalCount} student{totalCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <DataViewSwitcher<IStudentProfile>
        data={profiles}
        isLoading={isLoading}
        storageKey="student-profile.view"
        searchPlaceholder="Search students…"
        searchFields={[
          'firstName',
          'lastName',
          'rollNumber',
          'registrationNumber',
          'program',
          'collegeEmail',
        ]}
        pageSize={20}
        showSearch={false}
        renderCard={(s) => {
          const dept = typeof s.department === 'object' ? s.department : null;
          const statusStyle =
            s.status === 'active'
              ? 'bg-green-50 text-green-600'
              : s.status === 'detained'
                ? 'bg-amber-50 text-amber-600'
                : s.status === 'passed_out'
                  ? 'bg-blue-50 text-blue-600'
                  : 'bg-slate-100 text-slate-500';
          return (
            <motion.div
              whileHover={{ y: -2 }}
              className="flex flex-col gap-3 rounded-2xl bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                {s.passportPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.passportPhotoUrl}
                    alt={s.firstName}
                    className="h-11 w-11 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary">
                    {(s.firstName ?? '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${statusStyle}`}
                >
                  {(s.status ?? '').toString().replace(/_/g, ' ')}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {s.firstName}
                  {s.middleName ? ` ${s.middleName}` : ''} {s.lastName}
                </p>
                <p className="text-[11px] font-mono text-slate-600">{s.rollNumber}</p>
                <p className="text-xs text-slate-500">
                  {s.program} · Batch {s.batch}
                </p>
                {dept && <p className="text-[11px] text-slate-600">{dept.name}</p>}
                <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                    Semester {s.currentSemester}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-semibold ${s.section ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}
                  >
                    {s.section ? `Section ${s.section}` : 'Not allotted'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-center text-xs">
                <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                  <p className="text-[9px] uppercase text-slate-600">CGPA</p>
                  <p className="font-bold text-slate-800">
                    {s.currentCgpa != null ? s.currentCgpa.toFixed(2) : '—'}
                  </p>
                </div>
                <div
                  className={`rounded-lg px-2 py-1.5 ${(s.totalBacklogs ?? 0) > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-800'}`}
                >
                  <p className="text-[9px] uppercase text-slate-600">Backlogs</p>
                  <p className="font-bold">{s.totalBacklogs ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 text-xs">
                <button
                  type="button"
                  onClick={() => setDetail(s)}
                  className="font-medium text-slate-500 hover:text-primary"
                >
                  View
                </button>
                {canLifecycleManage && (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        const response = await mutation(`student-profile/${s._id}`, {
                          method: 'GET',
                        });
                        const fullProfile = response?.results?.data as IStudentProfile | undefined;
                        if (!fullProfile) return;
                        setEditing(fullProfile);
                        setShowForm(true);
                      }}
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      <Edit2 className="h-3 w-3" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s)}
                      className="inline-flex items-center gap-1 font-medium text-red-500 hover:underline"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          );
        }}
        table={
          <CustomTable<IStudentProfile>
            data={profiles}
            columns={columns}
            actions={actions}
            detailPanel={(student) => (
              <StudentTableDetailPanel
                student={student}
                onSetRegistrationNumber={handleSetRegNo}
                canSetRegistrationNumber={canSetRegistrationNumber}
              />
            )}
            title="Student Directory"
            description="Manage student profiles, programme details, branch assignments and academic status."
            onRefresh={() => {
              void mutate();
              void mutateStats();
            }}
            isValidating={isValidating}
            customActions={
              canCreateStudent || canImport ? (
                <div className="flex items-center gap-2">
                  {canImport && (
                    <CustomButton
                      variant="secondary"
                      startIcon={<UploadCloud className="h-4 w-4" />}
                      onClick={() => setShowImport(true)}
                    >
                      Import students
                    </CustomButton>
                  )}
                  {canCreateStudent && (
                    <CustomButton
                      variant="primary"
                      startIcon={<Plus className="h-4 w-4" />}
                      onClick={() => {
                        setEditing(null);
                        setShowForm(true);
                      }}
                    >
                      Add Student
                    </CustomButton>
                  )}
                </div>
              ) : undefined
            }
            isLoading={isLoading}
            page={Math.max(0, page - 1)}
            totalCount={totalCount}
            pageSize={PAGE_SIZE}
            onPageChange={(p) => setPage(p + 1)}
            options={{
              search: false,
              export: false,
              refresh: true,
              pagination: true,
              pageSize: PAGE_SIZE,
              actionsType: 'dropdown',
              detailPanel: true,
              detailPanelPosition: 'left',
              detailPanelHeader: 'Details',
            }}
          />
        }
      />

      <AnimatePresence>
        {showForm && (
          <StudentForm
            initial={editing ?? undefined}
            onClose={() => {
              setShowForm(false);
              setEditing(null);
            }}
            onSaved={mutate}
          />
        )}
        <ImportMigrationDialog
          open={showImport}
          target="students"
          title="Students"
          onClose={() => setShowImport(false)}
          onImported={() => {
            void mutate();
            void mutateStats();
          }}
        />
        {detail && (
          <ProfileDetailDrawer
            profile={detail}
            onClose={() => setDetail(null)}
            canPromote={canLifecycleManage}
            canBonafide={canIssueBonafide}
            canSetRegNo={canSetRegistrationNumber}
            canViewSensitive={canViewSensitive}
            onPromote={() => handlePromote(detail)}
            onBonafide={() => handleBonafide(detail)}
            onSetRegNo={() => handleSetRegNo(detail)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default UseProtectedRoutes(StudentProfilePage, [
  'super_admin',
  'admin',
  'principal',
  'dean_academic',
  'hod',
  'faculty',
  'examination_cell',
  'accounts_department',
  'administration_office',
  'assistant_administration_officer',
  'admission_incharge',
  'placement_cell',
  'scholarship_cell',
  'student',
]);

// ─── Student Self-Edit Modal ─────────────────────────────────────────────────
function SelfEditModal({
  open,
  profile,
  onClose,
  onSaved,
}: {
  open: boolean;
  profile: IStudentProfile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      personalEmail: profile.personalEmail ?? '',
      whatsappPhone: profile.whatsappPhone ?? '',
      bloodGroup: profile.bloodGroup ?? '',
      religion: profile.religion ?? '',
      motherTongue: profile.motherTongue ?? '',
      maritalStatus: profile.maritalStatus ?? '',
      passportNumber: profile.passportNumber ?? '',
      emergencyContactName: profile.emergencyContactName ?? '',
      emergencyContactRelationship: profile.emergencyContactRelationship ?? '',
      emergencyContactPhone: profile.emergencyContactPhone ?? '',
      permanentAddress: {
        line1: profile.permanentAddress?.line1 ?? '',
        line2: profile.permanentAddress?.line2 ?? '',
        city: profile.permanentAddress?.city ?? '',
        district: profile.permanentAddress?.district ?? '',
        state: profile.permanentAddress?.state ?? '',
        pincode: profile.permanentAddress?.pincode ?? '',
        country: profile.permanentAddress?.country ?? 'India',
      },
      parentInfo: {
        fatherName: profile.parentInfo?.fatherName ?? '',
        fatherPhone: profile.parentInfo?.fatherPhone ?? '',
        fatherEmail: profile.parentInfo?.fatherEmail ?? '',
        fatherOccupation: profile.parentInfo?.fatherOccupation ?? '',
        motherName: profile.parentInfo?.motherName ?? '',
        motherPhone: profile.parentInfo?.motherPhone ?? '',
        motherEmail: profile.parentInfo?.motherEmail ?? '',
        motherOccupation: profile.parentInfo?.motherOccupation ?? '',
        guardianName: profile.parentInfo?.guardianName ?? '',
        guardianPhone: profile.parentInfo?.guardianPhone ?? '',
      },
    },
    validationSchema: Yup.object({
      personalEmail: Yup.string().email('Invalid email').nullable(),
      emergencyContactPhone: Yup.string().nullable(),
    }),
    onSubmit: async (values) => {
      const res = await mutation('student-profile/me', { method: 'PATCH', body: values });
      if (res && res.status >= 200 && res.status < 300) {
        toast.success('Profile updated');
        onSaved();
      } else if (res) {
        toast.error(res.results?.message || 'Failed to update profile');
      }
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white"
      >
        <div className="flex items-center justify-between p-5">
          <h2 className="text-lg font-bold text-slate-800">Edit My Profile</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={formik.handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-2">
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
              You can edit personal & contact details only. Roll no., program, semester, results and
              fees are admin-managed. <strong>Photo, signature, Aadhaar & ABC ID</strong>
              must be re-submitted through the <strong>Documents</strong> module so the admin can
              verify before they take effect.
            </p>

            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Personal</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  className={inputCls}
                  placeholder="Personal Email"
                  type="email"
                  {...formik.getFieldProps('personalEmail')}
                />
                <input
                  className={inputCls}
                  placeholder="WhatsApp Phone"
                  {...formik.getFieldProps('whatsappPhone')}
                />
                <input
                  className={inputCls}
                  placeholder="Blood Group"
                  {...formik.getFieldProps('bloodGroup')}
                />
                <input
                  className={inputCls}
                  placeholder="Religion"
                  {...formik.getFieldProps('religion')}
                />
                <input
                  className={inputCls}
                  placeholder="Mother Tongue"
                  {...formik.getFieldProps('motherTongue')}
                />
                <input
                  className={inputCls}
                  placeholder="Marital Status"
                  {...formik.getFieldProps('maritalStatus')}
                />
                <input
                  className={inputCls}
                  placeholder="Passport Number"
                  {...formik.getFieldProps('passportNumber')}
                />
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Emergency Contact</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  className={inputCls}
                  placeholder="Name"
                  {...formik.getFieldProps('emergencyContactName')}
                />
                <input
                  className={inputCls}
                  placeholder="Relationship"
                  {...formik.getFieldProps('emergencyContactRelationship')}
                />
                <input
                  className={inputCls}
                  placeholder="Phone"
                  {...formik.getFieldProps('emergencyContactPhone')}
                />
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Permanent Address</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  className={inputCls}
                  placeholder="Line 1"
                  {...formik.getFieldProps('permanentAddress.line1')}
                />
                <input
                  className={inputCls}
                  placeholder="Line 2"
                  {...formik.getFieldProps('permanentAddress.line2')}
                />
                <input
                  className={inputCls}
                  placeholder="City"
                  {...formik.getFieldProps('permanentAddress.city')}
                />
                <input
                  className={inputCls}
                  placeholder="District"
                  {...formik.getFieldProps('permanentAddress.district')}
                />
                <input
                  className={inputCls}
                  placeholder="State"
                  {...formik.getFieldProps('permanentAddress.state')}
                />
                <input
                  className={inputCls}
                  placeholder="Pincode"
                  {...formik.getFieldProps('permanentAddress.pincode')}
                />
                <input
                  className={inputCls}
                  placeholder="Country"
                  {...formik.getFieldProps('permanentAddress.country')}
                />
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Parent / Guardian</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  className={inputCls}
                  placeholder="Father's Name"
                  {...formik.getFieldProps('parentInfo.fatherName')}
                />
                <input
                  className={inputCls}
                  placeholder="Father's Phone"
                  {...formik.getFieldProps('parentInfo.fatherPhone')}
                />
                <input
                  className={inputCls}
                  placeholder="Father's Email"
                  {...formik.getFieldProps('parentInfo.fatherEmail')}
                />
                <input
                  className={inputCls}
                  placeholder="Father's Occupation"
                  {...formik.getFieldProps('parentInfo.fatherOccupation')}
                />
                <input
                  className={inputCls}
                  placeholder="Mother's Name"
                  {...formik.getFieldProps('parentInfo.motherName')}
                />
                <input
                  className={inputCls}
                  placeholder="Mother's Phone"
                  {...formik.getFieldProps('parentInfo.motherPhone')}
                />
                <input
                  className={inputCls}
                  placeholder="Mother's Email"
                  {...formik.getFieldProps('parentInfo.motherEmail')}
                />
                <input
                  className={inputCls}
                  placeholder="Mother's Occupation"
                  {...formik.getFieldProps('parentInfo.motherOccupation')}
                />
                <input
                  className={inputCls}
                  placeholder="Guardian Name"
                  {...formik.getFieldProps('parentInfo.guardianName')}
                />
                <input
                  className={inputCls}
                  placeholder="Guardian Phone"
                  {...formik.getFieldProps('parentInfo.guardianPhone')}
                />
              </div>
            </section>
          </div>

          <div className="flex justify-end gap-2 p-5">
            <CustomButton variant="secondary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton variant="primary" type="submit" loading={isLoading}>
              Save Changes
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

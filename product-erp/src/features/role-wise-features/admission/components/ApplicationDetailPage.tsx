/**
 * @file ApplicationDetailPage.tsx
 * @description Full detail view for a single admission application.
 * Actions: Verify Documents, Schedule Counseling, Allocate Seat, Approve/Reject, Enroll.
 * @module features/role-wise-features/admission
 */
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { Formik } from 'formik';
import * as Yup from 'yup';
import {
  ChevronLeft,
  CheckCircle,
  XCircle,
  Award,
  UserCheck,
  FileText,
  Phone,
  MapPin,
  BookOpen,
  Users,
  CreditCard,
  Clock,
  GraduationCap,
  Info,
  ListChecks,
  Hourglass,
  Printer,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { motion } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import AdmissionWorkflowBar from '@/shared/components/AdmissionWorkflowBar';
import FileViewer, { IViewerFile } from '@/shared/core/FileViewer';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useAuthStore } from '@/shared/store/authStore';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import {
  IAdmissionApplication,
  IDocumentChecklistItem,
  TApplicationStatus,
} from '../types/admission.types';

type MutationResult = { results?: { success?: boolean }; status?: number } | undefined;

const STATUS_CFG: Record<TApplicationStatus, { label: string; bg: string; text: string }> = {
  draft: { label: 'Draft', bg: 'bg-slate-100', text: 'text-slate-500' },
  submitted: { label: 'Submitted', bg: 'bg-blue-50', text: 'text-blue-600' },
  under_review: { label: 'Under Review', bg: 'bg-yellow-50', text: 'text-yellow-700' },
  approved: { label: 'Approved', bg: 'bg-green-50', text: 'text-green-600' },
  rejected: { label: 'Rejected', bg: 'bg-red-50', text: 'text-red-500' },
  enrolled: { label: 'Enrolled', bg: 'bg-emerald-50', text: 'text-emerald-600' },
  withdrawn: { label: 'Withdrawn', bg: 'bg-slate-100', text: 'text-slate-600' },
  // Deprecated statuses (kept so legacy records still render):
  document_verification: { label: 'Doc Verification', bg: 'bg-yellow-50', text: 'text-yellow-700' },
  merit_list: { label: 'Merit List', bg: 'bg-purple-50', text: 'text-purple-600' },
  counseling_scheduled: { label: 'Counseling', bg: 'bg-indigo-50', text: 'text-indigo-600' },
  seat_allocated: { label: 'Seat Allocated', bg: 'bg-cyan-50', text: 'text-cyan-600' },
  pending_approval: { label: 'Pending Approval', bg: 'bg-orange-50', text: 'text-orange-600' },
  fee_pending: { label: 'Fee Pending', bg: 'bg-amber-50', text: 'text-amber-600' },
};

const programmeLabel = (value: string) =>
  value.includes('_')
    ? value
        .split('_')
        .map((part) => part.toUpperCase())
        .join(' ')
    : value;

const humanizeValue = (value?: string) =>
  value
    ? value
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (character) => character.toUpperCase())
    : '—';

const DOC_LABELS: Record<string, string> = {
  hsc_10th_marksheet: 'HSC (10th) Marksheet',
  hsc_10th_certificate: 'HSC (10th) Pass Certificate',
  plus_two_marksheet: '+2 / Diploma Marksheet',
  plus_two_certificate: '+2 / Diploma Certificate',
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
  entrance_exam_result: 'Entrance Exam Rank / Score Card',
  payment_proof: 'Payment Proof',
};

const TIMELINE_STEPS: { status: TApplicationStatus; label: string }[] = [
  { status: 'submitted', label: 'Applied' },
  { status: 'under_review', label: 'Under Review' },
  { status: 'approved', label: 'Approved' },
  { status: 'enrolled', label: 'Enrolled' },
];

const STATUS_ORDER = TIMELINE_STEPS.map((s) => s.status);

const ROLE_LABEL: Record<string, string> = {
  admission_counselor: 'Admission Counselor',
  admission_incharge: 'Admission Incharge',
  administration_office: 'Administration Office',
  assistant_administration_officer: 'Assistant Administration Officer',
  dean_academic: 'Dean (Academic)',
  principal: 'Principal',
  accounts_department: 'Accounts Department',
  super_admin: 'Super Admin',
  admin: 'Admin',
};

/**
 * Per-stage guidance shown in the “What’s happening now” card. Each entry is
 * a short, applicant-friendly explanation of the current stage plus who owns
 * the next action and a typical service-level expectation.
 */
const STAGE_GUIDE: Record<
  TApplicationStatus,
  {
    tone: 'info' | 'progress' | 'success' | 'danger' | 'neutral';
    headline: string;
    description: string;
    nextActor: string;
    nextAction: string;
    sla: string;
  }
> = {
  draft: {
    tone: 'neutral',
    headline: 'Application is in draft',
    description: 'The applicant has not yet submitted the form. No action is required from staff.',
    nextActor: 'Applicant',
    nextAction: 'Complete and submit the application form',
    sla: 'Until the applicant submits',
  },
  submitted: {
    tone: 'info',
    headline: 'Application submitted — ready for review',
    description:
      'The applicant has submitted the form with all documents. The Administration Office needs to start the review.',
    nextActor: 'Administration Office / Assistant Administration Officer',
    nextAction: 'Click “Start Review” to begin verifying documents',
    sla: 'Within 1–2 working days of submission',
  },
  under_review: {
    tone: 'progress',
    headline: 'Application under review',
    description:
      'The Administration Office is reviewing the uploaded documents. After review, the application is either approved or rejected.',
    nextActor: 'Administration Office / Assistant Administration Officer',
    nextAction: 'Verify each document, then approve or reject the application',
    sla: '1–2 working days',
  },
  document_verification: {
    tone: 'progress',
    headline: 'Documents under verification (legacy stage)',
    description: 'Legacy stage — will be treated the same as Under Review.',
    nextActor: 'Administration Office',
    nextAction: 'Verify each document, then approve or reject',
    sla: '1–2 working days',
  },
  merit_list: {
    tone: 'neutral',
    headline: 'Merit list (legacy)',
    description: 'Merit list flow has been removed. Existing records are read-only.',
    nextActor: '—',
    nextAction: 'No further action',
    sla: '—',
  },
  counseling_scheduled: {
    tone: 'neutral',
    headline: 'Counseling scheduled (legacy)',
    description: 'Counseling scheduling flow has been removed. Existing records are read-only.',
    nextActor: '—',
    nextAction: 'No further action',
    sla: '—',
  },
  seat_allocated: {
    tone: 'neutral',
    headline: 'Seat allocated (legacy)',
    description: 'Seat allocation flow has been removed. Existing records are read-only.',
    nextActor: '—',
    nextAction: 'No further action',
    sla: '—',
  },
  pending_approval: {
    tone: 'neutral',
    headline: 'Pending approval (legacy)',
    description: 'Approval-chain flow has been removed. Existing records are read-only.',
    nextActor: '—',
    nextAction: 'No further action',
    sla: '—',
  },
  approved: {
    tone: 'success',
    headline: 'Approved — ready for enrollment',
    description:
      'The application has been approved by the Administration Office. Super Admin / Admin / AO can now confirm enrollment to issue a registration number.',
    nextActor: 'Super Admin / Admin / Administration Office',
    nextAction: 'Click “Confirm Enrollment” to finalize',
    sla: 'Within 1 working day',
  },
  fee_pending: {
    tone: 'info',
    headline: 'Awaiting fee payment (legacy)',
    description:
      'Fee-pending status is legacy. Payment is now tracked separately on the application.',
    nextActor: 'Accounts Department',
    nextAction: 'Record fee payment',
    sla: '—',
  },
  enrolled: {
    tone: 'success',
    headline: 'Enrolled — admission complete',
    description: 'The applicant is now an enrolled student. A registration number has been issued.',
    nextActor: 'Student',
    nextAction: 'No further action required',
    sla: 'Completed',
  },
  rejected: {
    tone: 'danger',
    headline: 'Application rejected',
    description:
      'This application has been rejected. The reason is recorded in the approval timeline below.',
    nextActor: '—',
    nextAction: 'No further action',
    sla: '—',
  },
  withdrawn: {
    tone: 'neutral',
    headline: 'Application withdrawn',
    description: 'The applicant has withdrawn this application.',
    nextActor: '—',
    nextAction: 'No further action',
    sla: '—',
  },
};

const STAGE_TONE: Record<
  'info' | 'progress' | 'success' | 'danger' | 'neutral',
  { bg: string; ring: string; text: string; iconBg: string }
> = {
  info: {
    bg: 'bg-blue-50',
    ring: 'ring-blue-100',
    text: 'text-blue-700',
    iconBg: 'bg-blue-100 text-blue-600',
  },
  progress: {
    bg: 'bg-amber-50',
    ring: 'ring-amber-100',
    text: 'text-amber-700',
    iconBg: 'bg-amber-100 text-amber-600',
  },
  success: {
    bg: 'bg-emerald-50',
    ring: 'ring-emerald-100',
    text: 'text-emerald-700',
    iconBg: 'bg-emerald-100 text-emerald-600',
  },
  danger: {
    bg: 'bg-red-50',
    ring: 'ring-red-100',
    text: 'text-red-700',
    iconBg: 'bg-red-100 text-red-600',
  },
  neutral: {
    bg: 'bg-slate-50',
    ring: 'ring-slate-100',
    text: 'text-slate-700',
    iconBg: 'bg-slate-200 text-slate-600',
  },
};

function Section({
  title,
  icon,
  action,
  description,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="inline-block w-full break-inside-avoid border-b border-slate-100 bg-white align-top last:border-b-0">
      <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-slate-50 py-2 last:border-b-0 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-3">
      <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </span>
      <span className="wrap-break-word text-sm font-medium text-slate-800">{value ?? '—'}</span>
    </div>
  );
}

function OnboardingAdminCard({
  app,
  onRefresh,
}: {
  app: IAdmissionApplication;
  onRefresh: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const [isEditing, setIsEditing] = useState(false);
  const [onboardStatus, setOnboardStatus] = useState<string>(
    (app.onboardStatus as string) || 'pending',
  );
  const [transportOption, setTransportOption] = useState<string>(
    (app.transportOption as string) || '',
  );

  const handleSave = async () => {
    const res = await mutation(`admission/applications/${app._id}/onboard`, {
      method: 'PATCH',
      body: {
        onboardStatus,
        transportOption: onboardStatus === 'day_scholar' ? transportOption : null,
      },
      isAlert: true,
    });
    if (res) {
      toast.success('Onboarding choice updated successfully');
      setIsEditing(false);
      onRefresh();
    }
  };

  const labelCls = 'mb-1 block text-xs font-medium text-slate-600';
  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary focus:bg-white';

  if (!isEditing) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className={labelCls}>Onboard Status</p>
            <p className="text-sm font-semibold text-slate-800">
              {(app.onboardStatus as string) === 'pending'
                ? 'Not Selected (Pending)'
                : humanizeValue(app.onboardStatus as string)}
            </p>
          </div>
          {(app.onboardStatus as string) === 'day_scholar' && (
            <div>
              <p className={labelCls}>Transport Mode</p>
              <p className="text-sm font-semibold capitalize text-slate-800">
                {(app.transportOption as string) === 'bus'
                  ? 'Institute Bus Service'
                  : 'Own Arrangement'}
              </p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary  transition hover:border-primary hover:bg-primary-100 active:scale-[0.98]"
        >
          Change Preferences
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Onboard Status</label>
          <select
            className={inputCls}
            value={onboardStatus}
            onChange={(e) => {
              setOnboardStatus(e.target.value);
              if (e.target.value !== 'day_scholar') setTransportOption('');
            }}
          >
            <option value="pending">Pending</option>
            <option value="hosteller">Hosteller</option>
            <option value="day_scholar">Day Scholar</option>
          </select>
        </div>
        {onboardStatus === 'day_scholar' && (
          <div>
            <label className={labelCls}>Transport Option</label>
            <select
              className={inputCls}
              value={transportOption}
              onChange={(e) => setTransportOption(e.target.value)}
            >
              <option value="">-- Select --</option>
              <option value="bus">Institute Bus Service</option>
              <option value="own">Own Arrangement</option>
            </select>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <CustomButton variant="cancel" size="sm" onClick={() => setIsEditing(false)}>
          Cancel
        </CustomButton>
        <CustomButton
          size="sm"
          onClick={handleSave}
          loading={isLoading}
          disabled={onboardStatus === 'day_scholar' && !transportOption}
        >
          Save
        </CustomButton>
      </div>
    </div>
  );
}

function OfficialApplicationFormSheet({
  app,
  settings,
  photoUrl,
  onViewDoc,
}: {
  app: IAdmissionApplication;
  settings?: {
    name?: string;
    logoUrl?: string;
    address?: string;
    accreditations?: string[];
    shortCode?: string;
    email?: string;
  };
  photoUrl?: string;
  onViewDoc?: (files: IViewerFile[], title: string) => void;
}) {
  const formatAddr = (addr?: {
    line1?: string;
    line2?: string;
    city?: string;
    district?: string;
    state?: string;
    pincode?: string;
  }) => {
    if (!addr) return '—';
    return [
      addr.line1,
      addr.line2,
      addr.city,
      addr.district ?? addr.state,
      addr.state,
      addr.pincode,
    ]
      .filter(Boolean)
      .join(', ');
  };

  const uploadedDocsList = (
    (app.documentChecklist as Array<{
      docType: string;
      status?: string;
      uploadedFileUrl?: string;
      files?: Array<{ url: string; name?: string }>;
    }>) ?? []
  ).filter((d) => Boolean(d.uploadedFileUrl) || (d.files?.length ?? 0) > 0);

  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl border border-slate-300  space-y-6 text-xs text-slate-900 max-w-4xl mx-auto font-sans print:p-0 print:border-none print: print:max-w-none">
      {/* Official Institution Header */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div className="flex items-center gap-4">
          {settings?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.logoUrl}
              alt={`${settings.name} Logo`}
              className="size-18 object-contain  shrink-0 "
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 text-xl font-extrabold text-slate-800">
              {settings?.shortCode || 'DV'}
            </div>
          )}
          <div>
            <h1 className="text-lg font-black text-slate-955 uppercase tracking-tight">
              {settings?.name || 'DevVelocity Institute of Technology'}
            </h1>
            <p className="text-[11px] text-slate-600 font-semibold uppercase tracking-wide">
              {settings?.accreditations && settings.accreditations.length > 0
                ? settings.accreditations.join(' · ')
                : 'Approved by AICTE & UGC · Accredited Grade A++'}
            </p>
            <p className="text-[10px] text-slate-500 font-medium">
              {settings?.address || 'Bhubaneswar, Odisha'} ·{' '}
              {settings?.email || 'admission@devvelocity.edu'}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end shrink-0 text-right">
          <span className="text-sm font-mono font-bold text-slate-955">
            No: #{app.applicationNumber}
          </span>
          <span className="text-[11px] font-semibold text-slate-500">
            Academic Year: {app.academicYear}
          </span>
        </div>
      </div>

      {/* Section 1: Personal & Identification Particulars */}
      <div className="space-y-2 print-section">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5 border-b pb-1 border-slate-300">
          <UserCheck className="h-4 w-4 text-slate-500 no-print" /> 1. Personal &amp; Identification
          Particulars
        </h3>
        <table className="w-full border-collapse border border-slate-300 text-left text-xs">
          <tbody>
            <tr>
              <td className="bg-slate-50 text-slate-700 font-bold text-[11px] px-3 py-2 border border-slate-300 w-[20%] print:py-1 print:px-2 print:text-[10px]">
                Academic Session
              </td>
              <td className="px-3 py-2 text-xs font-bold text-slate-900 border border-slate-300 w-[30%] print:py-1 print:px-2 print:text-[10px]">
                {app.academicYear}
              </td>
              <td className="bg-slate-50 text-slate-700 font-bold text-[11px] px-3 py-2 border border-slate-300 w-[20%] print:py-1 print:px-2 print:text-[10px]">
                Admission Type
              </td>
              <td className="px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-300 w-[30%] uppercase print:py-1 print:px-2 print:text-[10px]">
                {humanizeValue(app.admissionType || 'regular')}
              </td>
            </tr>
            <tr>
              <td className="bg-slate-50 text-slate-700 font-bold text-[11px] px-3 py-2 border border-slate-300 print:py-1 print:px-2 print:text-[10px]">
                Full Name of Candidate
              </td>
              <td
                colSpan={2}
                className="px-3 py-2 text-xs font-extrabold text-slate-955 border border-slate-300 uppercase print:py-1 print:px-2 print:text-[10px]"
              >
                {app.candidateName || '—'}
              </td>
              <td rowSpan={3} className="p-1 border border-slate-300 w-32 text-center bg-slate-50">
                <div className="mx-auto h-32 w-28 border border-slate-300 bg-white flex items-center justify-center overflow-hidden rounded ">
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoUrl}
                      alt="Passport Photo"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-[9px] text-slate-600 font-bold uppercase leading-tight p-2 text-center">
                      Passport Photo
                    </span>
                  )}
                </div>
              </td>
            </tr>
            <tr>
              <td className="bg-slate-50 text-slate-700 font-bold text-[11px] px-3 py-2 border border-slate-300 print:py-1 print:px-2 print:text-[10px]">
                {" Father's"} Name
              </td>
              <td
                colSpan={2}
                className="px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-300 print:py-1 print:px-2 print:text-[10px]"
              >
                {app.fatherName || '—'}
              </td>
            </tr>
            <tr>
              <td className="bg-slate-50 text-slate-700 font-bold text-[11px] px-3 py-2 border border-slate-300 print:py-1 print:px-2 print:text-[10px]">
                {"Mother's"} Name
              </td>
              <td
                colSpan={2}
                className="px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-300 print:py-1 print:px-2 print:text-[10px]"
              >
                {app.motherName || '—'}
              </td>
            </tr>
            <tr>
              <td className="bg-slate-50 text-slate-700 font-bold text-[11px] px-3 py-2 border border-slate-300 print:py-1 print:px-2 print:text-[10px]">
                Date of Birth
              </td>
              <td className="px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-300 print:py-1 print:px-2 print:text-[10px]">
                {app.dateOfBirth ? new Date(app.dateOfBirth).toLocaleDateString('en-IN') : '—'}
              </td>
              <td className="bg-slate-50 text-slate-700 font-bold text-[11px] px-3 py-2 border border-slate-300 print:py-1 print:px-2 print:text-[10px]">
                Gender
              </td>
              <td className="px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-300 capitalize print:py-1 print:px-2 print:text-[10px]">
                {app.gender || '—'}
              </td>
            </tr>
            <tr>
              <td className="bg-slate-50 text-slate-700 font-bold text-[11px] px-3 py-2 border border-slate-300 print:py-1 print:px-2 print:text-[10px]">
                Social Category
              </td>
              <td className="px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-300 uppercase print:py-1 print:px-2 print:text-[10px]">
                {app.category || '—'}
              </td>
              <td className="bg-slate-50 text-slate-700 font-bold text-[11px] px-3 py-2 border border-slate-300 print:py-1 print:px-2 print:text-[10px]">
                Aadhaar Number
              </td>
              <td className="px-3 py-2 text-xs font-mono text-slate-800 border border-slate-300 font-medium print:py-1 print:px-2 print:text-[10px]">
                {app.aadhaarNumber || '—'}
              </td>
            </tr>
            <tr>
              <td className="bg-slate-50 text-slate-700 font-bold text-[11px] px-3 py-2 border border-slate-300 print:py-1 print:px-2 print:text-[10px]">
                Religion
              </td>
              <td className="px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-300 print:py-1 print:px-2 print:text-[10px]">
                {app.religion || '—'}
              </td>
              <td className="bg-slate-50 text-slate-700 font-bold text-[11px] px-3 py-2 border border-slate-300 print:py-1 print:px-2 print:text-[10px]">
                Nationality / Blood Group
              </td>
              <td className="px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-300 print:py-1 print:px-2 print:text-[10px]">
                {app.nationality || 'Indian'} / {app.bloodGroup || '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section 2: Contact & Address Particulars */}
      <div className="space-y-2 print-section">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5 border-b pb-1 border-slate-300">
          <Phone className="h-4 w-4 text-slate-500 no-print" /> 2. Contact &amp; Communication
          Details
        </h3>
        <table className="w-full border-collapse border border-slate-300 text-left text-xs">
          <tbody>
            <tr>
              <td className="bg-slate-50 text-slate-700 font-bold text-[11px] px-3 py-2 border border-slate-300 w-[20%]">
                Email ID
              </td>
              <td className="px-3 py-2 text-xs font-semibold text-slate-900 border border-slate-300 w-[30%]">
                {app.email || '—'}
              </td>
              <td className="bg-slate-50 text-slate-700 font-bold text-[11px] px-3 py-2 border border-slate-300 w-[20%]">
                Mobile Number
              </td>
              <td className="px-3 py-2 text-xs font-semibold text-slate-900 border border-slate-300 w-[30%]">
                {app.phone || '—'}
              </td>
            </tr>
            <tr>
              <td className="bg-slate-50 text-slate-700 font-bold text-[11px] px-3 py-2 border border-slate-300">
                WhatsApp Number
              </td>
              <td className="px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-300">
                {app.whatsappPhone || '—'}
              </td>
              <td className="bg-slate-50 text-slate-700 font-bold text-[11px] px-3 py-2 border border-slate-300">
                Parent Phone
              </td>
              <td className="px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-300">
                {app.parentPhone || '—'}
              </td>
            </tr>
            <tr>
              <td className="bg-slate-50 text-slate-700 font-bold text-[11px] px-3 py-2 border border-slate-300">
                Present Address
              </td>
              <td
                colSpan={3}
                className="px-3 py-2 text-xs text-slate-800 border border-slate-300 font-medium"
              >
                {formatAddr(app.presentAddress)}
              </td>
            </tr>
            <tr>
              <td className="bg-slate-50 text-slate-700 font-bold text-[11px] px-3 py-2 border border-slate-300">
                Permanent Address
              </td>
              <td
                colSpan={3}
                className="px-3 py-2 text-xs text-slate-800 border border-slate-300 font-medium"
              >
                {formatAddr(app.permanentAddress)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section 3: Educational Qualifications Table */}
      <div className="space-y-2 print-section">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5 border-b pb-1 border-slate-300">
          <BookOpen className="h-4 w-4 text-slate-500 no-print" /> 3. Educational Qualifications
        </h3>
        <table className="w-full border-collapse border border-slate-300 text-left text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-800">
              <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px] w-[20%] print:py-1 print:px-2">
                Level
              </th>
              <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px] print:py-1 print:px-2">
                Board / University
              </th>
              <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px] print:py-1 print:px-2">
                Institute Name
              </th>
              <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px] w-[15%] print:py-1 print:px-2">
                Passing Year
              </th>
              <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px] w-[15%] text-right print:py-1 print:px-2">
                Marks (%)
              </th>
            </tr>
          </thead>
          <tbody>
            {(app.academicRecords ?? []).length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="border border-slate-300 px-3 py-2 text-slate-600 print:py-1 print:px-2"
                >
                  No academic records provided.
                </td>
              </tr>
            ) : (
              (app.academicRecords ?? []).map((r, i) => (
                <tr key={i}>
                  <td className="border border-slate-300 px-3 py-2 font-bold text-slate-800 capitalize print:py-1 print:px-2 print:text-[10px]">
                    {humanizeValue(r.level)}
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-slate-700 print:py-1 print:px-2 print:text-[10px]">
                    {r.boardOrUniversity || '—'}
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-slate-700 print:py-1 print:px-2 print:text-[10px]">
                    {r.instituteName || '—'}
                  </td>
                  <td className="border border-slate-300 px-3 py-2 font-mono text-slate-700 font-medium print:py-1 print:px-2 print:text-[10px]">
                    {r.yearOfPassing || '—'}
                  </td>
                  <td className="border border-slate-300 px-3 py-2 font-bold text-emerald-700 text-right print:py-1 print:px-2 print:text-[10px]">
                    {r.percentageOfMarks ? `${r.percentageOfMarks}%` : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Section 4: Entrance Examination Details */}
      <div className="space-y-2 print-section">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5 border-b pb-1 border-slate-300">
          <Award className="h-4 w-4 text-slate-500 no-print" /> 4. Entrance Examination Details
        </h3>
        <table className="w-full border-collapse border border-slate-300 text-left text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-800">
              <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px] print:py-1 print:px-2">
                Entrance Exam
              </th>
              <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px] w-[15%] print:py-1 print:px-2">
                Exam Year
              </th>
              <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px] print:py-1 print:px-2">
                Application / Roll No
              </th>
              <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px] w-[15%] print:py-1 print:px-2">
                AIR Rank
              </th>
              <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px] w-[15%] print:py-1 print:px-2">
                Percentile %
              </th>
              <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px] w-[15%] text-right print:py-1 print:px-2">
                Score
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-300 px-3 py-2 font-bold text-slate-800 print:py-1 print:px-2 print:text-[10px]">
                {app.entranceExam?.exam === 'OTHER'
                  ? app.entranceExam.otherName
                  : app.entranceExam?.exam || '—'}
              </td>
              <td className="border border-slate-300 px-3 py-2 font-mono text-slate-700 print:py-1 print:px-2 print:text-[10px]">
                {app.entranceExam?.year || '—'}
              </td>
              <td className="border border-slate-300 px-3 py-2 font-mono text-slate-700 font-medium print:py-1 print:px-2 print:text-[10px]">
                {app.entranceExam?.applicationNo || '—'}
              </td>
              <td className="border border-slate-300 px-3 py-2 text-slate-700 font-medium print:py-1 print:px-2 print:text-[10px]">
                {app.entranceExam?.rank ? `#${app.entranceExam.rank}` : '—'}
              </td>
              <td className="border border-slate-300 px-3 py-2 font-bold text-emerald-700 print:py-1 print:px-2 print:text-[10px]">
                {app.entranceExam?.percentile != null ? `${app.entranceExam.percentile}%` : '—'}
              </td>
              <td className="border border-slate-300 px-3 py-2 text-slate-700 font-medium text-right print:py-1 print:px-2 print:text-[10px]">
                {app.entranceExam?.score || '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section 5: Selected Programme Preferences */}
      <div className="space-y-2 print-section">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5 border-b pb-1 border-slate-300">
          <GraduationCap className="h-4 w-4 text-slate-500 no-print" /> 5. Selected Programme
          Preferences
        </h3>
        <table className="w-full border-collapse border border-slate-300 text-left text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-800">
              <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px] w-[20%] print:py-1 print:px-2">
                Preference Choice
              </th>
              <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px] print:py-1 print:px-2">
                Programme Description
              </th>
            </tr>
          </thead>
          <tbody>
            {(app.programPreferences ?? []).map((prog, idx) => (
              <tr key={idx}>
                <td className="border border-slate-300 px-3 py-2 font-bold text-slate-800 print:py-1 print:px-2 print:text-[10px]">
                  Choice Rank #{idx + 1}
                </td>
                <td className="border border-slate-300 px-3 py-2 text-slate-800 font-semibold print:py-1 print:px-2 print:text-[10px]">
                  {programmeLabel(prog)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Section 6: Uploaded Documents Status */}
      <div className="space-y-2 print-section">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5 border-b pb-1 border-slate-300">
          <FileText className="h-4 w-4 text-slate-500 no-print" /> 6. Uploaded Documents Status
        </h3>
        <table className="w-full border-collapse border border-slate-300 text-left text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-800">
              <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px] print:py-1 print:px-2">
                Document Category
              </th>
              <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px] w-[25%] print:py-1 print:px-2">
                Status
              </th>
              <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px] w-[45%] print:py-1 print:px-2">
                Files Attached
              </th>
            </tr>
          </thead>
          <tbody>
            {uploadedDocsList.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="border border-slate-300 px-3 py-2 text-slate-500 print:py-1 print:px-2"
                >
                  No documents attached.
                </td>
              </tr>
            ) : (
              uploadedDocsList.map((doc) => {
                const files = (doc.files ?? []) as Array<{ url: string; name?: string }>;
                const docName = DOC_LABELS[doc.docType] ?? doc.docType.replace(/_/g, ' ');
                return (
                  <tr key={doc.docType}>
                    <td className="border border-slate-300 px-3 py-2 font-bold text-slate-800 capitalize print:py-1 print:px-2 print:text-[10px]">
                      {docName}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 print:py-1 print:px-2">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase border ${
                          doc.status === 'verified'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : doc.status === 'rejected'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {doc.status || 'Uploaded'}
                      </span>
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-slate-600 print:py-1 print:px-2 print:text-[10px]">
                      <div className="flex flex-col gap-1">
                        {(files.length ? files : [{ url: doc.uploadedFileUrl ?? '' }]).map(
                          (f, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-mono print:text-[10px]">
                                {f.name || `Document #${idx + 1}`}
                              </span>
                              {onViewDoc && (
                                <button
                                  type="button"
                                  onClick={() => onViewDoc([{ url: f.url, name: f.name }], docName)}
                                  className="no-print text-[10px] font-bold text-primary hover:underline border border-primary/20 bg-primary/5 px-2 py-0.5 rounded cursor-pointer"
                                >
                                  View
                                </button>
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Section 7: Fee Payment Particulars */}
      <div className="space-y-2 print-section">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5 border-b pb-1 border-slate-300">
          <CreditCard className="h-4 w-4 text-slate-500 no-print" /> 7. Fee Payment Particulars
        </h3>
        <table className="w-full border-collapse border border-slate-300 text-left text-xs">
          <tbody>
            <tr>
              <td className="bg-slate-100 text-slate-700 font-bold text-[11px] px-3 py-2 border border-slate-300 w-[20%] print:py-1 print:px-2 print:text-[10px]">
                Amount Paid
              </td>
              <td className="px-3 py-2 text-xs font-bold text-emerald-700 border border-slate-300 w-[30%] print:py-1 print:px-2 print:text-[10px]">
                {app.paymentDetails?.amountInNumber
                  ? `₹ ${app.paymentDetails.amountInNumber.toLocaleString('en-IN')}`
                  : 'Not Recorded'}
              </td>
              <td className="bg-slate-100 text-slate-700 font-bold text-[11px] px-3 py-2 border border-slate-300 w-[20%] print:py-1 print:px-2 print:text-[10px]">
                Transaction Ref / UTR
              </td>
              <td className="px-3 py-2 text-xs font-mono text-slate-800 border border-slate-300 w-[30%] font-semibold print:py-1 print:px-2 print:text-[10px]">
                {app.paymentDetails?.transactionId || '—'}
              </td>
            </tr>
            <tr>
              <td className="bg-slate-100 text-slate-700 font-bold text-[11px] px-3 py-2 border border-slate-300 print:py-1 print:px-2 print:text-[10px]">
                Payment Verification
              </td>
              <td className="px-3 py-2 text-xs font-semibold border border-slate-300 capitalize print:py-1 print:px-2 print:text-[10px]">
                {app.paymentDetails?.verificationStatus ? (
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase border ${
                      app.paymentDetails.verificationStatus === 'verified'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {app.paymentDetails.verificationStatus}
                  </span>
                ) : (
                  'Pending'
                )}
              </td>
              <td className="bg-slate-100 text-slate-700 font-bold text-[11px] px-3 py-2 border border-slate-300 print:py-1 print:px-2 print:text-[10px]">
                Payment Date
              </td>
              <td className="px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-300 print:py-1 print:px-2 print:text-[10px]">
                {app.paymentDetails?.paidAt
                  ? new Date(app.paymentDetails.paidAt).toLocaleDateString('en-IN')
                  : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section 8: Applicant Undertaking & Declaration Box */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2 print-section print:p-3 print:bg-emerald-50/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-emerald-900 print:text-[10.5px]">
            <CheckCircle className="h-4 w-4 text-emerald-600 no-print" />
            8. Applicant Undertaking &amp; Declaration
          </div>
          <span className="font-bold px-2.5 py-0.5 rounded-full text-[11px] border text-emerald-700 bg-emerald-100 border-emerald-200 print:text-[9.5px]">
            Verified &amp; Agreed
          </span>
        </div>
        <p className="text-xs text-slate-700 leading-relaxed print:text-[10px] print:leading-snug">
          I hereby declare that all particulars entered in this application form are authentic,
          complete, and accurate. I understand that if any statement is found false or misleading at
          any stage, my candidature for admission will stand automatically canceled.
        </p>
      </div>
    </div>
  );
}

export default function ApplicationDetailPage() {
  const { id, tenant, role } = useParams<{ id: string; tenant: string; role: string }>();
  const router = useRouter();
  const selectedRole = useAuthStore((state) => state.activeRole);
  const selectedSystemRole = useAuthStore((state) => state.role);
  const activeRole = selectedRole?.baseRole ?? selectedRole?.name ?? selectedSystemRole;
  const canView = useHasPermission('admission', 'view');
  const hasEditPermission = useHasPermission('admission', 'edit');
  const hasCreatePermission = useHasPermission('admission', 'create');
  const hasApprovePermission = useHasPermission('admission', 'approve');
  const canOperate =
    [
      'super_admin',
      'admin',
      'administration_office',
      'assistant_administration_officer',
      'admission_incharge',
      'admission_counselor',
    ].includes(activeRole ?? '') && hasEditPermission;
  const canDecide =
    [
      'super_admin',
      'admin',
      'administration_office',
      'assistant_administration_officer',
      'admission_incharge',
    ].includes(activeRole ?? '') && hasApprovePermission;
  const canManagePayment = ['super_admin', 'admin', 'accounts_department'].includes(
    activeRole ?? '',
  );
  const canEnroll =
    ['super_admin', 'admin', 'administration_office', 'assistant_administration_officer'].includes(
      activeRole ?? '',
    ) && hasCreatePermission;
  const {
    data: appResp,
    error,
    isLoading,
    mutate,
  } = useSwr<{ data?: IAdmissionApplication } | IAdmissionApplication>(
    canView ? `admission/applications/${id}` : null,
  );
  // `useSwr` returns the JSON envelope `{ success, data: {...} }` — unwrap.
  const app: IAdmissionApplication | undefined =
    (appResp as { data?: IAdmissionApplication } | undefined)?.data ??
    (appResp as IAdmissionApplication | undefined);
  const photoUrl =
    app?.documentChecklist?.find((d) => d.docType === 'passport_photo')?.files?.[0]?.url ??
    app?.documentChecklist?.find((d) => d.docType === 'passport_photo')?.uploadedFileUrl;
  const canVerifyDocuments =
    canOperate && (app?.status === 'under_review' || app?.status === 'document_verification');
  const canManageAdmissionPayment =
    canManagePayment && (app?.status === 'under_review' || app?.status === 'approved');
  const { mutation, isLoading: processing } = useMutation();
  const { data: meRes } = useSwr<{ data?: { name?: string; email?: string; role?: string } }>(
    'user/me',
  );
  const currentUser = meRes?.data;
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isVerifyingAll, setIsVerifyingAll] = useState(false);
  const { data: settingsRes } = useSwr<{
    data?: {
      name: string;
      shortCode?: string;
      logoUrl?: string;
      email?: string;
      phone?: string;
      address?: string;
      accreditations?: string[];
    };
  }>('institution-setting/public');
  const settings = settingsRes?.data;
  const [localChecklist, setLocalChecklist] = useState<
    Record<string, { original: boolean; photocopy: boolean }>
  >({});
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amountInNumber: '',
    transactionId: '',
    paidAt: '',
  });
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      if (app?.documentChecklist) {
        const map: Record<string, { original: boolean; photocopy: boolean }> = {};
        app.documentChecklist.forEach((doc: IDocumentChecklistItem) => {
          map[doc.docType] = {
            original: Boolean(doc.originalSubmitted),
            photocopy: Boolean(doc.photocopySubmitted),
          };
        });
        setLocalChecklist(map);
      }
      if (app?.paymentDetails) {
        setPaymentForm({
          amountInNumber: String(app.paymentDetails.amountInNumber ?? ''),
          transactionId: app.paymentDetails.transactionId ?? '',
          paidAt: app.paymentDetails.paidAt
            ? new Date(app.paymentDetails.paidAt).toISOString().slice(0, 10)
            : '',
        });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [app]);
  const [viewer, setViewer] = useState<{ open: boolean; files: IViewerFile[]; title: string }>({
    open: false,
    files: [],
    title: '',
  });

  const statusIdx = app ? STATUS_ORDER.indexOf(app.status) : -1;
  const hasPaymentDetails = Boolean(app?.paymentDetails?.amountInNumber);
  const paymentVerified =
    !hasPaymentDetails || app?.paymentDetails?.verificationStatus === 'verified';

  const allDocsVerified = (() => {
    const list = (app?.documentChecklist ?? []) as Array<{
      status?: string;
      uploadedFileUrl?: string;
      files?: unknown[];
    }>;
    const uploaded = list.filter((d) => d.uploadedFileUrl || (d.files?.length ?? 0) > 0);
    return uploaded.length > 0 && uploaded.every((d) => d.status === 'verified');
  })();

  const patchAction = async (
    endpoint: string,
    body: Record<string, unknown>,
    successMsg: string,
  ) => {
    const res = await mutation(`admission/applications/${id}/${endpoint}`, {
      method: 'PATCH',
      body,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success(successMsg);
      mutate();
    } else {
      toast.error('Action failed. Please try again.');
    }
  };

  const handleStartReview = async () => {
    const confirm = await Swal.fire({
      title: 'Start review?',
      text: 'This moves the application to the Under Review stage.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Start',
      confirmButtonColor: '#0178D7',
    });
    if (!confirm.isConfirmed) return;
    await patchAction('start-review', {}, 'Review started');
  };

  const handleReviewDoc = async (docType: string, action: 'verify' | 'reject') => {
    let reason: string | undefined;
    if (action === 'reject') {
      const { value } = await Swal.fire({
        title: 'Reject this document',
        input: 'textarea',
        inputLabel: 'Reason (will be sent to the applicant)',
        inputPlaceholder:
          'e.g. The 10th marksheet image is blurred — please re-upload a clearer copy',
        inputAttributes: { 'aria-label': 'Rejection reason' },
        showCancelButton: true,
        confirmButtonText: 'Reject & notify applicant',
        confirmButtonColor: '#dc2626',
        inputValidator: (v) => (!v || !v.trim() ? 'A reason is required' : null),
      });
      if (!value) return;
      reason = value.trim();
    }
    const originalSubmitted = localChecklist[docType]?.original ?? false;
    const photocopySubmitted = localChecklist[docType]?.photocopy ?? false;
    const res = await mutation(`admission/applications/${id}/documents/${docType}/review`, {
      method: 'PATCH',
      body: { action, reason, originalSubmitted, photocopySubmitted },
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success(
        action === 'verify' ? 'Document verified' : 'Document rejected — applicant notified',
      );
      mutate();
    } else {
      toast.error('Action failed. Please try again.');
    }
  };

  const handleRequestDoc = async (docType: string) => {
    const { value: reason } = await Swal.fire({
      title: 'Request Document',
      text: `Enter instructions / description for requesting ${DOC_LABELS[docType] ?? docType}:`,
      input: 'textarea',
      inputPlaceholder: 'e.g. Please upload your JEE scorecard / rank card.',
      showCancelButton: true,
      confirmButtonText: 'Request Document',
      inputValidator: (v) => (!v || !v.trim() ? 'A description is required' : null),
    });
    if (!reason) return;

    const originalSubmitted = localChecklist[docType]?.original ?? false;
    const photocopySubmitted = localChecklist[docType]?.photocopy ?? false;
    const res = await mutation(`admission/applications/${id}/documents/${docType}/review`, {
      method: 'PATCH',
      body: {
        action: 'request',
        reason: reason.trim(),
        originalSubmitted,
        photocopySubmitted,
      },
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Document requested successfully — applicant notified');
      mutate();
    } else {
      toast.error('Action failed. Please try again.');
    }
  };

  const handleVerifyAllDocs = async () => {
    const unverifiedDocs = (
      (app?.documentChecklist as Array<{
        docType: string;
        status?: 'pending' | 'verified' | 'rejected';
        files?: unknown[];
        uploadedFileUrl?: string;
      }>) ?? []
    ).filter((doc) => {
      const hasFile = Boolean(doc.uploadedFileUrl) || (doc.files && doc.files.length > 0);
      return hasFile && doc.status !== 'verified';
    });

    if (unverifiedDocs.length === 0) {
      toast.info('No unverified documents with uploaded files found.');
      return;
    }

    const confirm = await Swal.fire({
      title: 'Verify all documents?',
      text: `This will mark all ${unverifiedDocs.length} unverified uploaded documents as Verified.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Verify All',
      confirmButtonColor: '#10b981',
    });
    if (!confirm.isConfirmed) return;

    setIsVerifyingAll(true);
    let succeeded = 0;
    try {
      for (const doc of unverifiedDocs) {
        const originalSubmitted = localChecklist[doc.docType]?.original ?? false;
        const photocopySubmitted = localChecklist[doc.docType]?.photocopy ?? false;
        const res = await mutation(`admission/applications/${id}/documents/${doc.docType}/review`, {
          method: 'PATCH',
          body: {
            action: 'verify',
            originalSubmitted,
            photocopySubmitted,
          },
        });
        if ((res as { results?: { success?: boolean } })?.results?.success) {
          succeeded++;
        }
      }
      if (succeeded > 0) {
        toast.success(`${succeeded} documents verified successfully`);
        mutate();
      } else {
        toast.error('Could not verify documents.');
      }
    } catch {
      toast.error('An error occurred during verification.');
    } finally {
      setIsVerifyingAll(false);
    }
  };

  const handleRequestCustomDoc = async () => {
    const { value: formValues } = await Swal.fire({
      title: 'Request Additional Document',
      html:
        '<input id="swal-input-name" class="swal2-input" style="font-size: 0.875rem;" placeholder="Document Name (e.g. Migration Certificate)">' +
        '<textarea id="swal-input-reason" class="swal2-textarea" style="font-size: 0.875rem;" placeholder="Instructions for the applicant (required)"></textarea>',
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Request',
      confirmButtonColor: '#d97706',
      preConfirm: () => {
        const name = (document.getElementById('swal-input-name') as HTMLInputElement).value;
        const reason = (document.getElementById('swal-input-reason') as HTMLTextAreaElement).value;
        if (!name || !name.trim()) {
          Swal.showValidationMessage('Document name is required');
          return false;
        }
        if (!reason || !reason.trim()) {
          Swal.showValidationMessage('Instructions/Reason is required');
          return false;
        }
        return { name: name.trim(), reason: reason.trim() };
      },
    });

    if (!formValues) return;

    const { name, reason } = formValues;
    const docType = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/(^_+|_+$)/g, '');

    if (!docType) {
      toast.error('Invalid document name.');
      return;
    }

    const res = await mutation(`admission/applications/${id}/documents/${docType}/review`, {
      method: 'PATCH',
      body: {
        action: 'request',
        reason,
        originalSubmitted: false,
        photocopySubmitted: false,
      },
    });

    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success(`Requested "${name}" successfully — applicant notified`);
      mutate();
    } else {
      toast.error('Action failed. Please try again.');
    }
  };

  const handleToggleOriginal = (docType: string, checked: boolean) => {
    setLocalChecklist((prev) => ({
      ...prev,
      [docType]: {
        ...(prev[docType] ?? { photocopy: false }),
        original: checked,
      },
    }));
  };

  const handleTogglePhotocopy = (docType: string, checked: boolean) => {
    setLocalChecklist((prev) => ({
      ...prev,
      [docType]: {
        ...(prev[docType] ?? { original: false }),
        photocopy: checked,
      },
    }));
  };

  const handleAdminUpload = async (docType: string, file: File) => {
    const fd = new FormData();
    fd.append('document', file);
    const res = (await mutation(`admission/applications/${id}/documents/${docType}`, {
      method: 'POST',
      isFormData: true,
      body: fd,
    })) as MutationResult;
    if (res?.results?.success) {
      toast.success('File uploaded successfully');
      mutate();
    } else {
      toast.error('Upload failed. Please try again.');
    }
  };

  const handleAdminDelete = async (docType: string, publicId?: string) => {
    const confirm = await Swal.fire({
      title: 'Delete file?',
      text: 'This will permanently remove this file from the application checklist.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;

    const path = publicId
      ? `admission/applications/${id}/documents/${docType}?publicId=${encodeURIComponent(publicId)}`
      : `admission/applications/${id}/documents/${docType}`;
    const res = (await mutation(path, { method: 'DELETE' })) as MutationResult;
    if (res?.results?.success) {
      toast.success('File deleted');
      mutate();
    } else {
      toast.error('Delete failed. Please try again.');
    }
  };

  const handleSavePayment = async () => {
    const body = new FormData();
    if (paymentForm.amountInNumber) body.append('amountInNumber', paymentForm.amountInNumber);
    if (paymentForm.transactionId) body.append('transactionId', paymentForm.transactionId);
    if (paymentForm.paidAt) body.append('paidAt', paymentForm.paidAt);
    if (paymentScreenshot) body.append('screenshot', paymentScreenshot);

    const res = await mutation(`admission/applications/${id}/payment`, {
      method: 'PATCH',
      isFormData: true,
      body,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Payment details saved');
      setIsEditingPayment(false);
      setPaymentScreenshot(null);
      mutate();
    } else {
      toast.error('Failed to save payment details.');
    }
  };

  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const handleReviewPayment = async (action: 'approve' | 'reject') => {
    if (action === 'reject') {
      const { value } = await Swal.fire({
        title: 'Reject payment?',
        input: 'textarea',
        inputLabel: 'Remarks for the applicant',
        inputPlaceholder: 'e.g. Transaction ID could not be matched with bank statement',
        showCancelButton: true,
        confirmButtonText: 'Reject Payment',
        confirmButtonColor: '#dc2626',
        inputValidator: (v) => (!v || !v.trim() ? 'Remarks are required' : null),
      });
      if (!value) return;
      const remarks = value.trim();

      const res = await mutation(`admission/applications/${id}/payment/review`, {
        method: 'PATCH',
        body: { action: 'reject', remarks },
      });
      if ((res as { results?: { success?: boolean } })?.results?.success !== false) {
        toast.success('Payment rejected');
        mutate();
      } else {
        toast.error('Could not reject payment status.');
      }
    } else {
      setVerifyModalOpen(true);
    }
  };

  const handleConfirmVerification = async (verifyData: {
    amountInNumber: number;
    transactionId: string;
    receiptNo: string;
    receiptDate: string;
    paymentMode: string;
    remarks: string;
  }) => {
    try {
      setVerifyingPayment(true);
      // 1. Save verified transaction & receipt info
      const body = new FormData();
      if (verifyData.amountInNumber)
        body.append('amountInNumber', String(verifyData.amountInNumber));
      if (verifyData.transactionId) body.append('transactionId', verifyData.transactionId);
      if (verifyData.receiptNo) body.append('receiptNo', verifyData.receiptNo);
      if (verifyData.receiptDate) body.append('receiptDate', verifyData.receiptDate);
      if (verifyData.paymentMode) body.append('paymentMode', verifyData.paymentMode);

      await mutation(`admission/applications/${id}/payment`, {
        method: 'PATCH',
        body,
        isAlert: false,
      });

      // 2. Mark payment as verified
      const res = await mutation(`admission/applications/${id}/payment/review`, {
        method: 'PATCH',
        body: { action: 'approve', remarks: verifyData.remarks },
      });

      if ((res as { results?: { success?: boolean } })?.results?.success !== false) {
        toast.success('Admission payment verified successfully!');
        setVerifyModalOpen(false);
        mutate();
      } else {
        toast.error('Could not finalize payment verification.');
      }
    } catch {
      toast.error('Error verifying payment.');
    } finally {
      setVerifyingPayment(false);
    }
  };

  const handleApprove = async () => {
    const { value: remarks } = await Swal.fire({
      title: 'Approve Application',
      input: 'textarea',
      inputPlaceholder: 'Remarks (required)',
      showCancelButton: true,
      confirmButtonText: 'Approve',
      confirmButtonColor: '#0178D7',
      preConfirm: (v) => {
        if (!v) {
          Swal.showValidationMessage('Remarks required');
          return false;
        }
        return v;
      },
    });
    if (remarks)
      await patchAction('decide', { decision: 'approved', remarks }, 'Application approved');
  };

  const handleReject = async () => {
    const { value: remarks } = await Swal.fire({
      title: 'Reject Application',
      input: 'textarea',
      inputPlaceholder: 'Reason for rejection (required)',
      showCancelButton: true,
      confirmButtonText: 'Reject',
      confirmButtonColor: '#d33',
      preConfirm: (v) => {
        if (!v) {
          Swal.showValidationMessage('Reason required');
          return false;
        }
        return v;
      },
    });
    if (remarks)
      await patchAction('decide', { decision: 'rejected', remarks }, 'Application rejected');
  };

  const handleEnroll = async () => {
    const confirm = await Swal.fire({
      title: 'Confirm Enrollment?',
      text: `Enroll ${app?.candidateName} in ${programmeLabel(app?.allocatedProgram ?? '')}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Enroll',
      confirmButtonColor: '#0178D7',
    });
    if (confirm.isConfirmed) {
      const res = await mutation(`admission/applications/${id}/enroll`, { method: 'POST' });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Enrolled successfully');
        mutate();
      } else {
        toast.error('Enrollment failed');
      }
    }
  };

  if (!canView) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Admission access unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your active role cannot view this application.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Application could not be loaded</h1>
        <p className="mt-2 text-sm text-red-600">{error.message}</p>
        <CustomButton className="mx-auto mt-4 w-fit!" onClick={() => mutate()}>
          Try again
        </CustomButton>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
    );
  }

  if (!app) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl bg-white">
        <p className="text-slate-500">Application not found.</p>
      </div>
    );
  }

  const cfg = STATUS_CFG[app.status] ?? {
    label: app.status ? humanizeValue(String(app.status)) : 'Unknown',
    bg: 'bg-slate-100',
    text: 'text-slate-500',
  };

  const documentItems = app.documentChecklist ?? [];
  const uploadedDocuments = documentItems.filter(
    (doc) => Boolean(doc.uploadedFileUrl) || Boolean(doc.files?.length),
  ).length;
  const verifiedDocuments = documentItems.filter((doc) => doc.status === 'verified').length;
  const attentionDocuments = documentItems.filter(
    (doc) => doc.status === 'rejected' || (!doc.uploadedFileUrl && !doc.files?.length),
  ).length;
  const enrollmentAudit = [...(app.approvalChain ?? [])]
    .reverse()
    .find((step) => step.remarks?.toLowerCase().includes('enrolled'));
  const enrollmentTimestamp = app.enrolledAt || enrollmentAudit?.actionedAt || app.updatedAt;
  const enrolledByName = enrollmentAudit?.approvedByName || 'Admission Cell';

  return (
    <div className="mb-20 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 overflow-hidden">
          <AdmissionWorkflowBar />
        </div>
        <button
          type="button"
          onClick={() => router.back()}
          className="group inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white  transition hover:bg-primary-700 active:scale-[0.98]"
        >
          <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Applications
        </button>
      </div>

      {app.status === 'enrolled' ? (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-4 rounded-2xl bg-emerald-50 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <div className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-600 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide text-white ">
                Enrolled — Admission Complete
              </div>
              <p className="mt-0.5 text-xs text-emerald-700">
                The applicant has been successfully converted into an active student.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:text-right">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                Enrollment date &amp; time
              </p>
              <p className="mt-0.5 text-xs font-semibold text-emerald-900">
                {enrollmentTimestamp
                  ? new Date(enrollmentTimestamp).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : 'Not recorded'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                Registration number
              </p>
              <p className="mt-0.5 font-mono text-xs font-semibold text-emerald-900">
                {app.registrationNumber || 'Pending university issue'}
              </p>
            </div>
          </div>
          <div className="min-w-0 border-t border-emerald-200 pt-3 sm:col-span-2">
            <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-xs leading-relaxed text-emerald-900">
              <span className="shrink-0 font-bold">Enrolled by:</span>
              <span className="min-w-0 break-words font-medium">{enrolledByName}</span>
            </p>
          </div>
        </motion.section>
      ) : (
        /* Progress Timeline */
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl bg-white px-5 py-4"
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Application Progress</h3>
            {app.submittedAt && (
              <p className="text-[11px] text-slate-600">
                Submitted {new Date(app.submittedAt).toLocaleString('en-IN')}
              </p>
            )}
          </div>
          <div className="relative flex items-center justify-between gap-1 overflow-x-auto">
            {TIMELINE_STEPS.map((step, i) => {
              const done = statusIdx >= i;
              const active = app.status === step.status;
              return (
                <React.Fragment key={step.status}>
                  <div className="flex min-w-14 flex-col items-center gap-1 pt-1">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${active ? 'bg-primary text-white ring-2 ring-primary ring-offset-2' : done ? 'bg-secondary text-white' : 'bg-slate-100 text-slate-600'}`}
                    >
                      {done && !active ? <CheckCircle className="h-4 w-4" /> : i + 1}
                    </div>
                    <span
                      className={`text-center text-[10px] leading-tight ${active ? 'font-semibold text-primary' : done ? 'text-secondary' : 'text-slate-600'}`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < TIMELINE_STEPS.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 ${done && statusIdx > i ? 'bg-secondary' : 'bg-slate-100'}`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </motion.div>
      )}

      {app.status === 'enrolled' && (
        <motion.aside
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
              <Info className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">
                Need to update student details?
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
                This admission is complete. Make any further profile changes from Student
                Management.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/${tenant}/${role}/student-management`)}
            className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white  transition hover:bg-amber-700 active:scale-[0.98]"
          >
            Go to Student Management
          </button>
        </motion.aside>
      )}

      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl bg-white"
      >
        <div className="flex flex-col gap-5 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            {(() => {
              const photoUrl =
                app.documentChecklist?.find((d) => d.docType === 'passport_photo')?.files?.[0]
                  ?.url ??
                app.documentChecklist?.find((d) => d.docType === 'passport_photo')?.uploadedFileUrl;
              const initials = (app.candidateName ?? '?')
                .split(' ')
                .map((s) => s[0])
                .filter(Boolean)
                .slice(0, 2)
                .join('')
                .toUpperCase();
              return photoUrl ? (
                <Image
                  src={photoUrl}
                  alt={app.candidateName}
                  width={56}
                  height={56}
                  unoptimized
                  className="h-14 w-14 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-base font-bold text-primary">
                  {initials || '?'}
                </div>
              );
            })()}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${cfg.bg} ${cfg.text}`}
                >
                  {cfg.label}
                </span>
                <span className="text-xs font-medium text-slate-600">Admission application</span>
              </div>
              <h1 className="mt-1.5 truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                {app.candidateName}
              </h1>
              <p className="mt-1 font-mono text-xs text-slate-600">#{app.applicationNumber}</p>
            </div>
          </div>

          <div className="flex max-w-3xl flex-wrap gap-2 xl:justify-end">
            {(() => {
              const lastStep = (app.approvalChain ?? []).slice(-1)[0];
              const officerName = lastStep?.approvedByName
                ? String(lastStep.approvedByName)
                : 'Admission Cell';
              if (app.status === 'approved') {
                return (
                  <span className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-emerald-50 px-3 text-xs font-bold text-emerald-700">
                    Approved by {officerName}
                  </span>
                );
              }
              return null;
            })()}
            {canOperate && (app.status === 'draft' || app.status === 'submitted') && (
              <CustomButton
                variant="primary"
                startIcon={<FileText className="h-4 w-4" />}
                onClick={() => router.push(`../admission/new?appId=${app._id}`)}
              >
                {app.status === 'draft' ? 'Fill / Edit Form' : 'Edit Submitted Form'}
              </CustomButton>
            )}
            {app.status === 'submitted' && canOperate && (
              <CustomButton
                variant="secondary"
                startIcon={<CheckCircle className="h-4 w-4" />}
                onClick={handleStartReview}
                loading={processing}
              >
                Start Review
              </CustomButton>
            )}
            {app.status === 'under_review' && canDecide && (
              <>
                <CustomButton
                  variant="secondary"
                  startIcon={<CheckCircle className="h-4 w-4" />}
                  onClick={handleApprove}
                  loading={processing}
                  disabled={!allDocsVerified}
                >
                  Approve
                </CustomButton>
                <CustomButton
                  variant="cancel"
                  startIcon={<XCircle className="h-4 w-4" />}
                  onClick={handleReject}
                  loading={processing}
                >
                  Reject
                </CustomButton>
              </>
            )}
            {app.status === 'approved' && canEnroll && (
              <CustomButton
                variant="primary"
                startIcon={<GraduationCap className="h-4 w-4" />}
                onClick={handleEnroll}
                loading={processing}
                disabled={!paymentVerified}
              >
                Confirm Enrollment
              </CustomButton>
            )}
            <CustomButton
              variant="secondary"
              startIcon={<Printer className="h-4 w-4" />}
              onClick={() => setIsPreviewOpen(true)}
            >
              Preview Application PDF
            </CustomButton>
          </div>
        </div>
      </motion.header>

      {/* What's happening now */}
      {app.status !== 'enrolled' &&
        (() => {
          const guide = STAGE_GUIDE[app.status] ?? STAGE_GUIDE.draft;
          const tone = STAGE_TONE[guide.tone];
          const Icon =
            guide.tone === 'success'
              ? CheckCircle
              : guide.tone === 'danger'
                ? XCircle
                : guide.tone === 'progress'
                  ? Hourglass
                  : Info;
          return (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className={`rounded-2xl px-4 py-3 ring-1 ${tone.bg} ${tone.ring}`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone.iconBg}`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1">
                  <h3 className={`text-base font-semibold ${tone.text}`}>{guide.headline}</h3>
                  <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                    {guide.description}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
                    <p>
                      <span className="font-semibold text-slate-600">Owner:</span> {guide.nextActor}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-600">Next:</span> {guide.nextAction}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-600">Timing:</span> {guide.sla}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })()}

      <div
        id="sec-profile"
        className="grid scroll-mt-20 overflow-hidden rounded-2xl bg-white xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
      >
        <div className="min-w-0 xl:border-r xl:border-slate-100">
          {/* Personal Info */}
          <Section
            title="Personal Information"
            description="Identity and demographic details provided by the applicant"
            icon={<UserCheck className="h-4.5 w-4.5" />}
          >
            <div className="space-y-2.5">
              <InfoRow
                label="Date of Birth"
                value={
                  app.dateOfBirth ? new Date(app.dateOfBirth).toLocaleDateString('en-IN') : '—'
                }
              />
              <InfoRow label="Gender" value={<span className="capitalize">{app.gender}</span>} />
              <InfoRow label="Category" value={<span className="uppercase">{app.category}</span>} />
              <InfoRow label="Religion" value={app.religion} />
              <InfoRow label="Nationality" value={app.nationality} />
              <InfoRow label="Aadhaar" value={app.aadhaarNumber} />
              <InfoRow label="Blood Group" value={app.bloodGroup} />
            </div>
          </Section>

          {/* Onboarding Preferences */}
          <Section
            title="Onboarding & Transport Preferences"
            description="Residential and daily travel preferences for onboarding"
            icon={<Users className="h-4.5 w-4.5" />}
          >
            <OnboardingAdminCard app={app} onRefresh={mutate} />
          </Section>

          {/* Contact */}
          <Section
            title="Contact Details"
            description="Primary communication channels and registered addresses"
            icon={<Phone className="h-4.5 w-4.5" />}
          >
            <div className="space-y-2.5">
              <InfoRow label="Email" value={app.email} />
              <InfoRow label="Phone" value={app.phone} />
              <InfoRow label="WhatsApp" value={app.whatsappPhone} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3">
              {[
                { label: 'Present Address', addr: app.presentAddress },
                { label: 'Permanent Address', addr: app.permanentAddress },
              ].map(({ label, addr }) => (
                <div key={label} className="rounded-xl bg-slate-50 p-3">
                  <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-slate-600">
                    <MapPin className="h-3 w-3" />
                    {label}
                  </p>
                  {addr ? (
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {addr.line1}
                      {addr.line2 ? `, ${addr.line2}` : ''}
                      <br />
                      {addr.city}, {addr.district ?? addr.state}
                      <br />
                      {addr.state} — {addr.pincode}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-600">Not provided</p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="min-w-0">
          {/* Program */}
          <Section
            title="Programme Preferences"
            description="Requested programme choices, allocation and merit position"
            icon={<GraduationCap className="h-4.5 w-4.5" />}
          >
            <div className="space-y-2.5">
              <InfoRow label="Academic Year" value={app.academicYear} />
              <InfoRow label="Admission Type" value={humanizeValue(app.admissionType)} />
              <InfoRow
                label="Preferences"
                value={
                  <div className="flex flex-wrap gap-1">
                    {(app.programPreferences ?? []).map((p: string, i: number) => (
                      <span
                        key={p}
                        className="whitespace-nowrap rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary"
                      >
                        {i + 1}. {programmeLabel(p)}
                      </span>
                    ))}
                  </div>
                }
              />
              {app.allocatedProgram && (
                <InfoRow
                  label="Allocated Program"
                  value={
                    <span className="inline-flex whitespace-nowrap rounded-full bg-secondary-50 px-2.5 py-0.5 text-xs font-semibold text-secondary">
                      {programmeLabel(app.allocatedProgram)}
                    </span>
                  }
                />
              )}
              {app.meritRank && (
                <InfoRow
                  label="Merit Rank"
                  value={<span className="font-bold text-primary">#{app.meritRank}</span>}
                />
              )}
            </div>
          </Section>

          {/* Entrance Exam */}
          <Section
            title="Entrance Examination"
            description="Entrance test identity, rank, percentile and score"
            icon={<Award className="h-4.5 w-4.5" />}
          >
            {app.entranceExam ? (
              <div className="space-y-2.5">
                <InfoRow
                  label="Exam"
                  value={
                    app.entranceExam.exam === 'OTHER'
                      ? app.entranceExam.otherName
                      : app.entranceExam.exam
                  }
                />
                <InfoRow label="Year" value={app.entranceExam.year} />
                <InfoRow label="Application No." value={app.entranceExam.applicationNo} />
                <InfoRow label="Rank" value={app.entranceExam.rank} />
                <InfoRow
                  label="Percentile"
                  value={
                    app.entranceExam.percentile != null ? `${app.entranceExam.percentile}%` : null
                  }
                />
                <InfoRow label="Score" value={app.entranceExam.score} />
              </div>
            ) : (
              <p className="text-sm text-slate-600">No entrance exam details</p>
            )}
          </Section>

          {/* Academic Records */}
          <Section
            title="Academic Records"
            description="Previous qualifications used for eligibility and merit"
            icon={<BookOpen className="h-4.5 w-4.5" />}
          >
            {(app.academicRecords ?? []).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-2 text-left font-semibold text-slate-500">Level</th>
                      <th className="pb-2 text-left font-semibold text-slate-500">
                        Board/University
                      </th>
                      <th className="pb-2 text-left font-semibold text-slate-500">Institute</th>
                      <th className="pb-2 text-left font-semibold text-slate-500">Year</th>
                      <th className="pb-2 text-right font-semibold text-slate-500">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(app.academicRecords ?? []).map(
                      (
                        r: {
                          level: string;
                          boardOrUniversity: string;
                          instituteName: string;
                          yearOfPassing: number;
                          percentageOfMarks: number;
                        },
                        i: number,
                      ) => (
                        <tr key={i}>
                          <td className="py-2 text-slate-700">{humanizeValue(r.level)}</td>
                          <td className="py-2 text-slate-600">{r.boardOrUniversity}</td>
                          <td className="py-2 text-slate-600">{r.instituteName}</td>
                          <td className="py-2 text-slate-600">{r.yearOfPassing}</td>
                          <td className="py-2 text-right font-semibold text-primary">
                            {r.percentageOfMarks}%
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-600">No academic records</p>
            )}
          </Section>

          {/* Parent Info */}
          <Section
            title="Parent / Guardian"
            description="Family contacts, occupations and declared annual income"
            icon={<Users className="h-4.5 w-4.5" />}
          >
            <div className="space-y-2.5">
              <InfoRow
                label="Father"
                value={`${app.parentInfo?.fatherName || app.fatherName || '—'}${app.parentInfo?.fatherOccupation ? ` · ${app.parentInfo.fatherOccupation}` : ''}`}
              />
              <InfoRow
                label="Father Phone"
                value={app.parentInfo?.fatherPhone || app.parentPhone}
              />
              <InfoRow
                label="Mother"
                value={`${app.parentInfo?.motherName || app.motherName || '—'}${app.parentInfo?.motherOccupation ? ` · ${app.parentInfo.motherOccupation}` : ''}`}
              />
              <InfoRow label="Mother Phone" value={app.parentInfo?.motherPhone} />
              {app.parentInfo?.guardianName && (
                <InfoRow label="Guardian" value={app.parentInfo.guardianName} />
              )}
              {app.guardianPhone && <InfoRow label="Guardian Phone" value={app.guardianPhone} />}
              {app.parentInfo?.annualIncome && (
                <InfoRow
                  label="Annual Income"
                  value={`₹${app.parentInfo.annualIncome.toLocaleString('en-IN')}`}
                />
              )}
            </div>
          </Section>
        </div>
      </div>

      {/* Document Checklist & Verification */}
      <div id="sec-documents" className="scroll-mt-20 overflow-hidden rounded-2xl bg-white">
        <Section
          title="Document Checklist & Verification"
          description="Review uploaded evidence and complete document verification"
          icon={<FileText className="h-4.5 w-4.5" />}
        >
          <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-slate-100 lg:grid-cols-4">
            {[
              { label: 'Required', value: documentItems.length, tone: 'text-slate-800' },
              { label: 'Uploaded', value: uploadedDocuments, tone: 'text-blue-700' },
              { label: 'Verified', value: verifiedDocuments, tone: 'text-emerald-700' },
              { label: 'Needs action', value: attentionDocuments, tone: 'text-amber-700' },
            ].map((item) => (
              <div key={item.label} className="bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
                  {item.label}
                </p>
                <p className={`mt-1 text-xl font-bold ${item.tone}`}>{item.value}</p>
              </div>
            ))}
          </div>

          {canVerifyDocuments && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <div>
                <p className="text-xs font-bold text-slate-700">Verification controls</p>
                <p className="mt-0.5 text-[11px] text-slate-600">
                  Review individual evidence below or complete uploaded documents together.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleRequestCustomDoc}
                  disabled={processing || isVerifyingAll}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-50"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Request document
                </button>
                <button
                  type="button"
                  onClick={handleVerifyAllDocs}
                  disabled={processing || isVerifyingAll || uploadedDocuments === 0}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isVerifyingAll ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="h-3.5 w-3.5" />
                  )}
                  {isVerifyingAll ? 'Verifying…' : 'Verify uploaded'}
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-190 text-xs">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-600">
                  <th className="rounded-l-lg px-3 py-2.5 text-left font-bold min-w-52">
                    Document
                  </th>
                  <th className="px-3 py-2.5 text-left font-bold">Digital evidence</th>
                  <th className="px-3 py-2.5 text-center font-bold">Photocopy</th>
                  <th className="px-3 py-2.5 text-center font-bold">Original</th>
                  <th className="rounded-r-lg px-3 py-2.5 text-left font-bold">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(
                  (app.documentChecklist as Array<{
                    docType: string;
                    uploadedFileUrl?: string;
                    verifiedAt?: string;
                    remarks?: string;
                    status?: 'pending' | 'verified' | 'rejected';
                    rejectionReason?: string;
                    originalSubmitted?: boolean;
                    photocopySubmitted?: boolean;
                    previouslyRejected?: boolean;
                    files?: unknown[];
                  }>) ?? []
                ).map((doc) => {
                  const docFiles = (doc.files ?? []) as Array<{
                    url: string;
                    name?: string;
                    mimeType?: string;
                    publicId?: string;
                  }>;
                  const hasFile = Boolean(doc.uploadedFileUrl) || docFiles.length > 0;
                  const photocopy = Boolean(doc.photocopySubmitted) || hasFile;
                  const isPending = !doc.status || doc.status === 'pending';
                  const showActions =
                    canVerifyDocuments && (isPending || doc.status === 'rejected');
                  const viewerFiles: IViewerFile[] = docFiles.length
                    ? docFiles.map((f) => ({ url: f.url, name: f.name, mimeType: f.mimeType }))
                    : doc.uploadedFileUrl
                      ? [{ url: doc.uploadedFileUrl }]
                      : [];
                  const docLabel =
                    DOC_LABELS[doc.docType] ??
                    doc.docType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                  return (
                    <tr
                      key={doc.docType}
                      className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
                    >
                      <td className="px-3 py-3.5 font-semibold text-slate-700">{docLabel}</td>
                      <td className="px-3 py-3.5">
                        <div className="flex flex-col items-start gap-1.5">
                          {viewerFiles.map((vf, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setViewer({ open: true, files: [vf], title: docLabel })
                                }
                                className="text-primary underline hover:opacity-80 font-medium"
                              >
                                {vf.name || `View File ${idx + 1}`}
                              </button>
                              {canVerifyDocuments && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAdminDelete(doc.docType, docFiles[idx]?.publicId)
                                  }
                                  className="text-rose-600 hover:text-rose-800 transition"
                                  title="Delete file"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                          {canVerifyDocuments && (
                            <label className="mt-1 cursor-pointer rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-200 transition">
                              Upload File
                              <input
                                type="file"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleAdminUpload(doc.docType, f);
                                }}
                              />
                            </label>
                          )}
                          {!viewerFiles.length && <span className="text-slate-300">—</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        {canVerifyDocuments && doc.status !== 'verified' ? (
                          <input
                            type="checkbox"
                            checked={Boolean(localChecklist[doc.docType]?.photocopy)}
                            disabled={processing || isVerifyingAll}
                            onChange={(e) => handleTogglePhotocopy(doc.docType, e.target.checked)}
                            className="h-4 w-4 cursor-pointer accent-emerald-600"
                            aria-label="Mark photocopy received"
                          />
                        ) : photocopy || localChecklist[doc.docType]?.photocopy ? (
                          <CheckCircle className="mx-auto h-4 w-4 text-emerald-600" />
                        ) : (
                          <XCircle className="mx-auto h-4 w-4 text-slate-300" />
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        {canVerifyDocuments && doc.status !== 'verified' ? (
                          <input
                            type="checkbox"
                            checked={Boolean(localChecklist[doc.docType]?.original)}
                            disabled={processing || isVerifyingAll}
                            onChange={(e) => handleToggleOriginal(doc.docType, e.target.checked)}
                            className="h-4 w-4 cursor-pointer accent-emerald-600"
                            aria-label="Mark original received"
                          />
                        ) : doc.originalSubmitted || localChecklist[doc.docType]?.original ? (
                          <CheckCircle className="mx-auto h-4 w-4 text-emerald-600" />
                        ) : (
                          <XCircle className="mx-auto h-4 w-4 text-slate-300" />
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        {doc.status === 'verified' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                            <CheckCircle className="h-3 w-3" /> Verified
                          </span>
                        ) : doc.status === 'rejected' ? (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">
                              <XCircle className="h-3 w-3" /> Rejected / Requested
                            </span>
                            {doc.rejectionReason ? (
                              <span className="text-[11px] italic text-rose-700">
                                “{doc.rejectionReason}”
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-slate-600">Pending</span>
                        )}
                        {showActions ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {hasFile && (
                              <button
                                type="button"
                                onClick={() => handleReviewDoc(doc.docType, 'verify')}
                                disabled={processing || isVerifyingAll}
                                className="rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
                              >
                                {doc.previouslyRejected ? 'Reverify' : 'Verify'}
                              </button>
                            )}
                            {hasFile && (
                              <button
                                type="button"
                                onClick={() => handleReviewDoc(doc.docType, 'reject')}
                                disabled={processing || isVerifyingAll}
                                className="rounded-md bg-rose-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50 transition cursor-pointer"
                              >
                                Reject
                              </button>
                            )}
                            {!hasFile && (
                              <button
                                type="button"
                                onClick={() => handleRequestDoc(doc.docType)}
                                disabled={processing || isVerifyingAll}
                                className="rounded-md bg-amber-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition cursor-pointer"
                              >
                                Request Doc
                              </button>
                            )}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                {(!app.documentChecklist || (app.documentChecklist as unknown[]).length === 0) && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-600">
                      No document checklist yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {app.status === 'under_review' && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                <ListChecks className="h-4 w-4 text-primary" />
                <span>
                  Verify or reject each document individually using the actions in the row above.
                  When all documents are reviewed, approve or reject the application from the
                  header.
                </span>
              </div>
            )}
            {app.status !== 'under_review' &&
              app.status !== 'document_verification' &&
              app.status !== 'submitted' &&
              app.status !== 'draft' && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">
                  <CheckCircle className="h-4 w-4" />
                  <span>Document checklist locked — application has moved past verification.</span>
                </div>
              )}
          </div>
        </Section>
      </div>

      {/* Fees & Payment Section */}
      <div id="sec-payment" className="scroll-mt-20 space-y-5 overflow-hidden rounded-2xl">
        {(app.paymentDetails || canManageAdmissionPayment) && (
          <Section
            title="Payment Details"
            description="Admission payment evidence, verification status and accounting review"
            icon={<CreditCard className="h-4.5 w-4.5" />}
            action={
              canManageAdmissionPayment && !isEditingPayment ? (
                <button
                  type="button"
                  onClick={() => setIsEditingPayment(true)}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Edit Payment Details
                </button>
              ) : undefined
            }
          >
            {isEditingPayment ? (
              <div className="space-y-3 rounded-xl bg-slate-50 p-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Amount Paid (₹)
                  </label>
                  <input
                    type="number"
                    value={paymentForm.amountInNumber}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({ ...prev, amountInNumber: e.target.value }))
                    }
                    className="w-full rounded-md border border-slate-200 p-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none text-slate-800"
                    placeholder="e.g. 5000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Transaction / UTR ID
                  </label>
                  <input
                    type="text"
                    value={paymentForm.transactionId}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({ ...prev, transactionId: e.target.value }))
                    }
                    className="w-full rounded-md border border-slate-200 p-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none text-slate-800"
                    placeholder="UTR123456789"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={paymentForm.paidAt}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({ ...prev, paidAt: e.target.value }))
                    }
                    className="w-full rounded-md border border-slate-200 p-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Payment Proof Screenshot
                  </label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setPaymentScreenshot(e.target.files?.[0] ?? null)}
                    className="w-full rounded-md border border-slate-200 bg-white p-2 text-sm text-slate-800 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-700"
                  />
                  {paymentScreenshot ? (
                    <p className="mt-1 text-xs text-slate-500">{paymentScreenshot.name}</p>
                  ) : null}
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleSavePayment}
                    disabled={processing}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingPayment(false);
                      setPaymentScreenshot(null);
                    }}
                    className="rounded-md bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-300 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <InfoRow
                  label="Verification Status"
                  value={
                    app.paymentDetails?.verificationStatus ? (
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                          app.paymentDetails.verificationStatus === 'verified'
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                            : app.paymentDetails.verificationStatus === 'rejected'
                              ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                              : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                        }`}
                      >
                        {app.paymentDetails.verificationStatus}
                      </span>
                    ) : (
                      'Not recorded'
                    )
                  }
                />
                <InfoRow
                  label="Amount"
                  value={
                    app.paymentDetails?.amountInNumber
                      ? `₹${app.paymentDetails.amountInNumber.toLocaleString('en-IN')}`
                      : '—'
                  }
                />
                <InfoRow label="Amount in Words" value={app.paymentDetails?.amountInWords} />
                <InfoRow label="Transaction / UTR ID" value={app.paymentDetails?.transactionId} />
                <InfoRow
                  label="Paid At"
                  value={
                    app.paymentDetails?.paidAt
                      ? new Date(app.paymentDetails.paidAt).toLocaleDateString('en-IN')
                      : null
                  }
                />
                <InfoRow label="Receipt No." value={app.paymentDetails?.receiptNo} />
                <InfoRow
                  label="Receipt Date"
                  value={
                    app.paymentDetails?.receiptDate
                      ? new Date(app.paymentDetails.receiptDate).toLocaleDateString('en-IN')
                      : null
                  }
                />
                <InfoRow
                  label="Payment Mode"
                  value={
                    app.paymentDetails?.paymentMode ? (
                      <span className="capitalize">
                        {humanizeValue(app.paymentDetails.paymentMode)}
                      </span>
                    ) : null
                  }
                />
                <InfoRow
                  label="Payment Proof"
                  value={
                    app.paymentDetails?.screenshotUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setViewer({
                            open: true,
                            files: [{ url: app.paymentDetails?.screenshotUrl ?? '' }],
                            title: 'Payment Proof',
                          })
                        }
                        className="text-primary underline hover:opacity-80"
                      >
                        View proof
                      </button>
                    ) : null
                  }
                />
                <InfoRow label="Payment Remarks" value={app.paymentDetails?.verificationRemarks} />
                {canManageAdmissionPayment &&
                app.paymentDetails?.amountInNumber &&
                app.paymentDetails?.verificationStatus !== 'verified' ? (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleReviewPayment('approve')}
                      disabled={processing}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                    >
                      Verify Payment
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReviewPayment('reject')}
                      disabled={processing}
                      className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 transition"
                    >
                      Reject Payment
                    </button>
                  </div>
                ) : null}
                {app.paymentDetails?.verificationStatus === 'verified' && (
                  <div className="rounded-xl bg-emerald-50 p-3.5 text-xs font-medium text-emerald-900 ring-1 ring-emerald-200/70 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-sm">
                      <span>✓</span> Payment Verified
                    </div>
                    {(() => {
                      const vObj =
                        typeof app.paymentDetails?.verifiedBy === 'object'
                          ? (app.paymentDetails.verifiedBy as {
                              name?: string;
                              email?: string;
                              role?: string;
                            })
                          : null;
                      const verifierName =
                        vObj?.name ||
                        vObj?.email ||
                        currentUser?.name ||
                        currentUser?.email ||
                        'Authorized User';
                      const verifierRole = vObj?.role || currentUser?.role || 'super_admin';

                      return (
                        <p className="text-xs text-slate-700">
                          Verified by:{' '}
                          <span className="font-bold text-slate-900">{verifierName}</span>
                          <span className="ml-1.5 inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                            {humanizeValue(verifierRole)}
                          </span>
                          {app.paymentDetails?.verifiedAt && (
                            <span className="ml-2 text-slate-500 font-normal">
                              on{' '}
                              {new Date(app.paymentDetails.verifiedAt).toLocaleDateString('en-IN')}
                            </span>
                          )}
                        </p>
                      );
                    })()}
                  </div>
                )}
                {app.status === 'approved' &&
                (!app.paymentDetails?.amountInNumber ||
                  app.paymentDetails?.verificationStatus !== 'verified') ? (
                  <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700 ring-1 ring-amber-100">
                    Enrollment is locked until payment is recorded and verified.
                  </div>
                ) : null}
              </div>
            )}
          </Section>
        )}
      </div>

      {/* Print CSS Rules: Target ONLY #standalone-print-sheet-root during window.print() */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 8mm;
              }
              html, body {
                background: #ffffff !important;
                color: #000000 !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                height: auto !important;
                overflow: visible !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              /* Hide all top navigation, sidebars, modal backdrops, dialogs, buttons */
              header, nav, aside, [role="dialog"], [aria-modal="true"], .no-print {
                display: none !important;
              }
              body * {
                visibility: hidden !important;
              }
              /* Make ONLY #standalone-print-sheet-root visible starting at top-left 0px margin */
              #standalone-print-sheet-root, #standalone-print-sheet-root * {
                visibility: visible !important;
              }
              #standalone-print-sheet-root {
                display: block !important;
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                box-: none !important;
                background: #ffffff !important;
              }
              /* Strip outer card border, radius, , and paddings for clean A4 paper fit */
              #standalone-print-sheet-root > div {
                padding: 0 !important;
                margin: 0 !important;
                border: none !important;
                border-radius: 0 !important;
                box-: none !important;
                max-width: 100% !important;
                width: 100% !important;
              }
            }
          `,
        }}
      />

      {/* Official Application Form Sheet Preview (rendered in shared FileViewer component for on-screen modal) */}
      <FileViewer
        open={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title={`Official Application Form Sheet — #${app.applicationNumber}`}
        actionLabel="Print / Save PDF"
        onAction={() => window.print()}
      >
        <OfficialApplicationFormSheet
          app={app}
          settings={settings}
          photoUrl={photoUrl}
          onViewDoc={(files, title) => setViewer({ open: true, files, title })}
        />
      </FileViewer>

      {/* Dedicated Standalone Printable Sheet container for @media print (always 1 single copy) */}
      <div id="standalone-print-sheet-root" className="hidden">
        <OfficialApplicationFormSheet app={app} settings={settings} photoUrl={photoUrl} />
      </div>

      {/* Approval Chain & Audit Trail */}
      <div id="sec-approval" className="scroll-mt-20 overflow-hidden rounded-2xl bg-white">
        {((app.approvalChain as unknown[]) ?? []).length > 0 && (
          <Section
            title="Approval Chain & Audit History"
            description="Chronological ownership, decisions and staff remarks"
            icon={<Clock className="h-4.5 w-4.5" />}
          >
            <div className="space-y-3">
              {(
                app.approvalChain as Array<{
                  role: string;
                  status: string;
                  approvedByName?: string;
                  remarks?: string;
                  actionedAt?: string;
                }>
              ).map((step, i) => {
                const isApproved = step.status === 'approved';
                const isRejected = step.status === 'rejected';
                return (
                  <div key={i} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                    <div
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        isApproved
                          ? 'bg-emerald-100 text-emerald-600'
                          : isRejected
                            ? 'bg-red-100 text-red-600'
                            : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {isApproved ? (
                        <CheckCircle className="h-3.5 w-3.5" />
                      ) : isRejected ? (
                        <XCircle className="h-3.5 w-3.5" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-700">
                        {ROLE_LABEL[step.role] ?? humanizeValue(step.role)}
                      </p>
                      <p
                        className={`text-xs capitalize ${
                          isApproved
                            ? 'text-emerald-600'
                            : isRejected
                              ? 'text-red-500'
                              : 'text-slate-600'
                        }`}
                      >
                        {isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Awaiting action'}
                        {step.approvedByName ? ` · by ${step.approvedByName}` : ''}
                        {step.actionedAt
                          ? ` · ${new Date(step.actionedAt).toLocaleDateString('en-IN')}`
                          : ''}
                      </p>
                      {step.remarks && (
                        <p className="mt-1 rounded-lg bg-white p-2 text-xs italic text-slate-500">
                          “{step.remarks}”
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}
      </div>

      <VerifyAccountsPaymentModal
        open={verifyModalOpen}
        onClose={() => setVerifyModalOpen(false)}
        app={app}
        onConfirm={handleConfirmVerification}
        loading={verifyingPayment}
      />

      <FileViewer
        open={viewer.open}
        onClose={() => setViewer((v) => ({ ...v, open: false }))}
        files={viewer.files}
        title={viewer.title}
      />
    </div>
  );
}

// ── Accounts Fee Verification Modal ──────────────────────────────────────────
const verifyAccountsPaymentSchema = Yup.object({
  amountInNumber: Yup.number()
    .typeError('Amount must be a valid number')
    .positive('Amount must be greater than 0')
    .required('Verified payment amount is required'),
  transactionId: Yup.string()
    .trim()
    .min(3, 'Transaction / UTR ID must be at least 3 characters')
    .required('Transaction / UTR Reference ID is required'),
  receiptNo: Yup.string()
    .trim()
    .min(2, 'Receipt number must be at least 2 characters')
    .required('Official fee receipt number is required'),
  receiptDate: Yup.string().required('Receipt date is required'),
  paymentMode: Yup.string()
    .oneOf(['upi', 'bank_transfer', 'dd', 'cash', 'cheque'])
    .required('Select verified payment mode'),
  remarks: Yup.string().optional(),
});

function VerifyAccountsPaymentModal({
  open,
  onClose,
  app,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  app: IAdmissionApplication | null | undefined;
  onConfirm: (data: {
    amountInNumber: number;
    transactionId: string;
    receiptNo: string;
    receiptDate: string;
    paymentMode: string;
    remarks: string;
  }) => Promise<void>;
  loading: boolean;
}) {
  if (!open) return null;

  const initialValues = {
    amountInNumber: app?.paymentDetails?.amountInNumber ?? 0,
    transactionId: app?.paymentDetails?.transactionId ?? '',
    receiptNo: app?.paymentDetails?.receiptNo ?? '',
    receiptDate: app?.paymentDetails?.receiptDate
      ? new Date(app.paymentDetails.receiptDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    paymentMode: app?.paymentDetails?.paymentMode ?? 'bank_transfer',
    remarks: app?.paymentDetails?.verificationRemarks ?? '',
  };

  const applicantName: string =
    typeof app?.personalDetails === 'object' &&
    app?.personalDetails &&
    'fullName' in app.personalDetails
      ? String((app.personalDetails as Record<string, unknown>).fullName)
      : String((app as { studentName?: string })?.studentName || 'Applicant');
  const programName: string =
    typeof app?.academicDetails === 'object' &&
    app?.academicDetails &&
    'program' in app.academicDetails
      ? String((app.academicDetails as Record<string, unknown>).program)
      : 'Degree Program';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-8  max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-4.5 w-4.5" />
              </span>
              <h3 className="text-lg font-bold text-slate-900">
                Accounts Fee Verification & Clearance
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Verify applicant fee receipt, confirm transaction reference, and authorize enrollment.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Applicant Details Banner */}
        <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-xs text-emerald-950">
          <p className="font-semibold text-emerald-900">
            Applicant: {applicantName} ({app?.applicationNumber || 'APP-2026'})
          </p>
          <p className="mt-1 text-emerald-700">
            Program: <strong>{programName}</strong> · Role: Accounts Verification Officer
          </p>
        </div>

        <Formik
          initialValues={initialValues}
          enableReinitialize
          validationSchema={verifyAccountsPaymentSchema}
          onSubmit={(values) => {
            onConfirm({
              amountInNumber: Number(values.amountInNumber),
              transactionId: values.transactionId.trim(),
              receiptNo: values.receiptNo.trim(),
              receiptDate: values.receiptDate,
              paymentMode: values.paymentMode,
              remarks: values.remarks.trim(),
            });
          }}
        >
          {({ errors, touched, getFieldProps, handleSubmit }) => (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    Transaction / UTR Reference ID *
                  </label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-primary"
                    placeholder="e.g. UTR1293840294"
                    {...getFieldProps('transactionId')}
                  />
                  <p className="mt-1 text-[11px] text-slate-600">
                    Bank UTR or transaction confirmation code.
                  </p>
                  {touched.transactionId && errors.transactionId && (
                    <p className="mt-1 text-xs font-medium text-red-500">{errors.transactionId}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    Fee Receipt Number *
                  </label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-primary"
                    placeholder="e.g. REC-2026-081"
                    {...getFieldProps('receiptNo')}
                  />
                  <p className="mt-1 text-[11px] text-slate-600">
                    Official institutional receipt serial number.
                  </p>
                  {touched.receiptNo && errors.receiptNo && (
                    <p className="mt-1 text-xs font-medium text-red-500">{errors.receiptNo}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    Verified Payment Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-primary"
                    {...getFieldProps('amountInNumber')}
                  />
                  <p className="mt-1 text-[11px] text-slate-600">
                    Confirmed credited amount received in bank.
                  </p>
                  {touched.amountInNumber && errors.amountInNumber && (
                    <p className="mt-1 text-xs font-medium text-red-500">{errors.amountInNumber}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Payment Mode *</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-primary"
                    {...getFieldProps('paymentMode')}
                  >
                    <option value="upi">UPI / QR Code</option>
                    <option value="bank_transfer">
                      Netbanking / Bank Transfer (NEFT/RTGS/IMPS)
                    </option>
                    <option value="dd">Demand Draft (DD)</option>
                    <option value="cash">Cash Counter Receipt</option>
                    <option value="cheque">Cheque</option>
                  </select>
                  <p className="mt-1 text-[11px] text-slate-600">
                    Payment channel used by applicant.
                  </p>
                  {touched.paymentMode && errors.paymentMode && (
                    <p className="mt-1 text-xs font-medium text-red-500">{errors.paymentMode}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Receipt / Verification Date *
                </label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-primary"
                  {...getFieldProps('receiptDate')}
                />
                {touched.receiptDate && errors.receiptDate && (
                  <p className="mt-1 text-xs font-medium text-red-500">{errors.receiptDate}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Accounts Clearance Notes & Remarks
                </label>
                <textarea
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-primary"
                  placeholder="e.g. Transaction verified against bank statement ending in 4092."
                  {...getFieldProps('remarks')}
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <CustomButton variant="cancel" type="button" onClick={onClose}>
                  Cancel
                </CustomButton>
                <CustomButton
                  type="submit"
                  loading={loading}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  Confirm & Verify Admission Fee
                </CustomButton>
              </div>
            </form>
          )}
        </Formik>
      </motion.div>
    </div>
  );
}

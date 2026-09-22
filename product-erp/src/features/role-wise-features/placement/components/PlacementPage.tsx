/**
 * @file PlacementPage.tsx
 * @description Placement management — role-aware:
 *   All: View drives (GET placement)
 *   Student: Register for drive (POST placement/:id/register), view own applications
 *   Coordinator/Admin: Create drive, view applications, shortlist/select candidates
 * @module features/role-wise-features/placement
 */
'use client';

import React, { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import {
  Briefcase,
  Plus,
  CheckCircle,
  MapPin,
  Calendar,
  Eye,
  BadgeCheck,
  User,
  FileSpreadsheet,
  Upload,
  Award,
  X,
  Building2,
  Target,
  TrendingUp,
  UsersRound,
  UserRoundSearch,
  LayoutDashboard,
  Globe2,
  Send,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Column, Action } from '@/shared/core/CustomTable';
import DataViewSwitcher from '@/shared/core/DataViewSwitcher';
import AsyncSelect from '@/shared/core/AsyncSelect';
import Empty from '@/shared/core/Empty';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { useAuthStore } from '@/shared/store/authStore';

interface IPlacementDrive {
  _id: string;
  academicYear: string;
  companyName: string;
  companyProfile?: string;
  hrContact?: string;
  hrEmail?: string;
  jobRole: string;
  jobDescription?: string;
  package: number;
  packageMax?: number;
  venue: string;
  registrationStart: string;
  registrationEnd: string;
  driveDate?: string;
  eligibilityCgpa?: number;
  eligibilityBacklogs?: number;
  eligiblePrograms: string[];
  eligibleBranches: string[];
  eligibleBatches: string[];
  rounds: Array<{ roundNo: number; roundName: string; scheduledDate?: string }>;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  registeredCount?: number;
  selectedCount?: number;
  isRegistered?: boolean;
  [key: string]: unknown;
}

interface IApplication {
  _id: string;
  studentId: string | { _id?: string; name?: string };
  studentName: string;
  rollNumber: string;
  program?: string;
  branch?: string;
  cgpaAtTimeOfApplication: number;
  currentRound: number;
  roundResults: Array<{ roundNo: number; roundName: string; status: string }>;
  status:
    | 'registered'
    | 'shortlisted'
    | 'round_ongoing'
    | 'selected'
    | 'offered'
    | 'accepted'
    | 'declined'
    | 'rejected'
    | 'withdrawn'
    | 'absent'
    | 'superseded';
  offeredPackage?: number;
  offeredRole?: string;
  offerLetterUrl?: string;
  [key: string]: unknown;
}

interface IPlacementStats {
  totalDrives?: number;
  totalRegistered?: number;
  totalSelected?: number;
  upcoming?: number;
  ongoing?: number;
  completed?: number;
  cancelled?: number;
  placementRate?: number;
  avgCtc?: number;
  averageOfferedCtc?: number;
  highestOfferedCtc?: number;
  offersIssued?: number;
  offersAccepted?: number;
  offersDeclined?: number;
  offersPending?: number;
  offerAcceptanceRate?: number;
  closingSoon?: number;
  offersExpiring?: number;
  readiness?: Record<string, number>;
  applicationStatus?: Record<string, number>;
  monthlyApplications?: Array<{ month: string; applications: number; selections: number }>;
  branchOutcomes?: Array<{ branch: string; applications: number; selections: number }>;
}

interface IPlacementNetworkListing {
  _id: string;
  ownerTenantId: string;
  ownerOrganizationName: string;
  companyName: string;
  jobRole: string;
  academicYear: string;
  venue: string;
  driveDate: string;
  registrationEnd: string;
  package: number;
  packageMax?: number;
  eligibilityCgpa?: number;
  eligibilityBacklogs?: number;
  eligiblePrograms: string[];
  eligibleBranches: string[];
  availableSeats?: number;
  participationNote?: string;
  isOwnedByCurrentTenant: boolean;
  request?: { status: 'pending' | 'approved' | 'rejected' | 'withdrawn' } | null;
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';
const labelCls = 'mb-1 block text-xs font-medium text-slate-600';

const DRIVE_STATUS_CFG = {
  upcoming: { label: 'Upcoming', bg: 'bg-blue-50', text: 'text-blue-600' },
  ongoing: { label: 'Ongoing', bg: 'bg-green-50', text: 'text-green-600' },
  completed: { label: 'Completed', bg: 'bg-slate-100', text: 'text-slate-500' },
  cancelled: { label: 'Cancelled', bg: 'bg-red-50', text: 'text-red-500' },
};

const APP_STATUS_CFG = {
  registered: { label: 'Registered', bg: 'bg-blue-50', text: 'text-blue-600' },
  shortlisted: { label: 'Shortlisted', bg: 'bg-amber-50', text: 'text-amber-600' },
  round_ongoing: { label: 'Rounds', bg: 'bg-violet-50', text: 'text-violet-600' },
  selected: { label: 'Selected', bg: 'bg-green-50', text: 'text-green-600' },
  offered: { label: 'Offer issued', bg: 'bg-primary-50', text: 'text-primary' },
  accepted: { label: 'Accepted', bg: 'bg-green-50', text: 'text-green-700' },
  declined: { label: 'Declined', bg: 'bg-slate-100', text: 'text-slate-600' },
  rejected: { label: 'Rejected', bg: 'bg-red-50', text: 'text-red-500' },
  withdrawn: { label: 'Withdrawn', bg: 'bg-slate-100', text: 'text-slate-500' },
  absent: { label: 'Absent', bg: 'bg-red-50', text: 'text-red-500' },
  superseded: { label: 'Superseded', bg: 'bg-slate-100', text: 'text-slate-500' },
};

function fmtDate(iso?: string) {
  return iso
    ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
}

// ─── Create / Edit Drive Modal ───────────────────────────────────────────────
function CreateDriveModal({
  drive,
  onClose,
  onSaved,
}: {
  drive?: IPlacementDrive | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutation, isLoading } = useMutation();
  const isEdit = !!drive;
  const [rounds, setRounds] = useState(
    drive?.rounds.length
      ? drive.rounds
      : [{ roundNo: 1, roundName: 'Aptitude', scheduledDate: '' }],
  );
  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      academicYear: drive?.academicYear ?? '',
      companyName: drive?.companyName ?? '',
      companyProfile: drive?.companyProfile ?? '',
      hrContact: drive?.hrContact ?? '',
      hrEmail: drive?.hrEmail ?? '',
      jobRole: drive?.jobRole ?? '',
      jobDescription: drive?.jobDescription ?? '',
      package: drive?.package ?? 0,
      packageMax: drive?.packageMax ?? 0,
      venue: drive?.venue ?? '',
      registrationStart: drive?.registrationStart?.slice(0, 10) ?? '',
      registrationEnd: drive?.registrationEnd?.slice(0, 10) ?? '',
      driveDate: drive?.driveDate ? drive.driveDate.slice(0, 10) : '',
      eligibilityCgpa: drive?.eligibilityCgpa ?? 0,
      eligibilityBacklogs: drive?.eligibilityBacklogs ?? 0,
      eligiblePrograms: drive?.eligiblePrograms ?? [],
      eligibleBranches: drive?.eligibleBranches ?? [],
      eligibleBatches: drive?.eligibleBatches ?? [],
    },
    validationSchema: Yup.object({
      academicYear: Yup.string().required('Academic year required'),
      companyName: Yup.string().trim().required('Company name required'),
      jobRole: Yup.string().trim().required('Role required'),
      venue: Yup.string().trim().required('Venue required'),
      package: Yup.number().moreThan(0).required('Package required'),
      registrationStart: Yup.date().required(),
      registrationEnd: Yup.date().required(),
      driveDate: Yup.date().required(),
    }),
    onSubmit: async (values) => {
      const endpoint = isEdit ? `placement/${drive!._id}` : 'placement';
      const method = (isEdit ? 'PUT' : 'POST') as 'PUT' | 'POST';
      const res = await mutation(endpoint, { method, body: { ...values, rounds }, isAlert: true });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success(isEdit ? 'Drive updated' : 'Drive created');
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="placement-drive-dialog-title"
        className="relative z-10 max-h-[92dvh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-5 sm:p-7"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
              Guided placement setup
            </p>
            <h2 id="placement-drive-dialog-title" className="mt-1 text-xl font-bold text-slate-900">
              {isEdit ? 'Edit placement drive' : 'Create placement drive'}
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Define the employer opportunity, eligibility window and ordered selection rounds.
              Students only see drives for which they can register.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close drive form"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={formik.handleSubmit} className="space-y-6">
          <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
            <span className="font-semibold">Before publishing:</span> confirm the registration
            deadline precedes the drive date, compensation is recorded in LPA and selection rounds
            match the company process.
          </div>
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Opportunity details</h3>
              <p className="text-xs text-slate-500">Employer, role, compensation and venue.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <AsyncSelect
                type="academicYears"
                label="Academic Year"
                value={formik.values.academicYear || null}
                onChange={(value) => formik.setFieldValue('academicYear', value ?? '')}
                required
              />
              <div>
                <label className={labelCls}>Company *</label>
                <input
                  name="companyName"
                  value={formik.values.companyName}
                  onChange={formik.handleChange}
                  placeholder="Infosys"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Job role *</label>
                <input
                  name="jobRole"
                  value={formik.values.jobRole}
                  onChange={formik.handleChange}
                  placeholder="Software Engineer"
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Job description</label>
              <textarea
                name="jobDescription"
                rows={2}
                value={formik.values.jobDescription}
                onChange={formik.handleChange}
                className={inputCls + ' resize-none'}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className={labelCls}>Package from (LPA) *</label>
                <input
                  type="number"
                  name="package"
                  min={0}
                  value={formik.values.package}
                  onChange={formik.handleChange}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Package to (LPA)</label>
                <input
                  type="number"
                  name="packageMax"
                  value={formik.values.packageMax}
                  onChange={formik.handleChange}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Venue *</label>
                <input
                  name="venue"
                  value={formik.values.venue}
                  onChange={formik.handleChange}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Minimum CGPA</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step="0.1"
                  name="eligibilityCgpa"
                  value={formik.values.eligibilityCgpa}
                  onChange={formik.handleChange}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Maximum active backlogs</label>
                <input
                  type="number"
                  min={0}
                  name="eligibilityBacklogs"
                  value={formik.values.eligibilityBacklogs}
                  onChange={formik.handleChange}
                  className={inputCls}
                />
              </div>
            </div>
          </section>
          <section className="space-y-4 border-t border-slate-100 pt-5">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Schedule and eligibility</h3>
              <p className="text-xs text-slate-500">Control who can apply and when.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelCls}>Registration opens *</label>
                <input
                  type="date"
                  name="registrationStart"
                  value={formik.values.registrationStart}
                  onChange={formik.handleChange}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Registration closes *</label>
                <input
                  type="date"
                  name="registrationEnd"
                  value={formik.values.registrationEnd}
                  onChange={formik.handleChange}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Drive Date</label>
                <input
                  type="date"
                  name="driveDate"
                  value={formik.values.driveDate}
                  onChange={formik.handleChange}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <AsyncSelect
                type="programs"
                label="Eligible programmes"
                multiple
                value={formik.values.eligiblePrograms}
                onChange={(_, options) =>
                  formik.setFieldValue(
                    'eligiblePrograms',
                    options?.map((option) => option.label) ?? [],
                  )
                }
                placeholder="All programmes"
              />
              <AsyncSelect
                type="departments"
                label="Eligible branches"
                multiple
                value={formik.values.eligibleBranches}
                onChange={(_, options) =>
                  formik.setFieldValue(
                    'eligibleBranches',
                    options?.map((option) => option.label) ?? [],
                  )
                }
                placeholder="All branches"
              />
              <AsyncSelect
                type="batches"
                label="Eligible batches"
                multiple
                value={formik.values.eligibleBatches}
                onChange={(_, options) =>
                  formik.setFieldValue(
                    'eligibleBatches',
                    options?.map((option) => option.label) ?? [],
                  )
                }
                placeholder="All batches"
              />
            </div>
          </section>
          <section className="space-y-3 border-t border-slate-100 pt-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Selection rounds</p>
                  <p className="text-xs text-slate-500">
                    Add rounds in the exact order candidates will complete them.
                  </p>
                </div>
                <CustomButton
                  variant="tertiary"
                  onClick={() =>
                    setRounds((current) => [
                      ...current,
                      { roundNo: current.length + 1, roundName: '', scheduledDate: '' },
                    ])
                  }
                >
                  Add round
                </CustomButton>
              </div>
              <div className="space-y-2">
                {rounds.map((round, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[40px_1fr_160px_auto] gap-2 rounded-lg bg-slate-50 p-2"
                  >
                    <span className="pt-2 text-center text-sm font-bold text-primary">
                      {index + 1}
                    </span>
                    <input
                      className={inputCls}
                      value={round.roundName}
                      placeholder="Technical interview"
                      onChange={(event) =>
                        setRounds((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, roundName: event.target.value } : item,
                          ),
                        )
                      }
                    />
                    <input
                      type="date"
                      className={inputCls}
                      value={round.scheduledDate?.slice(0, 10) ?? ''}
                      onChange={(event) =>
                        setRounds((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, scheduledDate: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      disabled={rounds.length === 1}
                      onClick={() =>
                        setRounds((current) =>
                          current
                            .filter((_, itemIndex) => itemIndex !== index)
                            .map((item, itemIndex) => ({ ...item, roundNo: itemIndex + 1 })),
                        )
                      }
                      className="text-xs text-red-500 disabled:opacity-30"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
            <CustomButton variant="tertiary" type="button" onClick={onClose}>
              Cancel
            </CustomButton>
            <CustomButton variant="primary" type="submit" loading={isLoading}>
              {isEdit ? 'Update' : 'Create'}
            </CustomButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Drive Card (student view) ────────────────────────────────────────────────
function DriveCard({
  drive,
  onRegister,
  canRegister,
}: {
  drive: IPlacementDrive;
  onRegister: () => void;
  canRegister: boolean;
}) {
  const st = DRIVE_STATUS_CFG[drive.status] ?? DRIVE_STATUS_CFG.upcoming;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-3 rounded-2xl bg-white p-5"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-900">{drive.companyName}</p>
          <p className="text-xs text-primary font-medium">{drive.jobRole}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${st.bg} ${st.text}`}
        >
          {st.label}
        </span>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        {drive.package > 0 ? (
          <span className="font-bold text-green-600">
            {drive.package}
            {drive.packageMax && drive.packageMax !== drive.package
              ? `–${drive.packageMax}`
              : ''}{' '}
            LPA
          </span>
        ) : null}
        {drive.venue && (
          <span className="flex items-center gap-0.5">
            <MapPin className="h-3 w-3" />
            {drive.venue}
          </span>
        )}
        {drive.driveDate && (
          <span className="flex items-center gap-0.5">
            <Calendar className="h-3 w-3" />
            {fmtDate(drive.driveDate)}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500">
        CGPA {drive.eligibilityCgpa ?? 0}+ · up to {drive.eligibilityBacklogs ?? 0} active backlogs
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-600">
          Registration closes: {fmtDate(drive.registrationEnd)}
        </span>
        {drive.isRegistered ? (
          <span className="flex items-center gap-1 text-xs font-medium text-green-600">
            <CheckCircle className="h-3.5 w-3.5" />
            Registered
          </span>
        ) : canRegister && (drive.status === 'upcoming' || drive.status === 'ongoing') ? (
          <CustomButton variant="primary" onClick={onRegister} className="py-1.5! text-xs! w-fit!">
            Register
          </CustomButton>
        ) : null}
      </div>
    </motion.div>
  );
}

function PlacementAnalytics({
  records,
  stats,
  loading,
}: {
  records: IPlacementDrive[];
  stats: IPlacementStats;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
    );
  }

  const totalDrives = stats.totalDrives ?? records.length;
  const registrations =
    stats.totalRegistered ??
    records.reduce((sum, record) => sum + (record.registeredCount ?? 0), 0);
  const selections =
    stats.totalSelected ?? records.reduce((sum, record) => sum + (record.selectedCount ?? 0), 0);
  const conversion =
    stats.placementRate ?? (registrations > 0 ? (selections / registrations) * 100 : 0);
  const packages = records.map((record) => record.package).filter((value) => value > 0);
  const averagePackage =
    stats.averageOfferedCtc ??
    stats.avgCtc ??
    (packages.length ? packages.reduce((sum, value) => sum + value, 0) / packages.length : 0);
  const upcoming =
    stats.upcoming ?? records.filter((record) => record.status === 'upcoming').length;
  const active = stats.ongoing ?? records.filter((record) => record.status === 'ongoing').length;
  const funnel = [
    { label: 'Openings', value: totalDrives, color: '#2563eb' },
    { label: 'Applications', value: registrations, color: '#7c3aed' },
    { label: 'Selections', value: selections, color: '#059669' },
  ];
  const funnelMax = Math.max(...funnel.map((item) => item.value), 1);
  const packageBands = [
    { label: '< 5', count: packages.filter((value) => value < 5).length, color: '#38bdf8' },
    {
      label: '5–8',
      count: packages.filter((value) => value >= 5 && value < 8).length,
      color: '#2563eb',
    },
    {
      label: '8–12',
      count: packages.filter((value) => value >= 8 && value < 12).length,
      color: '#7c3aed',
    },
    { label: '12+', count: packages.filter((value) => value >= 12).length, color: '#059669' },
  ];
  const bandMax = Math.max(...packageBands.map((item) => item.count), 1);
  const statusBreakdown = [
    {
      label: 'Upcoming',
      value: records.filter((record) => record.status === 'upcoming').length,
      color: '#2563eb',
    },
    {
      label: 'Ongoing',
      value: records.filter((record) => record.status === 'ongoing').length,
      color: '#059669',
    },
    {
      label: 'Completed',
      value: records.filter((record) => record.status === 'completed').length,
      color: '#64748b',
    },
    {
      label: 'Cancelled',
      value: records.filter((record) => record.status === 'cancelled').length,
      color: '#e11d48',
    },
  ];
  const topDrives = [...records]
    .filter((record) => (record.registeredCount ?? 0) > 0)
    .sort((left, right) => (right.registeredCount ?? 0) - (left.registeredCount ?? 0))
    .slice(0, 5);
  const topDriveMax = Math.max(...topDrives.map((record) => record.registeredCount ?? 0), 1);
  const readiness = [
    { label: 'Placement ready', value: stats.readiness?.ready ?? 0, color: '#059669' },
    { label: 'Resume missing', value: stats.readiness?.resumeMissing ?? 0, color: '#f59e0b' },
    { label: 'Not eligible', value: stats.readiness?.notEligible ?? 0, color: '#e11d48' },
    { label: 'Already placed', value: stats.readiness?.placed ?? 0, color: '#2563eb' },
  ];
  const readinessTotal = readiness.reduce((sum, item) => sum + item.value, 0);
  const activity = stats.monthlyApplications ?? [];
  const activityMax = Math.max(
    ...activity.flatMap((item) => [item.applications, item.selections]),
    1,
  );
  const branchOutcomes = stats.branchOutcomes ?? [];
  const branchMax = Math.max(...branchOutcomes.map((item) => item.applications), 1);
  const kpis = [
    {
      label: 'Placement drives',
      value: totalDrives.toLocaleString('en-IN'),
      detail: `${upcoming} upcoming · ${active} active`,
      icon: Building2,
      iconClass: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Student applications',
      value: registrations.toLocaleString('en-IN'),
      detail: totalDrives
        ? `${(registrations / totalDrives).toFixed(1)} per drive`
        : 'No applications yet',
      icon: UsersRound,
      iconClass: 'bg-violet-50 text-violet-600',
    },
    {
      label: 'Selections',
      value: selections.toLocaleString('en-IN'),
      detail: `${conversion.toFixed(1)}% application conversion`,
      icon: Target,
      iconClass: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Average advertised CTC',
      value: averagePackage ? `${averagePackage.toFixed(1)} LPA` : '—',
      detail: packages.length
        ? `Across ${packages.length} priced drives`
        : 'Add package data to compare',
      icon: TrendingUp,
      iconClass: 'bg-amber-50 text-amber-600',
    },
  ];

  return (
    <section aria-label="Placement analytics" className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, value, detail, icon: Icon, iconClass }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
              </div>
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}
              >
                <Icon className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-500">{detail}</p>
          </motion.div>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Hiring funnel</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Movement from published opportunities to final selections.
          </p>
          <svg
            viewBox="0 0 620 190"
            className="mt-4 h-auto w-full"
            role="img"
            aria-label="Placement hiring funnel"
          >
            {funnel.map((item, index) => {
              const width = item.value ? Math.max(22, (item.value / funnelMax) * 430) : 0;
              const y = 12 + index * 58;
              return (
                <g key={item.label}>
                  <text x="0" y={y + 18} fill="#64748b" fontSize="13">
                    {item.label}
                  </text>
                  <rect x="96" y={y} width="440" height="30" rx="9" fill="#f1f5f9" />
                  <motion.rect
                    x="96"
                    y={y}
                    height="30"
                    rx="9"
                    fill={item.color}
                    initial={{ width: 0 }}
                    animate={{ width }}
                    transition={{ duration: 0.55, delay: index * 0.08 }}
                  />
                  <text x="552" y={y + 20} fill="#0f172a" fontSize="14" fontWeight="700">
                    {item.value.toLocaleString('en-IN')}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">CTC distribution</h3>
          <p className="mt-0.5 text-xs text-slate-500">Drive count by advertised LPA range.</p>
          {packages.length ? (
            <svg
              viewBox="0 0 420 190"
              className="mt-4 h-auto w-full"
              role="img"
              aria-label="Advertised package distribution"
            >
              {packageBands.map((item, index) => {
                const height = (item.count / bandMax) * 105;
                const x = 30 + index * 98;
                return (
                  <g key={item.label}>
                    <line x1={x} y1="145" x2={x + 58} y2="145" stroke="#e2e8f0" />
                    <motion.rect
                      x={x}
                      y={145 - height}
                      width="58"
                      rx="8"
                      fill={item.color}
                      initial={{ height: 0, y: 145 }}
                      animate={{ height, y: 145 - height }}
                      transition={{ duration: 0.5, delay: index * 0.07 }}
                    />
                    <text
                      x={x + 29}
                      y={132 - height}
                      textAnchor="middle"
                      fill="#334155"
                      fontSize="12"
                      fontWeight="700"
                    >
                      {item.count}
                    </text>
                    <text x={x + 29} y="168" textAnchor="middle" fill="#64748b" fontSize="12">
                      {item.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="mt-4 flex min-h-36 items-center justify-center rounded-xl bg-slate-50 px-4 text-center text-xs text-slate-500">
              Add compensation to a drive to see package distribution.
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Drive lifecycle</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Current distribution of every placement drive.
          </p>
          <div className="mt-4 grid items-center gap-4 sm:grid-cols-[160px_1fr]">
            <svg
              viewBox="0 0 160 160"
              className="mx-auto h-40 w-40"
              role="img"
              aria-label="Placement drive status distribution"
            >
              <circle cx="80" cy="80" r="54" fill="none" stroke="#f1f5f9" strokeWidth="18" />
              {statusBreakdown.map((item, index) => {
                const circumference = 339.3;
                const prior = statusBreakdown
                  .slice(0, index)
                  .reduce((sum, status) => sum + status.value, 0);
                const segment = totalDrives ? (item.value / totalDrives) * circumference : 0;
                const offset = totalDrives ? -(prior / totalDrives) * circumference : 0;
                return (
                  <motion.circle
                    key={item.label}
                    cx="80"
                    cy="80"
                    r="54"
                    fill="none"
                    stroke={item.color}
                    strokeWidth="18"
                    strokeLinecap="round"
                    strokeDasharray={`${segment} ${circumference - segment}`}
                    strokeDashoffset={offset}
                    transform="rotate(-90 80 80)"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.08 }}
                  />
                );
              })}
              <text x="80" y="76" textAnchor="middle" fill="#0f172a" fontSize="25" fontWeight="700">
                {totalDrives}
              </text>
              <text x="80" y="97" textAnchor="middle" fill="#64748b" fontSize="11">
                drives
              </text>
            </svg>
            <div className="space-y-2.5">
              {statusBreakdown.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-4 text-xs">
                  <span className="flex items-center gap-2 text-slate-600">
                    <svg width="9" height="9" aria-hidden="true">
                      <circle cx="4.5" cy="4.5" r="4.5" fill={item.color} />
                    </svg>
                    {item.label}
                  </span>
                  <span className="font-bold text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Highest participation</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Top drives ranked by student registrations.
          </p>
          {topDrives.length ? (
            <svg
              viewBox="0 0 520 225"
              className="mt-4 h-auto w-full"
              role="img"
              aria-label="Top placement drives by registrations"
            >
              {topDrives.map((record, index) => {
                const y = 10 + index * 42;
                const width = ((record.registeredCount ?? 0) / topDriveMax) * 310;
                const label =
                  record.companyName.length > 16
                    ? `${record.companyName.slice(0, 15)}…`
                    : record.companyName;
                return (
                  <g key={record._id}>
                    <text x="0" y={y + 18} fill="#64748b" fontSize="12">
                      {label}
                    </text>
                    <rect x="132" y={y} width="320" height="25" rx="7" fill="#f1f5f9" />
                    <motion.rect
                      x="132"
                      y={y}
                      height="25"
                      rx="7"
                      fill="#2563eb"
                      initial={{ width: 0 }}
                      animate={{ width }}
                      transition={{ duration: 0.5, delay: index * 0.06 }}
                    />
                    <text x="468" y={y + 17} fill="#0f172a" fontSize="12" fontWeight="700">
                      {record.registeredCount ?? 0}
                    </text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="mt-4 flex min-h-40 items-center justify-center rounded-xl bg-slate-50 text-xs text-slate-500">
              Participation appears after students register.
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Student readiness</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Eligibility and resume readiness across placement profiles.
          </p>
          <div className="mt-4 space-y-3">
            {readiness.map((item, index) => {
              const percent = readinessTotal ? (item.value / readinessTotal) * 100 : 0;
              return (
                <div key={item.label}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-600">{item.label}</span>
                    <span className="font-bold text-slate-900">
                      {item.value}{' '}
                      <span className="font-normal text-slate-400">({percent.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <svg
                    viewBox="0 0 500 14"
                    className="h-3.5 w-full"
                    role="img"
                    aria-label={`${item.label}: ${item.value}`}
                  >
                    <rect width="500" height="14" rx="7" fill="#f1f5f9" />
                    <motion.rect
                      width={(percent / 100) * 500}
                      height="14"
                      rx="7"
                      fill={item.color}
                      initial={{ width: 0 }}
                      animate={{ width: (percent / 100) * 500 }}
                      transition={{ duration: 0.45, delay: index * 0.06 }}
                    />
                  </svg>
                </div>
              );
            })}
            {!readinessTotal && (
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-center text-xs text-slate-500">
                Student readiness appears after placement profiles are created.
              </p>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Offer outcomes</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Acceptance health and pending student decisions.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              { label: 'Issued', value: stats.offersIssued ?? 0, tone: 'bg-blue-50 text-blue-700' },
              {
                label: 'Accepted',
                value: stats.offersAccepted ?? 0,
                tone: 'bg-emerald-50 text-emerald-700',
              },
              {
                label: 'Awaiting response',
                value: stats.offersPending ?? 0,
                tone: 'bg-amber-50 text-amber-700',
              },
              {
                label: 'Declined',
                value: stats.offersDeclined ?? 0,
                tone: 'bg-rose-50 text-rose-700',
              },
            ].map((item) => (
              <div key={item.label} className={`rounded-xl p-3 ${item.tone}`}>
                <p className="text-xl font-bold">{item.value}</p>
                <p className="mt-0.5 text-[11px] font-medium">{item.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5">
            <span className="text-xs text-slate-500">Offer acceptance rate</span>
            <span className="text-sm font-bold text-slate-900">
              {(stats.offerAcceptanceRate ?? 0).toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Application momentum</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Monthly applications compared with students reaching selection.
              </p>
            </div>
            <div className="flex gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                Applications
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                Selections
              </span>
            </div>
          </div>
          {activity.length ? (
            <svg
              viewBox="0 0 900 245"
              className="mt-4 h-auto w-full"
              role="img"
              aria-label="Monthly placement application momentum"
            >
              {activity.map((item, index) => {
                const groupWidth = 820 / activity.length;
                const x = 50 + index * groupWidth;
                const applicationHeight = (item.applications / activityMax) * 150;
                const selectionHeight = (item.selections / activityMax) * 150;
                return (
                  <g key={item.month}>
                    <line x1={x - 8} y1="180" x2={x + groupWidth - 15} y2="180" stroke="#e2e8f0" />
                    <motion.rect
                      x={x}
                      y={180 - applicationHeight}
                      width={Math.min(22, groupWidth / 3)}
                      height={applicationHeight}
                      rx="5"
                      fill="#2563eb"
                      initial={{ height: 0, y: 180 }}
                      animate={{ height: applicationHeight, y: 180 - applicationHeight }}
                    />
                    <motion.rect
                      x={x + Math.min(27, groupWidth / 2.5)}
                      y={180 - selectionHeight}
                      width={Math.min(22, groupWidth / 3)}
                      height={selectionHeight}
                      rx="5"
                      fill="#059669"
                      initial={{ height: 0, y: 180 }}
                      animate={{ height: selectionHeight, y: 180 - selectionHeight }}
                    />
                    <text x={x + 18} y="205" textAnchor="middle" fill="#64748b" fontSize="11">
                      {item.month.slice(5)}
                    </text>
                  </g>
                );
              })}
              <text x="8" y="22" fill="#94a3b8" fontSize="11">
                {activityMax}
              </text>
              <text x="8" y="183" fill="#94a3b8" fontSize="11">
                0
              </text>
            </svg>
          ) : (
            <div className="mt-4 flex min-h-40 items-center justify-center rounded-xl bg-slate-50 text-xs text-slate-500">
              Monthly trends appear when students begin applying.
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-900">Branch outcomes</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Compare participation and selection across academic branches.
          </p>
          {branchOutcomes.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {branchOutcomes.map((item) => (
                <div key={item.branch} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-xs font-bold text-slate-700">{item.branch}</span>
                    <span className="text-[11px] text-slate-500">
                      {item.selections}/{item.applications} selected
                    </span>
                  </div>
                  <svg
                    viewBox="0 0 400 15"
                    className="mt-2 h-3.5 w-full"
                    role="img"
                    aria-label={`${item.branch} applications and selections`}
                  >
                    <rect width="400" height="15" rx="7" fill="#eff6ff" />
                    <rect
                      width={(item.applications / branchMax) * 400}
                      height="15"
                      rx="7"
                      fill="#93c5fd"
                    />
                    <motion.rect
                      width={(item.selections / branchMax) * 400}
                      height="15"
                      rx="7"
                      fill="#059669"
                      initial={{ width: 0 }}
                      animate={{ width: (item.selections / branchMax) * 400 }}
                    />
                  </svg>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 flex min-h-24 items-center justify-center rounded-xl bg-slate-50 text-xs text-slate-500">
              Branch comparisons appear after applications are recorded.
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:p-5 lg:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-blue-950">Operational attention</h3>
              <p className="mt-1 text-xs text-blue-700">
                Items that may need coordinator follow-up during the next seven days.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:min-w-80">
              <div className="rounded-xl bg-white px-4 py-3">
                <p className="text-xl font-bold text-blue-900">{stats.closingSoon ?? 0}</p>
                <p className="text-[11px] text-slate-500">Registrations closing</p>
              </div>
              <div className="rounded-xl bg-white px-4 py-3">
                <p className="text-xl font-bold text-amber-700">{stats.offersExpiring ?? 0}</p>
                <p className="text-[11px] text-slate-500">Offers expiring</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlacementNetwork({ canDecide }: { canDecide: boolean }) {
  const {
    data: raw,
    isLoading,
    mutate,
  } = useSwr<{ data?: IPlacementNetworkListing[] }>('placement/network');
  const { data: requestsRaw, mutate: mutateRequests } = useSwr<{
    data?: {
      incoming: Array<{
        _id: string;
        requesterOrganizationName: string;
        estimatedStudents: number;
        contactName: string;
        contactEmail: string;
        message?: string;
        status: string;
        listingId?: { companyName?: string; jobRole?: string };
      }>;
      outgoing: Array<{ _id: string; status: string }>;
    };
  }>('placement/network/requests');
  const listings = raw?.data ?? [];
  const incoming = requestsRaw?.data?.incoming ?? [];
  const { mutation, isLoading: submitting } = useMutation();

  const requestAccess = async (listing: IPlacementNetworkListing) => {
    const answer = await Swal.fire({
      title: `Request ${listing.companyName} drive`,
      html: `<div class="space-y-3 text-left"><label class="block text-xs font-semibold">Estimated eligible students<input id="network-students" type="number" min="1" max="10000" class="swal2-input !m-0 !mt-1 !w-full" /></label><label class="block text-xs font-semibold">Institution contact<input id="network-contact" class="swal2-input !m-0 !mt-1 !w-full" /></label><label class="block text-xs font-semibold">Contact email<input id="network-email" type="email" class="swal2-input !m-0 !mt-1 !w-full" /></label><label class="block text-xs font-semibold">Participation note<textarea id="network-message" class="swal2-textarea !m-0 !mt-1 !w-full" maxlength="1000"></textarea></label></div>`,
      showCancelButton: true,
      confirmButtonText: 'Send request',
      confirmButtonColor: '#0178D7',
      preConfirm: () => {
        const estimatedStudents = Number(
          (document.getElementById('network-students') as HTMLInputElement)?.value,
        );
        const contactName = (
          document.getElementById('network-contact') as HTMLInputElement
        )?.value.trim();
        const contactEmail = (
          document.getElementById('network-email') as HTMLInputElement
        )?.value.trim();
        const message = (
          document.getElementById('network-message') as HTMLTextAreaElement
        )?.value.trim();
        if (!estimatedStudents || !contactName || !contactEmail) {
          Swal.showValidationMessage('Student estimate, contact and email are required');
          return false;
        }
        return { estimatedStudents, contactName, contactEmail, message };
      },
    });
    if (!answer.isConfirmed || !answer.value) return;
    const result = await mutation(`placement/network/${listing._id}/requests`, {
      method: 'POST',
      body: answer.value,
      isAlert: true,
    });
    if (result) {
      toast.success('Participation request sent');
      mutate();
      mutateRequests();
    }
  };

  const decide = async (requestId: string, decision: 'approve' | 'reject') => {
    const answer = await Swal.fire({
      title:
        decision === 'approve' ? 'Approve institution request?' : 'Reject institution request?',
      input: 'textarea',
      inputLabel: 'Decision note (optional)',
      showCancelButton: true,
      confirmButtonText: decision === 'approve' ? 'Approve request' : 'Reject request',
      confirmButtonColor: decision === 'approve' ? '#059669' : '#e11d48',
    });
    if (!answer.isConfirmed) return;
    const result = await mutation(`placement/network/requests/${requestId}`, {
      method: 'PATCH',
      body: { decision, decisionNote: answer.value },
      isAlert: true,
    });
    if (result) {
      toast.success(`Request ${decision === 'approve' ? 'approved' : 'rejected'}`);
      mutateRequests();
      mutate();
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700">
            <Globe2 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-blue-950">Institution placement network</h2>
            <p className="mt-1 max-w-4xl text-xs leading-5 text-blue-700">
              Discover drives that other institutions intentionally shared. Sending a request does
              not register students automatically—the host institution reviews capacity and
              coordinates the approved participation securely.
            </p>
          </div>
        </div>
      </div>
      {canDecide && incoming.length > 0 && (
        <section>
          <h3 className="text-sm font-bold text-slate-900">Incoming participation requests</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Review institutions asking to participate in drives published by your campus.
          </p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {incoming.map((request) => (
              <div key={request._id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {request.requesterOrganizationName}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {request.listingId?.companyName ?? 'Placement drive'} ·{' '}
                      {request.listingId?.jobRole ?? 'Opportunity'}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-700">
                    {request.status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <p className="text-slate-500">Estimated students</p>
                    <p className="mt-0.5 font-bold text-slate-900">{request.estimatedStudents}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <p className="text-slate-500">Contact</p>
                    <p className="mt-0.5 truncate font-bold text-slate-900">
                      {request.contactName}
                    </p>
                  </div>
                </div>
                {request.message && (
                  <p className="mt-3 text-xs leading-5 text-slate-600">{request.message}</p>
                )}
                {request.status === 'pending' && (
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => decide(request._id, 'reject')}
                      className="rounded-lg px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
                    >
                      Reject
                    </button>
                    <CustomButton
                      variant="primary"
                      onClick={() => decide(request._id, 'approve')}
                      className="w-fit! text-xs!"
                    >
                      Approve
                    </CustomButton>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      <section>
        <h3 className="text-sm font-bold text-slate-900">Shared placement opportunities</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Only explicitly published opportunity details are visible across institutions.
        </p>
        {isLoading ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-52 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : listings.length ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {listings.map((listing) => (
              <motion.article
                key={listing._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <Building2 className="h-5 w-5" />
                  </span>
                  {listing.request && (
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${listing.request.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : listing.request.status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}
                    >
                      {listing.request.status}
                    </span>
                  )}
                </div>
                <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-primary">
                  {listing.ownerOrganizationName}
                </p>
                <h4 className="mt-1 text-sm font-bold text-slate-900">{listing.companyName}</h4>
                <p className="text-xs text-slate-500">{listing.jobRole}</p>
                <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                  <p className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    {fmtDate(listing.driveDate)}
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" />
                    {listing.venue}
                  </p>
                  <p className="font-bold text-emerald-700">
                    {listing.package}
                    {listing.packageMax && listing.packageMax !== listing.package
                      ? `–${listing.packageMax}`
                      : ''}{' '}
                    LPA
                  </p>
                </div>
                {listing.participationNote && (
                  <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">
                    {listing.participationNote}
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-[11px] text-slate-500">
                    Closes {fmtDate(listing.registrationEnd)}
                  </span>
                  {!listing.isOwnedByCurrentTenant && !listing.request && (
                    <CustomButton
                      variant="primary"
                      startIcon={<Send className="h-3.5 w-3.5" />}
                      loading={submitting}
                      onClick={() => requestAccess(listing)}
                      className="w-fit! text-xs!"
                    >
                      Request to join
                    </CustomButton>
                  )}
                  {listing.isOwnedByCurrentTenant && (
                    <span className="text-xs font-bold text-blue-700">
                      Published by your institution
                    </span>
                  )}
                </div>
              </motion.article>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center">
            <Globe2 className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-800">No shared drives available</p>
            <p className="mt-1 text-xs text-slate-500">
              Institutions can publish eligible upcoming drives from the Placement Drives tab.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Applications Drawer ───────────────────────────────────────────────────────
function ApplicationsDrawer({ drive, onClose }: { drive: IPlacementDrive; onClose: () => void }) {
  const { data: raw, isLoading, mutate } = useSwr(`placement/${drive._id}/applications`);
  const apps: IApplication[] = (raw as { data?: IApplication[] })?.data ?? [];
  const { data: countsRaw } = useSwr<{ data?: Record<string, number> }>(
    `placement/${drive._id}/applications/counts`,
  );
  const counts = countsRaw?.data ?? {};
  const { mutation } = useMutation();

  const handleShortlist = async (app: IApplication) => {
    const studentId = typeof app.studentId === 'string' ? app.studentId : (app.studentId._id ?? '');
    const res = await mutation(`placement/${drive._id}/shortlist`, {
      method: 'PUT',
      body: { studentIds: [studentId] },
      isAlert: true,
    });
    if (res) mutate();
  };

  const handleRound = async (app: IApplication) => {
    const nextRound = app.currentRound + 1;
    const configured = drive.rounds.find((round) => round.roundNo === nextRound);
    if (!configured) return;
    const answer = await Swal.fire({
      title: `${configured.roundName} result`,
      text: app.studentName,
      input: 'select',
      inputOptions: { pass: 'Passed', fail: 'Not selected', absent: 'Absent' },
      inputPlaceholder: 'Choose result',
      showCancelButton: true,
      confirmButtonText: 'Save result',
      inputValidator: (value) => (!value ? 'Choose a result' : undefined),
    });
    if (!answer.isConfirmed) return;
    const res = await mutation(`placement/${drive._id}/rounds`, {
      method: 'POST',
      body: {
        roundNo: configured.roundNo,
        roundName: configured.roundName,
        results: [{ applicationId: app._id, status: answer.value }],
      },
      isAlert: true,
    });
    if (res) mutate();
  };

  const handleSelect = async (app: IApplication) => {
    const res = await mutation(`placement/${drive._id}/select`, {
      method: 'PUT',
      body: { applicationIds: [app._id] },
      isAlert: true,
    });
    if (res) mutate();
  };

  const handleOffer = async (app: IApplication) => {
    const r = await Swal.fire({
      title: `Issue offer to ${app.studentName}`,
      html: `<div class="space-y-3 text-left">
        <label class="block text-xs font-semibold">Offered role<input id="offer-role" class="swal2-input !m-0 !mt-1 !w-full" value="${drive.jobRole.replaceAll('"', '&quot;')}"></label>
        <label class="block text-xs font-semibold">Package (LPA)<input id="offer-package" type="number" min="${drive.package}" max="${drive.packageMax ?? drive.package}" step="0.01" class="swal2-input !m-0 !mt-1 !w-full" value="${drive.package}"></label>
        <label class="block text-xs font-semibold">Response deadline<input id="offer-expiry" type="date" class="swal2-input !m-0 !mt-1 !w-full"></label>
        <label class="block text-xs font-semibold">Joining date<input id="joining-date" type="date" class="swal2-input !m-0 !mt-1 !w-full"></label>
        <label class="block text-xs font-semibold">Company offer letter (PDF)<input id="offer-file" type="file" accept=".pdf,image/jpeg,image/png" class="swal2-file !m-0 !mt-1 !w-full"></label>
      </div>`,
      showCancelButton: true,
      confirmButtonText: 'Issue offer',
      confirmButtonColor: '#0178D7',
      preConfirm: () => {
        const role = (document.getElementById('offer-role') as HTMLInputElement)?.value.trim();
        const offeredPackage = (document.getElementById('offer-package') as HTMLInputElement)
          ?.value;
        const offerExpiresAt = (document.getElementById('offer-expiry') as HTMLInputElement)?.value;
        const joiningDate = (document.getElementById('joining-date') as HTMLInputElement)?.value;
        const file = (document.getElementById('offer-file') as HTMLInputElement)?.files?.[0];
        if (!role || !offeredPackage || !offerExpiresAt || !file) {
          Swal.showValidationMessage('Role, package, deadline and offer letter are required');
          return false;
        }
        return { role, offeredPackage, offerExpiresAt, joiningDate, file };
      },
    });
    if (!r.isConfirmed || !r.value) return;
    const form = new FormData();
    form.append('offeredRole', r.value.role);
    form.append('offeredPackage', r.value.offeredPackage);
    form.append('offerExpiresAt', r.value.offerExpiresAt);
    if (r.value.joiningDate) form.append('joiningDate', r.value.joiningDate);
    form.append('offerLetter', r.value.file);
    const res = await mutation(`placement/applications/${app._id}/offer`, {
      method: 'POST',
      body: form,
      isFormData: true,
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Offer issued');
      mutate();
    } else toast.error('Failed');
  };

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
            <h2 className="text-sm font-bold">
              {drive.companyName} — {drive.jobRole}
            </h2>
            <p className="text-xs text-slate-600">{apps.length} applications</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-600 hover:text-slate-600 text-xl"
          >
            ✕
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
          {(
            [
              { key: 'registered', label: 'Registered', cls: 'text-slate-700' },
              { key: 'shortlisted', label: 'Shortlisted', cls: 'text-amber-600' },
              { key: 'selected', label: 'Selected', cls: 'text-green-600' },
              { key: 'rejected', label: 'Rejected', cls: 'text-red-500' },
            ] as const
          ).map((s) => (
            <div key={s.key} className="text-center">
              <p className={`text-base font-bold ${s.cls}`}>{counts[s.key] ?? 0}</p>
              <p className="text-[10px] text-slate-600">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="p-4 space-y-2">
          {isLoading
            ? [1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-50" />
              ))
            : apps.map((a) => {
                const c = APP_STATUS_CFG[a.status] ?? APP_STATUS_CFG.registered;
                return (
                  <div
                    key={a._id}
                    className="flex items-center justify-between rounded-xl bg-slate-50 p-3 gap-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{a.studentName ?? '—'}</p>
                      <p className="text-xs text-slate-600">
                        {a.rollNumber} · {a.branch} · CGPA {a.cgpaAtTimeOfApplication}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}
                      >
                        {c.label}
                      </span>
                      {a.status === 'registered' && (
                        <button
                          type="button"
                          onClick={() => handleShortlist(a)}
                          title="Shortlist for first round"
                          className="text-amber-500 hover:text-amber-600"
                        >
                          <BadgeCheck className="h-4 w-4" />
                        </button>
                      )}
                      {a.status === 'shortlisted' && (
                        <button
                          type="button"
                          onClick={() => handleRound(a)}
                          title={`Record ${drive.rounds[0]?.roundName ?? 'round'} result`}
                          className="text-violet-600"
                        >
                          <FileSpreadsheet className="h-4 w-4" />
                        </button>
                      )}
                      {a.status === 'round_ongoing' && a.currentRound < drive.rounds.length && (
                        <button
                          type="button"
                          onClick={() => handleRound(a)}
                          title="Record next round result"
                          className="text-violet-600"
                        >
                          <FileSpreadsheet className="h-4 w-4" />
                        </button>
                      )}
                      {a.status === 'round_ongoing' &&
                        a.currentRound === drive.rounds.length &&
                        a.roundResults.at(-1)?.status === 'pass' && (
                          <button
                            type="button"
                            onClick={() => handleSelect(a)}
                            title="Confirm final selection"
                            className="text-green-600"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                      {a.status === 'selected' && (
                        <button
                          type="button"
                          onClick={() => handleOffer(a)}
                          title="Issue Offer"
                          className="text-primary hover:text-primary/80"
                        >
                          <Briefcase className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          {!isLoading && !apps.length && (
            <p className="text-center text-sm text-slate-600 py-8">No applications yet</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PlacementPage() {
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const canView = useHasPermission('placement', 'view');
  const canCreate = useHasPermission('placement', 'create');
  const canEdit = useHasPermission('placement', 'edit');
  const canApprove = useHasPermission('placement', 'approve');
  const canExport = useHasPermission('placement', 'export');
  const isStudent = activeRole === 'student';
  const isCoord = !isStudent;
  const canCreateDrive = isCoord && canCreate;
  const canRegister = isStudent && canCreate;

  const [showCreate, setShowCreate] = useState(false);
  const [editDrive, setEditDrive] = useState<IPlacementDrive | null>(null);
  const [viewApps, setViewApps] = useState<IPlacementDrive | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<
    'overview' | 'drives' | 'network' | 'profile' | 'applications' | 'profiles'
  >('overview');

  const { data: raw, error, isLoading, mutate } = useSwr(canView ? 'placement' : null);
  const { data: statsRaw } = useSwr<{ data?: IPlacementStats }>(
    canView && isCoord ? 'placement/stats' : null,
  );
  const stats = statsRaw?.data ?? {};
  const { mutation } = useMutation();
  const records: IPlacementDrive[] = (raw as { data?: IPlacementDrive[] })?.data ?? [];
  const filtered = records.filter((record) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      [record.companyName, record.jobRole, record.venue, record.academicYear].some((value) =>
        value?.toLowerCase().includes(query),
      );
    return (
      matchesSearch &&
      (!filterStatus || record.status === filterStatus) &&
      (!filterYear || record.academicYear === filterYear)
    );
  });
  const viewTabs = isCoord
    ? [
        {
          id: 'overview' as const,
          label: 'Overview',
          detail: 'Analytics and outcomes',
          icon: LayoutDashboard,
        },
        {
          id: 'drives' as const,
          label: 'Placement drives',
          detail: 'Opportunities and outcomes',
          icon: Briefcase,
        },
        {
          id: 'profiles' as const,
          label: 'Student readiness',
          detail: 'Profiles and eligibility',
          icon: UserRoundSearch,
        },
        {
          id: 'network' as const,
          label: 'Placement network',
          detail: 'Shared institution drives',
          icon: Globe2,
        },
      ]
    : [
        {
          id: 'overview' as const,
          label: 'Overview',
          detail: 'Opportunities at a glance',
          icon: LayoutDashboard,
        },
        {
          id: 'drives' as const,
          label: 'Opportunities',
          detail: 'Eligible placement drives',
          icon: Briefcase,
        },
        {
          id: 'profile' as const,
          label: 'My profile',
          detail: 'Resume and readiness',
          icon: User,
        },
        {
          id: 'applications' as const,
          label: 'My applications',
          detail: 'Rounds, offers and status',
          icon: Target,
        },
      ];

  const handleRegister = async (drive: IPlacementDrive) => {
    const r = await Swal.fire({
      title: `Register for ${drive.companyName}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Register',
      confirmButtonColor: '#0178D7',
    });
    if (!r.isConfirmed) return;
    const res = await mutation(`placement/${drive._id}/register`, {
      method: 'POST',
      body: {},
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Registered!');
      mutate();
    } else toast.error('Failed');
  };

  const handlePublish = async (drive: IPlacementDrive) => {
    const answer = await Swal.fire({
      title: `Publish ${drive.companyName} to the network?`,
      html: `<div class="space-y-3 text-left"><p class="rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-800">Only opportunity, schedule and eligibility details are shared. Student and application data remain private.</p><label class="block text-xs font-semibold">Available external seats (optional)<input id="network-seats" type="number" min="1" max="10000" class="swal2-input !m-0 !mt-1 !w-full" /></label><label class="block text-xs font-semibold">Participation guidance<textarea id="network-note" maxlength="1000" class="swal2-textarea !m-0 !mt-1 !w-full" placeholder="Travel, reporting or coordination instructions"></textarea></label></div>`,
      showCancelButton: true,
      confirmButtonText: 'Publish drive',
      confirmButtonColor: '#0178D7',
      preConfirm: () => {
        const seats = Number((document.getElementById('network-seats') as HTMLInputElement)?.value);
        const participationNote = (
          document.getElementById('network-note') as HTMLTextAreaElement
        )?.value.trim();
        return { availableSeats: seats || undefined, participationNote };
      },
    });
    if (!answer.isConfirmed || !answer.value) return;
    const result = await mutation(`placement/${drive._id}/network/publish`, {
      method: 'POST',
      body: answer.value,
      isAlert: true,
    });
    if (result) toast.success('Drive published to the institution network');
  };

  const columns: Column<IPlacementDrive>[] = [
    {
      field: 'companyName',
      title: 'Company',
      render: (r) => (
        <div>
          <p className="text-sm font-bold">{r.companyName}</p>
          <p className="text-xs text-primary">{r.jobRole}</p>
        </div>
      ),
    },
    {
      field: 'package',
      title: 'Package',
      render: (r) => <span className="text-sm font-bold text-green-600">{r.package} LPA</span>,
    },
    {
      field: 'venue',
      title: 'Venue',
      render: (r) => <span className="text-sm">{r.venue}</span>,
    },
    {
      field: 'driveDate',
      title: 'Drive Date',
      render: (r) => <span className="text-xs">{fmtDate(r.driveDate)}</span>,
    },
    {
      field: 'registeredCount',
      title: 'Applied',
      render: (r) => <span className="text-sm font-medium">{r.registeredCount ?? 0}</span>,
    },
    {
      field: 'status',
      title: 'Status',
      render: (r) => {
        const c = DRIVE_STATUS_CFG[r.status] ?? DRIVE_STATUS_CFG.upcoming;
        return (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
            {c.label}
          </span>
        );
      },
    },
  ];

  const actions: Action<IPlacementDrive>[] = [
    ...(canApprove
      ? ([
          {
            tooltip: 'View Applications',
            icon: <Eye className="h-4 w-4 text-primary" />,
            onClick: (r: IPlacementDrive) => setViewApps(r),
          },
        ] as Action<IPlacementDrive>[])
      : []),
    ...(canEdit
      ? ([
          {
            tooltip: 'Edit Drive',
            icon: <FileSpreadsheet className="h-4 w-4 text-amber-600" />,
            onClick: (r: IPlacementDrive) => setEditDrive(r),
          },
        ] as Action<IPlacementDrive>[])
      : []),
    ...(canApprove
      ? ([
          {
            tooltip: 'Publish to placement network',
            icon: <Globe2 className="h-4 w-4 text-blue-700" />,
            onClick: (r: IPlacementDrive) => handlePublish(r),
          },
        ] as Action<IPlacementDrive>[])
      : []),
  ];

  if (!canView) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Placement access unavailable</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your active role cannot view placement opportunities.
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">
          Placement drives could not be loaded
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Placement management</h1>
        <p className="mt-1 max-w-4xl text-sm text-slate-500">
          Manage student readiness, employer drives, selection rounds, offers and collaborative
          opportunities across participating institutions.
        </p>
      </div>
      <div
        role="tablist"
        aria-label="Placement workspace"
        className="flex w-fit max-w-full gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2"
      >
        {viewTabs.map(({ id, label, detail, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors ${view === id ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${view === id ? 'bg-white/15' : 'bg-slate-100'}`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-xs font-bold">{label}</span>
              <span className={`text-[10px] ${view === id ? 'text-white/75' : 'text-slate-400'}`}>
                {detail}
              </span>
            </span>
          </button>
        ))}
      </div>

      {view === 'overview' && (
        <PlacementAnalytics records={records} stats={stats} loading={isLoading} />
      )}
      {isCoord && view === 'network' && <PlacementNetwork canDecide={canApprove} />}

      {view === 'drives' && (
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_180px_240px_auto_auto] xl:items-center">
          <div className="relative min-w-0">
            <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search company, role, venue or placement session"
              className="h-[42px] w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-500 hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filter by placement status"
            className="h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/10"
          >
            <option value="">All statuses</option>
            <option value="upcoming">Upcoming</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <AsyncSelect
            type="academicYears"
            value={filterYear || null}
            onChange={(value) => setFilterYear(value ?? '')}
            placeholder="All placement sessions"
            emptyMessage="No configured academic years are available."
            className="w-full"
          />
          {(search || filterStatus || filterYear) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setFilterStatus('');
                setFilterYear('');
              }}
              className="inline-flex h-[42px] items-center justify-center whitespace-nowrap rounded-lg px-3 text-xs font-bold text-primary transition-colors hover:bg-primary/5"
            >
              Clear filters
            </button>
          )}
          {canCreateDrive && (
            <CustomButton
              variant="primary"
              startIcon={<Plus className="h-4 w-4" />}
              onClick={() => setShowCreate(true)}
              className="w-fit! shrink-0"
            >
              Create Drive
            </CustomButton>
          )}
        </div>
      )}

      {!isCoord && view === 'profile' && <MyPlacementProfile />}
      {!isCoord && view === 'applications' && <MyApplications />}
      {isCoord && view === 'profiles' && <PlacementProfilesTab />}

      {((isCoord && view === 'drives') || (!isCoord && view === 'drives')) && (
        <>
          {isCoord ? (
            <DataViewSwitcher<IPlacementDrive>
              data={filtered}
              isLoading={isLoading}
              storageKey="placement-drives.view"
              searchPlaceholder="Search drives…"
              searchFields={['companyName', 'jobRole', 'venue', 'status']}
              renderCard={(d) => {
                const statusStyle =
                  d.status === 'completed'
                    ? 'bg-green-50 text-green-600'
                    : d.status === 'ongoing'
                      ? 'bg-blue-50 text-blue-600'
                      : d.status === 'cancelled'
                        ? 'bg-red-50 text-red-500'
                        : 'bg-amber-50 text-amber-600';
                return (
                  <motion.div
                    whileHover={{ y: -2 }}
                    className="flex flex-col gap-3 rounded-2xl bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
                        <Briefcase className="h-5 w-5" />
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${statusStyle}`}
                      >
                        {d.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{d.companyName}</p>
                      <p className="text-xs text-slate-500">{d.jobRole}</p>
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-500">
                      {d.venue && (
                        <p className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 text-slate-600" />
                          <span className="truncate">{d.venue}</span>
                        </p>
                      )}
                      {d.driveDate && (
                        <p className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3 text-slate-600" />
                          <span>
                            {new Date(d.driveDate).toLocaleDateString('en-IN', {
                              dateStyle: 'medium',
                            })}
                          </span>
                        </p>
                      )}
                      {d.package > 0 && (
                        <p className="flex items-center gap-1.5">
                          <BadgeCheck className="h-3 w-3 text-amber-500" />
                          <span>{d.package} LPA</span>
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                        <p className="text-[10px] uppercase text-slate-600">Registered</p>
                        <p className="font-bold text-slate-800">{d.registeredCount ?? 0}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                        <p className="text-[10px] uppercase text-slate-600">Selected</p>
                        <p className="font-bold text-slate-800">{d.selectedCount ?? 0}</p>
                      </div>
                    </div>
                    {(canApprove || canEdit) && (
                      <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => setEditDrive(d)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline"
                          >
                            <FileSpreadsheet className="h-3 w-3" /> Edit
                          </button>
                        )}
                        {canApprove && (
                          <>
                            <button
                              type="button"
                              onClick={() => handlePublish(d)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                            >
                              <Globe2 className="h-3 w-3" /> Publish
                            </button>
                            <button
                              type="button"
                              onClick={() => setViewApps(d)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                              <Eye className="h-3 w-3" /> Applicants
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              }}
              table={
                <CustomTable
                  key="placement-drives-register"
                  title="Placement drive register"
                  description="Employer opportunities, eligibility, schedule, applications and selection outcomes."
                  data={filtered}
                  columns={columns}
                  actions={actions}
                  isLoading={isLoading}
                  onRefresh={() => void mutate()}
                  options={{
                    search: true,
                    refresh: true,
                    export: canExport,
                    pagination: true,
                    pageSize: 12,
                    responsive: true,
                  }}
                  localization={{ toolbar: { searchPlaceholder: 'Search drives…' } }}
                />
              }
            />
          ) : isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-44 animate-pulse rounded-2xl bg-white" />
              ))}
            </div>
          ) : filtered.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {filtered.map((d) => (
                <DriveCard
                  key={d._id}
                  drive={d}
                  canRegister={canRegister}
                  onRegister={() => handleRegister(d)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-white">
              <Empty
                title="No placement drives found"
                subTitle={
                  canCreateDrive
                    ? 'Create a governed drive with eligibility rules and ordered selection rounds.'
                    : 'New eligible placement opportunities will appear here.'
                }
                pathName={canCreateDrive ? 'Create first drive' : undefined}
                onClick={canCreateDrive ? () => setShowCreate(true) : undefined}
              />
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {showCreate && (
          <CreateDriveModal
            onClose={() => setShowCreate(false)}
            onSaved={() => {
              mutate();
              setShowCreate(false);
            }}
          />
        )}
        {editDrive && (
          <CreateDriveModal
            drive={editDrive}
            onClose={() => setEditDrive(null)}
            onSaved={() => {
              mutate();
              setEditDrive(null);
            }}
          />
        )}
        {viewApps && <ApplicationsDrawer drive={viewApps} onClose={() => setViewApps(null)} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Student: My Placement Profile ────────────────────────────────────────────────────────
interface IPlacementProfile {
  _id?: string;
  resumeUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  personalEmail?: string;
  cgpa?: number;
  activeBacklogs?: number;
  eligibilityStatus?: string;
  isEligibleForPlacement?: boolean;
  skills?: { name: string; proficiency: string }[];
  trainingSessionsAttended?: number;
  mockInterviewsGiven?: number;
  lastMockScore?: number;
}

function MyPlacementProfile() {
  const {
    data: raw,
    isLoading,
    mutate,
  } = useSwr<{ data?: IPlacementProfile | null }>('placement/profiles/me');
  const profile = raw?.data ?? null;
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
  const learningCredentials = credentialsRaw?.data ?? [];
  const { mutation, isLoading: saving } = useMutation();
  const [uploading, setUploading] = useState(false);
  const [skillName, setSkillName] = useState('');
  const [skillProficiency, setSkillProficiency] = useState<
    'beginner' | 'intermediate' | 'advanced' | 'expert'
  >('beginner');

  const formik = useFormik<IPlacementProfile>({
    enableReinitialize: true,
    initialValues: {
      linkedinUrl: profile?.linkedinUrl ?? '',
      githubUrl: profile?.githubUrl ?? '',
      portfolioUrl: profile?.portfolioUrl ?? '',
      personalEmail: profile?.personalEmail ?? '',
      skills: profile?.skills ?? [],
    },
    validationSchema: Yup.object({
      personalEmail: Yup.string().email('Enter a valid email address').max(254),
      linkedinUrl: Yup.string()
        .url('Enter a complete HTTPS URL')
        .matches(/^https:\/\//i, 'Use a secure HTTPS URL')
        .max(500),
      githubUrl: Yup.string()
        .url('Enter a complete HTTPS URL')
        .matches(/^https:\/\//i, 'Use a secure HTTPS URL')
        .max(500),
      portfolioUrl: Yup.string()
        .url('Enter a complete HTTPS URL')
        .matches(/^https:\/\//i, 'Use a secure HTTPS URL')
        .max(500),
      skills: Yup.array()
        .of(
          Yup.object({
            name: Yup.string().trim().min(2).max(80).required(),
            proficiency: Yup.string()
              .oneOf(['beginner', 'intermediate', 'advanced', 'expert'])
              .required(),
          }),
        )
        .max(50),
    }),
    onSubmit: async (values) => {
      const path = profile ? 'placement/profiles/me' : 'placement/profiles';
      const method = (profile ? 'PUT' : 'POST') as 'PUT' | 'POST';
      const res = await mutation(path, { method, body: values, isAlert: true });
      if ((res as { data?: { success?: boolean } })?.data?.success !== false) {
        toast.success('Profile saved');
        mutate();
      } else toast.error('Save failed');
    },
  });

  const addSkill = () => {
    const name = skillName.trim();
    if (name.length < 2) {
      toast.error('Enter a skill name');
      return;
    }
    if (
      (formik.values.skills ?? []).some((skill) => skill.name.toLowerCase() === name.toLowerCase())
    ) {
      toast.error('This skill is already in your profile');
      return;
    }
    formik.setFieldValue('skills', [
      ...(formik.values.skills ?? []),
      { name, proficiency: skillProficiency },
    ]);
    setSkillName('');
  };

  const handleResume = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append('resume', file);
    try {
      const r = await mutation('placement/profiles/me/resume', {
        method: 'POST',
        body: fd,
        isFormData: true,
      });
      const j = (
        r as
          | { results?: { success?: boolean; data?: { success?: boolean }; message?: string } }
          | undefined
      )?.results;
      if (r && j?.data?.success !== false) {
        toast.success('Resume uploaded');
        mutate();
      } else if (r) toast.error(j?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-white" />;
  }

  return (
    <div className="space-y-4">
      {profile && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-white p-5"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Placement Profile</p>
              <p className="text-xs text-slate-500">
                Eligibility:{' '}
                <span
                  className={
                    profile.isEligibleForPlacement
                      ? 'font-semibold text-green-600'
                      : 'font-semibold text-red-500'
                  }
                >
                  {profile.eligibilityStatus ?? '—'}
                </span>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-2.5">
              <p className="text-slate-600">CGPA</p>
              <p className="text-base font-semibold text-slate-800">{profile.cgpa ?? '—'}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5">
              <p className="text-slate-600">Active Backlogs</p>
              <p className="text-base font-semibold text-slate-800">
                {profile.activeBacklogs ?? 0}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5">
              <p className="text-slate-600">Trainings</p>
              <p className="text-base font-semibold text-slate-800">
                {profile.trainingSessionsAttended ?? 0}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5">
              <p className="text-slate-600">Mocks</p>
              <p className="text-base font-semibold text-slate-800">
                {profile.mockInterviewsGiven ?? 0}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-white p-5"
      >
        <p className="mb-3 text-sm font-semibold text-slate-800">Resume</p>
        <div className="flex flex-wrap items-center gap-3">
          {profile?.resumeUrl ? (
            <a
              href={profile.resumeUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-2 text-xs font-medium text-primary hover:bg-primary-100"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> View Current Resume
            </a>
          ) : (
            <span className="text-xs text-slate-600">No resume uploaded yet</span>
          )}
          <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200">
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'Uploading…' : profile?.resumeUrl ? 'Replace' : 'Upload Resume'}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleResume(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-white p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Verified learning credentials</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Provider certificates and badges available for placement evidence.
            </p>
          </div>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
            {learningCredentials.length}
          </span>
        </div>
        {learningCredentials.length ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {learningCredentials.map((credential) => (
              <div
                key={credential._id}
                className="flex items-start gap-3 rounded-xl border border-slate-100 p-3"
              >
                <span className="rounded-lg bg-amber-100 p-2 text-amber-700">
                  <Award className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {credential.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {credential.courseId?.title ?? 'External course'} · {credential.type}
                  </p>
                  {credential.verificationUrl && (
                    <a
                      href={credential.verificationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs font-semibold text-primary hover:underline"
                    >
                      Verify
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-slate-50 px-4 py-5 text-center text-xs text-slate-500">
            Completed and verified LMS credentials will appear automatically.
          </p>
        )}
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={formik.handleSubmit}
        className="space-y-4 rounded-2xl bg-white p-5"
      >
        <div>
          <p className="text-sm font-semibold text-slate-800">Skills & readiness evidence</p>
          <p className="mt-1 text-xs text-slate-500">
            Add verified skills with an honest proficiency level so coordinators can guide you.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_180px_auto]">
            <input
              className={inputCls}
              value={skillName}
              onChange={(event) => setSkillName(event.target.value)}
              placeholder="Example: Java, accounting, CAD"
              maxLength={80}
            />
            <select
              className={inputCls}
              value={skillProficiency}
              onChange={(event) =>
                setSkillProficiency(event.target.value as typeof skillProficiency)
              }
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
            <CustomButton type="button" variant="tertiary" onClick={addSkill}>
              Add skill
            </CustomButton>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(formik.values.skills ?? []).map((skill) => (
              <span
                key={skill.name.toLowerCase()}
                className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary"
              >
                {skill.name} · {skill.proficiency}
                <button
                  type="button"
                  aria-label={`Remove ${skill.name}`}
                  onClick={() =>
                    formik.setFieldValue(
                      'skills',
                      (formik.values.skills ?? []).filter((item) => item !== skill),
                    )
                  }
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
            {!(formik.values.skills ?? []).length && (
              <span className="text-xs text-slate-600">No skills added yet.</span>
            )}
          </div>
        </div>
        <p className="border-t border-slate-100 pt-4 text-sm font-semibold text-slate-800">
          Contact & Links
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Personal Email</label>
            <input className={inputCls} type="email" {...formik.getFieldProps('personalEmail')} />
            {formik.touched.personalEmail && formik.errors.personalEmail && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.personalEmail}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>LinkedIn</label>
            <input className={inputCls} {...formik.getFieldProps('linkedinUrl')} />
            {formik.touched.linkedinUrl && formik.errors.linkedinUrl && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.linkedinUrl}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>GitHub</label>
            <input className={inputCls} {...formik.getFieldProps('githubUrl')} />
            {formik.touched.githubUrl && formik.errors.githubUrl && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.githubUrl}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Portfolio</label>
            <input className={inputCls} {...formik.getFieldProps('portfolioUrl')} />
            {formik.touched.portfolioUrl && formik.errors.portfolioUrl && (
              <p className="mt-1 text-xs text-red-500">{formik.errors.portfolioUrl}</p>
            )}
          </div>
        </div>
        <div className="flex justify-end">
          <CustomButton type="submit" loading={saving} className="w-fit!">
            {profile ? 'Save' : 'Create Profile'}
          </CustomButton>
        </div>
      </motion.form>
    </div>
  );
}

// ─── Student: My Applications ───────────────────────────────────────────────────────────
function MyApplications() {
  interface IMyApp {
    _id: string;
    driveId?: { _id: string; companyName: string; jobRole: string; status: string };
    status: keyof typeof APP_STATUS_CFG;
    registeredAt?: string;
    offeredPackage?: number;
    offeredRole?: string;
    offerLetterUrl?: string;
    offerExpiresAt?: string;
  }
  const { data, isLoading, mutate } = useSwr<{ data?: IMyApp[] }>('placement/my/applications');
  const apps = data?.data ?? [];
  const { mutation } = useMutation();

  const respond = async (application: IMyApp, response: 'accept' | 'decline') => {
    let reason = '';
    if (response === 'decline') {
      const answer = await Swal.fire({
        title: 'Decline this offer?',
        input: 'textarea',
        inputLabel: 'Reason',
        inputPlaceholder: 'Briefly explain your decision',
        showCancelButton: true,
        inputValidator: (value) => (value.trim().length < 3 ? 'A reason is required' : undefined),
      });
      if (!answer.isConfirmed) return;
      reason = answer.value;
    } else {
      const answer = await Swal.fire({
        title: 'Accept this placement offer?',
        text: 'Your verified placement outcome will be updated.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Accept offer',
      });
      if (!answer.isConfirmed) return;
    }
    const result = await mutation(`placement/applications/${application._id}/respond`, {
      method: 'PUT',
      body: { response, reason },
      isAlert: true,
    });
    if (result) mutate();
  };

  if (isLoading)
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-white" />
        ))}
      </div>
    );
  if (apps.length === 0)
    return (
      <div className="rounded-2xl bg-white">
        <Empty
          title="No placement applications yet"
          subTitle="Register for an eligible drive to start tracking your selection journey."
        />
      </div>
    );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {apps.map((a) => {
        const c = APP_STATUS_CFG[a.status] ?? APP_STATUS_CFG.registered;
        return (
          <motion.div
            key={a._id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-white p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {a.driveId?.companyName ?? 'Unknown Company'}
                </p>
                <p className="text-xs text-primary">{a.offeredRole ?? a.driveId?.jobRole ?? '—'}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
                {c.label}
              </span>
            </div>
            {a.registeredAt && (
              <p className="mt-2 text-[11px] text-slate-600">
                Registered: {fmtDate(a.registeredAt)}
              </p>
            )}
            {a.status === 'offered' && (
              <div className="mt-3 rounded-lg bg-primary/5 p-3">
                <p className="text-sm font-semibold text-slate-800">
                  {a.offeredPackage} LPA · respond by {fmtDate(a.offerExpiresAt)}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  {a.offerLetterUrl && (
                    <a
                      href={a.offerLetterUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-primary"
                    >
                      View offer letter
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => respond(a, 'accept')}
                    className="text-xs font-semibold text-green-600"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => respond(a, 'decline')}
                    className="text-xs font-semibold text-red-500"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Coordinator: Placement Profiles Tab ───────────────────────────────────────
interface IProfileListItem {
  [key: string]: unknown;
  _id: string;
  studentId?: string;
  studentName?: string;
  rollNo?: string;
  cgpa?: number;
  activeBacklogs?: number;
  isEligibleForPlacement?: boolean;
  eligibilityStatus?: string;
  resumeUrl?: string;
  branch?: string;
  semester?: number;
}

function PlacementProfilesTab() {
  const { data: listRaw, isLoading, mutate } = useSwr('placement/profiles/list?limit=100');
  const { data: statsRaw } = useSwr('placement/profiles/stats');
  const { mutation } = useMutation();
  const [detail, setDetail] = useState<IProfileListItem | null>(null);

  const profiles: IProfileListItem[] =
    ((listRaw as { data?: { data?: IProfileListItem[] } })?.data?.data as IProfileListItem[]) ??
    ((listRaw as { data?: IProfileListItem[] })?.data as IProfileListItem[]) ??
    [];
  const stats =
    ((statsRaw as { data?: Record<string, number> })?.data as Record<string, number>) ?? {};

  const handleRecalc = async (p: IProfileListItem) => {
    if (!p.studentId) return;
    const res = await mutation(`placement/profiles/${p.studentId}/eligibility`, {
      method: 'PUT',
      body: {},
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Eligibility recalculated');
      mutate();
    } else toast.error('Failed');
  };

  const columns: Column<IProfileListItem>[] = [
    {
      field: 'studentName',
      title: 'Student',
      render: (r) => (
        <div>
          <p className="text-sm font-medium">{r.studentName ?? '—'}</p>
          <p className="text-xs text-slate-600">{r.rollNo}</p>
        </div>
      ),
    },
    {
      field: 'branch',
      title: 'Branch',
      render: (r) => (
        <span className="text-xs text-slate-600">
          {r.branch ?? '—'} {r.semester ? `· Sem ${r.semester}` : ''}
        </span>
      ),
    },
    {
      field: 'cgpa',
      title: 'CGPA',
      render: (r) => <span className="text-sm font-medium">{r.cgpa ?? '—'}</span>,
    },
    {
      field: 'activeBacklogs',
      title: 'Backlogs',
      render: (r) => <span className="text-sm">{r.activeBacklogs ?? 0}</span>,
    },
    {
      field: 'isEligibleForPlacement',
      title: 'Eligibility',
      render: (r) => (
        <span
          className={
            'rounded-full px-2.5 py-0.5 text-xs font-medium ' +
            (r.isEligibleForPlacement ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500')
          }
        >
          {r.eligibilityStatus ?? (r.isEligibleForPlacement ? 'Eligible' : 'Ineligible')}
        </span>
      ),
    },
    {
      field: 'resumeUrl',
      title: 'Resume',
      render: (r) =>
        r.resumeUrl ? (
          <a
            href={r.resumeUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-primary hover:underline"
          >
            View
          </a>
        ) : (
          <span className="text-xs text-slate-600">—</span>
        ),
    },
  ];

  const actions: Action<IProfileListItem>[] = [
    {
      tooltip: 'View Details',
      icon: <Eye className="h-4 w-4 text-primary" />,
      onClick: (r) => setDetail(r),
    },
    {
      tooltip: 'Recalculate Eligibility',
      icon: <BadgeCheck className="h-4 w-4 text-amber-500" />,
      onClick: (r) => handleRecalc(r),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-white p-3 text-xs sm:grid-cols-4">
        <div>
          <p className="text-slate-600">Total Profiles</p>
          <p className="text-base font-semibold text-slate-800">{stats.total ?? profiles.length}</p>
        </div>
        <div>
          <p className="text-slate-600">Eligible</p>
          <p className="text-base font-semibold text-green-600">{stats.eligible ?? '—'}</p>
        </div>
        <div>
          <p className="text-slate-600">Ineligible</p>
          <p className="text-base font-semibold text-red-500">{stats.ineligible ?? '—'}</p>
        </div>
        <div>
          <p className="text-slate-600">Avg CGPA</p>
          <p className="text-base font-semibold text-slate-800">
            {stats.avgCgpa != null ? Number(stats.avgCgpa).toFixed(2) : '—'}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white">
        <CustomTable
          data={profiles}
          columns={columns}
          actions={actions}
          isLoading={isLoading}
          options={{ search: true, pagination: true, pageSize: 12 }}
          localization={{ toolbar: { searchPlaceholder: 'Search profiles…' } }}
        />
      </div>

      <AnimatePresence>
        {detail && (
          <ProfileDetailDrawer
            profileId={detail._id}
            onClose={() => setDetail(null)}
            onSaved={() => mutate()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Coordinator: Profile Detail Drawer ────────────────────────────────────────
function ProfileDetailDrawer({
  profileId,
  onClose,
  onSaved,
}: {
  profileId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  interface IFullProfile {
    _id: string;
    studentName?: string;
    rollNo?: string;
    branch?: string;
    cgpa?: number;
    activeBacklogs?: number;
    isEligibleForPlacement?: boolean;
    eligibilityStatus?: string;
    eligibilityReasons?: string[];
    resumeUrl?: string;
    skills?: { name: string; proficiency: string }[];
    linkedinUrl?: string;
    githubUrl?: string;
    personalEmail?: string;
    notes?: string;
  }
  const { data, isLoading, mutate } = useSwr<{ data?: IFullProfile }>(
    `placement/profiles/${profileId}`,
  );
  const profile = data?.data;
  const { mutation, isLoading: saving } = useMutation();
  const formik = useFormik<{ cgpa?: number; activeBacklogs?: number; notes?: string }>({
    enableReinitialize: true,
    initialValues: {
      cgpa: profile?.cgpa ?? 0,
      activeBacklogs: profile?.activeBacklogs ?? 0,
      notes: profile?.notes ?? '',
    },
    onSubmit: async (values) => {
      const res = await mutation(`placement/profiles/${profileId}/admin`, {
        method: 'PUT',
        body: values,
        isAlert: true,
      });
      if ((res as { results?: { success?: boolean } })?.results?.success) {
        toast.success('Profile updated');
        mutate();
        onSaved();
      } else toast.error('Failed');
    },
  });

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
        className="relative z-10 h-full w-full max-w-md overflow-y-auto bg-white  p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900">Placement Profile</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-600 hover:text-slate-600 text-xl"
          >
            ✕
          </button>
        </div>
        {isLoading || !profile ? (
          <div className="h-40 animate-pulse rounded-xl bg-slate-50" />
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">{profile.studentName ?? '—'}</p>
              <p className="text-xs text-slate-500">
                {profile.rollNo} {profile.branch ? `· ${profile.branch}` : ''}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-600">Eligibility</p>
              <p
                className={
                  'text-sm font-semibold ' +
                  (profile.isEligibleForPlacement ? 'text-green-600' : 'text-red-500')
                }
              >
                {profile.eligibilityStatus ?? '—'}
              </p>
              {profile.eligibilityReasons?.length ? (
                <ul className="mt-1 list-disc pl-4 text-xs text-slate-500">
                  {profile.eligibilityReasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            {profile.skills?.length ? (
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-600">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.skills.map((s) => (
                    <span
                      key={s.name}
                      className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] text-primary"
                    >
                      {s.name} · {s.proficiency}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {profile.resumeUrl && (
              <a
                href={profile.resumeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> View Resume
              </a>
            )}
            <form
              onSubmit={formik.handleSubmit}
              className="space-y-3 border-t border-slate-100 pt-4"
            >
              <p className="text-sm font-semibold text-slate-800">Admin Override</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>CGPA</label>
                  <input
                    type="number"
                    step="0.01"
                    className={inputCls}
                    {...formik.getFieldProps('cgpa')}
                  />
                </div>
                <div>
                  <label className={labelCls}>Active Backlogs</label>
                  <input
                    type="number"
                    className={inputCls}
                    {...formik.getFieldProps('activeBacklogs')}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <textarea
                  rows={2}
                  className={inputCls + ' resize-none'}
                  {...formik.getFieldProps('notes')}
                />
              </div>
              <CustomButton type="submit" loading={saving} className="w-fit!">
                Save Override
              </CustomButton>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
}

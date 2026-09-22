/**
 * @file ApplicantStatusPage.tsx
 * @description Applicant-facing status view rendered on the public admission
 *   portal AFTER the applicant has submitted their draft. Renders:
 *   - Header card with application number, candidate name, submitted date
 *   - Linear step tracker across the 9 stages
 *   - "What's happening now" panel with owner / next action / typical timing
 *   - Action-required block for any rejected documents (re-upload via
 *     `InlineFileUpload`)
 *   - Stage-specific extras (merit rank, counseling details, allocated seat)
 *   - Approval chain
 *   - Rejection reason when terminally rejected
 * @module features/role-wise-features/admission/components
 */
'use client';

import React from 'react';
import { toast } from 'react-toastify';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  FileCheck2,
  GraduationCap,
  Hourglass,
  ListChecks,
  XCircle,
  Users,
  Printer,
  Check,
} from 'lucide-react';
import { useState } from 'react';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import InlineFileUpload from '@/shared/core/InlineFileUpload';
import type { IViewerFile } from '@/shared/core/FileViewer';
import type { IApplicantApplication, TApplicantStatus } from '../types/applicant-status.types';

interface IBankAccount {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  branchName?: string;
}

interface IPaymentSettings {
  institutionName: string;
  qrCodeUrl?: string;
  upiId?: string;
  upiName?: string;
  bankAccounts: IBankAccount[];
  paymentInstructions?: string;
  acceptedModes: string[];
  requireScreenshot: boolean;
  requireUtrNumber: boolean;
}

interface IApplicantStatusPageProps {
  app: IApplicantApplication;
  onRefresh: () => void;
}

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
};

const JOURNEY: Array<{
  key: TApplicantStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: 'submitted', label: 'Submitted', icon: FileCheck2 },
  { key: 'under_review', label: 'Under Review', icon: ListChecks },
  { key: 'approved', label: 'Approved', icon: CheckCircle2 },
  { key: 'enrolled', label: 'Enrolled', icon: GraduationCap },
];

interface IStageGuide {
  tone: 'info' | 'progress' | 'success' | 'danger';
  title: string;
  description: string;
  defaultDesk: string;
  whatYouShouldDo: string;
  expected: string;
}

const STAGE_GUIDE: Record<TApplicantStatus, IStageGuide> = {
  draft: {
    tone: 'info',
    title: 'Continue your application',
    description:
      'You have a draft application. Complete every section and submit it to be considered.',
    defaultDesk: 'Applicant',
    whatYouShouldDo: 'Fill out remaining sections and click Submit Application.',
    expected: 'Application window stays open until the deadline announced by the institute.',
  },
  submitted: {
    tone: 'progress',
    title: 'Application submitted — waiting for review',
    description:
      'Your application has reached the Administration Office. They will pick it up and start reviewing your documents shortly.',
    defaultDesk: 'Admission Cell',
    whatYouShouldDo:
      'Nothing right now. We will notify you by email and in-app once the review begins.',
    expected: 'Review typically begins within 1–2 working days.',
  },
  under_review: {
    tone: 'progress',
    title: 'Application under review',
    description:
      'The Administration Office is reviewing your application and uploaded documents. If anything is unclear they will reach out to you.',
    defaultDesk: 'Administration Office / Verification Cell',
    whatYouShouldDo: 'Keep an eye on email and notifications in case more documents are requested.',
    expected: 'Review usually completes within 2–3 working days.',
  },
  document_verification: {
    tone: 'progress',
    title: 'Documents under verification',
    description:
      'The admission cell is checking your uploaded documents. If anything is missing or unclear they will reach out to you.',
    defaultDesk: 'Admission Cell / Verification Cell',
    whatYouShouldDo: 'Keep an eye on email and notifications in case more documents are requested.',
    expected: 'Verification usually completes within 2–3 working days.',
  },
  merit_list: {
    tone: 'success',
    title: 'You are in the merit list',
    description:
      'Your application has been ranked in the merit list. The admission committee will schedule counseling for shortlisted candidates.',
    defaultDesk: 'Admission Committee',
    whatYouShouldDo:
      'Watch for the counseling schedule. Be ready with original documents on the day.',
    expected: 'Counseling is normally scheduled within a week of merit list publication.',
  },
  counseling_scheduled: {
    tone: 'progress',
    title: 'Counseling scheduled',
    description:
      'A counseling slot has been booked for you. Please attend on the scheduled date with all original documents.',
    defaultDesk: 'Admission Cell',
    whatYouShouldDo: 'Attend the counseling at the scheduled date, time, and venue.',
    expected: 'Seat allocation happens at the counseling session itself.',
  },
  seat_allocated: {
    tone: 'success',
    title: 'Seat allocated',
    description:
      'A seat has been reserved for you in your preferred program. Final approval from the committee comes next.',
    defaultDesk: 'Admission Committee',
    whatYouShouldDo: 'Nothing right now — the committee is reviewing your file.',
    expected: 'Approvals usually complete within 1–2 working days per approver.',
  },
  pending_approval: {
    tone: 'progress',
    title: 'Final approval in progress',
    description:
      'Your file is moving through the approval chain — Counselor, Dean, then Principal. Each one signs off before the next.',
    defaultDesk: 'Approval Chain',
    whatYouShouldDo: 'Nothing — you will be notified once the chain completes.',
    expected: 'Each approver typically responds within 1–2 working days.',
  },
  approved: {
    tone: 'success',
    title: 'Admission approved',
    description:
      'Congratulations! All approvers have signed off. The next step is fee payment to confirm your seat.',
    defaultDesk: 'Applicant / Accounts Department',
    whatYouShouldDo: 'Pay the booking / first instalment fee from the Fee section once it opens.',
    expected: 'Pay before the deadline shared in your approval email to keep your seat.',
  },
  fee_pending: {
    tone: 'progress',
    title: 'Fee payment pending',
    description:
      'Pay the booking amount or first instalment to confirm your enrollment. Until then, the seat is held provisionally.',
    defaultDesk: 'Applicant / Accounts Department',
    whatYouShouldDo: 'Complete the payment using the link shared by the accounts team.',
    expected: 'Failing to pay by the deadline may release your seat.',
  },
  enrolled: {
    tone: 'success',
    title: 'You are enrolled — welcome!',
    description:
      'Your enrollment is complete. Sign in to your student dashboard to access classes, fees, and timetables.',
    defaultDesk: 'Student Affairs',
    whatYouShouldDo: 'Use the Sign in button to go to your student dashboard.',
    expected: 'Orientation details will be sent via email.',
  },
  rejected: {
    tone: 'danger',
    title: 'Application not accepted',
    description:
      'Unfortunately the committee did not approve your application. Please see the reason below or contact the admission cell for clarity.',
    defaultDesk: 'Admission Cell',
    whatYouShouldDo:
      'Contact the admission office if you would like more information or wish to re-apply next cycle.',
    expected: 'Re-application opens with the next admission cycle.',
  },
  withdrawn: {
    tone: 'info',
    title: 'Application withdrawn',
    description:
      'This application has been withdrawn. You can re-apply in a future admission cycle.',
    defaultDesk: 'Admission Cell',
    whatYouShouldDo: 'Contact the admission cell if this was unexpected.',
    expected: '—',
  },
};

const TONE: Record<IStageGuide['tone'], { panel: string; iconWrap: string; pill: string }> = {
  info: {
    panel: 'bg-sky-50',
    iconWrap: 'bg-sky-100 text-sky-700',
    pill: 'bg-sky-100 text-sky-800',
  },
  progress: {
    panel: 'bg-amber-50',
    iconWrap: 'bg-amber-100 text-amber-700',
    pill: 'bg-amber-100 text-amber-800',
  },
  success: {
    panel: 'bg-emerald-50',
    iconWrap: 'bg-emerald-100 text-emerald-700',
    pill: 'bg-emerald-100 text-emerald-800',
  },
  danger: {
    panel: 'bg-rose-50',
    iconWrap: 'bg-rose-100 text-rose-700',
    pill: 'bg-rose-100 text-rose-800',
  },
};

const ROLE_LABEL: Record<string, string> = {
  admission_counselor: 'Admission Counselor',
  dean_academic: 'Dean (Academic)',
  principal: 'Principal',
};

function formatDate(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function resolveCurrentDesk(
  app: IApplicantApplication,
  status: TApplicantStatus,
  guide: IStageGuide,
  rejectedDocsCount: number,
) {
  const paymentStatus = app.paymentDetails?.verificationStatus;

  if (rejectedDocsCount > 0) return 'Applicant';
  if (paymentStatus === 'rejected') return 'Applicant';
  if (paymentStatus === 'pending') return 'Accounts Department';
  if (status === 'approved' && paymentStatus === 'verified') return 'Administration Office';
  if (status === 'approved' || status === 'fee_pending') return 'Applicant / Accounts Department';

  return guide.defaultDesk;
}

function OnboardForm({ app, onRefresh }: { app: IApplicantApplication; onRefresh: () => void }) {
  const { mutation, isLoading } = useMutation();
  const [status, setStatus] = useState<'hosteller' | 'day_scholar' | ''>(
    app.onboardStatus && app.onboardStatus !== 'pending' ? app.onboardStatus : '',
  );
  const [transport, setTransport] = useState<'bus' | 'own' | ''>(app.transportOption || '');
  const [isEditing, setIsEditing] = useState(!app.onboardStatus || app.onboardStatus === 'pending');

  const handleSave = async () => {
    if (!status) {
      toast.error('Please select an option');
      return;
    }
    if (status === 'day_scholar' && !transport) {
      toast.error('Please select a transportation option');
      return;
    }

    const res = await mutation('admission/my-application/onboard', {
      method: 'PATCH',
      body: {
        onboardStatus: status,
        transportOption: status === 'day_scholar' ? transport : null,
      },
      isAlert: true,
    });

    if (res) {
      toast.success('Onboarding choice updated successfully');
      setIsEditing(false);
      onRefresh();
    }
  };

  if (!isEditing) {
    return (
      <div className="mt-4 space-y-3">
        <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
          <p className="text-sm font-semibold text-slate-800 capitalize">
            Selection: {status === 'hosteller' ? 'Hosteller' : 'Day Scholar'}
          </p>
          {status === 'day_scholar' && (
            <p className="text-xs text-slate-500 mt-1">
              Transport Option: {transport === 'bus' ? 'College Bus Service' : 'Own Arrangement'}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Change Preferences
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => {
            setStatus('hosteller');
            setTransport('');
          }}
          className={`flex-1 rounded-xl border p-4 text-left transition-all ${
            status === 'hosteller'
              ? 'border-primary-500 bg-primary-50/30 ring-2 ring-primary-500'
              : 'border-slate-200 hover:bg-slate-50/50'
          }`}
        >
          <p className="text-sm font-bold text-slate-800">Hosteller</p>
          <p className="text-xs text-slate-500 mt-1">
            Request room allocation in the boys/girls hostel.
          </p>
        </button>
        <button
          type="button"
          onClick={() => setStatus('day_scholar')}
          className={`flex-1 rounded-xl border p-4 text-left transition-all ${
            status === 'day_scholar'
              ? 'border-primary-500 bg-primary-50/30 ring-2 ring-primary-500'
              : 'border-slate-200 hover:bg-slate-50/50'
          }`}
        >
          <p className="text-sm font-bold text-slate-800">Day Scholar</p>
          <p className="text-xs text-slate-500 mt-1">
            Commute from home using college bus or own transport.
          </p>
        </button>
      </div>

      {status === 'day_scholar' && (
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Transportation Option
          </p>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="transport"
                value="bus"
                checked={transport === 'bus'}
                onChange={() => setTransport('bus')}
                className="h-4 w-4 border-slate-300 text-primary focus:ring-primary"
              />
              Institute Bus Service
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="transport"
                value="own"
                checked={transport === 'own'}
                onChange={() => setTransport('own')}
                className="h-4 w-4 border-slate-300 text-primary focus:ring-primary"
              />
              Own Arrangement
            </label>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        {app.onboardStatus !== 'pending' && (
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading || !status || (status === 'day_scholar' && !transport)}
          className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90 transition-all disabled:opacity-50"
        >
          Save Preferences
        </button>
      </div>
    </div>
  );
}

export default function ApplicantStatusPage({ app, onRefresh }: IApplicantStatusPageProps) {
  const { mutation } = useMutation();
  const { data: paymentSettingsResp } = useSwr<{ data?: IPaymentSettings }>(
    'payment-settings/active',
  );
  const paymentSettings = paymentSettingsResp?.data;

  const [paymentForm, setPaymentForm] = React.useState({
    amountInNumber: app.paymentDetails?.amountInNumber
      ? String(app.paymentDetails.amountInNumber)
      : '',
    transactionId: app.paymentDetails?.transactionId ?? '',
    paidAt: app.paymentDetails?.paidAt ? String(app.paymentDetails.paidAt).slice(0, 10) : '',
  });
  const [paymentScreenshot, setPaymentScreenshot] = React.useState<File | null>(null);

  const reuploadDoc = async (docType: string, file: File): Promise<boolean> => {
    const fd = new FormData();
    fd.append('document', file);
    const res = (await mutation(`admission/my-application/documents/${docType}`, {
      method: 'POST',
      isFormData: true,
      body: fd,
    })) as { results?: { success?: boolean; message?: string } };
    if (res?.results?.success) {
      toast.success('Re-uploaded. The admission cell will review it again.');
      onRefresh();
      return true;
    }
    toast.error(res?.results?.message ?? 'Upload failed. Please try again.');
    return false;
  };

  const statusKey = (app.status as TApplicantStatus) ?? 'submitted';
  const guide = STAGE_GUIDE[statusKey] ?? STAGE_GUIDE.submitted;
  const tone = TONE[guide.tone];

  const isTerminal = statusKey === 'rejected' || statusKey === 'withdrawn';
  const currentIdx = JOURNEY.findIndex((s) => s.key === statusKey);

  const rejectedDocs = (app.documentChecklist ?? []).filter((d) => d.status === 'rejected');
  const paymentStatus = app.paymentDetails?.verificationStatus;
  const currentDesk = resolveCurrentDesk(app, statusKey, guide, rejectedDocs.length);
  const canSubmitPayment =
    !isTerminal &&
    statusKey !== 'enrolled' &&
    statusKey !== 'draft' &&
    paymentStatus !== 'verified';
  const showPaymentPanel =
    canSubmitPayment ||
    Boolean(app.paymentDetails?.amountInNumber) ||
    Boolean(app.paymentDetails?.transactionId);

  const submitPayment = async () => {
    const hasPayment =
      paymentForm.amountInNumber ||
      paymentForm.transactionId ||
      paymentForm.paidAt ||
      paymentScreenshot;
    if (!hasPayment) {
      toast.error('Enter payment amount, transaction ID, date, or upload a screenshot.');
      return;
    }

    const fd = new FormData();
    if (paymentForm.amountInNumber) fd.append('amountInNumber', paymentForm.amountInNumber);
    if (paymentForm.transactionId) fd.append('transactionId', paymentForm.transactionId);
    if (paymentForm.paidAt) fd.append('paidAt', paymentForm.paidAt);
    if (paymentScreenshot) fd.append('screenshot', paymentScreenshot);

    const res = (await mutation('admission/my-application/payment', {
      method: 'PATCH',
      isFormData: true,
      body: fd,
    })) as { results?: { success?: boolean; message?: string } };

    if (res?.results?.success) {
      toast.success('Payment details submitted for verification.');
      onRefresh();
      return;
    }
    toast.error(res?.results?.message ?? 'Could not submit payment details.');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body {
                background-color: #fff !important;
                color: #000 !important;
              }
              header, .no-print {
                display: none !important;
              }
              main {
                padding: 0 !important;
                margin: 0 !important;
                max-width: 100% !important;
              }
              #print-application-sheet {
                display: block !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                box-: none !important;
              }
              table {
                width: 100% !important;
                border-collapse: collapse !important;
                border-color: #000 !important;
                margin-bottom: 1.5rem !important;
              }
              th, td {
                border: 1px solid #000 !important;
                color: #000 !important;
                padding: 6px 10px !important;
              }
              .bg-slate-50, .bg-slate-100 {
                background-color: #f1f5f9 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              h1, h2, h3 {
                color: #000 !important;
              }
            }
            @media screen {
              #print-application-sheet {
                display: none !important;
              }
            }
          `,
        }}
      />

      <div className="no-print space-y-6">
        {/* Header card */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white/90 p-6  backdrop-blur-md sm:p-8">
          <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-primary-500/5 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Application #{app.applicationNumber}
              </p>
              <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                {app.candidateName}
              </h1>
              {app.submittedAt ? (
                <p className="mt-1 text-xs text-slate-500 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-600" /> Submitted on{' '}
                  {formatDate(app.submittedAt)}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors  active:scale-95 cursor-pointer"
              >
                <Printer className="h-4 w-4" /> Print Form
              </button>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold  ring-1 ring-inset ${
                  guide.tone === 'success'
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10'
                    : guide.tone === 'danger'
                      ? 'bg-rose-50 text-rose-700 ring-rose-600/10'
                      : 'bg-amber-50 text-amber-700 ring-amber-600/10'
                }`}
              >
                {guide.tone === 'success' ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : guide.tone === 'danger' ? (
                  <XCircle className="h-3.5 w-3.5" />
                ) : (
                  <Clock className="h-3.5 w-3.5 animate-pulse text-amber-600" />
                )}
                {(app.status || '').replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          {/* Step tracker (hidden for terminal states) */}
          {!isTerminal ? (
            <div className="mt-8 border-t border-slate-100 pt-8 overflow-x-auto pb-1">
              <div className="relative min-w-125">
                {/* Progress Line */}
                <div className="absolute top-5 left-8 right-8 h-0.5 bg-slate-100" />
                <div
                  className="absolute top-5 left-8 h-0.5 bg-linear-to-r from-primary-500 to-indigo-600 transition-all duration-500"
                  style={{
                    width: `${(currentIdx / (JOURNEY.length - 1)) * 88}%`,
                  }}
                />

                <ol className="relative flex justify-between">
                  {JOURNEY.map((step, idx) => {
                    const done = currentIdx > idx;
                    const active = currentIdx === idx;
                    const Icon = step.icon;
                    return (
                      <li key={step.key} className="flex flex-col items-center w-24">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                            done
                              ? 'bg-emerald-600 text-white  '
                              : active
                                ? 'bg-primary-600 text-white ring-4 ring-primary-500/20  '
                                : 'bg-white border border-slate-200 text-slate-600'
                          }`}
                        >
                          {done ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <Icon className="h-5 w-5" />
                          )}
                        </div>
                        <span
                          className={`mt-2 text-center text-xs font-semibold tracking-tight transition-colors duration-300 ${
                            done || active ? 'text-slate-900 font-bold' : 'text-slate-600'
                          }`}
                        >
                          {step.label}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          ) : null}
        </div>

        {/* What's happening now */}
        <div
          className={`relative overflow-hidden rounded-2xl border border-slate-150 p-6  ${tone.panel}`}
        >
          <div
            className={`absolute top-0 bottom-0 left-0 w-1.5 ${
              guide.tone === 'success'
                ? 'bg-emerald-500'
                : guide.tone === 'danger'
                  ? 'bg-rose-500'
                  : 'bg-amber-500'
            }`}
          />

          <div className="flex items-start gap-4 pl-1">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl  ${tone.iconWrap}`}
            >
              <Hourglass className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                What&apos;s happening now
              </p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">{guide.title}</h2>
              <p className="mt-1 text-sm text-slate-700 leading-relaxed">{guide.description}</p>

              <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-100 bg-white/70 p-4  backdrop-blur-xs transition-all hover:bg-white ">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    Current desk
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-850">{currentDesk}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white/70 p-4  backdrop-blur-xs transition-all hover:bg-white ">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    What you should do
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-850">
                    {guide.whatYouShouldDo}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white/70 p-4  backdrop-blur-xs transition-all hover:bg-white ">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    Typical timing
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-850">{guide.expected}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action required — rejected documents */}
        {rejectedDocs.length > 0 ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-5 ">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 ">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-rose-700">
                  Action required — {rejectedDocs.length}{' '}
                  {rejectedDocs.length === 1 ? 'document' : 'documents'} need re-upload
                </p>
                <p className="mt-1 text-sm text-rose-900 leading-relaxed">
                  The admission cell could not accept the following documents. Please upload a
                  corrected version of each. Your status will not move forward until every rejected
                  document is re-submitted and re-verified.
                </p>

                <div className="mt-4 space-y-3">
                  {rejectedDocs.map((doc) => {
                    const docFiles: IViewerFile[] = (doc.files ?? []).map((f) => ({
                      url: f.url,
                      name: f.name ?? doc.docType,
                    }));
                    return (
                      <div
                        key={doc.docType}
                        className="rounded-xl border border-slate-100 bg-white p-4 "
                      >
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900">
                            {DOC_LABELS[doc.docType] ?? doc.docType.replace(/_/g, ' ')}
                          </p>
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-inset ring-rose-600/10">
                            <XCircle className="h-3 w-3" /> Rejected
                          </span>
                        </div>
                        {doc.rejectionReason ? (
                          <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs italic text-rose-800">
                            Counselor&apos;s note: “{doc.rejectionReason}”
                          </p>
                        ) : null}
                        <InlineFileUpload
                          label="Upload corrected version"
                          files={docFiles}
                          onUpload={(f) => reuploadDoc(doc.docType, f)}
                          hint="PDF or supported image, up to 5 MB. Tap View to verify the upload."
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {app.status !== 'draft' ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-6 ">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ">
                <Users className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Student Onboarding
                </p>
                <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                  Hostel & Transport Preferences
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Please declare whether you require hostel accommodations or daily transportation
                  services.
                </p>

                <OnboardForm app={app} onRefresh={onRefresh} />
              </div>
            </div>
          </div>
        ) : null}

        {showPaymentPanel ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-6 ">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 ">
                <CreditCard className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-405">
                  Admission payment
                </p>
                <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                  {paymentStatus === 'rejected'
                    ? 'Payment needs correction'
                    : paymentStatus === 'pending'
                      ? 'Payment under verification'
                      : 'Submit booking payment details'}
                </h2>
                {app.paymentDetails?.verificationRemarks ? (
                  <p className="mt-2.5 rounded-lg bg-rose-50 px-3 py-2 text-xs italic text-rose-800">
                    Accounts note: “{app.paymentDetails.verificationRemarks}”
                  </p>
                ) : null}

                {/* Layout for Payment QR and Details alongside Submit Form */}
                <div
                  className={`mt-6 grid gap-6 ${canSubmitPayment && paymentSettings ? 'lg:grid-cols-12' : 'grid-cols-1'}`}
                >
                  {/* Column 1: QR & Instructions */}
                  {canSubmitPayment && paymentSettings ? (
                    <div className="lg:col-span-5 rounded-xl border border-slate-100 bg-slate-50/50 p-4 flex flex-col items-center">
                      <p className="text-xs font-bold text-slate-500 mb-3 w-full text-left uppercase tracking-wider">
                        Scan to Pay
                      </p>
                      {paymentSettings.qrCodeUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={paymentSettings.qrCodeUrl}
                          alt="Payment QR Code"
                          className="h-40 w-40 object-contain rounded-lg  bg-white p-2 border border-slate-100"
                        />
                      ) : (
                        <div className="flex h-40 w-40 items-center justify-center rounded-xl bg-white border border-slate-100 text-xs text-slate-600">
                          QR not configured
                        </div>
                      )}
                      <div className="mt-3.5 w-full space-y-2 text-xs text-slate-600">
                        {paymentSettings.upiId && (
                          <div className="rounded-lg bg-white p-2 border border-slate-100/80">
                            <p className="font-semibold text-slate-600 text-[10px] uppercase tracking-wider">
                              UPI ID
                            </p>
                            <p className="font-mono text-slate-800 break-all mt-0.5">
                              {paymentSettings.upiId}
                            </p>
                            {paymentSettings.upiName && (
                              <p className="text-[10px] text-slate-600 mt-0.5">
                                {paymentSettings.upiName}
                              </p>
                            )}
                          </div>
                        )}
                        {paymentSettings.bankAccounts?.map((bank, index) => (
                          <div
                            key={`${bank.bankName}-${index}`}
                            className="rounded-lg bg-white p-2 border border-slate-100/80"
                          >
                            <p className="font-bold text-slate-700">{bank.bankName}</p>
                            <p className="text-slate-500">{bank.accountHolderName}</p>
                            <p className="mt-1 text-slate-800">
                              A/C:{' '}
                              <span className="font-mono font-semibold">{bank.accountNumber}</span>
                            </p>
                            <p className="text-slate-800">
                              IFSC: <span className="font-mono font-semibold">{bank.ifscCode}</span>
                            </p>
                            {bank.branchName && (
                              <p className="text-[10px] text-slate-600">
                                Branch: {bank.branchName}
                              </p>
                            )}
                          </div>
                        ))}
                        {paymentSettings.paymentInstructions && (
                          <div className="rounded-lg bg-amber-50/50 border border-amber-100/50 p-2 text-amber-800 text-[11px] leading-relaxed">
                            {paymentSettings.paymentInstructions}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {/* Column 2: Payment Fields Form */}
                  <div
                    className={`${canSubmitPayment && paymentSettings ? 'lg:col-span-7' : 'w-full'} space-y-4`}
                  >
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                          Amount Paid
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={paymentForm.amountInNumber}
                          onChange={(e) =>
                            setPaymentForm((prev) => ({ ...prev, amountInNumber: e.target.value }))
                          }
                          disabled={!canSubmitPayment}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:bg-white focus:ring-3 focus:ring-primary-500/10 transition-all disabled:bg-slate-100 disabled:text-slate-600"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                          Transaction / UTR ID
                        </label>
                        <input
                          value={paymentForm.transactionId}
                          onChange={(e) =>
                            setPaymentForm((prev) => ({ ...prev, transactionId: e.target.value }))
                          }
                          disabled={!canSubmitPayment}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:bg-white focus:ring-3 focus:ring-primary-500/10 transition-all disabled:bg-slate-100 disabled:text-slate-600"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                          Payment Date
                        </label>
                        <input
                          type="date"
                          value={paymentForm.paidAt}
                          onChange={(e) =>
                            setPaymentForm((prev) => ({ ...prev, paidAt: e.target.value }))
                          }
                          disabled={!canSubmitPayment}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:bg-white focus:ring-3 focus:ring-primary-500/10 transition-all disabled:bg-slate-100 disabled:text-slate-600"
                        />
                      </div>
                    </div>

                    {canSubmitPayment ? (
                      <div className="space-y-4">
                        <div className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-55 p-6 text-center hover:bg-slate-50/50 transition-colors cursor-pointer group">
                          <input
                            type="file"
                            accept="application/pdf,image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp,image/tiff,image/heic,image/heif"
                            onChange={(e) => setPaymentScreenshot(e.target.files?.[0] ?? null)}
                            className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                          />
                          <CreditCard className="mx-auto h-8 w-8 text-slate-600 group-hover:text-primary-500 transition-colors" />
                          <p className="mt-2 text-xs font-semibold text-slate-600">
                            {paymentScreenshot
                              ? paymentScreenshot.name
                              : 'Upload payment screenshot / receipt'}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-600">
                            PDF or supported image up to 5 MB
                          </p>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={submitPayment}
                            className="w-full sm:w-auto shrink-0 rounded-xl bg-linear-to-r from-primary-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white   hover:from-primary-700 hover:to-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-primary-500/20 transition-all"
                          >
                            Submit Payment
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {statusKey === 'merit_list' && app.meritRank ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-6 ">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Your merit rank
            </p>
            <p className="mt-1 text-3xl font-extrabold text-emerald-600">#{app.meritRank}</p>
          </div>
        ) : null}

        {statusKey === 'counseling_scheduled' && app.counselingSchedule ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-6 ">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Counseling details
            </p>
            <div className="mt-3.5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  Date
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {formatDate(app.counselingSchedule.date)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  Time
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {app.counselingSchedule.time || '—'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  Venue
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {app.counselingSchedule.venue || '—'}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {statusKey === 'seat_allocated' && app.allocatedSeat ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-6 ">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Allocated seat
            </p>
            <p className="mt-1.5 text-base font-bold text-slate-850">
              {app.allocatedSeat.program || '—'}
              {app.allocatedSeat.department ? ` · ${app.allocatedSeat.department}` : ''}
            </p>
          </div>
        ) : null}

        {/* Approval chain — show whenever approvals exist */}
        {Array.isArray(app.approvals) && app.approvals.length > 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-6 ">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Approval chain
            </p>
            <div className="mt-4 space-y-3">
              {app.approvals.map((a, i) => {
                const label = ROLE_LABEL[a.role] ?? a.role.replace(/_/g, ' ');
                const stateText =
                  a.status === 'approved'
                    ? `Approved · ${formatDate(a.approvedAt)}`
                    : a.status === 'rejected'
                      ? `Rejected · ${formatDate(a.approvedAt)}`
                      : 'Awaiting action';
                return (
                  <div
                    key={i}
                    className="flex items-start gap-4 rounded-xl border border-slate-100 bg-slate-50/30 p-4"
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        a.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-700'
                          : a.status === 'rejected'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {a.status === 'approved' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : a.status === 'rejected' ? (
                        <XCircle className="h-4 w-4" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">{label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{stateText}</p>
                      {a.remarks ? (
                        <p className="mt-2.5 rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs italic text-slate-600">
                          “{a.remarks}”
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {statusKey === 'rejected' && app.rejectionReason ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-6 ">
            <p className="text-xs font-bold uppercase tracking-wider text-rose-700">Reason</p>
            <p className="mt-1.5 text-sm text-rose-900 leading-relaxed">{app.rejectionReason}</p>
          </div>
        ) : null}
      </div>

      {/* Printable Sheet */}
      <PrintableApplicationSheet app={app} />
    </div>
  );
}

// ─── Helpers for print sheet ───────────────────────────────────────────────────

/** Shape of a single document checklist entry coming from the API */
interface IDocChecklistEntry {
  docType: string;
  files?: IViewerFile[];
  uploadedFileUrl?: string;
}

/** Shape of a single academic record row coming from the API */
interface IAcademicRecord {
  examName?: string;
  boardOrUniversity?: string;
  instituteName?: string;
  passingYear?: string | number;
  securedMarks?: string | number;
  totalMarks?: string | number;
  percentage?: string | number;
}

/** Address sub-object used by the printable sheet */
interface IAddressObj {
  line1?: string;
  line2?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
}

/** Entrance exam sub-object used by the printable sheet */
interface IEntranceExam {
  exam?: string;
  examName?: string;
  otherName?: string;
  applicationNo?: string;
  rollNumber?: string;
  year?: string | number;
  rank?: string | number;
  score?: string | number;
  percentile?: string | number;
}

/** Full application shape expected by the printable sheet.
 *  Uses explicit fields so the index signature conflict with
 *  IApplicantApplication is avoided. */
interface IPrintableApp extends IApplicantApplication {
  // Personal details
  fatherName?: string;
  motherName?: string;
  dateOfBirth?: string;
  gender?: string;
  category?: string;
  religion?: string;
  aadhaarNumber?: string;
  nationality?: string;
  bloodGroup?: string;
  // Contact
  email?: string;
  phone?: string;
  whatsappPhone?: string;
  parentPhone?: string;
  // Address
  presentAddress?: IAddressObj;
  permanentAddress?: IAddressObj;
  sameAddress?: boolean;
  // Academic & entrance
  academicRecords?: IAcademicRecord[];
  entranceExam?: IEntranceExam;
  programPreferences?: string[];
}

const programmeLabel = (value: string) => {
  const parts = value.split('_');
  if (parts.length >= 2) {
    const course = parts[0].toUpperCase();
    const branch = parts.slice(1).join(' ').toUpperCase();
    return `${course} in ${branch}`;
  }
  return value.toUpperCase();
};

function buildDocMap(raw: IPrintableApp): Record<string, IViewerFile[]> {
  const map: Record<string, IViewerFile[]> = {};
  const list: IDocChecklistEntry[] = (raw?.documentChecklist as IDocChecklistEntry[]) ?? [];
  list.forEach((d) => {
    if (Array.isArray(d.files) && d.files.length) {
      map[d.docType] = d.files;
    } else if (d.uploadedFileUrl) {
      map[d.docType] = [{ url: d.uploadedFileUrl }];
    }
  });
  return map;
}

function PrintableApplicationSheet({ app }: { app: IPrintableApp }) {
  const { data: settingsRes } = useSwr<{
    success: boolean;
    data: {
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

  const docs = buildDocMap(app);
  const photoFile = docs['passport_photo']?.[0]?.url;
  const addr = (a?: IAddressObj) =>
    a ? [a.line1, a.line2, a.city, a.district, a.state, a.pincode].filter(Boolean).join(', ') : '—';

  const uploadedDocsList = Object.entries(docs).filter(([, files]) => (files?.length ?? 0) > 0);

  const examTitle =
    app.entranceExam?.exam === 'OTHER'
      ? app.entranceExam?.otherName
      : app.entranceExam?.exam || app.entranceExam?.examName;
  const hasExam = Boolean(
    app.entranceExam &&
    (examTitle ||
      app.entranceExam.applicationNo ||
      app.entranceExam.rollNumber ||
      app.entranceExam.rank ||
      app.entranceExam.score ||
      app.entranceExam.percentile != null),
  );

  return (
    <div id="print-application-sheet" className="p-8 bg-white text-slate-855 space-y-6">
      {/* Printable Official Header */}
      <div className="flex items-center justify-between pb-6 border-b-2 border-slate-300">
        <div className="flex items-center gap-4">
          {/* Institution Logo */}
          {settings?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.logoUrl}
              alt={`${settings.name} Logo`}
              className="h-16 w-16 object-contain rounded-lg shrink-0"
            />
          ) : (
            <div className="h-12 w-12 bg-primary-50 text-primary rounded-lg flex items-center justify-center font-extrabold text-xl tracking-tighter shrink-0 border border-primary/20">
              {settings?.shortCode || 'DV'}
            </div>
          )}
          <div>
            <h1 className="text-lg font-black text-slate-950 uppercase tracking-tight">
              {settings?.name || 'DevVelocity Institute of Technology'}
            </h1>
            <p className="text-[11px] text-slate-600 font-semibold tracking-wider uppercase">
              {settings?.accreditations && settings.accreditations.length > 0
                ? settings.accreditations.join(' · ')
                : 'Approved by AICTE & UGC · Accredited A++ Grade'}
            </p>
            <p className="text-[10px] text-slate-600 font-medium">
              {settings?.address || 'Bhubaneswar, Odisha'}
              {settings?.email ? ` · ${settings.email}` : ' · admission@devvelocity.edu'}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0 text-right">
          <span className="text-xs font-bold text-slate-955 uppercase tracking-wider">
            Application Form
          </span>
          <span className="text-[10px] text-slate-500 font-mono font-semibold">
            No: {app.applicationNumber}
          </span>
        </div>
      </div>

      {/* Section 1: Personal & Identification Particulars */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5 border-b pb-1">
          1. Personal &amp; Identification Particulars
        </h3>
        <table className="w-full border-collapse border border-slate-300 text-left text-xs">
          <tbody>
            <tr>
              <td className="bg-slate-50 text-slate-500 font-semibold text-[10px] px-3 py-1.5 border border-slate-300 w-[20%]">
                Candidate Name
              </td>
              <td className="px-3 py-1.5 text-xs font-bold text-slate-955 border border-slate-300 w-[55%]">
                {app.candidateName || '—'}
              </td>
              <td rowSpan={4} className="border border-slate-300 text-center w-[25%] p-2">
                <div className="mx-auto h-28 w-24 border border-slate-300 bg-white flex items-center justify-center overflow-hidden rounded">
                  {photoFile ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoFile}
                      alt="Passport Photo"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-[9px] text-slate-600 font-bold uppercase leading-tight">
                      Passport Photo
                    </span>
                  )}
                </div>
              </td>
            </tr>
            <tr>
              <td className="bg-slate-50 text-slate-500 font-semibold text-[10px] px-3 py-1.5 border border-slate-300">
                {"Father's"} Name
              </td>
              <td className="px-3 py-1.5 text-xs font-semibold text-slate-800 border border-slate-300">
                {app.fatherName || '—'}
              </td>
            </tr>
            <tr>
              <td className="bg-slate-50 text-slate-500 font-semibold text-[10px] px-3 py-1.5 border border-slate-300">
                {"Mother's"} Name
              </td>
              <td className="px-3 py-1.5 text-xs font-semibold text-slate-800 border border-slate-300">
                {app.motherName || '—'}
              </td>
            </tr>
            <tr>
              <td className="bg-slate-50 text-slate-500 font-semibold text-[10px] px-3 py-1.5 border border-slate-300">
                Date of Birth
              </td>
              <td className="px-3 py-1.5 text-xs font-semibold text-slate-800 border border-slate-300">
                {app.dateOfBirth || '—'}
              </td>
            </tr>
            <tr>
              <td className="bg-slate-50 text-slate-500 font-semibold text-[10px] px-3 py-1.5 border border-slate-300">
                Gender
              </td>
              <td className="px-3 py-1.5 text-xs font-semibold text-slate-800 border border-slate-300 capitalize">
                {app.gender || '—'}
              </td>
              <td className="bg-slate-50 text-slate-500 font-semibold text-[10px] px-3 py-1.5 border border-slate-300">
                Social Category
              </td>
              <td className="px-3 py-1.5 text-xs font-semibold text-slate-800 border border-slate-300 uppercase">
                {app.category || '—'}
              </td>
            </tr>
            <tr>
              <td className="bg-slate-50 text-slate-500 font-semibold text-[10px] px-3 py-1.5 border border-slate-300">
                Religion
              </td>
              <td className="px-3 py-1.5 text-xs font-semibold text-slate-800 border border-slate-300">
                {app.religion || '—'}
              </td>
              <td className="bg-slate-50 text-slate-500 font-semibold text-[10px] px-3 py-1.5 border border-slate-300">
                Aadhaar Number
              </td>
              <td className="px-3 py-1.5 text-xs font-mono text-slate-800 border border-slate-300">
                {app.aadhaarNumber || '—'}
              </td>
            </tr>
            <tr>
              <td className="bg-slate-50 text-slate-500 font-semibold text-[10px] px-3 py-1.5 border border-slate-300">
                Nationality
              </td>
              <td className="px-3 py-1.5 text-xs font-semibold text-slate-800 border border-slate-300">
                {app.nationality || '—'}
              </td>
              <td className="bg-slate-50 text-slate-500 font-semibold text-[10px] px-3 py-1.5 border border-slate-300">
                Blood Group
              </td>
              <td className="px-3 py-1.5 text-xs font-semibold text-slate-800 border border-slate-300">
                {app.bloodGroup || '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section 2: Contact & Address Particulars */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5 border-b pb-1">
          2. Contact &amp; Communication Details
        </h3>
        <table className="w-full border-collapse border border-slate-300 text-left text-xs">
          <tbody>
            <tr>
              <td className="bg-slate-50 text-slate-500 font-semibold text-[10px] px-3 py-1.5 border border-slate-300 w-[20%]">
                Email ID
              </td>
              <td className="px-3 py-1.5 text-xs font-semibold text-slate-800 border border-slate-300 w-[30%]">
                {app.email || '—'}
              </td>
              <td className="bg-slate-50 text-slate-500 font-semibold text-[10px] px-3 py-1.5 border border-slate-300 w-[20%]">
                Mobile Number
              </td>
              <td className="px-3 py-1.5 text-xs font-semibold text-slate-800 border border-slate-300 w-[30%]">
                {app.phone || '—'}
              </td>
            </tr>
            <tr>
              <td className="bg-slate-50 text-slate-500 font-semibold text-[10px] px-3 py-1.5 border border-slate-300">
                WhatsApp Number
              </td>
              <td className="px-3 py-1.5 text-xs font-semibold text-slate-800 border border-slate-300">
                {app.whatsappPhone || '—'}
              </td>
              <td className="bg-slate-50 text-slate-500 font-semibold text-[10px] px-3 py-1.5 border border-slate-300">
                Parent Phone
              </td>
              <td className="px-3 py-1.5 text-xs font-semibold text-slate-800 border border-slate-300">
                {app.parentPhone || '—'}
              </td>
            </tr>
            <tr>
              <td className="bg-slate-50 text-slate-500 font-semibold text-[10px] px-3 py-1.5 border border-slate-300">
                Present Address
              </td>
              <td
                colSpan={3}
                className="px-3 py-1.5 text-xs text-slate-800 border border-slate-300 font-medium"
              >
                {addr(app.presentAddress)}
              </td>
            </tr>
            <tr>
              <td className="bg-slate-50 text-slate-500 font-semibold text-[10px] px-3 py-1.5 border border-slate-300">
                Permanent Address
              </td>
              <td
                colSpan={3}
                className="px-3 py-1.5 text-xs text-slate-800 border border-slate-300 font-medium"
              >
                {app.sameAddress ? 'Same as Present Address' : addr(app.permanentAddress)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section 3: Academic Qualifications */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5 border-b pb-1">
          3. Academic Record &amp; Qualifications
        </h3>
        <table className="w-full border-collapse border border-slate-300 text-left text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="border border-slate-300 px-3 py-1.5 font-bold uppercase text-[9px]">
                Exam Name
              </th>
              <th className="border border-slate-300 px-3 py-1.5 font-bold uppercase text-[9px]">
                Board / University
              </th>
              <th className="border border-slate-300 px-3 py-1.5 font-bold uppercase text-[9px]">
                Institute Name
              </th>
              <th className="border border-slate-300 px-3 py-1.5 font-bold uppercase text-[9px] w-[10%]">
                Year
              </th>
              <th className="border border-slate-300 px-3 py-1.5 font-bold uppercase text-[9px] w-[10%] text-right">
                Secured
              </th>
              <th className="border border-slate-300 px-3 py-1.5 font-bold uppercase text-[9px] w-[10%] text-right">
                Total
              </th>
              <th className="border border-slate-300 px-3 py-1.5 font-bold uppercase text-[9px] w-[10%] text-right">
                Percentage
              </th>
            </tr>
          </thead>
          <tbody>
            {!app.academicRecords || app.academicRecords.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="border border-slate-300 px-3 py-2 text-slate-500 text-center"
                >
                  No academic qualifications entered.
                </td>
              </tr>
            ) : (
              app.academicRecords.map((r: IAcademicRecord, idx: number) => (
                <tr key={idx}>
                  <td className="border border-slate-300 px-3 py-1.5 font-bold text-slate-800">
                    {r.examName || '—'}
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5 text-slate-700">
                    {r.boardOrUniversity || '—'}
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5 text-slate-700 truncate max-w-37.5">
                    {r.instituteName || '—'}
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5 font-mono text-slate-700">
                    {r.passingYear || '—'}
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5 text-right font-mono font-medium text-slate-800">
                    {r.securedMarks || '—'}
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5 text-right font-mono font-medium text-slate-800">
                    {r.totalMarks || '—'}
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5 text-right font-mono font-bold text-primary">
                    {r.percentage ? `${r.percentage}%` : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Section 4: Entrance Examination Details */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5 border-b pb-1">
          4. Entrance Examination Details
        </h3>
        <table className="w-full border-collapse border border-slate-300 text-left text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="border border-slate-300 px-3 py-1.5 font-bold uppercase text-[9px] w-[25%]">
                Entrance Exam Name
              </th>
              <th className="border border-slate-300 px-3 py-1.5 font-bold uppercase text-[9px] w-[20%]">
                Roll Number
              </th>
              <th className="border border-slate-300 px-3 py-1.5 font-bold uppercase text-[9px] w-[15%] text-right">
                All India Rank
              </th>
              <th className="border border-slate-300 px-3 py-1.5 font-bold uppercase text-[9px] w-[20%] text-right">
                Score Secured
              </th>
              <th className="border border-slate-300 px-3 py-1.5 font-bold uppercase text-[9px] w-[20%] text-right">
                Percentile
              </th>
            </tr>
          </thead>
          <tbody>
            {!hasExam ? (
              <tr>
                <td
                  colSpan={5}
                  className="border border-slate-300 px-3 py-2 text-slate-500 text-center"
                >
                  No entrance exam details declared.
                </td>
              </tr>
            ) : (
              <tr>
                <td className="border border-slate-300 px-3 py-1.5 font-bold text-slate-800 uppercase">
                  {examTitle || '—'}
                </td>
                <td className="border border-slate-300 px-3 py-1.5 font-mono text-slate-700 font-medium">
                  {app.entranceExam?.applicationNo || app.entranceExam?.rollNumber || '—'}
                </td>
                <td className="border border-slate-300 px-3 py-1.5 text-right font-mono font-medium text-slate-800">
                  {app.entranceExam?.rank ? `#${app.entranceExam.rank}` : '—'}
                </td>
                <td className="border border-slate-300 px-3 py-1.5 text-right font-mono font-medium text-slate-800">
                  {app.entranceExam?.score || '—'}
                </td>
                <td className="border border-slate-300 px-3 py-1.5 text-right font-mono font-bold text-primary">
                  {app.entranceExam?.percentile != null ? `${app.entranceExam.percentile}%` : '—'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Section 5: Course Preferences */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5 border-b pb-1">
          5. Programme Preferences
        </h3>
        <table className="w-full border-collapse border border-slate-300 text-left text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="border border-slate-300 px-3 py-1.5 font-bold uppercase text-[9px] w-[25%]">
                Preference Rank
              </th>
              <th className="border border-slate-300 px-3 py-1.5 font-bold uppercase text-[9px]">
                Programme Description
              </th>
            </tr>
          </thead>
          <tbody>
            {!app.programPreferences || app.programPreferences.length === 0 ? (
              <tr>
                <td
                  colSpan={2}
                  className="border border-slate-300 px-3 py-2 text-slate-500 text-center"
                >
                  No programme preferences recorded.
                </td>
              </tr>
            ) : (
              app.programPreferences.map((prog: string, idx: number) => (
                <tr key={idx}>
                  <td className="border border-slate-300 px-3 py-1.5 font-bold text-slate-800">
                    Choice Rank #{idx + 1}
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5 text-slate-700 font-semibold">
                    {programmeLabel(prog)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Section 6: Attached Documents Details */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5 border-b pb-1">
          6. Uploaded Documents Status
        </h3>
        <table className="w-full border-collapse border border-slate-300 text-left text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="border border-slate-300 px-3 py-1.5 font-bold uppercase text-[9px]">
                Document Category
              </th>
              <th className="border border-slate-300 px-3 py-1.5 font-bold uppercase text-[9px] w-[25%]">
                Status
              </th>
              <th className="border border-slate-300 px-3 py-1.5 font-bold uppercase text-[9px] w-[50%]">
                Files Attached
              </th>
            </tr>
          </thead>
          <tbody>
            {uploadedDocsList.length === 0 ? (
              <tr>
                <td colSpan={3} className="border border-slate-300 px-3 py-2 text-slate-500">
                  No documents attached.
                </td>
              </tr>
            ) : (
              uploadedDocsList.map(([docType, files]) => (
                <tr key={docType}>
                  <td className="border border-slate-300 px-3 py-1.5 font-bold text-slate-800 capitalize">
                    {docType.replace(/_/g, ' ')}
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5">
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 uppercase border border-emerald-200">
                      Uploaded
                    </span>
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5 text-slate-650">
                    <div className="flex flex-col gap-1 text-[10px] font-mono">
                      {files.map((file, idx) => (
                        <div key={idx}>{file.name || `Document #${idx + 1}`}</div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Section 7: Booking Fee Payment Details */}
      {app.paymentDetails?.amountInNumber ? (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5 border-b pb-1">
            7. Booking Fee Payment Details
          </h3>
          <table className="w-full border-collapse border border-slate-300 text-left text-xs">
            <tbody>
              <tr>
                <td className="bg-slate-50 text-slate-500 font-semibold text-[10px] px-3 py-1.5 border border-slate-300 w-[20%]">
                  Amount Paid
                </td>
                <td className="px-3 py-1.5 text-xs font-bold text-slate-950 border border-slate-300 w-[30%]">
                  ₹{app.paymentDetails.amountInNumber}
                </td>
                <td className="bg-slate-50 text-slate-500 font-semibold text-[10px] px-3 py-1.5 border border-slate-300 w-[20%]">
                  Transaction ID / UTR
                </td>
                <td className="px-3 py-1.5 text-xs font-mono text-slate-850 border border-slate-300 w-[30%]">
                  {app.paymentDetails.transactionId || '—'}
                </td>
              </tr>
              <tr>
                <td className="bg-slate-50 text-slate-500 font-semibold text-[10px] px-3 py-1.5 border border-slate-300">
                  Payment Date
                </td>
                <td className="px-3 py-1.5 text-xs text-slate-800 border border-slate-300">
                  {app.paymentDetails.paidAt ? formatDate(app.paymentDetails.paidAt) : '—'}
                </td>
                <td className="bg-slate-50 text-slate-500 font-semibold text-[10px] px-3 py-1.5 border border-slate-300">
                  Verification Status
                </td>
                <td className="px-3 py-1.5 text-xs font-bold border border-slate-300 uppercase">
                  <span
                    className={
                      app.paymentDetails.verificationStatus === 'verified'
                        ? 'text-emerald-700'
                        : app.paymentDetails.verificationStatus === 'rejected'
                          ? 'text-rose-705'
                          : 'text-amber-705'
                    }
                  >
                    {app.paymentDetails.verificationStatus || 'pending'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Section 8: Applicant Undertaking & Declaration */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-1">
          8. Applicant Undertaking &amp; Declaration
        </h3>
        <div className="rounded-xl border border-slate-300 bg-slate-50/50 p-4 text-[10px] leading-relaxed text-slate-650">
          <p>
            I hereby declare that all particulars entered in this application form are authentic,
            complete, and accurate. I understand that if any statement is found false or misleading
            at any stage, my candidature for admission will stand automatically canceled.
          </p>
          <div className="mt-4 flex items-center justify-between border-t border-slate-300 pt-3">
            <div>
              <span className="font-bold text-slate-550 block uppercase text-[8px] tracking-wider">
                Declaration Status
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 uppercase mt-0.5">
                <Check className="h-3 w-3" /> Verified &amp; Agreed
              </span>
            </div>
            <div className="text-right">
              <span className="font-bold text-slate-550 block uppercase text-[8px] tracking-wider">
                Submitted At
              </span>
              <span className="text-[10px] text-slate-700 font-medium mt-0.5 inline-block">
                {app.submittedAt ? formatDate(app.submittedAt) : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * @file InitiateApplicationPage.tsx
 * @description Admin-side short form to initiate an admission application.
 * Creates a draft application + a user account with a permanent ERP Student ID
 * and temporary password, then emails the credentials so the applicant can
 * complete the remaining fields themselves.
 * @module features/role-wise-features/admission
 */
'use client';

import AdmissionWorkflowBar from '@/shared/components/AdmissionWorkflowBar';
import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import useMutation from '@/shared/hooks/useMutation';
import { motion } from '@/shared/utils/motion';
import { useFormik } from 'formik';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  Copy,
  FileText,
  GraduationCap,
  Info,
  Mail,
  Phone,
  Send,
  ShieldCheck,
  BadgeCheck,
  User,
  UserPlus,
} from 'lucide-react';
import { useRouter } from 'nextjs-toploader/app';
import React from 'react';
import { toast } from 'react-toastify';
import * as Yup from 'yup';

interface IInitiateValues {
  candidateName: string;
  email: string;
  phone: string;
  academicYear: string;
  admissionType: 'regular' | 'lateral_entry';
  programPreference: string;
  preferredDepartmentId: string;
  sendEmail: boolean;
}

interface IInitiateResponse {
  application: { _id: string; applicationNumber: string; candidateName: string; email: string };
  tempStudentId: string;
  tempPassword?: string;
  credentialsEmailRequested?: boolean;
}

const SCHEMA = Yup.object({
  candidateName: Yup.string().trim().min(2, 'Too short').required('Candidate name is required'),
  email: Yup.string().email('Invalid email address').optional(),
  phone: Yup.string()
    .matches(/^[0-9+\-\s]{10,15}$/, 'Enter a valid phone number')
    .required('Phone number is required'),
  academicYear: Yup.string()
    .matches(/^\d{4}-\d{2}$/, 'Use format YYYY-YY (e.g. 2026-27)')
    .required('Academic year is required'),
  admissionType: Yup.string()
    .oneOf(['regular', 'lateral_entry'])
    .required('Admission type is required'),
  programPreference: Yup.string().trim().required('Select a degree programme (e.g. B.Tech, MCA)'),
  preferredDepartmentId: Yup.string().trim().optional(),
  sendEmail: Yup.boolean().default(true),
});

const InitiateApplicationPage: React.FC = () => {
  const router = useRouter();
  const { mutation, isLoading } = useMutation();
  const [result, setResult] = React.useState<IInitiateResponse | null>(null);
  const [copiedId, setCopiedId] = React.useState(false);
  const [copiedPass, setCopiedPass] = React.useState(false);
  const [programmeCodes, setProgrammeCodes] = React.useState<{
    regular?: string;
    lateral?: string;
  }>({});

  const formik = useFormik<IInitiateValues>({
    initialValues: {
      candidateName: '',
      email: '',
      phone: '',
      academicYear: '',
      admissionType: 'regular',
      programPreference: '',
      preferredDepartmentId: '',
      sendEmail: false,
    },
    validationSchema: SCHEMA,
    onSubmit: async (values) => {
      const res = (await mutation('admission/initiate', {
        method: 'POST',
        body: {
          ...values,
          preferredDepartmentId: values.preferredDepartmentId || undefined,
        },
        isAlert: true,
      })) as { results?: { success?: boolean; data?: IInitiateResponse } } | undefined;

      if (res?.results?.success && res.results.data) {
        setResult(res.results.data);
      }
    },
  });

  const copy = async (text: string | undefined, type: 'id' | 'pass') => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'id') {
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
      } else {
        setCopiedPass(true);
        setTimeout(() => setCopiedPass(false), 2000);
      }
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Copy failed');
    }
  };

  const err = (k: keyof IInitiateValues): string | undefined =>
    formik.touched[k] && typeof formik.errors[k] === 'string'
      ? (formik.errors[k] as string)
      : undefined;

  if (result) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 w-full p-2"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <AdmissionWorkflowBar />
          <button
            onClick={() => router.push('../admission')}
            className="group inline-flex cursor-pointer shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700  transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98]"
          >
            <ChevronLeft className="h-4 w-4 text-slate-500 transition-transform group-hover:-translate-x-0.5" />
            Back to Applications List
          </button>
        </div>

        {/* Success Confirmation Card */}
        <div className="overflow-hidden w-full rounded-2xl border border-slate-200/80 bg-white ">
          {/* Header Banner - Fresh Light Emerald */}
          <div className="bg-linear-to-r from-emerald-50 via-teal-50/80 to-cyan-50/60 border-b border-emerald-100 p-6 sm:p-8 text-slate-900 relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 opacity-5 pointer-events-none">
              <CheckCircle2 className="h-64 w-64 text-emerald-900" />
            </div>
            <div className="relative z-10 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white  ">
                <CheckCircle2 className="h-7 w-7 text-white" />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-bold text-emerald-800  backdrop-blur-sm mb-2">
                  <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" /> Application Record Created
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  Applicant Provisioned Successfully
                </h1>
                <p className="mt-1.5 text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
                  Admission record for{' '}
                  <span className="font-bold text-slate-900 underline decoration-emerald-400 decoration-2">
                    {result.application.candidateName}
                  </span>{' '}
                  is now active under Application{' '}
                  <span className="font-mono font-bold text-emerald-900 bg-emerald-100/70 border border-emerald-200/60 px-2 py-0.5 rounded">
                    {result.application.applicationNumber}
                  </span>
                  .
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Status Delivery Info */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 sm:p-5 flex items-start gap-3.5 text-blue-900">
              <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm leading-relaxed">
                {result.credentialsEmailRequested ? (
                  <>
                    Account credentials and student portal login instructions have been
                    automatically queued for email delivery to{' '}
                    <span className="font-bold text-blue-950 underline">
                      {result.application.email}
                    </span>
                    .
                  </>
                ) : (
                  <>
                    Email notification was{' '}
                    <span className="font-semibold text-slate-700">not requested</span>. Please
                    record the generated ERP Student ID and Temporary Password below and communicate
                    them securely to the applicant.
                  </>
                )}
              </div>
            </div>

            {/* Generated Credentials Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ERP Student ID Card */}
              <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80 p-5 transition-all hover:border-slate-300 hover:bg-white ">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Permanent ERP Student ID
                  </span>
                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                    Active
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="font-mono text-2xl font-black tracking-tight text-slate-900">
                    {result.tempStudentId}
                  </p>
                  <button
                    type="button"
                    onClick={() => copy(result.tempStudentId, 'id')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700  transition-all hover:bg-slate-100 hover:text-primary active:scale-95"
                  >
                    {copiedId ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-slate-600" />
                        <span>Copy ID</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="mt-3 text-xs text-slate-500 leading-relaxed border-t border-slate-200/60 pt-2.5">
                  🔑 Standardized Student Identifier used across academic records, fee invoicing,
                  and exams.
                </p>
              </div>

              {/* Temporary Password Card */}
              {result.tempPassword && (
                <div className="group relative overflow-hidden rounded-xl border border-amber-200/80 bg-amber-50/40 p-5 transition-all hover:border-amber-300 hover:bg-white ">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                      Temporary Access Password
                    </span>
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                      One-time view
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="font-mono text-2xl font-black tracking-wider text-slate-900 select-all">
                      {result.tempPassword}
                    </p>
                    <button
                      type="button"
                      onClick={() => copy(result.tempPassword, 'pass')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900  transition-all hover:bg-amber-100 active:scale-95"
                    >
                      {copiedPass ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-amber-700" />
                          <span>Copy Pass</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-amber-800/80 leading-relaxed border-t border-amber-200/60 pt-2.5">
                    ⚠️ Displayed strictly once. The applicant must change this password upon initial
                    portal login.
                  </p>
                </div>
              )}
            </div>

            {/* Next Action Cards */}
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 mb-3">Choose Next Workflow Step</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => router.push(`../admission/${result.application._id}`)}
                  className="flex flex-col items-start p-4 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition text-left group"
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className="p-2 rounded-lg bg-primary text-white">
                      <FileText className="h-4 w-4" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
                  </div>
                  <span className="text-sm font-bold text-slate-900">
                    Complete Application Form
                  </span>
                  <span className="text-xs text-slate-500 mt-1">
                    Directly enter candidate qualification details, parent info & upload documents
                    now.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => router.push('../admission')}
                  className="flex flex-col items-start p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 transition text-left group"
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                      <UserPlus className="h-4 w-4" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-600 transition-transform group-hover:translate-x-1" />
                  </div>
                  <span className="text-sm font-bold text-slate-900">
                    Return to Applications List
                  </span>
                  <span className="text-xs text-slate-500 mt-1">
                    View status of all initiated and submitted candidate applications.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    formik.resetForm({ values: { ...formik.initialValues } });
                  }}
                  className="flex flex-col items-start p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 transition text-left group"
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                      <BadgeCheck className="h-4 w-4" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-600 transition-transform group-hover:translate-x-1" />
                  </div>
                  <span className="text-sm font-bold text-slate-900">
                    Initiate Another Candidate
                  </span>
                  <span className="text-xs text-slate-500 mt-1">
                    Start a fresh admission initiation form for a new student.
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6 w-full p-2">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AdmissionWorkflowBar />
        <button
          onClick={() => router.back()}
          className="group inline-flex cursor-pointer shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700  transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98]"
        >
          <ChevronLeft className="h-4 w-4 text-slate-600 transition-transform group-hover:-translate-x-0.5" />
          Back
        </button>
      </div>

      {/* Main Guided Form Container */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-200 bg-white  overflow-hidden"
      >
        {/* Page Hero Header & Workflow Guide - Fresh Light linear */}
        <div className="border-b border-slate-200/80 bg-linear-to-br from-blue-50/90 via-sky-50/60 to-indigo-50/40 p-6 sm:p-8 text-slate-900 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-primary/20 text-primary ">
                <UserPlus className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary-700">
                  Admission Portal Management
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  Initiate Candidate Application
                </h1>
              </div>
            </div>
            <p className="mt-2.5 text-sm text-slate-600 w-full flex-wrap leading-relaxed">
              Register basic candidate details to instantly generate a permanent{' '}
              <span className="font-bold text-primary-700 bg-primary/10 px-2 py-0.5 rounded">
                ERP Student ID
              </span>{' '}
              and provision applicant portal login credentials.
            </p>
          </div>
        </div>

        <form onSubmit={formik.handleSubmit} className="p-6 sm:p-8 space-y-8">
          {/* Section 1: Candidate Contact Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <User className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-slate-900">1. Candidate Contact Information</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Full Name */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="block text-sm font-semibold text-slate-800">
                  Candidate Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-600">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    name="candidateName"
                    value={formik.values.candidateName}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    placeholder="Enter full legal name as per 10th/Matric marksheets"
                    className={`w-full rounded-xl border bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900  transition-all focus:outline-none focus:ring-2 ${
                      err('candidateName')
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                        : 'border-slate-300 hover:border-slate-400 focus:border-primary focus:ring-primary/20'
                    }`}
                  />
                </div>
                {err('candidateName') ? (
                  <p className="text-xs font-medium text-red-500">{err('candidateName')}</p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Provide complete legal name without titles (e.g., Rajesh Kumar).
                  </p>
                )}
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-slate-800">
                    Email Address
                  </label>
                  <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                    Optional for walk-in
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-600">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    name="email"
                    type="email"
                    value={formik.values.email}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    placeholder="applicant@example.com"
                    className={`w-full rounded-xl border bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900  transition-all focus:outline-none focus:ring-2 ${
                      err('email')
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                        : 'border-slate-300 hover:border-slate-400 focus:border-primary focus:ring-primary/20'
                    }`}
                  />
                </div>
                {err('email') ? (
                  <p className="text-xs font-medium text-red-500">{err('email')}</p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Required if you choose to email credentials automatically.
                  </p>
                )}
              </div>

              {/* Mobile Phone */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-800">
                  Mobile Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-600">
                    <Phone className="h-4 w-4" />
                  </div>
                  <input
                    name="phone"
                    value={formik.values.phone}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    placeholder="10-digit primary mobile number"
                    className={`w-full rounded-xl border bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900  transition-all focus:outline-none focus:ring-2 ${
                      err('phone')
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                        : 'border-slate-300 hover:border-slate-400 focus:border-primary focus:ring-primary/20'
                    }`}
                  />
                </div>
                {err('phone') ? (
                  <p className="text-xs font-medium text-red-500">{err('phone')}</p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Used for admission SMS updates and identity verification.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Academic Program & Preferences */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <GraduationCap className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-slate-900">
                2. Academic Program &amp; Admission Category
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Academic Year */}
              <div className="space-y-1.5">
                <AsyncSelect
                  type="academicYears"
                  label="Academic Session Year"
                  required
                  value={formik.values.academicYear}
                  onChange={(value) => formik.setFieldValue('academicYear', value ?? '')}
                  placeholder="Select admission academic session"
                  error={err('academicYear')}
                />
              </div>

              {/* Admission Type */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-800">
                  Admission Type <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    name="admissionType"
                    value={formik.values.admissionType}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    className={`w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-slate-900  transition-all focus:outline-none focus:ring-2 ${
                      err('admissionType')
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                        : 'border-slate-300 hover:border-slate-400 focus:border-primary focus:ring-primary/20'
                    }`}
                  >
                    <option value="regular">Regular 1st Year Entry</option>
                    <option value="lateral_entry">Lateral Entry (2nd Year Direct)</option>
                  </select>
                </div>
                {err('admissionType') && (
                  <p className="text-xs font-medium text-red-500">{err('admissionType')}</p>
                )}
              </div>

              {/* Degree Program */}
              <div className=" space-y-1.5">
                <AsyncSelect
                  type="programs"
                  params={{ admissionOnly: true }}
                  label="Degree Programme Preference"
                  required
                  value={formik.values.programPreference}
                  onChange={(value, option) => {
                    void formik.setFieldValue('programPreference', value ?? '');
                    void formik.setFieldValue('preferredDepartmentId', '');
                    setProgrammeCodes({
                      regular:
                        typeof option?.meta?.regularAdmissionCode === 'string'
                          ? option.meta.regularAdmissionCode
                          : undefined,
                      lateral:
                        typeof option?.meta?.lateralAdmissionCode === 'string'
                          ? option.meta.lateralAdmissionCode
                          : undefined,
                    });
                  }}
                  placeholder="Select degree programme (e.g. B.Tech, MCA, MBA)"
                  error={err('programPreference')}
                />
                {formik.values.programPreference &&
                  (formik.values.admissionType === 'lateral_entry'
                    ? programmeCodes.lateral
                    : programmeCodes.regular) && (
                    <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
                      New ERP Student IDs use{' '}
                      <strong>
                        {formik.values.academicYear.slice(2, 4) || 'YY'}
                        {formik.values.admissionType === 'lateral_entry'
                          ? programmeCodes.lateral
                          : programmeCodes.regular}
                        001
                      </strong>{' '}
                      format. The final sequence is generated atomically when the draft is created.
                    </p>
                  )}
              </div>

              {/* Branch / Department */}
              <div className=" space-y-1.5">
                <AsyncSelect
                  type="departments"
                  params={{
                    program: formik.values.programPreference,
                    admissionOnly: true,
                  }}
                  label="Branch (Optional)"
                  value={formik.values.preferredDepartmentId}
                  onChange={(value) => formik.setFieldValue('preferredDepartmentId', value ?? '')}
                  disabled={!formik.values.programPreference}
                  placeholder={
                    formik.values.programPreference
                      ? 'Select preferred branch or department'
                      : '⚠️ Please select a degree programme first'
                  }
                  error={err('preferredDepartmentId')}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Notification & Credentials Options */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-slate-900">
                3. Credentials &amp; Delivery Settings
              </h2>
            </div>

            <div className="space-y-4">
              <label
                className={`flex cursor-pointer items-start gap-4 rounded-xl border p-4.5 transition-all ${
                  formik.values.sendEmail
                    ? 'border-primary-300 bg-white ring-2 ring-primary/10 '
                    : 'border-slate-200 bg-white/60 hover:border-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  name="sendEmail"
                  checked={formik.values.sendEmail}
                  onChange={formik.handleChange}
                  className="mt-1 h-5 w-5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer shrink-0"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold text-slate-900">
                      Send welcome email with generated credentials to applicant
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600">
                    {formik.values.sendEmail ? (
                      <>
                        The ERP Student ID, temporary password and admission portal instructions
                        will be queued for email delivery to{' '}
                        <span className="font-semibold text-slate-900 underline">
                          {formik.values.email || '[Email specified above]'}
                        </span>
                        .
                      </>
                    ) : (
                      <>
                        No email will be sent. Email delivery was not requested. Generated
                        credentials appear only on the next confirmation screen; copy them securely
                        because it cannot be recovered later.
                      </>
                    )}
                  </p>
                </div>
              </label>

              {formik.values.sendEmail && !formik.values.email && (
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 rounded-lg p-3">
                  <Info className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    Please provide candidate email address above to enable automatic email dispatch.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-4 ">
            <div className="w-fit">
              <CustomButton
                variant="cancel"
                type="button"
                onClick={() => router.back()}
                className="px-5 py-2.5 text-sm font-semibold"
              >
                Cancel
              </CustomButton>
            </div>
            <div className="w-fit">
              <CustomButton
                variant="primary"
                type="submit"
                loading={isLoading}
                loadingText="Generating ERP ID &amp; Provisioning..."
                startIcon={<UserPlus className="h-4.5 w-4.5" />}
                className="px-6 py-2.5 text-sm font-bold  "
              >
                Initiate Application Now
              </CustomButton>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default InitiateApplicationPage;

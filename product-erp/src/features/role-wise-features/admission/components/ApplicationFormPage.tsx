/**
 * @file ApplicationFormPage.tsx
 * @description Multi-step online admission application form.
 *
 * Document uploads are placed INLINE next to the field they belong to
 * (Aadhaar upload next to the Aadhaar Number field, Marksheet/Certificate
 * uploads inside each academic-record row, etc.) — never in a separate
 * "Documents" section. Multiple files per docType are supported via the
 * shared `InlineFileUpload` component.
 *
 * Self-service drafts are pre-populated from `GET admission/my-application`
 * so the applicant always sees their saved values when navigating between
 * steps or returning later.
 * @module features/role-wise-features/admission
 */
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'nextjs-toploader/app';
import { useSearchParams } from 'next/navigation';
import { toast } from 'react-toastify';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  User,
  Phone,
  BookOpen,
  Award,
  Upload as UploadIcon,
  Loader2,
  Eye,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import AsyncSelect from '@/shared/core/AsyncSelect';
import AdmissionWorkflowBar from '@/shared/components/AdmissionWorkflowBar';
import InlineFileUpload from '@/shared/core/InlineFileUpload';
import FileViewer, { IViewerFile } from '@/shared/core/FileViewer';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────
interface IAddressValues {
  line1: string;
  line2: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
}

interface IAcademicRecordValues {
  level: string;
  boardOrUniversity: string;
  instituteName: string;
  yearOfPassing: string;
  percentageOfMarks: string;
}

interface IEntranceExamValues {
  exam: string;
  otherName: string;
  applicationNo: string;
  rank: string;
  percentile: string;
  score: string;
  year: string;
}

interface IPaymentValues {
  amountPaid: string;
  transactionId: string;
  paidAt: string;
}

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

interface IFormValues {
  academicYear: string;
  candidateName: string;
  fatherName: string;
  motherName: string;
  dateOfBirth: string;
  gender: string;
  category: string;
  religion: string;
  nationality: string;
  bloodGroup: string;
  aadhaarNumber: string;
  email: string;
  sendCredentialsEmail: boolean;
  phone: string;
  whatsappPhone: string;
  parentPhone: string;
  presentAddress: IAddressValues;
  permanentAddress: IAddressValues;
  sameAddress: boolean;
  academicRecords: IAcademicRecordValues[];
  entranceExam: IEntranceExamValues;
  admissionType: string;
  programPreferences: string[];
  preferredDepartmentId: string;
  declarationAccepted: boolean;
  paymentInfo: IPaymentValues;
}

interface IDocumentChecklistItemDTO {
  docType: string;
  files?: IViewerFile[];
  uploadedFileUrl?: string;
}

interface IApplicationDraft {
  _id?: string;
  academicYear?: string;
  candidateName?: string;
  fatherName?: string;
  motherName?: string;
  dateOfBirth?: string;
  gender?: string;
  category?: string;
  religion?: string;
  nationality?: string;
  bloodGroup?: string;
  aadhaarNumber?: string;
  email?: string;
  phone?: string;
  whatsappPhone?: string;
  parentPhone?: string;
  presentAddress?: Partial<IAddressValues>;
  permanentAddress?: Partial<IAddressValues>;
  academicRecords?: Array<
    Partial<IAcademicRecordValues> & {
      yearOfPassing?: number | string;
      percentageOfMarks?: number | string;
    }
  >;
  entranceExam?: Partial<Record<keyof IEntranceExamValues, string | number>>;
  admissionType?: string;
  programPreferences?: string[];
  preferredDepartmentId?: string | null;
  declarationAccepted?: boolean;
  documentChecklist?: IDocumentChecklistItemDTO[];
  paymentDetails?: {
    amountInNumber?: number;
    transactionId?: string;
    paidAt?: string;
  };
  status?: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 40 }, (_, i) => CURRENT_YEAR - i);

const EMPTY_ADDRESS: IAddressValues = {
  line1: '',
  line2: '',
  city: '',
  district: '',
  state: '',
  pincode: '',
};

const INITIAL: IFormValues = {
  academicYear: (() => {
    const now = new Date();
    const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    return `${year}-${String(year + 1).slice(-2)}`;
  })(),
  candidateName: '',
  fatherName: '',
  motherName: '',
  dateOfBirth: '',
  gender: '',
  category: '',
  religion: '',
  nationality: 'Indian',
  bloodGroup: '',
  aadhaarNumber: '',
  email: '',
  sendCredentialsEmail: false,
  phone: '',
  whatsappPhone: '',
  parentPhone: '',
  presentAddress: { ...EMPTY_ADDRESS },
  permanentAddress: { ...EMPTY_ADDRESS },
  sameAddress: false,
  academicRecords: [
    {
      level: '10th',
      boardOrUniversity: '',
      instituteName: '',
      yearOfPassing: '',
      percentageOfMarks: '',
    },
    {
      level: '12th_or_diploma',
      boardOrUniversity: '',
      instituteName: '',
      yearOfPassing: '',
      percentageOfMarks: '',
    },
  ],
  entranceExam: {
    exam: '',
    otherName: '',
    applicationNo: '',
    rank: '',
    percentile: '',
    score: '',
    year: CURRENT_YEAR.toString(),
  },
  admissionType: 'regular',
  programPreferences: [],
  preferredDepartmentId: '',
  declarationAccepted: false,
  paymentInfo: { amountPaid: '', transactionId: '', paidAt: '' },
};

const STEP_SCHEMAS = [
  Yup.object({
    candidateName: Yup.string().required('Required'),
    fatherName: Yup.string().required('Required'),
    motherName: Yup.string().required('Required'),
    dateOfBirth: Yup.string().required('Required'),
    gender: Yup.string().required('Required'),
    category: Yup.string().required('Required'),
    nationality: Yup.string().required('Required'),
    aadhaarNumber: Yup.string()
      .required('Aadhaar number is required')
      .matches(/^\d{12}$/, 'Aadhaar must be exactly 12 digits'),
    academicYear: Yup.string()
      .matches(/^\d{4}-(?:\d{2}|\d{4})$/, 'Select a valid academic year')
      .required('Required'),
    admissionType: Yup.string().oneOf(['regular', 'lateral_entry']).required('Required'),
    programPreferences: Yup.array().min(1, 'Select a programme / curriculum'),
  }),
  Yup.object({
    email: Yup.string().email('Invalid email').required('Required'),
    phone: Yup.string().min(10, 'Min 10 digits').required('Required'),
    presentAddress: Yup.object({
      line1: Yup.string().required('Required'),
      city: Yup.string().required('Required'),
      state: Yup.string().required('Required'),
      pincode: Yup.string().required('Required'),
    }),
    permanentAddress: Yup.object({
      line1: Yup.string().required('Required'),
      city: Yup.string().required('Required'),
      state: Yup.string().required('Required'),
      pincode: Yup.string().required('Required'),
    }),
  }),
  Yup.object({
    academicRecords: Yup.array()
      .of(
        Yup.object({
          boardOrUniversity: Yup.string().required('Board/University is required'),
          instituteName: Yup.string().required('Institute name is required'),
          yearOfPassing: Yup.string().required('Year of passing is required'),
          percentageOfMarks: Yup.number()
            .typeError('Percentage must be a number')
            .min(0, 'Percentage must be between 0 and 100')
            .max(100, 'Percentage must be between 0 and 100')
            .required('Percentage of marks is required (0-100)'),
        }),
      )
      .min(1),
  }),
  Yup.object({
    entranceExam: Yup.object({
      exam: Yup.string().required('Entrance exam is required'),
      year: Yup.string().required('Exam year is required'),
      percentile: Yup.number()
        .typeError('Percentile must be a number')
        .min(0, 'Percentile must be between 0 and 100')
        .max(100, 'Percentile must be between 0 and 100')
        .nullable()
        .optional(),
      rank: Yup.number()
        .typeError('Rank must be a number')
        .min(1, 'Min rank is 1')
        .nullable()
        .optional(),
    }),
  }),
  // Step 4 (Documents) - enforced via custom check in handleNext.
  Yup.object({}),
  // Step 5 (Payment) - all optional; if not filled, treated as unpaid.
  Yup.object({}),
  // Step 6 (Review & Submit) - validation for Program Preferences & Declaration
  Yup.object({
    programPreferences: Yup.array().min(1, 'Select at least one program'),
    declarationAccepted: Yup.boolean().oneOf([true], 'You must accept the declaration'),
  }),
];

function getInitialResumeStep(values: IFormValues, docMap: Record<string, IViewerFile[]>): number {
  for (let s = 0; s < STEP_SCHEMAS.length - 1; s++) {
    const schema = STEP_SCHEMAS[s];
    if (s === 4) {
      const hasDocs = Object.values(docMap).some((list) => list.length > 0);
      if (!hasDocs) return s;
    } else {
      try {
        schema.validateSync(values, { abortEarly: true });
      } catch {
        return s;
      }
    }
  }
  return STEP_SCHEMAS.length - 1;
}

const STEPS = [
  { label: 'Personal', icon: <User className="h-4 w-4" /> },
  { label: 'Contact', icon: <Phone className="h-4 w-4" /> },
  { label: 'Academic', icon: <BookOpen className="h-4 w-4" /> },
  { label: 'Entrance', icon: <Award className="h-4 w-4" /> },
  { label: 'Documents', icon: <UploadIcon className="h-4 w-4" /> },
  { label: 'Payment', icon: <Check className="h-4 w-4" /> },
  { label: 'Review & Submit', icon: <Eye className="h-4 w-4" /> },
];

const DOC = {
  PASSPORT_PHOTO: 'passport_photo',
  AADHAAR: 'aadhaar_card',
  HSC_TENTH_MARKSHEET: 'hsc_10th_marksheet',
  HSC_TENTH_CERTIFICATE: 'hsc_10th_certificate',
  PLUS_TWO_MARKSHEET: 'plus_two_marksheet',
  PLUS_TWO_CERTIFICATE: 'plus_two_certificate',
  PLUS_THREE_MARKSHEET: 'plus_three_marksheet',
  PLUS_THREE_CERTIFICATE: 'plus_three_certificate',
  LEAVING: 'school_leaving_certificate',
  CASTE: 'caste_certificate',
  INCOME: 'income_certificate',
  RESIDENCE: 'residence_certificate',
  ANTI_RAGGING_STUDENT: 'anti_ragging_student',
  ANTI_RAGGING_GUARDIAN: 'anti_ragging_guardian',
  APAAR_ID: 'apaar_id',
  PAYMENT_PROOF: 'payment_proof',
  ENTRANCE_EXAM_RESULT: 'entrance_exam_result',
} as const;

/**
 * Document requirements rendered in the Documents step. Each row maps to a
 * docType in the backend admission schema. `mandatory` blocks submission when
 * empty (for self-service drafts). `pgOnly` rows render only when the applicant
 * has selected a postgraduate program preference.
 */
const DOCUMENT_REQUIREMENTS: ReadonlyArray<{
  docType: string;
  label: string;
  hint?: string;
  mandatory: boolean;
  pgOnly?: boolean;
  casteOnly?: boolean;
}> = [
  {
    docType: DOC.PASSPORT_PHOTO,
    label: 'Passport-Size Photo',
    hint: 'Recent color photograph with light background (JPG/PNG)',
    mandatory: true,
  },
  {
    docType: DOC.AADHAAR,
    label: 'Aadhaar Card',
    hint: 'Upload both front and back combined or multiple sheets',
    mandatory: true,
  },
  {
    docType: DOC.HSC_TENTH_MARKSHEET,
    label: '10th / Matriculation Marksheet',
    mandatory: true,
  },
  {
    docType: DOC.HSC_TENTH_CERTIFICATE,
    label: '10th / Matriculation Pass Certificate',
    mandatory: true,
  },
  {
    docType: DOC.PLUS_TWO_MARKSHEET,
    label: '12th / Diploma Marksheet',
    mandatory: true,
  },
  {
    docType: DOC.PLUS_TWO_CERTIFICATE,
    label: '12th / Diploma Pass Certificate',
    mandatory: true,
  },
  {
    docType: DOC.LEAVING,
    label: 'School / College Leaving Certificate (CLC)',
    hint: 'Original mandatory at the time of physical reporting',
    mandatory: true,
  },
  {
    docType: DOC.PLUS_THREE_MARKSHEET,
    label: '+3 / B.Tech Marksheet',
    hint: 'Required for MBA / MCA applicants only',
    mandatory: true,
    pgOnly: true,
  },
  {
    docType: DOC.PLUS_THREE_CERTIFICATE,
    label: '+3 / B.Tech / Degree Pass Certificate',
    hint: 'Required for MBA / MCA applicants only',
    mandatory: true,
    pgOnly: true,
  },
  {
    docType: DOC.CASTE,
    label: 'Caste Certificate',
    hint: 'Mandatory for SC / ST / OBC / SEBC / PH applicants only',
    mandatory: true,
    casteOnly: true,
  },
  {
    docType: DOC.RESIDENCE,
    label: 'Residence Certificate',
    hint: 'Mandatory for SC / ST / OBC / SEBC / PH applicants only',
    mandatory: true,
    casteOnly: true,
  },
  {
    docType: DOC.INCOME,
    label: 'Income Certificate',
    hint: 'Mandatory for SC / ST / OBC / SEBC / PH applicants only',
    mandatory: true,
    casteOnly: true,
  },
  {
    docType: DOC.ANTI_RAGGING_STUDENT,
    label: 'Anti-Ragging Affidavit (Student)',
    mandatory: false,
  },
  {
    docType: DOC.ANTI_RAGGING_GUARDIAN,
    label: 'Anti-Ragging Affidavit (Guardian)',
    mandatory: false,
  },
  {
    docType: DOC.APAAR_ID,
    label: 'APAAR ID / ABC ID card',
    mandatory: false,
  },
  {
    docType: DOC.ENTRANCE_EXAM_RESULT,
    label: 'Entrance Exam Rank / Score Card',
    hint: 'Upload JEE Main, OJEE, GATE, CAT, MAT or other entrance scorecard',
    mandatory: true,
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const programmeLabel = (code: string): string => {
  if (!code) return '—';
  return code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

function Field({
  label,
  error,
  children,
  required,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';
const selectCls = inputCls;

function toFormValues(raw: IApplicationDraft | undefined): IFormValues {
  if (!raw) return INITIAL;
  const dob = raw.dateOfBirth ? String(raw.dateOfBirth).slice(0, 10) : '';
  const records: IAcademicRecordValues[] =
    Array.isArray(raw.academicRecords) && raw.academicRecords.length
      ? raw.academicRecords.map((x) => ({
          level: String(x.level ?? '10th'),
          boardOrUniversity: String(x.boardOrUniversity ?? ''),
          instituteName: String(x.instituteName ?? ''),
          yearOfPassing: x.yearOfPassing != null ? String(x.yearOfPassing) : '',
          percentageOfMarks: x.percentageOfMarks != null ? String(x.percentageOfMarks) : '',
        }))
      : INITIAL.academicRecords;
  const ent = raw.entranceExam ?? {};
  const present: IAddressValues = { ...EMPTY_ADDRESS, ...(raw.presentAddress ?? {}) };
  const permanent: IAddressValues = { ...EMPTY_ADDRESS, ...(raw.permanentAddress ?? {}) };
  const sameAddress =
    !!raw.permanentAddress && JSON.stringify(present) === JSON.stringify(permanent);
  return {
    candidateName: String(raw.candidateName ?? ''),
    fatherName: String(raw.fatherName ?? ''),
    motherName: String(raw.motherName ?? ''),
    dateOfBirth: dob,
    gender: String(raw.gender ?? ''),
    category: String(raw.category ?? ''),
    religion: String(raw.religion ?? ''),
    nationality: String(raw.nationality ?? 'Indian'),
    bloodGroup: String(raw.bloodGroup ?? ''),
    aadhaarNumber: String(raw.aadhaarNumber ?? ''),
    email: String(raw.email ?? ''),
    sendCredentialsEmail: false,
    phone: String(raw.phone ?? ''),
    whatsappPhone: String(raw.whatsappPhone ?? ''),
    parentPhone: String(raw.parentPhone ?? ''),
    presentAddress: present,
    permanentAddress: permanent,
    sameAddress,
    academicRecords: records,
    entranceExam: {
      exam: String(ent.exam ?? ''),
      otherName: String(ent.otherName ?? ''),
      applicationNo: String(ent.applicationNo ?? ''),
      rank: ent.rank != null ? String(ent.rank) : '',
      percentile: ent.percentile != null ? String(ent.percentile) : '',
      score: ent.score != null ? String(ent.score) : '',
      year: ent.year != null ? String(ent.year) : new Date().getFullYear().toString(),
    },
    academicYear: String(raw.academicYear ?? INITIAL.academicYear),
    admissionType: String(raw.admissionType ?? 'regular'),
    programPreferences: Array.isArray(raw.programPreferences) ? raw.programPreferences : [],
    preferredDepartmentId: String(raw.preferredDepartmentId ?? ''),
    declarationAccepted: Boolean(raw.declarationAccepted),
    paymentInfo: {
      amountPaid:
        raw.paymentDetails?.amountInNumber != null ? String(raw.paymentDetails.amountInNumber) : '',
      transactionId: String(raw.paymentDetails?.transactionId ?? ''),
      paidAt: raw.paymentDetails?.paidAt ? String(raw.paymentDetails.paidAt).slice(0, 10) : '',
    },
  };
}

function buildDocMap(raw: IApplicationDraft | undefined): Record<string, IViewerFile[]> {
  const map: Record<string, IViewerFile[]> = {};
  const list = raw?.documentChecklist ?? [];
  list.forEach((d) => {
    if (Array.isArray(d.files) && d.files.length) {
      map[d.docType] = d.files;
    } else if (d.uploadedFileUrl) {
      map[d.docType] = [{ url: d.uploadedFileUrl }];
    }
  });
  return map;
}

interface IApplicationFormPageProps {
  /**
   * When true the form is rendered for an applicant editing THEIR OWN draft:
   * - prefills via GET admission/my-application
   * - saves via PATCH admission/my-application
   * - submits via POST admission/my-application/submit
   * Otherwise it behaves as the admin/public single-shot POST admission/apply flow.
   */
  selfService?: boolean;
}

interface IMutationResult {
  results?: {
    success?: boolean;
    message?: string;
    error?: string | { message?: string; title?: string; details?: string };
    data?: {
      applicationNumber?: string;
      docType?: string;
      files?: IViewerFile[];
      uploadedFileUrl?: string;
    };
  };
}

// ──────────────────────────────────────────────────────────────────────────────
export default function ApplicationFormPage({ selfService = false }: IApplicationFormPageProps) {
  const [step, setStep] = useState(0);
  const [maxReachedStep, setMaxReachedStep] = useState(0);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetAppId = searchParams.get('appId') || searchParams.get('applicationId');
  // Keep navigation/submit loading state separate from upload loading state
  // so the Next button doesn't spin every time the applicant uploads a file.
  const { mutation: uploadMutation } = useMutation();
  const { mutation: navMutation, isLoading: navLoading } = useMutation();
  // `useSwr` returns the JSON envelope `{ success, data: {...} }` — unwrap to
  // the actual application object. Falls back to the value itself if a route
  // ever returns it unwrapped.
  const swrPath = selfService
    ? 'admission/my-application'
    : targetAppId
      ? `admission/applications/${targetAppId}`
      : null;
  const { data: draftResp, mutate: mutateDraft } = useSwr<
    { data?: IApplicationDraft } | IApplicationDraft
  >(swrPath);
  const { data: paymentSettingsResp } = useSwr<{ data?: IPaymentSettings }>(
    'payment-settings/active',
  );
  const { data: programmesResp } = useSwr<{
    data?: Array<{
      value: string;
      label: string;
      academicLevel: 'certificate' | 'diploma' | 'undergraduate' | 'postgraduate' | 'doctoral';
    }>;
  }>('admission/programs');
  const draft: IApplicationDraft | undefined =
    (draftResp as { data?: IApplicationDraft } | undefined)?.data ??
    (draftResp as IApplicationDraft | undefined);
  const paymentSettings = paymentSettingsResp?.data;
  const programmeLevels = useMemo(
    () =>
      new Map(
        (programmesResp?.data ?? []).map((programme) => [programme.value, programme.academicLevel]),
      ),
    [programmesResp],
  );
  const requiresDegreeDocuments = (programmes: string[]) =>
    programmes.some((programme) =>
      ['postgraduate', 'doctoral'].includes(programmeLevels.get(programme) ?? ''),
    );

  const [docs, setDocs] = useState<Record<string, IViewerFile[]>>({});
  const [stagedFiles, setStagedFiles] = useState<Record<string, File[]>>({});
  const [isUploadingBatch, setIsUploadingBatch] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  // Drives `enableReinitialize` so Formik picks up the draft values exactly
  // once per application id. Mutated only inside the prefill effect below.
  const [initialValues, setInitialValues] = useState<IFormValues>(INITIAL);

  const formik = useFormik<IFormValues>({
    initialValues,
    enableReinitialize: true,
    validationSchema: STEP_SCHEMAS[step],
    validateOnChange: true,
    validateOnBlur: true,
    onSubmit: async (values) => {
      const payload = buildPayload(values, selfService);

      // selfService MUST be checked first — in the admission portal the URL
      // may contain ?appId=... (from a prefill or previous navigation) but the
      // submit must always go through the applicant's own /my-application routes.
      if (selfService) {
        const patchRes = (await navMutation('admission/my-application', {
          method: 'PATCH',
          body: payload,
          silentError: true,
          returnError: true,
        })) as IMutationResult & { status?: number };
        if (!patchRes?.results?.success) {
          const msg =
            (patchRes?.results as { message?: string } | undefined)?.message ||
            'Failed to save your application. Please review and try again.';
          toast.error(msg);
          return;
        }
        const submitRes = (await navMutation('admission/my-application/submit', {
          method: 'POST',
          silentError: true,
          returnError: true,
        })) as IMutationResult & { status?: number };
        if (submitRes?.results?.success) {
          toast.success('Application submitted! Our admission cell will review it shortly.');
          setJustSubmitted(true);
          // Re-fetch the draft so the portal page sees the new SUBMITTED status
          // and switches to ApplicantStatusPage on the next render.
          await mutateDraft();
          router.replace('/admission-portal?submitted=1');
        } else {
          const errMsg =
            (submitRes?.results as { message?: string } | undefined)?.message ||
            (submitRes?.results as { error?: { message?: string } | string } | undefined)?.error;
          const errorText =
            typeof errMsg === 'string'
              ? errMsg
              : errMsg?.message || 'Could not submit your application. Please try again.';
          toast.error(errorText, { autoClose: 8000 });
        }
        return;
      }

      const activeId = targetAppId || adminDraftId;
      if (activeId) {
        const patchRes = (await navMutation(`admission/applications/${activeId}`, {
          method: 'PATCH',
          body: {
            ...payload,
            status: 'submitted',
          },
          silentError: true,
          returnError: true,
        })) as IMutationResult;
        if (patchRes?.results?.success) {
          toast.success('Application form submitted successfully!');
          router.push(`../admission/${activeId}`);
        } else {
          const errMsg =
            (patchRes?.results as { message?: string } | undefined)?.message ||
            (patchRes?.results as { error?: { message?: string } | string } | undefined)?.error;
          const errorText =
            typeof errMsg === 'string'
              ? errMsg
              : errMsg?.message ||
                'Failed to submit application form. Please review and try again.';
          toast.error(errorText, { autoClose: 8000 });
        }
        return;
      }

      const res = (await navMutation('admission/apply', {
        method: 'POST',
        body: payload,
      })) as IMutationResult;
      if (res?.results?.success) {
        const appNo = res.results.data?.applicationNumber;
        toast.success(`Application submitted! Number: ${appNo ?? ''}`);
        router.push(`../admission`);
      } else {
        toast.error('Submission failed. Please check the form and try again.');
      }
    },
  });

  // Prefill from the applicant's saved draft EXACTLY ONCE per application id.
  const prefilledIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!draft) return;
    const id = draft._id ?? targetAppId ?? 'self';
    if (prefilledIdRef.current === id) {
      setDocs(buildDocMap(draft));
      return;
    }
    prefilledIdRef.current = id;
    const initialFormValues = toFormValues(draft);
    const docMap = buildDocMap(draft);
    setInitialValues(initialFormValues);
    setDocs(docMap);
    const resumeStep = getInitialResumeStep(initialFormValues, docMap);
    setStep(resumeStep);
    setMaxReachedStep(resumeStep);
  }, [draft, selfService, targetAppId]);

  // ─── Document upload helpers ──────────────────────────────────────────────
  const uploadDoc = async (docType: string, file: File): Promise<boolean> => {
    const activeId = targetAppId || adminDraftId;
    const uploadUrl = activeId
      ? `admission/applications/${activeId}/documents/${docType}`
      : selfService
        ? `admission/my-application/documents/${docType}`
        : null;

    if (!uploadUrl) {
      toast.info('Sign in via the credentials emailed to you, then upload here.');
      return false;
    }
    const fd = new FormData();
    fd.append('document', file);
    const res = (await uploadMutation(uploadUrl, {
      method: 'POST',
      isFormData: true,
      body: fd,
    })) as IMutationResult;
    if (res?.results?.success) {
      const updated = res.results.data;
      const newList: IViewerFile[] =
        updated?.files && updated.files.length
          ? updated.files
          : [
              ...(docs[docType] ?? []),
              ...(updated?.uploadedFileUrl
                ? [{ url: updated.uploadedFileUrl, name: file.name }]
                : []),
            ];
      setDocs((prev) => ({ ...prev, [docType]: newList }));
      mutateDraft();
      return true;
    }
    return false;
  };

  const removeDoc = async (docType: string, file: IViewerFile, silent = false) => {
    const activeId = targetAppId || adminDraftId;
    const uploadUrl = activeId
      ? `admission/applications/${activeId}/documents/${docType}`
      : selfService
        ? `admission/my-application/documents/${docType}`
        : null;
    if (!uploadUrl) return;

    const publicId = (file as IViewerFile & { publicId?: string }).publicId;
    const path = publicId ? `${uploadUrl}?publicId=${encodeURIComponent(publicId)}` : uploadUrl;
    const res = (await uploadMutation(path, { method: 'DELETE' })) as IMutationResult;
    if (res?.results?.success) {
      const remaining = res.results.data?.files ?? [];
      setDocs((prev) => ({ ...prev, [docType]: remaining }));
      mutateDraft();
      if (!silent) toast.info('Document removed');
    } else if (!silent) {
      toast.error('Could not remove the document.');
    }
  };

  const stageDoc = (docType: string, file: File) => {
    const isMultiple =
      docType === DOC.AADHAAR ||
      docType === DOC.HSC_TENTH_MARKSHEET ||
      docType === DOC.PLUS_TWO_MARKSHEET ||
      docType === DOC.PLUS_THREE_MARKSHEET;
    if (!isMultiple) {
      setStagedFiles((prev) => ({ ...prev, [docType]: [file] }));
    } else {
      setStagedFiles((prev) => ({ ...prev, [docType]: [...(prev[docType] ?? []), file] }));
    }
  };

  const unstageDoc = (docType: string, fileIndex: number) => {
    setStagedFiles((prev) => {
      const list = prev[docType] ?? [];
      const updated = list.filter((_, idx) => idx !== fileIndex);
      return { ...prev, [docType]: updated };
    });
  };

  const handleBatchUpload = async (): Promise<Record<string, IViewerFile[]> | null> => {
    setIsUploadingBatch(true);
    setUploadProgressText('Preparing files...');
    setUploadProgress({ current: 0, total: 0 });
    try {
      const stagedEntries = Object.entries(stagedFiles).filter(([, list]) => list.length > 0);
      let index = 0;
      const total = stagedEntries.reduce((acc, [, list]) => acc + list.length, 0);
      const nextDocs: Record<string, IViewerFile[]> = { ...docs };
      setUploadProgress({ current: 0, total });

      const activeId = targetAppId || adminDraftId;
      const baseUploadUrl = activeId
        ? `admission/applications/${activeId}/documents`
        : selfService
          ? `admission/my-application/documents`
          : null;

      if (!baseUploadUrl) {
        toast.error('Application draft reference missing. Please try again.');
        return null;
      }

      for (const [docType, list] of stagedEntries) {
        const isMultiple =
          docType === DOC.AADHAAR ||
          docType === DOC.HSC_TENTH_MARKSHEET ||
          docType === DOC.PLUS_TWO_MARKSHEET ||
          docType === DOC.PLUS_THREE_MARKSHEET;
        const currentFiles = docs[docType] ?? [];
        if (!isMultiple && currentFiles.length > 0) {
          await removeDoc(docType, currentFiles[0], true);
          nextDocs[docType] = [];
        }

        for (const file of list) {
          index++;
          setUploadProgress({ current: index, total });
          setUploadProgressText(
            `Uploading ${docType.replace(/_/g, ' ')} (${index} of ${total})...`,
          );
          const fd = new FormData();
          fd.append('document', file);
          const res = (await uploadMutation(`${baseUploadUrl}/${docType}`, {
            method: 'POST',
            isFormData: true,
            body: fd,
          })) as IMutationResult;
          if (!res?.results?.success) {
            toast.error(`Failed to upload "${file.name}"`);
            return null;
          }
          const updated = res.results.data;
          nextDocs[docType] =
            updated?.files && updated.files.length
              ? updated.files
              : [
                  ...(nextDocs[docType] ?? []),
                  ...(updated?.uploadedFileUrl
                    ? [{ url: updated.uploadedFileUrl, name: file.name }]
                    : []),
                ];
        }
      }
      setDocs(nextDocs);
      setStagedFiles({});
      mutateDraft();
      return nextDocs;
    } catch (error) {
      console.error(error);
      toast.error('An error occurred during upload.');
      return null;
    } finally {
      setIsUploadingBatch(false);
      setUploadProgressText('');
      setUploadProgress({ current: 0, total: 0 });
    }
  };

  const docFiles = (docType: string): IViewerFile[] => docs[docType] ?? [];

  // Shared FileViewer state — single instance reused by every inline View pill.
  const [viewerFiles, setViewerFiles] = useState<IViewerFile[]>([]);
  const [viewerTitle, setViewerTitle] = useState<string | undefined>(undefined);
  const [viewerIdx, setViewerIdx] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerAction, setViewerAction] = useState<{
    label: string;
    onClick: () => void;
  } | null>(null);
  const viewerBlobUrls = useRef<string[]>([]);
  const docInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const clearViewerBlobs = () => {
    viewerBlobUrls.current.forEach((url) => URL.revokeObjectURL(url));
    viewerBlobUrls.current = [];
  };

  const closeViewer = () => {
    setViewerOpen(false);
    setViewerAction(null);
    clearViewerBlobs();
  };

  const openViewer = (
    files: IViewerFile[],
    title?: string,
    idx = 0,
    action?: { label: string; onClick: () => void },
  ) => {
    if (!files.length) return;
    setViewerFiles(files);
    setViewerTitle(title);
    setViewerIdx(idx);
    setViewerAction(action ?? null);
    setViewerOpen(true);
  };

  const openStagedViewer = (docType: string, label: string, files: File[], idx = 0) => {
    if (!files.length) return;
    clearViewerBlobs();
    const viewerList = files.map((file) => {
      const url = URL.createObjectURL(file);
      viewerBlobUrls.current.push(url);
      return { url, name: file.name, mimeType: file.type };
    });
    openViewer(
      viewerList,
      label,
      idx,
      files.length === 1
        ? {
            label: 'Replace file',
            onClick: () => {
              closeViewer();
              docInputRefs.current[docType]?.click();
            },
          }
        : undefined,
    );
  };

  const [adminDraftId, setAdminDraftId] = useState<string | null>(null);
  const activeAppId = targetAppId || adminDraftId;

  const autosaveDraft = async (): Promise<boolean> => {
    if (selfService) {
      const payload = buildPayload(formik.values, true, /*partial*/ true);
      const res = (await navMutation('admission/my-application', {
        method: 'PATCH',
        body: payload,
      })) as IMutationResult;
      return !!res?.results?.success;
    }

    const payload = buildPayload(formik.values, false, /*partial*/ true);

    if (activeAppId) {
      const res = (await navMutation(`admission/applications/${activeAppId}`, {
        method: 'PATCH',
        body: payload,
      })) as IMutationResult;
      return !!res?.results?.success;
    }

    // Admin direct creation flow (selfService = false)
    if (formik.values.candidateName && formik.values.phone && formik.values.programPreferences[0]) {
      const res = (await navMutation('admission/initiate', {
        method: 'POST',
        body: {
          candidateName: formik.values.candidateName,
          email: formik.values.email || undefined,
          phone: formik.values.phone,
          admissionType: formik.values.admissionType || 'regular',
          programPreference: formik.values.programPreferences[0],
          preferredDepartmentId: formik.values.preferredDepartmentId || undefined,
          academicYear: formik.values.academicYear,
          sendEmail: formik.values.sendCredentialsEmail,
        },
      })) as IMutationResult;
      if (res?.results?.success) {
        const createdId = (res.results.data as unknown as { application?: { _id?: string } })
          ?.application?._id;
        if (!createdId) return false;

        // Preserve the newly-created draft across refreshes without remounting or
        // reinitialising the active form. The initiate endpoint stores only the
        // minimum identity fields, so persist every value entered in Steps 1–2
        // immediately before allowing navigation to continue.
        prefilledIdRef.current = createdId;
        setAdminDraftId(createdId);
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('appId', createdId);
        window.history.replaceState(window.history.state, '', currentUrl);

        const saveRes = (await navMutation(`admission/applications/${createdId}`, {
          method: 'PATCH',
          body: payload,
        })) as IMutationResult;
        const saved = !!saveRes?.results?.success;
        if (saved && formik.values.sendCredentialsEmail) {
          toast.success(`Login credentials were queued for delivery to ${formik.values.email}.`);
        }
        return saved;
      }
      return false;
    }
    return true;
  };

  const [stepSubmitted, setStepSubmitted] = useState(false);

  const handleNext = async () => {
    const errors = await formik.validateForm();
    if (Object.keys(errors).length > 0) {
      setStepSubmitted(true);
      // Build a nested touched tree from dotted error paths so nested
      // (e.g. `presentAddress.line1`) errors render in the UI.
      const touched: Record<string, unknown> = {};
      const markTouched = (obj: unknown, prefix = '') => {
        if (!obj || typeof obj !== 'object') return;
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          const path = prefix ? `${prefix}.${k}` : k;
          if (v && typeof v === 'object' && !Array.isArray(v)) {
            markTouched(v, path);
          } else if (Array.isArray(v)) {
            v.forEach((item, idx) => markTouched(item, `${path}.${idx}`));
          } else {
            // Assign nested true into the touched tree.
            const parts = path.split('.');
            let cur: Record<string, unknown> = touched;
            for (let i = 0; i < parts.length - 1; i++) {
              const p = parts[i];
              const next = cur[p];
              if (!next || typeof next !== 'object') cur[p] = {};
              cur = cur[p] as Record<string, unknown>;
            }
            cur[parts[parts.length - 1]] = true;
          }
        }
      };
      markTouched(errors);
      formik.setTouched(touched as never, true);
      // If the declaration box is the only thing blocking, scroll down to it.
      if (errors.declarationAccepted) {
        setTimeout(() => {
          document
            .getElementById('declaration-section')
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
      toast.error('Please fill in all required fields before proceeding.');
      return;
    }
    setStepSubmitted(false);
    // Step 4 (Documents) — run batch upload & enforce mandatory uploads.
    if (step === 4) {
      const hasStaged = Object.values(stagedFiles).some((list) => list.length > 0);
      let effectiveDocs = docs;
      if (hasStaged) {
        const uploadedDocs = await handleBatchUpload();
        if (!uploadedDocs) return;
        effectiveDocs = uploadedDocs;
      }

      const isPg = requiresDegreeDocuments(f.values.programPreferences);
      const isCaste = f.values.category && f.values.category !== 'general';
      const missing = DOCUMENT_REQUIREMENTS.filter(
        (d) => d.mandatory && (!d.pgOnly || isPg) && (!d.casteOnly || isCaste),
      ).filter((d) => (effectiveDocs[d.docType] ?? []).length === 0);

      if (missing.length) {
        toast.error(`Please upload: ${missing.map((d) => d.label).join(', ')}`);
        return;
      }
    }
    if (step < STEPS.length - 1) {
      const ok = await autosaveDraft();
      if (!ok) {
        toast.error('Could not save your progress. Please try again.');
        return;
      }
      setStep((s) => {
        const next = s + 1;
        setMaxReachedStep((prev) => Math.max(prev, next));
        return next;
      });
    } else {
      formik.handleSubmit();
    }
  };

  const f = formik;
  const err = (path: string): string | undefined => {
    const parts = path.split('.');
    let e: unknown = f.errors;
    let t: unknown = f.touched;
    for (const p of parts) {
      e = (e as Record<string, unknown> | undefined)?.[p];
      t = (t as Record<string, unknown> | undefined)?.[p];
    }
    const errorMsg =
      typeof e === 'string' ? e : Array.isArray(e) && typeof e[0] === 'string' ? e[0] : undefined;
    return (t || stepSubmitted) && errorMsg ? errorMsg : undefined;
  };

  const syncPermanent = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (f.values.sameAddress) {
      const field = e.target.name.replace('presentAddress.', 'permanentAddress.');
      f.setFieldValue(field, e.target.value);
    }
    f.handleChange(e);
  };

  if (justSubmitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 border-2 border-emerald-200">
          <svg
            className="h-10 w-10 text-emerald-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Application Submitted!</h2>
          <p className="mt-2 text-sm text-slate-500 max-w-sm">
            Your application has been received. Redirecting you to your status page…
          </p>
        </div>
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5 mb-20">
      {!selfService && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4  sm:px-7">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-bold text-slate-900 sm:text-2xl">
                New Admission Application
              </h1>
              <span className="hidden rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary sm:inline-flex">
                Guided application
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
              Create and complete the applicant’s admission record step by step.
            </p>
          </div>
          <button
            onClick={() => router.back()}
            className="group inline-flex h-10 cursor-pointer shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:border-primary/30 hover:bg-primary-50 hover:text-primary active:scale-[0.98]"
          >
            <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Back
          </button>
        </div>
      )}
      {!selfService && <AdmissionWorkflowBar />}
      {selfService && (
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Complete Your Application</h1>
          <p className="text-sm text-slate-500">
            Fill in the remaining details to submit your application for review.
          </p>
        </div>
      )}

      {/* Step Indicator */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4  sm:px-7">
        {STEPS.map((s, i) => {
          const isCurrent = i === step;
          const isCompleted = i < step;
          const isReachable = i <= maxReachedStep;
          return (
            <React.Fragment key={s.label}>
              <button
                type="button"
                onClick={() => {
                  if (isReachable) {
                    setStepSubmitted(false);
                    setStep(i);
                  }
                }}
                className={`flex flex-col items-center gap-1 ${isReachable ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold  transition-all ${
                    isCurrent
                      ? 'bg-primary text-white ring-2 ring-primary ring-offset-2'
                      : isCompleted
                        ? 'bg-secondary text-white'
                        : isReachable
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : s.icon}
                </div>
                <span
                  className={`hidden text-[10px] font-medium sm:block ${
                    isCurrent
                      ? 'text-primary font-bold'
                      : isCompleted
                        ? 'text-secondary'
                        : isReachable
                          ? 'text-slate-700 font-semibold'
                          : 'text-slate-600'
                  }`}
                >
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-1 ${isCompleted ? 'bg-secondary' : 'bg-slate-100'}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="rounded-2xl border border-slate-200 bg-white p-5  sm:p-6"
        >
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">Personal Information</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Candidate Full Name" error={err('candidateName')} required>
                  <input
                    name="candidateName"
                    value={f.values.candidateName}
                    onChange={f.handleChange}
                    onBlur={f.handleBlur}
                    placeholder="As per 10th certificate"
                    className={inputCls}
                  />
                </Field>
                <Field label="Father's Name" error={err('fatherName')} required>
                  <input
                    name="fatherName"
                    value={f.values.fatherName}
                    onChange={f.handleChange}
                    onBlur={f.handleBlur}
                    className={inputCls}
                  />
                </Field>
                <Field label="Mother's Name" error={err('motherName')} required>
                  <input
                    name="motherName"
                    value={f.values.motherName}
                    onChange={f.handleChange}
                    onBlur={f.handleBlur}
                    className={inputCls}
                  />
                </Field>
                <Field label="Date of Birth" error={err('dateOfBirth')} required>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={f.values.dateOfBirth}
                    onChange={f.handleChange}
                    onBlur={f.handleBlur}
                    className={inputCls}
                  />
                </Field>
                <Field label="Gender" error={err('gender')} required>
                  <select
                    name="gender"
                    value={f.values.gender}
                    onChange={f.handleChange}
                    className={selectCls}
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </Field>

                <Field label="Category" error={err('category')} required>
                  <select
                    name="category"
                    value={f.values.category}
                    onChange={f.handleChange}
                    className={selectCls}
                  >
                    <option value="">Select</option>
                    <option value="general">General</option>
                    <option value="obc">OBC</option>
                    <option value="sc">SC</option>
                    <option value="st">ST</option>
                    <option value="sebc">SEBC</option>
                    <option value="ph">PH</option>
                  </select>
                </Field>

                <Field label="Religion">
                  <input
                    name="religion"
                    value={f.values.religion}
                    onChange={f.handleChange}
                    className={inputCls}
                  />
                </Field>
                <Field label="Nationality" error={err('nationality')} required>
                  <input
                    name="nationality"
                    value={f.values.nationality}
                    onChange={f.handleChange}
                    className={inputCls}
                  />
                </Field>
                <Field label="Blood Group">
                  <select
                    name="bloodGroup"
                    value={f.values.bloodGroup}
                    onChange={f.handleChange}
                    className={selectCls}
                  >
                    <option value="">Select</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Aadhaar Number" error={err('aadhaarNumber')} required>
                  <input
                    name="aadhaarNumber"
                    value={f.values.aadhaarNumber}
                    onChange={f.handleChange}
                    placeholder="12-digit number"
                    maxLength={12}
                    className={inputCls}
                  />
                </Field>
              </div>

              {!selfService && !activeAppId && (
                <div className="space-y-4 rounded-2xl border border-primary-100 bg-primary-50/40 p-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Programme &amp; Branch</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Select the curriculum for this direct admission before continuing.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {selfService ? (
                      <Field label="Academic Year">
                        <div className="rounded-xl bg-white px-3 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200">
                          {f.values.academicYear}
                        </div>
                      </Field>
                    ) : (
                      <AsyncSelect
                        type="academicYears"
                        label="Academic Year"
                        required
                        value={f.values.academicYear}
                        onChange={(value) => f.setFieldValue('academicYear', value ?? '')}
                        placeholder="Select admission academic year"
                        error={err('academicYear')}
                      />
                    )}
                    <Field label="Admission Type" required>
                      <select
                        name="admissionType"
                        value={f.values.admissionType}
                        onChange={f.handleChange}
                        className={selectCls}
                      >
                        <option value="regular">Regular</option>
                        <option value="lateral_entry">Lateral Entry</option>
                      </select>
                    </Field>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-700">
                      Programme / Curriculum <span className="text-red-500">*</span>
                    </label>
                    <AsyncSelect
                      type="programs"
                      params={{ admissionOnly: true }}
                      multiple
                      value={f.values.programPreferences}
                      onChange={(values) => {
                        const programmeChanged = values[0] !== f.values.programPreferences[0];
                        void f.setFieldValue('programPreferences', values);
                        if (programmeChanged) void f.setFieldValue('preferredDepartmentId', '');
                      }}
                      placeholder="Search and select an active curriculum"
                      required
                      error={err('programPreferences')}
                    />
                  </div>
                  <div>
                    <AsyncSelect
                      type="departments"
                      params={{
                        program: f.values.programPreferences[0],
                        admissionOnly: true,
                      }}
                      label="Preferred Branch (Optional)"
                      value={f.values.preferredDepartmentId}
                      onChange={(value) => f.setFieldValue('preferredDepartmentId', value ?? '')}
                      disabled={!f.values.programPreferences[0]}
                      placeholder={
                        f.values.programPreferences[0]
                          ? 'Select a preferred branch'
                          : 'Select a curriculum first'
                      }
                    />
                    <p className="mt-2 text-xs text-slate-600">
                      Branches are filtered by the selected curriculum. Branch selection is
                      optional.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">Contact Details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email" error={err('email')} required>
                  <input
                    type="email"
                    name="email"
                    value={f.values.email}
                    onChange={f.handleChange}
                    onBlur={f.handleBlur}
                    className={inputCls}
                  />
                </Field>
                <Field label="Phone Number" error={err('phone')} required>
                  <input
                    type="tel"
                    name="phone"
                    value={f.values.phone}
                    onChange={f.handleChange}
                    onBlur={f.handleBlur}
                    className={inputCls}
                  />
                </Field>
                <Field label="WhatsApp Number">
                  <input
                    type="tel"
                    name="whatsappPhone"
                    value={f.values.whatsappPhone}
                    onChange={f.handleChange}
                    className={inputCls}
                  />
                </Field>
                <Field label="Parent / Guardian Phone">
                  <input
                    type="tel"
                    name="parentPhone"
                    value={f.values.parentPhone}
                    onChange={f.handleChange}
                    className={inputCls}
                  />
                </Field>
              </div>
              {!selfService && !activeAppId && (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                  <input
                    type="checkbox"
                    name="sendCredentialsEmail"
                    checked={f.values.sendCredentialsEmail}
                    onChange={f.handleChange}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">
                      Send login credentials to the student
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                      When you click Next, the student account will be created and credentials will
                      be queued for delivery to {f.values.email || 'the entered email address'}.
                      Leave this unchecked when staff will complete the application directly.
                    </span>
                  </span>
                </label>
              )}
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-700">Present Address</h3>
                  </div>
                  <div className="space-y-3">
                    <Field label="Address Line 1" error={err('presentAddress.line1')} required>
                      <input
                        name="presentAddress.line1"
                        value={f.values.presentAddress.line1}
                        onChange={syncPermanent}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Address Line 2">
                      <input
                        name="presentAddress.line2"
                        value={f.values.presentAddress.line2}
                        onChange={syncPermanent}
                        className={inputCls}
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="City" error={err('presentAddress.city')} required>
                        <input
                          name="presentAddress.city"
                          value={f.values.presentAddress.city}
                          onChange={syncPermanent}
                          className={inputCls}
                        />
                      </Field>
                      <Field label="District">
                        <input
                          name="presentAddress.district"
                          value={f.values.presentAddress.district}
                          onChange={syncPermanent}
                          className={inputCls}
                        />
                      </Field>
                      <Field label="State" error={err('presentAddress.state')} required>
                        <input
                          name="presentAddress.state"
                          value={f.values.presentAddress.state}
                          onChange={syncPermanent}
                          className={inputCls}
                        />
                      </Field>
                      <Field label="Pincode" error={err('presentAddress.pincode')} required>
                        <input
                          name="presentAddress.pincode"
                          value={f.values.presentAddress.pincode}
                          onChange={syncPermanent}
                          maxLength={6}
                          className={inputCls}
                        />
                      </Field>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700">Permanent Address</h3>
                    <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={f.values.sameAddress}
                        onChange={(e) => {
                          f.setFieldValue('sameAddress', e.target.checked);
                          if (e.target.checked)
                            f.setFieldValue('permanentAddress', f.values.presentAddress);
                        }}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      Same as present
                    </label>
                  </div>
                  <div className="space-y-3">
                    <Field label="Address Line 1" error={err('permanentAddress.line1')} required>
                      <input
                        name="permanentAddress.line1"
                        value={f.values.permanentAddress.line1}
                        onChange={f.handleChange}
                        disabled={f.values.sameAddress}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Address Line 2">
                      <input
                        name="permanentAddress.line2"
                        value={f.values.permanentAddress.line2}
                        onChange={f.handleChange}
                        disabled={f.values.sameAddress}
                        className={inputCls}
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="City" error={err('permanentAddress.city')} required>
                        <input
                          name="permanentAddress.city"
                          value={f.values.permanentAddress.city}
                          onChange={f.handleChange}
                          disabled={f.values.sameAddress}
                          className={inputCls}
                        />
                      </Field>
                      <Field label="District">
                        <input
                          name="permanentAddress.district"
                          value={f.values.permanentAddress.district}
                          onChange={f.handleChange}
                          disabled={f.values.sameAddress}
                          className={inputCls}
                        />
                      </Field>
                      <Field label="State" error={err('permanentAddress.state')} required>
                        <input
                          name="permanentAddress.state"
                          value={f.values.permanentAddress.state}
                          onChange={f.handleChange}
                          disabled={f.values.sameAddress}
                          className={inputCls}
                        />
                      </Field>
                      <Field label="Pincode" error={err('permanentAddress.pincode')} required>
                        <input
                          name="permanentAddress.pincode"
                          value={f.values.permanentAddress.pincode}
                          onChange={f.handleChange}
                          disabled={f.values.sameAddress}
                          maxLength={6}
                          className={inputCls}
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">Academic Records</h2>
              {f.values.academicRecords.map((record, i) => {
                return (
                  <div key={i} className="rounded-xl bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-700">
                        {record.level === '10th'
                          ? '10th Standard'
                          : record.level === '12th_or_diploma'
                            ? '12th / Diploma'
                            : 'Degree'}
                      </h3>
                      {i > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            f.setFieldValue(
                              'academicRecords',
                              f.values.academicRecords.filter((_, j) => j !== i),
                            )
                          }
                          className="text-xs text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label="Level" required>
                        <select
                          name={`academicRecords.${i}.level`}
                          value={record.level}
                          onChange={f.handleChange}
                          className={selectCls}
                        >
                          <option value="10th">10th</option>
                          <option value="12th_or_diploma">12th / Diploma</option>
                          <option value="degree">Degree</option>
                        </select>
                      </Field>
                      <Field
                        label="Board / University"
                        error={
                          (f.errors.academicRecords as Array<{ boardOrUniversity?: string }>)?.[i]
                            ?.boardOrUniversity
                        }
                        required
                      >
                        <input
                          name={`academicRecords.${i}.boardOrUniversity`}
                          value={record.boardOrUniversity}
                          onChange={f.handleChange}
                          className={inputCls}
                        />
                      </Field>
                      <Field
                        label="Institute Name"
                        error={err(`academicRecords.${i}.instituteName`)}
                        required
                      >
                        <input
                          name={`academicRecords.${i}.instituteName`}
                          value={record.instituteName}
                          onChange={f.handleChange}
                          className={inputCls}
                        />
                      </Field>
                      <Field
                        label="Year of Passing"
                        error={err(`academicRecords.${i}.yearOfPassing`)}
                        required
                      >
                        <select
                          name={`academicRecords.${i}.yearOfPassing`}
                          value={record.yearOfPassing}
                          onChange={f.handleChange}
                          className={selectCls}
                        >
                          <option value="">Select Year</option>
                          {YEAR_OPTIONS.map((yr) => (
                            <option key={yr} value={yr}>
                              {yr}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field
                        label="Percentage of Marks"
                        error={err(`academicRecords.${i}.percentageOfMarks`)}
                        required
                      >
                        <input
                          type="number"
                          name={`academicRecords.${i}.percentageOfMarks`}
                          value={record.percentageOfMarks}
                          onChange={f.handleChange}
                          onBlur={f.handleBlur}
                          min={0}
                          max={100}
                          step={0.01}
                          className={inputCls}
                        />
                      </Field>
                    </div>
                  </div>
                );
              })}
              <div className="flex flex-wrap items-center gap-3">
                <CustomButton
                  variant="tertiary"
                  onClick={() =>
                    f.setFieldValue('academicRecords', [
                      ...f.values.academicRecords,
                      {
                        level: 'degree',
                        boardOrUniversity: '',
                        instituteName: '',
                        yearOfPassing: '',
                        percentageOfMarks: '',
                      },
                    ])
                  }
                >
                  + Add Academic Record
                </CustomButton>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">Entrance Exam Details</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Exam Name" error={err('entranceExam.exam')} required>
                  <select
                    name="entranceExam.exam"
                    value={f.values.entranceExam.exam}
                    onChange={f.handleChange}
                    className={selectCls}
                  >
                    <option value="">Select</option>
                    {['OJEE', 'JEE_MAIN', 'CAT', 'MAT', 'ATMA', 'OTHER'].map((e) => (
                      <option key={e} value={e}>
                        {e.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </Field>
                {f.values.entranceExam.exam === 'OTHER' && (
                  <Field label="Exam Name (specify)" required>
                    <input
                      name="entranceExam.otherName"
                      value={f.values.entranceExam.otherName}
                      onChange={f.handleChange}
                      className={inputCls}
                    />
                  </Field>
                )}
                <Field label="Year" error={err('entranceExam.year')} required>
                  <select
                    name="entranceExam.year"
                    value={f.values.entranceExam.year}
                    onChange={f.handleChange}
                    className={selectCls}
                  >
                    <option value="">Select Year</option>
                    {YEAR_OPTIONS.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Application Number">
                  <input
                    name="entranceExam.applicationNo"
                    value={f.values.entranceExam.applicationNo}
                    onChange={f.handleChange}
                    className={inputCls}
                  />
                </Field>
                <Field label="Rank" error={err('entranceExam.rank')}>
                  <input
                    type="number"
                    name="entranceExam.rank"
                    value={f.values.entranceExam.rank}
                    onChange={f.handleChange}
                    onBlur={f.handleBlur}
                    min={1}
                    className={inputCls}
                  />
                </Field>
                <Field label="Percentile" error={err('entranceExam.percentile')}>
                  <input
                    type="number"
                    name="entranceExam.percentile"
                    value={f.values.entranceExam.percentile}
                    onChange={f.handleChange}
                    onBlur={f.handleBlur}
                    min={0}
                    max={100}
                    step={0.01}
                    className={inputCls}
                  />
                </Field>
                <Field label="Score" error={err('entranceExam.score')}>
                  <input
                    type="number"
                    name="entranceExam.score"
                    value={f.values.entranceExam.score}
                    onChange={f.handleChange}
                    onBlur={f.handleBlur}
                    className={inputCls}
                  />
                </Field>
              </div>

              {(selfService || activeAppId) && (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Programme &amp; Branch</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Review or update the programme details linked to this application.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {selfService ? (
                      <Field label="Academic Year">
                        <div className="rounded-xl bg-white px-3 py-2.5 text-sm text-slate-700 ring-1 ring-slate-200">
                          {f.values.academicYear}
                        </div>
                      </Field>
                    ) : (
                      <AsyncSelect
                        type="academicYears"
                        label="Academic Year"
                        required
                        value={f.values.academicYear}
                        onChange={(value) => f.setFieldValue('academicYear', value ?? '')}
                        placeholder="Select admission academic year"
                        error={err('academicYear')}
                      />
                    )}
                    <Field label="Admission Type" required>
                      <select
                        name="admissionType"
                        value={f.values.admissionType}
                        onChange={f.handleChange}
                        className={selectCls}
                      >
                        <option value="regular">Regular</option>
                        <option value="lateral_entry">Lateral Entry</option>
                      </select>
                    </Field>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-700">
                      Programme / Curriculum <span className="text-red-500">*</span>
                    </label>
                    <AsyncSelect
                      type="programs"
                      params={{ admissionOnly: true }}
                      multiple
                      value={f.values.programPreferences}
                      onChange={(values) => {
                        const programmeChanged = values[0] !== f.values.programPreferences[0];
                        void f.setFieldValue('programPreferences', values);
                        if (programmeChanged) void f.setFieldValue('preferredDepartmentId', '');
                      }}
                      placeholder="Search and select an active curriculum"
                      required
                      error={err('programPreferences')}
                    />
                  </div>
                  <AsyncSelect
                    type="departments"
                    params={{
                      program: f.values.programPreferences[0],
                      admissionOnly: true,
                    }}
                    label="Preferred Branch (Optional)"
                    value={f.values.preferredDepartmentId}
                    onChange={(value) => f.setFieldValue('preferredDepartmentId', value ?? '')}
                    disabled={!f.values.programPreferences[0]}
                    placeholder={
                      f.values.programPreferences[0]
                        ? 'Select a preferred branch'
                        : 'Select a curriculum first'
                    }
                  />
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Upload Supporting Documents</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Select and verify all required files first. Click{' '}
                  <strong className="text-primary">Next</strong> to upload all of them in a batch.
                </p>
              </div>

              <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-100">
                {(() => {
                  const isPg = requiresDegreeDocuments(f.values.programPreferences);
                  const isCaste = f.values.category && f.values.category !== 'general';
                  const visible = DOCUMENT_REQUIREMENTS.filter(
                    (d) => (!d.pgOnly || isPg) && (!d.casteOnly || isCaste),
                  );

                  return visible.map((d) => {
                    const uploaded = docFiles(d.docType);
                    const staged = stagedFiles[d.docType] ?? [];
                    const hasAny = uploaded.length > 0 || staged.length > 0;
                    const isMultiple =
                      d.docType === DOC.AADHAAR ||
                      d.docType === DOC.HSC_TENTH_MARKSHEET ||
                      d.docType === DOC.PLUS_TWO_MARKSHEET ||
                      d.docType === DOC.PLUS_THREE_MARKSHEET;

                    return (
                      <div
                        key={d.docType}
                        className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1 max-w-xl">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-700">{d.label}</span>
                            {d.mandatory && (
                              <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600 uppercase tracking-wide">
                                Required
                              </span>
                            )}
                          </div>
                          {d.hint && <p className="text-xs text-slate-600">{d.hint}</p>}

                          {/* File Lists */}
                          <div className="mt-2 space-y-1.5">
                            {/* Server Uploaded Files */}
                            {uploaded.map((file, idx) => (
                              <div
                                key={`up-${idx}`}
                                className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50/50 border border-emerald-100 rounded-lg px-2.5 py-1.5 w-fit"
                              >
                                <span className="font-medium truncate max-w-xs">
                                  {file.name || `${d.label} File`}
                                </span>
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1 rounded font-semibold">
                                  Uploaded
                                </span>
                                <button
                                  type="button"
                                  onClick={() => openViewer(uploaded, d.label, idx)}
                                  className="text-primary font-semibold hover:underline ml-2"
                                >
                                  View
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeDoc(d.docType, file)}
                                  className="text-red-500 font-semibold hover:underline ml-1"
                                >
                                  Delete
                                </button>
                              </div>
                            ))}

                            {/* Locally Staged Files */}
                            {staged.map((file, idx) => (
                              <div
                                key={`st-${idx}`}
                                className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50/50 border border-amber-100 rounded-lg px-2.5 py-1.5 w-fit"
                              >
                                <span className="font-medium truncate max-w-xs">{file.name}</span>
                                <span className="text-[10px] bg-amber-100 text-amber-800 px-1 rounded font-semibold">
                                  Staged
                                </span>
                                <button
                                  type="button"
                                  onClick={() => openStagedViewer(d.docType, d.label, staged, idx)}
                                  className="text-primary font-semibold hover:underline ml-2"
                                >
                                  View
                                </button>
                                <button
                                  type="button"
                                  onClick={() => unstageDoc(d.docType, idx)}
                                  className="text-red-500 font-semibold hover:underline ml-1"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* File Select Trigger */}
                        <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                          <label className="cursor-pointer flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-100 hover:border-slate-300">
                            <UploadIcon className="h-3.5 w-3.5 text-slate-600" />
                            {hasAny ? (isMultiple ? 'Add File' : 'Replace File') : 'Select File'}
                            <input
                              ref={(node) => {
                                docInputRefs.current[d.docType] = node;
                              }}
                              type="file"
                              accept="application/pdf,image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp,image/tiff,image/heic,image/heif"
                              multiple={isMultiple}
                              onChange={(e) => {
                                const list = e.target.files;
                                if (!list) return;
                                for (const file of Array.from(list)) {
                                  if (file.size > 5 * 1024 * 1024) {
                                    toast.error('File size exceeds the 5 MB limit.');
                                    continue;
                                  }
                                  stageDoc(d.docType, file);
                                }
                                e.target.value = '';
                              }}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Booking Fee Payment</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Pay the admission booking fee using the QR below, then enter the transaction
                  details. You can also skip this step and pay later — Accounts will verify the
                  payment after admission.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-5">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Amount to pay
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {f.values.paymentInfo.amountPaid
                      ? `₹ ${Number(f.values.paymentInfo.amountPaid).toLocaleString('en-IN')}`
                      : 'Enter amount below'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Booking fee — non-refundable. Adjusted against semester fee on enrollment.
                  </p>

                  <div className="mt-4 flex flex-col items-center justify-center rounded-xl bg-white p-4">
                    {paymentSettings?.qrCodeUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={paymentSettings.qrCodeUrl}
                        alt="UPI QR for booking fee"
                        className="h-48 w-48 object-contain"
                      />
                    ) : (
                      <div className="flex h-48 w-48 items-center justify-center rounded-xl bg-slate-50 text-xs text-slate-600">
                        QR not configured
                      </div>
                    )}
                    <div className="mt-3 w-full space-y-2 text-xs text-slate-500">
                      {paymentSettings?.upiId && (
                        <p>
                          UPI:{' '}
                          <span className="font-mono text-slate-700">{paymentSettings.upiId}</span>
                          {paymentSettings.upiName ? ` (${paymentSettings.upiName})` : ''}
                        </p>
                      )}
                      {paymentSettings?.bankAccounts?.map((bank, index) => (
                        <div
                          key={`${bank.bankName}-${index}`}
                          className="rounded-lg bg-slate-50 p-2"
                        >
                          <p className="font-medium text-slate-700">{bank.bankName}</p>
                          <p>{bank.accountHolderName}</p>
                          <p>
                            A/C <span className="font-mono">{bank.accountNumber}</span> · IFSC{' '}
                            <span className="font-mono">{bank.ifscCode}</span>
                          </p>
                        </div>
                      ))}
                      {paymentSettings?.paymentInstructions && (
                        <p className="whitespace-pre-line">{paymentSettings.paymentInstructions}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Payment entry form */}
                <div className="space-y-3">
                  <Field label="Amount Paid (₹)">
                    <input
                      type="number"
                      min="0"
                      name="paymentInfo.amountPaid"
                      value={f.values.paymentInfo.amountPaid}
                      onChange={f.handleChange}
                      placeholder="Enter the amount you paid"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Transaction / UTR ID">
                    <input
                      type="text"
                      name="paymentInfo.transactionId"
                      value={f.values.paymentInfo.transactionId}
                      onChange={f.handleChange}
                      placeholder="As shown in your UPI / bank app"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Date of Payment">
                    <input
                      type="date"
                      name="paymentInfo.paidAt"
                      value={f.values.paymentInfo.paidAt}
                      onChange={f.handleChange}
                      max={new Date().toISOString().slice(0, 10)}
                      className={inputCls}
                    />
                  </Field>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <InlineFileUpload
                      label="Payment Screenshot"
                      hint="Upload the success screen from your UPI / bank app"
                      files={docFiles(DOC.PAYMENT_PROOF)}
                      onUpload={(file) => uploadDoc(DOC.PAYMENT_PROOF, file)}
                      onRemove={(file) => removeDoc(DOC.PAYMENT_PROOF, file)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-6">
              {/* Review Panel */}
              <ReviewStep
                values={f.values}
                docs={docs}
                onEdit={(s) => setStep(s)}
                isSubmitted={draft?.status !== undefined && draft.status !== 'draft'}
                onDeclarationChange={(accepted) => f.setFieldValue('declarationAccepted', accepted)}
                declarationError={
                  f.errors.declarationAccepted && f.touched.declarationAccepted
                    ? String(f.errors.declarationAccepted)
                    : undefined
                }
                onViewDoc={(files, title, idx) => openViewer(files, title, idx)}
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            setStepSubmitted(false);
            setStep((s) => s - 1);
          }}
          disabled={step === 0}
          className="group inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600  transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4 text-slate-600 transition-transform group-hover:-translate-x-0.5" />
          Previous
        </button>
        <span className="text-sm text-slate-600">
          Step {step + 1} of {STEPS.length}
        </span>
        <CustomButton
          variant="primary"
          endIcon={
            step < STEPS.length - 1 ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <Check className="h-4 w-4" />
            )
          }
          onClick={handleNext}
          loading={navLoading}
          disabled={step === STEPS.length - 1 && !f.values.declarationAccepted}
          className="w-fit!"
        >
          {step < STEPS.length - 1 ? 'Next' : 'Submit Application'}
        </CustomButton>
      </div>

      {isUploadingBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center ">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-900">
              {uploadProgressText || 'Uploading documents...'}
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{
                  width: uploadProgress.total
                    ? `${Math.min(100, Math.round((uploadProgress.current / uploadProgress.total) * 100))}%`
                    : '10%',
                }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {uploadProgress.total
                ? `${uploadProgress.current} of ${uploadProgress.total} files uploaded`
                : 'Preparing files...'}
            </p>
            <p className="mt-1 text-[11px] text-slate-600">
              Please keep this page open until upload completes.
            </p>
          </div>
        </div>
      )}

      <FileViewer
        open={viewerOpen}
        onClose={closeViewer}
        files={viewerFiles}
        initialIndex={viewerIdx}
        title={viewerTitle}
        actionLabel={viewerAction?.label}
        onAction={viewerAction ? viewerAction.onClick : undefined}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Payload helpers
// ──────────────────────────────────────────────────────────────────────────────

function buildPayload(values: IFormValues, selfService: boolean, partial = false) {
  const academicRecords = values.academicRecords
    .filter((r) => r.boardOrUniversity || r.instituteName || r.yearOfPassing || r.percentageOfMarks)
    .map((r) => ({
      ...r,
      yearOfPassing: r.yearOfPassing ? Number(r.yearOfPassing) : undefined,
      percentageOfMarks: r.percentageOfMarks ? Number(r.percentageOfMarks) : undefined,
    }));

  const entranceExam = !values.entranceExam.exam
    ? undefined
    : {
        ...values.entranceExam,
        year: Number(values.entranceExam.year) || new Date().getFullYear(),
        rank: values.entranceExam.rank ? Number(values.entranceExam.rank) : undefined,
        percentile: values.entranceExam.percentile
          ? Number(values.entranceExam.percentile)
          : undefined,
        score: values.entranceExam.score ? Number(values.entranceExam.score) : undefined,
      };

  return {
    academicYear: values.academicYear,
    candidateName: values.candidateName,
    fatherName: values.fatherName,
    motherName: values.motherName,
    dateOfBirth: values.dateOfBirth || undefined,
    gender: values.gender || undefined,
    category: values.category || undefined,
    religion: values.religion,
    nationality: values.nationality,
    bloodGroup: values.bloodGroup,
    aadhaarNumber: values.aadhaarNumber,
    email: values.email,
    phone: values.phone,
    whatsappPhone: values.whatsappPhone,
    parentPhone: values.parentPhone,
    presentAddress: values.presentAddress,
    permanentAddress: values.sameAddress ? values.presentAddress : values.permanentAddress,
    academicRecords,
    entranceExam,
    admissionType: values.admissionType,
    programPreferences: values.programPreferences,
    preferredDepartmentId: values.preferredDepartmentId || null,
    parentInfo: { fatherName: values.fatherName, motherName: values.motherName },
    declarationAccepted: partial ? undefined : Boolean(values.declarationAccepted),
    paymentDetails:
      values.paymentInfo.amountPaid || values.paymentInfo.transactionId || values.paymentInfo.paidAt
        ? {
            amountInNumber: values.paymentInfo.amountPaid
              ? Number(values.paymentInfo.amountPaid)
              : 0,
            transactionId: values.paymentInfo.transactionId || undefined,
            paidAt: values.paymentInfo.paidAt || undefined,
          }
        : undefined,
  };
}

// ─── Review step ────────────────────────────────────────────────────────────

function ReviewStep({
  values,
  docs,
  onEdit,
  onDeclarationChange,
  declarationError,
  onViewDoc,
  isSubmitted = false,
}: {
  values: IFormValues;
  docs: Record<string, IViewerFile[]>;
  onEdit: (step: number) => void;
  onDeclarationChange: (accepted: boolean) => void;
  declarationError?: string;
  onViewDoc: (files: IViewerFile[], title: string, idx?: number) => void;
  isSubmitted?: boolean;
}) {
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

  const photoFile = docs['passport_photo']?.[0]?.url;
  const addr = (a: IAddressValues) =>
    [a.line1, a.line2, a.city, a.district, a.state, a.pincode].filter(Boolean).join(', ');

  const uploadedDocsList = Object.entries(docs).filter(([, files]) => (files?.length ?? 0) > 0);

  return (
    <div className="space-y-6">
      {/* Official Government / University Style Application Form Sheet */}
      <div
        id="print-application-sheet"
        className=" border border-slate-100 bg-white p-6 sm:p-8  space-y-6 text-slate-800"
      >
        {/* Printable Official Header */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-300">
          <div className="flex items-center gap-4">
            {/* Institution Logo */}
            {settings?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.logoUrl}
                alt={`${settings.name} Logo`}
                className="size-18 object-contain "
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

          <div className="flex flex-col items-end gap-2 no-print shrink-0">
            {isSubmitted ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 uppercase">
                  Submitted
                </span>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-1.5 text-[11px] font-bold text-primary ring-1 ring-primary/20 transition-colors hover:bg-primary/10"
                >
                  🖨 Print / Save PDF
                </button>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200 uppercase">
                Draft Form
              </span>
            )}
          </div>
        </div>

        {/* Section 1: Personal & Identification Particulars (4-Column Layout Table) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <User className="h-4 w-4 text-slate-500 no-print" /> 1. Personal &amp; Identification
              Particulars
            </h3>
            <button
              type="button"
              onClick={() => onEdit(0)}
              className="text-xs font-semibold text-primary hover:underline no-print"
            >
              Edit Section
            </button>
          </div>

          <table className="w-full border-collapse border border-slate-300">
            <tbody>
              <tr>
                <td className="bg-slate-50 text-slate-500 font-semibold text-[11px] px-3 py-2 border border-slate-300 w-[20%]">
                  Academic Session
                </td>
                <td className="px-3 py-2 text-xs font-bold text-slate-800 border border-slate-300 w-[30%]">
                  {values.academicYear}
                </td>
                <td className="bg-slate-50 text-slate-500 font-semibold text-[11px] px-3 py-2 border border-slate-300 w-[20%]">
                  Admission Type
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-300 w-[30%] uppercase">
                  {values.admissionType}
                </td>
              </tr>
              <tr>
                <td className="bg-slate-50 text-slate-500 font-semibold text-[11px] px-3 py-2 border border-slate-300">
                  Full Name of Candidate
                </td>
                <td
                  colSpan={2}
                  className="px-3 py-2 text-xs font-extrabold text-slate-900 border border-slate-300 uppercase"
                >
                  {values.candidateName || '—'}
                </td>
                <td
                  rowSpan={3}
                  className="p-1 border border-slate-300 w-30 text-center bg-slate-50/50"
                >
                  <div className="mx-auto h-32 w-28 border border-slate-300 bg-white flex items-center justify-center overflow-hidden rounded">
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
                <td className="bg-slate-50 text-slate-500 font-semibold text-[11px] px-3 py-2 border border-slate-300">
                  {"Father's"} Name
                </td>
                <td
                  colSpan={2}
                  className="px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-300"
                >
                  {values.fatherName || '—'}
                </td>
              </tr>
              <tr>
                <td className="bg-slate-50 text-slate-500 font-semibold text-[11px] px-3 py-2 border border-slate-300">
                  {"Mother's"} Name
                </td>
                <td
                  colSpan={2}
                  className="px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-300"
                >
                  {values.motherName || '—'}
                </td>
              </tr>
              <tr>
                <td className="bg-slate-50 text-slate-500 font-semibold text-[11px] px-3 py-2 border border-slate-300">
                  Date of Birth
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-300">
                  {values.dateOfBirth || '—'}
                </td>
                <td className="bg-slate-50 text-slate-500 font-semibold text-[11px] px-3 py-2 border border-slate-300">
                  Gender
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-300 capitalize">
                  {values.gender || '—'}
                </td>
              </tr>
              <tr>
                <td className="bg-slate-50 text-slate-500 font-semibold text-[11px] px-3 py-2 border border-slate-300">
                  Social Category
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-300 uppercase">
                  {values.category || '—'}
                </td>
                <td className="bg-slate-50 text-slate-500 font-semibold text-[11px] px-3 py-2 border border-slate-300">
                  Aadhaar Number
                </td>
                <td
                  colSpan={2}
                  className="px-3 py-2 text-xs font-mono text-slate-800 border border-slate-300 font-medium"
                >
                  {values.aadhaarNumber || '—'}
                </td>
              </tr>
              <tr>
                <td className="bg-slate-50 text-slate-500 font-semibold text-[11px] px-3 py-2 border border-slate-300">
                  Religion
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-300">
                  {values.religion || '—'}
                </td>
                <td className="bg-slate-50 text-slate-500 font-semibold text-[11px] px-3 py-2 border border-slate-300">
                  Nationality / Blood Group
                </td>
                <td
                  colSpan={2}
                  className="px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-300"
                >
                  {values.nationality || '—'} / {values.bloodGroup || '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 2: Contact & Address Particulars (Table Layout) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <Phone className="h-4 w-4 text-slate-500 no-print" /> 2. Contact &amp; Communication
              Details
            </h3>
            <button
              type="button"
              onClick={() => onEdit(1)}
              className="text-xs font-semibold text-primary hover:underline no-print"
            >
              Edit Section
            </button>
          </div>

          <table className="w-full border-collapse border border-slate-300">
            <tbody>
              <tr>
                <td className="bg-slate-50 text-slate-500 font-semibold text-[11px] px-3 py-2 border border-slate-300 w-[20%]">
                  Email ID
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-300 w-[30%]">
                  {values.email || '—'}
                </td>
                <td className="bg-slate-50 text-slate-500 font-semibold text-[11px] px-3 py-2 border border-slate-300 w-[20%]">
                  Mobile Number
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-300 w-[30%]">
                  {values.phone || '—'}
                </td>
              </tr>
              <tr>
                <td className="bg-slate-50 text-slate-500 font-semibold text-[11px] px-3 py-2 border border-slate-300">
                  WhatsApp Number
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-300">
                  {values.whatsappPhone || '—'}
                </td>
                <td className="bg-slate-50 text-slate-500 font-semibold text-[11px] px-3 py-2 border border-slate-300">
                  Parent Phone
                </td>
                <td className="px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-300">
                  {values.parentPhone || '—'}
                </td>
              </tr>
              <tr>
                <td className="bg-slate-50 text-slate-500 font-semibold text-[11px] px-3 py-2 border border-slate-300">
                  Present Address
                </td>
                <td
                  colSpan={3}
                  className="px-3 py-2 text-xs text-slate-800 border border-slate-300 font-medium"
                >
                  {addr(values.presentAddress) || '—'}
                </td>
              </tr>
              <tr>
                <td className="bg-slate-50 text-slate-500 font-semibold text-[11px] px-3 py-2 border border-slate-300">
                  Permanent Address
                </td>
                <td
                  colSpan={3}
                  className="px-3 py-2 text-xs text-slate-800 border border-slate-300 font-medium"
                >
                  {values.sameAddress
                    ? 'Same as Present Address'
                    : addr(values.permanentAddress) || '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 3: Academic Qualifications Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-slate-500 no-print" /> 3. Educational Qualifications
            </h3>
            <button
              type="button"
              onClick={() => onEdit(2)}
              className="text-xs font-semibold text-primary hover:underline no-print"
            >
              Edit Section
            </button>
          </div>

          <table className="w-full border-collapse border border-slate-300 text-left text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px] w-[20%]">
                  Level
                </th>
                <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px]">
                  Board / University
                </th>
                <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px]">
                  Institute Name
                </th>
                <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px] w-[15%]">
                  Passing Year
                </th>
                <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px] w-[15%]">
                  Marks (%)
                </th>
              </tr>
            </thead>
            <tbody>
              {values.academicRecords.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/50">
                  <td className="border border-slate-300 px-3 py-2 font-bold text-slate-800">
                    {r.level === '10th'
                      ? '10th / Matriculation'
                      : r.level === '12th_or_diploma'
                        ? '12th / Diploma'
                        : 'Degree'}
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-slate-700">
                    {r.boardOrUniversity || '—'}
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-slate-700">
                    {r.instituteName || '—'}
                  </td>
                  <td className="border border-slate-300 px-3 py-2 font-mono text-slate-700 font-medium">
                    {r.yearOfPassing || '—'}
                  </td>
                  <td className="border border-slate-300 px-3 py-2 font-bold text-emerald-700">
                    {r.percentageOfMarks ? `${r.percentageOfMarks}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section 4: Entrance Examination Particulars */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <Award className="h-4 w-4 text-slate-500 no-print" /> 4. Entrance Examination Details
            </h3>
            <button
              type="button"
              onClick={() => onEdit(3)}
              className="text-xs font-semibold text-primary hover:underline no-print"
            >
              Edit Section
            </button>
          </div>

          <table className="w-full border-collapse border border-slate-300 text-left text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px]">
                  Entrance Exam
                </th>
                <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px] w-[15%]">
                  Exam Year
                </th>
                <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px]">
                  Application / Roll No
                </th>
                <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px] w-[15%]">
                  AIR Rank
                </th>
                <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px] w-[15%]">
                  Percentile %
                </th>
                <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px] w-[15%]">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-300 px-3 py-2 font-bold text-slate-800">
                  {values.entranceExam.exam || '—'}
                </td>
                <td className="border border-slate-300 px-3 py-2 font-mono text-slate-700">
                  {values.entranceExam.year || '—'}
                </td>
                <td className="border border-slate-300 px-3 py-2 font-mono text-slate-700 font-medium">
                  {values.entranceExam.applicationNo || '—'}
                </td>
                <td className="border border-slate-300 px-3 py-2 text-slate-700 font-medium">
                  {values.entranceExam.rank ? `#${values.entranceExam.rank}` : '—'}
                </td>
                <td className="border border-slate-300 px-3 py-2 font-bold text-emerald-700">
                  {values.entranceExam.percentile ? `${values.entranceExam.percentile}%` : '—'}
                </td>
                <td className="border border-slate-300 px-3 py-2 text-slate-700 font-medium">
                  {values.entranceExam.score || '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 5: Program Preferences */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <Check className="h-4 w-4 text-slate-500 no-print" /> 5. Selected Programme
              Preferences
            </h3>
            <button
              type="button"
              onClick={() => onEdit(3)}
              className="text-xs font-semibold text-primary hover:underline no-print"
            >
              Edit Section
            </button>
          </div>

          <table className="w-full border-collapse border border-slate-300 text-left text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px] w-[20%]">
                  Preference Choice
                </th>
                <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px]">
                  Programme Description
                </th>
              </tr>
            </thead>
            <tbody>
              {values.programPreferences.map((prog, idx) => (
                <tr key={idx}>
                  <td className="border border-slate-300 px-3 py-2 font-bold text-slate-800">
                    Choice Rank #{idx + 1}
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-slate-700 font-semibold">
                    {programmeLabel(prog)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section 6: Attached Documents Details */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <UploadIcon className="h-4 w-4 text-slate-500 no-print" /> 6. Uploaded Documents
              Status
            </h3>
            <button
              type="button"
              onClick={() => onEdit(4)}
              className="text-xs font-semibold text-primary hover:underline no-print"
            >
              Edit Section
            </button>
          </div>

          <table className="w-full border-collapse border border-slate-300 text-left text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px]">
                  Document Category
                </th>
                <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px] w-[25%]">
                  Status
                </th>
                <th className="border border-slate-300 px-3 py-2 font-bold uppercase text-[10px] w-[50%]">
                  Files Attached
                </th>
              </tr>
            </thead>
            <tbody>
              {uploadedDocsList.length === 0 ? (
                <tr>
                  <td colSpan={3} className="border border-slate-300 px-3 py-2 text-slate-500">
                    No documents attached yet.
                  </td>
                </tr>
              ) : (
                uploadedDocsList.map(([docType, files]) => (
                  <tr key={docType}>
                    <td className="border border-slate-300 px-3 py-2 font-bold text-slate-800 capitalize">
                      {docType.replace(/_/g, ' ')}
                    </td>
                    <td className="border border-slate-300 px-3 py-2">
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 uppercase border border-emerald-200">
                        Uploaded
                      </span>
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-slate-600">
                      <div className="flex flex-col gap-1.5">
                        {files.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="truncate max-w-60 text-xs font-mono" title={file.name}>
                              {file.name || `Document #${idx + 1}`}
                            </span>
                            <button
                              type="button"
                              onClick={() => onViewDoc(files, docType.replace(/_/g, ' '), idx)}
                              className="no-print text-[10px] font-semibold text-primary hover:underline hover:text-primary-focus cursor-pointer border border-primary/20 bg-primary/5 px-2 py-0.5 rounded "
                            >
                              View
                            </button>
                          </div>
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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <Check className="h-4 w-4 text-slate-500 no-print" /> 7. Booking Fee Payment Details
            </h3>
            <button
              type="button"
              onClick={() => onEdit(5)}
              className="text-xs font-semibold text-primary hover:underline no-print"
            >
              Edit Section
            </button>
          </div>

          <table className="w-full border-collapse border border-slate-300 text-left text-xs">
            <tbody>
              <tr>
                <td className="bg-slate-50 text-slate-500 font-semibold text-[11px] px-3 py-2 border border-slate-300 w-[20%]">
                  Amount Paid
                </td>
                <td className="px-3 py-2 text-xs font-bold text-emerald-700 border border-slate-300 w-[30%]">
                  {values.paymentInfo.amountPaid
                    ? `₹ ${values.paymentInfo.amountPaid}`
                    : 'Not Paid Yet'}
                </td>
                <td className="bg-slate-50 text-slate-500 font-semibold text-[11px] px-3 py-2 border border-slate-300 w-[20%]">
                  Transaction Reference
                </td>
                <td className="px-3 py-2 text-xs font-mono text-slate-800 border border-slate-300 w-[30%] font-semibold">
                  {values.paymentInfo.transactionId || '—'}
                </td>
              </tr>
              <tr>
                <td className="bg-slate-50 text-slate-500 font-semibold text-[11px] px-3 py-2 border border-slate-300">
                  Payment Date
                </td>
                <td
                  colSpan={3}
                  className="px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-300"
                >
                  {values.paymentInfo.paidAt || '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 8: Final Declaration Box */}
        <div
          id="declaration-section"
          className={`rounded-xl border p-5 space-y-3 transition-colors ${
            values.declarationAccepted
              ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900'
              : 'border-amber-300 bg-amber-50/60 text-amber-900'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
              {values.declarationAccepted ? (
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-600" />
              )}
              Applicant Undertaking &amp; Declaration
            </div>
            <span
              className={`font-bold px-2.5 py-0.5 rounded-full text-[11px] border ${
                values.declarationAccepted
                  ? 'text-emerald-700 bg-emerald-100 border-emerald-200'
                  : 'text-amber-800 bg-amber-100 border-amber-300'
              }`}
            >
              {values.declarationAccepted ? 'Verified & Agreed' : 'Pending Agreement'}
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            I hereby declare that all particulars entered in this application form are authentic,
            complete, and accurate. I understand that if any statement is found false or misleading
            at any stage, my candidature for admission will stand automatically canceled.
          </p>
          <div className="pt-2 flex flex-col gap-2 border-t border-slate-200/80 no-print">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-800 font-semibold select-none">
              <input
                type="checkbox"
                name="declarationAccepted"
                checked={values.declarationAccepted}
                onChange={(e) => onDeclarationChange(e.target.checked)}
                className="h-4 w-4 rounded accent-primary cursor-pointer"
              />
              <span>I have read and accept the declaration above</span>
            </label>
            {declarationError && (
              <p className="text-xs font-semibold text-rose-500">{declarationError}</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800">
        Once you click <b>Submit Application</b>, your application moves to official review and you
        will not be able to edit it. Make sure everything in the preview sheet above is correct.
      </div>
    </div>
  );
}

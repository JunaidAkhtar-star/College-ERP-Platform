'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import { useRouter } from 'nextjs-toploader/app';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import CustomButton from '@/shared/core/CustomButton';
import InlineFileUpload from '@/shared/core/InlineFileUpload';
import type { IViewerFile } from '@/shared/core/FileViewer';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import { getTenantRolePath } from '@/shared/utils';
import { useAuthStore } from '@/shared/store/authStore';
import { disconnectSocket } from '@/shared/hooks/useSocket';
import UseProtectedRoutes from '@/shared/hooks/UseProtectedRoutes';

interface IInstitutionSettings {
  name?: string;
  shortCode?: string;
  tagline?: string;
  address?: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  onboardingStatus?: 'pending' | 'completed';
  onboardingStep?: number;
}

interface IDomainSettings {
  defaultDomain: string;
  customDomain?: string;
  status?: 'pending' | 'active' | 'failed';
  sslStatus?: 'pending' | 'active' | 'failed';
  cnameTarget: string;
  verificationHost?: string;
  verificationToken?: string;
}

type TFieldName =
  | 'name'
  | 'shortCode'
  | 'tagline'
  | 'address'
  | 'phone'
  | 'email'
  | 'websiteUrl'
  | 'primaryColor'
  | 'secondaryColor';

const steps = ['Welcome', 'Institution', 'Contact', 'Branding', 'Domain', 'Review'] as const;
const stepPositions = [
  'col-start-1 row-start-1',
  'col-start-2 row-start-1',
  'col-start-2 row-start-2',
  'col-start-1 row-start-2',
  'col-start-1 row-start-3',
  'col-start-2 row-start-3',
] as const;
const stepConnectors: Partial<Record<number, { symbol: string; className: string }>> = {
  0: { symbol: '→', className: '-right-5 top-1/2 -translate-y-1/2' },
  1: { symbol: '↓', className: '-bottom-4 right-1/2 translate-x-1/2' },
  2: { symbol: '←', className: '-left-5 top-1/2 -translate-y-1/2' },
  3: { symbol: '↓', className: '-bottom-4 left-1/2 -translate-x-1/2' },
  4: { symbol: '→', className: '-right-5 top-1/2 -translate-y-1/2' },
};

const stepFields: TFieldName[][] = [
  [],
  ['name', 'shortCode'],
  ['email', 'phone', 'address', 'websiteUrl'],
  ['primaryColor', 'secondaryColor'],
  [],
  [],
];

const stepSaveFields: TFieldName[][] = [
  [],
  ['name', 'shortCode', 'tagline'],
  ['email', 'phone', 'address', 'websiteUrl'],
  ['primaryColor', 'secondaryColor'],
  [],
  [],
];

const inputClass =
  'mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10';

function SetupIllustration({ step }: { step: number }) {
  return (
    <div className="mx-auto w-full max-w-md">
      <svg viewBox="0 0 440 300" role="img" aria-label={`${steps[step]} setup illustration`}>
        <ellipse cx="220" cy="264" rx="150" ry="16" fill="#CFE5F5" opacity=".55" />
        <rect x="54" y="32" width="332" height="220" rx="34" fill="#FFFFFF" opacity=".82" />
        <AnimatePresence mode="wait">
          <motion.g
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            {step === 0 && (
              <>
                <rect x="102" y="78" width="236" height="142" rx="16" fill="#EAF5FD" />
                <rect x="122" y="98" width="196" height="92" rx="9" fill="#FFFFFF" />
                <rect x="139" y="116" width="58" height="10" rx="5" fill="#75B8E8" />
                <rect x="139" y="139" width="158" height="7" rx="3.5" fill="#D5E6F2" />
                <rect x="139" y="157" width="118" height="7" rx="3.5" fill="#D5E6F2" />
                <rect x="186" y="203" width="68" height="9" rx="4.5" fill="#8CB7D4" />
                <motion.circle
                  cx="302"
                  cy="110"
                  r="18"
                  fill="#58B7A8"
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 2.4, repeat: Infinity }}
                />
                <path
                  d="m294 110 6 6 11-13"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}
            {step === 1 && (
              <>
                <path d="M118 126 220 72l102 54" fill="#B9DCF3" />
                <rect x="132" y="126" width="176" height="98" rx="5" fill="#FFFFFF" />
                {[154, 190, 226, 262].map((x) => (
                  <g key={x}>
                    <rect x={x} y="143" width="20" height="62" rx="4" fill="#DCECF7" />
                    <rect x={x - 4} y="137" width="28" height="7" rx="3" fill="#75B8E8" />
                  </g>
                ))}
                <rect x="120" y="217" width="200" height="10" rx="5" fill="#5B9DCC" />
                <motion.path
                  d="M220 86v31"
                  stroke="#0178D7"
                  strokeWidth="5"
                  strokeLinecap="round"
                  animate={{ opacity: [0.45, 1, 0.45] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </>
            )}
            {step === 2 && (
              <>
                <rect
                  x="95"
                  y="95"
                  width="156"
                  height="108"
                  rx="16"
                  fill="#FFFFFF"
                  stroke="#C8E1F2"
                  strokeWidth="4"
                />
                <path
                  d="m111 115 62 47 62-47"
                  fill="#E4F2FB"
                  stroke="#75B8E8"
                  strokeWidth="4"
                  strokeLinejoin="round"
                />
                <motion.g animate={{ x: [0, 8, 0] }} transition={{ duration: 3, repeat: Infinity }}>
                  <rect x="257" y="78" width="90" height="142" rx="20" fill="#DDF2EE" />
                  <rect x="269" y="96" width="66" height="98" rx="9" fill="#FFFFFF" />
                  <circle cx="302" cy="120" r="15" fill="#58B7A8" />
                  <rect x="282" y="146" width="40" height="7" rx="3.5" fill="#AAD9D1" />
                  <rect x="277" y="161" width="50" height="7" rx="3.5" fill="#D4E9E5" />
                </motion.g>
                <path
                  d="M230 175c21-8 27-24 29-39"
                  fill="none"
                  stroke="#0178D7"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="7 8"
                />
              </>
            )}
            {step === 3 && (
              <>
                <rect
                  x="100"
                  y="76"
                  width="240"
                  height="154"
                  rx="18"
                  fill="#FFFFFF"
                  stroke="#C8E1F2"
                  strokeWidth="4"
                />
                <rect x="100" y="76" width="240" height="32" rx="18" fill="#E5F3FC" />
                <circle cx="121" cy="92" r="5" fill="#75B8E8" />
                <circle cx="137" cy="92" r="5" fill="#9ACFBE" />
                <motion.rect
                  x="125"
                  y="130"
                  width="72"
                  height="72"
                  rx="16"
                  fill="#0178D7"
                  animate={{ fill: ['#0178D7', '#1688D9', '#0178D7'] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
                <rect x="216" y="133" width="92" height="10" rx="5" fill="#75B8E8" />
                <rect x="216" y="157" width="73" height="7" rx="3.5" fill="#D5E6F2" />
                <rect x="216" y="177" width="58" height="20" rx="10" fill="#9BB94F" />
              </>
            )}
            {step === 4 && (
              <>
                <motion.circle
                  cx="220"
                  cy="148"
                  r="66"
                  fill="#E7F3FB"
                  animate={{ scale: [0.97, 1.03, 0.97] }}
                  transition={{ duration: 3.4, repeat: Infinity }}
                />
                <circle cx="220" cy="148" r="45" fill="#FFFFFF" stroke="#75B8E8" strokeWidth="4" />
                <path
                  d="M178 148h84M220 104c17 19 17 69 0 88M220 104c-17 19-17 69 0 88M187 124h66M187 172h66"
                  fill="none"
                  stroke="#75B8E8"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <motion.path
                  d="M285 106c28 19 35 55 16 82"
                  fill="none"
                  stroke="#58B7A8"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray="8 9"
                  animate={{ strokeDashoffset: [34, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                />
                <rect x="284" y="188" width="55" height="27" rx="8" fill="#58B7A8" />
                <rect
                  x="101"
                  y="83"
                  width="71"
                  height="42"
                  rx="10"
                  fill="#FFFFFF"
                  stroke="#C8E1F2"
                  strokeWidth="3"
                />
                <rect x="114" y="96" width="45" height="7" rx="3.5" fill="#75B8E8" />
              </>
            )}
            {step === 5 && (
              <>
                <motion.circle
                  cx="220"
                  cy="148"
                  r="72"
                  fill="#E1F4EF"
                  animate={{ scale: [0.96, 1.03, 0.96] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
                <circle cx="220" cy="148" r="48" fill="#58B7A8" />
                <motion.path
                  d="m195 148 17 17 35-39"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                />
                <rect x="139" y="226" width="162" height="9" rx="4.5" fill="#B8D6E9" />
              </>
            )}
          </motion.g>
        </AnimatePresence>
      </svg>
      <p className="text-center text-xs font-medium text-slate-500">
        Your setup remains private and encrypted
      </p>
    </div>
  );
}

function OnboardingPage() {
  const router = useRouter();
  const role = useAuthStore((state) => state.role);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const {
    data: response,
    isLoading,
    error: settingsError,
    mutate,
  } = useSwr<{ data?: IInstitutionSettings }>('institution-setting');
  const { mutation, isLoading: isSaving } = useMutation();
  const { mutation: saveProgress, isLoading: isSavingProgress } = useMutation();
  const { mutation: domainMutation, isLoading: isSavingDomain } = useMutation();
  const { mutation: verifyDomainMutation, isLoading: isVerifyingDomain } = useMutation();
  const {
    data: domainResponse,
    error: domainError,
    mutate: refreshDomain,
  } = useSwr<{ data?: IDomainSettings }>('tenant-domain');
  const settings = response?.data;
  const domainSettings = domainResponse?.data;
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
  const [savedLogoUrl, setSavedLogoUrl] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const restoredProgress = useRef(-1);

  useEffect(() => {
    if (!settings) return;
    if (settings.logoUrl) window.queueMicrotask(() => setSavedLogoUrl(settings.logoUrl ?? ''));
    const serverStep = Math.min(Math.max(settings.onboardingStep ?? 0, 0), 5);
    if (serverStep <= restoredProgress.current) return;
    restoredProgress.current = serverStep;
    window.queueMicrotask(() => setStep(serverStep));
  }, [settings]);

  useEffect(() => {
    if (!domainSettings?.customDomain) return;
    window.queueMicrotask(() => setCustomDomain(domainSettings.customDomain ?? ''));
  }, [domainSettings?.customDomain]);

  useEffect(() => {
    if (
      step !== 4 ||
      !domainSettings?.customDomain ||
      domainSettings.status === 'active' ||
      isVerifyingDomain
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      void verifyDomainMutation('tenant-domain/verify', {
        method: 'POST',
        body: {},
        silentError: true,
        dedupe: true,
      }).then(() => refreshDomain());
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [
    domainSettings?.customDomain,
    domainSettings?.status,
    isVerifyingDomain,
    refreshDomain,
    step,
    verifyDomainMutation,
  ]);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(logoPreviewUrl);
    };
  }, [logoPreviewUrl]);

  const logoFiles: IViewerFile[] = logoPreviewUrl
    ? [
        {
          url: logoPreviewUrl,
          name: logoFile?.name || 'Institution logo',
          mimeType: logoFile?.type,
        },
      ]
    : savedLogoUrl
      ? [{ url: savedLogoUrl, name: 'Current institution logo', mimeType: 'image/*' }]
      : [];

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      name: settings?.name === 'Institution setup required' ? '' : settings?.name || '',
      shortCode: settings?.shortCode || '',
      tagline: settings?.tagline || '',
      address: settings?.address || '',
      phone: settings?.phone || '',
      email: settings?.email || '',
      websiteUrl: settings?.websiteUrl || '',
      primaryColor: settings?.primaryColor || '#0178D7',
      secondaryColor: settings?.secondaryColor || '#9BB94F',
    },
    validationSchema: Yup.object({
      name: Yup.string().trim().required('Institution name is required'),
      shortCode: Yup.string()
        .trim()
        .matches(/^[A-Za-z0-9]{2,12}$/, {
          message: 'Short code must be 2–12 letters or numbers only (for example, RITE).',
          excludeEmptyString: true,
        })
        .required('Short code is required'),
      address: Yup.string().trim().required('Official address is required'),
      phone: Yup.string()
        .trim()
        .matches(/^\+?[0-9][0-9\s()-]{7,19}$/, 'Enter a valid phone number with 8–20 digits')
        .required('Phone number is required'),
      email: Yup.string()
        .trim()
        .email('Enter a valid email')
        .required('Official email is required'),
      websiteUrl: Yup.string().trim().url('Enter a complete URL').optional(),
      primaryColor: Yup.string()
        .matches(/^#[0-9A-Fa-f]{6}$/, 'Enter a valid six-digit hex colour')
        .required('Primary colour is required'),
      secondaryColor: Yup.string()
        .matches(/^#[0-9A-Fa-f]{6}$/, 'Enter a valid six-digit hex colour')
        .required('Secondary colour is required'),
    }),
    onSubmit: async (values) => {
      if (!logoFile && !savedLogoUrl) {
        toast.error('Institution logo is required');
        setStep(3);
        return;
      }
      const body = new FormData();
      Object.entries(values).forEach(([key, value]) => body.append(key, value));
      if (logoFile && !savedLogoUrl) body.append('logo', logoFile);
      const saved = await mutation('institution-setting', {
        method: 'PUT',
        isFormData: true,
        body,
      });
      if (!saved) return;
      const completed = await mutation('institution-setting/complete-onboarding', {
        method: 'POST',
        body: {},
      });
      if (!completed) return;
      toast.success('Your institution workspace is ready');
      router.replace(getTenantRolePath(role ?? 'super_admin', '/dashboard'));
    },
  });

  const fieldError = (name: TFieldName) =>
    formik.touched[name] && formik.errors[name] ? String(formik.errors[name]) : '';

  const move = async (next: number) => {
    if (next > step) {
      const errors = await formik.validateForm();
      const fields = stepFields[step];
      fields.forEach((field) => void formik.setFieldTouched(field, true, false));
      if (fields.some((field) => errors[field])) return;
      if (step === 3 && !logoFile && !savedLogoUrl) {
        toast.error('Add your institution logo to continue.');
        return;
      }

      // Navigation should not be held hostage by network/database latency. The save
      // continues in the background and the button remains disabled until it settles.
      setDirection(1);
      setStep(next);

      const body = new FormData();
      stepSaveFields[step].forEach((field) => body.append(field, formik.values[field]));
      body.append('onboardingStep', String(next));
      if (step === 3 && logoFile) body.append('logo', logoFile);
      const saved = await saveProgress('institution-setting', {
        method: 'PUT',
        isFormData: true,
        body,
      });
      if (!saved) {
        setDirection(-1);
        setStep(step);
        return;
      }
      const persistedLogo = saved.results?.data?.logoUrl as string | undefined;
      if (persistedLogo) {
        setSavedLogoUrl(persistedLogo);
        setLogoFile(null);
        setLogoPreviewUrl('');
      }
      return;
    }
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const setLogo = async (file: File) => {
    setLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
    return true;
  };

  const removeLogo = async () => {
    setLogoFile(null);
    setLogoPreviewUrl('');
  };

  const saveDomain = async () => {
    const normalized = customDomain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/[/:].*$/, '')
      .replace(/\.$/, '');
    if (
      !/^(?=.{4,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(normalized)
    ) {
      toast.error('Enter a domain such as erp.yourinstitution.edu.in without a page path.');
      return;
    }
    const saved = await domainMutation('tenant-domain', {
      method: 'PUT',
      body: { customDomain: normalized },
    });
    if (!saved?.results?.success) return;
    toast.success('Custom domain saved. DNS verification can be completed after onboarding.');
    await refreshDomain();
  };

  const verifyDomain = async () => {
    const verified = await verifyDomainMutation('tenant-domain/verify', {
      method: 'POST',
      body: {},
    });
    await refreshDomain();
    if (verified?.results?.success) toast.success('Custom domain verified successfully.');
  };

  const copyDnsValue = async (value?: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success('DNS value copied.');
    } catch {
      toast.error('This browser could not copy the value. Select and copy it manually.');
    }
  };

  const signOut = () => {
    disconnectSocket();
    clearAuth();
    router.replace('/auth/signin');
  };

  if (isLoading) return <div className="min-h-dvh animate-pulse bg-slate-50" />;
  if (settingsError || !settings) {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-50 p-5">
        <div className="max-w-md rounded-2xl bg-white p-6 text-center">
          <CircleAlert className="mx-auto h-8 w-8 text-rose-500" />
          <h1 className="mt-4 text-lg font-semibold text-slate-900">
            Institution setup could not be loaded
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Your saved progress is safe. Check the connection and try loading it again.
          </p>
          <CustomButton className="mt-5" onClick={() => void mutate()}>
            Try again
          </CustomButton>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#f4f8fb] p-3 sm:p-6">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-7xl overflow-hidden rounded-3xl bg-white">
        <aside className="relative hidden w-[38%] overflow-hidden bg-linear-to-br from-[#e7f4ff] via-[#f2f9ff] to-[#e8f7f5] p-8 lg:flex lg:flex-col">
          <div className="relative z-10">
            <p className="text-sm font-semibold text-primary">Institution workspace setup</p>
            <h1 className="mt-3 max-w-sm text-3xl font-semibold leading-tight tracking-[-0.035em] text-slate-900">
              Let’s prepare your ERP for the first day.
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600">
              A resumable setup for your institution identity, contact details, brand and launch
              address.
            </p>
          </div>
          <div className="my-auto">
            <SetupIllustration step={step} />
          </div>
          <div className="relative z-10 grid grid-cols-2 grid-rows-3 gap-x-6 gap-y-4">
            {steps.map((label, index) => {
              const complete = index < step;
              const active = index === step;
              const connector = stepConnectors[index];
              return (
                <div
                  key={label}
                  className={`relative flex min-h-12 items-center gap-2.5 rounded-xl bg-white/65 px-2.5 py-2 ${stepPositions[index]}`}
                >
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-xl text-xs font-semibold transition ${
                      complete
                        ? 'bg-emerald-500 text-white'
                        : active
                          ? 'bg-primary text-white'
                          : 'bg-white/70 text-slate-600'
                    }`}
                  >
                    {complete ? '✓' : String(index + 1).padStart(2, '0')}
                  </span>
                  <span
                    className={`text-sm ${active ? 'font-semibold text-slate-900' : 'text-slate-500'}`}
                  >
                    {label}
                  </span>
                  {connector && (
                    <span
                      aria-hidden="true"
                      className={`absolute text-base font-medium text-[#78a9c8] ${connector.className}`}
                    >
                      {connector.symbol}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col p-5 sm:p-8 lg:p-12">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Step {step + 1} of {steps.length}
            </p>
            <div className="flex items-center gap-4">
              <span className="hidden text-xs text-slate-600 sm:inline">About 3 minutes</span>
              <button
                type="button"
                onClick={signOut}
                className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                Sign out
              </button>
            </div>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <motion.div
              animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
              className="h-full rounded-full bg-primary"
            />
          </div>

          <form onSubmit={formik.handleSubmit} className="flex flex-1 flex-col">
            <div className="flex flex-1 items-center py-8">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  initial={{ opacity: 0, x: direction * 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -20 }}
                  transition={{ duration: 0.28 }}
                  className="mx-auto w-full max-w-2xl"
                >
                  <div className="mb-5 lg:hidden">
                    <SetupIllustration step={step} />
                  </div>
                  {step === 0 && (
                    <div>
                      <h2 className="text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
                        Welcome to your new workspace
                      </h2>
                      <p className="mt-4 max-w-xl text-base leading-7 text-slate-500">
                        We’ll configure the information used across admissions, reports, emails,
                        certificates and your institution portal. You can update it later.
                      </p>
                      <div className="mt-8 grid gap-3 sm:grid-cols-3">
                        {['Official identity', 'Contact details', 'Brand experience'].map(
                          (label, index) => (
                            <div key={label} className="rounded-xl bg-slate-50 p-4">
                              <span className="text-xs font-semibold text-primary">
                                0{index + 1}
                              </span>
                              <p className="mt-2 text-sm font-medium text-slate-800">{label}</p>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  {step === 1 && (
                    <div>
                      <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                        Tell us about your institution
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        These details become the official identity across the ERP.
                      </p>
                      <div className="mt-7 grid gap-5 sm:grid-cols-2">
                        {(
                          [
                            ['name', 'Institution name', 'Example Institute of Technology'],
                            ['shortCode', 'Short code', 'EIT'],
                            ['tagline', 'Tagline (optional)', 'Education for tomorrow'],
                          ] as const
                        ).map(([name, label, placeholder]) => (
                          <label key={name} className={name === 'tagline' ? 'sm:col-span-2' : ''}>
                            <span className="text-sm font-medium text-slate-700">
                              {label}
                              {name !== 'tagline' && <span className="ml-0.5 text-red-500">*</span>}
                            </span>
                            <input
                              name={name}
                              value={formik.values[name]}
                              onChange={(event) => {
                                if (name === 'shortCode') {
                                  const shortCode = event.target.value
                                    .replace(/[^A-Za-z0-9]/g, '')
                                    .toUpperCase()
                                    .slice(0, 12);
                                  void formik.setFieldValue(name, shortCode);
                                  return;
                                }
                                formik.handleChange(event);
                              }}
                              onBlur={formik.handleBlur}
                              placeholder={placeholder}
                              maxLength={name === 'shortCode' ? 12 : undefined}
                              autoCapitalize={name === 'shortCode' ? 'characters' : undefined}
                              aria-invalid={Boolean(fieldError(name))}
                              aria-describedby={
                                name === 'shortCode' ? 'institution-short-code-help' : undefined
                              }
                              className={`${inputClass} ${fieldError(name) ? 'border-red-300 bg-red-50' : ''}`}
                            />
                            {fieldError(name) && (
                              <span
                                id={
                                  name === 'shortCode' ? 'institution-short-code-help' : undefined
                                }
                                className="mt-1 block text-xs text-red-500"
                              >
                                {fieldError(name)}
                              </span>
                            )}
                            {name === 'shortCode' && !fieldError(name) && (
                              <span
                                id="institution-short-code-help"
                                className="mt-1 block text-xs leading-5 text-slate-500"
                              >
                                2–12 letters or numbers. Used as your workspace abbreviation.
                              </span>
                            )}
                          </label>
                        ))}
                      </div>

                      <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs">
                            🏛️
                          </span>
                          <div>
                            <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wide">
                              Primary Campus Setup Included
                            </h4>
                            <p className="mt-1 text-xs leading-relaxed text-blue-800">
                              When onboarding completes, your institution’s primary location (e.g.{' '}
                              <b>
                                {formik.values.shortCode
                                  ? `${formik.values.shortCode}-01`
                                  : 'MAIN-01'}{' '}
                                · {formik.values.name || 'Institution'} Main Campus
                              </b>
                              ) will be automatically created. You can manage multi-campus
                              sub-branches anytime under <b>Campus Governance</b>.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div>
                      <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                        Add official contact details
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Used in documents, notifications and public institution references.
                      </p>
                      <div className="mt-7 grid gap-5 sm:grid-cols-2">
                        {(
                          [
                            ['email', 'Official email', 'office@example.edu.in'],
                            ['phone', 'Official phone', '+91 98765 43210'],
                            ['websiteUrl', 'Website (optional)', 'https://example.edu.in'],
                          ] as const
                        ).map(([name, label, placeholder]) => (
                          <label
                            key={name}
                            className={name === 'websiteUrl' ? 'sm:col-span-2' : ''}
                          >
                            <span className="text-sm font-medium text-slate-700">
                              {label}
                              {name !== 'websiteUrl' && (
                                <span className="ml-0.5 text-red-500">*</span>
                              )}
                            </span>
                            <input
                              name={name}
                              value={formik.values[name]}
                              onChange={formik.handleChange}
                              onBlur={formik.handleBlur}
                              placeholder={placeholder}
                              aria-invalid={Boolean(fieldError(name))}
                              className={`${inputClass} ${fieldError(name) ? 'border-red-300 bg-red-50' : ''}`}
                            />
                            {fieldError(name) && (
                              <span className="mt-1 block text-xs text-red-500">
                                {fieldError(name)}
                              </span>
                            )}
                          </label>
                        ))}
                        <label className="sm:col-span-2">
                          <span className="text-sm font-medium text-slate-700">
                            Official address <span className="ml-0.5 text-red-500">*</span>
                          </span>
                          <textarea
                            name="address"
                            rows={3}
                            value={formik.values.address}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            placeholder="Campus address, city, state and postal code"
                            aria-invalid={Boolean(fieldError('address'))}
                            className={`${inputClass} ${fieldError('address') ? 'border-red-300 bg-red-50' : ''}`}
                          />
                          {fieldError('address') && (
                            <span className="mt-1 block text-xs text-red-500">
                              {fieldError('address')}
                            </span>
                          )}
                        </label>
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div>
                      <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                        Create a familiar brand experience
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Add the logo and colours users will recognize throughout the workspace.
                      </p>
                      <div className="mt-7 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_220px]">
                        <div className="min-w-0 overflow-hidden rounded-2xl bg-slate-50 p-5">
                          <InlineFileUpload
                            label="Institution logo"
                            required
                            files={logoFiles}
                            onUpload={setLogo}
                            onRemove={removeLogo}
                            hint="PNG, JPG or WebP · 5 MB max"
                            inlineImagePreview
                          />
                        </div>
                        <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-1">
                          {(['primaryColor', 'secondaryColor'] as const).map((name) => (
                            <label
                              key={name}
                              className="block rounded-xl bg-slate-50 p-4 text-sm font-medium text-slate-700"
                            >
                              {name === 'primaryColor' ? 'Primary colour' : 'Secondary colour'}{' '}
                              <span className="text-red-500">*</span>
                              <div className="mt-3 flex min-w-0 items-center gap-3">
                                <input
                                  type="color"
                                  name={name}
                                  value={
                                    /^#[0-9A-Fa-f]{6}$/.test(formik.values[name])
                                      ? formik.values[name]
                                      : '#000000'
                                  }
                                  onChange={formik.handleChange}
                                  className="h-11 w-14 cursor-pointer rounded-lg bg-white p-1"
                                />
                                <input
                                  type="text"
                                  name={name}
                                  value={formik.values[name]}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                                      void formik.setFieldValue(name, value.toUpperCase());
                                    }
                                  }}
                                  onBlur={formik.handleBlur}
                                  maxLength={7}
                                  inputMode="text"
                                  aria-label={`${name === 'primaryColor' ? 'Primary' : 'Secondary'} colour hex code`}
                                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-xs uppercase text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                                  placeholder="#0178D7"
                                />
                              </div>
                              {fieldError(name) && (
                                <span className="mt-1.5 block text-xs text-red-500">
                                  {fieldError(name)}
                                </span>
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 4 && (
                    <div>
                      <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                        Connect a custom domain
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Keep the managed recovery address or optionally connect an institution-owned
                        domain. You can also configure this later in Settings.
                      </p>
                      <div className="mt-7 rounded-2xl bg-slate-50 p-5">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-600">
                          Managed address — always available
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-800">
                          {domainSettings?.defaultDomain || 'Your tenant subdomain'}
                        </p>
                      </div>
                      {domainError && (
                        <div className="mt-4 rounded-xl bg-amber-50 p-4 text-xs text-amber-800">
                          Custom-domain controls are temporarily unavailable. You can safely skip
                          this optional step and configure the domain later under Settings.
                        </div>
                      )}
                      <label className="mt-5 block">
                        <span className="text-sm font-medium text-slate-700">
                          Custom domain (optional)
                        </span>
                        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                          <input
                            value={customDomain}
                            onChange={(event) => setCustomDomain(event.target.value)}
                            placeholder="erp.yourinstitution.edu.in"
                            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                          />
                          <CustomButton
                            type="button"
                            onClick={saveDomain}
                            loading={isSavingDomain}
                            loadingText="Saving..."
                            disabled={!customDomain.trim()}
                          >
                            Save domain
                          </CustomButton>
                        </div>
                      </label>
                      {domainSettings?.customDomain && (
                        <div className="mt-5 space-y-4">
                          <div className="rounded-xl bg-blue-50 p-4 text-xs leading-5 text-blue-900">
                            <p className="font-semibold">
                              Add these records with your DNS provider
                            </p>
                            <p className="mt-1 text-blue-700">
                              Open the DNS settings where your institution domain is registered, add
                              both records below, then wait for propagation.
                            </p>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {[
                              {
                                type: 'CNAME',
                                host: domainSettings.customDomain,
                                value: domainSettings.cnameTarget,
                              },
                              {
                                type: 'TXT',
                                host: domainSettings.verificationHost,
                                value: domainSettings.verificationToken,
                              },
                            ].map((record) => (
                              <div key={record.type} className="min-w-0 rounded-xl bg-slate-50 p-4">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-slate-800">
                                    {record.type} record
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => void copyDnsValue(record.value)}
                                    className="cursor-pointer text-xs font-semibold text-primary"
                                  >
                                    Copy value
                                  </button>
                                </div>
                                <p className="mt-3 text-[10px] uppercase tracking-wide text-slate-600">
                                  Host / Name
                                </p>
                                <p
                                  className="mt-1 truncate font-mono text-xs text-slate-700"
                                  title={record.host}
                                >
                                  {record.host || 'Waiting for configuration'}
                                </p>
                                <p className="mt-3 text-[10px] uppercase tracking-wide text-slate-600">
                                  Target / Value
                                </p>
                                <p
                                  className="mt-1 truncate font-mono text-xs text-slate-700"
                                  title={record.value}
                                >
                                  {record.value || 'Waiting for configuration'}
                                </p>
                              </div>
                            ))}
                          </div>
                          <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-800">
                                Domain: {domainSettings.status || 'pending'} · SSL:{' '}
                                {domainSettings.sslStatus || 'pending'}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                DNS is checked automatically every 30 seconds while this step is
                                open.
                              </p>
                            </div>
                            {domainSettings.status !== 'active' && (
                              <CustomButton
                                type="button"
                                onClick={verifyDomain}
                                loading={isVerifyingDomain}
                                loadingText="Checking DNS..."
                              >
                                Verify now
                              </CustomButton>
                            )}
                          </div>
                          <p className="text-xs leading-5 text-slate-500">
                            You do not need to wait here. Continue onboarding and check the same
                            domain and SSL status later under Settings → Custom domain.
                          </p>
                        </div>
                      )}
                      <p className="mt-4 text-xs leading-5 text-slate-500">
                        Choose Continue without entering a domain to skip this step.
                      </p>
                    </div>
                  )}

                  {step === 5 && (
                    <div>
                      <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                        Everything looks ready
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Review your workspace identity before activation.
                      </p>
                      <div className="mt-7 overflow-hidden rounded-2xl bg-slate-50">
                        <div className="flex items-center gap-4 bg-blue-50 p-5">
                          <span className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-white text-lg font-semibold text-primary">
                            {logoFiles[0]?.url ? (
                              <Image
                                src={logoFiles[0].url}
                                alt={`${formik.values.name || 'Institution'} logo`}
                                fill
                                sizes="56px"
                                className="object-contain p-1.5"
                                unoptimized
                              />
                            ) : (
                              formik.values.shortCode.slice(0, 3).toUpperCase()
                            )}
                          </span>
                          <div>
                            <p className="text-lg font-semibold text-slate-900">
                              {formik.values.name}
                            </p>
                            <p className="text-sm text-slate-500">
                              {formik.values.shortCode} ·{' '}
                              {formik.values.tagline || 'Institution workspace'}
                            </p>
                          </div>
                        </div>
                        <dl className="grid gap-4 p-5 text-sm sm:grid-cols-2">
                          <div>
                            <dt className="text-xs text-slate-600">Official email</dt>
                            <dd className="mt-1 font-medium text-slate-700">
                              {formik.values.email}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-slate-600">Phone</dt>
                            <dd className="mt-1 font-medium text-slate-700">
                              {formik.values.phone}
                            </dd>
                          </div>
                          <div className="sm:col-span-2">
                            <dt className="text-xs text-slate-600">Address</dt>
                            <dd className="mt-1 font-medium text-slate-700">
                              {formik.values.address}
                            </dd>
                          </div>
                        </dl>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {[
                          {
                            label: 'Institution identity',
                            detail: `${formik.values.name} (${formik.values.shortCode})`,
                            ready: Boolean(formik.values.name && formik.values.shortCode),
                          },
                          {
                            label: 'Official contacts',
                            detail: formik.values.email,
                            ready: Boolean(
                              formik.values.email && formik.values.phone && formik.values.address,
                            ),
                          },
                          {
                            label: 'Tenant branding',
                            detail: 'Logo and colour theme',
                            ready: Boolean(logoFile || savedLogoUrl),
                          },
                          {
                            label: 'Institution domain',
                            detail: domainSettings?.customDomain
                              ? domainSettings.status === 'active'
                                ? 'Verified and active'
                                : 'Saved — DNS can finish later'
                              : 'Managed recovery address',
                            ready: true,
                          },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="flex items-start gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-100"
                          >
                            {item.ready ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            ) : (
                              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            )}
                            <div>
                              <p className="text-xs font-semibold text-slate-800">{item.label}</p>
                              <p className="mt-0.5 text-[11px] text-slate-500">{item.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex gap-3 rounded-xl bg-emerald-50 p-4 text-xs leading-5 text-emerald-800">
                        <ShieldCheck className="h-5 w-5 shrink-0" />
                        Activating unlocks the ERP. Academic structure, people, integrations and
                        backups remain available as guided readiness tasks from Settings and their
                        respective modules.
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={() => void move(step - 1)}
                disabled={step === 0 || isSaving || isSavingProgress}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-0"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              {step < steps.length - 1 ? (
                <CustomButton
                  type="button"
                  onClick={() => void move(step + 1)}
                  loading={isSavingProgress}
                  loadingText="Saving progress..."
                  endIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Continue
                </CustomButton>
              ) : (
                <CustomButton
                  type="submit"
                  loading={isSaving || isSavingProgress}
                  loadingText={isSavingProgress ? 'Saving progress...' : 'Preparing workspace...'}
                >
                  Activate workspace
                </CustomButton>
              )}
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

export default UseProtectedRoutes(OnboardingPage, ['super_admin', 'admin']);

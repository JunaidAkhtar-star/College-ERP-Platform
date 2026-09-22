'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { ArrowRight, Mail, ChevronRight, X, KeyRound, CreditCard, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import CustomButton from '@/shared/core/CustomButton';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import AvailableConnectorsSection from './AvailableConnectorsSection';

type TConnectorId =
  | 'smtp'
  | 'google_sso'
  | 'microsoft_sso'
  | 'razorpay'
  | 'stripe'
  | 'paytm'
  | 'phonepe'
  | 'cashfree';

interface IIntegration {
  provider: string;
  enabled: boolean;
  config: Record<string, string | number | boolean>;
  hasSecret: boolean;
  status: 'not_configured' | 'configured' | 'healthy' | 'error';
  lastTestedAt?: string;
  lastError?: string;
}

interface ISsoConfiguration {
  provider: 'google' | 'microsoft';
  enabled: boolean;
  clientId?: string;
  hasClientSecret: boolean;
  microsoftTenantId?: string;
  allowedDomains: string[];
  autoProvision: boolean;
  status: 'disabled' | 'configured' | 'healthy' | 'error';
  lastTestedAt?: string;
  lastError?: string;
}

interface ISsoConfigurationsResponse {
  success: boolean;
  data: {
    providers: ISsoConfiguration[];
    provisionableRoles: string[];
  };
}

const fieldStyle =
  'mt-2 w-full rounded-xl bg-white px-3.5 py-3 text-sm text-slate-900 outline-none ring-1 ring-slate-200 transition placeholder:text-slate-600 focus:ring-2 focus:ring-primary/30';
const labelStyle = 'text-xs font-semibold text-slate-700';

function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {description && <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition duration-200 focus:outline-none focus:ring-4 focus:ring-primary/15 ${
          checked ? 'bg-primary' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute left-1 top-1 size-5 rounded-full bg-white transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function ProviderFormHeader({
  group,
  label,
  description,
  logo,
  status,
  tone,
}: {
  group: string;
  label: string;
  description: string;
  logo: string;
  status: IIntegration['status'];
  tone: string;
}) {
  return (
    <header className={`shrink-0 rounded-t-3xl bg-gradient-to-br ${tone} p-5 sm:p-6`}>
      <div className="flex items-center justify-between gap-5">
        <div className="min-w-0">
          <h3 className="text-xl font-bold">{group}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-700">{label}</p>
          <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">{description}</p>
        </div>
        <span className="flex h-11 w-20 shrink-0 items-center justify-center rounded-2xl bg-white p-2">
          <Image
            src={logo}
            alt={`${label} logo`}
            width={28}
            height={28}
            unoptimized
            className="h-7 w-full object-contain"
          />
        </span>
      </div>
      <div className="mt-4">
        <span
          className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
            status === 'healthy'
              ? 'bg-emerald-100 text-emerald-700'
              : status === 'error'
                ? 'bg-rose-100 text-rose-700'
                : status === 'configured'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-white/80 text-slate-600'
          }`}
        >
          {status.replace('_', ' ')}
        </span>
      </div>
    </header>
  );
}

function SetupProgress() {
  return (
    <div className="grid grid-cols-3 items-center gap-2 text-center text-[11px] font-semibold text-slate-500">
      {['Save credentials', 'Test readiness', 'Available'].map((step, index) => (
        <div key={step} className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-primary">
            {index + 1}
          </span>
          <span className="hidden sm:inline">{step}</span>
          {index < 2 && <ArrowRight className="ml-auto size-3.5 text-slate-300" />}
        </div>
      ))}
    </div>
  );
}

export default function TenantIntegrationsTab() {
  const query = useSwr<{ success: boolean; data: IIntegration[] }>('tenant-integrations');
  const ssoQuery = useSwr<ISsoConfigurationsResponse>('sso/configurations');
  const integrations = query.data?.data ?? [];
  const ssoConfigurations = ssoQuery.data?.data.providers ?? [];

  const getIntegration = (provider: string) => integrations.find((i) => i.provider === provider);

  const smtp = getIntegration('smtp');
  const googleSso = ssoConfigurations.find((item) => item.provider === 'google');
  const microsoftSso = ssoConfigurations.find((item) => item.provider === 'microsoft');
  const razorpay = getIntegration('razorpay');
  const stripe = getIntegration('stripe');
  const paytm = getIntegration('paytm');
  const phonepe = getIntegration('phonepe');
  const cashfree = getIntegration('cashfree');

  const [activeDrawer, setActiveDrawer] = useState<TConnectorId | null>(null);

  if (query.isLoading || ssoQuery.isLoading) {
    return (
      <div className="space-y-4" aria-label="Loading institution integrations">
        <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-3xl bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (query.error || ssoQuery.error) {
    return (
      <div className="rounded-2xl bg-rose-50 p-5 text-sm text-rose-700">
        <p className="font-semibold">Institution integrations could not be loaded</p>
        <p className="mt-1 text-xs leading-5">
          Refresh this section before changing credentials or provider availability.
        </p>
        <CustomButton
          variant="secondary"
          className="mt-4 w-fit!"
          onClick={() => void Promise.all([query.mutate(), ssoQuery.mutate()])}
        >
          Try again
        </CustomButton>
      </div>
    );
  }

  const sections = [
    {
      title: 'Single Sign-On (SSO)',
      desc: 'Institutional identity providers and OpenID Connect login',
      icon: ShieldCheck,
      items: [
        {
          id: 'google_sso' as const,
          label: 'Google Workspace SSO',
          category: 'Authentication',
          description:
            'Allow students and faculty to sign in using their Google institutional email.',
          logo: '/provider-logos/google.svg',
          icon: KeyRound,
          status:
            googleSso?.status === 'disabled'
              ? 'not_configured'
              : (googleSso?.status ?? 'not_configured'),
          enabled: googleSso?.enabled ?? false,
        },
        {
          id: 'microsoft_sso' as const,
          label: 'Microsoft Entra ID (Azure AD) SSO',
          category: 'Authentication',
          description: 'Allow institutional login via Microsoft 365 / Entra ID accounts.',
          logo: '/provider-logos/microsoft.svg',
          icon: KeyRound,
          status:
            microsoftSso?.status === 'disabled'
              ? 'not_configured'
              : (microsoftSso?.status ?? 'not_configured'),
          enabled: microsoftSso?.enabled ?? false,
        },
      ],
    },
    {
      title: 'Email & Messaging Gateways',
      desc: 'Outbound SMTP email mailbox and SMS gateways',
      icon: Mail,
      items: [
        {
          id: 'smtp' as const,
          label: 'Institution Email (SMTP)',
          category: 'Email Mailbox',
          description: 'Send all operational, fee receipts and academic emails via custom mailbox.',
          logo: '/provider-logos/smtp.svg',
          icon: Mail,
          status: smtp?.status ?? 'not_configured',
          enabled: smtp?.enabled ?? false,
        },
      ],
    },
    {
      title: 'Finance & Payment Gateways',
      desc: 'Collect student fees online directly into your merchant bank account',
      icon: CreditCard,
      items: [
        {
          id: 'razorpay' as const,
          label: 'Razorpay Payments',
          category: 'Payment Gateway',
          description:
            'UPI, Credit/Debit cards, NetBanking & Auto-debit for student fee collection.',
          logo: '/provider-logos/razorpay.png',
          icon: CreditCard,
          status: razorpay?.status ?? 'not_configured',
          enabled: razorpay?.enabled ?? false,
        },
        {
          id: 'stripe' as const,
          label: 'Stripe Global Payments',
          category: 'Payment Gateway',
          description:
            'International tuition fee payments, credit card processing and recurring billing.',
          logo: '/provider-logos/stripe.svg',
          icon: CreditCard,
          status: stripe?.status ?? 'not_configured',
          enabled: stripe?.enabled ?? false,
        },
        {
          id: 'paytm' as const,
          label: 'Paytm Business Gateway',
          category: 'Payment Gateway',
          description: 'Paytm Wallet, UPI Intent, and instant QR fee payments for students.',
          logo: '/provider-logos/paytm.svg',
          icon: CreditCard,
          status: paytm?.status ?? 'not_configured',
          enabled: paytm?.enabled ?? false,
        },
        {
          id: 'phonepe' as const,
          label: 'PhonePe Payment Gateway',
          category: 'Payment Gateway',
          description:
            'High-success rate UPI and PhonePe Wallet checkout for admissions & hostel fees.',
          logo: '/provider-logos/phonepe.svg',
          icon: CreditCard,
          status: phonepe?.status ?? 'not_configured',
          enabled: phonepe?.enabled ?? false,
        },
        {
          id: 'cashfree' as const,
          label: 'Cashfree Payments',
          category: 'Payment Gateway',
          description:
            'Zero-fee UPI, Buy-Now-Pay-Later (BNPL) fee EMI, and instant refund settlements.',
          logo: '/provider-logos/cashfree.svg',
          icon: CreditCard,
          status: cashfree?.status ?? 'not_configured',
          enabled: cashfree?.enabled ?? false,
        },
      ],
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Connectors, Integrations &amp; SSO</h2>
        <p className="mt-1 text-sm text-slate-500">
          Configure institutional authentication providers, custom email/SMS gateways, and payment
          processors.
        </p>
      </div>

      {/* ── Categorized Sections ───────────────────────────────────────────── */}
      {sections.map((sec) => {
        const SectionIcon = sec.icon;
        return (
          <div key={sec.title} className="space-y-3.5">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <SectionIcon className="size-4 text-primary" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">{sec.title}</h3>
                <p className="text-xs text-slate-600">{sec.desc}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {sec.items.map((item) => {
                const FallbackIcon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveDrawer(item.id)}
                    className="group flex min-h-28 items-center gap-4 rounded-3xl bg-slate-50 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-primary/10"
                  >
                    <span
                      className={`flex h-11 shrink-0 items-center justify-center rounded-2xl bg-white p-2 ${
                        ['razorpay', 'stripe', 'paytm', 'phonepe', 'cashfree'].includes(item.id)
                          ? 'w-20'
                          : 'w-11'
                      }`}
                    >
                      {item.logo ? (
                        <Image
                          src={item.logo}
                          alt={`${item.label} logo`}
                          width={28}
                          height={28}
                          unoptimized
                          className="h-7 w-full object-contain"
                        />
                      ) : (
                        <FallbackIcon className="size-6 text-primary" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-bold text-slate-900">
                          {item.label}
                        </span>
                        <span
                          className={`size-2.5 shrink-0 rounded-full ${
                            item.status === 'healthy'
                              ? 'bg-emerald-500'
                              : item.status === 'error'
                                ? 'bg-rose-500'
                                : item.status === 'configured'
                                  ? 'bg-amber-400'
                                  : 'bg-slate-300'
                          }`}
                        />
                      </span>
                      <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-500">
                        {item.description}
                      </span>
                      <span
                        className={`mt-2 block text-xs font-semibold ${
                          item.status === 'healthy' ? 'text-emerald-700' : 'text-primary'
                        }`}
                      >
                        {item.status === 'healthy'
                          ? 'Configured and connected'
                          : item.status === 'error'
                            ? 'Needs attention'
                            : item.status === 'configured'
                              ? 'Saved — run readiness test'
                              : 'Set up provider'}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <AvailableConnectorsSection />

      {/* ── Slide-Over Drawers ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {activeDrawer === 'smtp' && (
          <SmtpDrawer
            smtp={smtp}
            onClose={() => setActiveDrawer(null)}
            onSaved={async () => {
              await query.mutate();
            }}
          />
        )}
        {activeDrawer === 'google_sso' && (
          <SsoDrawer
            provider="google"
            integration={googleSso}
            onClose={() => setActiveDrawer(null)}
            onSaved={async () => {
              await ssoQuery.mutate();
            }}
          />
        )}
        {activeDrawer === 'microsoft_sso' && (
          <SsoDrawer
            provider="microsoft"
            integration={microsoftSso}
            onClose={() => setActiveDrawer(null)}
            onSaved={async () => {
              await ssoQuery.mutate();
            }}
          />
        )}
        {activeDrawer === 'razorpay' && (
          <GenericConnectorDrawer
            provider="razorpay"
            label="Razorpay Payments"
            logo="/provider-logos/razorpay.png"
            integration={razorpay}
            onClose={() => setActiveDrawer(null)}
            onSaved={async () => {
              await query.mutate();
            }}
          />
        )}
        {activeDrawer === 'stripe' && (
          <GenericConnectorDrawer
            provider="stripe"
            label="Stripe Global Payments"
            logo="/provider-logos/stripe.svg"
            integration={stripe}
            onClose={() => setActiveDrawer(null)}
            onSaved={async () => {
              await query.mutate();
            }}
          />
        )}
        {activeDrawer === 'paytm' && (
          <GenericConnectorDrawer
            provider="paytm"
            label="Paytm Business Gateway"
            logo="/provider-logos/paytm.svg"
            integration={paytm}
            onClose={() => setActiveDrawer(null)}
            onSaved={async () => {
              await query.mutate();
            }}
          />
        )}
        {activeDrawer === 'phonepe' && (
          <GenericConnectorDrawer
            provider="phonepe"
            label="PhonePe Payment Gateway"
            logo="/provider-logos/phonepe.svg"
            integration={phonepe}
            onClose={() => setActiveDrawer(null)}
            onSaved={async () => {
              await query.mutate();
            }}
          />
        )}
        {activeDrawer === 'cashfree' && (
          <GenericConnectorDrawer
            provider="cashfree"
            label="Cashfree Payments"
            logo="/provider-logos/cashfree.svg"
            integration={cashfree}
            onClose={() => setActiveDrawer(null)}
            onSaved={async () => {
              await query.mutate();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── SMTP Drawer ─────────────────────────────────────────────────────────────

function SmtpDrawer({
  smtp,
  onClose,
  onSaved,
}: {
  smtp?: IIntegration;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { mutation, isLoading } = useMutation();

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      enabled: smtp?.enabled ?? false,
      host: String(smtp?.config.host ?? ''),
      port: Number(smtp?.config.port ?? 587),
      secure: Boolean(smtp?.config.secure),
      username: String(smtp?.config.username ?? ''),
      fromName: String(smtp?.config.fromName ?? ''),
      fromEmail: String(smtp?.config.fromEmail ?? ''),
      replyTo: String(smtp?.config.replyTo ?? ''),
      secret: '',
    },
    validationSchema: Yup.object({
      host: Yup.string().required('SMTP host is required'),
      port: Yup.number().min(1).max(65535).required('Port is required'),
      username: Yup.string().required('Username is required'),
      fromName: Yup.string().required('Sender name is required'),
      fromEmail: Yup.string().email('Invalid email').required('Sender email is required'),
      replyTo: Yup.string().email('Invalid email'),
    }),
    onSubmit: async (values) => {
      const { enabled, secret, ...config } = values;
      const res = await mutation('tenant-integrations/smtp', {
        method: 'PUT',
        body: { enabled, config, secrets: secret ? { password: secret } : {} },
      });
      if (res?.results?.success) {
        toast.success('SMTP configuration saved.');
        await onSaved();
        onClose();
      }
    },
  });

  const testConnection = async () => {
    const res = await mutation('tenant-integrations/smtp/test', {
      method: 'POST',
      body: {},
    });
    if (res?.results?.success) {
      toast.success('SMTP connection verified successfully!');
      await onSaved();
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 overscroll-none bg-slate-200/80 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.aside
        role="dialog"
        aria-modal="true"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 280 }}
        className="ml-auto flex h-dvh w-full max-w-2xl flex-col bg-white"
      >
        <div className="flex items-center justify-between bg-slate-50 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-white p-2">
              <Image
                src="/provider-logos/smtp.svg"
                alt="SMTP"
                width={24}
                height={24}
                unoptimized
                className="size-6 object-contain"
              />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Institution Email (SMTP)</h3>
              <p className="text-xs text-slate-500">Configure outbound SMTP mail server</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        <form
          onSubmit={formik.handleSubmit}
          className="m-4 flex min-h-0 flex-1 flex-col justify-between overflow-hidden rounded-3xl bg-slate-50 sm:m-6"
        >
          <ProviderFormHeader
            group="SMTP"
            label="Institution Email"
            description="Send operational, fee and academic email through the institution mailbox."
            logo="/provider-logos/smtp.svg"
            status={smtp?.status ?? 'not_configured'}
            tone="from-emerald-100 to-teal-50 text-emerald-950"
          />
          <div className="space-y-4 overflow-y-auto p-6">
            <SetupProgress />
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className={labelStyle}>SMTP Host</span>
                <input
                  type="text"
                  name="host"
                  value={formik.values.host}
                  onChange={formik.handleChange}
                  placeholder="smtp.office365.com"
                  className={fieldStyle}
                />
              </label>

              <label>
                <span className={labelStyle}>Port</span>
                <input
                  type="number"
                  name="port"
                  value={formik.values.port}
                  onChange={formik.handleChange}
                  placeholder="587"
                  className={fieldStyle}
                />
              </label>

              <label>
                <span className={labelStyle}>Username</span>
                <input
                  type="text"
                  name="username"
                  value={formik.values.username}
                  onChange={formik.handleChange}
                  placeholder="erp@institution.edu"
                  className={fieldStyle}
                />
              </label>

              <label>
                <span className={labelStyle}>Sender Name</span>
                <input
                  type="text"
                  name="fromName"
                  value={formik.values.fromName}
                  onChange={formik.handleChange}
                  placeholder="Institution ERP"
                  className={fieldStyle}
                />
              </label>

              <label>
                <span className={labelStyle}>Sender Email</span>
                <input
                  type="email"
                  name="fromEmail"
                  value={formik.values.fromEmail}
                  onChange={formik.handleChange}
                  placeholder="erp@institution.edu"
                  className={fieldStyle}
                />
              </label>

              <label>
                <span className={labelStyle}>Reply-To Email</span>
                <input
                  type="email"
                  name="replyTo"
                  value={formik.values.replyTo}
                  onChange={formik.handleChange}
                  placeholder="support@institution.edu"
                  className={fieldStyle}
                />
              </label>
            </div>

            <label className="block">
              <span className={labelStyle}>
                SMTP Password {smtp?.hasSecret && '(leave blank to keep saved password)'}
              </span>
              <input
                type="password"
                name="secret"
                value={formik.values.secret}
                onChange={formik.handleChange}
                placeholder={smtp?.hasSecret ? 'Saved securely' : 'Enter app password'}
                className={fieldStyle}
                autoComplete="new-password"
              />
            </label>

            <ToggleSwitch
              checked={formik.values.secure}
              onChange={(checked) => formik.setFieldValue('secure', checked)}
              label="TLS/SSL secure transport"
              description="Connect to the mail provider using encrypted transport."
            />

            <ToggleSwitch
              checked={formik.values.enabled}
              onChange={(checked) => formik.setFieldValue('enabled', checked)}
              label="Enable SMTP provider"
              description="Use this mailbox for institution email delivery after readiness testing."
            />
          </div>

          <div className="flex items-center justify-between rounded-b-3xl bg-white px-6 py-4">
            <CustomButton
              type="button"
              variant="tertiary"
              onClick={testConnection}
              disabled={!smtp?.enabled}
            >
              Test connection
            </CustomButton>
            <div className="flex gap-2">
              <CustomButton type="button" variant="secondary" onClick={onClose}>
                Cancel
              </CustomButton>
              <CustomButton type="submit" loading={isLoading}>
                Save configuration
              </CustomButton>
            </div>
          </div>
        </form>
      </motion.aside>
    </motion.div>
  );
}

// ─── Single Sign-On (SSO) Drawer ──────────────────────────────────────────────

function SsoDrawer({
  provider,
  integration,
  onClose,
  onSaved,
}: {
  provider: 'google' | 'microsoft';
  integration?: ISsoConfiguration;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { mutation, isLoading } = useMutation();
  const isGoogle = provider === 'google';
  const label = isGoogle ? 'Google Workspace' : 'Microsoft Entra ID';
  const logo = isGoogle ? '/provider-logos/google.svg' : '/provider-logos/microsoft.svg';

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      enabled: integration?.enabled ?? false,
      clientId: integration?.clientId ?? '',
      tenantId: integration?.microsoftTenantId ?? 'common',
      allowedDomains: integration?.allowedDomains.join(', ') ?? '',
      secret: '',
    },
    validationSchema: Yup.object({
      clientId: Yup.string().required('Client ID is required'),
    }),
    onSubmit: async (values) => {
      const res = await mutation(`sso/configurations/${provider}`, {
        method: 'PUT',
        body: {
          enabled: values.enabled,
          clientId: values.clientId.trim(),
          clientSecret: values.secret.trim() || undefined,
          microsoftTenantId: isGoogle ? undefined : values.tenantId.trim(),
          allowedDomains: values.allowedDomains
            .split(',')
            .map((domain) => domain.trim().toLowerCase())
            .filter(Boolean),
          autoProvision: false,
        },
      });
      if (res?.results?.success) {
        toast.success(`${label} SSO integration saved.`);
        await onSaved();
        onClose();
      }
    },
  });

  const testConnection = async () => {
    const res = await mutation(`sso/configurations/${provider}/test`, {
      method: 'POST',
      body: {},
    });
    if (res?.results?.success) {
      toast.success(`${label} SSO connection verified successfully!`);
      await onSaved();
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 overscroll-none bg-slate-200/80 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.aside
        role="dialog"
        aria-modal="true"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 280 }}
        className="ml-auto flex h-dvh w-full max-w-2xl flex-col bg-white"
      >
        <div className="flex items-center justify-between bg-slate-50 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-white p-2">
              <Image
                src={logo}
                alt={label}
                width={24}
                height={24}
                unoptimized
                className="size-6 object-contain"
              />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{label} Single Sign-On</h3>
              <p className="text-xs text-slate-500">Configure OIDC OpenID Connect authentication</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        <form
          onSubmit={formik.handleSubmit}
          className="m-4 flex min-h-0 flex-1 flex-col justify-between overflow-hidden rounded-3xl bg-slate-50 sm:m-6"
        >
          <ProviderFormHeader
            group={isGoogle ? 'Google' : 'Microsoft'}
            label={`${label} Single Sign-On`}
            description={`Allow approved institution users to authenticate securely with ${label}.`}
            logo={logo}
            status={
              integration?.status === 'disabled'
                ? 'not_configured'
                : (integration?.status ?? 'not_configured')
            }
            tone={
              isGoogle
                ? 'from-sky-100 to-blue-50 text-sky-950'
                : 'from-violet-100 to-indigo-50 text-violet-950'
            }
          />
          <div className="space-y-4 overflow-y-auto p-6">
            <SetupProgress />
            <label className="block">
              <span className={labelStyle}>OAuth Client ID</span>
              <input
                type="text"
                name="clientId"
                value={formik.values.clientId}
                onChange={formik.handleChange}
                placeholder={
                  isGoogle
                    ? '000000000-xxxx.apps.googleusercontent.com'
                    : '00000000-0000-0000-0000-000000000000'
                }
                className={fieldStyle}
              />
            </label>

            {!isGoogle && (
              <label className="block">
                <span className={labelStyle}>Microsoft Tenant ID</span>
                <input
                  type="text"
                  name="tenantId"
                  value={formik.values.tenantId}
                  onChange={formik.handleChange}
                  placeholder="common or your-azure-tenant-id"
                  className={fieldStyle}
                />
              </label>
            )}

            <label className="block">
              <span className={labelStyle}>
                Client Secret {integration?.hasClientSecret && '(leave blank to keep saved secret)'}
              </span>
              <input
                type="password"
                name="secret"
                value={formik.values.secret}
                onChange={formik.handleChange}
                placeholder={
                  integration?.hasClientSecret ? 'Saved securely' : 'Enter OAuth client secret'
                }
                className={fieldStyle}
                autoComplete="new-password"
              />
            </label>

            <label className="block">
              <span className={labelStyle}>Allowed Email Domains (Comma-separated)</span>
              <input
                type="text"
                name="allowedDomains"
                value={formik.values.allowedDomains}
                onChange={formik.handleChange}
                placeholder="institution.edu, student.institution.edu"
                className={fieldStyle}
              />
            </label>

            <ToggleSwitch
              checked={formik.values.enabled}
              onChange={(checked) => formik.setFieldValue('enabled', checked)}
              label={`Enable ${label} Single Sign-On`}
              description="Allow approved institution users to sign in with this identity provider."
            />
          </div>

          <div className="flex items-center justify-between rounded-b-3xl bg-white px-6 py-4">
            <CustomButton
              type="button"
              variant="tertiary"
              onClick={testConnection}
              disabled={!integration?.enabled}
            >
              Test connection
            </CustomButton>
            <div className="flex gap-2">
              <CustomButton type="button" variant="secondary" onClick={onClose}>
                Cancel
              </CustomButton>
              <CustomButton type="submit" loading={isLoading}>
                Save SSO configuration
              </CustomButton>
            </div>
          </div>
        </form>
      </motion.aside>
    </motion.div>
  );
}

// ─── Tenant Payment Gateway Drawer ──────────────────────────────────────────

function GenericConnectorDrawer({
  provider,
  label,
  logo,
  integration,
  onClose,
  onSaved,
}: {
  provider: string;
  label: string;
  logo?: string;
  integration?: IIntegration;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { mutation, isLoading } = useMutation();
  const isPaymentGateway = [
    'razorpay',
    'stripe',
    'paytm',
    'phonepe',
    'cashfree',
    'webhooks',
  ].includes(provider);
  const backendWebhookUrl =
    typeof window !== 'undefined'
      ? `${process.env.NEXT_PUBLIC_BACKEND_URL || window.location.origin + '/api/v1'}/tenant-integrations/${provider}/webhook`
      : '';
  const providerFields: Record<
    string,
    { accountLabel: string; accountPlaceholder: string; secretLabel: string; webhookLabel: string }
  > = {
    razorpay: {
      accountLabel: 'Razorpay Key ID',
      accountPlaceholder: 'rzp_test_… or rzp_live_…',
      secretLabel: 'Razorpay Key Secret',
      webhookLabel: 'Razorpay Webhook Secret',
    },
    stripe: {
      accountLabel: 'Account Label (Optional)',
      accountPlaceholder: 'Institution Stripe account',
      secretLabel: 'Stripe Secret Key',
      webhookLabel: 'Stripe Webhook Signing Secret',
    },
    paytm: {
      accountLabel: 'Paytm Merchant ID',
      accountPlaceholder: 'Enter merchant ID',
      secretLabel: 'Paytm Merchant Key',
      webhookLabel: 'Paytm Webhook Checksum Key',
    },
    phonepe: {
      accountLabel: 'PhonePe Client ID',
      accountPlaceholder: 'Enter PhonePe OAuth client ID',
      secretLabel: 'PhonePe Client Secret',
      webhookLabel: 'PhonePe Webhook Password',
    },
    cashfree: {
      accountLabel: 'Cashfree App ID',
      accountPlaceholder: 'Enter app ID',
      secretLabel: 'Cashfree Secret Key',
      webhookLabel: 'Cashfree Webhook Secret (Optional)',
    },
  };
  const fieldCopy = providerFields[provider] ?? {
    accountLabel: 'API Key / Account ID',
    accountPlaceholder: 'Enter account key',
    secretLabel: 'API Secret / Private Token',
    webhookLabel: 'Webhook Signing Secret',
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      enabled: integration?.enabled ?? false,
      apiKey: String(
        integration?.config.keyId ??
          integration?.config.appId ??
          integration?.config.merchantId ??
          integration?.config.accountLabel ??
          integration?.config.apiKey ??
          '',
      ),
      apiSecret: '',
      webhookSecret: '',
      environment: String(integration?.config.environment ?? 'sandbox'),
      saltIndex: String(integration?.config.saltIndex ?? '1'),
      websiteName: String(integration?.config.websiteName ?? 'DEFAULT'),
      webhookUsername: String(integration?.config.webhookUsername ?? ''),
    },
    onSubmit: async (values) => {
      const { enabled, apiSecret, webhookSecret, ...config } = values;
      const res = await mutation(`tenant-integrations/${provider}`, {
        method: 'PUT',
        body: {
          enabled,
          config,
          secrets: {
            ...(apiSecret ? { secretKey: apiSecret } : {}),
            ...(webhookSecret ? { webhookSecret } : {}),
          },
        },
      });
      if (res?.results?.success) {
        toast.success(`${label} configuration saved.`);
        await onSaved();
        onClose();
      }
    },
  });

  const testConnection = async () => {
    const res = await mutation(`tenant-integrations/${provider}/test`, {
      method: 'POST',
      body: {},
    });
    if (res?.results?.success) {
      toast.success(`${label} connection verified successfully!`);
      await onSaved();
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 overscroll-none bg-slate-200/80 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.aside
        role="dialog"
        aria-modal="true"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 280 }}
        className="ml-auto flex h-dvh w-full max-w-2xl flex-col bg-white"
      >
        <div className="flex items-center justify-between bg-slate-50 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            {logo ? (
              <div className="flex size-11 items-center justify-center rounded-2xl bg-white p-2">
                <Image
                  src={logo}
                  alt={label}
                  width={24}
                  height={24}
                  unoptimized
                  className="size-6 object-contain"
                />
              </div>
            ) : null}
            <div>
              <h3 className="text-base font-bold text-slate-900">{label}</h3>
              <p className="text-xs text-slate-500">Configure credentials &amp; API keys</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        <form
          onSubmit={formik.handleSubmit}
          className="m-4 flex min-h-0 flex-1 flex-col justify-between overflow-hidden rounded-3xl bg-slate-50 sm:m-6"
        >
          <ProviderFormHeader
            group={label.split(' ')[0]}
            label={label}
            description="Configure tenant-owned merchant credentials and verify provider readiness."
            logo={logo ?? '/provider-logos/razorpay.png'}
            status={integration?.status ?? 'not_configured'}
            tone="from-indigo-100 to-blue-50 text-indigo-950"
          />
          <div className="space-y-4 overflow-y-auto p-6">
            <SetupProgress />
            <label className="block">
              <span className={labelStyle}>{fieldCopy.accountLabel}</span>
              <input
                type="text"
                name="apiKey"
                value={formik.values.apiKey}
                onChange={formik.handleChange}
                placeholder={fieldCopy.accountPlaceholder}
                className={fieldStyle}
              />
            </label>

            {['paytm', 'phonepe', 'cashfree'].includes(provider) && (
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className={labelStyle}>Environment</span>
                  <select
                    name="environment"
                    value={formik.values.environment}
                    onChange={formik.handleChange}
                    className={fieldStyle}
                  >
                    <option value="sandbox">
                      {provider === 'paytm' ? 'Staging / Test' : 'Sandbox / Test'}
                    </option>
                    <option value="production">Production / Live</option>
                  </select>
                </label>
                {provider === 'phonepe' && (
                  <>
                    <label>
                      <span className={labelStyle}>Client Version</span>
                      <input
                        type="text"
                        name="saltIndex"
                        value={formik.values.saltIndex}
                        onChange={formik.handleChange}
                        placeholder="1"
                        className={fieldStyle}
                      />
                    </label>
                    <label>
                      <span className={labelStyle}>Webhook Username</span>
                      <input
                        type="text"
                        name="webhookUsername"
                        value={formik.values.webhookUsername}
                        onChange={formik.handleChange}
                        placeholder="Configured in PhonePe dashboard"
                        className={fieldStyle}
                      />
                    </label>
                  </>
                )}
                {provider === 'paytm' && (
                  <label>
                    <span className={labelStyle}>Website Name</span>
                    <input
                      type="text"
                      name="websiteName"
                      value={formik.values.websiteName}
                      onChange={formik.handleChange}
                      placeholder="DEFAULT"
                      className={fieldStyle}
                    />
                  </label>
                )}
              </div>
            )}

            <label className="block">
              <span className={labelStyle}>
                {fieldCopy.secretLabel}{' '}
                {integration?.hasSecret && '(leave blank to keep saved secret)'}
              </span>
              <input
                type="password"
                name="apiSecret"
                value={formik.values.apiSecret}
                onChange={formik.handleChange}
                placeholder={
                  integration?.hasSecret ? 'Saved securely' : 'Enter secret key or auth token'
                }
                className={fieldStyle}
                autoComplete="new-password"
              />
            </label>

            {['razorpay', 'stripe', 'phonepe'].includes(provider) && (
              <label className="block">
                <span className={labelStyle}>
                  {fieldCopy.webhookLabel}{' '}
                  {integration?.hasSecret && '(leave blank to keep saved secret)'}
                </span>
                <input
                  type="password"
                  name="webhookSecret"
                  value={formik.values.webhookSecret}
                  onChange={formik.handleChange}
                  placeholder={
                    integration?.hasSecret
                      ? 'Saved securely'
                      : 'Enter the signing secret from the provider dashboard'
                  }
                  className={fieldStyle}
                  autoComplete="new-password"
                />
              </label>
            )}

            {isPaymentGateway && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <span className={labelStyle}>Your Backend Webhook URL</span>
                <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                  Provide this webhook URL in your {label} merchant dashboard to receive automated
                  payment confirmation callbacks.
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={backendWebhookUrl}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(backendWebhookUrl);
                      toast.success('Webhook URL copied to clipboard!');
                    }}
                    className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            <ToggleSwitch
              checked={formik.values.enabled}
              onChange={(checked) => formik.setFieldValue('enabled', checked)}
              label={`Enable ${label}`}
              description="Make this provider available after its connection passes readiness testing."
            />
          </div>

          <div className="flex items-center justify-between rounded-b-3xl bg-white px-6 py-4">
            <CustomButton
              type="button"
              variant="tertiary"
              onClick={testConnection}
              disabled={!integration?.enabled}
            >
              Test connection
            </CustomButton>
            <div className="flex gap-2">
              <CustomButton type="button" variant="secondary" onClick={onClose}>
                Cancel
              </CustomButton>
              <CustomButton type="submit" loading={isLoading}>
                Save connector
              </CustomButton>
            </div>
          </div>
        </form>
      </motion.aside>
    </motion.div>
  );
}

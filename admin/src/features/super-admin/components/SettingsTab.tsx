/**
 * @file SettingsTab.tsx
 * @description Platform configuration, provider readiness and administrator SSO control center.
 * @module features/super-admin/components
 */

'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  Activity,
  ArrowRight,
  BellRing,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Copy,
  CreditCard,
  Database,
  FlaskConical,
  HardDrive,
  Images,
  Info,
  KeyRound,
  LockKeyhole,
  Mail,
  MessageSquareText,
  Server,
  Send,
  Settings2,
  ShieldCheck,
  TriangleAlert,
  Video,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';
import CustomButton from '@/shared/core/CustomButton';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { AnimatePresence, motion } from '@/shared/utils/motion';

type TSection = 'overview' | 'providers' | 'admin-access';
type TSsoProvider = 'google' | 'microsoft';
type TPlatformProvider = 'google_drive' | 'agora' | 'firebase' | 'smtp' | 'cloudinary';
type TProviderStatus = 'not_configured' | 'configured' | 'healthy' | 'error' | 'disabled';

interface IPlatformConfig {
  environment: string;
  masterDatabaseName: string;
  tenantIsolation: string;
  emailConfigured: boolean;
  redisConfigured: boolean;
  firebaseConfigured: boolean;
  invoiceBilling: {
    configured: boolean;
    method: 'bank_transfer_with_admin_verification';
  };
  allowedOriginCount: number;
  retentionDays: {
    notifications: number;
    auditLogs: number;
    softDeletes: number;
    chatMessages: number;
  };
}

interface ISsoConfiguration {
  provider: TSsoProvider;
  enabled: boolean;
  clientId?: string;
  hasClientSecret: boolean;
  microsoftTenantId?: string;
  allowedDomains: string[];
  status?: 'configured' | 'healthy' | 'error' | 'disabled';
  lastTestedAt?: string;
  lastError?: string;
}

interface ISsoResponse {
  providers: ISsoConfiguration[];
}

interface IPlatformIntegration {
  provider: TPlatformProvider;
  group?: string;
  label: string;
  description: string;
  features?: string[];
  secretLabel: string;
  multilineSecret?: boolean;
  fields?: Array<{
    key: string;
    label: string;
    placeholder?: string;
    type?: 'text' | 'number' | 'toggle';
  }>;
  enabled: boolean;
  status: TProviderStatus;
  config: Record<string, string | number | boolean>;
  hasSecret: boolean;
  lastTestedAt?: string;
  lastError?: string;
}

const integrationFieldFallbacks: Record<
  TPlatformProvider,
  NonNullable<IPlatformIntegration['fields']>
> = {
  google_drive: [
    {
      key: 'clientId',
      label: 'OAuth client ID',
      placeholder: '000000000000-xxxx.apps.googleusercontent.com',
    },
    {
      key: 'callbackUrl',
      label: 'Authorized redirect URI',
      placeholder: 'https://api.example.com/api/v1/tenant-backup/google/callback',
    },
  ],
  agora: [{ key: 'appId', label: 'Agora App ID', placeholder: '32-character application ID' }],
  firebase: [
    { key: 'projectId', label: 'Project ID' },
    { key: 'clientEmail', label: 'Service account email' },
    { key: 'apiKey', label: 'Web API key' },
    { key: 'authDomain', label: 'Auth domain' },
    { key: 'messagingSenderId', label: 'Messaging sender ID' },
    { key: 'appId', label: 'Web application ID' },
    { key: 'vapidKey', label: 'Web push VAPID key' },
  ],
  smtp: [
    { key: 'host', label: 'SMTP host' },
    { key: 'port', label: 'Port', type: 'number' },
    { key: 'secure', label: 'Use TLS immediately', type: 'toggle' },
    { key: 'username', label: 'Username' },
    { key: 'fromName', label: 'Sender name' },
    { key: 'fromEmail', label: 'Sender email' },
    { key: 'replyTo', label: 'Reply-to email' },
  ],
  cloudinary: [
    { key: 'cloudName', label: 'Cloud name' },
    { key: 'apiKey', label: 'API key' },
  ],
};

const integrationGroupFallbacks: Record<TPlatformProvider, string> = {
  google_drive: 'Google',
  agora: 'Agora',
  firebase: 'Firebase',
  smtp: 'SMTP',
  cloudinary: 'Cloudinary',
};

const fieldClass =
  'mt-2 w-full rounded-xl bg-white px-3.5 py-3 text-sm text-slate-900 outline-none ring-1 ring-slate-200 transition placeholder:text-slate-400 focus:ring-2 focus:ring-primary/30';

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children} <span className="text-rose-500">*</span>
    </>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <span className="mt-1.5 block text-xs font-medium text-rose-600">{message}</span>
  ) : null;
}

function formatDate(value?: string) {
  if (!value) return 'Not tested yet';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
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
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition duration-200 focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? 'bg-primary' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const healthy = status === 'healthy';
  const failed = status === 'error';
  const disabled = status === 'disabled';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
        healthy
          ? 'bg-emerald-100 text-emerald-700'
          : failed
            ? 'bg-rose-100 text-rose-700'
            : disabled
              ? 'bg-slate-200 text-slate-600'
              : 'bg-amber-100 text-amber-700'
      }`}
    >
      {healthy ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : failed ? (
        <TriangleAlert className="h-3.5 w-3.5" />
      ) : (
        <Activity className="h-3.5 w-3.5" />
      )}
      {status.replaceAll('_', ' ')}
    </span>
  );
}

function SectionHeading({
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  icon: React.ElementType;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="rounded-2xl bg-primary/10 p-3 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

export default function SettingsTab() {
  const [section, setSection] = useState<TSection>('overview');
  const [selectedProvider, setSelectedProvider] = useState<TPlatformProvider | null>(null);
  const [selectedSsoProvider, setSelectedSsoProvider] = useState<TSsoProvider | null>(null);
  const drawerOpen = Boolean(selectedProvider || selectedSsoProvider);

  useEffect(() => {
    if (!drawerOpen) return;
    document.documentElement.classList.add('overflow-hidden');
    document.body.classList.add('overflow-hidden');
    return () => {
      document.documentElement.classList.remove('overflow-hidden');
      document.body.classList.remove('overflow-hidden');
    };
  }, [drawerOpen]);
  const { data, isLoading, error } = useSwr<{ data?: IPlatformConfig }>(
    'super-admin/platform-config',
  );
  const { data: ssoRaw, mutate: refreshSso } = useSwr<{ data?: ISsoResponse }>(
    'sso/configurations',
  );
  const { data: integrationRaw, mutate: refreshIntegrations } = useSwr<{
    data?: IPlatformIntegration[];
  }>('super-admin/integrations');
  const config = data?.data;
  const providers = integrationRaw?.data ?? [];
  const selectedIntegration =
    providers.find((provider) => provider.provider === selectedProvider) ?? null;
  const selectedSsoConfiguration =
    ssoRaw?.data?.providers.find((provider) => provider.provider === selectedSsoProvider) ?? null;
  const healthyProviders = providers.filter((provider) => provider.status === 'healthy').length;
  const healthySso =
    ssoRaw?.data?.providers.filter((provider) => provider.status === 'healthy').length ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-3xl bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="rounded-3xl bg-rose-50 p-10 text-center">
        <TriangleAlert className="mx-auto h-8 w-8 text-rose-600" />
        <h2 className="mt-4 text-lg font-bold text-rose-900">Configuration unavailable</h2>
        <p className="mt-1 text-sm text-rose-700">
          The platform configuration could not be loaded. Check the backend connection and retry.
        </p>
      </div>
    );
  }

  const tabs: Array<{
    id: TSection;
    label: string;
    description: string;
    icon: React.ElementType;
  }> = [
    {
      id: 'overview',
      label: 'Platform overview',
      description: 'Infrastructure and retention',
      icon: Server,
    },
    {
      id: 'providers',
      label: 'Service providers',
      description: 'Backup, communication, payments and storage',
      icon: Settings2,
    },
    {
      id: 'admin-access',
      label: 'Administrator SSO',
      description: 'Google and Microsoft login',
      icon: KeyRound,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-sky-50 via-white to-violet-100 p-6 sm:p-8">
        <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-sky-200/35 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-1/3 h-64 w-64 rounded-full bg-violet-200/40 blur-3xl" />
        <div className="relative grid items-center gap-8 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Encrypted provider governance
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Platform & Integration Center
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Configure platform services once, verify their readiness, and understand exactly which
              tenant or administrator experiences each provider controls.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/80 px-4 py-3">
                <p className="text-2xl font-bold text-sky-700">{healthyProviders}</p>
                <p className="text-xs text-slate-500">Service providers ready</p>
              </div>
              <div className="rounded-2xl bg-white/80 px-4 py-3">
                <p className="text-2xl font-bold text-violet-700">{healthySso}</p>
                <p className="text-xs text-slate-500">Admin SSO ready</p>
              </div>
              <div className="col-span-2 rounded-2xl bg-white/80 px-4 py-3 sm:col-span-1">
                <p className="text-2xl font-bold text-emerald-700">{config.allowedOriginCount}</p>
                <p className="text-xs text-slate-500">Approved origins</p>
              </div>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: [0, -6, 0] }}
            transition={{
              opacity: { duration: 0.5 },
              y: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
            }}
            className="relative min-h-64 overflow-hidden rounded-[1.75rem] bg-white/55 sm:min-h-80"
          >
            <Image
              src="/integration-center-illustration.png"
              alt="Illustration of secure cloud backup, video services and connected tenant institutions"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 52vw"
              className="object-cover"
            />
          </motion.div>
        </div>
      </section>

      <nav
        aria-label="Integration Center sections"
        className="grid gap-2 rounded-3xl bg-slate-100 p-2 md:grid-cols-3"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = section === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSection(tab.id)}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
                active ? 'bg-white text-slate-900' : 'text-slate-500 hover:bg-white/60'
              }`}
            >
              <span className={`rounded-xl p-2 ${active ? 'bg-primary/10 text-primary' : ''}`}>
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span>
                <span className="block text-sm font-bold">{tab.label}</span>
                <span className="mt-0.5 block text-xs text-slate-400">{tab.description}</span>
              </span>
            </button>
          );
        })}
      </nav>

      {section === 'overview' && <OverviewSection config={config} providers={providers} />}
      {section === 'providers' && (
        <section className="space-y-5">
          <SectionHeading
            icon={Settings2}
            eyebrow="Dynamic provider control"
            title="All platform integrations"
            description="Configure Google Drive, Agora, Firebase, SMTP and Cloudinary without deployment environment changes. A provider becomes usable only after it is saved, enabled and successfully tested."
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {providers.map((integration) => (
              <IntegrationProviderTile
                key={integration.provider}
                integration={integration}
                onOpen={() => setSelectedProvider(integration.provider)}
              />
            ))}
          </div>
          <div className="flex gap-3 rounded-2xl bg-sky-50 p-4 text-sm text-sky-800">
            <Info className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="leading-6">
              Google SSO is configured separately under Administrator SSO because it controls only
              central admin login. Every service shown above is encrypted in the master database;
              tenant-facing capabilities still follow subscription and permission rules.
            </p>
          </div>
        </section>
      )}
      {section === 'admin-access' && (
        <section className="space-y-5">
          <SectionHeading
            icon={KeyRound}
            eyebrow="Platform administrator access"
            title="Google and Microsoft SSO"
            description="This configuration is only for the central Admin application. It never enables login for college tenants, students, faculty or tenant administrators."
          />
          <div className="rounded-2xl bg-violet-50 p-4 text-sm leading-6 text-violet-800">
            Only an existing, active platform administrator with an approved email domain can
            complete SSO. Automatic account creation remains disabled.
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(ssoRaw?.data?.providers ?? []).map((provider) => (
              <SsoProviderTile
                key={provider.provider}
                config={provider}
                onOpen={() => setSelectedSsoProvider(provider.provider)}
              />
            ))}
          </div>
        </section>
      )}

      <footer className="flex items-start gap-3 rounded-2xl bg-slate-100 p-4 text-sm text-slate-600">
        <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-slate-700" />
        <p className="leading-6">
          Provider secrets are encrypted in the master database and never returned to this page.
          MongoDB, Redis and the master encryption key remain protected by deployment-level secret
          management because the server needs them before the database is available.
        </p>
      </footer>

      <AnimatePresence>
        {selectedIntegration && (
          <IntegrationDrawer
            integration={selectedIntegration}
            onClose={() => setSelectedProvider(null)}
            onSaved={refreshIntegrations}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedSsoConfiguration && (
          <SsoDrawer
            config={selectedSsoConfiguration}
            onClose={() => setSelectedSsoProvider(null)}
            onSaved={refreshSso}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function OverviewSection({
  config,
  providers,
}: {
  config: IPlatformConfig;
  providers: IPlatformIntegration[];
}) {
  const providerReady = (provider: TPlatformProvider) => {
    const integration = providers.find((item) => item.provider === provider);
    return Boolean(integration?.enabled && integration.status === 'healthy');
  };
  const services = [
    {
      label: 'Transactional email',
      description: 'Platform email transport for operational messages.',
      enabled: providerReady('smtp'),
      icon: Mail,
      provider: 'smtp' as const,
      logoSrc: undefined,
    },
    {
      label: 'Redis cache',
      description: 'Shared cache, sockets, rate limits and background coordination.',
      enabled: config.redisConfigured,
      icon: Cloud,
      provider: undefined,
      logoSrc: '/provider-logos/redis.svg',
    },
    {
      label: 'Firebase push',
      description: providerReady('firebase')
        ? 'Firebase is enabled and the latest connection test passed.'
        : 'Configure, enable and test Firebase in Service providers.',
      enabled: providerReady('firebase'),
      icon: BellRing,
      provider: 'firebase' as const,
      logoSrc: undefined,
    },
    {
      label: 'Invoice billing',
      description: config.invoiceBilling.configured
        ? 'Bank-transfer proof review and controlled subscription activation are configured.'
        : 'Add beneficiary details in Billing before accepting paid registrations.',
      enabled: config.invoiceBilling.configured,
      icon: CreditCard,
      provider: undefined,
      logoSrc: undefined,
    },
  ];
  const retention = [
    { label: 'Notifications', days: config.retentionDays.notifications, icon: BellRing },
    { label: 'Audit logs', days: config.retentionDays.auditLogs, icon: ShieldCheck },
    { label: 'Soft deletes', days: config.retentionDays.softDeletes, icon: Database },
    { label: 'Deleted chat', days: config.retentionDays.chatMessages, icon: MessageSquareText },
  ];
  return (
    <section className="space-y-6">
      <SectionHeading
        icon={Server}
        eyebrow="Operational foundation"
        title="Platform health at a glance"
        description="Review the infrastructure that must be available before dynamic providers and tenant applications can operate reliably."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl bg-sky-50 p-5">
          <Server className="h-5 w-5 text-sky-700" />
          <p className="mt-5 text-xs font-bold uppercase tracking-wider text-sky-700">
            Environment
          </p>
          <p className="mt-1 text-xl font-bold capitalize text-slate-900">{config.environment}</p>
          <p className="mt-1 text-xs text-slate-500">Current backend runtime mode</p>
        </div>
        <div className="rounded-3xl bg-violet-50 p-5">
          <Database className="h-5 w-5 text-violet-700" />
          <p className="mt-5 text-xs font-bold uppercase tracking-wider text-violet-700">
            Master database
          </p>
          <p className="mt-1 truncate font-mono text-base font-bold text-slate-900">
            {config.masterDatabaseName}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {config.tenantIsolation.replaceAll('_', ' ')}
          </p>
        </div>
        <div className="rounded-3xl bg-emerald-50 p-5">
          <ShieldCheck className="h-5 w-5 text-emerald-700" />
          <p className="mt-5 text-xs font-bold uppercase tracking-wider text-emerald-700">
            Network policy
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {config.allowedOriginCount} origins
          </p>
          <p className="mt-1 text-xs text-slate-500">Explicitly approved by CORS</p>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl bg-slate-50 p-5 sm:p-6">
          <h3 className="text-base font-bold text-slate-900">Bootstrap service readiness</h3>
          <p className="mt-1 text-sm text-slate-500">
            Provider services become ready only after configuration and successful connection
            testing. Redis is reported directly by the backend infrastructure.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {services.map((service) => (
              <div key={service.label} className="rounded-2xl bg-white p-4">
                <div className="flex items-start gap-3">
                  {service.logoSrc ? (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white p-2">
                      <Image
                        src={service.logoSrc}
                        alt="Redis logo"
                        width={28}
                        height={28}
                        className="h-7 w-7 object-contain"
                      />
                    </span>
                  ) : service.provider ? (
                    <ProviderMark provider={service.provider} />
                  ) : (
                    <span
                      className={`rounded-xl p-2.5 ${
                        service.enabled
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      <service.icon className="h-5 w-5" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800">{service.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{service.description}</p>
                    <p
                      className={`mt-2 text-xs font-bold ${
                        service.enabled ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {service.enabled ? 'Ready' : 'Action required'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl bg-slate-50 p-5 sm:p-6">
          <h3 className="text-base font-bold text-slate-900">Data retention policy</h3>
          <p className="mt-1 text-sm text-slate-500">Active automated cleanup windows.</p>
          <div className="mt-5 space-y-3">
            {retention.map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-2xl bg-white p-3.5">
                <span className="rounded-xl bg-primary/10 p-2 text-primary">
                  <item.icon className="h-4 w-4" />
                </span>
                <p className="flex-1 text-sm font-semibold text-slate-700">{item.label}</p>
                <p className="text-sm font-bold text-slate-900">{item.days} days</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProviderMark({ provider }: { provider: TPlatformProvider }) {
  const marks: Record<TPlatformProvider, { src: string; label: string }> = {
    google_drive: {
      src: '/provider-logos/google-drive.svg',
      label: 'Google Drive',
    },
    agora: { src: '/provider-logos/agora.svg', label: 'Agora' },
    firebase: { src: '/provider-logos/firebase.svg', label: 'Firebase' },
    smtp: { src: '/provider-logos/smtp.svg', label: 'SMTP' },
    cloudinary: { src: '/provider-logos/cloudinary.svg', label: 'Cloudinary' },
  };
  const mark = marks[provider];
  return (
    <span
      title={mark.label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white p-2"
    >
      <Image
        src={mark.src}
        alt={`${mark.label} logo`}
        width={28}
        height={28}
        className="h-7 w-7 object-contain"
      />
    </span>
  );
}

function IntegrationProviderTile({
  integration,
  onOpen,
}: {
  integration: IPlatformIntegration;
  onOpen: () => void;
}) {
  const healthy = integration.status === 'healthy';
  const failed = integration.status === 'error';
  const configured = integration.status === 'configured';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-h-28 cursor-pointer items-center gap-4 rounded-3xl bg-slate-50 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-primary/10"
      aria-label={`Set up ${integration.label}`}
    >
      <ProviderMark provider={integration.provider} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-bold text-slate-900">{integration.label}</span>
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${
              healthy
                ? 'bg-emerald-500'
                : failed
                  ? 'bg-rose-500'
                  : configured
                    ? 'bg-amber-400'
                    : 'bg-slate-300'
            }`}
            aria-label={
              healthy
                ? 'Connected'
                : failed
                  ? 'Connection error'
                  : configured
                    ? 'Test required'
                    : 'Not configured'
            }
          />
        </span>
        <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-500">
          {integration.description}
        </span>
        <span
          className={`mt-2 block text-xs font-semibold ${
            healthy ? 'text-emerald-700' : 'text-primary'
          }`}
        >
          {healthy ? 'Configured and connected' : 'Set up provider'}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  );
}

function IntegrationDrawer({
  integration,
  onClose,
  onSaved,
}: {
  integration: IPlatformIntegration;
  onClose: () => void;
  onSaved: () => void | Promise<unknown>;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 overscroll-none bg-slate-900/20 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="integration-drawer-title"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 280 }}
        className="ml-auto flex h-dvh w-full max-w-2xl flex-col bg-white"
      >
        <div className="flex items-center gap-3 bg-slate-50 px-5 py-4 sm:px-6">
          <ProviderMark provider={integration.provider} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
              Provider setup
            </p>
            <h2 id="integration-drawer-title" className="truncate text-lg font-bold text-slate-900">
              {integration.label}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white p-2.5 text-slate-500 transition hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-primary/10"
            aria-label="Close provider setup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 p-4 sm:p-6">
          <PlatformIntegrationCard integration={integration} onSaved={onSaved} />
        </div>
      </motion.aside>
    </motion.div>
  );
}

function PlatformIntegrationCard({
  integration,
  onSaved,
}: {
  integration: IPlatformIntegration;
  onSaved: () => void | Promise<unknown>;
}) {
  const { mutation: saveIntegration, isLoading: isSaving } = useMutation();
  const { mutation: testIntegration, isLoading: isTesting } = useMutation();
  const providerStyles: Record<
    TPlatformProvider,
    { icon: React.ElementType; tone: string; iconTone: string }
  > = {
    google_drive: {
      icon: HardDrive,
      tone: 'from-sky-100 to-blue-50 text-sky-950',
      iconTone: 'bg-sky-200/70 text-sky-700',
    },
    agora: {
      icon: Video,
      tone: 'from-violet-100 to-indigo-50 text-violet-950',
      iconTone: 'bg-violet-200/70 text-violet-700',
    },
    firebase: {
      icon: BellRing,
      tone: 'from-amber-100 to-orange-50 text-amber-950',
      iconTone: 'bg-amber-200/70 text-amber-700',
    },
    smtp: {
      icon: Send,
      tone: 'from-emerald-100 to-teal-50 text-emerald-950',
      iconTone: 'bg-emerald-200/70 text-emerald-700',
    },
    cloudinary: {
      icon: Images,
      tone: 'from-cyan-100 to-sky-50 text-cyan-950',
      iconTone: 'bg-cyan-200/70 text-cyan-700',
    },
  };
  const providerStyle = providerStyles[integration.provider];
  const fields = integration.fields ?? integrationFieldFallbacks[integration.provider];
  const features = integration.features ?? [];
  const initialConfig = fields.reduce<Record<string, string | number | boolean>>(
    (result, field) => ({
      ...result,
      [field.key]: integration.config?.[field.key] ?? (field.type === 'toggle' ? false : ''),
    }),
    {
      ...(integration.provider === 'google_drive'
        ? {
            callbackUrl:
              integration.config?.callbackUrl ??
              'https://api.devvelocity.in/api/v1/tenant-backup/google/callback',
          }
        : {}),
    },
  );
  const configValidation = fields.reduce<Record<string, Yup.Schema>>((shape, field) => {
    if (field.type === 'toggle') return { ...shape, [field.key]: Yup.boolean().required() };
    if (field.type === 'number') {
      return {
        ...shape,
        [field.key]: Yup.number()
          .typeError(`${field.label} must be a number`)
          .integer(`${field.label} must be a whole number`)
          .min(1, `${field.label} is below the allowed minimum`)
          .max(65535, `${field.label} exceeds the allowed maximum`)
          .required(`${field.label} is required`),
      };
    }
    let schema = Yup.string().trim().required(`${field.label} is required`);
    if (field.key.toLowerCase().includes('email')) {
      schema = schema.email(`Enter a valid ${field.label.toLowerCase()}`);
    }
    if (field.key === 'clientId' && integration.provider === 'google_drive') {
      schema = schema.matches(
        /\.apps\.googleusercontent\.com$/,
        'Enter a valid Google OAuth client ID',
      );
    }
    if (field.key === 'appId' && integration.provider === 'agora') {
      schema = schema.matches(
        /^[a-f0-9]{32}$/i,
        'Agora App ID must contain 32 hexadecimal characters',
      );
    }
    return { ...shape, [field.key]: schema };
  }, {});
  const formik = useFormik({
    initialValues: {
      enabled: integration.enabled,
      secret: '',
      config: initialConfig,
    },
    validationSchema: Yup.object({
      enabled: Yup.boolean().required(),
      config: Yup.object(configValidation),
      secret: integration.hasSecret
        ? Yup.string()
        : Yup.string().trim().required(`${integration.secretLabel} is required`),
    }),
    onSubmit: async (values, helpers) => {
      const response = await saveIntegration(`super-admin/integrations/${integration.provider}`, {
        method: 'PUT',
        body: {
          enabled: values.enabled,
          config: values.config,
          secret: values.secret || undefined,
        },
      });
      if (!response?.results?.success) return;
      helpers.setFieldValue('secret', '', false);
      toast.success(`${integration.label} saved. Test readiness before tenant use.`);
      await onSaved();
    },
  });

  const test = async () => {
    const response = await testIntegration(
      `super-admin/integrations/${integration.provider}/test`,
      { method: 'POST', body: {} },
    );
    if (!response?.results?.success) return;
    toast.success(response.results.message || `${integration.label} is healthy and ready.`);
    await onSaved();
  };

  return (
    <article className="flex h-full min-h-0 flex-col rounded-3xl bg-slate-50">
      <header
        className={`shrink-0 rounded-t-3xl bg-gradient-to-br ${providerStyle.tone} p-5 sm:p-6`}
      >
        <div className="flex items-center justify-between gap-5">
          <div className="min-w-0">
            <h3 className="text-xl font-bold">
              {integration.group ?? integrationGroupFallbacks[integration.provider]}
            </h3>
            <p className="mt-1 text-sm font-semibold text-slate-700">{integration.label}</p>
            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">
              {integration.description}
            </p>
          </div>
          <ProviderMark provider={integration.provider} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusBadge status={integration.status} />
          {features.map((feature) => (
            <span
              key={feature}
              className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-600"
            >
              {feature}
            </span>
          ))}
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain p-5 sm:p-6">
          <div className="grid grid-cols-3 items-center gap-2 text-center text-[11px] font-semibold text-slate-500">
            {['Save credentials', 'Test readiness', 'Tenant available'].map((step, index) => (
              <div key={step} className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-primary">
                  {index + 1}
                </span>
                <span className="hidden sm:inline">{step}</span>
                {index < 2 && <ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-300" />}
              </div>
            ))}
          </div>
          {integration.lastError && (
            <div className="flex gap-3 rounded-2xl bg-rose-100 p-4 text-sm text-rose-800">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-bold">Last test failed</p>
                <p className="mt-1 text-xs leading-5">{integration.lastError}</p>
              </div>
            </div>
          )}
          <div className="grid gap-4">
            {fields.map((field) =>
              field.type === 'toggle' ? (
                <div key={field.key}>
                  <ToggleSwitch
                    checked={Boolean(formik.values.config[field.key])}
                    onChange={(checked) => formik.setFieldValue(`config.${field.key}`, checked)}
                    label={field.label}
                  />
                </div>
              ) : (
                <label key={field.key} className="text-xs font-bold text-slate-600">
                  <RequiredLabel>{field.label}</RequiredLabel>
                  <input
                    type={field.type ?? 'text'}
                    name={`config.${field.key}`}
                    value={String(formik.values.config[field.key] ?? '')}
                    disabled={
                      integration.provider === 'google_drive' && field.key === 'callbackUrl'
                    }
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    placeholder={field.placeholder}
                    className={`${fieldClass} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`}
                  />
                  {integration.provider === 'google_drive' && field.key === 'callbackUrl' && (
                    <span className="mt-1.5 block font-normal leading-5 text-slate-400">
                      This URL is controlled by the platform and cannot be changed here.
                    </span>
                  )}
                  <FieldError
                    message={
                      formik.touched.config?.[field.key]
                        ? String(formik.errors.config?.[field.key] ?? '')
                        : undefined
                    }
                  />
                </label>
              ),
            )}
            <label className="text-xs font-bold text-slate-600">
              <RequiredLabel>{integration.secretLabel}</RequiredLabel>
              <span className="ml-1 font-normal text-slate-400">
                {integration.hasSecret ? 'Leave blank to keep the encrypted value' : 'Required'}
              </span>
              {integration.multilineSecret ? (
                <textarea
                  autoComplete="off"
                  rows={4}
                  name="secret"
                  value={formik.values.secret}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder={
                    integration.hasSecret ? 'Encrypted value saved' : 'Paste private key'
                  }
                  className={fieldClass}
                />
              ) : (
                <input
                  type="password"
                  autoComplete="new-password"
                  name="secret"
                  value={formik.values.secret}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder={integration.hasSecret ? 'Encrypted value saved' : 'Enter secret'}
                  className={fieldClass}
                />
              )}
              <FieldError message={formik.touched.secret ? formik.errors.secret : undefined} />
            </label>
          </div>
          <ToggleSwitch
            checked={formik.values.enabled}
            onChange={(checked) => formik.setFieldValue('enabled', checked)}
            label="Enable provider"
            description="Tenant features remain blocked until the saved configuration passes readiness testing."
          />
        </div>
        <div className="z-10 flex shrink-0 flex-col gap-3 rounded-b-3xl bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs leading-5 text-slate-500">
            Last tested:{' '}
            <span className="font-semibold">{formatDate(integration.lastTestedAt)}</span>
          </p>
          <div className="flex gap-2">
            <CustomButton
              variant="secondary"
              size="small"
              loading={isTesting}
              loadingText="Testing..."
              disabled={isSaving || !integration.hasSecret}
              onClick={test}
              startIcon={<FlaskConical className="h-4 w-4" />}
            >
              Test readiness
            </CustomButton>
            <CustomButton
              size="small"
              loading={isSaving}
              loadingText="Saving..."
              disabled={isTesting}
              onClick={() => formik.submitForm()}
            >
              Save configuration
            </CustomButton>
          </div>
        </div>
      </div>
    </article>
  );
}

function SsoProviderMark({ provider }: { provider: TSsoProvider }) {
  const label = provider === 'google' ? 'Google' : 'Microsoft';
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white p-2">
      <Image
        src={`/provider-logos/${provider}.svg`}
        alt={`${label} logo`}
        width={28}
        height={28}
        className="h-7 w-7 object-contain"
      />
    </span>
  );
}

function SsoProviderTile({ config, onOpen }: { config: ISsoConfiguration; onOpen: () => void }) {
  const healthy = config.status === 'healthy';
  const failed = config.status === 'error';
  const configured = config.status === 'configured';
  const label = config.provider === 'google' ? 'Google' : 'Microsoft';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-h-28 cursor-pointer items-center gap-4 rounded-3xl bg-slate-50 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-primary/10"
      aria-label={`Set up ${label} administrator SSO`}
    >
      <SsoProviderMark provider={config.provider} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-bold text-slate-900">
            {label} administrator SSO
          </span>
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${
              healthy
                ? 'bg-emerald-500'
                : failed
                  ? 'bg-rose-500'
                  : configured
                    ? 'bg-amber-400'
                    : 'bg-slate-300'
            }`}
            aria-label={
              healthy
                ? 'Connected'
                : failed
                  ? 'Connection error'
                  : configured
                    ? 'Test required'
                    : 'Not configured'
            }
          />
        </span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">
          Secure OpenID Connect login for existing central administrators.
        </span>
        <span
          className={`mt-2 block text-xs font-semibold ${
            healthy ? 'text-emerald-700' : 'text-primary'
          }`}
        >
          {healthy ? 'Configured and connected' : 'Set up administrator login'}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  );
}

function SsoDrawer({
  config,
  onClose,
  onSaved,
}: {
  config: ISsoConfiguration;
  onClose: () => void;
  onSaved: () => void | Promise<unknown>;
}) {
  const label = config.provider === 'google' ? 'Google' : 'Microsoft';
  return (
    <motion.div
      className="fixed inset-0 z-50 overscroll-none bg-slate-900/20 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="sso-drawer-title"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 280 }}
        className="ml-auto flex h-dvh w-full max-w-2xl flex-col bg-white"
      >
        <div className="flex items-center gap-3 bg-slate-50 px-5 py-4 sm:px-6">
          <SsoProviderMark provider={config.provider} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
              Administrator SSO setup
            </p>
            <h2 id="sso-drawer-title" className="truncate text-lg font-bold text-slate-900">
              {label} login
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl bg-white p-2.5 text-slate-500 transition hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-primary/10"
            aria-label="Close administrator SSO setup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 p-4 sm:p-6">
          <PlatformSsoCard config={config} onSaved={onSaved} />
        </div>
      </motion.aside>
    </motion.div>
  );
}

function PlatformSsoCard({
  config,
  onSaved,
}: {
  config: ISsoConfiguration;
  onSaved: () => void | Promise<unknown>;
}) {
  const { mutation: saveConfiguration, isLoading: isSaving } = useMutation();
  const { mutation: testConfiguration, isLoading: isTesting } = useMutation();
  const callbackUrl =
    typeof window === 'undefined'
      ? '/auth/sso/callback'
      : `${window.location.origin}/auth/sso/callback`;
  const formik = useFormik({
    initialValues: {
      enabled: config.enabled,
      clientId: config.clientId ?? '',
      clientSecret: '',
      tenantId: config.microsoftTenantId ?? 'common',
      domains: config.allowedDomains.join(', '),
    },
    validationSchema: Yup.object({
      enabled: Yup.boolean().required(),
      clientId: Yup.string()
        .trim()
        .required('OAuth client ID is required')
        .test('provider-client-id', 'Enter a valid Google OAuth client ID', (value) =>
          config.provider === 'google' ? value.endsWith('.apps.googleusercontent.com') : true,
        ),
      clientSecret: config.hasClientSecret
        ? Yup.string()
        : Yup.string().trim().required('Client secret is required'),
      tenantId:
        config.provider === 'microsoft'
          ? Yup.string().trim().required('Microsoft tenant ID is required')
          : Yup.string(),
      domains: Yup.string()
        .trim()
        .required('At least one administrator email domain is required')
        .test('domains', 'Enter valid comma-separated domain names', (value) =>
          value
            .split(',')
            .map((domain) => domain.trim())
            .filter(Boolean)
            .every((domain) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)+$/i.test(domain)),
        ),
    }),
    onSubmit: async (values, helpers) => {
      const response = await saveConfiguration(`sso/configurations/${config.provider}`, {
        method: 'PUT',
        body: {
          enabled: values.enabled,
          clientId: values.clientId,
          clientSecret: values.clientSecret || undefined,
          microsoftTenantId: config.provider === 'microsoft' ? values.tenantId : undefined,
          allowedDomains: values.domains
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
          autoProvision: false,
        },
      });
      if (!response?.results?.success) return;
      helpers.setFieldValue('clientSecret', '', false);
      toast.success(`${config.provider} administrator SSO saved.`);
      await onSaved();
    },
  });

  const test = async () => {
    if (!config.hasClientSecret) {
      toast.error('Save the client ID and client secret before testing.');
      return;
    }
    const response = await testConfiguration(`sso/configurations/${config.provider}/test`, {
      method: 'POST',
    });
    if (!response?.results?.success) return;
    toast.success(`${config.provider} administrator SSO is healthy.`);
    await onSaved();
  };

  const providerColor =
    config.provider === 'google'
      ? 'bg-gradient-to-br from-blue-100 to-sky-50 text-blue-950'
      : 'bg-gradient-to-br from-indigo-100 to-violet-50 text-indigo-950';

  return (
    <article className="flex h-full min-h-0 flex-col rounded-3xl bg-slate-50">
      <header className={`shrink-0 rounded-t-3xl ${providerColor} p-5 sm:p-6`}>
        <div className="flex items-center justify-between gap-5">
          <div className="min-w-0">
            <h3 className="text-xl font-bold">
              {config.provider === 'google' ? 'Google' : 'Microsoft'}
            </h3>
            <p className="mt-1 text-sm font-semibold text-slate-700">Administrator SSO</p>
            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">
              OpenID Connect login for existing central platform administrators only.
            </p>
          </div>
          <SsoProviderMark provider={config.provider} />
        </div>
        <div className="mt-4">
          <StatusBadge status={config.status ?? 'not_configured'} />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain p-5 sm:p-6">
          {config.lastError && (
            <div className="flex gap-3 rounded-2xl bg-rose-100 p-4 text-sm text-rose-800">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{config.lastError}</p>
            </div>
          )}
          <label className="text-xs font-bold text-slate-600">
            <RequiredLabel>Authorized redirect URI</RequiredLabel>
            <div className="flex gap-2">
              <input readOnly value={callbackUrl} className={`${fieldClass} text-slate-500`} />
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(callbackUrl)
                    .then(() => toast.success('Callback URL copied'))
                }
                className="mt-2 rounded-xl bg-white px-3 text-slate-500 transition hover:text-primary"
                aria-label="Copy administrator SSO callback URL"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </label>
          <label className="text-xs font-bold text-slate-600">
            <RequiredLabel>OAuth client ID</RequiredLabel>
            <input
              name="clientId"
              value={formik.values.clientId}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              className={fieldClass}
            />
            <FieldError message={formik.touched.clientId ? formik.errors.clientId : undefined} />
          </label>
          <label className="text-xs font-bold text-slate-600">
            <RequiredLabel>Client secret</RequiredLabel>
            <span className="ml-1 font-normal text-slate-400">
              {config.hasClientSecret ? 'Leave blank to keep the encrypted value' : 'Required'}
            </span>
            <input
              type="password"
              autoComplete="new-password"
              name="clientSecret"
              value={formik.values.clientSecret}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              placeholder={config.hasClientSecret ? 'Encrypted value saved' : 'Enter client secret'}
              className={fieldClass}
            />
            <FieldError
              message={formik.touched.clientSecret ? formik.errors.clientSecret : undefined}
            />
          </label>
          {config.provider === 'microsoft' && (
            <label className="text-xs font-bold text-slate-600">
              <RequiredLabel>Microsoft tenant ID</RequiredLabel>
              <input
                name="tenantId"
                value={formik.values.tenantId}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className={fieldClass}
              />
              <FieldError message={formik.touched.tenantId ? formik.errors.tenantId : undefined} />
            </label>
          )}
          <label className="text-xs font-bold text-slate-600">
            <RequiredLabel>Allowed administrator email domains</RequiredLabel>
            <input
              name="domains"
              value={formik.values.domains}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              placeholder="devvelocity.com, another-approved-domain.com"
              className={fieldClass}
            />
            <span className="mt-1.5 block font-normal leading-5 text-slate-400">
              Separate multiple domains with commas. Users must already have an active platform
              administrator account.
            </span>
            <FieldError message={formik.touched.domains ? formik.errors.domains : undefined} />
          </label>
          <ToggleSwitch
            checked={formik.values.enabled}
            onChange={(checked) => formik.setFieldValue('enabled', checked)}
            label={`Enable ${config.provider} administrator login`}
            description="This affects only the central Admin sign-in page and never tenant authentication."
          />
        </div>
        <div className="z-10 flex shrink-0 flex-col gap-3 rounded-b-3xl bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs leading-5 text-slate-500">
            Last tested: <span className="font-semibold">{formatDate(config.lastTestedAt)}</span>
          </p>
          <div className="flex gap-2">
            <CustomButton
              variant="secondary"
              size="small"
              loading={isTesting}
              loadingText="Testing..."
              disabled={isSaving || !config.hasClientSecret}
              onClick={test}
              startIcon={<FlaskConical className="h-4 w-4" />}
            >
              Test readiness
            </CustomButton>
            <CustomButton
              size="small"
              loading={isSaving}
              loadingText="Saving..."
              disabled={isTesting}
              onClick={() => formik.submitForm()}
            >
              Save configuration
            </CustomButton>
          </div>
        </div>
      </div>
    </article>
  );
}

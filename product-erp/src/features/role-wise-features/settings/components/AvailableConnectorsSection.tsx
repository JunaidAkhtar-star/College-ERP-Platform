/**
 * @file AvailableConnectorsSection.tsx
 * @description Renders the tenant connector catalogue as integration cards and
 *              configures each connection in an admin-style right drawer.
 * @module features/role-wise-features/settings
 */
'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { ArrowRight, ChevronRight, FlaskConical, Settings2, Webhook, X } from 'lucide-react';
import { toast } from 'react-toastify';
import CustomButton from '@/shared/core/CustomButton';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { AnimatePresence, motion } from '@/shared/utils/motion';

interface IConnectorCatalogItem {
  provider: string;
  label: string;
  capabilities: string[];
}

interface IExternalConnector {
  _id: string;
  name: string;
  provider: string;
  enabled: boolean;
  status: 'configured' | 'healthy' | 'degraded' | 'disabled' | 'error';
  config: Record<string, string | number | boolean>;
  capabilities: string[];
  hasSecret: boolean;
  lastTestedAt?: string;
  lastSucceededAt?: string;
  lastError?: string;
}

interface IApiResponse<T> {
  success: boolean;
  data: T;
}

const inputClass =
  'mt-2 w-full rounded-xl bg-white px-3.5 py-3 text-sm text-slate-900 outline-none ring-1 ring-slate-200 transition placeholder:text-slate-600 focus:ring-2 focus:ring-primary/30';

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

/**
 * Presents the live connector catalogue and configured tenant connections.
 */
export default function AvailableConnectorsSection() {
  const catalogQuery = useSwr<IApiResponse<IConnectorCatalogItem[]>>('external-connector/metadata');
  const connectorQuery = useSwr<IApiResponse<IExternalConnector[]>>('external-connector');
  const catalog = useMemo(() => catalogQuery.data?.data ?? [], [catalogQuery.data]);
  const connectors = useMemo(() => connectorQuery.data?.data ?? [], [connectorQuery.data]);
  const [selected, setSelected] = useState<IConnectorCatalogItem | null>(null);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Settings2 className="size-4 text-primary" />
            <h3 className="text-sm font-bold text-slate-900">All available connectors</h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Accounting, workspace, meetings, messaging and custom provider connections.
          </p>
        </div>
        <div className="flex gap-2 text-xs font-semibold">
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">
            {connectors.length} configured
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
            {connectors.filter((item) => item.status === 'healthy').length} healthy
          </span>
        </div>
      </div>

      {catalogQuery.error || connectorQuery.error ? (
        <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
          Available connectors could not be loaded. Please refresh and try again.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {catalog.map((item) => {
            const configured = connectors.find((connector) => connector.provider === item.provider);
            return (
              <button
                key={item.provider}
                type="button"
                onClick={() => setSelected(item)}
                className="group flex min-h-28 items-center gap-4 rounded-3xl bg-slate-50 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-primary/10"
              >
                <ConnectorMark provider={item.provider} label={item.label} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold text-slate-900">{item.label}</span>
                    <ConnectorStatusDot status={configured?.status} />
                  </span>
                  <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-500">
                    {item.capabilities.join(' · ')}
                  </span>
                  <span
                    className={`mt-2 block text-xs font-semibold ${
                      configured?.status === 'healthy' ? 'text-emerald-700' : 'text-primary'
                    }`}
                  >
                    {configured?.status === 'healthy'
                      ? 'Configured and connected'
                      : configured
                        ? 'Manage connection'
                        : 'Set up provider'}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </button>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {selected && (
          <ConnectorDrawer
            catalogItem={selected}
            connector={connectors.find((item) => item.provider === selected.provider)}
            onClose={() => setSelected(null)}
            onSaved={async () => {
              await connectorQuery.mutate();
            }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function ConnectorStatusDot({ status }: { status?: IExternalConnector['status'] }) {
  const tone =
    status === 'healthy'
      ? 'bg-emerald-500'
      : status === 'error' || status === 'degraded'
        ? 'bg-rose-500'
        : status === 'configured'
          ? 'bg-amber-400'
          : 'bg-slate-300';
  return <span className={`size-2.5 shrink-0 rounded-full ${tone}`} />;
}

function ConnectorMark({ provider, label }: { provider: string; label: string }) {
  const logos: Record<string, string> = {
    twilio_sms: '/provider-logos/twilio.svg',
    tally_bridge: '/provider-logos/tally.svg',
    quickbooks: '/provider-logos/quickbooks.svg',
    google_workspace: '/provider-logos/google.svg',
    microsoft_graph: '/provider-logos/microsoft.svg',
    google_meet: '/provider-logos/google-meet.svg',
    bigbluebutton: '/provider-logos/bigbluebutton.svg',
    custom_webhook: '/provider-logos/custom-webhook.svg',
  };
  const logo = logos[provider];
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white p-2">
      {logo ? (
        <Image
          src={logo}
          alt={`${label} logo`}
          width={28}
          height={28}
          unoptimized
          className="size-7 object-contain"
        />
      ) : (
        <Webhook className="size-6 text-primary" />
      )}
    </span>
  );
}

function ConnectorFormHeader({
  catalogItem,
  status,
}: {
  catalogItem: IConnectorCatalogItem;
  status?: IExternalConnector['status'];
}) {
  const tone =
    catalogItem.provider === 'twilio_sms'
      ? 'from-rose-100 to-red-50 text-rose-950'
      : catalogItem.provider === 'tally_bridge' || catalogItem.provider === 'quickbooks'
        ? 'from-emerald-100 to-teal-50 text-emerald-950'
        : catalogItem.provider.includes('google')
          ? 'from-sky-100 to-blue-50 text-sky-950'
          : 'from-violet-100 to-indigo-50 text-violet-950';
  return (
    <header className={`shrink-0 rounded-t-3xl bg-gradient-to-br ${tone} p-5 sm:p-6`}>
      <div className="flex items-center justify-between gap-5">
        <div className="min-w-0">
          <h3 className="text-xl font-bold">{catalogItem.label}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-700">Tenant connector</p>
          <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">
            Enables {catalogItem.capabilities.join(', ')} for approved institution workflows.
          </p>
        </div>
        <ConnectorMark provider={catalogItem.provider} label={catalogItem.label} />
      </div>
      <div className="mt-4">
        <span
          className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
            status === 'healthy'
              ? 'bg-emerald-100 text-emerald-700'
              : status === 'error' || status === 'degraded'
                ? 'bg-rose-100 text-rose-700'
                : status === 'configured'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-white/80 text-slate-600'
          }`}
        >
          {status ?? 'not configured'}
        </span>
      </div>
    </header>
  );
}

function ConnectorDrawer({
  catalogItem,
  connector,
  onClose,
  onSaved,
}: {
  catalogItem: IConnectorCatalogItem;
  connector?: IExternalConnector;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { mutation, isLoading } = useMutation();
  const isTwilio = catalogItem.provider === 'twilio_sms';
  const needsEndpoint = [
    'tally_bridge',
    'bigbluebutton',
    'custom_webhook',
    'canvas_lms',
    'moodle_lms',
    'oneroster_1_2',
    'coursera',
  ].includes(catalogItem.provider);
  const isQuickBooks = catalogItem.provider === 'quickbooks';
  const isLmsProvider = ['canvas_lms', 'moodle_lms', 'oneroster_1_2', 'coursera'].includes(
    catalogItem.provider,
  );
  const isCoursera = catalogItem.provider === 'coursera';
  const isGoogleWorkspace = catalogItem.provider === 'google_workspace';
  const isGoogleOAuth = ['google_workspace', 'google_meet'].includes(catalogItem.provider);
  const usesRefreshOAuth = isQuickBooks || isGoogleOAuth;
  const isMicrosoft = catalogItem.provider === 'microsoft_graph';
  const isBigBlueButton = catalogItem.provider === 'bigbluebutton';
  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      name: connector?.name ?? catalogItem.label,
      enabled: connector?.enabled ?? true,
      endpoint: String(connector?.config.endpoint ?? ''),
      accountSid: String(connector?.config.accountSid ?? ''),
      fromNumber: String(connector?.config.fromNumber ?? ''),
      realmId: String(connector?.config.realmId ?? ''),
      accountId: String(connector?.config.accountId ?? ''),
      organizationId: String(connector?.config.organizationId ?? ''),
      environment: String(connector?.config.environment ?? 'sandbox'),
      customerId: String(connector?.config.customerId ?? 'my_customer'),
      domain: String(connector?.config.domain ?? ''),
      tenantId: String(connector?.config.tenantId ?? ''),
      clientId: String(connector?.config.clientId ?? ''),
      checksumAlgorithm: String(connector?.config.checksumAlgorithm ?? 'sha256'),
      rateLimitPerMinute: Number(connector?.config.rateLimitPerMinute ?? 60),
      secret: '',
      accessToken: '',
      oauthClientId: '',
      oauthClientSecret: '',
      rotationReason: '',
    },
    validationSchema: Yup.object({
      name: Yup.string().trim().min(2).max(120).required('Connection name is required'),
      endpoint: needsEndpoint
        ? Yup.string().url('Enter a valid HTTPS URL').required('Provider endpoint is required')
        : Yup.string(),
      accountSid: isTwilio ? Yup.string().trim().required('Account SID is required') : Yup.string(),
      fromNumber: isTwilio
        ? Yup.string().trim().required('Sender number is required')
        : Yup.string(),
      realmId: isQuickBooks
        ? Yup.string().trim().required('QuickBooks company ID is required')
        : Yup.string(),
      organizationId: isCoursera
        ? Yup.string().trim().required('Coursera organization ID is required')
        : Yup.string(),
      customerId: isGoogleWorkspace
        ? Yup.string().trim().required('Google customer ID is required')
        : Yup.string(),
      tenantId: isMicrosoft
        ? Yup.string().trim().required('Microsoft tenant ID is required')
        : Yup.string(),
      clientId: isMicrosoft
        ? Yup.string().trim().required('Microsoft application client ID is required')
        : Yup.string(),
      rateLimitPerMinute: Yup.number().integer().min(1).max(1000).required(),
      secret: connector?.hasSecret
        ? Yup.string()
        : Yup.string().trim().required('Secret or access token is required'),
      accessToken:
        usesRefreshOAuth && !connector?.hasSecret
          ? Yup.string().trim().required('OAuth access token is required')
          : Yup.string(),
      oauthClientId:
        usesRefreshOAuth && !connector?.hasSecret
          ? Yup.string().trim().required('OAuth client ID is required')
          : Yup.string(),
      oauthClientSecret:
        usesRefreshOAuth && !connector?.hasSecret
          ? Yup.string().trim().required('OAuth client secret is required')
          : Yup.string(),
      rotationReason: connector?.hasSecret
        ? Yup.string().when('secret', {
            is: (value: string) => Boolean(value.trim()),
            then: (schema) => schema.min(10, 'Explain why the saved credential is being rotated'),
          })
        : Yup.string(),
    }),
    onSubmit: async (values) => {
      let config: Record<string, string | number>;
      if (isTwilio) {
        config = {
          accountSid: values.accountSid,
          fromNumber: values.fromNumber,
          rateLimitPerMinute: values.rateLimitPerMinute,
        };
      } else if (isQuickBooks) {
        config = {
          realmId: values.realmId,
          environment: values.environment,
          rateLimitPerMinute: values.rateLimitPerMinute,
        };
      } else if (isGoogleWorkspace) {
        config = {
          customerId: values.customerId,
          domain: values.domain,
          rateLimitPerMinute: values.rateLimitPerMinute,
        };
      } else if (isMicrosoft) {
        config = {
          tenantId: values.tenantId,
          clientId: values.clientId,
          rateLimitPerMinute: values.rateLimitPerMinute,
        };
      } else if (isBigBlueButton) {
        config = {
          endpoint: values.endpoint,
          checksumAlgorithm: values.checksumAlgorithm,
          rateLimitPerMinute: values.rateLimitPerMinute,
        };
      } else if (isLmsProvider) {
        config = {
          endpoint: values.endpoint,
          accountId: values.accountId,
          organizationId: values.organizationId,
          rateLimitPerMinute: values.rateLimitPerMinute,
        };
      } else {
        config = { endpoint: values.endpoint, rateLimitPerMinute: values.rateLimitPerMinute };
      }
      const primarySecretKey: Record<string, string> = {
        twilio_sms: 'authToken',
        tally_bridge: 'signingSecret',
        quickbooks: 'refreshToken',
        google_workspace: 'refreshToken',
        microsoft_graph: 'clientSecret',
        google_meet: 'refreshToken',
        bigbluebutton: 'sharedSecret',
        custom_webhook: 'signingSecret',
      };
      const secrets = {
        ...(values.secret
          ? { [primarySecretKey[catalogItem.provider] ?? 'accessToken']: values.secret }
          : {}),
        ...(usesRefreshOAuth && values.accessToken ? { accessToken: values.accessToken } : {}),
        ...(usesRefreshOAuth && values.oauthClientId ? { clientId: values.oauthClientId } : {}),
        ...(usesRefreshOAuth && values.oauthClientSecret
          ? { clientSecret: values.oauthClientSecret }
          : {}),
      };
      const response = await mutation(
        connector ? `external-connector/${connector._id}` : 'external-connector',
        {
          method: connector ? 'PUT' : 'POST',
          body: {
            name: values.name,
            provider: catalogItem.provider,
            enabled: values.enabled,
            config,
            secrets,
            rotationReason: values.rotationReason,
          },
        },
      );
      if (!response?.results?.success) return;
      toast.success(`${catalogItem.label} connector saved securely.`);
      await onSaved();
      onClose();
    },
  });
  const isRotatingCredential = Boolean(
    formik.values.secret ||
    formik.values.accessToken ||
    formik.values.oauthClientId ||
    formik.values.oauthClientSecret,
  );

  const testConnection = async () => {
    if (!connector) return;
    const response = await mutation(`external-connector/${connector._id}/test`, {
      method: 'POST',
    });
    if (response?.results?.success) {
      toast.success(`${catalogItem.label} connection verified.`);
      await onSaved();
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 overscroll-none bg-slate-200/80 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="connector-drawer-title"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 280 }}
        className="ml-auto flex h-dvh w-full max-w-2xl flex-col bg-white"
      >
        <div className="flex items-center gap-3 bg-slate-50 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <ConnectorMark provider={catalogItem.provider} label={catalogItem.label} />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                Provider setup
              </p>
              <h3 id="connector-drawer-title" className="font-bold text-slate-900">
                {catalogItem.label}
              </h3>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close connector form"
            onClick={onClose}
            className="ml-auto rounded-xl bg-white p-2.5 text-slate-500 transition hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-primary/10"
          >
            <X className="size-5" />
          </button>
        </div>

        <form
          onSubmit={formik.handleSubmit}
          className="m-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-slate-50 sm:m-6"
        >
          <ConnectorFormHeader catalogItem={catalogItem} status={connector?.status} />
          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            <SetupProgress />
            <DrawerField
              label="Connection name"
              name="name"
              value={formik.values.name}
              onChange={formik.handleChange}
              error={formik.touched.name ? formik.errors.name : undefined}
            />
            {isTwilio && (
              <div className="grid gap-4 sm:grid-cols-2">
                <DrawerField
                  label="Account SID"
                  name="accountSid"
                  value={formik.values.accountSid}
                  onChange={formik.handleChange}
                  error={formik.touched.accountSid ? formik.errors.accountSid : undefined}
                />
                <DrawerField
                  label="Sender number"
                  name="fromNumber"
                  value={formik.values.fromNumber}
                  onChange={formik.handleChange}
                  error={formik.touched.fromNumber ? formik.errors.fromNumber : undefined}
                />
              </div>
            )}
            {needsEndpoint && (
              <DrawerField
                label={
                  isBigBlueButton
                    ? 'BigBlueButton API endpoint'
                    : catalogItem.provider === 'tally_bridge'
                      ? 'HTTPS Tally bridge endpoint'
                      : ['canvas_lms', 'moodle_lms', 'oneroster_1_2', 'coursera'].includes(
                            catalogItem.provider,
                          )
                        ? 'HTTPS LMS integration endpoint'
                        : 'HTTPS webhook endpoint'
                }
                name="endpoint"
                value={formik.values.endpoint}
                onChange={formik.handleChange}
                placeholder="https://provider.example.com/api"
                error={formik.touched.endpoint ? formik.errors.endpoint : undefined}
              />
            )}
            {isLmsProvider && (
              <div className="grid gap-4 sm:grid-cols-2">
                <DrawerField
                  label={isCoursera ? 'Coursera account ID' : 'Provider account ID'}
                  name="accountId"
                  value={formik.values.accountId}
                  onChange={formik.handleChange}
                  placeholder="Supplied by the provider"
                />
                <DrawerField
                  label={isCoursera ? 'Coursera organization ID' : 'Organization ID'}
                  name="organizationId"
                  value={formik.values.organizationId}
                  onChange={formik.handleChange}
                  placeholder="Institution organization identifier"
                  error={formik.touched.organizationId ? formik.errors.organizationId : undefined}
                />
              </div>
            )}
            {isQuickBooks && (
              <div className="grid gap-4 sm:grid-cols-2">
                <DrawerField
                  label="QuickBooks company ID (Realm ID)"
                  name="realmId"
                  value={formik.values.realmId}
                  onChange={formik.handleChange}
                  error={formik.touched.realmId ? formik.errors.realmId : undefined}
                />
                <DrawerSelect
                  label="Environment"
                  name="environment"
                  value={formik.values.environment}
                  onChange={formik.handleChange}
                  options={[
                    { value: 'sandbox', label: 'Sandbox' },
                    { value: 'production', label: 'Production' },
                  ]}
                />
              </div>
            )}
            {isGoogleWorkspace && (
              <div className="grid gap-4 sm:grid-cols-2">
                <DrawerField
                  label="Google customer ID"
                  name="customerId"
                  value={formik.values.customerId}
                  onChange={formik.handleChange}
                  error={formik.touched.customerId ? formik.errors.customerId : undefined}
                />
                <DrawerField
                  label="Workspace domain"
                  name="domain"
                  value={formik.values.domain}
                  onChange={formik.handleChange}
                  placeholder="institution.edu"
                />
              </div>
            )}
            {isMicrosoft && (
              <div className="grid gap-4 sm:grid-cols-2">
                <DrawerField
                  label="Microsoft tenant ID"
                  name="tenantId"
                  value={formik.values.tenantId}
                  onChange={formik.handleChange}
                  error={formik.touched.tenantId ? formik.errors.tenantId : undefined}
                />
                <DrawerField
                  label="Application client ID"
                  name="clientId"
                  value={formik.values.clientId}
                  onChange={formik.handleChange}
                  error={formik.touched.clientId ? formik.errors.clientId : undefined}
                />
              </div>
            )}
            {isBigBlueButton && (
              <DrawerSelect
                label="Checksum algorithm"
                name="checksumAlgorithm"
                value={formik.values.checksumAlgorithm}
                onChange={formik.handleChange}
                options={['sha1', 'sha256', 'sha384', 'sha512'].map((value) => ({
                  value,
                  label: value.toUpperCase(),
                }))}
              />
            )}
            <DrawerField
              label={
                connector?.hasSecret
                  ? 'New primary credential (leave blank to keep saved)'
                  : usesRefreshOAuth
                    ? 'OAuth refresh token'
                    : isMicrosoft
                      ? 'Application client secret'
                      : isBigBlueButton
                        ? 'BigBlueButton shared secret'
                        : 'Secret or access token'
              }
              name="secret"
              type="password"
              value={formik.values.secret}
              onChange={formik.handleChange}
              error={formik.touched.secret ? formik.errors.secret : undefined}
            />
            {usesRefreshOAuth && (
              <div className="grid gap-4 sm:grid-cols-2">
                <DrawerField
                  label={
                    connector?.hasSecret ? 'New access token (optional)' : 'OAuth access token'
                  }
                  name="accessToken"
                  type="password"
                  value={formik.values.accessToken}
                  onChange={formik.handleChange}
                  error={formik.touched.accessToken ? formik.errors.accessToken : undefined}
                />
                <DrawerField
                  label={connector?.hasSecret ? 'OAuth client ID (optional)' : 'OAuth client ID'}
                  name="oauthClientId"
                  value={formik.values.oauthClientId}
                  onChange={formik.handleChange}
                  error={formik.touched.oauthClientId ? formik.errors.oauthClientId : undefined}
                />
                <DrawerField
                  label={
                    connector?.hasSecret ? 'OAuth client secret (optional)' : 'OAuth client secret'
                  }
                  name="oauthClientSecret"
                  type="password"
                  value={formik.values.oauthClientSecret}
                  onChange={formik.handleChange}
                  error={
                    formik.touched.oauthClientSecret ? formik.errors.oauthClientSecret : undefined
                  }
                />
              </div>
            )}
            {connector?.hasSecret && isRotatingCredential && (
              <DrawerField
                label="Credential rotation reason"
                name="rotationReason"
                value={formik.values.rotationReason}
                onChange={formik.handleChange}
                error={formik.touched.rotationReason ? formik.errors.rotationReason : undefined}
              />
            )}
            <DrawerField
              label="Requests per minute"
              name="rateLimitPerMinute"
              type="number"
              value={String(formik.values.rateLimitPerMinute)}
              onChange={formik.handleChange}
              error={
                formik.touched.rateLimitPerMinute
                  ? String(formik.errors.rateLimitPerMinute ?? '')
                  : undefined
              }
            />
            <ToggleSwitch
              checked={formik.values.enabled}
              onChange={(checked) => formik.setFieldValue('enabled', checked)}
              label="Enable connector"
              description="Make this connection available to approved institution workflows."
            />
            {connector?.lastError && (
              <div className="rounded-2xl bg-rose-50 p-4 text-xs text-rose-700">
                {connector.lastError}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-3xl bg-white px-6 py-4">
            <CustomButton
              type="button"
              variant="tertiary"
              disabled={!connector?.enabled}
              onClick={testConnection}
              startIcon={<FlaskConical className="size-4" />}
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

function DrawerField({
  label,
  error,
  ...input
}: {
  label: string;
  error?: string;
  name: string;
  value: string;
  type?: string;
  placeholder?: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <label className="block text-xs font-semibold text-slate-700">
      {label}
      <input {...input} className={inputClass} />
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

function DrawerSelect({
  label,
  options,
  ...select
}: {
  label: string;
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
}) {
  return (
    <label className="block text-xs font-semibold text-slate-700">
      {label}
      <select {...select} className={inputClass}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

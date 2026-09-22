/**
 * @file SettingsPage.tsx
 * @description Unified Settings page — tabbed UI for Profile, Security and
 *   Notifications preferences. All data comes from existing backend endpoints
 *   (`auth/change-password`, `notification/preferences`).
 */
'use client';

import React, { useState, useEffect } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import {
  ShieldCheck,
  BellRing,
  KeyRound,
  Mail,
  Smartphone,
  MessageSquare,
  Monitor,
  LogOut,
  Trash2,
  Laptop,
  Tablet,
  MapPin,
  Clock,
  Building,
  Plug,
  Network,
  DatabaseBackup,
  CreditCard,
  LayoutDashboard,
  ChevronRight,
  CheckCircle2,
  CircleAlert,
} from 'lucide-react';
import TenantIntegrationsTab from './TenantIntegrationsTab';
import TenantDomainTab from './TenantDomainTab';
import TenantBackupTab from './TenantBackupTab';
import TenantSubscriptionTab from './TenantSubscriptionTab';
import { motion, AnimatePresence } from '@/shared/utils/motion';
import CustomButton from '@/shared/core/CustomButton';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { usePushReadiness } from '@/shared/hooks/usePushReadiness';
import { getPushDeviceId, PUSH_MANUAL_OPTOUT_KEY } from '@/shared/hooks/useFcm';
import { useAuthStore } from '@/shared/store/authStore';
import { removeFromLocalStorage, saveToLocalStorage, setLocalStorageItem } from '@/shared/utils';
import UseProtectedRoutes from '@/shared/hooks/UseProtectedRoutes';
import type { IApiResponse, IAuthUser } from '@/shared/types';
import InlineFileUpload from '@/shared/core/InlineFileUpload';
import type { IViewerFile } from '@/shared/core/FileViewer';

type TTab =
  | 'overview'
  | 'security'
  | 'sessions'
  | 'notifications'
  | 'institution'
  | 'integrations'
  | 'backup'
  | 'domain'
  | 'subscription';

interface INotificationPrefs {
  email: boolean;
  inApp: boolean;
  push: boolean;
  sms: boolean;
}

interface ISession {
  jti: string;
  ip?: string;
  device?: string;
  createdAt?: string;
  issuedAt?: string;
  lastUsedAt?: string;
  isCurrent?: boolean;
}

const TABS: { id: TTab; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'security', label: 'Security', icon: ShieldCheck, desc: 'Password and account safety' },
  { id: 'sessions', label: 'Sessions', icon: Monitor, desc: 'Devices signed into your account' },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: BellRing,
    desc: 'How you want to be notified',
  },
];

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';

interface ISettingsPageProps {
  initialTab?: TTab;
}

interface ISettingsTab {
  id: TTab;
  label: string;
  icon: React.ElementType;
  desc: string;
}

function SettingsPage({ initialTab = 'overview' }: ISettingsPageProps) {
  const [active, setActive] = useState<TTab>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tabFromUrl = urlParams.get('tab') as TTab | null;
      if (tabFromUrl) return tabFromUrl;
    }
    return initialTab;
  });

  const user = useAuthStore((s) => s.user);
  const activeRole = useAuthStore((s) => s.activeRole);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handlePopState = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const tabFromUrl = urlParams.get('tab') as TTab | null;
        if (tabFromUrl) setActive(tabFromUrl);
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, []);

  const handleTabChange = (tabId: TTab) => {
    setActive(tabId);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tabId);
      window.history.replaceState({}, '', url.toString());
    }
  };

  const activeRoleName = activeRole?.baseRole || activeRole?.name || user?.role;
  const isAdmin = activeRoleName === 'super_admin' || activeRoleName === 'admin';
  const isActiveSuperAdmin = activeRoleName === 'super_admin';
  const accountTabs: ISettingsTab[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
      desc: 'Setup status and shortcuts',
    },
    ...TABS,
  ];
  const administrationTabs: ISettingsTab[] = isAdmin
    ? [
        {
          id: 'institution',
          label: 'Institution profile',
          icon: Building,
          desc: 'Identity, contacts and branding',
        },
        {
          id: 'integrations',
          label: 'Integrations',
          icon: Plug,
          desc: 'Email, push and providers',
        },
        {
          id: 'backup',
          label: 'Backup & recovery',
          icon: DatabaseBackup,
          desc: 'Automatic data protection',
        },
        {
          id: 'domain',
          label: 'Custom domain',
          icon: Network,
          desc: 'Domain and DNS verification',
        },
        ...(isActiveSuperAdmin
          ? [
              {
                id: 'subscription' as TTab,
                label: 'Plan & billing',
                icon: CreditCard,
                desc: 'Subscription, add-ons and invoices',
              },
            ]
          : []),
      ]
    : [];

  const allowedTabs = [...accountTabs, ...administrationTabs].map((tab) => tab.id);
  const currentTab = allowedTabs.includes(active) ? active : 'overview';

  const renderNavigationGroup = (label: string, tabs: ISettingsTab[]) => (
    <div>
      <p className="mb-1 hidden px-3 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600 md:block">
        {label}
      </p>
      <div className="flex gap-1 md:block">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-w-max items-center gap-2 rounded-xl px-3 py-2.5 text-left transition md:mb-0.5 md:w-full md:items-start md:gap-3 ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 md:mt-0.5 md:h-5 md:w-5" />
              <span className="flex-1">
                <span className="block text-sm font-medium">{tab.label}</span>
                <span className="hidden text-xs text-slate-600 md:block">{tab.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-7xl p-2 mb-10">
      <header className="mb-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
          Configuration workspace
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">
          Manage your account and the institution services available to your active role.
        </p>
      </header>

      <div className="grid items-start gap-6 md:grid-cols-[270px_minmax(0,1fr)]">
        <nav
          aria-label="Settings sections"
          className="sticky top-16 z-10 -mx-4 overflow-x-auto bg-white/95 px-4 py-2 backdrop-blur md:top-20 md:mx-0 md:max-h-[calc(100dvh-7rem)] md:self-start md:overflow-y-auto md:rounded-2xl md:bg-slate-50 md:p-2"
        >
          {renderNavigationGroup('Your account', accountTabs)}
          {administrationTabs.length > 0 && (
            <div className="ml-2 border-l border-slate-200 pl-2 md:ml-0 md:mt-3 md:border-l-0 md:pl-0">
              {renderNavigationGroup('Institution administration', administrationTabs)}
            </div>
          )}
        </nav>

        <section className="min-w-0 rounded-2xl bg-white p-1 sm:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {currentTab === 'overview' && (
                <SettingsOverview
                  isAdmin={isAdmin}
                  isSuperAdmin={isActiveSuperAdmin}
                  onOpen={handleTabChange}
                />
              )}
              {currentTab === 'security' && <SecurityTab />}
              {currentTab === 'sessions' && <SessionsTab />}
              {currentTab === 'notifications' && <NotificationsTab />}
              {currentTab === 'institution' && <InstitutionTab />}
              {currentTab === 'integrations' && <TenantIntegrationsTab />}
              {currentTab === 'backup' && <TenantBackupTab />}
              {currentTab === 'domain' && <TenantDomainTab />}
              {currentTab === 'subscription' && <TenantSubscriptionTab />}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>

      {!!user?.mustChangePassword && (
        <div className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You must change your password before continuing to use the system.
        </div>
      )}
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

interface ISettingsOverviewProps {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  onOpen: (tab: TTab) => void;
}

function SettingsOverview({ isAdmin, isSuperAdmin, onOpen }: ISettingsOverviewProps) {
  const user = useAuthStore((state) => state.user);
  const { data: institutionResponse } =
    useSwr<IApiResponse<IInstitutionSetting>>('institution-setting');
  const { data: preferencesResponse } = useSwr<IApiResponse<INotificationPrefs>>(
    'notification/preferences',
  );
  const { readiness, ready: pushReady } = usePushReadiness();
  const institution = institutionResponse?.data;
  const preferences = preferencesResponse?.data;
  const profileReady = Boolean(
    institution?.name && institution?.email && institution?.logoUrl && institution?.address,
  );
  const notificationChannels = preferences
    ? [preferences.email, preferences.inApp, preferences.push, preferences.sms].filter(Boolean)
        .length
    : 0;

  const cards: Array<{
    id: TTab;
    title: string;
    description: string;
    status: string;
    ready: boolean;
    icon: React.ElementType;
  }> = [
    {
      id: 'security',
      title: 'Account security',
      description: 'Change your password and protect sign-in with an authenticator app.',
      status: user?.mfaEnabled ? 'MFA protected' : 'MFA recommended',
      ready: Boolean(user?.mfaEnabled),
      icon: ShieldCheck,
    },
    {
      id: 'sessions',
      title: 'Signed-in devices',
      description: 'Review active sessions and remove devices you no longer recognize.',
      status: 'Review access',
      ready: true,
      icon: Monitor,
    },
    {
      id: 'notifications',
      title: 'Notification delivery',
      description: 'Choose email, in-app, browser push and SMS delivery channels.',
      status:
        notificationChannels > 0
          ? `${notificationChannels} channel${notificationChannels === 1 ? '' : 's'} enabled`
          : 'Choose channels',
      ready: notificationChannels > 0,
      icon: BellRing,
    },
    ...(isAdmin
      ? [
          {
            id: 'institution' as TTab,
            title: 'Institution profile',
            description: 'The identity used across reports, emails, portals and notifications.',
            status: profileReady ? 'Profile complete' : 'Action required',
            ready: profileReady,
            icon: Building,
          },
          {
            id: 'integrations' as TTab,
            title: 'Service integrations',
            description: 'Connect institution-owned email, push and external service providers.',
            status: pushReady ? 'Push delivery ready' : readiness?.reason || 'Review connections',
            ready: pushReady,
            icon: Plug,
          },
          {
            id: 'backup' as TTab,
            title: 'Backup & recovery',
            description: 'Configure protected automatic backups and review recent backup jobs.',
            status: 'Review protection',
            ready: true,
            icon: DatabaseBackup,
          },
          {
            id: 'domain' as TTab,
            title: 'Institution domain',
            description: 'Connect and verify the institution-owned web address.',
            status: 'Check domain',
            ready: true,
            icon: Network,
          },
          ...(isSuperAdmin
            ? [
                {
                  id: 'subscription' as TTab,
                  title: 'Plan & billing',
                  description: 'Review plan access, add-ons, capacity and invoice history.',
                  status: 'View plan',
                  ready: true,
                  icon: CreditCard,
                },
              ]
            : []),
        ]
      : []),
  ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">
          {isAdmin ? 'Institution setup overview' : 'Your settings overview'}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Select a section below. Configuration controls are shown only when your active role can
          manage them.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onOpen(card.id)}
              className="group rounded-2xl bg-slate-50 p-4 text-left transition hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-white p-2.5 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-900">{card.title}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                  </span>
                  <span className="mt-1 block text-sm leading-5 text-slate-500">
                    {card.description}
                  </span>
                  <span
                    className={`mt-3 flex items-center gap-1.5 text-xs font-medium ${
                      card.ready ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {card.ready ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <CircleAlert className="h-3.5 w-3.5" />
                    )}
                    <span className="line-clamp-2">{card.status}</span>
                  </span>
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Security Tab ─────────────────────────────────────────────────────────────

function SecurityTab() {
  const { mutation, isLoading } = useMutation();

  const formik = useFormik({
    initialValues: { currentPassword: '', newPassword: '', confirm: '' },
    validationSchema: Yup.object({
      currentPassword: Yup.string().required('Current password is required'),
      newPassword: Yup.string()
        .min(8, 'Min 8 characters')
        .matches(/[A-Z]/, 'At least one uppercase letter')
        .matches(/[0-9]/, 'At least one digit')
        .required('Required'),
      confirm: Yup.string()
        .oneOf([Yup.ref('newPassword')], 'Passwords must match')
        .required('Confirm your password'),
    }),
    onSubmit: async (values, helpers) => {
      const res = await mutation('auth/change-password', {
        method: 'POST',
        body: { currentPassword: values.currentPassword, newPassword: values.newPassword },
      });
      if (res?.results?.success) helpers.resetForm();
    },
  });

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Security</h2>
      <p className="mb-6 text-sm text-slate-500">
        Use a strong, unique password — at least 8 characters with one uppercase letter and a digit.
      </p>

      <form onSubmit={formik.handleSubmit} className="max-w-lg space-y-4">
        <Field
          label="Current password"
          name="currentPassword"
          type="password"
          formik={formik}
          icon={KeyRound}
        />
        <Field
          label="New password"
          name="newPassword"
          type="password"
          formik={formik}
          icon={KeyRound}
        />
        <Field
          label="Confirm new password"
          name="confirm"
          type="password"
          formik={formik}
          icon={KeyRound}
        />
        <div className="pt-2">
          <CustomButton type="submit" loading={isLoading} className="w-full sm:w-auto">
            Update password
          </CustomButton>
        </div>
      </form>

      <MfaSection />
    </div>
  );
}

// ─── MFA Section ──────────────────────────────────────────────────────────────

function MfaSection() {
  const user = useAuthStore((s) => s.user);
  const { mutation, isLoading } = useMutation();
  const { data: meRaw, mutate: refetchUser } = useSwr<IApiResponse<IAuthUser>>('user/me');
  const freshUser = meRaw?.data;
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string>('');
  const [token, setToken] = useState('');
  const [disableToken, setDisableToken] = useState('');
  const [showDisable, setShowDisable] = useState(false);

  // Keep store + localStorage in sync with the authoritative DB record.
  React.useEffect(() => {
    if (freshUser && user && freshUser.mfaEnabled !== user.mfaEnabled) {
      const merged = { ...user, ...freshUser };
      setLocalStorageItem('erp_user', merged);
      useAuthStore.setState({ user: merged });
    }
  }, [freshUser, user]);

  const syncMfaStatus = async (enabled: boolean) => {
    if (user) {
      const merged = { ...user, mfaEnabled: enabled };
      setLocalStorageItem('erp_user', merged);
      useAuthStore.setState({ user: merged });
    }
    await refetchUser();
  };

  const startSetup = async () => {
    const res = await mutation('auth/mfa/setup', { method: 'POST', body: {} });
    const data = res?.results?.data as { qrDataUrl: string; secret: string } | undefined;
    if (data?.qrDataUrl) {
      setQrDataUrl(data.qrDataUrl);
      setSecret(data.secret);
    }
  };

  const verify = async () => {
    if (token.length !== 6) {
      toast.error('Enter the 6-digit code from your authenticator app');
      return;
    }
    const res = await mutation('auth/mfa/verify', { method: 'POST', body: { token } });
    if (res?.results?.success) {
      await syncMfaStatus(true);
      setQrDataUrl(null);
      setSecret('');
      setToken('');
    }
  };

  const disable = async () => {
    if (disableToken.length !== 6) {
      toast.error('Enter the 6-digit code to confirm');
      return;
    }
    const res = await mutation('auth/mfa/disable', {
      method: 'POST',
      body: { token: disableToken },
    });
    if (res?.results?.success) {
      await syncMfaStatus(false);
      setDisableToken('');
      setShowDisable(false);
    }
  };

  return (
    <div className="mt-8 rounded-xl bg-slate-50 p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 text-slate-500" />
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-800">Two-Factor Authentication (MFA)</div>
          <div className="text-xs text-slate-500">
            {user?.mfaEnabled
              ? 'MFA is active. You will be asked for a 6-digit code on every login.'
              : 'Add an extra layer of security using an authenticator app (Google Authenticator, Authy, 1Password).'}
          </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            user?.mfaEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'
          }`}
        >
          {user?.mfaEnabled ? 'On' : 'Off'}
        </span>
      </div>

      {!user?.mfaEnabled && !qrDataUrl && (
        <div className="mt-4">
          <CustomButton onClick={startSetup} loading={isLoading} variant="primary">
            Enable MFA
          </CustomButton>
        </div>
      )}

      {!user?.mfaEnabled && qrDataUrl && (
        <div className="mt-4 space-y-4 rounded-lg bg-white p-4">
          <div>
            <div className="text-sm font-medium text-slate-800">1. Scan this QR code</div>
            <div className="text-xs text-slate-500">
              Open your authenticator app and scan the code below.
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 sm:flex-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="MFA QR code"
              className="h-44 w-44 rounded-lg bg-white p-2 ring-1 ring-slate-200"
            />
            <div className="flex-1 text-xs text-slate-500">
              Can&apos;t scan? Enter this secret manually:
              <div className="mt-1 break-all rounded bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700">
                {secret}
              </div>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-800">2. Enter the 6-digit code</div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
                className={`${inputCls} max-w-45 tracking-widest`}
                placeholder="123456"
              />
              <CustomButton onClick={verify} loading={isLoading} variant="primary">
                Verify &amp; Enable
              </CustomButton>
            </div>
          </div>
        </div>
      )}

      {user?.mfaEnabled && !showDisable && (
        <div className="mt-4">
          <CustomButton onClick={() => setShowDisable(true)} variant="secondary">
            Disable MFA
          </CustomButton>
        </div>
      )}

      {user?.mfaEnabled && showDisable && (
        <div className="mt-4 space-y-3 rounded-lg bg-white p-4">
          <div className="text-sm font-medium text-slate-800">
            Enter your current 6-digit code to confirm
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={disableToken}
              onChange={(e) => setDisableToken(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className={`${inputCls} max-w-45 tracking-widest`}
            />
            <CustomButton onClick={disable} loading={isLoading} variant="primary">
              Disable
            </CustomButton>
            <CustomButton onClick={() => setShowDisable(false)} variant="secondary">
              Cancel
            </CustomButton>
          </div>
        </div>
      )}
    </div>
  );
}

interface IFieldProps {
  label: string;
  name: string;
  type?: string;
  icon?: React.ElementType;
  formik: {
    values: Record<string, unknown>;
    touched: Record<string, unknown>;
    errors: Record<string, unknown>;
    handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  };
}

function Field({ label, name, type = 'text', icon: Icon, formik }: IFieldProps) {
  const err = formik.touched[name] && formik.errors[name];
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
        )}
        <input
          name={name}
          type={type}
          value={(formik.values[name] as string | number | undefined) ?? ''}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          className={`${inputCls} ${Icon ? 'pl-9' : ''}`}
        />
      </div>
      {err ? <span className="mt-1 block text-xs text-rose-600">{String(err)}</span> : null}
    </label>
  );
}

// ─── Notifications Tab ────────────────────────────────────────────────────────

function NotificationsTab() {
  const { data, isLoading, mutate } = useSwr<IApiResponse<INotificationPrefs>>(
    'notification/preferences',
  );
  const { mutation, isLoading: saving } = useMutation();
  const { readiness: pushReadiness, ready: pushReady } = usePushReadiness();
  const [browserPermission, setBrowserPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  useEffect(() => {
    const syncPermission = () => {
      if ('Notification' in window) setBrowserPermission(Notification.permission);
    };
    window.addEventListener('focus', syncPermission);
    return () => window.removeEventListener('focus', syncPermission);
  }, []);

  const prefs = data?.data || { email: true, inApp: true, push: false, sms: true };

  const update = async (key: keyof INotificationPrefs, value: boolean) => {
    if (key === 'push' && value) {
      if (!pushReady) {
        toast.info(pushReadiness?.reason || 'Push delivery is not ready for this institution.');
        return;
      }
      if (browserPermission === 'unsupported') {
        toast.info('This browser does not support web push notifications.');
        return;
      }
      let permission = Notification.permission;
      if (permission === 'default') permission = await Notification.requestPermission();
      setBrowserPermission(permission);
      if (permission !== 'granted') {
        toast.info(
          permission === 'denied'
            ? 'Notifications are blocked. Allow them in this site’s browser settings, then try again.'
            : 'Push was not enabled because notification access was not granted.',
        );
        return;
      }
    }
    const next = { ...prefs, [key]: value };
    const res = await mutation('notification/preferences', { method: 'PUT', body: next });
    if (!res?.results?.success) return;
    if (key === 'push' && !value) {
      saveToLocalStorage(PUSH_MANUAL_OPTOUT_KEY, 'true');
      await mutation('notification/fcm-token', {
        method: 'DELETE',
        body: { platform: 'web', deviceId: getPushDeviceId() },
        isAlert: false,
      });
      toast.success('Push access removed from this device');
    } else if (key === 'push') {
      removeFromLocalStorage(PUSH_MANUAL_OPTOUT_KEY);
      toast.success('Push notifications enabled on this device');
    }
    mutate();
  };

  const rows: {
    key: keyof INotificationPrefs;
    label: string;
    desc: string;
    icon: React.ElementType;
  }[] = [
    { key: 'email', label: 'Email', desc: 'Receive important updates by email', icon: Mail },
    { key: 'inApp', label: 'In-app', desc: 'Show notifications in the app header', icon: BellRing },
    { key: 'push', label: 'Push', desc: 'Browser push notifications', icon: MessageSquare },
    { key: 'sms', label: 'SMS', desc: 'Time-sensitive updates by text message', icon: Smartphone },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
      <p className="mb-6 text-sm text-slate-500">Choose how you want to be reached.</p>

      {isLoading ? (
        <div className="py-10 text-center text-sm text-slate-600">Loading preferences…</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((row) => {
            const Icon = row.icon;
            const unavailable =
              row.key === 'push' && (!pushReady || browserPermission === 'unsupported');
            const pushBlocked = row.key === 'push' && browserPermission === 'denied';
            const checked =
              unavailable || (row.key === 'push' && browserPermission !== 'granted')
                ? false
                : !!prefs[row.key];
            return (
              <div key={row.key} className="flex items-center gap-4 py-4">
                <div className="rounded-lg bg-slate-50 p-2 text-slate-500">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-800">{row.label}</div>
                  <div className={`text-xs ${unavailable ? 'text-amber-600' : 'text-slate-500'}`}>
                    {unavailable
                      ? pushReadiness?.reason ||
                        'Push delivery is unavailable for this institution or browser.'
                      : pushBlocked
                        ? 'Blocked by this browser. Allow Notifications in site settings, then turn Push on again.'
                        : row.desc}
                  </div>
                </div>
                <Toggle
                  checked={checked}
                  disabled={saving || unavailable}
                  onChange={(v) => update(row.key, v)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition ${
        checked ? 'bg-primary' : 'bg-slate-300'
      } ${disabled ? 'opacity-60' : ''}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 translate-y-0.5 transform rounded-full bg-white  transition ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

// ─── Sessions Tab ─────────────────────────────────────────────────────────────

interface IParsedUA {
  browser: string;
  os: string;
  type: 'mobile' | 'tablet' | 'desktop';
}

function parseUA(ua?: string): IParsedUA {
  const fallback: IParsedUA = { browser: 'Unknown browser', os: 'Unknown OS', type: 'desktop' };
  if (!ua || ua === 'unknown') return fallback;

  let browser = 'Browser';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) browser = 'Chrome';
  else if (/firefox\//i.test(ua)) browser = 'Firefox';
  else if (/safari\//i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/opr\/|opera/i.test(ua)) browser = 'Opera';

  let os = 'OS';
  if (/windows nt 10/i.test(ua)) os = 'Windows 10/11';
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/mac os x ([\d_]+)/i.test(ua)) {
    const m = ua.match(/mac os x ([\d_]+)/i);
    os = m ? `macOS ${m[1].replace(/_/g, '.')}` : 'macOS';
  } else if (/android/i.test(ua)) os = 'Android';
  else if (/linux/i.test(ua)) os = 'Linux';

  let type: IParsedUA['type'] = 'desktop';
  if (/ipad|tablet/i.test(ua)) type = 'tablet';
  else if (/mobi|iphone|android/i.test(ua) && !/ipad|tablet/i.test(ua)) type = 'mobile';

  return { browser, os, type };
}

function SessionsTab() {
  const { data: raw, isLoading, mutate } = useSwr('auth/sessions');
  const { mutation, isLoading: revoking } = useMutation();
  const rawSessions: ISession[] =
    (raw as { data?: { activeSessions?: ISession[] } })?.data?.activeSessions ??
    (raw as { data?: ISession[] })?.data ??
    [];
  const sessions: ISession[] = [...rawSessions].sort((a, b) => {
    if (a.isCurrent && !b.isCurrent) return -1;
    if (!a.isCurrent && b.isCurrent) return 1;
    const aT = new Date(a.createdAt || a.issuedAt || 0).getTime();
    const bT = new Date(b.createdAt || b.issuedAt || 0).getTime();
    return bT - aT;
  });

  const fmtDate = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const relTime = (iso?: string) => {
    if (!iso || !now) return '';
    const diff = now - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return `${Math.floor(d / 30)}mo ago`;
  };

  const revokeOne = async (jti: string) => {
    const conf = await Swal.fire({
      title: 'Revoke this session?',
      text: 'The device will be signed out immediately.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Revoke',
      confirmButtonColor: '#dc2626',
    });
    if (!conf.isConfirmed) return;
    const res = await mutation(`auth/sessions/${jti}`, { method: 'DELETE', isAlert: true });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('Session revoked');
      mutate();
    }
  };

  const revokeAll = async () => {
    const conf = await Swal.fire({
      title: 'Sign out all other devices?',
      text: 'Your current session will be kept; every other session will be terminated.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sign out others',
      confirmButtonColor: '#dc2626',
    });
    if (!conf.isConfirmed) return;
    const res = await mutation('auth/sessions?keepCurrent=true', {
      method: 'DELETE',
      isAlert: true,
    });
    if ((res as { results?: { success?: boolean } })?.results?.success) {
      toast.success('All other sessions revoked');
      mutate();
    }
  };

  const deviceIcon = (type: IParsedUA['type']) => {
    if (type === 'mobile') return Smartphone;
    if (type === 'tablet') return Tablet;
    return Laptop;
  };

  const otherCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Active Sessions</h2>
          <p className="text-sm text-slate-500">
            Devices currently signed in to your account. Revoke any session you don&apos;t
            recognize.
          </p>
        </div>
        {otherCount > 0 && (
          <div className="w-fit">
            <CustomButton
              startIcon={<LogOut className="mr-1.5 h-4 w-4" />}
              className="w-fit!"
              variant="tertiary"
              onClick={revokeAll}
              loading={revoking}
            >
              Sign out other devices
            </CustomButton>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 py-12 text-center">
          <Monitor className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">No active sessions found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {sessions.map((s) => {
            const ua = parseUA(s.device);
            const Icon = deviceIcon(ua.type);
            const started = s.createdAt || s.issuedAt;
            return (
              <div
                key={s.jti}
                className={`group relative overflow-hidden rounded-2xl p-5 transition ${
                  s.isCurrent
                    ? 'bg-linear-to-br from-emerald-50 via-emerald-50/40 to-white ring-1 ring-emerald-200'
                    : 'bg-slate-50 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                      s.isCurrent ? 'bg-emerald-500 text-white' : 'bg-white text-slate-600'
                    }`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {ua.browser} on {ua.os}
                      </p>
                      {s.isCurrent ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          Current
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                          {ua.type}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">Signed in {relTime(started)}</p>
                  </div>

                  {!s.isCurrent && (
                    <button
                      type="button"
                      onClick={() => revokeOne(s.jti)}
                      className="shrink-0 rounded-lg p-2 text-slate-600 transition hover:bg-red-50 hover:text-red-600"
                      title="Revoke session"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-slate-600">
                        IP address
                      </p>
                      <p className="truncate font-medium text-slate-700">{s.ip || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-slate-600">Started</p>
                      <p className="truncate font-medium text-slate-700">{fmtDate(started)}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Institution Tab ─────────────────────────────────────────────────────────

function InstitutionTab() {
  const {
    data: rawSettings,
    isLoading,
    mutate,
  } = useSwr<IApiResponse<IInstitutionSetting>>('institution-setting');
  const { mutation, isLoading: isSaving } = useMutation();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string>('');
  const [uploadedSocialPreviewFiles, setUploadedSocialPreviewFiles] = useState<
    IViewerFile[] | null
  >(null);

  const settings = rawSettings?.data;
  const socialPreviewFiles =
    uploadedSocialPreviewFiles ??
    (settings?.seoImageUrl ? [{ url: settings.seoImageUrl, name: 'Social preview image' }] : []);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      name: settings?.name || '',
      tagline: settings?.tagline || '',
      address: settings?.address || '',
      phone: settings?.phone || '',
      email: settings?.email || '',
      websiteUrl: settings?.websiteUrl || '',
      accreditations: settings?.accreditations?.join(', ') || '',
      primaryColor: settings?.primaryColor || '#0178D7',
      secondaryColor: settings?.secondaryColor || '#9BB94F',
      seoTitle: settings?.seoTitle || '',
      seoDescription: settings?.seoDescription || '',
      seoImageUrl: settings?.seoImageUrl || '',
    },
    validationSchema: Yup.object({
      name: Yup.string().required('Name is required'),
      email: Yup.string().email('Invalid email address'),
      websiteUrl: Yup.string()
        .trim()
        .url('Official website must be a complete URL beginning with https://'),
      primaryColor: Yup.string().matches(/^#[0-9A-Fa-f]{6}$/, 'Use a valid 6-digit hex colour'),
      secondaryColor: Yup.string().matches(/^#[0-9A-Fa-f]{6}$/, 'Use a valid 6-digit hex colour'),
      seoTitle: Yup.string().max(70, 'Use no more than 70 characters'),
      seoDescription: Yup.string().max(180, 'Use no more than 180 characters'),
      seoImageUrl: Yup.string()
        .trim()
        .url('Social preview image must be a complete URL beginning with https://'),
    }),
    onSubmit: async (values) => {
      const formData = new FormData();
      formData.append('name', values.name);
      formData.append('tagline', values.tagline);
      formData.append('address', values.address);
      formData.append('phone', values.phone);
      formData.append('email', values.email);
      formData.append('websiteUrl', values.websiteUrl);
      formData.append('primaryColor', values.primaryColor);
      formData.append('secondaryColor', values.secondaryColor);
      formData.append('seoTitle', values.seoTitle);
      formData.append('seoDescription', values.seoDescription);
      formData.append('seoImageUrl', values.seoImageUrl);

      const accList = values.accreditations
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      formData.append('accreditations', JSON.stringify(accList));

      if (logoFile) {
        formData.append('logo', logoFile);
      }
      if (faviconFile) {
        formData.append('favicon', faviconFile);
      }

      const res = await mutation('institution-setting', {
        method: 'PUT',
        isFormData: true,
        body: formData,
      });

      if (res?.results?.success) {
        toast.success('Institution settings updated successfully');
        setLogoFile(null);
        setFaviconFile(null);
        mutate();
      } else {
        toast.error(
          'Institution settings could not be saved. Please review the form and try again.',
        );
      }
    },
  });

  const uploadSocialPreview = async (file: File) => {
    const body = new FormData();
    body.append('file', file);
    const response = await mutation('upload', {
      method: 'POST',
      body,
      isFormData: true,
      dedupe: false,
    });
    const uploaded = response?.results?.data as { url?: string; filename?: string } | undefined;
    if (!uploaded?.url) return false;
    setUploadedSocialPreviewFiles([{ url: uploaded.url, name: uploaded.filename ?? file.name }]);
    await formik.setFieldValue('seoImageUrl', uploaded.url);
    return true;
  };

  const displayPreview = logoPreview || settings?.logoUrl || '';
  const faviconDisplayPreview = faviconPreview || settings?.faviconUrl || '';

  if (isLoading) {
    return <div className="py-12 text-center text-slate-500">Loading settings...</div>;
  }

  return (
    <form onSubmit={formik.handleSubmit} noValidate className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-slate-900">Institution Identity & Branding</h3>
        <p className="text-sm text-slate-500">
          Configure details used dynamically in email templates, notifications, and print reports.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Institution Name
            </label>
            <input
              type="text"
              name="name"
              className={inputCls}
              value={formik.values.name}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
            />
            {formik.touched.name && formik.errors.name && (
              <p className="mt-1 text-xs text-rose-500">{formik.errors.name}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Tagline / Subtitle
            </label>
            <input
              type="text"
              name="tagline"
              className={inputCls}
              value={formik.values.tagline}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Official Website URL
            </label>
            <input
              type="text"
              name="websiteUrl"
              className={inputCls}
              value={formik.values.websiteUrl}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
            />
          </div>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6">
          <label className="mb-2 text-xs font-medium text-slate-600">Institution Logo</label>
          <div className="relative mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl bg-white  ring-1 ring-slate-200">
            {displayPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayPreview}
                alt="Logo Preview"
                className="h-full w-full object-contain p-2"
              />
            ) : (
              <Building className="h-10 w-10 text-slate-300" />
            )}
          </div>
          <input
            type="file"
            id="logo-upload"
            className="hidden"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setLogoFile(file);
                setLogoPreview(URL.createObjectURL(file));
              }
            }}
          />
          <label
            htmlFor="logo-upload"
            className="cursor-pointer rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700  ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Upload New Logo
          </label>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Support / General Email
          </label>
          <input
            type="email"
            name="email"
            className={inputCls}
            value={formik.values.email}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
          />
          {formik.touched.email && formik.errors.email && (
            <p className="mt-1 text-xs text-rose-500">{formik.errors.email}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Contact Number</label>
          <input
            type="text"
            name="phone"
            className={inputCls}
            value={formik.values.phone}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Postal Address</label>
        <textarea
          name="address"
          rows={2}
          className={inputCls}
          value={formik.values.address}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          Accreditations (comma-separated list)
        </label>
        <input
          type="text"
          name="accreditations"
          placeholder="e.g. AICTE Approved, NAAC Accredited"
          className={inputCls}
          value={formik.values.accreditations}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
        />
      </div>

      <section className="rounded-xl bg-slate-50 p-4 sm:p-5">
        <h4 className="text-sm font-semibold text-slate-900">Portal colour theme</h4>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Applied to sign-in, password recovery, navigation, buttons and active states.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {(['primaryColor', 'secondaryColor'] as const).map((field) => (
            <label key={field} htmlFor={field}>
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                {field === 'primaryColor' ? 'Primary colour' : 'Accent colour'}
              </span>
              <div className="flex items-center gap-2 rounded-lg bg-white p-2 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-primary/30">
                <input
                  id={`${field}-picker`}
                  type="color"
                  value={formik.values[field]}
                  onChange={(event) =>
                    formik.setFieldValue(field, event.target.value.toUpperCase())
                  }
                  className="h-9 w-12 cursor-pointer rounded-md bg-transparent"
                  aria-label={`Choose ${field === 'primaryColor' ? 'primary' : 'accent'} colour`}
                />
                <input
                  id={field}
                  name={field}
                  value={formik.values[field]}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder={field === 'primaryColor' ? '#0178D7' : '#9BB94F'}
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold uppercase text-slate-800 outline-none"
                />
              </div>
              {formik.touched[field] && formik.errors[field] && (
                <span className="mt-1 block text-xs text-rose-600">{formik.errors[field]}</span>
              )}
            </label>
          ))}
        </div>
        <div className="mt-4 overflow-hidden rounded-lg bg-white p-3">
          <div className="flex items-center justify-between rounded-lg bg-primary px-4 py-3 text-white">
            <span className="text-sm font-semibold">Theme preview</span>
            <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-bold text-slate-950">
              Active
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h4 className="text-sm font-semibold text-slate-900">Browser icon & SEO</h4>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Controls the tenant browser tab, search description, and link preview metadata.
        </p>

        <div className="mt-4 grid gap-5 md:grid-cols-[160px_1fr]">
          <div className="rounded-xl bg-slate-50 p-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-white  ring-1 ring-slate-200">
              {faviconDisplayPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={faviconDisplayPreview}
                  alt="Favicon preview"
                  className="h-10 w-10 object-contain"
                />
              ) : (
                <Building className="h-7 w-7 text-slate-300" />
              )}
            </div>
            <input
              id="favicon-upload"
              type="file"
              className="hidden"
              accept=".ico,image/x-icon,image/vnd.microsoft.icon,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  setFaviconFile(file);
                  setFaviconPreview(URL.createObjectURL(file));
                }
              }}
            />
            <label
              htmlFor="favicon-upload"
              className="mt-3 inline-flex cursor-pointer rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700  ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Upload favicon
            </label>
            <p className="mt-2 text-[11px] leading-4 text-slate-500">
              ICO, PNG or WebP. Use a square 32×32 or 48×48 image.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">SEO title</label>
              <input
                name="seoTitle"
                className={inputCls}
                value={formik.values.seoTitle}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder={formik.values.name}
              />
              <div className="mt-1 flex justify-between text-[11px] text-slate-600">
                <span>
                  {formik.touched.seoTitle && formik.errors.seoTitle
                    ? formik.errors.seoTitle
                    : 'Shown in the browser tab and search results.'}
                </span>
                <span>{formik.values.seoTitle.length}/70</span>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                SEO description
              </label>
              <textarea
                name="seoDescription"
                rows={3}
                className={inputCls}
                value={formik.values.seoDescription}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              <div className="mt-1 flex justify-between text-[11px] text-slate-600">
                <span>
                  {formik.touched.seoDescription && formik.errors.seoDescription
                    ? formik.errors.seoDescription
                    : 'A concise description of this institution portal.'}
                </span>
                <span>{formik.values.seoDescription.length}/180</span>
              </div>
            </div>
            <InlineFileUpload
              label="Social preview image"
              files={socialPreviewFiles}
              onUpload={uploadSocialPreview}
              onRemove={async () => {
                setUploadedSocialPreviewFiles([]);
                await formik.setFieldValue('seoImageUrl', '');
              }}
              hint="Upload the image shown when your institution portal is shared"
              inlineImagePreview
            />
          </div>
        </div>
      </section>

      <div className="border-t border-slate-100 pt-4">
        {formik.submitCount > 0 && !formik.isValid && (
          <div role="alert" className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <p className="font-semibold">Settings could not be saved</p>
            <p className="mt-1 text-xs leading-5">
              {Object.values(formik.errors)
                .filter((message): message is string => typeof message === 'string')
                .join(' · ')}
            </p>
          </div>
        )}
        <div className="flex items-center justify-end gap-3">
          {formik.dirty && (
            <span className="text-xs font-medium text-amber-600">Unsaved changes</span>
          )}
          <CustomButton type="submit" loading={isSaving} loadingText="Saving settings...">
            Save Changes
          </CustomButton>
        </div>
      </div>
    </form>
  );
}

interface IInstitutionSetting {
  name: string;
  tagline?: string;
  address?: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  logoUrl?: string;
  faviconUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoImageUrl?: string;
  accreditations?: string[];
  primaryColor?: string;
  secondaryColor?: string;
}

export default UseProtectedRoutes(SettingsPage);

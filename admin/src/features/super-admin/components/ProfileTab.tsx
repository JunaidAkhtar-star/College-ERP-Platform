/**
 * @file ProfileTab.tsx
 * @description Authenticated SaaS operator identity and secure account management.
 * @module features/super-admin/components
 */

'use client';

import { Form, Formik } from 'formik';
import Image from 'next/image';
import { useRef, useState } from 'react';
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  Clock3,
  KeyRound,
  LockKeyhole,
  Mail,
  LoaderCircle,
  Phone,
  ShieldCheck,
  Smartphone,
  UserRound,
} from 'lucide-react';
import { toast } from 'react-toastify';
import CustomButton from '@/shared/core/CustomButton';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useAuthStore } from '@/shared/store/authStore';
import type { IAuthUser } from '@/shared/types';
import { motion } from '@/shared/utils/motion';
import { operatorPasswordSchema } from '../validations/profile.schema';

interface IPasswordValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface IMfaSetupData {
  qrDataUrl: string;
  secret: string;
}

const inputClass =
  'mt-2 w-full rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none ring-1 ring-inset ring-slate-200 transition focus:bg-white focus:ring-2 focus:ring-primary/30';

export default function ProfileTab() {
  const user = useAuthStore((state) => state.user);
  const setAuth = useAuthStore((state) => state.setAuth);
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const role = useAuthStore((state) => state.role);
  const activeRole = useAuthStore((state) => state.activeRole);
  const { data: meResponse, mutate: refreshProfile } = useSwr<{ data?: IAuthUser }>('user/me');
  const profile = meResponse?.data ?? user;
  const { mutation: passwordMutation, isLoading: isChangingPassword } = useMutation();
  const { mutation: setupMfaMutation, isLoading: isPreparingMfa } = useMutation();
  const { mutation: verifyMfaMutation, isLoading: isVerifyingMfa } = useMutation();
  const { mutation: disableMfaMutation, isLoading: isDisablingMfa } = useMutation();
  const { mutation: profileMutation, isLoading: isSavingProfile } = useMutation();
  const { mutation: avatarMutation, isLoading: isUploadingAvatar } = useMutation();
  const avatarInput = useRef<HTMLInputElement>(null);
  const mfaEnabled = Boolean(profile?.mfaEnabled);
  const [mfaSetup, setMfaSetup] = useState<IMfaSetupData | null>(null);
  const [mfaToken, setMfaToken] = useState('');

  const syncProfile = (updated: IAuthUser) => {
    if (accessToken && refreshToken && role) {
      setAuth(updated, accessToken, refreshToken, role, activeRole);
    }
  };

  const syncMfaStatus = async (enabled: boolean) => {
    if (user) syncProfile({ ...user, mfaEnabled: enabled });
    await refreshProfile();
  };

  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
      toast.error('Choose an image up to 2 MB.');
      return;
    }
    const body = new FormData();
    body.append('avatar', file);
    const response = await avatarMutation('user/me/avatar', {
      method: 'PATCH',
      body,
      isFormData: true,
    });
    const updated = response?.results?.data as IAuthUser | undefined;
    if (updated) {
      syncProfile(updated);
      await refreshProfile();
      toast.success('Profile photo updated.');
    }
    if (avatarInput.current) avatarInput.current.value = '';
  };

  const updatePassword = async (values: IPasswordValues, resetForm: () => void) => {
    const response = await passwordMutation('auth/change-password', {
      method: 'POST',
      body: { currentPassword: values.currentPassword, newPassword: values.newPassword },
    });
    if (!response?.results?.success) return;
    toast.success('Password updated securely.');
    resetForm();
  };

  const beginMfaSetup = async () => {
    const response = await setupMfaMutation('auth/mfa/setup', { method: 'POST' });
    const data = response?.results?.data as IMfaSetupData | undefined;
    if (response?.results?.success && data) {
      setMfaSetup(data);
      setMfaToken('');
    }
  };

  const verifyMfa = async () => {
    const response = await verifyMfaMutation('auth/mfa/verify', {
      method: 'POST',
      body: { token: mfaToken },
    });
    if (response?.results?.success) {
      toast.success('Multi-factor authentication enabled.');
      await syncMfaStatus(true);
      setMfaSetup(null);
      setMfaToken('');
    }
  };

  const disableMfa = async () => {
    const response = await disableMfaMutation('auth/mfa/disable', {
      method: 'POST',
      body: { token: mfaToken },
    });
    if (response?.results?.success) {
      toast.success('Multi-factor authentication disabled.');
      await syncMfaStatus(false);
      setMfaToken('');
    }
  };

  const roleLabel = String(
    activeRole?.displayName || activeRole?.name || role || 'Super administrator',
  )
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#e9f5ff] via-white to-[#edfafa] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
            <div className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-white ring-4 ring-white/80">
              {profile?.avatar ? (
                <Image
                  src={profile.avatar}
                  alt={profile.name}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center bg-blue-50 text-primary">
                  <UserRound className="h-9 w-9" />
                </div>
              )}
              <button
                type="button"
                onClick={() => avatarInput.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute inset-x-0 bottom-0 flex h-8 cursor-pointer items-center justify-center bg-slate-900/70 text-white transition group-hover:h-10 disabled:cursor-wait"
                aria-label="Change profile photo"
              >
                <Camera className="h-4 w-4" />
              </button>
              {isUploadingAvatar && (
                <div className="absolute inset-0 grid place-items-center bg-white/80 backdrop-blur-sm">
                  <div className="text-center text-primary">
                    <LoaderCircle className="mx-auto h-7 w-7 animate-spin" />
                    <span className="mt-1 block text-[10px] font-semibold">Uploading</span>
                  </div>
                </div>
              )}
              <input
                ref={avatarInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => uploadAvatar(event.target.files?.[0])}
              />
            </div>
            <div>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-900 sm:text-3xl">
                  {profile?.name || 'SaaS administrator'}
                </h1>
                {profile?.isEmailVerified && <BadgeCheck className="h-5 w-5 text-primary" />}
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {profile?.email || 'Authenticated operator'}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  {roleLabel}
                </span>
                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    mfaEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  MFA {mfaEnabled ? 'protected' : 'recommended'}
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-64">
            <div className="rounded-xl bg-white/75 p-4">
              <Mail className="h-4 w-4 text-primary" />
              <p className="mt-3 text-xs text-slate-500">Email status</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">
                {profile?.isEmailVerified ? 'Verified' : 'Pending'}
              </p>
            </div>
            <div className="rounded-xl bg-white/75 p-4">
              <Clock3 className="h-4 w-4 text-primary" />
              <p className="mt-3 text-xs text-slate-500">Last access</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">
                {profile?.lastLogin
                  ? new Date(profile.lastLogin).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'First session'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 sm:p-7">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-primary">
              <UserRound className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Personal information</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Keep your operator identity and contact details current.
              </p>
            </div>
          </div>

          <Formik
            enableReinitialize
            initialValues={{ name: profile?.name || '', phone: profile?.phone || '' }}
            onSubmit={async (values) => {
              const response = await profileMutation('user/me', { method: 'PATCH', body: values });
              const updated = response?.results?.data as IAuthUser | undefined;
              if (updated) {
                syncProfile(updated);
                await refreshProfile();
                toast.success('Account profile updated.');
              }
            }}
          >
            {({ values, handleChange, dirty }) => (
              <Form className="mt-7 space-y-5">
                <label className="block text-sm font-medium text-slate-700">
                  Display name
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-4 top-5 h-4 w-4 text-slate-400" />
                    <input
                      name="name"
                      value={values.name}
                      onChange={handleChange}
                      required
                      maxLength={255}
                      className={`${inputClass} pl-11`}
                      placeholder="Administrator name"
                    />
                  </div>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Phone number
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-4 top-5 h-4 w-4 text-slate-400" />
                    <input
                      name="phone"
                      value={values.phone}
                      onChange={handleChange}
                      className={`${inputClass} pl-11`}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </label>
                <div className="flex justify-end pt-1">
                  <CustomButton
                    type="submit"
                    variant="primary"
                    size="medium"
                    loading={isSavingProfile}
                    loadingText="Saving..."
                    disabled={!dirty}
                  >
                    Save changes
                  </CustomButton>
                </div>
              </Form>
            )}
          </Formik>
        </section>

        <section className="rounded-2xl bg-white p-6 sm:p-7">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-700">
              <KeyRound className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Password security</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Use a unique password containing at least 12 characters.
              </p>
            </div>
          </div>
          <Formik<IPasswordValues>
            initialValues={{ currentPassword: '', newPassword: '', confirmPassword: '' }}
            validationSchema={operatorPasswordSchema}
            onSubmit={(values, helpers) => updatePassword(values, helpers.resetForm)}
          >
            {({ values, errors, touched, handleChange, dirty }) => (
              <Form className="mt-7 space-y-4">
                {(['currentPassword', 'newPassword', 'confirmPassword'] as const).map((field) => (
                  <label key={field} className="block text-sm font-medium text-slate-700">
                    {field === 'currentPassword'
                      ? 'Current password'
                      : field === 'newPassword'
                        ? 'New password'
                        : 'Confirm new password'}
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-4 top-5 h-4 w-4 text-slate-400" />
                      <input
                        type="password"
                        name={field}
                        value={values[field]}
                        onChange={handleChange}
                        autoComplete={
                          field === 'currentPassword' ? 'current-password' : 'new-password'
                        }
                        className={`${inputClass} pl-11`}
                      />
                    </div>
                    {touched[field] && errors[field] && (
                      <span className="mt-1.5 block text-xs text-rose-600">{errors[field]}</span>
                    )}
                  </label>
                ))}
                <div className="flex justify-end pt-2">
                  <CustomButton
                    type="submit"
                    variant="primary"
                    size="medium"
                    loading={isChangingPassword}
                    loadingText="Updating..."
                    disabled={!dirty}
                  >
                    Update password
                  </CustomButton>
                </div>
              </Form>
            )}
          </Formik>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl bg-white">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex items-start gap-3">
            <span
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
                mfaEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900">Authenticator protection</h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    mfaEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {mfaEnabled ? 'Active' : 'Not enabled'}
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Add a rotating six-digit code after your password to protect sensitive platform
                operations.
              </p>
            </div>
          </div>
          {!mfaEnabled && !mfaSetup && (
            <CustomButton
              variant="primary"
              size="medium"
              onClick={beginMfaSetup}
              loading={isPreparingMfa}
              loadingText="Preparing..."
            >
              Enable MFA
            </CustomButton>
          )}
        </div>

        {mfaSetup && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-slate-50 p-6 sm:p-7"
          >
            <div className="grid gap-7 md:grid-cols-[200px_1fr] md:items-start">
              <div className="rounded-xl bg-white p-3">
                <Image
                  src={mfaSetup.qrDataUrl}
                  alt="Authenticator QR code"
                  width={176}
                  height={176}
                  unoptimized
                  className="mx-auto rounded-lg"
                />
              </div>
              <div>
                <div className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-white">
                    1
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Scan the QR code</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Open Google Authenticator, Microsoft Authenticator, Authy, or another TOTP
                      application.
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-white">
                    2
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">Or enter the setup key</p>
                    <code className="mt-2 block break-all rounded-xl bg-white p-3 text-xs text-slate-700">
                      {mfaSetup.secret}
                    </code>
                  </div>
                </div>
                <div className="mt-5 flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-white">
                    3
                  </span>
                  <div>
                    <label className="text-sm font-semibold text-slate-800">
                      Verify the generated code
                      <input
                        value={mfaToken}
                        onChange={(event) =>
                          setMfaToken(event.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="000000"
                        className="mt-2 block w-52 rounded-xl bg-white px-4 py-3 text-center font-mono text-lg tracking-[0.3em] outline-none ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-primary/30"
                      />
                    </label>
                    <div className="mt-4">
                      <CustomButton
                        variant="primary"
                        size="medium"
                        onClick={verifyMfa}
                        loading={isVerifyingMfa}
                        loadingText="Verifying..."
                        disabled={mfaToken.length !== 6}
                      >
                        Verify and enable
                      </CustomButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {mfaEnabled && (
          <div className="bg-emerald-50/70 p-6 sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-emerald-900">
                    Your account is protected
                  </p>
                  <p className="mt-0.5 text-xs text-emerald-700">
                    A current authenticator code is required to disable this protection.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="relative">
                  <Smartphone className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-emerald-600" />
                  <input
                    value={mfaToken}
                    onChange={(event) =>
                      setMfaToken(event.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="6-digit code"
                    aria-label="Current authenticator code"
                    className="w-full rounded-xl bg-white py-3 pl-11 pr-4 text-center font-mono tracking-[0.2em] outline-none ring-1 ring-inset ring-emerald-200 focus:ring-2 focus:ring-emerald-400 sm:w-52"
                  />
                </label>
                <CustomButton
                  variant="cancel"
                  size="medium"
                  onClick={disableMfa}
                  loading={isDisablingMfa}
                  loadingText="Disabling..."
                  disabled={mfaToken.length !== 6}
                >
                  Disable MFA
                </CustomButton>
              </div>
            </div>
          </div>
        )}
      </section>
    </motion.div>
  );
}

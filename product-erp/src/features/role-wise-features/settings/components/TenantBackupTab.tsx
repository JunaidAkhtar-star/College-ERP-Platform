'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import {
  CheckCircle2,
  CloudCog,
  DatabaseBackup,
  HardDrive,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from 'lucide-react';
import CustomButton from '@/shared/core/CustomButton';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';

type TFrequency = 'daily' | 'weekly' | 'monthly';
interface IBackupConfig {
  connected: boolean;
  enabled: boolean;
  frequency: TFrequency;
  hourUtc: number;
  dayOfWeek: number;
  dayOfMonth: number;
  retentionCount: number;
  driveFolderId?: string;
  driveAccountEmail?: string;
  nextRunAt?: string;
  lastRunAt?: string;
  lastStatus?: 'completed' | 'failed';
  lastError?: string;
}
interface IBackupJob {
  _id: string;
  backupNumber: string;
  trigger: 'manual' | 'scheduled';
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  stage:
    | 'queued'
    | 'exporting'
    | 'encrypting'
    | 'verifying'
    | 'authorizing'
    | 'uploading'
    | 'finalizing'
    | 'completed'
    | 'failed';
  progressMessage: string;
  failureCode?: string;
  driveFileName?: string;
  byteSize?: number;
  checksum?: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
}
interface IOverview {
  providerConfigured: boolean;
  tenant: {
    tenantId: string;
    institutionName: string;
    databaseName: string;
    dataSizeBytes: number;
    storageSizeBytes: number;
    collections: number;
  };
  activeJob?: IBackupJob | null;
  config: IBackupConfig;
  jobs: IBackupJob[];
}

const inputClass =
  'w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none ring-1 ring-slate-200 transition focus:bg-white focus:ring-2 focus:ring-primary/30';

const formatBytes = (bytes: number) => {
  if (!bytes) return 'Calculating…';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** unitIndex).toFixed(unitIndex > 1 ? 1 : 0)} ${units[unitIndex]}`;
};

const localSchedule = (hourUtc: number, dayOfWeekUtc: number) => {
  const date = new Date(Date.UTC(2024, 0, 7 + dayOfWeekUtc, hourUtc));
  return { hour: date.getHours(), dayOfWeek: date.getDay() };
};

const utcSchedule = (hourLocal: number, dayOfWeekLocal: number) => {
  const date = new Date(2024, 0, 7 + dayOfWeekLocal, hourLocal);
  return { hourUtc: date.getUTCHours(), dayOfWeek: date.getUTCDay() };
};

export default function TenantBackupTab() {
  const query = useSwr<{ success: boolean; data: IOverview }>('tenant-backup', {
    refreshInterval: (latest) => (latest?.data?.data?.activeJob ? 4000 : 60000),
    revalidateOnFocus: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    dedupingInterval: 2000,
  });
  const { mutation, isLoading } = useMutation();
  const overview = query.data?.data;
  const config = overview?.config;
  const refreshBackups = query.mutate;
  const [draft, setDraft] = useState<Partial<IBackupConfig>>({});

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('backup');
    if (!status) return;
    if (status === 'connected') {
      toast.success('Google Drive connected. You can now save a backup schedule.');
      void refreshBackups();
    } else {
      toast.error('Google Drive could not be connected. Check the OAuth configuration and retry.');
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('backup');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [refreshBackups]);
  const form = {
    enabled: draft.enabled ?? config?.enabled ?? false,
    frequency: draft.frequency ?? config?.frequency ?? ('weekly' as TFrequency),
    hourUtc: draft.hourUtc ?? config?.hourUtc ?? 2,
    dayOfWeek: draft.dayOfWeek ?? config?.dayOfWeek ?? 0,
    dayOfMonth: draft.dayOfMonth ?? config?.dayOfMonth ?? 1,
    retentionCount: draft.retentionCount ?? config?.retentionCount ?? 7,
    driveFolderId: draft.driveFolderId ?? config?.driveFolderId ?? '',
  };
  const local = localSchedule(form.hourUtc, form.dayOfWeek);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const connect = async () => {
    const returnUrl = window.location.href.split('?')[0];
    const response = await mutation(
      `tenant-backup/google/authorization-url?returnUrl=${encodeURIComponent(returnUrl)}`,
      { method: 'GET' },
    );
    const url = response?.results?.data?.url;
    if (typeof url === 'string') window.location.assign(url);
  };

  const save = async () => {
    const response = await mutation('tenant-backup/schedule', {
      method: 'PUT',
      body: form,
    });
    if (response?.results?.success) {
      toast.success('Automatic backup schedule saved.');
      await query.mutate();
    }
  };

  const runNow = async () => {
    const response = await mutation('tenant-backup/run', {
      method: 'POST',
      body: {},
      dedupe: false,
    });
    if (response?.results?.success) {
      toast.success('Secure backup started. Progress will remain visible in the main header.');
      await query.mutate();
    }
  };

  const disconnect = async () => {
    const confirmation = await Swal.fire({
      title: 'Disconnect Google Drive?',
      text: 'Automatic backups will stop. Existing files in Drive will not be deleted.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Disconnect',
      confirmButtonColor: '#dc2626',
    });
    if (!confirmation.isConfirmed) return;
    const response = await mutation('tenant-backup/google', { method: 'DELETE' });
    if (response?.results?.success) {
      toast.success('Google Drive disconnected.');
      await query.mutate();
    }
  };

  if (query.error) {
    return (
      <div className="rounded-2xl bg-rose-50 p-5 text-sm text-rose-700">
        <p className="font-semibold">Backup controls could not be loaded</p>
        <p className="mt-1 text-xs">
          No backup settings were changed. Check access and try loading this section again.
        </p>
        <CustomButton
          variant="secondary"
          className="mt-4 w-fit!"
          onClick={() => void query.mutate()}
        >
          Try again
        </CustomButton>
      </div>
    );
  }

  if (query.isLoading || !overview) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Loading backup controls…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-5  sm:p-6">
        <div className="flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-slate-50">
            <Image
              src="/provider-logos/google-drive.svg"
              alt="Google Drive"
              width={34}
              height={34}
              className="size-9 object-contain"
            />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary">
              Data protection
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
              Google Drive backup
            </h2>
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-500">
          Create encrypted tenant database archives and retain them in your institution’s Google
          Drive. Devvelocity can access only the backup files it creates.
        </p>
      </div>

      {!overview.providerConfigured ? (
        <div className="rounded-3xl border border-amber-200/70 bg-amber-50/70 p-5 text-sm text-amber-900">
          <div className="flex gap-3">
            <CloudCog className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Google Drive backup is not configured on the server</p>
              <p className="mt-1 text-amber-800">
                Add the Google Drive OAuth client ID, secret and callback URL to the backend
                environment before connecting an account.
              </p>
            </div>
          </div>
        </div>
      ) : !config?.connected ? (
        <div className="grid overflow-hidden rounded-3xl border border-slate-200/70 bg-white  lg:grid-cols-[1.08fr_.92fr]">
          <div className="p-6 sm:p-8">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-100">
              <Image
                src="/provider-logos/google-drive.svg"
                alt="Google Drive"
                width={42}
                height={42}
                className="size-11 object-contain"
              />
            </span>
            <h3 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900">
              Connect your institution Drive
            </h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Authorize a dedicated Google account to receive encrypted, integrity-checked tenant
              database backups.
            </p>
            <CustomButton className="mt-6 rounded-xl!" onClick={connect} loading={isLoading}>
              Continue with Google Drive
            </CustomButton>
          </div>
          <div className="bg-[#f7fafc] p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
              Permission boundary
            </p>
            <div className="mt-5 space-y-4">
              {[
                ['Private by design', 'Your existing Drive documents remain inaccessible.'],
                ['Encrypted archives', 'Every database archive is protected before upload.'],
                ['Verified recovery', 'SHA-256 checksums detect damaged or altered files.'],
              ].map(([title, text]) => (
                <div key={title} className="flex gap-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-600 ">
                    <CheckCircle2 className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {overview.activeJob && (
            <div className="overflow-hidden rounded-2xl bg-primary-50">
              <div className="flex items-start gap-3 p-4">
                <LoaderCircle className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">
                      Secure backup in progress
                    </p>
                    <span className="text-xs font-bold text-primary">
                      {overview.activeJob.progress}%
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {overview.activeJob.progressMessage}
                  </p>
                  <progress
                    value={overview.activeJob.progress}
                    max={100}
                    className="mt-3 h-2 w-full overflow-hidden rounded-full accent-primary"
                    aria-label={`Backup progress ${overview.activeJob.progress}%`}
                  />
                  <p className="mt-2 text-[11px] text-slate-500">
                    You may continue working. This progress also appears in the main header.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[1.25fr_.75fr_.75fr]">
            <div className="rounded-3xl border border-slate-200/70 bg-white p-5 ">
              <div className="flex items-center gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50">
                  <Image
                    src="/provider-logos/google-drive.svg"
                    alt="Google Drive"
                    width={30}
                    height={30}
                    className="size-8 object-contain"
                  />
                </span>
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-emerald-700">
                    <span className="size-1.5 rounded-full bg-emerald-500" /> Connected account
                  </span>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                    {config.driveAccountEmail || 'Google Drive'}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200/70 bg-white p-5">
              <DatabaseBackup className="h-5 w-5 text-primary" />
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-600">
                Next automatic run
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {config.enabled && config.nextRunAt
                  ? new Date(config.nextRunAt).toLocaleString('en-IN')
                  : 'Scheduling disabled'}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200/70 bg-white p-5">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-600">
                Protection
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                AES-256-GCM · SHA-256 verified
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Institution</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                {overview.tenant.institutionName}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Current tenant data</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatBytes(overview.tenant.dataSizeBytes)}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Protected data collections</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {overview.tenant.collections.toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/70 bg-white p-5  sm:p-6">
            <div>
              <h3 className="font-semibold text-slate-900">Automatic backup schedule</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Choose when encrypted backups run and how many recovery points remain in Drive.
              </p>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Frequency
                <select
                  className={`${inputClass} mt-1.5`}
                  value={form.frequency}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      frequency: event.target.value as TFrequency,
                    }))
                  }
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Run time ({timezone})
                <select
                  className={`${inputClass} mt-1.5`}
                  value={local.hour}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      ...utcSchedule(Number(event.target.value), local.dayOfWeek),
                    }))
                  }
                >
                  {Array.from({ length: 24 }, (_, hour) => (
                    <option key={hour} value={hour}>
                      {new Date(2024, 0, 1, hour).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] font-normal text-slate-500">
                  Shown in your current device timezone.
                </span>
              </label>
              {form.frequency === 'weekly' && (
                <label className="text-sm font-medium text-slate-700">
                  Day of week
                  <select
                    className={`${inputClass} mt-1.5`}
                    value={local.dayOfWeek}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        ...utcSchedule(local.hour, Number(event.target.value)),
                      }))
                    }
                  >
                    {[
                      'Sunday',
                      'Monday',
                      'Tuesday',
                      'Wednesday',
                      'Thursday',
                      'Friday',
                      'Saturday',
                    ].map((day, index) => (
                      <option key={day} value={index}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {form.frequency === 'monthly' && (
                <label className="text-sm font-medium text-slate-700">
                  Day of month
                  <input
                    className={`${inputClass} mt-1.5`}
                    type="number"
                    min={1}
                    max={28}
                    value={form.dayOfMonth}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        dayOfMonth: Number(event.target.value),
                      }))
                    }
                  />
                </label>
              )}
              <label className="text-sm font-medium text-slate-700">
                Backups to retain
                <input
                  className={`${inputClass} mt-1.5`}
                  type="number"
                  min={1}
                  max={30}
                  value={form.retentionCount}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      retentionCount: Number(event.target.value),
                    }))
                  }
                />
              </label>
            </div>
            <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Automatic encrypted backups</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Run this schedule without requiring an administrator to remain signed in.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.enabled}
                onClick={() => setDraft((current) => ({ ...current, enabled: !form.enabled }))}
                className={`relative h-7 w-12 shrink-0 rounded-full transition focus:outline-none focus:ring-4 focus:ring-primary/15 ${
                  form.enabled ? 'bg-primary' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute left-1 top-1 size-5 rounded-full bg-white transition-transform ${
                    form.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <CustomButton onClick={save} loading={isLoading}>
                Save schedule
              </CustomButton>
              <CustomButton
                variant="secondary"
                onClick={runNow}
                loading={isLoading}
                disabled={Boolean(overview.activeJob)}
              >
                {overview.activeJob ? 'Backup running' : 'Backup now'}
              </CustomButton>
              <CustomButton variant="cancel" onClick={disconnect} startIcon={<Unplug size={16} />}>
                Disconnect
              </CustomButton>
            </div>
          </div>
        </>
      )}

      <div className="rounded-3xl border border-slate-200/70 bg-white p-5  sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Backup history</h3>
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs font-semibold text-primary"
            onClick={() => void query.mutate()}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {overview.jobs.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 px-4 py-10 text-center">
              <HardDrive className="mx-auto size-6 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-500">
                No backups have been created yet.
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Run the first backup after connecting and saving a schedule.
              </p>
            </div>
          ) : (
            overview.jobs.map((job) => (
              <div
                key={job._id}
                className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {job.driveFileName || job.backupNumber}
                  </p>
                  <p className="text-xs text-slate-500">
                    {job.trigger} · {new Date(job.createdAt).toLocaleString('en-IN')}
                    {job.byteSize ? ` · ${(job.byteSize / 1_048_576).toFixed(1)} MB` : ''}
                  </p>
                  {job.status === 'running' && (
                    <div className="mt-2 max-w-md">
                      <progress
                        value={job.progress}
                        max={100}
                        className="h-1.5 w-full overflow-hidden rounded-full accent-primary"
                        aria-label={`Backup progress ${job.progress}%`}
                      />
                      <p className="mt-1 text-xs text-primary">
                        {job.progress}% · {job.progressMessage}
                      </p>
                    </div>
                  )}
                  {job.error && (
                    <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2">
                      <p className="text-xs font-semibold text-rose-700">Backup did not complete</p>
                      <p className="mt-0.5 text-xs text-rose-700">{job.error}</p>
                    </div>
                  )}
                </div>
                <span
                  className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                    job.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-700'
                      : job.status === 'failed'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {job.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

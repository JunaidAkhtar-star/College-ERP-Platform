'use client';

import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Action, Column } from '@/shared/core/CustomTable';
import AsyncSelect from '@/shared/core/AsyncSelect';
import WorkflowActionDialog, { IWorkflowStatusOption } from '@/shared/core/WorkflowActionDialog';
import Empty from '@/shared/core/Empty';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { downloadPdfBlob, fetchProtectedBlob } from '@/shared/utils';
import { CircleAlert, Database, Download, PackageOpen, RotateCw, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useHasAnyRole } from '@/shared/hooks/useHasRole';
import { useAuthStore } from '@/shared/store/authStore';

interface IDataset {
  key: string;
  label: string;
  description: string;
  fields: string[];
}
interface IJob extends Record<string, unknown> {
  _id: string;
  exportNumber: string;
  datasets: string[];
  format: 'json' | 'ndjson';
  counts: Record<string, number>;
  status: string;
  expiresAt: string;
  downloadedAt?: string;
  downloadCount: number;
  purpose?: string;
  legalBasis?: string;
  redactionProfile?: 'standard' | 'deidentified';
  createdAt: string;
  requestedBy?: string;
}
interface IApiResponse<T> {
  success: boolean;
  data: T;
}
interface IDsar extends Record<string, unknown> {
  _id: string;
  requestNumber: string;
  subjectUserId: { _id: string; name?: string; email?: string } | string;
  requestType: string;
  status: string;
  dueAt: string;
  requestedBy?: string;
}
interface ILegalHold extends Record<string, unknown> {
  _id: string;
  holdNumber: string;
  name: string;
  datasets: string[];
  reason: string;
  status: 'active' | 'released';
  effectiveAt: string;
  createdBy?: string;
}
interface IActionDialog {
  title: string;
  description: string;
  confirmLabel: string;
  showReason?: boolean;
  statusOptions?: IWorkflowStatusOption[];
  resolutionStatuses?: string[];
  onConfirm: (values: { status?: string; reason: string; resolution?: string }) => Promise<void>;
}
const inputClass =
  'rounded-xl bg-slate-100 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20';

export default function DataPortabilityPage() {
  const {
    data: metadataRaw,
    error: metadataError,
    mutate: refreshMetadata,
  } = useSwr<IApiResponse<IDataset[]>>('data-portability/metadata');
  const {
    data: jobsRaw,
    mutate: refresh,
    error: jobsError,
    isLoading: jobsLoading,
  } = useSwr<IApiResponse<IJob[]>>('data-portability', { refreshInterval: 4000 });
  const {
    data: dsarsRaw,
    error: dsarsError,
    mutate: refreshDsars,
  } = useSwr<IApiResponse<IDsar[]>>('data-portability/dsars');
  const {
    data: holdsRaw,
    error: holdsError,
    mutate: refreshHolds,
  } = useSwr<IApiResponse<ILegalHold[]>>('data-portability/legal-holds');
  const { data: summaryRaw, error: summaryError } = useSwr<
    IApiResponse<{
      pendingExports: number;
      overdueDsars: number;
      activeHolds: number;
      readyExports: number;
    }>
  >('data-portability/compliance-summary');
  const { mutation, isLoading } = useMutation();
  const canApprove = useHasAnyRole(['super_admin', 'principal']);
  const userId = useAuthStore((state) => state.user?._id ?? '');
  const datasets = useMemo(() => metadataRaw?.data ?? [], [metadataRaw]);
  const jobs = useMemo(() => jobsRaw?.data ?? [], [jobsRaw]);
  const dsars = useMemo(() => dsarsRaw?.data ?? [], [dsarsRaw]);
  const holds = useMemo(() => holdsRaw?.data ?? [], [holdsRaw]);
  const [selected, setSelected] = useState<string[]>([]);
  const [format, setFormat] = useState<'json' | 'ndjson'>('json');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [purpose, setPurpose] = useState('');
  const [legalBasis, setLegalBasis] = useState('legal_obligation');
  const [redactionProfile, setRedactionProfile] = useState<'standard' | 'deidentified'>(
    'deidentified',
  );
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [subjectUserId, setSubjectUserId] = useState('');
  const [requestType, setRequestType] = useState('access');
  const [dsarDetails, setDsarDetails] = useState('');
  const [holdName, setHoldName] = useState('');
  const [holdReason, setHoldReason] = useState('');
  const [holdDatasets, setHoldDatasets] = useState<string[]>([]);
  const [actionDialog, setActionDialog] = useState<IActionDialog | null>(null);
  const refreshWorkspace = async () => {
    await Promise.all([refreshMetadata(), refresh(), refreshDsars(), refreshHolds()]);
  };
  const create = async () => {
    if (!selected.length) {
      toast.error('Select at least one dataset');
      return;
    }
    if (purpose.trim().length < 10) {
      toast.error('State a specific export purpose (minimum 10 characters)');
      return;
    }
    const response = await mutation('data-portability', {
      method: 'POST',
      body: {
        datasets: selected,
        format,
        filters: {
          from: from || undefined,
          to: to || undefined,
          academicYear: academicYear || undefined,
        },
        purpose,
        legalBasis,
        redactionProfile,
      },
    });
    if (!response?.results?.success) return;
    toast.success(
      'Export request recorded; sensitive or bulk packages require independent approval',
    );
    await refresh();
  };
  const decide = async (job: IJob, action: 'approve' | 'reject') => {
    setActionDialog({
      title: `${action === 'approve' ? 'Approve' : 'Reject'} export ${job.exportNumber}`,
      description: 'This decision is recorded in the export governance audit trail.',
      confirmLabel: action === 'approve' ? 'Approve export' : 'Reject export',
      onConfirm: async ({ reason }) => {
        const response = await mutation(`data-portability/${job._id}/decide`, {
          method: 'PATCH',
          body: { action, reason },
        });
        if (!response?.results?.success) return;
        toast.success(`Export ${action}d`);
        setActionDialog(null);
        await refresh();
      },
    });
  };
  const cancel = async (job: IJob) => {
    setActionDialog({
      title: `Cancel export ${job.exportNumber}`,
      description: 'Explain why the package is cancelled and confirm its deletion state.',
      confirmLabel: 'Cancel export',
      onConfirm: async ({ reason }) => {
        const response = await mutation(`data-portability/${job._id}/cancel`, {
          method: 'POST',
          body: { reason },
        });
        if (!response?.results?.success) return;
        toast.success('Export cancelled and deletion state verified');
        setActionDialog(null);
        await refresh();
      },
    });
  };
  const createDsar = async () => {
    if (!subjectUserId || dsarDetails.trim().length < 10) {
      toast.error('Select the person and enter meaningful request details');
      return;
    }
    const response = await mutation('data-portability/dsars', {
      method: 'POST',
      body: { subjectUserId, requestType, details: dsarDetails },
    });
    if (!response) return;
    toast.success('Data-subject request registered');
    setSubjectUserId('');
    setDsarDetails('');
    await refreshDsars();
  };
  const transitionDsar = async (row: IDsar) => {
    setActionDialog({
      title: `Update ${row.requestNumber}`,
      description:
        'Select the governed workflow stage. A resolution is required for a terminal decision.',
      confirmLabel: 'Update request',
      showReason: false,
      statusOptions: [
        { value: 'identity_verified', label: 'Identity verified' },
        { value: 'under_review', label: 'Under review' },
        { value: 'fulfilled', label: 'Fulfilled' },
        { value: 'rejected', label: 'Rejected' },
      ],
      resolutionStatuses: ['fulfilled', 'rejected'],
      onConfirm: async ({ status, resolution }) => {
        const response = await mutation(`data-portability/dsars/${row._id}/status`, {
          method: 'PATCH',
          body: { status, resolution },
        });
        if (!response?.results?.success) return;
        toast.success('DSAR workflow updated');
        setActionDialog(null);
        await refreshDsars();
      },
    });
  };
  const createHold = async () => {
    if (holdName.trim().length < 3 || holdReason.trim().length < 10 || !holdDatasets.length) {
      toast.error('Complete the hold name, reason and affected datasets');
      return;
    }
    const response = await mutation('data-portability/legal-holds', {
      method: 'POST',
      body: { name: holdName, reason: holdReason, datasets: holdDatasets },
    });
    if (!response) return;
    toast.success('Legal hold activated');
    setHoldName('');
    setHoldReason('');
    setHoldDatasets([]);
    await refreshHolds();
  };
  const releaseHold = async (row: ILegalHold) => {
    setActionDialog({
      title: `Release ${row.holdNumber}`,
      description: 'Record the releasing authority and preservation-release reason.',
      confirmLabel: 'Release legal hold',
      onConfirm: async ({ reason }) => {
        const response = await mutation(`data-portability/legal-holds/${row._id}/release`, {
          method: 'PATCH',
          body: { reason },
        });
        if (!response?.results?.success) return;
        toast.success('Legal hold released');
        setActionDialog(null);
        await refreshHolds();
      },
    });
  };
  const download = async (job: IJob) => {
    setDownloadingId(job._id);
    try {
      const blob = await fetchProtectedBlob(`data-portability/${job._id}/download`);
      if (!blob) {
        toast.error('Export download failed or expired');
        return;
      }
      downloadPdfBlob(blob, `${job.exportNumber}.${job.format}`);
      toast.success('Export downloaded');
      await refresh();
    } finally {
      setDownloadingId(null);
    }
  };
  const columns: Column<IJob>[] = [
    { field: 'exportNumber', title: 'Export #' },
    { field: 'datasets', title: 'Datasets', render: (row) => row.datasets.join(', ') },
    {
      field: 'counts',
      title: 'Rows',
      render: (row) =>
        Object.values(row.counts)
          .reduce((sum, count) => sum + count, 0)
          .toLocaleString('en-IN'),
    },
    { field: 'format', title: 'Format', render: (row) => row.format.toUpperCase() },
    {
      field: 'purpose',
      title: 'Governance',
      render: (row) => (
        <div>
          <p className="line-clamp-1 text-xs font-semibold">
            {row.purpose ?? 'Legacy authorized export'}
          </p>
          <p className="text-[11px] text-slate-600">
            {(row.legalBasis ?? 'legacy_authorized').replaceAll('_', ' ')} ·{' '}
            {row.redactionProfile ?? 'standard'}
          </p>
        </div>
      ),
    },
    {
      field: 'status',
      title: 'Status',
      render: (row) => (
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
            row.status === 'ready'
              ? 'bg-emerald-50 text-emerald-700'
              : row.status === 'pending_approval'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-slate-100 text-slate-600'
          }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      field: 'expiresAt',
      title: 'Available until',
      render: (row) => new Date(row.expiresAt).toLocaleString('en-IN'),
    },
  ];
  const actions: Action<IJob>[] = [
    {
      icon: <Download size={15} />,
      tooltip: 'Download secure export',
      onClick: download,
      hidden: (row) =>
        row.status !== 'ready' ||
        downloadingId === row._id ||
        new Date(row.expiresAt) <= new Date(),
    },
    {
      icon: <ShieldCheck size={15} />,
      tooltip: 'Approve secure export',
      onClick: (row) => decide(row, 'approve'),
      hidden: (row) =>
        !canApprove || row.status !== 'pending_approval' || row.requestedBy === userId,
    },
    {
      icon: <span className="text-xs font-bold text-rose-600">×</span>,
      tooltip: 'Reject secure export',
      onClick: (row) => decide(row, 'reject'),
      hidden: (row) =>
        !canApprove || row.status !== 'pending_approval' || row.requestedBy === userId,
    },
    {
      icon: <span className="text-xs font-bold text-slate-500">⊘</span>,
      tooltip: 'Cancel and verify deletion',
      onClick: cancel,
      hidden: (row) => ['cancelled', 'expired'].includes(row.status),
    },
  ];
  const dsarColumns: Column<IDsar>[] = [
    { field: 'requestNumber', title: 'Request' },
    {
      field: 'subjectUserId',
      title: 'Data subject',
      render: (row) =>
        typeof row.subjectUserId === 'string'
          ? 'Selected person'
          : (row.subjectUserId.name ?? row.subjectUserId.email ?? 'Selected person'),
    },
    { field: 'requestType', title: 'Right', render: (row) => row.requestType.replaceAll('_', ' ') },
    { field: 'status', title: 'Status', render: (row) => row.status.replaceAll('_', ' ') },
    {
      field: 'dueAt',
      title: 'Due',
      render: (row) => new Date(row.dueAt).toLocaleDateString('en-IN'),
    },
  ];
  const dsarActions: Action<IDsar>[] = [
    {
      icon: <ShieldCheck size={15} />,
      tooltip: 'Advance governed workflow',
      onClick: transitionDsar,
      hidden: (row) =>
        !canApprove || ['fulfilled', 'rejected'].includes(row.status) || row.requestedBy === userId,
    },
  ];
  const holdColumns: Column<ILegalHold>[] = [
    { field: 'holdNumber', title: 'Hold' },
    { field: 'name', title: 'Matter' },
    { field: 'datasets', title: 'Preserved datasets', render: (row) => row.datasets.join(', ') },
    { field: 'status', title: 'Status' },
    {
      field: 'effectiveAt',
      title: 'Effective',
      render: (row) => new Date(row.effectiveAt).toLocaleDateString('en-IN'),
    },
  ];
  const holdActions: Action<ILegalHold>[] = [
    {
      icon: <span className="text-xs font-bold">↗</span>,
      tooltip: 'Release legal hold',
      onClick: releaseHold,
      hidden: (row) => !canApprove || row.status !== 'active' || row.createdBy === userId,
    },
  ];
  return (
    <div className="space-y-6 pb-8">
      <header>
        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
          <ShieldCheck className="h-4 w-4" /> Governed data export
        </p>
        <h1 className="text-3xl font-black text-slate-950">Data Portability</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Create time-limited, audit-tracked institution data packages without exposing credentials
          or integration secrets.
        </p>
      </header>
      {(metadataError || jobsError) && (
        <section className="flex flex-col gap-4 rounded-3xl bg-rose-50 p-5 text-rose-700 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h2 className="font-bold">Data Portability could not load securely</h2>
              <p className="mt-1 text-sm text-rose-600">
                No request was changed. Check the connection and load the workspace again.
              </p>
            </div>
          </div>
          <CustomButton
            variant="secondary"
            onClick={() => void refreshWorkspace()}
            startIcon={<RotateCw className="h-4 w-4" />}
          >
            Try again
          </CustomButton>
        </section>
      )}
      {(dsarsError || holdsError || summaryError) && (
        <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          One or more privacy-governance registers could not be loaded. Missing totals and records
          are not estimated.
        </div>
      )}
      <section className="rounded-3xl bg-white p-5">
        <div className="grid gap-3 md:grid-cols-4">
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className={inputClass}
          />
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className={inputClass}
          />
          <AsyncSelect
            type="academicYears"
            value={academicYear}
            onChange={(value) => setAcademicYear(value ?? '')}
            placeholder="All academic years"
          />
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value as 'json' | 'ndjson')}
            className={inputClass}
          >
            <option value="json">Structured JSON</option>
            <option value="ndjson">Streaming NDJSON</option>
          </select>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
            placeholder="Specific purpose / authorized use"
            className={inputClass}
          />
          <select
            value={legalBasis}
            onChange={(event) => setLegalBasis(event.target.value)}
            className={inputClass}
          >
            <option value="legal_obligation">Legal obligation</option>
            <option value="contract">Contract</option>
            <option value="consent">Consent</option>
            <option value="legitimate_interest">Legitimate interest</option>
          </select>
          <select
            value={redactionProfile}
            onChange={(event) =>
              setRedactionProfile(event.target.value as 'standard' | 'deidentified')
            }
            className={inputClass}
          >
            <option value="deidentified">De-identified fields</option>
            <option value="standard">Authorized direct identifiers</option>
          </select>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {datasets.map((dataset) => {
            const active = selected.includes(dataset.key);
            return (
              <button
                key={dataset.key}
                onClick={() =>
                  setSelected((current) =>
                    active
                      ? current.filter((key) => key !== dataset.key)
                      : [...current, dataset.key],
                  )
                }
                className={`rounded-2xl p-4 text-left transition-colors ${active ? 'bg-primary text-white' : 'bg-slate-50 text-slate-700 hover:bg-blue-50'}`}
              >
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  <span className="font-bold">{dataset.label}</span>
                </div>
                <p
                  className={`mt-2 text-xs leading-5 ${active ? 'text-white/75' : 'text-slate-500'}`}
                >
                  {dataset.description}
                </p>
                <p className={`mt-2 text-[11px] ${active ? 'text-white/60' : 'text-slate-600'}`}>
                  {dataset.fields.length} governed fields
                </p>
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-600">
            Maximum 250,000 rows per package · download expires after 24 hours
          </p>
          <CustomButton
            variant="primary"
            onClick={create}
            loading={isLoading}
            startIcon={<PackageOpen className="h-4 w-4" />}
          >
            Prepare export
          </CustomButton>
        </div>
      </section>
      <section className="rounded-2xl bg-white p-4">
        {jobsLoading ? (
          <div className="h-48 animate-pulse rounded-2xl bg-slate-50" />
        ) : jobs.length ? (
          <CustomTable<IJob> columns={columns} data={jobs} actions={actions} />
        ) : (
          <Empty
            title="No secure export requests yet"
            subTitle="Select the required datasets, explain the authorized purpose, and prepare the first governed package."
          />
        )}
      </section>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Pending export approvals', summaryRaw?.data?.pendingExports ?? '—'],
          ['Ready secure exports', summaryRaw?.data?.readyExports ?? '—'],
          ['Overdue DSARs', summaryRaw?.data?.overdueDsars ?? '—'],
          ['Active legal holds', summaryRaw?.data?.activeHolds ?? '—'],
        ].map(([label, value], index) => (
          <div
            key={String(label)}
            className={`rounded-2xl border p-4 ${
              index === 2
                ? 'border-rose-100 bg-rose-50'
                : index === 3
                  ? 'border-violet-100 bg-violet-50'
                  : 'border-blue-100 bg-blue-50'
            }`}
          >
            <p className="text-2xl font-black text-slate-950">{value}</p>
            <p className="mt-1 text-xs font-medium text-slate-600">{label}</p>
          </div>
        ))}
      </section>
      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl bg-white p-5">
          <h2 className="font-bold text-slate-900">Data-subject requests</h2>
          <p className="mt-1 text-xs text-slate-500">
            Identity verification and fulfilment follow a controlled, due-dated workflow.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <AsyncSelect
              type="users"
              label="Person"
              value={subjectUserId}
              onChange={(value) => setSubjectUserId(value ?? '')}
              placeholder="Search by name or email"
              required
            />
            <label className="space-y-1.5 text-xs font-semibold text-slate-700">
              <span>Request right</span>
              <select
                value={requestType}
                onChange={(event) => setRequestType(event.target.value)}
                className={`w-full ${inputClass}`}
              >
                <option value="access">Access</option>
                <option value="rectification">Rectification</option>
                <option value="erasure">Erasure</option>
                <option value="restriction">Restriction</option>
                <option value="portability">Portability</option>
              </select>
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-700">
              <span>Request details</span>
              <textarea
                rows={2}
                value={dsarDetails}
                onChange={(event) => setDsarDetails(event.target.value)}
                placeholder="Describe what the person requested"
                className={`w-full resize-none ${inputClass}`}
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <CustomButton variant="primary" onClick={createDsar} loading={isLoading}>
              Register DSAR
            </CustomButton>
          </div>
          <div className="mt-4">
            <CustomTable data={dsars} columns={dsarColumns} actions={dsarActions} />
          </div>
        </div>
        <div className="rounded-2xl bg-white p-5">
          <h2 className="font-bold text-slate-900">Legal holds</h2>
          <p className="mt-1 text-xs text-slate-500">
            Active holds prevent governed export deletion for affected datasets.
          </p>
          {canApprove && (
            <>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <input
                  value={holdName}
                  onChange={(event) => setHoldName(event.target.value)}
                  placeholder="Matter / hold name"
                  className={inputClass}
                />
                <input
                  value={holdReason}
                  onChange={(event) => setHoldReason(event.target.value)}
                  placeholder="Preservation reason"
                  className={inputClass}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {datasets.map((dataset) => (
                  <label
                    key={dataset.key}
                    className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={holdDatasets.includes(dataset.key)}
                      onChange={() =>
                        setHoldDatasets((current) =>
                          current.includes(dataset.key)
                            ? current.filter((key) => key !== dataset.key)
                            : [...current, dataset.key],
                        )
                      }
                    />
                    {dataset.label}
                  </label>
                ))}
              </div>
              <div className="mt-3 flex justify-end">
                <CustomButton variant="primary" onClick={createHold} loading={isLoading}>
                  Activate hold
                </CustomButton>
              </div>
            </>
          )}
          <div className="mt-4">
            <CustomTable data={holds} columns={holdColumns} actions={holdActions} />
          </div>
        </div>
      </section>
      <WorkflowActionDialog
        open={Boolean(actionDialog)}
        title={actionDialog?.title ?? ''}
        description={actionDialog?.description}
        confirmLabel={actionDialog?.confirmLabel ?? 'Confirm'}
        showReason={actionDialog?.showReason}
        statusOptions={actionDialog?.statusOptions}
        resolutionStatuses={actionDialog?.resolutionStatuses}
        loading={isLoading}
        onClose={() => setActionDialog(null)}
        onConfirm={async (values) => actionDialog?.onConfirm(values)}
      />
    </div>
  );
}

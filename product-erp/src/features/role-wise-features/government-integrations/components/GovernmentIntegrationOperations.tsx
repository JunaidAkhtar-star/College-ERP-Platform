'use client';

import CustomTable, { type Column } from '@/shared/core/CustomTable';
import Empty from '@/shared/core/Empty';
import useSwr from '@/shared/hooks/useSwr';
import useMutation from '@/shared/hooks/useMutation';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { useAuthStore } from '@/shared/store/authStore';
import { motion } from '@/shared/utils/motion';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  ListChecks,
  Plus,
  Send,
  Settings2,
  ShieldAlert,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

type TProvider = 'digilocker' | 'nad' | 'abc' | 'aishe' | 'nirf';
type TOperationView = 'readiness' | 'records' | 'submissions' | 'connection';

interface IProviderOption {
  provider: TProvider;
  shortName: string;
  name: string;
  description: string;
  capabilities: string[];
  cycleBased: boolean;
  requiredEvidence: Array<{ type: string; label: string }>;
}

interface IOperationalRow {
  [key: string]: unknown;
  reference: string;
  name: string;
  category: string;
  status: 'ready' | 'warning' | 'blocked';
  primaryValue: string;
  secondaryValue: string;
  issues: string[];
}

interface IOperationalData {
  provider: TProvider;
  academicYear: string;
  generatedAt: string;
  source: 'live_erp';
  summary: { total: number; ready: number; warnings: number; blocked: number; readiness: number };
  sections: Array<{
    key: string;
    label: string;
    value: number;
    ready: number;
    description: string;
  }>;
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    entityType: string;
    reference?: string;
  }>;
  rows: IOperationalRow[];
  exportFields: string[];
}

interface IProps {
  providers: IProviderOption[];
}

interface ISubmissionBatch {
  [key: string]: unknown;
  _id: string;
  batchNumber: string;
  provider: TProvider;
  academicYear: string;
  status:
    | 'draft'
    | 'in_review'
    | 'approved'
    | 'exported'
    | 'submitted'
    | 'partially_accepted'
    | 'accepted'
    | 'rejected';
  excludedRecords: number;
  recordCount: number;
  acceptedRecords: number;
  rejectedRecords: number;
  acknowledgementReference?: string;
  sourceGeneratedAt: string;
  createdAt: string;
  history: Array<{
    action: string;
    fromStatus?: string;
    toStatus?: string;
    note?: string;
    at: string;
  }>;
}

interface IConnectionProfile {
  provider: TProvider;
  mode: 'portal_export' | 'api';
  enabled: boolean;
  apiBaseUrl?: string;
  clientId?: string;
  hasCredential: boolean;
  status: 'not_configured' | 'credential_required' | 'configured' | 'verified' | 'failed';
  adapterAvailable: boolean;
  lastTestedAt?: string;
  lastTestSucceeded?: boolean;
  message?: string;
}

const currentAcademicYear = () => {
  const now = new Date();
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
};

export default function GovernmentIntegrationOperations({ providers }: IProps) {
  const canCreate = useHasPermission('regulatory_integration', 'create');
  const canEdit = useHasPermission('regulatory_integration', 'edit');
  const canApprove = useHasPermission('regulatory_integration', 'approve');
  const activeRole = useAuthStore(
    (state) => state.activeRole?.baseRole ?? state.activeRole?.name ?? state.role,
  );
  const canManageConnection =
    canEdit && ['super_admin', 'admin'].includes(activeRole?.toLowerCase() ?? '');
  const { mutation, isLoading: mutating } = useMutation();
  const [provider, setProvider] = useState<TProvider>(providers[0]?.provider ?? 'abc');
  const [academicYear, setAcademicYear] = useState(currentAcademicYear);
  const [view, setView] = useState<TOperationView>('readiness');
  const [showReadyRecords, setShowReadyRecords] = useState(false);
  const [showBatchHistory, setShowBatchHistory] = useState(false);
  const [connectionDraft, setConnectionDraft] = useState<{
    mode: 'portal_export' | 'api';
    enabled: boolean;
    apiBaseUrl: string;
    clientId: string;
    credential: string;
  } | null>(null);
  const { data, error, isLoading, isValidating, mutate } = useSwr<{
    success: boolean;
    data: IOperationalData;
  }>(
    `regulatory-integration/${provider}/operations?academicYear=${encodeURIComponent(academicYear)}`,
  );
  const operations = data?.data;
  const { data: connectionData, mutate: mutateConnections } = useSwr<{
    success: boolean;
    data: IConnectionProfile[];
  }>('regulatory-integration/connections');
  const connection = connectionData?.data.find((item) => item.provider === provider);
  const selectedProvider = providers.find((item) => item.provider === provider);
  const connectionForm = connectionDraft ?? {
    mode: connection?.mode ?? ('portal_export' as const),
    enabled: connection?.enabled ?? true,
    apiBaseUrl: connection?.apiBaseUrl ?? '',
    clientId: connection?.clientId ?? '',
    credential: '',
  };
  const visibleRecords = useMemo(
    () =>
      showReadyRecords
        ? (operations?.rows ?? [])
        : (operations?.rows ?? []).filter((row) => row.status !== 'ready'),
    [operations?.rows, showReadyRecords],
  );
  const {
    data: batchData,
    isLoading: batchesLoading,
    isValidating: batchesValidating,
    mutate: mutateBatches,
  } = useSwr<{ success: boolean; data: ISubmissionBatch[] }>(
    `regulatory-integration/submissions?provider=${provider}&academicYear=${encodeURIComponent(academicYear)}`,
  );
  const activeBatches = useMemo(
    () =>
      (batchData?.data ?? []).filter((batch) => !['accepted', 'rejected'].includes(batch.status)),
    [batchData?.data],
  );
  const completedBatchCount = (batchData?.data?.length ?? 0) - activeBatches.length;
  const visibleBatches = showBatchHistory ? (batchData?.data ?? []) : activeBatches;
  const columns = useMemo<Column<IOperationalRow>[]>(
    () => [
      {
        field: 'name',
        title: 'Record',
        minWidth: '220px',
        render: (row) => (
          <div>
            <p className="font-bold text-slate-900">{row.name}</p>
            <p className="mt-0.5 text-xs text-slate-500">{row.reference}</p>
          </div>
        ),
      },
      { field: 'category', title: 'Reporting category', minWidth: '190px' },
      {
        field: 'primaryValue',
        title: 'ERP value',
        minWidth: '150px',
        cellClassName: 'text-center',
        headerClassName: 'text-center',
        render: (row) => (
          <div className="text-center">
            <p className="font-bold text-slate-800">{row.primaryValue}</p>
            <p className="mt-0.5 text-xs text-slate-500">{row.secondaryValue}</p>
          </div>
        ),
      },
      {
        field: 'status',
        title: 'Validation',
        minWidth: '130px',
        cellClassName: 'text-center',
        headerClassName: 'text-center',
        render: (row) => (
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${
              row.status === 'ready'
                ? 'bg-emerald-50 text-emerald-700'
                : row.status === 'blocked'
                  ? 'bg-red-50 text-red-700'
                  : 'bg-amber-50 text-amber-700'
            }`}
          >
            {row.status}
          </span>
        ),
      },
      {
        field: 'issues',
        title: 'Required action',
        minWidth: '260px',
        render: (row) =>
          row.issues.length ? (
            <ul className="space-y-1 text-xs text-slate-600">
              {row.issues.map((issue) => (
                <li key={issue}>• {issue}</li>
              ))}
            </ul>
          ) : (
            <span className="text-xs font-semibold text-emerald-700">No validation issues</span>
          ),
      },
    ],
    [],
  );

  const refreshWorkspace = async () => {
    await Promise.all([mutate(), mutateBatches(), mutateConnections()]);
  };

  const saveConnection = async () => {
    const response = await mutation(`regulatory-integration/${provider}/connection`, {
      method: 'PUT',
      body: connectionForm,
    });
    if (!response?.results?.success) return;
    toast.success('Connection profile saved securely');
    setConnectionDraft(null);
    await mutateConnections();
  };

  const testConnection = async () => {
    const response = await mutation(`regulatory-integration/${provider}/connection/test`, {
      method: 'POST',
    });
    if (!response?.results?.success) return;
    toast.info(response.results.message);
    await mutateConnections();
  };

  const createBatch = async () => {
    const response = await mutation(`regulatory-integration/${provider}/submissions`, {
      method: 'POST',
      body: { academicYear },
    });
    if (!response?.results?.success) return;
    toast.success('Validated records frozen into a governed submission batch');
    await mutateBatches();
  };

  const askForNote = async (title: string, label: string) => {
    const result = await Swal.fire({
      title,
      input: 'textarea',
      inputLabel: label,
      inputPlaceholder: 'Record the basis for this controlled action…',
      inputValidator: (value) => (value.trim().length < 3 ? 'Enter at least 3 characters' : null),
      showCancelButton: true,
      confirmButtonText: 'Continue',
    });
    return result.isConfirmed ? String(result.value).trim() : null;
  };

  const requestReview = async (batch: ISubmissionBatch) => {
    const note = await askForNote('Send batch for review?', 'Preparation note');
    if (!note) return;
    const response = await mutation(
      `regulatory-integration/submissions/${batch._id}/request-review`,
      { method: 'POST', body: { note } },
    );
    if (!response?.results?.success) return;
    toast.success('Batch sent for independent review');
    await mutateBatches();
  };

  const decideBatch = async (batch: ISubmissionBatch, decision: 'approved' | 'rejected') => {
    const note = await askForNote(
      decision === 'approved' ? 'Approve this submission batch?' : 'Reject this submission batch?',
      'Independent review note',
    );
    if (!note) return;
    const response = await mutation(`regulatory-integration/submissions/${batch._id}/decision`, {
      method: 'POST',
      body: { decision, note },
    });
    if (!response?.results?.success) return;
    toast.success(`Batch ${decision}`);
    await mutateBatches();
  };

  const exportBatch = async (batch: ISubmissionBatch) => {
    const response = await mutation(`regulatory-integration/submissions/${batch._id}/exported`, {
      method: 'POST',
    });
    const exported = response?.results?.data as { filename?: string; content?: string } | undefined;
    if (!response?.results?.success || !exported?.content || !exported.filename) return;
    const url = URL.createObjectURL(
      new Blob([exported.content], { type: 'text/csv;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = exported.filename;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success('Governed CSV export generated and recorded');
    await mutateBatches();
  };

  const markSubmitted = async (batch: ISubmissionBatch) => {
    const result = await Swal.fire({
      title: 'Record portal submission',
      input: 'text',
      inputLabel: 'Official acknowledgement or submission reference',
      inputValidator: (value) => (value.trim().length < 2 ? 'Acknowledgement is required' : null),
      showCancelButton: true,
      confirmButtonText: 'Record submission',
    });
    if (!result.isConfirmed) return;
    const response = await mutation(`regulatory-integration/submissions/${batch._id}/submitted`, {
      method: 'POST',
      body: { acknowledgementReference: String(result.value).trim() },
    });
    if (!response?.results?.success) return;
    toast.success('Government portal submission recorded');
    await mutateBatches();
  };

  const reconcileBatch = async (batch: ISubmissionBatch) => {
    const result = await Swal.fire({
      title: 'Reconcile provider response',
      html: '<p class="text-sm text-slate-600">Record accepted and rejected counts from the official acknowledgement.</p>',
      input: 'text',
      inputLabel: 'Accepted, rejected (example: 95, 5)',
      inputPlaceholder: '0, 0',
      inputValidator: (value) => {
        const parts = value.split(',').map((part) => Number(part.trim()));
        return parts.length !== 2 || parts.some((part) => !Number.isInteger(part) || part < 0)
          ? 'Enter two non-negative whole numbers separated by a comma'
          : null;
      },
      showCancelButton: true,
      confirmButtonText: 'Continue',
    });
    if (!result.isConfirmed) return;
    const [acceptedRecords, rejectedRecords] = String(result.value)
      .split(',')
      .map((part) => Number(part.trim()));
    const note = await askForNote('Confirm reconciliation', 'Provider response note');
    if (!note) return;
    const response = await mutation(`regulatory-integration/submissions/${batch._id}/reconcile`, {
      method: 'POST',
      body: { acceptedRecords, rejectedRecords, note },
    });
    if (!response?.results?.success) return;
    toast.success('Submission response reconciled');
    await mutateBatches();
  };

  const batchColumns: Column<ISubmissionBatch>[] = [
    {
      field: 'batchNumber',
      title: 'Submission batch',
      minWidth: '210px',
      render: (batch) => (
        <div>
          <p className="font-bold text-slate-900">{batch.batchNumber}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Snapshot {new Date(batch.sourceGeneratedAt).toLocaleString('en-IN')}
          </p>
        </div>
      ),
    },
    {
      field: 'academicYear',
      title: 'Academic year',
      minWidth: '120px',
      headerClassName: 'text-center',
      cellClassName: 'text-center',
    },
    {
      field: 'status',
      title: 'Lifecycle',
      minWidth: '140px',
      headerClassName: 'text-center',
      cellClassName: 'text-center',
      render: (batch) => (
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold capitalize text-blue-700">
          {batch.status.replaceAll('_', ' ')}
        </span>
      ),
    },
    {
      field: 'excludedRecords',
      title: 'Validation outcome',
      minWidth: '150px',
      headerClassName: 'text-center',
      cellClassName: 'text-center',
      render: (batch) => (
        <span className="text-xs font-semibold text-slate-600">
          {batch.recordCount} ready · {batch.excludedRecords} excluded
        </span>
      ),
    },
    {
      field: 'acknowledgementReference',
      title: 'Acknowledgement',
      minWidth: '180px',
      render: (batch) => (
        <span className="text-xs font-semibold text-slate-600">
          {batch.acknowledgementReference ?? 'Not submitted'}
        </span>
      ),
    },
    {
      field: '_id',
      title: 'Next action',
      minWidth: '260px',
      render: (batch) => (
        <div className="flex flex-wrap gap-2">
          {canEdit && batch.status === 'draft' && (
            <button
              type="button"
              disabled={mutating}
              onClick={() => void requestReview(batch)}
              className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700"
            >
              Request review
            </button>
          )}
          {canApprove && batch.status === 'in_review' && (
            <>
              <button
                type="button"
                disabled={mutating}
                onClick={() => void decideBatch(batch, 'approved')}
                className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={mutating}
                onClick={() => void decideBatch(batch, 'rejected')}
                className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700"
              >
                Reject
              </button>
            </>
          )}
          {canEdit && (batch.status === 'approved' || batch.status === 'exported') && (
            <button
              type="button"
              disabled={mutating}
              onClick={() => void exportBatch(batch)}
              className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-bold text-violet-700"
            >
              <Download size={13} /> Export
            </button>
          )}
          {canEdit && batch.status === 'exported' && (
            <button
              type="button"
              disabled={mutating}
              onClick={() => void markSubmitted(batch)}
              className="rounded-lg bg-cyan-50 px-2.5 py-1.5 text-xs font-bold text-cyan-700"
            >
              Record submission
            </button>
          )}
          {canEdit && (batch.status === 'submitted' || batch.status === 'partially_accepted') && (
            <button
              type="button"
              disabled={mutating}
              onClick={() => void reconcileBatch(batch)}
              className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-700"
            >
              Reconcile
            </button>
          )}
          {['accepted', 'rejected'].includes(batch.status) && (
            <span className="text-xs font-semibold text-slate-500">Workflow complete</span>
          )}
        </div>
      ),
    },
  ];

  if (!providers.length) {
    return (
      <Empty title="No providers available" subTitle="Configure the provider catalogue first." />
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
            <Database size={15} /> Live ERP data
          </div>
          <h2 className="mt-2 text-lg font-bold text-slate-900">Regulatory data preparation</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            {selectedProvider?.description ??
              'Validate operational records before creating an official portal submission or export.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(selectedProvider?.capabilities ?? []).map((capability) => (
              <span
                key={capability}
                className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700"
              >
                {capability}
              </span>
            ))}
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
              {selectedProvider?.cycleBased ? 'Annual reporting cycles' : 'Continuous operations'}
            </span>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">
            Provider
            <select
              value={provider}
              onChange={(event) => {
                setProvider(event.target.value as TProvider);
                setConnectionDraft(null);
              }}
              className="mt-1.5 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-primary"
            >
              {providers.map((item) => (
                <option key={item.provider} value={item.provider}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Academic year
            <input
              value={academicYear}
              onChange={(event) => setAcademicYear(event.target.value)}
              placeholder="2026-27"
              pattern="\d{4}-\d{2}"
              className="mt-1.5 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-primary"
            />
          </label>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="font-bold text-red-800">Operational data could not be prepared</p>
          <p className="mt-1 text-sm text-red-600">{error.message}</p>
        </div>
      )}

      <nav
        aria-label="Data operations workflow"
        className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-2 sm:grid-cols-2 lg:grid-cols-4"
      >
        {[
          {
            id: 'readiness' as const,
            step: '01',
            label: 'Check readiness',
            hint: 'Understand what is ready',
            icon: CheckCircle2,
          },
          {
            id: 'records' as const,
            step: '02',
            label: 'Resolve records',
            hint: 'Correct blocking issues',
            icon: ListChecks,
          },
          {
            id: 'submissions' as const,
            step: '03',
            label: 'Submit & track',
            hint: 'Prepare and reconcile',
            icon: Send,
          },
          ...(canManageConnection
            ? [
                {
                  id: 'connection' as const,
                  step: 'Admin',
                  label: 'Connection settings',
                  hint: 'Restricted configuration',
                  icon: Settings2,
                },
              ]
            : []),
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setView(item.id)}
            aria-current={view === item.id ? 'step' : undefined}
            className={`flex min-h-16 items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
              view === item.id
                ? 'bg-blue-50 text-primary'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                view === item.id ? 'bg-white text-primary' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <item.icon size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-black uppercase tracking-wider opacity-70">
                {item.step}
              </span>
              <span className="block truncate text-sm font-bold">{item.label}</span>
              <span className="hidden text-[11px] opacity-70 lg:block">{item.hint}</span>
            </span>
          </button>
        ))}
      </nav>

      {operations && view === 'readiness' && (
        <>
          <div className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-blue-900">Start with source-data readiness</p>
              <p className="mt-1 text-xs leading-5 text-blue-700">
                Review this summary, then resolve blocked or warning records before preparing a
                governed batch.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setView('records')}
              className="min-h-10 shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
            >
              Review {operations.summary.blocked + operations.summary.warnings} issues
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: 'Readiness',
                value: `${operations.summary.readiness}%`,
                icon: Database,
                tone: 'bg-blue-50 text-blue-700',
              },
              {
                label: 'Ready records',
                value: operations.summary.ready,
                icon: CheckCircle2,
                tone: 'bg-emerald-50 text-emerald-700',
              },
              {
                label: 'Warnings',
                value: operations.summary.warnings,
                icon: AlertTriangle,
                tone: 'bg-amber-50 text-amber-700',
              },
              {
                label: 'Blocked',
                value: operations.summary.blocked,
                icon: ShieldAlert,
                tone: 'bg-red-50 text-red-700',
              },
            ].map((metric, index) => (
              <motion.article
                key={metric.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"
              >
                <span className={`grid h-10 w-10 place-items-center rounded-xl ${metric.tone}`}>
                  <metric.icon size={18} />
                </span>
                <div>
                  <p className="text-xl font-black text-slate-900">{metric.value}</p>
                  <p className="text-xs font-semibold text-slate-500">{metric.label}</p>
                </div>
              </motion.article>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {operations.sections.map((section) => (
              <article
                key={section.key}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{section.label}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{section.description}</p>
                  </div>
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">
                    {section.value}
                  </span>
                </div>
              </article>
            ))}
          </div>

          <article className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Provider delivery contract</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Snapshot exports contain the validated fields below. Final acceptance remains
                  controlled by the official provider portal.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {operations.exportFields.map((field) => (
                  <span
                    key={field}
                    className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600"
                  >
                    {field.replaceAll('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          </article>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setView(operations.summary.blocked ? 'records' : 'submissions')}
              className="min-h-10 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white"
            >
              {operations.summary.blocked
                ? 'Continue to resolve records'
                : 'Continue to submission'}
            </button>
          </div>
        </>
      )}

      {view === 'connection' && canManageConnection && (
        <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900">Connection and delivery mode</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Portal export works without API credentials. API mode remains disabled until
                official institution credentials and an approved provider adapter are available.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${
                connection?.status === 'verified'
                  ? 'bg-emerald-50 text-emerald-700'
                  : connection?.status === 'failed'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-amber-50 text-amber-700'
              }`}
            >
              {(connection?.status ?? 'not_configured').replaceAll('_', ' ')}
            </span>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-4">
            <label className="text-xs font-bold text-slate-600">
              Delivery mode
              <select
                disabled={!canManageConnection}
                value={connectionForm.mode}
                onChange={(event) =>
                  setConnectionDraft({
                    ...connectionForm,
                    mode: event.target.value as 'portal_export' | 'api',
                  })
                }
                className="mt-1.5 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-primary"
              >
                <option value="portal_export">Governed portal export</option>
                <option value="api">Official API connector</option>
              </select>
            </label>
            {connectionForm.mode === 'api' && (
              <>
                <label className="text-xs font-bold text-slate-600">
                  API base URL
                  <input
                    disabled={!canManageConnection}
                    value={connectionForm.apiBaseUrl}
                    onChange={(event) =>
                      setConnectionDraft({
                        ...connectionForm,
                        apiBaseUrl: event.target.value,
                      })
                    }
                    placeholder="https://official-provider.example"
                    className="mt-1.5 min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="text-xs font-bold text-slate-600">
                  Institution client ID
                  <input
                    disabled={!canManageConnection}
                    value={connectionForm.clientId}
                    onChange={(event) =>
                      setConnectionDraft({
                        ...connectionForm,
                        clientId: event.target.value,
                      })
                    }
                    placeholder="Issued by the provider"
                    className="mt-1.5 min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="text-xs font-bold text-slate-600">
                  Client credential
                  <input
                    disabled={!canManageConnection}
                    type="password"
                    autoComplete="new-password"
                    value={connectionForm.credential}
                    onChange={(event) =>
                      setConnectionDraft({
                        ...connectionForm,
                        credential: event.target.value,
                      })
                    }
                    placeholder={
                      connection?.hasCredential
                        ? 'Saved securely · enter to replace'
                        : 'Required for API mode'
                    }
                    className="mt-1.5 min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-primary"
                  />
                </label>
              </>
            )}
          </div>
          <label className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            <input
              type="checkbox"
              disabled={!canManageConnection}
              checked={connectionForm.enabled}
              onChange={(event) =>
                setConnectionDraft({ ...connectionForm, enabled: event.target.checked })
              }
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span>
              <strong>Enable this delivery profile.</strong>
              <span className="mt-0.5 block text-xs text-slate-500">
                {connection?.message ?? 'Save a delivery mode to establish its readiness state.'}
              </span>
            </span>
          </label>
          {canManageConnection && (
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={mutating}
                onClick={() => void saveConnection()}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:border-primary hover:text-primary disabled:opacity-50"
              >
                Save profile
              </button>
              <button
                type="button"
                disabled={mutating || !connection?.enabled}
                onClick={() => void testConnection()}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                Verify readiness
              </button>
            </div>
          )}
        </article>
      )}

      {view === 'records' && (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Records requiring attention</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Corrections happen in the source ERP module. Return here and refresh after fixing
                the identity, curriculum or result record.
              </p>
            </div>
            <label className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-slate-50 px-3 text-xs font-bold text-slate-600">
              <input
                type="checkbox"
                checked={showReadyRecords}
                onChange={(event) => setShowReadyRecords(event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Include ready records
            </label>
          </div>
          <CustomTable<IOperationalRow>
            columns={columns}
            data={visibleRecords}
            isLoading={isLoading}
            isValidating={isValidating}
            title={showReadyRecords ? 'Complete validation register' : 'Issues to resolve'}
            subtitle={
              operations
                ? `${operations.summary.total} live ERP records assessed`
                : 'Preparing live ERP data'
            }
            description="Blocked records must be corrected in their source ERP module; this register does not duplicate or override source data."
            onRefresh={() => void refreshWorkspace()}
            options={{ responsive: true, export: true, bordered: false, pageSize: 10 }}
          />
          <div className="flex flex-wrap justify-between gap-2">
            <button
              type="button"
              onClick={() => setView('readiness')}
              className="min-h-10 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700"
            >
              Back to readiness
            </button>
            <button
              type="button"
              onClick={() => setView('submissions')}
              className="min-h-10 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
            >
              Continue to submission
            </button>
          </div>
        </div>
      )}

      {view === 'submissions' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Your responsibility in this step
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {canApprove && !canCreate
                    ? 'Review batches submitted by an independent maker. Approve or reject only after validating the evidence.'
                    : canCreate
                      ? 'Create a batch from ready records and request independent review. You cannot approve your own batch.'
                      : 'Track approved submissions, acknowledgements and reconciliation outcomes.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[10px] font-bold text-slate-500">
                {['Draft', 'Review', 'Approved', 'Exported', 'Submitted', 'Reconciled'].map(
                  (status, index) => (
                    <span key={status} className="rounded-lg bg-slate-100 px-2 py-1.5">
                      {index + 1}. {status}
                    </span>
                  ),
                )}
              </div>
            </div>
            {!!completedBatchCount && (
              <button
                type="button"
                onClick={() => setShowBatchHistory((current) => !current)}
                className="mt-3 text-xs font-bold text-primary"
              >
                {showBatchHistory
                  ? 'Hide completed batch history'
                  : `Show ${completedBatchCount} completed ${completedBatchCount === 1 ? 'batch' : 'batches'}`}
              </button>
            )}
          </div>
          <CustomTable<ISubmissionBatch>
            columns={batchColumns}
            data={visibleBatches}
            isLoading={batchesLoading}
            isValidating={batchesValidating}
            title={showBatchHistory ? 'All submission batches' : 'Active submission workspace'}
            subtitle="Immutable snapshots with independent review and provider reconciliation"
            description="Only validation-ready records enter a batch. Excluded source records remain visible in the validation register for correction."
            onRefresh={() => void mutateBatches()}
            customActions={
              canCreate ? (
                <button
                  type="button"
                  disabled={mutating || !operations?.summary.ready}
                  onClick={() => void createBatch()}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={16} /> Create validated batch
                </button>
              ) : undefined
            }
            detailPanel={(batch) => (
              <div className="grid gap-4 p-4 lg:grid-cols-[0.7fr_1.3fr]">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-emerald-50 p-3">
                    <p className="text-xl font-black text-emerald-700">{batch.acceptedRecords}</p>
                    <p className="text-[11px] font-semibold text-emerald-700">Accepted records</p>
                  </div>
                  <div className="rounded-xl bg-red-50 p-3">
                    <p className="text-xl font-black text-red-700">{batch.rejectedRecords}</p>
                    <p className="text-[11px] font-semibold text-red-700">Rejected records</p>
                  </div>
                  <div className="col-span-2 rounded-xl bg-slate-100 p-3">
                    <p className="text-xs font-bold text-slate-700">Provider acknowledgement</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {batch.acknowledgementReference ?? 'Awaiting portal submission'}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Controlled lifecycle
                  </p>
                  <div className="mt-3 space-y-2">
                    {(batch.history ?? []).map((event, index) => (
                      <div
                        key={`${event.action}-${event.at}-${index}`}
                        className="flex items-start justify-between gap-3 rounded-xl bg-white p-3"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {event.action.replaceAll('_', ' ')}
                          </p>
                          {event.note && (
                            <p className="mt-1 text-xs leading-5 text-slate-500">{event.note}</p>
                          )}
                        </div>
                        <time className="shrink-0 text-[10px] text-slate-400">
                          {new Date(event.at).toLocaleString('en-IN')}
                        </time>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            options={{
              responsive: true,
              export: false,
              bordered: false,
              pageSize: 10,
              detailPanel: true,
              detailPanelHeader: 'Batch evidence and lifecycle',
            }}
          />
        </div>
      )}
    </section>
  );
}

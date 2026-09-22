'use client';

import CustomButton from '@/shared/core/CustomButton';
import Empty from '@/shared/core/Empty';
import InlineFileUpload from '@/shared/core/InlineFileUpload';
import type { IViewerFile } from '@/shared/core/FileViewer';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import {
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  FileCheck2,
  Landmark,
  LockKeyhole,
  RefreshCw,
  Settings2,
  ShieldCheck,
  UploadCloud,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from '@/shared/utils/motion';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import GovernmentIntegrationOperations from './GovernmentIntegrationOperations';

type TProvider = 'digilocker' | 'nad' | 'abc' | 'aishe' | 'nirf';
type TStatus =
  | 'not_started'
  | 'documents_pending'
  | 'submitted'
  | 'approved'
  | 'configured'
  | 'suspended';
interface IRecord {
  status: TStatus;
  institutionCode?: string;
  nodalOfficerName?: string;
  nodalOfficerEmail?: string;
  applicationReference?: string;
  productionEnabled: boolean;
  consentConfirmed: boolean;
  notes?: string;
  lastReviewedAt?: string;
  checklist: Array<{ key: string; label: string; completed: boolean }>;
  approval?: {
    status: 'not_requested' | 'pending' | 'approved' | 'rejected';
    requestedAt?: string;
    decidedAt?: string;
    decisionNote?: string;
  };
  connectivity?: {
    status: 'not_configured' | 'not_tested' | 'verified' | 'failed';
    lastCheckedAt?: string;
    message?: string;
  };
  evidence?: Array<{
    _id: string;
    type: string;
    name: string;
    url: string;
    publicId?: string;
    issuedAt?: string;
    expiresAt?: string;
    uploadedAt: string;
  }>;
  cycles?: Array<{
    _id: string;
    name: string;
    reportingYear: string;
    status: 'draft' | 'in_review' | 'submitted' | 'acknowledged' | 'closed';
    dueDate?: string;
    submittedAt?: string;
    acknowledgementReference?: string;
    notes?: string;
  }>;
  history?: Array<{
    action: string;
    fromStatus?: string;
    toStatus?: string;
    reason?: string;
    at: string;
  }>;
}
interface IIntegration {
  provider: TProvider;
  name: string;
  shortName: string;
  description: string;
  officialUrl: string;
  capabilities: string[];
  checklist: Array<{ key: string; label: string }>;
  cycleBased: boolean;
  requiredEvidence: Array<{ type: string; label: string }>;
  record: IRecord;
}
interface IOverview {
  integrations: IIntegration[];
  summary: {
    total: number;
    configured: number;
    inProgress: number;
    productionEnabled: number;
    pendingApproval: number;
    expiringEvidence: number;
  };
}
interface IFormState {
  status: TStatus;
  institutionCode: string;
  nodalOfficerName: string;
  nodalOfficerEmail: string;
  applicationReference: string;
  notes: string;
  checklist: string[];
  consentConfirmed: boolean;
  reason: string;
}

type TWorkspaceTab = 'overview' | 'providers' | 'operations' | 'cycles' | 'approvals' | 'activity';

const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10';
const statusLabels: Record<TStatus, string> = {
  not_started: 'Not started',
  documents_pending: 'Documents pending',
  submitted: 'Submitted',
  approved: 'Approved',
  configured: 'Governance configured',
  suspended: 'Suspended',
};
const providerStyle: Record<TProvider, string> = {
  digilocker: 'bg-blue-50 text-blue-700 border-blue-100',
  nad: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  abc: 'bg-violet-50 text-violet-700 border-violet-100',
  aishe: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  nirf: 'bg-amber-50 text-amber-700 border-amber-100',
};
const providerColor: Record<TProvider, string> = {
  digilocker: '#0284c7',
  nad: '#4f46e5',
  abc: '#7c3aed',
  aishe: '#059669',
  nirf: '#d97706',
};

const allowedNextStatus: Record<TStatus, TStatus[]> = {
  not_started: ['documents_pending'],
  documents_pending: ['not_started', 'submitted'],
  submitted: ['documents_pending', 'approved'],
  approved: ['documents_pending', 'configured'],
  configured: ['suspended'],
  suspended: ['configured'],
};

function formFor(item: IIntegration): IFormState {
  const record = item.record;
  return {
    status: record?.status ?? 'not_started',
    institutionCode: record?.institutionCode ?? '',
    nodalOfficerName: record?.nodalOfficerName ?? '',
    nodalOfficerEmail: record?.nodalOfficerEmail ?? '',
    applicationReference: record?.applicationReference ?? '',
    notes: record?.notes ?? '',
    checklist:
      record?.checklist?.filter((entry) => entry.completed).map((entry) => entry.key) ?? [],
    consentConfirmed: record?.consentConfirmed ?? false,
    reason: '',
  };
}

function readinessFor(item: IIntegration) {
  const completed = item.record.checklist?.filter((entry) => entry.completed).length ?? 0;
  const total = item.checklist.length;
  return {
    completed,
    total,
    percent: total ? Math.round((completed / total) * 100) : 0,
  };
}

export default function GovernmentIntegrationsPage() {
  const canCreate = useHasPermission('regulatory_integration', 'create');
  const canEdit = useHasPermission('regulatory_integration', 'edit');
  const canApprove = useHasPermission('regulatory_integration', 'approve');
  const canDelete = useHasPermission('regulatory_integration', 'delete');
  const {
    data,
    mutate,
    error,
    isLoading: overviewLoading,
    isValidating,
  } = useSwr<{ success: boolean; data: IOverview }>('regulatory-integration/overview');
  const { mutation, isLoading } = useMutation();
  const [selected, setSelected] = useState<IIntegration | null>(null);
  const [form, setForm] = useState<IFormState | null>(null);
  const [tab, setTab] = useState<TWorkspaceTab>('overview');
  const [evidenceType, setEvidenceType] = useState('production_approval');
  const [evidenceIssuedAt, setEvidenceIssuedAt] = useState('');
  const [evidenceExpiresAt, setEvidenceExpiresAt] = useState('');
  const [cycleOpen, setCycleOpen] = useState<TProvider | null>(null);
  const [cycleForm, setCycleForm] = useState({
    name: '',
    reportingYear: '',
    dueDate: '',
    notes: '',
  });
  const overview = data?.data;
  const metrics: Array<{
    label: string;
    value: number;
    icon: LucideIcon;
    hint: string;
    tone: string;
  }> = [
    {
      label: 'Available services',
      value: overview?.summary.total ?? 0,
      icon: Landmark,
      hint: 'Governed provider catalogue',
      tone: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'In onboarding',
      value: overview?.summary.inProgress ?? 0,
      icon: CircleDashed,
      hint: 'Registration or approval underway',
      tone: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Governance configured',
      value: overview?.summary.configured ?? 0,
      icon: FileCheck2,
      hint: 'Governance configuration complete',
      tone: 'bg-violet-50 text-violet-700',
    },
    {
      label: 'Authorized',
      value: overview?.summary.productionEnabled ?? 0,
      icon: LockKeyhole,
      hint: 'Independently approved for production',
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Awaiting approval',
      value: overview?.summary.pendingApproval ?? 0,
      icon: ClipboardCheck,
      hint: 'Maker-checker decisions pending',
      tone: 'bg-cyan-50 text-cyan-700',
    },
    {
      label: 'Evidence expiring',
      value: overview?.summary.expiringEvidence ?? 0,
      icon: Clock3,
      hint: 'Expires within 60 days',
      tone: 'bg-rose-50 text-rose-700',
    },
  ];
  const completion = useMemo(() => {
    if (!form || !selected?.checklist.length) return 0;
    return Math.round((form.checklist.length / selected.checklist.length) * 100);
  }, [form, selected]);
  const integrations = overview?.integrations ?? [];
  const reportingCycleCount = integrations.reduce(
    (total, item) => total + (item.record.cycles?.length ?? 0),
    0,
  );
  const activityCount = integrations.reduce(
    (total, item) => total + (item.record.history?.length ?? 0),
    0,
  );
  const attentionItems = integrations.flatMap((item) => {
    const readiness = readinessFor(item);
    if (item.record.approval?.status === 'pending') {
      return [{ provider: item, label: 'Production approval requires a decision' }];
    }
    if (!item.record.nodalOfficerName || !item.record.nodalOfficerEmail) {
      return [{ provider: item, label: 'Assign a nodal officer and contact' }];
    }
    if (readiness.percent < 100) {
      return [
        {
          provider: item,
          label: `${readiness.total - readiness.completed} onboarding control${readiness.total - readiness.completed === 1 ? '' : 's'} incomplete`,
        },
      ];
    }
    if (!item.record.productionEnabled) {
      return [{ provider: item, label: 'Complete authorization before production use' }];
    }
    return [];
  });

  const open = (item: IIntegration) => {
    setSelected(item);
    setForm(formFor(item));
    setEvidenceType(item.requiredEvidence[0]?.type ?? 'supporting_evidence');
    setEvidenceIssuedAt('');
    setEvidenceExpiresAt('');
  };
  const close = () => {
    setSelected(null);
    setForm(null);
  };
  const requestClose = async () => {
    const dirty = Boolean(
      selected && form && JSON.stringify(form) !== JSON.stringify(formFor(selected)),
    );
    if (dirty) {
      const result = await Swal.fire({
        title: 'Discard unsaved changes?',
        text: 'Updates made in this onboarding form have not been saved.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Discard changes',
        confirmButtonColor: '#dc2626',
      });
      if (!result.isConfirmed) return;
    }
    close();
  };
  const save = async () => {
    if (!selected || !form) return;
    if (form.nodalOfficerEmail && !/^\S+@\S+\.\S+$/.test(form.nodalOfficerEmail)) {
      toast.error('Enter a valid nodal officer email address');
      return;
    }
    if (form.status !== selected.record.status && form.reason.trim().length < 3) {
      toast.error('Explain the reason for changing the lifecycle status');
      return;
    }
    const response = await mutation(`regulatory-integration/${selected.provider}`, {
      method: 'PUT',
      body: form,
    });
    if (!response?.results?.success) return;
    toast.success(`${selected.shortName} onboarding updated`);
    await mutate();
    close();
  };

  const requestApproval = async () => {
    if (!selected) return;
    const reason = form?.reason.trim() || 'Readiness reviewed and submitted for authorization';
    const response = await mutation(
      `regulatory-integration/${selected.provider}/request-approval`,
      { method: 'POST', body: { reason } },
    );
    if (!response?.results?.success) return;
    toast.success('Production authorization sent for independent approval');
    await mutate();
    close();
  };

  const decideApproval = async (item: IIntegration, decision: 'approved' | 'rejected') => {
    const confirmation = await Swal.fire({
      title: decision === 'approved' ? 'Authorize production?' : 'Reject authorization?',
      text:
        decision === 'approved'
          ? `Confirm that ${item.shortName} evidence, authority and institutional controls were independently reviewed.`
          : `Record why ${item.shortName} is not ready for production authorization.`,
      icon: decision === 'approved' ? 'question' : 'warning',
      input: 'textarea',
      inputLabel: 'Decision note',
      inputPlaceholder: 'Record the evidence and basis for this decision…',
      inputValidator: (value) => (value.trim().length < 3 ? 'Enter at least 3 characters' : null),
      showCancelButton: true,
      confirmButtonText: decision === 'approved' ? 'Authorize' : 'Reject',
      confirmButtonColor: decision === 'approved' ? '#0178D7' : '#dc2626',
    });
    if (!confirmation.isConfirmed) return;
    const note = String(confirmation.value).trim();
    const response = await mutation(`regulatory-integration/${item.provider}/approval`, {
      method: 'POST',
      body: { decision, note: note.trim() },
    });
    if (!response?.results?.success) return;
    toast.success(`Authorization ${decision}`);
    await mutate();
  };

  const uploadEvidence = async (file: File) => {
    if (!selected) return false;
    const body = new FormData();
    body.append('file', file);
    body.append('type', evidenceType);
    body.append('name', file.name);
    if (evidenceIssuedAt) body.append('issuedAt', evidenceIssuedAt);
    if (evidenceExpiresAt) body.append('expiresAt', evidenceExpiresAt);
    const response = await mutation(`regulatory-integration/${selected.provider}/evidence`, {
      method: 'POST',
      body,
      isFormData: true,
      dedupe: false,
    });
    if (!response?.results?.success) return false;
    await mutate();
    const refreshed = (response.results.data ?? selected.record) as IRecord;
    setSelected({ ...selected, record: refreshed });
    toast.success('Approval evidence uploaded');
    setEvidenceIssuedAt('');
    setEvidenceExpiresAt('');
    return true;
  };

  const removeEvidence = async (_file: IViewerFile, index: number) => {
    if (!selected) return;
    const evidence = selected.record.evidence?.[index];
    if (!evidence) return;
    const response = await mutation(
      `regulatory-integration/${selected.provider}/evidence/${evidence._id}`,
      { method: 'DELETE' },
    );
    if (!response?.results?.success) return;
    const nextRecord = {
      ...selected.record,
      evidence: selected.record.evidence?.filter((_, evidenceIndex) => evidenceIndex !== index),
    };
    setSelected({ ...selected, record: nextRecord });
    await mutate();
  };

  const createCycle = async () => {
    if (!cycleOpen) return;
    if (!cycleForm.name.trim() || !cycleForm.reportingYear.trim()) {
      toast.error('Cycle name and reporting year are required');
      return;
    }
    const response = await mutation(`regulatory-integration/${cycleOpen}/cycles`, {
      method: 'POST',
      body: {
        ...cycleForm,
        dueDate: cycleForm.dueDate || undefined,
        notes: cycleForm.notes.trim() || undefined,
      },
    });
    if (!response?.results?.success) return;
    toast.success('Reporting cycle created');
    setCycleOpen(null);
    setCycleForm({ name: '', reportingYear: '', dueDate: '', notes: '' });
    await mutate();
  };

  const advanceCycle = async (
    provider: TProvider,
    cycle: NonNullable<IRecord['cycles']>[number],
  ) => {
    const next: Partial<Record<typeof cycle.status, typeof cycle.status>> = {
      draft: 'in_review',
      in_review: 'submitted',
      submitted: 'acknowledged',
      acknowledged: 'closed',
    };
    const nextStatus = next[cycle.status];
    if (!nextStatus) return;
    let acknowledgementReference: string | undefined;
    if (nextStatus === 'acknowledged') {
      const result = await Swal.fire({
        title: 'Record authority acknowledgement',
        input: 'text',
        inputLabel: 'Acknowledgement reference',
        inputPlaceholder: 'Official acknowledgement or submission reference',
        inputValidator: (value) => (!value.trim() ? 'Reference is required' : null),
        showCancelButton: true,
        confirmButtonText: 'Record acknowledgement',
      });
      if (!result.isConfirmed) return;
      acknowledgementReference = String(result.value).trim();
    }
    const response = await mutation(`regulatory-integration/${provider}/cycles/${cycle._id}`, {
      method: 'PATCH',
      body: { status: nextStatus, acknowledgementReference },
    });
    if (!response?.results?.success) return;
    toast.success(`Cycle moved to ${nextStatus.replaceAll('_', ' ')}`);
    await mutate();
  };

  const deleteCycle = async (
    provider: TProvider,
    cycle: NonNullable<IRecord['cycles']>[number],
  ) => {
    const result = await Swal.fire({
      title: 'Delete draft cycle?',
      text: `${cycle.name} will be permanently removed.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete draft',
      confirmButtonColor: '#dc2626',
    });
    if (!result.isConfirmed) return;
    const response = await mutation(`regulatory-integration/${provider}/cycles/${cycle._id}`, {
      method: 'DELETE',
    });
    if (!response?.results?.success) return;
    toast.success('Draft cycle deleted');
    await mutate();
  };

  return (
    <div className="mx-auto w-full max-w-375 space-y-6 ">
      <section className="relative overflow-hidden rounded-3xl border border-blue-100 bg-linear-to-br from-blue-50 via-white to-cyan-50 px-6 py-8 text-slate-900 sm:px-8">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-100/60 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
              <ShieldCheck size={15} /> Governed institutional integrations
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Government & Regulatory Integrations
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Track eligibility, institutional approvals, nodal ownership and production readiness
              in one auditable workspace. Credentials are never requested before official approval.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void mutate()}
            disabled={isValidating}
            className="inline-flex min-h-10 w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-primary disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric, index) => (
          <motion.article
            key={metric.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -3, borderColor: '#bfdbfe' }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"
          >
            <span
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${metric.tone}`}
            >
              <metric.icon size={19} />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-black text-slate-900">
                {overviewLoading ? '—' : metric.value}
              </p>
              <p className="text-xs font-bold text-slate-700">{metric.label}</p>
              <p className="truncate text-[11px] text-slate-500">{metric.hint}</p>
            </div>
          </motion.article>
        ))}
      </section>

      <nav
        className="flex w-fit max-w-full gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2"
        role="tablist"
        aria-label="Government integration sections"
      >
        {[
          {
            id: 'overview' as const,
            label: 'Overview',
            detail: 'Readiness & attention',
            icon: CircleDashed,
          },
          {
            id: 'providers' as const,
            label: 'Providers',
            detail: `${integrations.length} services`,
            icon: Landmark,
          },
          {
            id: 'operations' as const,
            label: 'Data operations',
            detail: 'Live ERP validation',
            icon: FileCheck2,
          },
          {
            id: 'cycles' as const,
            label: 'Reporting cycles',
            detail: `${reportingCycleCount} cycles`,
            icon: Clock3,
          },
          {
            id: 'approvals' as const,
            label: 'Approvals',
            detail: `${overview?.summary.pendingApproval ?? 0} pending`,
            icon: ClipboardCheck,
          },
          {
            id: 'activity' as const,
            label: 'Activity',
            detail: `${activityCount} events`,
            icon: FileCheck2,
          },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors ${tab === item.id ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${tab === item.id ? 'bg-white/15' : 'bg-slate-100'}`}
            >
              <item.icon className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-xs font-bold">{item.label}</span>
              <span
                className={`mt-0.5 block text-[10px] ${tab === item.id ? 'text-white/75' : 'text-slate-400'}`}
              >
                {item.detail}
              </span>
            </span>
          </button>
        ))}
      </nav>

      {error && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-bold text-red-800">Integration workspace could not be loaded</p>
          <p className="mt-1 text-sm text-red-600">{error.message}</p>
          <button
            type="button"
            onClick={() => void mutate()}
            className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-700"
          >
            Try again
          </button>
        </section>
      )}

      {overviewLoading && !overview && (
        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="h-72 animate-pulse rounded-2xl bg-white" />
          ))}
        </section>
      )}

      {!error && tab === 'overview' && overview && (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.75fr)]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Institution readiness</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Live onboarding progress across every governed provider.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {overview.summary.configured}/{overview.summary.total} configured
              </span>
            </div>
            <div className="mt-5 divide-y divide-slate-100">
              {integrations.map((item) => {
                const readiness = readinessFor(item);
                return (
                  <button
                    key={item.provider}
                    type="button"
                    onClick={() => open(item)}
                    className="grid w-full gap-3 py-4 text-left transition hover:bg-slate-50 sm:grid-cols-[minmax(10rem,0.75fr)_minmax(12rem,1fr)_auto] sm:items-center sm:px-3"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-xs font-black ${providerStyle[item.provider]}`}
                      >
                        {item.shortName.slice(0, 3).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-slate-900">
                          {item.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {statusLabels[item.record.status]}
                        </span>
                      </span>
                    </span>
                    <span>
                      <span className="flex justify-between text-[11px] font-semibold text-slate-500">
                        <span>{readiness.completed} controls complete</span>
                        <span>{readiness.percent}%</span>
                      </span>
                      <svg
                        viewBox="0 0 100 4"
                        preserveAspectRatio="none"
                        className="mt-2 h-2 w-full overflow-hidden rounded-full"
                        role="img"
                        aria-label={`${readiness.percent}% onboarding readiness`}
                      >
                        <rect width="100" height="4" rx="2" fill="#f1f5f9" />
                        <motion.rect
                          initial={{ width: 0 }}
                          animate={{ width: readiness.percent }}
                          transition={{ duration: 0.7, ease: 'easeOut' }}
                          height="4"
                          rx="2"
                          fill={providerColor[item.provider]}
                        />
                      </svg>
                    </span>
                    <span
                      className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-bold ${item.record.productionEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                    >
                      {item.record.productionEnabled ? 'Authorized' : 'Not authorized'}
                    </span>
                  </button>
                );
              })}
            </div>
          </article>

          <div className="space-y-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-900">Attention required</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Highest-priority next action per provider.
                  </p>
                </div>
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-700">
                  <Clock3 size={17} />
                </span>
              </div>
              {attentionItems.length ? (
                <div className="mt-4 space-y-2">
                  {attentionItems.map((attention) => (
                    <button
                      key={attention.provider.provider}
                      type="button"
                      onClick={() => open(attention.provider)}
                      className="flex w-full items-start gap-3 rounded-xl bg-slate-50 p-3 text-left transition hover:bg-slate-100"
                    >
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                      <span>
                        <span className="block text-xs font-bold text-slate-800">
                          {attention.provider.shortName}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                          {attention.label}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
                  All provider governance controls are up to date.
                </div>
              )}
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-bold text-slate-900">Authorization posture</h2>
              <p className="mt-1 text-xs text-slate-500">Separation-of-duty control status.</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-2xl font-black text-emerald-700">
                    {overview.summary.productionEnabled}
                  </p>
                  <p className="text-[11px] font-semibold text-emerald-700">Authorized</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="text-2xl font-black text-amber-700">
                    {overview.summary.pendingApproval}
                  </p>
                  <p className="text-[11px] font-semibold text-amber-700">Awaiting decision</p>
                </div>
              </div>
            </article>
          </div>
        </section>
      )}

      {!error && tab === 'providers' && (
        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {(overview?.integrations ?? []).map((item) => {
            const { percent } = readinessFor(item);
            return (
              <article
                key={item.provider}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border text-sm font-black ${providerStyle[item.provider]}`}
                      >
                        {item.shortName.slice(0, 3).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate font-bold text-slate-900">{item.name}</h2>
                        <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                          {statusLabels[item.record?.status ?? 'not_started']}
                        </span>
                      </div>
                    </div>
                    <a
                      href={item.officialUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open official ${item.name} website`}
                      className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-primary"
                    >
                      <ExternalLink size={18} />
                    </a>
                  </div>
                  <p className="mt-4 min-h-12 text-sm leading-6 text-slate-600">
                    {item.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.capabilities.map((capability) => (
                      <span
                        key={capability}
                        className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600"
                      >
                        {capability}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5">
                    <div className="flex justify-between text-xs font-semibold text-slate-500">
                      <span>Onboarding readiness</span>
                      <span>{percent}%</span>
                    </div>
                    <svg
                      viewBox="0 0 100 4"
                      preserveAspectRatio="none"
                      className="mt-2 h-2 w-full overflow-hidden rounded-full"
                      role="img"
                      aria-label={`${percent}% onboarding readiness`}
                    >
                      <rect width="100" height="4" rx="2" fill="#f1f5f9" />
                      <motion.rect
                        initial={{ width: 0 }}
                        animate={{ width: percent }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                        height="4"
                        rx="2"
                        fill={providerColor[item.provider]}
                      />
                    </svg>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Approval
                      </p>
                      <p className="mt-1 font-semibold capitalize text-slate-700">
                        {(item.record.approval?.status ?? 'not_requested').replaceAll('_', ' ')}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Last review
                      </p>
                      <p className="mt-1 font-semibold text-slate-700">
                        {item.record.lastReviewedAt
                          ? new Date(item.record.lastReviewedAt).toLocaleDateString('en-IN')
                          : 'Not reviewed'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => open(item)}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    <Settings2 size={16} /> {canEdit ? 'Manage onboarding' : 'View onboarding'}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {!error && tab === 'operations' && (
        <GovernmentIntegrationOperations
          providers={integrations.map((item) => ({
            provider: item.provider,
            shortName: item.shortName,
            name: item.name,
            description: item.description,
            capabilities: item.capabilities,
            cycleBased: item.cycleBased,
            requiredEvidence: item.requiredEvidence,
          }))}
        />
      )}

      {tab === 'cycles' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Regulatory reporting cycles</h2>
              <p className="mt-1 text-sm text-slate-500">
                Preserve AISHE and NIRF submissions by reporting year instead of overwriting them.
              </p>
            </div>
            {canCreate && (
              <div className="flex gap-2">
                {(overview?.integrations ?? [])
                  .filter((item) => item.cycleBased)
                  .map((item) => (
                    <button
                      key={item.provider}
                      type="button"
                      onClick={() => setCycleOpen(item.provider)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-primary hover:text-primary"
                    >
                      Add {item.shortName} cycle
                    </button>
                  ))}
              </div>
            )}
          </div>
          {(overview?.integrations ?? []).some((item) => item.record.cycles?.length) ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(overview?.integrations ?? []).flatMap((item) =>
                (item.record.cycles ?? []).map((cycle) => (
                  <article
                    key={`${item.provider}-${cycle._id}`}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`rounded-lg border px-2 py-1 text-xs font-bold ${providerStyle[item.provider]}`}
                      >
                        {item.shortName}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold capitalize text-slate-600">
                        {cycle.status.replaceAll('_', ' ')}
                      </span>
                    </div>
                    <h3 className="mt-3 font-bold text-slate-900">{cycle.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Reporting year {cycle.reportingYear}
                    </p>
                    <p className="mt-3 text-xs text-slate-600">
                      Due{' '}
                      {cycle.dueDate
                        ? new Date(cycle.dueDate).toLocaleDateString('en-IN')
                        : 'not set'}
                    </p>
                    {(canEdit || (canDelete && cycle.status === 'draft')) && (
                      <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
                        {canDelete && cycle.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => void deleteCycle(item.provider, cycle)}
                            className="rounded-lg px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                          >
                            Delete draft
                          </button>
                        )}
                        {canEdit && cycle.status !== 'closed' && (
                          <button
                            type="button"
                            onClick={() => void advanceCycle(item.provider, cycle)}
                            className="rounded-lg bg-primary-50 px-3 py-2 text-xs font-bold text-primary hover:bg-blue-100"
                          >
                            Advance workflow
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                )),
              )}
            </div>
          ) : (
            <Empty
              title="No reporting cycles yet"
              subTitle="Create the first AISHE or NIRF cycle to preserve annual submission history."
            />
          )}
        </section>
      )}

      {tab === 'approvals' && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Production authorization queue</h2>
            <p className="mt-1 text-sm text-slate-500">
              Independent approval keeps preparation and authorization responsibilities separate.
            </p>
          </div>
          {(overview?.integrations ?? []).filter(
            (item) => item.record.approval?.status === 'pending',
          ).length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {(overview?.integrations ?? [])
                .filter((item) => item.record.approval?.status === 'pending')
                .map((item) => (
                  <article
                    key={item.provider}
                    className="rounded-2xl border border-amber-200 bg-amber-50 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
                          Decision required
                        </p>
                        <h3 className="mt-1 font-bold text-slate-900">{item.name}</h3>
                        <p className="mt-1 text-xs text-slate-600">
                          Requested{' '}
                          {item.record.approval?.requestedAt
                            ? new Date(item.record.approval.requestedAt).toLocaleString('en-IN')
                            : 'recently'}
                        </p>
                      </div>
                      {canApprove && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void decideApproval(item, 'rejected')}
                            className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-red-600"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => void decideApproval(item, 'approved')}
                            className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white"
                          >
                            Approve
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
            </div>
          ) : (
            <Empty
              title="Approval queue is clear"
              subTitle="No production-authorization decisions are waiting."
            />
          )}
        </section>
      )}

      {tab === 'activity' && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Governance activity</h2>
            <p className="mt-1 text-sm text-slate-500">
              Recent lifecycle, evidence and authorization events across providers.
            </p>
          </div>
          {(overview?.integrations ?? []).some((item) => item.record.history?.length) ? (
            <div className="space-y-2">
              {(overview?.integrations ?? [])
                .flatMap((item) =>
                  (item.record.history ?? []).map((event) => ({
                    ...event,
                    provider: item.shortName,
                  })),
                )
                .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
                .slice(0, 30)
                .map((event, index) => (
                  <article
                    key={`${event.provider}-${event.at}-${index}`}
                    className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-primary">
                      <ShieldCheck className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-bold text-slate-800">
                          {event.action.replaceAll('_', ' ')} · {event.provider}
                        </p>
                        <time className="text-[11px] text-slate-500">
                          {new Date(event.at).toLocaleString('en-IN')}
                        </time>
                      </div>
                      {event.reason && (
                        <p className="mt-1 text-xs text-slate-600">{event.reason}</p>
                      )}
                    </div>
                  </article>
                ))}
            </div>
          ) : (
            <Empty
              title="No governance activity yet"
              subTitle="Lifecycle and approval actions will appear here."
            />
          )}
        </section>
      )}

      {selected && form && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-200/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${selected.name} onboarding`}
          onClick={() => void requestClose()}
        >
          <div
            className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
              <div className="flex items-center gap-3">
                <span
                  className={`grid h-10 w-10 place-items-center rounded-xl border text-xs font-black ${providerStyle[selected.provider]}`}
                >
                  {selected.shortName.slice(0, 3).toUpperCase()}
                </span>
                <div>
                  <h2 className="font-bold text-slate-900">{selected.name}</h2>
                  <p className="text-xs text-slate-500">Onboarding readiness · {completion}%</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void requestClose()}
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </header>
            <div className="space-y-6 p-5 sm:p-6">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                <strong>Important:</strong> This workspace tracks readiness; it does not claim
                government approval. Enable production only after written authority approval and
                institutional authorization.
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">
                  Status
                  <select
                    disabled={!canEdit}
                    className={inputClass}
                    value={form.status}
                    onChange={(event) =>
                      setForm({ ...form, status: event.target.value as TStatus })
                    }
                  >
                    {[form.status, ...allowedNextStatus[selected.record.status]]
                      .filter((value, index, values) => values.indexOf(value) === index)
                      .map((value) => (
                        <option key={value} value={value}>
                          {statusLabels[value]}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Institution code
                  <input
                    disabled={!canEdit}
                    className={inputClass}
                    value={form.institutionCode}
                    onChange={(event) => setForm({ ...form, institutionCode: event.target.value })}
                    placeholder="Official institution identifier"
                  />
                </label>
                {form.status !== selected.record.status && (
                  <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                    Reason for lifecycle change *
                    <textarea
                      disabled={!canEdit}
                      className={`${inputClass} min-h-20 resize-y`}
                      maxLength={500}
                      value={form.reason}
                      onChange={(event) => setForm({ ...form, reason: event.target.value })}
                      placeholder="Explain the completed milestone, supporting authority or reason for returning this workflow."
                    />
                    <span className="mt-1 block text-[11px] font-normal text-slate-500">
                      This explanation is preserved in the governance history.
                    </span>
                  </label>
                )}
                <label className="text-sm font-semibold text-slate-700">
                  Nodal officer name
                  <input
                    disabled={!canEdit}
                    className={inputClass}
                    value={form.nodalOfficerName}
                    onChange={(event) => setForm({ ...form, nodalOfficerName: event.target.value })}
                    placeholder="Authorized officer"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Nodal officer email
                  <input
                    disabled={!canEdit}
                    type="email"
                    className={inputClass}
                    value={form.nodalOfficerEmail}
                    onChange={(event) =>
                      setForm({ ...form, nodalOfficerEmail: event.target.value })
                    }
                    placeholder="officer@institution.edu"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                  Application reference
                  <input
                    disabled={!canEdit}
                    className={inputClass}
                    value={form.applicationReference}
                    onChange={(event) =>
                      setForm({ ...form, applicationReference: event.target.value })
                    }
                    placeholder="Reference supplied by the authority"
                  />
                </label>
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Readiness checklist</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {selected.checklist.map((entry) => {
                    const checked = form.checklist.includes(entry.key);
                    return (
                      <label
                        key={entry.key}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition ${checked ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-700'}`}
                      >
                        <input
                          disabled={!canEdit}
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setForm({
                              ...form,
                              checklist: checked
                                ? form.checklist.filter((key) => key !== entry.key)
                                : [...form.checklist, entry.key],
                            })
                          }
                          className="mt-0.5 h-4 w-4 accent-emerald-600"
                        />
                        <span>{entry.label}</span>
                        {checked && <CheckCircle2 size={16} className="ml-auto shrink-0" />}
                      </label>
                    );
                  })}
                </div>
              </div>
              <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <div>
                  <h3 className="font-bold text-slate-900">Approval evidence</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Attach official approval, registration or acknowledgement evidence. Files are
                    stored in the tenant evidence folder and recorded in activity history.
                  </p>
                </div>
                {canEdit && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block text-xs font-semibold text-slate-600 sm:col-span-3">
                      Evidence category
                      <select
                        className={inputClass}
                        value={evidenceType}
                        onChange={(event) => setEvidenceType(event.target.value)}
                      >
                        {[
                          ...selected.requiredEvidence,
                          {
                            type: 'application_acknowledgement',
                            label: 'Application acknowledgement',
                          },
                          { type: 'agreement', label: 'Agreement or MoU' },
                          { type: 'supporting_evidence', label: 'Other supporting evidence' },
                        ]
                          .filter(
                            (entry, index, entries) =>
                              entries.findIndex((candidate) => candidate.type === entry.type) ===
                              index,
                          )
                          .map((entry) => (
                            <option key={entry.type} value={entry.type}>
                              {entry.label}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Document issue date
                      <input
                        type="date"
                        className={inputClass}
                        value={evidenceIssuedAt}
                        onChange={(event) => setEvidenceIssuedAt(event.target.value)}
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Expiry date
                      <input
                        type="date"
                        min={evidenceIssuedAt || undefined}
                        className={inputClass}
                        value={evidenceExpiresAt}
                        onChange={(event) => setEvidenceExpiresAt(event.target.value)}
                      />
                    </label>
                    <div className="flex items-end pb-2 text-[11px] leading-4 text-slate-500">
                      Expiry dates drive the 60-day renewal warning.
                    </div>
                  </div>
                )}
                <InlineFileUpload
                  label="Regulatory evidence files"
                  multiple
                  disabled={!canEdit}
                  files={(selected.record.evidence ?? []).map((entry) => ({
                    url: entry.url,
                    name: entry.name,
                  }))}
                  onUpload={uploadEvidence}
                  onRemove={removeEvidence}
                  hint="PDF or image · maximum 5 MB each"
                />
                <div className="flex flex-wrap gap-2">
                  {selected.requiredEvidence.map((required) => {
                    const present = selected.record.evidence?.some(
                      (entry) => entry.type === required.type,
                    );
                    return (
                      <span
                        key={required.type}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          present ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {present ? 'Complete' : 'Required'} · {required.label}
                      </span>
                    );
                  })}
                </div>
              </section>
              <label className="block text-sm font-semibold text-slate-700">
                Internal notes
                <textarea
                  disabled={!canEdit}
                  className={`${inputClass} min-h-24 resize-y`}
                  maxLength={2000}
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  placeholder="Record blockers, approvals and next actions"
                />
              </label>
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="flex items-start gap-3 text-sm text-slate-700">
                  <input
                    disabled={!canEdit}
                    type="checkbox"
                    checked={form.consentConfirmed}
                    onChange={(event) =>
                      setForm({ ...form, consentConfirmed: event.target.checked })
                    }
                    className="mt-0.5 h-4 w-4 accent-primary"
                  />
                  <span>
                    <strong>Institutional authorization confirmed.</strong>
                    <br />
                    Required consent, lawful purpose and nodal responsibility have been reviewed.
                  </span>
                </label>
                <div className="flex items-start gap-3 text-sm text-slate-700">
                  <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    <strong>Production authorization</strong>
                    <br />
                    Current decision:{' '}
                    <span className="capitalize">
                      {(selected.record.approval?.status ?? 'not_requested').replaceAll('_', ' ')}
                    </span>
                    . Authorization requires an independent approver and does not claim live API
                    connectivity.
                  </span>
                </div>
              </div>
            </div>
            <footer className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
              <CustomButton type="button" variant="secondary" onClick={() => void requestClose()}>
                Close
              </CustomButton>
              {canEdit && (
                <CustomButton type="button" onClick={save} disabled={isLoading}>
                  {isLoading ? 'Saving…' : 'Save onboarding'}
                </CustomButton>
              )}
              {canEdit &&
                selected.record.status === 'configured' &&
                selected.record.approval?.status !== 'pending' &&
                selected.record.approval?.status !== 'approved' && (
                  <CustomButton type="button" onClick={requestApproval} disabled={isLoading}>
                    Request authorization
                  </CustomButton>
                )}
            </footer>
          </div>
        </div>
      )}

      <AnimatePresence>
        {cycleOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-200/80 p-0 backdrop-blur-sm sm:items-center sm:p-4">
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="w-full max-w-xl rounded-t-3xl bg-white sm:rounded-3xl"
              role="dialog"
              aria-modal="true"
              aria-label="Create reporting cycle"
            >
              <header className="flex items-start justify-between border-b border-slate-200 p-5">
                <div className="flex gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-primary">
                    <UploadCloud className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-bold text-slate-900">Create reporting cycle</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Preserve a separate {cycleOpen.toUpperCase()} submission period.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCycleOpen(null)}
                  className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                  Cycle name *
                  <input
                    className={inputClass}
                    value={cycleForm.name}
                    onChange={(event) => setCycleForm({ ...cycleForm, name: event.target.value })}
                    placeholder="Example: AISHE Survey 2025–26"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Reporting year *
                  <input
                    className={inputClass}
                    value={cycleForm.reportingYear}
                    onChange={(event) =>
                      setCycleForm({ ...cycleForm, reportingYear: event.target.value })
                    }
                    placeholder="2025–26"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Submission due date
                  <input
                    type="date"
                    className={inputClass}
                    value={cycleForm.dueDate}
                    onChange={(event) =>
                      setCycleForm({ ...cycleForm, dueDate: event.target.value })
                    }
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                  Planning notes
                  <textarea
                    className={`${inputClass} min-h-24 resize-y`}
                    maxLength={1000}
                    value={cycleForm.notes}
                    onChange={(event) => setCycleForm({ ...cycleForm, notes: event.target.value })}
                    placeholder="Record owners, milestones and submission preparation notes."
                  />
                </label>
              </div>
              <footer className="flex justify-end gap-2 border-t border-slate-200 p-4">
                <CustomButton variant="secondary" onClick={() => setCycleOpen(null)}>
                  Cancel
                </CustomButton>
                <CustomButton onClick={createCycle} loading={isLoading}>
                  Create cycle
                </CustomButton>
              </footer>
            </motion.section>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

'use client';

import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Action, Column } from '@/shared/core/CustomTable';
import AsyncSelect from '@/shared/core/AsyncSelect';
import Empty from '@/shared/core/Empty';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useAuthStore } from '@/shared/store/authStore';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import QualityWorkflowBar from '@/shared/components/QualityWorkflowBar';
import { motion } from '@/shared/utils/motion';
import {
  BarChart3,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  History,
  Eye,
  Pencil,
  Plus,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { useRouter } from 'nextjs-toploader/app';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'react-toastify';
import ComplianceRecordModal from './ComplianceRecordModal';
import TallyIntegrationPanel from './TallyIntegrationPanel';
import RequirementModal from './RequirementModal';
import FrameworkModal from './FrameworkModal';
import ComplianceInsights from './ComplianceInsights';
import FrameworkCatalogModal from './FrameworkCatalogModal';
import ComplianceFindingsPanel from './ComplianceFindingsPanel';
import type {
  IComplianceDashboard,
  IComplianceFramework,
  IComplianceRequirement,
  IComplianceSubmission,
  TFramework,
} from '../types/compliance.types';

interface IApiResponse<T> {
  success: boolean;
  data: T;
}

type TTab = 'overview' | 'tally' | string;

const STATUS_STYLE: Record<string, string> = {
  approved: 'bg-emerald-50 text-emerald-700',
  submitted: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-amber-50 text-amber-700',
  non_compliant: 'bg-red-50 text-red-700',
  not_started: 'bg-slate-100 text-slate-500',
};

const entityId = (value: string | { _id: string }) =>
  typeof value === 'string' ? value : value._id;

export default function ComplianceWorkspacePage() {
  const router = useRouter();
  const pathname = usePathname();
  const roleBase = pathname.split('/').slice(0, 3).join('/');
  const [tab, setTab] = useState<TTab>('overview');
  const [academicYear, setAcademicYear] = useState('');
  const [selected, setSelected] = useState<IComplianceRequirement | null>(null);
  const [editing, setEditing] = useState<IComplianceSubmission | null>(null);
  const [requirementModal, setRequirementModal] = useState(false);
  const [frameworkModal, setFrameworkModal] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [requirementScope, setRequirementScope] = useState<'all' | 'mine'>('all');
  const [editingFramework, setEditingFramework] = useState<IComplianceFramework | null>(null);
  const userId = useAuthStore((state) => state.user?._id);
  const canView = useHasPermission('compliance', 'view');
  const canCreate = useHasPermission('compliance', 'create');
  const canEdit = useHasPermission('compliance', 'edit');
  const canReview = useHasPermission('compliance', 'approve');
  const canExport = useHasPermission('compliance', 'export');
  const canViewNaac = useHasPermission('naac', 'view');
  const canViewNba = useHasPermission('nba', 'view');
  const canViewAudit = useHasPermission('audit_log', 'view');
  const canConfigure = canReview;
  const canUseTally = canView && (canEdit || canExport);
  const visibleTab: TTab = !canUseTally && tab === 'tally' ? 'overview' : tab;
  const framework: TFramework | null = !['overview', 'tally', 'findings'].includes(visibleTab)
    ? visibleTab
    : null;
  const { mutation, isLoading: reviewing } = useMutation();

  const {
    data: frameworksRaw,
    error: frameworksError,
    mutate: refreshFrameworks,
  } = useSwr<IApiResponse<IComplianceFramework[]>>(
    canView ? 'compliance-workspace/frameworks' : null,
  );

  const {
    data: dashboardRaw,
    error: dashboardError,
    isLoading: dashboardLoading,
    mutate: refreshDashboard,
  } = useSwr<IApiResponse<IComplianceDashboard>>(
    canView && academicYear
      ? `compliance-workspace/dashboard?academicYear=${encodeURIComponent(academicYear)}`
      : null,
  );
  const {
    data: requirementsRaw,
    error: requirementsError,
    isLoading: requirementsLoading,
    mutate: refreshRequirements,
  } = useSwr<IApiResponse<IComplianceRequirement[]>>(
    canView && framework
      ? `compliance-workspace/requirements?framework=${framework}&active=true`
      : null,
  );
  const {
    data: submissionsRaw,
    error: submissionsError,
    isLoading: submissionsLoading,
    mutate: refreshSubmissions,
  } = useSwr<IApiResponse<IComplianceSubmission[]>>(
    canView && framework && academicYear
      ? `compliance-workspace/submissions?framework=${framework}&academicYear=${encodeURIComponent(academicYear)}`
      : null,
  );

  const dashboard = dashboardRaw?.data;
  const frameworks = useMemo(() => frameworksRaw?.data ?? [], [frameworksRaw]);
  const activeFramework = frameworks.find((item) => item.slug === framework) ?? null;
  const requirements = useMemo(() => requirementsRaw?.data ?? [], [requirementsRaw]);
  const submissions = useMemo(() => submissionsRaw?.data ?? [], [submissionsRaw]);
  const filteredSubmissions = useMemo(
    () => submissions.filter((row) => !statusFilter || row.status === statusFilter),
    [statusFilter, submissions],
  );
  const submissionByRequirement = useMemo(
    () => new Map(submissions.map((row) => [row.requirementId._id, row])),
    [submissions],
  );
  const visibleRequirements = useMemo(
    () =>
      requirements.filter((requirement) => {
        if (requirementScope === 'all') return true;
        if (!requirement.ownerIds?.length) return true;
        return requirement.ownerIds.some((owner) => entityId(owner) === userId);
      }),
    [requirementScope, requirements, userId],
  );

  const openRecord = (requirement: IComplianceRequirement) => {
    if (!academicYear) {
      toast.info('Select an academic year before opening compliance records');
      return;
    }
    const record = submissionByRequirement.get(requirement._id) ?? null;
    if (!record && !canCreate) return;
    setSelected(requirement);
    setEditing(record);
  };

  const submittedById = (row: IComplianceSubmission) => {
    const submittedBy = row.submittedBy;
    return typeof submittedBy === 'string' ? submittedBy : submittedBy?._id;
  };

  const review = async (row: IComplianceSubmission, status: 'approved' | 'non_compliant') => {
    const response = await mutation(`compliance-workspace/submissions/${row._id}/review`, {
      method: 'PATCH',
      body: { status },
    });
    if (!response?.results?.success) return;
    toast.success(status === 'approved' ? 'Compliance record approved' : 'Marked non-compliant');
    refreshSubmissions();
    refreshDashboard();
  };

  const exportRegister = () => {
    if (!filteredSubmissions.length) {
      toast.info('There are no records to export');
      return;
    }
    const dynamicFields = Array.from(
      new Map(
        requirements.flatMap((item) => item.requiredFields).map((item) => [item.key, item]),
      ).values(),
    );
    const escapeCsv = (value: string | number | boolean | undefined) => {
      const text = String(value ?? '');
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const headers = [
      'Code',
      'Requirement',
      'Academic Year',
      'Period',
      'Status',
      ...dynamicFields.map((field) => field.label),
      'Remarks',
    ];
    const rows = filteredSubmissions.map((row) => [
      row.requirementId.code,
      row.requirementId.title,
      row.academicYear,
      row.period ?? '',
      row.status,
      ...dynamicFields.map((field) => row.values[field.key]),
      row.remarks ?? '',
    ]);
    const content = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${framework}-${academicYear}-compliance-register.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportAuditManifest = async () => {
    if (!academicYear) return;
    const query = new URLSearchParams({ academicYear });
    if (framework) query.set('framework', framework);
    const response = await mutation(`compliance-workspace/audit-package?${query.toString()}`, {
      method: 'GET',
    });
    const manifest = response?.results?.data;
    if (!manifest) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `compliance-audit-${academicYear}${framework ? `-${framework}` : ''}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success('Audit manifest exported');
  };

  const columns: Column<IComplianceSubmission>[] = [
    {
      field: 'requirementId',
      title: 'Requirement',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-800">{row.requirementId.title}</p>
          <p className="text-xs text-slate-600">{row.requirementId.code}</p>
        </div>
      ),
    },
    { field: 'period', title: 'Period', render: (row) => row.period || 'Full year' },
    {
      field: 'status',
      title: 'Status',
      render: (row) => (
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${STATUS_STYLE[row.status]}`}
        >
          {row.status.replace('_', ' ')}
        </span>
      ),
    },
    {
      field: 'updatedAt',
      title: 'Updated',
      render: (row) => new Date(row.updatedAt).toLocaleDateString('en-IN'),
    },
    {
      field: 'evidenceValidUntil',
      title: 'Evidence validity',
      render: (row) =>
        row.evidenceValidUntil
          ? new Date(row.evidenceValidUntil).toLocaleDateString('en-IN')
          : 'Not specified',
    },
  ];
  const actions: Action<IComplianceSubmission>[] = [
    {
      icon: canEdit ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />,
      tooltip: canEdit ? 'Open record' : 'View record',
      onClick: (row) => {
        setSelected(row.requirementId);
        setEditing(row);
      },
    },
    {
      icon: <CheckCircle2 className="h-4 w-4" />,
      tooltip: 'Approve',
      onClick: (row) => review(row, 'approved'),
      hidden: (row) => !canReview || row.status !== 'submitted' || submittedById(row) === userId,
    },
    {
      icon: <ShieldAlert className="h-4 w-4" />,
      tooltip: 'Mark non-compliant',
      onClick: (row) => review(row, 'non_compliant'),
      hidden: (row) => !canReview || row.status !== 'submitted' || submittedById(row) === userId,
    },
  ];

  const ComplianceRegisterEmptyState = () => (
    <Empty
      title={statusFilter ? 'No records match this status' : 'No compliance evidence recorded'}
      subTitle={
        statusFilter
          ? 'Choose another workflow status or clear the filter.'
          : canCreate
            ? 'Open a requirement above to create and submit its first evidence record.'
            : 'Your role can view this register. An authorized contributor must create the first evidence record.'
      }
      pathName={statusFilter ? 'Clear status filter' : undefined}
      onClick={statusFilter ? () => setStatusFilter('') : undefined}
    />
  );

  const tabs: { id: TTab; label: string; detail: string; icon: typeof BarChart3 }[] = [
    { id: 'overview', label: 'Overview', detail: 'Readiness and review', icon: BarChart3 },
    ...frameworks.map((item) => ({
      id: item.slug,
      label: item.shortName,
      detail: 'Requirements and evidence',
      icon: ShieldCheck,
    })),
    {
      id: 'findings',
      label: 'Findings',
      detail: 'Corrective actions',
      icon: ShieldAlert,
    },
    ...(canUseTally
      ? [
          {
            id: 'tally' as const,
            label: 'Tally',
            detail: 'Finance export',
            icon: FileSpreadsheet,
          },
        ]
      : []),
  ];
  const stats: { label: string; value: number; icon: LucideIcon; color: string }[] = [
    {
      label: 'Requirements',
      value: dashboard?.totalRequirements ?? 0,
      icon: BookOpenCheck,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Approved',
      value: dashboard?.approved ?? 0,
      icon: CheckCircle2,
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Awaiting review',
      value: dashboard?.submitted ?? 0,
      icon: History,
      color: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Non-compliant',
      value: dashboard?.nonCompliant ?? 0,
      icon: ShieldAlert,
      color: 'bg-red-50 text-red-600',
    },
  ];

  if (!canView) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-lg font-semibold text-slate-900">Compliance access unavailable</h1>
        <p className="mt-1 text-sm text-slate-600">
          The active role is not authorized for compliance records.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <QualityWorkflowBar />
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Compliance</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Define regulatory requirements, collect evidence, review submissions and resolve gaps.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full sm:w-56">
            <AsyncSelect
              type="academicYears"
              label="Academic year"
              value={academicYear || null}
              onChange={(value) => setAcademicYear(value ?? '')}
              placeholder="Select academic year"
            />
          </div>
          {canConfigure && (
            <CustomButton
              onClick={() => {
                setEditingFramework(null);
                setCatalogOpen(true);
              }}
              startIcon={<Plus className="h-4 w-4" />}
            >
              New framework
            </CustomButton>
          )}
        </div>
      </header>

      <nav
        className="flex w-fit max-w-full gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2"
        role="tablist"
        aria-label="Compliance workspace"
      >
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={visibleTab === item.id}
              onClick={() => setTab(item.id)}
              className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors ${visibleTab === item.id ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${visibleTab === item.id ? 'bg-white/15' : 'bg-slate-100'}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-xs font-bold">{item.label}</span>
                <span
                  className={`mt-0.5 block text-[10px] ${visibleTab === item.id ? 'text-white/75' : 'text-slate-400'}`}
                >
                  {item.detail}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      {(frameworksError || dashboardError || requirementsError || submissionsError) && (
        <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-red-800">Compliance data could not be loaded</p>
            <p className="text-sm text-red-700">Check your connection or access, then retry.</p>
          </div>
          <button
            className="min-h-10 rounded-xl border border-red-200 bg-white px-3.5 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            type="button"
            onClick={() => {
              refreshFrameworks();
              if (academicYear) refreshDashboard();
              if (framework) {
                refreshRequirements();
                if (academicYear) refreshSubmissions();
              }
            }}
          >
            Retry
          </button>
        </div>
      )}

      {!academicYear && frameworks.length > 0 && (
        <div className="rounded-2xl bg-white">
          <Empty
            title="Select an academic year"
            subTitle="Choose the reporting cycle above to load compliance readiness, evidence and review records."
          />
        </div>
      )}

      {!frameworksError && frameworks.length === 0 && (
        <div className="rounded-2xl bg-white">
          <Empty
            title="No compliance frameworks configured"
            subTitle={
              canConfigure
                ? 'Set up the institution’s first applicable standard, then define its requirements and evidence fields.'
                : 'A Quality Administrator must set up the institution’s applicable standards before evidence collection can begin.'
            }
            pathName={canConfigure ? 'Choose frameworks' : undefined}
            onClick={canConfigure ? () => setCatalogOpen(true) : undefined}
          />
        </div>
      )}

      {visibleTab === 'overview' &&
        academicYear &&
        frameworks.length > 0 &&
        (dashboardLoading || (dashboard?.totalSubmissions ?? 0) > 0 ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map(({ label, value, icon: Icon, color }) => (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={label}
                  className="rounded-2xl bg-white p-4"
                >
                  <div className={`inline-flex rounded-xl p-2.5 ${color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-2xl font-bold text-slate-900">
                    {dashboardLoading ? '—' : value}
                  </p>
                  <p className="text-xs font-semibold text-slate-500">{label}</p>
                </motion.div>
              ))}
            </div>
            <ComplianceInsights
              dashboard={dashboard}
              isLoading={dashboardLoading}
              onOpenFramework={setTab}
            />
            {(canViewNaac || canViewNba || canViewAudit) && (
              <div className="grid gap-4 md:grid-cols-2">
                {(canViewNaac || canViewNba) && (
                  <button
                    onClick={() => router.push(`${roleBase}/accreditation`)}
                    className="flex items-center justify-between rounded-2xl bg-white p-5 text-left"
                  >
                    <span className="flex items-center gap-3">
                      <span className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                        <FileSpreadsheet className="h-5 w-5" />
                      </span>
                      <span>
                        <strong className="block text-slate-900">Accreditation exports</strong>
                        <small className="text-slate-500">NAAC and NBA compliance CSV files</small>
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-600" />
                  </button>
                )}
                {canViewAudit && (
                  <button
                    onClick={() => router.push(`${roleBase}/audit-log`)}
                    className="flex items-center justify-between rounded-2xl bg-white p-5 text-left"
                  >
                    <span className="flex items-center gap-3">
                      <span className="rounded-2xl bg-violet-50 p-3 text-violet-600">
                        <History className="h-5 w-5" />
                      </span>
                      <span>
                        <strong className="block text-slate-900">Audit trail</strong>
                        <small className="text-slate-500">Review immutable system activity</small>
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-600" />
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-white">
            <Empty
              title="No compliance evidence for this academic year"
              subTitle={
                canCreate
                  ? 'Open a framework and complete its first requirement to begin readiness analytics.'
                  : 'Your role can view compliance analytics. An authorized contributor must submit the first evidence record.'
              }
              pathName={canCreate ? 'Open first framework' : undefined}
              onClick={canCreate ? () => setTab(frameworks[0].slug) : undefined}
            />
          </div>
        ))}

      {framework && academicYear && (
        <div className="space-y-5">
          {activeFramework && (
            <section className="rounded-2xl bg-white p-5">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                    <ShieldCheck className="h-4 w-4" />
                    {activeFramework.authority || activeFramework.country}
                  </div>
                  <h2 className="mt-2 text-xl font-bold text-slate-900">{activeFramework.name}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Version {activeFramework.version} · {activeFramework.country}
                    {activeFramework.region ? ` / ${activeFramework.region}` : ''}
                  </p>
                </div>
                {canConfigure && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingFramework(activeFramework);
                      setFrameworkModal(true);
                    }}
                    className="inline-flex min-h-10 w-fit items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <Settings2 className="h-4 w-4" />
                    Configure framework
                  </button>
                )}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {[
                  ['1', 'Choose requirement', 'Open the obligation that needs evidence.'],
                  ['2', 'Record and submit', 'Complete required fields and attach verified files.'],
                  ['3', 'Review and resolve', 'An independent reviewer approves or records a gap.'],
                ].map(([step, title, detail]) => (
                  <div key={step} className="flex gap-3 rounded-xl bg-slate-50 p-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-primary">
                      {step}
                    </span>
                    <span>
                      <strong className="block text-xs text-slate-700">{title}</strong>
                      <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">
                        {detail}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
          {canExport && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={exportAuditManifest}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                <FileSpreadsheet className="h-4 w-4" /> Export audit manifest
              </button>
            </div>
          )}
          {canConfigure && (
            <div className="flex flex-wrap justify-end gap-2">
              <CustomButton
                variant="primary"
                onClick={() => setRequirementModal(true)}
                startIcon={<Plus className="h-4 w-4" />}
              >
                Add {activeFramework?.terminology.requirement ?? 'requirement'}
              </CustomButton>
            </div>
          )}
          {requirements.length > 0 && (
            <div className="flex w-fit overflow-hidden rounded-lg border border-slate-200 bg-white">
              {(['all', 'mine'] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setRequirementScope(scope)}
                  className={`min-h-9 px-3 py-1.5 text-xs font-semibold ${requirementScope === scope ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  {scope === 'all' ? 'All requirements' : 'My work'}
                </button>
              ))}
            </div>
          )}
          {requirements.length > 0 ? (
            visibleRequirements.length > 0 ? (
              <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visibleRequirements.map((requirement) => {
                  const record = submissionByRequirement.get(requirement._id);
                  return (
                    <motion.button
                      whileHover={{ y: -3 }}
                      key={requirement._id}
                      onClick={() => openRecord(requirement)}
                      disabled={!academicYear || (!record && !canCreate)}
                      className="rounded-2xl bg-white p-5 text-left disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
                          {requirement.code}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${STATUS_STYLE[record?.status ?? 'not_started']}`}
                        >
                          {(record?.status ?? 'not_started').replace('_', ' ')}
                        </span>
                      </div>
                      <h3 className="mt-5 font-black text-slate-900">{requirement.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {requirement.category} · {requirement.frequency.replace('_', ' ')}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1">
                          <UsersRound className="h-3 w-3" />
                          {requirement.ownerIds?.length
                            ? `${requirement.ownerIds.length} owner${requirement.ownerIds.length === 1 ? '' : 's'}`
                            : 'Shared ownership'}
                        </span>
                        {requirement.dueMonth && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1">
                            <CalendarClock className="h-3 w-3" /> Due month {requirement.dueMonth}
                          </span>
                        )}
                      </div>
                      {requirement.targetValue !== undefined && (
                        <p className="mt-4 text-xs font-bold text-primary">
                          Target: {requirement.targetValue} {requirement.unit}
                        </p>
                      )}
                      <span className="mt-5 flex items-center gap-1 text-xs font-bold text-slate-500">
                        <Plus className="h-3.5 w-3.5" />{' '}
                        {record
                          ? canEdit && !['submitted', 'approved'].includes(record.status)
                            ? 'Update record'
                            : 'View record'
                          : canCreate
                            ? 'Start compliance record'
                            : 'No record submitted'}
                      </span>
                    </motion.button>
                  );
                })}
              </section>
            ) : (
              <div className="rounded-2xl bg-white">
                <Empty
                  title="No compliance work assigned to you"
                  subTitle="Requirements assigned to you or shared with your team will appear here."
                  pathName="View all requirements"
                  onClick={() => setRequirementScope('all')}
                />
              </div>
            )
          ) : (
            <div className="rounded-2xl bg-white">
              <Empty
                title={`No ${activeFramework?.terminology.requirement?.toLowerCase() ?? 'requirements'} configured`}
                subTitle={
                  canConfigure
                    ? 'Create the first requirement to define what evidence must be collected.'
                    : 'A Quality Administrator must define this framework’s requirements before evidence collection can begin.'
                }
                pathName={canConfigure ? 'Add first requirement' : undefined}
                onClick={canConfigure ? () => setRequirementModal(true) : undefined}
              />
            </div>
          )}
          {requirements.length > 0 && (
            <section className="overflow-hidden rounded-2xl bg-white">
              <CustomTable
                data={filteredSubmissions}
                columns={columns}
                actions={actions}
                isLoading={submissionsLoading || requirementsLoading || reviewing}
                title={`${activeFramework?.terminology.submission ?? 'Submission'} register`}
                description={`Review ${activeFramework?.shortName ?? framework.toUpperCase()} evidence ownership, reporting periods and workflow decisions.`}
                onRefresh={() => {
                  refreshSubmissions();
                  refreshDashboard();
                }}
                isValidating={submissionsLoading}
                customActions={
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      aria-label="Compliance workflow status"
                      className="min-h-9 w-40 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">All statuses</option>
                      <option value="in_progress">In progress</option>
                      <option value="submitted">Submitted</option>
                      <option value="approved">Approved</option>
                      <option value="non_compliant">Non-compliant</option>
                    </select>
                    {canExport && (
                      <button
                        type="button"
                        onClick={exportRegister}
                        className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" /> Export CSV
                      </button>
                    )}
                  </div>
                }
                components={{ emptyState: ComplianceRegisterEmptyState }}
                options={{ search: true, refresh: true, pagination: true, pageSize: 10 }}
              />
            </section>
          )}
        </div>
      )}
      {visibleTab === 'tally' && canUseTally && <TallyIntegrationPanel />}
      {visibleTab === 'findings' && academicYear && (
        <ComplianceFindingsPanel
          academicYear={academicYear}
          userId={userId}
          canCreateFinding={canReview}
          canEdit={canEdit}
          canVerify={canReview}
        />
      )}

      <ComplianceRecordModal
        key={selected?._id ?? 'no-compliance-record'}
        open={Boolean(selected)}
        requirement={selected}
        submission={editing}
        academicYear={academicYear}
        readOnly={
          (!editing && !canCreate) ||
          (Boolean(editing) && !canEdit) ||
          Boolean(editing && ['submitted', 'approved'].includes(editing.status))
        }
        onClose={() => {
          setSelected(null);
          setEditing(null);
        }}
        onSaved={() => {
          refreshSubmissions();
          refreshDashboard();
        }}
      />
      {framework && (
        <RequirementModal
          open={requirementModal}
          framework={framework}
          onClose={() => setRequirementModal(false)}
          onSaved={() => {
            refreshRequirements();
            refreshDashboard();
          }}
        />
      )}
      <FrameworkModal
        key={editingFramework?._id ?? 'new-framework'}
        open={frameworkModal}
        framework={editingFramework}
        onClose={() => {
          setFrameworkModal(false);
          setEditingFramework(null);
        }}
        onSaved={() => {
          refreshFrameworks();
          refreshDashboard();
        }}
      />
      <FrameworkCatalogModal
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        onActivated={() => refreshFrameworks()}
        onCreateCustom={() => {
          setCatalogOpen(false);
          setEditingFramework(null);
          setFrameworkModal(true);
        }}
      />
    </div>
  );
}

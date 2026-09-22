'use client';

import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Column } from '@/shared/core/CustomTable';
import Empty from '@/shared/core/Empty';
import AsyncSelect from '@/shared/core/AsyncSelect';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { motion } from '@/shared/utils/motion';
import {
  BarChart3,
  Check,
  Download,
  FileBarChart,
  Filter,
  Plus,
  Save,
  Trash2,
  X,
  Search,
  CalendarClock,
  CircleAlert,
  Eye,
  RotateCw,
  ShieldCheck,
  Users,
  Clock3,
  Database,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useHasPermission } from '@/shared/hooks/useHasPermission';

type TValue = string | number | boolean | null;
interface IReportRow {
  _id?: string;
  [key: string]: TValue | undefined;
}
interface IField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean';
  options?: string[];
}
interface IDataset {
  key: string;
  label: string;
  description: string;
  fields: IField[];
  asOfField?: string;
}
interface IFilter {
  field: string;
  operator: string;
  value: string;
  secondValue?: string;
}
interface IReport {
  _id: string;
  name: string;
  description?: string;
  dataset: string;
  columns: string[];
  filters: IFilter[];
  sort: { field: string; direction: 'asc' | 'desc' }[];
  visibility: 'private' | 'roles' | 'institution';
  allowedRoles: string[];
  status: 'draft' | 'pending_approval' | 'published' | 'retired';
  version: number;
  definitionKey: string;
  updatedAt: string;
  canEdit: boolean;
  canApprove: boolean;
}
interface ISnapshot {
  _id: string;
  snapshotNumber: string;
  definitionVersion: number;
  asOf: string;
  rowCount: number;
  total: number;
  snapshotHash: string;
  [key: string]: unknown;
}
interface IApiResponse<T> {
  success: boolean;
  data: T;
}
interface IResult {
  rows: IReportRow[];
  total: number;
  truncated: boolean;
}
interface IUserOption {
  _id: string;
  name: string;
  email: string;
}
interface ISchedule {
  _id: string;
  reportDefinitionId: IReport | string;
  cronExpression: string;
  timezone: string;
  format: 'json' | 'csv';
  recipientUserIds: Array<IUserOption | string>;
  asOfMode: 'run_time' | 'previous_day' | 'previous_month_end';
  status: 'active' | 'paused';
  lastRunAt?: string;
  lastError?: string;
  [key: string]: unknown;
}

const OPERATORS = [
  { value: 'eq', label: 'Equals' },
  { value: 'ne', label: 'Not equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'gte', label: 'At least' },
  { value: 'lte', label: 'At most' },
  { value: 'between', label: 'Between' },
  { value: 'in', label: 'In list' },
];

function describeCron(expression: string) {
  const [minute, hour, day, , weekday] = expression.split(' ');
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  if (weekday !== '*') {
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `Every ${names[Number(weekday)] ?? 'week'} at ${time}`;
  }
  if (day !== '*') return `Monthly on day ${day} at ${time}`;
  return `Daily at ${time}`;
}

export default function ReportCenterPage() {
  const {
    data: metadataRaw,
    error: metadataError,
    mutate: refreshMetadata,
  } = useSwr<IApiResponse<IDataset[]>>('report-center/metadata');
  const {
    data: reportsRaw,
    mutate: refreshReports,
    isLoading,
    error: reportsError,
  } = useSwr<IApiResponse<IReport[]>>('report-center');
  const {
    data: snapshotsRaw,
    mutate: refreshSnapshots,
    error: snapshotsError,
  } = useSwr<IApiResponse<ISnapshot[]>>('report-center/snapshots');
  const {
    data: schedulesRaw,
    mutate: refreshSchedules,
    error: schedulesError,
  } = useSwr<IApiResponse<ISchedule[]>>('report-center/schedules');
  const { mutation, isLoading: working } = useMutation();
  const canCreateReports = useHasPermission('report_center', 'create');
  const canEditReports = useHasPermission('report_center', 'edit');
  const canApproveReports = useHasPermission('report_center', 'approve');
  const canExportReports = useHasPermission('report_center', 'export');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [datasetKey, setDatasetKey] = useState('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<IFilter[]>([]);
  const [sort, setSort] = useState<IReport['sort']>([]);
  const [visibility, setVisibility] = useState<IReport['visibility']>('private');
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
  const [result, setResult] = useState<IResult | null>(null);
  const [activeReport, setActiveReport] = useState<IReport | null>(null);
  const [asOf, setAsOf] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | IReport['status']>('all');
  const [workspace, setWorkspace] = useState<'reports' | 'schedules' | 'snapshots'>('reports');
  const [schedulingReport, setSchedulingReport] = useState<IReport | null>(null);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [scheduleFrequency, setScheduleFrequency] = useState<'daily' | 'weekly' | 'monthly'>(
    'weekly',
  );
  const [scheduleTime, setScheduleTime] = useState('07:00');
  const [scheduleDay, setScheduleDay] = useState('1');
  const [scheduleFormat, setScheduleFormat] = useState<'csv' | 'json'>('csv');
  const [scheduleAsOf, setScheduleAsOf] = useState<ISchedule['asOfMode']>('previous_day');
  const { data: usersRaw } = useSwr<{ data?: { data?: IUserOption[] } }>(
    schedulingReport ? `user?search=${encodeURIComponent(recipientSearch)}&limit=25` : null,
  );

  const datasets = useMemo(() => metadataRaw?.data ?? [], [metadataRaw]);
  const reports = useMemo(() => reportsRaw?.data ?? [], [reportsRaw]);
  const snapshots = useMemo(() => snapshotsRaw?.data ?? [], [snapshotsRaw]);
  const schedules = useMemo(() => schedulesRaw?.data ?? [], [schedulesRaw]);
  const recipientOptions = useMemo(() => usersRaw?.data?.data ?? [], [usersRaw]);
  const visibleReports = useMemo(() => {
    const query = reportSearch.trim().toLowerCase();
    return reports.filter((report) => {
      const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
      const matchesQuery =
        !query ||
        [report.name, report.description, report.dataset]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));
      return matchesStatus && matchesQuery;
    });
  }, [reports, reportSearch, statusFilter]);
  const dataset = datasets.find((item) => item.key === datasetKey);
  const fieldMap = useMemo(
    () => new Map((dataset?.fields ?? []).map((field) => [field.key, field])),
    [dataset],
  );
  const hasWorkspaceError = Boolean(metadataError || reportsError);
  const publishedCount = reports.filter((report) => report.status === 'published').length;
  const attentionCount = reports.filter((report) =>
    ['draft', 'pending_approval'].includes(report.status),
  ).length;
  const builderProgress = [
    Boolean(datasetKey),
    selectedColumns.length > 0,
    Boolean(name.trim()),
  ].filter(Boolean).length;
  const canSaveReport =
    builderProgress === 3 &&
    (visibility !== 'roles' || allowedRoles.length > 0) &&
    (editingId ? canEditReports : canCreateReports);
  const refreshWorkspace = async () => {
    await Promise.all([
      refreshMetadata(),
      refreshReports(),
      refreshSnapshots(),
      refreshSchedules(),
    ]);
  };

  const reset = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setDatasetKey('');
    setSelectedColumns([]);
    setFilters([]);
    setSort([]);
    setVisibility('private');
    setAllowedRoles([]);
    setResult(null);
  };
  const openNew = () => {
    reset();
    setBuilderOpen(true);
  };
  const openReport = (report: IReport) => {
    setEditingId(report._id);
    setName(report.name);
    setDescription(report.description ?? '');
    setDatasetKey(report.dataset);
    setSelectedColumns(report.columns);
    setFilters(report.filters);
    setSort(report.sort ?? []);
    setVisibility(report.visibility);
    setAllowedRoles(report.allowedRoles ?? []);
    setResult(null);
    setBuilderOpen(true);
  };
  const payload = () => ({
    name,
    description,
    dataset: datasetKey,
    columns: selectedColumns,
    filters,
    sort,
    visibility,
    allowedRoles: visibility === 'roles' ? allowedRoles : [],
  });
  const preview = async () => {
    if (!datasetKey || !selectedColumns.length) {
      toast.error('Choose a dataset and at least one column');
      return;
    }
    const response = await mutation('report-center/preview', {
      method: 'POST',
      body: { ...payload(), asOf: asOf || undefined },
    });
    const next = response?.results?.data as IResult | undefined;
    if (next) setResult(next);
  };
  const save = async () => {
    if (!name.trim()) {
      toast.error('Report name is required');
      return;
    }
    const response = await mutation(editingId ? `report-center/${editingId}` : 'report-center', {
      method: editingId ? 'PUT' : 'POST',
      body: payload(),
    });
    if (!response?.results?.success) return;
    toast.success('Report saved');
    refreshReports();
    setBuilderOpen(false);
    reset();
  };
  const runSaved = async (report: IReport) => {
    const response = await mutation(
      `report-center/${report._id}/run?limit=5000${asOf ? `&asOf=${encodeURIComponent(asOf)}` : ''}`,
      {
        method: 'GET',
      },
    );
    const data = response?.results?.data as
      | { rows?: IReportRow[]; total?: number; truncated?: boolean }
      | undefined;
    if (!data?.rows) return;
    setActiveReport(report);
    setResult({
      rows: data.rows,
      total: data.total ?? data.rows.length,
      truncated: Boolean(data.truncated),
    });
    toast.success(`${data.rows.length} rows ready to review`);
  };
  const submitDefinition = async (report: IReport) => {
    const response = await mutation(`report-center/${report._id}/submit`, {
      method: 'POST',
    });
    if (!response) return;
    toast.success('Report definition submitted for independent publication');
    await refreshReports();
  };
  const publishDefinition = async (report: IReport) => {
    const response = await mutation(`report-center/${report._id}/publish`, {
      method: 'POST',
    });
    if (!response) return;
    toast.success('Immutable report version published');
    await refreshReports();
  };
  const createSnapshot = async (report: IReport) => {
    const response = await mutation(`report-center/${report._id}/snapshot`, {
      method: 'POST',
      body: { asOf: asOf || undefined },
    });
    if (!response) return;
    toast.success('Tamper-evident as-of snapshot created');
    await refreshSnapshots();
  };
  const createSchedule = async () => {
    if (!schedulingReport || !selectedRecipients.length) {
      toast.error('Select at least one recipient');
      return;
    }
    const [hour, minute] = scheduleTime.split(':').map(Number);
    const cronExpression =
      scheduleFrequency === 'daily'
        ? `${minute} ${hour} * * *`
        : scheduleFrequency === 'weekly'
          ? `${minute} ${hour} * * ${scheduleDay}`
          : `${minute} ${hour} ${scheduleDay} * *`;
    const response = await mutation('report-center/schedules', {
      method: 'POST',
      body: {
        reportDefinitionId: schedulingReport._id,
        cronExpression,
        timezone: 'Asia/Kolkata',
        format: scheduleFormat,
        recipientUserIds: selectedRecipients,
        asOfMode: scheduleAsOf,
      },
    });
    if (!response?.results?.success) return;
    toast.success('Report delivery scheduled');
    setSchedulingReport(null);
    setSelectedRecipients([]);
    refreshSchedules();
  };
  const toggleSchedule = async (schedule: ISchedule) => {
    const nextStatus = schedule.status === 'active' ? 'paused' : 'active';
    const response = await mutation(`report-center/schedules/${schedule._id}/status`, {
      method: 'PATCH',
      body: { status: nextStatus },
    });
    if (!response?.results?.success) return;
    toast.success(
      nextStatus === 'active' ? 'Scheduled delivery resumed' : 'Scheduled delivery paused',
    );
    refreshSchedules();
  };
  const downloadCsv = (
    fileName: string,
    columns: string[],
    rows: IReportRow[],
    fields: IField[],
  ) => {
    const escape = (value: TValue | undefined) => {
      const text = String(value ?? '');
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const labelsByKey = new Map(fields.map((field) => [field.key, field.label]));
    const labels = columns.map((key) => labelsByKey.get(key) ?? key);
    const content = [labels, ...rows.map((row) => columns.map((key) => row[key]))]
      .map((row) => row.map(escape).join(','))
      .join('\n');
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${fileName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const previewColumns: Column<IReportRow>[] = selectedColumns.map((key) => ({
    field: key,
    title: fieldMap.get(key)?.label ?? key,
    render: (row) => {
      const value = row[key];
      if (fieldMap.get(key)?.type === 'date' && typeof value === 'string')
        return new Date(value).toLocaleDateString('en-IN');
      return typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '—');
    },
  }));

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            <FileBarChart className="h-4 w-4" /> Analytics
          </div>
          <h1 className="text-3xl font-black text-slate-950">Report Center</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Build reusable reports from approved institution data, review live results and preserve
            trustworthy evidence without technical queries.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={asOf}
            onChange={(event) => setAsOf(event.target.value)}
            aria-label="Report as-of date"
            className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200 outline-none"
          />
          {canCreateReports ? (
            <CustomButton
              variant="primary"
              onClick={openNew}
              startIcon={<Plus className="h-4 w-4" />}
            >
              Build report
            </CustomButton>
          ) : (
            <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
              View and run access
            </span>
          )}
        </div>
      </header>
      {hasWorkspaceError && (
        <section className="flex flex-col gap-4 rounded-3xl bg-rose-50 p-5 text-rose-700 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h2 className="font-bold">Report Center could not load institution data</h2>
              <p className="mt-1 text-sm text-rose-600">
                No report was changed. Check the connection and try loading your role workspace
                again.
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
      <section className="rounded-3xl bg-blue-50 p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
              Guided workspace
            </p>
            <h2 className="mt-2 text-xl font-black text-slate-950">
              Turn live records into a controlled, reusable report
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Choose an approved dataset, select only the information you need, preview the result,
              then save it privately or send it through review before sharing.
            </p>
          </div>
          <div className="grid shrink-0 gap-2 text-sm sm:grid-cols-3 lg:w-[30rem]">
            {['Choose data', 'Preview safely', 'Save or share'].map((label, index) => (
              <div key={label} className="rounded-2xl bg-white p-3 text-slate-700">
                <span className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-black text-blue-700">
                  {index + 1}
                </span>
                <span className="font-bold">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-100">
          <BarChart3 className="h-5 w-5 text-primary" />
          <p className="mt-4 text-3xl font-black text-slate-950">{reports.length}</p>
          <p className="text-sm text-slate-500">Saved reports</p>
        </div>
        <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-100">
          <Check className="h-5 w-5 text-emerald-600" />
          <p className="mt-4 text-3xl font-black text-slate-950">{datasets.length}</p>
          <p className="text-sm text-slate-500">Governed datasets</p>
        </div>
        <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-100">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <p className="mt-4 text-3xl font-black text-slate-950">{publishedCount}</p>
          <p className="text-sm text-slate-500">Ready to run</p>
        </div>
        <div className="rounded-3xl bg-amber-50 p-5 ring-1 ring-amber-100">
          <Clock3 className="h-5 w-5 text-amber-700" />
          <p className="mt-4 text-3xl font-black text-slate-950">{attentionCount}</p>
          <p className="text-sm text-slate-600">Awaiting action</p>
        </div>
      </div>
      <nav
        role="tablist"
        aria-label="Report Center workspaces"
        className="grid gap-2 rounded-3xl bg-white p-2 sm:grid-cols-3"
      >
        {[
          {
            id: 'reports' as const,
            label: 'Reports',
            description: 'Build, review and run',
            count: reports.length,
            icon: BarChart3,
          },
          {
            id: 'schedules' as const,
            label: 'Schedules',
            description: 'Automatic report runs',
            count: schedules.length,
            icon: CalendarClock,
          },
          {
            id: 'snapshots' as const,
            label: 'Evidence snapshots',
            description: 'Historical audit records',
            count: snapshots.length,
            icon: ShieldCheck,
          },
        ].map((item) => {
          const Icon = item.icon;
          const selected = workspace === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setWorkspace(item.id)}
              className={`flex min-w-0 items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${
                selected ? 'bg-blue-50 text-blue-800' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  selected ? 'bg-blue-100' : 'bg-slate-100'
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-black">{item.label}</span>
                <span className="block truncate text-xs opacity-75">{item.description}</span>
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black">
                {item.count}
              </span>
            </button>
          );
        })}
      </nav>
      {workspace === 'reports' && (
        <div role="tabpanel" className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-4 top-3 h-4 w-4 text-slate-600" />
              <input
                value={reportSearch}
                onChange={(event) => setReportSearch(event.target.value)}
                className="w-full rounded-2xl bg-white py-2.5 pl-11 pr-4 text-sm outline-none ring-1 ring-slate-100 focus:ring-primary/30"
                placeholder="Search by report name, description or dataset…"
              />
            </div>
            <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-white p-1">
              {(['all', 'published', 'draft', 'pending_approval'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold capitalize transition-colors ${
                    statusFilter === status
                      ? 'bg-blue-100 text-blue-800'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {status.replaceAll('_', ' ')}
                </button>
              ))}
            </div>
          </div>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {isLoading &&
              [0, 1, 2].map((item) => (
                <div key={item} className="h-52 animate-pulse rounded-3xl bg-white" />
              ))}
            {visibleReports.map((report) => (
              <motion.div
                whileHover={{ y: -3 }}
                key={report._id}
                className="rounded-3xl bg-white p-5"
              >
                <div className="flex items-start justify-between">
                  <span className="rounded-xl bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                    {datasets.find((item) => item.key === report.dataset)?.label ?? report.dataset}
                  </span>
                  <span className="text-xs capitalize text-slate-600">
                    v{report.version ?? 1} · {(report.status ?? 'published').replaceAll('_', ' ')}
                  </span>
                </div>
                <h3 className="mt-5 font-black text-slate-900">{report.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                  {report.description ||
                    `${report.columns.length} columns · ${report.filters.length} filters`}
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                  {report.canEdit && canEditReports ? (
                    <button
                      onClick={() => openReport(report)}
                      className="text-xs font-bold text-primary"
                    >
                      Create new version
                    </button>
                  ) : (
                    <span className="text-xs font-medium text-slate-400">Shared with you</span>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {report.canEdit && canEditReports && report.status === 'draft' && (
                      <CustomButton variant="tertiary" onClick={() => submitDefinition(report)}>
                        Submit
                      </CustomButton>
                    )}
                    {canApproveReports &&
                      report.canApprove &&
                      report.status === 'pending_approval' && (
                        <CustomButton variant="primary" onClick={() => publishDefinition(report)}>
                          Publish
                        </CustomButton>
                      )}
                    {(report.status ?? 'published') === 'published' && (
                      <>
                        {canExportReports && (
                          <CustomButton variant="tertiary" onClick={() => createSnapshot(report)}>
                            Snapshot
                          </CustomButton>
                        )}
                        {canCreateReports && (
                          <CustomButton
                            variant="tertiary"
                            onClick={() => {
                              setSchedulingReport(report);
                              setSelectedRecipients([]);
                            }}
                          >
                            Schedule
                          </CustomButton>
                        )}
                        <CustomButton
                          variant="secondary"
                          onClick={() => runSaved(report)}
                          startIcon={<Eye className="h-4 w-4" />}
                        >
                          Run
                        </CustomButton>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
            {!isLoading && !visibleReports.length && (
              <div className="rounded-3xl bg-white md:col-span-2 xl:col-span-3">
                <Empty
                  title={
                    reports.length ? 'No reports match these filters' : 'No reusable reports yet'
                  }
                  subTitle={
                    reports.length
                      ? 'Try another name or dataset.'
                      : 'Build a governed report once, then run, schedule or snapshot it whenever needed.'
                  }
                  pathName={!reports.length && canCreateReports ? 'Build first report' : undefined}
                  onClick={!reports.length && canCreateReports ? openNew : undefined}
                />
              </div>
            )}
          </section>

          {activeReport && result && (
            <section className="overflow-hidden rounded-3xl bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">
                    Live result
                  </p>
                  <h2 className="font-black text-slate-900">{activeReport.name}</h2>
                  <p className="text-xs text-slate-500">
                    {result.total} matching records
                    {result.truncated ? ` · showing the first ${result.rows.length}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  {canExportReports && (
                    <CustomButton
                      variant="secondary"
                      startIcon={<Download className="h-4 w-4" />}
                      onClick={() =>
                        downloadCsv(
                          activeReport.name,
                          activeReport.columns,
                          result.rows,
                          datasets.find((item) => item.key === activeReport.dataset)?.fields ?? [],
                        )
                      }
                    >
                      Export CSV
                    </CustomButton>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveReport(null);
                      setResult(null);
                    }}
                    className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"
                    aria-label="Close report result"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <CustomTable
                data={result.rows}
                columns={activeReport.columns.map((key) => ({
                  field: key,
                  title:
                    datasets
                      .find((item) => item.key === activeReport.dataset)
                      ?.fields.find((field) => field.key === key)?.label ?? key,
                }))}
                options={{ search: false, pagination: true, pageSize: 20 }}
              />
            </section>
          )}
        </div>
      )}

      {workspace === 'schedules' && (
        <section role="tabpanel" className="rounded-3xl bg-white p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-black text-slate-900">Scheduled delivery</h2>
              <p className="text-xs text-slate-500">
                Human-readable schedules with recipient and last-run visibility.
              </p>
            </div>
          </div>
          {schedulesError && (
            <div className="mb-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-700">
              Scheduled deliveries could not be loaded. Your existing schedules were not changed.
            </div>
          )}
          {!schedulesError && schedules.length === 0 ? (
            <Empty
              title="No scheduled deliveries"
              subTitle="Run a published report, then choose Schedule to deliver it automatically."
            />
          ) : (
            <CustomTable<ISchedule>
              data={schedules}
              columns={[
                {
                  field: 'reportDefinitionId',
                  title: 'Report',
                  render: (row) =>
                    typeof row.reportDefinitionId === 'object'
                      ? row.reportDefinitionId.name
                      : 'Saved report',
                },
                {
                  field: 'cronExpression',
                  title: 'Schedule',
                  render: (row) => describeCron(row.cronExpression),
                },
                {
                  field: 'recipientUserIds',
                  title: 'Recipients',
                  render: (row) => `${row.recipientUserIds.length} recipient(s)`,
                },
                { field: 'format', title: 'Format' },
                {
                  field: 'lastRunAt',
                  title: 'Last delivery',
                  render: (row) =>
                    row.lastRunAt ? new Date(row.lastRunAt).toLocaleString('en-IN') : 'Not run yet',
                },
                {
                  field: 'status',
                  title: 'Health',
                  render: (row) => (
                    <div>
                      <button
                        type="button"
                        onClick={() => canEditReports && toggleSchedule(row)}
                        disabled={!canEditReports}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          row.lastError
                            ? 'bg-red-50 text-red-600'
                            : row.status === 'active'
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-slate-100 text-slate-500'
                        }`}
                        title={row.status === 'active' ? 'Pause delivery' : 'Resume delivery'}
                      >
                        {row.lastError
                          ? 'Delivery failed'
                          : row.status === 'active'
                            ? 'Delivering'
                            : 'Paused'}
                      </button>
                      {row.lastError && (
                        <p className="mt-1 max-w-52 text-xs text-red-500">
                          Check report access and recipients, then resume delivery.
                        </p>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          )}
        </section>
      )}
      {workspace === 'snapshots' && (
        <section role="tabpanel" className="rounded-3xl bg-white p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="font-black text-slate-900">As-of snapshot register</h2>
            <p className="text-xs text-slate-500">
              Immutable evidence retains the definition hash, version, date and row totals.
            </p>
          </div>
          {snapshotsError && (
            <div className="mb-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-700">
              Snapshot history could not be loaded. Try refreshing the page.
            </div>
          )}
          {!snapshotsError && snapshots.length === 0 ? (
            <Empty
              title="No evidence snapshots yet"
              subTitle="Choose Snapshot on a published report to retain an immutable as-of record."
            />
          ) : (
            <CustomTable<ISnapshot>
              data={snapshots}
              columns={[
                { field: 'snapshotNumber', title: 'Snapshot' },
                { field: 'definitionVersion', title: 'Definition version' },
                {
                  field: 'asOf',
                  title: 'As of',
                  render: (row) => new Date(row.asOf).toLocaleString('en-IN'),
                },
                { field: 'rowCount', title: 'Rows retained' },
                { field: 'total', title: 'Matching total' },
                {
                  field: 'snapshotHash',
                  title: 'Integrity hash',
                  render: (row) => (
                    <span className="font-mono text-xs">{row.snapshotHash.slice(0, 16)}…</span>
                  ),
                },
              ]}
            />
          )}
        </section>
      )}

      {schedulingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  Scheduled delivery
                </p>
                <h2 className="text-xl font-black text-slate-900">{schedulingReport.name}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Choose a simple frequency and real recipients. Delivery runs in Asia/Kolkata.
                </p>
              </div>
              <button
                onClick={() => setSchedulingReport(null)}
                className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                <span>Frequency</span>
                <select
                  value={scheduleFrequency}
                  onChange={(event) =>
                    setScheduleFrequency(event.target.value as typeof scheduleFrequency)
                  }
                  className="w-full rounded-xl bg-slate-100 px-3 py-2.5 font-normal"
                >
                  <option value="daily">Every day</option>
                  <option value="weekly">Every week</option>
                  <option value="monthly">Every month</option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                <span>Delivery time</span>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(event) => setScheduleTime(event.target.value)}
                  className="w-full rounded-xl bg-slate-100 px-3 py-2.5 font-normal"
                />
              </label>
              {scheduleFrequency !== 'daily' && (
                <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                  <span>{scheduleFrequency === 'weekly' ? 'Day of week' : 'Day of month'}</span>
                  {scheduleFrequency === 'weekly' ? (
                    <select
                      value={scheduleDay}
                      onChange={(event) => setScheduleDay(event.target.value)}
                      className="w-full rounded-xl bg-slate-100 px-3 py-2.5 font-normal"
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
                  ) : (
                    <input
                      type="number"
                      min={1}
                      max={28}
                      value={scheduleDay}
                      onChange={(event) => setScheduleDay(event.target.value)}
                      className="w-full rounded-xl bg-slate-100 px-3 py-2.5 font-normal"
                    />
                  )}
                </label>
              )}
              <label className="space-y-1.5 text-sm font-semibold text-slate-700">
                <span>File format</span>
                <select
                  value={scheduleFormat}
                  onChange={(event) => setScheduleFormat(event.target.value as 'csv' | 'json')}
                  className="w-full rounded-xl bg-slate-100 px-3 py-2.5 font-normal"
                >
                  <option value="csv">Excel-compatible CSV</option>
                  <option value="json">JSON data</option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
                <span>Data cut-off</span>
                <select
                  value={scheduleAsOf}
                  onChange={(event) => setScheduleAsOf(event.target.value as ISchedule['asOfMode'])}
                  className="w-full rounded-xl bg-slate-100 px-3 py-2.5 font-normal"
                >
                  <option value="run_time">Include data available at delivery time</option>
                  <option value="previous_day">Close at the previous day</option>
                  <option value="previous_month_end">Close at the previous month end</option>
                </select>
              </label>
            </div>
            <div className="mt-5 flex gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">
              <ShieldCheck className="h-5 w-5 shrink-0" />
              <p>
                Recipients are checked against this report&apos;s visibility and your active role
                before the schedule is saved.
              </p>
            </div>
            <div className="mt-5">
              <label className="text-sm font-semibold text-slate-700">Recipients</label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-600" />
                <input
                  value={recipientSearch}
                  onChange={(event) => setRecipientSearch(event.target.value)}
                  className="w-full rounded-xl bg-slate-100 py-2.5 pl-9 pr-3 text-sm outline-none"
                  placeholder="Search staff by name or email…"
                />
              </div>
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-100 p-2">
                {recipientOptions.map((person) => (
                  <label
                    key={person._id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRecipients.includes(person._id)}
                      onChange={() =>
                        setSelectedRecipients((current) =>
                          current.includes(person._id)
                            ? current.filter((id) => id !== person._id)
                            : [...current, person._id],
                        )
                      }
                    />
                    <Users className="h-4 w-4 text-slate-600" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-700">
                        {person.name}
                      </span>
                      <span className="block truncate text-xs text-slate-600">{person.email}</span>
                    </span>
                  </label>
                ))}
                {recipientSearch.trim() && recipientOptions.length === 0 && (
                  <p className="px-3 py-5 text-center text-sm text-slate-500">
                    No eligible people match this search.
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <CustomButton variant="secondary" onClick={() => setSchedulingReport(null)}>
                Cancel
              </CustomButton>
              <CustomButton variant="primary" loading={working} onClick={createSchedule}>
                Schedule delivery
              </CustomButton>
            </div>
          </motion.div>
        </div>
      )}

      {builderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-2 backdrop-blur-sm sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label={editingId ? 'Create a new report version' : 'Build a new report'}
            className="h-[calc(100dvh-1rem)] w-full max-w-[96rem] overflow-y-auto rounded-3xl bg-slate-50 p-4 sm:h-[calc(100dvh-2rem)] sm:p-6 lg:p-8"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  Visual report builder
                </p>
                <h2 className="text-xl font-black text-slate-900">
                  {editingId ? 'Create a new report version' : 'Build a new report'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  1. Choose data and columns · 2. Add filters · 3. Preview · 4. Save
                </p>
                <div
                  className="mt-3 flex items-center gap-3"
                  aria-label={`${builderProgress} of 3 required choices complete`}
                >
                  <div className="h-1.5 w-40 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full bg-blue-600 transition-all ${
                        builderProgress === 3
                          ? 'w-full'
                          : builderProgress === 2
                            ? 'w-2/3'
                            : builderProgress === 1
                              ? 'w-1/3'
                              : 'w-0'
                      }`}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {builderProgress}/3 required choices
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBuilderOpen(false)}
                className="rounded-full bg-white p-2 text-slate-500"
                aria-label="Close report builder"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6 grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
              <aside className="space-y-4 rounded-3xl bg-white p-5 xl:sticky xl:top-0 xl:self-start xl:p-6">
                <div className="rounded-2xl bg-blue-50 p-4">
                  <span className="text-xs font-black uppercase tracking-wider text-blue-700">
                    Step 1 · Report setup
                  </span>
                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    Name the report, choose its source and select what readers should see.
                  </p>
                </div>
                <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                  <span>Name</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-xl bg-slate-100 px-3 py-2.5 font-normal outline-none"
                  />
                </label>
                <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                  <span>Description</span>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="w-full resize-none rounded-xl bg-slate-100 px-3 py-2.5 font-normal outline-none"
                  />
                </label>
                <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                  <span className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-blue-600" /> Data source
                  </span>
                  <select
                    value={datasetKey}
                    onChange={(event) => {
                      setDatasetKey(event.target.value);
                      setSelectedColumns([]);
                      setFilters([]);
                      setResult(null);
                    }}
                    className="w-full rounded-xl bg-slate-100 px-3 py-2.5 font-normal outline-none"
                  >
                    <option value="">Choose dataset</option>
                    {datasets.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  {dataset && (
                    <span className="block rounded-xl bg-blue-50 p-3 text-xs font-normal leading-5 text-blue-800">
                      {dataset.description}
                      {dataset.asOfField
                        ? ` The as-of date is applied to ${dataset.asOfField === 'createdAt' ? 'when each record entered the system' : dataset.asOfField}.`
                        : ''}
                    </span>
                  )}
                </label>
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-700">Columns</p>
                    <span className="text-xs text-slate-500">
                      {selectedColumns.length} selected
                    </span>
                  </div>
                  <div className="max-h-60 space-y-1 overflow-y-auto">
                    {dataset?.fields.map((field) => (
                      <label
                        key={field.key}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedColumns.includes(field.key)}
                          onChange={(event) =>
                            setSelectedColumns((current) =>
                              event.target.checked
                                ? [...current, field.key]
                                : current.filter((key) => key !== field.key),
                            )
                          }
                        />
                        {field.label}
                      </label>
                    ))}
                  </div>
                </div>
                <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                  <span>Visibility</span>
                  <select
                    value={visibility}
                    onChange={(event) => setVisibility(event.target.value as IReport['visibility'])}
                    className="w-full rounded-xl bg-slate-100 px-3 py-2.5 font-normal outline-none"
                  >
                    <option value="private">Only me</option>
                    <option value="institution">Institution</option>
                    <option value="roles">Selected roles</option>
                  </select>
                </label>
                {visibility === 'roles' && (
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <AsyncSelect
                      type="roles"
                      multiple
                      required
                      label="Who can run it?"
                      value={allowedRoles}
                      onChange={(values) => setAllowedRoles(values)}
                      placeholder="Search and select roles…"
                      emptyMessage="No active institution roles are available for sharing."
                      limit={50}
                    />
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Selected roles can run the report after an independent reviewer publishes it.
                    </p>
                  </div>
                )}
              </aside>
              <main className="space-y-4">
                <section className="rounded-3xl bg-white p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-blue-700">
                        Step 2 · Optional
                      </p>
                      <h3 className="mt-1 font-black text-slate-900">Narrow the results</h3>
                      <p className="text-xs text-slate-500">
                        Add conditions only when you need a smaller, focused result.
                      </p>
                    </div>
                    <CustomButton
                      variant="secondary"
                      disabled={!dataset}
                      onClick={() =>
                        setFilters((current) => [
                          ...current,
                          { field: dataset?.fields[0]?.key ?? '', operator: 'eq', value: '' },
                        ])
                      }
                      startIcon={<Filter className="h-4 w-4" />}
                    >
                      Add filter
                    </CustomButton>
                  </div>
                  <div className="mt-3 space-y-2">
                    {filters.length === 0 && (
                      <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                        No filters added. The report will include every record you are allowed to
                        access.
                      </div>
                    )}
                    {filters.map((filter, index) => (
                      <div
                        key={index}
                        className="grid gap-2 rounded-2xl bg-slate-50 p-3 sm:grid-cols-[1fr_140px_1fr_40px]"
                      >
                        <select
                          value={filter.field}
                          onChange={(event) =>
                            setFilters((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, field: event.target.value } : item,
                              ),
                            )
                          }
                          className="rounded-xl bg-white px-3 py-2 text-sm outline-none"
                        >
                          {dataset?.fields.map((field) => (
                            <option key={field.key} value={field.key}>
                              {field.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={filter.operator}
                          onChange={(event) =>
                            setFilters((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, operator: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          className="rounded-xl bg-white px-3 py-2 text-sm outline-none"
                        >
                          {OPERATORS.map((operator) => (
                            <option key={operator.value} value={operator.value}>
                              {operator.label}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          {fieldMap.get(filter.field)?.options?.length &&
                          ['eq', 'ne'].includes(filter.operator) ? (
                            <select
                              value={filter.value}
                              onChange={(event) =>
                                setFilters((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, value: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 text-sm outline-none"
                            >
                              <option value="">Choose value</option>
                              {fieldMap.get(filter.field)?.options?.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : fieldMap.get(filter.field)?.type === 'boolean' ? (
                            <select
                              value={filter.value}
                              onChange={(event) =>
                                setFilters((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, value: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 text-sm outline-none"
                            >
                              <option value="">Choose value</option>
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                          ) : (
                            <input
                              type={
                                fieldMap.get(filter.field)?.type === 'date'
                                  ? 'date'
                                  : fieldMap.get(filter.field)?.type === 'number'
                                    ? 'number'
                                    : 'text'
                              }
                              value={filter.value}
                              onChange={(event) =>
                                setFilters((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, value: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              placeholder={`Enter ${fieldMap.get(filter.field)?.label?.toLowerCase() ?? 'filter value'}`}
                              aria-label={`${fieldMap.get(filter.field)?.label ?? 'Filter'} value`}
                              className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 text-sm outline-none"
                            />
                          )}
                          {filter.operator === 'between' && (
                            <input
                              type={
                                fieldMap.get(filter.field)?.type === 'date'
                                  ? 'date'
                                  : fieldMap.get(filter.field)?.type === 'number'
                                    ? 'number'
                                    : 'text'
                              }
                              value={filter.secondValue ?? ''}
                              onChange={(event) =>
                                setFilters((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, secondValue: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              placeholder={`Maximum ${fieldMap.get(filter.field)?.label?.toLowerCase() ?? 'value'}`}
                              aria-label={`${fieldMap.get(filter.field)?.label ?? 'Filter'} maximum value`}
                              className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 text-sm outline-none"
                            />
                          )}
                        </div>
                        <button
                          onClick={() =>
                            setFilters((current) =>
                              current.filter((_, itemIndex) => itemIndex !== index),
                            )
                          }
                          className="rounded-xl bg-red-50 text-red-500"
                        >
                          <Trash2 className="mx-auto h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="rounded-3xl bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-blue-700">
                        Step 3 · Optional
                      </p>
                      <h3 className="mt-1 font-black text-slate-900">Arrange the records</h3>
                      <p className="text-xs text-slate-500">
                        Choose how records should be ordered in previews and exports.
                      </p>
                    </div>
                    {sort.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSort([])}
                        className="text-xs font-semibold text-red-500"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_160px]">
                    <select
                      value={sort[0]?.field ?? ''}
                      onChange={(event) =>
                        setSort(
                          event.target.value
                            ? [
                                {
                                  field: event.target.value,
                                  direction: sort[0]?.direction ?? 'asc',
                                },
                              ]
                            : [],
                        )
                      }
                      className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none"
                    >
                      <option value="">Use natural order</option>
                      {selectedColumns.map((key) => (
                        <option key={key} value={key}>
                          {fieldMap.get(key)?.label ?? key}
                        </option>
                      ))}
                    </select>
                    <select
                      value={sort[0]?.direction ?? 'asc'}
                      disabled={!sort.length}
                      onChange={(event) =>
                        setSort((current) =>
                          current.length
                            ? [
                                {
                                  ...current[0],
                                  direction: event.target.value as 'asc' | 'desc',
                                },
                              ]
                            : current,
                        )
                      }
                      className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none disabled:opacity-50"
                    >
                      <option value="asc">Ascending</option>
                      <option value="desc">Descending</option>
                    </select>
                  </div>
                </section>
                <section className="overflow-hidden rounded-3xl bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-blue-700">
                        Step 4 · Review and finish
                      </p>
                      <h3 className="mt-1 font-black text-slate-900">Check the live preview</h3>
                      <p className="text-xs text-slate-500">
                        {result
                          ? `${result.total} matching records${result.truncated ? ' · preview limited' : ''}`
                          : 'Run preview to validate the report'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <CustomButton
                        variant="secondary"
                        onClick={preview}
                        loading={working}
                        disabled={!datasetKey || selectedColumns.length === 0}
                      >
                        Preview
                      </CustomButton>
                      <CustomButton
                        variant="primary"
                        onClick={save}
                        loading={working}
                        disabled={!canSaveReport}
                        startIcon={<Save className="h-4 w-4" />}
                      >
                        Save report
                      </CustomButton>
                    </div>
                  </div>
                  {result && (
                    <CustomTable
                      data={result.rows}
                      columns={previewColumns}
                      options={{ search: true, pagination: true, pageSize: 10 }}
                    />
                  )}
                </section>
              </main>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

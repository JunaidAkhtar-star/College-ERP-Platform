'use client';

import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Column } from '@/shared/core/CustomTable';
import Empty from '@/shared/core/Empty';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import {
  AlertTriangle,
  ArrowRight,
  DatabaseZap,
  Download,
  FileSpreadsheet,
  History,
  Upload,
  CheckCircle2,
  CircleAlert,
  RotateCcw,
  RotateCw,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { AnimatePresence, motion } from '@/shared/utils/motion';

interface IField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  aliases?: string[];
  example?: string;
}
interface ITarget {
  key: string;
  label: string;
  description: string;
  uniqueField: string;
  fields: IField[];
}
interface IRowError {
  row: number;
  field?: string;
  value?: string;
  message: string;
  [key: string]: unknown;
}
interface IImportJob {
  _id: string;
  target: string;
  sourceFileName: string;
  status: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  committedRows: number;
  processedRows: number;
  failedRows: number;
  skippedRows: number;
  updatedRows: number;
  rowErrors: IRowError[];
  createdAt: string;
  [key: string]: unknown;
}
interface IApiResponse<T> {
  success: boolean;
  data: T;
}

const statusStyle: Record<string, string> = {
  validated: 'bg-emerald-50 text-emerald-700',
  validation_failed: 'bg-amber-50 text-amber-700',
  completed: 'bg-emerald-50 text-emerald-700',
  partially_completed: 'bg-amber-50 text-amber-700',
  failed: 'bg-red-50 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
  committing: 'bg-blue-50 text-blue-700',
  queued: 'bg-blue-50 text-blue-700',
  rolled_back: 'bg-slate-100 text-slate-600',
};

const normal = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
function parseHeaders(input: string) {
  const headers: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"' && quoted && input[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      headers.push(value.trim());
      value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      headers.push(value.trim());
      break;
    } else value += char;
  }
  return headers.filter(Boolean);
}

function parsePreview(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < input.length && rows.length < 7; index += 1) {
    const char = input[index];
    if (char === '"' && quoted && input[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[index + 1] === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = '';
    } else value += char;
  }
  return rows;
}

export default function ImportCenterPage({
  initialTargetKey = '',
  embedded = false,
  onImported,
}: {
  initialTargetKey?: string;
  embedded?: boolean;
  onImported?: () => void;
} = {}) {
  const canStage = useHasPermission('import_center', 'create');
  const canCancel = useHasPermission('import_center', 'edit');
  const canCommit = useHasPermission('import_center', 'approve');
  const canRollback = useHasPermission('import_center', 'delete');
  const canExport = useHasPermission('import_center', 'export');
  const {
    data: metadataRaw,
    error: metadataError,
    mutate: refreshMetadata,
  } = useSwr<IApiResponse<ITarget[]>>('import-center/metadata');
  const {
    data: jobsRaw,
    mutate: refreshJobs,
    isLoading,
    error: jobsError,
  } = useSwr<IApiResponse<IImportJob[]>>('import-center', {
    refreshInterval: (latest) => {
      const jobs = latest?.data?.data ?? [];
      return jobs.some((job: IImportJob) => ['queued', 'committing'].includes(job.status))
        ? 3000
        : 60000;
    },
    revalidateOnFocus: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    dedupingInterval: 2000,
  });
  const { mutation, isLoading: working } = useMutation();
  const [targetKey, setTargetKey] = useState(initialTargetKey);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<IImportJob | null>(null);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update' | 'fail'>('skip');
  const [showTargets, setShowTargets] = useState(!initialTargetKey);
  const [showUpload, setShowUpload] = useState(true);
  const [showMatched, setShowMatched] = useState(false);
  const notifiedJobId = useRef('');
  const targets = useMemo(() => metadataRaw?.data ?? [], [metadataRaw]);
  const jobs = useMemo(() => jobsRaw?.data ?? [], [jobsRaw]);
  const target = targets.find((item) => item.key === targetKey);
  const mappedHeaders = useMemo(
    () => headers.filter((header) => Boolean(mapping[header])),
    [headers, mapping],
  );
  const duplicateMappedFields = useMemo(() => {
    const values = mappedHeaders.map((header) => mapping[header]);
    return new Set(values.filter((value, index) => values.indexOf(value) !== index));
  }, [mappedHeaders, mapping]);
  const problemHeaders = useMemo(
    () =>
      headers.filter((header) => !mapping[header] || duplicateMappedFields.has(mapping[header])),
    [duplicateMappedFields, headers, mapping],
  );
  const missingRequiredFields = useMemo(
    () =>
      target?.fields.filter(
        (field) => field.required && !Object.values(mapping).includes(field.key),
      ) ?? [],
    [mapping, target],
  );
  const matchedHeaders = useMemo(
    () => headers.filter((header) => mapping[header] && !problemHeaders.includes(header)),
    [headers, mapping, problemHeaders],
  );
  const previewData = useMemo(
    () =>
      previewRows
        .slice(1)
        .map((row, rowIndex) =>
          Object.fromEntries([
            ['_row', rowIndex + 2],
            ...(previewRows[0] ?? []).map((header, columnIndex) => [
              header,
              row[columnIndex] || '—',
            ]),
          ]),
        ),
    [previewRows],
  );
  const previewColumns = useMemo<Column<Record<string, unknown>>[]>(
    () =>
      (previewRows[0] ?? []).map((header) => ({
        field: header,
        title: header,
        render: (row) => String(row[header] ?? '—'),
      })),
    [previewRows],
  );

  useEffect(() => {
    if (!result || !['queued', 'committing'].includes(result.status)) return;
    const refreshed = jobs.find((job) => job._id === result._id);
    if (!refreshed || refreshed.status === result.status) return;
    const timer = window.setTimeout(() => setResult(refreshed), 0);
    return () => window.clearTimeout(timer);
  }, [jobs, result]);

  useEffect(() => {
    if (result?.status === 'completed' && notifiedJobId.current !== result._id) {
      notifiedJobId.current = result._id;
      onImported?.();
    }
  }, [onImported, result?._id, result?.status]);

  const selectFile = async (next: File | null) => {
    setFile(next);
    setResult(null);
    if (!next || !target) {
      setHeaders([]);
      setMapping({});
      setPreviewRows([]);
      return;
    }
    if (!next.name.toLowerCase().endsWith('.csv')) {
      toast.error('Choose a CSV file');
      return;
    }
    if (next.size > 10 * 1024 * 1024) {
      toast.error('Choose a CSV file smaller than 10 MB');
      return;
    }
    const sourceText = await next.text();
    const sourceHeaders = parseHeaders(sourceText);
    setPreviewRows(parsePreview(sourceText));
    setHeaders(sourceHeaders);
    const candidates = new Map<string, string>();
    target.fields.forEach((field) =>
      [field.key, field.label, ...(field.aliases ?? [])].forEach((candidate) =>
        candidates.set(normal(candidate), field.key),
      ),
    );
    setMapping(
      Object.fromEntries(
        sourceHeaders.map((header) => [header, candidates.get(normal(header)) ?? '']),
      ),
    );
    setShowUpload(false);
    setShowMatched(false);
  };

  const validateImport = async () => {
    if (!canStage) {
      toast.error('Your active role cannot stage imports');
      return;
    }
    if (!file || !target) {
      toast.error('Choose an import type and CSV file');
      return;
    }
    const missing = target.fields.filter(
      (field) => field.required && !Object.values(mapping).includes(field.key),
    );
    if (missing.length) {
      toast.error(`Map required fields: ${missing.map((field) => field.label).join(', ')}`);
      return;
    }
    const mappedFields = Object.values(mapping).filter(Boolean);
    const duplicateFields = mappedFields.filter(
      (field, index) => mappedFields.indexOf(field) !== index,
    );
    if (duplicateFields.length) {
      const labels = Array.from(new Set(duplicateFields)).map(
        (key) => target.fields.find((field) => field.key === key)?.label ?? key,
      );
      toast.error(`Each destination field can be mapped once. Review: ${labels.join(', ')}`);
      return;
    }
    const form = new FormData();
    form.append('file', file);
    form.append('target', target.key);
    form.append('mapping', JSON.stringify(mapping));
    form.append(
      'options',
      JSON.stringify({
        skipDuplicates: duplicateStrategy === 'skip',
        updateExisting: duplicateStrategy === 'update',
      }),
    );
    const response = await mutation('import-center/stage', {
      method: 'POST',
      body: form,
      isFormData: true,
      dedupe: false,
    });
    const job = response?.results?.data as IImportJob | undefined;
    if (!job) return;
    setResult(job);
    refreshJobs();
    toast.success(
      `${job.validRows} rows ready${job.skippedRows ? ` · ${job.skippedRows} skipped` : ''}`,
    );
  };
  const commit = async (job: IImportJob) => {
    const confirmation = await Swal.fire({
      title: 'Commit validated rows?',
      text: `${job.validRows} records will be written. This action is audited.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Commit import',
      confirmButtonColor: '#0178D7',
    });
    if (!confirmation.isConfirmed) return;
    const response = await mutation(`import-center/${job._id}/commit`, { method: 'POST' });
    const committed = response?.results?.data as IImportJob | undefined;
    if (!committed) return;
    setResult(committed);
    refreshJobs();
    toast.success('Import queued — you can safely leave this page');
  };
  const cancel = async (job: IImportJob) => {
    const response = await mutation(`import-center/${job._id}/cancel`, { method: 'POST' });
    if (!response?.results?.success) return;
    setResult(response.results.data as IImportJob);
    refreshJobs();
    toast.success('Staged import cancelled');
  };
  const rollback = async (job: IImportJob) => {
    const confirmation = await Swal.fire({
      title: 'Roll back this import?',
      text: `This removes ${job.committedRows} records created by this job. Updated records cannot be rolled back automatically.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Roll back import',
      confirmButtonColor: '#dc2626',
    });
    if (!confirmation.isConfirmed) return;
    const response = await mutation(`import-center/${job._id}/rollback`, { method: 'POST' });
    if (!response?.results?.success) return;
    setResult(response.results.data as IImportJob);
    refreshJobs();
    toast.success('Import rolled back safely');
  };
  const downloadTemplate = (item: ITarget) => {
    const escape = (value: string) =>
      /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    const content = [
      item.fields.map((field) => escape(field.label)).join(','),
      item.fields.map((field) => escape(field.example ?? '')).join(','),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${item.key}-import-template.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const downloadErrors = (job: IImportJob) => {
    const escape = (value: string | number | undefined) => {
      const text = String(value ?? '');
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const rows = [
      ['Row', 'Field', 'Value', 'Error'],
      ...job.rowErrors.map((error) => [
        error.row,
        error.field ?? '',
        error.value ?? '',
        error.message,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob([rows.map((row) => row.map(escape).join(',')).join('\n')], { type: 'text/csv' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${job.target}-import-errors-${new Date(job.createdAt).toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const errorColumns: Column<IRowError>[] = [
    { field: 'row', title: 'Row' },
    {
      field: 'field',
      title: 'Field',
      render: (row) =>
        target?.fields.find((field) => field.key === row.field)?.label ?? row.field ?? 'Record',
    },
    { field: 'value', title: 'Value', render: (row) => row.value ?? '—' },
    { field: 'message', title: 'Problem' },
  ];

  return (
    <div className={`space-y-6 ${embedded ? '' : 'pb-8'}`}>
      {!embedded && (
        <header>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            <DatabaseZap className="h-4 w-4" /> Data governance
          </div>
          <h1 className="text-3xl font-black text-slate-950">Import & Migration Center</h1>
          <p className="mt-1 text-sm text-slate-500">
            Map, validate and safely commit records from CSV without bypassing tenant governance.
          </p>
        </header>
      )}
      {(metadataError || jobsError) && (
        <section className="flex flex-col gap-4 rounded-3xl bg-rose-50 p-5 text-rose-700 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h2 className="font-bold">Import Center could not load migration data</h2>
              <p className="mt-1 text-sm text-rose-600">
                No staged file was changed. Check the connection and load the workspace again.
              </p>
            </div>
          </div>
          <CustomButton
            variant="secondary"
            onClick={() => void Promise.all([refreshMetadata(), refreshJobs()])}
            startIcon={<RotateCw className="h-4 w-4" />}
          >
            Try again
          </CustomButton>
        </section>
      )}
      {!canStage && (
        <section className="flex items-start gap-3 rounded-2xl bg-blue-50 p-4 text-blue-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-bold">Review workspace</p>
            <p className="mt-0.5 text-xs text-blue-700">
              Your active role can review migration jobs but cannot upload or stage a new file.
            </p>
          </div>
        </section>
      )}
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-2 sm:grid-cols-4">
        {[
          ['1', 'Choose template', Boolean(target)],
          ['2', 'Upload & map', Boolean(file)],
          ['3', 'Validate', Boolean(result)],
          [
            '4',
            'Import',
            Boolean(
              result &&
              ['queued', 'committing', 'completed', 'partially_completed'].includes(result.status),
            ),
          ],
        ].map(([number, label, done]) => (
          <div
            key={String(number)}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
              done ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600'
            }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full ${
                done ? 'bg-emerald-600 text-white' : 'bg-slate-100'
              }`}
            >
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : number}
            </span>
            {label}
          </div>
        ))}
      </div>
      <div className={`grid gap-5 ${embedded ? '' : 'xl:grid-cols-[1fr_360px]'}`}>
        <main className="space-y-5">
          <section className="rounded-3xl bg-white p-5 md:p-6">
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-blue-50 p-3 text-blue-600">
                <FileSpreadsheet className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-black text-slate-900">1. Choose data type</h2>
                <p className="text-sm text-slate-500">
                  {target ? `${target.label} selected` : 'Start with the data you want to migrate.'}
                </p>
              </div>
              {target && (
                <button
                  type="button"
                  onClick={() => setShowTargets((value) => !value)}
                  className="ml-auto rounded-xl px-3 py-2 text-xs font-bold text-primary hover:bg-blue-50"
                >
                  {showTargets ? 'Done' : 'Change'}
                </button>
              )}
            </div>
            <AnimatePresence initial={false}>
              {(!target || showTargets) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-5 grid gap-3 overflow-hidden sm:grid-cols-2"
                >
                  {targets.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => {
                        setTargetKey(item.key);
                        setFile(null);
                        setHeaders([]);
                        setMapping({});
                        setResult(null);
                        setShowTargets(false);
                        setShowUpload(true);
                      }}
                      className={`rounded-2xl p-4 text-left transition ${targetKey === item.key ? 'bg-primary text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
                    >
                      <strong className="block text-sm">{item.label}</strong>
                      <small
                        className={targetKey === item.key ? 'text-blue-100' : 'text-slate-500'}
                      >
                        {item.description}
                      </small>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            {target && canExport && (
              <button
                type="button"
                onClick={() => downloadTemplate(target)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10"
              >
                <Download className="h-4 w-4" />
                Download {target.label} template
              </button>
            )}
          </section>
          <section className="rounded-3xl bg-white p-5 md:p-6">
            <div className="flex items-center gap-3">
              {file ? (
                <FileCheck2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <Upload className="h-5 w-5 text-primary" />
              )}
              <div>
                <h2 className="font-black text-slate-900">2. Upload CSV</h2>
                {file && (
                  <p className="text-xs text-slate-500">
                    {file.name} · {(file.size / 1024).toFixed(1)} KB
                  </p>
                )}
              </div>
              {file && (
                <button
                  type="button"
                  onClick={() => setShowUpload((value) => !value)}
                  className="ml-auto rounded-xl px-3 py-2 text-xs font-bold text-primary hover:bg-blue-50"
                >
                  {showUpload ? 'Done' : 'Replace file'}
                </button>
              )}
            </div>
            <AnimatePresence initial={false}>
              {(!file || showUpload) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <label
                    className={`mt-4 flex cursor-pointer flex-col items-center rounded-2xl bg-slate-50 p-8 text-center ${!target || !canStage ? 'pointer-events-none opacity-50' : ''}`}
                  >
                    <Upload className="h-7 w-7 text-primary" />
                    <strong className="mt-3 text-sm text-slate-800">
                      {file?.name ?? 'Select migration file'}
                    </strong>
                    <small className="mt-1 text-slate-600">CSV · maximum 5,000 rows · 10 MB</small>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      disabled={!canStage}
                      className="hidden"
                      onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
                    />
                  </label>
                  <div className="mt-4 rounded-2xl border border-slate-100 p-4">
                    <p className="text-sm font-bold text-slate-800">When a record already exists</p>
                    <p className="mb-3 text-xs text-slate-500">
                      Matching uses{' '}
                      {target?.uniqueField
                        ? `the ${
                            target.fields.find((field) => field.key === target.uniqueField)
                              ?.label ?? 'unique record'
                          } field`
                        : 'the unique record field'}
                      .
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {[
                        ['skip', 'Skip existing', 'Safest for first-time migration'],
                        ['update', 'Update existing', 'Replace mapped values'],
                        ['fail', 'Flag as error', 'Review every duplicate'],
                      ].map(([value, label, helper]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setDuplicateStrategy(value as typeof duplicateStrategy)}
                          className={`rounded-xl p-3 text-left ${
                            duplicateStrategy === value
                              ? 'bg-primary text-white'
                              : 'bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span className="block text-xs font-bold">{label}</span>
                          <span
                            className={`mt-1 block text-[10px] ${
                              duplicateStrategy === value ? 'text-blue-100' : 'text-slate-600'
                            }`}
                          >
                            {helper}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
          {headers.length > 0 && target && (
            <section className="rounded-3xl bg-white p-5 md:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-black text-slate-900">3. Map columns</h2>
                  <p className="text-sm text-slate-500">
                    {problemHeaders.length || missingRequiredFields.length
                      ? 'Fix only the items that need your attention.'
                      : 'Everything required was matched automatically.'}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${problemHeaders.length || missingRequiredFields.length ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}
                >
                  {mappedHeaders.length}/{headers.length} matched
                </span>
              </div>
              {!problemHeaders.length && !missingRequiredFields.length && (
                <div className="mt-4 flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-800">
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold">Your file is ready for validation</p>
                    <p className="mt-0.5 text-xs text-emerald-700">
                      All required fields have a clear destination. We kept the matched list
                      collapsed to reduce clutter.
                    </p>
                  </div>
                </div>
              )}
              {missingRequiredFields.length > 0 && (
                <div className="mt-4 rounded-2xl bg-amber-50 p-4">
                  <p className="text-sm font-bold text-amber-800">Missing required destinations</p>
                  <p className="mt-1 text-xs text-amber-700">
                    Choose a source column for:{' '}
                    {missingRequiredFields.map((field) => field.label).join(', ')}
                  </p>
                </div>
              )}
              <div className="mt-4 space-y-2">
                {problemHeaders.map((header) => (
                  <div
                    key={header}
                    className="grid items-center gap-2 rounded-2xl bg-slate-50 p-3 sm:grid-cols-[1fr_30px_1fr]"
                  >
                    <span className="truncate text-sm font-semibold text-slate-700">{header}</span>
                    <ArrowRight className="hidden h-4 w-4 text-slate-300 sm:block" />
                    <select
                      value={mapping[header] ?? ''}
                      onChange={(event) =>
                        setMapping((current) => ({ ...current, [header]: event.target.value }))
                      }
                      className="rounded-xl bg-white px-3 py-2 text-sm outline-none"
                    >
                      <option value="">Ignore column</option>
                      {target.fields.map((field) => (
                        <option key={field.key} value={field.key}>
                          {field.label}
                          {field.required ? ' *' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {matchedHeaders.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowMatched((value) => !value)}
                    className="flex w-full items-center justify-between text-left text-xs font-bold text-slate-600"
                  >
                    <span>{matchedHeaders.length} columns matched automatically</span>
                    {showMatched ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  <AnimatePresence initial={false}>
                    {showMatched && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 space-y-2 overflow-hidden"
                      >
                        {matchedHeaders.map((header) => (
                          <div
                            key={header}
                            className="grid items-center gap-2 rounded-xl bg-emerald-50/60 p-3 sm:grid-cols-[1fr_30px_1fr]"
                          >
                            <span className="truncate text-sm font-semibold text-slate-700">
                              {header}
                            </span>
                            <ArrowRight className="hidden h-4 w-4 text-emerald-400 sm:block" />
                            <select
                              value={mapping[header]}
                              onChange={(event) =>
                                setMapping((current) => ({
                                  ...current,
                                  [header]: event.target.value,
                                }))
                              }
                              className="rounded-xl bg-white px-3 py-2 text-sm outline-none"
                            >
                              <option value="">Ignore column</option>
                              {target.fields.map((field) => (
                                <option key={field.key} value={field.key}>
                                  {field.label}
                                  {field.required ? ' *' : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
              {previewRows.length > 1 && (
                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100">
                  <div className="bg-slate-50 px-4 py-3">
                    <p className="text-sm font-bold text-slate-800">Source preview</p>
                    <p className="text-xs text-slate-500">
                      Confirm the first {previewRows.length - 1} rows before server validation.
                    </p>
                  </div>
                  <CustomTable
                    data={previewData}
                    columns={previewColumns}
                    options={{ search: false, pagination: false }}
                  />
                </div>
              )}
              <div className="mt-5 flex justify-end">
                <CustomButton
                  variant="primary"
                  onClick={validateImport}
                  loading={working}
                  disabled={!canStage}
                >
                  Validate import
                </CustomButton>
              </div>
            </section>
          )}
          {result && (
            <section className="overflow-hidden rounded-3xl bg-white">
              <div className="grid gap-3 p-5 sm:grid-cols-5">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-2xl font-black text-slate-900">{result.totalRows}</p>
                  <p className="text-xs text-slate-500">Total rows</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-4">
                  <p className="text-2xl font-black text-emerald-700">{result.validRows}</p>
                  <p className="text-xs text-emerald-600">Valid rows</p>
                </div>
                <div className="rounded-2xl bg-red-50 p-4">
                  <p className="text-2xl font-black text-red-700">{result.invalidRows}</p>
                  <p className="text-xs text-red-600">Invalid rows</p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-4">
                  <p className="text-2xl font-black text-amber-700">{result.skippedRows ?? 0}</p>
                  <p className="text-xs text-amber-600">Skipped</p>
                </div>
                <div className="rounded-2xl bg-blue-50 p-4">
                  <p className="text-2xl font-black text-blue-700">
                    {(result.committedRows ?? 0) + (result.updatedRows ?? 0)}
                  </p>
                  <p className="text-xs text-blue-600">Written</p>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2 px-5 pb-5">
                {result.rowErrors.length > 0 && canExport && (
                  <CustomButton
                    variant="secondary"
                    onClick={() => downloadErrors(result)}
                    startIcon={<Download className="h-4 w-4" />}
                  >
                    Download errors
                  </CustomButton>
                )}
                {['validated', 'validation_failed'].includes(result.status) &&
                  result.validRows > 0 &&
                  canCommit && (
                    <CustomButton
                      variant="primary"
                      onClick={() => commit(result)}
                      loading={working}
                    >
                      Commit valid rows
                    </CustomButton>
                  )}
                {['validated', 'validation_failed'].includes(result.status) &&
                  result.validRows > 0 &&
                  !canCommit && (
                    <span className="rounded-xl bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700">
                      Ready for leadership approval
                    </span>
                  )}
                {['validated', 'validation_failed'].includes(result.status) && canCancel && (
                  <CustomButton variant="tertiary" onClick={() => cancel(result)}>
                    Cancel staged import
                  </CustomButton>
                )}
                {['completed', 'partially_completed'].includes(result.status) &&
                  result.updatedRows === 0 &&
                  canRollback && (
                    <CustomButton
                      variant="tertiary"
                      onClick={() => rollback(result)}
                      startIcon={<RotateCcw className="h-4 w-4" />}
                    >
                      Roll back
                    </CustomButton>
                  )}
              </div>
              {['queued', 'committing'].includes(result.status) && (
                <div className="mx-5 mb-5 rounded-2xl bg-blue-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-blue-800">
                      Import is running in background
                    </p>
                    <span className="text-sm font-bold text-blue-700">
                      {Math.min(
                        100,
                        Math.round(
                          ((result.processedRows ?? 0) / Math.max(result.validRows, 1)) * 100,
                        ),
                      )}
                      %
                    </span>
                  </div>
                  <progress
                    value={result.processedRows ?? 0}
                    max={Math.max(result.validRows, 1)}
                    className="mt-3 h-2 w-full accent-primary"
                    aria-label="Import progress"
                  />
                  <p className="mt-1 text-xs text-blue-600">
                    {(result.processedRows ?? 0).toLocaleString('en-IN')} of{' '}
                    {result.validRows.toLocaleString('en-IN')} validated rows processed. You may
                    safely leave this page.
                  </p>
                </div>
              )}
              {result.rowErrors.length > 0 && (
                <CustomTable
                  data={result.rowErrors}
                  columns={errorColumns}
                  options={{ search: true, pagination: true, pageSize: 10 }}
                />
              )}
            </section>
          )}
        </main>
        {!embedded && (
          <aside className="space-y-4">
            <section className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 p-5">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h3 className="mt-4 font-black text-slate-900">Safe migration workflow</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Uploads are staged first. Only validated rows can be committed, and every validation
                and commit is recorded in the audit trail.
              </p>
            </section>
            <section className="rounded-3xl bg-white p-5">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <h3 className="font-black text-slate-900">Recent jobs</h3>
              </div>
              <div className="mt-4 space-y-3">
                {jobs.slice(0, 8).map((job) => (
                  <button
                    key={job._id}
                    onClick={() => setResult(job)}
                    className="w-full rounded-2xl bg-slate-50 p-3 text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="truncate text-xs text-slate-700">
                        {job.sourceFileName}
                      </strong>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${statusStyle[job.status] ?? 'bg-slate-100 text-slate-500'}`}
                      >
                        {job.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600">
                      {job.totalRows} rows · {new Date(job.createdAt).toLocaleDateString('en-IN')}
                    </p>
                  </button>
                ))}
                {!isLoading && !jobs.length && (
                  <Empty
                    title="No import history yet"
                    subTitle="Validated and completed migration jobs will appear here."
                  />
                )}
              </div>
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}

'use client';

import QualityWorkflowBar from '@/shared/components/QualityWorkflowBar';
import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import Empty from '@/shared/core/Empty';
import { EnterprisePage, GuidancePanel } from '@/shared/core/EnterprisePage';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import useSwr from '@/shared/hooks/useSwr';
import { downloadPdfBlob, fetchProtectedBlob } from '@/shared/utils/pdfDownload';
import { motion } from '@/shared/utils/motion';
import {
  AlertTriangle,
  BadgeCheck,
  BookOpenCheck,
  Download,
  FileSpreadsheet,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import AccreditationSetupPanel from './AccreditationSetupPanel';

interface ICriterionSummary {
  _id: string;
  total: number;
  approved: number;
  submitted: number;
  averageScore?: number;
}

interface INbaReport {
  _id: string;
  status: 'draft' | 'approved';
  thresholdMet: boolean;
}

interface ITemplateCard {
  id: string;
  module: 'naac' | 'nba';
  endpoint: string;
  filename: string;
  title: string;
  description: string;
  criteria: string;
  fields: string;
}

const criteria = [
  'Curricular Aspects',
  'Teaching–Learning',
  'Research & Extension',
  'Infrastructure',
  'Student Support',
  'Governance',
  'Institutional Values',
];

const templates: ITemplateCard[] = [
  {
    id: 'naac-1',
    module: 'naac',
    endpoint: 'naac-1',
    filename: 'naac_criteria_1_enrollment.csv',
    title: 'Student enrollment extract',
    description:
      'Active students for the selected year, limited to your permitted department scope.',
    criteria: 'NAAC · Criterion 1',
    fields: 'Identity · programme · semester · admission',
  },
  {
    id: 'naac-5',
    module: 'naac',
    endpoint: 'naac-5',
    filename: 'naac_criteria_5_placement.csv',
    title: 'Verified placement extract',
    description: 'Verified placements whose joining dates fall inside the selected academic year.',
    criteria: 'NAAC · Criterion 5',
    fields: 'Student · employer · package · joining date',
  },
  {
    id: 'nba-performance',
    module: 'nba',
    endpoint: 'nba-performance',
    filename: 'nba_student_performance.csv',
    title: 'Student performance extract',
    description:
      'Academic performance for active students in the selected year and authorized scope.',
    criteria: 'NBA · Student performance',
    fields: 'CGPA · backlogs · lateral-entry benefit',
  },
];

const currentAcademicYear = () => {
  const now = new Date();
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
};

export default function AccreditationPage() {
  const router = useRouter();
  const params = useParams<{ tenant: string; role: string }>();
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [academicYear, setAcademicYear] = useState(currentAcademicYear);
  const canViewNaac = useHasPermission('naac', 'view');
  const canViewNba = useHasPermission('nba', 'view');
  const canExportNaac = useHasPermission('naac', 'export');
  const canExportNba = useHasPermission('nba', 'export');

  const {
    data: summaryRaw,
    error: summaryError,
    isLoading: summaryLoading,
    isValidating: summaryValidating,
    mutate: refreshSummary,
  } = useSwr<{ success: boolean; data: ICriterionSummary[] }>(
    canViewNaac
      ? `naac-nba/naac/evidence/summary?academicYear=${encodeURIComponent(academicYear)}`
      : null,
  );
  const {
    data: reportsRaw,
    error: reportsError,
    isLoading: reportsLoading,
    mutate: refreshReports,
  } = useSwr<{ success: boolean; data: INbaReport[]; total: number }>(
    canViewNba
      ? `naac-nba/nba/reports?academicYear=${encodeURIComponent(academicYear)}&page=1&limit=100`
      : null,
  );

  const summary = useMemo(() => summaryRaw?.data ?? [], [summaryRaw?.data]);
  const reports = useMemo(() => reportsRaw?.data ?? [], [reportsRaw?.data]);
  const readiness = useMemo(
    () =>
      summary.reduce(
        (result, row) => ({
          total: result.total + row.total,
          approved: result.approved + row.approved,
          submitted: result.submitted + row.submitted,
        }),
        { total: 0, approved: 0, submitted: 0 },
      ),
    [summary],
  );
  const approvalProgress = readiness.total
    ? Math.round((readiness.approved / readiness.total) * 100)
    : 0;
  const criterionRows = criteria.map((label, index) => {
    const value = summary.find((row) => row._id === String(index + 1));
    return {
      criterion: index + 1,
      label,
      total: value?.total ?? 0,
      approved: value?.approved ?? 0,
    };
  });
  const visibleTemplates = templates.filter((template) =>
    template.module === 'naac' ? canViewNaac : canViewNba,
  );
  const canDownload = (template: ITemplateCard) =>
    template.module === 'naac' ? canExportNaac : canExportNba;

  const handleDownload = async (item: ITemplateCard) => {
    if (!canDownload(item)) {
      toast.error(`Your active role does not have ${item.module.toUpperCase()} export permission.`);
      return;
    }
    setDownloading((previous) => ({ ...previous, [item.id]: true }));
    try {
      const blob = await fetchProtectedBlob(
        `compliance/export/${item.endpoint}?academicYear=${encodeURIComponent(academicYear)}`,
      );
      if (!blob) throw new Error('Export request failed');
      downloadPdfBlob(blob, item.filename);
      toast.success(`${item.filename} generated for ${academicYear}`);
    } catch {
      toast.error(
        'The governed extract could not be generated. Check your data scope and export permission.',
      );
    } finally {
      setDownloading((previous) => ({ ...previous, [item.id]: false }));
    }
  };

  const refresh = async () => Promise.all([refreshSummary(), refreshReports()]);
  const openEvidenceWorkspace = () => router.push(`/${params.tenant}/${params.role}/naac-nba`);

  return (
    <div className="space-y-5">
      <QualityWorkflowBar />
      <EnterprisePage
        eyebrow="Quality and accreditation"
        title="Accreditation readiness"
        description="Assess evidence approval, identify criterion gaps and generate year-scoped institutional extracts for NAAC and NBA preparation."
        icon={FileSpreadsheet}
        actions={
          <div className="flex flex-wrap gap-2">
            <CustomButton
              variant="secondary"
              onClick={() => void refresh()}
              disabled={summaryValidating}
              startIcon={
                <RefreshCw className={`h-4 w-4 ${summaryValidating ? 'animate-spin' : ''}`} />
              }
            >
              Refresh
            </CustomButton>
            <CustomButton
              onClick={openEvidenceWorkspace}
              startIcon={<BookOpenCheck className="h-4 w-4" />}
            >
              Manage evidence
            </CustomButton>
          </div>
        }
      >
        <AccreditationSetupPanel academicYear={academicYear} />
        <section className="grid gap-4 rounded-2xl bg-blue-50 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-primary">
              Reporting scope
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              Choose the year before reviewing or exporting
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Every metric and download below is tied to this academic year. Department-scoped roles
              receive only their authorized records.
            </p>
          </div>
          <AsyncSelect
            type="academicYears"
            label="Academic year"
            value={academicYear}
            onChange={(value) => setAcademicYear(value ?? currentAcademicYear())}
            placeholder="Select academic year"
          />
        </section>

        {(summaryError || reportsError) && (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="font-bold text-red-800">Some accreditation data could not be loaded</p>
            <p className="mt-1 text-xs text-red-700">
              Refresh or verify that the active role has NAAC/NBA view permission.
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: 'Evidence records',
              value: readiness.total,
              hint: academicYear,
              icon: FileSpreadsheet,
              tone: 'bg-blue-50 text-blue-700',
            },
            {
              label: 'Approved evidence',
              value: readiness.approved,
              hint: `${approvalProgress}% approval progress`,
              icon: BadgeCheck,
              tone: 'bg-emerald-50 text-emerald-700',
            },
            {
              label: 'Awaiting review',
              value: readiness.submitted,
              hint: 'Reviewer action required',
              icon: AlertTriangle,
              tone: 'bg-amber-50 text-amber-700',
            },
            {
              label: 'Approved NBA reports',
              value: reports.filter((report) => report.status === 'approved').length,
              hint: `${reportsRaw?.total ?? 0} total reports`,
              icon: ShieldCheck,
              tone: 'bg-violet-50 text-violet-700',
            },
          ].map((metric, index) => (
            <motion.article
              key={metric.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="flex min-h-24 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"
            >
              <span
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${metric.tone}`}
              >
                <metric.icon size={19} />
              </span>
              <div className="min-w-0">
                <p className="text-xl font-black text-slate-900">
                  {summaryLoading || reportsLoading ? '—' : metric.value}
                </p>
                <p className="truncate text-xs font-bold text-slate-600">{metric.label}</p>
                <p className="mt-0.5 truncate text-[10px] text-slate-400">{metric.hint}</p>
              </div>
            </motion.article>
          ))}
        </div>

        {canViewNaac && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-bold text-slate-900">NAAC criterion coverage</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Approval progress by criterion; zero means no evidence exists for this year.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {criterionRows.filter((row) => row.total > 0).length}/7 criteria represented
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {criterionRows.map((row) => {
                const percent = row.total ? Math.round((row.approved / row.total) * 100) : 0;
                const filled = Math.round(percent / 10);
                return (
                  <article key={row.criterion} className="rounded-xl bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-primary">
                          Criterion {row.criterion}
                        </p>
                        <p className="mt-0.5 text-xs font-bold text-slate-800">{row.label}</p>
                      </div>
                      <span className="text-sm font-black text-slate-700">
                        {row.approved}/{row.total}
                      </span>
                    </div>
                    <div
                      className="mt-3 grid grid-cols-10 gap-1"
                      aria-label={`${percent}% approved`}
                    >
                      {Array.from({ length: 10 }, (_, index) => (
                        <span
                          key={index}
                          className={`h-1.5 rounded-full ${index < filled ? 'bg-primary' : 'bg-slate-200'}`}
                        />
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <GuidancePanel
          icon={AlertTriangle}
          title="These are governed ERP extracts—not direct portal submissions"
          description="Review every CSV, secure institutional approval and upload through the applicable official portal. The selected year and your department scope are enforced by the backend."
        />

        <section>
          <div className="mb-3">
            <h2 className="font-bold text-slate-900">Governed data extracts</h2>
            <p className="mt-1 text-xs text-slate-500">
              Purpose-specific downloads generated from live institutional records for{' '}
              {academicYear}.
            </p>
          </div>
          {visibleTemplates.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleTemplates.map((template) => {
                const allowed = canDownload(template);
                return (
                  <article
                    key={template.id}
                    className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                        <FileSpreadsheet size={18} />
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600">
                        CSV
                      </span>
                    </div>
                    <p className="mt-4 text-[10px] font-black uppercase tracking-wider text-primary">
                      {template.criteria}
                    </p>
                    <h3 className="mt-1 font-bold text-slate-900">{template.title}</h3>
                    <p className="mt-2 flex-1 text-xs leading-5 text-slate-500">
                      {template.description}
                    </p>
                    <div className="mt-4 rounded-xl bg-slate-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Included fields
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-600">{template.fields}</p>
                    </div>
                    <CustomButton
                      variant="primary"
                      onClick={() => void handleDownload(template)}
                      loading={downloading[template.id]}
                      disabled={!allowed}
                      startIcon={<Download className="h-4 w-4" />}
                      className="mt-4 w-full"
                    >
                      {allowed ? `Generate ${academicYear} CSV` : 'Export permission required'}
                    </CustomButton>
                  </article>
                );
              })}
            </div>
          ) : (
            <Empty
              title="No accreditation module access"
              subTitle="Your active role needs NAAC or NBA view permission."
            />
          )}
        </section>
      </EnterprisePage>
    </div>
  );
}

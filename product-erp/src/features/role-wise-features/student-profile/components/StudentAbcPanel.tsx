'use client';

import CustomTable, { type Column } from '@/shared/core/CustomTable';
import Empty from '@/shared/core/Empty';
import useSwr from '@/shared/hooks/useSwr';
import { motion } from '@/shared/utils/motion';
import { BookOpenCheck, CircleAlert, Landmark, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';

interface ISubjectCredit {
  [key: string]: unknown;
  reference: string;
  subjectCode: string;
  subjectName: string;
  semester: number;
  academicYear: string;
  grade: string;
  gradePoint: number;
  percentage: number;
  passed: boolean;
  credits: number;
  curriculumMapped: boolean;
  preparationStatus: string;
  batchNumber?: string;
}

interface IAbcLedger {
  identity: {
    studentName: string;
    rollNumber: string;
    abcId?: string;
    status: 'recorded_by_institution' | 'not_recorded';
    editableByStudent: false;
  };
  summary: {
    totalEarnedCredits: number;
    subjectMappedCredits: number;
    passedSubjects: number;
    preparedRecords: number;
    submittedRecords: number;
  };
  semesterCredits: Array<{
    semester: number;
    academicYear: string;
    result: string;
    sgpa?: number;
    cgpa?: number;
    registeredCredits?: number;
    earnedCredits: number;
    source: 'published_semester_result' | 'frozen_gradebook';
  }>;
  subjectCredits: ISubjectCredit[];
  submissions: Array<{
    batchNumber: string;
    academicYear: string;
    status: string;
    recordCount: number;
    acknowledgementReference?: string;
    preparedAt: string;
    submittedAt?: string;
    reconciledAt?: string;
    confirmationSource: 'institution_recorded_provider_response' | 'institution_workflow';
  }>;
  notices: string[];
  generatedAt: string;
}

const statusTone = (status: string) => {
  if (status === 'accepted') return 'bg-emerald-50 text-emerald-700';
  if (status === 'rejected' || status === 'not_eligible') return 'bg-red-50 text-red-700';
  if (status === 'ready') return 'bg-blue-50 text-blue-700';
  return 'bg-amber-50 text-amber-700';
};

export default function StudentAbcPanel() {
  const { data, error, isLoading, isValidating, mutate } = useSwr<{
    success: boolean;
    data: IAbcLedger;
  }>('student-profile/me/abc-ledger');
  const ledger = data?.data;
  const columns = useMemo<Column<ISubjectCredit>[]>(
    () => [
      {
        field: 'subjectName',
        title: 'Course',
        minWidth: '220px',
        render: (row) => (
          <div>
            <p className="font-bold text-slate-900">{row.subjectName}</p>
            <p className="mt-0.5 text-xs text-slate-500">{row.subjectCode}</p>
          </div>
        ),
      },
      {
        field: 'semester',
        title: 'Semester',
        minWidth: '100px',
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        render: (row) => <span className="font-semibold">Semester {row.semester}</span>,
      },
      {
        field: 'grade',
        title: 'Grade',
        minWidth: '100px',
        headerClassName: 'text-center',
        cellClassName: 'text-center',
      },
      {
        field: 'credits',
        title: 'Earned credits',
        minWidth: '120px',
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        render: (row) => <strong className="text-primary">{row.credits}</strong>,
      },
      {
        field: 'preparationStatus',
        title: 'ABC workflow',
        minWidth: '160px',
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        render: (row) => (
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ${statusTone(row.preparationStatus)}`}
          >
            {row.preparationStatus.replaceAll('_', ' ')}
          </span>
        ),
      },
    ],
    [],
  );

  if (error) {
    return (
      <Empty
        title="ABC ledger unavailable"
        subTitle="Your credit information could not be loaded. Contact the examination office if this continues."
      />
    );
  }

  return (
    <section className="space-y-4" aria-label="My APAAR and Academic Bank of Credits">
      <article className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,.75fr)] lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
              <Landmark size={16} /> My APAAR & Credits
            </div>
            <h2 className="mt-2 text-xl font-bold text-slate-900">Academic credit passport</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Review the identity, credits and institutional submission records prepared for your
              Academic Bank of Credits account.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${ledger?.identity.abcId ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}
              >
                {ledger?.identity.abcId ? 'ABC ID recorded by institution' : 'ABC ID not recorded'}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                Student view · read only
              </span>
            </div>
          </div>
          <div className="rounded-2xl border border-white bg-white/80 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              APAAR / ABC ID
            </p>
            <p className="mt-2 break-all text-lg font-black tracking-wide text-slate-900">
              {isLoading ? 'Loading…' : (ledger?.identity.abcId ?? 'Not available')}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              This value is maintained by the institution. Submit correction requests through the
              administration office; students cannot edit it directly.
            </p>
          </div>
        </div>
      </article>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          {
            label: 'Earned credits',
            value: ledger?.summary.totalEarnedCredits ?? 0,
            icon: BookOpenCheck,
            tone: 'bg-blue-50 text-blue-700',
          },
          {
            label: 'Mapped credits',
            value: ledger?.summary.subjectMappedCredits ?? 0,
            icon: ShieldCheck,
            tone: 'bg-violet-50 text-violet-700',
          },
          {
            label: 'Passed courses',
            value: ledger?.summary.passedSubjects ?? 0,
            icon: BookOpenCheck,
            tone: 'bg-emerald-50 text-emerald-700',
          },
          {
            label: 'Prepared records',
            value: ledger?.summary.preparedRecords ?? 0,
            icon: ShieldCheck,
            tone: 'bg-cyan-50 text-cyan-700',
          },
          {
            label: 'Submitted records',
            value: ledger?.summary.submittedRecords ?? 0,
            icon: Landmark,
            tone: 'bg-amber-50 text-amber-700',
          },
        ].map((metric, index) => (
          <motion.article
            key={metric.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"
          >
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${metric.tone}`}
            >
              <metric.icon size={18} />
            </span>
            <div>
              <p className="text-xl font-black text-slate-900">{isLoading ? '—' : metric.value}</p>
              <p className="text-[11px] font-semibold text-slate-500">{metric.label}</p>
            </div>
          </motion.article>
        ))}
      </div>

      {!!ledger?.semesterCredits.length && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {ledger.semesterCredits.map((semester) => (
            <article
              key={`${semester.academicYear}-${semester.semester}`}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-500">Semester {semester.semester}</p>
                  <p className="mt-1 text-2xl font-black text-primary">{semester.earnedCredits}</p>
                  <p className="text-[11px] text-slate-500">credits earned</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold capitalize text-slate-600">
                  {semester.result}
                </span>
              </div>
              <p className="mt-3 text-[10px] text-slate-400">
                Source: {semester.source.replaceAll('_', ' ')}
              </p>
            </article>
          ))}
        </div>
      )}

      <CustomTable<ISubjectCredit>
        columns={columns}
        data={ledger?.subjectCredits ?? []}
        isLoading={isLoading}
        isValidating={isValidating}
        title="Subject credit ledger"
        subtitle="Passed courses from frozen examination records mapped to the active curriculum"
        description="A ready record is eligible for institutional preparation; it does not mean the government platform has accepted it."
        onRefresh={() => void mutate()}
        options={{ responsive: true, export: false, bordered: false, pageSize: 10 }}
      />

      <article className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-bold text-slate-900">ABC submission history</h3>
        <p className="mt-1 text-sm text-slate-500">
          Institution-prepared batches containing your credit records.
        </p>
        {ledger?.submissions.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {ledger.submissions.map((submission) => (
              <div key={submission.batchNumber} className="rounded-xl bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{submission.batchNumber}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {submission.recordCount} record{submission.recordCount === 1 ? '' : 's'} ·{' '}
                      {submission.academicYear}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ${statusTone(submission.status)}`}
                  >
                    {submission.status.replaceAll('_', ' ')}
                  </span>
                </div>
                <p className="mt-3 text-xs text-slate-600">
                  Acknowledgement: {submission.acknowledgementReference ?? 'Not submitted'}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {submission.confirmationSource.replaceAll('_', ' ')}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            Your credits have not been included in an institutional ABC submission batch yet.
          </p>
        )}
      </article>

      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
        <div className="flex gap-3">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="text-sm font-bold text-amber-900">Understand these statuses</p>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-800">
              {(ledger?.notices ?? []).map((notice) => (
                <li key={notice}>• {notice}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

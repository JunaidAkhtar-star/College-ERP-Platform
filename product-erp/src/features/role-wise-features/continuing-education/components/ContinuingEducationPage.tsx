'use client';
import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { type Action, type Column } from '@/shared/core/CustomTable';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { ErrorMessage, Field, FieldArray, Form, Formik } from 'formik';
import {
  BadgeCheck,
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  Plus,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
interface Api<T> {
  success: boolean;
  data: T;
}
interface Campus {
  _id: string;
  code: string;
  name: string;
}
interface Offering extends Record<string, unknown> {
  _id: string;
  code: string;
  title: string;
  deliveryMode: string;
  durationHours: number;
  fee: number;
  credentialType: string;
  status: string;
}
interface Cohort extends Record<string, unknown> {
  _id: string;
  code: string;
  offeringId: string | Offering;
  startsAt: string;
  endsAt: string;
  capacity: number;
  enrolledCount?: number;
  status: string;
  instructorId: string | { name: string };
}
interface Enrollment extends Record<string, unknown> {
  _id: string;
  enrollmentNumber: string;
  cohortId: string | Cohort;
  learnerName: string;
  learnerEmail: string;
  status: string;
  paymentStatus: string;
  attendancePercent: number;
  assessmentScore?: number;
  credentialCode?: string;
}
interface Dash {
  publishedOfferings: number;
  openCohorts: number;
  enrolledLearners: number;
  completions: number;
  activeCredentials: number;
}
type Modal = 'offering' | 'cohort' | 'enrollment' | 'progress' | 'complete' | null;
const cls =
  'mt-1 w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20';
const name = (v: string | { title?: string; code?: string; name?: string }) =>
  typeof v === 'string' ? 'Linked record' : (v.title ?? v.name ?? v.code ?? 'Linked record');
const money = (v: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(v);
export default function ContinuingEducationPage() {
  const [tab, setTab] = useState<'overview' | 'offerings' | 'cohorts' | 'enrollments'>('overview'),
    [modal, setModal] = useState<Modal>(null),
    [selected, setSelected] = useState<Enrollment | null>(null);
  const { mutation, isLoading } = useMutation();
  const canCreate = useHasPermission('curriculum', 'create');
  const canEdit = useHasPermission('curriculum', 'edit');
  const canApprove = useHasPermission('curriculum', 'approve');
  const canExport = useHasPermission('curriculum', 'export');
  const { data: dash, error: dashError } = useSwr<Api<Dash>>('continuing-education/dashboard'),
    {
      data: or,
      mutate: ro,
      error: offeringsError,
      isLoading: offeringsLoading,
      isValidating: offeringsValidating,
    } = useSwr<Api<Offering[]>>('continuing-education/offerings'),
    {
      data: cr,
      mutate: rc,
      error: cohortsError,
      isLoading: cohortsLoading,
      isValidating: cohortsValidating,
    } = useSwr<Api<Cohort[]>>('continuing-education/cohorts'),
    {
      data: er,
      mutate: re,
      error: enrollmentsError,
      isLoading: enrollmentsLoading,
      isValidating: enrollmentsValidating,
    } = useSwr<Api<Enrollment[]>>('continuing-education/enrollments'),
    { data: camp, error: campusesError } = useSwr<Api<Campus[]>>('campus-governance/campuses');
  const offerings = or?.data ?? [],
    cohorts = cr?.data ?? [],
    enrollments = er?.data ?? [],
    campuses = camp?.data ?? [],
    d = dash?.data;
  const save = async (
    path: string,
    body: unknown,
    msg: string,
    refresh: () => Promise<unknown>,
    method: 'POST' | 'PATCH' = 'POST',
  ) => {
    const r = await mutation(path, { method, body });
    if (!r?.results?.success) return;
    toast.success(msg);
    setModal(null);
    setSelected(null);
    await refresh();
  };
  const ocols: Column<Offering>[] = [
      {
        field: 'code',
        title: 'Offering',
        render: (r) => (
          <div>
            <b>
              {r.code} · {r.title}
            </b>
            <p className="text-xs text-slate-600">
              {r.durationHours} hours · {r.deliveryMode.replaceAll('_', ' ')}
            </p>
          </div>
        ),
      },
      { field: 'fee', title: 'Fee', render: (r) => (r.fee ? money(r.fee) : 'Free') },
      {
        field: 'credentialType',
        title: 'Credential',
        render: (r) => <Badge v={r.credentialType} />,
      },
      { field: 'status', title: 'Status', render: (r) => <Badge v={r.status} /> },
    ],
    ccols: Column<Cohort>[] = [
      {
        field: 'code',
        title: 'Cohort',
        render: (r) => (
          <div>
            <b>{r.code}</b>
            <p className="text-xs">{name(r.offeringId)}</p>
          </div>
        ),
      },
      {
        field: 'startsAt',
        title: 'Period',
        render: (r) =>
          `${new Date(r.startsAt).toLocaleDateString('en-IN')} – ${new Date(r.endsAt).toLocaleDateString('en-IN')}`,
      },
      { field: 'capacity', title: 'Capacity' },
      { field: 'instructorId', title: 'Instructor', render: (r) => name(r.instructorId) },
      { field: 'status', title: 'Status', render: (r) => <Badge v={r.status} /> },
    ],
    ecols: Column<Enrollment>[] = [
      {
        field: 'enrollmentNumber',
        title: 'Learner',
        render: (r) => (
          <div>
            <b>
              {r.enrollmentNumber} · {r.learnerName}
            </b>
            <p className="text-xs">{r.learnerEmail}</p>
          </div>
        ),
      },
      { field: 'cohortId', title: 'Cohort', render: (r) => name(r.cohortId) },
      { field: 'attendancePercent', title: 'Attendance', render: (r) => `${r.attendancePercent}%` },
      {
        field: 'assessmentScore',
        title: 'Score',
        render: (r) => r.assessmentScore ?? 'Not recorded',
      },
      { field: 'paymentStatus', title: 'Payment', render: (r) => <Badge v={r.paymentStatus} /> },
      { field: 'status', title: 'Outcome', render: (r) => <Badge v={r.status} /> },
    ],
    actions: Action<Enrollment>[] = [
      {
        tooltip: 'Update progress',
        icon: <BookOpenCheck className="h-4 w-4" />,
        hidden: (r) => !canEdit || !['pending', 'enrolled'].includes(r.status),
        onClick: (r) => {
          setSelected(r);
          setModal('progress');
        },
      },
      {
        tooltip: 'Finalize outcome',
        icon: <BadgeCheck className="h-4 w-4" />,
        hidden: (r) => !canApprove || r.status !== 'enrolled',
        onClick: (r) => {
          setSelected(r);
          setModal('complete');
        },
      },
    ];
  const tabs = [
    {
      id: 'overview' as const,
      label: 'Overview',
      description: 'Purpose and workflow',
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      id: 'offerings' as const,
      label: 'Programs',
      description: 'What learners can study',
      icon: <BookOpen className="h-4 w-4" />,
    },
    {
      id: 'cohorts' as const,
      label: 'Scheduled batches',
      description: 'When programs are delivered',
      icon: <CalendarDays className="h-4 w-4" />,
    },
    {
      id: 'enrollments' as const,
      label: 'Learners',
      description: 'Progress and credentials',
      icon: <Users className="h-4 w-4" />,
    },
  ];
  const cards: Array<[React.ElementType, string, number, string, string]> = [
    [
      GraduationCap,
      'Published offerings',
      d?.publishedOfferings ?? 0,
      'bg-blue-50',
      'text-blue-700',
    ],
    [CalendarDays, 'Open cohorts', d?.openCohorts ?? 0, 'bg-violet-50', 'text-violet-700'],
    [Users, 'Active learners', d?.enrolledLearners ?? 0, 'bg-amber-50', 'text-amber-700'],
    [BookOpenCheck, 'Completions', d?.completions ?? 0, 'bg-emerald-50', 'text-emerald-700'],
    [BadgeCheck, 'Active credentials', d?.activeCredentials ?? 0, 'bg-cyan-50', 'text-cyan-700'],
  ];
  const actionLabel =
    tab === 'overview' || tab === 'offerings'
      ? 'Create program'
      : tab === 'cohorts'
        ? 'Schedule batch'
        : 'Enroll learner';
  const openContextAction = () => {
    setModal(
      tab === 'overview' || tab === 'offerings'
        ? 'offering'
        : tab === 'cohorts'
          ? 'cohort'
          : 'enrollment',
    );
  };
  return (
    <div className="space-y-5 ">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Lifelong learning
          </p>
          <h1 className="text-2xl font-black">Continuing Education</h1>
          <p className="text-sm text-slate-500">
            Publish short programs, run capacity-controlled cohorts, track outcomes, and issue
            verifiable credentials.
          </p>
        </div>
        {canCreate && (
          <CustomButton onClick={openContextAction}>
            <Plus className="mr-2 h-4 w-4" />
            {actionLabel}
          </CustomButton>
        )}
      </header>
      <nav
        className="flex w-fit max-w-full gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2"
        role="tablist"
        aria-label="Continuing education workflow"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors ${tab === item.id ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tab === item.id ? 'bg-white/15' : 'bg-slate-100'}`}
            >
              {item.icon}
            </span>
            <span>
              <span className="block text-xs font-bold">{item.label}</span>
              <span
                className={`mt-0.5 block text-[10px] ${tab === item.id ? 'text-white/75' : 'text-slate-400'}`}
              >
                {item.description}
              </span>
            </span>
          </button>
        ))}
      </nav>
      {tab === 'overview' && (
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="max-w-xl">
                <h2 className="text-sm font-bold text-slate-900">Short-course workflow</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Create a program, schedule its delivery, enroll learners and record the final
                  outcome.
                </p>
              </div>
              <ol className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['1', 'Program', 'Content and credential'],
                  ['2', 'Batch', 'Dates and instructor'],
                  ['3', 'Learners', 'Enrollment and progress'],
                  ['4', 'Outcome', 'Completion and credential'],
                ].map(([step, label, detail]) => (
                  <li key={step} className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[11px] font-bold text-primary">
                      {step}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-slate-800">{label}</span>
                      <span className="block truncate text-[10px] text-slate-500">{detail}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {cards.map(([Icon, label, value, surface, foreground]) => (
              <article
                key={label}
                className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-blue-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500">{label}</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
                  </div>
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${surface} ${foreground}`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
              </article>
            ))}
          </div>

          <LearningPipeline offerings={offerings} cohorts={cohorts} enrollments={enrollments} />
        </div>
      )}
      {(dashError || offeringsError || cohortsError || enrollmentsError || campusesError) && (
        <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          Some continuing-education data could not be loaded. Refresh and try again; no placeholder
          program or learner records are shown.
        </div>
      )}
      {tab === 'offerings' && (
        <CustomTable
          key="continuing-offerings-table"
          title="Program catalog · short courses"
          description="Define what learners can study, including delivery mode, duration, fee and resulting credential."
          data={offerings}
          columns={ocols}
          isLoading={offeringsLoading}
          isValidating={offeringsValidating}
          onRefresh={() => void ro()}
          options={{ responsive: true, export: canExport, refresh: true, pagination: true }}
        />
      )}
      {tab === 'cohorts' && (
        <CustomTable
          key="continuing-cohorts-table"
          title="Delivery cohorts · scheduled batches"
          description="Turn a published program into a dated batch with an instructor, venue and learner capacity."
          data={cohorts}
          columns={ccols}
          isLoading={cohortsLoading}
          isValidating={cohortsValidating}
          onRefresh={() => void rc()}
          options={{ responsive: true, export: canExport, refresh: true, pagination: true }}
        />
      )}
      {tab === 'enrollments' && (
        <CustomTable
          key="continuing-enrollments-table"
          title="Learner outcomes · progress and credentials"
          description="Track registration, payment, attendance and assessment before recording the final outcome."
          data={enrollments}
          columns={ecols}
          actions={actions}
          isLoading={enrollmentsLoading}
          isValidating={enrollmentsValidating}
          onRefresh={() => void re()}
          options={{ responsive: true, export: canExport, refresh: true, pagination: true }}
        />
      )}
      {modal === 'offering' && (
        <OfferingForm
          close={() => setModal(null)}
          loading={isLoading}
          submit={(v) => save('continuing-education/offerings', v, 'Offering created', ro)}
        />
      )}{' '}
      {modal === 'cohort' && (
        <CohortForm
          offerings={offerings}
          campuses={campuses}
          close={() => setModal(null)}
          loading={isLoading}
          submit={(v) => save('continuing-education/cohorts', v, 'Cohort created', rc)}
        />
      )}{' '}
      {modal === 'enrollment' && (
        <EnrollmentForm
          cohorts={cohorts}
          close={() => setModal(null)}
          loading={isLoading}
          submit={(v) => save('continuing-education/enrollments', v, 'Learner enrolled', re)}
        />
      )}{' '}
      {modal === 'progress' && selected && (
        <ProgressForm
          item={selected}
          close={() => setModal(null)}
          loading={isLoading}
          submit={(v) =>
            save(
              `continuing-education/enrollments/${selected._id}/progress`,
              v,
              'Progress updated',
              re,
              'PATCH',
            )
          }
        />
      )}{' '}
      {modal === 'complete' && selected && (
        <CompleteForm
          close={() => setModal(null)}
          loading={isLoading}
          submit={(v) =>
            save(
              `continuing-education/enrollments/${selected._id}/complete`,
              v,
              'Enrollment finalized',
              re,
            )
          }
        />
      )}
    </div>
  );
}

function LearningPipeline({
  offerings,
  cohorts,
  enrollments,
}: {
  offerings: Offering[];
  cohorts: Cohort[];
  enrollments: Enrollment[];
}) {
  const published = offerings.filter((item) => item.status === 'published').length;
  const activeCohorts = cohorts.filter((item) => ['open', 'in_progress'].includes(item.status));
  const activeLearners = enrollments.filter((item) =>
    ['pending', 'enrolled'].includes(item.status),
  ).length;
  const completed = enrollments.filter((item) => item.status === 'completed').length;
  const credentials = enrollments.filter((item) => Boolean(item.credentialCode)).length;
  const totalCapacity = activeCohorts.reduce((total, item) => total + item.capacity, 0);
  const enrolledSeats = activeCohorts.reduce((total, item) => total + (item.enrolledCount ?? 0), 0);
  const capacityUse = totalCapacity ? Math.round((enrolledSeats / totalCapacity) * 100) : 0;
  const completionRate = enrollments.length
    ? Math.round((completed / enrollments.length) * 100)
    : 0;
  const pipeline = [
    { label: 'Published programs', value: published, color: '#2563eb' },
    { label: 'Active batches', value: activeCohorts.length, color: '#8b5cf6' },
    { label: 'Active learners', value: activeLearners, color: '#f59e0b' },
    { label: 'Completed learners', value: completed, color: '#10b981' },
    { label: 'Credentials issued', value: credentials, color: '#0891b2' },
  ];
  const maxValue = Math.max(1, ...pipeline.map((item) => item.value));

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
      <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-bold text-slate-900">Learning delivery pipeline</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          A live view of how programs move from publication to verified credentials.
        </p>
        {offerings.length || cohorts.length || enrollments.length ? (
          <svg
            viewBox="0 0 680 230"
            className="mt-5 h-56 w-full"
            role="img"
            aria-label="Continuing education delivery pipeline"
          >
            {[0.25, 0.5, 0.75, 1].map((ratio) => (
              <line
                key={ratio}
                x1="28"
                x2="660"
                y1={180 - ratio * 145}
                y2={180 - ratio * 145}
                stroke="#e2e8f0"
                strokeDasharray="4 6"
              />
            ))}
            {pipeline.map((item, index) => {
              const slot = 620 / pipeline.length;
              const barHeight = (item.value / maxValue) * 140;
              const x = 36 + index * slot + 30;
              return (
                <g key={item.label} className="transition-opacity hover:opacity-75">
                  <rect
                    x={x}
                    y={180 - barHeight}
                    width="58"
                    height={barHeight}
                    rx="10"
                    fill={item.color}
                  >
                    <title>{`${item.label}: ${item.value}`}</title>
                  </rect>
                  <text
                    x={x + 29}
                    y={Math.max(24, 172 - barHeight)}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="700"
                    fill="#334155"
                  >
                    {item.value}
                  </text>
                  <text x={x + 29} y="202" textAnchor="middle" fontSize="9" fill="#64748b">
                    {item.label.split(' ')[0]}
                  </text>
                  <text x={x + 29} y="214" textAnchor="middle" fontSize="9" fill="#64748b">
                    {item.label.split(' ').slice(1).join(' ')}
                  </text>
                </g>
              );
            })}
          </svg>
        ) : (
          <div className="mt-5 flex h-56 items-center justify-center rounded-xl bg-slate-50 px-6 text-center text-xs leading-5 text-slate-500">
            Start by creating a program. Pipeline analytics will appear as batches and learners are
            added.
          </div>
        )}
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-bold text-slate-900">Delivery health</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Capacity and outcome signals from current learner records.
        </p>
        <div className="mt-5 space-y-5">
          {[
            [
              'Active batch capacity used',
              capacityUse,
              `${enrolledSeats} of ${totalCapacity} seats`,
            ],
            [
              'Overall completion rate',
              completionRate,
              `${completed} of ${enrollments.length} enrollments`,
            ],
          ].map(([label, value, detail]) => (
            <div key={String(label)}>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-700">{label}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{detail}</p>
                </div>
                <strong className="text-xl text-slate-900">{value}%</strong>
              </div>
              <svg
                viewBox="0 0 100 8"
                className="mt-3 h-2 w-full overflow-hidden rounded-full"
                role="img"
                aria-label={`${label}: ${value}%`}
              >
                <rect width="100" height="8" rx="4" fill="#f1f5f9" />
                <rect width={Number(value)} height="8" rx="4" fill="#2563eb" />
              </svg>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-xl bg-emerald-50 p-4">
          <p className="text-xs font-bold text-emerald-800">Credential integrity</p>
          <p className="mt-1 text-[11px] leading-5 text-emerald-700">
            {credentials} active credential{credentials === 1 ? '' : 's'} can be independently
            verified using their unique public code.
          </p>
        </div>
      </article>
    </section>
  );
}

function Badge({ v }: { v: string }) {
  return (
    <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold capitalize text-primary">
      {v.replaceAll('_', ' ')}
    </span>
  );
}
function Shell({
  title,
  description,
  close,
  children,
}: {
  title: string;
  description: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-200/80 sm:items-center sm:p-4">
      <div className="max-h-[94dvh] w-full max-w-5xl overflow-y-auto rounded-t-3xl border border-slate-200 bg-white sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-linear-to-r from-blue-50 via-white to-violet-50 px-5 py-5 sm:px-7">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              Continuing education workflow
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">{title}</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            aria-label="Close form"
            onClick={close}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:border-blue-200 hover:text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 sm:p-7">{children}</div>
      </div>
    </div>
  );
}
function Err({ n }: { n: string }) {
  return <ErrorMessage name={n}>{(m) => <p className="text-xs text-red-500">{m}</p>}</ErrorMessage>;
}
function FieldHelp({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[11px] leading-4 text-slate-500">{children}</p>;
}
function Submit({ loading, label }: { loading: boolean; label: string }) {
  return (
    <div className="flex justify-end sm:col-span-2">
      <CustomButton type="submit" loading={loading}>
        {label}
      </CustomButton>
    </div>
  );
}
function OfferingForm({
  close,
  loading,
  submit,
}: {
  close: () => void;
  loading: boolean;
  submit: (v: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <Shell
      title="Create a short-course program"
      description="Define the reusable program first. Scheduled batches and learner registrations will be created from this program."
      close={close}
    >
      <Formik
        initialValues={{
          code: '',
          title: '',
          description: '',
          deliveryMode: 'online',
          durationHours: 1,
          fee: 0,
          credentialType: 'certificate',
          status: 'published',
          learningOutcomes: [''],
          prerequisites: '',
        }}
        validationSchema={Yup.object({
          code: Yup.string().required(),
          title: Yup.string().required(),
          description: Yup.string().min(5).required(),
          durationHours: Yup.number().positive().required(),
          fee: Yup.number().min(0).required(),
          learningOutcomes: Yup.array().of(Yup.string().required()).min(1),
        })}
        onSubmit={(v) =>
          submit({
            ...v,
            prerequisites: v.prerequisites
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean),
          })
        }
      >
        {({ values }) => (
          <Form className="grid gap-3 sm:grid-cols-2">
            {[
              ['code', 'Program code *', 'A short unique reference, for example DSA-101.'],
              ['title', 'Program title *', 'The learner-facing name displayed in the catalog.'],
              [
                'durationHours',
                'Duration (hours) *',
                'Total guided learning hours for completion.',
              ],
              ['fee', 'Fee *', 'Enter 0 when learners are not charged.'],
            ].map(([x, l, help]) => (
              <label key={x} className="text-sm">
                {l}
                <FieldHelp>{help}</FieldHelp>
                <Field
                  name={x}
                  type={['durationHours', 'fee'].includes(x) ? 'number' : 'text'}
                  className={cls}
                />
                <Err n={x} />
              </label>
            ))}
            <label className="text-sm">
              Delivery
              <FieldHelp>Choose how learners will attend this program.</FieldHelp>
              <Field as="select" name="deliveryMode" className={cls}>
                {['in_person', 'online', 'hybrid'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </Field>
            </label>
            <label className="text-sm">
              Credential
              <FieldHelp>Select what successful learners receive.</FieldHelp>
              <Field as="select" name="credentialType" className={cls}>
                {['certificate', 'badge', 'microcredential', 'non_credit'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </Field>
            </label>
            <label className="text-sm sm:col-span-2">
              Description *
              <FieldHelp>Explain the audience, subject coverage and practical value.</FieldHelp>
              <Field as="textarea" rows={4} name="description" className={cls} />
              <Err n="description" />
            </label>
            <FieldArray name="learningOutcomes">
              {({ push, remove }) => (
                <div className="space-y-2 sm:col-span-2">
                  <div className="flex justify-between">
                    <b>Learning outcomes *</b>
                    <button type="button" onClick={() => push('')} className="text-xs text-primary">
                      Add outcome
                    </button>
                  </div>
                  <FieldHelp>
                    Write measurable skills learners should demonstrate after completion.
                  </FieldHelp>
                  {values.learningOutcomes.map((_, i) => (
                    <div key={i} className="flex gap-2">
                      <Field name={`learningOutcomes.${i}`} className={cls} />
                      <button
                        type="button"
                        disabled={values.learningOutcomes.length === 1}
                        onClick={() => remove(i)}
                        className="text-xs text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </FieldArray>
            <label className="text-sm sm:col-span-2">
              Prerequisites (comma separated)
              <FieldHelp>Optional prior knowledge or eligibility requirements.</FieldHelp>
              <Field name="prerequisites" className={cls} />
            </label>
            <Submit loading={loading} label="Publish offering" />
          </Form>
        )}
      </Formik>
    </Shell>
  );
}
function CohortForm({
  offerings,
  campuses,
  close,
  loading,
  submit,
}: {
  offerings: Offering[];
  campuses: Campus[];
  close: () => void;
  loading: boolean;
  submit: (v: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <Shell
      title="Schedule a delivery batch"
      description="Choose a published program, establish the enrollment window, then define when, where and by whom it will be delivered."
      close={close}
    >
      <Formik
        initialValues={{
          offeringId: '',
          code: '',
          startsAt: '',
          endsAt: '',
          enrollmentOpensAt: '',
          enrollmentClosesAt: '',
          capacity: 20,
          instructorId: '',
          campusId: '',
          venue: '',
          meetingUrl: '',
          status: 'open',
        }}
        validationSchema={Yup.object({
          offeringId: Yup.string().required(),
          code: Yup.string().required(),
          enrollmentOpensAt: Yup.date().required(),
          enrollmentClosesAt: Yup.date().min(Yup.ref('enrollmentOpensAt')).required(),
          startsAt: Yup.date().min(Yup.ref('enrollmentClosesAt')).required(),
          endsAt: Yup.date().min(Yup.ref('startsAt')).required(),
          capacity: Yup.number().min(1).required(),
          instructorId: Yup.string().required(),
        })}
        onSubmit={submit}
      >
        {({ values, setFieldValue }) => (
          <Form className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Offering *<FieldHelp>Select the published program this batch will deliver.</FieldHelp>
              <Field as="select" name="offeringId" className={cls}>
                <option value="">Select published offering</option>
                {offerings
                  .filter((x) => x.status === 'published')
                  .map((x) => (
                    <option key={x._id} value={x._id}>
                      {x.code} · {x.title}
                    </option>
                  ))}
              </Field>
            </label>
            <label className="text-sm">
              Batch code *
              <FieldHelp>A unique operational reference, for example DSA-SEP-26.</FieldHelp>
              <Field name="code" className={cls} />
            </label>
            {[
              ['enrollmentOpensAt', 'Enrollment opens'],
              ['enrollmentClosesAt', 'Enrollment closes'],
              ['startsAt', 'Cohort starts'],
              ['endsAt', 'Cohort ends'],
            ].map(([x, l]) => (
              <label key={x} className="text-sm">
                {l} *
                <FieldHelp>Dates must follow enrollment opening → closing → delivery.</FieldHelp>
                <Field type="datetime-local" name={x} className={cls} />
                <Err n={x} />
              </label>
            ))}
            <label className="text-sm">
              Learner capacity *
              <FieldHelp>Enrollment closes automatically when all seats are filled.</FieldHelp>
              <Field type="number" name="capacity" className={cls} />
            </label>
            <AsyncSelect
              type="faculty"
              label="Instructor"
              required
              value={values.instructorId}
              onChange={(v) => setFieldValue('instructorId', v ?? '')}
              placeholder="Search active faculty by name or employee code"
              emptyMessage="No active faculty members match this search."
            />
            <label className="text-sm">
              Campus
              <FieldHelp>Leave empty for a fully online batch.</FieldHelp>
              <Field as="select" name="campusId" className={cls}>
                <option value="">Online / no campus</option>
                {campuses.map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.code} · {x.name}
                  </option>
                ))}
              </Field>
            </label>
            <label className="text-sm">
              Venue
              <FieldHelp>Optional room, building or external delivery location.</FieldHelp>
              <Field name="venue" className={cls} />
            </label>
            <label className="text-sm sm:col-span-2">
              Meeting URL
              <FieldHelp>Required operational link when delivery is online or hybrid.</FieldHelp>
              <Field name="meetingUrl" className={cls} />
            </label>
            <Submit loading={loading} label="Create cohort" />
          </Form>
        )}
      </Formik>
    </Shell>
  );
}
function EnrollmentForm({
  cohorts,
  close,
  loading,
  submit,
}: {
  cohorts: Cohort[];
  close: () => void;
  loading: boolean;
  submit: (v: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <Shell
      title="Enroll a learner"
      description="Register an internal or external learner into an open batch. Fee and enrollment status are determined from the selected program."
      close={close}
    >
      <Formik
        initialValues={{ cohortId: '', learnerId: '', learnerName: '', learnerEmail: '' }}
        validationSchema={Yup.object({
          cohortId: Yup.string().required(),
          learnerName: Yup.string().required(),
          learnerEmail: Yup.string().email().required(),
        })}
        onSubmit={submit}
      >
        {({ values, setFieldValue }) => (
          <Form className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              Open cohort *
              <FieldHelp>Only batches currently accepting registrations are available.</FieldHelp>
              <Field as="select" name="cohortId" className={cls}>
                <option value="">Select cohort</option>
                {cohorts
                  .filter((x) => x.status === 'open')
                  .map((x) => (
                    <option key={x._id} value={x._id}>
                      {x.code} · {name(x.offeringId)}
                    </option>
                  ))}
              </Field>
            </label>
            <AsyncSelect
              type="users"
              label="Existing user (optional)"
              value={values.learnerId}
              params={{ excludeRoles: 'super_admin' }}
              placeholder="Search an institutional learner account"
              emptyMessage="No eligible institutional users match this search."
              onChange={(v, o) => {
                setFieldValue('learnerId', v ?? '');
                if (o) {
                  setFieldValue('learnerName', o.label);
                  if (o.sub?.includes('@')) setFieldValue('learnerEmail', o.sub);
                }
              }}
            />
            <label className="text-sm">
              Learner name *
              <FieldHelp>Auto-filled for an existing user, or enter an external learner.</FieldHelp>
              <Field name="learnerName" className={cls} />
              <Err n="learnerName" />
            </label>
            <label className="text-sm">
              Learner email *
              <FieldHelp>Used as the learner identity for enrollment and credentials.</FieldHelp>
              <Field name="learnerEmail" className={cls} />
              <Err n="learnerEmail" />
            </label>
            <Submit loading={loading} label="Enroll learner" />
          </Form>
        )}
      </Formik>
    </Shell>
  );
}
function ProgressForm({
  item,
  close,
  loading,
  submit,
}: {
  item: Enrollment;
  close: () => void;
  loading: boolean;
  submit: (v: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <Shell
      title={`Update ${item.enrollmentNumber}`}
      description="Record the learner's attendance, assessment result and payment position before the outcome is finalized."
      close={close}
    >
      <Formik
        initialValues={{
          attendancePercent: item.attendancePercent,
          assessmentScore: item.assessmentScore ?? '',
          paymentStatus: item.paymentStatus,
        }}
        validationSchema={Yup.object({
          attendancePercent: Yup.number().min(0).max(100).required(),
          assessmentScore: Yup.number().min(0).max(100).nullable(),
          paymentStatus: Yup.string().required(),
        })}
        onSubmit={submit}
      >
        {() => (
          <Form className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Attendance % *
              <FieldHelp>Enter the verified participation percentage from 0 to 100.</FieldHelp>
              <Field type="number" name="attendancePercent" className={cls} />
            </label>
            <label className="text-sm">
              Assessment score
              <FieldHelp>Leave empty when this program has no scored assessment.</FieldHelp>
              <Field type="number" name="assessmentScore" className={cls} />
            </label>
            <label className="text-sm">
              Payment status
              <FieldHelp>
                Paid or not-required status is mandatory before successful completion.
              </FieldHelp>
              <Field as="select" name="paymentStatus" className={cls}>
                {['not_required', 'pending', 'paid', 'refunded'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </Field>
            </label>
            <Submit loading={loading} label="Update progress" />
          </Form>
        )}
      </Formik>
    </Shell>
  );
}
function CompleteForm({
  close,
  loading,
  submit,
}: {
  close: () => void;
  loading: boolean;
  submit: (v: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <Shell
      title="Finalize learner outcome"
      description="Apply the completion thresholds. A successful, payment-cleared learner receives a unique verifiable credential."
      close={close}
    >
      <Formik
        initialValues={{ outcome: 'completed', attendanceThreshold: 75, scoreThreshold: 50 }}
        validationSchema={Yup.object({
          outcome: Yup.string().required(),
          attendanceThreshold: Yup.number().min(0).max(100).required(),
          scoreThreshold: Yup.number().min(0).max(100),
        })}
        onSubmit={submit}
      >
        {() => (
          <Form className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Outcome
              <FieldHelp>Completed issues a credential; failed closes without one.</FieldHelp>
              <Field as="select" name="outcome" className={cls}>
                <option value="completed">Completed · issue credential</option>
                <option value="failed">Not completed</option>
              </Field>
            </label>
            <label className="text-sm">
              Attendance threshold %
              <FieldHelp>Minimum attendance required for successful completion.</FieldHelp>
              <Field type="number" name="attendanceThreshold" className={cls} />
            </label>
            <label className="text-sm">
              Score threshold %
              <FieldHelp>Minimum assessment score required for the credential.</FieldHelp>
              <Field type="number" name="scoreThreshold" className={cls} />
            </label>
            <Submit loading={loading} label="Finalize outcome" />
          </Form>
        )}
      </Formik>
    </Shell>
  );
}

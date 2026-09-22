'use client';

import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Action, Column } from '@/shared/core/CustomTable';
import InlineFileUpload from '@/shared/core/InlineFileUpload';
import { IViewerFile } from '@/shared/core/FileViewer';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import {
  Activity,
  BadgeCheck,
  CheckCircle2,
  Eye,
  FileBadge,
  FlaskConical,
  IndianRupee,
  Lightbulb,
  Plus,
  Rocket,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

type TProjectStatus =
  | 'submitted'
  | 'screening'
  | 'evaluation'
  | 'approved'
  | 'incubating'
  | 'completed'
  | 'rejected';
interface IPerson {
  _id: string;
  name?: string;
  email?: string;
}
interface IProject extends Record<string, unknown> {
  _id: string;
  title: string;
  problemStatement: string;
  proposedSolution: string;
  category: string;
  submitterId: IPerson | string;
  teamMemberIds: Array<IPerson | string>;
  mentorId?: IPerson | string;
  status: TProjectStatus;
  evaluationScore?: number;
  evaluationNote?: string;
  fundingAllocated: number;
  fundingSpent: number;
  milestones: {
    title: string;
    dueDate: string;
    status: 'planned' | 'completed';
    evidenceUrl?: string;
  }[];
  ipRecords: { type: string; applicationNumber: string; status: string }[];
  prototypeUrl?: string;
  startupName?: string;
  incorporationNumber?: string;
  outcome?: string;
}
interface IActivity extends Record<string, unknown> {
  _id: string;
  title: string;
  description?: string;
  kind: string;
  quarter: string;
  academicYear: string;
  startDate: string;
  endDate?: string;
  venue?: string;
  participantCount?: number;
  facultyCoordinator?: IPerson | string;
  studentCoordinator?: IPerson | string;
  outcome?: string;
  proofUrl?: string;
  reportedToMic: boolean;
}
interface IIicStats {
  activities: { total: number; reported: number; pending: number };
  projects: {
    total: number;
    active: number;
    incubating: number;
    completed: number;
    ipRecords: number;
    allocated: number;
    spent: number;
  };
  projectStages: Array<{ _id: string; count: number }>;
  categories: Array<{ _id: string; count: number }>;
  byQuarter: Array<{ _id: string; count: number }>;
  activityKinds: Array<{ _id: string; count: number; participants: number }>;
}
const fieldClass =
  'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15';
const nextStatus: Record<TProjectStatus, TProjectStatus[]> = {
  submitted: ['screening', 'rejected'],
  screening: ['evaluation', 'rejected'],
  evaluation: ['approved', 'rejected'],
  approved: ['incubating'],
  incubating: ['completed'],
  completed: [],
  rejected: [],
};

export default function IicPage() {
  const canCreate = useHasPermission('iic', 'create');
  const canEdit = useHasPermission('iic', 'edit');
  const canApprove = useHasPermission('iic', 'approve');
  const [tab, setTab] = useState<'overview' | 'projects' | 'activities'>('overview');
  const [projectOpen, setProjectOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const {
    data: projectRaw,
    isLoading: loadingProjects,
    isValidating: refreshingProjects,
    mutate: refreshProjects,
  } = useSwr('iic/projects');
  const {
    data: activityRaw,
    isLoading: loadingActivities,
    isValidating: refreshingActivities,
    mutate: refreshActivities,
  } = useSwr('iic');
  const { data: statsRaw, isLoading: loadingStats, mutate: refreshStats } = useSwr('iic/stats');
  const projects = (projectRaw as { data?: IProject[] })?.data ?? [];
  const activities = (activityRaw as { data?: IActivity[] })?.data ?? [];
  const { mutation } = useMutation();
  const markReported = async (row: IActivity) => {
    const response = await mutation(`iic/${row._id}/reported`, { method: 'PATCH' });
    if (!response?.results?.success) return;
    toast.success('Activity included in MIC reporting');
    refreshActivities();
  };
  const projectColumns: Column<IProject>[] = [
    { field: 'title', title: 'Innovation' },
    { field: 'category', title: 'Category' },
    {
      field: 'submitterId',
      title: 'Lead',
      render: (row) =>
        typeof row.submitterId === 'object' ? (row.submitterId.name ?? '—') : 'Project lead',
    },
    { field: 'status', title: 'Stage', render: (row) => <Stage value={row.status} /> },
    {
      field: 'mentorId',
      title: 'Mentor',
      render: (row) =>
        typeof row.mentorId === 'object' ? (row.mentorId.name ?? '—') : 'Not assigned',
    },
    {
      field: 'fundingAllocated',
      title: 'Funding',
      render: (row) =>
        `₹${row.fundingSpent.toLocaleString('en-IN')} / ₹${row.fundingAllocated.toLocaleString('en-IN')}`,
    },
  ];
  const activityColumns: Column<IActivity>[] = [
    { field: 'title', title: 'Activity' },
    { field: 'kind', title: 'Type', render: (row) => row.kind.replace('_', ' ') },
    { field: 'quarter', title: 'Period', render: (row) => `${row.quarter} · ${row.academicYear}` },
    {
      field: 'startDate',
      title: 'Date',
      render: (row) => new Date(row.startDate).toLocaleDateString('en-IN'),
    },
    {
      field: 'participantCount',
      title: 'Participants',
      render: (row) => row.participantCount ?? '—',
    },
    {
      field: 'reportedToMic',
      title: 'MIC',
      render: (row) => <Stage value={row.reportedToMic ? 'reported' : 'pending'} />,
    },
  ];
  const projectActions: Action<IProject>[] = [
    {
      icon: <Eye size={15} />,
      tooltip: 'Open innovation workspace',
      onClick: (row) => setProjectId(row._id),
    },
  ];
  const activityActions: Action<IActivity>[] = canApprove
    ? [
        {
          icon: <CheckCircle2 size={15} />,
          tooltip: 'Mark reported to MIC',
          onClick: markReported,
          hidden: (row) => row.reportedToMic,
        },
      ]
    : [];

  return (
    <div className="space-y-5 pb-8">
      <header>
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            <Lightbulb className="h-4 w-4" /> Idea to measurable impact
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">Innovation & Incubation</h1>
          <p className="mt-1 text-sm text-slate-500">
            Evaluate ideas, incubate projects, govern funding and record IP, prototypes and
            startups.
          </p>
        </div>
      </header>
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {[
          { key: 'overview' as const, label: 'Overview', icon: Activity },
          { key: 'projects' as const, label: 'Innovation pipeline', icon: Lightbulb },
          { key: 'activities' as const, label: 'Activities & MIC reporting', icon: FileBadge },
        ].map((item) => (
          <button
            type="button"
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${tab === item.key ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>
      {tab === 'overview' ? (
        <IicOverview
          data={(statsRaw as { data?: IIicStats })?.data}
          loading={loadingStats}
          onRefresh={() => refreshStats()}
        />
      ) : tab === 'projects' ? (
        <>
          <CustomTable
            data={projects}
            columns={projectColumns}
            actions={projectActions}
            isLoading={loadingProjects}
            isValidating={refreshingProjects}
            title="Innovation pipeline"
            description="Submitted ideas, evaluation stages, mentors, incubation funding and measurable outcomes."
            onRefresh={() => refreshProjects()}
            customActions={
              <CustomButton
                startIcon={<Plus className="h-4 w-4" />}
                onClick={() => setProjectOpen(true)}
              >
                Submit idea
              </CustomButton>
            }
            options={{ search: true, refresh: true, pagination: true, export: true }}
          />
        </>
      ) : (
        <>
          <CustomTable
            data={activities}
            columns={activityColumns}
            actions={activityActions}
            isLoading={loadingActivities}
            isValidating={refreshingActivities}
            title="IIC activity register"
            description="Quarterly innovation activities, participation, evidence and MIC reporting readiness."
            onRefresh={() => refreshActivities()}
            customActions={
              canCreate ? (
                <CustomButton
                  startIcon={<Plus className="h-4 w-4" />}
                  onClick={() => setActivityOpen(true)}
                >
                  Record activity
                </CustomButton>
              ) : undefined
            }
            options={{ search: true, refresh: true, pagination: true, export: true }}
          />
        </>
      )}
      {projectOpen && (
        <ProjectForm
          onClose={() => setProjectOpen(false)}
          onSaved={async () => {
            await refreshProjects();
            setProjectOpen(false);
          }}
        />
      )}
      {activityOpen && (
        <ActivityForm
          onClose={() => setActivityOpen(false)}
          onSaved={async () => {
            await refreshActivities();
            setActivityOpen(false);
          }}
        />
      )}
      {projectId && (
        <ProjectWorkspace
          id={projectId}
          canEdit={canEdit}
          canApprove={canApprove}
          onClose={() => setProjectId(null)}
          onChanged={refreshProjects}
        />
      )}
    </div>
  );
}

function IicOverview({
  data,
  loading,
  onRefresh,
}: {
  data?: IIicStats;
  loading: boolean;
  onRefresh: () => void;
}) {
  const project = data?.projects;
  const activity = data?.activities;
  const cards = [
    {
      label: 'Innovation ideas',
      value: project?.total ?? 0,
      icon: Lightbulb,
      tone: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Active pipeline',
      value: project?.active ?? 0,
      icon: Activity,
      tone: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Incubating',
      value: project?.incubating ?? 0,
      icon: FlaskConical,
      tone: 'bg-violet-50 text-violet-700',
    },
    {
      label: 'Completed outcomes',
      value: project?.completed ?? 0,
      icon: Rocket,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'IP records',
      value: project?.ipRecords ?? 0,
      icon: BadgeCheck,
      tone: 'bg-cyan-50 text-cyan-700',
    },
    {
      label: 'Funding utilized',
      value: money(project?.spent ?? 0),
      icon: IndianRupee,
      tone: 'bg-rose-50 text-rose-700',
    },
  ];
  return (
    <section className="space-y-4" aria-label="IIC analytics overview">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Innovation intelligence</h2>
          <p className="text-sm text-slate-500">
            Institution-wide ideas, incubation maturity, funding, IP and MIC evidence readiness.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-primary hover:text-primary"
        >
          Refresh
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <article
            key={label}
            className="flex min-h-20 items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tone}`}>
                <Icon className="h-5 w-5" />
              </span>
              <p className="text-sm font-semibold text-slate-600">{label}</p>
            </div>
            <p className="shrink-0 text-right text-2xl font-black text-slate-950">
              {loading ? '—' : value}
            </p>
          </article>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <OverviewPanel
          title="Innovation stage pipeline"
          description="Ideas across governance and incubation stages."
        >
          <StageChart data={data?.projectStages ?? []} />
        </OverviewPanel>
        <OverviewPanel
          title="MIC reporting readiness"
          description="Activities with complete evidence compared with pending reports."
        >
          <ReadinessChart
            reported={activity?.reported ?? 0}
            pending={activity?.pending ?? 0}
            total={activity?.total ?? 0}
          />
        </OverviewPanel>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <RankedData
          title="Innovation categories"
          data={(data?.categories ?? []).map((item) => ({ label: item._id, value: item.count }))}
        />
        <RankedData
          title="Activities by quarter"
          data={(data?.byQuarter ?? []).map((item) => ({ label: item._id, value: item.count }))}
        />
        <RankedData
          title="Participation by activity"
          data={(data?.activityKinds ?? []).map((item) => ({
            label: item._id.replaceAll('_', ' '),
            value: item.participants,
          }))}
          suffix=" participants"
        />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900">Incubation funding control</h3>
            <p className="text-xs text-slate-500">
              Approved allocation compared with recorded utilization.
            </p>
          </div>
          <strong className="text-sm text-slate-700">
            {money(project?.spent ?? 0)} / {money(project?.allocated ?? 0)}
          </strong>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-primary"
            style={{
              width: `${project?.allocated ? Math.min(100, ((project.spent ?? 0) / project.allocated) * 100) : 0}%`,
            }}
          />
        </div>
      </div>
    </section>
  );
}

function OverviewPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="font-bold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500">{description}</p>
      <div className="mt-5">{children}</div>
    </article>
  );
}

function StageChart({ data }: { data: IIicStats['projectStages'] }) {
  if (!data.length)
    return <AnalyticsEmpty text="Innovation stages appear after the first idea is submitted." />;
  const order: TProjectStatus[] = [
    'submitted',
    'screening',
    'evaluation',
    'approved',
    'incubating',
    'completed',
  ];
  const values = order.map((stage) => ({
    stage,
    count: data.find((item) => item._id === stage)?.count ?? 0,
  }));
  const max = Math.max(...values.map((item) => item.count), 1);
  return (
    <svg
      viewBox="0 0 680 215"
      role="img"
      aria-label="Innovation pipeline by stage"
      className="h-56 w-full min-w-[580px]"
    >
      {[45, 90, 135, 180].map((y) => (
        <line key={y} x1="35" x2="650" y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 5" />
      ))}
      {values.map((item, index) => {
        const width = 62;
        const gap = 38;
        const x = 46 + index * (width + gap);
        const height = Math.max(4, (item.count / max) * 135);
        return (
          <g key={item.stage}>
            <rect
              x={x}
              y={180 - height}
              width={width}
              height={height}
              rx="7"
              fill={item.stage === 'completed' ? '#059669' : '#0178d7'}
            >
              <title>{`${item.stage}: ${item.count}`}</title>
            </rect>
            <text
              x={x + width / 2}
              y="202"
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill="#64748b"
            >
              {item.stage.slice(0, 9)}
            </text>
            <text
              x={x + width / 2}
              y={172 - height}
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill="#334155"
            >
              {item.count}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ReadinessChart({
  reported,
  pending,
  total,
}: {
  reported: number;
  pending: number;
  total: number;
}) {
  const rate = total ? Math.round((reported / total) * 100) : 0;
  const circumference = 2 * Math.PI * 54;
  return (
    <div className="flex flex-wrap items-center justify-center gap-8">
      <svg
        viewBox="0 0 140 140"
        className="h-40 w-40"
        role="img"
        aria-label={`${rate}% of IIC activities reported to MIC`}
      >
        <circle cx="70" cy="70" r="54" fill="none" stroke="#e2e8f0" strokeWidth="14" />
        <circle
          cx="70"
          cy="70"
          r="54"
          fill="none"
          stroke="#059669"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${(rate / 100) * circumference} ${circumference}`}
          transform="rotate(-90 70 70)"
        />
        <text x="70" y="67" textAnchor="middle" fontSize="24" fontWeight="800" fill="#0f172a">
          {rate}%
        </text>
        <text x="70" y="88" textAnchor="middle" fontSize="10" fill="#64748b">
          MIC ready
        </text>
      </svg>
      <div className="space-y-3 text-sm">
        <p className="flex justify-between gap-8 text-slate-600">
          <span>Reported</span>
          <strong className="text-emerald-700">{reported}</strong>
        </p>
        <p className="flex justify-between gap-8 text-slate-600">
          <span>Pending evidence</span>
          <strong className="text-amber-700">{pending}</strong>
        </p>
        <p className="flex justify-between gap-8 border-t border-slate-200 pt-3 text-slate-600">
          <span>Total activities</span>
          <strong>{total}</strong>
        </p>
      </div>
    </div>
  );
}

function RankedData({
  title,
  data,
  suffix = '',
}: {
  title: string;
  data: Array<{ label: string; value: number }>;
  suffix?: string;
}) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="font-bold text-slate-900">{title}</h3>
      {data.length ? (
        <div className="mt-5 space-y-4">
          {data.map((item) => (
            <div key={item.label}>
              <div className="mb-1.5 flex justify-between gap-3 text-xs">
                <span className="truncate capitalize text-slate-600">{item.label}</span>
                <strong>
                  {item.value}
                  {suffix}
                </strong>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(item.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <AnalyticsEmpty text="No verified data available yet." />
      )}
    </article>
  );
}

function AnalyticsEmpty({ text }: { text: string }) {
  return (
    <div className="grid min-h-36 place-items-center rounded-lg border border-dashed border-slate-200 px-5 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}
function money(value: number) {
  return `₹${new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`;
}

function ProjectForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { mutation, isLoading } = useMutation();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Product innovation');
  const [problem, setProblem] = useState('');
  const [solution, setSolution] = useState('');
  const [team, setTeam] = useState<string[]>([]);
  return (
    <Modal
      title="Submit an innovation idea"
      sub="The idea starts as submitted and is evaluated by the IIC team."
      onClose={onClose}
    >
      <div className="grid gap-4">
        <label className="text-sm font-semibold text-slate-700">
          Idea title <span className="text-rose-600">*</span>
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Use a clear name that identifies the proposed innovation.
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Example: Smart campus water monitor"
            className={fieldClass}
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Innovation category <span className="text-rose-600">*</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={fieldClass}
          >
            {[
              'Product innovation',
              'Process innovation',
              'Social innovation',
              'Digital solution',
              'Sustainability',
              'Healthcare',
              'Other',
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Problem statement <span className="text-rose-600">*</span>
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Describe affected users, current difficulty and supporting evidence.
            </span>
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              rows={6}
              placeholder="What problem are you solving?"
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Proposed solution <span className="text-rose-600">*</span>
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Explain novelty, feasibility and the expected measurable impact.
            </span>
            <textarea
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
              rows={6}
              placeholder="How will your solution work?"
              className={fieldClass}
            />
          </label>
        </div>
        <AsyncSelect
          type="users"
          multiple
          label="Team members"
          value={team}
          onChange={setTeam}
          placeholder="Search students or faculty by name"
        />
        <div className="flex justify-end gap-2">
          <CustomButton variant="cancel" onClick={onClose}>
            Cancel
          </CustomButton>
          <CustomButton
            loading={isLoading}
            onClick={async () => {
              if (
                title.trim().length < 3 ||
                problem.trim().length < 20 ||
                solution.trim().length < 20
              )
                return toast.error('Add a clear title, problem and proposed solution');
              const response = await mutation('iic/projects', {
                method: 'POST',
                body: {
                  title,
                  category,
                  problemStatement: problem,
                  proposedSolution: solution,
                  teamMemberIds: team,
                },
              });
              if (!response?.results?.success) return;
              toast.success('Innovation idea submitted');
              onSaved();
            }}
          >
            Submit idea
          </CustomButton>
        </div>
      </div>
    </Modal>
  );
}

function ActivityForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { mutation, isLoading } = useMutation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState('workshop');
  const [quarter, setQuarter] = useState('Q1');
  const [academicYear, setAcademicYear] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [venue, setVenue] = useState('');
  const [participants, setParticipants] = useState('');
  const [faculty, setFaculty] = useState('');
  const [student, setStudent] = useState('');
  const [outcome, setOutcome] = useState('');
  const [proof, setProof] = useState<IViewerFile[]>([]);
  const upload = async (file: File) => {
    const body = new FormData();
    body.append('file', file);
    const response = await mutation('upload', {
      method: 'POST',
      body,
      isFormData: true,
      dedupe: false,
    });
    const data = response?.results?.data as { url?: string; filename?: string } | undefined;
    if (!data?.url) return false;
    setProof([{ url: data.url, name: data.filename ?? file.name }]);
    return true;
  };
  return (
    <Modal
      title="Record IIC activity"
      sub="Capture coordinators, participation, outcome and owned evidence before MIC reporting."
      onClose={onClose}
    >
      <div className="grid gap-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Activity title"
          className={fieldClass}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Purpose and agenda"
          className={fieldClass}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={fieldClass}>
            {[
              'workshop',
              'hackathon',
              'ideation',
              'expert_lecture',
              'industry_visit',
              'celebration',
              'other',
            ].map((v) => (
              <option key={v}>{v.replace('_', ' ')}</option>
            ))}
          </select>
          <select
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
            className={fieldClass}
          >
            {['Q1', 'Q2', 'Q3', 'Q4'].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <AsyncSelect
            type="academicYears"
            value={academicYear || null}
            onChange={(value) => setAcademicYear(value ?? '')}
            placeholder="Academic year"
          />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={fieldClass}
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={fieldClass}
          />
          <input
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="Venue"
            className={fieldClass}
          />
          <AsyncSelect
            type="faculty"
            value={faculty || null}
            onChange={(value) => setFaculty(value ?? '')}
            placeholder="Faculty coordinator"
          />
          <AsyncSelect
            type="students"
            value={student || null}
            onChange={(value) => setStudent(value ?? '')}
            placeholder="Student coordinator"
          />
          <input
            type="number"
            min="0"
            value={participants}
            onChange={(e) => setParticipants(e.target.value)}
            placeholder="Participant count"
            className={fieldClass}
          />
        </div>
        <textarea
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          rows={3}
          placeholder="Measured outcome"
          className={fieldClass}
        />
        <InlineFileUpload
          label="Report or photo evidence"
          files={proof}
          onUpload={upload}
          onRemove={async () => setProof([])}
        />
        <div className="flex justify-end gap-2">
          <CustomButton variant="cancel" onClick={onClose}>
            Cancel
          </CustomButton>
          <CustomButton
            loading={isLoading}
            onClick={async () => {
              if (!title.trim() || !academicYear || !startDate)
                return toast.error('Title, academic year and start date are required');
              const response = await mutation('iic', {
                method: 'POST',
                body: {
                  title,
                  description,
                  kind,
                  quarter,
                  academicYear,
                  startDate,
                  endDate: endDate || undefined,
                  venue,
                  participantCount: participants ? Number(participants) : undefined,
                  facultyCoordinator: faculty || undefined,
                  studentCoordinator: student || undefined,
                  outcome,
                  proofUrl: proof[0]?.url,
                },
              });
              if (!response?.results?.success) return;
              toast.success('IIC activity recorded');
              onSaved();
            }}
          >
            Save activity
          </CustomButton>
        </div>
      </div>
    </Modal>
  );
}

function ProjectWorkspace({
  id,
  canEdit,
  canApprove,
  onClose,
  onChanged,
}: {
  id: string;
  canEdit: boolean;
  canApprove: boolean;
  onClose: () => void;
  onChanged: () => void | Promise<unknown>;
}) {
  const { data, mutate } = useSwr<{ data?: IProject }>(`iic/projects/${id}`);
  const project = data?.data;
  const { mutation, isLoading } = useMutation();
  const [mentorId, setMentorId] = useState('');
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDue, setMilestoneDue] = useState('');
  const [allocated, setAllocated] = useState('');
  const [spent, setSpent] = useState('');
  const [ipType, setIpType] = useState('patent');
  const [ipNumber, setIpNumber] = useState('');
  const [ipStatus, setIpStatus] = useState('filed');
  const refresh = async () => {
    await mutate();
    await onChanged();
  };
  if (!project)
    return (
      <Modal title="Innovation workspace" onClose={onClose}>
        <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
      </Modal>
    );
  const transition = async (status: TProjectStatus) => {
    const result = await Swal.fire({
      title: `Move to ${status}?`,
      input: 'textarea',
      inputPlaceholder: 'Evaluation note / decision reason',
      showCancelButton: true,
      ...(project.status === 'evaluation' && status === 'approved'
        ? { inputLabel: 'Add the decision note; score is requested next' }
        : {}),
    });
    if (!result.isConfirmed) return;
    let score: number | undefined;
    if (project.status === 'evaluation' && status === 'approved') {
      const scoreResult = await Swal.fire({
        title: 'Evaluation score',
        input: 'number',
        inputAttributes: { min: '0', max: '100' },
        showCancelButton: true,
      });
      if (!scoreResult.isConfirmed) return;
      score = Number(scoreResult.value);
    }
    const response = await mutation(`iic/projects/${id}/transition`, {
      method: 'PATCH',
      body: { status, note: result.value, score },
    });
    if (response?.results?.success) refresh();
  };
  return (
    <Modal
      title={project.title}
      sub={`${project.category} · ${project.status.replace('_', ' ')}`}
      onClose={onClose}
      wide
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <main className="space-y-4">
          <section className="rounded-2xl bg-slate-50 p-4">
            <h3 className="font-bold">Problem</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
              {project.problemStatement}
            </p>
            <h3 className="mt-4 font-bold">Proposed solution</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
              {project.proposedSolution}
            </p>
          </section>
          <section className="rounded-2xl bg-slate-50 p-4">
            <h3 className="font-bold">Milestones</h3>
            {project.milestones.map((item, index) => (
              <div key={`${item.title}-${index}`} className="mt-2 rounded-xl bg-white p-3 text-sm">
                <div className="flex justify-between">
                  <span>{item.title}</span>
                  <Stage value={item.status} />
                </div>
                <p className="text-xs text-slate-600">
                  Due {new Date(item.dueDate).toLocaleDateString('en-IN')}
                </p>
                {canEdit && item.status === 'planned' && (
                  <EvidenceCompletion projectId={id} index={index} onDone={refresh} />
                )}
              </div>
            ))}
            {!project.milestones.length && (
              <p className="mt-2 text-xs text-slate-600">No milestones added yet.</p>
            )}
          </section>
          <section className="rounded-2xl bg-slate-50 p-4">
            <h3 className="font-bold">IP & outcomes</h3>
            {project.ipRecords.map((item, index) => (
              <p key={`${item.applicationNumber}-${index}`} className="mt-2 text-sm">
                {item.type} · {item.applicationNumber} · {item.status}
              </p>
            ))}
            {project.outcome && <p className="mt-3 text-sm text-slate-600">{project.outcome}</p>}
          </section>
        </main>
        {(canEdit || canApprove) && (
          <aside className="space-y-4">
            {canApprove && nextStatus[project.status].length > 0 && (
              <Panel title="Evaluation & stage">
                {nextStatus[project.status].map((status) => (
                  <CustomButton
                    key={status}
                    variant={status === 'rejected' ? 'cancel' : 'secondary'}
                    onClick={() => transition(status)}
                    className="mt-2 w-full"
                  >
                    {status.replace('_', ' ')}
                  </CustomButton>
                ))}
              </Panel>
            )}
            {canEdit && ['approved', 'incubating'].includes(project.status) && (
              <Panel title="Mentor">
                <AsyncSelect
                  type="users"
                  value={mentorId || null}
                  onChange={(value) => setMentorId(value ?? '')}
                  placeholder="Search mentor"
                />
                <CustomButton
                  className="mt-2 w-full"
                  loading={isLoading}
                  onClick={async () => {
                    if (!mentorId) return toast.error('Choose a mentor');
                    const r = await mutation(`iic/projects/${id}/mentor`, {
                      method: 'PATCH',
                      body: { mentorId },
                    });
                    if (r?.results?.success) refresh();
                  }}
                >
                  Assign mentor
                </CustomButton>
              </Panel>
            )}
            {canEdit && project.status === 'incubating' && (
              <Panel title="Milestone">
                <input
                  value={milestoneTitle}
                  onChange={(e) => setMilestoneTitle(e.target.value)}
                  placeholder="Milestone title"
                  className={fieldClass}
                />
                <input
                  type="date"
                  value={milestoneDue}
                  onChange={(e) => setMilestoneDue(e.target.value)}
                  className={`${fieldClass} mt-2`}
                />
                <CustomButton
                  className="mt-2 w-full"
                  onClick={async () => {
                    const r = await mutation(`iic/projects/${id}/milestones`, {
                      method: 'POST',
                      body: { title: milestoneTitle, dueDate: milestoneDue },
                    });
                    if (r?.results?.success) refresh();
                  }}
                >
                  Add milestone
                </CustomButton>
              </Panel>
            )}
            {canEdit && ['approved', 'incubating'].includes(project.status) && (
              <Panel title="Funding">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={allocated}
                    onChange={(e) => setAllocated(e.target.value)}
                    placeholder="Allocated"
                    className={fieldClass}
                  />
                  <input
                    type="number"
                    value={spent}
                    onChange={(e) => setSpent(e.target.value)}
                    placeholder="Spent"
                    className={fieldClass}
                  />
                </div>
                <CustomButton
                  className="mt-2 w-full"
                  onClick={async () => {
                    const r = await mutation(`iic/projects/${id}/funding`, {
                      method: 'PATCH',
                      body: { allocated: Number(allocated), spent: Number(spent) },
                    });
                    if (r?.results?.success) refresh();
                  }}
                >
                  Update funding
                </CustomButton>
              </Panel>
            )}
            {canEdit && ['approved', 'incubating', 'completed'].includes(project.status) && (
              <Panel title="IP record">
                <select
                  value={ipType}
                  onChange={(e) => setIpType(e.target.value)}
                  className={fieldClass}
                >
                  {['patent', 'copyright', 'trademark', 'design'].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
                <input
                  value={ipNumber}
                  onChange={(e) => setIpNumber(e.target.value)}
                  placeholder="Application number"
                  className={`${fieldClass} mt-2`}
                />
                <select
                  value={ipStatus}
                  onChange={(e) => setIpStatus(e.target.value)}
                  className={`${fieldClass} mt-2`}
                >
                  {['draft', 'filed', 'published', 'granted', 'rejected'].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
                <CustomButton
                  className="mt-2 w-full"
                  onClick={async () => {
                    const r = await mutation(`iic/projects/${id}/ip`, {
                      method: 'POST',
                      body: { type: ipType, applicationNumber: ipNumber, status: ipStatus },
                    });
                    if (r?.results?.success) refresh();
                  }}
                >
                  Add IP record
                </CustomButton>
              </Panel>
            )}
            {canEdit && ['incubating', 'completed'].includes(project.status) && (
              <OutcomePanel id={id} onDone={refresh} />
            )}
          </aside>
        )}
      </div>
    </Modal>
  );
}

function EvidenceCompletion({
  projectId,
  index,
  onDone,
}: {
  projectId: string;
  index: number;
  onDone: () => void;
}) {
  const { mutation } = useMutation();
  const [files, setFiles] = useState<IViewerFile[]>([]);
  return (
    <InlineFileUpload
      compact
      label="Completion evidence"
      files={files}
      onUpload={async (file) => {
        const body = new FormData();
        body.append('file', file);
        const uploaded = await mutation('upload', {
          method: 'POST',
          body,
          isFormData: true,
          dedupe: false,
        });
        const item = uploaded?.results?.data as { url?: string; filename?: string } | undefined;
        if (!item?.url) return false;
        setFiles([{ url: item.url, name: item.filename ?? file.name }]);
        const done = await mutation(`iic/projects/${projectId}/milestones/${index}/complete`, {
          method: 'PATCH',
          body: { evidenceUrl: item.url },
        });
        if (done?.results?.success) onDone();
        return Boolean(done?.results?.success);
      }}
    />
  );
}
function OutcomePanel({ id, onDone }: { id: string; onDone: () => void }) {
  const { mutation, isLoading } = useMutation();
  const [outcome, setOutcome] = useState('');
  const [startup, setStartup] = useState('');
  const [incorporation, setIncorporation] = useState('');
  const [files, setFiles] = useState<IViewerFile[]>([]);
  return (
    <Panel title="Prototype / startup outcome">
      <textarea
        value={outcome}
        onChange={(e) => setOutcome(e.target.value)}
        rows={3}
        placeholder="Measured outcome"
        className={fieldClass}
      />
      <input
        value={startup}
        onChange={(e) => setStartup(e.target.value)}
        placeholder="Startup name (optional)"
        className={`${fieldClass} mt-2`}
      />
      <input
        value={incorporation}
        onChange={(e) => setIncorporation(e.target.value)}
        placeholder="Incorporation number"
        className={`${fieldClass} mt-2`}
      />
      <InlineFileUpload
        label="Prototype evidence"
        files={files}
        onUpload={async (file) => {
          const body = new FormData();
          body.append('file', file);
          const r = await mutation('upload', {
            method: 'POST',
            body,
            isFormData: true,
            dedupe: false,
          });
          const item = r?.results?.data as { url?: string; filename?: string } | undefined;
          if (!item?.url) return false;
          setFiles([{ url: item.url, name: item.filename ?? file.name }]);
          return true;
        }}
      />
      <CustomButton
        className="mt-2 w-full"
        loading={isLoading}
        onClick={async () => {
          const r = await mutation(`iic/projects/${id}/outcome`, {
            method: 'PATCH',
            body: {
              outcome,
              startupName: startup || undefined,
              incorporationNumber: incorporation || undefined,
              prototypeUrl: files[0]?.url,
            },
          });
          if (r?.results?.success) onDone();
        }}
      >
        Record outcome
      </CustomButton>
    </Panel>
  );
}
function Stage({ value }: { value: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-600">
      {value.replace('_', ' ')}
    </span>
  );
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="mb-2 font-black text-slate-900">{title}</h3>
      {children}
    </section>
  );
}
function Modal({
  title,
  sub,
  children,
  onClose,
  wide,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm">
      <div
        className={`max-h-[94dvh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 ${wide ? 'max-w-6xl' : 'max-w-4xl'}`}
      >
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
              Guided IIC workflow
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{title}</h2>
            {sub && <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{sub}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

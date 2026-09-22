'use client';

import EngagementWorkflowBar from '@/shared/components/EngagementWorkflowBar';
import AsyncSelect from '@/shared/core/AsyncSelect';
import CustomButton from '@/shared/core/CustomButton';
import CustomTable, { Action, Column } from '@/shared/core/CustomTable';
import InlineFileUpload from '@/shared/core/InlineFileUpload';
import { IViewerFile } from '@/shared/core/FileViewer';
import useMutation from '@/shared/hooks/useMutation';
import useSwr from '@/shared/hooks/useSwr';
import { useHasPermission } from '@/shared/hooks/useHasPermission';
import { motion } from '@/shared/utils/motion';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Eye,
  HeartHandshake,
  Pencil,
  Plus,
  Send,
  Trash2,
  UserRoundCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

interface IPerson {
  _id: string;
  name?: string;
  email?: string;
}
interface IMember {
  userId: IPerson | string;
  role?: string;
  joinedAt: string;
}
interface IActivity {
  title: string;
  description?: string;
  date: string;
  participantCount?: number;
  proofUrl?: string;
  venue?: string;
  outcome?: string;
  budget?: number;
}
interface IClub extends Record<string, unknown> {
  _id: string;
  name: string;
  category: string;
  description?: string;
  isActive: boolean;
  facultyAdvisor?: IPerson | string;
  studentHead?: IPerson | string;
  members: IMember[];
  activities: IActivity[];
  establishedYear?: number;
}
interface IMembershipRequest extends Record<string, unknown> {
  _id: string;
  clubId: IClub | string;
  userId: IPerson | string;
  message?: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  requestedAt: string;
  decisionNote?: string;
}
interface IClubStats {
  total: number;
  active: number;
  pendingRequests: number;
  members: number;
  activities: number;
  participants: number;
  activityBudget: number;
  byCategory: Array<{ _id: string; count: number }>;
  activityTrend: Array<{ _id: string; count: number; participants: number }>;
}

const fieldClass =
  'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15';
const categories = [
  'technical',
  'cultural',
  'sports',
  'literary',
  'entrepreneurship',
  'social',
  'other',
];
const personId = (person?: IPerson | string) => (typeof person === 'string' ? person : person?._id);

export default function ClubsPage() {
  const canCreate = useHasPermission('clubs', 'create');
  const canEdit = useHasPermission('clubs', 'edit');
  const canApprove = useHasPermission('clubs', 'approve');
  const canDelete = useHasPermission('clubs', 'delete');
  const [tab, setTab] = useState<'overview' | 'clubs' | 'requests'>('overview');
  const { data: raw, isLoading, isValidating, mutate } = useSwr('club');
  const { data: statsRaw, isLoading: statsLoading, mutate: refreshStats } = useSwr('club/stats');
  const {
    data: requestsRaw,
    isLoading: requestsLoading,
    isValidating: requestsRefreshing,
    mutate: refreshRequests,
  } = useSwr('club/membership-requests/list');
  const { mutation, isLoading: saving } = useMutation();
  const clubs = (raw as { data?: IClub[] })?.data ?? [];
  const stats = (statsRaw as { data?: IClubStats })?.data;
  const requests = (requestsRaw as { data?: IMembershipRequest[] })?.data ?? [];
  const [editing, setEditing] = useState<IClub | null | undefined>(undefined);
  const [detailId, setDetailId] = useState<string | null>(null);

  const deactivate = async (club: IClub) => {
    const result = await Swal.fire({
      title: 'Deactivate this club?',
      text: `${club.name} stays in history, but new members and activities will be blocked.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Deactivate',
      confirmButtonColor: '#dc2626',
    });
    if (!result.isConfirmed) return;
    const response = await mutation(`club/${club._id}`, { method: 'DELETE' });
    if (!response?.results?.success) return;
    toast.success('Club deactivated');
    mutate();
  };
  const requestMembership = async (club: IClub) => {
    const result = await Swal.fire({
      title: `Join ${club.name}?`,
      input: 'textarea',
      inputLabel: 'Why would you like to join? (optional)',
      inputPlaceholder: 'Share your interests, skills or how you hope to contribute.',
      inputAttributes: { maxlength: '1000' },
      showCancelButton: true,
      confirmButtonText: 'Send request',
    });
    if (!result.isConfirmed) return;
    const response = await mutation(`club/${club._id}/join-request`, {
      method: 'POST',
      body: { message: String(result.value ?? '').trim() || undefined },
    });
    if (!response?.results?.success) return;
    toast.success('Membership request sent');
    await refreshRequests();
    setTab('requests');
  };

  const columns: Column<IClub>[] = [
    { field: 'name', title: 'Club', sortable: true },
    {
      field: 'category',
      title: 'Category',
      render: (row) => <span className="capitalize">{row.category}</span>,
    },
    {
      field: 'facultyAdvisor',
      title: 'Faculty advisor',
      render: (row) =>
        typeof row.facultyAdvisor === 'object' ? (row.facultyAdvisor.name ?? '—') : 'Not assigned',
    },
    { field: 'members', title: 'Members', render: (row) => row.members?.length ?? 0 },
    { field: 'activities', title: 'Activities', render: (row) => row.activities?.length ?? 0 },
    {
      field: 'isActive',
      title: 'Status',
      render: (row) => (
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            row.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];
  const actions: Action<IClub>[] = [
    {
      icon: <Eye size={15} />,
      tooltip: 'Open club workspace',
      onClick: (row) => setDetailId(row._id),
    },
    {
      icon: <Send size={15} />,
      tooltip: 'Request membership',
      onClick: requestMembership,
      hidden: (row) => !row.isActive,
    },
    {
      icon: <Pencil size={15} />,
      tooltip: 'Edit club',
      onClick: (row) => setEditing(row),
      hidden: (row) => !canEdit || !row.isActive,
    },
    {
      icon: <Trash2 size={15} />,
      tooltip: 'Deactivate club',
      onClick: deactivate,
      hidden: (row) => !canDelete || !row.isActive,
      className: 'text-red-500',
    },
  ];

  return (
    <div className="space-y-5 pb-8">
      <EngagementWorkflowBar />
      <header>
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
            <HeartHandshake className="h-4 w-4" /> Student engagement
          </p>
          <h1 className="mt-2 text-2xl font-black text-slate-900">Clubs & activities</h1>
          <p className="mt-1 text-sm text-slate-500">
            Assign leaders, maintain membership and preserve activity evidence.
          </p>
        </div>
      </header>
      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {[
          { key: 'overview' as const, label: 'Overview', icon: BarChart3 },
          { key: 'clubs' as const, label: 'Club directory', icon: HeartHandshake },
          {
            key: 'requests' as const,
            label: canApprove ? 'Membership requests' : 'My requests',
            icon: UserRoundCheck,
          },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${tab === key ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>
      {tab === 'overview' ? (
        <ClubsOverview stats={stats} loading={statsLoading} onRefresh={() => refreshStats()} />
      ) : tab === 'clubs' ? (
        <CustomTable
          data={clubs}
          columns={columns}
          actions={actions}
          isLoading={isLoading}
          isValidating={isValidating}
          title="Club directory"
          description="Active student communities, leadership, membership strength and activity history."
          onRefresh={() => mutate()}
          customActions={
            canCreate ? (
              <CustomButton
                startIcon={<Plus className="h-4 w-4" />}
                onClick={() => setEditing(null)}
              >
                Create club
              </CustomButton>
            ) : undefined
          }
          options={{ search: true, refresh: true, pagination: true, export: true }}
        />
      ) : (
        <MembershipRequestsTable
          data={requests}
          loading={requestsLoading}
          refreshing={requestsRefreshing}
          canApprove={canApprove}
          onRefresh={() => refreshRequests()}
          onChanged={async () => {
            await refreshRequests();
            await mutate();
            await refreshStats();
          }}
        />
      )}
      {editing !== undefined && (
        <ClubForm
          club={editing}
          saving={saving}
          onClose={() => setEditing(undefined)}
          onSave={async (body) => {
            const response = await mutation(editing ? `club/${editing._id}` : 'club', {
              method: editing ? 'PATCH' : 'POST',
              body,
            });
            if (!response?.results?.success) return;
            toast.success(editing ? 'Club updated' : 'Club created');
            await mutate();
            setEditing(undefined);
          }}
        />
      )}
      {detailId && (
        <ClubWorkspace
          clubId={detailId}
          canEdit={canEdit}
          onClose={() => setDetailId(null)}
          onChanged={mutate}
        />
      )}
    </div>
  );
}

function ClubsOverview({
  stats,
  loading,
  onRefresh,
}: {
  stats?: IClubStats;
  loading: boolean;
  onRefresh: () => void;
}) {
  const cards = [
    {
      label: 'Active clubs',
      value: stats?.active ?? 0,
      icon: HeartHandshake,
      tone: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Club members',
      value: stats?.members ?? 0,
      icon: Users,
      tone: 'bg-violet-50 text-violet-700',
    },
    {
      label: 'Activities delivered',
      value: stats?.activities ?? 0,
      icon: Activity,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Student participation',
      value: stats?.participants ?? 0,
      icon: UserRoundCheck,
      tone: 'bg-cyan-50 text-cyan-700',
    },
    {
      label: 'Pending requests',
      value: stats?.pendingRequests ?? 0,
      icon: Send,
      tone: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Activity expenditure',
      value: compactMoney(stats?.activityBudget ?? 0),
      icon: BarChart3,
      tone: 'bg-rose-50 text-rose-700',
    },
  ];
  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Student engagement overview</h2>
          <p className="text-sm text-slate-500">
            Institution-wide membership, activity participation and club portfolio health.
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
        {cards.map(({ label, value, icon: Icon, tone }, index) => (
          <motion.article
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: index * 0.035 }}
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
          </motion.article>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <AnalyticsPanel
          title="Activity momentum"
          description="Monthly activities and recorded student participation."
        >
          <ActivityTrend data={stats?.activityTrend ?? []} />
        </AnalyticsPanel>
        <AnalyticsPanel
          title="Club portfolio"
          description="Active communities grouped by engagement category."
        >
          <CategoryChart data={stats?.byCategory ?? []} />
        </AnalyticsPanel>
      </div>
    </section>
  );
}

function AnalyticsPanel({
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
      <div className="mt-5 overflow-x-auto">{children}</div>
    </article>
  );
}
function ActivityTrend({ data }: { data: IClubStats['activityTrend'] }) {
  if (!data.length)
    return (
      <AnalyticsEmpty text="Activity trends appear after clubs record their first activity." />
    );
  const visible = data.slice(-10),
    max = Math.max(...visible.map((item) => item.participants), 1),
    x = (index: number) => 38 + index * 57,
    y = (value: number) => 150 - (value / max) * 112,
    points = visible.map((item, index) => `${x(index)},${y(item.participants)}`).join(' ');
  return (
    <svg
      viewBox="0 0 600 185"
      role="img"
      aria-label="Monthly club participation trend"
      className="h-48 min-w-[520px] w-full"
    >
      <defs>
        <linearGradient id="clubTrend" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0178d7" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#0178d7" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[38, 75, 112, 150].map((line) => (
        <line
          key={line}
          x1="38"
          x2="552"
          y1={line}
          y2={line}
          stroke="#e2e8f0"
          strokeDasharray="4 5"
        />
      ))}
      <polygon points={`38,150 ${points} 552,150`} fill="url(#clubTrend)" />
      <polyline
        points={points}
        fill="none"
        stroke="#0178d7"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {visible.map((item, index) => (
        <g key={item._id}>
          <circle
            cx={x(index)}
            cy={y(item.participants)}
            r="4"
            fill="white"
            stroke="#0178d7"
            strokeWidth="2.5"
          >
            <title>{`${item.participants} participants across ${item.count} activities`}</title>
          </circle>
          <text x={x(index)} y="174" textAnchor="middle" fontSize="9" fill="#64748b">
            {item._id.slice(5)}
          </text>
        </g>
      ))}
    </svg>
  );
}
function CategoryChart({ data }: { data: IClubStats['byCategory'] }) {
  const max = Math.max(...data.map((item) => item.count), 1);
  return data.length ? (
    <div className="space-y-4">
      {data.map((item) => (
        <div key={item._id}>
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="capitalize text-slate-600">{item._id}</span>
            <strong>{item.count}</strong>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  ) : (
    <AnalyticsEmpty text="Club category insights will appear after clubs are created." />
  );
}
function AnalyticsEmpty({ text }: { text: string }) {
  return (
    <div className="grid min-h-36 place-items-center rounded-lg border border-dashed border-slate-200 px-5 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}
function compactMoney(value: number) {
  return `₹${new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`;
}

function MembershipRequestsTable({
  data,
  loading,
  refreshing,
  canApprove,
  onRefresh,
  onChanged,
}: {
  data: IMembershipRequest[];
  loading: boolean;
  refreshing: boolean;
  canApprove: boolean;
  onRefresh: () => void;
  onChanged: () => void | Promise<unknown>;
}) {
  const { mutation, isLoading } = useMutation();
  const decide = async (row: IMembershipRequest, decision: 'approved' | 'rejected') => {
    const result = await Swal.fire({
      title: decision === 'approved' ? 'Approve membership?' : 'Reject membership?',
      input: 'textarea',
      inputPlaceholder:
        decision === 'approved'
          ? 'Welcome note or assigned responsibility'
          : 'Explain the decision',
      inputValidator: (value) => (value.trim().length < 3 ? 'Add a meaningful note' : undefined),
      showCancelButton: true,
      confirmButtonText: decision === 'approved' ? 'Approve request' : 'Reject request',
    });
    if (!result.isConfirmed) return;
    const response = await mutation(`club/membership-requests/${row._id}/decision`, {
      method: 'PATCH',
      body: { decision, note: result.value },
    });
    if (!response?.results?.success) return;
    toast.success(decision === 'approved' ? 'Membership approved' : 'Membership request rejected');
    await onChanged();
  };
  const columns: Column<IMembershipRequest>[] = [
    {
      field: 'clubId',
      title: 'Club',
      render: (row) => (typeof row.clubId === 'object' ? row.clubId.name : 'Club'),
    },
    {
      field: 'userId',
      title: 'Applicant',
      render: (row) =>
        typeof row.userId === 'object' ? (
          <div>
            <p className="font-semibold text-slate-800">{row.userId.name ?? 'Applicant'}</p>
            <p className="text-xs text-slate-500">{row.userId.email}</p>
          </div>
        ) : (
          'Applicant'
        ),
    },
    { field: 'message', title: 'Interest', render: (row) => row.message || 'No message provided' },
    {
      field: 'requestedAt',
      title: 'Requested',
      render: (row) => new Date(row.requestedAt).toLocaleDateString('en-IN'),
    },
    { field: 'status', title: 'Status', render: (row) => <Status value={row.status} /> },
  ];
  const actions: Action<IMembershipRequest>[] = canApprove
    ? [
        {
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
          tooltip: 'Approve request',
          onClick: (row) => decide(row, 'approved'),
          hidden: (row) => row.status !== 'pending',
        },
        {
          icon: <XCircle className="h-4 w-4 text-rose-600" />,
          tooltip: 'Reject request',
          onClick: (row) => decide(row, 'rejected'),
          hidden: (row) => row.status !== 'pending',
        },
      ]
    : [];
  return (
    <CustomTable
      data={data}
      columns={columns}
      actions={actions}
      isLoading={loading || isLoading}
      isValidating={refreshing}
      title={canApprove ? 'Membership request queue' : 'My membership requests'}
      description={
        canApprove
          ? 'Review student interest and approve roster access with an auditable decision.'
          : 'Track the status of requests you submitted to active clubs.'
      }
      onRefresh={onRefresh}
      options={{ search: true, refresh: true, pagination: true, export: canApprove }}
    />
  );
}

function Status({ value }: { value: string }) {
  const tone =
    value === 'approved'
      ? 'bg-emerald-50 text-emerald-700'
      : value === 'rejected'
        ? 'bg-rose-50 text-rose-700'
        : 'bg-amber-50 text-amber-700';
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${tone}`}>
      {value}
    </span>
  );
}

function ClubForm({
  club,
  saving,
  onClose,
  onSave,
}: {
  club: IClub | null;
  saving: boolean;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(club?.name ?? '');
  const [category, setCategory] = useState(club?.category ?? 'technical');
  const [description, setDescription] = useState(club?.description ?? '');
  const [facultyAdvisor, setFacultyAdvisor] = useState(personId(club?.facultyAdvisor) ?? '');
  const [studentHead, setStudentHead] = useState(personId(club?.studentHead) ?? '');
  const [establishedYear, setEstablishedYear] = useState(club?.establishedYear?.toString() ?? '');
  return (
    <Modal title={club ? 'Edit club' : 'Create a club'} onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Club name *">
          <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Category *">
          <select
            className={fieldClass}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((value) => (
              <option key={value} value={value} className="capitalize">
                {value}
              </option>
            ))}
          </select>
        </Field>
        <AsyncSelect
          label="Faculty advisor"
          type="faculty"
          value={facultyAdvisor || null}
          onChange={(value) => setFacultyAdvisor(value ?? '')}
          placeholder="Search active faculty"
        />
        <AsyncSelect
          label="Student head"
          type="students"
          value={studentHead || null}
          onChange={(value) => setStudentHead(value ?? '')}
          placeholder="Search students"
        />
        <Field label="Established year">
          <input
            type="number"
            min="1900"
            max={new Date().getFullYear()}
            className={fieldClass}
            value={establishedYear}
            onChange={(e) => setEstablishedYear(e.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Purpose and description">
            <textarea
              rows={4}
              className={fieldClass}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <CustomButton variant="cancel" onClick={onClose}>
          Cancel
        </CustomButton>
        <CustomButton
          loading={saving}
          onClick={() => {
            if (name.trim().length < 2) return toast.error('Enter a club name');
            onSave({
              name: name.trim(),
              category,
              description: description.trim() || undefined,
              facultyAdvisor: facultyAdvisor || undefined,
              studentHead: studentHead || undefined,
              establishedYear: establishedYear ? Number(establishedYear) : undefined,
            });
          }}
        >
          {club ? 'Save changes' : 'Create club'}
        </CustomButton>
      </div>
    </Modal>
  );
}

function ClubWorkspace({
  clubId,
  canEdit,
  onClose,
  onChanged,
}: {
  clubId: string;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void | Promise<unknown>;
}) {
  const { data, mutate } = useSwr<{ data?: IClub }>(`club/${clubId}`);
  const { mutation, isLoading } = useMutation();
  const club = data?.data;
  const [memberId, setMemberId] = useState('');
  const [memberRole, setMemberRole] = useState('Member');
  const [activityTitle, setActivityTitle] = useState('');
  const [activityDate, setActivityDate] = useState('');
  const [participantCount, setParticipantCount] = useState('');
  const [activityVenue, setActivityVenue] = useState('');
  const [activityOutcome, setActivityOutcome] = useState('');
  const [activityBudget, setActivityBudget] = useState('');
  const [activityProof, setActivityProof] = useState<IViewerFile[]>([]);
  const refresh = async () => {
    await mutate();
    await onChanged();
  };
  return (
    <Modal title={club?.name ?? 'Club workspace'} onClose={onClose} wide>
      {!club ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl bg-slate-50 p-4">
            <h3 className="font-bold text-slate-900">Member roster</h3>
            <p className="mb-4 text-xs text-slate-500">Select people by name—IDs stay hidden.</p>
            {canEdit && club.isActive && (
              <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                <AsyncSelect
                  type="users"
                  value={memberId || null}
                  onChange={(value) => setMemberId(value ?? '')}
                  placeholder="Search a person"
                />
                <input
                  className={fieldClass}
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                  placeholder="Role"
                />
                <CustomButton
                  loading={isLoading}
                  onClick={async () => {
                    if (!memberId) return toast.error('Choose a member');
                    const response = await mutation(`club/${clubId}/members`, {
                      method: 'POST',
                      body: { userId: memberId, role: memberRole },
                    });
                    if (!response?.results?.success) return;
                    toast.success('Member added');
                    setMemberId('');
                    refresh();
                  }}
                >
                  Add
                </CustomButton>
              </div>
            )}
            <div className="mt-4 space-y-2">
              {(club.members ?? []).map((member) => {
                const id = personId(member.userId) ?? '';
                const label =
                  typeof member.userId === 'object'
                    ? (member.userId.name ?? member.userId.email)
                    : 'Member';
                return (
                  <div
                    key={id}
                    className="flex items-center justify-between rounded-xl bg-white p-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{label}</p>
                      <p className="text-xs text-slate-500">{member.role ?? 'Member'}</p>
                    </div>
                    {canEdit && club.isActive && (
                      <button
                        type="button"
                        aria-label={`Remove ${label}`}
                        className="text-red-500"
                        onClick={async () => {
                          const response = await mutation(`club/${clubId}/members/${id}`, {
                            method: 'DELETE',
                          });
                          if (response?.results?.success) refresh();
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
              {!club.members?.length && (
                <p className="py-4 text-center text-xs text-slate-600">No members added yet.</p>
              )}
            </div>
          </section>
          <section className="rounded-2xl bg-slate-50 p-4">
            <h3 className="font-bold text-slate-900">Activity evidence</h3>
            <p className="mb-4 text-xs text-slate-500">
              Record participation and outcomes after each activity.
            </p>
            {canEdit && club.isActive && (
              <div className="grid gap-2">
                <input
                  className={fieldClass}
                  value={activityTitle}
                  onChange={(e) => setActivityTitle(e.target.value)}
                  placeholder="Activity title"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    className={fieldClass}
                    value={activityDate}
                    onChange={(e) => setActivityDate(e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    className={fieldClass}
                    value={participantCount}
                    onChange={(e) => setParticipantCount(e.target.value)}
                    placeholder="Participants"
                  />
                </div>
                <input
                  className={fieldClass}
                  value={activityVenue}
                  onChange={(e) => setActivityVenue(e.target.value)}
                  placeholder="Venue or delivery mode"
                />
                <textarea
                  className={fieldClass}
                  rows={3}
                  value={activityOutcome}
                  onChange={(e) => setActivityOutcome(e.target.value)}
                  placeholder="Measured outcome, achievement or participant impact"
                />
                <input
                  type="number"
                  min="0"
                  className={fieldClass}
                  value={activityBudget}
                  onChange={(e) => setActivityBudget(e.target.value)}
                  placeholder="Activity expenditure (optional)"
                />
                <InlineFileUpload
                  compact
                  label="Activity report or photo evidence"
                  files={activityProof}
                  onRemove={async () => setActivityProof([])}
                  onUpload={async (file) => {
                    const body = new FormData();
                    body.append('file', file);
                    const response = await mutation('upload', {
                      method: 'POST',
                      body,
                      isFormData: true,
                      dedupe: false,
                    });
                    const uploaded = response?.results?.data as
                      | { url?: string; filename?: string }
                      | undefined;
                    if (!uploaded?.url) return false;
                    setActivityProof([{ url: uploaded.url, name: uploaded.filename ?? file.name }]);
                    return true;
                  }}
                />
                <CustomButton
                  loading={isLoading}
                  onClick={async () => {
                    if (!activityTitle.trim() || !activityDate)
                      return toast.error('Add activity title and date');
                    const response = await mutation(`club/${clubId}/activities`, {
                      method: 'POST',
                      body: {
                        title: activityTitle.trim(),
                        date: activityDate,
                        participantCount: participantCount ? Number(participantCount) : undefined,
                        venue: activityVenue.trim() || undefined,
                        outcome: activityOutcome.trim() || undefined,
                        budget: activityBudget ? Number(activityBudget) : undefined,
                        proofUrl: activityProof[0]?.url,
                      },
                    });
                    if (!response?.results?.success) return;
                    toast.success('Activity recorded');
                    setActivityTitle('');
                    setActivityDate('');
                    setParticipantCount('');
                    setActivityVenue('');
                    setActivityOutcome('');
                    setActivityBudget('');
                    setActivityProof([]);
                    refresh();
                  }}
                >
                  Record activity
                </CustomButton>
              </div>
            )}
            <div className="mt-4 space-y-2">
              {(club.activities ?? []).map((activity, index) => (
                <div key={`${activity.title}-${index}`} className="rounded-xl bg-white p-3">
                  <p className="text-sm font-semibold text-slate-800">{activity.title}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(activity.date).toLocaleDateString('en-IN')} ·{' '}
                    {activity.participantCount ?? 0} participants
                  </p>
                  {(activity.venue || activity.outcome) && (
                    <p className="mt-1 text-xs text-slate-600">
                      {activity.venue}
                      {activity.venue && activity.outcome ? ' · ' : ''}
                      {activity.outcome}
                    </p>
                  )}
                </div>
              ))}
              {!club.activities?.length && (
                <p className="py-4 text-center text-xs text-slate-600">
                  No activities recorded yet.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm">
      <div
        className={`max-h-[92dvh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 ${wide ? 'max-w-6xl' : 'max-w-4xl'}`}
      >
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
              Guided club workflow
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Maintain accountable leadership, membership and evidence-backed student engagement.
            </p>
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
